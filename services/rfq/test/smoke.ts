import {Wallet} from "ethers";

import {
  createRFQService,
  assertRFQModuleConformance,
  FixedRatePricingProvider,
  InMemoryNonceStore,
  NoopInventoryRiskCheck,
  nonceModule,
  pricingModule,
  RFQ_DOMAIN_NAME,
  RFQ_DOMAIN_VERSION,
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
    taker: TAKER,
    tokenIn: TOKEN_IN,
    tokenOut: TOKEN_OUT,
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
    taker: TAKER,
    tokenIn: TOKEN_IN,
    tokenOut: TOKEN_OUT,
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
    taker: TAKER,
    tokenIn: TOKEN_IN,
    tokenOut: TOKEN_OUT,
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
    venue: VENUE,
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
    taker: TAKER,
    tokenIn: TOKEN_IN,
    tokenOut: TOKEN_OUT,
    amountIn: 100n,
    amountOut: 250n,
    venue: VENUE
  };
}

function priceRequest(): RFQPriceRequest {
  return {
    maker: MAKER,
    taker: TAKER,
    tokenIn: TOKEN_IN,
    tokenOut: TOKEN_OUT,
    amountIn: "100",
    venue: VENUE
  };
}

main().catch((err) => {
  console.error(err);
  throw err;
});
