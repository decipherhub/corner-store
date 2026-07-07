import {readFileSync, writeFileSync} from "fs";
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
