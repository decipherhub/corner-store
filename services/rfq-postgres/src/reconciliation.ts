import {Pool} from "pg";
import {QuoteNonceScope, QuoteObservation} from "@corner-store/rfq-service";
import {PostgresQuoteCoordinatorStore} from "./store";

export interface ChainBlock {
  number: number;
  hash: `0x${string}`;
  parentHash: `0x${string}`;
}

export interface QuoteChainEvent {
  transactionHash: `0x${string}`;
  logIndex: number;
  blockNumber: number;
  blockHash: `0x${string}`;
  scope: QuoteNonceScope;
  nonce: string;
  kind: "fill" | "cancel";
}

export interface RFQChainReader {
  head(): Promise<ChainBlock>;
  block(blockNumber: number): Promise<ChainBlock>;
  quoteEvents(fromBlock: number, toBlock: number): Promise<readonly QuoteChainEvent[]>;
}

export interface ReconciliationWorkerConfig {
  pool: Pool;
  store: PostgresQuoteCoordinatorStore;
  reader: RFQChainReader;
  sourceId: string;
  startBlock: number;
  confirmationDepth?: number;
  maxBlockRange?: number;
  maxReorgDepth?: number;
  maxLagBlocks?: number;
  maxStaleSeconds?: number;
  now?: () => number;
}

export interface ReconciliationHealth {
  ready: boolean;
  sourceId: string;
  cursorBlock: number;
  headBlock: number;
  lagBlocks: number;
  staleSeconds: number;
  failureCode?: string;
}

interface CursorRow {
  block_number: string;
  block_hash: string;
  updated_at: string;
  last_success_at: string;
  failure_code: string | null;
}

export class PostgresQuoteReconciliationWorker {
  private readonly pool: Pool;
  private readonly store: PostgresQuoteCoordinatorStore;
  private readonly reader: RFQChainReader;
  private readonly sourceId: string;
  private readonly startBlock: number;
  private readonly confirmationDepth: number;
  private readonly maxBlockRange: number;
  private readonly maxReorgDepth: number;
  private readonly maxLagBlocks: number;
  private readonly maxStaleSeconds: number;
  private readonly now: () => number;

  constructor(config: ReconciliationWorkerConfig) {
    this.pool = config.pool;
    this.store = config.store;
    this.reader = config.reader;
    this.sourceId = boundedSourceId(config.sourceId);
    this.startBlock = nonNegative(config.startBlock, "startBlock");
    this.confirmationDepth = positive(config.confirmationDepth ?? 12, "confirmationDepth");
    this.maxBlockRange = positive(config.maxBlockRange ?? 500, "maxBlockRange");
    this.maxReorgDepth = positive(config.maxReorgDepth ?? 64, "maxReorgDepth");
    this.maxLagBlocks = nonNegative(config.maxLagBlocks ?? this.confirmationDepth * 2, "maxLagBlocks");
    this.maxStaleSeconds = positive(config.maxStaleSeconds ?? 120, "maxStaleSeconds");
    this.now = config.now ?? (() => Math.floor(Date.now() / 1000));
  }

  async runOnce(): Promise<ReconciliationHealth> {
    const now = this.now();
    try {
      const head = validateBlock(await this.reader.head());
      let cursor = await this.cursor();
      if (!cursor) cursor = await this.initializeCursor(now);
      cursor = await this.rollbackReorg(cursor, now);
      const toBlock = Math.min(head.number, cursor.blockNumber + this.maxBlockRange);
      for (let blockNumber = cursor.blockNumber + 1; blockNumber <= toBlock; blockNumber += 1) {
        const block = validateBlock(await this.reader.block(blockNumber));
        if (block.parentHash.toLowerCase() !== cursor.blockHash.toLowerCase()) {
          throw failure("CHAIN_DISCONTINUITY", `block ${block.number} does not extend the persisted cursor`);
        }
        const events = [...await this.reader.quoteEvents(blockNumber, blockNumber)].sort(compareEvents);
        for (const event of events) {
          validateEvent(event, block);
        }
        await this.stageBlock(block, events, now);
        for (const event of events) {
          await this.store.markObserved({
            scope: event.scope,
            nonce: event.nonce,
            observation: observation(event),
            now
          });
        }
        await this.advanceCursor(block, now);
        cursor = {blockNumber: block.number, blockHash: block.hash};
      }
      await this.finalizeCanonical(head, now);
      await this.clearFailure(now);
      return this.health(head.number, now);
    } catch (error: any) {
      await this.recordFailure(typeof error?.code === "string" ? error.code : "RECONCILIATION_FAILED", now);
      throw error;
    }
  }

