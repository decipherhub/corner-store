import assert from "node:assert/strict";
import {test} from "node:test";
import {mkdtempSync, readFileSync, writeFileSync} from "node:fs";
import {tmpdir} from "node:os";
import {join} from "node:path";
import {RFQQuoteCoordinator, RFQQuoteCoordinatorV3, LocalFileQuoteCoordinatorStore, hashCanonical} from "../src";

const addr = (n: number) => `0x${n.toString(16).padStart(40, "0")}` as `0x${string}`;
const policyId = `0x${"11".repeat(32)}` as const;
const otherPolicy = `0x${"22".repeat(32)}` as const;
const product = {maker: addr(1), tokenIn: addr(3), tokenOut: addr(4), venue: addr(5), policyId, capability: "rfq.quote.v2" as const, flowType: 0 as const};
const intent = {taker: addr(2), tokenIn: addr(3), tokenOut: addr(4), amountIn: "10", venue: addr(5), policyId, idempotencyKey: "authorization"};
const evidence = {snapshotId: "fixture", version: "1", observedAt: 100, validUntil: 1000, available: true};
function fixture(patch: Record<string, unknown> = {}) {
  const calls: string[] = [];
  const filePath = join(mkdtempSync(join(tmpdir(), "rfq-authorization-")), "quotes.json");
  const store = new LocalFileQuoteCoordinatorStore({filePath, inventory: [{maker: addr(1), token: addr(4), venue: addr(5), available: "1000"}]});
  const config = {chainId: 31337, verifyingContract: addr(6), maker: addr(1), products: [product], maxTtlSeconds: 120, now: () => 100,
    store: new Proxy(store, {get(target, key) {const value = Reflect.get(target, key); return typeof value === "function" ? (...args: any[]) => {calls.push(String(key)); return value.apply(target, args);} : value;}}),
    pricing: {price: () => {calls.push("pricing"); return {amountOut: "20", ...evidence};}},
    riskCheck: {check: () => {calls.push("risk"); return {decision: "passed" as const, ...evidence};}},
    signer: {signTypedData: async () => {calls.push("signer"); return "0x11" as const;}}, verifySignature: () => {}, ...patch};
  return {config, calls, filePath, coordinator: new RFQQuoteCoordinator(config)};
}
const code = (expected: string) => (error: any) => error.code === expected;

test("invalid TTL and unauthorized products do no store, pricing, risk or signer work", async () => {
  const f = fixture();
  for (const ttlSeconds of [0, -1, 0.5, Number.MAX_SAFE_INTEGER + 1, 121, null, NaN, Infinity]) {
    await assert.rejects(() => f.coordinator.quote({...intent, ttlSeconds} as any), code("INVALID_REQUEST"));
  }
  for (const patch of [{venue: addr(9)}, {tokenIn: addr(9)}, {tokenOut: addr(9)}, {tokenIn: addr(4), tokenOut: addr(3)}, {policyId: otherPolicy}]) {
    await assert.rejects(() => f.coordinator.quote({...intent, ...patch}), code("PRODUCT_UNAUTHORIZED"));
  }
  await assert.rejects(() => f.coordinator.quote({...intent, flowType: 1} as any), code("INVALID_REQUEST"));
  assert.deepEqual(f.calls, []);
  for (const patch of [{maker: addr(9)}, {products: [{...product, capability: "rfq.quote.v3"}]}]) {
    const denied = fixture(patch);
    await assert.rejects(() => denied.coordinator.quote(intent), code("PRODUCT_UNAUTHORIZED"));
    assert.deepEqual(denied.calls, []);
  }
});

