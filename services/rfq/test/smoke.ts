declare function require(name: string): any;

import {Wallet} from "ethers";

import {
  createRFQService,
  hashCanonical,
  LocalFileQuoteCoordinatorStore,
  assertRFQModuleConformance,
  FixedRatePricingProvider,
  InMemoryNonceStore,
  NoopInventoryRiskCheck,
  nonceModule,
  pricingModule,
  RFQ_DOMAIN_NAME,
  RFQ_DOMAIN_VERSION,
  RFQQuoteCoordinator,
  RFQQuoteService,
  riskModule,
  runRFQModuleConformance,
  signerModule
} from "../src";
import {RFQQuoteRequest, RFQTypedData, TypedDataSigner, InventoryRiskCheck, RFQPriceRequest} from "../src/types";

const MAKER = "0x1000000000000000000000000000000000000001";
const TAKER = "0x2000000000000000000000000000000000000002";
const OTHER_TAKER = "0x2000000000000000000000000000000000000022";
const TOKEN_IN = "0x3000000000000000000000000000000000000003";
const TOKEN_OUT = "0x4000000000000000000000000000000000000004";
const VENUE = "0x5000000000000000000000000000000000000005";
const ADAPTER = "0x6000000000000000000000000000000000000006";
const childProcess = require("child_process");
const fs = require("fs");
const os = require("os");
const path = require("path");

class CaptureSigner implements TypedDataSigner {
  public lastTypedData?: RFQTypedData;
  public calls = 0;

  async signTypedData(typedData: RFQTypedData): Promise<`0x${string}`> {
    this.calls += 1;
    this.lastTypedData = typedData;
    return `0x${"11".repeat(65)}`;
  }
}

class RejectingRiskCheck implements InventoryRiskCheck {
  check(_request: RFQPriceRequest, _price: { amountOut: string }): void {
    throw new Error("insufficient inventory");
  }
}

async function main() {
  await lowLevelQuoteServiceSmoke();
  await highLevelSdkSmoke();
  await referenceComponentSmoke();
  await moduleConformanceSmoke();
  await durableCoordinatorSmoke();
  console.log("RFQ service smoke ok");
}

async function lowLevelQuoteServiceSmoke() {
  const signer = new CaptureSigner();
  const service = new RFQQuoteService(
    {
      chainId: 31337,
      verifyingContract: ADAPTER,
      now: () => 1_700_000_000,
      nextNonce: () => 42n,
      defaultTtlSeconds: 120
    },
    signer
  );

  const signed = await service.createSignedQuote({
    maker: MAKER,
    taker: TAKER as `0x${string}`,
    tokenIn: TOKEN_IN as `0x${string}`,
    tokenOut: TOKEN_OUT as `0x${string}`,
    amountIn: 100n,
    amountOut: 250n,
    venue: VENUE
  });

  assert(signed.quote.maker === MAKER.toLowerCase(), "maker normalized");
  assert(signed.quote.taker === TAKER.toLowerCase(), "taker normalized");
  assert(signed.quote.amountIn === "100", "amountIn string");
  assert(signed.quote.amountOut === "250", "amountOut string");
  assert(signed.quote.nonce === "42", "nonce assigned");
  assert(signed.quote.expiry === 1_700_000_120, "expiry assigned");
  assert(signed.signature.length === 132, "65-byte signature");
  assert(signed.typedData.domain.name === RFQ_DOMAIN_NAME, "domain name");
  assert(signed.typedData.domain.version === RFQ_DOMAIN_VERSION, "domain version");
  assert(signed.typedData.domain.chainId === 31337, "chain id");
  assert(signed.typedData.domain.verifyingContract === ADAPTER.toLowerCase(), "verifying contract");
  assert(signer.lastTypedData?.message.venue === VENUE.toLowerCase(), "venue bound into signed message");

  assertThrows(() => service.createQuote({...baseRequest(), amountIn: Number.MAX_SAFE_INTEGER + 1}), "unsafe amount");
  assertThrows(() => service.createQuote({...baseRequest(), nonce: Number.MAX_SAFE_INTEGER + 1}), "unsafe nonce");
  assertThrows(() => service.createQuote({...baseRequest(), taker: "0x123"}), "bad taker");
  assertThrows(() => service.createQuote({...baseRequest(), ttlSeconds: 0}), "bad ttl");

  const defaultNonceService = new RFQQuoteService({chainId: 31337, verifyingContract: ADAPTER, now: () => 1}, signer);
  const firstNonce = BigInt(defaultNonceService.createQuote(baseRequest()).nonce);
  const secondNonce = BigInt(defaultNonceService.createQuote(baseRequest()).nonce);
  assert(secondNonce > firstNonce, "default nonce is monotonic");
}

