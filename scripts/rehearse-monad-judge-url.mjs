#!/usr/bin/env node

import {readFile} from "node:fs/promises";
import {fileURLToPath} from "node:url";
import {resolve} from "node:path";

const MONAD_CHAIN_ID = 10143;
const MAX_RESPONSE_BYTES = 1024 * 1024;
const ADDRESS = /^0x[a-fA-F0-9]{40}$/;
const HASH = /^0x[a-fA-F0-9]{64}$/;

export async function rehearseJudgeUrl(baseUrl, options = {}) {
  const base = normalizeBaseUrl(baseUrl);
  const checks = [];
  const [healthResponse, stateResponse, htmlResponse, appResponse] = await Promise.all([
    request(base, "/health"),
    request(base, "/api/state"),
    request(base, "/"),
    request(base, "/app.js")
  ]);

  for (const [surface, response] of [
    ["health", healthResponse],
    ["state", stateResponse],
    ["html", htmlResponse],
    ["app", appResponse]
  ]) {
    assert(response.status === 200, `${surface} returned HTTP ${response.status}`);
    assertSameOrigin(base, response.url, surface);
    assertSecurityHeaders(response.headers, surface);
    checks.push(`${surface}-reachable-and-hardened`);
  }

  const health = parseJson(await boundedText(healthResponse), "health");
  assert(health.status === "ok", "health status is not ok");
  assert(Number.isSafeInteger(health.blockNumber) && health.blockNumber > 0, "health blockNumber is invalid");
  checks.push("chain-health-current");

  const stateText = await boundedText(stateResponse);
  assertNoSecretShape(stateText, "state response");
  const state = parseJson(stateText, "state");
  validateState(state);
  checks.push("monad-deployment-and-readiness");
  checks.push("required-judge-scenes");

  const html = await boundedText(htmlResponse);
  assert(html.includes("JUDGE QUICK START") && html.includes('id="scenarios"'), "judge quick start is missing");
  const app = await boundedText(appResponse);
  for (const marker of [
    "wallet_addEthereumChain",
    "wallet_switchEthereumChain",
    "accountsChanged",
    "chainChanged",
    "corner-store-public-testnet-rfq-settlement"
  ]) {
    assert(app.includes(marker), `browser runtime is missing ${marker}`);
  }
  checks.push("judge-browser-flow-present");

  let evidence;
  if (options.evidencePath) {
    evidence = parseJson(await readFile(options.evidencePath, "utf8"), "settlement evidence");
    validateSettlementEvidence(evidence, state, health);
    checks.push("measured-settlement-evidence");
  }

  return {
    ready: true,
    url: base.href,
    deploymentId: state.deployment.deploymentId,
    sourceCommit: state.deployment.sourceCommit,
    chainId: state.deployment.chainId,
    currentBlock: health.blockNumber,
    optionalClaimExpiryScene: state.scenarios.some((scenario) => scenario.id === "claim-expiry" && scenario.enabled === true),
    evidenceTransaction: evidence?.transactionHash ?? null,
    checks
  };
}

