(() => {
  "use strict";

  const Model = window.PortalModel;
  const STORAGE_KEY = "corner-store-product-portal-demo-v1";
  const app = document.querySelector("#app");
  const toast = document.querySelector("#toast");
  let timer = null;
  let toastTimer = null;
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

  function navItem(label, target, active, icon) {
    return `<button class="nav-item ${active ? "is-active" : ""}" data-route="${target}">
      <span class="nav-icon">${icon}</span><span>${label}</span>
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
        <nav aria-label="주요 메뉴">${navigation.map(([label, target, key, icon]) => navItem(label, target, active === key, icon)).join("")}</nav>
        <div class="sidebar-grow"></div>
        <div class="demo-boundary">REFERENCE DEMO · 실제 주문/인증 없음</div>
        <a class="portal-link" href="${investor ? "#/issuer/home" : "#/investor/home"}">${investor ? "발행사 데모 열기" : "투자자 데모 열기"} ↗</a>
        <div class="account-chip">
          ${investor ? '<img src="/assets/robin-avatar.svg" width="28" height="28" alt="" />' : '<span class="issuer-avatar">A</span>'}
          <span><strong>${investor ? "Robin" : "ABC 자산운용"}</strong><small>${investor ? "0xB0B7...91C4" : "Peter"}</small></span>
          <span class="chevron">▾</span>
        </div>
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

  function stat(label, value, detail = "") {
    return `<article class="stat-card"><span>${label}</span><strong>${value}</strong>${detail ? `<small>${detail}</small>` : ""}</article>`;
  }

  function investorHome(postTrade = false) {
    const qualified = state.investorQualified;
    return shell("investor", "홈", `
      ${header(`안녕하세요, Robin님`, postTrade ? "ABCF 주문이 체결되었습니다" : qualified ? "모든 거래 자격이 준비되었습니다" : "거래 자격을 신청하면 자산 2종을 더 거래할 수 있습니다")}
      ${postTrade ? '<div class="alert success"><strong>체결 완료</strong><span>ABC 사모 펀드 토큰 50개가 내 자산에 반영됐습니다.</span></div>' : ""}
      <section class="stats-grid">
        ${stat("총 평가액", postTrade ? "37,400,000 원" : "32,400,000 원")}
        ${stat("보유 자산", postTrade ? "3종" : "2종")}
        ${stat("거래 가능한 자산", qualified ? "4종" : "2종")}
      </section>
      <section class="card">
        <div class="card-heading"><strong>${qualified ? "추천 자산" : "해야 할 일"}</strong><span>${qualified ? "2종" : "2건"}</span></div>
        ${qualified ? taskRow("ABC 사모 펀드 토큰", "최소 주문 50개 · 기준가 100,000원", "주문하기", "investor/order") : `
          ${taskRow("KLM 주식", "거래 자격만 신청하면 바로 거래할 수 있습니다", "거래 자격 신청", "investor/qualification")}
          ${taskRow("ABC 사모 펀드 토큰", "인증 1개가 더 필요합니다", "거래 자격 신청", "investor/asset", "secondary")}`}
      </section>
      <section class="home-lower">
        <div class="card"><div class="card-heading"><strong>보유 자산</strong><button class="text-button" data-route="investor/assets">전체 보기 ›</button></div>
          ${holdingRow("국고채 토큰", "1,200주", "24,000,000 원")}${holdingRow("MMF 토큰", "840주", "8,400,000 원")}
        </div>
        <div class="card"><div class="card-heading"><strong>최근 거래</strong><button class="text-button" data-route="investor/assets">전체 보기 ›</button></div>
          ${postTrade ? recentTradeRow("ABCF 매수", "오늘", "+50주") : ""}${recentTradeRow("국고채 토큰 매수", "09-01", "+400주")}${recentTradeRow("MMF 토큰 매수", "08-28", "+840주")}
        </div>
      </section>`);
  }

  function taskRow(title, description, action, target, variant = "primary") {
    return `<div class="task-row"><span><strong>${title}</strong><small>${description}</small></span><button class="button ${variant}" data-route="${target}">${action}</button></div>`;
  }

  function holdingRow(name, amount, value) {
    return `<div class="holding-row"><span class="holding-icon"></span><span><strong>${name}</strong><small>${amount}</small></span><b>${value}</b></div>`;
  }

  function recentTradeRow(name, date, amount) {
    return `<div class="recent-trade-row"><span><strong>${name}</strong><small>${date}</small></span><b>${amount}</b></div>`;
  }

  function investorTrade() {
    const assets = Model.assets(state);
    return shell("investor", "trade", `
      ${header("거래하기", "내 인증과 자산별 규칙을 기준으로 지금 거래 가능한 자산을 확인합니다")}
      ${state.issuerAssetListed ? '<div class="alert success"><strong>신규 자산</strong><span>ABC 사모 펀드 토큰이 거래 목록에 등록됐습니다.</span></div>' : ""}
      <div class="filter-row"><button class="filter is-active">전체</button><button class="filter">거래 가능</button><button class="filter">자격 필요</button><span class="filter-spacer"></span>${badge(`${assets.length}개 자산`)}</div>
      <section class="asset-grid">${assets.map(assetCard).join("")}</section>`);
  }

  function assetCard(asset) {
    const eligible = asset.eligible || state.investorQualified;
    const target = eligible ? (asset.symbol === "ABCF" ? "investor/order" : "investor/assets") : "investor/asset";
    return `<button class="asset-card" data-route="${target}">
      <span class="asset-symbol">${asset.symbol}</span>
      <span class="asset-title"><strong>${asset.name}</strong><small>${asset.symbol}</small></span>
      ${eligible ? badge("거래 가능", "positive") : badge(`조건 ${asset.missing}개 부족`, "negative")}
      <span class="asset-meta"><span>기준가 <strong>${asset.price}</strong></span><span>최소 주문 <strong>${asset.minimum}</strong></span></span>
      <span class="asset-arrow">→</span>
    </button>`;
  }

  const eligibility = [
    ["ONCHAINID 신원", true, "신원 확인됨"],
    ["제재 목록", true, "제재 대상 아님"],
    ["허용 국가", true, "대한민국"],
    ["적격투자자", true, "인증 보유"],
    ["고액투자자", false, "추가 인증 필요"]
  ];

  function investorAsset() {
    return shell("investor", "trade", `
      <button class="back" data-route="investor/trade">← 거래 목록</button>
      ${header("ABC 사모 펀드 토큰", "ABCF · ABC 자산운용")}
      <section class="two-column">
        <div>
          <div class="hero-card"><span class="asset-symbol large">ABCF</span><div><small>기준가</small><strong>100,000 원</strong></div><div><small>최소 주문</small><strong>50개</strong></div></div>
          <section class="card eligibility-card"><div class="card-heading"><strong>거래 자격</strong>${badge("1개 인증 필요", "negative")}</div>
            ${eligibility.map(([label, ok, detail], index) => `<details class="condition" ${index === 4 ? "open" : ""}><summary><span class="status-dot ${ok ? "ok" : "no"}">${ok ? "✓" : "×"}</span><strong>${label}</strong><span>${detail}</span></summary><p>${ok ? "현재 지갑의 PII-free 자격 증거가 조건을 충족합니다." : "고액 투자자 인증기관에서 인증을 완료한 뒤 거래 자격을 신청하세요."}</p></details>`).join("")}
          </section>
        </div>
        <aside class="side-card"><h2>거래 준비</h2><p>부족한 인증을 완료하면 이 자산의 거래 자격을 요청할 수 있습니다.</p><button class="button primary full" data-route="investor/qualification">거래 자격 신청</button><small>실제 인증기관으로 정보를 전송하지 않습니다.</small></aside>
      </section>`);
  }

  function investorQualification() {
    const items = ["본인 명의 지갑입니다", "투자 위험을 확인했습니다", "자산별 거래 제한에 동의합니다", "고액 투자자 인증을 제출합니다"];
    const ready = Model.qualificationReady(state);
    return shell("investor", "trade", `
      <button class="back" data-route="investor/asset">← ABC 사모 펀드 토큰</button>
      ${header("거래 자격 신청", "필요한 확인과 인증을 차례로 완료해 주세요")}
      <section class="two-column"><div class="card form-card"><div class="card-heading"><strong>신청 전 확인</strong><span>${state.qualificationChecks.filter(Boolean).length} / 4</span></div>
        ${items.map((item, index) => `<label class="check-row"><input type="checkbox" data-check="${index}" ${state.qualificationChecks[index] ? "checked" : ""}/><span><strong>${item}</strong><small>${index === 3 ? "인증기관을 선택하고 증빙을 제출합니다" : "확인 결과는 이 브라우저 데모에만 저장됩니다"}</small></span></label>`).join("")}
      </div><aside class="side-card"><h2>다음 단계</h2><p>${ready ? "인증기관을 선택할 준비가 됐습니다." : "모든 항목을 확인하면 계속할 수 있습니다."}</p><button class="button primary full" data-route="investor/provider" ${ready ? "" : "disabled"}>인증기관 선택</button></aside></section>`);
  }

  function providerModal() {
    return `${investorQualification()}<div class="modal-backdrop" data-action="close-provider"><section class="modal" role="dialog" aria-modal="true" aria-labelledby="provider-title" data-modal-panel>
      <button class="modal-close" data-action="close-provider" aria-label="닫기">×</button><p class="eyebrow">인증 1 / 2</p><h2 id="provider-title">인증기관 선택</h2><p>고액 투자자 인증을 발급할 기관을 선택하세요.</p>
      <div class="provider-list"><button data-provider="Korea Trust"><span class="provider-mark">KT</span><span><strong>Korea Trust</strong><small>예상 처리 1–2일</small></span><span>→</span></button><button data-provider="Atlas Verify"><span class="provider-mark">AV</span><span><strong>Atlas Verify</strong><small>예상 처리 2–3일</small></span><span>→</span></button></div>
      <p class="privacy-note">이 reference demo는 파일을 서버로 업로드하거나 PII를 저장하지 않습니다.</p>
    </section></div>`;
  }

  function investorUpload() {
    return shell("investor", "trade", `
      <button class="back" data-route="investor/qualification">← 거래 자격 신청</button>
      ${header("인증 서류 제출", `${state.provider || "선택한 인증기관"}에서 검토할 파일을 선택해 주세요`, "인증 2 / 2")}
      <section class="upload-wrap"><div class="card form-card"><div class="card-heading"><strong>증빙 파일</strong>${state.certificationFile ? badge("선택됨", "positive") : badge("필수")}</div>
        <label class="drop-zone" id="certification-drop"><input id="certification-file" type="file" accept=".pdf,.png,.jpg,.jpeg"/><span class="upload-icon">↑</span><strong>${state.certificationFile ? escapeHtml(state.certificationFile) : "파일을 놓거나 클릭해 선택"}</strong><small>PDF, PNG, JPG · 데모에서는 파일 내용이 전송되지 않습니다</small></label>
        <div class="upload-progress ${state.certificationFile ? "is-complete" : ""}"><span></span></div>
        <button class="button primary" data-action="submit-certification" ${state.certificationFile ? "" : "disabled"}>인증 요청 제출</button>
      </div></section>`);
  }

  function loadingScreen(title, description, steps, current) {
    return shell("investor", "trade", `<section class="center-state"><div class="spinner" aria-hidden="true"></div>${header(title, description)}<ol class="timeline">${steps.map((step, index) => `<li class="${index <= current ? "done" : ""}"><span>${index < current ? "✓" : index + 1}</span>${step}</li>`).join("")}</ol><p class="privacy-note">창을 닫아도 실제 작업이 실행되지는 않는 reference demo입니다.</p></section>`);
  }

  function qualificationReady() {
    return shell("investor", "trade", `
      ${header("인증이 완료되었습니다", "고액 투자자 인증을 거래 자격 신청에 포함할 수 있습니다")}
      <section class="two-column"><div class="card"><div class="success-panel"><span>✓</span><h2>고액 투자자 인증</h2><p>${state.provider} · 유효기간 2027.09.05</p></div><label class="message-field"><span>검토 담당자에게 남길 말 (선택)</span><textarea id="qualification-message" placeholder="추가로 전달할 내용을 입력하세요"></textarea></label></div><aside class="side-card"><h2>신청 내용</h2>${eligibility.map(([label, ok]) => `<div class="mini-row"><span>${label}</span>${badge(ok || label === "고액투자자" ? "준비됨" : "필요", ok || label === "고액투자자" ? "positive" : "negative")}</div>`).join("")}<button class="button primary full" data-action="submit-qualification">거래 자격 신청</button></aside></section>`);
  }

  function qualificationApproved() {
    return shell("investor", "trade", `<section class="center-state"><div class="success-ring">✓</div>${header("거래 자격이 승인되었습니다", "ABC 사모 펀드 토큰을 포함한 4개 자산을 거래할 수 있습니다")}<button class="button primary" data-route="investor/order">ABCF 주문하기</button><button class="button secondary" data-route="investor/trade">거래 목록 보기</button></section>`);
  }

  function investorOrder(stage = "order") {
    const valid = Model.isMinimumOrder(state.orderAmount);
    const price = Number(state.orderAmount || 0) * 100000;
    const quoteReady = stage === "quote";
    if (stage === "loading") return loadingScreen("견적을 받고 있습니다", "복수의 딜러에게 요청을 전달했습니다", ["주문 조건 확인", "딜러 견적 요청", "최적 견적 선택"], 1);
    if (stage === "fill") return loadingScreen("체결 중입니다", "서명된 견적과 온체인 조건을 마지막으로 확인합니다", ["견적 잠금", "컴플라이언스 확인", "자산 결제"], 1);
    return shell("investor", "trade", `
      <button class="back" data-route="investor/trade">← ABC 사모 펀드 토큰</button>${header("주문하기", "딜러 견적을 받은 뒤 최종 체결합니다")}
      <section class="two-column"><div class="card form-card"><div class="card-heading"><strong>주문 수량</strong>${badge("최소 50개")}</div>
        <label class="amount-field"><span>수량</span><input id="order-amount" type="number" min="0" max="500" step="10" value="${state.orderAmount}"/><strong>ABCF</strong></label>
        <input class="range" id="order-range" type="range" min="0" max="500" step="10" value="${state.orderAmount}" aria-label="주문 수량"/>
        <div class="range-label"><span>0</span><span>최소 50</span><span>500</span></div>
        ${valid ? '<div class="alert success compact"><strong>주문 가능</strong><span>최소 주문 수량을 충족합니다.</span></div>' : '<div class="alert danger compact"><strong>수량 부족</strong><span>최소 50개 이상 입력해 주세요.</span></div>'}
        ${quoteReady ? `<div class="quote-box"><div><span>도착한 최적 견적</span>${badge("15초 남음", "warning")}</div><strong>${price.toLocaleString("ko-KR")} 원</strong><small>단가 100,000원 · 딜러 Han River Markets · 수수료 포함</small></div>` : ""}
      </div><aside class="side-card order-summary"><h2>주문 요약</h2><div class="mini-row"><span>자산</span><strong>ABCF</strong></div><div class="mini-row"><span>수량</span><strong>${state.orderAmount}개</strong></div><div class="mini-row"><span>예상 금액</span><strong>${price.toLocaleString("ko-KR")} 원</strong></div>
      <button class="button primary full" data-action="${quoteReady ? "accept-quote" : "request-quote"}" ${valid ? "" : "disabled"}>${quoteReady ? "이 견적으로 체결" : "견적 요청"}</button><small>견적 요청과 체결은 모두 시뮬레이션입니다.</small></aside></section>`);
  }

  function investorComplete() {
    return shell("investor", "trade", `<section class="center-state"><div class="success-ring">✓</div>${header("체결이 완료되었습니다", "ABC 사모 펀드 토큰 50개가 내 자산에 반영됐습니다")}<div class="receipt"><div><span>주문 번호</span><strong>CS-ABCF-0905</strong></div><div><span>체결 금액</span><strong>5,000,000 원</strong></div><div><span>딜러</span><strong>Han River Markets</strong></div></div><div class="button-row"><button class="button primary" data-action="complete-home">홈으로</button><button class="button secondary" data-route="investor/assets">내 자산 보기</button></div></section>`);
  }

  function investorAssets() {
    return shell("investor", "assets", `${header("내 자산", "현재 보유 수량과 평가액")}
      <div class="tabs"><button class="is-active">보유 자산</button><button data-route="investor/certifications">인증 현황</button></div>
      <section class="card"><div class="table-row table-head"><span>자산</span><span>보유 수량</span><span>평가액</span><span>상태</span></div>
      ${state.postTrade ? '<div class="table-row"><strong>ABCF</strong><span>50</span><span>5,000,000 원</span><span class="positive">거래 가능</span></div>' : ""}<div class="table-row"><strong>KTB</strong><span>1,200</span><span>12,000,000 원</span><span class="positive">거래 가능</span></div><div class="table-row"><strong>MMF</strong><span>840</span><span>20,160,000 원</span><span class="positive">거래 가능</span></div></section>`);
  }

  function investorCertifications() {
    const certs = [["ONCHAINID 신원", "확인됨", "2027.09.05"], ["제재 목록", "통과", "실시간"], ["국가", "대한민국", "2027.09.05"], ["적격투자자", "유효", "2027.06.30"], ["고액투자자", state.investorQualified ? "유효" : "미보유", state.investorQualified ? "2027.09.05" : "-"]];
    return shell("investor", "certifications", `${header("내 인증", "개인정보 대신 자격 상태와 유효기간만 표시합니다")}
      <div class="tabs"><button data-route="investor/assets">보유 자산</button><button class="is-active">인증 현황</button></div><section class="card cert-list">${certs.map(([name, status, date]) => `<div><span class="status-dot ${status === "미보유" ? "no" : "ok"}">${status === "미보유" ? "×" : "✓"}</span><strong>${name}</strong><span>${status}</span><small>${date}</small></div>`).join("")}</section>`);
  }

  function investorPaused() {
    return shell("investor", "trade", `${header("주문하기", "ABC 사모 펀드 토큰")}
      <div class="alert warning"><strong>주문이 일시 중지되었습니다</strong><span>운영자가 시장 상태를 확인하고 있습니다. 기존 자산과 인증에는 영향이 없습니다.</span></div><section class="two-column"><div class="card form-card muted"><div class="card-heading"><strong>주문 수량</strong>${badge("일시 중지", "warning")}</div><label class="amount-field"><span>수량</span><input value="50" disabled/><strong>ABCF</strong></label></div><aside class="side-card"><h2>주문 요약</h2><p>거래가 재개되면 새 견적을 요청해야 합니다.</p><button class="button primary full" disabled>견적 요청</button><button class="button secondary full" data-route="investor/trade">거래 목록으로</button></aside></section>`);
  }

  function issuerHome() {
    return shell("issuer", "홈", `${header("안녕하세요, Peter님", "등록 중인 자산과 운영 상태를 확인하세요")}
      <section class="stats-grid">${stat("운영 중인 자산", state.issuerAssetListed ? "2종" : "1종")}${stat("등록 진행 중", state.issuerAssetListed ? "0건" : "1건")}${stat("이번 달 체결", state.issuerAssetListed ? "28건" : "24건")}</section>
      <section class="card"><div class="card-heading"><strong>자산 등록 현황</strong><button class="button primary small" data-route="issuer/basic">새 자산 등록</button></div>
        ${state.issuerAssetListed ? taskRow("ABC 사모 펀드 토큰", "거래 중 · ABCF", "현황 보기", "issuer/metrics") : taskRow("ABC 사모 펀드 토큰", "자료 준비 단계 · 5/7 준비됨", "계속하기", "issuer/evidence")}
        ${taskRow("ABC 글로벌 채권 토큰", "거래 중 · ABCG", "현황 보기", "issuer/metrics")}
      </section>`);
  }

  const issuerFields = [
    ["name", "자산 이름", "ABC 사모 펀드 토큰", "text"], ["symbol", "심볼", "ABCF", "text"],
    ["supply", "총 발행량", "1000000", "number"], ["minimum", "최소 주문 수량", "50", "number"],
    ["contract", "토큰 컨트랙트", "0xABCF...2048", "text"]
  ];

  function issuerBasic() {
    const complete = issuerFields.every(([key]) => String(state.issuerForm[key]).trim()) && state.issuerForm.chain;
    return shell("issuer", "register", `${header("기본 정보", "투자자에게 표시할 자산 정보를 입력해 주세요", "자산 등록 1 / 4")}
      <section class="two-column"><form class="card form-card" id="issuer-form"><div class="field-grid">${issuerFields.map(([key, label, placeholder, type]) => `<label><span>${label}</span><input name="${key}" type="${type}" value="${escapeHtml(state.issuerForm[key])}" placeholder="${placeholder}"/></label>`).join("")}<label><span>블록체인</span><select name="chain"><option ${state.issuerForm.chain === "Ethereum" ? "selected" : ""}>Ethereum</option><option ${state.issuerForm.chain === "GIWA" ? "selected" : ""}>GIWA</option></select></label></div></form><aside class="side-card"><h2>입력 안내</h2><p>컨트랙트 주소는 외부 ERC-3643 신뢰 경계입니다. 이 데모는 라이브 wiring을 검증하지 않습니다.</p><button class="button primary full" data-route="issuer/rules" ${complete ? "" : "disabled"}>발행 조건 선택</button></aside></section>`);
  }

  const questionData = [
    ["offering", "어떤 방식으로 발행하셨나요", [["reg-d", "Reg D 506(c)", "사모 · 적격투자자 대상"], ["reg-s", "Reg S", "역외 발행"], ["registered", "등록증권", "공모 · 상장"]]],
    ["fund", "펀드에 해당하나요", [["private-fund", "사모펀드", "투자자 수 제한"], ["public-fund", "공모펀드", "공개 모집"], ["no", "해당 없음", "일반 증권"]]],
    ["investor", "누가 투자할 수 있나요", [["qualified", "적격투자자", "기관·전문투자자"], ["high-value", "고액투자자", "추가 자산 기준"], ["all", "모든 인증 투자자", "기본 KYC"]]],
    ["holding", "최소 보유 기간이 있나요", [["90", "90일", "양도 제한"], ["180", "180일", "장기 보유"], ["none", "없음", "즉시 양도"]]],
    ["distribution", "분배 주기는 어떻게 되나요", [["quarterly", "분기", "3개월마다"], ["monthly", "매월", "월별 분배"], ["none", "없음", "분배 없음"]]]
  ];

  function issuerRules() {
    const ready = Model.issuerRulesReady(state);
    const rules = Model.compiledRules(state);
    return shell("issuer", "register", `${header("발행 조건", "자산이 어떤 규정으로 발행됐는지 골라 주세요", "자산 등록 2 / 4")}
      <section class="two-column"><div><div class="alert warning compact"><strong>!</strong><span>법률 검토를 마친 결과를 입력해 주세요. 이 화면은 법률 검토를 대신하지 않습니다.</span></div><section class="card form-card questions">${questionData.map(([key, title, answers], index) => `<fieldset><legend><span>${index + 1}.</span>${title}</legend><div class="answer-tiles">${answers.map(([value, label, detail]) => `<button type="button" class="answer-tile ${state.issuerAnswers[key] === value ? "is-selected" : ""}" data-question="${key}" data-answer="${value}"><strong>${label}</strong><small>${detail}</small></button>`).join("")}</div></fieldset>`).join("")}</section></div>
      <aside class="side-card sticky"><h2>적용될 거래 규칙</h2><div class="rule-badges">${rules.length ? rules.map((rule) => badge(rule, "accent")).join("") : '<p class="empty">답변을 선택하면 규칙이 표시됩니다.</p>'}</div><div class="mini-row"><span>예상 거래 가능 투자자</span><strong>${ready ? "128명" : "-"}</strong></div><div class="mini-row"><span>필요 자료</span><strong>${ready ? "7개" : "-"}</strong></div><button class="button primary full" data-route="issuer/evidence" ${ready ? "" : "disabled"}>자료 준비</button></aside></section>`);
  }

  const evidenceItems = [
    ["qualified", "적격투자자 인증 발급", "connect", "ABC 자산운용"], ["highValue", "고액 투자자 인증 발급", "connect", "ABC 자산운용"],
    ["acquisition", "취득일과 보유 이력", "upload", "파일 필요"], ["holders", "보유자 명부", "upload", "holders.csv"],
    ["related", "관계자 명단", "upload", "related-parties.csv"], ["sanctions", "제재 명단 확인", "connect", "연결 필요"],
    ["distribution", "분배 기간", "upload", "distribution-policy.pdf"]
  ];

  function issuerEvidence(modalKey = null) {
    const progress = Model.evidenceProgress(state);
    const body = shell("issuer", "register", `${header("자료 준비", "각 항목을 눌러 파일을 업로드하거나 시스템을 연결해 주세요", "자산 등록 3 / 4")}
      <section class="two-column"><section class="card evidence-card"><div class="card-heading"><strong>필요한 자료</strong><span>${progress.ready} / ${progress.total} 준비됨</span></div>${evidenceItems.map(([key, label, mode, detail]) => `<button class="evidence-row" data-evidence="${key}"><span class="status-dot ${state.evidence[key] ? "ok" : "no"}">${state.evidence[key] ? "○" : "×"}</span><strong>${label}</strong><span>${state.evidence[key] ? detail : mode === "upload" ? "파일을 올려 주세요" : "시스템을 연결해 주세요"}</span><em>${state.evidence[key] ? "변경" : mode === "upload" ? "업로드" : "연결"}</em></button>`).join("")}</section>
      <aside class="side-card sticky"><h2>검토 준비</h2><div class="progress-count"><strong>${progress.ready}</strong><span>/ ${progress.total}</span></div><div class="progress-bar"><span class="progress-${progress.ready}"></span></div><p>${progress.ready === progress.total ? "필요한 자료가 모두 준비됐습니다." : `미제출 ${progress.total - progress.ready}건이 있어도 reference review를 진행할 수 있습니다.`}</p><button class="button ${progress.ready === progress.total ? "primary" : "warning-button"} full" data-action="submit-issuer-review">${progress.ready === progress.total ? "심사 요청" : "미완료 상태로 심사 요청"}</button></aside></section>`);
    return modalKey ? `${body}${evidenceModal(modalKey)}` : body;
  }

  function evidenceModal(key) {
    const item = evidenceItems.find(([itemKey]) => itemKey === key);
    if (!item) return "";
    const [, label, mode] = item;
    const upload = mode === "upload";
    return `<div class="modal-backdrop" data-action="close-evidence"><section class="modal" role="dialog" aria-modal="true" data-modal-panel><button class="modal-close" data-action="close-evidence" aria-label="닫기">×</button><p class="eyebrow">필요 자료</p><h2>${label}</h2><p>${upload ? "정책 또는 명부 파일을 선택해 주세요." : "PII-free 상태 증거를 제공하는 시스템을 연결합니다."}</p>${upload ? '<label class="drop-zone compact"><input id="evidence-file" type="file"/><span class="upload-icon">↑</span><strong>파일을 놓거나 클릭해 선택</strong><small>파일 내용은 서버로 전송되지 않습니다</small></label>' : '<label class="modal-field"><span>연결 이름</span><input value="ABC 자산운용 인증 시스템" readonly/></label><label class="modal-field"><span>Evidence endpoint</span><input value="https://evidence.example.invalid/status" readonly/></label>'}<button class="button primary full" data-complete-evidence="${key}">${upload ? "업로드 완료" : "연결 확인"}</button></section></div>`;
  }

  function issuerReview() {
    return shell("issuer", "register", `<section class="center-state"><div class="spinner"></div>${header("심사가 진행 중입니다", "규칙 구성과 제출 자료를 확인하고 있습니다", "자산 등록 4 / 4")}<ol class="timeline"><li class="done"><span>✓</span>기본 정보</li><li class="done"><span>✓</span>발행 조건</li><li class="done"><span>✓</span>자료 준비</li><li class="done"><span>4</span>최종 검토</li></ol></section>`);
  }

  function issuerLive() {
    return shell("issuer", "register", `<section class="center-state"><div class="success-ring">✓</div>${header("거래가 시작되었습니다", "ABC 사모 펀드 토큰이 투자자 거래 목록에 공개됐습니다")}<div class="receipt"><div><span>심볼</span><strong>ABCF</strong></div><div><span>최소 주문</span><strong>50개</strong></div><div><span>상태</span><strong class="positive">거래 중</strong></div></div><button class="button primary" data-route="issuer/metrics">자산 현황 보기</button><a class="button secondary" href="#/investor/trade">투자자 화면에서 확인</a></section>`);
  }

  function issuerMetrics() {
    const active = state.issuerAssetListed;
    return shell("issuer", "assets", `${header(active ? "ABC 사모 펀드 토큰" : "ABC 글로벌 채권 토큰", active ? "ABCF · 거래 중" : "ABCG · 거래 중")}
      <section class="stats-grid">${stat("총 체결 금액", active ? "128,500,000 원" : "840,000,000 원", "+12.4%")}${stat("보유 투자자", active ? "18명" : "64명")}${stat("이번 달 체결", active ? "28건" : "24건")}</section>
      <section class="two-column dashboard"><div class="card chart-card"><div class="card-heading"><strong>체결 금액</strong><span>최근 7일</span></div><div class="chart" aria-label="최근 7일 체결 금액 막대 그래프">${[32, 54, 42, 68, 51, 82, 74].map((height, index) => `<span class="height-${height}"><small>${index + 1}일</small></span>`).join("")}</div></div><aside class="card recent-card"><div class="card-heading"><strong>최근 체결</strong><span>실시간</span></div>${[["09:42", "50 ABCF", "5,000,000원"], ["09:18", "120 ABCF", "12,000,000원"], ["어제", "80 ABCF", "8,000,000원"]].map((row) => `<div class="recent-row"><span>${row[0]}</span><strong>${row[1]}</strong><span>${row[2]}</span></div>`).join("")}</aside></section>`);
  }

  function render() {
    clearTimeout(timer);
    const current = route();
    if (current === "investor/approved" && !state.investorQualified) {
      state.investorQualified = true;
      saveState();
    }
    if (current === "issuer/live" && !state.issuerAssetListed) {
      state.issuerAssetListed = true;
      saveState();
    }
    const views = {
      "investor/home": () => investorHome(false), "investor/post-trade": () => investorHome(true), "investor/trade": investorTrade,
      "investor/asset": investorAsset, "investor/qualification": investorQualification, "investor/provider": providerModal,
      "investor/upload": investorUpload, "investor/review": () => loadingScreen("인증을 검토하고 있습니다", "선택한 인증기관이 제출 상태를 확인합니다", ["파일 확인", "인증기관 검토", "인증 발급"], 1),
      "investor/qualification-ready": qualificationReady, "investor/application-review": () => loadingScreen("거래 자격을 검토하고 있습니다", "자산 규칙과 현재 인증을 대조합니다", ["신원 확인", "인증 확인", "자산 규칙 적용"], 1),
      "investor/approved": qualificationApproved, "investor/order": () => investorOrder("order"), "investor/quote-loading": () => investorOrder("loading"),
      "investor/quote": () => investorOrder("quote"), "investor/fill": () => investorOrder("fill"), "investor/complete": investorComplete,
      "investor/assets": investorAssets, "investor/certifications": investorCertifications, "investor/paused": investorPaused,
      "issuer/home": issuerHome, "issuer/basic": issuerBasic, "issuer/rules": issuerRules, "issuer/evidence": () => issuerEvidence(),
      "issuer/review": issuerReview, "issuer/live": issuerLive, "issuer/metrics": issuerMetrics
    };
    app.innerHTML = (views[current] || views["investor/home"])();
    const range = document.querySelector("#order-range");
    if (range) range.style.setProperty("--range-progress", `${Math.min(100, state.orderAmount / 5)}%`);
    document.title = `${current.startsWith("issuer") ? "발행사" : "투자자"} · Corner Store`;

    const transitions = {
      "investor/review": [2500, "investor/qualification-ready"],
      "investor/application-review": [2000, "investor/approved"],
      "investor/quote-loading": [2000, "investor/quote"],
      "investor/fill": [2500, "investor/complete"],
      "issuer/review": [2500, "issuer/live"]
    };
    if (transitions[current]) timer = setTimeout(() => go(transitions[current][1]), transitions[current][0]);
    if (current === "investor/approved") showToast("거래 자격이 승인되었습니다.");
    if (current === "issuer/live") showToast("ABCF가 투자자 거래 목록에 공개됐습니다.");
  }

  app.addEventListener("click", (event) => {
    const routeButton = event.target.closest("[data-route]");
    if (routeButton && !routeButton.disabled) return go(routeButton.dataset.route);

    const provider = event.target.closest("[data-provider]");
    if (provider) {
      state.provider = provider.dataset.provider;
      saveState();
      return go("investor/upload");
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
    if (action === "close-provider") {
      if (event.target.closest("[data-modal-panel]") && !event.target.matches(".modal-close")) return;
      return go("investor/qualification");
    }
    if (action === "close-evidence") {
      if (event.target.closest("[data-modal-panel]") && !event.target.matches(".modal-close")) return;
      return render();
    }
    if (action === "submit-certification") return go("investor/review");
    if (action === "submit-qualification") return go("investor/application-review");
    if (action === "request-quote") return go("investor/quote-loading");
    if (action === "accept-quote") return go("investor/fill");
    if (action === "complete-home") {
      state.postTrade = true;
      saveState();
      go("investor/post-trade");
      return showToast("체결 내역과 보유 자산이 갱신되었습니다.");
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
      state.certificationFile = event.target.files[0]?.name || null;
      saveState();
      return render();
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
    state.certificationFile = event.dataTransfer.files[0]?.name || "qualification-evidence.pdf";
    saveState();
    render();
  });

  window.addEventListener("hashchange", render);
  render();
})();
