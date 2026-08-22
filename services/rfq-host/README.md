# Corner Store RFQ Production Host Boundary

`services/rfq-host` is a production-separable HTTP boundary around the durable
RFQ coordinator from `@corner-store/rfq-service`. It is not the local Anvil demo
backend and does not replace operator-owned pricing, risk, signer custody,
transactional storage, TLS termination or WORM audit infrastructure.

## Boundary

The host owns request-path hardening that belongs outside the SDK:

1. request-size and JSON/schema validation;
2. authentication through an `RFQAuthenticator` port;
3. exact normalized authenticated-taker binding to body `taker`;
4. principal-hash keyed rate limiting through a replaceable `RateLimiter` port;
5. strict coordinator `quoteWithEvidence()` issuance, where the actual pricing result and risk decision carry freshness evidence before nonce reservation;
6. durable coordinator quote issuance and local signer verification;
7. strict PII-free audit persistence before returning a quote;
8. bounded metrics and best-effort incident notification.

The request path never logs or audits raw bearer tokens, raw idempotency keys,
raw request bodies, signer references or stack traces. Audit records carry hashes
for principal/request/idempotency and on-chain identifiers only.

## Production replacement points

| Port | Reference implementation | Production requirement |
| --- | --- | --- |
| `RFQAuthenticator` | `StaticBearerAuthenticator` for tests | mTLS/OIDC/session authority returning a principal and exact taker claim |
| `RateLimiter` | bounded in-memory single-process limiter | shared store/service limiter using hashed principal keys |
| coordinator pricing/risk modules | SDK test fixtures | actual module return values with `snapshotId`, `version`, `observedAt`, `validUntil`, `available` validated inside `quoteWithEvidence()` |
| `AuditSink` | memory sink | strict WORM/retention sink; default `strictAudit` fails closed on quote issuance |
| `MetricsSink` | memory sink | bounded-label metrics, no principal/address labels |
| `IncidentSink` | memory sink | non-recursive pager/webhook/ticket integration |
| coordinator store | SDK reference file store in tests | transactional HA DB plus chain indexer/reconciliation worker |

TLS termination is an operator boundary. The server refuses non-loopback bind
unless `publicBindAcknowledged: true` is set after the operator has configured a
trusted TLS/proxy boundary.

## Test

```sh
cd services/rfq-host
npm test
```

The smoke test covers 401/403 auth, malformed and oversized bodies including
`Content-Length` caps, 429 with `Retry-After`, limiter capacity under principal
spray, stale/missing/future actual coordinator evidence, fresh risk `decision: rejected` as 422 without raw
reason disclosure, signer call and verification failure, strict audit fail-closed
retry without re-signing, incident
hook isolation, PII-free audit redaction, bounded metrics, successful quote
issuance and idempotent replay.
