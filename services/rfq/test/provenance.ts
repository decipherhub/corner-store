import assert from "node:assert/strict";
import {test} from "node:test";
import {mkdtempSync, readFileSync, writeFileSync} from "node:fs";
import {tmpdir} from "node:os";
import {join} from "node:path";
import {AbiCoder, Wallet, TypedDataEncoder, keccak256, toUtf8Bytes} from "ethers";
import {
  RFQQuoteServiceV3, RFQQuoteCoordinatorV3, LocalFileQuoteCoordinatorStore,
  RFQ_QUOTE_V3_TYPES, domainV3, typedDataV3, affiliateEvidenceCommitment,
  createRFQServiceV3FromModules, pricingModule, riskModule, signerModuleV3, nonceModule,
  FixedRatePricingProvider, InMemoryNonceStore, runRFQV3ModuleConformance
} from "../src";

const addr = (n: number) => `0x${n.toString(16).padStart(40, "0")}` as `0x${string}`;
const hash = (s: string) => keccak256(toUtf8Bytes(s)) as `0x${string}`;
const wallet = new Wallet(hash("local v3 fixture"));
const maker = wallet.address.toLowerCase() as `0x${string}`;
const base = {maker, taker: addr(2), tokenIn: addr(3), tokenOut: addr(4), amountIn: "10", amountOut: "20", venue: addr(5), policyId: hash("policy"), flowType: 0 as const, affiliateEvidenceHash: hash("evidence")};
const signer = {signTypedData: async (data: any) => wallet.signTypedData(data.domain, data.types, data.message) as Promise<`0x${string}`>};
const config = {chainId: 31337, verifyingContract: addr(6), now: () => 100, nextNonce: () => 7n};

test("v3 uses exact Solidity field order and a separate domain", async () => {
  const signed = await new RFQQuoteServiceV3(config, signer).createSignedQuote(base);
  assert.equal(signed.typedData.primaryType, "RFQQuoteV3");
  assert.equal(signed.typedData.domain.version, "3");
  assert.deepEqual(RFQ_QUOTE_V3_TYPES.RFQQuoteV3.map((f) => f.name), ["maker", "taker", "tokenIn", "tokenOut", "amountIn", "amountOut", "venue", "policyId", "flowType", "affiliateEvidenceHash", "nonce", "expiry"]);
  const typeHash = hash("RFQQuoteV3(address maker,address taker,address tokenIn,address tokenOut,uint256 amountIn,uint256 amountOut,address venue,bytes32 policyId,uint8 flowType,bytes32 affiliateEvidenceHash,uint256 nonce,uint64 expiry)");
  const q = signed.quote;
  const structHash = keccak256(AbiCoder.defaultAbiCoder().encode(["bytes32", "address", "address", "address", "address", "uint256", "uint256", "address", "bytes32", "uint8", "bytes32", "uint256", "uint64"], [typeHash, q.maker, q.taker, q.tokenIn, q.tokenOut, q.amountIn, q.amountOut, q.venue, q.policyId, q.flowType, q.affiliateEvidenceHash, q.nonce, q.expiry]));
  assert.equal(TypedDataEncoder.hashStruct("RFQQuoteV3", signed.typedData.types, q), structHash);
  assert.notEqual(TypedDataEncoder.hash(signed.typedData.domain, signed.typedData.types, q), TypedDataEncoder.hash({...signed.typedData.domain, version: "2"}, signed.typedData.types, q));
});

test("v3 rejects unsupported flows and malformed or absent evidence", async () => {
  const service = new RFQQuoteServiceV3(config, signer);
  for (const patch of [{flowType: 2}, {flowType: 255}, {affiliateEvidenceHash: "0x12"}, {affiliateEvidenceHash: undefined}, {tokenOut: base.tokenIn}]) {
    await assert.rejects(() => service.createSignedQuote({...base, ...patch} as any));
  }
});

