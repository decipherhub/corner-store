const $ = (id) => document.getElementById(id);
const KNOWN_NETWORKS = new Set(["anvil", "sepolia", "arbitrum-sepolia", "arbitrum-one", "giwa"]);
const DEMO_BROADCAST_NETWORKS = new Set(["anvil"]);
const MODULE_PRESETS = {
  pricingModule: new Set(["corner-store.fixed-rate", "integrator.pricing"]),
  riskModule: new Set(["corner-store.noop-risk", "integrator.risk"]),
  signerModule: new Set(["integrator.signer"]),
  nonceModule: new Set(["corner-store.in-memory-nonce", "integrator.nonce"])
};
const HELP_CONTENT = {
  "library-only": {
    title: "Library only는 언제 사용하나요?",
    body: `
      <p>Corner Store의 타입, quote 생성 규칙과 모듈 인터페이스만 가져가고 HTTP 서버와 운영 구조는 직접 만드는 방식입니다.</p>
      <h3>생성되는 것</h3><ul><li>RFQ SDK를 사용하는 프로젝트 골격</li><li>Pricing, Risk, Signer, Nonce 모듈 연결 지점</li><li>설정 및 conformance test</li></ul>
      <h3>직접 만들어야 하는 것</h3><ul><li>HTTP API 또는 worker</li><li>인증, DB, 모니터링과 배포 환경</li></ul>
      <div class="dialog-example">기존 서버 없음 + 자체 아키텍처로 새로 개발\n→ Library only</div>`
  },
  "reference-service": {
    title: "Reference service는 어떻게 사용하나요?",
    body: `
      <p>실행 가능한 최소 RFQ HTTP 서비스를 먼저 생성하고, 데모 모듈을 실제 Pricing·Risk·Signer·Nonce 구현으로 하나씩 교체하는 방식입니다.</p>
      <h3>적합한 경우</h3><ul><li>빠르게 PoC나 데모를 실행할 때</li><li>Corner Store 권장 경계를 출발점으로 사용할 때</li><li>선택적으로 Docker 예제가 필요할 때</li></ul>
      <div class="dialog-example">Reference API 실행\n→ fixed-rate를 NAV pricing으로 교체\n→ in-memory nonce를 DB nonce로 교체</div>
      <div class="dialog-boundary">Reference 기본 모듈은 production 완성품이 아닙니다. 특히 fixed-rate, no-op risk와 in-memory nonce는 교체 대상입니다.</div>`
  },
  "existing-backend": {
    title: "Existing backend는 어떻게 연결하나요?",
    body: `
      <p>이미 운영 중인 API, 인증, DB와 배포 파이프라인을 유지하면서 Corner Store의 모듈 계약만 구현하는 방식입니다.</p>
      <h3>연결 순서</h3><ul><li>기존 가격 엔진을 rfq.price.v1 adapter로 감쌉니다.</li><li>기존 risk와 signer를 capability contract에 연결합니다.</li><li>기존 DB에서 maker-scoped nonce를 원자적으로 할당합니다.</li></ul>
      <div class="dialog-example">증권사 기존 백엔드\n+ Corner Store module adapters\n+ Router settlement</div>`
  },
  network: {
    title: "Network target에는 무엇을 고르나요?",
    body: `
      <p>설정과 dry-run을 만들 대상 EVM 네트워크입니다. Anvil 외 네트워크도 RPC를 입력해 계획을 검토할 수 있습니다.</p>
      <ul><li><b>Anvil</b>: 로컬 reference stack 직접 배포 가능</li><li><b>Arbitrum/GIWA/기타 EVM</b>: 현재 Studio에서는 dry-run과 검토만 가능</li></ul>
      <div class="dialog-boundary">Production network는 브라우저에서 바로 broadcast하지 않습니다. 향후 multisig proposal, HSM signer와 contract verification을 갖춘 production adapter가 실행해야 합니다.</div>`
  },
  rpc: {
    title: "RPC URL은 무엇인가요?",
    body: `<p>Studio와 CLI가 선택한 블록체인 노드에 접속할 주소입니다. 로컬 Anvil, 사내 노드 또는 RPC provider가 발급한 endpoint를 입력합니다.</p><div class="dialog-example">Local: http://127.0.0.1:8545\nHosted: https://&lt;provider-endpoint&gt;</div><div class="dialog-boundary">API key가 포함된 RPC는 project JSON에 저장하지 않고 실행 환경에서 주입하는 것이 안전합니다.</div>`
  },
  "asset-profile": {
    title: "Asset profile은 무엇인가요?",
    body: `<p>reference 배포에 적용할 규제 자산 정책 예시입니다. BUIDL-like는 QP·최소 투자금·claim freshness를, Reg D는 Regulation D 발행 흐름을 보여줍니다.</p><div class="dialog-boundary">실제 BUIDL, Securitize 또는 법률 승인을 의미하지 않습니다. Production 자산은 별도의 onboarding과 정책 검토가 필요합니다.</div>`
  },
  artifact: {
    title: "Artifact path는 왜 필요한가요?",
    body: `<p>배포된 Router, ComplianceEngine, RFQ Adapter 등의 주소를 기록하는 JSON 위치입니다. Backend, Operator API와 Dashboard는 이 파일을 주소의 source of truth로 사용해야 합니다.</p><div class="dialog-example">deployments/anvil-e2e.json\n→ router\n→ engine\n→ rfqAdapter\n→ makerAuthorizer</div>`
  },
  operator: {
    title: "Operator role label",
    body: `<p>정책 등록, Maker 승인과 긴급 운영을 담당할 역할의 식별 이름입니다. 현재 reference config에서는 설명용 label이며 브라우저 signer 주소가 아닙니다.</p><div class="dialog-example">예: treasury-operator, compliance-ops</div>`
  },
  investor: {
    title: "Investor fixture label",
    body: `<p>데모에서 거래 흐름을 확인할 투자자 persona의 이름입니다. 실제 funded Anvil account와 claim은 demo scenario JSON에서 준비됩니다.</p><div class="dialog-example">예: eligible-investor, expired-claim-investor</div>`
  },
  maker: {
    title: "Maker role label",
    body: `<p>RFQ 견적을 서명하고 반대편 inventory를 제공하는 dealer 역할의 이름입니다. 이름을 입력한다고 Maker가 온체인 승인되는 것은 아닙니다.</p><div class="dialog-example">예: primary-dealer, treasury-maker</div>`
  },
  governance: {
    title: "Governance label",
    body: `<p>정책 변경과 권한 인계를 승인할 외부 governance 또는 multisig의 식별 이름입니다. 현재 Studio가 Safe를 생성하거나 private key를 보관하지는 않습니다.</p><div class="dialog-example">예: issuer-safe, protocol-governance</div>`
  },
  approvals: {
    title: "Required approvals",
    body: `<p>향후 생성되는 governance proposal을 실행하기 전에 요구할 승인 수입니다. 예를 들어 2이면 최소 2명의 승인을 기대한다는 뜻입니다.</p><div class="dialog-boundary">현재 reference 배포 컨트랙트 안에 n-of-m signer 로직을 만드는 값은 아닙니다.</div>`
  },
  pricing: {
    title: "Pricing module 선택",
    body: `<p>Maker가 amountIn과 amountOut을 계산하는 구현입니다.</p><ul><li><b>Fixed rate</b>: 데모용 고정 비율</li><li><b>Integrator pricing</b>: 기존 NAV·oracle·dealer pricing 연결 지점</li><li><b>Custom</b>: 조직이 구현한 module ID</li></ul>`
  },
  risk: {
    title: "Risk module 선택",
    body: `<p>Quote를 서명하기 전에 inventory, 한도와 가격 편차를 검사합니다.</p><ul><li><b>No-op risk</b>: 데모용, 추가 검사를 하지 않음</li><li><b>Integrator risk</b>: 기존 risk engine 연결 지점</li></ul><div class="dialog-boundary">Production에서 no-op risk 사용은 권장하지 않습니다.</div>`
  },
  signer: {
    title: "Signer module 선택",
    body: `<p>EIP-712 RFQ quote에 서명하는 외부 권한 경계입니다. 실제 운영에서는 HSM, KMS 또는 별도 signer service가 구현해야 합니다.</p><div class="dialog-boundary">Studio와 project JSON에는 private key를 저장하지 않습니다.</div>`
  },
  nonce: {
    title: "Nonce module 선택",
    body: `<p>같은 quote가 중복 사용되지 않도록 Maker별 고유 nonce를 할당합니다.</p><ul><li><b>In-memory</b>: 데모용, 재시작 시 상태가 사라질 수 있음</li><li><b>Durable integrator nonce</b>: DB에서 원자적으로 할당하는 production 연결 지점</li></ul>`
  }
};
const state = {
  project: "",
  snapshot: null,
  doctorReady: false,
  planReady: false,
  verified: false,
  plan: null,
  artifact: null,
  operationsUrl: "",
  runtime: null
};