async function highLevelSdkSmoke() {
  const signer = new CaptureSigner();
  const nonceStore = new InMemoryNonceStore();
  const rfq = createRFQService({
    chainId: 31337,
    verifyingContract: ADAPTER,
    maker: MAKER,
    signer,
    nonceStore,
    pricing: new FixedRatePricingProvider({numerator: 99n, denominator: 100n}),
    riskCheck: new NoopInventoryRiskCheck(),
    now: () => 1_700_000_000,
    defaultTtlSeconds: 30
  });

  const signed = await rfq.quote({
    taker: TAKER as `0x${string}`,
    tokenIn: TOKEN_IN as `0x${string}`,
    tokenOut: TOKEN_OUT as `0x${string}`,
    amountIn: "1000000000000000000",
    venue: VENUE
  });

  assert(signed.quote.maker === MAKER.toLowerCase(), "SDK maker from config");
  assert(signed.quote.amountIn === "1000000000000000000", "SDK amountIn preserved");
  assert(signed.quote.amountOut === "990000000000000000", "SDK fixed-rate pricing");
  assert(signed.quote.expiry === 1_700_000_030, "SDK default ttl");
  assert(BigInt(signed.quote.nonce) > 0n, "SDK nonce assigned");
  assert(signer.calls === 1, "SDK signed once");
  assert(signed.typedData.message.amountOut === signed.quote.amountOut, "SDK typed data binds price");

  const asyncClock = createRFQService({
    chainId: 31337,
    verifyingContract: ADAPTER,
    maker: MAKER,
    signer,
    pricing: new FixedRatePricingProvider({numerator: 1n, denominator: 1n}),
    now: async () => 1_800_000_000,
    defaultTtlSeconds: 60
  });
  const chainTimed = await asyncClock.quote({
    taker: TAKER as `0x${string}`,
    tokenIn: TOKEN_IN as `0x${string}`,
    tokenOut: TOKEN_OUT as `0x${string}`,
    amountIn: 10n,
    venue: VENUE
  });
  assert(chainTimed.quote.expiry === 1_800_000_060, "SDK supports async chain clock");

  const second = await rfq.quote({taker: TAKER, tokenIn: TOKEN_IN, tokenOut: TOKEN_OUT, amountIn: 10n, venue: VENUE});
  assert(BigInt(second.quote.nonce) > BigInt(signed.quote.nonce), "SDK nonce store is monotonic");

  const otherTaker = await rfq.quote({
    taker: OTHER_TAKER,
    tokenIn: TOKEN_IN,
    tokenOut: TOKEN_OUT,
    amountIn: 10n,
    venue: VENUE
  });
  assert(BigInt(otherTaker.quote.nonce) > BigInt(second.quote.nonce), "SDK nonce is maker-scoped like RFQAdapter");

  const rejectingSigner = new CaptureSigner();
  const rejecting = createRFQService({
    chainId: 31337,
    verifyingContract: ADAPTER,
    maker: MAKER,
    signer: rejectingSigner,
    pricing: new FixedRatePricingProvider({numerator: 1n, denominator: 1n}),
    riskCheck: new RejectingRiskCheck()
  });

  await assertRejects(
    () => rejecting.quote({taker: TAKER, tokenIn: TOKEN_IN, tokenOut: TOKEN_OUT, amountIn: 1n, venue: VENUE}),
    "risk rejection"
  );
  assert(rejectingSigner.calls === 0, "risk check rejects before signing");

  await assertRejects(
    () => rfq.quote({taker: TAKER, tokenIn: TOKEN_IN, tokenOut: TOKEN_OUT, amountIn: Number.MAX_SAFE_INTEGER + 1, venue: VENUE}),
    "SDK unsafe amount"
  );
}

async function referenceComponentSmoke() {
  assertThrows(() => new FixedRatePricingProvider({numerator: 0n, denominator: 1n}), "zero numerator");
  assertThrows(() => new FixedRatePricingProvider({numerator: 1n, denominator: 0n}), "zero denominator");
  const pricing = new FixedRatePricingProvider({numerator: 1n, denominator: 3n});
  assertThrows(() => pricing.price({...priceRequest(), amountIn: 1n.toString()}), "zero amountOut rejected");
}

