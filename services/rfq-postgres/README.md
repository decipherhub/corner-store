# Corner Store RFQ PostgreSQL Store

Optional production-oriented persistence for `@corner-store/rfq-service`. This package
keeps PostgreSQL out of the core SDK and does not change local/demo deployments.

## Bootstrap

```ts
import {Pool} from "pg";
import {PostgresQuoteCoordinatorStore} from "@corner-store/rfq-postgres";

const pool = new Pool({connectionString: process.env.DATABASE_URL, max: 20});
const store = new PostgresQuoteCoordinatorStore({pool, confirmationDepth: 12});

await store.initialize([{
  maker: "0x...",
  token: "0x...",
  venue: "0x...",
  available: "1000000000000000000"
}]);
```

`initialize()` applies checksum-bound forward-only migrations under a PostgreSQL advisory
lock. Inventory configuration is idempotent but refuses to lower `available` below an
already reserved amount. Run migrations with an operator role before starting restricted
runtime roles in deployments that separate DDL and DML permissions.

## Transaction and data contract

- Quote mutations use `SERIALIZABLE` transactions with bounded retries for serialization,
  deadlock and concurrent unique-key races.
- Idempotency lookup, maker nonce allocation, expired-lease release and inventory
  reservation commit together.
- Only hashes/bounded operational identifiers and PII-free quote records are stored. Raw
  auth tokens, idempotency keys, signer keys and KYC documents are outside this package.
- `LocalFileQuoteCoordinatorStore` remains the single-host reference implementation.

## Reconciliation

`PostgresQuoteReconciliationWorker` consumes a provider-neutral `RFQChainReader`. It stores
the last canonical cursor, scanned block hashes and fill/cancel observations. Unfinalized
reorgs roll quote state back to `PUBLISHED`; a reorg through a finalized observation or a
reorg deeper than the configured bound fails closed. `health()` is not ready when a failure
is recorded, cursor lag exceeds `maxLagBlocks`, or the last successful pass is stale.

Run one worker per `sourceId` through an operator-owned leader election. Concurrent worker
leadership is not supplied by this package. Include `await worker.readiness()` in the host
readiness report. Production runtime requires the `reconciliation` component, so lag,
staleness or a recorded worker failure prevents quote issuance.

## Operations

- Size the pool below the database connection budget across all host and worker replicas.
  A quote transaction holds one connection while locking its inventory and scope rows.
- Retry only through this package; do not wrap quote issuance in unbounded application
  retries.
- Back up the whole `corner_store_rfq` schema consistently. Restore into an isolated
  database, run migration/checksum verification, compare inventory and chain cursor to an
  authoritative snapshot, then resume the worker before quote issuance.
- Retention deletion must never remove live quote rows, nonce scopes, inventory totals or
  blocks required by the configured reorg window. Archive terminal records according to
  operator/legal policy only after an external audit commitment is preserved.
- This package does not provide managed HA, TLS, credentials, WORM retention, monitoring or
  disaster-recovery drills; those remain operator evidence gates.

## Tests

```bash
CORNER_STORE_TEST_POSTGRES_URL=postgresql://... \
CORNER_STORE_REQUIRE_POSTGRES=1 npm run test:postgres
```

CI runs this suite against a digest-pinned PostgreSQL service with concurrent independent
store instances. Without the URL, the repository-wide local check only builds the optional
package and reports the database tests as skipped.
