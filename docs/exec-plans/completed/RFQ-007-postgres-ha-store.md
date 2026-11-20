# RFQ-007 PostgreSQL HA Quote Coordinator Store

## Goal

Implement issue #170 as an optional PostgreSQL-backed `QuoteCoordinatorStore` plus a
restart-safe reconciliation worker, without changing the local reference or demo paths.

## Scope

1. Add a forward-only schema and migration runner for nonce scopes, inventory, quote
   records, chain cursors, blocks and observations.
2. Implement serializable, bounded-retry quote lifecycle transactions with exact
   idempotent replay and once-only lease release.
3. Implement a bounded chain reader/worker contract with cursor persistence, unfinalized
   reorg rollback and fail-closed lag/deep-reorg health.
4. Run concurrency and restart/reorg tests against a real PostgreSQL service in CI.
5. Document connection, isolation, retention and backup/restore ownership.

## Non-goals

- Selecting a managed PostgreSQL vendor or storing credentials.
- Replacing `LocalFileQuoteCoordinatorStore` in demos.
- Custody, pricing, KYC or signer-provider selection.
- Redis as an authoritative lifecycle database.

## Stop condition

The package builds independently, real-PostgreSQL tests prove the transactional
invariants, existing RFQ tests pass, and the feature/docs record any remaining operator
deployment evidence instead of claiming production readiness.

## Outcome

Completed on 2026-11-21. The optional package, migration boundary, serializable
quote lifecycle, restart-safe reconciliation worker and mandatory production
readiness contract are implemented. Real PostgreSQL CI proves multi-process
nonce, idempotency, inventory, restart, crash/reorg and finality behavior. The
repository-wide CI gate and clean-project package import also pass. Managed
database HA, external leader election, operator backup/restore drills, WORM audit,
KMS/HSM custody and live provider deployments remain operator-owned production
evidence rather than SDK claims.
