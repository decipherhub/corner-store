const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const app = fs.readFileSync(path.join(root, "app.js"), "utf8");
const css = fs.readFileSync(path.join(root, "styles.css"), "utf8");
const server = fs.readFileSync(path.join(root, "server.js"), "utf8");
const {composeDashboardRuntime} = require(path.join(root, "runtime-state.js"));

new Function(app);
const composed = composeDashboardRuntime(
  {ready: true, presentation: {}, wallets: []},
  {oracle: [], fills: []},
  {enabled: true, source: "deployment-artifact"}
);
if (!composed.chainState.tsvStyle.enabled) throw new Error("TSV deployment evidence composition regression");
for (const unavailable of [undefined, {ready: false}, {ready: true, presentation: {}}]) {
  let rejected = false;
  try { composeDashboardRuntime(unavailable, {oracle: [], fills: []}, {enabled: true}); }
  catch { rejected = true; }
  if (!rejected) throw new Error("unavailable runtime was presented as ready");
}

for (const marker of [
  'id="walletSelector"', "Admin", 'id="ribbonCore"', 'id="ribbonAsset"', 'id="ribbonActivation"', 'id="dashboardHolding"',
  'id="deploymentCore"', 'id="deploymentActivation"', 'id="deploymentRouter"',
  'id="userNav"', 'id="adminNav"', 'id="dashboardView"', 'id="createView"', 'id="rfqsView"',
  'id="portfolioView"', 'id="adminDashboardView"', 'id="adminUsersView"', 'id="adminMakerView"',
  'id="venueANav"', 'id="venueBNav"', "Broker-dealer ATS · RFQ", "TSV-style operator · AMM",
  'id="tokenizerNav"', "Issuer / transfer-agent facts", 'id="tokenizerAssetView"',
  'id="tokenizerHoldersView"', 'id="tokenizerHolderRows"', 'id="tokenizerIdentityTrack"',
  'id="tokenizerInvestorRecordsNav"', 'id="tokenizerHoldersNav"', "B-02-v2",
  'id="venueBOnboardingView"', 'id="venueBPoolView"', 'id="venueBLimitsView"', 'id="venueBLogView"',
  'id="venueIntegrationView"', 'id="tsvSourceBadge"', 'id="tsvVolumeBar"', 'id="tsvTradeRows"',
  "Illustrative rule set", "Order Book remains <strong>not implemented</strong>", "ExternalSettlementGate v1",
  'id="adminEnforcementView"', 'id="caseType"', 'id="caseWallet"', 'id="caseCreate"',
  'id="casePrepare"', 'id="caseQuote"', 'id="caseMutate"', 'id="caseExecute"', 'id="caseRestore"',
  'id="caseTimeline"', 'id="caseResult"', "Element", "ExecutionRouter", "Adapter 직접 호출",
  "Compliance Pre-check", 'id="estimatePay"', 'id="estimateReceive"', "예상 단가", "최종 온체인 거부 시연",
  "Quote 후 claim 만료", "Maker 승인 철회 시연", "Single configured demo Maker", "Enforcement Cases",
  'id="buySide"', 'id="sellSide"', 'id="quoteHolding"',
  'id="ttl"', "scenario 기본값",
  'id="marketChart"', 'id="marketCurrent"', 'id="marketVolume"', "Indicative RFQ mid",
  "market-range-label", "전체 기간", 'id="marketLastFill"', 'id="marketFillTape"',
  'id="confirmDialog"', 'id="demoGuide"', 'aria-modal="true"',
  '<link rel="stylesheet" href="/styles.css">', '<script src="/runtime-state.js"></script>', '<script src="/app.js"></script>'
]) {
  if (!html.includes(marker)) throw new Error(`role compliance dashboard marker missing: ${marker}`);
}

