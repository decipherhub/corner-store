const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const app = fs.readFileSync(path.join(root, "app.js"), "utf8");
const css = fs.readFileSync(path.join(root, "styles.css"), "utf8");
const server = fs.readFileSync(path.join(root, "server.js"), "utf8");
const launcher = fs.readFileSync(path.join(root, "..", "..", "scripts", "demo.sh"), "utf8");

new Function(app);

for (const marker of [
  'id="dashboardView"', 'id="createView"', 'id="rfqsView"', 'id="portfolioView"',
  'data-view="security"', 'data-view="operator"', "Advanced demo",
  "총 포트폴리오 가치", "새 RFQ 만들기", "My RFQs", "받은 견적 비교", "Portfolio",
  "Demo fixture", "매도 <small>준비 중", "이번 세션 체결", "mobile-advanced-nav",
  'role="group" aria-label="RFQ 상태 필터"', 'id="buidlData"',
  'id="confirmDialog"', 'id="demoGuide"', 'aria-modal="true"',
  '<link rel="stylesheet" href="/styles.css">', '<script src="/app.js"></script>'
]) {
  if (!html.includes(marker)) throw new Error(`user-first dashboard marker missing: ${marker}`);
}

for (const marker of [
  "/health", "/demo/state", "/demo/setup", "/demo/quote", "/demo/trade", "/demo/restore",
  "/api/v1/config", "/api/v1/deployment", "/api/v1/manifest", "/api/v1/events",
  "ttlSeconds", "quote: signed", "RFQMakerNotApproved", "setComplianceState",
  "Preview fixture", "Live · executable",
  "session.settledDelta", "formatTokenUnits", 'showView("portfolio")',
  "Fixture base + live delta", "escapeHtml(JSON.stringify(live, null, 2))",
  "clearTimeout(quoteTimer)", "live !== signed", "operatorApi"
]) {
  if (!app.includes(marker)) throw new Error(`dashboard API/state marker missing: ${marker}`);
}

for (const [control, handler] of [
  ["newRfq", 'showView("create")'],
  ["newRfqFromList", 'showView("create")'],
  ["emptyNewRfq", 'showView("create")'],
  ["portfolioRfq", 'showView("create")'],
  ["setupDemo", "setupDemo"],
  ["connect", "check"],
  ["executeQuote", "execute"],
  ["securityPrepare", "prepareSecurityQuote"],
  ["securityRevoke", "revokeSecurity"],
  ["securityRestore", "restoreSecurity"],
  ["refresh", "operator"],
  ["openGuide", "openModal"],
  ["notificationButton", "notificationPanel"]
]) {
  const binding = app.indexOf(`$("${control}").onclick`);
  if (binding < 0 || !app.slice(binding, binding + 260).includes(handler)) {
    throw new Error(`dashboard control ${control} is not wired to ${handler}`);
  }
}

for (const marker of [
  'document.querySelectorAll("[data-view]")',
  'document.querySelectorAll("[data-filter]")',
  '$("rfqForm").onsubmit = requestQuote',
  '$("selectLive").onclick = selectQuote',
  '$("viewQuote")',
  "trapModalKeys"
]) {
  if (!app.includes(marker)) throw new Error(`dynamic interaction marker missing: ${marker}`);
}

for (const marker of [
  "--blue:", ".app-shell", ".sidebar", ".hero-balance", ".quote-grid",
  ".modal-backdrop", "@media (max-width: 720px)", "@media (prefers-reduced-motion: reduce)"
]) {
  if (!css.includes(marker)) throw new Error(`dashboard style marker missing: ${marker}`);
}

for (const marker of [
  '"/styles.css"', '"text/css; charset=utf-8"', '"/app.js"', '"text/javascript; charset=utf-8"',
  "CORNER_STORE_OPERATOR_API", "CORNER_STORE_API_TOKEN", "proxyOperatorApi", "operator_api_unavailable",
  "CORNER_STORE_RFQ_BACKEND", 'path.startsWith("/rfq-api/")', "proxyRfqBackend", "rfq_backend_unavailable"
]) {
  if (!server.includes(marker)) throw new Error(`dashboard server marker missing: ${marker}`);
}

for (const marker of ["scripts/e2e-anvil.sh", "CORNER_STORE_ARTIFACT", "CORNER_STORE_RFQ_BACKEND", "Press Ctrl-C to stop all demo services"]) {
  if (!launcher.includes(marker)) throw new Error(`demo launcher marker missing: ${marker}`);
}

console.log("corner-store user-first RFQ dashboard smoke ok");
