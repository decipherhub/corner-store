import {strict as assert} from "assert";
import {mkdtempSync, readFileSync, writeFileSync} from "fs";
import {tmpdir} from "os";
import {join} from "path";
import {Wallet} from "ethers";

import {loadConfig} from "../src/config";
import {encodeReasonCode, explainBlockedTrade} from "../src/explain";
import {TestnetRfqRuntime, buildRouterRequest} from "../src/runtime";
import {InMemoryRateLimiter, ServiceUnavailableError, classifyPublicError, startServer} from "../src/server";

const maker = Wallet.createRandom();
const artifact = {
  schemaVersion: 1,
  deploymentId: "smoke",
  sourceCommit: "abc123",
  chainId: 31337,
  createdAt: 1,
  assetProfile: "buidl-like",
  activationMode: "public-testnet-reference-fixture",
  productionDeployment: false,
  participantApprovalsRequired: true,
  eligibleInvestorBScenario: "holding-period-pending",
  governance: "0x0000000000000000000000000000000000000010",
  operator: "0x0000000000000000000000000000000000000011",
  maker: maker.address,
  investor: "0x0000000000000000000000000000000000000012",
  eligibleInvestorB: "0x0000000000000000000000000000000000000013",
  ineligibleInvestor: "0x0000000000000000000000000000000000000014",
  expiredInvestor: "0x0000000000000000000000000000000000000015",
  rwaToken: "0x0000000000000000000000000000000000000020",
  quote: "0x0000000000000000000000000000000000000021",
  rfqVenue: "0x000000000000000000000000000000000000F00D",
  elementReg: "0x0000000000000000000000000000000000000022",
  recipeReg: "0x0000000000000000000000000000000000000023",
  router: "0x0000000000000000000000000000000000000030",
  engine: "0x0000000000000000000000000000000000000031",
  policyReg: "0x0000000000000000000000000000000000000032",
  operatorReg: "0x0000000000000000000000000000000000000038",
  venueReg: "0x0000000000000000000000000000000000000039",
  selector: "0x000000000000000000000000000000000000003A",
  rfqAdapter: "0x0000000000000000000000000000000000000033",
  makerAuthorizer: "0x0000000000000000000000000000000000000034",
  qualifiedPurchaser: "0x0000000000000000000000000000000000000035",
  acquisitionSource: "0x0000000000000000000000000000000000000036",
  lockup: "0x0000000000000000000000000000000000000037",
  identityRegistry: "0x0000000000000000000000000000000000000040",
  identityRegistryStorage: "0x0000000000000000000000000000000000000041",
  trustedIssuersRegistry: "0x0000000000000000000000000000000000000042",
  claimTopicsRegistry: "0x0000000000000000000000000000000000000043",
  claimIssuer: "0x0000000000000000000000000000000000000044",
  makerIdentity: "0x0000000000000000000000000000000000000045",
  investorIdentity: "0x0000000000000000000000000000000000000046",
  eligibleInvestorBIdentity: "0x0000000000000000000000000000000000000047",
  ineligibleInvestorIdentity: "0x0000000000000000000000000000000000000048",
  expiredInvestorIdentity: "0x0000000000000000000000000000000000000049"
};
const dir = mkdtempSync(join(tmpdir(), "corner-store-testnet-demo-"));
const path = join(dir, "artifact.json");
const makerKeyPath = join(dir, "maker-key");
writeFileSync(path, JSON.stringify(artifact));
writeFileSync(makerKeyPath, `${maker.privateKey}\n`);
const config = loadConfig({
  CORNER_STORE_TESTNET_ARTIFACT: path,
  CORNER_STORE_TESTNET_RPC_URL: "http://127.0.0.1:8545",
  CORNER_STORE_TESTNET_MAKER_KEY: maker.privateKey
});
assert.equal(config.artifact.deploymentId, "smoke");
assert.equal(config.makerWallet.address, maker.address);
assert.equal(config.apiRequestsPerMinute, 240);
assert.equal(config.quoteRequestsPerMinute, 20);
const fileSecretConfig = loadConfig({
  CORNER_STORE_TESTNET_ARTIFACT: path,
  CORNER_STORE_TESTNET_RPC_URL: "http://127.0.0.1:8545",
  CORNER_STORE_TESTNET_MAKER_KEY_FILE: makerKeyPath
});
assert.equal(fileSecretConfig.makerWallet.address, maker.address);
assert.throws(
  () => loadConfig({
    CORNER_STORE_TESTNET_ARTIFACT: path,
    CORNER_STORE_TESTNET_RPC_URL: "http://127.0.0.1:8545",
    CORNER_STORE_TESTNET_MAKER_KEY: maker.privateKey,
    CORNER_STORE_TESTNET_MAKER_KEY_FILE: makerKeyPath
  }),
  /set only one/
);

