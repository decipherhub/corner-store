import {Pool, PoolClient, QueryResult} from "pg";
import {
  ExpireInput,
  MarkObservedInput,
  MarkSignedInput,
  MarkSignFailedInput,
  QuoteCoordinatorRecord,
  QuoteCoordinatorStore,
  QuoteInventoryDelta,
  QuoteLifecycleState,
  QuoteNonceScope,
  ReconcileInput,
  ReserveQuoteInput,
  ReserveQuoteResult,
  RevokeInput,
  RFQStoreError,
  hashCanonical
} from "@corner-store/rfq-service";
import {migrate} from "./migrations";

export interface PostgresInventoryConfig {
  maker: string;
  token: string;
  venue: string;
  available: string;
}

export interface PostgresQuoteCoordinatorStoreConfig {
  pool: Pool;
  confirmationDepth?: number;
  transactionRetries?: number;
}

interface QuoteRow {
  request_hash: string;
  record: QuoteCoordinatorRecord;
  lease_released: boolean;
}

const TERMINAL = new Set<QuoteLifecycleState>(["FILLED", "CANCELLED", "EXPIRED", "SIGN_FAILED", "REVOKED"]);

export class PostgresQuoteCoordinatorStore implements QuoteCoordinatorStore {
  private readonly pool: Pool;
  private readonly confirmationDepth: number;
  private readonly transactionRetries: number;

  constructor(config: PostgresQuoteCoordinatorStoreConfig) {
    this.pool = config.pool;
    this.confirmationDepth = positiveInteger(config.confirmationDepth ?? 12, "confirmationDepth");
    this.transactionRetries = positiveInteger(config.transactionRetries ?? 4, "transactionRetries");
  }

  async initialize(inventory: readonly PostgresInventoryConfig[] = []): Promise<void> {
    await migrate(this.pool);
    if (!inventory.length) return;
    await this.transaction(async (client) => {
      for (const item of [...inventory].sort(compareInventory)) {
        const maker = address(item.maker, "inventory maker");
        const token = address(item.token, "inventory token");
        const venue = address(item.venue, "inventory venue");
        const available = uint(item.available, "inventory available", true);
        const result = await client.query(
          `INSERT INTO corner_store_rfq.inventory(maker, token, venue, available, reserved, updated_at)
           VALUES ($1, $2, $3, $4, 0, $5)
           ON CONFLICT (maker, token, venue) DO UPDATE
             SET available = EXCLUDED.available, updated_at = EXCLUDED.updated_at
             WHERE corner_store_rfq.inventory.reserved <= EXCLUDED.available`,
          [maker, token, venue, available, epochSeconds()]
        );
        if (!result.rowCount) throw new Error("configured inventory is below the currently reserved amount");
      }
    });
  }

