import assert from "node:assert/strict";
import {test} from "node:test";
import {mkdtempSync, writeFileSync} from "node:fs";
import {tmpdir} from "node:os";
import {join} from "node:path";
import {AbiCoder, keccak256, Wallet, toUtf8Bytes} from "ethers";
import {RFQQuoteServiceV3, RFQQuoteService} from "../../rfq/src";
import {parseQuoteFile, readQuoteFile, encodeVenueDataV3, encodeVenueData} from "../src/rfq";
import {execFileSync} from "node:child_process";
const addr = (n: number) => `0x${n.toString(16).padStart(40, "0")}` as `0x${string}`;
const hash = (s: string) => keccak256(toUtf8Bytes(s)) as `0x${string}`;
const wallet = new Wallet(hash("cli fixture"));
const signer = {signTypedData: async (d: any) => wallet.signTypedData(d.domain, d.types, d.message) as Promise<`0x${string}`>};
async function quote() {return new RFQQuoteServiceV3({chainId: 31337, verifyingContract: addr(6), now: () => 100, nextNonce: () => 42n}, signer).createSignedQuote({maker: wallet.address as `0x${string}`, taker: addr(2), tokenIn: addr(3), tokenOut: addr(4), amountIn: "10", amountOut: "20", venue: addr(5), policyId: hash("policy"), flowType: 1, affiliateEvidenceHash: hash("claim")});}

test("quote files parse v3 explicitly and encode the exact new tuple", async () => {
  const signed = await quote();
  const dir = mkdtempSync(join(tmpdir(), "cli-v3-")); const file = join(dir, "quote.json");
  writeFileSync(file, JSON.stringify(signed));
  assert.deepEqual(readQuoteFile(file), signed);
  assert.deepEqual(parseQuoteFile(signed, 3), signed);
  assert.throws(() => parseQuoteFile(signed, 2), /version/i);
  const encoded = encodeVenueDataV3(signed.quote, signed.signature);
  const tuple = "tuple(address maker,address taker,address tokenIn,address tokenOut,uint256 amountIn,uint256 amountOut,address venue,bytes32 policyId,uint8 flowType,bytes32 affiliateEvidenceHash,uint256 nonce,uint64 expiry)";
  const decoded = AbiCoder.defaultAbiCoder().decode([tuple, "bytes"], encoded);
  assert.equal(Number(decoded[0].flowType), 1);
  assert.equal(decoded[0].affiliateEvidenceHash, hash("claim"));
  assert.equal(decoded[0].nonce, 42n);
  assert.notEqual(encoded, encodeVenueData(signed.quote, signed.signature));
});

test("quote parser rejects cross-version types, message disagreement and malformed fields", async () => {
  const signed = await quote();
  for (const mutate of [(v: any) => v.typedData.domain.version = "2", (v: any) => v.typedData.primaryType = "RFQQuote", (v: any) => v.typedData.message.flowType = 0, (v: any) => v.quote.flowType = 2, (v: any) => delete v.quote.affiliateEvidenceHash, (v: any) => v.typedData.types.RFQQuoteV3.reverse(), (v: any) => v.quote.nonce = "-1", (v: any) => v.signature = "0xz"] ) {
    const value = JSON.parse(JSON.stringify(signed)); mutate(value); assert.throws(() => parseQuoteFile(value));
  }
});

test("legacy file format and tuple remain accepted", async () => {
  const v3 = await quote(); const {flowType, affiliateEvidenceHash, ...request} = v3.quote;
  const v2 = await new RFQQuoteService({chainId: 31337, verifyingContract: addr(6), now: () => 100}, signer).createSignedQuote(request);
  assert.deepEqual(parseQuoteFile(v2, 2), v2);
  assert.throws(() => parseQuoteFile(v2, 3));
});

test("CLI exposes opt-in v3 command without changing legacy defaults", () => {
  const cli = join(__dirname, "../src/index.js");
  assert.match(execFileSync(process.execPath, [cli, "rfq-v3-quote", "--help"], {encoding: "utf8"}), /--request/);
  assert.match(execFileSync(process.execPath, [cli, "rfq-quote", "--help"], {encoding: "utf8"}), /--maker-account/);
});

