const $ = (id) => document.getElementById(id);
const KNOWN_NETWORKS = new Set(["anvil", "sepolia", "arbitrum-sepolia", "arbitrum-one", "giwa"]);
const DEMO_BROADCAST_NETWORKS = new Set(["anvil"]);
const MODULE_PRESETS = {
  pricingModule: new Set(["corner-store.fixed-rate", "integrator.pricing"]),
  riskModule: new Set(["corner-store.noop-risk", "integrator.risk"]),
  signerModule: new Set(["integrator.signer"]),
  nonceModule: new Set(["corner-store.in-memory-nonce", "integrator.nonce"])
};
const KO_TEXT = {
  "Deployment Studio": "배포 스튜디오",
  "Local control surface": "로컬 제어 화면",
  "Project mode": "프로젝트 방식",
  "Create the integration shell": "통합 프로젝트 골격 생성",
  "Target & config": "대상 및 설정",
  "Reference or production core": "레퍼런스 또는 프로덕션 코어",
  "Doctor": "환경 점검",
  "Required environment checks": "필수 실행 환경 확인",
  "Deployment plan": "배포 계획",
  "Dry-run or production export": "Dry-run 또는 프로덕션 계획 내보내기",
  "Demo deploy": "데모 배포",
  "Operator-allowed target only": "운영자가 허용한 대상만",
  "Artifact & verify": "Artifact 및 검증",
  "Address source of truth": "주소의 단일 기준",
  "Activation": "활성화",
  "Operations handoff": "운영 환경 연결",
  "Connecting": "연결 중",
  "Local workspace": "로컬 작업 공간",
  "Configuration → evidence → operation": "설정 → 검증 근거 → 운영",
  "Build a regulated DEX from the real Corner Store workflow.": "Corner Store의 실제 흐름으로 규제 자산 DEX를 구성합니다.",
  "Current project": "현재 프로젝트",
  "No project": "프로젝트 없음",
  "Runtime constraints": "실행 환경 제한",
  "Operator policy is injected when the local control service starts.": "로컬 제어 서비스가 시작될 때 운영 정책이 주입됩니다.",
  "Direct deploy": "직접 배포",
  "Demo allowlist only": "허용된 데모 대상만",
  "Production core": "프로덕션 코어",
  "Preflight and plan export only": "사전 점검 및 계획 내보내기만",
  "Secrets": "비밀정보",
  "Browser prohibited": "브라우저 입력 금지",
  "01 / Project mode": "01 / 프로젝트 방식",
  "Choose how Corner Store enters your stack": "Corner Store를 어떤 방식으로 도입할지 선택합니다",
  "Not created": "생성되지 않음",
  "Library only": "라이브러리만 사용",
  "Import Corner Store modules inside a service you build.": "직접 개발한 서비스 안에서 Corner Store 모듈을 가져와 사용합니다.",
  "You own the HTTP and runtime boundary": "HTTP 및 실행 환경을 직접 구성",
  "Reference service": "레퍼런스 서비스",
  "Generate a minimal RFQ HTTP service, then replace modules.": "최소 RFQ HTTP 서비스를 생성한 뒤 필요한 모듈을 교체합니다.",
  "Fastest runnable starting point": "가장 빠르게 실행 가능한 시작점",
  "Existing backend": "기존 백엔드 연결",
  "Connect Corner Store modules to an API you already operate.": "운영 중인 API에 Corner Store 모듈을 연결합니다.",
  "Keep your current service boundary": "현재 서비스 구조 유지",
  "Project name": "프로젝트 이름",
  "Include optional Docker reference": "선택적 Docker 예제 포함",
  "Create integration project": "통합 프로젝트 생성",
  "02 / Target & configuration": "02 / 대상 및 설정",
  "Bind the JSON contracts the CLI actually consumes": "CLI가 실제로 사용하는 JSON 설정을 연결합니다",
  "Save reference configuration": "레퍼런스 설정 저장",
  "Reference deploy": "레퍼런스 배포",
  "Local/demo stack, guarded Anvil broadcast remains available after doctor and dry-run.": "로컬/데모 스택입니다. 환경 점검과 dry-run 이후 Anvil 배포가 허용됩니다.",
  "Save config, run production-preflight, preview and export production-plan. No browser broadcast or signing.": "설정을 저장하고 프로덕션 사전 점검과 계획 내보내기를 수행합니다. 브라우저 배포와 서명은 지원하지 않습니다.",
  "Network target": "대상 네트워크",
  "RPC URL": "RPC 주소",
  "Asset profile": "자산 프로필",
  "Artifact path": "Artifact 경로",
  "Execution venues": "거래 실행 방식",
  "Order Book · not implemented": "Order Book · 미구현",
  "Operator role label": "Operator 역할 이름",
  "Investor fixture label": "투자자 테스트 역할 이름",
  "Maker role label": "Maker 역할 이름",
  "Governance label": "Governance 역할 이름",
  "Required approvals": "필요 승인 수",
  "Reference account boundary": "레퍼런스 계정 범위",
  "Pricing module": "가격 산정 모듈",
  "Risk module": "리스크 모듈",
  "Signer module": "서명 모듈",
  "Nonce module": "Nonce 모듈",
  "Module contract, not package discovery": "모듈 계약 설정이며 패키지 검색 기능이 아닙니다",
  "Demo fixtures": "데모 테스트 데이터",
  "Inspect demo JSON": "데모 JSON 확인",
  "Browser broadcast": "브라우저 배포",
  "Browser signing": "브라우저 서명",
  "Secret fields": "비밀정보 필드",
  "Disabled": "비활성화",
  "Rejected": "거부",
  "Network name": "네트워크 이름",
  "Actual chainId": "실제 chainId",
  "Runtime RPC": "실행 RPC",
  "Approved RPC hosts": "허용된 RPC 호스트",
  "Release source commit": "검토된 소스 커밋",
  "Contract bundle SHA-256": "컨트랙트 번들 SHA-256",
  "Deployment ID": "배포 ID",
  "Deployer address": "배포자 주소",
  "Operator address": "Operator 주소",
  "Evidence path": "검증 근거 경로",
  "Existing Safe": "기존 Safe",
  "Expected Safe singleton": "예상 Safe singleton",
  "Safe proxy code hash": "Safe proxy 코드 해시",
  "Threshold N": "승인 기준 N",
  "Production venues": "프로덕션 거래 실행 방식",
  "Expected owner list M": "예상 owner 목록 M",
  "Existing ERC-3643 token": "기존 ERC-3643 토큰",
  "Save production config": "프로덕션 설정 저장",
  "Run production preflight": "프로덕션 사전 점검 실행",
  "Generate production plan": "프로덕션 계획 생성",
  "Export plan JSON": "계획 JSON 내보내기",
  "03 / Doctor": "03 / 환경 점검",
  "Prove the local toolchain before planning a deployment": "배포 계획 전에 로컬 도구가 준비됐는지 확인합니다",
  "Run doctor": "환경 점검 실행",
  "Create a project, then run the required environment checks.": "프로젝트를 생성한 뒤 필수 환경 점검을 실행하세요.",
  "04 / Deployment plan": "04 / 배포 계획",
  "Review the exact read-only Foundry command": "실행될 읽기 전용 Foundry 명령을 검토합니다",
  "Generate dry-run": "Dry-run 생성",
  "The plan combines CLI output with the saved configuration.": "저장된 설정과 CLI 출력을 조합해 계획을 표시합니다.",
  "05 / Demo deployment": "05 / 데모 배포",
  "Broadcast only when the operator policy allows the target": "운영 정책이 허용한 대상에만 트랜잭션을 전송합니다",
  "Deploy reference stack": "레퍼런스 스택 배포",
  "Doctor ready": "환경 점검 완료",
  "Dry-run reviewed": "Dry-run 검토 완료",
  "Operator-allowed demo RPC": "운영자가 허용한 데모 RPC",
  "No browser secrets": "브라우저 비밀정보 없음",
  "06 / Artifact & verify": "06 / Artifact 및 검증",
  "Turn deployment output into operational evidence": "배포 결과를 운영 가능한 검증 근거로 만듭니다",
  "Verify artifact": "Artifact 검증",
  "Verification has not run.": "아직 검증하지 않았습니다.",
  "The deployment artifact will appear here as the address source of truth.": "배포가 끝나면 주소의 단일 기준인 artifact가 여기에 표시됩니다.",
  "07 / Activation": "07 / 활성화",
  "Run the DEX demo on this exact deployment": "이 배포본을 그대로 사용해 DEX 데모를 실행합니다",
  "Start DEX demo": "DEX 데모 시작",
  "Open DEX": "DEX 열기",
  "Stop DEX": "DEX 종료",
  "Artifact-bound runtime": "Artifact에 연결된 실행 환경",
  "Manual evidence checklist": "수동 검토 체크리스트",
  "Maker approval reviewed": "Maker 승인 검토",
  "Signer authorization reviewed": "Signer 권한 검토",
  "Inventory and allowances reviewed": "재고와 allowance 검토",
  "Router smoke settlement observed": "Router 시험 체결 확인",
  "Governance handoff reviewed": "Governance 권한 인계 검토",
  "DEX handoff locked": "DEX 연결 잠김",
  "Verify the artifact before starting services with this deployment.": "이 배포본으로 서비스를 시작하기 전에 artifact를 검증하세요.",
  "Context guide": "도움말",
  "How this option is used": "이 옵션의 사용 방법"
};
const originalTextNodes = [];
let currentLanguage = "en";
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
  configReady: false,
  doctorReady: false,
  planReady: false,
  deploymentReady: false,
  verified: false,
  productionPreflightReady: false,
  productionPlan: null,
  plan: null,
  artifact: null,
  operationsUrl: "",
  runtime: null,
  dexRuntime: null
};

