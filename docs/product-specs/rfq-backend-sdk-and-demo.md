# RFQ Backend SDK and MVP Demo Plan

## Status

Planned. This document defines scope before implementation.

## Purpose

Corner Store needs an off-chain RFQ component because a maker must price and sign quotes before a taker submits settlement through `ExecutionRouter` and `RFQAdapter`.

Corner Store should not provide or operate a production RFQ server. The product should provide:

1. TypeScript SDK pieces for integrators to build their own RFQ quote backend.
2. A local-only reference example that demonstrates those SDK pieces.
3. A later MVP demo backend that uses the SDK from a user's point of view.

The separation matters: the SDK is reusable product infrastructure; the MVP backend is an application/demo built on top of it.

## Current baseline

Already implemented:

- Solidity `RFQAdapter` with EIP-712 quote verification.
- Router-only settlement path.
- full-fill / exact-taker v1 behavior.
- nonce, expiry, signature and quote-field binding tests.
- `services/rfq` minimal TypeScript quote signer reference.

Current gap on `main` before the stacked PRs land:

- `services/rfq` is not yet shaped as a backend SDK.
- signer, nonce, pricing and risk boundaries are not explicit enough for reuse.
- there is no MVP user-facing RFQ backend flow yet.

Open PR context to preserve when planning implementation:

- PR #24 adds RFQ maker approval and quote cancellation hardening.
- PR #28 adds protected-router RFQ integration scenarios.
- PR #29 adds a live-Anvil E2E runner and scripted demo vehicle.
- PR #30 adds an interactive CLI using the deployed stack and RFQ quote path.
- PR #35 adds the BUIDL-like ERC-3643 compliance fixture with mock TA facts.

Those PRs should be treated as pending upstream context. The RFQ SDK work should
not duplicate their contract tests, E2E runner, CLI, or BUIDL fixture; it should
provide the reusable TypeScript backend boundary those layers can call.

## Layering

```text
src/execution/adapters/rfq/RFQAdapter.sol
  -> on-chain settlement, signature verification, replay/expiry checks

services/rfq SDK
  -> quote construction, typed-data shape, validation, signing abstractions

local reference example
  -> mock pricing + in-memory nonce + local signer for integration guidance

MVP demo backend
  -> user-facing quote API built from the SDK for demos only
```

## Phase 1 — RFQ TypeScript SDK interfaces

Goal: make `services/rfq` usable as the reusable quote-backend integration layer.

Deliverables:

- SDK interfaces:
  - `TypedDataSigner`
  - `NonceStore`
  - `PricingProvider`
  - `InventoryRiskCheck` placeholder
- quote request/response validation:
  - address format
  - safe integer / bigint / decimal string amount handling
  - positive amount checks
  - TTL and expiry checks
  - chainId and verifyingContract binding
  - venue binding
- keep EIP-712 typed-data generation compatible with `RFQAdapter`.
- keep backend compliance as a non-goal; final compliance remains at fill time in `ExecutionRouter`.
- local reference implementation:
  - in-memory nonce store
  - fixed/mock pricing provider
  - capture/mock signer for tests
- tests for:
  - quote generation
  - invalid request rejection
  - unsafe number rejection
  - nonce uniqueness
  - typed-data shape compatibility

Acceptance criteria:

- `cd services/rfq && npm test` passes.
- repo-level check includes the RFQ service test.
- docs clearly state this is an SDK layer, not a production server.

## Phase 2 — Local reference example

Goal: show how an operator would wire the SDK without implying Corner Store operates the backend.

Deliverables:

- local-only example entrypoint under `services/rfq`.
- mock pricing.
- in-memory nonce.
- test signer or local private-key signer clearly marked as non-production.
- sample request/response for signed quote generation.

Non-goals:

- no hosted server.
- no production key custody.
- no market-making strategy.
- no inventory management.
- no compliance final decision.
- no dashboard.

Acceptance criteria:

- a developer can run a local command to produce a signed quote payload compatible with `RFQAdapter`.
- documentation explains which parts an operator must replace in production.

## Phase 3 — MVP demo backend

Goal: provide a demo backend that uses the RFQ SDK from a user's point of view.

This is separate from the SDK issue and should be implemented after Phase 1. If
PR #29/#30 are merged first, this backend should reuse the live-Anvil demo
runner and CLI configuration instead of creating another deployment/demo path.
If PR #35 is merged first, the BUIDL-like asset should be the default regulated
asset scenario for this demo backend.

Target demo flow:

```text
user requests quote
  -> MVP backend calls RFQ SDK
  -> mock maker prices and signs quote
  -> user receives signed quote
  -> user submits through ExecutionRouter/RFQAdapter
  -> on-chain compliance passes or rejects
  -> UI/CLI shows result
```

Potential deliverables:

- local HTTP API or CLI wrapper.
- `/quote`-style request/response shape if HTTP is chosen.
- BUIDL-like demo asset pair config.
- integration guide for local Anvil/Foundry deployment.
- optional later dashboard issue.

MVP backend non-goals:

- no production RFQ operator service.
- no real market maker.
- no real custody.
- no production signer/key-management claims.
- no backend-side compliance override.

Acceptance criteria:

- demo flow can generate a quote and settle it through the protected Router path.
- success and compliance rejection cases are both visible.
- documentation states that production operators must replace pricing, signer custody, nonce persistence and risk controls.


## Documentation audit notes

This planning pass checked the product-spec index, roadmap, RFQ venue architecture,
feature state, progress notes and open PRs #24, #28, #29, #30 and #35. The gaps
found in current source-of-truth docs were:

- RFQ backend SDK work was not explicitly separated from production RFQ server operation.
- MVP demo backend was not listed as a later application/demo layer built on the SDK.
- near-term roadmap issues jumped from RFQ v1 settlement to production hardening, skipping the SDK and demo-backend bridge.
- pending E2E/CLI/BUIDL PRs were not called out as context for future RFQ backend planning.

This document fills those gaps. Production RFQ hardening remains a separate track
for dealer approval, custody, cancellation and partial-fill policy.

## Product boundary

RFQ backend responsibilities remain split:

| Area | Corner Store provides | Operator provides in production |
| --- | --- | --- |
| Quote format | SDK and tests | integration into their backend |
| EIP-712 typed data | SDK | signer custody and policy |
| Pricing | mock/reference only | actual pricing strategy |
| Nonce | interface + in-memory demo | persistent nonce store |
| Inventory/risk | placeholder interface | actual inventory and risk controls |
| Compliance | on-chain final gate | optional precheck only |
| Hosting | none | operator-owned infrastructure |

## First implementation issue

Recommended first issue:

```text
feat(rfq): add TypeScript SDK interfaces for quote backend integration
```

That issue should not implement the MVP backend. It should prepare the SDK foundation the MVP backend will use.
