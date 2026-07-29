const $ = (id) => document.getElementById(id);
const profiles = {admin: {id: "admin", label: "Admin", role: "admin", address: null}};
const viewMeta = {
  dashboard: ["Overview", "Dashboard"], create: ["New request", "RFQ 거래"], rfqs: ["Requests & quotes", "My RFQs"],
  portfolio: ["Holdings", "Portfolio"], adminDashboard: ["Admin", "Dashboard"], adminMonitoring: ["Admin", "RFQ 모니터링"],
  adminUsers: ["Admin", "사용자 / 화이트리스트"], adminMaker: ["Admin", "Maker 관리"],
  adminEnforcement: ["Compliance operations", "Enforcement Cases"], adminHistory: ["Admin", "거래 내역"]
};
let currentProfile = profiles.admin;
let chainState = null;
let marketHistory = null;
let stateLoadedAt = Date.now();
let presentationInitialized = false;
let precheck = null;
let live = null;
let quoteConsumed = false;
let quoteTimer = null;
let tradeSide = "buy";
let marketRange = "1h";
let enforcementCase = null;
let session = {rfqId: null, status: null, quoteCount: 0, settledCount: 0, rwaDelta: 0n, quoteDelta: 0n, activities: []};

function endpoint(path) { return `${$("backend").value.replace(/\/$/, "")}${path}`; }
async function api(path, init) {
  const response = await fetch(endpoint(path), init);
  const body = await response.json();
  if (!response.ok) throw Error(body.message || body.error || "RFQ backend request failed");
  return body;
}
async function operatorApi(path) {
  const response = await fetch(path);
  const body = await response.json();
  if (!response.ok) throw Error(body.message || body.error || "Operator API request failed");
  return body;
}
function post(path, value) { return api(path, {method: "POST", headers: {"content-type": "application/json"}, body: JSON.stringify(value)}); }
function escapeHtml(value) { return String(value).replace(/[&<>"']/g, (c) => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c])); }
function shortAddress(value) { return value ? `${value.slice(0, 6)}…${value.slice(-4)}` : "—"; }
function activeInputAsset() {
  return tradeSide === "buy" ? chainState?.presentation.quoteAsset : chainState?.presentation.asset;
}
function baseAmount(value, decimals = activeInputAsset()?.decimals ?? 18) {
  if (!new RegExp(`^\\d+(\\.\\d{1,${decimals}})?$`).test(value)) throw Error(`금액은 소수점 ${decimals}자리 이하의 양수여야 합니다.`);
  const [whole, fraction = ""] = value.split(".");
  const amount = (whole + fraction.padEnd(decimals, "0")).replace(/^0+/, "") || "0";
  if (BigInt(amount) <= 0n) throw Error("금액은 0보다 커야 합니다.");
  return amount;
}
function formatBaseUnits(value, decimals = chainState?.presentation.asset.decimals ?? 18) {
  const raw = BigInt(value);
  const sign = raw < 0n ? "-" : "";
  const absolute = raw < 0n ? -raw : raw;
  const scale = 10n ** BigInt(decimals);
  const whole = absolute / scale;
  const fraction = (absolute % scale).toString().padStart(decimals, "0").replace(/0+$/, "").slice(0, 4);
  return `${sign}${whole.toLocaleString("en-US")}${fraction ? `.${fraction}` : ""}`;
}
function formatInputBaseUnits(value, decimals = chainState?.presentation.asset.decimals ?? 18) {
  const raw = BigInt(value);
  const scale = 10n ** BigInt(decimals);
  const whole = raw / scale;
  const fraction = (raw % scale).toString().padStart(decimals, "0").replace(/0+$/, "");
  return `${whole}${fraction ? `.${fraction}` : ""}`;
}
function chainNow() { return Number(chainState?.chainTimestamp || 0) + Math.floor((Date.now() - stateLoadedAt) / 1000); }
function formatRatio(numerator, denominator, precision = 4) {
  const scale = 10n ** BigInt(precision);
  const scaled = BigInt(numerator) * scale / BigInt(denominator);
  const whole = scaled / scale;
  const fraction = (scaled % scale).toString().padStart(precision, "0").replace(/0+$/, "");
  return `${whole}${fraction ? `.${fraction}` : ""}`;
}
function referencePrice() {
  const asset = chainState.presentation.asset;
  const quote = chainState.presentation.quoteAsset;
  const pricing = chainState.marketPrice || chainState.presentation.execution.pricing;
  const movement = pricing.lastMove === "buy-up" ? " ↑" : pricing.lastMove === "sell-down" ? " ↓" : "";
  return `${formatRatio(pricing.numerator, pricing.denominator)} ${quote.symbol} / ${asset.symbol}${movement}`;
}
function suggestedAmount(side = tradeSide) {
  const suggested = chainState.suggestedTradeAmounts;
  return side === "buy" ? suggested.buyAmountIn : suggested.sellAmountIn;
}
function applySuggestedAmount(side = tradeSide) {
  const decimals = side === "buy"
    ? chainState.presentation.quoteAsset.decimals
    : chainState.presentation.asset.decimals;
  $("amount").value = formatInputBaseUnits(suggestedAmount(side), decimals);
}
function quoteRate(quote) {
  const asset = chainState.presentation.asset;
  const settlement = chainState.presentation.quoteAsset;
  const numerator = tradeSide === "buy"
    ? BigInt(quote.amountIn) * (10n ** BigInt(asset.decimals))
    : BigInt(quote.amountOut) * (10n ** BigInt(asset.decimals));
  const denominator = tradeSide === "buy"
    ? BigInt(quote.amountOut) * (10n ** BigInt(settlement.decimals))
    : BigInt(quote.amountIn) * (10n ** BigInt(settlement.decimals));
  return `${formatRatio(numerator, denominator)} ${settlement.symbol} / ${asset.symbol}`;
}
function setStatus(id, text, kind = "") { $(id).textContent = text; $(id).className = `inline-status ${kind}`; }
function addActivity(title, detail) {
  session.activities.unshift({title, detail, time: new Date()});
  session.activities = session.activities.slice(0, 6);
  $("homeActivity").innerHTML = session.activities.map((a) => `<div class="activity-item"><div><strong>${escapeHtml(a.title)}</strong><small>${escapeHtml(a.detail)}</small></div><time>${a.time.toLocaleTimeString("ko-KR", {hour:"2-digit",minute:"2-digit"})}</time></div>`).join("");
}
function updateSummary() {
  $("activeRfqCount").textContent = session.status === "quoted" ? "1" : "0";
  $("settledCount").textContent = String(session.settledCount);
  $("quoteCount").textContent = String(session.quoteCount);
  $("rfqNavCount").textContent = session.rfqId ? "1" : "0";
}
function showView(view) {
  document.querySelectorAll(".view").forEach((node) => node.classList.toggle("hidden", node.id !== `${view}View`));
  document.querySelectorAll("[data-view]").forEach((button) => button.classList.toggle("active", button.dataset.view === view));
  const [kicker, title] = viewMeta[view] || viewMeta.dashboard;
  $("pageKicker").textContent = kicker; $("pageTitle").textContent = title;
  if (view.startsWith("admin")) refreshAdmin();
}
function selectedWallet() {
  if (currentProfile.role !== "user" || !currentProfile.address) throw Error("사용자 지갑을 선택하세요.");
  return currentProfile;
}

async function loadState() {
  [chainState, marketHistory] = await Promise.all([api("/demo/state"), api("/demo/market-history")]);
  stateLoadedAt = Date.now();
  for (const wallet of chainState.wallets || []) profiles[wallet.id] = {...wallet, role: "user"};
  configurePresentation();
  currentProfile = profiles[$("walletSelector").value] || profiles[chainState.wallets[0]?.id] || profiles.admin;
  $("walletAddress").textContent = currentProfile.role === "admin" ? shortAddress(chainState.maker) : shortAddress(currentProfile.address);
  return chainState;
}
function configurePresentation() {
  const selected = $("walletSelector").value;
  const firstLoad = !presentationInitialized;
  $("walletSelector").innerHTML = `<option value="admin">Admin</option>${chainState.wallets.map((wallet) => `<option value="${escapeHtml(wallet.id)}">${escapeHtml(wallet.label)}</option>`).join("")}`;
  $("walletSelector").value = presentationInitialized && profiles[selected] ? selected : chainState.wallets[0].id;
  presentationInitialized = true;
  const asset = chainState.presentation.asset;
  const minimum = formatBaseUnits(asset.minimumAmountBaseUnits);
  $("ribbonAsset").textContent = `${asset.name} · ERC-3643`;
  $("asset").innerHTML = `<option>${escapeHtml(asset.name)} · ${escapeHtml(asset.symbol)}</option>`;
  $("assetName").textContent = asset.name; $("assetSymbol").textContent = asset.symbol;
  $("portfolioAssetName").textContent = asset.name;
  $("portfolioQuoteName").textContent = chainState.presentation.quoteAsset.name;
  $("referencePrice").textContent = referencePrice();
  $("assetReferencePrice").textContent = `${referencePrice()} · ${chainState.presentation.execution.pricing.provider}`;
  $("portfolioReferencePrice").textContent = `${referencePrice()} · ${chainState.presentation.execution.pricing.provider}`;
  $("minimumHelp").textContent = `최소 ${minimum} ${asset.symbol} · 현재 가격 기준 ${chainState.suggestedTradeAmounts.bufferBps} bps 여유분 자동 반영`;
  if (firstLoad || !$("amount").value) applySuggestedAmount();
  const injectedTtl = String(chainState.presentation.execution.defaultQuoteTtlSeconds);
  if (![...$("ttl").options].some((option) => option.value === injectedTtl)) {
    $("ttl").add(new Option(`${injectedTtl}초 · scenario`, injectedTtl));
  }
  $("ttl").value = injectedTtl;
  $("liveMakerDescription").textContent = chainState.presentation.maker.label;
  if ($("caseManifest")) {
    $("caseManifest").textContent = `${asset.symbol} · ${chainState.assetProfile}`;
    const selectedCaseWallet = $("caseWallet").value;
    $("caseWallet").innerHTML = chainState.wallets
      .map((wallet) => `<option value="${escapeHtml(wallet.id)}">${escapeHtml(wallet.label)} · ${shortAddress(wallet.address)}</option>`)
      .join("");
    if (chainState.wallets.some((wallet) => wallet.id === selectedCaseWallet)) {
      $("caseWallet").value = selectedCaseWallet;
    }
  }
  renderMarketChart();
  updateSidePresentation();
}
function renderMarketChart() {
  if (!marketHistory || !chainState) return;
  const width = 920, height = 300;
  const pad = {left: 58, right: 32, top: 34, bottom: 38};
  const valueOf = (point) => Number(point.numerator) / Number(point.denominator);
  const spreadHalf = marketHistory.spreadBps / 20_000;
  const fixtureCount = Math.max(marketHistory.oracle.length, marketHistory.indicative.length - marketHistory.fills.length);
  const allHistory = [...marketHistory.oracle, ...marketHistory.indicative, ...marketHistory.fills];
  const latestTime = Math.max(...allHistory.map((point) => Number(point.timestamp)));
  const rangeSeconds = { "1m": 60, "5m": 300, "1h": 3600, all: Infinity }[marketRange];
  const cutoff = Number.isFinite(rangeSeconds) ? latestTime - rangeSeconds : -Infinity;
  const visible = (points, orderFor) => points
    .map((point, index) => ({...point, displayOrder: orderFor(index)}))
    .filter((point) => Number(point.timestamp) >= cutoff);
  let oracle = visible(marketHistory.oracle, (index) => index);
  let indicative = visible(marketHistory.indicative, (index) => index);
  const fills = visible(marketHistory.fills, (index) => fixtureCount + index);
  if (!oracle.length && marketHistory.oracle.length) {
    oracle = [{...marketHistory.oracle.at(-1), displayOrder: fixtureCount - 1}];
  }
  if (!indicative.length && marketHistory.indicative.length) {
    indicative = [{...marketHistory.indicative.at(-1), displayOrder: fixtureCount - 1 + marketHistory.fills.length}];
  }
  const all = [...oracle, ...indicative, ...fills];
  if (!all.length) return;
  const times = all.map((point) => Number(point.timestamp));
  const values = all.map(valueOf).concat(
    indicative.flatMap((point) => [
      valueOf(point) * (1 + spreadHalf),
      valueOf(point) * (1 - spreadHalf)
    ])
  );
  const minTime = Math.min(...times);
  const rawMin = Math.min(...values), rawMax = Math.max(...values);
  const centerPrice = (rawMin + rawMax) / 2;
  const priceSpan = Math.max((rawMax - rawMin) * 1.2, centerPrice * 0.01);
  const minPrice = centerPrice - priceSpan / 2, maxPrice = centerPrice + priceSpan / 2;
  const minOrder = Math.min(...all.map((point) => point.displayOrder));
  const maxOrder = Math.max(...all.map((point) => point.displayOrder));
  const x = (order) => pad.left + ((Number(order) - minOrder) / Math.max(maxOrder - minOrder, 1)) * (width - pad.left - pad.right);
  const y = (price) => pad.top + (1 - (price - minPrice) / Math.max(maxPrice - minPrice, 0.000001)) * (height - pad.top - pad.bottom);
  const line = (points) => points.map((point, index) => `${index ? "L" : "M"}${x(point.displayOrder).toFixed(1)},${y(valueOf(point)).toFixed(1)}`).join(" ");
  const upper = indicative.map((point) => `${x(point.displayOrder).toFixed(1)},${y(valueOf(point) * (1 + spreadHalf)).toFixed(1)}`);
  const lower = [...indicative].reverse().map((point) => {
    return `${x(point.displayOrder).toFixed(1)},${y(valueOf(point) * (1 - spreadHalf)).toFixed(1)}`;
  });
  const grid = [0, 1, 2, 3].map((index) => {
    const price = minPrice + (maxPrice - minPrice) * (3 - index) / 3;
    const yy = pad.top + (height - pad.top - pad.bottom) * index / 3;
    return `<line x1="${pad.left}" y1="${yy}" x2="${width-pad.right}" y2="${yy}" class="chart-grid"/><text x="${pad.left-9}" y="${yy+4}" text-anchor="end" class="chart-axis">${price.toFixed(4)}</text>`;
  }).join("");
  const fillMarkers = fills.map((point, index) => {
    const xx = x(point.displayOrder);
    const yy = y(valueOf(point));
    const alignRight = xx > width - 150;
    const labelY = Math.max(13, Math.min(height - 18, yy + (index % 2 ? 19 : -12)));
    const price = valueOf(point).toFixed(4);
    return `<g class="fill-point ${point.side}" tabindex="0"><circle cx="${xx.toFixed(1)}" cy="${yy.toFixed(1)}" r="5"/><text x="${(xx + (alignRight ? -9 : 9)).toFixed(1)}" y="${labelY.toFixed(1)}" text-anchor="${alignRight ? "end" : "start"}" class="fill-label">${point.side === "buy" ? "B" : "S"} ${price}</text><title>${point.side === "buy" ? "매수" : "매도"} 체결 · ${price} ${marketHistory.quoteSymbol}/${marketHistory.assetSymbol} · ${formatBaseUnits(point.amountRwa)} ${marketHistory.assetSymbol} · ${new Date(Number(point.timestamp) * 1000).toLocaleTimeString("ko-KR")}</title></g>`;
  }).join("");
  const firstTime = new Date(minTime * 1000).toLocaleTimeString("ko-KR", {hour: "2-digit", minute: "2-digit"});
  const lastTime = new Date(Math.max(...times) * 1000).toLocaleTimeString("ko-KR", {hour: "2-digit", minute: "2-digit", second: "2-digit"});
  $("marketChart").innerHTML = `${grid}<polygon points="${upper.concat(lower).join(" ")}" class="spread-band"/><path d="${line(oracle)}" class="chart-line oracle-line"/><path d="${line(indicative)}" class="chart-line indicative-line"/>${fillMarkers}<text x="${pad.left}" y="${height-10}" class="chart-axis">${firstTime}</text><text x="${width-pad.right}" y="${height-10}" text-anchor="end" class="chart-axis">${lastTime}</text>`;
  $("marketCurrent").textContent = referencePrice();
  $("marketMove").textContent = marketHistory.current.lastMove === "buy-up" ? "최근 매수 후 상승" : marketHistory.current.lastMove === "sell-down" ? "최근 매도 후 하락" : "주입된 초기 가격";
  $("marketSpread").textContent = `${marketHistory.spreadBps} bps`;
  const volume = fills.reduce((sum, fill) => sum + BigInt(fill.amountQuote), 0n);
  $("marketVolume").textContent = `${formatBaseUnits(volume, chainState.presentation.quoteAsset.decimals)} ${chainState.presentation.quoteAsset.symbol}`;
  $("marketTrades").textContent = String(fills.length);
  const latestFill = fills.at(-1);
  $("marketLastFill").textContent = latestFill
    ? `${valueOf(latestFill).toFixed(4)} ${marketHistory.quoteSymbol}/${marketHistory.assetSymbol}`
    : "아직 체결 없음";
  $("marketFillTape").innerHTML = fills.length
    ? [...fills].reverse().slice(0, 6).map((fill) => `<article class="fill-ticket ${fill.side}"><strong>${fill.side === "buy" ? "매수" : "매도"} · ${valueOf(fill).toFixed(4)} ${marketHistory.quoteSymbol}/${marketHistory.assetSymbol}</strong><small>${formatBaseUnits(fill.amountRwa)} ${marketHistory.assetSymbol} · ${new Date(Number(fill.timestamp) * 1000).toLocaleTimeString("ko-KR")} · ${shortAddress(fill.transactionHash)}</small></article>`).join("")
    : "<span>선택 구간에 실제 Router 체결이 없습니다.</span>";
  document.querySelectorAll("[data-market-range]").forEach((button) => button.classList.toggle("active", button.dataset.marketRange === marketRange));
}
function setMarketRange(range) {
  marketRange = range;
  renderMarketChart();
}
function updateSidePresentation() {
  if (!chainState) return;
  const asset = chainState.presentation.asset;
  const quote = chainState.presentation.quoteAsset;
  $("buySide").classList.toggle("active", tradeSide === "buy");
  $("sellSide").classList.toggle("active", tradeSide === "sell");
  $("amountLabel").textContent = tradeSide === "buy" ? "결제 금액" : "매도 수량";
  $("amountUnit").textContent = tradeSide === "buy" ? quote.symbol : asset.symbol;
  $("requestQuote").textContent = tradeSide === "buy" ? "매수 Quote 요청" : "매도 Quote 요청";
}
async function setTradeSide(side) {
  tradeSide = side;
  live = null;
  quoteConsumed = false;
  session.rfqId = null;
  session.status = null;
  $("quoteComparison").classList.add("hidden");
  $("rfqRows").innerHTML = '<tr><td colspan="7"><div class="empty-row">아직 RFQ가 없습니다.</div></td></tr>';
  applySuggestedAmount(side);
  updateSidePresentation();
  await runPrecheck();
  updateSummary();
}
async function beginNewRfq() {
  live = null;
  quoteConsumed = false;
  session.rfqId = null;
  session.status = null;
  if (quoteTimer) clearTimeout(quoteTimer);
  $("executeQuote").disabled = false;
  $("quoteComparison").classList.add("hidden");
  $("result").innerHTML = "";
  $("rfqRows").innerHTML = '<tr><td colspan="7"><div class="empty-row">아직 RFQ가 없습니다.</div></td></tr>';
  applySuggestedAmount();
  updateSummary();
  showView("create");
  await runPrecheck();
}
function renderWalletBalances() {
  if (currentProfile.role !== "user") return;
  $("dashboardHolding").textContent = `${formatBaseUnits(currentProfile.rwaBalance)} ${chainState.presentation.asset.symbol}`;
  $("portfolioTotal").textContent = `${formatBaseUnits(currentProfile.rwaBalance)} ${chainState.presentation.asset.symbol}`;
  $("buidlHolding").textContent = formatBaseUnits(currentProfile.rwaBalance);
  $("quoteHolding").textContent = `${formatBaseUnits(currentProfile.quoteBalance, chainState.presentation.quoteAsset.decimals)} ${chainState.presentation.quoteAsset.symbol}`;
}
async function switchProfile() {
  currentProfile = profiles[$("walletSelector").value];
  const admin = currentProfile.role === "admin";
  const qpRequired = chainState?.requiresQualifiedPurchaser;
  $("userNav").classList.toggle("hidden", admin);
  $("adminNav").classList.toggle("hidden", !admin);
  $("walletAddress").textContent = admin ? shortAddress(chainState?.maker) : shortAddress(currentProfile.address);
  $("roleBanner").classList.toggle("hidden", admin || !qpRequired || currentProfile.qualifiedPurchaser);
  $("roleBanner").innerHTML = admin ? "" : `<strong>현재 지갑은 적격투자자가 아닙니다.</strong> ${escapeHtml(currentProfile.eligibilityReason || "Qualified Purchaser claim missing")}`;
  if (admin) showView("adminDashboard");
  else {
    showView("dashboard");
    applySuggestedAmount();
    const latest = await runPrecheck();
    $("dashboardEligibility").textContent = latest?.allowed
      ? `현재 지갑은 ${chainState.assetProfile} RFQ 거래가 가능합니다.`
      : `RFQ 거래가 차단되었습니다: ${latest?.verdict?.reason || "현재 정책을 확인하세요."}`;
    $("newRfq").disabled = !latest?.allowed;
    $("portfolioRfq").disabled = !latest?.allowed;
    renderWalletBalances();
  }
}

function precheckHtml(result) {
  if (!result) return "<div>검사 결과가 없습니다.</div>";
  return result.checks.map((check) => `<div class="${check.pass ? "pass" : "fail"}"><span>${check.pass ? "✓" : "✕"} ${escapeHtml(check.label)}</span><strong>${check.pass ? "통과" : escapeHtml(check.reason || "실패")}</strong></div>`).join("");
}
async function runPrecheck() {
  if (currentProfile.role !== "user" || !currentProfile.address) return;
  try {
    const amountIn = baseAmount($("amount").value.trim());
    precheck = await post("/demo/precheck", {taker: currentProfile.address, amountIn, side: tradeSide});
    $("precheckRows").innerHTML = precheckHtml(precheck);
    $("precheckVerdict").textContent = precheck.allowed ? "예상 결과: 체결 가능" : `예상 결과: 체결 불가 · ${precheck.verdict.reason || "policy rejected"}`;
    $("precheckCard").classList.toggle("blocked", !precheck.allowed);
    $("requestQuote").disabled = !precheck.allowed;
    $("proveCompliance").classList.toggle(
      "hidden",
      !chainState?.requiresQualifiedPurchaser || precheck.wallet.qualifiedPurchaser || !chainState?.makerApproved
    );
    $("assetInvestorState").textContent = precheck.wallet.qualifiedPurchaser ? "적격" : "비적격";
    $("assetInvestorState").className = precheck.wallet.qualifiedPurchaser ? "positive" : "negative";
    $("complianceStatus").textContent = precheck.allowed ? "Pre-check 통과 · 최종 체결 시 최신 정책을 다시 검사합니다." : precheck.verdict.reason || "현재 정책상 체결할 수 없습니다.";
    $("complianceStatus").classList.toggle("blocked", !precheck.allowed);
    return precheck;
  } catch (error) {
    precheck = null; $("requestQuote").disabled = true;
    $("precheckRows").innerHTML = `<div class="fail"><span>✕ 검사 실패</span><strong>${escapeHtml(error.message)}</strong></div>`;
    return {allowed: false, verdict: {reason: error.message}};
  }
}

async function check() {
  try { await Promise.all([api("/health"), loadState()]); await switchProfile(); setStatus("setupStatus", "Backend와 온체인 상태를 확인했습니다.", "good"); }
  catch (error) { setStatus("setupStatus", error.message, "bad"); }
}
async function setupDemo() {
  $("setupDemo").disabled = true;
  try {
    await post("/demo/setup", {});
    await loadState(); await switchProfile();
    $("environmentBadge").textContent = "Ready"; $("environmentBadge").className = "status-pill live";
    $("setupChecks").classList.remove("hidden");
    const pricing = chainState.presentation.execution.pricing;
    $("setupChecks").innerHTML = `<div><span>RFQ backend</span><strong>Ready</strong></div><div><span>Maker</span><strong>${chainState.makerApproved ? "Approved" : "Revoked"}</strong></div><div><span>Injected wallets</span><strong>${chainState.wallets.length} loaded</strong></div><div><span>Pricing source</span><strong>${escapeHtml(pricing.provider)}</strong></div><div><span>Maker inventory</span><strong>${formatBaseUnits(chainState.makerInventory.rwaBalance)} ${escapeHtml(chainState.presentation.asset.symbol)} / ${formatBaseUnits(chainState.makerInventory.quoteBalance, chainState.presentation.quoteAsset.decimals)} ${escapeHtml(chainState.presentation.quoteAsset.symbol)}</strong></div>`;
    setStatus("setupStatus", `Scenario v${chainState.presentation.schemaVersion} 데이터와 실제 온체인 상태를 준비했습니다.`, "good");
  } catch (error) { setStatus("setupStatus", error.message, "bad"); }
  finally { $("setupDemo").disabled = false; }
}

async function requestQuote(event) {
  event?.preventDefault();
  $("requestQuote").disabled = true;
  try {
    const latest = await runPrecheck();
    if (!latest?.allowed) throw Error(latest?.verdict.reason || "Compliance Pre-check failed");
    const wallet = selectedWallet();
    live = await post("/demo/quote", {
      taker: wallet.address,
      amountIn: latest.amountIn,
      side: tradeSide,
      ttlSeconds: Number($("ttl").value)
    });
    quoteConsumed = false;
    $("executeQuote").disabled = false;
    session.rfqId = `#${String(live.quote.nonce).slice(-6)}`; session.status = "quoted"; session.quoteCount += 1;
    addActivity("Firm quote 도착", `${wallet.label} · ${chainState.presentation.maker.label}`);
    renderQuote(); updateSummary(); showView("rfqs");
  } catch (error) { setStatus("status", error.message, "bad"); }
  finally { $("requestQuote").disabled = !precheck?.allowed; }
}
function renderRfqRows() {
  if (!live) return;
  const owner = Object.values(profiles).find((p) => p.address?.toLowerCase() === live.quote.taker.toLowerCase());
  $("rfqRows").innerHTML = `<tr><td><strong>${session.rfqId}</strong></td><td>${escapeHtml(owner?.label || shortAddress(live.quote.taker))}</td><td><strong>${tradeSide === "buy" ? "매수" : "매도"}</strong></td><td>${escapeHtml(chainState.presentation.asset.name)}</td><td><span class="status-pill neutral">${session.status}</span></td><td>1 live + ${chainState.presentation.previewQuotes.length} preview</td><td><button id="viewQuote" class="text-button">견적 보기 →</button></td></tr>`;
  $("viewQuote").onclick = () => $("quoteComparison").scrollIntoView({behavior:"smooth"});
}
function renderQuote() {
  renderRfqRows(); $("quoteComparison").classList.remove("hidden");
  const maker = chainState.presentation.maker.label;
  const liveRate = quoteRate(live.quote);
  const input = tradeSide === "buy" ? chainState.presentation.quoteAsset : chainState.presentation.asset;
  const output = tradeSide === "buy" ? chainState.presentation.asset : chainState.presentation.quoteAsset;
  const ownsQuote = currentProfile.role === "user" &&
    currentProfile.address?.toLowerCase() === live.quote.taker.toLowerCase();
  const quoteAction = quoteConsumed
    ? "새 RFQ 만들기"
    : ownsQuote
      ? "이 견적 검토"
      : "현재 지갑으로 새 RFQ";
  $("quoteCards").innerHTML = `<article class="quote-card live"><div class="maker-line"><strong>${escapeHtml(maker)}</strong><span>${quoteConsumed ? "Settled · consumed" : "Live · executable"}</span></div><strong class="rate">${liveRate}</strong><small>${tradeSide === "buy" ? "매수" : "매도"} · Backend-generated firm quote</small><dl><div><dt>Pay</dt><dd>${formatBaseUnits(live.quote.amountIn, input.decimals)} ${escapeHtml(input.symbol)}</dd></div><div><dt>Receive</dt><dd>${formatBaseUnits(live.quote.amountOut, output.decimals)} ${escapeHtml(output.symbol)}</dd></div><div><dt>유효시간</dt><dd id="liveExpiry">${quoteConsumed ? "Consumed" : "—"}</dd></div><div><dt>Taker</dt><dd>${shortAddress(live.quote.taker)}</dd></div></dl><button id="selectLive" class="primary">${quoteAction}</button></article>${chainState.presentation.previewQuotes.map((quote) => `<article class="quote-card preview"><div class="maker-line"><strong>${escapeHtml(quote.maker)}</strong><span>Scenario fixture</span></div><strong class="rate">${escapeHtml(quote.rate)}</strong><small>Indicative only</small><button class="secondary" disabled>Preview only</button></article>`).join("")}`;
  $("selectLive").onclick = quoteConsumed || !ownsQuote ? beginNewRfq : selectQuote;
  if (quoteTimer) clearTimeout(quoteTimer);
  if (quoteConsumed) return;
  const tick = () => {
    if (!live) return;
    const left = Number(live.quote.expiry) - chainNow();
    if (left <= 0) { session.status = "expired"; $("liveExpiry").textContent = "Expired"; return; }
    $("liveExpiry").textContent = `${Math.floor(left/60)}분 ${left%60}초`; quoteTimer = setTimeout(tick, 1000);
  }; tick();
}
async function selectQuote() {
  if (!live || quoteConsumed) return;
  if (currentProfile.role !== "user" || currentProfile.address?.toLowerCase() !== live.quote.taker.toLowerCase()) {
    $("result").innerHTML = '<div class="inline-status bad">이 quote는 다른 taker 지갑에 바인딩되어 있습니다. 해당 지갑으로 전환하세요.</div>'; return;
  }
  const latest = await runPrecheck();
  $("acceptPrecheck").innerHTML = `<strong>Accept 전 Pre-check</strong>${precheckHtml(latest)}<b>${latest.allowed ? "현재 체결 가능" : "현재 체결 불가"}</b>`;
  $("modalPrecheck").innerHTML = $("acceptPrecheck").innerHTML;
  const input = tradeSide === "buy" ? chainState.presentation.quoteAsset : chainState.presentation.asset;
  const output = tradeSide === "buy" ? chainState.presentation.asset : chainState.presentation.quoteAsset;
  $("review").innerHTML = `<div><span>방향</span><strong>${tradeSide === "buy" ? "매수" : "매도"}</strong></div><div><span>Maker</span><strong>${escapeHtml(chainState.presentation.maker.label)}</strong></div><div><span>Taker</span><strong>${shortAddress(live.quote.taker)}</strong></div><div><span>Pay</span><strong>${formatBaseUnits(live.quote.amountIn, input.decimals)} ${escapeHtml(input.symbol)}</strong></div><div><span>Receive</span><strong>${formatBaseUnits(live.quote.amountOut, output.decimals)} ${escapeHtml(output.symbol)}</strong></div><div><span>Nonce</span><strong>${live.quote.nonce}</strong></div><details class="payload-review"><summary>Signed quote payload</summary><pre>${escapeHtml(JSON.stringify(live,null,2))}</pre></details>`;
  $("executeQuote").textContent = latest.allowed ? "견적 수락 및 체결" : "최종 온체인 검사 시도";
  $("executeQuote").disabled = false;
  $("confirmBackdrop").classList.remove("hidden");
}
async function execute() {
  if (!live) return;
  $("executeQuote").disabled = true;
  try {
    const priceBefore = referencePrice();
    const latest = await runPrecheck();
    const action = latest.allowed ? "settle" : latest.wallet.qualifiedPurchaser ? "revoked-maker" : "compliance-proof";
    const result = await post("/demo/trade", {amountIn: live.quote.amountIn, action, quote: live});
    if (result.rejection) {
      $("result").innerHTML = `<div class="inline-status good"><strong>Router가 체결을 거부했습니다.</strong><br>${escapeHtml(result.rejection)}<br><small>${escapeHtml(result.reasonCode || "")}</small></div>`;
      addActivity("RFQ 체결 거부", result.rejection); session.status = "rejected";
    } else {
      session.status = "accepted"; session.settledCount += 1;
      session.rwaDelta += BigInt(result.transaction.rwaDelta);
      session.quoteDelta += BigInt(result.transaction.quoteDelta);
      quoteConsumed = true;
      if (quoteTimer) clearTimeout(quoteTimer);
      $("result").innerHTML = `<div class="inline-status good"><strong>체결 완료</strong><br>Block ${result.transaction.blockNumber}<br><small>${result.transaction.hash}</small></div>`;
      $("portfolioDelta").textContent = `현재 세션 실제 체결: ${formatBaseUnits(session.rwaDelta)} ${chainState.presentation.asset.symbol} / ${formatBaseUnits(session.quoteDelta, chainState.presentation.quoteAsset.decimals)} ${chainState.presentation.quoteAsset.symbol}`;
      addActivity(`${result.side === "sell" ? "매도" : "매수"} RFQ 체결 완료`, `Block ${result.transaction.blockNumber}`);
    }
    $("confirmBackdrop").classList.add("hidden"); updateSummary(); renderQuote(); await loadState(); renderWalletBalances();
    if (result.transaction) {
      $("result").innerHTML = `<div class="inline-status good"><strong>체결 완료</strong><br>Block ${result.transaction.blockNumber}<br><small>${escapeHtml(priceBefore)} → ${escapeHtml(referencePrice())}</small></div>`;
    }
  } catch (error) { $("result").innerHTML = `<div class="inline-status bad">체결 실패: ${escapeHtml(error.message)}</div>`; }
  finally { $("executeQuote").disabled = quoteConsumed; }
}
async function proveCompliance() {
  try {
    const latest = await runPrecheck();
    if (latest?.wallet.qualifiedPurchaser) throw Error("비적격 지갑에서 실행하세요.");
    const quote = await post("/demo/quote", {
      taker: currentProfile.address,
      amountIn: latest.amountIn,
      side: tradeSide,
      ttlSeconds: chainState.presentation.temporalEligibility.quoteTtlSeconds
    });
    const result = await post("/demo/trade", {amountIn: quote.quote.amountIn, action: "compliance-proof", quote});
    setStatus("status", `최종 Router 검사 거부: ${result.rejection}`, "good");
    addActivity("비적격 거래 차단", result.rejection);
  } catch (error) { setStatus("status", error.message, "bad"); }
}

async function refreshAdmin() {
  if (currentProfile.role !== "admin") return;
  try {
    await loadState();
    const eventsPayload = await operatorApi("/api/v1/events").catch(() => ({events: []}));
    const events = eventsPayload.events || [];
    const rejected = events.filter((e) => e.name === "RFQRejected").length;
    const settled = events.filter((e) => e.name === "RFQSettled").length;
    $("adminStats").innerHTML = `<article class="stat-card"><span>진행 중 RFQ</span><strong>${session.status === "quoted" ? 1 : 0}</strong></article><article class="stat-card"><span>오늘 거부</span><strong>${rejected}</strong></article><article class="stat-card"><span>적격 / 비적격</span><strong>${chainState.wallets.filter((w)=>w.qualifiedPurchaser).length} / ${chainState.wallets.filter((w)=>!w.qualifiedPurchaser).length}</strong></article>`;
    $("adminRecent").innerHTML = events.length ? events.slice(-6).reverse().map(eventRow).join("") : '<div class="empty-row">아직 이벤트가 없습니다.</div>';
    $("monitoringContent").innerHTML = `<div><span>현재 RFQ</span><strong>${session.rfqId || "없음"}</strong></div><div><span>상태</span><strong>${session.status || "—"}</strong></div><div><span>Quote taker</span><strong>${live ? shortAddress(live.quote.taker) : "—"}</strong></div>`;
    $("adminUserRows").innerHTML = chainState.wallets.map(renderClaimEditor).join("");
    document.querySelectorAll(".admin-claim-save").forEach((button) => button.onclick = () => saveClaim(button));
    document.querySelectorAll('[data-claim-field="basis"]').forEach((select) => {
      select.onchange = () => {
        select.closest(".claim-editor").querySelector(".claim-basis-help").textContent = qpBasisHelp(select.value);
      };
    });
    $("makerFacts").innerHTML = `<div><span>Maker</span><strong>${escapeHtml(chainState.presentation.maker.label)} · ${shortAddress(chainState.maker)}</strong></div><div><span>상태</span><strong>${chainState.makerApproved ? "Active" : "Cancelled"}</strong></div><div><span>RWA inventory</span><strong>${formatBaseUnits(chainState.makerInventory.rwaBalance)} ${escapeHtml(chainState.presentation.asset.symbol)}</strong></div><div><span>Settlement inventory</span><strong>${formatBaseUnits(chainState.makerInventory.quoteBalance, chainState.presentation.quoteAsset.decimals)} ${escapeHtml(chainState.presentation.quoteAsset.symbol)}</strong></div>`;
    const temporal = chainState.presentation.temporalEligibility;
    const target = chainState.wallets.find((wallet) => wallet.id === temporal.walletId);
    $("temporalFacts").innerHTML = `<div><span>대상 지갑</span><strong>${escapeHtml(target?.label || temporal.walletId)}</strong></div><div><span>현재 chain time</span><strong>${new Date(chainState.chainTimestamp * 1000).toLocaleTimeString("ko-KR")}</strong></div><div><span>주입 freshness</span><strong>${temporal.freshnessSeconds}초</strong></div><div><span>시간 전진</span><strong>+${temporal.advanceSeconds}초</strong></div>`;
    $("advanceTemporal").disabled = !live || live.quote.taker.toLowerCase() !== target?.address.toLowerCase();
    setStatus("temporalStatus", $("advanceTemporal").disabled ? "먼저 대상 지갑으로 quote를 요청하세요." : "저장된 quote가 있습니다. 시간을 경과시키면 claim만 만료되고 quote는 아직 유효합니다.");
    $("revokeMaker").disabled = !chainState.makerApproved; $("restoreMaker").disabled = chainState.makerApproved;
    setStatus("makerStatus", chainState.makerApproved ? "Maker가 승인되어 있습니다." : "Maker가 취소되어 새 체결이 차단됩니다.", chainState.makerApproved ? "good" : "bad");
    renderEvents(events);
  } catch (error) { setStatus("makerStatus", error.message, "bad"); }
}
function renderClaimEditor(wallet) {
  const claim = wallet.qpClaim;
  const basisOptions = [
    ["NONE", "Claim 없음"],
    ["NATURAL", "개인 투자자 · $5M investments"],
    ["FAMILY_COMPANY", "가족회사 · $5M + 소유자 확인"],
    ["TRUST", "신탁 · 설정자/수탁자 확인"],
    ["INSTITUTIONAL", "기관 · $25M discretionary investments"],
    ["QIB", "QIB · 적격기관투자자 간주 경로"],
    ["KNOWLEDGEABLE_EMPLOYEE", "KE · Rule 3c-5 임직원 예외"],
    ["OTHER", "기타 · 수동 검토"]
  ].map(([value, label]) => `<option value="${value}" ${claim.basis === value ? "selected" : ""}>${label}</option>`).join("");
  const lookThroughOptions = ["NONE", "PENDING", "COMPLETED", "FAILED"]
    .map((value) => `<option value="${value}" ${claim.lookThroughStatus === value ? "selected" : ""}>${value}</option>`).join("");
  return `<tr data-claim-wallet="${escapeHtml(wallet.id)}">
    <td><strong>${escapeHtml(wallet.label)}</strong><small><code>${shortAddress(wallet.address)}</code></small></td>
    <td><span class="status-pill ${wallet.qualifiedPurchaser ? "live" : "warning"}">${wallet.qualifiedPurchaser ? "거래 허용" : "차단"}</span><small>${escapeHtml(wallet.eligibilityReason || "ICA 투자자 요건 통과")}</small>${wallet.expiresAt ? `<small>claim expires ${new Date(wallet.expiresAt * 1000).toLocaleString("ko-KR")}</small>` : ""}</td>
    <td><div class="claim-editor">
      <label>QP 근거<select data-claim-field="basis">${basisOptions}</select></label>
      <label>Look-through<select data-claim-field="lookThroughStatus">${lookThroughOptions}</select></label>
      <label class="claim-check"><input type="checkbox" data-claim-field="signatureValid" ${claim.signatureValid ? "checked" : ""}> 서명 유효</label>
      <label class="claim-check"><input type="checkbox" data-claim-field="issuerTrusted" ${claim.issuerTrusted ? "checked" : ""}> Trusted Issuer</label>
      <label class="claim-check"><input type="checkbox" data-claim-field="coveredCompanyMatchesFund" ${claim.coveredCompanyMatchesFund ? "checked" : ""}> KE 대상 펀드 일치</label>
      <small class="claim-basis-help">${escapeHtml(qpBasisHelp(claim.basis))}</small>
    </div></td>
    <td><button class="primary admin-claim-save" data-wallet="${escapeHtml(wallet.id)}">Claim 기록</button></td>
  </tr>`;
}
function qpBasisHelp(basis) {
  return {
    NONE: "QP claim이 없어 거래가 차단됩니다.",
    NATURAL: "개인 투자자 경로입니다. Trusted Issuer가 $5M 이상 investments 요건을 오프체인에서 확인한 claim이면 통과합니다.",
    FAMILY_COMPANY: "가족회사 경로입니다. $5M 요건과 실소유자 look-through가 COMPLETED여야 통과합니다.",
    TRUST: "신탁 경로입니다. 법정 관계자 요건을 확인하고 look-through가 COMPLETED여야 통과합니다.",
    INSTITUTIONAL: "기관 경로입니다. Trusted Issuer가 $25M 이상 discretionary investments 요건을 확인한 claim이면 통과합니다.",
    QIB: "Rule 144A의 Qualified Institutional Buyer 지위를 확인한 간주 경로입니다.",
    KNOWLEDGEABLE_EMPLOYEE: "QP 자체가 아니라 Rule 3c-5의 KE 예외 경로입니다. 해당 펀드의 투자 업무에 관여하는 임직원이어야 하며 대상 펀드가 일치해야 합니다.",
    OTHER: "자동 판정할 수 없는 예외 경로이므로 수동 검토 상태로 처리됩니다."
  }[basis] || "";
}
async function saveClaim(button) {
  button.disabled = true;
  try {
    const row = button.closest("[data-claim-wallet]");
    const value = (field) => row.querySelector(`[data-claim-field="${field}"]`);
    const claim = {
      basis: value("basis").value,
      signatureValid: value("signatureValid").checked,
      issuerTrusted: value("issuerTrusted").checked,
      lookThroughStatus: value("lookThroughStatus").value,
      coveredCompanyMatchesFund: value("coveredCompanyMatchesFund").checked
    };
    const updated = await post("/demo/admin/claim", {walletId: button.dataset.wallet, claim});
    setStatus(
      "adminUserStatus",
      `${updated.label}: 입력 claim을 기록했고 ICA 투자자 판정은 ${updated.qualifiedPurchaser ? "거래 허용" : `차단 (${updated.eligibilityReason})`}입니다.`,
      updated.qualifiedPurchaser ? "good" : "bad"
    );
    await refreshAdmin();
  } catch (error) { setStatus("adminUserStatus", error.message, "bad"); }
  finally { button.disabled = false; }
}
async function setMaker(approved) {
  try { await post("/demo/admin/maker", {approved}); addActivity("Maker 상태 변경", approved ? "복구" : "취소"); await refreshAdmin(); }
  catch (error) { setStatus("makerStatus", error.message, "bad"); }
}
async function prepareTemporal() {
  $("prepareTemporal").disabled = true;
  try {
    const temporal = chainState.presentation.temporalEligibility;
    await post("/demo/admin/temporal/prepare", {walletId: temporal.walletId});
    addActivity("시간 만료 데모 준비", `${temporal.freshnessSeconds}초 freshness 주입`);
    await refreshAdmin();
    setStatus("temporalStatus", `${temporal.walletId}의 QP claim을 새로 발급했습니다. 해당 지갑으로 quote를 요청하세요.`, "good");
  } catch (error) { setStatus("temporalStatus", error.message, "bad"); }
  finally { $("prepareTemporal").disabled = false; }
}
async function advanceTemporal() {
  $("advanceTemporal").disabled = true;
  try {
    const temporal = chainState.presentation.temporalEligibility;
    await post("/demo/admin/temporal/advance", {seconds: temporal.advanceSeconds});
    addActivity("Anvil 시간 경과", `+${temporal.advanceSeconds}초`);
    await refreshAdmin();
    setStatus("temporalStatus", "QP claim이 만료되었습니다. 같은 taker 지갑으로 돌아가 저장된 quote의 최종 거부를 확인하세요.", "good");
  } catch (error) { setStatus("temporalStatus", error.message, "bad"); }
}

const enforcementLabels = {
  "adapter-boundary": {
    title: "Adapter 직접 호출 차단",
    control: "RFQAdapter.onlyRouter",
    mutation: "별도 정책 변경 없음",
    expected: "NotAuthorized + 실패 receipt + 잔액 불변"
  },
  "claim-expiry": {
    title: "Quote 이후 QP claim 만료",
    control: "ExecutionRouter fill-time compliance",
    mutation: "Anvil chain time 전진",
    expected: "ComplianceRejected + reasonCode + 잔액 불변"
  },
  "maker-revocation": {
    title: "Quote 이후 Maker 승인 취소",
    control: "RFQAdapter maker allowlist",
    mutation: "Maker approval true → false",
    expected: "RFQMakerNotApproved + 실패 receipt + 잔액 불변"
  }
};

function caseWalletState() {
  return chainState.wallets.find((wallet) => wallet.id === enforcementCase?.walletId);
}
function caseStep(label, detail, status = "pending") {
  enforcementCase.steps.push({label, detail, status, time: new Date()});
  renderEnforcementCase();
}
function caseBadge(status) {
  const label = {
    opened: "Open", prepared: "Baseline ready", quoted: "Quote issued",
    mutated: "Policy changed", blocked: "Blocked · verified", restored: "Closed"
  }[status] || "Not opened";
  $("caseStatusBadge").textContent = label;
  $("caseStatusBadge").className = `status-pill ${status === "blocked" ? "live" : status === "restored" ? "neutral" : "warning"}`;
}
function renderCaseEvidence(result) {
  if (!result) {
    $("caseResult").classList.add("hidden");
    $("caseResult").innerHTML = "";
    return;
  }
  const tx = result.attemptedTransaction;
  const balances = result.balanceEvidence;
  const trace = result.trace || [];
  const blockNumber = tx ? Number(tx.blockNumber) : null;
  const receiptStatus = tx ? Number(tx.status) : null;
  $("caseResult").classList.remove("hidden");
  $("caseResult").innerHTML = `
    <div class="evidence-outcome"><span>Enforcement outcome</span><strong>${escapeHtml(result.outcome || (result.rejection ? "BLOCKED" : "UNKNOWN"))}</strong></div>
    <div class="evidence-grid">
      <div><span>Rejection</span><strong>${escapeHtml(result.rejection || "—")}</strong></div>
      <div><span>Reason code / selector</span><code>${escapeHtml(result.reasonCode || result.selector || "—")}</code></div>
      <div><span>Transaction</span><code>${tx ? escapeHtml(shortAddress(tx.hash)) : "—"}</code></div>
      <div><span>Receipt</span><strong>${tx && Number.isSafeInteger(blockNumber) && Number.isSafeInteger(receiptStatus) ? `Block ${blockNumber} · status ${receiptStatus}` : "—"}</strong></div>
      <div><span>RWA balance</span><code>${balances ? `${escapeHtml(balances.rwaBefore)} → ${escapeHtml(balances.rwaAfter)}` : "—"}</code></div>
      <div><span>Settlement balance</span><code>${balances ? `${escapeHtml(balances.quoteBefore)} → ${escapeHtml(balances.quoteAfter)}` : "—"}</code></div>
    </div>
    <div class="balance-proof ${balances?.unchanged ? "verified" : ""}">
      <strong>${balances?.unchanged ? "✓ Asset movement prevented" : "Balance evidence unavailable"}</strong>
      <span>실패 전후 RWA와 결제 자산 잔액이 동일해야 합니다.</span>
    </div>
    <div class="evidence-trace">${trace.map((item, index) => {
      const status = ["passed", "rejected", "pending"].includes(item.status) ? item.status : "pending";
      return `<div class="${status}"><span>${String(index + 1).padStart(2, "0")}</span><strong>${escapeHtml(item.stage)}</strong><small>${escapeHtml(item.detail)}</small></div>`;
    }).join("")}</div>`;
}
function renderEnforcementCase() {
  if (!enforcementCase) {
    caseBadge(null);
    $("caseCreate").disabled = false;
    $("caseType").disabled = false;
    $("caseWallet").disabled = false;
    $("caseFacts").innerHTML = "<span>케이스를 생성하면 기준 상태와 단계별 작업이 표시됩니다.</span>";
    $("caseTimeline").innerHTML = '<div class="empty-row">열린 케이스가 없습니다.</div>';
    ["casePrepare", "caseQuote", "caseMutate", "caseExecute", "caseRestore"].forEach((id) => $(id).disabled = true);
    renderCaseEvidence(null);
    return;
  }
  const definition = enforcementLabels[enforcementCase.type];
  const wallet = caseWalletState();
  caseBadge(enforcementCase.status);
  $("caseFacts").innerHTML = `
    <div><span>Case ID</span><strong>${escapeHtml(enforcementCase.id)}</strong></div>
    <div><span>Control</span><strong>${escapeHtml(definition.control)}</strong></div>
    <div><span>대상</span><strong>${escapeHtml(wallet?.label || enforcementCase.walletId)} · ${shortAddress(wallet?.address)}</strong></div>
    <div><span>상태 변경</span><strong>${escapeHtml(definition.mutation)}</strong></div>
    <div><span>기대 증거</span><strong>${escapeHtml(definition.expected)}</strong></div>`;
  $("caseTimeline").innerHTML = enforcementCase.steps.length
    ? enforcementCase.steps.map((step, index) => `<div class="case-step ${step.status}"><span>${String(index + 1).padStart(2, "0")}</span><div><strong>${escapeHtml(step.label)}</strong><small>${escapeHtml(step.detail)}</small><time>${step.time.toLocaleTimeString("ko-KR")}</time></div></div>`).join("")
    : '<div class="empty-row">첫 작업을 실행하세요.</div>';

  const status = enforcementCase.status;
  const direct = enforcementCase.type === "adapter-boundary";
  const closed = status === "restored";
  $("caseCreate").disabled = !closed;
  $("caseType").disabled = !closed;
  $("caseWallet").disabled = !closed;
  $("casePrepare").disabled = status !== "opened";
  $("caseQuote").disabled = direct || status !== "prepared";
  $("caseMutate").disabled = direct || status !== "quoted";
  $("caseExecute").disabled = direct ? status !== "prepared" : status !== "mutated";
  $("caseRestore").disabled = !["prepared", "quoted", "mutated", "blocked"].includes(status);
  $("caseQuote").textContent = direct ? "2. Quote 불필요" : "2. Firm quote 발급";
  $("caseMutate").textContent = direct ? "3. 정책 변경 불필요" : "3. 정책 상태 변경";
  renderCaseEvidence(enforcementCase.result);
}
function createEnforcementCase() {
  if (enforcementCase && enforcementCase.status !== "restored") return;
  let walletId = $("caseWallet").value;
  const type = $("caseType").value;
  if (type === "claim-expiry") {
    walletId = chainState.presentation.temporalEligibility.walletId;
    $("caseWallet").value = walletId;
  }
  const definition = enforcementLabels[type];
  const wallet = chainState.wallets.find((entry) => entry.id === walletId);
  enforcementCase = {
    id: `EC-${Date.now().toString(36).toUpperCase()}`,
    type,
    walletId,
    status: "opened",
    quote: null,
    result: null,
    steps: [{
      label: "Case opened",
      detail: `${definition.title} · ${wallet?.label || walletId}`,
      status: "passed",
      time: new Date()
    }]
  };
  renderEnforcementCase();
}
async function prepareEnforcementCase() {
  if (!enforcementCase || enforcementCase.status !== "opened") return;
  $("casePrepare").disabled = true;
  try {
    if (enforcementCase.type === "claim-expiry") {
      await post("/demo/admin/temporal/prepare", {walletId: enforcementCase.walletId});
    } else if (enforcementCase.type === "maker-revocation") {
      await post("/demo/enforcement/restore", {kind: "maker-revocation"});
    } else {
      await loadState();
    }
    await loadState();
    enforcementCase.status = "prepared";
    const wallet = caseWalletState();
    if (enforcementCase.type === "maker-revocation") {
      const baseline = await post("/demo/precheck", {
        taker: wallet.address,
        amountIn: chainState.suggestedTradeAmounts.buyAmountIn,
        side: "buy"
      });
      if (!baseline.allowed) {
        enforcementCase.status = "opened";
        throw Error(`선택 지갑의 기준 거래가 먼저 허용되어야 합니다: ${baseline.verdict.reason || "policy rejected"}`);
      }
    }
    caseStep(
      "Baseline captured",
      `Maker ${chainState.makerApproved ? "approved" : "not approved"} · RWA ${formatBaseUnits(wallet.rwaBalance)} · ${chainState.presentation.quoteAsset.symbol} ${formatBaseUnits(wallet.quoteBalance, chainState.presentation.quoteAsset.decimals)}`,
      "passed"
    );
  } catch (error) {
    caseStep("Baseline failed", error.message, "rejected");
  }
}
async function issueEnforcementQuote() {
  if (!enforcementCase || enforcementCase.status !== "prepared" || enforcementCase.type === "adapter-boundary") return;
  $("caseQuote").disabled = true;
  try {
    const wallet = caseWalletState();
    const ttlSeconds = enforcementCase.type === "claim-expiry"
      ? chainState.presentation.temporalEligibility.quoteTtlSeconds
      : chainState.presentation.execution.defaultQuoteTtlSeconds;
    enforcementCase.quote = await post("/demo/quote", {
      taker: wallet.address,
      amountIn: chainState.suggestedTradeAmounts.buyAmountIn,
      side: "buy",
      ttlSeconds
    });
    enforcementCase.status = "quoted";
    caseStep(
      "Firm quote issued",
      `Nonce ${enforcementCase.quote.quote.nonce} · expires ${new Date(Number(enforcementCase.quote.quote.expiry) * 1000).toLocaleTimeString("ko-KR")} · taker ${shortAddress(wallet.address)}`,
      "passed"
    );
  } catch (error) {
    caseStep("Quote issuance failed", error.message, "rejected");
  }
}
async function mutateEnforcementPolicy() {
  if (!enforcementCase || enforcementCase.status !== "quoted") return;
  $("caseMutate").disabled = true;
  try {
    if (enforcementCase.type === "claim-expiry") {
      const seconds = chainState.presentation.temporalEligibility.advanceSeconds;
      await post("/demo/admin/temporal/advance", {seconds});
      caseStep("Claim state changed", `Chain time advanced by ${seconds}s after quote issuance`, "rejected");
    } else {
      await post("/demo/admin/maker", {approved: false});
      caseStep("Maker policy changed", "Operator revoked the quote maker after signing", "rejected");
    }
    await loadState();
    enforcementCase.status = "mutated";
    renderEnforcementCase();
  } catch (error) {
    caseStep("Policy mutation failed", error.message, "rejected");
  }
}
async function executeEnforcementCase() {
  if (!enforcementCase) return;
  $("caseExecute").disabled = true;
  try {
    const result = enforcementCase.type === "adapter-boundary"
      ? await post("/demo/enforcement/adapter-boundary", {walletId: enforcementCase.walletId})
      : await post("/demo/trade", {
          amountIn: enforcementCase.quote.quote.amountIn,
          action: enforcementCase.type === "maker-revocation" ? "revoked-maker" : "compliance-proof",
          quote: enforcementCase.quote
        });
    if (
      !result.rejection ||
      !result.attemptedTransaction ||
      result.attemptedTransaction.status !== 0 ||
      !result.balanceEvidence?.unchanged
    ) {
      throw Error("차단 결과에 실패 receipt와 잔액 불변 증거가 모두 포함되지 않았습니다.");
    }
    enforcementCase.result = result;
    enforcementCase.status = "blocked";
    caseStep(
      "Execution blocked",
      `${result.rejection} · block ${result.attemptedTransaction.blockNumber} · balances unchanged`,
      "passed"
    );
    await loadState();
  } catch (error) {
    caseStep("Evidence verification failed", error.message, "rejected");
  }
}
async function restoreEnforcementCase() {
  if (!enforcementCase) return;
  $("caseRestore").disabled = true;
  try {
    if (enforcementCase.type !== "adapter-boundary") {
      await post("/demo/enforcement/restore", {kind: enforcementCase.type});
    }
    await loadState();
    enforcementCase.status = "restored";
    caseStep("Case closed", "Mutable demo policy state restored to the scenario baseline", "passed");
  } catch (error) {
    caseStep("Restore failed", error.message, "rejected");
  }
}

function eventRow(e) { return `<div class="event"><span class="kind">${escapeHtml(e.name)}</span><div><strong>Block ${escapeHtml(e.blockNumber)}</strong><br><code>${escapeHtml(e.transactionHash)}</code></div><details><summary>details</summary><code>${escapeHtml(JSON.stringify(e.args))}</code></details></div>`; }
function renderEvents(events) {
  $("eventSummary").innerHTML = `<div><strong>${events.filter((e)=>e.name==="RFQSettled").length}</strong><span>Settled</span></div><div><strong>${events.filter((e)=>e.name==="RFQRejected").length}</strong><span>Rejected</span></div><div><strong>${events.length}</strong><span>Total</span></div>`;
  $("events").innerHTML = events.length ? events.slice().reverse().map(eventRow).join("") : '<div class="empty-row">이벤트가 없습니다.</div>';
}
async function refreshHistory() { try { renderEvents((await operatorApi("/api/v1/events")).events || []); } catch (error) { $("events").innerHTML = `<div class="empty-row">${escapeHtml(error.message)}</div>`; } }

document.querySelectorAll("[data-view]").forEach((button) => button.onclick = () => showView(button.dataset.view));
$("walletSelector").onchange = switchProfile;
$("range1m").onclick = () => setMarketRange("1m");
$("range5m").onclick = () => setMarketRange("5m");
$("range1h").onclick = () => setMarketRange("1h");
$("rangeAll").onclick = () => setMarketRange("all");
$("newRfq").onclick = beginNewRfq; $("newRfqFromList").onclick = beginNewRfq; $("portfolioRfq").onclick = beginNewRfq;
$("setupDemo").onclick = setupDemo; $("connect").onclick = check; $("rfqForm").onsubmit = requestQuote; $("proveCompliance").onclick = proveCompliance;
$("buySide").onclick = () => setTradeSide("buy"); $("sellSide").onclick = () => setTradeSide("sell");
$("amount").oninput = () => { clearTimeout(window.precheckTimer); window.precheckTimer = setTimeout(runPrecheck, 250); };
$("executeQuote").onclick = execute; $("closeConfirm").onclick = $("cancelConfirm").onclick = () => $("confirmBackdrop").classList.add("hidden");
$("adminRefresh").onclick = refreshAdmin; $("refresh").onclick = refreshHistory; $("revokeMaker").onclick = () => setMaker(false); $("restoreMaker").onclick = () => setMaker(true);
$("prepareTemporal").onclick = prepareTemporal; $("advanceTemporal").onclick = advanceTemporal;
$("caseCreate").onclick = createEnforcementCase;
$("casePrepare").onclick = prepareEnforcementCase;
$("caseQuote").onclick = issueEnforcementQuote;
$("caseMutate").onclick = mutateEnforcementPolicy;
$("caseExecute").onclick = executeEnforcementCase;
$("caseRestore").onclick = restoreEnforcementCase;
$("caseType").onchange = () => {
  if ($("caseType").value === "claim-expiry" && chainState) {
    $("caseWallet").value = chainState.presentation.temporalEligibility.walletId;
  }
};
$("openGuide").onclick = () => $("guideBackdrop").classList.remove("hidden"); $("closeGuide").onclick = () => $("guideBackdrop").classList.add("hidden");
$("notificationButton").onclick = () => $("notificationPanel").classList.toggle("hidden");
updateSummary();
check();
