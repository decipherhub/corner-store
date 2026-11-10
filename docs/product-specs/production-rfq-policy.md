# Production RFQ Policy and Component Contract

## Purpose

이 문서는 ADR-009를 구현 가능한 component contract로 구체화한다. Corner Store가
제공하는 것은 protected settlement protocol, RFQ SDK contract와 conformance다.
실제 dealer operation, pricing, custody와 infrastructure는 operator가 구현한다.

## Product Boundary

| Component | Corner Store responsibility | Production operator responsibility |
| --- | --- | --- |
| ExecutionRouter | fill-time compliance, pause, venue binding, post-trade commit | deployment/governance 운영 |
| RFQ Adapter | quote authorization, exact full-fill, replay/cancel, atomic transfer | maker onboarding과 allowance policy |
| RFQ SDK | typed quote, module capabilities, conformance | module implementations와 hosting |
| Maker authorizer | versioned verification seam | signer registration/rotation approval |
| Pricing | interface/reference only | market data, pricing strategy와 freshness |
| Inventory risk | interface/reference only | balance, limits, concentration과 availability |
| Nonce | interface/conformance | durable atomic store와 recovery |
| Signer | typed-data interface and single local env/file key in reference code | external signer/access policy; key management, multisig and custody expansion deferred |
| Audit | record schema/integration seam | WORM, retention, access와 incident production |

## Owner and Trust Matrix

| Owner | Trusted for | Not trusted for |
| --- | --- | --- |
| Issuer/TA | identity facts, claim freshness, token transfer eligibility | RFQ price/fill decision |
| Protocol governance | contract/authorizer upgrade and delayed authority expansion | dealer pricing |
| Operator | maker/venue/module approval, pause and incident coordination | silently overriding legal claims |
| Dealer/maker | executable price, inventory and settlement obligation | final compliance |
| RFQ host | authenticated request, idempotency and lifecycle persistence | signer secret custody |
| Signer custodian | authorized typed-data signature and key audit | choosing quote fields |
| Indexer/surveillance | finalized reconciliation and anomaly evidence | preventing an on-chain fill |
| Router/Engine | latest on-chain compliance and atomic dispatch | off-chain market-data quality |
| Taker/custodian | wallet/request authority and allowance | maker inventory |

## Supported Production-v1 Flow

```text
authenticated taker
  → hashed-principal rate limit
  → bounded TTL / local product authorization
  → idempotency lookup (persisted authorization on retry)
  → current on-chain policy ID resolution and catalog match (new request only)
  → pricing snapshot
  → inventory and risk eligibility
  → atomic nonce + time-bounded inventory reservation
  → external signer
  → audit persistence
  → exact-taker signed quote
  → taker submits ExecutionRequest
  → Router pause + replay + latest compliance
  → current maker/signer authorization
  → exact full-fill transfer
  → compliance commit + execution event
```

Backend pre-check나 quote 발급 이후에도 claim, Manifest, maker, signer 또는 venue가
바뀌면 fill은 거부될 수 있다.

## Component Contracts

### Production HTTP host boundary

`services/rfq-host` provides the hardened host seam for production operators
without converting `services/rfq-demo-backend` into production infrastructure.
The request sequence is fixed:

```text
size/json/schema parsing
  → authenticator principal+taker claim
  → exact normalized taker binding
  → hashed-principal rate limit
  → bounded TTL / local maker/venue/pair/policy/capability/flow authorization
  → required dependency readiness
  → durable coordinator quoteAuthorizedWithEvidence
    → idempotency lookup and persisted authorization validation
    → new request only: trusted current policyId resolution and catalog match
    → actual pricing result + actual risk decision freshness before reserve/sign
  → strict PII-free audit
  → quote response
```

Required fail-closed behavior:

- missing or invalid auth returns 401; authenticated taker mismatch returns 403;
- request body larger than the configured cap returns 413;
- rate limit returns 429 with `Retry-After` and never keys on a raw principal;
- the actual pricing result and actual risk decision returned inside
  `quoteWithEvidence()` must include `snapshotId`, `version`, `observedAt`,
  `validUntil` and availability; missing, stale, future-skewed or unavailable
  values stop before nonce reservation and signing, while idempotent replay uses
  persisted evidence without provider recall or re-signing; existing RESERVED
  replay must revalidate persisted evidence before signing and terminalize/release
  the reservation if evidence is stale, missing, future-skewed or unavailable;