test("affiliate commitment follows both sender directions and dual-status agreement", () => {
  const leg = {asset: addr(4), sender: maker, affiliateSource: addr(8), basis: 8, source: 1, claimIssuer: addr(9), verifiedAt: 90, decayStartedAt: 0, effectiveStatus: 3};
  const expectedLeg = keccak256(AbiCoder.defaultAbiCoder().encode(["address", "address", "address", "uint8", "uint8", "address", "uint64", "uint64", "uint8"], Object.values(leg)));
  const expected = keccak256(AbiCoder.defaultAbiCoder().encode(["bytes32", "bytes32", "bytes32"], [hash("corner-store.affiliate-evidence.v1"), hashZero(), expectedLeg]));
  assert.deepEqual(affiliateEvidenceCommitment(undefined, leg, 100), {affiliateEvidenceHash: expected, sellerIsAffiliate: false});
  assert.notEqual(affiliateEvidenceCommitment(leg, undefined, 100).affiliateEvidenceHash, expected);
  assert.throws(() => affiliateEvidenceCommitment(leg, {...leg, effectiveStatus: 4}, 100), /conflict/i);
  for (const patch of [{effectiveStatus: 0}, {effectiveStatus: 2}, {verifiedAt: 101}, {basis: 7, decayStartedAt: 0}]) {
    assert.throws(() => affiliateEvidenceCommitment(undefined, {...leg, ...patch}, 100));
  }
});
function hashZero() { return `0x${"00".repeat(32)}`; }

function fixture() {
  const filePath = join(mkdtempSync(join(tmpdir(), "rfq-v3-")), "quotes.json");
  const store = new LocalFileQuoteCoordinatorStore({filePath, inventory: [{maker, token: base.tokenOut, venue: base.venue, available: "1000"}]});
  let evidence = {affiliateEvidenceHash: base.affiliateEvidenceHash, sellerIsAffiliate: false, configurationHash: hash("configuration"), contextVersion: 1 as const};
  let signs = 0;
  const context = {resolve: async () => evidence};
  const cfg = {...config, maker, store, context, signer: {signTypedData: async (d: any) => {signs++; return signer.signTypedData(d);}}, pricing: {price: () => ({amountOut: "20"})}, riskCheck: {check: () => {}}};
  const intent = {...base, idempotencyKey: "v3-request"};
  return {filePath, store, cfg, intent, signs: () => signs, change: () => {evidence = {...evidence, affiliateEvidenceHash: hash("changed")};}};
}

test("v3 coordinator persists schema, domain and context and never re-signs published quotes", async () => {
  const f = fixture();
  const coordinator = new RFQQuoteCoordinatorV3(f.cfg);
  const first = await coordinator.quote(f.intent);
  f.change();
  assert.deepEqual(await coordinator.quote(f.intent), first);
  assert.equal(f.signs(), 1);
  const record = JSON.parse(readFileSync(f.filePath, "utf8")).records[0];
  assert.equal(record.schemaVersion, 2);
  assert.equal(record.quoteVersion, 3);
  assert.deepEqual(record.domain, domainV3(31337, addr(6)));
  assert.equal(record.contextEvidence.affiliateEvidenceHash, base.affiliateEvidenceHash);
  assert.equal(record.signedQuote.quote.flowType, 0);
});

test("v3 RESERVED recovery rejects changed evidence before signing and releases inventory", async () => {
  const f = fixture();
  await new RFQQuoteCoordinatorV3(f.cfg).quote(f.intent);
  const state = JSON.parse(readFileSync(f.filePath, "utf8"));
  const r = state.records[0];
  r.state = "RESERVED"; delete r.signedQuote; delete r.quoteHash;
  writeFileSync(f.filePath, JSON.stringify(state));
  f.change();
  await assert.rejects(() => new RFQQuoteCoordinatorV3(f.cfg).quote(f.intent), /context|evidence/i);
  assert.equal(f.signs(), 1);
  const after = JSON.parse(readFileSync(f.filePath, "utf8"));
  assert.equal(after.records[0].state, "REVOKED");
  assert.equal(Object.values(after.inventoryByScope).map((b: any) => b.reserved)[0], "0");
});

