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
  "production-network": {
    title: "Production network.name",
    body: `<p>Toolkit production config의 <code>network.name</code>입니다. 사람이 검토하는 target label이며 chainId와 RPC가 실제 실행 대상을 고정합니다.</p><div class="dialog-example">arbitrum-one\nsepolia\nissuer-private-evm</div>`
  },
  "production-chain": {
    title: "Production network.chainId",
    body: `<p>실제 runtime RPC가 보고해야 하는 EVM chain id입니다. production-preflight가 이 값과 RPC 응답의 일치를 검사합니다.</p><div class="dialog-boundary">Studio는 chainId를 저장하고 검토 명령을 실행할 뿐, 브라우저에서 transaction을 만들지 않습니다.</div>`
  },
  "production-rpc": {
    title: "Production network.rpcUrl",
    body: `<p>Toolkit production config의 runtime RPC endpoint입니다. 브라우저에 private key나 signer secret을 입력하지 않으며, RPC credential은 운영 환경에서 주입하는 구성을 권장합니다.</p>`
  },
  "production-rpc-hosts": {
    title: "Approved RPC hosts",
    body: `<p>배포 검토에서 승인한 RPC provider hostname 목록입니다. 실행 시 URL을 환경변수로 바꿔도 이 목록 밖의 provider로는 production command가 진행되지 않습니다.</p><div class="dialog-example">arb-mainnet.example\narb-backup.example</div>`
  },
  "production-release": {
    title: "Reviewed contract release",
    body: `<p>Source commit은 사람이 승인한 Git revision이고, Contract bundle SHA-256은 실제 Foundry 입력 파일 묶음의 결정적 hash입니다. production-deploy는 현재 파일 hash가 config 및 dry-run evidence와 정확히 같은 경우에만 실행됩니다.</p><div class="dialog-example">corner-store production-source-hash</div>`
  },
  "production-deployment-id": {
    title: "Production deploymentId",
    body: `<p>production-plan command와 artifact lineage에 들어가는 stable deployment label입니다. Toolkit validator는 letters, numbers, underscore, dot, dash만 허용합니다.</p><div class="dialog-example">issuer-mainnet-2026-07\nfund-a-arbitrum-one</div>`
  },
  "production-addresses": {
    title: "Production deployer and operator",
    body: `<p>Deployer는 외부 signer가 Foundry command에서 사용할 sender address이고, Operator는 production core가 운영 권한으로 받을 address입니다. Studio는 둘 다 주소로만 저장합니다.</p><div class="dialog-boundary">이 필드들은 private key, account password 또는 signer session이 아닙니다.</div>`
  },
  "production-artifact": {
    title: "Production deployment.artifact",
    body: `<p>production-plan이 배포 결과를 기록해야 하는 artifact 위치입니다. downstream 운영 도구가 주소 source of truth로 읽을 경로를 명확히 고정합니다.</p><div class="dialog-example">deployments/issuer-mainnet-core.json</div><div class="dialog-boundary">현재 실행기는 안전한 단일 파일 경로 <code>deployments/&lt;filename&gt;.json</code>만 허용합니다.</div>`
  },
  "production-safe": {
    title: "Existing Safe",
    body: `<p>이미 만들어진 Safe proxy 주소입니다. Studio는 Safe를 생성하거나 owner transaction을 서명하지 않습니다. preflight는 proxy code hash, singleton, owner set과 threshold를 모두 대조합니다.</p>`
  },
  "production-safe-implementation": {
    title: "Safe singleton and proxy code",
    body: `<p>선택한 Safe release/provider가 공표한 singleton 주소와 실제 Safe proxy runtime bytecode의 keccak256 hash를 입력합니다. ABI가 같은 가짜 governance contract를 차단하기 위한 필수 검증값입니다.</p><div class="dialog-boundary">Explorer 화면에서 임의 복사하지 말고 사용하는 Safe 배포 문서·release evidence와 대조하십시오.</div>`
  },
  "production-evidence": {
    title: "Frozen deployment evidence",
    body: `<p>현재 production config hash에 묶인 dry-run 및 target-chain fork simulation 결과 파일입니다. CLI production-deploy는 configHash, chainId, sourceCommit과 pass 상태가 유효하지 않으면 broadcast하지 않습니다.</p><div class="dialog-example">deployments/production-evidence.json</div>`
  },
  "production-owners": {
    title: "Expected owner list M",
    body: `<p>Safe에 있어야 하는 owner address 목록입니다. 한 줄에 하나씩 입력하며 duplicate와 zero address는 Toolkit validation에서 거부됩니다.</p>`
  },
  "production-threshold": {
    title: "Threshold N",
    body: `<p>Safe 실행에 필요한 승인 수입니다. N은 1 이상이고 owner list size M 이하이어야 합니다.</p><div class="dialog-example">M = 3 owners\nN = 2 threshold</div>`
  },
  "production-token": {
    title: "Existing ERC-3643 token",
    body: `<p>이미 배포된 ERC-3643 token을 production preflight에 포함할 때만 입력합니다. 비워 두면 existing asset preflight를 하지 않습니다.</p><div class="dialog-boundary">Production core plan은 token을 배포하지 않습니다.</div>`
  },
  "production-venues": {
    title: "Production venues",
    body: `<p>Toolkit production config의 <code>venues</code> flags입니다. RFQ 또는 AMM 중 최소 하나가 켜져야 preflight와 plan이 통과합니다.</p>`
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
  productionPreflightReady: false,
  productionPlan: null,
  plan: null,
  artifact: null,
  operationsUrl: "",
  runtime: null,
  dexRuntime: null
};

