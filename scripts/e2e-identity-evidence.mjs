import assert from "node:assert/strict";
import {randomBytes} from "node:crypto";
import {readFileSync} from "node:fs";
import {createRequire} from "node:module";
import {resolve} from "node:path";

const require = createRequire(resolve("services/rfq/package.json"));
const {AbiCoder, Contract, HDNodeWallet, JsonRpcProvider, MaxUint256, encodeBytes32String, id, keccak256} = require("ethers");
const {domain, domainV3, typedData, typedDataV3, OnchainRFQContextResolver, ethersContextReader} = require("./dist/src/index.js");
const {loadLocalKycCommitmentsV2, KycEvidenceCoordinatorV2, InMemoryKycEvidenceStoreV2, identityEvidenceAcceptanceV2} =
  require(resolve("services/compliance-data/dist/src/identity-v2.js"));
const {DemoKycProviderAdapterV2} = require(resolve("services/compliance-data/dist/src/kyc-demo-v2.js"));
const {encodeAcceptIdentityEvidenceV2, decodeAcceptIdentityEvidenceV2} = require(resolve("services/toolkit/dist/src/index.js"));
const [rpc, artifactPath] = process.argv.slice(2);
assert.match(rpc, /^http:\/\/127\.0\.0\.1:\d+$/);
const artifactText = readFileSync(artifactPath, "utf8");
const a = JSON.parse(artifactText);
const provider = new JsonRpcProvider(rpc, undefined, {cacheTimeout: -1});
const mnemonic = "test test test test test test test test test test test junk";
const wallet = (index) => HDNodeWallet.fromPhrase(mnemonic, undefined, `m/44'/60'/0'/0/${index}`).connect(provider);
const admin = wallet(0), taker = wallet(1), maker = wallet(2), other = wallet(3);
const abi = (name) => JSON.parse(readFileSync(`out/${name}.sol/${name}.json`, "utf8")).abi;
const evidence = new Contract(a.identityEvidenceV2, abi("IdentityUniquenessV2"), admin);
const engine = new Contract(a.engine, abi("ComplianceEngine"), admin);
const policies = new Contract(a.policyReg, abi("TokenPolicyRegistry"), provider);
const surveillance = new Contract(a.surveillance, abi("SurveillanceFlagV2"), provider);
const tokens = [a.cash, a.rwa].map((address) => new Contract(address, [
  "function approve(address,uint256) returns (bool)", "function balanceOf(address) view returns (uint256)"
], provider));
const coder = AbiCoder.defaultAbiCoder();
const quoteTuple = "tuple(address maker,address taker,address tokenIn,address tokenOut,uint256 amountIn,uint256 amountOut,address venue,bytes32 policyId,uint256 nonce,uint64 expiry)";
const quoteTupleV3 = "tuple(address maker,address taker,address tokenIn,address tokenOut,uint256 amountIn,uint256 amountOut,address venue,bytes32 policyId,uint8 flowType,bytes32 affiliateEvidenceHash,uint256 nonce,uint64 expiry)";
let passes = 0;
const pass = (label) => {passes++; console.log(`PASS: ${label}`);};
const now = async () => (await provider.getBlock("latest")).timestamp;
const localKey = randomBytes(32).toString("hex");
const commitments = loadLocalKycCommitmentsV2({env: {CORNER_STORE_KYC_HMAC_KEY: localKey}});
const issuerId = commitments.hash("source", "fixture-issuer");
const trustBasisHash = commitments.hash("source", "fixture-delegation");
const records = new Map();
const acceptanceReceipts = [];
const privateReferences = [localKey, "private-taker-case", "private-maker-case", "5493001KJTIIGC8Y1R12"];
const publicOnly = (value) => {
  const text = (typeof value === "string" ? value : JSON.stringify(value)).toLowerCase();
  for (const secret of privateReferences) {
    assert.equal(text.includes(secret.toLowerCase()), false, "private evidence leaked");
    assert.equal(text.includes(Buffer.from(secret).toString("hex")), false, "encoded private evidence leaked");
  }
};
const snapshot = async () => ({
  balances: await Promise.all(tokens.flatMap((token) => [taker.address, maker.address, other.address,
    a.router, a.routerV2, a.rfqV2, a.rfqV3].map((address) => token.balanceOf(address)))),
  count: await surveillance.transferCount()
});
const reason = (code) => keccak256(coder.encode(["uint16", "bytes32", "uint32"], [0, encodeBytes32String("A-04-v2"), code]));
const accept = async (actor) => {
  const call = identityEvidenceAcceptanceV2(records.get(actor.address), commitments, await now());
  const fields = {wallet: call.wallet, asset: call.asset, evidence: call.evidence};
  assert.equal(encodeAcceptIdentityEvidenceV2(fields), call.calldata);
  assert.deepEqual(decodeAcceptIdentityEvidenceV2(call.calldata), fields);
  assert.equal((call.calldata.length - 2) / 2, 292);
  publicOnly(fields);
  publicOnly(call.calldata);
  const receipt = await (await admin.sendTransaction({to: a.identityEvidenceV2, data: call.calldata})).wait();
  assert.equal(receipt.status, 1);
  acceptanceReceipts.push(receipt);
  const event = receipt.logs.map((log) => {try {return evidence.interface.parseLog(log);} catch {return null;}})
    .find((event) => event?.name === "EvidenceAccepted");
  assert.ok(event);
  assert.equal(event.args.evidenceHash, call.evidence.evidenceHash);
  const stored = await evidence.evidenceOf(actor.address, a.rwa);
  assert.equal(stored.identityId, call.evidence.identityId);
  assert.equal(stored.evidenceHash, call.evidence.evidenceHash);
  assert.equal(stored.expiresAt, BigInt(call.evidence.expiresAt));
  assert.equal(await evidence.walletOf(stored.identityId), actor.address);
  publicOnly(receipt.logs.map((log) => ({topics: log.topics, data: log.data})));
};

