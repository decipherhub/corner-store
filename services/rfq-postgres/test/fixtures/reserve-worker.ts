import {Pool} from "pg";
import {PostgresQuoteCoordinatorStore} from "../../src";
import {RFQStoreError} from "@corner-store/rfq-service";

const config = JSON.parse(process.env.CORNER_STORE_WORKER_INPUT ?? "null") as {
  databaseUrl: string;
  workerId: number;
  count: number;
};

const MAKER = "0x1000000000000000000000000000000000000001" as const;
const TAKER = "0x2000000000000000000000000000000000000002" as const;
const TOKEN_IN = "0x3000000000000000000000000000000000000003" as const;
const TOKEN_OUT = "0x4000000000000000000000000000000000000004" as const;
const VENUE = "0x5000000000000000000000000000000000000005" as const;
const ADAPTER = "0x6000000000000000000000000000000000000006" as const;
const POLICY = `0x${"77".repeat(32)}` as `0x${string}`;

async function main(): Promise<void> {
  if (!config?.databaseUrl) throw new Error("worker database URL missing");
  const pool = new Pool({connectionString: config.databaseUrl, max: 4});
  const store = new PostgresQuoteCoordinatorStore({pool, transactionRetries: 30});
  await store.initialize();
  const results = await Promise.all(Array.from({length: config.count}, async (_, offset) => {
    const index = config.workerId * config.count + offset;
    const key = `sha256:key-${index}`;
    try {
      const result = await store.reserveOrReturnExisting({
        scope: {chainId: 31337, adapter: ADAPTER, maker: MAKER},
        idempotencyKeyHash: key,
        requestHash: `sha256:request-${index}`,
        request: {taker: TAKER, tokenIn: TOKEN_IN, tokenOut: TOKEN_OUT, amountIn: "10", venue: VENUE, policyId: POLICY, ttlSeconds: 300},
        inventoryDelta: {maker: MAKER, token: TOKEN_OUT, venue: VENUE, amount: "10"},
        reservationExpiresAt: 400,
        createdAt: 100 + index
      });
      return {status: "fulfilled", key, nonce: result.record.nonce};
    } catch (error) {
      return {status: "rejected", key, code: error instanceof RFQStoreError ? error.code : "UNEXPECTED"};
    }
  }));
  process.stdout.write(JSON.stringify(results));
  await pool.end();
}

main().catch((error) => {
  process.stderr.write(`${error?.stack ?? error}\n`);
  process.exitCode = 1;
});
