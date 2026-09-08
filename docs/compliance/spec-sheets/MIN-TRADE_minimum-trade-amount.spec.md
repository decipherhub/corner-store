---
type: requirement-spec
project: RWA DEX (Giwa) · corner-store
element-id: MIN-TRADE-v1
element-name: Minimum Trade Amount
status: v1.0 (2026-09-08) — technical predicate; commercial/legal semantics require asset-level approval
implements: src/compliance/elements/MinimumTradeAmount.sol
stateful: false
review-required: product, legal
---

# MIN-TRADE-v1 — Minimum Trade Amount

## Purpose

Provide one reusable threshold predicate for assets whose approved commercial
terms require a minimum regulated-asset quantity. The Element is asset-neutral:
the amount is supplied by the token Manifest, not compiled into bytecode.

## Configuration

`ElementParameter("MIN-TRADE-v1", abi.encode(uint256 minimumAmount))`

- exactly one ABI-encoded nonzero `uint256`
- registry input is public, bounded to 256 bytes, unique by `elementId`, and must
  be used by a bound Recipe
- the bytes are included in the binding and aggregate compiled plan hashes
- changes use the normal delayed Manifest semantic-update lifecycle

## Evaluation

The Engine passes the regulated token amount (`amountOut` when the asset is
`tokenOut`, otherwise `amountIn`). v1 returns PASS iff `amount >= minimumAmount`.

| code | meaning |
|---:|---|
| 1 | parameter missing, malformed, or zero (fail closed) |
| 2 | regulated-asset trade amount is below the configured minimum |

## Composition

The Element's Recipe contains only `MIN-TRADE-v1`. Investor eligibility such as
Accredited Investor or Qualified Purchaser is expressed through separate Recipe
bindings. A BUIDL-like demo therefore composes:

1. Reg D 506(c)
2. ICA 3(c)(7)
3. Minimum Trade Amount

No BUIDL-specific logic exists below the demo Manifest/profile boundary.

## Scope warning

This version preserves the previous demo's per-trade, both-direction quantity
check. It does not assert that a real fund's published minimum means secondary
trade size, initial subscription, buy-only minimum, or post-trade balance. Those
semantics require a new reviewed Element/version and, where needed, NAV/oracle or
position state.
