export type Hex = `0x${string}`;
export type Address = Hex;
export type UintLike = bigint | string | number;

export interface RFQQuote {
  maker: Address;
  taker: Address;
  tokenIn: Address;
  tokenOut: Address;
  amountIn: string;
  amountOut: string;
  venue: Address;
  nonce: string;
  expiry: number;
}

export interface SignedRFQQuote {
  quote: RFQQuote;
  signature: Hex;
  typedData: RFQTypedData;
}

// Low-level request for callers that already know maker, amountOut and nonce policy.
export interface RFQQuoteRequest {
  maker: Address;
  taker: Address;
  tokenIn: Address;
  tokenOut: Address;
  amountIn: UintLike;
  amountOut: UintLike;
  venue: Address;
  ttlSeconds?: number;
  nonce?: UintLike;
}

// High-level request for integrators building an RFQ backend with this SDK.
export interface RFQQuoteIntent {
  taker: Address;
  tokenIn: Address;
  tokenOut: Address;
  amountIn: UintLike;
  venue: Address;
  ttlSeconds?: number;
}

export interface EIP712Domain {
  name: string;
  version: string;
  chainId: number;
  verifyingContract: Address;
}

export interface RFQTypedData {
  domain: EIP712Domain;
  types: {
    RFQQuote: Array<{ name: keyof RFQQuote; type: string }>;
  };
  primaryType: "RFQQuote";
  message: RFQQuote;
}

export interface TypedDataSigner {
  signTypedData(typedData: RFQTypedData): Promise<Hex>;
}

export interface NonceScope {
  maker: Address;
  taker: Address;
  tokenIn: Address;
  tokenOut: Address;
  venue: Address;
}

export interface NonceStore {
  nextNonce(scope: NonceScope): Promise<bigint> | bigint;
}

export interface RFQPriceRequest {
  maker: Address;
  taker: Address;
  tokenIn: Address;
  tokenOut: Address;
  amountIn: string;
  venue: Address;
}

export interface RFQFreshnessEvidence {
  snapshotId: string;
  version: string;
  observedAt: number;
  validUntil: number;
  available: boolean;
}

export interface RFQPrice extends Partial<RFQFreshnessEvidence> {
  amountOut: UintLike;
}

export interface PricingProvider {
  price(request: RFQPriceRequest): Promise<RFQPrice> | RFQPrice;
}

export interface RFQRiskDecision extends Partial<RFQFreshnessEvidence> {
  decision?: "passed" | "rejected";
  reason?: string;
}

export interface InventoryRiskCheck {
  check(request: RFQPriceRequest, price: { amountOut: string }): Promise<void | RFQRiskDecision> | void | RFQRiskDecision;
}

export interface RFQServiceConfig {
  chainId: number;
  verifyingContract: Address;
  defaultTtlSeconds?: number;
  now?: () => number | Promise<number>;
  nextNonce?: () => bigint;
}

export interface RFQBackendSDKConfig {
  chainId: number;
  verifyingContract: Address;
  maker: Address;
  signer: TypedDataSigner;
  pricing: PricingProvider;
  nonceStore?: NonceStore;
  riskCheck?: InventoryRiskCheck;
  defaultTtlSeconds?: number;
  now?: () => number | Promise<number>;
}

export const RFQ_MODULE_SCHEMA_VERSION = 1;

export type RFQModuleKind = "pricing" | "risk" | "signer" | "nonce";
export type RFQModuleMaturity = "reference" | "custom" | "production";

export interface RFQModuleDescriptor {
  schemaVersion: typeof RFQ_MODULE_SCHEMA_VERSION;
  id: string;
  version: string;
  kind: RFQModuleKind;
  capabilities: string[];
  maturity: RFQModuleMaturity;
  configKeys: string[];
  secretConfigKeys: string[];
}

export interface RFQModule<T> {
  descriptor: RFQModuleDescriptor;
  implementation: T;
}

export interface RFQModuleSet {
  pricing: RFQModule<PricingProvider>;
  risk: RFQModule<InventoryRiskCheck>;
  signer: RFQModule<TypedDataSigner>;
  nonce: RFQModule<NonceStore>;
}

export interface RFQModuleRuntimeConfig {
  chainId: number;
  verifyingContract: Address;
  maker: Address;
  modules: RFQModuleSet;
  defaultTtlSeconds?: number;
  now?: () => number | Promise<number>;
}