if (typeof document !== "undefined") {
  document.addEventListener("DOMContentLoaded", boot);
}

async function boot() {
  initializeLanguage();
  bindControls();
  setDeploymentTarget(document.querySelector('input[name="deploymentTarget"]:checked').value);
  try {
    const health = await api("/api/v1/health");
    $("apiLed").classList.add("is-pass");
    $("apiStatus").textContent = tr("Local API ready", "로컬 API 준비 완료");
    $("workspacePath").textContent = health.workspaceRoot;
    state.runtime = health.runtime;
    setNetworkTarget(health.runtime.broadcastNetwork);
    $("rpcUrl").value = health.runtime.defaultRpcUrl;
    $("broadcastPolicy").textContent = `${health.runtime.broadcastNetwork} · ${health.runtime.allowedRpcHosts.join(", ")}`;
    await loadProjects();
  } catch (error) {
    $("apiStatus").textContent = tr("Local API unavailable", "로컬 API에 연결할 수 없음");
    message("projectMessage", error.message, true);
  }
}

function initializeLanguage() {
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  while (walker.nextNode()) {
    const node = walker.currentNode;
    const value = node.nodeValue ?? "";
    if (value.trim() && !node.parentElement?.closest("script, style")) {
      originalTextNodes.push({node, value});
    }
  }
  currentLanguage = localStorage.getItem("corner-store-studio-language") === "en" ? "en" : "ko";
  $("languageToggle").onclick = () => {
    currentLanguage = currentLanguage === "ko" ? "en" : "ko";
    localStorage.setItem("corner-store-studio-language", currentLanguage);
    applyLanguage();
  };
  applyLanguage();
}

