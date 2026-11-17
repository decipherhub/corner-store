import {domain, typedData, domainV3, typedDataV3} from "./eip712";
import {
  Address,
  Hex,
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
  normalizeBytes32,
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
  policyId: Hex;
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
      policyId: normalizeBytes32(request.policyId, "policyId"),
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
      policyId: normalized.policyId,
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
      policyId: normalizeBytes32(intent.policyId, "policyId"),
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

export function normalizeFlowType(value: unknown): 0 | 1 {
  if (value !== 0 && value !== 1) throw new Error("unsupported RFQ v3 flowType");
  return value;
}

export class RFQQuoteServiceV3 {
  private readonly legacy: RFQQuoteService;
  constructor(private readonly config: RFQServiceConfig, private readonly signer: import("./types").TypedDataSignerV3) {
    this.legacy = new RFQQuoteService({...config, now: () => 0}, {signTypedData: async () => "0x"});
  }

  async createSignedQuote(request: import("./types").RFQQuoteRequestV3): Promise<import("./types").SignedRFQQuoteV3> {
    const flowType = normalizeFlowType(request.flowType);
    const affiliateEvidenceHash = normalizeBytes32(request.affiliateEvidenceHash, "affiliateEvidenceHash");
    const now = normalizeTimestamp(await (this.config.now?.() ?? Math.floor(Date.now() / 1000)));
    const normalized = this.legacy.createQuote(request);
    const quote = {...normalized, expiry: now + normalized.expiry, flowType, affiliateEvidenceHash};
    validateRFQQuoteV3(quote);
    const data = typedDataV3(domainV3(normalizeChainId(this.config.chainId), normalizeAddress(this.config.verifyingContract, "verifyingContract")), quote);
    return {quote, typedData: data, signature: assertHex(await this.signer.signTypedData(data), "signature")};
  }
}

export class RFQBackendSDKV3 {
  private readonly nonces: NonceStore;
  constructor(private readonly config: import("./types").RFQBackendSDKConfigV3) {
    normalizeChainId(config.chainId);
    normalizeAddress(config.verifyingContract, "verifyingContract");
    normalizeAddress(config.maker, "maker");
    this.nonces = config.nonceStore ?? new InMemoryNonceStore();
  }

  async quote(intent: import("./types").RFQQuoteIntentV3): Promise<import("./types").SignedRFQQuoteV3> {
    const flowType = normalizeFlowType(intent.flowType);
    const request = {
      maker: normalizeAddress(this.config.maker, "maker"), taker: normalizeAddress(intent.taker, "taker"),
      tokenIn: normalizeAddress(intent.tokenIn, "tokenIn"), tokenOut: normalizeAddress(intent.tokenOut, "tokenOut"),
      amountIn: toPositiveUintString(intent.amountIn, "amountIn"), venue: normalizeAddress(intent.venue, "venue")
    };
    const price = await this.config.pricing.price(request);
    const amountOut = toPositiveUintString(price.amountOut, "amountOut");
    const risk = await (this.config.riskCheck ?? new NoopInventoryRiskCheck()).check(request, {amountOut});
    if (risk?.decision === "rejected") throw new Error("risk rejected");
    const full = {...request, amountOut, policyId: normalizeBytes32(intent.policyId, "policyId"), ttlSeconds: intent.ttlSeconds, flowType};
    const nonce = await this.nonces.nextNonce(request);
    const evidence = validateRFQContextEvidence(await this.config.context.resolve({...full, nonce}));
    return new RFQQuoteServiceV3(this.config, this.config.signer).createSignedQuote({...full, nonce, affiliateEvidenceHash: evidence.affiliateEvidenceHash});
  }
}

export function createRFQServiceV3(config: import("./types").RFQBackendSDKConfigV3): RFQBackendSDKV3 {
  return new RFQBackendSDKV3(config);
}

export function validateRFQContextEvidence(value: import("./types").RFQContextEvidence): import("./types").RFQContextEvidence {
  if (!value || value.contextVersion !== 1 || typeof value.sellerIsAffiliate !== "boolean") throw new Error("invalid context evidence");
  return {contextVersion: 1, configurationHash: normalizeBytes32(value.configurationHash, "configurationHash"), affiliateEvidenceHash: normalizeBytes32(value.affiliateEvidenceHash, "affiliateEvidenceHash"), sellerIsAffiliate: value.sellerIsAffiliate};
}

export function validateRFQQuoteV3(quote: import("./types").RFQQuoteV3): void {
  for (const key of ["maker", "taker", "tokenIn", "tokenOut", "venue"] as const) {
    if (/^0x0{40}$/i.test(normalizeAddress(quote[key], key))) throw new Error(`${key} must be nonzero`);
  }
  if (quote.tokenIn.toLowerCase() === quote.tokenOut.toLowerCase()) throw new Error("RFQ v3 requires distinct token legs");
  for (const key of ["amountIn", "amountOut", "nonce"] as const) {
    const amount = BigInt(toUintString(quote[key], key));
    if (amount >= (1n << 256n) || (key !== "nonce" && amount === 0n)) throw new Error(`${key} is outside uint256 bounds`);
  }
  if (!Number.isSafeInteger(quote.expiry) || quote.expiry < 0) throw new Error("quote expiry must be a nonnegative safe integer");
  normalizeFlowType(quote.flowType);
  normalizeBytes32(quote.affiliateEvidenceHash, "affiliateEvidenceHash");
  normalizeBytes32(quote.policyId, "policyId");
}
