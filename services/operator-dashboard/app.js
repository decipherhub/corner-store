const $ = (id) => document.getElementById(id);
const profiles = {
  admin: {id: "admin", label: "Admin", role: "admin", address: null},
  "eligible-a": {id: "eligible-a", label: "적격투자자 A", role: "user", address: null},
  "eligible-b": {id: "eligible-b", label: "적격투자자 B", role: "user", address: null},
  ineligible: {id: "ineligible", label: "비적격투자자", role: "user", address: null}
};
const viewMeta = {
  dashboard: ["Overview", "Dashboard"], create: ["New request", "RFQ 거래"], rfqs: ["Requests & quotes", "My RFQs"],
  portfolio: ["Holdings", "Portfolio"], adminDashboard: ["Admin", "Dashboard"], adminMonitoring: ["Admin", "RFQ 모니터링"],
  adminUsers: ["Admin", "사용자 / 화이트리스트"], adminMaker: ["Admin", "Maker 관리"], adminHistory: ["Admin", "거래 내역"]
};
const fixtures = [
  {name: "Falcon Markets", rate: "0.9998", label: "Preview fixture"},
  {name: "Nomos Capital", rate: "1.0003", label: "Preview fixture"}
];
let currentProfile = profiles["eligible-a"];
let chainState = null;
let precheck = null;
let live = null;
let quoteConsumed = false;
let quoteTimer = null;
let session = {rfqId: null, status: null, quoteCount: 0, settledCount: 0, delta: 0n, activities: []};

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
function baseAmount(value) {
  if (!/^\d+(\.\d{1,18})?$/.test(value)) throw Error("금액은 소수점 18자리 이하의 양수여야 합니다.");
  const [whole, fraction = ""] = value.split(".");
  const amount = (whole + fraction.padEnd(18, "0")).replace(/^0+/, "") || "0";
  if (BigInt(amount) <= 0n) throw Error("금액은 0보다 커야 합니다.");
  return amount;
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
  for (const wallet of chainState.wallets || []) Object.assign(profiles[wallet.id], wallet);
  currentProfile = profiles[$("walletSelector").value];
  $("walletAddress").textContent = currentProfile.role === "admin" ? shortAddress(chainState.maker) : shortAddress(currentProfile.address);
  return chainState;
}
async function switchProfile() {
  currentProfile = profiles[$("walletSelector").value];
  const admin = currentProfile.role === "admin";
  const qpRequired = chainState?.requiresQualifiedPurchaser;
  $("userNav").classList.toggle("hidden", admin);
  $("adminNav").classList.toggle("hidden", !admin);
  $("walletAddress").textContent = admin ? shortAddress(chainState?.maker) : shortAddress(currentProfile.address);
  $("roleBanner").classList.toggle("hidden", admin || !qpRequired || currentProfile.qualifiedPurchaser);
  $("roleBanner").innerHTML = admin ? "" : "<strong>현재 지갑은 적격투자자가 아닙니다.</strong> Qualified Purchaser claim missing";
  if (admin) showView("adminDashboard");
  else {
    showView("dashboard");
    const latest = await runPrecheck();
    $("dashboardEligibility").textContent = latest?.allowed
      ? `현재 지갑은 ${chainState.assetProfile} RFQ 거래가 가능합니다.`
      : "현재 지갑은 조회만 가능하며 RFQ 거래는 차단됩니다.";
    $("newRfq").disabled = !latest?.allowed;
    $("portfolioRfq").disabled = !latest?.allowed;
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
    precheck = await post("/demo/precheck", {taker: currentProfile.address, amountIn});
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
    live = await post("/demo/quote", {taker: wallet.address, amountIn: latest.amountIn, ttlSeconds: Number($("ttl").value)});
    quoteConsumed = false;
    session.rfqId = `#${String(live.quote.nonce).slice(-6)}`; session.status = "quoted"; session.quoteCount += 1;
    addActivity("Firm quote 도착", `${wallet.label} · Meridian OTC`);
    renderQuote(); updateSummary(); showView("rfqs");
  } catch (error) { setStatus("status", error.message, "bad"); }
  finally { $("requestQuote").disabled = !precheck?.allowed; }
}
function renderRfqRows() {
  if (!live) return;
  const owner = Object.values(profiles).find((p) => p.address?.toLowerCase() === live.quote.taker.toLowerCase());
  $("rfqRows").innerHTML = `<tr><td><strong>${session.rfqId}</strong></td><td>${escapeHtml(owner?.label || shortAddress(live.quote.taker))}</td><td>BUIDL-like RWA</td><td><span class="status-pill neutral">${session.status}</span></td><td>1 live + 2 preview</td><td><button id="viewQuote" class="text-button">견적 보기 →</button></td></tr>`;
  $("viewQuote").onclick = () => $("quoteComparison").scrollIntoView({behavior:"smooth"});
}
function renderQuote() {
  renderRfqRows(); $("quoteComparison").classList.remove("hidden");
  $("quoteCards").innerHTML = `<article class="quote-card live"><div class="maker-line"><strong>Meridian OTC</strong><span>${quoteConsumed ? "Settled · consumed" : "Live · executable"}</span></div><strong class="rate">1.0000</strong><small>참고가격 대비 0.00%</small><dl><div><dt>Pay</dt><dd>${live.quote.amountIn}</dd></div><div><dt>Receive</dt><dd>${live.quote.amountOut}</dd></div><div><dt>유효시간</dt><dd id="liveExpiry">${quoteConsumed ? "Consumed" : "—"}</dd></div><div><dt>Taker</dt><dd>${shortAddress(live.quote.taker)}</dd></div></dl><button id="selectLive" class="primary" ${quoteConsumed ? "disabled" : ""}>${quoteConsumed ? "체결 완료" : "이 견적 검토"}</button></article>${fixtures.map((f) => `<article class="quote-card preview"><div class="maker-line"><strong>${f.name}</strong><span>${f.label}</span></div><strong class="rate">${f.rate}</strong><small>Indicative only</small><button class="secondary" disabled>Preview only</button></article>`).join("")}`;
  if (!quoteConsumed) $("selectLive").onclick = selectQuote;
  if (quoteTimer) clearTimeout(quoteTimer);
  if (quoteConsumed) return;
  const tick = () => {
    if (!live) return;
    const left = Number(live.quote.expiry) - Math.floor(Date.now()/1000);
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
  $("review").innerHTML = `<div><span>Maker</span><strong>Meridian OTC</strong></div><div><span>Taker</span><strong>${shortAddress(live.quote.taker)}</strong></div><div><span>Amount</span><strong>${live.quote.amountIn}</strong></div><div><span>Nonce</span><strong>${live.quote.nonce}</strong></div><details class="payload-review"><summary>Signed quote payload</summary><pre>${escapeHtml(JSON.stringify(live,null,2))}</pre></details>`;
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
      session.status = "accepted"; session.settledCount += 1; session.delta += BigInt(result.transaction.rwaDelta);
      quoteConsumed = true;
      if (quoteTimer) clearTimeout(quoteTimer);
      $("result").innerHTML = `<div class="inline-status good"><strong>체결 완료</strong><br>Block ${result.transaction.blockNumber}<br><small>${result.transaction.hash}</small></div>`;
      $("portfolioDelta").textContent = `현재 세션 실제 체결: +${session.delta} base units`;
      addActivity("RFQ 체결 완료", `Block ${result.transaction.blockNumber}`);
    }
    $("confirmBackdrop").classList.add("hidden"); updateSummary(); renderQuote(); await loadState();
  } catch (error) { $("result").innerHTML = `<div class="inline-status bad">체결 실패: ${escapeHtml(error.message)}</div>`; }
  finally { $("executeQuote").disabled = quoteConsumed; }
}
async function proveCompliance() {
  try {
    const latest = await runPrecheck();
    if (latest?.wallet.qualifiedPurchaser) throw Error("비적격 지갑에서 실행하세요.");
    const quote = await post("/demo/quote", {taker: currentProfile.address, amountIn: latest.amountIn, ttlSeconds: 300});
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
    $("adminUserRows").innerHTML = chainState.wallets.map((w) => `<tr><td><strong>${escapeHtml(w.label)}</strong></td><td><code>${shortAddress(w.address)}</code></td><td><span class="status-pill ${w.qualifiedPurchaser ? "live" : "warning"}">${w.qualifiedPurchaser ? "Eligible" : "Ineligible"}</span></td><td><button class="${w.qualifiedPurchaser ? "danger" : "primary"} admin-user-toggle" data-wallet="${w.id}" data-eligible="${!w.qualifiedPurchaser}">${w.qualifiedPurchaser ? "적격 해제" : "적격 부여"}</button></td></tr>`).join("");
    document.querySelectorAll(".admin-user-toggle").forEach((button) => button.onclick = () => toggleUser(button));
    $("makerFacts").innerHTML = `<div><span>Maker</span><strong>Meridian OTC · ${shortAddress(chainState.maker)}</strong></div><div><span>상태</span><strong>${chainState.makerApproved ? "Active" : "Cancelled"}</strong></div>`;
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
$("amount").oninput = () => { clearTimeout(window.precheckTimer); window.precheckTimer = setTimeout(runPrecheck, 250); };
$("executeQuote").onclick = execute; $("closeConfirm").onclick = $("cancelConfirm").onclick = () => $("confirmBackdrop").classList.add("hidden");
$("adminRefresh").onclick = refreshAdmin; $("refresh").onclick = refreshHistory; $("revokeMaker").onclick = () => setMaker(false); $("restoreMaker").onclick = () => setMaker(true);
$("openGuide").onclick = () => $("guideBackdrop").classList.remove("hidden"); $("closeGuide").onclick = () => $("guideBackdrop").classList.add("hidden");
$("notificationButton").onclick = () => $("notificationPanel").classList.toggle("hidden");
updateSummary();
check();
