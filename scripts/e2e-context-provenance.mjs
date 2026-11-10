import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {createRequire} from "node:module";
import {resolve} from "node:path";

const require = createRequire(resolve("services/rfq/package.json"));
const {AbiCoder, Contract, HDNodeWallet, JsonRpcProvider, MaxUint256, id} = require("ethers");
const {RFQQuoteCoordinator, RFQQuoteCoordinatorV3, LocalFileQuoteCoordinatorStore,
  OnchainRFQContextResolver, ethersContextReader} = require("./dist/src/index.js");
const {startProductionRFQHost, StaticBearerAuthenticator, MemoryAuditSink} =
  require(resolve("services/rfq-host/dist/src/server.js"));
const [rpc, artifactPath, runDir] = process.argv.slice(2);
assert.match(rpc, /^http:\/\/127\.0\.0\.1:\d+$/);
const a = JSON.parse(readFileSync(artifactPath, "utf8"));
const provider = new JsonRpcProvider(rpc, undefined, {cacheTimeout: -1});
const mnemonic = "test test test test test test test test test test test junk";
const wallet = (index) => HDNodeWallet.fromPhrase(mnemonic, undefined, `m/44'/60'/0'/0/${index}`).connect(provider);
const admin = wallet(0), taker = wallet(1), maker = wallet(2);
const abi = (file, contract) => JSON.parse(readFileSync(`out/${file}.sol/${contract}.json`, "utf8")).abi;
const router = new Contract(a.routerV2, abi("ExecutionRouterV2", "ExecutionRouterV2"), taker);
const adapter = new Contract(a.rfqV3Adapter, abi("RFQAdapterV3", "RFQAdapterV3"), provider);
const affiliate = new Contract(a.affiliateSource, abi("Affiliate", "Affiliate"), admin);
const engine = new Contract(a.engine, abi("ComplianceEngine", "ComplianceEngine"), provider);
const tokens = [a.cash, a.rwa].map((address) => new Contract(address, [
  "function approve(address,uint256) returns (bool)", "function balanceOf(address) view returns (uint256)"
], provider));
const coder = AbiCoder.defaultAbiCoder();
const quoteTuple = "tuple(address maker,address taker,address tokenIn,address tokenOut,uint256 amountIn,uint256 amountOut,address venue,bytes32 policyId,uint8 flowType,bytes32 affiliateEvidenceHash,uint256 nonce,uint64 expiry)";
let passes = 0;
const pass = (label) => {passes++; console.log(`PASS: ${label}`);};
const now = async () => (await provider.getBlock("latest")).timestamp;
const context = new OnchainRFQContextResolver({chainId: 31337, verifyingContract: a.rfqV3Adapter,
  router: a.routerV2, venueRegistry: a.venueReg, policyRegistry: a.policyReg,
  affiliateSource: a.affiliateSource, reader: ethersContextReader(provider)});
const makeContext = (q, sellerIsAffiliate = false) => ({initiator: taker.address, buyer: taker.address,
  seller: maker.address, tokenIn: q.tokenIn, tokenOut: q.tokenOut, amountIn: q.amountIn,
  amountOut: q.amountOut, venue: a.rfqV3Venue, venueType: 2, flowType: q.flowType, sellerIsAffiliate});
const balances = async () => Promise.all(tokens.flatMap((token) =>
  [taker.address, maker.address, a.routerV2, a.rfqV3Adapter].map((address) => token.balanceOf(address))));
const fresh = async () => ({snapshotId: "local-fixture", version: "1", observedAt: await now(),
  validUntil: await now() + 600, available: true});
const config = {chainId: 31337, verifyingContract: a.rfqV3Adapter, maker: maker.address,
  now, defaultTtlSeconds: 600, signer: {signTypedData: (data) => maker.signTypedData(data.domain, data.types, data.message)},
  pricing: {price: async (request) => ({amountOut: request.amountIn, ...await fresh()})},
  riskCheck: {check: async () => ({...await fresh(), decision: "passed"})},
  store: new LocalFileQuoteCoordinatorStore({filePath: resolve(runDir, "quotes.json"), inventory:
    tokens.map((token) => ({maker: maker.address, token: token.target, venue: a.rfqV3Venue, available: String(1000n * 10n ** 18n)}))})};