try {
  assert.equal((await provider.getNetwork()).chainId, 31337n);
  publicOnly(artifactText);
  const bindings = await policies.recipeBindingsOf(a.rwa);
  assert.equal(bindings[0].recipeId, 1n);
  assert.equal(bindings[0].recipeVersion, 4n);
  assert.equal(bindings[0].mode, 0n);
  const rules = await policies.compiledRulesOf(a.rwa, 0);
  assert.equal(rules[3].elementId, encodeBytes32String("A-04-v2"));
  const parameters = await policies.compiledParametersOf(a.rwa, 0);
  assert.equal(parameters[3], coder.encode(["uint8", "uint8"], [1, 1]));
  pass("isolated manifest explicitly selects Reg D v4 and required DIRECT A-04-v2 parameters");

  const observedAt = await now();
  const audits = [];
  const adapter = new DemoKycProviderAdapterV2({commitments, now: () => observedAt, validitySeconds: 3600,
    provenance: {issuerId, trustBasisHash, issuedAt: observedAt, expiresAt: observedAt + 7200, attestationType: "SELECTIVE_DISCLOSURE"},
    fixtures: [{subject: taker.address, facts: {kyc: "VERIFIED", sanctions: "CLEAR"}, lei: "5493001KJTIIGC8Y1R12"},
      {subject: maker.address, facts: {kyc: "VERIFIED", sanctions: "CLEAR"}}]});
  let accepted = 0;
  const store = new InMemoryKycEvidenceStoreV2(commitments);
  const coordinator = new KycEvidenceCoordinatorV2(adapter, store, {commitments, mode: "demo", now: () => observedAt,
    accept: async () => {accepted++; return true;}, audit: (event) => {audits.push(event);}});
  for (const [actor, privateRef] of [[taker, "private-taker-case"], [maker, "private-maker-case"]]) {
    const identity = commitments.hash("identity", privateRef);
    const result = await coordinator.refresh({subject: actor.address, asset: a.rwa, identity,
      requestRefHash: commitments.hash("assessment", privateRef)});
    assert.ok(result.eligible);
    records.set(actor.address, result.materialization);
    await (await evidence.bindIdentity(actor.address, identity)).wait();
    assert.equal((await evidence.evidenceOf(actor.address, a.rwa)).evidenceHash, `0x${"00".repeat(32)}`);
    pass(`${actor === taker ? "taker" : "maker"}: provider evidence explicitly accepted, binding creates no on-chain evidence`);
  }
  assert.equal(accepted, 2);
  publicOnly(audits);
  await (await evidence.setTrustedIssuer(issuerId, trustBasisHash)).wait();
  for (const actor of [taker, maker]) for (const token of tokens) for (const target of [a.rfqV2, a.rfqV3]) {
    await (await token.connect(actor).approve(target, MaxUint256)).wait();
  }

  let nonce = 1;
  for (const version of [2, 3]) for (const sell of [false, true]) {
    const label = `RFQ v${version} ${sell ? "sell" : "buy"}`;
    const routerAddress = version === 2 ? a.router : a.routerV2;
    const adapterAddress = version === 2 ? a.rfqV2 : a.rfqV3;
    const router = new Contract(routerAddress, abi(version === 2 ? "ExecutionRouter" : "ExecutionRouterV2"), taker);
    const rfq = new Contract(adapterAddress, abi(version === 2 ? "RFQAdapter" : "RFQAdapterV3"), provider);
    await (await engine.setRouter(routerAddress)).wait();
    const q = {maker: maker.address, taker: taker.address, tokenIn: sell ? a.rwa : a.cash,
      tokenOut: sell ? a.cash : a.rwa, amountIn: 10n * 10n ** 18n, amountOut: 25n * 10n ** 18n,
      venue: adapterAddress, policyId: (await engine.policyHashesOf(a.rwa)).policyId,
      nonce, expiry: await now() + 600};
    let sellerIsAffiliate = false;
    if (version === 3) {
      const context = new OnchainRFQContextResolver({chainId: 31337, verifyingContract: adapterAddress,
        router: routerAddress, venueRegistry: a.venueReg, policyRegistry: a.policyReg,
        affiliateSource: a.affiliateSource, reader: ethersContextReader(provider)});
      const resolved = await context.resolve({...q, flowType: 0});
      q.flowType = 0;
      q.affiliateEvidenceHash = resolved.affiliateEvidenceHash;
      sellerIsAffiliate = resolved.sellerIsAffiliate;
    }
    const data = version === 2 ? typedData(domain(31337, adapterAddress), q) : typedDataV3(domainV3(31337, adapterAddress), q);
    const signature = await maker.signTypedData(data.domain, data.types, data.message);
    const req = {context: {initiator: taker.address, buyer: taker.address, seller: maker.address,
      tokenIn: q.tokenIn, tokenOut: q.tokenOut, amountIn: q.amountIn, amountOut: q.amountOut,
      venue: adapterAddress, venueType: 2, flowType: 0, sellerIsAffiliate},
      amountOutMin: q.amountOut, deadline: q.expiry, nonce,
      venueData: coder.encode([version === 2 ? quoteTuple : quoteTupleV3, "bytes"], [q, signature])};
    const reject = async (name, bad, errorName, code, caller = taker) => {
      const before = await snapshot();
      await assert.rejects(router.connect(caller).execute.staticCall(bad), (error) => {
        assert.equal(error.data?.slice(0, 10), id(errorName).slice(0, 10));
        if (code !== undefined) assert.equal(router.interface.parseError(error.data).args[0], reason(code));
        return true;
      });
      let receipt;
      try {receipt = await (await router.connect(caller).execute(bad, {gasLimit: 5000000})).wait();}
      catch (error) {receipt = error.receipt;}
      assert.ok(receipt, "missing mined rejection");
      assert.equal(receipt.status, 0);
      assert.equal(receipt.logs.length, 0);
      assert.deepEqual(await snapshot(), before);
      assert.equal(await router.usedNonce(caller.address, nonce), false);
      assert.equal(await rfq.usedQuoteNonce(maker.address, q.nonce), false);
      pass(`${label}: ${name}, mined revert preserves balances, nonces and surveillance`);
    };
    await (await evidence.revokeEvidence(taker.address, a.rwa)).wait();
    await (await evidence.revokeEvidence(maker.address, a.rwa)).wait();
    await reject("bound wallet without accepted evidence", req, "ComplianceRejected(bytes32)", 2);
    await accept(taker);
    await reject("maker without accepted evidence", req, "ComplianceRejected(bytes32)", 2);
    await accept(maker);
    assert.equal((await engine.evaluate(req.context)).allowed, true);
    await reject("mismatched buyer", {...req, context: {...req.context, buyer: maker.address}}, "RFQQuoteMismatch()");
    await reject("mismatched initiator", {...req, context: {...req.context, initiator: other.address}},
      "RFQQuoteMismatch()", undefined, other);
    await reject("mismatched maker", {...req, context: {...req.context, seller: taker.address}}, "RFQQuoteMismatch()");
    for (const actor of [taker, maker]) {
      await (await evidence.revokeEvidence(actor.address, a.rwa)).wait();
      await reject(`${actor === taker ? "taker" : "maker"} evidence revoked after signing`, req, "ComplianceRejected(bytes32)", 2);
      await accept(actor);
    }
    await (await evidence.setTrustedIssuer(issuerId, `0x${"00".repeat(32)}`)).wait();
    await reject("issuer removed after acceptance", req, "ComplianceRejected(bytes32)", 4);
    await (await evidence.setTrustedIssuer(issuerId, trustBasisHash)).wait();
    const before = await snapshot();
    const receipt = await (await router.execute(req)).wait();
    assert.equal(receipt.status, 1);
    const after = await snapshot();
    assert.deepEqual(after.balances.map((value, i) => value - before.balances[i]),
      [sell ? q.amountOut : -q.amountIn, sell ? -q.amountOut : q.amountIn, 0n, 0n, 0n, 0n, 0n,
        sell ? -q.amountIn : q.amountOut, sell ? q.amountIn : -q.amountOut, 0n, 0n, 0n, 0n, 0n]);
    assert.equal(after.count, before.count + 1n);
    for (const token of tokens) for (const target of [a.router, a.routerV2, a.rfqV2, a.rfqV3]) {
      assert.equal(await token.balanceOf(target), 0n);
    }
    assert.equal(await router.usedNonce(taker.address, nonce), true);
    assert.equal(await rfq.usedQuoteNonce(maker.address, q.nonce), true);
    publicOnly(receipt.logs.map((log) => ({topics: log.topics, data: log.data})));
    pass(`${label}: same signed request retries and settles exact bilateral deltas, one commit, zero custody`);
    nonce++;
  }
  assert.equal(await surveillance.transferCount(), 4n);
  assert.equal(acceptanceReceipts.length, 16);
  pass("key, raw evidence references and optional LEI absent from public calldata, artifact, audits and events");
  console.log(`Identity evidence E2E: ${passes} passed, 0 failed`);
} finally {
  provider.destroy();
}
