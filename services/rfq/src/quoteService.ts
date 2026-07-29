import {domain, typedData} from "./eip712";
import {
  Address,
  InventoryRiskCheck,
  NonceStore,
  RFQBackendSDKConfig,
  RFQPriceRequest,
  RFQQuote,
  RFQQuoteIntent,
  RFQQuoteRequest,
  RFQServiceConfig,
  SignedRFQQuote,
  TypedDataSigner
} from "./types";
import {
  assertHex,
  normalizeAddress,
  normalizeChainId,
  normalizeTtlSeconds,
  toPositiveUintString,
  toUintString
} from "./validation";
import {InMemoryNonceStore, NoopInventoryRiskCheck} from "./reference";

const DEFAULT_TTL_SECONDS = 60;

interface NormalizedQuoteIntent {
  taker: Address;
  tokenIn: Address;
  tokenOut: Address;
  amountIn: string;
  venue: Address;
  ttlSeconds: number;
}

export class RFQQuoteService {
  private readonly config: Required<Pick<RFQServiceConfig, "defaultTtlSeconds" | "now" | "nextNonce">> &
    Omit<RFQServiceConfig, "defaultTtlSeconds" | "now" | "nextNonce">;

  constructor(config: RFQServiceConfig, private readonly signer: TypedDataSigner) {
    const nextNonce = config.nextNonce ?? createMonotonicNonceGenerator();

    this.config = {
      defaultTtlSeconds: config.defaultTtlSeconds ?? DEFAULT_TTL_SECONDS,
      now: config.now ?? (() => Math.floor(Date.now() / 1000)),
      nextNonce,
      chainId: normalizeChainId(config.chainId),
      verifyingContract: normalizeAddress(config.verifyingContract, "verifyingContract")
    };
  }

  async createSignedQuote(request: RFQQuoteRequest): Promise<SignedRFQQuote> {
    const quote = this.createQuoteAt(request, normalizeTimestamp(await this.config.now()));
    const data = typedData(domain(this.config.chainId, this.config.verifyingContract), quote);
    const signature = assertHex(await this.signer.signTypedData(data), "signature");

    return {quote, signature, typedData: data};
  }

  createQuote(request: RFQQuoteRequest): RFQQuote {
    const now = this.config.now();
    if (now instanceof Promise) {
      throw new Error("async time source requires createSignedQuote()");
    }
    return this.createQuoteAt(request, normalizeTimestamp(now));
  }

  private createQuoteAt(request: RFQQuoteRequest, now: number): RFQQuote {
    const ttlSeconds = normalizeTtlSeconds(request.ttlSeconds ?? this.config.defaultTtlSeconds);

    return {
      maker: normalizeAddress(request.maker, "maker"),
      taker: normalizeAddress(request.taker, "taker"),
      tokenIn: normalizeAddress(request.tokenIn, "tokenIn"),
      tokenOut: normalizeAddress(request.tokenOut, "tokenOut"),
      amountIn: toPositiveUintString(request.amountIn, "amountIn"),
      amountOut: toPositiveUintString(request.amountOut, "amountOut"),
      venue: normalizeAddress(request.venue, "venue"),
      nonce: toUintString(request.nonce ?? this.config.nextNonce(), "nonce"),
      expiry: now + ttlSeconds
    };
  }
}

export class RFQBackendSDK {
  private readonly chainId: number;
  private readonly verifyingContract: Address;
  private readonly maker: Address;
  private readonly defaultTtlSeconds: number;
  private readonly now: () => number | Promise<number>;
  private readonly nonceStore: NonceStore;
  private readonly riskCheck: InventoryRiskCheck;

  constructor(private readonly config: RFQBackendSDKConfig) {
    this.chainId = normalizeChainId(config.chainId);
    this.verifyingContract = normalizeAddress(config.verifyingContract, "verifyingContract");
    this.maker = normalizeAddress(config.maker, "maker");
    this.defaultTtlSeconds = normalizeTtlSeconds(config.defaultTtlSeconds ?? DEFAULT_TTL_SECONDS);
    this.now = config.now ?? (() => Math.floor(Date.now() / 1000));
    this.nonceStore = config.nonceStore ?? new InMemoryNonceStore();
    this.riskCheck = config.riskCheck ?? new NoopInventoryRiskCheck();
  }

  async quote(intent: RFQQuoteIntent): Promise<SignedRFQQuote> {
    const normalized = this.normalizeIntent(intent);
    const priceRequest: RFQPriceRequest = {
      maker: this.maker,
      taker: normalized.taker,
      tokenIn: normalized.tokenIn,
      tokenOut: normalized.tokenOut,
      amountIn: normalized.amountIn,
      venue: normalized.venue
    };

    const priced = await this.config.pricing.price(priceRequest);
    const amountOut = toPositiveUintString(priced.amountOut, "amountOut");
    await this.riskCheck.check(priceRequest, {amountOut});
    const nonce = await this.nonceStore.nextNonce({
      maker: this.maker,
      taker: normalized.taker,
      tokenIn: normalized.tokenIn,
      tokenOut: normalized.tokenOut,
      venue: normalized.venue
    });

    const lowLevel = new RFQQuoteService(
      {
        chainId: this.chainId,
        verifyingContract: this.verifyingContract,
        defaultTtlSeconds: this.defaultTtlSeconds,
        now: this.now,
        nextNonce: () => nonce
      },
      this.config.signer
    );

    return lowLevel.createSignedQuote({
      maker: this.maker,
      taker: normalized.taker,
      tokenIn: normalized.tokenIn,
      tokenOut: normalized.tokenOut,
      amountIn: normalized.amountIn,
      amountOut,
      venue: normalized.venue,
      ttlSeconds: normalized.ttlSeconds,
      nonce
    });
  }

  private normalizeIntent(intent: RFQQuoteIntent): NormalizedQuoteIntent {
    return {
      taker: normalizeAddress(intent.taker, "taker"),
      tokenIn: normalizeAddress(intent.tokenIn, "tokenIn"),
      tokenOut: normalizeAddress(intent.tokenOut, "tokenOut"),
      amountIn: toPositiveUintString(intent.amountIn, "amountIn"),
      venue: normalizeAddress(intent.venue, "venue"),
      ttlSeconds: normalizeTtlSeconds(intent.ttlSeconds ?? this.defaultTtlSeconds)
    };
  }
}

export function createRFQService(config: RFQBackendSDKConfig): RFQBackendSDK {
  return new RFQBackendSDK(config);
}

function createMonotonicNonceGenerator(): () => bigint {
  let lastNonce = 0n;

  return () => {
    const candidate = BigInt(Date.now()) * 1000n;
    lastNonce = candidate > lastNonce ? candidate : lastNonce + 1n;
    return lastNonce;
  };
}

function normalizeTimestamp(value: number): number {
  if (!Number.isSafeInteger(value) || value < 0) throw new Error("time source must return a non-negative safe integer");
  return value;
}