assert.throws(
  () => loadConfig({
    CORNER_STORE_TESTNET_ARTIFACT: path,
    CORNER_STORE_TESTNET_RPC_URL: "http://127.0.0.1:8545",
    CORNER_STORE_TESTNET_MAKER_KEY: maker.privateKey,
    CORNER_STORE_TESTNET_DEMO_HOST: "0.0.0.0"
  }),
  /hackathon-testnet-only/
);
const publicConfig = loadConfig({
  CORNER_STORE_TESTNET_ARTIFACT: path,
  CORNER_STORE_TESTNET_RPC_URL: "http://127.0.0.1:8545",
  CORNER_STORE_TESTNET_MAKER_KEY: maker.privateKey,
  CORNER_STORE_TESTNET_DEMO_HOST: "0.0.0.0",
  CORNER_STORE_TESTNET_PUBLIC_ACKNOWLEDGEMENT: "hackathon-testnet-only",
  CORNER_STORE_TESTNET_API_REQUESTS_PER_MINUTE: "30",
  CORNER_STORE_TESTNET_QUOTE_REQUESTS_PER_MINUTE: "3"
});
assert.equal(publicConfig.host, "0.0.0.0");
assert.equal(publicConfig.apiRequestsPerMinute, 30);
assert.equal(publicConfig.quoteRequestsPerMinute, 3);
assert.throws(
  () => loadConfig({
    CORNER_STORE_TESTNET_ARTIFACT: path,
    CORNER_STORE_TESTNET_RPC_URL: "http://127.0.0.1:8545",
    CORNER_STORE_TESTNET_MAKER_KEY: maker.privateKey,
    CORNER_STORE_TESTNET_QUOTE_REQUESTS_PER_MINUTE: "1001"
  }),
  /at most 1000/
);
assert.throws(
  () => loadConfig({
    CORNER_STORE_TESTNET_ARTIFACT: path,
    CORNER_STORE_TESTNET_RPC_URL: "http://127.0.0.1:8545",
    CORNER_STORE_TESTNET_MAKER_KEY: maker.privateKey,
    CORNER_STORE_TESTNET_API_REQUESTS_PER_MINUTE: "10001"
  }),
  /at most 10000/
);

const unsupportedSchemaPath = join(dir, "unsupported-schema.json");
writeFileSync(unsupportedSchemaPath, JSON.stringify({...artifact, schemaVersion: 2}));
assert.throws(
  () => loadConfig({
    CORNER_STORE_TESTNET_ARTIFACT: unsupportedSchemaPath,
    CORNER_STORE_TESTNET_RPC_URL: "http://127.0.0.1:8545",
    CORNER_STORE_TESTNET_MAKER_KEY: maker.privateKey
  }),
  /schemaVersion must be 1/
);

const missingExpiredIdentityPath = join(dir, "missing-expired-identity.json");
const {expiredInvestorIdentity: _expiredInvestorIdentity, ...missingExpiredIdentity} = artifact;
writeFileSync(missingExpiredIdentityPath, JSON.stringify(missingExpiredIdentity));
assert.throws(
  () => loadConfig({
    CORNER_STORE_TESTNET_ARTIFACT: missingExpiredIdentityPath,
    CORNER_STORE_TESTNET_RPC_URL: "http://127.0.0.1:8545",
    CORNER_STORE_TESTNET_MAKER_KEY: maker.privateKey
  }),
  /expiredInvestorIdentity is required/
);

const limiter = new InMemoryRateLimiter(2, 1_000);
assert.equal(limiter.check("judge", 10_000).allowed, true);
assert.equal(limiter.check("judge", 10_100).allowed, true);
const limited = limiter.check("judge", 10_200);
assert.equal(limited.allowed, false);
assert.equal(limited.retryAfterSeconds, 1);
assert.equal(limiter.check("judge", 11_000).allowed, true);

const invalidAmount = classifyPublicError(new Error("amountIn must be a positive uint string"));
assert.deepEqual(invalidAmount, {
  status: 400,
  body: {error: "invalid_request", message: "amountIn must be a positive uint string"}
});
const upstreamFailure = classifyPublicError(
  new ServiceUnavailableError(new Error("RPC failed at https://credential.invalid"))
);
assert.deepEqual(upstreamFailure, {
  status: 503,
  body: {error: "service_unavailable", message: "request could not be completed"}
});
assert.doesNotMatch(JSON.stringify(upstreamFailure), /credential\.invalid/);
const internalFailure = classifyPublicError(new Error("unexpected invariant at https://credential.invalid"));
assert.deepEqual(internalFailure, {
  status: 500,
  body: {error: "internal_error", message: "request could not be completed"}
});
assert.doesNotMatch(JSON.stringify(internalFailure), /credential\.invalid/);

