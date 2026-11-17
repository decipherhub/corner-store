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
  policyId: Hex;
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
  policyId: Hex;
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
  policyId: Hex;
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

export interface RFQQuoteV3 extends RFQQuote {
  flowType: 0 | 1;
  affiliateEvidenceHash: Hex;
}

export interface RFQTypedDataV3 {
  domain: EIP712Domain;
  types: {RFQQuoteV3: Array<{name: keyof RFQQuoteV3; type: string}>};
  primaryType: "RFQQuoteV3";
  message: RFQQuoteV3;
}

export interface SignedRFQQuoteV3 {
  quote: RFQQuoteV3;
  signature: Hex;
  typedData: RFQTypedDataV3;
}

export interface TypedDataSignerV3 {
  signTypedData(typedData: RFQTypedDataV3): Promise<Hex>;
}

export interface RFQQuoteRequestV3 extends RFQQuoteRequest {
  flowType: 0 | 1;
  affiliateEvidenceHash: Hex;
}

export interface RFQQuoteIntentV3 extends RFQQuoteIntent {
  flowType: 0 | 1;
}

export interface RFQContextEvidence {
  contextVersion: 1;
  configurationHash: Hex;
  affiliateEvidenceHash: Hex;
  sellerIsAffiliate: boolean;
}

export interface RFQContextResolver {
  resolve(request: RFQQuoteRequest & {flowType: 0 | 1}): Promise<RFQContextEvidence>;
}

export interface RFQBackendSDKConfigV3 extends Omit<RFQBackendSDKConfig, "signer"> {
  signer: TypedDataSignerV3;
  context: RFQContextResolver;
}

export type RFQModuleSetV3 = Omit<RFQModuleSet, "signer"> & {signer: RFQModule<TypedDataSignerV3>};
export interface RFQModuleRuntimeConfigV3 extends Omit<RFQBackendSDKConfigV3, "signer" | "pricing"> {
  modules: RFQModuleSetV3;
}
