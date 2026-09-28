# Corner Store Compliance Data SDK

Provider-neutral foundation for ADR-008's off-chain compliance data layer.

It provides:

- Transfer Agent lot ingestion and deterministic lineage/clock resolution;
- conservative holder×asset snapshots for `AttestedAcquisitionSource`;
- idempotent person-group volume and holder state;
- tamper-evident rejection and out-of-router surveillance records.

```ts
const snapshot = await new AcquisitionResolver(provider).compile(holder, asset, chainTimestamp);
```

The SDK does **not** claim Securitize Connect API compatibility. A production
operator must supply and verify a provider adapter, authorization, PII controls,
durable database/WORM storage, finality/reorg handling, alerting and retention.
Only snapshot hashes and PII-free references should be submitted on-chain.

## Provider-neutral TA/KYC evidence

`KycEvidenceCoordinator` adds the production boundary for identity/provider refreshes without
encoding a vendor API. Operator-owned adapters implement `ProviderKycAdapter` and may call
Securitize, an issuer TA, or another identity provider, but the SDK input/output accepts only
PII-free on-chain bindings and hashes:

- subject address, optional ONCHAINID address, asset address and `requestRefHash`;
- bounded `providerId`/schema version, `assessmentRefHash` and `sourceEvidenceHash`;
- normalized KYC/sanctions/AI/QP/jurisdiction facts, timestamps and `ACTIVE | REVOKED | INELIGIBLE` status.

The coordinator validates declared provider metadata, exact subject/identity/asset binding, exact request/assessment/facts schema, freshness/future skew and
status, computes a domain-separated canonical `evidenceHash`, requires strict PII-free success audit before publishing eligible evidence to the
replaceable `KycEvidenceStore`, revalidates the store return, and returns an eligible materialization only for current
`ACTIVE` + KYC verified + sanctions clear assessments. Provider outage/timeout, incompatible provider output, malformed
request or result, stale/future data, binding mismatch, revocation, ineligibility, store conflict or strict
audit failure all fail closed. A previous successful snapshot is never used to hide a refresh
outage.

`InMemoryKycEvidenceStore` is a conformance/reference store only. It gives deterministic replay
semantics, same-assessment conflict detection and monotonic revocation/newer-observation
protection inside one process; production deployments must replace it with a transactional
durable/HA store plus provider-specific auth, WORM/retention, alerting and claim/registry
operation controls. The SDK emits a provider-neutral evidence object for an issuer/TA-approved
adapter to translate into ERC-3643/ONCHAINID claim or registry actions; it does not issue KYC,
write claims or persist raw provider payloads.

### KYC provider SPI v1

`KYC_PROVIDER_SPI_VERSION` (`1.0.0`) versions the adapter boundary. An adapter declares
`metadata` next to `assess`, and the coordinator requires an explicit `mode`:

```ts
const adapter: ProviderKycAdapter = {
  metadata: {
    spiVersion: "1.0.0",
    providerId: "vendor-x",
    providerSchemaVersions: ["vendor-x.kyc.v3"],
    capabilities: ["kyc", "sanctions", "accreditedInvestor"],
    environment: "production"
  },
  async assess(request, context) { /* call the provider, honor context.signal */ }
};
const coordinator = new KycEvidenceCoordinator(adapter, durableStore, {mode: "production", audit, incident});
```

- `validateKycProviderMetadata` requires exactly these fields, a strict `MAJOR.MINOR.PATCH`
  `spiVersion`, a bounded `providerId` slug, 1 to 16 unique bounded schema versions, unique known
  capabilities that include `kyc` and `sanctions`, and `environment` `demo` or `production`. Its
  errors are fixed text and never echo metadata.
- The constructor validates metadata once, keeps a frozen copy and never re-reads
  `adapter.metadata`. `mode: "production"` refuses an adapter that declares `environment: "demo"`.
  Unknown modes, unreadable metadata and other SPI majors are startup errors.
- A refresh returns `PROVIDER_INCOMPATIBLE` and stores nothing when the assessment `providerId`
  differs from the metadata, its `providerSchemaVersion` is not declared, or it carries an optional
  fact (`accreditedInvestor`, `qualifiedPurchaser`, `jurisdiction`) that is not a declared capability.
- Adapters report typed failures with `new KycProviderError(code)`, whose message is the code only.
  Recognition is structural (`name` and `code`, not `instanceof`), so errors thrown through another
  copy of the package still map. Adapter error messages never reach results, audit or incident records.

| Adapter failure | Refresh reason |
| --- | --- |
| coordinator `providerTimeoutMs` elapsed, or `KycProviderError("TIMEOUT")` | `PROVIDER_TIMEOUT` |
| `KycProviderError("UNAVAILABLE")`, or any other thrown value | `PROVIDER_UNAVAILABLE` |
| `KycProviderError("STALE")` | `STALE_OR_FUTURE_ASSESSMENT` |
| `KycProviderError("INCOMPATIBLE")` | `PROVIDER_INCOMPATIBLE` |