async function moduleConformanceSmoke() {
  const wallet = new Wallet("0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d");
  const signer = {
    signTypedData: async (typedData: RFQTypedData) =>
      wallet.signTypedData(typedData.domain, typedData.types, typedData.message) as Promise<`0x${string}`>
  };
  const fixture = {
    chainId: 31337,
    verifyingContract: ADAPTER,
    maker: wallet.address as `0x${string}`,
    taker: TAKER,
    otherTaker: OTHER_TAKER,
    tokenIn: TOKEN_IN,
    tokenOut: TOKEN_OUT,
    venue: VENUE as `0x${string}`,
    amountIn: "100",
    now: 1_700_000_000,
    ttlSeconds: 60
  } as const;
  const referenceResult = await assertRFQModuleConformance({
    pricing: pricingModule("corner-store.fixed-rate", new FixedRatePricingProvider({numerator: 1n, denominator: 1n}), {maturity: "reference"}),
    risk: riskModule("corner-store.noop-risk", new NoopInventoryRiskCheck(), {maturity: "reference"}),
    signer: signerModule("corner-store.capture-signer", signer, {maturity: "reference"}),
    nonce: nonceModule("corner-store.in-memory-nonce", new InMemoryNonceStore(), {maturity: "reference"})
  }, fixture);
  assert(referenceResult.passed, "reference module conformance");

  const modules = {
    pricing: pricingModule(
      "example.custom-pricing",
      {price: (request: RFQPriceRequest) => ({amountOut: (BigInt(request.amountIn) * 2n).toString()})},
      {configKeys: ["PRICE_FEED_URL"]}
    ),
    risk: riskModule("example.custom-risk", new NoopInventoryRiskCheck()),
    signer: signerModule("example.custom-signer", signer, {
      configKeys: ["SIGNER_KEY_ID"],
      secretConfigKeys: ["SIGNER_KEY_ID"]
    }),
    nonce: nonceModule("example.custom-nonce", new InMemoryNonceStore(), {
      configKeys: ["NONCE_DATABASE_URL"],
      secretConfigKeys: ["NONCE_DATABASE_URL"]
    })
  };
  const result = await assertRFQModuleConformance(modules, fixture);
  assert(result.checks.some((check) => check.name === "nonce" && check.pass), "custom module conformance");
  const fakeSignatureResult = await runRFQModuleConformance({
    ...modules,
    signer: signerModule("example.fake-signer", new CaptureSigner()),
    nonce: nonceModule("example.fake-nonce", new InMemoryNonceStore())
  }, fixture);
  assert(
    fakeSignatureResult.checks.some((check) => check.name === "signer-recovery" && !check.pass),
    "conformance rejects a shape-only signature"
  );
  assertThrows(
    () => pricingModule("Bad Module", new FixedRatePricingProvider({numerator: 1n, denominator: 1n})),
    "invalid module id"
  );
}

