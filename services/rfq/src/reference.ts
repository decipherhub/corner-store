import {NonceScope, NonceStore, PricingProvider, RFQPriceRequest, InventoryRiskCheck, UintLike} from "./types";
import {toBigInt, toPositiveUintString} from "./validation";

export class InMemoryNonceStore implements NonceStore {
  private readonly lastByScope = new Map<string, bigint>();

  nextNonce(scope: NonceScope): bigint {
    // RFQAdapter tracks usedQuoteNonce by maker => nonce, so the default store
    // must be maker-scoped rather than pair/taker-scoped. A production store may
    // add chainId/verifyingContract at the service boundary.
    const key = scope.maker;
    const nowBased = BigInt(Date.now()) * 1000n;
    const last = this.lastByScope.get(key) ?? 0n;
    const next = nowBased > last ? nowBased : last + 1n;
    this.lastByScope.set(key, next);
    return next;
  }
}

export class FixedRatePricingProvider implements PricingProvider {
  private readonly numerator: bigint;
  private readonly denominator: bigint;

  constructor(config: { numerator: UintLike; denominator: UintLike }) {
    this.numerator = toBigInt(config.numerator, "pricing numerator");
    this.denominator = toBigInt(config.denominator, "pricing denominator");
    if (this.numerator <= 0n) throw new Error("pricing numerator must be positive");
    if (this.denominator <= 0n) throw new Error("pricing denominator must be positive");
  }

  price(request: RFQPriceRequest): { amountOut: string } {
    const amountIn = BigInt(toPositiveUintString(request.amountIn, "amountIn"));
    const amountOut = (amountIn * this.numerator) / this.denominator;
    if (amountOut <= 0n) throw new Error("pricing provider returned zero amountOut");
    return {amountOut: amountOut.toString()};
  }
}

export class NoopInventoryRiskCheck implements InventoryRiskCheck {
  check(): void {
    // Reference/demo implementation only. Production operators must replace this.
  }
}
