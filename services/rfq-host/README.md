# Corner Store RFQ Production Host Boundary

`services/rfq-host` is a production-separable HTTP boundary around the durable
RFQ coordinator from `@corner-store/rfq-service`. It is not the local Anvil demo
backend and does not replace operator-owned pricing, risk, signer custody,
transactional storage, TLS termination or WORM audit infrastructure.

## Boundary

The host owns request-path hardening that belongs outside the SDK:

1. request-size, JSON/schema and bounded TTL validation;
2. local operator product authorization for maker, ordered pair, venue, policy,
   version capability and flow, before dependency calls;
3. authentication through `RFQAuthenticator` and exact normalized taker binding;
4. principal-hash keyed rate limiting and required dependency readiness;
5. coordinator idempotency lookup and persisted authorization validation;
6. new requests only: trusted `resolvePolicyId`, catalog policy match, actual
   pricing/risk freshness checks and atomic authorized inventory/nonce reservation;
7. local signer verification and persisted publication, or unchanged replay;
8. strict PII-free audit, bounded metrics and best-effort incident notification.

The request path never logs or audits raw bearer tokens, raw idempotency keys,
raw request bodies, signer references or stack traces. Audit records carry hashes
for principal/request/idempotency and on-chain identifiers only.

## Operator product and lifetime configuration

Construct each enabled endpoint's coordinator in the bootstrap with an explicit
catalog and lifetime limits:

```ts
const coordinator = new RFQQuoteCoordinator({
  ...dependencies,
  defaultTtlSeconds: 60,
  maxTtlSeconds: 300,
  products: [{
    maker, tokenIn, tokenOut, venue, policyId,
    capability: "rfq.quote.v2",
    flowType: 0
  }]
});
```

Use `RFQQuoteCoordinatorV3` with `capability: "rfq.quote.v3"` and its context
resolver for the versioned endpoint. Add separate entries for reverse pairs and
primary flow. V2 defaults to secondary and rejects client flow fields. Both
endpoints reject client maker, policy, nonce and output fields; successful v2/v3
quote response shapes and EIP-712 versions are unchanged.

Defaults are 60-second TTL and 300-second maximum. Both must be positive safe
integers with `defaultTtlSeconds <= maxTtlSeconds <= 3600`; the maximum is
inclusive. If tuning below 60 seconds, also lower the default. Invalid configuration
(including null) fails startup, and invalid TTL never reaches authentication,
limiter, readiness, store, policy, pricing, risk or signer work. Configure these
values in the bootstrap's coordinator config, not through new runtime environment
variables. Catalogs accept 1-256 exact tuples; ambiguous or malformed entries fail
closed. The constructor snapshots catalog entries so later input mutation cannot
widen access.

The host uses `quoteAuthorizedWithEvidence()` so a replay/conflict never calls
the policy resolver, pricing or risk. Its original authorization, policy, nonce,
expiry and signature remain authoritative. RESERVED recovery revalidates stored
freshness and current v3 context before signing. Current tuple support and TTL
limits still gate retries, so catalog removal or a lower lifetime cap may deny
an older request. Production evidence calls require an explicit catalog even
when called without HTTP.

Existing record schemas remain readable; production retries lacking the new
`productAuthorization` fail closed. Drain/expire old quotes and start a fresh
idempotency namespace/store. Do not synthesize historical grants from current
configuration. Lightweight SDK and separate demo hosts are unaffected. The local
context E2E explicitly sets its default/maximum to 600 seconds.

Failures are bounded: 400 `invalid_request`, 403 `product_unauthorized`,
409 `idempotency_conflict`, 500 `configuration_invalid`, or retryable
503 `dependency_unavailable`. Known resolver denial/configuration failures must
throw `RFQCoordinatorError` with `PRODUCT_UNAUTHORIZED`/`CONFIGURATION_INVALID`;
untyped provider throws are unavailable. Invalid resolver output is a configuration
failure. Unexpected internal failures return redacted 500 `internal_error`.
Existing authentication, inventory, risk, signer and audit codes remain in place.
No exception text or arbitrary resolver/limiter reason becomes a diagnostic label.
See the [production policy](../../docs/product-specs/production-rfq-policy.md).

## Production replacement points

| Port | Reference implementation | Production requirement |
| --- | --- | --- |
| `RFQAuthenticator` | `StaticBearerAuthenticator` for tests | mTLS/OIDC/session authority returning a principal and exact taker claim |
| `RateLimiter` | bounded in-memory single-process limiter | shared store/service limiter using hashed principal keys |
| `resolvePolicyId` | injected deterministic resolver in tests | fail-closed RPC/indexer read of the current Engine policy for the regulated token |
| coordinator pricing/risk modules | SDK test fixtures | actual module return values with `snapshotId`, `version`, `observedAt`, `validUntil`, `available` validated inside `quoteWithEvidence()` |
| `AuditSink` | memory sink | strict WORM/retention sink; default `strictAudit` fails closed on quote issuance |
| `MetricsSink` | memory sink | bounded-label metrics, no principal/address labels |
| `IncidentSink` | memory sink | non-recursive pager/webhook/ticket integration |
| coordinator store | SDK reference file store in tests | transactional HA DB plus chain indexer/reconciliation worker |

TLS termination is an operator boundary. The server refuses non-loopback bind
unless `publicBindAcknowledged: true` is set after the operator has configured a
trusted TLS/proxy boundary.

## Production entrypoint and image

`npm run start:production` uses the exact, versioned runtime and bootstrap
contract. It does not select the reference implementations in this README as
defaults: all durable/auth/signer/pricing/risk/policy/audit dependencies must be
provided by an operator bundle, and readiness gates quote issuance. See
[`../../docs/production-containers.md`](../../docs/production-containers.md) for
the complete environment schema, OCI build target, read-only deployment example
and release evidence requirements.

## Test

```sh
cd services/rfq-host
npm test
```

The smoke test covers liveness/readiness and dependency fail-closed behavior,
versioned bootstrap validation, graceful shutdown, 401/403 auth, malformed and oversized bodies including
`Content-Length` caps, 429 with `Retry-After`, limiter capacity under principal
spray, stale/missing/future actual coordinator evidence, fresh risk `decision: rejected` as 422 without raw
reason disclosure, signer call and verification failure, strict audit fail-closed
retry without re-signing, incident
hook isolation, PII-free audit redaction, bounded metrics, successful quote
issuance and idempotent replay.
It also proves unauthenticated requests cannot trigger policy resolution and that
the server-owned resolved policy is included in the EIP-712 v2 quote.

The authorization suites additionally verify invalid/max-boundary TTL, zero
costly-dependency calls for unsupported products, both endpoint versions,
persisted grants across restart/concurrent retry/RESERVED recovery, policy drift,
resolver outage, conflicts, malformed stored grants and terminal versus retryable
failure redaction.
