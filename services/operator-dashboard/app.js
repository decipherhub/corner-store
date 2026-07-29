const $ = (id) => document.getElementById(id);
const profiles = {admin: {id: "admin", label: "Admin", role: "admin", address: null}};
const viewMeta = {
  dashboard: ["Overview", "Dashboard"], create: ["New request", "RFQ 거래"], rfqs: ["Requests & quotes", "My RFQs"],
  portfolio: ["Holdings", "Portfolio"], adminDashboard: ["Admin", "Dashboard"], adminMonitoring: ["Admin", "RFQ 모니터링"],
  adminUsers: ["Admin", "사용자 / 화이트리스트"], adminMaker: ["Admin", "Maker 관리"], adminHistory: ["Admin", "거래 내역"]
};
let currentProfile = profiles.admin;
let chainState = null;
let stateLoadedAt = Date.now();
let presentationInitialized = false;
let precheck = null;
let live = null;
let quoteConsumed = false;
let quoteTimer = null;
let tradeSide = "buy";
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
function chainNow() { return Number(chainState?.chainTimestamp || 0) + Math.floor((Date.now() - stateLoadedAt) / 1000); }
function referencePrice() {
  const asset = chainState.presentation.asset;
  return `${asset.referenceCurrency} ${Number(asset.referencePrice).toLocaleString()}`;
}
function quoteRate(quote) {
  const scaled = BigInt(quote.amountOut) * 10000n / BigInt(quote.amountIn);
  return `${scaled / 10000n}.${(scaled % 10000n).toString().padStart(4, "0")}`;
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
  chainState = await api("/demo/state");
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
  $("assetReferencePrice").textContent = `${referencePrice()} · scenario`;
  $("portfolioReferencePrice").textContent = `${referencePrice()} · scenario`;
  $("minimumHelp").textContent = `주입된 최소 투자금액 ${minimum} · ${asset.decimals} decimals`;
  if (firstLoad || !$("amount").value) $("amount").value = minimum;
  $("liveMakerDescription").textContent = chainState.presentation.maker.label;
  updateSidePresentation();
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
  updateSidePresentation();
  await runPrecheck();
  updateSummary();
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
    const latest = await runPrecheck();
    $("dashboardEligibility").textContent = latest?.allowed
      ? `현재 지갑은 ${chainState.assetProfile} RFQ 거래가 가능합니다.`
      : "현재 지갑은 조회만 가능하며 RFQ 거래는 차단됩니다.";
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
    $("setupChecks").innerHTML = `<div><span>RFQ backend</span><strong>Ready</strong></div><div><span>Maker</span><strong>${chainState.makerApproved ? "Approved" : "Revoked"}</strong></div><div><span>Demo wallets</span><strong>${chainState.wallets.length} loaded</strong></div>`;
    setStatus("setupStatus", "클릭형 RFQ 데모가 준비되었습니다.", "good");
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
  $("quoteCards").innerHTML = `<article class="quote-card live"><div class="maker-line"><strong>${escapeHtml(maker)}</strong><span>${quoteConsumed ? "Settled · consumed" : "Live · executable"}</span></div><strong class="rate">${liveRate}</strong><small>${tradeSide === "buy" ? "매수" : "매도"} · Backend-generated firm quote</small><dl><div><dt>Pay</dt><dd>${formatBaseUnits(live.quote.amountIn, input.decimals)} ${escapeHtml(input.symbol)}</dd></div><div><dt>Receive</dt><dd>${formatBaseUnits(live.quote.amountOut, output.decimals)} ${escapeHtml(output.symbol)}</dd></div><div><dt>유효시간</dt><dd id="liveExpiry">${quoteConsumed ? "Consumed" : "—"}</dd></div><div><dt>Taker</dt><dd>${shortAddress(live.quote.taker)}</dd></div></dl><button id="selectLive" class="primary" ${quoteConsumed ? "disabled" : ""}>${quoteConsumed ? "체결 완료" : "이 견적 검토"}</button></article>${chainState.presentation.previewQuotes.map((quote) => `<article class="quote-card preview"><div class="maker-line"><strong>${escapeHtml(quote.maker)}</strong><span>Scenario fixture</span></div><strong class="rate">${escapeHtml(quote.rate)}</strong><small>Indicative only</small><button class="secondary" disabled>Preview only</button></article>`).join("")}`;
  if (!quoteConsumed) $("selectLive").onclick = selectQuote;
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
  $("confirmBackdrop").classList.remove("hidden");
}
async function execute() {
  if (!live) return;
  $("executeQuote").disabled = true;
  try {
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
    $("adminUserRows").innerHTML = chainState.wallets.map((w) => `<tr><td><strong>${escapeHtml(w.label)}</strong></td><td><code>${shortAddress(w.address)}</code></td><td><span class="status-pill ${w.qualifiedPurchaser ? "live" : "warning"}">${w.qualifiedPurchaser ? "Eligible" : escapeHtml(w.eligibilityReason || "Ineligible")}</span>${w.expiresAt ? `<small>expires ${new Date(w.expiresAt * 1000).toLocaleTimeString("ko-KR")}</small>` : ""}</td><td><button class="${w.qualifiedPurchaser ? "danger" : "primary"} admin-user-toggle" data-wallet="${escapeHtml(w.id)}" data-eligible="${!w.qualifiedPurchaser}">${w.qualifiedPurchaser ? "적격 해제" : "적격 부여"}</button></td></tr>`).join("");
    document.querySelectorAll(".admin-user-toggle").forEach((button) => button.onclick = () => toggleUser(button));
    $("makerFacts").innerHTML = `<div><span>Maker</span><strong>${escapeHtml(chainState.presentation.maker.label)} · ${shortAddress(chainState.maker)}</strong></div><div><span>상태</span><strong>${chainState.makerApproved ? "Active" : "Cancelled"}</strong></div>`;
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
async function toggleUser(button) {
  button.disabled = true;
  try {
    const updated = await post("/demo/admin/user", {walletId: button.dataset.wallet, eligible: button.dataset.eligible === "true"});
    setStatus("adminUserStatus", `${updated.label}: ${updated.qualifiedPurchaser ? "적격" : "비적격"}로 변경되었습니다.`, "good"); await refreshAdmin();
  } catch (error) { setStatus("adminUserStatus", error.message, "bad"); }
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
function eventRow(e) { return `<div class="event"><span class="kind">${escapeHtml(e.name)}</span><div><strong>Block ${escapeHtml(e.blockNumber)}</strong><br><code>${escapeHtml(e.transactionHash)}</code></div><details><summary>details</summary><code>${escapeHtml(JSON.stringify(e.args))}</code></details></div>`; }
function renderEvents(events) {
  $("eventSummary").innerHTML = `<div><strong>${events.filter((e)=>e.name==="RFQSettled").length}</strong><span>Settled</span></div><div><strong>${events.filter((e)=>e.name==="RFQRejected").length}</strong><span>Rejected</span></div><div><strong>${events.length}</strong><span>Total</span></div>`;
  $("events").innerHTML = events.length ? events.slice().reverse().map(eventRow).join("") : '<div class="empty-row">이벤트가 없습니다.</div>';
}
async function refreshHistory() { try { renderEvents((await operatorApi("/api/v1/events")).events || []); } catch (error) { $("events").innerHTML = `<div class="empty-row">${escapeHtml(error.message)}</div>`; } }

document.querySelectorAll("[data-view]").forEach((button) => button.onclick = () => showView(button.dataset.view));
$("walletSelector").onchange = switchProfile;
$("newRfq").onclick = () => showView("create"); $("newRfqFromList").onclick = () => showView("create"); $("portfolioRfq").onclick = () => showView("create");
$("setupDemo").onclick = setupDemo; $("connect").onclick = check; $("rfqForm").onsubmit = requestQuote; $("proveCompliance").onclick = proveCompliance;
$("buySide").onclick = () => setTradeSide("buy"); $("sellSide").onclick = () => setTradeSide("sell");
$("amount").oninput = () => { clearTimeout(window.precheckTimer); window.precheckTimer = setTimeout(runPrecheck, 250); };
$("executeQuote").onclick = execute; $("closeConfirm").onclick = $("cancelConfirm").onclick = () => $("confirmBackdrop").classList.add("hidden");
$("adminRefresh").onclick = refreshAdmin; $("refresh").onclick = refreshHistory; $("revokeMaker").onclick = () => setMaker(false); $("restoreMaker").onclick = () => setMaker(true);
$("prepareTemporal").onclick = prepareTemporal; $("advanceTemporal").onclick = advanceTemporal;
$("openGuide").onclick = () => $("guideBackdrop").classList.remove("hidden"); $("closeGuide").onclick = () => $("guideBackdrop").classList.add("hidden");
$("notificationButton").onclick = () => $("notificationPanel").classList.toggle("hidden");
updateSummary();
check();