- fresh risk `decision: rejected` returns stable 422 `risk_rejected` without raw
  reason disclosure, and signer verification failure plus strict audit
  persistence failure do not return a quote;
- incident hooks are best-effort and non-recursive; hook failure must not leak
  secrets or convert a prior safe failure into success;
- audit and metrics exclude raw bearer tokens, raw idempotency keys, signer refs,
  raw request bodies, stack traces and unbounded principal/address labels.

The reference in-memory limiter/audit/metrics/incident adapters are test doubles; the host does not accept independent host-side freshness assertions that can diverge from coordinator pricing/risk results.
Production deployments must replace them with operator-owned shared rate-limit
state, WORM/retention audit, bounded metrics and incident routing. TLS termination
remains external; the host refuses public bind unless the operator explicitly
acknowledges a trusted TLS/proxy boundary.

### Quote API boundary

Client-supplied fields:

- authenticated taker
- token pair and side
- exact `amountIn` in decimal base-unit string
- venue
- TTL preference within operator limits
- idempotency key

The client never chooses `policyId`. After authentication, rate limiting, local
authorization and readiness, the coordinator resolves it through a trusted Engine
read for a new request and compares it with the operator catalog. Replays use the
persisted policy instead of performing a new read.

Server-owned fields:

- maker
- amountOut
- nonce
- effective TTL/expiry
- current execution-bound `policyId`
- pricing/risk/signer module versions

Unsafe JavaScript number, caller-supplied maker/nonce/amountOut, unknown token/venue와
unsupported side는 pricing 전에 거부한다.

### Quote lifetime and product authorization (RFQ-006, D030)

Configure the coordinator in the operator bootstrap with `defaultTtlSeconds`,
`maxTtlSeconds` and an explicit `products` catalog. The omitted defaults are 60
seconds and 300 seconds respectively. Both must be positive safe integers,
`defaultTtlSeconds <= maxTtlSeconds <= 3600`. Operators can tune the maximum from
1 to 3600 seconds and must lower the default explicitly if choosing a maximum
below 60. Null, fractional, zero, negative, unsafe and out-of-range configuration
fails at construction; invalid request TTL fails before quote dependencies,
after host authentication and rate limiting.
The maximum is inclusive. Unsupported TTL is rejected, never silently clamped.
The host uses the selected endpoint coordinator's lifetime values.

Each catalog entry is an exact tuple of maker, ordered `tokenIn`/`tokenOut`,
venue, execution-bound `policyId`, capability (`rfq.quote.v2` or `rfq.quote.v3`)
and `flowType` (0 secondary, 1 primary). Maker, chain and adapter are server-owned.
Addresses are normalized and nonzero; pair legs must differ and policy must be a
nonzero bytes32. A catalog contains 1-256 entries; ambiguous entries with different
policies for the same tuple fail configuration. Separate entries authorize each
buy/sell direction, version and flow. V2 supports secondary flow only. V3 primary
requires an explicit entry and remains subject to current context verification.
This is an operator product-support decision, not a replacement for ERC-3643,
ONCHAINID or fill-time compliance.

Host authentication and shared rate limiting precede TTL/product authorization.
Authorization precedes readiness, store, policy, pricing, risk, context and signing.
Authentication/rate-limit rejections keep their existing audit and incident behavior,
including best-effort audit failure handling. For new requests,
a successful live resolver result must match the catalog policy before pricing.
Unsupported products and policy mismatches return a terminal product denial.
Resolver implementations must use `RFQCoordinatorError("PRODUCT_UNAUTHORIZED", ... )`
for a known denial and `CONFIGURATION_INVALID` for a known configuration failure;
untyped exceptions represent dependency unavailability. Do not encode denial in
an arbitrary exception message.

