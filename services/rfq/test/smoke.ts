import {RFQ_DOMAIN_NAME, RFQ_DOMAIN_VERSION, RFQQuoteService} from "../src";
import {RFQQuoteRequest, RFQTypedData, TypedDataSigner} from "../src/types";

const MAKER = "0x1000000000000000000000000000000000000001";
const TAKER = "0x2000000000000000000000000000000000000002";
const TOKEN_IN = "0x3000000000000000000000000000000000000003";
const TOKEN_OUT = "0x4000000000000000000000000000000000000004";
const VENUE = "0x5000000000000000000000000000000000000005";
const ADAPTER = "0x6000000000000000000000000000000000000006";

class CaptureSigner implements TypedDataSigner {
  public lastTypedData?: RFQTypedData;

  async signTypedData(typedData: RFQTypedData): Promise<`0x${string}`> {
    this.lastTypedData = typedData;
    return `0x${"11".repeat(65)}`;
  }
}

async function main() {
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

  const defaultNonceService = new RFQQuoteService({chainId: 31337, verifyingContract: ADAPTER, now: () => 1}, signer);
  const firstNonce = BigInt(defaultNonceService.createQuote(baseRequest()).nonce);
  const secondNonce = BigInt(defaultNonceService.createQuote(baseRequest()).nonce);
  assert(secondNonce > firstNonce, "default nonce is monotonic");

  console.log("RFQ service smoke ok");
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

main().catch((err) => {
  console.error(err);
  throw err;
});