  async reserveOrReturnExisting(input: ReserveQuoteInput): Promise<ReserveQuoteResult> {
    return this.transaction(async (client) => {
      const existing = await this.byIdempotency(client, input.scope, input.idempotencyKeyHash, true);
      if (existing) {
        if (existing.requestHash !== input.requestHash) {
          throw new RFQStoreError("IDEMPOTENCY_CONFLICT", "idempotency key conflict: request hash differs");
        }
        return {record: clone(existing), existing: true};
      }

      const inventory = normalizedInventory(input.inventoryDelta);
      const bucket = await client.query<{available: string; reserved: string}>(
        `SELECT available::text, reserved::text FROM corner_store_rfq.inventory
         WHERE maker = $1 AND token = $2 AND venue = $3 FOR UPDATE`,
        [inventory.maker, inventory.token, inventory.venue]
      );
      if (!bucket.rowCount) throw new RFQStoreError("INVENTORY_NOT_CONFIGURED", "inventory is not configured for maker/token/venue");

      const released = await this.releaseExpiredLeases(client, inventory, input.createdAt);
      const currentReserved = BigInt(bucket.rows[0].reserved) - released;
      const available = BigInt(bucket.rows[0].available);
      const requested = BigInt(inventory.amount);
      if (available - currentReserved < requested) {
        throw new RFQStoreError("INVENTORY_UNAVAILABLE", "insufficient unreserved inventory");
      }

      const nonceResult = await client.query<{last_nonce: string}>(
        `INSERT INTO corner_store_rfq.nonce_scopes(chain_id, adapter, maker, last_nonce)
         VALUES ($1, $2, $3, 1)
         ON CONFLICT (chain_id, adapter, maker) DO UPDATE
           SET last_nonce = corner_store_rfq.nonce_scopes.last_nonce + 1
         RETURNING last_nonce::text`,
        scopeParams(input.scope)
      );
      const nonce = nonceResult.rows[0].last_nonce;
      await client.query(
        `UPDATE corner_store_rfq.inventory SET reserved = $4, updated_at = $5
         WHERE maker = $1 AND token = $2 AND venue = $3`,
        [inventory.maker, inventory.token, inventory.venue, (currentReserved + requested).toString(), input.createdAt]
      );
      const record: QuoteCoordinatorRecord = {
        schemaVersion: input.quoteVersion === 3 ? 2 : 1,
        quoteVersion: input.quoteVersion,
        domain: input.domain,
        contextEvidence: input.contextEvidence,
        productAuthorization: input.productAuthorization,
        state: "RESERVED",
        scope: normalizedScope(input.scope),
        idempotencyKeyHash: input.idempotencyKeyHash,
        requestHash: input.requestHash,
        request: clone(input.request),
        nonce,
        inventoryLease: {
          ...inventory,
          leaseId: hashCanonical({scope: normalizedScope(input.scope), nonce, inventory}),
          expiresAt: input.reservationExpiresAt,
          released: false
        },
        createdAt: input.createdAt,
        updatedAt: input.createdAt,
        pricingSnapshotId: input.pricingSnapshotId,
        moduleVersions: input.moduleVersions,
        productionEvidence: input.productionEvidence,
        riskDecision: "passed",
        stateHistory: [{state: "RECEIVED", at: input.createdAt}, {state: "RESERVED", at: input.createdAt}]
      };
      await client.query(
        `INSERT INTO corner_store_rfq.quote_records(
           chain_id, adapter, maker, idempotency_key_hash, request_hash, nonce, state,
           inventory_token, inventory_venue, inventory_amount, reservation_expires_at,
           lease_released, record, created_at, updated_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,false,$12::jsonb,$13,$14)`,
        [...scopeParams(input.scope), input.idempotencyKeyHash, input.requestHash, nonce, record.state,
          inventory.token, inventory.venue, inventory.amount, input.reservationExpiresAt,
          JSON.stringify(record), input.createdAt, input.createdAt]
      );
      return {record: clone(record), existing: false};
    });
  }

  async markSigned(input: MarkSignedInput): Promise<QuoteCoordinatorRecord> {
    return this.transaction(async (client) => {
      const record = await this.requireByIdempotency(client, input.scope, input.idempotencyKeyHash, input.requestHash);
      if (record.state !== "RESERVED" || !record.inventoryLease || record.inventoryLease.released) return clone(record);
      if (record.inventoryLease.expiresAt <= input.now) {
        transition(record, "EXPIRED", input.now, true);
        await this.releaseLease(client, record, "expired");
        await this.persist(client, record);
        return clone(record);
      }
      if (input.signedQuote.quote.nonce !== record.nonce || input.signedQuote.quote.expiry !== record.inventoryLease.expiresAt) {
        throw new Error("signed quote does not match reserved nonce or expiry");
      }
      record.stateHistory.push({state: "SIGNED", at: input.now});
      record.state = "PUBLISHED";
      record.stateHistory.push({state: "PUBLISHED", at: input.now});
      record.signedQuote = clone(input.signedQuote);
      record.quoteHash = input.quoteHash;
      record.signerKeyRefHash = input.signerKeyRefHash;
      record.updatedAt = input.now;
      await this.persist(client, record);
      return clone(record);
    });
  }

  async markSignFailed(input: MarkSignFailedInput): Promise<QuoteCoordinatorRecord> {
    return this.transaction(async (client) => {
      const record = await this.requireByIdempotency(client, input.scope, input.idempotencyKeyHash, input.requestHash);
      if (record.state === "SIGN_FAILED" || TERMINAL.has(record.state) || record.state !== "RESERVED") return clone(record);
      transition(record, "SIGN_FAILED", input.now, true);
      await this.releaseLease(client, record, "sign-failed");
      await this.persist(client, record);
      return clone(record);
    });
  }

