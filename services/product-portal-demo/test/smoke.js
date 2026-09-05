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
  assert.match(app, /180주/);
  assert.match(app, /18,018,000 원/);
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
