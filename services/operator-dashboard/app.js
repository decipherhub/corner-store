const $ = (id) => document.getElementById(id);

let live = null;
let securityQuote = null;
let health = null;
let quoteTimer = null;
let activeFilter = "all";
let session = {
  rfqId: null,
  rfqStatus: null,
  quoteCount: 0,
  settledCount: 0,
  settledDelta: 0n,
  activities: []
};

const fixtures = [
  {name: "Falcon Markets", rate: "0.9998", total: "$4,999,000", validity: "8분", label: "Preview fixture"},
  {name: "Nomos Capital", rate: "1.0003", total: "$5,001,500", validity: "12분", label: "Preview fixture"}
];

const viewMeta = {
  dashboard: ["Overview", "Dashboard"],
  create: ["New request", "RFQ 거래"],
  rfqs: ["Requests & quotes", "My RFQs"],
  portfolio: ["Holdings", "Portfolio"],
  security: ["Advanced demo", "Security proof"],
  operator: ["Advanced demo", "Operator view"]
};

function endpoint(path) {
  return `${$("backend").value.replace(/\/$/, "")}${path}`;
}

async function api(path, init) {
  const response = await fetch(endpoint(path), init);
  const body = await response.json();
  if (!response.ok) throw Error(body.message || body.error || body.reason || "RFQ backend request failed");
  return body;
}

async function operatorApi(path) {
  const response = await fetch(path);
  const body = await response.json();
  if (!response.ok) throw Error(body.message || body.error || "Operator API request failed");
  return body;
}

function baseAmount(value) {
  if (!/^\d+(\.\d{1,18})?$/.test(value)) throw Error("금액은 소수점 18자리 이하의 양수로 입력하세요.");
  const [whole, fraction = ""] = value.split(".");
  const amount = (whole + fraction.padEnd(18, "0")).replace(/^0+/, "") || "0";
  if (BigInt(amount) <= 0n) throw Error("금액은 0보다 커야 합니다.");
  return amount;
}

function formatDisplay(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number.toLocaleString("en-US", {maximumFractionDigits: 4}) : value;
}

function formatTokenUnits(value) {
  const whole = value / 10n ** 18n;
  const fraction = value % 10n ** 18n;
  const fractionText = fraction.toString().padStart(18, "0").replace(/0+$/, "").slice(0, 4);
  return `${whole.toLocaleString("en-US")}${fractionText ? `.${fractionText}` : ""}`;
}

function shortAddress(value) {
  return value ? `${value.slice(0, 6)}…${value.slice(-4)}` : "—";
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[character]);
}

function quoteRate(signed) {
  const amountIn = BigInt(signed.quote.amountIn);
  const amountOut = BigInt(signed.quote.amountOut);
  return amountOut === 0n ? null : Number(amountIn * 1000000n / amountOut) / 1000000;
}

function setInlineStatus(id, message, kind = "") {
  const element = $(id);
  element.textContent = message;
  element.className = `inline-status ${kind}`;
}

function setComplianceState(state) {
  $("complianceStatus").className = `compliance-note ${state.makerApproved ? "" : "blocked"}`;
  $("complianceStatus").textContent = state.makerApproved
    ? "거래 준비 완료 · 체결 시점에 투자자, maker와 자산 정책을 다시 확인합니다."
    : "Maker 승인이 취소되어 거래할 수 없습니다. Dashboard에서 환경을 다시 준비하세요.";
}

function showView(view) {
  document.querySelectorAll(".view").forEach((section) => section.classList.toggle("hidden", section.id !== `${view}View`));
  document.querySelectorAll("[data-view]").forEach((button) => {
    const active = button.dataset.view === view;
    button.classList.toggle("active", active);
    button.setAttribute("aria-pressed", String(active));
  });
  const [kicker, title] = viewMeta[view] || viewMeta.dashboard;
  $("pageKicker").textContent = kicker;
  $("pageTitle").textContent = title;
  if (view === "operator") operator();
  window.scrollTo({top: 0, behavior: "smooth"});
}

function updateEstimate() {
  const raw = $("amount").value.trim();
  $("estimatedReceive").textContent = /^\d+(\.\d+)?$/.test(raw) ? `${formatDisplay(raw)} RWA` : "— RWA";
}