const resolvePolicyId = async () => (await engine.policyHashesOf(a.rwa)).policyId;
let host;
let observedAt = await now();
try {
  assert.equal((await provider.getNetwork()).chainId, 31337n);
  for (const actor of [taker, maker]) for (const token of tokens) {
    await (await token.connect(actor).approve(a.rfqV3Adapter, MaxUint256)).wait();
  }
  host = await startProductionRFQHost({coordinator: new RFQQuoteCoordinator(config),
    v3: {coordinator: new RFQQuoteCoordinatorV3({...config, context}), resolvePolicyId}, resolvePolicyId,
    authenticator: new StaticBearerAuthenticator([{token: "local-fixture-token", taker: taker.address}]),
    audit: new MemoryAuditSink(), now: () => observedAt});
  let routerNonce = 1;
  for (const sell of [false, true]) {
    const side = sell ? "sell" : "buy";
    const request = {taker: taker.address, tokenIn: sell ? a.rwa : a.cash, tokenOut: sell ? a.cash : a.rwa,
      amountIn: String(10n * 10n ** 18n), venue: a.rfqV3Venue, flowType: 0, ttlSeconds: 600};
    const quote = async (suffix) => {
      observedAt = await now();
      const response = await fetch(`${host.baseUrl}/rfq/v3/quote`, {method: "POST",
        headers: {"content-type": "application/json", authorization: "Bearer local-fixture-token"},
        body: JSON.stringify({...request, idempotencyKey: `${side}-${suffix}`})});
      const signed = await response.json();
      assert.equal(response.status, 200, JSON.stringify(signed));
      assert.equal(signed.typedData.domain.version, "3");
      return signed;
    };
    const signed = await quote("initial");
    const req = {context: makeContext(signed.quote), amountOutMin: signed.quote.amountOut, deadline: signed.quote.expiry, nonce: routerNonce,
      venueData: coder.encode([quoteTuple, "bytes"], [signed.quote, signed.signature])};
    const reject = async (label, bad, errorName) => {
      const before = await balances();
      await assert.rejects(router.execute.staticCall(bad), (error) =>
        error.data?.slice(0, 10) === id(`${errorName}()`).slice(0, 10));
      let receipt;
      try {receipt = await (await router.execute(bad, {gasLimit: 5000000})).wait();}
      catch (error) {receipt = error.receipt;}
      assert.ok(receipt, "missing mined rejection receipt");
      assert.equal(receipt.status, 0);
      assert.deepEqual(await balances(), before);
      assert.equal(await router.usedNonce(taker.address, routerNonce), false);
      assert.equal(await adapter.usedQuoteNonce(maker.address, signed.quote.nonce), false);
      pass(`${side}: ${label}, status 0 receipt, balances and nonces unchanged`);
    };
    await reject("seller mismatch", {...req, context: {...req.context, seller: taker.address}}, "RFQQuoteMismatch");
    await reject("flow mismatch", {...req, context: {...req.context, flowType: 1}}, "RFQQuoteMismatch");
    await reject("affiliate boolean mismatch", {...req, context: {...req.context, sellerIsAffiliate: true}}, "InvalidExecutionContext");
    await provider.send("evm_increaseTime", [1]);
    await provider.send("evm_mine", []);
    await (await affiliate.setClaim(sell ? taker.address : maker.address, a.rwa, 8, 1,
      admin.address, await now(), 0)).wait();
    await reject("actual sender evidence refresh invalidates signed commitment", req, "RFQQuoteMismatch");
    const refreshed = await quote("refreshed");
    assert.notEqual(refreshed.quote.affiliateEvidenceHash, signed.quote.affiliateEvidenceHash);
    const good = {...req, context: makeContext(refreshed.quote), deadline: refreshed.quote.expiry,
      venueData: coder.encode([quoteTuple, "bytes"], [refreshed.quote, refreshed.signature])};
    const before = await balances();
    const receipt = await (await router.execute(good)).wait();
    assert.equal(receipt.status, 1);
    const after = await balances();
    const amount = BigInt(request.amountIn);
    assert.deepEqual(after.map((value, i) => value - before[i]),
      [sell ? amount : -amount, sell ? -amount : amount, 0n, 0n,
        sell ? -amount : amount, sell ? amount : -amount, 0n, 0n]);
    assert.equal(await router.usedNonce(taker.address, routerNonce), true);
    assert.equal(await adapter.usedQuoteNonce(maker.address, refreshed.quote.nonce), true);
    assert.ok(receipt.logs.some((log) => log.address.toLowerCase() === a.routerV2.toLowerCase()));
    pass(`${side}: refreshed host quote settled exact token deltas through RouterV2, no custody`);
    routerNonce++;
  }
  console.log(`Context provenance E2E: ${passes} passed, 0 failed`);
} finally {
  if (host) await host.close();
  provider.destroy();
}