test("v3 RESERVED recovery rejects unavailable reads and domain mismatch", async () => {
  for (const mode of ["unavailable", "domain"]) {
    const f = fixture();
    await new RFQQuoteCoordinatorV3(f.cfg).quote(f.intent);
    const state = JSON.parse(readFileSync(f.filePath, "utf8"));
    const r = state.records[0]; r.state = "RESERVED"; delete r.signedQuote;
    if (mode === "domain") r.domain.version = "2";
    writeFileSync(f.filePath, JSON.stringify(state));
    const cfg = mode === "unavailable" ? {...f.cfg, context: {resolve: async () => {throw new Error("unavailable");}}} : f.cfg;
    await assert.rejects(() => new RFQQuoteCoordinatorV3(cfg).quote(f.intent));
    assert.equal(f.signs(), 1);
  }
});

test("v3 modules require explicit signer capability and conformance binds the new fields", async () => {
  const modules = {pricing: pricingModule("test.price", new FixedRatePricingProvider({numerator: 2n, denominator: 1n})), risk: riskModule("test.risk", {check: () => {}}), signer: signerModuleV3("test.sign", signer), nonce: nonceModule("test.nonce", new InMemoryNonceStore())};
  const cfg = {...config, maker, modules, context: {resolve: async () => ({affiliateEvidenceHash: base.affiliateEvidenceHash, sellerIsAffiliate: false, contextVersion: 1 as const, configurationHash: hash("cfg")})}};
  modules.signer.descriptor.capabilities = modules.signer.descriptor.capabilities.filter((c) => c !== "rfq.sign.eip712.v3");
  assert.throws(() => createRFQServiceV3FromModules(cfg), /capability/);
  modules.signer.descriptor.capabilities.push("rfq.sign.eip712.v3");
  const service = createRFQServiceV3FromModules(cfg);
  assert.equal((await service.quote(base)).typedData.domain.version, "3");
  const report = await runRFQV3ModuleConformance(modules, {...config, ...base, otherTaker: addr(10), now: 100, ttlSeconds: 60}, cfg.context);
  assert.equal(report.passed, true, JSON.stringify(report));
});

test("chain context resolver binds activation and reads both actual senders at one block", async () => {
  const {OnchainRFQContextResolver, venueConfigurationHash} = await import("../src");
  const code = "0x60016000";
  const codeHash = keccak256(code);
  const cfg = [2, addr(6), addr(20), addr(21), 0, true];
  const commitment = venueConfigurationHash(cfg, hash("adapter-config"));
  const calls: any[] = [];
  const answers: Record<string, any> = {venueOf: cfg, contextEvidenceOf: [3, 1, codeHash, addr(8), codeHash, addr(12), codeHash, commitment], isContextImplementationApproved: true, router: addr(7), adapterVersion: 3, contextVersion: 1, contextConfigHash: hash("adapter-config"), venueReg: addr(11), policyReg: addr(12), affiliateSource: addr(8), makerAuthorizer: addr(13), approvedMaker: true, usedQuoteNonce: false, statusOf: 2, effectiveStatus: 3, claimOf: [8, 1, addr(9), 90, 0]};
  const reader = {snapshot: async () => ({chainId: 31337, blockNumber: 10, timestamp: 100}), getCode: async () => code, call: async (to: string, _abi: string[], fn: string, args: any[], block: number) => {calls.push({to, fn, args, block}); if (!(fn in answers)) throw new Error(`missing ${fn}`); return answers[fn];}};
  const resolver = new OnchainRFQContextResolver({chainId: 31337, verifyingContract: addr(6), router: addr(7), venueRegistry: addr(11), policyRegistry: addr(12), affiliateSource: addr(8), reader});
  const result = await resolver.resolve(base);
  assert.equal(result.configurationHash, commitment);
  assert.ok(calls.every((c) => c.block === 10));
  assert.deepEqual(calls.filter((c) => c.fn === "effectiveStatus").map((c) => c.args), [[base.taker, base.tokenIn], [base.maker, base.tokenOut]]);
  for (const [fn, value] of [["contextConfigHash", hash("drift")], ["effectiveStatus", 2], ["router", addr(99)], ["isContextImplementationApproved", false], ["affiliateSource", addr(99)]] as Array<[string, any]>) {
    const previous = answers[fn]; answers[fn] = value;
    await assert.rejects(() => resolver.resolve(base)); answers[fn] = previous;
  }
  await resolver.resolve({...base, nonce: "42"});
  answers.usedQuoteNonce = true;
  await assert.rejects(() => resolver.resolve({...base, nonce: "42"}));
  answers.usedQuoteNonce = false;
  const primary = {...base, flowType: 1 as const};
  await assert.rejects(() => resolver.resolve(primary));
});

