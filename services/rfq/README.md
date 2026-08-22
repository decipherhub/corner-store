# Corner Store RFQ TypeScript SDK

`services/rfq` provides TypeScript helpers for building an RFQ quote backend that is compatible with Corner Store's on-chain `RFQAdapter`.

It is **not** a production RFQ server and Corner Store does not operate a hosted RFQ backend. Operators are responsible for hosting, pricing, signer custody, persistent nonces, inventory/risk controls and any optional off-chain prechecks.

## What the SDK does

- Builds the RFQ quote shape expected by `RFQAdapter`.
- Builds the EIP-712 typed data with the correct domain and field order.
- Binds quotes to `chainId`, `verifyingContract`, maker, taker, token pair, venue, nonce and expiry.
- Rejects unsafe JavaScript `number` inputs for on-chain integer fields.
- Provides high-level quote flow hooks for pricing, nonce and risk components.
- Provides versioned pricing/risk/signer/nonce module descriptors and capability validation.
- Provides a common conformance suite for reference and custom module sets.
- Provides local reference components for tests and demos.
- Provides a production-separable durable quote coordinator boundary with a local single-host file-backed reference store.

## What the SDK does not do

- No hosted backend.
- No production market-making strategy.
- No production signer/key custody.
- No custody or inventory management. The coordinator only models off-chain quote inventory leases; it does not lock tokens on-chain.
- No final compliance decision in the backend.
- No dashboard or websocket/order discovery.

Final compliance remains at fill time in `ExecutionRouter` and `ComplianceEngine`.

## Quick start

```ts
import {
  createRFQService,
  FixedRatePricingProvider,
  InMemoryNonceStore,
  NoopInventoryRiskCheck,
  TypedDataSigner,
} from "@corner-store/rfq-service";

const signer: TypedDataSigner = {
  async signTypedData(typedData) {
    // Replace this with KMS/HSM/wallet-service signing in production.
    return mySigner.signTypedData(typedData);
  },
};

const rfq = createRFQService({
  chainId: 31337,
  verifyingContract: "0x6000000000000000000000000000000000000006",
  maker: "0x1000000000000000000000000000000000000001",
  signer,
  pricing: new FixedRatePricingProvider({ numerator: 99n, denominator: 100n }),
  nonceStore: new InMemoryNonceStore(),
  riskCheck: new NoopInventoryRiskCheck(),
});

const signedQuote = await rfq.quote({
  taker: "0x2000000000000000000000000000000000000002",
  tokenIn: "0x3000000000000000000000000000000000000003",
  tokenOut: "0x4000000000000000000000000000000000000004",
  amountIn: "1000000000000000000",
  venue: "0x5000000000000000000000000000000000000005",
});
```

The returned `signedQuote` contains:

- `quote`: adapter-compatible quote fields.
- `signature`: maker signature.
- `typedData`: exact EIP-712 payload that was signed.


## Durable quote coordinator

`RFQQuoteCoordinator` is the application boundary for production-style firm quote
issuance. It sits above pricing, risk and signer modules and requires a
`QuoteCoordinatorStore` implementation that atomically handles:

- `(chainId, adapter/verifyingContract, maker)` monotonic nonce allocation;
- idempotency key hash + request hash conflict detection;
- maker outgoing-token inventory lease reservation;
- persisted signed responses for lost-response retry;
- signer-failure, expiry, revoke and finalized fill/cancel release;
- fill/cancel observation, confirmation-depth finality and reorg rollback.

The exported `LocalFileQuoteCoordinatorStore` is a **reference/single-host**
adapter. It uses only Node built-ins and an exclusive lock directory to
demonstrate restart persistence and hostile same-host concurrency without adding
a database dependency. It is not an HA production store. Production operators
must implement the same port with a transactional database or equivalent durable
compare-and-set, plus an on-chain indexer/reconciliation worker.

Durable records intentionally store hashes for idempotency keys and signer key
references. Do not write raw bearer tokens, identity documents, customer PII or
secrets to this store or to logs. Partial fill remains out of scope for RFQ v1.

Production hosts should call `quoteWithEvidence(intent, strictFreshnessPolicy)`.
That strict API validates the actual pricing result and actual risk decision
returned inside the coordinator call, persists their freshness evidence, and
returns it with a replay indicator. Existing signed idempotent records replay
without repricing, rerisking or re-signing. Existing RESERVED records revalidate
persisted evidence before signing; stale/missing/future/unavailable evidence
revokes the reservation and releases its lease without reusing the nonce. Fresh
risk `decision: rejected` is exposed as stable `RISK_REJECTED`; raw operator risk
reasons must not be logged or audited.

## Production host boundary

For HTTP endpoint hardening, use the separate `services/rfq-host` package. It
wraps `RFQQuoteCoordinator.quoteWithEvidence()` with auth, exact taker binding,
request-size caps, hashed-principal rate limiting, strict validation of the
actual pricing/risk evidence persisted by the coordinator, strict PII-free audit,
bounded metrics and incident hooks. It deliberately remains separate from
`services/rfq-demo-backend`, which is local Anvil demo infrastructure only.

## Replace for production

The reference components are intentionally local/demo-only:

| Component | Purpose | Production replacement |
| --- | --- | --- |
| `InMemoryNonceStore` | local maker-scoped monotonic nonce assignment matching `RFQAdapter.usedQuoteNonce[maker][nonce]` | DB/Redis-backed persistent nonce store, or `RFQQuoteCoordinator` with a production `QuoteCoordinatorStore` |
| `FixedRatePricingProvider` | deterministic demo price | operator pricing engine |
| `NoopInventoryRiskCheck` | no-op demo risk gate | inventory, exposure and maker risk checks |
| custom `TypedDataSigner` | signing seam | KMS/HSM/custody signer |

## Versioned modules and conformance

Use `pricingModule`, `riskModule`, `signerModule` and `nonceModule` to describe
the implementation without storing its config values. Compose the validated set
with `createRFQServiceFromModules`.

Every custom set should pass `assertRFQModuleConformance(modules, fixture)`.
Conformance checks SDK compatibility and call ordering; it is not a security or
legal certification of the implementation.

The Toolkit integration generator and package boundary are documented in
[`docs/sdk-integration.md`](../../docs/sdk-integration.md).

## Low-level API

Advanced callers can still use `RFQQuoteService.createSignedQuote()` when they already know `maker`, `amountOut`, `nonce` and expiry policy. This preserves the original reference-service behavior.

## Test

```sh
cd services/rfq
npm test
```