function addActivity(title, detail) {
  session.activities.unshift({title, detail, time: new Date()});
  session.activities = session.activities.slice(0, 5);
  $("homeActivity").innerHTML = session.activities.map((activity) => `
    <div class="activity-item">
      <div><strong>${activity.title}</strong><small>${activity.detail}</small></div>
      <time>${activity.time.toLocaleTimeString("ko-KR", {hour: "2-digit", minute: "2-digit"})}</time>
    </div>
  `).join("");
}

function updateSessionSummary() {
  $("activeRfqCount").textContent = session.rfqStatus === "quoted" ? "1" : "0";
  $("settledCount").textContent = String(session.settledCount);
  $("quoteCount").textContent = String(session.quoteCount);
  $("rfqNavCount").textContent = session.rfqId ? "1" : "0";
}

async function check() {
  try {
    setInlineStatus("setupStatus", "RFQ backend와 현재 maker 상태를 확인하고 있습니다.");
    const [backendHealth, state] = await Promise.all([api("/health"), api("/demo/state")]);
    health = backendHealth;
    $("walletAddress").textContent = shortAddress(backendHealth.taker);
    setComplianceState(state);
    setInlineStatus("setupStatus", state.ready ? "Backend와 온체인 RFQ 경로가 준비되었습니다." : "Backend는 연결됐지만 거래 경로가 준비되지 않았습니다.", state.ready ? "good" : "bad");
  } catch (error) {
    setInlineStatus("setupStatus", error.message, "bad");
  }
}

async function setupDemo() {
  $("setupDemo").disabled = true;
  $("setupChecks").classList.remove("hidden");
  setInlineStatus("setupStatus", "배포, 정책과 maker 승인을 확인하고 있습니다.");
  try {
    const [backendHealth, state, config, deployment, manifest] = await Promise.all([
      api("/health"),
      api("/demo/setup", {method: "POST", headers: {"content-type": "application/json"}, body: "{}"}),
      operatorApi("/api/v1/config"),
      operatorApi("/api/v1/deployment"),
      operatorApi("/api/v1/manifest")
    ]);
    health = backendHealth;
    $("walletAddress").textContent = shortAddress(backendHealth.taker);
    setComplianceState(state);
    const rows = [
      ["RFQ backend", backendHealth.demoSettlementEnabled ? "Ready" : "Settlement disabled"],
      ["Demo wallet", shortAddress(backendHealth.taker)],
      ["Maker", state.makerApproved ? "Approved" : "Revoked"],
      ["Asset profile", config.asset?.profile || "Configured"],
      ["Execution Router", deployment.router ? "Deployed" : "Missing"],
      ["Manifest", manifest.configured === false ? "Missing" : `Active · v${manifest.version}`]
    ];
    $("setupChecks").innerHTML = rows.map(([label, value]) => `<div><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong></div>`).join("");
    $("environmentBadge").textContent = state.ready ? "Ready" : "확인 필요";
    $("environmentBadge").className = `status-pill ${state.ready ? "live" : "warning"}`;
    setInlineStatus("setupStatus", state.ready ? "거래 준비가 완료되었습니다. 새 RFQ를 만들 수 있습니다." : "일부 구성요소가 준비되지 않았습니다.", state.ready ? "good" : "bad");
    addActivity("데모 환경 준비", "Backend, Router, Manifest와 maker 승인을 확인했습니다.");
  } catch (error) {
    $("environmentBadge").textContent = "오류";
    $("environmentBadge").className = "status-pill warning";
    $("setupChecks").innerHTML = "<div><span>Setup</span><strong>Incomplete</strong></div>";
    setInlineStatus("setupStatus", `준비 실패: ${error.message}. scripts/demo.sh를 다시 실행하세요.`, "bad");
  } finally {
    $("setupDemo").disabled = false;
  }
}

async function requestQuote(event) {
  event?.preventDefault();
  $("requestQuote").disabled = true;
  setInlineStatus("status", "Maker 승인 상태를 확인하고 있습니다.");
  try {
    const state = await api("/demo/state");
    setComplianceState(state);
    if (!state.makerApproved) throw Error("Maker 승인이 취소되었습니다. Dashboard에서 데모 환경을 다시 준비하세요.");
    const amountIn = baseAmount($("amount").value.trim());
    const ttlSeconds = Number($("ttl").value);
    const signed = await api("/demo/quote", {
      method: "POST",
      headers: {"content-type": "application/json"},
      body: JSON.stringify({amountIn, ttlSeconds, taker: health?.taker || state.investor})
    });
    live = signed?.quote?.quote ? signed.quote : signed;
    session.rfqId = `#${String(live.quote.nonce).slice(-6)}`;
    session.rfqStatus = "quoted";
    session.quoteCount += 1;
    renderQuote(live);
    updateSessionSummary();
    addActivity("Firm quote 도착", `BUIDL-like 매수 · ${formatDisplay($("amount").value)} QUOTE`);
    setInlineStatus("status", "견적이 도착했습니다. My RFQs에서 비교하고 수락하세요.", "good");
    showView("rfqs");
  } catch (error) {
    setInlineStatus("status", error.message, "bad");
  } finally {
    $("requestQuote").disabled = false;
  }
}