document.addEventListener("DOMContentLoaded", boot);

async function boot() {
  bindControls();
  try {
    const health = await api("/api/v1/health");
    $("apiLed").classList.add("is-pass");
    $("apiStatus").textContent = "Local API ready";
    $("workspacePath").textContent = health.workspaceRoot;
    state.runtime = health.runtime;
    setNetworkTarget(health.runtime.broadcastNetwork);
    $("rpcUrl").value = health.runtime.defaultRpcUrl;
    $("broadcastPolicy").textContent = `${health.runtime.broadcastNetwork} · ${health.runtime.allowedRpcHosts.join(", ")}`;
    await loadProjects();
  } catch (error) {
    $("apiStatus").textContent = "Local API unavailable";
    message("projectMessage", error.message, true);
  }
}

function bindControls() {
  document.querySelectorAll(".workflow-step").forEach((button) => {
    button.onclick = () => {
      document.querySelectorAll(".workflow-step").forEach((item) => item.classList.remove("is-current"));
      button.classList.add("is-current");
      $(button.dataset.target).scrollIntoView({behavior: "smooth", block: "start"});
    };
  });
  document.querySelectorAll('input[name="mode"]').forEach((input) => {
    input.onchange = () => {
      document.querySelectorAll(".mode-card").forEach((card) => card.classList.toggle("is-selected", card.contains(input)));
      $("dockerCompose").disabled = input.value !== "reference-service";
      if ($("dockerCompose").disabled) $("dockerCompose").checked = false;
      applyModuleDefaults(input.value);
      if (state.project) invalidatePlan();
    };
  });
  document.querySelectorAll("[data-help-topic]").forEach((button) => {
    button.onclick = (event) => {
      event.preventDefault();
      event.stopPropagation();
      openContextHelp(button.dataset.helpTopic);
    };
  });
  $("closeContextDialog").onclick = () => $("contextDialog").close();
  $("contextDialog").onclick = (event) => {
    if (event.target === $("contextDialog")) $("contextDialog").close();
  };
  $("networkPreset").onchange = () => {
    const custom = $("networkPreset").value === "custom";
    $("network").hidden = !custom;
    if (!custom) $("network").value = $("networkPreset").value;
    updateNetworkNote();
    if (state.project) invalidatePlan();
  };
  $("network").oninput = () => {
    updateNetworkNote();
    if (state.project) invalidatePlan();
  };
  for (const moduleId of Object.keys(MODULE_PRESETS)) {
    $(moduleId).onchange = () => {
      toggleCustomModule(moduleId);
      if (state.project) invalidatePlan();
    };
  }
  $("projectSelector").onchange = () => selectProject($("projectSelector").value);
  $("createProject").onclick = createProject;
  $("saveConfiguration").onclick = saveConfig;
  $("runDoctor").onclick = runDoctor;
  $("reviewPlan").onclick = reviewPlan;
  $("deployDemo").onclick = deployDemo;
  $("verifyArtifact").onclick = verifyArtifact;
  $("openOperations").onclick = () => {
    if (state.operationsUrl) window.open(state.operationsUrl, "_blank", "noopener");
  };
  $("configSection").querySelectorAll("input, select, textarea").forEach((input) => {
    input.addEventListener("input", invalidatePlan);
    input.addEventListener("change", invalidatePlan);
  });
  document.querySelectorAll("[data-activation]").forEach((input) => {
    input.onchange = saveActivation;
  });
}

