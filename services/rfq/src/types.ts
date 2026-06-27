export type Hex = `0x${string}`;
export type Address = Hex;

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

export interface RFQQuoteRequest {
  maker: Address;
  taker: Address;
  tokenIn: Address;
  tokenOut: Address;
  amountIn: bigint | string | number;
  amountOut: bigint | string | number;
  venue: Address;
  ttlSeconds?: number;
  nonce?: bigint | string | number;
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

export interface RFQServiceConfig {
  chainId: number;
  verifyingContract: Address;
  defaultTtlSeconds?: number;
  now?: () => number;
  nextNonce?: () => bigint;
}