### Module map

| Import | Contents |
| --- | --- |
| `@corner-store/compliance-data` | coordinator, reference store, evidence hash, TA/state/audit SDK, and the SPI re-exports |
| `@corner-store/compliance-data/spi` | SPI types, `Address`/`Hex`, `KYC_PROVIDER_SPI_VERSION`, provider id/schema patterns, `KycProviderError`, `isKycProviderError`, `validateKycProviderMetadata` |
| `@corner-store/compliance-data/demo` | `DemoKycProviderAdapter`, demo only |
| `@corner-store/compliance-data/conformance` | `runKycProviderConformance` |

`spi` depends only on shared types, so a vendor adapter package can build against it alone. The
root and `conformance` entry points never load the demo adapter. Deep `dist/` paths are not
exported, and the package has no runtime dependencies.

### Demo and production adapters

`DemoKycProviderAdapter` is a deterministic, fixture-backed adapter for local development, demos
and tests. It declares `environment: "demo"`, so a production-mode coordinator refuses it at
startup, and its assessments are never production KYC evidence. Unknown subjects resolve to
`KYC_NOT_VERIFIED`, and the same request and clock produce the same `evidenceHash`.

`examples/http-kyc-provider-adapter.ts` is a vendor-neutral, production-style reference that is not
exported. It posts to an operator-configured `https` endpoint through an injected `transport`
(global `fetch` fits) with an operator-supplied `credential`, forwards the coordinator's abort
`signal`, maps HTTP 408/504 to `TIMEOUT`, 409/422 and unexpected bodies to `INCOMPATIBLE` and other
failures to `UNAVAILABLE`, hashes vendor case ids and response fields into `assessmentRefHash` and
`sourceEvidenceHash`, and drops PII such as full names.

A production adapter is operator-owned. The operator supplies and verifies:

- provider configuration (provider id, schema versions, endpoint) and the vendor response mapping;
- credentials, resolved at call time and never logged, stored or placed in evidence;
- a transactional durable `KycEvidenceStore` in place of `InMemoryKycEvidenceStore`;
- networking, TLS and abort handling within `providerTimeoutMs`;
- the strict audit sink and incident hook with retention/WORM controls;
- `mode: "production"` for production deployments.

### Conformance

```ts
import {runKycProviderConformance} from "@corner-store/compliance-data/conformance";

const report = await runKycProviderConformance(adapter, {eligibleRequest, ineligibleRequest, now});
if (!report.passed) throw new Error(report.checks.filter((check) => !check.pass).map((check) => check.name).join(", "));
```

`eligibleRequest` must name a subject the provider reports eligible, and `ineligibleRequest` one it
reports not eligible. The suite runs `metadata-contract` (stops on failure), `environment-guard`,
`eligible-evidence` (eligible under the declared provider id and schema), `fail-closed-evidence`
(a well-formed `KYC_NOT_VERIFIED`, `SANCTIONS_HIT`, `INELIGIBLE` or `REVOKED` decision rather than an
outage, malformed or incompatible result) and `abort-signal` (the adapter rejects an `assess` call
made with an already-aborted signal within `providerTimeoutMs`, default 2000ms; an abort that
arrives mid-call is not probed). Each refresh uses a
fresh in-memory store and a strict audit sink. Check details contain fixed text and reason codes
only. Passing shows SPI conformance, not vendor accuracy, custody or legal sufficiency.

### SPI versioning and migration

- The SPI SemVer (`KYC_PROVIDER_SPI_VERSION`) is independent of the npm package version.
- Patch: no change to accepted adapter output or metadata.
- Minor: additive optional metadata or capabilities only. The coordinator accepts adapters that
  declare the same major and a minor no greater than its own.
- Major: removed, renamed or newly required fields, changed meaning, or stricter validation that
  rejects previously valid adapter output. A major change requires a migration section in this
  README, and the coordinator refuses other majors at startup.
- The evidence hash domain `corner-store/provider-neutral-kyc-evidence/v1` changes only with a
  major SPI change.

#### SPI 1.0.0 migration from the pre-SPI boundary

- Adapters must declare `metadata`. An adapter without it is refused at startup.
- `KycEvidenceCoordinator` requires `options.mode` (`"demo"` or `"production"`).
- Coordinator-enforced timeouts now fail closed as `PROVIDER_TIMEOUT` instead of
  `PROVIDER_UNAVAILABLE`. Consumers that match on reasons must also handle `PROVIDER_INCOMPATIBLE`.
- SPI types now live in `@corner-store/compliance-data/spi` and stay re-exported from the root.
  Evidence hashes and store semantics are unchanged.