function invalidatePlan() {
  state.doctorReady = false;
  state.planReady = false;
  state.plan = null;
  $("doctorChecks").className = "check-list empty-state";
  $("doctorChecks").textContent = "Configuration changed. Save it, then run doctor again.";
  $("planReview").className = "plan-review empty-state";
  $("planReview").textContent = "Configuration or RPC changed. Generate a new dry-run before deployment.";
  refreshDeployGate();
}

async function loadProjects() {
  const result = await api("/api/v1/projects");
  const selector = $("projectSelector");
  selector.innerHTML = '<option value="">No project</option>';
  result.projects.forEach((project) => selector.add(new Option(project.name, project.name)));
  const requested = localStorage.getItem("corner-store-studio-project");
  const selected = result.projects.find((item) => item.name === requested)?.name ?? result.projects[0]?.name;
  if (selected) {
    selector.value = selected;
    await selectProject(selected);
  }
}

async function selectProject(name) {
  if (!name) return;
  const snapshot = await api(`/api/v1/projects/${encodeURIComponent(name)}`);
  state.project = name;
  state.snapshot = snapshot;
  state.doctorReady = false;
  state.planReady = false;
  state.verified = snapshot.activation?.artifactVerified === true;
  localStorage.setItem("corner-store-studio-project", name);
  hydrate(snapshot);
  setProjectControls(true);
  $("projectState").textContent = "Configured";
  message("projectMessage", `Loaded ${name}.`, false);
  await refreshArtifact();
  await refreshHandoff();
  refreshDeployGate();
  updateWorkflowState();
}

