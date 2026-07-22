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
