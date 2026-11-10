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
5. trusted on-chain `resolvePolicyId` after auth/rate-limit, never from client input;
6. strict coordinator `quoteWithEvidence()` issuance, where the actual pricing result and risk decision carry freshness evidence before nonce reservation;
7. durable coordinator quote issuance and local signer verification;
8. strict PII-free audit persistence before returning a quote;
9. bounded metrics and best-effort incident notification.

The request path never logs or audits raw bearer tokens, raw idempotency keys,
raw request bodies, signer references or stack traces. Audit records carry hashes
for principal/request/idempotency and on-chain identifiers only.

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

## Rejection disclosure policy

Disclosure is opt-in through `ProductionRFQHostConfig.disclosurePolicyFile`.
The production bootstrap may return the same optional field in
`ProductionRFQDependencies`, pointing to an operator-mounted JSON file. No new
environment variable or bootstrap contract version is required. Without a path,
the response remains `422 {"error":"risk_rejected"}`.

The host reads and validates the file once at startup. Restart with a newly
versioned reviewed policy to change disclosure. Missing, unreadable, oversized
(over 16 KiB), invalid JSON or schema-invalid files disable disclosure. Startup
and quote rejection still work with the generic response. The schema is exact:

```json
{
  "schemaVersion": 1,
  "policyVersion": "operator-v1",
  "reasons": {
    "INVENTORY_LIMIT_EXCEEDED": {
      "tier": "detailed",
      "message": "Requested quote exceeds available inventory."
    }
  }
}
```

`policyVersion` is a 1-64 character identifier containing letters, digits, dots,
underscores or hyphens, starting with a letter or digit. Messages are nonempty
strings of at most 512 characters without control characters. Unknown fields,
reason identifiers and tiers invalidate the whole file.

[`policies/disclosure.v1.json`](policies/disclosure.v1.json) demonstrates the
three tiers. It is a reference policy, is never loaded automatically, and requires
operator/counsel approval of audience mapping and wording before production use.
Policy entries apply only to the authenticated taker requesting its own quote;
there is no privileged audience or compliance-report endpoint in this module.

| Tier | Optional response entry |
| --- | --- |
| `detailed` | policy message, tier and structured `reasonCode` |
| `action_only` | policy message and tier, with no reason identifier |
| `generic` | policy message and tier, with no reason identifier |

An allowlisted rejection adds `disclosure: {policyVersion, reasons: [...]}` to
the existing body. Status codes and `error` values stay unchanged. Every reason
must be recognized and allowlisted; otherwise the entire response stays generic
with no disclosure or policy version. The SDK accepts only operational
`INVENTORY_LIMIT_EXCEEDED`, `RISK_LIMIT_EXCEEDED` and `PRICING_OUTSIDE_LIMITS`
identifiers from a risk decision's optional `reasonCodes`. Unknown or malformed
reason lists suppress all entries, including otherwise safe entries. Sanctions,
AML and surveillance identifiers are outside this allowlist and always suppress
the whole response, even if a policy file attempts to disclose them. Integrations
must supply the complete structured reason list; the host does not interpret raw
provider text or integrate compliance reporter results.

Only policy-owned literal wording can reach the response. Raw `reason` text,
provider errors and internal messages never populate disclosure, audits or
metrics. Rejected requests allocate no nonce and do not sign; retrying a rejection
reruns the existing checks. Published quote replays retain the existing persisted
evidence behavior and never call providers or sign again. Successful quote bodies
contain no disclosure fields.

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
the server-owned resolved policy is included in the EIP-712 v2 quote. Disclosure
coverage includes all three tiers, authenticated taker binding, rejection retries,
quote replays, missing/malformed policy fallback and whole-response suppression
for unknown, malformed and sensitive reasons.