const holdingReason = encodeReasonCode(0, "C-01-v2", 4);
const holding = explainBlockedTrade(
  holdingReason,
  [{name: "latest compliance policy", pass: false, reasonCode: holdingReason}],
  {kind: "automatic", availableAt: 2_000_000_000, note: "fixture"}
);
assert.equal(holding.technicalLabel, "HOLDING_PERIOD_NOT_ELAPSED");
assert.equal(holding.timing.availableAt, 2_000_000_000);
assert.match(holding.action, /displayed availability time/);

const holdingWithoutTimingEvidence = explainBlockedTrade(
  holdingReason,
  [{name: "latest compliance policy", pass: false, reasonCode: holdingReason}]
);
assert.equal(holdingWithoutTimingEvidence.technicalLabel, "HOLDING_PERIOD_NOT_ELAPSED");
assert.equal(holdingWithoutTimingEvidence.timing.kind, "unknown");
assert.doesNotMatch(holdingWithoutTimingEvidence.action, /displayed availability time/);
assert.match(holdingWithoutTimingEvidence.timing.note, /No reliable availability time/);

const policyBeforeInventory = explainBlockedTrade(
  holdingReason,
  [
    {name: "latest compliance policy", pass: false, reasonCode: holdingReason},
    {name: "maker inventory", pass: false}
  ]
);
assert.equal(policyBeforeInventory.technicalLabel, "HOLDING_PERIOD_NOT_ELAPSED");

const inventory = explainBlockedTrade(
  `0x${"00".repeat(32)}`,
  [
    {name: "latest compliance policy", pass: true},
    {name: "maker inventory", pass: false}
  ]
);
assert.equal(inventory.technicalLabel, "MAKER_INVENTORY");
assert.equal(inventory.timing.kind, "operator-action");

const notQualified = explainBlockedTrade(
  "0x6b655efbba07e830a288e7f020633b96e4e1b3492af1bc62ec26fb952496ddce",
  [{name: "latest compliance policy", pass: false}]
);
assert.equal(notQualified.technicalLabel, "FAIL_NOT_QP");
assert.match(notQualified.title, /not qualified/);
assert.match(notQualified.title, /Demo Restricted Security \(DRS\)/);
assert.match(notQualified.detail, /Qualified Purchaser \(QP\)/);
assert.equal(notQualified.timing.kind, "operator-action");

const expiredQualification = explainBlockedTrade(
  "0xebb7df869f0f98bb5d2e6a0c77ea1d1af309d2949f6d970538fca4c690515339",
  [{name: "latest compliance policy", pass: false}],
  {kind: "operator-action", evidenceExpiredAt: 1_900_000_000, note: "fixture"}
);
assert.equal(expiredQualification.technicalLabel, "FAIL_QP_CLAIM_EXPIRED");
assert.equal(expiredQualification.timing.evidenceExpiredAt, 1_900_000_000);
assert.match(expiredQualification.title, /Qualified Purchaser \(QP\)/);
assert.match(expiredQualification.action, /refresh/);

const makerAllowance = explainBlockedTrade(
  `0x${"00".repeat(32)}`,
  [
    {name: "latest compliance policy", pass: true},
    {name: "maker allowance", pass: false}
  ]
);
assert.equal(makerAllowance.technicalLabel, "MAKER_ALLOWANCE");
assert.equal(makerAllowance.timing.kind, "operator-action");
assert.match(makerAllowance.action, /operator/);

const html = readFileSync(join(__dirname, "../../../public/index.html"), "utf8");
assert(html.includes('id="block-panel"'));
assert(html.includes('id="block-time"'));
assert(html.includes('id="scenarios"'));
assert(html.includes('id="wallet-network"'));
assert(html.includes('id="add-network"'));
assert(html.includes('id="asset"'));
assert(html.includes('id="download-evidence"'));
assert(html.includes("Run compliance pre-check"));
assert(html.includes("not a legal or regulatory determination"));
assert(html.includes("Buy DRS"));
assert(html.includes("Sell DRS"));
assert.doesNotMatch(html, /Mock Restricted Stock|mRSTK/);
const app = readFileSync(join(__dirname, "../../../public/app.js"), "utf8");
assert(app.includes('kind: "corner-store-public-testnet-rfq-settlement"'));
assert(app.includes("confirmationMs"));
assert(app.includes("currentChainTime()"));
assert(app.includes("state.readiness.chainTimestamp"));
assert.doesNotMatch(app, /Date\.now\(\)/, "browser wall clock must not drive policy countdowns");
assert(app.includes('wallet_switchEthereumChain'));
assert(app.includes('wallet_addEthereumChain'));
assert(app.includes('window.ethereum.on("accountsChanged"'));
assert(app.includes('window.ethereum.on("chainChanged"'));
assert(app.includes("Latest configured compliance policy passed"));
assert(app.includes("No evidence-backed availability time is available."));
const runtimeSource = readFileSync(join(__dirname, "../../../src/runtime.ts"), "utf8");
assert(runtimeSource.includes("Qualified Purchaser (QP) claim required"));
assert(runtimeSource.includes("choose Buy DRS"));
assert(runtimeSource.includes("choose Sell DRS"));

