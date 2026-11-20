import assert from "node:assert/strict";
import {execFile} from "node:child_process";
import {promisify} from "node:util";
import {join} from "node:path";
import test from "node:test";
import {Pool} from "pg";
import {
  PostgresQuoteCoordinatorStore,
  PostgresQuoteReconciliationWorker,
  QuoteChainEvent,
  ChainBlock,
  RFQChainReader
} from "../src";
import {ReserveQuoteInput, RFQStoreError} from "@corner-store/rfq-service";

const execFileAsync = promisify(execFile);

const DATABASE_URL = process.env.CORNER_STORE_TEST_POSTGRES_URL;
const REQUIRE_POSTGRES = process.env.CORNER_STORE_REQUIRE_POSTGRES === "1";
const MAKER = "0x1000000000000000000000000000000000000001" as const;
const TAKER = "0x2000000000000000000000000000000000000002" as const;
const TOKEN_IN = "0x3000000000000000000000000000000000000003" as const;
const TOKEN_OUT = "0x4000000000000000000000000000000000000004" as const;
const VENUE = "0x5000000000000000000000000000000000000005" as const;
const ADAPTER = "0x6000000000000000000000000000000000000006" as const;
const POLICY = `0x${"77".repeat(32)}` as `0x${string}`;
const scope = {chainId: 31337, adapter: ADAPTER, maker: MAKER};

test("PostgreSQL integration environment is available when required", {skip: !REQUIRE_POSTGRES}, () => {
  assert(DATABASE_URL, "CORNER_STORE_TEST_POSTGRES_URL is required");
});

test("PostgreSQL store preserves HA nonce, idempotency, inventory and reorg invariants", {skip: !DATABASE_URL}, async () => {
  const pool = new Pool({connectionString: DATABASE_URL, max: 30});
  await pool.query("DROP SCHEMA IF EXISTS corner_store_rfq CASCADE");
  const first = new PostgresQuoteCoordinatorStore({pool, confirmationDepth: 3, transactionRetries: 30});
  const second = new PostgresQuoteCoordinatorStore({pool, confirmationDepth: 3, transactionRetries: 30});
  await first.initialize([{maker: MAKER, token: TOKEN_OUT, venue: VENUE, available: "100"}]);
  await second.initialize();

  const attempts = (await Promise.all([runReserveWorker(0), runReserveWorker(1)])).flat();
  const fulfilled = attempts.filter((item) => item.status === "fulfilled");
  const rejected = attempts.filter((item) => item.status === "rejected");
  assert.equal(fulfilled.length, 10);
  assert.equal(rejected.length, 10);
  assert(rejected.every((item) => item.code === "INVENTORY_UNAVAILABLE"));
  assert.deepEqual(fulfilled.map((item) => Number(item.nonce)).sort((a, b) => a - b), [1,2,3,4,5,6,7,8,9,10]);
  assert.deepEqual(await first.inventory(MAKER, TOKEN_OUT, VENUE), {available: "100", reserved: "100"});

  const replay = await second.reserveOrReturnExisting(reserve("sha256:key-0", "sha256:request-0", 100, "10"));
  assert.equal(replay.existing, true);
  assert.equal(replay.record.nonce, fulfilled.find((item) => item.key === "sha256:key-0")?.nonce);
  await assert.rejects(
    second.reserveOrReturnExisting(reserve("sha256:key-0", "sha256:different", 100, "10")),
    (error: unknown) => error instanceof RFQStoreError && error.code === "IDEMPOTENCY_CONFLICT"
  );

  for (const item of fulfilled) await first.revoke({scope, nonce: item.nonce!, now: 500});
  assert.deepEqual(await first.inventory(MAKER, TOKEN_OUT, VENUE), {available: "100", reserved: "0"});

  const quote = await first.reserveOrReturnExisting(reserve("reorg-key", "reorg-request", 600, "25"));
  const nonce = quote.record.nonce!;
  await second.markSigned({
    scope,
    idempotencyKeyHash: "reorg-key",
    requestHash: "reorg-request",
    signedQuote: {quote: {
      maker: MAKER, taker: TAKER, tokenIn: TOKEN_IN, tokenOut: TOKEN_OUT,
      amountIn: "10", amountOut: "25", venue: VENUE, policyId: POLICY,
      nonce, expiry: 900
    }, signature: `0x${"11".repeat(65)}`, typedData: {} as any},
    quoteHash: "quote-hash",
    now: 601
  });

  const chain = new MutableChain();
  const oldBlock = chain.add(9, hash(9), hash(8));
  chain.add(10, hash(10), oldBlock.hash, [{
    transactionHash: hash(100), logIndex: 0, blockNumber: 10, blockHash: hash(10),
    scope, nonce, kind: "fill"
  }]);
  chain.setHead(10);
  const worker = new PostgresQuoteReconciliationWorker({
    pool, store: first, reader: chain, sourceId: "rfq-test", startBlock: 10,
    confirmationDepth: 3, maxLagBlocks: 0, maxStaleSeconds: 60, now: () => 700
  });
  assert.equal((await worker.runOnce()).ready, true);
  assert.equal((await first.getByIdempotencyKeyHash(scope, "reorg-key"))?.state, "FILL_OBSERVED");

  chain.add(10, hash(110), oldBlock.hash, []);
  assert.equal((await worker.runOnce()).ready, true);
  assert.equal((await first.getByIdempotencyKeyHash(scope, "reorg-key"))?.state, "PUBLISHED");
  assert.deepEqual(await first.inventory(MAKER, TOKEN_OUT, VENUE), {available: "100", reserved: "25"});

  chain.add(11, hash(111), hash(110), [{
    transactionHash: hash(101), logIndex: 0, blockNumber: 11, blockHash: hash(111),
    scope, nonce, kind: "fill"
  }]);
  chain.add(12, hash(112), hash(111), []);
  chain.add(13, hash(113), hash(112), []);
  chain.setHead(13);
  const restarted = new PostgresQuoteReconciliationWorker({
    pool, store: second, reader: chain, sourceId: "rfq-test", startBlock: 10,
    confirmationDepth: 3, maxLagBlocks: 0, maxStaleSeconds: 60, now: () => 701
  });
  const health = await restarted.runOnce();
  assert.equal(health.ready, true);
  assert.equal(health.cursorBlock, 13);
  assert.equal((await first.getByIdempotencyKeyHash(scope, "reorg-key"))?.state, "FILLED");
  assert.deepEqual(await first.inventory(MAKER, TOKEN_OUT, VENUE), {available: "100", reserved: "0"});
  await pool.end();
});