async function durableCoordinatorSmoke() {
  const makerWallet = new Wallet("0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d");
  const maker = makerWallet.address as `0x${string}`;
  let now = 1_700_000_000;
  const filePath = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "corner-rfq-coordinator-")), "store.json");
  const store = () => new LocalFileQuoteCoordinatorStore({
    filePath,
    confirmationDepth: 2,
    inventory: [{maker, token: TOKEN_OUT, venue: VENUE, available: "100"}]
  });
  const signer = {
    signTypedData: (typedData: RFQTypedData) =>
      makerWallet.signTypedData(typedData.domain, typedData.types, typedData.message) as Promise<`0x${string}`>
  };
  const coordinator = () => new RFQQuoteCoordinator({
    chainId: 31337,
    verifyingContract: ADAPTER,
    maker,
    signer,
    pricing: new FixedRatePricingProvider({numerator: 1n, denominator: 1n}),
    riskCheck: new NoopInventoryRiskCheck(),
    store: store(),
    now: () => now,
    defaultTtlSeconds: 60,
    confirmationDepth: 2,
    signerKeyRef: "kms://local-test-key",
    moduleVersions: {pricing: "fixed-rate@1.0.0", risk: "noop@1.0.0"}
  });

  const first = await coordinator().quote({...durableIntent("same-key"), amountIn: "40"});
  const replayAfterRestart = await coordinator().quote({...durableIntent("same-key"), amountIn: "40"});
  assert(replayAfterRestart.quote.nonce === first.quote.nonce, "idempotent retry returns persisted nonce after restart");
  assert(replayAfterRestart.signature === first.signature, "idempotent retry returns persisted signature after restart");
  await assertRejects(
    () => coordinator().quote({...durableIntent("same-key"), amountIn: "41"}),
    "idempotency conflict"
  );

  const concurrent = await Promise.allSettled(
    [0, 1, 2, 3].map((i) => coordinator().quote({...durableIntent(`concurrent-${i}`), amountIn: "30"}))
  );
  const fulfilled = concurrent.filter((result): result is PromiseFulfilledResult<any> => result.status === "fulfilled");
  const rejected = concurrent.filter((result): result is PromiseRejectedResult => result.status === "rejected");
  assert(fulfilled.length === 2, "concurrent reservations cannot exceed remaining inventory");
  assert(rejected.length === 2 && rejected.every((result) => /insufficient unreserved inventory/.test(String(result.reason?.message))), "over-capacity reservations fail closed");
  const nonces = [first.quote.nonce, ...fulfilled.map((result) => result.value.quote.nonce)].map(BigInt);
  assert(new Set(nonces.map(String)).size === nonces.length, "durable coordinator nonces are unique");
  assert(nonces[1] > nonces[0] && nonces[2] > nonces[1], "durable coordinator nonces are monotonic by maker scope");

  const observed = await coordinator().observeSettlement(first.quote.nonce, {
    kind: "fill",
    transactionHash: `0x${"aa".repeat(32)}`,
    blockNumber: 10,
    blockHash: `0x${"bb".repeat(32)}`
  });
  assert(observed.state === "FILL_OBSERVED" && observed.inventoryLease?.released === false, "observed fill retains lease until finality");
  const reorged = await coordinator().reconcile(first.quote.nonce, {
    currentBlockNumber: 11,
    canonicalBlockHash: `0x${"cc".repeat(32)}`,
    now
  });
  assert(reorged.state === "PUBLISHED" && !reorged.observed && reorged.inventoryLease?.released === false, "reorg rolls observed fill back to published");
  await coordinator().observeSettlement(first.quote.nonce, {
    kind: "cancel",
    transactionHash: `0x${"dd".repeat(32)}`,
    blockNumber: 12,
    blockHash: `0x${"ee".repeat(32)}`
  });
  const cancelled = await coordinator().reconcile(first.quote.nonce, {
    currentBlockNumber: 13,
    canonicalBlockHash: `0x${"ee".repeat(32)}`,
    now
  });
  assert(cancelled.state === "CANCELLED" && cancelled.inventoryLease?.released === true, "cancel finality releases lease exactly once");
  const revokedAgain = await coordinator().revoke(first.quote.nonce);
  assert(revokedAgain.state === "CANCELLED" && revokedAgain.inventoryLease?.releaseReason === "cancelled", "terminal release is idempotent");

  const afterCancel = await coordinator().quote({...durableIntent("after-cancel"), amountIn: "40"});
  assert(BigInt(afterCancel.quote.nonce) > BigInt(fulfilled[1].value.quote.nonce), "released inventory can be quoted with a later nonce");
  now += 61;
  const expired = await coordinator().expire(afterCancel.quote.nonce);
  assert(expired.state === "EXPIRED" && expired.inventoryLease?.released === true, "expiry releases reservation");

  const failingSigner = new RFQQuoteCoordinator({
    chainId: 31337,
    verifyingContract: ADAPTER,
    maker,
    signer: {signTypedData: async () => { throw new Error("external signer unavailable"); }},
    pricing: new FixedRatePricingProvider({numerator: 1n, denominator: 1n}),
    riskCheck: new NoopInventoryRiskCheck(),
    store: store(),
    now: () => now,
    defaultTtlSeconds: 60
  });
  await assertRejects(() => failingSigner.quote({...durableIntent("sign-fails"), amountIn: "10"}), "sign failure fails closed");
  const failedRecord = await store().getByIdempotencyKeyHash(
    {chainId: 31337, adapter: ADAPTER.toLowerCase() as `0x${string}`, maker: maker.toLowerCase() as `0x${string}`},
    hashCanonical({value: "sign-fails"})
  );
  assert(failedRecord?.state === "SIGN_FAILED" && failedRecord.inventoryLease?.released === true, "sign failure burns nonce and releases lease");
  const afterFailure = await coordinator().quote({...durableIntent("after-sign-failure"), amountIn: "10"});
  assert(BigInt(afterFailure.quote.nonce) > BigInt(failedRecord?.nonce ?? "0"), "nonce after sign failure is not reused");

  await assertRejects(
    () => new RFQQuoteCoordinator({
      chainId: 31337,
      verifyingContract: ADAPTER,
      maker,
      signer: new CaptureSigner(),
      pricing: new FixedRatePricingProvider({numerator: 1n, denominator: 1n}),
      riskCheck: new NoopInventoryRiskCheck(),
      store: store(),
      now: () => now
    }).quote({...durableIntent("bad-signature"), amountIn: "1"}),
    "local signature verification"
  );

  const riskRejectedSigner = new CaptureSigner();
  await assertRejects(
    () => new RFQQuoteCoordinator({
      chainId: 31337,
      verifyingContract: ADAPTER,
      maker,
      signer: riskRejectedSigner,
      pricing: new FixedRatePricingProvider({numerator: 1n, denominator: 1n}),
      riskCheck: new RejectingRiskCheck(),
      store: store(),
      now: () => now
    }).quote({...durableIntent("risk-rejected"), amountIn: "1"}),
    "coordinator risk rejection"
  );
  const riskRejectedRecord = await store().getByIdempotencyKeyHash(
    {chainId: 31337, adapter: ADAPTER.toLowerCase() as `0x${string}`, maker: maker.toLowerCase() as `0x${string}`},
    hashCanonical({value: "risk-rejected"})
  );
  assert(!riskRejectedRecord && riskRejectedSigner.calls === 0, "risk rejection does not reserve nonce or call signer");

  const noCanonicalObservation = {
    kind: "fill" as const,
    transactionHash: `0x${"12".repeat(32)}` as `0x${string}`,
    blockNumber: 20,
    blockHash: `0x${"34".repeat(32)}` as `0x${string}`
  };
  const noCanonical = await coordinator().observeSettlement(afterFailure.quote.nonce, noCanonicalObservation);
  assert(noCanonical.state === "FILL_OBSERVED", "second observed fill recorded");
  const sameObserved = await coordinator().observeSettlement(afterFailure.quote.nonce, noCanonicalObservation);
  assert(sameObserved.state === "FILL_OBSERVED" && sameObserved.observed?.transactionHash === noCanonicalObservation.transactionHash, "identical observation is idempotent");
  await assertRejects(
    () => coordinator().observeSettlement(afterFailure.quote.nonce, {...noCanonicalObservation, transactionHash: `0x${"13".repeat(32)}`}),
    "conflicting observed tx hash"
  );
  await assertRejects(
    () => coordinator().observeSettlement(afterFailure.quote.nonce, {...noCanonicalObservation, kind: "cancel" as const}),
    "conflicting observed kind"
  );
  now += 61;
  await assertRejects(() => coordinator().expire(afterFailure.quote.nonce), "observed quote cannot expire before reconciliation");
  await assertRejects(() => coordinator().revoke(afterFailure.quote.nonce), "observed quote cannot revoke before reconciliation");
  const notFinalWithoutCanonical = await coordinator().reconcile(afterFailure.quote.nonce, {currentBlockNumber: 99, now});
  assert(notFinalWithoutCanonical.state === "FILL_OBSERVED" && notFinalWithoutCanonical.inventoryLease?.released === false, "canonical block hash is required before finality");
  await assertRejects(
    () => coordinator().observeSettlement(afterFailure.quote.nonce, {
      kind: "fill",
      transactionHash: `0x${"01".repeat(31)}`,
      blockNumber: 100,
      blockHash: `0x${"02".repeat(32)}`
    }),
    "invalid transaction hash length"
  );
  await assertRejects(
    () => coordinator().reconcile(afterFailure.quote.nonce, {currentBlockNumber: 100, canonicalBlockHash: `0x${"03".repeat(31)}`, now}),
    "invalid canonical hash length"
  );
  const finalizedFill = await coordinator().reconcile(afterFailure.quote.nonce, {currentBlockNumber: 99, canonicalBlockHash: `0x${"34".repeat(32)}`, now});
  assert(finalizedFill.state === "FILLED" && finalizedFill.inventoryLease?.released === true, "canonical block hash permits finality");

  await signerLatencyExpiryAndRevokeSmoke(maker, makerWallet);
  await crashAfterReserveResumeSmoke(maker, makerWallet);
  await duplicateResumePublishesOneQuoteSmoke(maker);
  await staleLockAndCreateRaceSmoke(maker);

  const durableState = JSON.parse(fs.readFileSync(filePath, "utf8"));
  const firstRecord = durableState.records.find((record: any) => record.nonce === first.quote.nonce);
  assert(
    ["RECEIVED", "RESERVED", "SIGNED", "PUBLISHED", "FILL_OBSERVED", "PUBLISHED", "CANCEL_OBSERVED", "CANCELLED"].every((state, index) => firstRecord.stateHistory[index]?.state === state),
    "durable lifecycle records received/reserved/signed/published/observed/reorg/final states"
  );
  const raw = JSON.stringify(durableState);
  assert(!raw.includes("same-key") && !raw.includes("kms://local-test-key"), "durable audit stores hashes not raw idempotency keys or signer refs");
}

