import {EIP712Domain, RFQQuote, RFQTypedData} from "./types";

export const RFQ_DOMAIN_NAME = "CornerStoreRFQ";
export const RFQ_DOMAIN_VERSION = "1";

export const RFQ_QUOTE_TYPES: RFQTypedData["types"] = {
  RFQQuote: [
    {name: "maker", type: "address"},
    {name: "taker", type: "address"},
    {name: "tokenIn", type: "address"},
    {name: "tokenOut", type: "address"},
    {name: "amountIn", type: "uint256"},
    {name: "amountOut", type: "uint256"},
    {name: "venue", type: "address"},
    {name: "nonce", type: "uint256"},
    {name: "expiry", type: "uint64"}
  ]
};

export function domain(chainId: number, verifyingContract: EIP712Domain["verifyingContract"]): EIP712Domain {
  return {
    name: RFQ_DOMAIN_NAME,
    version: RFQ_DOMAIN_VERSION,
    chainId,
    verifyingContract
  };
}

export function typedData(domainValue: EIP712Domain, quote: RFQQuote): RFQTypedData {
  return {
    domain: domainValue,
    types: RFQ_QUOTE_TYPES,
    primaryType: "RFQQuote",
    message: quote
  };
}
