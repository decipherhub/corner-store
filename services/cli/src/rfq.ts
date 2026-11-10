import {readFileSync, writeFileSync} from "fs";
import {request as httpRequest} from "http";
import {request as httpsRequest} from "https";
import {AbiCoder, TypedDataEncoder} from "ethers";

// REUSE the services/rfq EIP-712 signer library (do NOT reimplement the typed
// data). Resolved at runtime from the sibling package's compiled output.
import {RFQ_QUOTE_TYPES, RFQ_QUOTE_V3_TYPES, RFQQuoteService, domain as rfqDomain, domainV3, normalizeAddress, normalizeBytes32, normalizeFlowType, validateRFQQuoteV3, toPositiveUintString, toUintString} from "../../rfq/src";
import {RFQQuote, RFQQuoteV3, RFQTypedData, RFQTypedDataV3, SignedRFQQuote, SignedRFQQuoteV3, TypedDataSigner} from "../../rfq/src/types";

// Adapt an ethers wallet to the services/rfq TypedDataSigner interface.
export class WalletTypedDataSigner implements TypedDataSigner {
  constructor(private readonly wallet: {signTypedData: (d: any, t: any, v: any) => Promise<string>}) {}

  async signTypedData(typedData: RFQTypedData | RFQTypedDataV3): Promise<`0x${string}`> {
    const sig = await this.wallet.signTypedData(typedData.domain, typedData.types, typedData.message);
    return sig as `0x${string}`;
  }
}

export type QuoteFile = SignedRFQQuote | SignedRFQQuoteV3;

export function writeQuoteFile(path: string, signed: QuoteFile): void {
  writeFileSync(path, `${JSON.stringify(signed, null, 2)}\n`);
}

export function readQuoteFile(path: string): QuoteFile {
  return parseQuoteFile(JSON.parse(readFileSync(path, "utf8")));
}

export function isV3QuoteFile(value: QuoteFile): value is SignedRFQQuoteV3 {
  return value.typedData.primaryType === "RFQQuoteV3";
}

export function parseQuoteFile(value: unknown, expectedVersion?: 2 | 3): QuoteFile {
  const v = value as QuoteFile;
  if (!v?.quote || !v?.typedData || typeof v.signature !== "string" || !/^0x(?:[0-9a-fA-F]{2})+$/.test(v.signature)) throw new Error("invalid signed quote file");
  const version = v.typedData.domain?.version;
  if ((version !== "2" && version !== "3") || (expectedVersion && String(expectedVersion) !== version)) throw new Error("quote domain version mismatch");
  const v3 = version === "3";
  const types = v3 ? RFQ_QUOTE_V3_TYPES : RFQ_QUOTE_TYPES;
  const primary = v3 ? "RFQQuoteV3" : "RFQQuote";
  if (v.typedData.primaryType !== primary || JSON.stringify(v.typedData.types) !== JSON.stringify(types)) throw new Error("quote typed-data schema mismatch");
  const d = v.typedData.domain;
  if (d.name !== "CornerStoreRFQ" || !Number.isSafeInteger(d.chainId) || d.chainId <= 0) throw new Error("invalid quote domain");
  normalizeAddress(d.verifyingContract, "verifyingContract");
  const q = v.quote;
  for (const key of ["maker", "taker", "tokenIn", "tokenOut", "venue"] as const) normalizeAddress(q[key], key);
  normalizeBytes32(q.policyId, "policyId");
  for (const key of ["amountIn", "amountOut"] as const) toPositiveUintString(q[key], key);
  toUintString(q.nonce, "nonce");
  if (!Number.isSafeInteger(q.expiry) || q.expiry < 0) throw new Error("invalid quote expiry");
  if (v3) {
    const quote = q as RFQQuoteV3;
    validateRFQQuoteV3(quote);
    normalizeBytes32(quote.affiliateEvidenceHash, "affiliateEvidenceHash");
    if (quote.tokenIn.toLowerCase() === quote.tokenOut.toLowerCase()) throw new Error("identical quote token pair");
  } else if ("flowType" in q || "affiliateEvidenceHash" in q) throw new Error("v3 fields require domain version 3");
  if (TypedDataEncoder.hash(d, types, q) !== TypedDataEncoder.hash(d, types, v.typedData.message)) throw new Error("quote and typed-data message disagree");
  return v;
}

export function encodeVenueDataV3(quote: RFQQuoteV3, signature: string): string {
  const fields = RFQ_QUOTE_V3_TYPES.RFQQuoteV3;
  return coder.encode([`tuple(${fields.map((f) => `${f.type} ${f.name}`).join(",")})`, "bytes"], [fields.map((f) => quote[f.name]), signature]);
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

function postJson(urlValue: string, value: unknown, bearerToken?: string): Promise<{status: number; body: string}> {
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
          ...(bearerToken ? {authorization: `Bearer ${bearerToken}`} : {}),
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
  "tuple(address maker,address taker,address tokenIn,address tokenOut,uint256 amountIn,uint256 amountOut,address venue,bytes32 policyId,uint256 nonce,uint64 expiry)";

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
        quote.policyId,
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
export type {RFQQuote, RFQQuoteV3, RFQTypedData, SignedRFQQuote, SignedRFQQuoteV3};

export async function requestBackendQuoteV3(backendUrl: string, request: unknown, bearerToken?: string): Promise<SignedRFQQuoteV3> {
  const response = await postJson(`${backendUrl.replace(/\/$/, "")}/rfq/v3/quote`, request, bearerToken);
  if (response.status < 200 || response.status >= 300) throw new Error(`RFQ v3 backend rejected request (${response.status})`);
  return parseQuoteFile(JSON.parse(response.body), 3) as SignedRFQQuoteV3;
}
