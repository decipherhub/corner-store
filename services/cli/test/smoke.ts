import {mkdtempSync} from "fs";
import {tmpdir} from "os";
import {join} from "path";
import {Wallet, verifyTypedData} from "ethers";

import {decodeReason, encodeReason, tableSize} from "../src/reason";
import {
  RFQ_QUOTE_TYPES,
  RFQQuoteService,
  WalletTypedDataSigner,
  encodeVenueData,
  readQuoteFile,
  rfqDomain,
  writeQuoteFile
} from "../src/rfq";

const CHAIN_ID = 31337;
const RFQ_VERIFYING_CONTRACT = "0x7969c5eD335650692Bc04293B07F5BF2e7A673C0";

// Mirror of cmdQuoteInspect's signer recovery (reuses the rfq lib domain+types).
function recoverMaker(quote: any, signature: string): {recovered: string; ok: boolean} {
  const dom = rfqDomain(CHAIN_ID, RFQ_VERIFYING_CONTRACT as `0x${string}`);
  try {
    const recovered = verifyTypedData(dom, RFQ_QUOTE_TYPES, quote, signature);
    return {recovered, ok: recovered.toLowerCase() === quote.maker.toLowerCase()};
  } catch {
    return {recovered: "", ok: false};
  }
}

// Ground-truth reason codes computed independently with `cast keccak` against the
// on-chain ReasonCodes.encode / ComplianceEngine encoding.
const A02_RECIPE1 = "0xdf005707ef0d1c9c5675600e45928090b03a3d8ea92af2d691132565e834e7c0";
const POLICY_SUSPENDED = "0x6c918c291dab5574048c8f619004a9721b8ac1b978c93e69f239e614a34d5e4f";
const A01_RECIPE7 = "0x4ec564787cbeb03d100cec07278646352648e18a22c4b6e3a8549fa92f376f46";

async function main() {
  // --- reason table -------------------------------------------------------
  assert(encodeReason(1, "A-02-v1", 1) === A02_RECIPE1, "encode matches cast (A-02 recipe 1)");
  assert(encodeReason(0, "POLICY", 3) === POLICY_SUSPENDED, "encode matches cast (POLICY suspended)");
  assert(encodeReason(7, "A-01-v1", 1) === A01_RECIPE7, "encode matches cast (A-01 recipe 7)");

  // table = 3 recipes x 11 elements + 6 policy statuses.
  assert(tableSize() === 3 * 11 + 6, "reason table size");

  const jur = decodeReason(A02_RECIPE1);
  assert(jur.label.includes("Jurisdiction") && jur.label.includes("A-02-v1"), "decodes A-02 to Jurisdiction");
  const pol = decodeReason(POLICY_SUSPENDED);
  assert(pol.label.includes("SUSPENDED"), "decodes policy suspended");
  // case-insensitive input.
  assert(decodeReason(A02_RECIPE1.toUpperCase()).label === jur.label, "upper-case input decodes");
  assert(decodeReason("0x" + "de".repeat(32)).label === "unknown code", "unknown code");

  // --- quote-file round-trip ---------------------------------------------
  const maker = new Wallet("0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d");
  const service = new RFQQuoteService(
    {chainId: CHAIN_ID, verifyingContract: RFQ_VERIFYING_CONTRACT as `0x${string}`, defaultTtlSeconds: 3600},
    new WalletTypedDataSigner(maker)
  );
  const signed = await service.createSignedQuote({
    maker: (await maker.getAddress()) as `0x${string}`,
    taker: "0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65",
    tokenIn: "0x0B306BF915C4d645ff596e518fAf3F9669b97016",
    tokenOut: "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC",
    amountIn: "120000000000000000000",
    amountOut: "200000000000000000000",
    venue: "0x000000000000000000000000000000000000F00D",
    ttlSeconds: 3600
  });
  assert(signed.signature.length === 132, "65-byte signature");

  const dir = mkdtempSync(join(tmpdir(), "corner-store-cli-"));
  const file = join(dir, "quote.json");
  writeQuoteFile(file, signed);
  const round = readQuoteFile(file);
  assert(round.quote.maker === signed.quote.maker, "quote maker round-trips");
  assert(round.quote.amountIn === signed.quote.amountIn, "amountIn round-trips");
  assert(round.signature === signed.signature, "signature round-trips");

  const venueData = encodeVenueData(round.quote, round.signature);
  assert(venueData.startsWith("0x") && venueData.length > 200, "venueData encodes");

  // --- quote-inspect signer recovery (valid + tampered) -------------------
  const valid = recoverMaker(round.quote, round.signature);
  assert(valid.ok, "quote-inspect recovers the maker from a valid signature");
  assert(valid.recovered.toLowerCase() === (await maker.getAddress()).toLowerCase(), "recovered == maker");

  // Flip one hex nibble inside r; recovery yields a different address (or throws).
  const tamperedSig = `${round.signature.slice(0, 10)}${round.signature[10] === "0" ? "1" : "0"}${round.signature.slice(11)}`;
  assert(tamperedSig !== round.signature, "tampered signature differs");
  const tampered = recoverMaker(round.quote, tamperedSig);
  assert(!tampered.ok, "quote-inspect FAILs a tampered signature");

  // --- reason-decode regression: the recipe-aware per-element code `check`
  //     reports for a failed element must resolve in the reason table. --------
  assert(
    decodeReason(encodeReason(1, "A-02-v1", 1)).label.includes("Jurisdiction"),
    "check per-element reason decodes (recipe 1 / A-02-v1 -> Jurisdiction)"
  );

  console.log("corner-store CLI smoke ok");
}

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(`assertion failed: ${msg}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