function applyLanguage() {
  document.documentElement.lang = currentLanguage;
  for (const {node, value} of originalTextNodes) {
    const trimmed = value.trim();
    const translated = currentLanguage === "ko" ? KO_TEXT[trimmed] : undefined;
    node.nodeValue = translated
      ? value.replace(trimmed, translated)
      : value;
  }
  $("languageToggle").textContent = currentLanguage === "ko" ? "English" : "한국어";
  $("languageToggle").setAttribute(
    "aria-label",
    currentLanguage === "ko" ? "영어로 전환" : "Switch to Korean"
  );
}

function tr(english, korean) {
  return currentLanguage === "ko" ? korean : english;
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
  state.configReady = false;
  state.doctorReady = false;
  state.planReady = false;
  state.deploymentReady = false;
  state.verified = false;
  state.plan = null;
  $("doctorChecks").className = "check-list empty-state";
  $("doctorChecks").textContent = tr(
    "Configuration changed. Save it, then run doctor again.",
    "설정이 변경되었습니다. 저장한 뒤 환경 점검을 다시 실행하세요."
  );
  $("planReview").className = "plan-review empty-state";
  $("planReview").textContent = tr(
    "Configuration or RPC changed. Generate a new dry-run before deployment.",
    "설정 또는 RPC가 변경되었습니다. 배포 전에 dry-run을 다시 생성하세요."
  );
  refreshDeployGate();
}