async function createProject() {
  const mode = document.querySelector('input[name="mode"]:checked').value;
  setBusy($("createProject"), true, "Creating…");
  try {
    const result = await api("/api/v1/projects", {
      method: "POST",
      body: {
        name: $("projectName").value.trim(),
        mode,
        docker: $("dockerCompose").checked
      }
    });
    await loadProjects();
    $("projectSelector").value = result.project.name;
    await selectProject(result.project.name);
  } catch (error) {
    message("projectMessage", error.message, true);
  } finally {
    setBusy($("createProject"), false, "Create integration project");
  }
}

function hydrate(snapshot) {
  const config = snapshot.config;
  const integration = snapshot.integration;
  if (config) {
    setNetworkTarget(config.deployment.network);
    $("assetProfile").value = config.asset.profile;
    $("artifactPath").value = config.deployment.artifact;
    $("venueRfq").checked = config.venues.rfq;
    $("venueAmm").checked = config.venues.amm;
    $("operatorAccount").value = config.accounts.operator;
    $("investorAccount").value = config.accounts.investor;
    $("makerAccount").value = config.accounts.maker;
    $("multisig").value = config.governance.multisig;
    $("requiredApprovals").value = config.governance.requiredApprovals;
  }
  if (integration) {
    const modeInput = document.querySelector(`input[name="mode"][value="${CSS.escape(integration.mode)}"]`);
    if (modeInput) {
      modeInput.checked = true;
      document.querySelectorAll(".mode-card").forEach((card) => card.classList.toggle("is-selected", card.contains(modeInput)));
      $("dockerCompose").disabled = integration.mode !== "reference-service";
      $("dockerCompose").checked = integration.deployment?.dockerCompose === true;
    }
    setModuleValue("pricingModule", integration.modules.pricing.moduleId);
    setModuleValue("riskModule", integration.modules.risk.moduleId);
    setModuleValue("signerModule", integration.modules.signer.moduleId);
    setModuleValue("nonceModule", integration.modules.nonce.moduleId);
  }
  if (snapshot.scenario) $("scenarioJson").value = JSON.stringify(snapshot.scenario, null, 2);
  Object.entries(snapshot.activation ?? {}).forEach(([key, value]) => {
    const input = document.querySelector(`[data-activation="${key}"]`);
    if (input) input.checked = value === true;
  });
}

