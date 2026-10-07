import {IncomingMessage, ServerResponse, createServer} from "http";
import {readFileSync} from "fs";
import {resolve} from "path";
import {getAddress} from "ethers";

import {TestnetRfqRuntime, TradeSide, buildRouterRequest} from "./runtime";

const MAX_BODY = 16 * 1024;

export async function startServer(runtime: TestnetRfqRuntime) {
  const publicDir = resolve(__dirname, "../../../public");
  const ethersBundle = resolve(__dirname, "../../../node_modules/ethers/dist/ethers.umd.min.js");
  const quoteLimiter = new InMemoryRateLimiter(runtime.config.quoteRequestsPerMinute);
  const server = createServer((req, res) => void handle(req, res, runtime, publicDir, ethersBundle, quoteLimiter));
  await new Promise<void>((resolveListen, reject) => {
    server.once("error", reject);
    server.listen(runtime.config.port, runtime.config.host, () => {
      server.off("error", reject);
      resolveListen();
    });
  });
  return server;
}

async function handle(
  req: IncomingMessage,
  res: ServerResponse,
  runtime: TestnetRfqRuntime,
  publicDir: string,
  ethersBundle: string,
  quoteLimiter: InMemoryRateLimiter
) {
  try {
    if (req.method === "GET" && req.url === "/health") {
      const blockNumber = await runtime.provider.getBlockNumber();
      return json(res, 200, {service: "corner-store-testnet-rfq-demo", status: "ok", blockNumber});
    }
    if (req.method === "GET" && req.url === "/") return sendFile(res, resolve(publicDir, "index.html"), "text/html");
    if (req.method === "GET" && req.url === "/app.js") return sendFile(res, resolve(publicDir, "app.js"), "text/javascript");
    if (req.method === "GET" && req.url === "/styles.css") return sendFile(res, resolve(publicDir, "styles.css"), "text/css");
    if (req.method === "GET" && req.url === "/vendor/ethers.js") return sendFile(res, ethersBundle, "text/javascript");
    if (req.method === "GET" && req.url === "/api/state") return json(res, 200, await runtime.publicState());

    if (req.method === "GET" && req.url?.startsWith("/api/wallet/")) {
      return json(res, 200, await runtime.walletState(getAddress(decodeURIComponent(req.url.slice(12)))));
    }

    if (req.method === "POST" && req.url === "/api/precheck") {
      const body = await bodyJson(req);
      return json(res, 200, await runtime.precheck(
        address(body.taker, "taker"),
        uintString(body.amountIn, "amountIn"),
        side(body.side)
      ));
    }

    if (req.method === "POST" && req.url === "/api/quote") {
      const rate = quoteLimiter.check(req.socket.remoteAddress ?? "unknown", Date.now());
      if (!rate.allowed) {
        res.setHeader("Retry-After", String(rate.retryAfterSeconds));
        return json(res, 429, {error: "rate_limited"});
      }
      const body = await bodyJson(req);
      const signed = await runtime.quoteFor(
        address(body.taker, "taker"),
        uintString(body.amountIn, "amountIn"),
        side(body.side),
        optionalPositiveInteger(body.ttlSeconds, "ttlSeconds")
      );
      const latest = await runtime.provider.getBlock("latest");
      if (!latest) throw new Error("latest block is unavailable");
      const routerNonce = BigInt(`0x${cryptoRandomHex(24)}`);
      const deadline = BigInt(latest.timestamp + 3600);
      return json(res, 200, {
        signed,
        execution: {
          inputToken: signed.quote.tokenIn,
          spender: runtime.config.artifact.rfqAdapter,
          router: runtime.config.artifact.router,
          request: buildRouterRequest(runtime.config, signed, routerNonce, deadline)
        }
      });
    }

    return json(res, 404, {error: "not_found"});
  } catch (error) {
    return json(res, 400, {
      error: "invalid_request",
      message: error instanceof Error ? error.message : "unknown error"
    });
  }
}

function sendFile(res: ServerResponse, path: string, type: string) {
  const content = readFileSync(path);
  securityHeaders(res);
  res.writeHead(200, {
    "content-type": `${type}; charset=utf-8`,
    "content-length": content.length,
    "cache-control": "no-store"
  });
  res.end(content);
}

function json(res: ServerResponse, status: number, value: unknown) {
  const content = Buffer.from(`${JSON.stringify(value)}\n`);
  securityHeaders(res);
  res.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "content-length": content.length,
    "cache-control": "no-store"
  });
  res.end(content);
}

function securityHeaders(res: ServerResponse) {
  res.setHeader("Content-Security-Policy", "default-src 'self'; script-src 'self'; style-src 'self'; connect-src 'self'; img-src 'self' data:; frame-ancestors 'none'; base-uri 'none'; form-action 'self'");
  res.setHeader("Referrer-Policy", "no-referrer");
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
}

export class InMemoryRateLimiter {
  private readonly entries = new Map<string, {windowStartMs: number; count: number}>();

  constructor(private readonly maximum: number, private readonly windowMs = 60_000) {}

  check(key: string, nowMs: number): {allowed: boolean; retryAfterSeconds: number} {
    const current = this.entries.get(key);
    if (!current || nowMs - current.windowStartMs >= this.windowMs) {
      this.entries.set(key, {windowStartMs: nowMs, count: 1});
      this.prune(nowMs);
      return {allowed: true, retryAfterSeconds: 0};
    }
    if (current.count >= this.maximum) {
      return {
        allowed: false,
        retryAfterSeconds: Math.max(1, Math.ceil((this.windowMs - (nowMs - current.windowStartMs)) / 1000))
      };
    }
    current.count += 1;
    return {allowed: true, retryAfterSeconds: 0};
  }

  private prune(nowMs: number) {
    if (this.entries.size <= 1_024) return;
    for (const [key, value] of this.entries) {
      if (nowMs - value.windowStartMs >= this.windowMs) this.entries.delete(key);
    }
  }
}

async function bodyJson(req: IncomingMessage): Promise<Record<string, unknown>> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of req) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    size += buffer.length;
    if (size > MAX_BODY) throw new Error("request body exceeds 16 KiB");
    chunks.push(buffer);
  }
  const value = JSON.parse(Buffer.concat(chunks).toString("utf8"));
  if (typeof value !== "object" || value === null || Array.isArray(value)) throw new Error("JSON object required");
  return value as Record<string, unknown>;
}

function address(value: unknown, label: string) {
  if (typeof value !== "string") throw new Error(`${label} is required`);
  return getAddress(value);
}

function uintString(value: unknown, label: string) {
  if (typeof value !== "string" || !/^\d+$/.test(value) || BigInt(value) <= 0n) {
    throw new Error(`${label} must be a positive uint string`);
  }
  return value;
}

function side(value: unknown): TradeSide {
  if (value === "buy" || value === "sell") return value;
  throw new Error("side must be buy or sell");
}

function optionalPositiveInteger(value: unknown, label: string): number | undefined {
  if (value === undefined) return undefined;
  if (!Number.isSafeInteger(value) || Number(value) <= 0) throw new Error(`${label} must be a positive integer`);
  return Number(value);
}

function cryptoRandomHex(bytes: number): string {
  return require("crypto").randomBytes(bytes).toString("hex");
}
