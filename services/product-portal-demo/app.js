(() => {
  "use strict";

  const Model = window.PortalModel;
  const STORAGE_KEY = "corner-store-product-portal-demo-v3";
  const app = document.querySelector("#app");
  const toast = document.querySelector("#toast");
  let timer = null;
  let toastTimer = null;
  let uploadTimers = [];
  let overlay = null;
  let state = loadState();

  function loadState() {
    try {
      return Model.normalizeState(JSON.parse(localStorage.getItem(STORAGE_KEY)));
    } catch {
      return Model.initialState();
    }
  }

  function saveState() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }

  function escapeHtml(value) {
    return String(value)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function route() {
    return location.hash.replace(/^#\/?/, "") || "investor/home";
  }

  function go(next) {
    if (route() === next) render();
    else location.hash = `#/${next}`;
  }

  function showToast(message) {
    toast.textContent = message;
    toast.classList.add("is-visible");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove("is-visible"), 3000);
  }

  function navItem(label, target, active) {
    return `<button class="nav-item ${active ? "is-active" : ""}" data-route="${target}">
      <span class="nav-icon" aria-hidden="true"></span><span>${label}</span>
    </button>`;
  }

  function shell(role, active, body) {
    const investor = role === "investor";
    const navigation = investor
      ? [
          ["홈", "investor/home", "홈", "⌂"],
          ["거래하기", "investor/trade", "trade", "↗"],
          ["내 자산", "investor/assets", "assets", "▦"],
          ["내 인증", "investor/certifications", "certifications", "✓"]
        ]
      : [
          ["홈", "issuer/home", "홈", "⌂"],
          ["자산 등록", "issuer/basic", "register", "+"],
          ["내 자산", "issuer/metrics", "assets", "▦"]
        ];
    return `<div class="app-shell" data-portal="${role}">
      <aside class="sidebar">
        <div class="brand"><strong>Corner Store</strong>${investor ? "" : "<small>발행사 포털</small>"}</div>
        <nav aria-label="주요 메뉴">${navigation.map(([label, target, key]) => navItem(label, target, active === key)).join("")}</nav>
        <div class="sidebar-grow"></div>
        <button class="account-chip" data-action="wallet-details" aria-label="${investor ? "지갑 연결 정보" : "발행사 세션 정보"}">
          ${investor ? '<img src="/assets/robin-avatar.svg" width="28" height="28" alt="" />' : '<span class="issuer-avatar">A</span>'}
          <span><strong>${investor ? "Robin" : "ABC 자산운용"}</strong><small>${investor ? "0xB0B7...91C4" : "Peter"}</small></span>
          <span class="chevron">▾</span>
        </button>
      </aside>
      <main class="main"><div class="content">${body}</div></main>
    </div>`;
  }

  function header(title, description, eyebrow = "") {
    return `<header class="page-header">${eyebrow ? `<p class="eyebrow">${eyebrow}</p>` : ""}<h1>${title}</h1>${description ? `<p>${description}</p>` : ""}</header>`;
  }

  function badge(label, tone = "neutral") {
    return `<span class="badge ${tone}">${label}</span>`;
  }

  function stepper(labels, current) {
    return `<ol class="flow-stepper">${labels.map((label, index) => `<li class="${index <= current ? "is-active" : ""}"><span>${index + 1}</span><strong>${label}</strong></li>`).join("")}</ol>`;
  }

  function issuerProgress(current) {
    const labels = ["기본 정보", "발행 조건", "자료 준비", "심사 신청"];
    return `<aside class="side-card progress-card"><div class="side-heading">등록 진행</div>${labels.map((label, index) => `<div class="progress-step ${index <= current ? "is-active" : ""} ${index < current ? "is-done" : ""}"><span>${index < current ? "✓" : index + 1}</span><strong>${label}</strong><small>${index < current ? "완료" : index === current ? "작성 중" : "대기"}</small></div>`).join("")}</aside>`;
  }

  function walletModal() {
    const investor = route().startsWith("investor");
    if (!investor) {
      return `<div class="modal-backdrop" data-action="close-overlay"><section class="modal session-modal" role="dialog" aria-modal="true" data-modal-panel><button class="modal-close" data-action="close-overlay" aria-label="닫기">×</button><p class="eyebrow">Issuer session</p><h2>ABC 자산운용</h2><div class="connection-status"><span class="live-dot"></span><strong>Enterprise SSO 연결됨</strong><small>Peter · 발행 담당자</small></div><div class="session-grid"><span>권한</span><strong>Issuer operator</strong><span>네트워크</span><strong>Ethereum</strong><span>Token wiring</span><strong class="positive">Token / IdentityRegistry verified</strong><span>Safe proposal</span><strong>CS-ABCF-0905 · 2 / 3 owners</strong><span>Venue</span><strong>RFQ · signer / inventory ready</strong></div><button class="button secondary full" data-route="investor/home">투자자 화면 열기</button><p class="privacy-note">Sandbox session은 실제 SSO 또는 Safe에 요청하지 않습니다.</p></section></div>`;
    }
    if (overlay === "wallet-picker") {
      return `<div class="modal-backdrop" data-action="close-overlay"><section class="modal session-modal" role="dialog" aria-modal="true" data-modal-panel><button class="modal-close" data-action="close-overlay" aria-label="닫기">×</button><p class="eyebrow">Wallet</p><h2>지갑 연결</h2><p>거래에 사용할 지갑 방식을 선택하세요.</p><div class="provider-list"><button data-wallet="MetaMask"><span class="provider-mark">M</span><span><strong>MetaMask</strong><small>브라우저 지갑</small></span><span>→</span></button><button data-wallet="WalletConnect"><span class="provider-mark">W</span><span><strong>WalletConnect</strong><small>모바일 또는 QR 연결</small></span><span>→</span></button><button data-wallet="Safe"><span class="provider-mark">S</span><span><strong>Safe</strong><small>다중 서명 계정</small></span><span>→</span></button></div><p class="privacy-note">Sandbox에서는 외부 wallet provider를 호출하지 않습니다.</p></section></div>`;
    }
    return `<div class="modal-backdrop" data-action="close-overlay"><section class="modal session-modal" role="dialog" aria-modal="true" data-modal-panel><button class="modal-close" data-action="close-overlay" aria-label="닫기">×</button><p class="eyebrow">Wallet session</p><h2>${state.walletProvider} 연결됨</h2><div class="connection-status"><span class="live-dot"></span><strong>0xB0B7...91C4</strong><small>Robin · 세션 만료까지 42분</small></div><div class="session-grid"><span>네트워크</span><strong>Ethereum</strong><span>Chain ID</span><strong>1</strong><span>서명 방식</span><strong>EIP-712</strong><span>Identity</span><strong class="positive">Verified</strong></div><div class="button-row"><button class="button secondary" data-action="switch-network">네트워크 확인</button><button class="button secondary" data-action="change-wallet">지갑 변경</button></div><button class="button secondary full portal-switch" data-route="issuer/home">발행사 화면 열기</button><p class="privacy-note">표시된 연결은 sandbox facade이며 실제 wallet 권한을 사용하지 않습니다.</p></section></div>`;
  }

  function transactionModal() {
    const trade = latestSelectedTrade();
    const transactionHash = trade?.transactionHash || "0x6f82a918...c491ae";
    return `<div class="modal-backdrop" data-action="close-overlay"><section class="modal session-modal" role="dialog" aria-modal="true" data-modal-panel><button class="modal-close" data-action="close-overlay" aria-label="닫기">×</button><p class="eyebrow">Settlement evidence</p><h2>체결 증거</h2><div class="connection-status"><span class="live-dot"></span><strong>Finalized · 3 confirmations</strong><small>Ethereum · block 22,184,102</small></div><div class="session-grid transaction-grid"><span>Transaction</span><code>${escapeHtml(transactionHash)}</code><span>Router</span><code>0xC042...7110</code><span>Manifest</span><strong>${trade?.symbol || currentAsset().symbol} v4</strong><span>Decision</span><strong class="positive">PASS · 5/5</strong><span>Quote</span><strong>${trade?.id ? escapeHtml(trade.id) : "RFQ-1842"} · nonce ${trade?.sequence || 984102}</strong></div><button class="button secondary full" data-action="copy-transaction">Transaction hash 복사</button><p class="privacy-note">Sandbox receipt이며 실제 explorer 또는 RPC의 증거가 아닙니다.</p></section></div>`;
  }

  function marketControlModal(mode) {
    const pausing = mode === "pause";
    return `<div class="modal-backdrop" data-action="close-overlay"><section class="modal market-control-modal" role="dialog" aria-modal="true" aria-labelledby="market-control-title" data-modal-panel><button class="modal-close" data-action="close-overlay" aria-label="닫기">×</button><p class="eyebrow">Order operations · Sandbox</p><h2 id="market-control-title">${pausing ? "전체 주문 일시정지" : "전체 주문 재개"}</h2><p>${pausing ? "자격을 받은 모든 자산의 새 견적과 체결을 즉시 차단합니다. 기존 보유 자산과 거래 내역은 유지됩니다." : "정지 사유가 해소됐는지 확인한 뒤 투자자 주문을 다시 허용합니다."}</p>${pausing ? '<label class="modal-field"><span>정지 사유</span><select id="pause-reason"><option>유동성 및 재고 점검</option><option>컴플라이언스 자료 갱신</option><option>시장 변동성 확인</option><option>운영 점검</option></select></label>' : `<div class="alert success compact"><strong>○</strong><span>${escapeHtml(state.pauseReason || "운영 점검")} 확인 완료</span></div>`}<div class="control-impact"><div><span>신규 견적</span><strong>${pausing ? "전체 차단" : "허용"}</strong></div><div><span>보유 자산</span><strong>영향 없음</strong></div><div><span>거래 내역</span><strong>보존</strong></div></div><div class="button-row"><button class="button secondary" data-action="cancel-control">취소</button><button class="button ${pausing ? "danger-outline" : "primary"}" data-action="${pausing ? "confirm-pause" : "confirm-resume"}">${pausing ? "전체 주문 일시정지" : "전체 주문 재개"}</button></div><p class="privacy-note">실제 operator 권한이나 온체인 pause transaction을 실행하지 않는 browser-only 제어입니다.</p></section></div>`;
  }

  function stat(label, value, detail = "") {
    return `<article class="stat-card"><span>${label}</span><strong>${value}</strong>${detail ? `<small>${detail}</small>` : ""}</article>`;
  }

  function formatWon(value) {
    return `${Number(value || 0).toLocaleString("ko-KR")} 원`;
  }

  function formatDateTime(value, compact = false) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "-";
    return new Intl.DateTimeFormat("ko-KR", compact
      ? { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false }
      : { year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false }
    ).format(date);
  }

  function assetName(symbol) {
    return Model.assets(state).find((asset) => asset.symbol === symbol)?.name || symbol;
  }

  function currentAsset() {
    return Model.assets(state).find((asset) => asset.symbol === state.selectedAsset) || Model.assets(state).find((asset) => asset.symbol === "ABCF");
  }

  function latestSelectedTrade() {
    return Model.recentTransactions(state, 50).find((trade) => trade.symbol === state.selectedAsset && trade.source === "demo") || null;
  }

  function investorHome() {
    const abcfQualified = Boolean(state.qualifiedAssets.ABCF);
    const klmQualified = Boolean(state.qualifiedAssets.KLMS);
    const portfolio = Model.portfolioSummary(state);
    const latestPurchase = Model.recentTransactions(state, 50).find((trade) => trade.source === "demo") || null;
    const hasCompletedPurchase = Boolean(latestPurchase);
    const holdings = portfolio.holdings.slice().sort((left, right) => (right.symbol === "ABCF") - (left.symbol === "ABCF"));
    const recentTrades = Model.recentTransactions(state, 3);
    const pendingTasks = [
      !klmQualified ? taskRow("KLM 주식", "거래 자격만 신청하면 바로 거래할 수 있습니다", "거래 자격 신청", "investor/asset", "primary", "KLMS") : "",
      !abcfQualified ? taskRow("ABC 사모 펀드 토큰", "인증 1개가 더 필요합니다", "거래 자격 신청", "investor/asset", "secondary", "ABCF") : ""
    ].filter(Boolean);
    return shell("investor", "홈", `
      ${header(`안녕하세요, Robin님`, hasCompletedPurchase ? "최근 주문이 보유 자산에 반영되었습니다" : pendingTasks.length ? `거래 자격을 신청하면 자산 ${pendingTasks.length}종을 더 거래할 수 있습니다` : "모든 거래 자격이 준비되었습니다")}
      ${hasCompletedPurchase ? `<div class="alert success"><strong>포트폴리오 갱신</strong><span>${escapeHtml(assetName(latestPurchase.symbol))} 누적 ${state.holdings[latestPurchase.symbol].toLocaleString("ko-KR")}주가 반영됐습니다.</span></div>` : ""}
      ${state.assetPaused ? `<div class="alert warning"><strong>일부 자산이 주문을 받지 않습니다</strong><span>${escapeHtml(state.pauseReason || "운영 점검 중")} · 보유 자산과 이전 거래는 그대로 유지됩니다.</span></div>` : ""}
      <section class="stats-grid">
        ${stat("총 평가액", formatWon(portfolio.totalValue))}
        ${stat("보유 자산", `${portfolio.assetCount}종`)}
        ${stat("거래 가능한 자산", `${2 + Number(klmQualified) + Number(abcfQualified)}종`)}
      </section>
      <section class="card">
        <div class="card-heading"><strong>${pendingTasks.length ? "해야 할 일" : "거래 준비 완료"}</strong><span>${pendingTasks.length ? `${pendingTasks.length}건` : "완료"}</span></div>
        ${pendingTasks.length ? pendingTasks.join("") : '<div class="empty-row">모든 자산의 거래 자격이 준비되었습니다.</div>'}
      </section>
      <section class="home-lower">
        <div class="card"><div class="card-heading"><strong>보유 자산</strong><button class="text-button" data-route="investor/assets">전체 보기 ›</button></div>
          ${holdings.map((holding) => holdingRow(holding.name, `${holding.quantity.toLocaleString("ko-KR")}주`, formatWon(holding.value))).join("")}
        </div>
        <div class="card"><div class="card-heading"><strong>최근 거래</strong><button class="text-button" data-route="investor/transactions">전체 보기 ›</button></div>
          ${recentTrades.map(recentTradeRow).join("")}
        </div>
      </section>`);
  }

  function taskRow(title, description, action, target, variant = "primary", symbol = "") {
    return `<div class="task-row"><span><strong>${title}</strong><small>${description}</small></span><button class="button ${variant}" data-route="${target}" ${symbol ? `data-select-asset="${symbol}"` : ""}>${action}</button></div>`;
  }

  function holdingRow(name, amount, value) {
    return `<div class="holding-row"><span class="holding-icon"></span><span><strong>${name}</strong><small>${amount}</small></span><b>${value}</b></div>`;
  }

  function recentTradeRow(trade) {
    return `<div class="recent-trade-row"><span><strong>${escapeHtml(assetName(trade.symbol))} 매수</strong><small>${formatDateTime(trade.completedAt, true)}</small></span><b>+${trade.quantity.toLocaleString("ko-KR")}주</b></div>`;
  }

  function investorTrade() {
    const assets = Model.assets(state);
    return shell("investor", "trade", `
      ${header("거래하기", "자격을 받은 자산은 바로 거래할 수 있습니다")}
      ${state.issuerAssetListed ? '<div class="alert success"><strong>신규 자산</strong><span>ABC 사모 펀드 토큰이 거래 목록에 등록됐습니다.</span></div>' : ""}
      ${state.assetPaused ? `<div class="alert warning"><strong>일부 자산이 주문을 받지 않습니다</strong><span>${escapeHtml(state.pauseReason || "운영 점검 중")} · 자격이 없는 자산은 기존 상태로 표시됩니다.</span></div>` : ""}
      <section class="asset-list">${assets.map(assetCard).join("")}</section>`);
  }

  function assetCard(asset) {
    if (asset.paused) return `<article class="asset-list-row"><span class="holding-icon"></span><span class="asset-title"><strong>${asset.name}</strong><small>${asset.symbol}</small></span><strong class="asset-status warning-text">주문 중지</strong><button class="button secondary" disabled>거래하기</button></article>`;
    const target = asset.eligible ? "investor/order" : "investor/asset";
    return `<article class="asset-list-row"><span class="holding-icon"></span><span class="asset-title"><strong>${asset.name}</strong><small>${asset.symbol}</small></span><strong class="asset-status ${asset.eligible ? "positive" : "negative"}">${asset.eligible ? "거래 가능" : "거래 자격 없음"}</strong><button class="button ${asset.eligible ? "primary" : "secondary"}" data-route="${target}" data-select-asset="${asset.symbol}">${asset.eligible ? "거래하기" : "거래 자격 신청"}</button></article>`;
  }

  const eligibility = [
    ["ONCHAINID 신원", true, "신원 확인됨"],
    ["제재 목록", true, "제재 대상 아님"],
    ["허용 국가", true, "대한민국"],
    ["적격투자자", true, "인증 보유"],
    ["고액투자자", false, "추가 인증 필요"]
  ];

  function qualificationItems(asset = currentAsset()) {
    if (asset.symbol === "KLMS") {
      return [["신원 확인", "2027-03-31까지 유효"], ["제재 대상 여부 확인", "2026-12-31까지 유효"]];
    }
    return [["신원 확인", "2027-03-31까지 유효"], ["제재 대상 여부 확인", "2026-12-31까지 유효"], ["거주 국가 대한민국", "2027-03-31까지 유효"], ["고액 투자자 인증", "아직 받지 않았습니다"]];
  }

  function investorAsset() {
    const asset = currentAsset();
    const isAbcf = asset.symbol === "ABCF";
    return shell("investor", "trade", `
      <button class="back" data-route="investor/trade">← 거래하기</button>${header(asset.name)}
      <section class="two-column asset-detail-layout"><div><section class="card eligibility-summary"><div class="eligibility-title"><strong class="negative">거래 자격 없음</strong><span>${isAbcf ? "고액 투자자 인증이 필요합니다" : "자격 조건 확인 후 운용사 승인을 신청해야 합니다"}</span></div>${isAbcf ? '<div class="missing-credential"><span class="status-dot no">×</span><span><strong>고액 투자자 인증</strong><small>아직 받지 않았습니다</small></span><button class="button secondary" data-action="open-provider">인증 받기</button></div><div class="collapsed-condition"><span class="status-dot ok">○</span><span>나머지 조건 3가지는 충족했습니다</span><strong>펼치기⌄</strong></div>' : '<div class="missing-credential is-ready"><span class="status-dot ok">○</span><span><strong>필요 조건 2가지 확인 완료</strong><small>신원 및 제재 대상 여부 확인됨</small></span></div>'}</section><section class="card asset-info"><div class="card-heading"><strong>자산 정보</strong></div><div><span>현재가</span><strong>${asset.price}</strong></div><div><span>최소 주문 수량</span><strong>${asset.minimum}</strong></div><div><span>거래 방식</span><strong>딜러와 1:1</strong></div><div><span>운용사</span><strong>${isAbcf ? "ABC 자산운용" : "KLM Securities"}</strong></div></section></div><aside class="side-card availability-card"><div class="side-heading">거래 가능 여부</div><div class="alert danger compact"><strong>×</strong><span>아직 거래할 수 없습니다</span></div><button class="button primary full" data-route="investor/qualification">거래 자격 신청</button></aside></section>`);
  }

  function investorQualification() {
    const asset = currentAsset();
    const isAbcf = asset.symbol === "ABCF";
    const items = qualificationItems(asset);
    const checks = isAbcf ? state.qualificationChecks : [true, true];
    const ready = Model.qualificationReady(state, asset.symbol);
    return shell("investor", "trade", `
      <button class="back" data-route="investor/asset">← ${asset.name}</button>
      ${header("거래 자격 신청", "이 자산에 필요한 인증을 확인합니다")}${stepper(["인증 확인", "신청서 제출", "운용사 검토"], 0)}
      <section class="two-column"><div class="card form-card requirement-card"><div class="card-heading"><strong>필요한 인증</strong><span>${checks.filter(Boolean).length} / ${items.length} 보유</span></div>${items.map(([item, detail], index) => `<label class="check-row ${isAbcf && index === 3 && !checks[index] ? "is-missing" : ""}"><input type="checkbox" ${isAbcf ? `data-check="${index}"` : "disabled"} ${checks[index] ? "checked" : ""}/><span><strong>${item}</strong><small>${detail}</small></span>${isAbcf && index === 3 && !checks[index] ? '<button type="button" class="button secondary small" data-action="open-provider">인증 받기</button>' : ""}</label>`).join("")}</div><aside class="side-card application-summary"><div class="side-heading">신청 준비</div><div class="alert ${ready ? "success" : "danger"} compact"><strong>${ready ? "○" : "×"}</strong><span>${ready ? "신청할 수 있습니다" : "인증 1개가 부족합니다"}</span></div><div class="mini-row"><span>자산</span><strong>${asset.name}</strong></div><div class="mini-row"><span>보유 인증</span><strong>${checks.filter(Boolean).length}개</strong></div><div class="mini-row"><span>필요 인증</span><strong>${items.length}개</strong></div><button class="button primary full" data-route="investor/qualification-ready" ${ready ? "" : "disabled"}>신청서 제출</button></aside></section>`);
  }

  function providerModal() {
    return `<div class="modal-backdrop" data-action="close-provider"><section class="modal" role="dialog" aria-modal="true" aria-labelledby="provider-title" data-modal-panel>
      <button class="modal-close" data-action="close-provider" aria-label="닫기">×</button><h2 id="provider-title">고액 투자자 인증</h2><p>인증 기관을 선택해 주세요</p><div class="provider-list"><button data-provider="한국인증원"><span class="provider-mark"></span><span><strong>한국인증원</strong><small>서류 심사 · 1~2일 소요</small></span><span>›</span></button><button data-provider="Verify Partners"><span class="provider-mark"></span><span><strong>Verify Partners</strong><small>계좌 연동으로 즉시 확인</small></span><span>›</span></button><button data-provider="직접 서류 제출"><span class="provider-mark"></span><span><strong>직접 서류 제출</strong><small>소득·자산 증빙 업로드</small></span><span>›</span></button></div>
    </section></div>`;
  }

  function investorUpload() {
    const progress = state.certificationUploadProgress || 0;
    return shell("investor", "trade", `
      <button class="back" data-route="investor/qualification">← 거래 자격 신청</button>
      ${header("고액 투자자 인증", "소득 또는 자산을 증명하는 서류를 올려 주세요")}
      <section class="two-column"><div class="card form-card"><div class="card-heading"><strong>증빙 서류</strong></div><label class="drop-zone" id="certification-drop"><input id="certification-file" type="file" accept=".pdf,.png,.jpg,.jpeg"/><span class="upload-icon"></span><strong>${state.certificationFile ? "다른 파일 추가" : "파일을 끌어다 놓거나 클릭해서 선택"}</strong><small>PDF, JPG, PNG · 최대 10MB</small></label><div class="file-list"><div class="file-row"><span class="file-icon"></span><span><strong>소득금액증명원.pdf</strong><small>1.2MB</small></span>${badge("○", "positive")}</div><div class="file-row"><span class="file-icon"></span><span><strong>${state.certificationFile ? escapeHtml(state.certificationFile) : "예금잔액증명서.pdf"}</strong><small>${progress === 100 ? "evidence hash 생성됨" : "840KB"}</small></span><span class="inline-progress"><i style="width:${Math.max(progress, 64)}%"></i><small>${Math.max(progress, 64)}%</small></span></div></div></div><aside class="side-card upload-summary"><div class="side-heading">제출 정보</div><div class="mini-row"><span>인증 종류</span><strong>고액 투자자</strong></div><div class="mini-row"><span>기관</span><strong>${state.provider || "한국인증원"}</strong></div><div class="mini-row"><span>첨부 파일</span><strong>2개</strong></div><div class="mini-row"><span>예상 소요</span><strong>1~2일</strong></div><button class="button primary full" data-action="submit-certification" ${progress === 100 ? "" : "disabled"}>서류 제출</button><button class="button secondary full" data-route="investor/qualification">취소</button></aside></section>`);
  }

  function loadingScreen(title, description, steps, current) {
    return shell("investor", "trade", `<section class="center-state"><div class="spinner" aria-hidden="true"></div>${header(title, description)}<ol class="timeline">${steps.map((step, index) => `<li class="${index <= current ? "done" : ""}"><span>${index < current ? "✓" : index + 1}</span>${step}</li>`).join("")}</ol><p class="privacy-note">창을 닫아도 실제 작업이 실행되지는 않는 reference demo입니다.</p></section>`);
  }

  function credentialReviewScreen() {
    return shell("investor", "trade", `<section class="center-state provider-review"><div class="spinner" aria-hidden="true"></div>${header(`${state.provider || "한국인증원"}이 서류를 확인하고 있습니다`, "보통 1~2일 걸리지만 이번에는 바로 처리됩니다")}<div class="review-summary"><div><span>인증 종류</span><strong>고액 투자자</strong></div><div><span>제출 서류</span><strong>2개</strong></div><div><span>제출 시각</span><strong>14:08</strong></div><div class="technical-proof"><span>Provider session</span><code>KYC-0905-1842</code></div><div class="technical-proof"><span>PII-free evidence</span><code>0x8a41...f20c</code></div></div></section>`);
  }

  function qualificationReady() {
    const asset = currentAsset();
    const items = asset.symbol === "ABCF"
      ? [["신원 확인", "2027-03-31까지 유효"], ["제재 대상 여부 확인", "2026-12-31까지 유효"], ["거주 국가 대한민국", "2027-03-31까지 유효"], ["고액 투자자 인증", `${state.provider || "한국인증원"} · 2027-09-04까지 유효`]]
      : qualificationItems(asset);
    return shell("investor", "trade", `
      <button class="back" data-route="investor/asset">← ${asset.name}</button>${header("거래 자격 신청", "이 자산에 필요한 인증을 확인합니다")}${stepper(["인증 확인", "신청서 제출", "운용사 검토"], 1)}<section class="two-column"><div><div class="card requirement-card"><div class="card-heading"><strong>필요한 인증</strong><span>${items.length} / ${items.length} 보유</span></div>${items.map(([item, detail]) => `<div class="check-row"><span class="checked-box">✓</span><span><strong>${item}</strong><small>${detail}</small></span></div>`).join("")}</div><label class="card message-field"><span>전할 말</span><textarea id="qualification-message" placeholder="운용사에 전할 말 (선택)"></textarea></label></div><aside class="side-card application-summary"><div class="side-heading">신청 준비</div><div class="alert success compact"><strong>○</strong><span>신청할 수 있습니다</span></div><div class="mini-row"><span>자산</span><strong>${asset.name}</strong></div><div class="mini-row"><span>보낼 인증</span><strong>${items.length}개</strong></div><div class="mini-row"><span>확인 주체</span><strong>운용사</strong></div><button class="button primary full" data-action="submit-qualification">신청서 제출</button></aside></section>`);
  }

  function applicationReviewScreen() {
    return shell("investor", "trade", `${header("거래 자격 신청")}${stepper(["인증 확인", "신청서 제출", "운용사 검토"], 2)}<section class="two-column"><div class="card centered-review"><div class="spinner"></div><h2>운용사가 확인하고 있습니다</h2><p>결과가 나오면 이 화면이 바뀝니다</p></div><aside class="side-card review-status"><div class="side-heading">진행 상태</div><h2>확인 중</h2><div class="status-history"><span>신청서 제출 · 14:12</span><span>운용사 접수 · 14:12</span><span>확인 결과 · 대기 중</span></div><button class="button secondary full">신청 취소</button></aside></section>`);
  }

  function qualificationApproved() {
    const asset = currentAsset();
    return shell("investor", "trade", `${header("거래 자격 신청")}${stepper(["인증 확인", "신청서 제출", "운용사 검토"], 2)}<section class="two-column"><div class="card centered-review approved-review"><div class="success-ring">○</div><h2>거래 자격을 받았습니다</h2><p>이제 ${asset.name}을 거래할 수 있습니다</p><button class="button primary" data-route="investor/order" data-select-asset="${asset.symbol}">주문하러 가기</button></div><aside class="side-card review-status"><div class="side-heading">진행 상태</div><h2 class="positive">승인 완료</h2><div class="status-history"><span>신청서 제출 · 14:12</span><span>운용사 접수 · 14:12</span><strong>승인 · 14:12</strong></div></aside></section>`);
  }

  function investorOrder(stage = "order") {
    if (state.assetPaused) return investorPaused();
    const asset = currentAsset();
    if (!asset.eligible) return investorAsset();
    const valid = Model.isMinimumOrder(state.orderAmount, asset.symbol);
    const price = Number(state.orderAmount || 0) * asset.unitPrice;
    const fee = Math.round(price * 0.001);
    const total = price + fee;
    const quoteReady = stage === "quote";
    if (stage === "loading") return quoteLoadingScreen();
    if (stage === "fill") return fillLoadingScreen();
    return shell("investor", "trade", `
      <button class="back" data-route="${asset.symbol === "ABCF" || asset.symbol === "KLMS" ? "investor/asset" : "investor/trade"}">← ${asset.name}</button>${header("주문하기", asset.name)}
      <section class="two-column"><div class="card form-card order-form ${valid ? "" : "is-invalid"}"><div class="card-heading"><strong>수량</strong></div><label class="figma-amount"><input id="order-amount" type="number" min="0" max="600" step="10" value="${state.orderAmount}"/><span>주</span></label><input class="range" id="order-range" type="range" min="0" max="600" step="10" value="${state.orderAmount}" aria-label="주문 수량"/><div class="range-label"><span>0</span><span>600</span></div>${valid ? "" : `<div class="alert danger compact"><strong>×</strong><span>최소 ${asset.minimumQuantity}주부터 주문할 수 있습니다</span></div>`}</div><aside class="side-card order-summary"><div class="side-heading">주문 정보</div><div class="alert ${valid ? "success" : "danger"} compact"><strong>${valid ? "○" : "×"}</strong><span>${valid ? (quoteReady ? "주문할 수 있습니다" : "견적을 요청할 수 있습니다") : "수량이 부족합니다"}</span></div><div class="mini-row"><span>자산</span><strong>${asset.symbol}</strong></div><div class="mini-row"><span>수량</span><strong>${state.orderAmount}주</strong></div>${quoteReady ? `<div class="mini-row"><span>단가</span><strong>${asset.price}</strong></div><div class="mini-row"><span>수수료</span><strong>${fee.toLocaleString("ko-KR")} 원</strong></div><div class="mini-row"><span>총 대금</span><strong>${total.toLocaleString("ko-KR")} 원</strong></div><div class="quote-expiry">이 견적은 18초 뒤 만료됩니다</div><div class="verification-line"><span>✓ 3개 딜러 비교</span><span>✓ EIP-712 서명 로컬 검증</span><span>✓ inventory reserved</span></div>` : valid ? '<div class="mini-row"><span>단가</span><strong>—</strong></div><div class="mini-row"><span>총 대금</span><strong>—</strong></div>' : `<div class="mini-row"><span>필요 수량</span><strong>${asset.minimumQuantity}주 이상</strong></div>`}<button class="button primary full" data-action="${quoteReady ? "accept-quote" : "request-quote"}" ${valid ? "" : "disabled"}>${quoteReady ? "주문하기" : "견적 요청"}</button></aside></section>`);
  }

  function quoteLoadingScreen() {
    const asset = currentAsset();
    return shell("investor", "trade", `<button class="back" data-route="investor/order">← ${asset.name}</button>${header("주문하기", asset.name)}<section class="two-column"><div class="card form-card order-form"><div class="card-heading"><strong>수량</strong></div><label class="figma-amount"><input value="${state.orderAmount}" disabled/><span>주</span></label><input class="range" type="range" min="0" max="600" value="${state.orderAmount}" disabled/><div class="range-label"><span>0</span><span>600</span></div></div><aside class="side-card order-summary dealer-wait"><div class="side-heading">주문 정보</div><div class="spinner"></div><strong>딜러에게 값을 묻는 중</strong><div class="mini-row"><span>자산</span><strong>${asset.symbol}</strong></div><div class="mini-row"><span>수량</span><strong>${state.orderAmount}주</strong></div><div class="mini-row"><span>단가</span><strong>—</strong></div><div class="mini-row"><span>총 대금</span><strong>—</strong></div><button class="button primary full" disabled>주문하기</button><small>Han River Markets · Atlas Liquidity · Seoul Digital</small></aside></section>`);
  }

  function fillLoadingScreen() {
    const asset = currentAsset();
    const fee = Math.round(state.orderAmount * asset.unitPrice * 0.001);
    const total = state.orderAmount * asset.unitPrice + fee;
    return shell("investor", "trade", `<section class="center-state processing-state"><div class="spinner"></div><h1>주문을 처리하고 있습니다</h1><div class="review-summary"><div><span>자산</span><strong>${asset.name}</strong></div><div><span>수량</span><strong>${state.orderAmount}주</strong></div><div><span>총 대금</span><strong>${total.toLocaleString("ko-KR")} 원</strong></div><div class="technical-proof"><span>Protected settlement</span><strong>서명·컴플라이언스·finality 확인 중</strong></div></div></section>`);
  }

  function investorComplete() {
    const asset = currentAsset();
    const trade = latestSelectedTrade();
    const quantity = trade?.quantity || state.orderAmount;
    const unitPrice = trade?.unitPrice || asset.unitPrice;
    const fee = trade?.fee || Math.round(quantity * unitPrice * 0.001);
    const total = trade?.total || quantity * unitPrice + fee;
    return shell("investor", "trade", `<section class="center-state completion-state"><div class="success-ring">○</div><h1>주문이 체결되었습니다</h1><p>${trade ? formatDateTime(trade.completedAt) : "체결 처리 완료"}</p><div class="receipt figma-receipt"><div class="receipt-heading"><strong>체결 내역</strong></div><div><span>자산</span><strong>${asset.name}</strong></div><div><span>수량</span><strong>${quantity.toLocaleString("ko-KR")}주</strong></div><div><span>단가</span><strong>${formatWon(unitPrice)}</strong></div><div><span>수수료</span><strong>${formatWon(fee)}</strong></div><div><span>총 대금</span><strong>${formatWon(total)}</strong></div><div class="receipt-action-row"><span>거래 번호</span><button class="text-button" data-action="transaction-details">${escapeHtml(trade?.transactionHash || trade?.id || "0x9b2c7d14")}</button></div></div><div class="button-row completion-actions"><button class="button secondary" data-action="complete-home">홈으로</button><button class="button primary" data-route="investor/assets">내 자산 보기</button></div></section>`);
  }

  function investorAssets() {
    const portfolio = Model.portfolioSummary(state);
    return shell("investor", "assets", `${header("내 자산", "현재 보유 수량과 평가액")}
      <section class="stats-grid asset-stats">${stat("총 평가액", formatWon(portfolio.totalValue))}${stat("보유 자산", `${portfolio.assetCount}종`)}${stat("오늘 매수", `+${formatWon(portfolio.todayPurchaseValue)}`)}</section>
      <div class="tabs"><button class="is-active">보유 자산</button><button data-route="investor/transactions">거래 내역</button><button data-route="investor/certifications">인증 현황</button></div>
      <section class="card"><div class="table-row table-head"><span>자산</span><span>보유 수량</span><span>평가액</span><span>상태</span></div>
      ${portfolio.holdings.slice().sort((left, right) => (right.symbol === "ABCF") - (left.symbol === "ABCF")).map((holding) => `<div class="table-row"><strong>${holding.symbol}<small>${escapeHtml(holding.name)}</small></strong><span>${holding.quantity.toLocaleString("ko-KR")}주</span><span>${formatWon(holding.value)}</span><span class="${state.assetPaused ? "warning-text" : "positive"}">${state.assetPaused ? "주문 중지" : "거래 가능"}</span></div>`).join("")}</section>`);
  }

  function investorTransactions() {
    const transactions = Model.recentTransactions(state, 50);
    return shell("investor", "assets", `${header("거래 내역", "체결된 주문과 정산 금액을 확인합니다")}
      <section class="stats-grid asset-stats">${stat("전체 체결", `${transactions.length}건`)}${stat("ABCF 매수", `${transactions.filter((trade) => trade.symbol === "ABCF").length}건`)}${stat("최근 체결", transactions[0] ? formatDateTime(transactions[0].completedAt, true) : "-")}</section>
      <div class="tabs"><button data-route="investor/assets">보유 자산</button><button class="is-active">거래 내역</button><button data-route="investor/certifications">인증 현황</button></div>
      <section class="card transaction-list"><div class="transaction-row transaction-head"><span>체결 시각</span><span>자산</span><span>구분</span><span>수량</span><span>총 대금</span><span>상태</span></div>${transactions.map((trade) => `<div class="transaction-row"><span>${formatDateTime(trade.completedAt, true)}</span><strong>${trade.symbol}<small>${escapeHtml(assetName(trade.symbol))}</small></strong><span>매수</span><span>+${trade.quantity.toLocaleString("ko-KR")}주</span><span>${formatWon(trade.total)}</span><span class="positive">체결 완료</span></div>`).join("")}</section>`);
  }

  function investorCertifications() {
    const certs = [["ONCHAINID 신원", "확인됨", "2027.09.05"], ["제재 목록", "통과", "실시간"], ["국가", "대한민국", "2027.09.05"], ["적격투자자", "유효", "2027.06.30"], ["고액투자자", state.investorQualified ? "유효" : "미보유", state.investorQualified ? "2027.09.05" : "-"]];
    return shell("investor", "certifications", `${header("내 인증", "개인정보 대신 자격 상태와 유효기간만 표시합니다")}
      <div class="tabs"><button data-route="investor/assets">보유 자산</button><button data-route="investor/transactions">거래 내역</button><button class="is-active">인증 현황</button></div><section class="card cert-list">${certs.map(([name, status, date]) => `<div><span class="status-dot ${status === "미보유" ? "no" : "ok"}">${status === "미보유" ? "×" : "✓"}</span><strong>${name}</strong><span>${status}</span><small>${date}</small></div>`).join("")}</section>`);
  }

  function investorPaused() {
    const asset = currentAsset();
    return shell("investor", "trade", `${header("주문하기", asset.name)}
      <div class="alert warning"><strong>일부 자산이 주문을 받지 않습니다</strong><span>${escapeHtml(state.pauseReason || "운영자가 시장 상태를 확인하고 있습니다.")} 기존 자산과 인증에는 영향이 없습니다.</span></div><section class="two-column"><div class="card form-card muted"><div class="card-heading"><strong>주문 수량</strong>${badge("주문 중지", "warning")}</div><label class="amount-field"><span>수량</span><input value="${state.orderAmount}" disabled/><strong>${asset.symbol}</strong></label><div class="pause-explanation"><strong>새 견적과 체결이 차단됐습니다</strong><span>이미 체결된 자산과 거래 내역은 그대로 확인할 수 있습니다.</span></div></div><aside class="side-card"><div class="side-heading">운영 상태</div><div class="mini-row"><span>자산</span><strong>${asset.symbol}</strong></div><div class="mini-row"><span>상태</span><strong class="warning-text">주문 중지</strong></div><div class="mini-row"><span>변경 시각</span><strong>${state.pauseUpdatedAt ? formatDateTime(state.pauseUpdatedAt, true) : "방금 전"}</strong></div><p>거래가 재개되면 새 견적을 요청해야 합니다.</p><button class="button primary full" disabled>견적 요청</button><button class="button secondary full" data-route="investor/assets">보유 자산 보기</button><button class="button secondary full" data-route="investor/trade">거래 목록으로</button></aside></section>`);
  }

  function orderOperations() {
    const status = state.assetPaused ? "주문 일시정지" : "주문 접수 중";
    return `<section class="asset-operations"><div><strong>주문 접수 관리</strong><span>투자자 화면의 자격 보유 자산을 한 번에 제어합니다</span></div><div class="operation-state"><span class="status-dot ${state.assetPaused ? "pause" : "ok"}">${state.assetPaused ? "!" : "○"}</span><span><strong class="${state.assetPaused ? "warning-text" : "positive"}">${status}</strong><small>${state.assetPaused ? escapeHtml(state.pauseReason || "운영 점검") : "RFQ venue · signer · inventory ready"}</small></span></div><button class="button ${state.assetPaused ? "primary" : "danger-outline"}" data-action="${state.assetPaused ? "open-resume" : "open-pause"}">${state.assetPaused ? "전체 주문 재개" : "전체 주문 일시정지"}</button></section>`;
  }

  function issuerHome() {
    const portfolio = Model.portfolioSummary(state);
    const abcfTradeCount = Model.recentTransactions(state, 50).filter((trade) => trade.symbol === "ABCF" && trade.source === "demo").length;
    const orderStatus = state.assetPaused ? "주문 중지" : "거래 중";
    return shell("issuer", "홈", `${header("안녕하세요, Peter님", "거래 중인 자산 1종을 운영하고 있습니다")}
      <section class="stats-grid">${stat("거래 중인 자산", state.assetPaused ? `0종 · ${state.issuerAssetListed ? 2 : 1}종 정지` : state.issuerAssetListed ? "2종" : "1종")}${stat("이번 달 체결", `${318 + abcfTradeCount}건`)}${stat("전체 보유자", `${482 + (state.holdings.ABCF > 0 ? 1 : 0)}명`)}</section>
      ${orderOperations()}
      <section class="card issuer-assets"><div class="card-heading"><strong>내 자산</strong><span>${state.issuerAssetListed ? "2종" : "1종"}</span></div>${state.issuerAssetListed ? `<div class="issuer-asset-row"><span class="holding-icon"></span><span><strong>ABC 사모 펀드 토큰</strong><small><em>ABCF</em><em>Reg D 506(c)</em><em>§ 3(c)(7)</em></small></span><strong class="${state.assetPaused ? "warning-text" : "positive"}">${orderStatus}</strong><button class="button secondary" data-route="issuer/metrics">운영 보기</button></div>` : ""}<div class="issuer-asset-row"><span class="holding-icon"></span><span><strong>ABC 성장형 펀드 토큰</strong><small><em>ABCG</em><em>Reg D 506(c)</em><em>§ 3(c)(7)</em></small></span><strong class="${state.assetPaused ? "warning-text" : "positive"}">${orderStatus}</strong><button class="button secondary" data-route="issuer/metrics">운영 보기</button></div></section><section class="card issuer-cta"><span><strong>새 자산을 등록하시겠어요</strong><small>발행 조건을 고르면 필요한 자료가 자동으로 정리됩니다</small></span><button class="button primary" data-route="issuer/basic">새 자산 등록</button></section>`);
  }

  const issuerFields = [
    ["name", "자산 이름", "ABC 사모 펀드 토큰", "text"], ["symbol", "심볼", "ABCF", "text"],
    ["supply", "총 발행량", "1000000", "number"], ["minimum", "최소 주문 수량", "50", "number"],
    ["contract", "토큰 컨트랙트", "0xABCF...2048", "text"]
  ];

  function issuerBasic() {
    const complete = issuerFields.every(([key]) => String(state.issuerForm[key]).trim()) && state.issuerForm.chain;
    const progress = issuerProgress(0).replace("</aside>", `<button class="button primary full" data-route="issuer/rules" ${complete ? "" : "disabled"}>다음</button></aside>`);
    return shell("issuer", "register", `${header("새 자산 등록", "자산의 기본 정보를 입력해 주세요")}<section class="two-column"><form class="card form-card" id="issuer-form"><div class="card-heading"><strong>기본 정보</strong></div><div class="field-grid">${issuerFields.map(([key, label, placeholder, type]) => `<label><span>${label}</span><input name="${key}" type="${type}" value="${escapeHtml(state.issuerForm[key])}" placeholder="${placeholder}"/></label>`).join("")}<label><span>블록체인</span><select name="chain"><option ${state.issuerForm.chain === "Ethereum" ? "selected" : ""}>Ethereum</option><option ${state.issuerForm.chain === "GIWA" ? "selected" : ""}>GIWA</option></select></label></div></form>${progress}</section>`);
  }

  const questionData = [
    ["offering", "어떤 방식으로 발행하셨나요", [["reg-d", "Reg D 506(c)", "사모 · 적격투자자 대상"], ["reg-s", "Reg S", "역외 발행"], ["registered", "등록증권", "공모 · 상장"]]],
    ["fund", "펀드에 해당하나요", [["private-fund", "§ 3(c)(7) 펀드", "고액 투자자만 참여"], ["no", "해당 없음", ""]]],
    ["investor", "토큰 자체에 이전 제한이 걸려 있나요", [["contract", "예", "계약에서 직접 막습니다"], ["external", "아니요", "외부에서 관리합니다"]]],
    ["holding", "주주명부는 어디서 관리하시나요", [["direct", "직접 운영", ""], ["transfer-agent", "명의개서대리인", ""]]],
    ["distribution", "재판매를 허용하시나요", [["rule-144", "Rule 144", "취득일 자료 필요"], ["section-4", "§ 4(a)(7)", ""], ["none", "허용 안 함", ""]]]
  ];

  function issuerRules() {
    const ready = Model.issuerRulesReady(state);
    const rules = Model.compiledRules(state);
    const progress = issuerProgress(1).replace("</aside>", `<div class="compiled-summary"><span>적용 규정</span><div>${rules.length ? rules.filter((rule) => ["Reg D 506(c)", "§ 3(c)(7)", "Rule 144"].includes(rule)).map((rule) => badge(rule)).join("") : "아직 고른 것이 없습니다"}</div><span>투자자 자격 조건</span><strong>${ready ? "4가지" : "-"}</strong><span>필요한 자료</span><strong>${ready ? "7가지" : "-"}</strong></div><button class="button primary full" data-route="issuer/evidence" ${ready ? "" : "disabled"}>다음</button></aside>`);
    return shell("issuer", "register", `${header("발행 조건", "자산이 어떤 규정으로 발행됐는지 골라 주세요")}<section class="two-column"><div><div class="alert warning compact"><strong>!</strong><span>법률 검토를 마친 결과를 입력해 주세요. 이 화면은 법률 검토를 대신하지 않습니다.</span></div><section class="card form-card questions"><div class="card-heading"><strong>발행 조건</strong></div>${questionData.map(([key, title, answers], index) => `<fieldset><legend><span>${index + 1}.</span>${title}</legend><div class="answer-tiles cols-${answers.length}">${answers.map(([value, label, detail]) => `<button type="button" class="answer-tile ${state.issuerAnswers[key] === value ? "is-selected" : ""}" data-question="${key}" data-answer="${value}"><strong>${label}</strong>${detail ? `<small>${detail}</small>` : ""}</button>`).join("")}</div></fieldset>`).join("")}</section></div>${progress}</section>`);
  }

  const evidenceItems = [
    ["qualified", "적격투자자 인증 발급", "connect", "ABC 자산운용"], ["highValue", "고액 투자자 인증 발급", "connect", "ABC 자산운용"],
    ["acquisition", "취득일과 보유 이력", "connect", "연결 안 됨"], ["holders", "보유자 명부", "upload", "보유자명부_2609.csv"],
    ["related", "관계자 명단", "upload", "파일 없음"], ["sanctions", "제재 명단 확인", "connect", "Screening Co."],
    ["distribution", "분배 기간", "upload", "분배기간.pdf"]
  ];

  function issuerEvidence(modalKey = null) {
    const progress = Model.evidenceProgress(state);
    const notices = { acquisition: "이 자료가 없으면 새로운 투자자가 될 수 없습니다", related: "이 자료가 없으면 임원과 대주주의 거래를 걸러낼 수 없습니다" };
    const body = shell("issuer", "register", `${header("자료 준비", "각 항목을 눌러 파일을 업로드하거나 시스템을 연결해 주세요")}
      <section class="two-column"><section class="card evidence-card"><div class="card-heading"><strong>필요한 자료</strong><span>${progress.ready} / ${progress.total} 준비됨</span></div>${evidenceItems.map(([key, label, mode, detail]) => `<button class="evidence-row ${state.evidence[key] ? "" : "is-missing"}" data-evidence="${key}"><span class="status-dot ${state.evidence[key] ? "ok" : "no"}">${state.evidence[key] ? "○" : "×"}</span><strong>${label}</strong><span>${state.evidence[key] ? detail : mode === "upload" ? "파일 없음" : "연결 안 됨"}</span><em>${state.evidence[key] ? "변경" : mode === "upload" ? "업로드" : "연결"}</em>${notices[key] && !state.evidence[key] ? `<small>${notices[key]}</small>` : ""}</button>`).join("")}</section>
      ${issuerProgress(2).replace("</aside>", `<div class="evidence-summary"><span>준비된 자료</span><strong>${progress.ready} / ${progress.total}</strong></div><button class="button secondary full" data-action="submit-issuer-review">심사 신청</button><p class="progress-note">자료가 빠진 채로도 신청할 수 있습니다</p></aside>`)}</section>`);
    return modalKey ? `${body}${evidenceModal(modalKey)}` : body;
  }

  function evidenceModal(key) {
    const item = evidenceItems.find(([itemKey]) => itemKey === key);
    if (!item) return "";
    const [, label] = item;
    const content = evidenceModalContent(key);
    return `<div class="modal-backdrop" data-action="close-evidence"><section class="modal evidence-modal" role="dialog" aria-modal="true" data-modal-panel><button class="modal-close" data-action="close-evidence" aria-label="닫기">×</button><p class="eyebrow">필요 자료 · Sandbox connector</p><h2>${label}</h2>${content}<button class="button primary full" data-complete-evidence="${key}">연결 상태 확인</button><p class="privacy-note">입력값과 파일은 외부로 전송하거나 저장하지 않습니다.</p></section></div>`;
  }

  function evidenceModalContent(key) {
    if (key === "qualified" || key === "highValue") {
      return `<p>인증 발급 주체와 PII-free evidence source를 설정합니다.</p><div class="radio-stack"><label><input type="radio" name="issuer-mode" checked/> 발행사가 직접 attestation</label><label><input type="radio" name="issuer-mode"/> 외부 인증기관 위임</label></div><div class="modal-field-grid"><label class="modal-field"><span>Issuer ID</span><input value="ABC-ASSET-001"/></label><label class="modal-field"><span>Credential schema</span><input value="${key === "qualified" ? "qualified-investor-v2" : "high-value-investor-v1"}"/></label></div><div class="connection-status compact"><span class="live-dot"></span><strong>Issuer key 확인됨</strong><small>마지막 동기화 14:31</small></div>`;
    }
    if (key === "acquisition") {
      return `<p>취득일과 lot lineage를 제공할 Transfer Agent를 선택하세요.</p><div class="provider-list compact-list"><button><span class="provider-mark">KT</span><span><strong>Korea Trust TA</strong><small>Lot API v2 · 정상</small></span><span>●</span></button><button><span class="provider-mark">HF</span><span><strong>Han Fund Services</strong><small>SFTP evidence · 정상</small></span><span>●</span></button><button><span class="provider-mark">MA</span><span><strong>Manual Attestation</strong><small>담당자 검토 필요</small></span><span>→</span></button></div>`;
    }
    if (key === "holders") {
      return `<p>현재 보유자 명부를 업로드하고 schema 검사를 실행합니다.</p><label class="drop-zone compact"><input type="file"/><span class="upload-icon">↑</span><strong>CSV 파일을 놓거나 선택</strong><small>holder ID는 브라우저 밖으로 전송되지 않습니다</small></label><div class="file-row modal-file"><span class="file-icon">CSV</span><span><strong>holders.csv</strong><small>128 rows · schema valid</small></span>${badge("검증 완료", "positive")}</div>`;
    }
    if (key === "related") {
      return `<p>관계자 명단을 암호화하고 evidence hash를 생성합니다.</p><label class="drop-zone compact"><input type="file"/><span class="upload-icon">↑</span><strong>관계자 명단 추가</strong><small>CSV, XLSX</small></label><div class="file-row modal-file"><span class="file-icon">XLS</span><span><strong>related-parties.xlsx</strong><small>암호화 및 중복 검사 · 82%</small><span class="file-progress progress-4"></span></span>${badge("처리 중", "warning")}</div>`;
    }
    if (key === "sanctions") {
      return `<p>제재 상태 provider와 fail-closed freshness 정책을 설정합니다.</p><div class="radio-stack"><label><input type="radio" name="sanctions-mode" checked/> 실시간 API</label><label><input type="radio" name="sanctions-mode"/> 일일 snapshot</label></div><label class="modal-field"><span>Provider</span><input value="Global Screening Sandbox" readonly/></label><label class="modal-field"><span>API credential</span><input type="password" value="" placeholder="세션 credential 입력" autocomplete="off"/></label><div class="connection-status compact"><span class="live-dot"></span><strong>Connection test PASS</strong><small>freshness 18초 · fail-closed</small></div>`;
    }
    return `<p>분배 제한이 적용되는 기준 기간을 설정합니다.</p><div class="modal-field-grid"><label class="modal-field"><span>시작일</span><input type="date" value="2026-09-01"/></label><label class="modal-field"><span>종료일</span><input type="date" value="2026-12-31"/></label></div><div class="radio-stack"><label><input type="radio" name="period-mode" checked/> 기간 중 양도 허용</label><label><input type="radio" name="period-mode"/> 분배 기준일 전 양도 제한</label></div><div class="connection-status compact"><span class="live-dot"></span><strong>Policy window valid</strong><small>다음 기준일 2026-12-31</small></div>`;
  }

  function issuerReview() {
    return shell("issuer", "register", `${header("등록 심사", "ABC 사모 펀드 토큰")}${stepper(["신청 접수", "심사", "거래 시작"], 1)}<section class="two-column issuer-review-layout"><div><section class="card issuer-review-hero"><div class="review-mark is-loading"></div><h2>거래소가 심사하고 있습니다</h2><p>보통 3영업일 걸립니다</p></section>${issuerReviewHistory(false)}</div><aside class="side-card current-status"><div class="side-heading">현재 상태</div><div class="mini-row"><span>신청 번호</span><strong>LST-2026-0041</strong></div><div class="mini-row"><span>신청일</span><strong>2026-09-04</strong></div><div class="mini-row"><span>상태</span><strong>심사 중</strong></div></aside></section>`);
  }

  function issuerLive() {
    return shell("issuer", "register", `${header("등록 심사", "ABC 사모 펀드 토큰")}${stepper(["신청 접수", "심사", "거래 시작"], 2)}<section class="two-column issuer-review-layout"><div><section class="card issuer-review-hero"><div class="review-mark is-done"></div><h2>거래가 시작됐습니다</h2><p>투자자가 지금부터 이 자산을 볼 수 있습니다</p><button class="button primary" data-route="issuer/metrics">자산 현황 보기</button></section>${issuerReviewHistory(true)}</div><aside class="side-card current-status"><div class="side-heading">현재 상태</div><div class="mini-row"><span>신청 번호</span><strong>LST-2026-0041</strong></div><div class="mini-row"><span>신청일</span><strong>2026-09-04</strong></div><div class="mini-row"><span>상태</span><strong class="positive">거래 중</strong></div><div class="alert success exposure-note"><strong>투자자 화면에 노출 중</strong><span>거래하기 목록에서 확인할 수 있습니다</span></div></aside></section>`);
  }

  function issuerReviewHistory(complete) {
    const rows = complete
      ? [["심사 신청 접수", "09-04 15:02"], ["서류 확인", "09-04 15:24 · 이상 없음"], ["토큰 계약 확인", "09-04 16:10 · 이전 제한 확인됨"], ["적용 규정 배정", "09-04 16:40"], ["거래소 등록", "09-04 17:02"]]
      : [["심사 신청 접수", "09-04 15:02"], ["서류 확인", "09-04 15:24 · 이상 없음"], ["토큰 계약 확인", "확인 중"], ["적용 규정 배정", "대기"], ["거래소 등록", "대기"]];
    return `<section class="card review-history"><div class="card-heading"><strong>진행 이력</strong></div>${rows.map(([label, detail], index) => `<div class="history-row ${complete || index < 2 ? "is-done" : index === 2 ? "is-active" : ""}"><span></span><strong>${label}</strong><small>${detail}</small></div>`).join("")}</section>`;
  }

  function issuerMetrics() {
    const active = state.issuerAssetListed;
    const userTrades = Model.recentTransactions(state, 10).filter((trade) => trade.symbol === "ABCF" && trade.source === "demo");
    const abcfPurchaseValue = userTrades.reduce((total, trade) => total + trade.quantity * trade.unitPrice, 0);
    const status = state.assetPaused ? "거래 일시정지" : "거래 중";
    const recentRows = [
      ...userTrades.map((trade) => [formatDateTime(trade.completedAt, true), `${trade.quantity.toLocaleString("ko-KR")} ABCF`, formatWon(trade.quantity * trade.unitPrice)]),
      ["09:42", "50 ABCF", "5,000,000 원"], ["09:18", "120 ABCF", "12,000,000 원"], ["어제", "80 ABCF", "8,000,000 원"]
    ].slice(0, 5);
    const operationRows = state.operationLog.slice(0, 4);
    const displayedRecentRows = active ? recentRows : [["09:42", "50 ABCG", "42,000,000 원"], ["09:18", "120 ABCG", "100,800,000 원"], ["어제", "80 ABCG", "67,200,000 원"]];
    const operationHistory = `<section class="card operation-history"><div class="card-heading"><strong>운영 이력</strong><span>PII-free browser audit</span></div>${operationRows.map((entry) => `<div class="operation-row"><span class="status-dot ${entry.action === "PAUSE" ? "pause" : "ok"}">${entry.action === "PAUSE" ? "!" : "○"}</span><span><strong>${entry.action === "PAUSE" ? "전체 주문 일시정지" : "전체 주문 재개"}</strong><small>${escapeHtml(entry.reason)}</small></span><time>${formatDateTime(entry.at, true)}</time></div>`).join("")}</section>`;
    return shell("issuer", "assets", `${header(active ? "ABC 사모 펀드 토큰" : "ABC 글로벌 채권 토큰", active ? `ABCF · ${status}` : `ABCG · ${status}`)}
      ${state.assetPaused ? `<div class="alert warning"><strong>투자자 주문 차단 중</strong><span>${escapeHtml(state.pauseReason || "운영 점검")} · 기존 보유 자산과 체결 이력은 유지됩니다.</span></div>` : ""}
      <section class="stats-grid">${stat("총 체결 금액", active ? formatWon(128500000 + abcfPurchaseValue) : "840,000,000 원", "+12.4%")} ${stat("보유 투자자", active ? `${18 + (state.holdings.ABCF > 0 ? 1 : 0)}명` : "64명")}${stat("이번 달 체결", active ? `${28 + userTrades.length}건` : "24건")}</section>
      ${orderOperations()}
      <section class="two-column dashboard"><div class="card chart-card"><div class="card-heading"><strong>체결 금액</strong><span>최근 7일</span></div><div class="chart" aria-label="최근 7일 체결 금액 막대 그래프">${[32, 54, 42, 68, 51, 82, active && portfolio.demoTradeCount ? 82 : 74].map((height, index) => `<span class="height-${height}"><small>${index + 1}일</small></span>`).join("")}</div></div><aside class="card recent-card"><div class="card-heading"><strong>최근 체결</strong><span>${state.assetPaused ? "정지됨" : "실시간"}</span></div>${displayedRecentRows.map((row) => `<div class="recent-row"><span>${row[0]}</span><strong>${row[1]}</strong><span>${row[2]}</span></div>`).join("")}</aside></section>
      ${operationHistory}`);
  }

  function render() {
    clearTimeout(timer);
    const current = route();
    if (state.assetPaused && ["investor/order", "investor/quote-loading", "investor/quote", "investor/fill"].includes(current)) {
      return go("investor/paused");
    }
    if (current === "investor/complete" && state.pendingOrder) {
      const settlement = Model.settlePendingOrder(state);
      state = settlement.state;
      saveState();
    }
    if (current === "investor/approved" && !state.qualifiedAssets[state.selectedAsset]) {
      state.qualifiedAssets[state.selectedAsset] = true;
      if (state.selectedAsset === "ABCF") state.investorQualified = true;
      saveState();
    }
    if (current === "investor/qualification-ready" && state.selectedAsset === "ABCF" && !state.qualificationChecks[3]) {
      state.qualificationChecks[3] = true;
      saveState();
    }
    if (current === "issuer/live" && !state.issuerAssetListed) {
      state.issuerAssetListed = true;
      saveState();
    }
    const views = {
      "investor/home": investorHome, "investor/post-trade": investorHome, "investor/trade": investorTrade,
      "investor/asset": investorAsset, "investor/qualification": investorQualification, "investor/provider": investorQualification,
      "investor/upload": investorUpload, "investor/review": credentialReviewScreen,
      "investor/qualification-ready": qualificationReady, "investor/application-review": applicationReviewScreen,
      "investor/approved": qualificationApproved, "investor/order": () => investorOrder("order"), "investor/quote-loading": () => investorOrder("loading"),
      "investor/quote": () => investorOrder("quote"), "investor/fill": () => investorOrder("fill"), "investor/complete": investorComplete,
      "investor/assets": investorAssets, "investor/transactions": investorTransactions, "investor/certifications": investorCertifications, "investor/paused": investorPaused,
      "issuer/home": issuerHome, "issuer/basic": issuerBasic, "issuer/rules": issuerRules, "issuer/evidence": () => issuerEvidence(),
      "issuer/review": issuerReview, "issuer/live": issuerLive, "issuer/metrics": issuerMetrics
    };
    app.innerHTML = (views[current] || views["investor/home"])();
    if (overlay === "wallet" || overlay === "wallet-picker") app.insertAdjacentHTML("beforeend", walletModal());
    if (overlay === "transaction") app.insertAdjacentHTML("beforeend", transactionModal());
    if (overlay === "provider") app.insertAdjacentHTML("beforeend", providerModal());
    if (overlay === "pause" || overlay === "resume") app.insertAdjacentHTML("beforeend", marketControlModal(overlay));
    const range = document.querySelector("#order-range");
    if (range) range.style.setProperty("--range-progress", `${Math.min(100, state.orderAmount / 6)}%`);
    document.title = `${current.startsWith("issuer") ? "발행사" : "투자자"} · Corner Store`;

    const transitions = {
      "investor/review": [2500, "investor/qualification-ready"],
      "investor/application-review": [2000, "investor/approved"],
      "investor/quote-loading": [2000, "investor/quote"],
      "investor/fill": [2500, "investor/complete"],
      "issuer/review": [2500, "issuer/live"]
    };
    if (transitions[current]) timer = setTimeout(() => go(transitions[current][1]), transitions[current][0]);
    if (current === "investor/approved") showToast(`${currentAsset().name} 거래 자격이 승인되었습니다.`);
    if (current === "issuer/live") showToast("ABCF가 투자자 거래 목록에 공개됐습니다.");
  }

  app.addEventListener("click", (event) => {
    const routeButton = event.target.closest("[data-route]");
    if (routeButton && !routeButton.disabled) {
      overlay = null;
      if (routeButton.dataset.selectAsset) {
        const asset = Model.assets(state).find((candidate) => candidate.symbol === routeButton.dataset.selectAsset);
        if (asset) {
          state.selectedAsset = asset.symbol;
          if (routeButton.dataset.route === "investor/order") {
            state.orderAmount = asset.symbol === "ABCF" ? 20 : asset.minimumQuantity;
          }
          saveState();
        }
      }
      return go(routeButton.dataset.route);
    }

    const provider = event.target.closest("[data-provider]");
    if (provider) {
      state.provider = provider.dataset.provider;
      overlay = null;
      saveState();
      return go("investor/upload");
    }

    const wallet = event.target.closest("[data-wallet]");
    if (wallet) {
      state.walletConnected = true;
      state.walletProvider = wallet.dataset.wallet;
      overlay = null;
      saveState();
      render();
      return showToast(`${state.walletProvider} sandbox session이 연결되었습니다.`);
    }

    const question = event.target.closest("[data-question]");
    if (question) {
      state.issuerAnswers[question.dataset.question] = question.dataset.answer;
      saveState();
      return render();
    }

    const evidence = event.target.closest("[data-evidence]");
    if (evidence) {
      app.innerHTML = issuerEvidence(evidence.dataset.evidence);
      return;
    }

    const completeEvidence = event.target.closest("[data-complete-evidence]");
    if (completeEvidence) {
      state.evidence[completeEvidence.dataset.completeEvidence] = true;
      saveState();
      return render();
    }

    const action = event.target.closest("[data-action]")?.dataset.action;
    if (!action) return;
    if (action === "wallet-details") {
      overlay = "wallet";
      return render();
    }
    if (action === "transaction-details") {
      overlay = "transaction";
      return render();
    }
    if (action === "open-provider") {
      overlay = "provider";
      return render();
    }
    if (action === "close-overlay") {
      if (event.target.closest("[data-modal-panel]") && !event.target.matches(".modal-close")) return;
      overlay = null;
      return render();
    }
    if (action === "change-wallet") {
      overlay = "wallet-picker";
      return render();
    }
    if (action === "switch-network") return showToast("Ethereum Mainnet · Chain ID 1 확인 완료");
    if (action === "copy-transaction") return showToast("Sandbox transaction hash를 복사했습니다.");
    if (action === "close-provider") {
      if (event.target.closest("[data-modal-panel]") && !event.target.matches(".modal-close")) return;
      overlay = null;
      return render();
    }
    if (action === "close-evidence") {
      if (event.target.closest("[data-modal-panel]") && !event.target.matches(".modal-close")) return;
      return render();
    }
    if (action === "submit-certification") return go("investor/review");
    if (action === "submit-qualification") return go("investor/application-review");
    if (action === "request-quote") {
      if (state.assetPaused) return go("investor/paused");
      return go("investor/quote-loading");
    }
    if (action === "accept-quote") {
      state.pendingOrder = Model.createPendingOrder(state, state.orderAmount);
      if (!state.pendingOrder) return go(state.assetPaused ? "investor/paused" : "investor/order");
      saveState();
      return go("investor/fill");
    }
    if (action === "complete-home") {
      go("investor/post-trade");
      return showToast("체결 내역과 보유 자산이 갱신되었습니다.");
    }
    if (action === "open-pause") {
      overlay = "pause";
      return render();
    }
    if (action === "open-resume") {
      overlay = "resume";
      return render();
    }
    if (action === "cancel-control") {
      overlay = null;
      return render();
    }
    if (action === "confirm-pause") {
      const result = Model.setAssetPaused(state, true, document.querySelector("#pause-reason")?.value || "운영 점검");
      state = result.state;
      overlay = null;
      saveState();
      render();
      return showToast("자격 보유 자산의 신규 주문이 일시정지되었습니다.");
    }
    if (action === "confirm-resume") {
      const result = Model.setAssetPaused(state, false, "운영 점검 완료");
      state = result.state;
      overlay = null;
      saveState();
      render();
      return showToast("자격 보유 자산의 주문이 재개되었습니다.");
    }
    if (action === "submit-issuer-review") {
      return go("issuer/review");
    }
  });

  app.addEventListener("change", (event) => {
    if (event.target.matches("[data-check]")) {
      state.qualificationChecks[Number(event.target.dataset.check)] = event.target.checked;
      saveState();
      return render();
    }
    if (event.target.matches("#certification-file")) {
      return beginCertificationUpload(event.target.files[0]?.name || null);
    }
    if (event.target.closest("#issuer-form")) {
      const data = new FormData(event.target.form);
      for (const [key, value] of data) state.issuerForm[key] = String(value);
      saveState();
      return render();
    }
  });

  app.addEventListener("input", (event) => {
    if (event.target.matches("#order-amount, #order-range")) {
      state.orderAmount = Math.max(0, Number(event.target.value || 0));
      saveState();
      render();
    }
  });

  app.addEventListener("dragover", (event) => {
    if (event.target.closest("#certification-drop")) event.preventDefault();
  });
  app.addEventListener("drop", (event) => {
    if (!event.target.closest("#certification-drop")) return;
    event.preventDefault();
    beginCertificationUpload(event.dataTransfer.files[0]?.name || "qualification-evidence.pdf");
  });

  function beginCertificationUpload(name) {
    uploadTimers.forEach(clearTimeout);
    uploadTimers = [];
    state.certificationFile = name;
    state.certificationUploadProgress = name ? 35 : 0;
    saveState();
    render();
    if (!name) return;
    uploadTimers.push(setTimeout(() => {
      state.certificationUploadProgress = 72;
      saveState();
      if (route() === "investor/upload") render();
    }, 500));
    uploadTimers.push(setTimeout(() => {
      state.certificationUploadProgress = 100;
      saveState();
      if (route() === "investor/upload") render();
    }, 1100));
  }

  window.addEventListener("hashchange", render);
  window.addEventListener("storage", (event) => {
    if (event.key !== STORAGE_KEY) return;
    state = loadState();
    overlay = null;
    render();
    showToast("다른 포털에서 변경된 상태를 반영했습니다.");
  });
  render();
})();