async function loadProjects() {
  const result = await api("/api/v1/projects");
  const selector = $("projectSelector");
  selector.innerHTML = `<option value="">${tr("No project", "프로젝트 없음")}</option>`;
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
  state.configReady = false;
  state.doctorReady = false;
  state.planReady = false;
  state.deploymentReady = false;
  state.verified = false;
  localStorage.setItem("corner-store-studio-project", name);
  hydrate(snapshot);
  setProjectControls(true);
  $("projectState").textContent = tr("Configured", "설정됨");
  message("projectMessage", tr(`Loaded ${name}.`, `${name} 프로젝트를 불러왔습니다.`), false);
  await refreshArtifact();
  await refreshHandoff();
  refreshDeployGate();
  updateWorkflowState();
}

async function createProject() {
  const mode = document.querySelector('input[name="mode"]:checked').value;
  setBusy($("createProject"), true, tr("Creating…", "생성 중…"));
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
    setBusy($("createProject"), false, tr("Create integration project", "통합 프로젝트 생성"));
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
    state.configReady = true;
    state.deploymentReady = false;
    state.verified = false;
    state.snapshot = await api(`/api/v1/projects/${encodeURIComponent(state.project)}`);
    message("configMessage", tr(
      "Saved the three versioned project files.",
      "세 개의 버전 관리 프로젝트 파일을 저장했습니다."
    ), false);
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
      <em>${check.required === false ? tr("optional", "선택") : tr("required", "필수")}</em>
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
    ? tr(
      `${network} matches the operator-injected direct demo deployment policy.`,
      `${network} 네트워크는 운영자가 허용한 직접 데모 배포 정책과 일치합니다.`
    )
    : tr(
      `${network || "Custom target"} is available for configuration and dry-run review; direct Studio broadcast remains disabled.`,
      `${network || "사용자 지정 대상"}은 설정과 dry-run 검토만 가능하며 Studio 직접 배포는 비활성화됩니다.`
    );
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
  setBusy($("runDoctor"), true, tr("Checking…", "확인 중…"));
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
    setBusy($("runDoctor"), false, tr("Run doctor", "환경 점검 실행"));
  }
}

function renderChecks(checks) {
  $("doctorChecks").className = "check-list";
  $("doctorChecks").innerHTML = checks.map((check) => `
    <div class="check-row">
      <span class="status-led ${check.pass ? "is-pass" : ""}"></span>
      <b>${escapeHtml(check.name)}</b>
      <span>${escapeHtml(check.detail)}</span>
      <em>${check.required ? tr("required", "필수") : tr("optional", "선택")}</em>
    </div>`).join("");
}

async function reviewPlan() {
  setBusy($("reviewPlan"), true, tr("Planning…", "계획 생성 중…"));
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
    setBusy($("reviewPlan"), false, tr("Generate dry-run", "Dry-run 생성"));
  }
}

function renderPlan(plan) {
  $("planReview").className = "plan-review";
  $("planReview").innerHTML = `
    <div class="plan-grid">
      <div><span>${tr("Profile", "프로필")}</span><strong>${escapeHtml(plan.profile)}</strong></div>
      <div><span>${tr("Network", "네트워크")}</span><strong>${escapeHtml(plan.config.deployment.network)}</strong></div>
      <div><span>RPC</span><strong>${escapeHtml(plan.rpcUrl)}</strong></div>
      <div><span>Artifact</span><strong>${escapeHtml(plan.artifactPath)}</strong></div>
      <div><span>RFQ</span><strong>${plan.config.venues.rfq ? tr("enabled", "활성화") : tr("disabled", "비활성화")}</strong></div>
      <div><span>AMM</span><strong>${plan.config.venues.amm ? tr("enabled", "활성화") : tr("disabled", "비활성화")}</strong></div>
      <div><span>${tr("Contracts", "컨트랙트")}</span><strong>${escapeHtml(plan.contractSource ?? "bundled")}</strong></div>
      <div><span>${tr("Mutation", "상태 변경")}</span><strong>${tr("dry-run only", "dry-run 전용")}</strong></div>
    </div>
    <div class="command-block">${escapeHtml(plan.command ?? "No command returned")}</div>`;
}

