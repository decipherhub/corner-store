import {readFileSync, writeFileSync} from "fs";
import {request as httpRequest} from "http";
import {request as httpsRequest} from "https";
import {AbiCoder} from "ethers";

// REUSE the services/rfq EIP-712 signer library (do NOT reimplement the typed
// data). Resolved at runtime from the sibling package's compiled output.
import {RFQ_QUOTE_TYPES, RFQQuoteService, domain as rfqDomain} from "../../rfq/src";
import {RFQQuote, RFQTypedData, SignedRFQQuote, TypedDataSigner} from "../../rfq/src/types";

// Adapt an ethers wallet to the services/rfq TypedDataSigner interface.
export class WalletTypedDataSigner implements TypedDataSigner {
  constructor(private readonly wallet: {signTypedData: (d: any, t: any, v: any) => Promise<string>}) {}

  async signTypedData(typedData: RFQTypedData): Promise<`0x${string}`> {
    const sig = await this.wallet.signTypedData(typedData.domain, typedData.types, typedData.message);
    return sig as `0x${string}`;
  }
}

export interface QuoteFile {
  quote: RFQQuote;
  signature: string;
  typedData: RFQTypedData;
}

export function writeQuoteFile(path: string, signed: SignedRFQQuote): void {
  writeFileSync(path, `${JSON.stringify(signed, null, 2)}\n`);
}

export function readQuoteFile(path: string): QuoteFile {
  return JSON.parse(readFileSync(path, "utf8")) as QuoteFile;
}

export async function requestBackendQuote(
  backendUrl: string,
  request: {taker: string; amountIn: string; ttlSeconds?: number}
): Promise<SignedRFQQuote> {
  const url = `${backendUrl.replace(/\/$/, "")}/rfq/quote`;
  let response: {status: number; body: string};
  try {
    response = await postJson(url, request);
  } catch (error) {
    throw new Error(`RFQ backend request failed (${url}): ${error instanceof Error ? error.message : error}`);
  }

  let body: any;
  try {
    body = JSON.parse(response.body);
  } catch {
    throw new Error(`RFQ backend returned non-JSON response (${response.status})`);
  }
  if (response.status < 200 || response.status >= 300) {
    throw new Error(`RFQ backend rejected the request (${response.status}): ${body.message ?? body.error ?? "unknown error"}`);
  }
  if (!body || typeof body !== "object" || !body.quote || !body.signature || !body.typedData) {
    throw new Error("RFQ backend response is missing quote, signature, or typedData");
  }
  return body as SignedRFQQuote;
}

function postJson(urlValue: string, value: unknown): Promise<{status: number; body: string}> {
  const url = new URL(urlValue);
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error(`unsupported backend protocol ${url.protocol}`);
  }
  const body = JSON.stringify(value);
  const requestFn = url.protocol === "https:" ? httpsRequest : httpRequest;

  return new Promise((resolve, reject) => {
    const req = requestFn(
      url,
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "content-length": Buffer.byteLength(body)
        },
        timeout: 10_000
      },
      (res) => {
        const chunks: Buffer[] = [];
        res.on("data", (chunk) => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
        res.on("end", () => resolve({status: res.statusCode ?? 0, body: Buffer.concat(chunks).toString("utf8")}));
      }
    );
    req.on("timeout", () => req.destroy(new Error("request timed out after 10 seconds")));
    req.on("error", reject);
    req.end(body);
  });
}

const coder = AbiCoder.defaultAbiCoder();
const RFQ_QUOTE_TUPLE =
  "tuple(address maker,address taker,address tokenIn,address tokenOut,uint256 amountIn,uint256 amountOut,address venue,uint256 nonce,uint64 expiry)";

// ABI-encode (RFQQuote, signature) exactly as RFQAdapter.execute decodes it.
export function encodeVenueData(quote: RFQQuote, signature: string): string {
  return coder.encode(
    [RFQ_QUOTE_TUPLE, "bytes"],
    [
      [
        quote.maker,
        quote.taker,
        quote.tokenIn,
        quote.tokenOut,
        quote.amountIn,
        quote.amountOut,
        quote.venue,
        quote.nonce,
        quote.expiry
      ],
      signature
    ]
  );
}

// Re-export the lib's EIP-712 domain builder + type set so `quote-inspect` can
// recover the signer with ethers.verifyTypedData WITHOUT re-declaring the types.
export {RFQ_QUOTE_TYPES, RFQQuoteService, rfqDomain};
export type {RFQQuote, RFQTypedData, SignedRFQQuote};
