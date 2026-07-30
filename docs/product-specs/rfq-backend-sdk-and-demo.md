# RFQ Backend SDK and MVP Demo Plan

## Status

SDK foundation and the local MVP demo backend are implemented.

## Purpose

Corner Store needs an off-chain RFQ component because a maker must price and sign quotes before a taker submits settlement through `ExecutionRouter` and `RFQAdapter`.

Corner Store should not provide or operate a production RFQ server. The product should provide:

1. TypeScript SDK pieces for integrators to build their own RFQ quote backend.
2. A local-only reference example that demonstrates those SDK pieces.
3. An MVP demo backend that uses the SDK from a user's point of view.

The separation matters: the SDK is reusable product infrastructure; the MVP backend is an application/demo built on top of it.

## Current baseline

Already implemented:

- Solidity `RFQAdapter` with EIP-712 quote verification.
- Router-only settlement path.
- full-fill / exact-taker v1 behavior.
- nonce, expiry, signature and quote-field binding tests.
- `services/rfq` minimal TypeScript quote signer reference.

Implemented:

- high-level `createRFQService(...).quote(...)` API.
- `NonceStore`, `PricingProvider`, and `InventoryRiskCheck` seams.
- local `InMemoryNonceStore`, `FixedRatePricingProvider`, and `NoopInventoryRiskCheck` reference implementations.
- validation helpers for addresses, chain id, TTL and on-chain integer values.
- `services/rfq/README.md` quick start and production responsibility boundary.
- `services/rfq-demo-backend` local HTTP quote API using the SDK reference seams.
- CLI `rfq-quote --backend` request, response validation and existing Router fill path.

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

Status: implemented in the SDK foundation branch.

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

Status: implemented by the SDK reference components and demo backend wiring.

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

Status: implemented as feature `DEMO-002`.

Goal: provide a demo backend that uses the RFQ SDK from a user's point of view.

The backend reuses the live-Anvil artifact and CLI instead of creating another
deployment path. The runner accepts `buidl-like` and `reg-d` asset profiles;
`buidl-like` is the default issue #40 demo while the Router, RFQ Adapter and
backend remain profile-agnostic.

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

Delivered:

- local `GET /health` and `POST /rfq/quote` HTTP API.
- deployment-artifact-bound pair, venue, maker and RFQ adapter configuration.
- fixed-rate SDK pricing, in-memory nonce and local Anvil signer fixtures.
- CLI `rfq-quote --backend` integration and quote-response validation.
- selectable `buidl-like | reg-d` deployment profile with BUIDL-like metadata,
  QP Recipe and minimum investment enabled by default. The deployment artifact
  remains authoritative during CLI re-onboarding, so a token cannot be rebound
  to a different/weaker profile through a CLI flag.
- automated runner coverage for backend quote → CLI → Router/RFQAdapter fill and
  revoked-maker rejection; dashboard remains a later issue.

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

## Follow-up boundary

Further RFQ work must be split from this demo application: production pricing,
signer integration, persistent nonce storage, inventory/risk controls, authentication,
rate limiting과 monitoring은 ADR-009를 따르는 별도 implementation feature다.
partial fill은 새 quote/adapter version 전까지 v1에서 허용하지 않는다.

## Phase 4 — Modular integration toolkit

Status: implemented by `SDK-001`.

- pricing, risk, signer and nonce modules declare versioned capabilities.
- reference and custom module sets run the same conformance suite.
- CLI scaffolds a minimal reference service or an existing-backend composition.
- generated configuration lists secret environment variable names but contains
  no secret values.
- Docker Compose is an optional reference export, not a required deployment
  architecture.

Hosted dealer operation, production pricing/inventory, signer custody and
Kubernetes remain outside this phase.