function reserve(key: string, requestHash: string, createdAt: number, amount: string): ReserveQuoteInput {
  return {
    scope,
    idempotencyKeyHash: key,
    requestHash,
    request: {taker: TAKER, tokenIn: TOKEN_IN, tokenOut: TOKEN_OUT, amountIn: "10", venue: VENUE, policyId: POLICY, ttlSeconds: 300},
    inventoryDelta: {maker: MAKER, token: TOKEN_OUT, venue: VENUE, amount},
    reservationExpiresAt: createdAt + 300,
    createdAt
  };
}

interface WorkerResult {
  status: "fulfilled" | "rejected";
  key: string;
  nonce?: string;
  code?: string;
}

async function runReserveWorker(workerId: number): Promise<WorkerResult[]> {
  const worker = join(__dirname, "fixtures", "reserve-worker.js");
  const {stdout} = await execFileAsync(process.execPath, [worker], {
    env: {...process.env, CORNER_STORE_WORKER_INPUT: JSON.stringify({databaseUrl: DATABASE_URL, workerId, count: 10})},
    maxBuffer: 1024 * 1024
  });
  return JSON.parse(stdout) as WorkerResult[];
}

class MutableChain implements RFQChainReader {
  private readonly blocks = new Map<number, ChainBlock>();
  private readonly events = new Map<number, readonly QuoteChainEvent[]>();
  private headNumber = 0;

  add(number: number, blockHash: `0x${string}`, parentHash: `0x${string}`, events: readonly QuoteChainEvent[] = []): ChainBlock {
    const block = {number, hash: blockHash, parentHash};
    this.blocks.set(number, block);
    this.events.set(number, events);
    return block;
  }

  setHead(number: number): void { this.headNumber = number; }
  async head(): Promise<ChainBlock> { return this.block(this.headNumber); }
  async block(blockNumber: number): Promise<ChainBlock> {
    const value = this.blocks.get(blockNumber);
    if (!value) throw new Error(`missing block ${blockNumber}`);
    return value;
  }
  async quoteEvents(fromBlock: number, toBlock: number): Promise<readonly QuoteChainEvent[]> {
    const result: QuoteChainEvent[] = [];
    for (let block = fromBlock; block <= toBlock; block += 1) result.push(...(this.events.get(block) ?? []));
    return result;
  }
}

function hash(value: number): `0x${string}` {
  return `0x${value.toString(16).padStart(64, "0")}`;
}