function setProjectControls(enabled) {
  for (const id of ["saveConfiguration", "runDoctor", "reviewPlan"]) $(id).disabled = !enabled;
}

async function saveConfig() {
  try {
    const config = {
      schemaVersion: 1,
      deployment: {artifact: $("artifactPath").value.trim(), network: selectedNetwork()},
      asset: {profile: $("assetProfile").value},
      venues: {amm: $("venueAmm").checked, rfq: $("venueRfq").checked, orderBook: false},
      accounts: {
        operator: $("operatorAccount").value.trim(),
        investor: $("investorAccount").value.trim(),
        maker: $("makerAccount").value.trim()
      },
      governance: {
        multisig: $("multisig").value.trim(),
        requiredApprovals: Number($("requiredApprovals").value)
      }
    };
    const integration = buildIntegration(document.querySelector('input[name="mode"]:checked').value);
    const scenario = JSON.parse($("scenarioJson").value);
    await api(`/api/v1/projects/${encodeURIComponent(state.project)}/config`, {method: "PUT", body: config});
    await api(`/api/v1/projects/${encodeURIComponent(state.project)}/integration`, {method: "PUT", body: integration});
    await api(`/api/v1/projects/${encodeURIComponent(state.project)}/scenario`, {method: "PUT", body: scenario});
    state.doctorReady = false;
    state.planReady = false;
    state.verified = false;
    state.snapshot = await api(`/api/v1/projects/${encodeURIComponent(state.project)}`);
    message("configMessage", "Saved the three versioned project files.", false);
    await refreshHandoff();
    refreshDeployGate();
  } catch (error) {
    message("configMessage", error.message, true);
  }
}

function buildIntegration(mode) {
  const definitions = {
    pricing: [selectedModule("pricingModule"), "rfq.price.v1", ["RFQ_PRICE_NUMERATOR", "RFQ_PRICE_DENOMINATOR"]],
    risk: [selectedModule("riskModule"), "rfq.risk.pre-sign.v1", []],
    signer: [selectedModule("signerModule"), "rfq.sign.eip712.v1", ["RFQ_SIGNER_PRIVATE_KEY"]],
    nonce: [selectedModule("nonceModule"), "rfq.nonce.maker-scoped.v1", []]
  };
  return {
    schemaVersion: 1,
    mode,
    sdk: {package: "@corner-store/rfq-service", version: "0.1.0"},
    modules: Object.fromEntries(Object.entries(definitions).map(([kind, [moduleId, capability, env]]) => [kind, {
      moduleId, moduleVersion: "1.0.0", capabilities: [capability], env
    }])),
    deployment: {dockerCompose: mode === "reference-service" && $("dockerCompose").checked}
  };
}

function applyModuleDefaults(mode) {
  const reference = mode === "reference-service";
  setModuleValue("pricingModule", reference ? "corner-store.fixed-rate" : "integrator.pricing");
  setModuleValue("riskModule", reference ? "corner-store.noop-risk" : "integrator.risk");
  setModuleValue("signerModule", "integrator.signer");
  setModuleValue("nonceModule", reference ? "corner-store.in-memory-nonce" : "integrator.nonce");
}