test("lifetime defaults, exact max boundary and configuration validation", async () => {
  const f = fixture();
  const hardMax = fixture({maxTtlSeconds: 3600});
  assert.equal((await hardMax.coordinator.quote({...intent, ttlSeconds: 3600})).quote.expiry, 3700);
  const minimum = fixture({defaultTtlSeconds: 1, maxTtlSeconds: 1});
  assert.equal((await minimum.coordinator.quote(intent)).quote.expiry, 101);
  assert.equal((await f.coordinator.quote(intent)).quote.expiry, 160);
  assert.equal((await f.coordinator.quote({...intent, idempotencyKey: "max", ttlSeconds: 120})).quote.expiry, 220);
  for (const maxTtlSeconds of [0, -1, 0.5, 3601, Number.MAX_SAFE_INTEGER, null]) {
    assert.throws(() => fixture({maxTtlSeconds}), code("CONFIGURATION_INVALID"));
  }
  for (const defaultTtlSeconds of [0, 121, null]) assert.throws(() => fixture({defaultTtlSeconds}), code("CONFIGURATION_INVALID"));
  assert.throws(() => fixture({products: [{...product, flowType: 1}]}), code("CONFIGURATION_INVALID"));
  assert.throws(() => fixture({products: [{...product, policyId: "0x00"}]}), code("CONFIGURATION_INVALID"));
  assert.throws(() => fixture({products: [product, {...product, policyId: otherPolicy}]}), code("CONFIGURATION_INVALID"));
});

test("persisted authorization survives policy changes and resolver outages on replay", async () => {
  const f = fixture();
  const {policyId: ignored, ...body} = intent;
  let resolves = 0;
  const first = await f.coordinator.quoteAuthorizedWithEvidence(body, () => {resolves++; return policyId;}, {now: 100});
  assert.equal(resolves, 1);
  assert.equal(first.record.productAuthorization?.policyId, policyId);
  assert.equal(first.record.productAuthorization?.capability, "rfq.quote.v2");
  const restarted = new RFQQuoteCoordinator({...f.config, products: [{...product, policyId: otherPolicy}], now: () => 110});
  f.calls.length = 0;
  const replay = await restarted.quoteAuthorizedWithEvidence(body, () => {throw new Error("must not resolve");}, {now: 110});
  assert.deepEqual(replay.signedQuote, first.signedQuote);
  assert.deepEqual(replay.record.productAuthorization, first.record.productAuthorization);
  assert.deepEqual(f.calls, ["getByIdempotencyKeyHash"]);
  await assert.rejects(() => restarted.quoteAuthorizedWithEvidence({...body, amountIn: "11"}, () => otherPolicy), code("IDEMPOTENCY_CONFLICT"));
  const state = JSON.parse(readFileSync(f.filePath, "utf8"));
  delete state.records[0].productAuthorization;
  writeFileSync(f.filePath, JSON.stringify(state));
  await assert.rejects(() => restarted.quoteAuthorizedWithEvidence(body, () => otherPolicy), code("CONFIGURATION_INVALID"));
});

test("policy mismatch is terminal before pricing and dependency throws have typed bounded codes", async () => {
  const f = fixture();
  const {policyId: ignored, ...body} = intent;
  await assert.rejects(() => f.coordinator.quoteAuthorizedWithEvidence(body, () => otherPolicy), code("PRODUCT_UNAUTHORIZED"));
  assert.ok(!f.calls.includes("pricing"));
  await assert.rejects(() => f.coordinator.quoteAuthorizedWithEvidence(body, () => {throw new Error("private resolver details");}), code("DEPENDENCY_UNAVAILABLE"));
  const denied = fixture({pricing: {price: () => {throw new Error("private pricing details");}}});
  await assert.rejects(() => denied.coordinator.quote(intent), code("DEPENDENCY_UNAVAILABLE"));
  assert.ok(!denied.calls.includes("signer"));
});