  async markObserved(input: MarkObservedInput): Promise<QuoteCoordinatorRecord> {
    return this.transaction(async (client) => {
      const record = await this.requireByNonce(client, input.scope, input.nonce);
      if (TERMINAL.has(record.state)) return clone(record);
      if (record.state === "FILL_OBSERVED" || record.state === "CANCEL_OBSERVED") {
        if (sameObservation(record.observed, input.observation)) return clone(record);
        throw new Error("conflicting settlement observation for quote nonce");
      }
      if (record.state !== "PUBLISHED") throw new Error(`cannot observe settlement from state ${record.state}`);
      record.state = input.observation.kind === "fill" ? "FILL_OBSERVED" : "CANCEL_OBSERVED";
      record.stateHistory.push({state: record.state, at: input.now});
      record.observed = clone(input.observation);
      record.updatedAt = input.now;
      await this.persist(client, record);
      return clone(record);
    });
  }

  async reconcile(input: ReconcileInput): Promise<QuoteCoordinatorRecord> {
    return this.transaction(async (client) => {
      const record = await this.requireByNonce(client, input.scope, input.nonce);
      if (record.state !== "FILL_OBSERVED" && record.state !== "CANCEL_OBSERVED") return clone(record);
      if (!record.observed) throw new Error("observed record is missing observation data");
      if (!input.canonicalBlockHash) return clone(record);
      if (input.canonicalBlockHash.toLowerCase() !== record.observed.blockHash.toLowerCase()) {
        record.state = "PUBLISHED";
        record.stateHistory.push({state: "PUBLISHED", at: input.now});
        record.observed = undefined;
        record.updatedAt = input.now;
        await this.persist(client, record);
        return clone(record);
      }
      if (input.currentBlockNumber - record.observed.blockNumber + 1 >= this.confirmationDepth) {
        const finalState = record.state === "FILL_OBSERVED" ? "FILLED" : "CANCELLED";
        transition(record, finalState, input.now, true);
        await this.releaseLease(client, record, finalState === "FILLED" ? "filled" : "cancelled");
        await this.persist(client, record);
      }
      return clone(record);
    });
  }

  async expire(input: ExpireInput): Promise<QuoteCoordinatorRecord> {
    return this.transaction(async (client) => {
      const record = await this.requireByNonce(client, input.scope, input.nonce);
      if (TERMINAL.has(record.state)) return clone(record);
      if (record.state === "FILL_OBSERVED" || record.state === "CANCEL_OBSERVED") throw new Error("observed quote cannot expire before reconciliation");
      if (record.signedQuote && input.now < record.signedQuote.quote.expiry) throw new Error("quote has not expired");
      transition(record, "EXPIRED", input.now, true);
      await this.releaseLease(client, record, "expired");
      await this.persist(client, record);
      return clone(record);
    });
  }

  async revoke(input: RevokeInput): Promise<QuoteCoordinatorRecord> {
    return this.transaction(async (client) => {
      const record = await this.requireByNonce(client, input.scope, input.nonce);
      if (TERMINAL.has(record.state)) return clone(record);
      if (record.state === "FILL_OBSERVED" || record.state === "CANCEL_OBSERVED") throw new Error("observed quote cannot be revoked before reconciliation");
      transition(record, "REVOKED", input.now, true);
      await this.releaseLease(client, record, "revoke");
      await this.persist(client, record);
      return clone(record);
    });
  }

  async getByIdempotencyKeyHash(scope: QuoteNonceScope, idempotencyKeyHash: string): Promise<QuoteCoordinatorRecord | undefined> {
    const result = await this.pool.query<{record: QuoteCoordinatorRecord}>(
      `SELECT record FROM corner_store_rfq.quote_records
       WHERE chain_id = $1 AND adapter = $2 AND maker = $3 AND idempotency_key_hash = $4`,
      [...scopeParams(scope), idempotencyKeyHash]
    );
    return result.rowCount ? clone(result.rows[0].record) : undefined;
  }