function refreshDeployGate() {
  const allowed = state.runtime &&
    isDirectDemoTarget(selectedNetwork()) &&
    isAllowedRpc($("rpcUrl").value, state.runtime.allowedRpcHosts);
  $("runDoctor").disabled = !(state.project && state.configReady);
  $("reviewPlan").disabled = !(state.project && state.doctorReady);
  $("gateDoctor").classList.toggle("is-pass", state.doctorReady);
  $("gatePlan").classList.toggle("is-pass", state.planReady);
  $("gateNetwork").classList.toggle("is-pass", allowed);
  $("gateNetworkLabel").textContent = allowed
    ? tr("Operator broadcast policy matched", "운영자 배포 정책 일치")
    : tr(
      "Requires the Anvil demo profile and an operator-allowlisted RPC host",
      "Anvil 데모 프로필과 운영자가 허용한 RPC 호스트가 필요합니다"
    );
  $("deployDemo").disabled = !(state.project && state.doctorReady && state.planReady && allowed);
  updateWorkflowState();
}

function updateWorkflowState() {
  const completed = workflowCompletion({
    project: Boolean(state.project),
    configReady: state.configReady,
    doctorReady: state.doctorReady,
    planReady: state.planReady,
    deploymentReady: state.deploymentReady,
    verified: state.verified,
    activationReady: state.dexRuntime?.state === "running"
  });
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

function workflowCompletion(value) {
  const order = ["project", "config", "doctor", "plan", "deploy", "artifact", "activation"];
  const evidence = {
    project: Boolean(value.project),
    config: value.configReady === true,
    doctor: value.doctorReady === true,
    plan: value.planReady === true,
    deploy: value.deploymentReady === true,
    artifact: value.verified === true,
    activation: value.activationReady === true
  };
  const completed = {};
  let prerequisitesComplete = true;
  for (const stage of order) {
    completed[stage] = prerequisitesComplete && evidence[stage];
    prerequisitesComplete = completed[stage];
  }
  return completed;
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
  state.deploymentReady = false;
  state.verified = false;
  updateWorkflowState();
  setBusy($("deployDemo"), true, tr("Deploying…", "배포 중…"));
  $("deployLog").textContent = tr(
    "$ Starting guarded local reference deployment…\n",
    "$ 보호된 로컬 레퍼런스 배포를 시작합니다…\n"
  );
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
      setBusy($("deployDemo"), false, tr("Deploy reference stack", "레퍼런스 스택 배포"));
      if (job.status === "succeeded") {
        state.deploymentReady = true;
        state.verified = false;
        $("deployLog").textContent += tr(
          "Artifact ready for verification.\n",
          "Artifact 검증 준비가 완료되었습니다.\n"
        );
        await refreshArtifact();
        await runDoctor();
        $("verifyArtifact").disabled = false;
      } else {
        $("deployLog").textContent += `FAILED: ${job.error}\n`;
      }
    });
    stream.onerror = () => {
      stream.close();
      setBusy($("deployDemo"), false, tr("Deploy reference stack", "레퍼런스 스택 배포"));
    };
  } catch (error) {
    $("deployLog").textContent += `BLOCKED: ${error.message}\n`;
    setBusy($("deployDemo"), false, tr("Deploy reference stack", "레퍼런스 스택 배포"));
  }
}

