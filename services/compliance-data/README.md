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

The coordinator validates exact subject/identity/asset binding, exact request/assessment/facts schema, freshness/future skew and
status, computes a domain-separated canonical `evidenceHash`, requires strict PII-free success audit before publishing eligible evidence to the
replaceable `KycEvidenceStore`, revalidates the store return, and returns an eligible materialization only for current
`ACTIVE` + KYC verified + sanctions clear assessments. Provider outage/timeout, malformed
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