The reservation atomically stores `productAuthorization` schema 1, containing
that exact tuple plus chain ID and adapter, alongside the normalized request,
request hash, nonce and original expiry. Host retries compare the client request
against the persisted request and validate the persisted authorization. Both
`quoteWithEvidence` and `quoteAuthorizedWithEvidence` compare current catalog
policy only after lookup establishes a new request. Replays never resolve policy,
reprice, extend expiry or re-sign a published quote, even if
the live resolver is unavailable or the catalog policy changed. RESERVED recovery
uses that grant and original lease, rechecks freshness and v3 context, then signs.
Current local tuple support and TTL limits still apply on every attempt; removing
a tuple disables retries too. A changed client request returns 409. Changed
policy/configuration never silently rewrites an existing record.

Both production evidence APIs require a catalog. Host startup requires one for
both enabled versions. Existing schema 1/v2 and schema 2/v3 records remain
readable, but production replay without a matching persisted grant fails closed.
Do not infer authorization or backfill old records automatically. Drain or expire
old quotes and use a fresh idempotency namespace/store before enabling this host
contract. The legacy non-production `quote()` path without a catalog and the
lightweight SDK/demo APIs remain available. Local provenance E2E explicitly tunes
both lifetime values to 600 seconds; the public Monad v2 demo is unchanged.

| Failure | HTTP / public code | Retry policy |
| --- | --- | --- |
| Invalid input or TTL | 400 `invalid_request` | Correct the request |
| Unsupported product or policy mismatch | 403 `product_unauthorized` | Terminal for this product/configuration |
| Terminal unsigned replay after signing failure, expiry or revocation | 400 `invalid_request` | Use a fresh request/key |
| Idempotency conflict | 409 `idempotency_conflict` | Use the original request |
| Invalid policy result, missing grant or configuration failure | 500 `configuration_invalid` | Operator correction required |
| Policy/pricing/risk/store/auth/limiter dependency exception | 503 `dependency_unavailable` | Retry the same request/key after recovery |
| Unexpected internal failure | 500 `internal_error` | Operator investigation required |

Existing 401/403 authentication, 413 body cap, 429 rate limit, 422 risk rejection,
409 inventory shortage and 503 signer/audit failures retain their codes. Raw
exception messages, catalog data, principal values and request bodies never enter
rejection diagnostics or metric labels. Rejection reason/module labels come from
bounded vocabularies. Product denial is not reported as authentication abuse.

### Pricing module

Minimum input:

```text
requestId, maker, taker, tokenIn, tokenOut, amountIn, venue, observedAt
```

Minimum output:

```text
amountOut, snapshotId, validUntil
```

Requirements:

- all amounts are base-unit decimal strings
- positive exact output
- deterministic rounding policy per pair/side
- stale or unavailable snapshot fails closed
- snapshot ID and module version enter the audit record

`rfq.price.v1` remains compatible for reference integrations. Production metadata
is an operator envelope until a versioned `rfq.price.v2` contract is introduced.

### Inventory-risk module

Checks at minimum:

- maker balance and Adapter allowance
- quote size and per-asset/dealer limit
- inventory concentration/direction
- market-data and internal-state freshness
- maker/venue operational state

Risk rejection runs before nonce allocation and signing. Compliance identity/claim
judgment remains outside this module.

For a firm quote, eligibility is followed by a durable inventory lease committed
atomically with nonce/idempotency reservation. The lease prevents concurrent
over-quoting inside the RFQ service. It does not lock tokens on-chain; dedicated
settlement accounts, allowance policy and reconciliation mitigate external balance
changes.

### Durable nonce module

Storage invariants:

```text
UNIQUE(chainId, adapter, maker, nonce)
UNIQUE(chainId, adapter, maker, idempotencyKey)
```

The atomic operation is:

```text
reserve-or-return-existing(
  makerScope,
  idempotencyKey,
  requestHash,
  inventoryDelta,
  reservationExpiry
)
```

- same key + same request hash: return the persisted quote/result
- same key + different request hash: conflict
- newly allocated nonce: never reuse, including signer/network failure
- multi-instance concurrency: exactly one allocation wins

This atomic coordinator is a production service boundary above the individual
`risk` and `nonce` module interfaces. The local in-memory module does not satisfy
this contract.

### Quote and nonce lifecycle

