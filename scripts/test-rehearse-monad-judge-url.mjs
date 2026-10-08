#!/usr/bin/env node

import assert from "node:assert/strict";
import {createServer} from "node:http";
import {mkdtemp, rm, writeFile} from "node:fs/promises";
import {tmpdir} from "node:os";
import {join} from "node:path";

import {rehearseJudgeUrl} from "./rehearse-monad-judge-url.mjs";

const address = (digit) => `0x${digit.repeat(40)}`;
const state = {
  deployment: {
    deploymentId: "monad-onchain-finance-rfq-v1",
    sourceCommit: "a".repeat(40),
    chainId: 10143,
    verifiedAtStartup: true
  },
  walletNetwork: {name: "Monad Testnet", chainId: 10143},
  contracts: {
    router: address("1"),
    rfqAdapter: address("2"),
    rwaToken: address("3"),
    quoteToken: address("4")
  },
  participants: {
    maker: address("5"),
    eligibleInvestorA: address("6"),
    eligibleInvestorB: address("7"),
    ineligibleInvestor: address("8"),
    expiredInvestor: address("9")
  },
  tokens: {
    rwa: {address: address("3"), name: "Mock Restricted Stock", symbol: "mRSTK"},
    quote: {address: address("4"), name: "Mock Quote", symbol: "qUSD"}
  },
  readiness: {
    makerApproved: true,
    manifestActive: true,
    makerRwa: "1",
    makerQuote: "1",
    makerRwaAllowance: "1",
    makerQuoteAllowance: "1",
    chainTimestamp: 2_000_000_000
  },
  scenarios: [
    {id: "success", wallet: address("6")},
    {id: "qualification-required", wallet: address("8")},
    {id: "holding-period", wallet: address("7"), enabled: true},
    {id: "claim-expiry", wallet: address("9"), enabled: true}
  ]
};
const health = {status: "ok", blockNumber: 200};
const headers = {
  "cache-control": "no-store",
  "content-security-policy": "default-src 'self'; frame-ancestors 'none'",
  "referrer-policy": "no-referrer",
  "x-content-type-options": "nosniff",
  "x-frame-options": "DENY"
};

const server = createServer((request, response) => {
  let body;
  let contentType = "application/json";
  if (request.url === "/health") body = JSON.stringify(health);
  else if (request.url === "/api/state") body = JSON.stringify(state);
  else if (request.url === "/") {
    contentType = "text/html";
    body = '<span>JUDGE QUICK START</span><div id="scenarios"></div>';
  } else if (request.url === "/app.js") {
    contentType = "text/javascript";
    body = "wallet_addEthereumChain wallet_switchEthereumChain accountsChanged chainChanged corner-store-public-testnet-rfq-settlement";
  } else {
    response.writeHead(404);
    response.end();
    return;
  }
  response.writeHead(200, {...headers, "content-type": contentType, "content-length": Buffer.byteLength(body)});
  response.end(body);
});

const directory = await mkdtemp(join(tmpdir(), "corner-store-monad-rehearsal-"));
try {
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  const bound = server.address();
  assert(bound && typeof bound === "object");
  const url = `http://127.0.0.1:${bound.port}`;
  const evidencePath = join(directory, "evidence.json");
  await writeFile(evidencePath, JSON.stringify({
    schemaVersion: 1,
    kind: "corner-store-public-testnet-rfq-settlement",
    deploymentId: state.deployment.deploymentId,
    sourceCommit: state.deployment.sourceCommit,
    chainId: 10143,
    router: state.contracts.router,
    rfqAdapter: state.contracts.rfqAdapter,
    wallet: state.participants.eligibleInvestorA,
    side: "buy",
    tokenIn: state.tokens.quote.address,
    tokenOut: state.tokens.rwa.address,
    amountIn: "100",
    amountOut: "10",
    transactionHash: `0x${"b".repeat(64)}`,
    blockNumber: 199,
    submittedAt: "2033-05-18T03:33:20.000Z",
    confirmedAt: "2033-05-18T03:33:21.250Z",
    confirmationMs: 1250
  }));

  const result = await rehearseJudgeUrl(url, {evidencePath});
  assert.equal(result.ready, true);
  assert.equal(result.chainId, 10143);
  assert.equal(result.evidenceTransaction, `0x${"b".repeat(64)}`);
  assert(result.checks.includes("measured-settlement-evidence"));

  state.deployment.chainId = 1;
  await assert.rejects(() => rehearseJudgeUrl(url), /state chainId must be 10143/);
  state.deployment.chainId = 10143;

  await assert.rejects(() => rehearseJudgeUrl("http://example.com"), /public judge URL must use HTTPS/);
  console.log("Monad judge URL rehearsal smoke ok");
} finally {
  await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  await rm(directory, {recursive: true, force: true});
}