function setNetworkTarget(value) {
  const known = KNOWN_NETWORKS.has(value);
  $("networkPreset").value = known ? value : "custom";
  $("network").value = value;
  $("network").hidden = known;
  updateNetworkNote();
}

function selectedNetwork() {
  return $("networkPreset").value === "custom"
    ? $("network").value.trim()
    : $("networkPreset").value;
}

function updateNetworkNote() {
  if (!$("networkModeNote")) return;
  const network = selectedNetwork();
  const direct = isDirectDemoTarget(network);
  $("networkModeNote").textContent = direct
    ? `${network} matches the operator-injected direct demo deployment policy.`
    : `${network || "Custom target"} is available for configuration and dry-run review; direct Studio broadcast remains disabled.`;
}

function isDirectDemoTarget(network) {
  return Boolean(
    state.runtime &&
    DEMO_BROADCAST_NETWORKS.has(state.runtime.broadcastNetwork) &&
    network === state.runtime.broadcastNetwork
  );
}

function setModuleValue(id, value) {
  const known = MODULE_PRESETS[id].has(value);
  $(id).value = known ? value : "custom";
  $(`${id}Custom`).value = known ? "" : value;
  toggleCustomModule(id);
}

function toggleCustomModule(id) {
  $(`${id}Custom`).hidden = $(id).value !== "custom";
}

function selectedModule(id) {
  const value = $(id).value === "custom" ? $(`${id}Custom`).value.trim() : $(id).value;
  if (!value) throw new Error(`${id.replace("Module", "")} custom module ID is required.`);
  return value;
}

function openContextHelp(topic) {
  const content = HELP_CONTENT[topic];
  if (!content) return;
  $("contextDialogTitle").textContent = content.title;
  $("contextDialogBody").innerHTML = content.body;
  $("contextDialog").showModal();
}

async function runDoctor() {
  setBusy($("runDoctor"), true, "Checking…");
  try {
    const result = await api(`/api/v1/projects/${encodeURIComponent(state.project)}/doctor`, {method: "POST"});
    state.doctorReady = result.ready === true;
    renderChecks(result.checks ?? []);
    refreshDeployGate();
  } catch (error) {
    state.doctorReady = false;
    $("doctorChecks").className = "check-list empty-state";
    $("doctorChecks").textContent = error.message;
  } finally {
    setBusy($("runDoctor"), false, "Run doctor");
  }
}

function renderChecks(checks) {
  $("doctorChecks").className = "check-list";
  $("doctorChecks").innerHTML = checks.map((check) => `
    <div class="check-row">
      <span class="status-led ${check.pass ? "is-pass" : ""}"></span>
      <b>${escapeHtml(check.name)}</b>
      <span>${escapeHtml(check.detail)}</span>
      <em>${check.required ? "required" : "optional"}</em>
    </div>`).join("");
}

async function reviewPlan() {
  setBusy($("reviewPlan"), true, "Planning…");
  try {
    const result = await api(`/api/v1/projects/${encodeURIComponent(state.project)}/deploy/plan`, {
      method: "POST", body: {rpcUrl: $("rpcUrl").value.trim()}
    });
    state.plan = result;
    state.planReady = true;
    renderPlan(result);
    refreshDeployGate();
  } catch (error) {
    state.planReady = false;
    $("planReview").className = "plan-review empty-state";
    $("planReview").textContent = error.message;
  } finally {
    setBusy($("reviewPlan"), false, "Generate dry-run");
  }
}