async function signerLatencyExpiryAndRevokeSmoke(maker: `0x${string}`, makerWallet: Wallet) {
  let now = 1_700_100_000;
  const expiryPath = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "corner-rfq-expiry-")), "store.json");
  const expiryStore = () => new LocalFileQuoteCoordinatorStore({
    filePath: expiryPath,
    inventory: [{maker, token: TOKEN_OUT, venue: VENUE, available: "50"}]
  });
  const expiryGate = deferred<RFQTypedData>();
  const expiryRelease = deferred<void>();
  const expiring = new RFQQuoteCoordinator({
    chainId: 31337,
    verifyingContract: ADAPTER,
    maker,
    signer: {
      signTypedData: async (typedData: RFQTypedData) => {
        expiryGate.resolve(typedData);
        await expiryRelease.promise;
        return makerWallet.signTypedData(typedData.domain, typedData.types, typedData.message) as Promise<`0x${string}`>;
      }
    },
    pricing: new FixedRatePricingProvider({numerator: 1n, denominator: 1n}),
    riskCheck: new NoopInventoryRiskCheck(),
    store: expiryStore(),
    now: () => now,
    defaultTtlSeconds: 5
  });
  const expiringAttempt = expiring.quote({...durableIntent("latency-expiry"), amountIn: "10", ttlSeconds: 5});
  await expiryGate.promise;
  now += 6;
  expiryRelease.resolve();
  await assertRejects(() => expiringAttempt, "sign latency expiry fail closed");
  const expiredRecord = await expiryStore().getByIdempotencyKeyHash(
    {chainId: 31337, adapter: ADAPTER.toLowerCase() as `0x${string}`, maker: maker.toLowerCase() as `0x${string}`},
    hashCanonical({value: "latency-expiry"})
  );
  assert(expiredRecord?.state === "EXPIRED" && !expiredRecord.signedQuote && expiredRecord.inventoryLease?.released === true, "late signature cannot publish expired reservation");

  now = 1_700_200_000;
  const revokePath = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "corner-rfq-revoke-")), "store.json");
  const revokeStore = () => new LocalFileQuoteCoordinatorStore({
    filePath: revokePath,
    inventory: [{maker, token: TOKEN_OUT, venue: VENUE, available: "50"}]
  });
  const revokeGate = deferred<RFQTypedData>();
  const revokeRelease = deferred<void>();
  const revoking = new RFQQuoteCoordinator({
    chainId: 31337,
    verifyingContract: ADAPTER,
    maker,
    signer: {
      signTypedData: async (typedData: RFQTypedData) => {
        revokeGate.resolve(typedData);
        await revokeRelease.promise;
        return makerWallet.signTypedData(typedData.domain, typedData.types, typedData.message) as Promise<`0x${string}`>;
      }
    },
    pricing: new FixedRatePricingProvider({numerator: 1n, denominator: 1n}),
    riskCheck: new NoopInventoryRiskCheck(),
    store: revokeStore(),
    now: () => now,
    defaultTtlSeconds: 60
  });
  const revokeAttempt = revoking.quote({...durableIntent("latency-revoke"), amountIn: "10"});
  await revokeGate.promise;
  const reserved = await revokeStore().getByIdempotencyKeyHash(
    {chainId: 31337, adapter: ADAPTER.toLowerCase() as `0x${string}`, maker: maker.toLowerCase() as `0x${string}`},
    hashCanonical({value: "latency-revoke"})
  );
  if (!reserved?.nonce) throw new Error("revoke latency test reservation missing nonce");
  await revoking.revoke(reserved.nonce);
  revokeRelease.resolve();
  await assertRejects(() => revokeAttempt, "sign latency revoke fail closed");
  const revokedRecord = await revokeStore().getByIdempotencyKeyHash(
    {chainId: 31337, adapter: ADAPTER.toLowerCase() as `0x${string}`, maker: maker.toLowerCase() as `0x${string}`},
    hashCanonical({value: "latency-revoke"})
  );
  assert(revokedRecord?.state === "REVOKED" && !revokedRecord.signedQuote && revokedRecord.inventoryLease?.released === true, "late signature cannot publish revoked reservation");
}

