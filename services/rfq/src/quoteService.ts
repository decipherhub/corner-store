import {domain, typedData} from "./eip712";
import {Address, Hex, RFQQuote, RFQQuoteRequest, RFQServiceConfig, SignedRFQQuote, TypedDataSigner} from "./types";

const ADDRESS_RE = /^0x[a-fA-F0-9]{40}$/;
const HEX_RE = /^0x[a-fA-F0-9]*$/;
const DEFAULT_TTL_SECONDS = 60;

export class RFQQuoteService {
  private readonly config: Required<Pick<RFQServiceConfig, "defaultTtlSeconds" | "now" | "nextNonce">> &
    Omit<RFQServiceConfig, "defaultTtlSeconds" | "now" | "nextNonce">;

  constructor(config: RFQServiceConfig, private readonly signer: TypedDataSigner) {
    const nextNonce = config.nextNonce ?? createMonotonicNonceGenerator();

    this.config = {
      defaultTtlSeconds: config.defaultTtlSeconds ?? DEFAULT_TTL_SECONDS,
      now: config.now ?? (() => Math.floor(Date.now() / 1000)),
      nextNonce,
      chainId: config.chainId,
      verifyingContract: normalizeAddress(config.verifyingContract, "verifyingContract")
    };
  }

  async createSignedQuote(request: RFQQuoteRequest): Promise<SignedRFQQuote> {
    const quote = this.createQuote(request);
    const data = typedData(domain(this.config.chainId, this.config.verifyingContract), quote);
    const signature = assertHex(await this.signer.signTypedData(data), "signature");

    return {quote, signature, typedData: data};
  }

  createQuote(request: RFQQuoteRequest): RFQQuote {
    const ttlSeconds = request.ttlSeconds ?? this.config.defaultTtlSeconds;
    if (!Number.isInteger(ttlSeconds) || ttlSeconds <= 0) {
      throw new Error("ttlSeconds must be a positive integer");
    }

    return {
      maker: normalizeAddress(request.maker, "maker"),
      taker: normalizeAddress(request.taker, "taker"),
      tokenIn: normalizeAddress(request.tokenIn, "tokenIn"),
      tokenOut: normalizeAddress(request.tokenOut, "tokenOut"),
      amountIn: toPositiveUintString(request.amountIn, "amountIn"),
      amountOut: toPositiveUintString(request.amountOut, "amountOut"),
      venue: normalizeAddress(request.venue, "venue"),
      nonce: toUintString(request.nonce ?? this.config.nextNonce(), "nonce"),
      expiry: this.config.now() + ttlSeconds
    };
  }
}

function normalizeAddress(value: Address, field: string): Address {
  if (!ADDRESS_RE.test(value)) throw new Error(`${field} must be a 20-byte hex address`);
  return value.toLowerCase() as Address;
}

function assertHex(value: Hex, field: string): Hex {
  if (!HEX_RE.test(value)) throw new Error(`${field} must be hex`);
  return value;
}

function toUintString(value: bigint | string | number, field: string): string {
  const parsed = toBigInt(value, field);
  if (parsed < 0n) throw new Error(`${field} must be non-negative`);
  return parsed.toString();
}

function toPositiveUintString(value: bigint | string | number, field: string): string {
  const parsed = toBigInt(value, field);
  if (parsed <= 0n) throw new Error(`${field} must be positive`);
  return parsed.toString();
}

function toBigInt(value: bigint | string | number, field: string): bigint {
  if (typeof value === "number") {
    if (!Number.isSafeInteger(value)) {
      throw new Error(`${field} number input must be a safe integer; use bigint or decimal string for large values`);
    }
    return BigInt(value);
  }

  return typeof value === "bigint" ? value : BigInt(value);
}

function createMonotonicNonceGenerator(): () => bigint {
  let lastNonce = 0n;

  return () => {
    const candidate = BigInt(Date.now()) * 1000n;
    lastNonce = candidate > lastNonce ? candidate : lastNonce + 1n;
    return lastNonce;
  };
}