function renderPlan(plan) {
  $("planReview").className = "plan-review";
  $("planReview").innerHTML = `
    <div class="plan-grid">
      <div><span>Profile</span><strong>${escapeHtml(plan.profile)}</strong></div>
      <div><span>Network</span><strong>${escapeHtml(plan.config.deployment.network)}</strong></div>
      <div><span>RPC</span><strong>${escapeHtml(plan.rpcUrl)}</strong></div>
      <div><span>Artifact</span><strong>${escapeHtml(plan.artifactPath)}</strong></div>
      <div><span>RFQ</span><strong>${plan.config.venues.rfq ? "enabled" : "disabled"}</strong></div>
      <div><span>AMM</span><strong>${plan.config.venues.amm ? "enabled" : "disabled"}</strong></div>
      <div><span>Contracts</span><strong>${escapeHtml(plan.contractSource ?? "bundled")}</strong></div>
      <div><span>Mutation</span><strong>dry-run only</strong></div>
    </div>
    <div class="command-block">${escapeHtml(plan.command ?? "No command returned")}</div>`;
}

function refreshDeployGate() {
  const allowed = state.runtime &&
    isDirectDemoTarget(selectedNetwork()) &&
    isAllowedRpc($("rpcUrl").value, state.runtime.allowedRpcHosts);
  $("gateDoctor").classList.toggle("is-pass", state.doctorReady);
  $("gatePlan").classList.toggle("is-pass", state.planReady);
  $("gateNetwork").classList.toggle("is-pass", allowed);
  $("gateNetworkLabel").textContent = allowed
    ? "Operator broadcast policy matched"
    : "Requires the Anvil demo profile and an operator-allowlisted RPC host";
  $("deployDemo").disabled = !(state.project && state.doctorReady && state.planReady && allowed);
  updateWorkflowState();
}

function updateWorkflowState() {
  const completed = {
    project: Boolean(state.project),
    config: Boolean(state.project),
    doctor: state.doctorReady,
    plan: state.planReady,
    deploy: Boolean(state.artifact),
    artifact: state.verified,
    activation: state.verified
  };
  const order = ["project", "config", "doctor", "plan", "deploy", "artifact", "activation"];
  let previousComplete = true;
  for (const stage of order) {
    const step = document.querySelector(`[data-stage="${stage}"]`);
    if (!step) continue;
    step.classList.toggle("is-complete", completed[stage]);
    step.classList.toggle("is-blocked", !completed[stage] && !previousComplete);
    previousComplete = previousComplete && completed[stage];
  }
}

function isAllowedRpc(value, allowedHosts) {
  try {
    const host = new URL(value).hostname;
    return allowedHosts.includes(host);
  } catch {
    return false;
  }
}

async function deployDemo() {
  setBusy($("deployDemo"), true, "Deploying…");
  $("deployLog").textContent = "$ Starting guarded local reference deployment…\n";
  try {
    const result = await api(`/api/v1/projects/${encodeURIComponent(state.project)}/deploy`, {
      method: "POST", body: {rpcUrl: $("rpcUrl").value.trim()}
    });
    const stream = new EventSource(`/api/v1/jobs/${encodeURIComponent(result.jobId)}/events`);
    stream.onmessage = (event) => {
      const payload = JSON.parse(event.data);
      $("deployLog").textContent += `${payload.line}\n`;
      $("deployLog").scrollTop = $("deployLog").scrollHeight;
    };
    stream.addEventListener("done", async (event) => {
      const job = JSON.parse(event.data);
      stream.close();
      setBusy($("deployDemo"), false, "Deploy reference stack");
      if (job.status === "succeeded") {
        $("deployLog").textContent += "Artifact ready for verification.\n";
        await refreshArtifact();
        $("verifyArtifact").disabled = false;
      } else {
        $("deployLog").textContent += `FAILED: ${job.error}\n`;
      }
    });
    stream.onerror = () => {
      stream.close();
      setBusy($("deployDemo"), false, "Deploy reference stack");
    };
  } catch (error) {
    $("deployLog").textContent += `BLOCKED: ${error.message}\n`;
    setBusy($("deployDemo"), false, "Deploy reference stack");
  }
}