async function crashAfterReserveResumeSmoke(maker: `0x${string}`, makerWallet: Wallet) {
  const now = 1_700_300_000;
  const filePath = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "corner-rfq-resume-")), "store.json");
  const store = () => new LocalFileQuoteCoordinatorStore({
    filePath,
    inventory: [{maker, token: TOKEN_OUT, venue: VENUE, available: "50"}]
  });
  const quoteIntent = {...durableIntent("crash-resume"), amountIn: "10"};
  const request = {taker: quoteIntent.taker, tokenIn: quoteIntent.tokenIn, tokenOut: quoteIntent.tokenOut, amountIn: quoteIntent.amountIn, venue: quoteIntent.venue, ttlSeconds: quoteIntent.ttlSeconds};
  await store().reserveOrReturnExisting({
    scope: {chainId: 31337, adapter: ADAPTER.toLowerCase() as `0x${string}`, maker: maker.toLowerCase() as `0x${string}`},
    idempotencyKeyHash: hashCanonical({value: "crash-resume"}),
    requestHash: hashCanonical(request),
    request,
    inventoryDelta: {maker: maker.toLowerCase() as `0x${string}`, token: TOKEN_OUT as `0x${string}`, venue: VENUE as `0x${string}`, amount: "10"},
    reservationExpiresAt: now + 60,
    createdAt: now
  });
  const resumed = await new RFQQuoteCoordinator({
    chainId: 31337,
    verifyingContract: ADAPTER,
    maker,
    signer: {signTypedData: (typedData: RFQTypedData) => makerWallet.signTypedData(typedData.domain, typedData.types, typedData.message) as Promise<`0x${string}`>},
    pricing: new FixedRatePricingProvider({numerator: 999n, denominator: 1n}),
    riskCheck: new RejectingRiskCheck(),
    store: store(),
    now: () => now
  }).quote(quoteIntent);
  assert(resumed.quote.nonce === "1" && resumed.quote.amountOut === "10", "crash-after-reserve retry resumes persisted reservation without repricing/risk");
}