  async health(headBlock?: number, now = this.now()): Promise<ReconciliationHealth> {
    const head = headBlock ?? validateBlock(await this.reader.head()).number;
    const row = await this.cursorRow();
    if (!row) {
      return {ready: false, sourceId: this.sourceId, cursorBlock: this.startBlock - 1, headBlock: head,
        lagBlocks: Math.max(0, head - this.startBlock + 1), staleSeconds: 0, failureCode: "CURSOR_MISSING"};
    }
    const cursorBlock = Number(row.block_number);
    const lagBlocks = Math.max(0, head - cursorBlock);
    const staleSeconds = Math.max(0, now - Number(row.last_success_at));
    const failureCode = row.failure_code ?? undefined;
    return {
      ready: !failureCode && lagBlocks <= this.maxLagBlocks && staleSeconds <= this.maxStaleSeconds,
      sourceId: this.sourceId,
      cursorBlock,
      headBlock: head,
      lagBlocks,
      staleSeconds,
      failureCode: failureCode ?? (lagBlocks > this.maxLagBlocks ? "RECONCILIATION_LAG" : staleSeconds > this.maxStaleSeconds ? "RECONCILIATION_STALE" : undefined)
    };
  }

  private async initializeCursor(now: number): Promise<{blockNumber: number; blockHash: `0x${string}`}> {
    if (this.startBlock === 0) throw failure("START_BLOCK_INVALID", "startBlock must be greater than zero for parent-bound cursor initialization");
    const parent = validateBlock(await this.reader.block(this.startBlock - 1));
    await this.pool.query(
      `INSERT INTO corner_store_rfq.chain_cursors(source_id, block_number, block_hash, updated_at, last_success_at, failure_code)
       VALUES ($1,$2,$3,$4,$4,NULL) ON CONFLICT (source_id) DO NOTHING`,
      [this.sourceId, parent.number, parent.hash.toLowerCase(), now]
    );
    await this.pool.query(
      `INSERT INTO corner_store_rfq.chain_blocks(source_id, block_number, block_hash, parent_hash)
       VALUES ($1,$2,$3,$4) ON CONFLICT (source_id, block_number) DO NOTHING`,
      [this.sourceId, parent.number, parent.hash.toLowerCase(), parent.parentHash.toLowerCase()]
    );
    return {blockNumber: parent.number, blockHash: parent.hash};
  }

  private async rollbackReorg(cursor: {blockNumber: number; blockHash: `0x${string}`}, now: number): Promise<{blockNumber: number; blockHash: `0x${string}`}> {
    const canonical = validateBlock(await this.reader.block(cursor.blockNumber));
    if (canonical.hash.toLowerCase() === cursor.blockHash.toLowerCase()) return cursor;
    let ancestor = cursor.blockNumber;
    for (let depth = 0; depth < this.maxReorgDepth && ancestor >= this.startBlock - 1; depth += 1, ancestor -= 1) {
      const stored = await this.pool.query<{block_hash: string}>(
        `SELECT block_hash FROM corner_store_rfq.chain_blocks WHERE source_id = $1 AND block_number = $2`,
        [this.sourceId, ancestor]
      );
      const expected = ancestor === this.startBlock - 1 && !stored.rowCount ? (await this.cursorAt(ancestor)) : stored.rows[0]?.block_hash;
      if (!expected) continue;
      const actual = validateBlock(await this.reader.block(ancestor));
      if (actual.hash.toLowerCase() === expected.toLowerCase()) {
        await this.rollbackObservationsAfter(ancestor, now);
        const client = await this.pool.connect();
        try {
          await client.query("BEGIN");
          await client.query(`DELETE FROM corner_store_rfq.chain_blocks WHERE source_id = $1 AND block_number > $2`, [this.sourceId, ancestor]);
          await client.query(
            `UPDATE corner_store_rfq.chain_cursors SET block_number = $2, block_hash = $3, updated_at = $4,
             last_success_at = $4, failure_code = NULL WHERE source_id = $1`,
            [this.sourceId, ancestor, actual.hash.toLowerCase(), now]
          );
          await client.query("COMMIT");
        } catch (error) {
          await client.query("ROLLBACK");
          throw error;
        } finally {
          client.release();
        }
        return {blockNumber: ancestor, blockHash: actual.hash};
      }
    }
    throw failure("REORG_DEPTH_EXCEEDED", "no common ancestor found within configured reorg depth");
  }