function renderQuote(signed) {
  if (quoteTimer) clearTimeout(quoteTimer);
  const expiry = Number(signed.quote.expiry) * 1000;
  const rate = quoteRate(signed);
  renderRfqRows();
  $("selectedRfqId").textContent = session.rfqId || "New";
  $("quoteComparison").classList.remove("hidden");
  $("quoteCards").innerHTML = `
    <article class="quote-card live">
      <div class="maker-line"><strong>Meridian OTC</strong><span>Live · executable</span></div>
      <strong class="rate">${rate?.toFixed(4) || "—"}</strong>
      <small>QUOTE / RWA</small>
      <dl>
        <div><dt>총 결제</dt><dd>${signed.quote.amountIn} base units</dd></div>
        <div><dt>예상 수령</dt><dd>${signed.quote.amountOut} base units</dd></div>
        <div><dt>유효시간</dt><dd id="liveExpiry">계산 중</dd></div>
        <div><dt>Maker</dt><dd>${shortAddress(signed.quote.maker)}</dd></div>
      </dl>
      <button id="selectLive" class="primary">이 견적 선택</button>
    </article>
    ${fixtures.map((fixture) => `
      <article class="quote-card preview">
        <div class="maker-line"><strong>${fixture.name}</strong><span>${fixture.label}</span></div>
        <strong class="rate">${fixture.rate}</strong>
        <small>Indicative only</small>
        <dl>
          <div><dt>예상 총액</dt><dd>${fixture.total}</dd></div>
          <div><dt>표시 유효시간</dt><dd>${fixture.validity}</dd></div>
          <div><dt>상태</dt><dd>미연동</dd></div>
        </dl>
        <button class="secondary" disabled>Preview only</button>
      </article>
    `).join("")}
  `;
  $("selectLive").onclick = selectQuote;

  const tick = () => {
    if (live !== signed) return;
    const seconds = Math.ceil((expiry - Date.now()) / 1000);
    const expiryElement = $("liveExpiry");
    if (!expiryElement) return;
    if (seconds <= 0) {
      expiryElement.textContent = "Expired";
      $("quoteExpiryBadge").textContent = "Expired";
      $("quoteExpiryBadge").className = "status-pill warning";
      session.rfqStatus = "expired";
      renderRfqRows();
      live = null;
      return;
    }
    expiryElement.textContent = `${Math.floor(seconds / 60)}분 ${seconds % 60}초`;
    $("quoteExpiryBadge").textContent = "Live";
    quoteTimer = setTimeout(tick, 1000);
  };
  tick();
}

function renderRfqRows() {
  if (!session.rfqId) return;
  const statusLabel = session.rfqStatus === "accepted" ? "Accepted" : session.rfqStatus === "expired" ? "Expired" : "Quoted";
  const visible = activeFilter === "all" || activeFilter === session.rfqStatus;
  $("rfqRows").innerHTML = visible ? `
    <tr>
      <td><strong>${session.rfqId}</strong></td>
      <td>BUIDL-like RWA</td>
      <td>매수</td>
      <td>${formatDisplay($("amount").value)}</td>
      <td><span class="status-pill ${session.rfqStatus === "accepted" ? "live" : session.rfqStatus === "expired" ? "warning" : "neutral"}">${statusLabel}</span></td>
      <td>${session.quoteCount}개 ${session.rfqStatus === "quoted" ? "live" : "received"}</td>
      <td><button id="viewQuote" class="text-button">${session.rfqStatus === "accepted" ? "결과 보기" : "견적 보기"} →</button></td>
    </tr>
  ` : `<tr><td colspan="7"><div class="empty-row">이 상태의 RFQ가 없습니다.</div></td></tr>`;
  const viewButton = $("viewQuote");
  if (viewButton) viewButton.onclick = () => {
    $("quoteComparison").classList.remove("hidden");
    $("quoteComparison").scrollIntoView({behavior: "smooth", block: "start"});
  };
}