test("v3 CLI refuses mismatched registry data before any approval or settlement", async () => {
  const {createServer} = await import("node:http");
  const {execFile} = await import("node:child_process");
  const {promisify} = await import("node:util");
  const {Interface} = await import("ethers");
  const token = new Interface(["function balanceOf(address) view returns (uint256)"]);
  const status = new Interface(["function usedQuoteNonce(address,uint256) view returns (bool)", "function approvedMaker(address) view returns (bool)", "function makerAuthorizer() view returns (address)", "function isAuthorizedSigner(address,bytes32,bytes) view returns (bool)", "function authorizerVersion() view returns (uint64)"]);
  const registry = new Interface(["function venueOf(address) view returns (tuple(uint8 venueType,address adapter,address target,address operator,uint8 custody,bool active))"]);
  let writes = 0;
  const rpc = createServer((req, res) => {
    let raw = ""; req.on("data", (b) => {raw += b;}); req.on("end", () => {
      const batch = JSON.parse(raw);
      function answer(q: any) {
        let result: unknown;
        if (q.method === "eth_chainId") result = "0x7a69";
        else if (q.method === "eth_blockNumber") result = "0xa";
        else if (q.method === "eth_getBlockByNumber") result = {hash: hash("block"), parentHash: hash("parent"), number: "0xa", timestamp: "0x64", nonce: "0x0000000000000000", difficulty: "0x0", gasLimit: "0x1000000", gasUsed: "0x0", miner: addr(1), extraData: "0x", transactions: [], baseFeePerGas: "0x1"};
        else if (q.method === "eth_call") {
          const data = q.params[0].data;
          if (data.startsWith(token.getFunction("balanceOf")!.selector)) result = token.encodeFunctionResult("balanceOf", [0]);
          else if (data.startsWith(registry.getFunction("venueOf")!.selector)) result = registry.encodeFunctionResult("venueOf", [[2, addr(99), addr(20), addr(21), 0, true]]);
          else {
            const parsed = status.parseTransaction({data});
            if (!parsed) throw new Error("unexpected call");
            const values: Record<string, any> = {usedQuoteNonce: false, approvedMaker: true, makerAuthorizer: addr(13), isAuthorizedSigner: true, authorizerVersion: 1};
            result = status.encodeFunctionResult(parsed.name, [values[parsed.name]]);
          }
        } else {writes++; result = "0x";}
        return {jsonrpc: "2.0", id: q.id, result};
      }
      res.setHeader("content-type", "application/json"); res.end(JSON.stringify(Array.isArray(batch) ? batch.map(answer) : answer(batch)));
    });
  });
  await new Promise<void>((resolve) => rpc.listen(0, "127.0.0.1", resolve));
  const {walletForAccount} = await import("../src/config");
  const caller = walletForAccount(1).address as `0x${string}`;
  const signed = await quote(); signed.quote.taker = caller; signed.typedData.message.taker = caller;
  signed.signature = await signer.signTypedData(signed.typedData);
  const dir = mkdtempSync(join(tmpdir(), "cli-v3-rpc-")); const file = join(dir, "quote.json"); const artifact = join(dir, "deployment.json");
  writeFileSync(file, JSON.stringify(signed));
  writeFileSync(artifact, JSON.stringify({router: addr(30), rfqAdapter: addr(31), routerV2: addr(7), rfqV3Adapter: addr(6), rfqV3Venue: addr(5), affiliateSource: addr(8), venueReg: addr(11), policyReg: addr(12), rwaToken: addr(4), quote: addr(3)}));
  try {
    const address = rpc.address() as {port: number};
    await assert.rejects(() => promisify(execFile)(process.execPath, [join(__dirname, "../src/index.js"), "--rpc", `http://127.0.0.1:${address.port}`, "--artifact", artifact, "buy", "0", "--venue", "rfq", "--quote", file]), (error: any) => /context venue mismatch/.test(error.stderr));
    assert.equal(writes, 0);
    const inspect = await promisify(execFile)(process.execPath, [join(__dirname, "../src/index.js"), "--rpc", `http://127.0.0.1:${address.port}`, "--artifact", artifact, "quote-inspect", file, "--json"]).then(() => {throw new Error("mismatched context inspection unexpectedly succeeded");}, (error: any) => JSON.parse(error.stdout));
    assert.equal(inspect.verifyingContract, addr(6));
  } finally {await new Promise<void>((resolve, reject) => rpc.close((e) => e ? reject(e) : resolve()));}
});