async function refreshArtifact() {
  if (!state.project) return;
  try {
    state.artifact = await api(`/api/v1/projects/${encodeURIComponent(state.project)}/artifact`);
    renderArtifact(state.artifact);
    $("verifyArtifact").disabled = !state.deploymentReady;
    updateWorkflowState();
  } catch {
    state.artifact = null;
    $("artifactViewer").className = "artifact-grid empty-state";
    $("artifactViewer").textContent = tr(
      "The deployment artifact will appear here as the address source of truth.",
      "배포가 끝나면 주소의 단일 기준인 artifact가 여기에 표시됩니다."
    );
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
  setBusy($("verifyArtifact"), true, tr("Verifying…", "검증 중…"));
  try {
    const result = await api(`/api/v1/projects/${encodeURIComponent(state.project)}/verify`, {method: "POST"});
    state.verified = result.ready === true;
    $("verifySummary").className = `verify-summary ${state.verified ? "is-pass" : ""}`;
    $("verifySummary").textContent = state.verified
      ? tr(
        `Basic artifact verification passed · ${(result.checks ?? []).length} bindings checked`,
        `기본 artifact 검증 통과 · ${(result.checks ?? []).length}개 연결 확인`
      )
      : tr("Artifact verification failed.", "Artifact 검증에 실패했습니다.");
    await refreshHandoff();
    updateWorkflowState();
  } catch (error) {
    state.verified = false;
    $("verifySummary").className = "verify-summary";
    $("verifySummary").textContent = error.message;
    updateWorkflowState();
  } finally {
    setBusy($("verifyArtifact"), false, tr("Verify artifact", "Artifact 검증"));
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
  $("startDexDemo").disabled = !handoff.enabled || !state.verified || running;
  $("openOperations").disabled = !running;
  $("stopDexDemo").disabled = !running;
  $("handoffMessage").className = `handoff-card ${running ? "is-ready" : ""}`;
  $("handoffMessage").innerHTML = running
    ? `<strong>${tr("DEX running on verified deployment", "검증된 배포본으로 DEX 실행 중")}</strong><span>${escapeHtml(handoff.url)} · ${escapeHtml(state.artifact?.router ?? "Router from artifact")}</span>`
    : handoff.enabled
      ? `<strong>${tr("Verified deployment ready", "검증된 배포본 준비 완료")}</strong><span>${tr(
        "Start the DEX demo to launch all services with this exact artifact and RPC. No redeployment occurs.",
        "이 artifact와 RPC로 모든 서비스를 실행하려면 DEX 데모를 시작하세요. 컨트랙트를 다시 배포하지 않습니다."
      )}</span>`
      : `<strong>${tr("DEX handoff locked", "DEX 연결 잠김")}</strong><span>${escapeHtml(handoff.reason)}</span>`;
  updateWorkflowState();
}

async function startDexDemo() {
  setBusy($("startDexDemo"), true, tr("Starting DEX…", "DEX 시작 중…"));
  let started = false;
  try {
    state.dexRuntime = await api(`/api/v1/projects/${encodeURIComponent(state.project)}/runtime/start`, {
      method: "POST",
      body: {rpcUrl: $("rpcUrl").value.trim()}
    });
    started = true;
  } catch (error) {
    $("handoffMessage").className = "handoff-card";
    $("handoffMessage").innerHTML = `<strong>${tr("DEX start failed", "DEX 시작 실패")}</strong><span>${escapeHtml(error.message)}</span>`;
  } finally {
    setBusy($("startDexDemo"), false, tr("Start DEX demo", "DEX 데모 시작"));
    if (started) await refreshHandoff();
  }
}

async function stopDexDemo() {
  setBusy($("stopDexDemo"), true, tr("Stopping…", "종료 중…"));
  let stopped = false;
  try {
    state.dexRuntime = await api(`/api/v1/projects/${encodeURIComponent(state.project)}/runtime/stop`, {
      method: "POST",
      body: {}
    });
    stopped = true;
  } catch (error) {
    $("handoffMessage").className = "handoff-card";
    $("handoffMessage").innerHTML = `<strong>${tr("DEX stop failed", "DEX 종료 실패")}</strong><span>${escapeHtml(error.message)}</span>`;
  } finally {
    setBusy($("stopDexDemo"), false, tr("Stop DEX", "DEX 종료"));
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

if (typeof module !== "undefined" && module.exports) {
  module.exports = {workflowCompletion};
}