function selectQuote() {
  if (!live) {
    setInlineStatus("status", "이 quote는 만료됐습니다. 새 RFQ를 만들어주세요.", "bad");
    showView("create");
    return;
  }
  if (Number(live.quote.expiry) * 1000 <= Date.now()) {
    live = null;
    session.rfqStatus = "expired";
    renderRfqRows();
    return;
  }
  $("review").innerHTML = `
    <div><span>자산</span><strong>BUIDL-like Treasury Fund</strong></div>
    <div><span>Maker</span><strong>Meridian OTC · ${shortAddress(live.quote.maker)}</strong></div>
    <div><span>결제 금액</span><strong>${live.quote.amountIn} base units</strong></div>
    <div><span>수령 수량</span><strong>${live.quote.amountOut} base units</strong></div>
    <div><span>Nonce</span><strong>${live.quote.nonce}</strong></div>
    <div><span>Signature</span><strong>${live.signature}</strong></div>
    <details class="payload-review">
      <summary>Router에 제출할 전체 signed quote payload</summary>
      <pre>${escapeHtml(JSON.stringify(live, null, 2))}</pre>
    </details>
  `;
  openModal("confirmBackdrop", "closeConfirm");
}

async function execute() {
  if (!live) return;
  $("executeQuote").disabled = true;
  $("executeQuote").textContent = "체결 중…";
  try {
    const signed = live;
    const result = await api("/demo/trade", {
      method: "POST",
      headers: {"content-type": "application/json"},
      body: JSON.stringify({amountIn: signed.quote.amountIn, action: "settle", quote: signed})
    });
    if (quoteTimer) clearTimeout(quoteTimer);
    quoteTimer = null;
    session.rfqStatus = "accepted";
    session.settledCount += 1;
    session.settledDelta += BigInt(result.transaction?.rwaDelta || "0");
    const updatedHolding = 25_000_000n * 10n ** 18n + session.settledDelta;
    const updatedHoldingText = formatTokenUnits(updatedHolding);
    $("buidlHolding").textContent = updatedHoldingText;
    $("buidlValue").textContent = `$${updatedHoldingText}`;
    $("buidlData").textContent = "Fixture base + live delta";
    $("result").classList.remove("hidden");
    $("result").innerHTML = `<div class="inline-status good"><strong>체결 완료</strong><br>Block ${result.transaction?.blockNumber || "—"} · RWA +${result.transaction?.rwaDelta || "—"} base units<br><small>${result.transaction?.hash || "—"}</small></div>`;
    $("portfolioDelta").className = "inline-status good";
    $("portfolioDelta").textContent = `이번 세션 실제 체결: +${session.settledDelta.toString()} RWA base units`;
    const selectedButton = $("selectLive");
    if (selectedButton) {
      selectedButton.disabled = true;
      selectedButton.textContent = "체결 완료";
    }
    addActivity("RFQ 체결 완료", `Block ${result.transaction?.blockNumber || "—"} · Meridian OTC`);
    live = null;
    updateSessionSummary();
    renderRfqRows();
    closeModal("confirmBackdrop");
    $("quoteExpiryBadge").textContent = "Accepted";
    $("quoteExpiryBadge").className = "status-pill live";
    showView("portfolio");
  } catch (error) {
    $("result").classList.remove("hidden");
    $("result").innerHTML = `<div class="inline-status bad">체결 실패: ${escapeHtml(error.message)}</div>`;
  } finally {
    $("executeQuote").disabled = !live;
    $("executeQuote").textContent = "견적 수락 및 체결";
  }
}

async function prepareSecurityQuote() {
  $("securityPrepare").disabled = true;
  setInlineStatus("securityStatus", "현재 maker 승인 상태를 확인하고 있습니다.");
  try {
    const state = await api("/demo/state");
    setComplianceState(state);
    if (!state.makerApproved) {
      $("securityRestore").disabled = false;
      throw Error("Maker가 이미 취소 상태입니다. 먼저 복구하세요.");
    }
    securityQuote = await api("/demo/quote", {
      method: "POST",
      headers: {"content-type": "application/json"},
      body: JSON.stringify({amountIn: baseAmount($("securityAmount").value.trim()), taker: state.investor})
    });
    $("securityQuote").classList.remove("hidden");
    $("securityQuote").textContent = `maker=${securityQuote.quote.maker} nonce=${securityQuote.quote.nonce} signature=${securityQuote.signature.slice(0, 22)}…`;
    $("securityRevoke").disabled = false;
    $("securityRestore").disabled = true;
    setInlineStatus("securityStatus", "승인 상태에서 quote를 저장했습니다. 이제 maker를 취소하고 같은 quote를 제출합니다.", "good");
  } catch (error) {
    setInlineStatus("securityStatus", error.message, "bad");
    $("securityPrepare").disabled = false;
  }
}

