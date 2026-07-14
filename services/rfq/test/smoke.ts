import {
  createRFQService,
  FixedRatePricingProvider,
  InMemoryNonceStore,
  NoopInventoryRiskCheck,
  RFQ_DOMAIN_NAME,
  RFQ_DOMAIN_VERSION,
  RFQQuoteService
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