  async inventory(maker: string, token: string, venue: string): Promise<{available: string; reserved: string} | undefined> {
    const result = await this.pool.query<{available: string; reserved: string}>(
      `SELECT available::text, reserved::text FROM corner_store_rfq.inventory
       WHERE maker = $1 AND token = $2 AND venue = $3`,
      [address(maker, "maker"), address(token, "token"), address(venue, "venue")]
    );
    return result.rowCount ? result.rows[0] : undefined;
  }

  private async transaction<T>(operation: (client: PoolClient) => Promise<T>): Promise<T> {
    for (let attempt = 1; ; attempt += 1) {
      const client = await this.pool.connect();
      try {
        await client.query("BEGIN ISOLATION LEVEL SERIALIZABLE");
        const result = await operation(client);
        await client.query("COMMIT");
        return result;
      } catch (error: any) {
        try { await client.query("ROLLBACK"); } catch { /* preserve the original failure */ }
        if (attempt < this.transactionRetries && ["40001", "40P01", "23505"].includes(error?.code)) continue;
        throw error;
      } finally {
        client.release();
      }
    }
  }

  private async byIdempotency(client: PoolClient, scope: QuoteNonceScope, key: string, lock: boolean): Promise<QuoteCoordinatorRecord | undefined> {
    const result = await client.query<{record: QuoteCoordinatorRecord}>(
      `SELECT record FROM corner_store_rfq.quote_records
       WHERE chain_id = $1 AND adapter = $2 AND maker = $3 AND idempotency_key_hash = $4${lock ? " FOR UPDATE" : ""}`,
      [...scopeParams(scope), key]
    );
    return result.rowCount ? clone(result.rows[0].record) : undefined;
  }

  private async requireByIdempotency(client: PoolClient, scope: QuoteNonceScope, key: string, requestHash: string): Promise<QuoteCoordinatorRecord> {
    const record = await this.byIdempotency(client, scope, key, true);
    if (!record) throw new Error("quote record not found");
    if (record.requestHash !== requestHash) throw new RFQStoreError("IDEMPOTENCY_CONFLICT", "idempotency key conflict: request hash differs");
    return record;
  }

  private async requireByNonce(client: PoolClient, scope: QuoteNonceScope, nonce: string): Promise<QuoteCoordinatorRecord> {
    const result = await client.query<{record: QuoteCoordinatorRecord}>(
      `SELECT record FROM corner_store_rfq.quote_records
       WHERE chain_id = $1 AND adapter = $2 AND maker = $3 AND nonce = $4 FOR UPDATE`,
      [...scopeParams(scope), uint(nonce, "nonce")]
    );
    if (!result.rowCount) throw new Error("quote record not found");
    return clone(result.rows[0].record);
  }

  private async releaseExpiredLeases(client: PoolClient, inventory: QuoteInventoryDelta, now: number): Promise<bigint> {
    const rows = await client.query<{record: QuoteCoordinatorRecord}>(
      `SELECT record FROM corner_store_rfq.quote_records
       WHERE maker = $1 AND inventory_token = $2 AND inventory_venue = $3
         AND lease_released = false AND reservation_expires_at <= $4
         AND state NOT IN ('FILL_OBSERVED','CANCEL_OBSERVED','FILLED','CANCELLED','EXPIRED','SIGN_FAILED','REVOKED')
       ORDER BY chain_id, adapter, nonce FOR UPDATE`,
      [inventory.maker, inventory.token, inventory.venue, now]
    );
    let released = 0n;
    for (const row of rows.rows) {
      const record = clone(row.record);
      transition(record, "EXPIRED", now, true);
      const amount = BigInt(record.inventoryLease!.amount);
      record.inventoryLease!.released = true;
      record.inventoryLease!.releaseReason = "expired";
      record.releaseReason = "expired";
      await this.persist(client, record);
      released += amount;
    }
    return released;
  }