| State | Durable data | Exit |
| --- | --- | --- |
| `RECEIVED` | request/idempotency hash | conflict, existing result, reserve |
| `RESERVED` | nonce + inventory lease | signed or sign failed |
| `SIGNED` | quote hash/signature/key ref | published |
| `PUBLISHED` | response + expiry | observed fill/cancel, expiry, revoke |
| `FILL_OBSERVED` | tx/block/hash | finalized or reorg to published |
| `CANCEL_OBSERVED` | tx/block/hash | finalized or reorg to published |
| terminal | filled/cancelled/expired/sign-failed/revoked | release reservation |

Nonce gaps are valid. Reuse is not. Reservation release waits for configured
confirmation depth; a reorg restores the prior non-terminal state and re-evaluates
expiry/current authorization.

### Signer and maker authorizer

Signer implementation receives validated typed data only. It must not choose quote
fields. The service checks returned signature and current maker authorization before
responding.

On-chain production migration:

```solidity
interface IMakerAuthorizer {
    function isAuthorizedSigner(
        address maker,
        bytes32 quoteHash,
        bytes calldata signature
    ) external view returns (bool);
}
```

The concrete implementation may use ECDSA delegates, ERC-1271 or both. Adding
authority is delayed/governed; revocation is immediate. The adapter checks current
authorization at fill time so rotation invalidates outstanding quotes from removed
signers.

RFQ-003 implements this seam with direct maker ECDSA compatibility, delayed governed
EOA delegates, immediate revocation and ERC-1271 maker verification.

Planned rotation may overlap old/new signer authorization for no longer than the
maximum quote TTL. Emergency rotation pauses the venue first, revokes the compromised
signer immediately and invalidates all of its outstanding quotes regardless of TTL.

### Audit record

PII-free minimum:

```text
requestId, idempotencyKeyHash, quoteHash, chainId, adapter, maker, taker,
tokenIn, tokenOut, amountIn, amountOut, venue, nonce, expiry,
pricingSnapshotId, moduleIds/versions, riskDecision,
createdAt, signerKeyRefHash, outcome
```

Secret values, raw identity documents and private market-data payloads are excluded.
The operator owns retention, access control and WORM export.

## Settlement Invariants

1. Adapter is callable only by the registered Router.
2. Router caller equals request initiator.
3. Quote is bound to chain, adapter, maker, taker, pair, amounts, venue, nonce and expiry.
4. Current maker and signer authorization passes at fill time.
5. Quote is unused and un-cancelled.
6. Router evaluates latest compliance before transfer.
7. Both token legs and compliance commit succeed atomically or all revert.
8. Adapter/Router end with no custody balance introduced by settlement.
9. Successful fill consumes the entire quote exactly once.
10. Regulated quantity, not quote-currency notional, is compared with compliance cap.

### Opt-in RFQ v3 context provenance

Separate `ExecutionRouterV2`/`RFQAdapterV3` deployments add authenticated context
before Engine evaluation. Signed maker/taker, pair, exact amounts, venue,
`flowType` and current actual-sender A-06 commitment must match the supplied
context. Settlement repeats authentication and compares signed `policyId` with
the fresh Engine decision before consuming the nonce and transferring. All
existing exact-fill, rollback, commit and event invariants remain in force.

`/rfq/quote` keeps its v2 schema/defaults. The opt-in `/rfq/v3/quote` requires
`flowType` and rejects client `policyId`, `affiliateEvidenceHash` and
`sellerIsAffiliate`. Both endpoint versions authorize products after authentication,
taker binding and rate limiting, before quote dependencies. The coordinator resolves
policy for new requests and then current context evidence.
Unavailable context returns a redacted 503. Production bootstrap requires the
explicit `v3_context_provenance` capability and ready `context` component.

V3 schema 2 records persist the exact domain, quote version and context evidence.
The coordinator resolves evidence before reservation and repeats it before
signing, including the reserved quote nonce. Invalid recovery terminalizes the
reservation and releases inventory; published replay returns the identical
signature without silently refreshing it. Legacy schema 1 records remain legacy.
Strict pricing/risk freshness, audit and inventory obligations also apply to v3.

