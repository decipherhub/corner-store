import {JsonRpcError, JsonRpcPayload, JsonRpcProvider, JsonRpcResult, makeError} from "ethers";

const RATE_LIMITED = -32011;

// Spaces JSON-RPC items under the RPC provider's per-second limit and retries
// only the batch items the provider rejected as rate limited.
export class PacedJsonRpcProvider extends JsonRpcProvider {
  private nextSendAt = 0;
  private readonly maxQueueDelayMs: number;
  private readonly rateLimitRetryDelayMs: number;
  private readonly maxRateLimitRetries: number;

  constructor(
    url: string,
    private readonly requestsPerSecond: number,
    options: {maxQueueDelayMs?: number; rateLimitRetryDelayMs?: number; maxRateLimitRetries?: number} = {}
  ) {
    // A batch is sent at the start of its reserved slots, so any 1-second window can hold
    // requestsPerSecond items plus one batch. Half-size batches cap that at 1.5x the rate.
    super(url, undefined, {staticNetwork: true, batchMaxCount: Math.max(1, Math.floor(requestsPerSecond / 2))});
    this.maxQueueDelayMs = options.maxQueueDelayMs ?? 10_000;
    this.rateLimitRetryDelayMs = options.rateLimitRetryDelayMs ?? 1_000;
    this.maxRateLimitRetries = options.maxRateLimitRetries ?? 3;
  }

  // JsonRpcProvider declares only JsonRpcResult, but error results pass through at runtime.
  async _send(payload: JsonRpcPayload | Array<JsonRpcPayload>): Promise<Array<JsonRpcResult>> {
    let pending = Array.isArray(payload) ? payload : [payload];
    const results: Array<JsonRpcResult | JsonRpcError> = [];
    for (let attempt = 0; ; attempt += 1) {
      await this.reserve(pending.length);
      const response: Array<JsonRpcResult | JsonRpcError> = await super._send(
        Array.isArray(payload) ? pending : pending[0]
      );
      const limited = new Set(response.filter(isRateLimited).map((result) => result.id));
      const retry = pending.filter((item) => limited.has(item.id));
      if (retry.length === 0 || attempt >= this.maxRateLimitRetries) {
        return [...results, ...response] as Array<JsonRpcResult>;
      }
      results.push(...response.filter((result) => !limited.has(result.id)));
      pending = retry;
      this.nextSendAt = Math.max(this.nextSendAt, Date.now() + this.rateLimitRetryDelayMs);
    }
  }

  private async reserve(items: number): Promise<void> {
    const now = Date.now();
    const sendAt = Math.max(now, this.nextSendAt);
    // TIMEOUT lets the server classify an exhausted budget as a 503 dependency failure.
    if (sendAt - now > this.maxQueueDelayMs) {
      throw makeError("RPC request budget exhausted; retry shortly", "TIMEOUT", {
        operation: "send",
        reason: "rpc request budget"
      });
    }
    this.nextSendAt = sendAt + Math.ceil((items * 1000) / this.requestsPerSecond);
    if (sendAt > now) await new Promise((resolve) => setTimeout(resolve, sendAt - now));
  }
}

function isRateLimited(result: JsonRpcResult | JsonRpcError): result is JsonRpcError {
  return "error" in result && result.error?.code === RATE_LIMITED;
}
