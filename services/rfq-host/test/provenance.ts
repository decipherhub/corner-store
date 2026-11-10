import assert from "node:assert/strict";
import {test} from "node:test";
import {mkdtempSync} from "node:fs";
import {tmpdir} from "node:os";
import {join} from "node:path";
import {Wallet, keccak256, toUtf8Bytes} from "ethers";
import {RFQQuoteCoordinatorV3, RFQQuoteCoordinator, LocalFileQuoteCoordinatorStore} from "@corner-store/rfq-service";
import {startProductionRFQHost, StaticBearerAuthenticator, MemoryAuditSink} from "../src/server";
const addr = (n: number) => `0x${n.toString(16).padStart(40, "0")}` as `0x${string}`;
const hash = (s: string) => keccak256(toUtf8Bytes(s)) as `0x${string}`;
const wallet = new Wallet(hash("host fixture"));
const maker = wallet.address.toLowerCase() as `0x${string}`;
const body = {idempotencyKey: "v3", taker: addr(2), tokenIn: addr(3), tokenOut: addr(4), amountIn: "10", venue: addr(5), flowType: 0};
function cfg() {
  const freshness = {snapshotId: "fixture", version: "1", observedAt: 90, validUntil: 200, available: true};
  return {products: [2, 3].map((version) => ({maker, tokenIn: addr(3), tokenOut: addr(4), venue: addr(5), policyId: hash("policy"), capability: `rfq.quote.v${version}` as "rfq.quote.v2" | "rfq.quote.v3", flowType: 0 as const})), chainId: 31337, verifyingContract: addr(6), maker, now: () => 100, signer: {signTypedData: async (d: any) => wallet.signTypedData(d.domain, d.types, d.message) as Promise<`0x${string}`>}, pricing: {price: () => ({amountOut: "20", ...freshness})}, riskCheck: {check: () => ({...freshness, decision: "passed" as const})}, store: new LocalFileQuoteCoordinatorStore({filePath: join(mkdtempSync(join(tmpdir(), "host-v3-")), "quotes.json"), inventory: [{maker, token: addr(4), venue: addr(5), available: "1000"}]})};
}
async function start(unavailable = false) {
  const config = cfg();
  return startProductionRFQHost({coordinator: new RFQQuoteCoordinator(config), v3: {coordinator: new RFQQuoteCoordinatorV3({...config, context: {resolve: async () => {if (unavailable) throw new Error("private provider unavailable"); return {contextVersion: 1, configurationHash: hash("cfg"), affiliateEvidenceHash: hash("claim"), sellerIsAffiliate: false};}}}), resolvePolicyId: () => hash("policy")}, authenticator: new StaticBearerAuthenticator([{token: "fixture-token", taker: addr(2)}]), resolvePolicyId: () => hash("policy"), audit: new MemoryAuditSink(), now: () => 100});
}
async function post(url: string, path: string, value: any, authenticated = true) {return fetch(`${url}${path}`, {method: "POST", headers: {"content-type": "application/json", ...(authenticated ? {authorization: "Bearer fixture-token"} : {})}, body: JSON.stringify(value)});}

test("versioned host endpoint opts into v3 and keeps the legacy response pinned", async () => {
  const host = await start();
  try {
    const v3 = await post(host.baseUrl, "/rfq/v3/quote", body);
    assert.equal(v3.status, 200);
    const signed: any = await v3.json();
    assert.equal(signed.typedData.domain.version, "3");
    assert.equal(signed.quote.flowType, 0);
    assert.equal(signed.quote.affiliateEvidenceHash, hash("claim"));
    const {flowType, ...legacyBody} = body;
    const v2: any = await (await post(host.baseUrl, "/rfq/quote", {...legacyBody, idempotencyKey: "legacy"})).json();
    assert.equal(v2.typedData.domain.version, "2");
    assert.equal(v2.quote.flowType, undefined);
    assert.equal(v2.quote.affiliateEvidenceHash, undefined);
  } finally {await host.close();}
});

test("v3 authenticates taker and rejects client evidence and unsupported flow", async () => {
  const host = await start();
  try {
    assert.equal((await post(host.baseUrl, "/rfq/v3/quote", body, false)).status, 401);
    assert.equal((await post(host.baseUrl, "/rfq/v3/quote", {...body, taker: addr(9)})).status, 403);
    for (const patch of [{flowType: 2}, {flowType: undefined}, {affiliateEvidenceHash: hash("forged")}, {sellerIsAffiliate: false}, {policyId: hash("forged")}]) assert.equal((await post(host.baseUrl, "/rfq/v3/quote", {...body, ...patch})).status, 400);
  } finally {await host.close();}
});

test("v3 fails closed and redacts unavailable context reads", async () => {
  const host = await start(true);
  try {
    const response = await post(host.baseUrl, "/rfq/v3/quote", body);
    assert.equal(response.status, 503);
    assert.ok(!(await response.text()).includes("private provider"));
  } finally {await host.close();}
});

test("runtime exposes v3 only with the declared provenance capability and readiness", async () => {
  const {startProductionRFQRuntime} = await import("../src/runtime");
  const {InMemoryRateLimiter, MemoryMetricsSink, MemoryIncidentSink} = await import("../src/server");
  const config = cfg();
  const v3 = {coordinator: new RFQQuoteCoordinatorV3({...config, context: {resolve: async () => ({contextVersion: 1, configurationHash: hash("cfg"), affiliateEvidenceHash: hash("claim"), sellerIsAffiliate: false})}}), resolvePolicyId: () => hash("policy")};
  const capabilities: any = Object.fromEntries(["durable_coordinator", "external_signer", "fresh_pricing_risk", "incident_monitoring", "live_policy_resolver", "production_authentication", "shared_rate_limit", "strict_audit"].map((v) => [v, true]));
  const dependencies = {coordinator: new RFQQuoteCoordinator(config), v3, authenticator: new StaticBearerAuthenticator([{token: "fixture-token", taker: addr(2)}]), resolvePolicyId: () => hash("policy"), rateLimiter: new InMemoryRateLimiter(), audit: new MemoryAuditSink(), metrics: new MemoryMetricsSink(), incident: new MemoryIncidentSink(), readiness: {check: () => ({ready: true, components: ["audit", "authentication", "coordinator", "policy", "pricing", "rate_limit", "risk", "signer", "context"].map((component) => ({component, ready: true}))})}};
  const options: any = {env: {CORNER_STORE_RFQ_CONFIG_VERSION: "1", CORNER_STORE_RFQ_BOOTSTRAP_MODULE: "/tmp/v3-bootstrap.cjs", CORNER_STORE_RFQ_PORT: "38763"}, loadBootstrap: () => ({contractVersion: "1.0.0", capabilities, createProductionRFQDependencies: () => dependencies}), logger: {info() {}, error() {}}};
  await assert.rejects(() => startProductionRFQRuntime(options), /bootstrap_dependencies_invalid/);
  capabilities.v3_context_provenance = true;
  const runtime = await startProductionRFQRuntime(options);
  try {assert.equal((await fetch(`${runtime.host.baseUrl}/ready`)).status, 200);} finally {await runtime.shutdown();}
});