async function duplicateResumePublishesOneQuoteSmoke(maker: `0x${string}`) {
  const now = 1_700_400_000;
  const filePath = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "corner-rfq-dup-")), "store.json");
  const store = () => new LocalFileQuoteCoordinatorStore({
    filePath,
    inventory: [{maker, token: TOKEN_OUT, venue: VENUE, available: "50"}]
  });
  const quoteIntent = {...durableIntent("duplicate-resume"), amountIn: "10"};
  const request = {taker: quoteIntent.taker, tokenIn: quoteIntent.tokenIn, tokenOut: quoteIntent.tokenOut, amountIn: quoteIntent.amountIn, venue: quoteIntent.venue, ttlSeconds: quoteIntent.ttlSeconds};
  const scope = {chainId: 31337, adapter: ADAPTER.toLowerCase() as `0x${string}`, maker: maker.toLowerCase() as `0x${string}`};
  await store().reserveOrReturnExisting({
    scope,
    idempotencyKeyHash: hashCanonical({value: "duplicate-resume"}),
    requestHash: hashCanonical(request),
    request,
    inventoryDelta: {maker: maker.toLowerCase() as `0x${string}`, token: TOKEN_OUT as `0x${string}`, venue: VENUE as `0x${string}`, amount: "10"},
    reservationExpiresAt: now + 60,
    createdAt: now
  });
  const firstSigner = {signTypedData: async () => `0x${"11".repeat(65)}` as `0x${string}`};
  const secondSigner = {signTypedData: async () => `0x${"22".repeat(65)}` as `0x${string}`};
  const baseConfig = {
    chainId: 31337,
    verifyingContract: ADAPTER as `0x${string}`,
    maker,
    pricing: new FixedRatePricingProvider({numerator: 1n, denominator: 1n}),
    riskCheck: new NoopInventoryRiskCheck(),
    now: () => now,
    verifySignature: () => {}
  };
  const [a, b] = await Promise.all([
    new RFQQuoteCoordinator({...baseConfig, signer: firstSigner, store: store()}).quote(quoteIntent),
    new RFQQuoteCoordinator({...baseConfig, signer: secondSigner, store: store()}).quote(quoteIntent)
  ]);
  assert(a.signature === b.signature, "duplicate RESERVED retries return the one persisted signed response");
  const state = JSON.parse(fs.readFileSync(filePath, "utf8"));
  const published = state.records[0].stateHistory.filter((entry: any) => entry.state === "PUBLISHED");
  assert(published.length === 1 && state.records[0].signedQuote.signature === a.signature, "store publishes exactly one duplicate retry result");
}

