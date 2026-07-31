import {strict as assert} from "assert";
import {mkdtempSync, writeFileSync} from "fs";
import {tmpdir} from "os";
import {join} from "path";
import {Wallet} from "ethers";

import {loadConfig} from "../src/config";
import {buildRouterRequest} from "../src/runtime";

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
  governance: "0x0000000000000000000000000000000000000010",
  operator: "0x0000000000000000000000000000000000000011",
  maker: maker.address,
  investor: "0x0000000000000000000000000000000000000012",
  eligibleInvestorB: "0x0000000000000000000000000000000000000013",
  ineligibleInvestor: "0x0000000000000000000000000000000000000014",
  rwaToken: "0x0000000000000000000000000000000000000020",
  quote: "0x0000000000000000000000000000000000000021",
  rfqVenue: "0x000000000000000000000000000000000000F00D",
  router: "0x0000000000000000000000000000000000000030",
  engine: "0x0000000000000000000000000000000000000031",
  policyReg: "0x0000000000000000000000000000000000000032",
  rfqAdapter: "0x0000000000000000000000000000000000000033",
  makerAuthorizer: "0x0000000000000000000000000000000000000034",
  qualifiedPurchaser: "0x0000000000000000000000000000000000000035"
};
const dir = mkdtempSync(join(tmpdir(), "corner-store-testnet-demo-"));
const path = join(dir, "artifact.json");
writeFileSync(path, JSON.stringify(artifact));
const config = loadConfig({
  CORNER_STORE_TESTNET_ARTIFACT: path,
  CORNER_STORE_TESTNET_RPC_URL: "http://127.0.0.1:8545",
  CORNER_STORE_TESTNET_MAKER_KEY: maker.privateKey
});
assert.equal(config.artifact.deploymentId, "smoke");
assert.equal(config.makerWallet.address, maker.address);

const signed = {
  quote: {
    maker: maker.address as `0x${string}`,
    taker: artifact.investor as `0x${string}`,
    tokenIn: artifact.quote as `0x${string}`,
    tokenOut: artifact.rwaToken as `0x${string}`,
    amountIn: "100",
    amountOut: "99",
    venue: artifact.rfqVenue as `0x${string}`,
    nonce: "7",
    expiry: 999
  },
  signature: `0x${"11".repeat(65)}` as `0x${string}`,
  typedData: {
    domain: {
      name: "CornerStoreRFQ",
      version: "1",
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
console.log("corner-store public-testnet RFQ demo smoke ok");