const signed = {
  quote: {
    maker: maker.address as `0x${string}`,
    taker: artifact.investor as `0x${string}`,
    tokenIn: artifact.quote as `0x${string}`,
    tokenOut: artifact.rwaToken as `0x${string}`,
    amountIn: "100",
    amountOut: "99",
    venue: artifact.rfqVenue as `0x${string}`,
    policyId: `0x${"77".repeat(32)}` as `0x${string}`,
    nonce: "7",
    expiry: 999
  },
  signature: `0x${"11".repeat(65)}` as `0x${string}`,
  typedData: {
    domain: {
      name: "CornerStoreRFQ",
      version: "2",
      chainId: 31337,
      verifyingContract: artifact.rfqAdapter as `0x${string}`
    },
    types: {RFQQuote: []},
    primaryType: "RFQQuote" as const,
    message: {} as never
  }
};
const request = buildRouterRequest(config, signed, 8n, 1000n);
assert.equal((request[0] as unknown[])[0], artifact.investor);
assert.equal((request[0] as unknown[])[7], 2);
assert.equal(request[1], "99");
assert.equal(request[3], "8");
assert.match(String(request[4]), /^0x/);

async function serverFailureSmoke() {
  const operatorEvents: string[] = [];
  const originalConsoleError = console.error;
  let server: Awaited<ReturnType<typeof startServer>> | undefined;
  try {
    console.error = (...values: unknown[]) => operatorEvents.push(values.map(String).join(" "));
    server = await startServer({
      config: {
        host: "127.0.0.1",
        port: 0,
        apiRequestsPerMinute: 10,
        quoteRequestsPerMinute: 10,
        quoteTtlSeconds: 60
      },
      provider: {
        getBlockNumber: async () => {
          throw new Error("RPC failed at https://credential.invalid");
        }
      },
      publicState: async () => {
        throw new Error("unexpected invariant at https://credential.invalid");
      },
      quoteFor: async () => {
        throw new Error("maker inventory is insufficient");
      }
    } as unknown as TestnetRfqRuntime);
    const bound = server.address();
    assert(bound && typeof bound === "object");
    const response = await fetch(`http://127.0.0.1:${bound.port}/health`);
    assert.equal(response.status, 503);
    assert.deepEqual(await response.json(), {
      error: "service_unavailable",
      message: "request could not be completed"
    });
    assert.equal(operatorEvents.length, 1);
    assert.match(operatorEvents[0], /"surface":"\/health"/);
    assert.match(operatorEvents[0], /"status":503/);
    assert.doesNotMatch(operatorEvents[0], /credential\.invalid/);

    const internalResponse = await fetch(`http://127.0.0.1:${bound.port}/api/state`);
    assert.equal(internalResponse.status, 500);
    assert.deepEqual(await internalResponse.json(), {
      error: "internal_error",
      message: "request could not be completed"
    });
    assert.equal(operatorEvents.length, 2);
    assert.match(operatorEvents[1], /"surface":"\/api\/state"/);
    assert.match(operatorEvents[1], /"status":500/);
    assert.doesNotMatch(operatorEvents[1], /credential\.invalid/);

    const readinessResponse = await fetch(`http://127.0.0.1:${bound.port}/api/quote`, {
      method: "POST",
      headers: {"content-type": "application/json"},
      body: JSON.stringify({
        taker: "0x0000000000000000000000000000000000000001",
        amountIn: "1",
        side: "buy"
      })
    });
    assert.equal(readinessResponse.status, 503);
    assert.deepEqual(await readinessResponse.json(), {
      error: "service_unavailable",
      message: "request could not be completed"
    });
    assert.equal(operatorEvents.length, 3);
    assert.match(operatorEvents[2], /"surface":"\/api\/quote"/);
    assert.match(operatorEvents[2], /"status":503/);
  } finally {
    console.error = originalConsoleError;
    if (server) {
      await new Promise<void>((resolve, reject) => server!.close((error) => error ? reject(error) : resolve()));
    }
  }
}

serverFailureSmoke()
  .then(() => console.log("corner-store public-testnet RFQ demo smoke ok"))
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