  private async releaseLease(client: PoolClient, record: QuoteCoordinatorRecord, reason: NonNullable<QuoteCoordinatorRecord["releaseReason"]>): Promise<void> {
    if (!record.inventoryLease || record.inventoryLease.released) return;
    const lease = record.inventoryLease;
    const result = await client.query<{reserved: string}>(
      `SELECT reserved::text FROM corner_store_rfq.inventory
       WHERE maker = $1 AND token = $2 AND venue = $3 FOR UPDATE`,
      [lease.maker, lease.token, lease.venue]
    );
    if (!result.rowCount) throw new Error("inventory bucket missing during lease release");
    const reserved = BigInt(result.rows[0].reserved) - BigInt(lease.amount);
    if (reserved < 0n) throw new Error("inventory reservation underflow");
    await client.query(
      `UPDATE corner_store_rfq.inventory SET reserved = $4, updated_at = $5
       WHERE maker = $1 AND token = $2 AND venue = $3`,
      [lease.maker, lease.token, lease.venue, reserved.toString(), record.updatedAt]
    );
    lease.released = true;
    lease.releaseReason = reason;
    record.releaseReason = reason;
  }

  private async persist(client: PoolClient, record: QuoteCoordinatorRecord): Promise<void> {
    await client.query(
      `UPDATE corner_store_rfq.quote_records
       SET state = $5, lease_released = $6, record = $7::jsonb, updated_at = $8
       WHERE chain_id = $1 AND adapter = $2 AND maker = $3 AND idempotency_key_hash = $4`,
      [...scopeParams(record.scope), record.idempotencyKeyHash, record.state,
        record.inventoryLease?.released ?? true, JSON.stringify(record), record.updatedAt]
    );
  }
}

function scopeParams(scope: QuoteNonceScope): [number, string, string] {
  const normalized = normalizedScope(scope);
  return [normalized.chainId, normalized.adapter, normalized.maker];
}

function normalizedScope(scope: QuoteNonceScope): QuoteNonceScope {
  if (!Number.isSafeInteger(scope.chainId) || scope.chainId <= 0) throw new Error("chainId must be a positive safe integer");
  return {chainId: scope.chainId, adapter: address(scope.adapter, "adapter") as `0x${string}`, maker: address(scope.maker, "maker") as `0x${string}`};
}

function normalizedInventory(value: QuoteInventoryDelta): QuoteInventoryDelta {
  return {
    maker: address(value.maker, "inventory maker") as `0x${string}`,
    token: address(value.token, "inventory token") as `0x${string}`,
    venue: address(value.venue, "inventory venue") as `0x${string}`,
    amount: uint(value.amount, "inventory amount")
  };
}

function address(value: string, field: string): string {
  if (!/^0x[0-9a-fA-F]{40}$/.test(value)) throw new Error(`${field} must be a 20-byte hex address`);
  return value.toLowerCase();
}

function uint(value: string, field: string, allowZero = false): string {
  if (!/^(0|[1-9][0-9]*)$/.test(value)) throw new Error(`${field} must be an unsigned decimal string`);
  const parsed = BigInt(value);
  if ((!allowZero && parsed === 0n) || parsed >= 2n ** 256n) throw new Error(`${field} is out of range`);
  return parsed.toString();
}

function positiveInteger(value: number, field: string): number {
  if (!Number.isSafeInteger(value) || value <= 0) throw new Error(`${field} must be a positive safe integer`);
  return value;
}

function transition(record: QuoteCoordinatorRecord, state: QuoteLifecycleState, at: number, terminal: boolean): void {
  record.state = state;
  record.stateHistory.push({state, at});
  record.updatedAt = at;
  if (terminal) record.terminalAt = at;
}

function sameObservation(a: QuoteCoordinatorRecord["observed"], b: NonNullable<QuoteCoordinatorRecord["observed"]>): boolean {
  return !!a && a.kind === b.kind && a.transactionHash.toLowerCase() === b.transactionHash.toLowerCase()
    && a.blockNumber === b.blockNumber && a.blockHash.toLowerCase() === b.blockHash.toLowerCase();
}

function compareInventory(a: PostgresInventoryConfig, b: PostgresInventoryConfig): number {
  return `${a.maker}:${a.token}:${a.venue}`.localeCompare(`${b.maker}:${b.token}:${b.venue}`);
}

function clone<T>(value: T): T {
  return value === undefined ? value : JSON.parse(JSON.stringify(value));
}

function epochSeconds(): number {
  return Math.floor(Date.now() / 1000);
}