document.addEventListener("DOMContentLoaded", boot);

async function boot() {
  bindControls();
  setDeploymentTarget(document.querySelector('input[name="deploymentTarget"]:checked').value);
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
  document.querySelectorAll('input[name="deploymentTarget"]').forEach((input) => {
    input.onchange = () => setDeploymentTarget(input.value);
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
  $("saveProductionConfig").onclick = saveProductionConfig;
  $("runProductionPreflight").onclick = runProductionPreflight;
  $("generateProductionPlan").onclick = generateProductionPlan;
  $("exportProductionPlan").onclick = exportProductionPlan;
  $("productionOwners").addEventListener("input", updateProductionOwnerNote);
  $("productionThreshold").addEventListener("input", updateProductionOwnerNote);
  $("runDoctor").onclick = runDoctor;
  $("reviewPlan").onclick = reviewPlan;
  $("deployDemo").onclick = deployDemo;
  $("verifyArtifact").onclick = verifyArtifact;
  $("startDexDemo").onclick = startDexDemo;
  $("stopDexDemo").onclick = stopDexDemo;
  $("openOperations").onclick = () => {
    if (state.dexRuntime?.state === "running" && state.operationsUrl) {
      window.open(state.operationsUrl, "_blank", "noopener");
    }
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
  hydrateProduction(snapshot.production);
  Object.entries(snapshot.activation ?? {}).forEach(([key, value]) => {
    const input = document.querySelector(`[data-activation="${key}"]`);
    if (input) input.checked = value === true;
  });
}

function hydrateProduction(config) {
  if (config) {
    $("productionNetworkName").value = config.network?.name ?? "";
    $("productionChainId").value = config.network?.chainId ?? "";
    $("productionRpcUrl").value = config.network?.rpcUrl ?? "";
    $("productionApprovedRpcHosts").value = Array.isArray(config.network?.approvedRpcHosts)
      ? config.network.approvedRpcHosts.join("\n")
      : "";
    $("productionSourceCommit").value = config.release?.sourceCommit ?? "";
    $("productionContractsHash").value = config.release?.contractsHash ?? "";
    $("productionDeploymentId").value = config.deploymentId ?? "";
    $("productionDeployer").value = config.deployer ?? "";
    $("productionOperator").value = config.operator ?? "";
    $("productionVenueRfq").checked = config.venues?.rfq !== false;
    $("productionVenueAmm").checked = config.venues?.amm === true;
    $("productionArtifactPath").value = config.deployment?.artifact ?? "deployments/production-core.json";
    $("productionEvidencePath").value = config.deployment?.evidence ?? "deployments/production-evidence.json";
    $("productionSafe").value = config.safe?.address ?? "";
    $("productionSafeSingleton").value = config.safe?.expectedSingleton ?? "";
    $("productionSafeCodeHash").value = config.safe?.proxyCodeHash ?? "";
    $("productionOwners").value = Array.isArray(config.safe?.expectedOwners)
      ? config.safe.expectedOwners.join("\n")
      : "";
    $("productionThreshold").value = config.safe?.threshold ?? "";
    $("productionToken").value = config.erc3643?.token ?? "";
  }
  updateProductionOwnerNote();
}

function setProjectControls(enabled) {
  for (const id of ["saveConfiguration", "runDoctor", "reviewPlan"]) $(id).disabled = !enabled;
  for (const id of ["saveProductionConfig", "runProductionPreflight"]) $(id).disabled = !enabled;
  $("generateProductionPlan").disabled = !enabled || !state.productionPreflightReady;
  $("exportProductionPlan").disabled = !state.productionPlan;
}

function setDeploymentTarget(value) {
  const production = value === "production";
  document.querySelectorAll(".target-card").forEach((card) => {
    const input = card.querySelector('input[name="deploymentTarget"]');
    card.classList.toggle("is-selected", input?.value === value);
  });
  $("referenceTargetPanel").hidden = production;
  $("productionTargetPanel").hidden = !production;
  document.querySelectorAll(".reference-only").forEach((node) => {
    node.hidden = production;
  });
  updateWorkflowState();
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

async function saveProductionConfig() {
  setBusy($("saveProductionConfig"), true, "Saving…");
  try {
    const config = buildProductionConfig();
    const saved = await api(`/api/v1/projects/${encodeURIComponent(state.project)}/production-config`, {
      method: "PUT",
      body: config
    });
    state.productionPreflightReady = false;
    state.productionPlan = null;
    hydrateProduction(saved);
    $("productionPreflight").className = "check-list empty-state";
    $("productionPreflight").textContent = "Production config saved. Run production-preflight before generating a plan.";
    $("productionPlanReview").className = "plan-review empty-state";
    $("productionPlanReview").textContent = "Production-plan output will appear here for review and export.";
    message("productionMessage", "Saved corner-store.production.json using the Toolkit ProductionConfig schema.", false);
    setProjectControls(Boolean(state.project));
  } catch (error) {
    message("productionMessage", error.message, true);
  } finally {
    setBusy($("saveProductionConfig"), false, "Save production config");
  }
}

function buildProductionConfig() {
  const owners = $("productionOwners").value
    .split(/\r?\n|,/)
    .map((value) => value.trim())
    .filter(Boolean);
  const token = $("productionToken").value.trim();
  const approvedRpcHosts = $("productionApprovedRpcHosts").value
    .split(/\r?\n|,/)
    .map((value) => value.trim())
    .filter(Boolean);
  return {
    schemaVersion: 1,
    network: {
      name: $("productionNetworkName").value.trim(),
      chainId: Number($("productionChainId").value),
      rpcUrl: $("productionRpcUrl").value.trim(),
      approvedRpcHosts
    },
    release: {
      sourceCommit: $("productionSourceCommit").value.trim(),
      contractsHash: $("productionContractsHash").value.trim()
    },
    deploymentId: $("productionDeploymentId").value.trim(),
    deployer: $("productionDeployer").value.trim(),
    operator: $("productionOperator").value.trim(),
    venues: {
      amm: $("productionVenueAmm").checked,
      rfq: $("productionVenueRfq").checked
    },
    safe: {
      address: $("productionSafe").value.trim(),
      expectedOwners: owners,
      threshold: Number($("productionThreshold").value),
      expectedSingleton: $("productionSafeSingleton").value.trim(),
      proxyCodeHash: $("productionSafeCodeHash").value.trim()
    },
    deployment: {
      artifact: $("productionArtifactPath").value.trim(),
      evidence: $("productionEvidencePath").value.trim()
    },
    ...(token ? {erc3643: {token}} : {})
  };
}

function updateProductionOwnerNote() {
  if (!$("productionOwnerNote")) return;
  const owners = $("productionOwners").value.split(/\r?\n|,/).map((value) => value.trim()).filter(Boolean);
  const threshold = Number($("productionThreshold").value || 0);
  $("productionOwnerNote").textContent = owners.length > 0
    ? `M = ${owners.length} expected owners; N = ${threshold || "unset"} threshold.`
    : "N must be between 1 and owner list size M.";
}

async function runProductionPreflight() {
  setBusy($("runProductionPreflight"), true, "Checking…");
  try {
    const result = await api(`/api/v1/projects/${encodeURIComponent(state.project)}/production-preflight`, {method: "POST"});
    state.productionPreflightReady = result.ready === true;
    renderProductionPreflight(result);
    $("generateProductionPlan").disabled = !state.productionPreflightReady;
    message("productionMessage", state.productionPreflightReady ? "Production preflight passed." : "Production preflight returned a non-ready result.", !state.productionPreflightReady);
  } catch (error) {
    state.productionPreflightReady = false;
    $("productionPreflight").className = "check-list empty-state";
    $("productionPreflight").textContent = error.message;
    message("productionMessage", error.message, true);
  } finally {
    setBusy($("runProductionPreflight"), false, "Run production preflight");
  }
}

function renderProductionPreflight(result) {
  const checks = Array.isArray(result.checks) ? result.checks : [
    {name: "production-preflight", pass: result.ready !== false, detail: result.output ?? "CLI preflight completed", required: true},
    {name: "browser-safety", pass: true, detail: "No browser signing, broadcast or private-key field is exposed", required: true}
  ];
  $("productionPreflight").className = "check-list";
  $("productionPreflight").innerHTML = checks.map((check) => `
    <div class="check-row">
      <span class="status-led ${check.pass ? "is-pass" : ""}"></span>
      <b>${escapeHtml(check.name)}</b>
      <span>${escapeHtml(check.detail ?? "")}</span>
      <em>${check.required === false ? "optional" : "required"}</em>
    </div>`).join("");
}

async function generateProductionPlan() {
  setBusy($("generateProductionPlan"), true, "Planning…");
  try {
    const result = await api(`/api/v1/projects/${encodeURIComponent(state.project)}/production-plan`, {method: "POST"});
    state.productionPlan = result;
    renderProductionPlan(result);
    $("exportProductionPlan").disabled = false;
    message("productionMessage", "Production plan generated for review and export.", false);
  } catch (error) {
    state.productionPlan = null;
    $("productionPlanReview").className = "plan-review empty-state";
    $("productionPlanReview").textContent = error.message;
    $("exportProductionPlan").disabled = true;
    message("productionMessage", error.message, true);
  } finally {
    setBusy($("generateProductionPlan"), false, "Generate production plan");
  }
}

function renderProductionPlan(plan) {
  $("productionPlanReview").className = "plan-review";
  $("productionPlanReview").innerHTML = `
    <div class="plan-grid">
      <div><span>Schema</span><strong>${escapeHtml(plan.schema ?? "corner-store-production")}</strong></div>
      <div><span>Network</span><strong>${escapeHtml(plan.config.network.name)}</strong></div>
      <div><span>ChainId</span><strong>${escapeHtml(plan.config.network.chainId)}</strong></div>
      <div><span>Deployment ID</span><strong>${escapeHtml(plan.config.deploymentId)}</strong></div>
      <div><span>Deployer</span><strong>${escapeHtml(plan.config.deployer)}</strong></div>
      <div><span>Operator</span><strong>${escapeHtml(plan.config.operator)}</strong></div>
      <div><span>RPC</span><strong>${escapeHtml(plan.config.network.rpcUrl)}</strong></div>
      <div><span>Safe</span><strong>${escapeHtml(plan.config.safe.address)}</strong></div>
      <div><span>M of N</span><strong>${escapeHtml(`${plan.config.safe.threshold} of ${plan.config.safe.expectedOwners.length}`)}</strong></div>
      <div><span>Venues</span><strong>${escapeHtml(`${plan.config.venues.rfq ? "RFQ" : ""}${plan.config.venues.rfq && plan.config.venues.amm ? " + " : ""}${plan.config.venues.amm ? "AMM" : ""}`)}</strong></div>
      <div><span>Token</span><strong>${escapeHtml(plan.config.erc3643?.token ?? "no existing asset preflight")}</strong></div>
      <div><span>Mutation</span><strong>export only</strong></div>
    </div>
    <div class="command-block">${escapeHtml(plan.command ?? plan.output ?? "No command returned")}</div>`;
}

function exportProductionPlan() {
  if (!state.productionPlan) return;
  const name = state.productionPlan.exportName ?? `${state.project}-production-plan.json`;
  const blob = new Blob([`${JSON.stringify(state.productionPlan, null, 2)}\n`], {type: "application/json"});
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  link.click();
  URL.revokeObjectURL(url);
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
        await runDoctor();
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
  state.dexRuntime = handoff.runtime ?? {state: "stopped"};
  const running = handoff.running === true;
  $("startDexDemo").disabled = !handoff.enabled || running;
  $("openOperations").disabled = !running;
  $("stopDexDemo").disabled = !running;
  $("handoffMessage").className = `handoff-card ${running ? "is-ready" : ""}`;
  $("handoffMessage").innerHTML = running
    ? `<strong>DEX running on verified deployment</strong><span>${escapeHtml(handoff.url)} · ${escapeHtml(state.artifact?.router ?? "Router from artifact")}</span>`
    : handoff.enabled
      ? "<strong>Verified deployment ready</strong><span>Start the DEX demo to launch all services with this exact artifact and RPC. No redeployment occurs.</span>"
      : `<strong>DEX handoff locked</strong><span>${escapeHtml(handoff.reason)}</span>`;
  updateWorkflowState();
}

async function startDexDemo() {
  setBusy($("startDexDemo"), true, "Starting DEX…");
  let started = false;
  try {
    state.dexRuntime = await api(`/api/v1/projects/${encodeURIComponent(state.project)}/runtime/start`, {
      method: "POST",
      body: {rpcUrl: $("rpcUrl").value.trim()}
    });
    started = true;
  } catch (error) {
    $("handoffMessage").className = "handoff-card";
    $("handoffMessage").innerHTML = `<strong>DEX start failed</strong><span>${escapeHtml(error.message)}</span>`;
  } finally {
    setBusy($("startDexDemo"), false, "Start DEX demo");
    if (started) await refreshHandoff();
  }
}

async function stopDexDemo() {
  setBusy($("stopDexDemo"), true, "Stopping…");
  let stopped = false;
  try {
    state.dexRuntime = await api(`/api/v1/projects/${encodeURIComponent(state.project)}/runtime/stop`, {
      method: "POST",
      body: {}
    });
    stopped = true;
  } catch (error) {
    $("handoffMessage").className = "handoff-card";
    $("handoffMessage").innerHTML = `<strong>DEX stop failed</strong><span>${escapeHtml(error.message)}</span>`;
  } finally {
    setBusy($("stopDexDemo"), false, "Stop DEX");
    if (stopped) await refreshHandoff();
  }
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