async function staleLockAndCreateRaceSmoke(maker: `0x${string}`) {
  const racePath = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "corner-rfq-race-")), "store.json");
  const modulePath = path.resolve("dist/src/coordinator.js");
  const childCode = `const {LocalFileQuoteCoordinatorStore}=require(${JSON.stringify(modulePath)}); new LocalFileQuoteCoordinatorStore({filePath: process.argv[1], inventory:[{maker:${JSON.stringify(maker)}, token:${JSON.stringify(TOKEN_OUT)}, venue:${JSON.stringify(VENUE)}, available:"10"}]});`;
  const children = await Promise.all([0, 1, 2, 3, 4, 5, 6, 7].map(() => runChild(process.execPath, ["-e", childCode, racePath])));
  const failed = children.filter((child) => child.status !== 0);
  assert(failed.length === 0, `multi-process initial store creation is race-safe: ${failed.map((child) => child.stderr).join(" | ")}`);
  const raceState = JSON.parse(fs.readFileSync(racePath, "utf8"));
  assert(raceState.schemaVersion === 1 && raceState.inventoryByScope[`${maker.toLowerCase()}:${TOKEN_OUT.toLowerCase()}:${VENUE.toLowerCase()}`]?.available === "10", "race-created store is schema and inventory readable");

  const lockPath = `${racePath}.lock`;
  fs.mkdirSync(lockPath);
  const stale = new Date(Date.now() - 10_000);
  fs.utimesSync(lockPath, stale, stale);
  await new LocalFileQuoteCoordinatorStore({
    filePath: racePath,
    staleLockMs: 1,
    inventory: [{maker, token: TOKEN_OUT, venue: VENUE, available: "10"}]
  }).getByIdempotencyKeyHash(
    {chainId: 31337, adapter: ADAPTER.toLowerCase() as `0x${string}`, maker: maker.toLowerCase() as `0x${string}`},
    hashCanonical({value: "missing"})
  );
  assert(!fs.existsSync(lockPath), "stale lock directory is recovered by mtime");
}

function runChild(command: string, args: string[]): Promise<{status: number; stdout: string; stderr: string}> {
  return new Promise((resolve) => {
    const child = childProcess.spawn(command, args, {stdio: ["ignore", "pipe", "pipe"]});
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk: any) => { stdout += chunk.toString(); });
    child.stderr.on("data", (chunk: any) => { stderr += chunk.toString(); });
    child.on("close", (status: number) => resolve({status: status ?? 1, stdout, stderr}));
  });
}

function deferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return {promise, resolve, reject};
}

function durableIntent(idempotencyKey: string) {
  return {
    idempotencyKey,
    taker: TAKER as `0x${string}`,
    tokenIn: TOKEN_IN as `0x${string}`,
    tokenOut: TOKEN_OUT as `0x${string}`,
    amountIn: "1",
    venue: VENUE as `0x${string}`,
    ttlSeconds: 60
  };
}

function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(message);
}

function assertThrows(fn: () => unknown, message: string) {
  try {
    fn();
  } catch {
    return;
  }

  throw new Error(message);
}

async function assertRejects(fn: () => Promise<unknown>, message: string) {
  try {
    await fn();
  } catch {
    return;
  }

  throw new Error(message);
}

function baseRequest(): RFQQuoteRequest {
  return {
    maker: MAKER,
    taker: TAKER as `0x${string}`,
    tokenIn: TOKEN_IN as `0x${string}`,
    tokenOut: TOKEN_OUT as `0x${string}`,
    amountIn: 100n,
    amountOut: 250n,
    venue: VENUE
  };
}

function priceRequest(): RFQPriceRequest {
  return {
    maker: MAKER,
    taker: TAKER as `0x${string}`,
    tokenIn: TOKEN_IN as `0x${string}`,
    tokenOut: TOKEN_OUT as `0x${string}`,
    amountIn: "100",
    venue: VENUE
  };
}

main().catch((err) => {
  console.error(err);
  throw err;
});
