import {createHash} from "node:crypto";
import {Pool, PoolClient} from "pg";

export interface Migration {
  version: number;
  name: string;
  sql: string;
}

export const MIGRATIONS: readonly Migration[] = [{
  version: 1,
  name: "quote-coordinator-ha",
  sql: `
CREATE SCHEMA IF NOT EXISTS corner_store_rfq;

CREATE TABLE IF NOT EXISTS corner_store_rfq.schema_migrations (
  version integer PRIMARY KEY,
  name text NOT NULL,
  checksum text NOT NULL,
  applied_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS corner_store_rfq.inventory (
  maker text NOT NULL,
  token text NOT NULL,
  venue text NOT NULL,
  available numeric(78, 0) NOT NULL CHECK (available >= 0),
  reserved numeric(78, 0) NOT NULL DEFAULT 0 CHECK (reserved >= 0 AND reserved <= available),
  updated_at bigint NOT NULL,
  PRIMARY KEY (maker, token, venue),
  CHECK (maker = lower(maker) AND token = lower(token) AND venue = lower(venue))
);

CREATE TABLE IF NOT EXISTS corner_store_rfq.nonce_scopes (
  chain_id bigint NOT NULL CHECK (chain_id > 0),
  adapter text NOT NULL,
  maker text NOT NULL,
  last_nonce numeric(78, 0) NOT NULL CHECK (last_nonce > 0),
  PRIMARY KEY (chain_id, adapter, maker),
  CHECK (adapter = lower(adapter) AND maker = lower(maker))
);

CREATE TABLE IF NOT EXISTS corner_store_rfq.quote_records (
  chain_id bigint NOT NULL CHECK (chain_id > 0),
  adapter text NOT NULL,
  maker text NOT NULL,
  idempotency_key_hash text NOT NULL,
  request_hash text NOT NULL,
  nonce numeric(78, 0) NOT NULL CHECK (nonce > 0),
  state text NOT NULL,
  inventory_token text NOT NULL,
  inventory_venue text NOT NULL,
  inventory_amount numeric(78, 0) NOT NULL CHECK (inventory_amount > 0),
  reservation_expires_at bigint NOT NULL,
  lease_released boolean NOT NULL DEFAULT false,
  record jsonb NOT NULL,
  created_at bigint NOT NULL,
  updated_at bigint NOT NULL,
  PRIMARY KEY (chain_id, adapter, maker, idempotency_key_hash),
  UNIQUE (chain_id, adapter, maker, nonce),
  CHECK (adapter = lower(adapter) AND maker = lower(maker)),
  CHECK (inventory_token = lower(inventory_token) AND inventory_venue = lower(inventory_venue))
);

CREATE INDEX IF NOT EXISTS quote_records_expiry_idx
  ON corner_store_rfq.quote_records (inventory_token, inventory_venue, reservation_expires_at)
  WHERE lease_released = false;

CREATE TABLE IF NOT EXISTS corner_store_rfq.chain_cursors (
  source_id text PRIMARY KEY,
  block_number bigint NOT NULL CHECK (block_number >= 0),
  block_hash text NOT NULL,
  updated_at bigint NOT NULL,
  last_success_at bigint NOT NULL,
  failure_code text
);

CREATE TABLE IF NOT EXISTS corner_store_rfq.chain_blocks (
  source_id text NOT NULL,
  block_number bigint NOT NULL CHECK (block_number >= 0),
  block_hash text NOT NULL,
  parent_hash text NOT NULL,
  PRIMARY KEY (source_id, block_number)
);

CREATE TABLE IF NOT EXISTS corner_store_rfq.chain_observations (
  source_id text NOT NULL,
  transaction_hash text NOT NULL,
  log_index integer NOT NULL CHECK (log_index >= 0),
  block_number bigint NOT NULL CHECK (block_number >= 0),
  block_hash text NOT NULL,
  chain_id bigint NOT NULL CHECK (chain_id > 0),
  adapter text NOT NULL,
  maker text NOT NULL,
  nonce numeric(78, 0) NOT NULL CHECK (nonce > 0),
  kind text NOT NULL CHECK (kind IN ('fill', 'cancel')),
  PRIMARY KEY (source_id, transaction_hash, log_index),
  FOREIGN KEY (source_id, block_number)
    REFERENCES corner_store_rfq.chain_blocks(source_id, block_number) ON DELETE CASCADE
);
`
}];

export async function migrate(pool: Pool): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("SELECT pg_advisory_xact_lock($1)", [1_704_202_601]);
    await client.query(`CREATE SCHEMA IF NOT EXISTS corner_store_rfq`);
    await client.query(`CREATE TABLE IF NOT EXISTS corner_store_rfq.schema_migrations (
      version integer PRIMARY KEY, name text NOT NULL, checksum text NOT NULL,
      applied_at timestamptz NOT NULL DEFAULT now())`);
    for (const migration of MIGRATIONS) await applyMigration(client, migration);
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

async function applyMigration(client: PoolClient, migration: Migration): Promise<void> {
  const checksum = createHash("sha256").update(migration.sql).digest("hex");
  const existing = await client.query<{checksum: string}>(
    "SELECT checksum FROM corner_store_rfq.schema_migrations WHERE version = $1",
    [migration.version]
  );
  if (existing.rowCount) {
    if (existing.rows[0].checksum !== checksum) throw new Error(`migration ${migration.version} checksum mismatch`);
    return;
  }
  await client.query(migration.sql);
  await client.query(
    "INSERT INTO corner_store_rfq.schema_migrations(version, name, checksum) VALUES ($1, $2, $3)",
    [migration.version, migration.name, checksum]
  );
}