async function refreshArtifact() {
  if (!state.project) return;
  try {
    state.artifact = await api(`/api/v1/projects/${encodeURIComponent(state.project)}/artifact`);
    renderArtifact(state.artifact);
    $("verifyArtifact").disabled = false;
    updateWorkflowState();
  } catch {
    state.artifact = null;
    $("artifactViewer").className = "artifact-grid empty-state";
    $("artifactViewer").textContent = "The deployment artifact will appear here as the address source of truth.";
    $("verifyArtifact").disabled = true;
    updateWorkflowState();
  }
}

function renderArtifact(artifact) {
  const priority = ["assetProfile", "router", "engine", "rwaToken", "quote", "rfqAdapter", "makerAuthorizer", "rfqVenue", "ammAdapter", "pool", "elementReg", "recipeReg", "policyReg", "operatorReg", "factory", "scenarioHash"];
  const keys = [...priority.filter((key) => artifact[key] !== undefined), ...Object.keys(artifact).filter((key) => !priority.includes(key))];
  $("artifactViewer").className = "artifact-grid";
  $("artifactViewer").innerHTML = keys.map((key) => `
    <div class="artifact-item" title="${escapeHtml(String(artifact[key]))}">
      <span>${escapeHtml(key)}</span><code>${escapeHtml(String(artifact[key]))}</code>
    </div>`).join("");
}

async function verifyArtifact() {
  setBusy($("verifyArtifact"), true, "Verifying…");
  try {
    const result = await api(`/api/v1/projects/${encodeURIComponent(state.project)}/verify`, {method: "POST"});
    state.verified = result.ready === true;
    $("verifySummary").className = `verify-summary ${state.verified ? "is-pass" : ""}`;
    $("verifySummary").textContent = state.verified
      ? `Basic artifact verification passed · ${(result.checks ?? []).length} bindings checked`
      : "Artifact verification failed.";
    await refreshHandoff();
    updateWorkflowState();
  } catch (error) {
    state.verified = false;
    $("verifySummary").className = "verify-summary";
    $("verifySummary").textContent = error.message;
  } finally {
    setBusy($("verifyArtifact"), false, "Verify artifact");
  }
}

async function saveActivation() {
  if (!state.project) return;
  const body = {};
  document.querySelectorAll("[data-activation]").forEach((input) => {
    body[input.dataset.activation] = input.checked;
  });
  await api(`/api/v1/projects/${encodeURIComponent(state.project)}/activation`, {method: "PUT", body});
}

async function refreshHandoff() {
  if (!state.project) return;
  const handoff = await api(`/api/v1/projects/${encodeURIComponent(state.project)}/handoff`);
  state.operationsUrl = handoff.url;
  $("openOperations").disabled = !handoff.enabled;
  $("handoffMessage").className = `handoff-card ${handoff.enabled ? "is-ready" : ""}`;
  $("handoffMessage").innerHTML = handoff.enabled
    ? "<strong>Verified deployment ready</strong><span>Open the existing runtime dashboard with this artifact as its source of truth.</span>"
    : `<strong>Operations handoff locked</strong><span>${escapeHtml(handoff.reason)}</span>`;
  updateWorkflowState();
}

async function api(path, options = {}) {
  const method = options.method ?? "GET";
  const mutation = method === "POST" || method === "PUT";
  const response = await fetch(path, {
    method,
    headers: mutation ? {"content-type": "application/json"} : undefined,
    body: options.body ? JSON.stringify(options.body) : undefined
  });
  const body = await response.json();
  if (!response.ok) throw new Error(body.message ?? body.error ?? `Request failed (${response.status})`);
  return body;
}

function setBusy(button, busy, text) {
  button.disabled = busy;
  button.textContent = text;
}

function message(id, text, error) {
  const target = $(id);
  target.textContent = text;
  target.className = `inline-message ${error ? "is-error" : "is-pass"}`;
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  })[character]);
}