The exact domain, ordered type, flow constraints, registration evidence and six
team-to-confirm defaults are specified in
[`execution-context-provenance.md`](./execution-context-provenance.md).
Migration and schema/capability compatibility are in
[`../sdk-versioning.md`](../sdk-versioning.md). A-06 is operator-attested evidence,
and custom context resolvers are an explicit integration trust boundary. The
reference local host/store/auth/pricing fixture is not production infrastructure.

## Failure and Recovery

| Failure point | Required behavior |
| --- | --- |
| pricing/risk unavailable | no nonce, no signature, fail closed |
| nonce reserved, signer fails | nonce gap allowed; never reuse |
| response lost after signing | same idempotency key returns persisted result |
| maker allowance/balance changes | atomic fill reverts; audit reconciliation records failure |
| claim/Manifest changes after quote | Router rejects at fill |
| signer revoked after quote | maker authorizer rejects at fill |
| cancel and fill race | first confirmed transaction wins |
| service restart | durable quote/nonce state reload + on-chain reconciliation |
| concurrent quotes | inventory lease prevents internal over-commit; external balance changes remain fail-atomic |
| fill/cancel reorg | observed state rolls back; reservation remains until finality or a new terminal state |
| suspected signer compromise | pause, revoke, cancel, withdraw allowance, reconcile |

## Required Test Matrix

### Module and service

- concurrent nonce requests across processes allocate unique monotonic values
- concurrent quotes cannot reserve more than available inventory
- same idempotency key is stable; conflicting payload is rejected
- risk rejection does not allocate nonce or call signer
- signer failure burns but never reuses a reserved nonce
- signer failure and expiry release inventory exactly once
- stale pricing/inventory dependencies fail closed
- returned signature is locally verified before response
- secrets never appear in config, logs, scaffold or audit record

### Contract and integration

- delegated signer and ERC-1271 maker authorization
- signer addition governance and immediate revoke
- quote signed before revoke fails after revoke
- exact full-fill, replay, cancellation and expiry
- maker balance/allowance failure is atomic
- quote-time eligible → fill-time ineligible rejects
- finite regulated-asset cap works for RFQ buy and sell
- direct Adapter call and wrong venue/type remain blocked
- v3 buy/sell authenticate actual regulated sender, reject seller/flow/affiliate
  mismatch before evaluation and invalidate quotes on evidence refresh
- v2/v3 domain and calldata cross-rejection; current evidence/implementation
  revocation, code/configuration drift and schema 6 activation-order regressions
- isolated live v3 host/SDK/Router E2E with failed receipts, unchanged balances
  and nonces, then fresh-evidence exact-fill recovery in both directions

### Operations

- multi-instance restart/reconciliation drill
- signer compromise incident drill
- fill/cancel observation, finality and reorg reconciliation drill
- maker offboarding clears signer authority and allowance
- pause/unpause governance evidence
- audit export and retention-provider recovery

## Migration Sequence

1. Implement durable nonce/idempotency reference adapter and hostile concurrency tests. **Implemented by RFQ-004 for the SDK/reference coordinator boundary; HA production must still provide a transactional DB store.**
2. Add external signer adapter contract and local signature verification. **Local signature verification implemented by RFQ-004 for direct-maker EIP-712; production authorizer-specific verification remains operator integration work.**
3. Add versioned `IMakerAuthorizer`; this originally preserved v1 quote fields, but
   CORE-010 intentionally supersedes them with the EIP-712 v2 `policyId` field.
4. Fix Router regulated-quantity cap before enabling finite caps.
5. Add production pricing/risk metadata envelope and audit record.
6. Add service auth/rate-limit/observability reference middleware.
7. Perform independent security and legal/operator review.

Partial fill starts only after this sequence and uses a new quote/adapter version.


### RFQ-004 implementation note

The SDK now exports `RFQQuoteCoordinator`, `QuoteCoordinatorStore` and
`LocalFileQuoteCoordinatorStore`. The coordinator implements the atomic
reserve/sign/persist lifecycle expected by this policy while preserving the
existing lightweight SDK and demo backend behavior. The file-backed store is a
reference/single-host adapter only; production readiness for HA deployment
requires replacing it with an operator-owned transactional DB implementation and
feeding `observeSettlement`/`reconcile` from a production chain indexer.