test("RESERVED recovery preserves authorization and original expiry without resolving or pricing", async () => {
  const f = fixture();
  const {policyId: ignored, ...body} = intent;
  const first = await f.coordinator.quoteAuthorizedWithEvidence(body, () => policyId, {now: 100});
  const state = JSON.parse(readFileSync(f.filePath, "utf8"));
  const r = state.records[0]; r.state = "RESERVED"; delete r.signedQuote; delete r.quoteHash;
  writeFileSync(f.filePath, JSON.stringify(state));
  f.calls.length = 0;
  const replay = await new RFQQuoteCoordinator({...f.config, now: () => 110}).quoteAuthorizedWithEvidence(body, () => {throw new Error("must not resolve");}, {now: 110});
  assert.equal(replay.signedQuote.quote.expiry, first.signedQuote.quote.expiry);
  assert.deepEqual(replay.record.productAuthorization, first.record.productAuthorization);
  assert.ok(!f.calls.includes("pricing"));
  assert.equal(replay.record.requestHash, hashCanonical(replay.record.request));
});

test("v3 capability and primary flow denial precedes context resolution", async () => {
  const f = fixture();
  const coordinator = new RFQQuoteCoordinatorV3({...f.config, products: [{...product, capability: "rfq.quote.v3", flowType: 0}], context: {resolve: async () => {f.calls.push("context"); throw new Error("must not resolve");}}});
  await assert.rejects(() => coordinator.quote({...intent, flowType: 1}), code("PRODUCT_UNAUTHORIZED"));
  assert.deepEqual(f.calls, []);
});

test("production evidence APIs require authorization and persisted grants reject tampering", async () => {
  const legacy = fixture({products: undefined});
  await assert.rejects(() => legacy.coordinator.quoteWithEvidence(intent), code("CONFIGURATION_INVALID"));
  assert.deepEqual(legacy.calls, []);
  const f = fixture();
  const {policyId: ignored, ...body} = intent;
  await f.coordinator.quoteAuthorizedWithEvidence(body, () => policyId, {now: 100});
  const original = readFileSync(f.filePath, "utf8");
  for (const patch of [{policyId: otherPolicy}, {maker: addr(9)}, {flowType: 1}, {capability: "rfq.quote.v3"}, {adapter: addr(9)}]) {
    const state = JSON.parse(original);
    Object.assign(state.records[0].productAuthorization, patch);
    writeFileSync(f.filePath, JSON.stringify(state));
    f.calls.length = 0;
    await assert.rejects(() => f.coordinator.quoteAuthorizedWithEvidence(body, () => {throw new Error("must not resolve");}), code("CONFIGURATION_INVALID"));
    assert.deepEqual(f.calls, ["getByIdempotencyKeyHash"]);
  }
});

test("concurrent retries persist one original authorization, nonce and expiry", async () => {
  const f = fixture();
  const {policyId: ignored, ...body} = intent;
  const [a, b] = await Promise.all([f.coordinator.quoteAuthorizedWithEvidence(body, () => policyId, {now: 100}), f.coordinator.quoteAuthorizedWithEvidence(body, () => policyId, {now: 100})]);
  assert.deepEqual(a.signedQuote, b.signedQuote);
  const state = JSON.parse(readFileSync(f.filePath, "utf8"));
  assert.equal(state.records.length, 1);
  assert.equal(state.records[0].nonce, "1");
  assert.deepEqual(a.record.productAuthorization, b.record.productAuthorization);
  assert.equal(state.records[0].inventoryLease.expiresAt, 160);
});

test("store and risk outages are retryable, while missing inventory configuration is terminal", async () => {
  const f = fixture({store: {getByIdempotencyKeyHash: async () => {throw new Error("private store details");}}});
  await assert.rejects(() => f.coordinator.quote(intent), code("DEPENDENCY_UNAVAILABLE"));
  assert.deepEqual(f.calls, []);
  const risk = fixture({riskCheck: {check: () => {throw new Error("private risk details");}}});
  await assert.rejects(() => risk.coordinator.quote(intent), code("DEPENDENCY_UNAVAILABLE"));
  assert.ok(!risk.calls.includes("signer"));
  const inventory = fixture();
  const config = {...inventory.config, products: [{...product, tokenOut: addr(9)}]};
  await assert.rejects(() => new RFQQuoteCoordinator(config).quote({...intent, tokenOut: addr(9)}), code("CONFIGURATION_INVALID"));
});