async function revokeSecurity() {
  if (!securityQuote) return;
  $("securityRevoke").disabled = true;
  setInlineStatus("securityStatus", "Maker를 취소한 뒤 저장된 quote를 제출하고 있습니다.");
  try {
    const result = await api("/demo/trade", {
      method: "POST",
      headers: {"content-type": "application/json"},
      body: JSON.stringify({amountIn: securityQuote.quote.amountIn, action: "revoked-maker", quote: securityQuote})
    });
    if (result.rejection !== "RFQMakerNotApproved") throw Error(`예상하지 못한 결과: ${result.rejection || "missing reason"}`);
    const state = await api("/demo/state");
    setComplianceState(state);
    $("securityResult").classList.remove("hidden");
    $("securityResult").innerHTML = `<div class="inline-status good"><strong>Router가 체결을 차단했습니다.</strong><br>${result.rejection}</div>`;
    $("securityRestore").disabled = false;
    setInlineStatus("securityStatus", "예상대로 차단됐으며 maker는 복구 전까지 취소 상태입니다.", "good");
    addActivity("Security proof 완료", "Maker 취소 후 RFQMakerNotApproved로 차단");
  } catch (error) {
    setInlineStatus("securityStatus", error.message, "bad");
    $("securityRevoke").disabled = false;
  }
}

async function restoreSecurity() {
  $("securityRestore").disabled = true;
  setInlineStatus("securityStatus", "Maker 승인을 복구하고 있습니다.");
  try {
    const state = await api("/demo/restore", {method: "POST", headers: {"content-type": "application/json"}, body: "{}"});
    setComplianceState(state);
    securityQuote = null;
    $("securityQuote").classList.add("hidden");
    $("securityResult").classList.add("hidden");
    $("securityPrepare").disabled = false;
    $("securityRevoke").disabled = true;
    setInlineStatus("securityStatus", "Maker 승인을 복구했습니다. 테스트를 다시 실행할 수 있습니다.", "good");
  } catch (error) {
    setInlineStatus("securityStatus", error.message, "bad");
    $("securityRestore").disabled = false;
  }
}

async function operator() {
  $("refresh").disabled = true;
  try {
    const [config, deployment, manifest, eventPayload] = await Promise.all([
      operatorApi("/api/v1/config"),
      operatorApi("/api/v1/deployment"),
      operatorApi("/api/v1/manifest"),
      operatorApi("/api/v1/events")
    ]);
    $("deployment").innerHTML = Object.entries(deployment).map(([key, value]) => `<div><span>${escapeHtml(key)}</span><strong>${escapeHtml(value || "—")}</strong></div>`).join("");
    $("policy").innerHTML = `
      <div><span>Asset profile</span><strong>${escapeHtml(config.asset?.profile || "—")}</strong></div>
      <div><span>Manifest status</span><strong>${escapeHtml(manifest.configured === false ? "Not available" : (["UNKNOWN", "UNREGULATED", "ACTIVE", "SUSPENDED", "PROPOSED", "RETIRED"][manifest.status] || manifest.status))}</strong></div>
      <div><span>Manifest version</span><strong>${escapeHtml(manifest.configured === false ? "—" : manifest.version)}</strong></div>
      <div><span>Recipe bindings</span><strong>${escapeHtml(manifest.configured === false ? "—" : manifest.recipeBindingCount)}</strong></div>
    `;
    const events = eventPayload.events || [];
    const settled = events.filter((event) => event.name === "RFQSettled").length;
    const makerChanges = events.filter((event) => event.name === "MakerApprovalSet").length;
    const latestBlock = events.reduce((latest, event) => Math.max(latest, Number(event.blockNumber) || 0), 0);
    $("eventSummary").innerHTML = `<div><strong>${settled}</strong><span>Settled</span></div><div><strong>${makerChanges}</strong><span>Maker changes</span></div><div><strong>${latestBlock || "—"}</strong><span>Latest block</span></div>`;
    $("events").innerHTML = events.length ? events.slice().reverse().map((event) => `
      <div class="event"><span class="kind">${escapeHtml(event.name)}</span><div><strong>Block ${escapeHtml(event.blockNumber)}</strong><br><code>${escapeHtml(event.transactionHash)}</code></div><details><summary>details</summary><code>${escapeHtml(JSON.stringify(event.args))}</code></details></div>
    `).join("") : `<div class="empty-row">아직 indexed event가 없습니다. RFQ를 체결하거나 Security proof를 실행하세요.</div>`;
  } catch (error) {
    $("events").innerHTML = `<div class="empty-row">Operator 데이터를 불러오지 못했습니다: ${escapeHtml(error.message)}</div>`;
  } finally {
    $("refresh").disabled = false;
  }
}

