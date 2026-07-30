import {mkdtempSync, writeFileSync} from "fs";
import {request as httpRequest} from "http";
import {tmpdir} from "os";
import {join} from "path";
import {HDNodeWallet, keccak256, toUtf8Bytes, verifyTypedData} from "ethers";

import {RFQ_QUOTE_TYPES} from "../../rfq/src";
import {ANVIL_MNEMONIC, DemoBackendConfig, loadConfig} from "../src/config";
import {startDemoServer} from "../src/server";
import {createDemoPricing} from "../src/service";

const makerWallet = HDNodeWallet.fromPhrase(ANVIL_MNEMONIC, "", "m/44'/60'/0'/0/2");

async function main(): Promise<void> {
  const dir = mkdtempSync(join(tmpdir(), "corner-store-rfq-demo-"));
  const artifactPath = join(dir, "anvil-e2e.json");
  const artifact = {
    assetProfile: "buidl-like" as const,
    scenarioSchemaVersion: 2,
    scenarioHash: "",
    deployer: "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266",
    investor: "0x70997970C51812dc3A010C7d01b50e0d17dc79C8",
    eligibleInvestorB: "0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65",
    ineligibleInvestor: "0x9965507D1a55bcC2695C58ba16FB37d819B0A4dc",
    maker: await makerWallet.getAddress(),
    makerAuthorizer: "0x0000000000000000000000000000000000000008",
    quote: "0x0B306BF915C4d645ff596e518fAf3F9669b97016",
    rfqAdapter: "0x7969c5eD335650692Bc04293B07F5BF2e7A673C0",
    rfqVenue: "0x000000000000000000000000000000000000F00D",
    rwaToken: "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC",
    router: "0x5FbDB2315678afecb367f032d93F642f64180aa3"
  };
  const scenario = {
    schemaVersion: 2 as const,
    deployment: {
      accounts: {
        deployer: 0,
        investor: 1,
        maker: 2,
        unapprovedMaker: 3,
        eligibleInvestorB: 4,
        ineligibleInvestor: 5
      },
      initialBalancesBaseUnits: {
        investorQuote: "1000",
        investorRwa: "500",
        makerQuote: "2000",
        makerRwa: "1000",
        poolRwa: "3000"
      }
    },
    execution: {
      pricing: {
        provider: "trade-impact-mock" as const,
        numerator: "3",
        denominator: "2",
        impactBpsPerFill: 100
      },
      defaultBuyAmountBaseUnits: "100",
      defaultSellAmountBaseUnits: "80",
      minimumTradeBufferBps: 50,
      defaultQuoteTtlSeconds: 600
    },
    asset: {
      name: "Injected Asset",
      symbol: "IA",
      minimumAmountBaseUnits: "66",
      decimals: 18
    },
    quoteAsset: {
      name: "Injected Settlement Asset",
      symbol: "iUSD",
      decimals: 18
    },
    maker: {label: "Injected Maker"},
    wallets: [
      {
        id: "investor",
        label: "Injected Investor",
        account: 1,
        artifactKey: "investor" as const,
        initialQualifiedPurchaser: true
      },
      {
        id: "investor-b",
        label: "Injected Investor B",
        account: 4,
        artifactKey: "eligibleInvestorB" as const,
        initialQualifiedPurchaser: true
      },
      {
        id: "blocked-investor",
        label: "Injected Ineligible Investor",
        account: 5,
        artifactKey: "ineligibleInvestor" as const,
        initialQualifiedPurchaser: false
      }
    ],
    previewQuotes: [],
    marketHistory: {
      intervalSeconds: 3600,
      sampleIntervalSeconds: 300,
      indicativeSpreadBps: 20,
      oraclePrices: ["1.47", "1.48", "1.49", "1.50"],
      indicativeMidPrices: ["1.48", "1.49", "1.50", "1.50"]
    },
    temporalEligibility: {
      walletId: "investor",
      baselineFreshnessSeconds: 31_536_000,
      freshnessSeconds: 60,
      advanceSeconds: 61,
      quoteTtlSeconds: 900
    }
  };
  const scenarioPath = join(dir, "scenario.json");
  const scenarioJson = JSON.stringify(scenario);
  artifact.scenarioHash = keccak256(toUtf8Bytes(scenarioJson));
  writeFileSync(scenarioPath, scenarioJson);
  writeFileSync(artifactPath, JSON.stringify(artifact));
  const loaded = loadConfig([
    "--artifact", artifactPath,
    "--scenario", scenarioPath
  ], {});
  assert(loaded.scenario.asset.name === "Injected Asset", "scenario data is loaded from the injected file");
  assert(loaded.scenario.wallets[0].label === "Injected Investor", "scenario wallet is not embedded in application code");
  assert(loaded.scenario.quoteAsset.symbol === "iUSD", "settlement asset presentation is injected");
  assert(loaded.defaultTtlSeconds === 600, "quote TTL comes from the injected scenario");
  assert(loaded.priceNumerator === "3" && loaded.priceDenominator === "2", "pricing comes from the injected scenario");
  assert(loaded.scenario.deployment.initialBalancesBaseUnits.makerRwa === "1000", "inventory comes from the injected scenario");
  assertThrows(
    () => loadConfig(["--artifact", artifactPath, "--scenario", scenarioPath, "--price-numerator", "2"], {}),
    "deployment-bound pricing cannot be overridden independently"
  );
  assertThrows(
    () => loadConfig(["--artifact", artifactPath, "--scenario", scenarioPath], {RFQ_DEMO_TTL_SECONDS: "900"}),
    "deployment-bound TTL cannot be overridden independently"
  );
  assertThrows(
    () => loadConfig(["--artifact", artifactPath, "--scenario", join(dir, "missing.json")], {}),
    "explicit missing scenario is rejected instead of falling back"
  );
  const mismatchedScenarioPath = join(dir, "mismatched-scenario.json");
  writeFileSync(mismatchedScenarioPath, JSON.stringify({...scenario, maker: {label: "Different Maker"}}));
  assertThrows(
    () => loadConfig(["--artifact", artifactPath, "--scenario", mismatchedScenarioPath], {}),
    "scenario content must match the data bound into the deployment artifact"
  );

  const config: DemoBackendConfig = {
    ...loaded,
    port: 0,
    now: () => 1_700_000_000
  };
  const market = createDemoPricing(config);
  assert(market.amountOut(100n, "sell") === 150n, "initial market price applies the injected ratio");
  assert(
    market.suggestedTradeAmounts().buyAmountIn === "101",
    "suggested buy amount rounds up the current-price minimum with the injected buffer"
  );
  market.recordFill("buy");
  assert(market.state().numerator === "303", "successful buy raises the mock market price");
  assert(
    market.suggestedTradeAmounts().buyAmountIn === "102",
    "suggested buy amount follows the raised runtime price"
  );
  assert(market.amountOut(100n, "sell") === 151n, "next sell quote uses the raised market price");
  market.recordFill("sell");
  assert(market.state().lastMove === "sell-down", "successful sell lowers the mock market price");
  market.reset();
  assert(market.state().numerator === "3" && market.state().denominator === "2", "demo setup resets market price");
  assert(
    market.history(1_700_000_000).oracle.length === 37,
    "history interpolates injected anchors at the configured sample interval"
  );
  const running = await startDemoServer(config);

  try {
    const health = await requestJson(`${running.baseUrl}/health`, "GET", undefined, {origin: "http://127.0.0.1:8790"});
    assert(health.status === 200, "health returns 200");
    assert(health.headers["access-control-allow-origin"] === "http://127.0.0.1:8790", "dashboard-only CORS is enabled for the local demo");
    const healthBody = JSON.parse(health.body) as any;
    assert(healthBody.status === "ok", "health reports ok");
    assert(healthBody.demoSettlementEnabled === false, "settlement is opt-in");
    assert(healthBody.taker.toLowerCase() === artifact.investor.toLowerCase(), "health exposes the canonical demo taker");

    const disabledTrade = await requestJson(`${running.baseUrl}/demo/trade`, "POST", {amountIn: "100", action: "settle"});
    assert(disabledTrade.status === 403, "settlement endpoint is unavailable outside the local runner");
    const disabledState = await requestJson(`${running.baseUrl}/demo/state`, "GET");
    assert(disabledState.status === 403, "demo state is unavailable outside the local runner");
    const disabledMarket = await requestJson(`${running.baseUrl}/demo/market-history`, "GET");
    assert(disabledMarket.status === 403, "market history is unavailable outside the local runner");
    const disabledSetup = await requestJson(`${running.baseUrl}/demo/setup`, "POST", {});
    assert(disabledSetup.status === 403, "demo setup is unavailable outside the local runner");
    const disabledRestore = await requestJson(`${running.baseUrl}/demo/restore`, "POST", {});
    assert(disabledRestore.status === 403, "demo restore is unavailable outside the local runner");
    const disabledBoundaryEvidence = await requestJson(`${running.baseUrl}/demo/enforcement/adapter-boundary`, "POST", {});
    assert(disabledBoundaryEvidence.status === 403, "adapter-boundary evidence is unavailable outside the local runner");
    const disabledEnforcementRestore = await requestJson(`${running.baseUrl}/demo/enforcement/restore`, "POST", {kind: "maker-revocation"});
    assert(disabledEnforcementRestore.status === 403, "enforcement restore is unavailable outside the local runner");

    const quoteResponse = await requestJson(`${running.baseUrl}/rfq/quote`, "POST", {
      taker: artifact.investor,
      amountIn: "100",
      ttlSeconds: 120
    });
    assert(quoteResponse.status === 200, "quote returns 200");
    const signed = JSON.parse(quoteResponse.body) as any;
    assert(signed.quote.amountIn === "100", "amountIn round-trips");
    assert(signed.quote.amountOut === "66", "buy quote inverts the injected qUSD-per-RWA price");
    assert(signed.quote.expiry === 1_700_000_120, "expiry uses injected chain clock");
    assert(signed.quote.tokenIn.toLowerCase() === artifact.quote.toLowerCase(), "tokenIn is deployment QUOTE");
    assert(signed.quote.tokenOut.toLowerCase() === artifact.rwaToken.toLowerCase(), "tokenOut is deployment RWA");
    const recovered = verifyTypedData(signed.typedData.domain, RFQ_QUOTE_TYPES, signed.quote, signed.signature);
    assert(recovered.toLowerCase() === artifact.maker.toLowerCase(), "signature recovers configured maker");

    const demoQuoteResponse = await requestJson(`${running.baseUrl}/demo/quote`, "POST", {amountIn: "100"});
    assert(demoQuoteResponse.status === 200, "demo quote returns 200 with the canonical taker default");
    const demoQuote = JSON.parse(demoQuoteResponse.body) as any;
    assert(demoQuote.quote.taker.toLowerCase() === artifact.investor.toLowerCase(), "demo quote uses canonical taker");

    const sellQuoteResponse = await requestJson(`${running.baseUrl}/demo/quote`, "POST", {
      taker: artifact.investor,
      amountIn: "100",
      side: "sell"
    });
    assert(sellQuoteResponse.status === 200, "sell quote returns 200");
    const sellQuote = JSON.parse(sellQuoteResponse.body) as any;
    assert(sellQuote.quote.tokenIn.toLowerCase() === artifact.rwaToken.toLowerCase(), "sell tokenIn is deployment RWA");
    assert(sellQuote.quote.tokenOut.toLowerCase() === artifact.quote.toLowerCase(), "sell tokenOut is deployment QUOTE");
    assert(sellQuote.quote.amountOut === "150", "sell quote applies the injected qUSD-per-RWA price");

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

function assertThrows(run: () => unknown, message: string): void {
  try {
    run();
  } catch {
    return;
  }
  throw new Error(`assertion failed: ${message}`);
}

function requestJson(urlValue: string, method: "GET" | "POST", value?: unknown, extraHeaders?: Record<string, string>): Promise<{status: number; body: string; headers: Record<string, string | string[] | undefined>}> {
  const body = value === undefined ? "" : JSON.stringify(value);
  return new Promise((resolve, reject) => {
    const req = httpRequest(
      urlValue,
      {
        method,
        headers: {...extraHeaders, ...(body ? {"content-type": "application/json", "content-length": Buffer.byteLength(body)} : {})}
      },
      (res) => {
        const chunks: Buffer[] = [];
        res.on("data", (chunk) => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
        res.on("end", () => resolve({status: res.statusCode ?? 0, body: Buffer.concat(chunks).toString("utf8"), headers: res.headers}));
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
