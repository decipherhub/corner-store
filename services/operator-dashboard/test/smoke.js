const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const app = fs.readFileSync(path.join(root, "app.js"), "utf8");
const css = fs.readFileSync(path.join(root, "styles.css"), "utf8");
const server = fs.readFileSync(path.join(root, "server.js"), "utf8");

new Function(app);

for (const marker of [
  'id="walletSelector"', "Admin", 'id="ribbonAsset"', 'id="dashboardHolding"',
  'id="userNav"', 'id="adminNav"', 'id="dashboardView"', 'id="createView"', 'id="rfqsView"',
  'id="portfolioView"', 'id="adminDashboardView"', 'id="adminUsersView"', 'id="adminMakerView"',
  "Compliance Pre-check", "참고가격", "최종 온체인 거부 시연", 'id="prepareTemporal"', 'id="advanceTemporal"',
  'id="confirmDialog"', 'id="demoGuide"', 'aria-modal="true"',
  '<link rel="stylesheet" href="/styles.css">', '<script src="/app.js"></script>'
]) {
  if (!html.includes(marker)) throw new Error(`role compliance dashboard marker missing: ${marker}`);
}

for (const marker of [
  "/health", "/demo/state", "/demo/setup", "/demo/precheck", "/demo/quote", "/demo/trade",
  "/demo/admin/user", "/demo/admin/maker", "/api/v1/events", "compliance-proof",
  "/demo/admin/temporal/prepare", "/demo/admin/temporal/advance", "Qualified Purchaser claim missing",
  "selectedWallet", "runPrecheck", "switchProfile", "requiresQualifiedPurchaser", "quoteConsumed",
  "configurePresentation", "chainNow", "quote.taker", "Router가 체결을 거부했습니다",
  "Scenario fixture", "Live · executable", "refreshAdmin", "toggleUser", "setMaker",
  "prepareTemporal", "advanceTemporal"
]) {
  if (!app.includes(marker)) throw new Error(`dashboard API/state marker missing: ${marker}`);
}

for (const [control, handler] of [
  ["newRfq", 'showView("create")'], ["setupDemo", "setupDemo"], ["connect", "check"],
  ["proveCompliance", "proveCompliance"], ["executeQuote", "execute"],
  ["adminRefresh", "refreshAdmin"], ["revokeMaker", "setMaker(false)"],
  ["restoreMaker", "setMaker(true)"], ["openGuide", "guideBackdrop"]
  ,["prepareTemporal", "prepareTemporal"], ["advanceTemporal", "advanceTemporal"]
]) {
  const binding = app.indexOf(`$("` + control + `").onclick`);
  if (binding < 0 || !app.slice(binding, binding + 280).includes(handler)) {
    throw new Error(`dashboard control ${control} is not wired to ${handler}`);
  }
}

for (const marker of [
  "--blue:", ".app-shell", ".sidebar", ".hero-balance", ".quote-grid", ".precheck-card",
  ".role-banner", ".modal-backdrop", "@media (max-width: 720px)", "@media (prefers-reduced-motion: reduce)"
]) {
  if (!css.includes(marker)) throw new Error(`dashboard style marker missing: ${marker}`);
}

for (const marker of [
  '"/styles.css"', '"/app.js"', "CORNER_STORE_OPERATOR_API", "CORNER_STORE_RFQ_BACKEND",
  'path.startsWith("/rfq-api/")', "proxyRfqBackend"
]) {
  if (!server.includes(marker)) throw new Error(`dashboard server marker missing: ${marker}`);
}

console.log("corner-store role compliance RFQ dashboard smoke ok");