function filterRfqs(filter, button) {
  activeFilter = filter;
  document.querySelectorAll("[data-filter]").forEach((tab) => {
    const active = tab === button;
    tab.classList.toggle("active", active);
    tab.setAttribute("aria-pressed", String(active));
  });
  renderRfqRows();
}

let modalFocus = null;
function openModal(backdropId, focusId) {
  modalFocus = document.activeElement;
  $(backdropId).classList.remove("hidden");
  document.body.classList.add("modal-open");
  $(focusId).focus();
}

function closeModal(backdropId) {
  $(backdropId).classList.add("hidden");
  if ($("confirmBackdrop").classList.contains("hidden") && $("guideBackdrop").classList.contains("hidden")) document.body.classList.remove("modal-open");
  modalFocus?.focus();
}

function trapModalKeys(event) {
  const backdrop = !$("confirmBackdrop").classList.contains("hidden") ? $("confirmBackdrop") : !$("guideBackdrop").classList.contains("hidden") ? $("guideBackdrop") : null;
  if (!backdrop) return;
  if (event.key === "Escape") {
    closeModal(backdrop.id);
    if (backdrop.id === "guideBackdrop") $("openGuide").setAttribute("aria-expanded", "false");
    return;
  }
  if (event.key !== "Tab") return;
  const focusable = [...backdrop.querySelectorAll("button,[href],input,select,[tabindex]:not([tabindex='-1'])")].filter((element) => !element.disabled);
  const first = focusable[0];
  const last = focusable[focusable.length - 1];
  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault();
    first.focus();
  }
}

document.querySelectorAll("[data-view]").forEach((button) => button.onclick = () => showView(button.dataset.view));
document.querySelectorAll("[data-filter]").forEach((button) => button.onclick = () => filterRfqs(button.dataset.filter, button));
$("newRfq").onclick = () => showView("create");
$("newRfqFromList").onclick = () => showView("create");
$("emptyNewRfq").onclick = () => showView("create");
$("portfolioRfq").onclick = () => showView("create");
$("setupDemo").onclick = setupDemo;
$("connect").onclick = check;
$("rfqForm").onsubmit = requestQuote;
$("amount").oninput = updateEstimate;
$("buySide").onclick = () => {
  $("buySide").classList.add("active");
  $("buySide").setAttribute("aria-pressed", "true");
};
$("executeQuote").onclick = execute;
$("closeConfirm").onclick = () => closeModal("confirmBackdrop");
$("cancelConfirm").onclick = () => closeModal("confirmBackdrop");
$("confirmBackdrop").onclick = (event) => { if (event.target === $("confirmBackdrop")) closeModal("confirmBackdrop"); };
$("securityPrepare").onclick = prepareSecurityQuote;
$("securityRevoke").onclick = revokeSecurity;
$("securityRestore").onclick = restoreSecurity;
$("refresh").onclick = operator;
$("openGuide").onclick = () => {
  $("openGuide").setAttribute("aria-expanded", "true");
  openModal("guideBackdrop", "closeGuide");
};
$("closeGuide").onclick = () => {
  $("openGuide").setAttribute("aria-expanded", "false");
  closeModal("guideBackdrop");
};
$("guideBackdrop").onclick = (event) => {
  if (event.target === $("guideBackdrop")) {
    $("openGuide").setAttribute("aria-expanded", "false");
    closeModal("guideBackdrop");
  }
};
$("notificationButton").onclick = () => {
  const hidden = $("notificationPanel").classList.toggle("hidden");
  $("notificationButton").setAttribute("aria-expanded", String(!hidden));
};
document.addEventListener("keydown", trapModalKeys);
updateEstimate();
updateSessionSummary();