export function validateSettlementEvidence(evidence, state, health) {
  assert(isRecord(evidence), "settlement evidence must be an object");
  assert(evidence.schemaVersion === 1, "settlement evidence schemaVersion must be 1");
  assert(evidence.kind === "corner-store-public-testnet-rfq-settlement", "settlement evidence kind is invalid");
  assert(evidence.deploymentId === state.deployment.deploymentId, "settlement evidence deploymentId mismatch");
  assert(evidence.sourceCommit === state.deployment.sourceCommit, "settlement evidence sourceCommit mismatch");
  assert(evidence.chainId === MONAD_CHAIN_ID, `settlement evidence chainId must be ${MONAD_CHAIN_ID}`);
  assert(sameAddress(evidence.router, state.contracts.router), "settlement evidence router mismatch");
  assert(sameAddress(evidence.rfqAdapter, state.contracts.rfqAdapter), "settlement evidence rfqAdapter mismatch");
  assert(ADDRESS.test(String(evidence.wallet)), "settlement evidence wallet is invalid");
  const participants = Object.values(state.participants).filter((value) => typeof value === "string");
  assert(participants.some((value) => sameAddress(value, evidence.wallet)), "settlement evidence wallet is not a published fixture participant");
  assert(evidence.side === "buy" || evidence.side === "sell", "settlement evidence side is invalid");
  assert(ADDRESS.test(String(evidence.tokenIn)) && ADDRESS.test(String(evidence.tokenOut)), "settlement evidence token address is invalid");
  const tokenAddresses = [state.tokens.rwa.address, state.tokens.quote.address];
  assert(tokenAddresses.some((value) => sameAddress(value, evidence.tokenIn)), "settlement evidence tokenIn mismatch");
  assert(tokenAddresses.some((value) => sameAddress(value, evidence.tokenOut)), "settlement evidence tokenOut mismatch");
  assert(!sameAddress(evidence.tokenIn, evidence.tokenOut), "settlement evidence token pair must be distinct");
  assert(positiveUint(evidence.amountIn) && positiveUint(evidence.amountOut), "settlement evidence amounts must be positive uint strings");
  assert(HASH.test(String(evidence.transactionHash)), "settlement evidence transactionHash is invalid");
  assert(Number.isSafeInteger(evidence.blockNumber) && evidence.blockNumber > 0, "settlement evidence blockNumber is invalid");
  assert(evidence.blockNumber <= health.blockNumber, "settlement evidence blockNumber is ahead of current health block");
  const submittedAt = Date.parse(String(evidence.submittedAt));
  const confirmedAt = Date.parse(String(evidence.confirmedAt));
  assert(Number.isFinite(submittedAt) && Number.isFinite(confirmedAt) && confirmedAt >= submittedAt, "settlement evidence timestamps are invalid");
  assert(Number.isSafeInteger(evidence.confirmationMs) && evidence.confirmationMs >= 0, "settlement evidence confirmationMs is invalid");
}

function validateState(state) {
  assert(isRecord(state), "state response must be an object");
  assert(isRecord(state.deployment), "state deployment is missing");
  assert(state.deployment.chainId === MONAD_CHAIN_ID, `state chainId must be ${MONAD_CHAIN_ID}`);
  assert(state.deployment.verifiedAtStartup === true, "deployment was not verified at startup");
  assert(typeof state.deployment.deploymentId === "string" && state.deployment.deploymentId.length > 0, "deploymentId is missing");
  assert(/^[a-f0-9]{40}$/i.test(String(state.deployment.sourceCommit)), "sourceCommit is invalid");
  assert(isRecord(state.walletNetwork) && state.walletNetwork.chainId === MONAD_CHAIN_ID, "Monad wallet network metadata is missing");
  assert(state.walletNetwork.name === "Monad Testnet", "wallet network name is invalid");
  assert(isRecord(state.contracts), "deployment contracts are missing");
  for (const field of ["router", "rfqAdapter", "rwaToken", "quoteToken"]) {
    assert(ADDRESS.test(String(state.contracts[field])), `contracts.${field} is invalid`);
  }
  assert(isRecord(state.tokens) && isRecord(state.tokens.rwa) && isRecord(state.tokens.quote), "token metadata is missing");
  assert(state.tokens.rwa.name === "Mock Restricted Stock" && state.tokens.rwa.symbol === "mRSTK", "mock restricted-stock label is missing");
  assert(isRecord(state.readiness), "readiness is missing");
  assert(state.readiness.makerApproved === true, "maker is not approved");
  assert(state.readiness.manifestActive === true, "Manifest is not active");
  for (const field of ["makerRwa", "makerQuote", "makerRwaAllowance", "makerQuoteAllowance"]) {
    assert(positiveUint(state.readiness[field]), `readiness.${field} must be positive`);
  }
  assert(Number.isSafeInteger(state.readiness.chainTimestamp) && state.readiness.chainTimestamp > 0, "chain timestamp is unavailable");
  assert(Array.isArray(state.scenarios), "judge scenarios are missing");
  const scenes = new Map(state.scenarios.map((scenario) => [scenario.id, scenario]));
  for (const id of ["success", "qualification-required", "holding-period"]) {
    const scene = scenes.get(id);
    assert(scene && ADDRESS.test(String(scene.wallet)), `required judge scene ${id} is missing`);
    if (id === "holding-period") assert(scene.enabled === true, "holding-period judge scene is not enabled");
  }
}