for (const marker of [
  "/health", "/demo/state", "/demo/market-history", "/demo/setup", "/demo/precheck", "/demo/quote", "/demo/trade",
  "/demo/admin/claim", "/demo/admin/maker", "/api/v1/events", "compliance-proof",
  "/demo/admin/temporal/prepare", "/demo/admin/temporal/advance", "Qualified Purchaser claim missing",
  "/demo/enforcement/adapter-boundary", "/demo/enforcement/restore",
  "selectedWallet", "runPrecheck", "switchProfile", "requiresQualifiedPurchaser", "quoteConsumed",
  "renderTsvVenue", "chainState.tsvStyle", "/api/v1/tsv-style", "executionEnabled",
  "composeDashboardRuntime", 'role === "venueA"', 'role === "venueB"',
  "renderTokenizer", 'role === "tokenizer"', "The Tokenizer records issuer and transfer-agent facts",
  'chainState?.assetProfile === "tsv-style"', "Venue A · launch --profile buidl-like or reg-d",
  '$("tokenizerHoldersNav").querySelector("span").textContent = tsvProfile ? "02" : "03"',
  "Per-wallet A-04-v2 acceptance is not exposed by the demo API.",
  "Runtime not connected", "Preview only", "No TSV-style runtime is connected",
  "configurePresentation", "chainNow", "quote.taker", "Router가 체결을 거부했습니다",
  "DeployProductionCore.deployCore", "deployment.coreImplementation", "deployment.activationMode",
  "Scenario fixture", "Live · executable", "refreshAdmin", "saveClaim", "setMaker"
  , 'side: tradeSide', 'setTradeSide("sell")', "transaction.quoteDelta",
  "defaultQuoteTtlSeconds", "formatInputBaseUnits", "coveredCompanyMatchesFund"
  , "beginNewRfq", '$("executeQuote").disabled = false', "formatRatio", "marketPrice",
  "session.rfqs.unshift", "selectRfqRecord", "activeRfqCount",
  "qpBasisHelp", "개인 투자자", "Rule 3c-5의 KE 예외 경로", "updated.transaction.blockNumber",
  "updated.transaction.hash", "renderMarketChart",
  "marketHistory.fills", "suggestedTradeAmounts", "applySuggestedAmount", "visibleRfqRecords",
  "lastImpactBps", "fill-point", "<title>",
  "fill-ticket", "displayOrder", "amountRwa", "renderRfqEstimate", "result.amountOut"
  , "createEnforcementCase", "prepareEnforcementCase", "issueEnforcementQuote",
  "mutateEnforcementPolicy", "executeEnforcementCase", "restoreEnforcementCase",
  "attemptedTransaction", "balanceEvidence", "Asset movement prevented"
]) {
  if (!app.includes(marker)) throw new Error(`dashboard API/state marker missing: ${marker}`);
}

if (app.includes("Qualified-purchaser demo claim active")) {
  throw new Error("TSV Tokenizer must not present qualified-purchaser state as A-04-v2 identity evidence");
}

for (const [control, handler] of [
  ["newRfq", "beginNewRfq"], ["setupDemo", "setupDemo"], ["connect", "check"],
  ["proveCompliance", "proveCompliance"], ["executeQuote", "execute"],
  ["adminRefresh", "refreshAdmin"], ["revokeMaker", "setMaker(false)"],
  ["restoreMaker", "setMaker(true)"], ["openGuide", "guideBackdrop"]
  ,["buySide", 'setTradeSide("buy")'], ["sellSide", 'setTradeSide("sell")']
  ,["caseCreate", "createEnforcementCase"], ["casePrepare", "prepareEnforcementCase"]
  ,["caseQuote", "issueEnforcementQuote"], ["caseMutate", "mutateEnforcementPolicy"]
  ,["caseExecute", "executeEnforcementCase"], ["caseRestore", "restoreEnforcementCase"]
]) {
  const binding = app.indexOf(`$("` + control + `").onclick`);
  if (binding < 0 || !app.slice(binding, binding + 280).includes(handler)) {
    throw new Error(`dashboard control ${control} is not wired to ${handler}`);
  }
}

for (const marker of [
  "--blue:", ".app-shell", ".sidebar", ".hero-balance", ".quote-grid", ".precheck-card", ".market-chart",
  ".market-range-label", ".fill-point", ".market-fill-tape", ".fill-ticket", ".deployment-lineage",
  ".architecture-strip", ".coverage-table", ".enforcement-layout", ".case-timeline", ".evidence-result",
  ".nav-context", ".policy-layout", ".policy-stack", ".pool-pair", ".limits-layout", ".volume-meter",
  ".integration-flow", ".integration-layout", ".integration-code", ".demo-disclaimer",
  ".asset-record-layout", "#tokenizerNav",
  ".role-banner", ".modal-backdrop", "@media (max-width: 720px)", "@media (prefers-reduced-motion: no-preference)"
]) {
  if (!css.includes(marker)) throw new Error(`dashboard style marker missing: ${marker}`);
}

for (const marker of [
  '"/styles.css"', '"/runtime-state.js"', '"/app.js"', "CORNER_STORE_OPERATOR_API", "CORNER_STORE_RFQ_BACKEND",
  'path.startsWith("/rfq-api/")', "proxyRfqBackend"
]) {
  if (!server.includes(marker)) throw new Error(`dashboard server marker missing: ${marker}`);
}

console.log("corner-store role compliance RFQ dashboard smoke ok");
