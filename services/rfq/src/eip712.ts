import {EIP712Domain, RFQQuote, RFQTypedData} from "./types";

export const RFQ_DOMAIN_NAME = "CornerStoreRFQ";
export const RFQ_DOMAIN_VERSION = "2";

export const RFQ_QUOTE_TYPES: RFQTypedData["types"] = {
  RFQQuote: [
    {name: "maker", type: "address"},
    {name: "taker", type: "address"},
    {name: "tokenIn", type: "address"},
    {name: "tokenOut", type: "address"},
    {name: "amountIn", type: "uint256"},
    {name: "amountOut", type: "uint256"},
    {name: "venue", type: "address"},
    {name: "policyId", type: "bytes32"},
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

export const RFQ_DOMAIN_VERSION_V3 = "3";
export const RFQ_QUOTE_V3_TYPES: import("./types").RFQTypedDataV3["types"] = {
  RFQQuoteV3: [
    ...RFQ_QUOTE_TYPES.RFQQuote.slice(0, 8),
    {name: "flowType", type: "uint8"},
    {name: "affiliateEvidenceHash", type: "bytes32"},
    ...RFQ_QUOTE_TYPES.RFQQuote.slice(8)
  ]
};

export function domainV3(chainId: number, verifyingContract: EIP712Domain["verifyingContract"]): EIP712Domain {
  return {...domain(chainId, verifyingContract), version: RFQ_DOMAIN_VERSION_V3};
}

export function typedDataV3(domainValue: EIP712Domain, quote: import("./types").RFQQuoteV3): import("./types").RFQTypedDataV3 {
  if (domainValue.version !== RFQ_DOMAIN_VERSION_V3) throw new Error("RFQ v3 requires domain version 3");
  return {domain: domainValue, types: RFQ_QUOTE_V3_TYPES, primaryType: "RFQQuoteV3", message: quote};
}
