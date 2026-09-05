const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const http = require("node:http");
const Model = require("../model.js");
const { server } = require("../server.js");

const root = path.join(__dirname, "..");
const app = fs.readFileSync(path.join(root, "app.js"), "utf8");
const css = fs.readFileSync(path.join(root, "styles.css"), "utf8");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");

function get(port, pathname) {
  return new Promise((resolve, reject) => {
    http.get({ host: "127.0.0.1", port, path: pathname }, (response) => {
      let body = "";
      response.setEncoding("utf8");
      response.on("data", (chunk) => { body += chunk; });
      response.on("end", () => resolve({ status: response.statusCode, headers: response.headers, body }));
    }).on("error", reject);
  });
}

async function run() {
  const initial = Model.initialState();
  assert.equal(initial.walletConnected, true);
  assert.equal(initial.walletProvider, "MetaMask");
  assert.equal(initial.certificationUploadProgress, 0);
  assert.deepEqual(initial.qualificationChecks, [true, true, true, false]);
  assert.equal(Model.isMinimumOrder(49), false);
  assert.equal(Model.isMinimumOrder(50), true);
  assert.deepEqual(Model.portfolioSummary(initial), {
    holdings: [
      { symbol: "KTB", name: "국고채 토큰", unitPrice: 20000, eligible: true, minimum: "10개", quantity: 1200, value: 24000000 },
      { symbol: "MMF", name: "MMF 토큰", unitPrice: 10000, eligible: true, minimum: "10개", quantity: 840, value: 8400000 }
    ],
    totalValue: 32400000,
    assetCount: 2,
    todayPurchaseValue: 0,
    transactionCount: 2,
    demoTradeCount: 0
  });
  initial.orderAmount = 180;
  initial.pendingOrder = Model.createPendingOrder(initial, initial.orderAmount, "2026-09-05T14:21:00+09:00");
  assert.equal(initial.pendingOrder.id, "RFQ-DEMO-1842");
  const firstSettlement = Model.settlePendingOrder(initial, "2026-09-05T14:21:03+09:00");
  assert.equal(firstSettlement.created, true);
  assert.equal(firstSettlement.trade.quantity, 180);
  assert.equal(firstSettlement.trade.fee, 18000);
  assert.equal(firstSettlement.trade.total, 18018000);
  assert.equal(firstSettlement.state.holdings.ABCF, 180);
  assert.equal(firstSettlement.state.transactions.length, 3);
  assert.equal(firstSettlement.state.issuerAssetListed, true);
  const replaySettlement = Model.settlePendingOrder({ ...firstSettlement.state, pendingOrder: firstSettlement.trade }, "2026-09-05T14:21:04+09:00");
  assert.equal(replaySettlement.created, false);
  assert.equal(replaySettlement.state.holdings.ABCF, 180);
  assert.equal(replaySettlement.state.transactions.length, 3);
  const duplicateSettlement = Model.settlePendingOrder(firstSettlement.state, "2026-09-05T14:22:00+09:00");
  assert.equal(duplicateSettlement.created, false);
  assert.equal(duplicateSettlement.state.holdings.ABCF, 180);
  assert.equal(duplicateSettlement.state.transactions.length, 3);
  duplicateSettlement.state.pendingOrder = Model.createPendingOrder(duplicateSettlement.state, 50, "2026-09-05T14:23:00+09:00");
  const secondSettlement = Model.settlePendingOrder(duplicateSettlement.state, "2026-09-05T14:23:03+09:00");
  assert.equal(secondSettlement.state.holdings.ABCF, 230);
  assert.equal(secondSettlement.state.transactions.length, 4);
  const paused = Model.setAssetPaused(secondSettlement.state, true, "유동성 점검", "2026-09-05T14:24:00+09:00");
  assert.equal(paused.changed, true);
  assert.equal(paused.state.assetPaused, true);
  assert.equal(paused.state.operationLog[0].action, "PAUSE");
  assert.equal(Model.createPendingOrder(paused.state, 50), null);
  const resumed = Model.setAssetPaused(paused.state, false, "점검 완료", "2026-09-05T14:25:00+09:00");
  assert.equal(resumed.state.assetPaused, false);
  const orderBeforePause = Model.createPendingOrder(resumed.state, 50, "2026-09-05T14:26:00+09:00");
  const interrupted = Model.setAssetPaused({ ...resumed.state, pendingOrder: orderBeforePause }, true, "긴급 점검", "2026-09-05T14:26:01+09:00");
  assert.equal(interrupted.state.pendingOrder, null);
  const migrated = Model.normalizeState({ postTrade: true });
  assert.equal(migrated.holdings.ABCF, 180);
  assert.equal(migrated.transactions.filter((trade) => trade.symbol === "ABCF").length, 1);
  assert.equal(migrated.issuerAssetListed, true);
  assert.equal(Model.qualificationReady(initial), false);
  initial.qualificationChecks = [true, true, true, true];
  assert.equal(Model.qualificationReady(initial), true);
  assert.deepEqual(Model.evidenceProgress(initial), { ready: 5, total: 7 });
  assert.equal(Model.assets(initial).some((asset) => asset.symbol === "ABCF"), true);
  initial.issuerAssetListed = true;
  assert.equal(Model.assets(initial).some((asset) => asset.symbol === "ABCF"), true);
  initial.issuerAnswers = { offering: "reg-d", fund: "private-fund", investor: "contract", holding: "transfer-agent", distribution: "rule-144" };
  assert.equal(Model.issuerRulesReady(initial), true);
  assert.deepEqual(Model.compiledRules(initial), ["Reg D 506(c)", "§ 3(c)(7)", "계약 이전 제한", "명의개서대리인", "Rule 144"]);

  for (const marker of [
    "investor/home", "investor/trade", "investor/qualification", "investor/provider",
    "investor/upload", "investor/review", "investor/quote-loading", "investor/quote",
    "investor/fill", "investor/complete", "investor/paused", "issuer/home", "issuer/basic",
    "issuer/rules", "issuer/evidence", "issuer/review", "issuer/live", "issuer/metrics"
  ]) assert.match(app, new RegExp(marker.replace("/", "\\/")));
  assert.match(app, /2500, "investor\/qualification-ready"/);
  assert.match(app, /2000, "investor\/quote"/);
  assert.match(app, /state\.issuerAssetListed = true/);
  assert.match(app, /dataTransfer\.files/);
  assert.match(app, /data-action="wallet-details"/);
  assert.match(app, /data-action="open-provider"/);
  assert.match(app, /overlay === "provider"/);
  assert.match(app, /"investor\/provider": investorQualification/);
  assert.doesNotMatch(app, /data-route="investor\/provider"/);
  assert.match(app, /corner-store-product-portal-demo-v3/);
  assert.match(app, /Robin/);
  assert.match(app, /0xB0B7\.\.\.91C4/);
  assert.match(app, /ABC 자산운용/);
  assert.match(app, /Peter/);
  assert.doesNotMatch(app, /<div class="demo-boundary"/);
  assert.doesNotMatch(app, /class="portal-link"/);
  assert.match(app, /data-wallet="WalletConnect"/);
  assert.match(app, /Provider session/);
  assert.match(app, /KYC-0905-1842/);
  assert.match(app, /Han River Markets/);
  assert.match(app, /Atlas Liquidity/);
  assert.match(app, /EIP-712 서명/);
  assert.match(app, /inventory reserved/);
  assert.match(app, /3 confirmations/);
  assert.match(app, /class="button-row completion-actions"/);
  assert.match(app, /class="receipt-action-row"/);
  assert.match(app, /investorTransactions/);
  assert.match(app, /investor\/transactions/);
  assert.match(app, /Model\.settlePendingOrder\(state\)/);
  assert.match(app, /Model\.createPendingOrder\(state, state\.orderAmount\)/);
  assert.match(app, /"open-pause"/);
  assert.match(app, /"confirm-pause"/);
  assert.match(app, /"confirm-resume"/);
  assert.match(app, /"cancel-control"/);
  assert.match(app, /ABCF 신규 quote와 fill/);
  assert.match(app, /window\.addEventListener\("storage"/);
  assert.match(app, /class="asset-list"/);
  assert.match(app, /class="flow-stepper"/);
  assert.match(app, /issuerProgress\(2\)/);
  assert.match(app, /Token \/ IdentityRegistry/);
  assert.match(app, /Safe proposal/);
  for (const evidence of ["qualified", "highValue", "acquisition", "holders", "related", "sanctions", "distribution"]) {
    assert.match(app, new RegExp(`key === \\\"${evidence}\\\"|\\[\\\"${evidence}\\\"`));
  }
  assert.match(html, /<script src="\/model\.js"><\/script>/);
  assert.match(css, /url\("\/assets\/order-handle\.svg"\)/);
  assert.match(css, /width: 240px/);
  assert.match(css, /\.sidebar \{[^}]*height: 100vh;[^}]*min-height: 0;/);
  assert.match(css, /\.button-row \{[^}]*align-items: center;[^}]*justify-content: center;/);
  assert.match(css, /\.center-state > \.button \{[^}]*min-width: 160px;/);
  assert.match(css, /\.center-state > \.button \+ \.button/);
  assert.match(css, /\.completion-actions \.button \{[^}]*margin: 0;/);
  assert.match(css, /\.asset-list-row/);
  assert.match(css, /\.progress-card/);
  assert.match(css, /\.issuer-review-layout/);
  assert.match(css, /\.transaction-row/);
  assert.match(css, /\.asset-operations/);
  assert.match(css, /\.operation-history/);

  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  try {
    const port = server.address().port;
    const health = await get(port, "/health");
    assert.equal(health.status, 200);
    assert.deepEqual(JSON.parse(health.body), { status: "ok", service: "product-portal-demo" });

    const page = await get(port, "/");
    assert.equal(page.status, 200);
    assert.match(page.headers["content-security-policy"], /default-src 'self'/);
    assert.match(page.body, /Corner Store · Product Portal Demo/);

    const asset = await get(port, "/assets/robin-avatar.svg");
    assert.equal(asset.status, 200);
    assert.equal(asset.headers["content-type"], "image/svg+xml");
    assert.match(asset.body, /<svg/);

    const missing = await get(port, "/private-key");
    assert.equal(missing.status, 404);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }

  console.log("product portal demo smoke passed");
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
