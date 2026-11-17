import {Address, Hex} from "./types";
import {normalizeAddress, normalizeBytes32, normalizeTtlSeconds} from "./validation";
import {RFQCoordinatorError} from "./errors";

export const DEFAULT_QUOTE_TTL_SECONDS = 60;
export const DEFAULT_MAX_QUOTE_TTL_SECONDS = 300;
export const MAX_QUOTE_TTL_SECONDS = 3600;
const MAX_PRODUCTS = 256;

export interface RFQAuthorizedProduct {
  maker: Address;
  tokenIn: Address;
  tokenOut: Address;
  venue: Address;
  policyId: Hex;
  capability: "rfq.quote.v2" | "rfq.quote.v3";
  flowType: 0 | 1;
}

export interface RFQProductAuthorization extends RFQAuthorizedProduct {
  schemaVersion: 1;
  chainId: number;
  adapter: Address;
}

export function quoteLifetimePolicy(defaultTtlSeconds: number = DEFAULT_QUOTE_TTL_SECONDS, maxTtlSeconds: number = DEFAULT_MAX_QUOTE_TTL_SECONDS) {
  try {
    normalizeTtlSeconds(maxTtlSeconds, MAX_QUOTE_TTL_SECONDS);
    normalizeTtlSeconds(defaultTtlSeconds, maxTtlSeconds);
    return {defaultTtlSeconds, maxTtlSeconds};
  } catch {
    throw new RFQCoordinatorError("CONFIGURATION_INVALID", "invalid quote lifetime configuration");
  }
}

export class RFQProductCatalog {
  private readonly products: RFQAuthorizedProduct[];

  constructor(products: readonly RFQAuthorizedProduct[]) {
    try {
      if (!Array.isArray(products) || products.length === 0 || products.length > MAX_PRODUCTS) throw new Error("invalid catalog size");
      const seen = new Set<string>();
      this.products = products.map((product) => {
        if (!product || !["rfq.quote.v2", "rfq.quote.v3"].includes(product.capability) || ![0, 1].includes(product.flowType)) throw new Error("invalid capability/flow");
        if (product.capability === "rfq.quote.v2" && product.flowType !== 0) throw new Error("v2 requires secondary flow");
        const normalized: RFQAuthorizedProduct = {
          maker: normalizeAddress(product.maker, "maker"),
          tokenIn: normalizeAddress(product.tokenIn, "tokenIn"),
          tokenOut: normalizeAddress(product.tokenOut, "tokenOut"),
          venue: normalizeAddress(product.venue, "venue"),
          policyId: normalizeBytes32(product.policyId, "policyId"),
          capability: product.capability,
          flowType: product.flowType
        };
        if ([normalized.maker, normalized.tokenIn, normalized.tokenOut, normalized.venue].some((a) => /^0x0{40}$/.test(a)) || normalized.tokenIn === normalized.tokenOut) throw new Error("invalid product actors/pair");
        const key = JSON.stringify({...normalized, policyId: undefined});
        if (seen.has(key)) throw new Error("ambiguous product");
        seen.add(key);
        return normalized;
      });
    } catch {
      throw new RFQCoordinatorError("CONFIGURATION_INVALID", "invalid RFQ product catalog");
    }
  }

  authorize(input: Omit<RFQProductAuthorization, "schemaVersion" | "policyId">): RFQProductAuthorization {
    const product = this.products.find((p) => p.maker === input.maker && p.venue === input.venue && p.tokenIn === input.tokenIn && p.tokenOut === input.tokenOut && p.capability === input.capability && p.flowType === input.flowType);
    if (!product) throw new RFQCoordinatorError("PRODUCT_UNAUTHORIZED", "RFQ product is not authorized");
    return {schemaVersion: 1, chainId: input.chainId, adapter: input.adapter, ...product};
  }
}