  private async rollbackObservationsAfter(ancestor: number, now: number): Promise<void> {
    const result = await this.pool.query<ObservationRow>(
      `SELECT chain_id::text, adapter, maker, nonce::text, block_hash
       FROM corner_store_rfq.chain_observations WHERE source_id = $1 AND block_number > $2
       ORDER BY block_number DESC, log_index DESC`,
      [this.sourceId, ancestor]
    );
    const nonCanonical = `0x${"00".repeat(32)}` as `0x${string}`;
    for (const row of result.rows) {
      const record = await this.store.reconcile({
        scope: {chainId: Number(row.chain_id), adapter: row.adapter as `0x${string}`, maker: row.maker as `0x${string}`},
        nonce: row.nonce,
        currentBlockNumber: ancestor,
        canonicalBlockHash: nonCanonical,
        now
      });
      if (record.state !== "PUBLISHED") throw failure("FINALIZED_REORG", "reorg crossed a finalized quote observation");
    }
  }

  private async stageBlock(block: ChainBlock, events: readonly QuoteChainEvent[], now: number): Promise<void> {
    const existing = await this.pool.query<{block_hash: string}>(
      `SELECT block_hash FROM corner_store_rfq.chain_blocks WHERE source_id = $1 AND block_number = $2`,
      [this.sourceId, block.number]
    );
    if (existing.rowCount && existing.rows[0].block_hash.toLowerCase() !== block.hash.toLowerCase()) {
      await this.rollbackObservationsAfter(block.number - 1, now);
      await this.pool.query(
        `DELETE FROM corner_store_rfq.chain_blocks WHERE source_id = $1 AND block_number >= $2`,
        [this.sourceId, block.number]
      );
    }
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      await client.query(
        `INSERT INTO corner_store_rfq.chain_blocks(source_id, block_number, block_hash, parent_hash)
         VALUES ($1,$2,$3,$4)
         ON CONFLICT (source_id, block_number) DO UPDATE SET block_hash = EXCLUDED.block_hash, parent_hash = EXCLUDED.parent_hash`,
        [this.sourceId, block.number, block.hash.toLowerCase(), block.parentHash.toLowerCase()]
      );
      for (const event of events) {
        await client.query(
          `INSERT INTO corner_store_rfq.chain_observations(
             source_id, transaction_hash, log_index, block_number, block_hash,
             chain_id, adapter, maker, nonce, kind)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
           ON CONFLICT (source_id, transaction_hash, log_index) DO NOTHING`,
          [this.sourceId, event.transactionHash.toLowerCase(), event.logIndex, event.blockNumber,
            event.blockHash.toLowerCase(), event.scope.chainId, event.scope.adapter.toLowerCase(),
            event.scope.maker.toLowerCase(), event.nonce, event.kind]
        );
      }
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  private async advanceCursor(block: ChainBlock, now: number): Promise<void> {
    await this.pool.query(
      `UPDATE corner_store_rfq.chain_cursors SET block_number = $2, block_hash = $3,
       updated_at = $4, last_success_at = $4, failure_code = NULL WHERE source_id = $1`,
      [this.sourceId, block.number, block.hash.toLowerCase(), now]
    );
  }

  private async finalizeCanonical(head: ChainBlock, now: number): Promise<void> {
    const finalBlock = head.number - this.confirmationDepth + 1;
    if (finalBlock < 0) return;
    const result = await this.pool.query<ObservationRow & {block_number: string}>(
      `SELECT chain_id::text, adapter, maker, nonce::text, block_number::text, block_hash
       FROM corner_store_rfq.chain_observations
       WHERE source_id = $1 AND block_number <= $2 ORDER BY block_number, log_index`,
      [this.sourceId, finalBlock]
    );
    for (const row of result.rows) {
      const canonical = validateBlock(await this.reader.block(Number(row.block_number)));
      await this.store.reconcile({
        scope: {chainId: Number(row.chain_id), adapter: row.adapter as `0x${string}`, maker: row.maker as `0x${string}`},
        nonce: row.nonce,
        currentBlockNumber: head.number,
        canonicalBlockHash: canonical.hash,
        now
      });
    }
  }

  private async cursor(): Promise<{blockNumber: number; blockHash: `0x${string}`} | undefined> {
    const row = await this.cursorRow();
    return row ? {blockNumber: Number(row.block_number), blockHash: row.block_hash as `0x${string}`} : undefined;
  }

  private async cursorAt(blockNumber: number): Promise<string | undefined> {
    const row = await this.cursorRow();
    return row && Number(row.block_number) === blockNumber ? row.block_hash : undefined;
  }

  private async cursorRow(): Promise<CursorRow | undefined> {
    const result = await this.pool.query<CursorRow>(
      `SELECT block_number::text, block_hash, updated_at::text, last_success_at::text, failure_code
       FROM corner_store_rfq.chain_cursors WHERE source_id = $1`, [this.sourceId]
    );
    return result.rowCount ? result.rows[0] : undefined;
  }

  private async clearFailure(now: number): Promise<void> {
    await this.pool.query(
      `UPDATE corner_store_rfq.chain_cursors SET failure_code = NULL, last_success_at = $2, updated_at = $2 WHERE source_id = $1`,
      [this.sourceId, now]
    );
  }

  private async recordFailure(code: string, now: number): Promise<void> {
    await this.pool.query(
      `UPDATE corner_store_rfq.chain_cursors SET failure_code = $2, updated_at = $3 WHERE source_id = $1`,
      [this.sourceId, code.slice(0, 64), now]
    ).catch(() => undefined);
  }
}

interface ObservationRow {
  chain_id: string;
  adapter: string;
  maker: string;
  nonce: string;
  block_hash: string;
}

function observation(event: QuoteChainEvent): QuoteObservation {
  return {kind: event.kind, transactionHash: event.transactionHash, blockNumber: event.blockNumber, blockHash: event.blockHash};
}

function validateBlock(block: ChainBlock): ChainBlock {
  nonNegative(block.number, "block number");
  bytes32(block.hash, "block hash");
  bytes32(block.parentHash, "parent hash");
  return block;
}

function validateEvent(event: QuoteChainEvent, block: ChainBlock): void {
  if (event.blockNumber !== block.number || event.blockHash.toLowerCase() !== block.hash.toLowerCase()) throw failure("EVENT_BLOCK_MISMATCH", "event block binding mismatch");
  bytes32(event.transactionHash, "transaction hash");
  nonNegative(event.logIndex, "logIndex");
  if (!/^[1-9][0-9]*$/.test(event.nonce)) throw failure("EVENT_NONCE_INVALID", "event nonce is invalid");
}

function compareEvents(a: QuoteChainEvent, b: QuoteChainEvent): number {
  return a.logIndex - b.logIndex || a.transactionHash.localeCompare(b.transactionHash);
}

function boundedSourceId(value: string): string {
  if (!/^[A-Za-z0-9._:-]{1,128}$/.test(value)) throw new Error("sourceId must be a bounded operational identifier");
  return value;
}

function bytes32(value: string, field: string): void {
  if (!/^0x[0-9a-fA-F]{64}$/.test(value)) throw new Error(`${field} must be 32-byte hex`);
}

function positive(value: number, field: string): number {
  if (!Number.isSafeInteger(value) || value <= 0) throw new Error(`${field} must be a positive safe integer`);
  return value;
}

function nonNegative(value: number, field: string): number {
  if (!Number.isSafeInteger(value) || value < 0) throw new Error(`${field} must be a non-negative safe integer`);
  return value;
}

function failure(code: string, message: string): Error & {code: string} {
  return Object.assign(new Error(message), {code});
}