function normalizeBaseUrl(value) {
  let url;
  try {
    url = new URL(value);
  } catch {
    throw new Error("--url must be a valid URL");
  }
  assert(!url.username && !url.password, "judge URL must not contain credentials");
  const loopback = ["127.0.0.1", "localhost", "[::1]"].includes(url.hostname);
  assert(url.protocol === "https:" || (url.protocol === "http:" && loopback), "public judge URL must use HTTPS");
  assert(!url.search && !url.hash, "judge URL must not contain a query or fragment");
  url.pathname = `${url.pathname.replace(/\/+$/, "")}/`;
  return url;
}

async function request(base, path) {
  const url = new URL(path.replace(/^\//, ""), base);
  return fetch(url, {
    redirect: "follow",
    signal: AbortSignal.timeout(10_000),
    headers: {accept: path.endsWith(".js") || path === "/" ? "text/html,*/*" : "application/json"}
  });
}

async function boundedText(response) {
  const declared = Number(response.headers.get("content-length") ?? 0);
  assert(!Number.isFinite(declared) || declared <= MAX_RESPONSE_BYTES, "response exceeds rehearsal size limit");
  const text = await response.text();
  assert(Buffer.byteLength(text) <= MAX_RESPONSE_BYTES, "response exceeds rehearsal size limit");
  return text;
}

function assertSecurityHeaders(headers, surface) {
  assert(headers.get("content-security-policy")?.includes("frame-ancestors 'none'"), `${surface} CSP is missing frame protection`);
  assert(headers.get("referrer-policy") === "no-referrer", `${surface} Referrer-Policy is invalid`);
  assert(headers.get("x-content-type-options") === "nosniff", `${surface} X-Content-Type-Options is invalid`);
  assert(headers.get("x-frame-options") === "DENY", `${surface} X-Frame-Options is invalid`);
  assert(headers.get("cache-control") === "no-store", `${surface} cache policy is invalid`);
}

function assertSameOrigin(base, responseUrl, surface) {
  assert(new URL(responseUrl).origin === base.origin, `${surface} redirected to another origin`);
}

function assertNoSecretShape(text, label) {
  const forbidden = [
    /CORNER_STORE_TESTNET_MAKER_KEY/i,
    /private[_-]?key/i,
    /mnemonic/i,
    /\/run\/secrets\//i,
    /authorization["']?\s*:/i
  ];
  assert(!forbidden.some((pattern) => pattern.test(text)), `${label} contains a secret-shaped field`);
}

function parseJson(text, label) {
  try {
    return JSON.parse(text);
  } catch {
    throw new Error(`${label} is not valid JSON`);
  }
}

function positiveUint(value) {
  return typeof value === "string" && /^\d+$/.test(value) && BigInt(value) > 0n;
}

function sameAddress(left, right) {
  return ADDRESS.test(String(left)) && ADDRESS.test(String(right)) && String(left).toLowerCase() === String(right).toLowerCase();
}

function isRecord(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function parseArgs(argv) {
  const options = {};
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--url") options.url = argv[++index];
    else if (argument === "--evidence") options.evidencePath = argv[++index];
    else if (argument === "-h" || argument === "--help") options.help = true;
    else throw new Error(`unknown argument: ${argument}`);
  }
  return options;
}

function usage() {
  return `Usage: node scripts/rehearse-monad-judge-url.mjs --url URL [--evidence FILE]\n\nValidates the hosted Monad judge surface and optionally a downloaded settlement evidence file. Public URLs must use HTTPS; loopback HTTP is accepted for local rehearsal.`;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  try {
    const options = parseArgs(process.argv.slice(2));
    if (options.help) {
      console.log(usage());
    } else {
      assert(options.url, "--url is required");
      console.log(JSON.stringify(await rehearseJudgeUrl(options.url, options), null, 2));
    }
  } catch (error) {
    console.error(`Monad judge rehearsal failed: ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 1;
  }
}