test("v3 default nonce allocation remains monotonic within one millisecond", async () => {
  const original = Date.now;
  Date.now = () => 100000;
  try {
    const service = new RFQQuoteServiceV3({chainId: 31337, verifyingContract: addr(6), now: () => 100}, signer);
    const first = await service.createSignedQuote(base);
    const second = await service.createSignedQuote(base);
    assert.ok(BigInt(second.quote.nonce) > BigInt(first.quote.nonce));
  } finally {Date.now = original;}
});

test("v3 backend rejects an explicit risk rejection before context or signing", async () => {
  const {createRFQServiceV3} = await import("../src");
  let reads = 0;
  const service = createRFQServiceV3({...config, maker, signer, pricing: {price: () => ({amountOut: "20"})}, riskCheck: {check: () => ({decision: "rejected"})}, context: {resolve: async () => {reads++; return {contextVersion: 1, configurationHash: hash("cfg"), affiliateEvidenceHash: hash("claim"), sellerIsAffiliate: false};}}});
  await assert.rejects(() => service.quote(base), /risk rejected/);
  assert.equal(reads, 0);
  const f = fixture();
  await assert.rejects(() => new RFQQuoteCoordinatorV3({...f.cfg, riskCheck: {check: () => ({decision: "rejected"})}}).quote(f.intent), /risk rejected/);
  assert.equal(f.signs(), 0);
});

test("v3 persisted quote hash commits the complete signed message", async () => {
  const {hashCanonical} = await import("../src");
  const f = fixture();
  const result = await new RFQQuoteCoordinatorV3(f.cfg).quote(f.intent);
  const record = JSON.parse(readFileSync(f.filePath, "utf8")).records[0];
  assert.equal(record.quoteHash, hashCanonical({quote: result.quote, domain: result.typedData.domain}));
});

test("v3 validates contract ranges and nonzero actors before invoking an external signer", async () => {
  let calls = 0;
  const service = new RFQQuoteServiceV3(config, {signTypedData: async () => {calls++; return "0x11";}});
  for (const patch of [{maker: addr(0)}, {taker: addr(0)}, {tokenIn: addr(0)}, {venue: addr(0)}, {amountIn: 1n << 256n}, {nonce: 1n << 256n}, {ttlSeconds: Number.MAX_SAFE_INTEGER}]) await assert.rejects(() => service.createSignedQuote({...base, ...patch} as any));
  assert.equal(calls, 0);
});

test("v3 coordinator includes the reserved nonce in its final context revalidation", async () => {
  const f = fixture();
  const nonces: unknown[] = [];
  await new RFQQuoteCoordinatorV3({...f.cfg, context: {resolve: async (request) => {nonces.push(request.nonce); return f.cfg.context.resolve();}}}).quote(f.intent);
  assert.equal(nonces[nonces.length - 1], "1");
});
