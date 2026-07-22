import {mkdtempSync, writeFileSync} from "fs";
import {request as httpRequest} from "http";
import {tmpdir} from "os";
import {join} from "path";
import {HDNodeWallet, verifyTypedData} from "ethers";

import {RFQ_QUOTE_TYPES} from "../../rfq/src";
import {ANVIL_MNEMONIC, DemoBackendConfig} from "../src/config";
import {startDemoServer} from "../src/server";

const makerWallet = HDNodeWallet.fromPhrase(ANVIL_MNEMONIC, "", "m/44'/60'/0'/0/2");

async function main(): Promise<void> {
  const dir = mkdtempSync(join(tmpdir(), "corner-store-rfq-demo-"));
  const artifactPath = join(dir, "anvil-e2e.json");
  const artifact = {
    investor: "0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65",
    maker: await makerWallet.getAddress(),
    quote: "0x0B306BF915C4d645ff596e518fAf3F9669b97016",
    rfqAdapter: "0x7969c5eD335650692Bc04293B07F5BF2e7A673C0",
    rfqVenue: "0x000000000000000000000000000000000000F00D",
    rwaToken: "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC"
  };
  writeFileSync(artifactPath, JSON.stringify(artifact));

  const config: DemoBackendConfig = {
    host: "127.0.0.1",
    port: 0,
    chainId: 31337,
    rpcUrl: "http://127.0.0.1:8545",
    artifactPath,
    artifact,
    makerWallet,
    defaultTtlSeconds: 3600,
    priceNumerator: "2",
    priceDenominator: "1",
    now: () => 1_700_000_000
  };
  const running = await startDemoServer(config);

  try {
    const health = await requestJson(`${running.baseUrl}/health`, "GET");
    assert(health.status === 200, "health returns 200");
    const healthBody = JSON.parse(health.body) as any;
    assert(healthBody.status === "ok", "health reports ok");

    const quoteResponse = await requestJson(`${running.baseUrl}/rfq/quote`, "POST", {
      taker: artifact.investor,
      amountIn: "100",
      ttlSeconds: 120
    });
    assert(quoteResponse.status === 200, "quote returns 200");
    const signed = JSON.parse(quoteResponse.body) as any;
    assert(signed.quote.amountIn === "100", "amountIn round-trips");
    assert(signed.quote.amountOut === "200", "fixed-rate pricing is applied");
    assert(signed.quote.expiry === 1_700_000_120, "expiry uses injected chain clock");
    assert(signed.quote.tokenIn.toLowerCase() === artifact.quote.toLowerCase(), "tokenIn is deployment QUOTE");
    assert(signed.quote.tokenOut.toLowerCase() === artifact.rwaToken.toLowerCase(), "tokenOut is deployment RWA");
    const recovered = verifyTypedData(signed.typedData.domain, RFQ_QUOTE_TYPES, signed.quote, signed.signature);
    assert(recovered.toLowerCase() === artifact.maker.toLowerCase(), "signature recovers configured maker");

    const secondResponse = await requestJson(`${running.baseUrl}/quote`, "POST", {
      taker: artifact.investor,
      amountIn: "100"
    });
    const second = JSON.parse(secondResponse.body) as any;
    assert(BigInt(second.quote.nonce) > BigInt(signed.quote.nonce), "nonce increases monotonically");

    const badResponse = await requestJson(`${running.baseUrl}/rfq/quote`, "POST", {
      taker: artifact.investor,
      amountIn: 100
    });
    assert(badResponse.status === 400, "unsafe JSON number amount is rejected");
  } finally {
    await running.close();
  }

  console.log("corner-store RFQ demo backend smoke ok");
}

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(`assertion failed: ${message}`);
}

function requestJson(urlValue: string, method: "GET" | "POST", value?: unknown): Promise<{status: number; body: string}> {
  const body = value === undefined ? "" : JSON.stringify(value);
  return new Promise((resolve, reject) => {
    const req = httpRequest(
      urlValue,
      {
        method,
        headers: body
          ? {"content-type": "application/json", "content-length": Buffer.byteLength(body)}
          : undefined
      },
      (res) => {
        const chunks: Buffer[] = [];
        res.on("data", (chunk) => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
        res.on("end", () => resolve({status: res.statusCode ?? 0, body: Buffer.concat(chunks).toString("utf8")}));
      }
    );
    req.on("error", reject);
    req.end(body);
  });
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
