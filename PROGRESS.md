# Progress

## Current Status

저장소는 SDK/reference DEX 아키텍처·개발 계획 문서, Foundry product scaffold,
reference execution contracts와 vendored Uniswap v3 배포 도구를 포함한다.

공식 문서는 DEX-level compliance SDK, Corner Store reference DEX,
Element/Recipe/Manifest/Operator 4-Layer와 mode-aware `RecipeBinding[]` 모델을
source of truth로 사용한다.

## Active Feature

없음. 다음 feature를 시작할 때 `FEATURES.md`에서 하나만 `active`로 전환한다.

## Completed

- `PORTAL-004 — Stateful Portfolio and Asset Operations`: route별 hardcode 대신
  idempotent pending-order/transaction journal과 holdings를 browser state에 추가해
  체결 완료 즉시 홈, 내 자산, 거래 내역과 발행사 현황이 같은 수량·평가액·정산
  결과를 읽도록 연결했다. 반복 매수 누적, legacy `postTrade` migration과
  localStorage reload를 지원한다. 발행사 ABCF pause/resume confirmation, PII-free
  운영 이력과 same-origin tab 동기화를 추가하고 pause 중 pending 주문 제거 및
  투자자 quote/fill fail-closed를 구현했다. model regression과 portal smoke,
  JS syntax/whitespace, 1440x900 headless Chrome 18개 cross-flow assertion 및 네 화면
  visual review가 통과했다. PR CI의 repository-wide `scripts/check.sh`도 Foundry
  870/870, 모든 service smoke와 deploy-v3 10/10으로 통과했다. contract/RPC/testnet
  변경이 없어 Anvil/GIWA E2E는 재실행하지 않았다.

- `PORTAL-003 — Figma Visual Parity and Stable Demo Identity`: 사용자가 제공한
  `figma/*.zip` 원본은 수정·stage하지 않고 `/tmp`에서만 안전하게 추출해 투자자
  19개 및 발행사 18개 PNG를 확인했다. 투자자 `Robin / 0xB0B7...91C4`와 발행사
  `ABC 자산운용 / Peter`를 항상 연결된 demo identity로 표시하고, 거래 목록,
  자격 신청, 주문/완료, 자산 등록, 규칙, 자료 준비와 심사 화면의 list/card,
  progress, CTA hierarchy를 1440x900 Figma 구조에 맞췄다. wallet/KYC/RFQ/
  settlement/asset-onboarding facade는 account/evidence detail에 유지했다. targeted
  portal smoke, 대표 12개 Chrome 1440x900 visual comparison, `git diff --check`가
  통과했다. Node 16 실행은 SDK doctor가 요구대로 fail-closed했고, 설치된 Node 24로
  재실행한 전체 `scripts/check.sh`는 Foundry 870/870, 모든 service smoke 및
  deploy-v3 10/10으로 통과했다. 두 기존 Solidity formatting drift 파일은
  restoration trap 후 원본 SHA-256으로 복원했다. contract/RPC/testnet 변경이 없어
  Anvil/GIWA E2E는 재실행하지 않았다. 후속 확인에서 900px 미만 viewport에서는
  sidebar의 고정 `min-height` 때문에 계정 chip이 화면 아래로 밀리는 문제를 찾아
  sidebar를 `100vh`에 고정하고 1440x720에서도 Robin 및 ABC 자산운용 identity가
  하단에 남는 것을 검증했다. 자격 신청 직접 진입 시 고액 투자자 인증기관 선택이
  먼저 노출될 수 있던 route 기반 modal도 명시적 overlay state로 분리했다.
  `#/investor/qualification` 및 호환용 `#/investor/provider` 직접 진입은 모두 modal
  없이 자격 신청 화면을 표시하며, `인증 받기` 클릭만 provider modal을 연다.
  targeted smoke, JS syntax, whitespace와 두 경로의 1440x720 render를 재검증했다.

- `PORTAL-002 — Production-like Demo Integration Facades`: 외부 권한을 획득하지
  않는 기존 browser-only 경계를 유지하면서 wallet 연결/해제/재연결, KYC/TA
  provider와 PII-free evidence, multi-dealer RFQ·EIP-712/taker/inventory 검증,
  Router settlement·finality receipt와 발행사 일곱 evidence connector를 제품 수준의
  sandbox interaction으로 보강했다. 완료 화면의 가로 action row에 중앙 화면용
  sibling margin이 침범하던 CSS specificity 결함을 수정하고, Figma/interaction
  spec의 두 핵심 CTA와 별도 체결 증거 action으로 계층을 정리했다. Chrome CDP
  22개 interaction assertion, 대표 1440x900 visual review, targeted smoke와
  `git diff --check`가 통과했다. restoration trap을 사용한 전체 `scripts/check.sh`도
  Foundry 870/870, 모든 service smoke와 deploy-v3 10/10으로 통과했고 두 기존
  Solidity formatting drift 원본은 복원했다. contract/RPC/testnet path가 없어
  Anvil/GIWA E2E는 재실행하지 않았다.

- `PORTAL-001 — Figma Investor and Issuer Product Demo`: `origin/main`에서 분리한
  `feature/figma-investor-issuer-portals`에 독립 browser-only product portal을
  구현했다. 투자자 홈/거래/자격/인증/RFQ 견적·체결/자산·인증과 발행사 기본
  정보/발행 조건/증빙/심사/거래 시작/지표를 연결했고, Figma catalog의 ABCF는
  처음부터 표시하며 발행사 activation 이후 같은 origin에 알림을 반영한다. 실제 wallet, PII, provider,
  법률 판단, signer와 settlement에는 연결하지 않는다. targeted smoke와 JS syntax,
  `git diff --check`, Figma 대비 1440x900 Chrome render, Chrome CDP full interaction
  walkthrough가 통과했다. 두 기존 Solidity formatting drift를 restoration trap 안에서
  임시 포맷한 full `scripts/check.sh`도 Foundry 870/870, 전체 services와 deploy-v3
  10/10으로 통과했으며 원본 파일은 복원했다. direct current-tree check는 동일한 기존
  formatting drift에서 중단된다. Anvil/GIWA path는 변경하지 않아 별도 E2E는 실행하지
  않았다.

- `SDK-003 — Publishable Package Release Contract`: CLI, Toolkit과 RFQ SDK를
  독립 npm tarball로 build/pack하고 Node 20 clean temporary projects에 설치하는
  release gate를 완성했다. Toolkit packed export/config simulation, generated
  RFQ module conformance, packaged CLI doctor/deploy dry-run과 contract bundle
  Foundry build를 repository-relative package resolution 없이 검증한다. SemVer,
  npm version과 persisted schema/capability version의 분리, release/rollback 및
  immutable on-chain version migration 절차를 `docs/sdk-versioning.md`에 기록했다.
  검증: Toolkit/RFQ/CLI package tests pass; Node 20
  `scripts/sdk-product-smoke.sh` pass; Node 16 doctor fail-closed 확인;
  `git diff --check` pass. `scripts/check.sh`는 실행했으나 G006과 무관한 기존
  formatting drift(`script/DeployProductionCore.s.sol`,
  `script/DemoScenarios.s.sol`)에서 중단됐다.

- `CORE-005 — Compliance Core Production Hardening`: Compliance Core registry
  semantics were hardened for production onboarding. Element registration is now
  immutable per `elementId`, pins metadata/version hashes and records default
  enforcement action. Recipe registration accepts canonical normalized aliases,
  stores version-independent `recipeKey` commitments, preserves immutable legacy
  numeric aliases and rejects collisions/overwrites. `TokenPolicyRegistry`
  compiles bounded per-binding Element enforcement rules at registration/update
  time and rejects normal onboarding overrides that weaken an Element's default
  action; `FORCE_FLAG_ONLY` remains limited to Elements that default to
  `FLAG_ONLY`. Engine rejection now preserves exact nonzero Element reason codes
  and only falls back to recipe-scoped code `1` for zero reasons. Toolkit/CLI
  production onboarding v2 now validates alias/key derivation, default actions,
  bounded overrides and compiled plan commitments, emits additive v2 calldata,
  and verifies alias/key, default action and compiled-plan state fail-closed while
  legacy v1 configs/calldata remain accepted. 검증: targeted registry tests 86
  pass, Engine tests 37 pass, RegD integration tests 6 pass, full
  `forge test --offline` 870/870 pass, `npm test --prefix services/toolkit`
  pass, `npm test --prefix services/cli` pass, isolated `/tmp` full
  `scripts/check.sh` pass(after formatting only the pre-existing
  `script/DeployProductionCore.s.sol` and `script/DemoScenarios.s.sol` drift in
  the copy and running fresh `npm ci` for copied stale `node_modules`; this full
  check was before the final Solidity-only bijection guard and post-fix full
  `forge test --offline` 870/870 passed), full Anvil E2E `buidl-like` and
  `reg-d` pass with 7/7 scenarios and RFQ flows, and
  `git diff --check` pass. Original-tree `scripts/check.sh` remains blocked by
  pre-existing formatting drift in `script/DeployProductionCore.s.sol` and
  `script/DemoScenarios.s.sol`; `DemoScenarios` contains only the scoped G005
  reason-contract edit and was not broad-formatted in the original tree.

- `DEPLOY-003 — Production ERC-3643 Asset Onboarding`: production core deployment과
  local Anvil demo onboarding을 분리한 production-only asset onboarding Toolkit/CLI
  surface를 추가했다. `corner-store.production-onboarding.json`은 exact schema로
  ERC-3643 token→IdentityRegistry→Compliance wiring, Identity Registry dependency,
  Corner Store registry/adapter/operator addresses, legalPackageHash, Element/Recipe/
  Manifest/RecipeBinding, governance Safe metadata, explicit operator executor,
  active venue, RFQ maker/signer delegate and read-only inventory requirements를 받는다. Validator는 unknown fields,
  duplicate ids/addresses, unsupported codeHashes key, PII/secret shaped input,
  omitted/empty venue or inventory, active RFQ venue without approved maker/signer
  delegate/approved-maker inventory, RFQ config without RFQ venue를 fail-closed한다.
  `production-onboarding-plan`은 deterministic calldata와 Safe-owner/operator-authority
  drafts를 분리한다. Safe drafts에는 Safe/required approval/proposal identity가,
  operator drafts에는 explicit executor/proposal identity가 포함되며 immutable output으로
  쓰고 governance-owner/governance-delayed/operator authority를 분리하고 transfer/approval/
  broadcast를 생성하지 않는다.
  `production-onboarding-verify`는 injected reader/JsonRpcProvider로 ERC-3643 wiring,
  code hash, registry state, exact Manifest hash/fields/bindings, ACTIVE
  declaredBy/approvedBy, governance Safe ownership of safe-owner targets, global/asset/venue pause gates, TokenPolicyRegistry/RFQAdapter operator executor
  authorization, maker approval, active signer and inventory balance/allowance를
  read-only 검증한다. Pending signer는
  detail로 보고하지만 ready가 아니다. 검증: `npm test --prefix services/toolkit`,
  `npm test --prefix services/cli`, production onboarding example validation,
  `git diff --check` 통과. `scripts/check.sh`는 실행했으나 known pre-existing
  Solidity formatting blocker(`script/DeployProductionCore.s.sol`,
  `script/DemoScenarios.s.sol`)에서 실패했다. Anvil E2E는 기존 untracked
  `deployments/` 보호를 위해 이 slice에서 실행하지 않았다.

- `DATA-002 — Provider-Neutral TA/KYC Evidence`: `services/compliance-data`에
  provider-neutral TA/KYC evidence coordinator와 replaceable store port를 추가했다.
  요청/결과는 subject, optional ONCHAINID identity, asset, request/evidence hashes와
  bounded provider/status/fact fields만 사용하며 raw name/email/document/SSN/provider
  subject/webhook payload는 core I/O·snapshot·audit에 저장하지 않는다. coordinator는
  provider result의 exact binding, freshness/future skew, explicit revoke/ineligible,
  sanctions/KYC facts와 provider timeout을 fail-closed로 검증하고 canonical domain-separated evidenceHash를
  계산한다. eligible snapshot은 strict success audit이 성공한 뒤에만 store에 publish하고 store 반환값을 재검증한다. provider outage/timeout/malformed request·result/stale/future/mismatch/revoked/ineligible/
  conflict/audit failure는 eligible materialization을 반환하지 않으며 cached last-good
  snapshot으로 outage를 숨기지 않는다. `InMemoryKycEvidenceStore`는 single-process
  reference/conformance store로 idempotent replay, same-assessment conflict, newer/revoked
  monotonic semantics를 검증하며 production HA/WORM/claim-write adapter는 operator 교체
  지점으로 남겼다. 검증: `npm test --prefix services/compliance-data`,
  `git diff --check` 통과. E2E는 이 provider-boundary feature 범위가 아니어서 실행하지
  않았다.

- `RFQ-005 — Production RFQ Host Hardening`: `services/rfq-host`를 새
  production-separable HTTP host boundary로 추가했다. local Anvil demo backend는
  그대로 두고, host는 request-size/JSON/schema validation, authenticator port와
  exact taker binding, hashed-principal rate limit, pricing/risk freshness gate,
  durable coordinator issuance, strict PII-free audit, bounded metrics와
  incident hook을 순서대로 적용한다. stale/missing/future/unavailable
  pricing·risk dependency는 nonce reservation과 signer 호출 전에 fail-closed하며,
  external signer verification failure와 audit sink failure는 quote response를
  내지 않고 incident로 기록한다. `/health`는 secret/config를 노출하지 않고,
  public bind는 operator TLS/trusted-proxy acknowledgement 없이는 거부한다.
  검증: baseline 및 final `npm test --prefix services/rfq`,
  `npm test --prefix services/rfq-host`, `npm test --prefix services/rfq-demo-backend`,
  `git diff --check` 통과. E2E는 기존 untracked `deployments/` 보호를 위해
  이 feature 범위에서 실행하지 않았다. `scripts/check.sh`는 이 stacked 작업에서
  known unrelated Solidity formatting gate가 있어 실행하지 않았고, RFQ hardening과
  무관한 Solidity 파일은 수정하지 않았다.

- `RFQ-004 — Durable Quote Coordinator`: `services/rfq`에 production-separable
  `RFQQuoteCoordinator`와 `QuoteCoordinatorStore` 포트를 추가했다. coordinator는
  pricing/risk가 통과한 뒤에만 `(chainId, adapter, maker)` scope nonce와
  idempotency/request hash, maker outgoing inventory lease를 원자적으로 예약하고,
  external signer 결과를 로컬 EIP-712 검증 후 durable record에 저장한다. 같은
  idempotency key+request는 service restart/new coordinator instance 이후에도 같은
  signed quote를 반환하고, 다른 request hash는 conflict로 거부된다. signer failure,
  expiry, revoke, finalized fill/cancel은 lease를 정확히 한 번 해제하며 nonce gap은
  허용하되 재사용하지 않는다. fill/cancel observation은 block/hash를 기록하고
  configured finality 이후 terminal 처리하며, reorg는 observed 상태를 `PUBLISHED`로
  되돌리고 lease를 유지한다. durable record에는 raw idempotency key나 signer ref를
  저장하지 않는다. 함께 추가한 `LocalFileQuoteCoordinatorStore`는 Node built-ins 기반
  reference/single-host file adapter이며 production HA는 동일 포트를 operator
  transactional DB와 indexer/reconciliation worker로 구현해야 한다. 검증: baseline 및
  final `npm test --prefix services/rfq` 통과, `git diff --check` 통과.

- `STUDIO-002 — Localized Evidence-Gated Workflow`: Deployment Studio의 기본
  언어를 한국어로 제공하고 English 전환 선택을 유지한다. 설정 저장부터 Doctor,
  계획, 배포, Artifact 검증, DEX 실행까지 실제 evidence와 선행 단계가 모두
  충족된 경우에만 완료로 표시하도록 workflow 상태를 fail-closed했다.
  Deployment Studio smoke test와 `git diff --check`를 통과했다.
- `DOC-004 — Product Architecture and Technical Whitepaper`: current
  source-of-truth와 구현을 기준으로 외부 공유용 기술 백서를 작성했다. 문제 정의,
  제품 경계, Element/Recipe/Manifest/Operator, Router fill-time enforcement,
  RFQ backend module, trust boundary, control/execution plane, 핵심 ABI와
  protocol invariant, 통합자별 adoption path, architectural trade-off, current
  implementation과 production gap을 11개의 Mermaid diagram과 함께 설명한다.
  GitBook/GitHub에서 직접 읽을 수 있도록 루트 README와 문서 인덱스에 연결하고,
  공식 1차 자료와 claim-to-evidence matrix를 추가했다. 내부 링크, Mermaid
  fence/diagram 구성, Engine 34/34, RFQ integration 8/8, RFQ SDK smoke와
  `git diff --check`를 검증했다.
- `DEMO-016 — Artifact-bound Public Testnet RFQ Demo`: 기존 local Anvil
  facilitator를 변경하지 않고 committed public deployment artifact를 읽는 별도
  browser demo를 추가했다. runtime은 RPC chain/bytecode와 artifact Maker를
  검증하고 RFQ SDK로 Maker quote만 서명한다. investor는 브라우저 지갑으로
  allowance와 Router settlement를 직접 제출하며 deployment lineage, contract
  주소, token/Manifest/Maker 상태, balance/QP pre-check, quote와 receipt를
  확인할 수 있다. isolated Anvil에서 149-transaction artifact를 배포·승격하고
  Maker/investor approvals 후 API state/pre-check/quote, external investor
  Router static call과 block 154 settlement를 통과했다. 전체
  `scripts/check.sh`(Forge 669/669, 모든 service smoke, deploy-v3 10/10)도
  통과했다.
- `DEPLOY-002 — Public Testnet RFQ Reference Deployment`: 기존 Anvil 데모를
  변경하지 않고 외부 RPC·chain ID·actor 주소와 Foundry keystore/Ledger signer를
  사용하는 RFQ-only public-testnet deployment를 추가했다. 실제 T-REX
  ERC-3643/ONCHAINID fixture, illustrative BUIDL-like Manifest, Engine/Router/RFQ,
  mock quote token, claim과 inventory를 배포하며 participant allowance는 각
  wallet이 별도 승인한다. read-only verifier는 chain/artifact, code, ownership,
  operator, Manifest/venue/maker/inventory/allowance를 fail-closed로 확인한다.
  검증된 배포만 append-only public artifact로 승격하며 모든 named 주소와
  deployment transaction/CREATE index를 보존해 후속 runtime에서 재사용한다.
  전체 `scripts/check.sh`(Forge 669/669, 모든 service smoke, deploy-v3 10/10),
  별도 Anvil external-keystore broadcast, governance/operator handoff, artifact
  승격·조회와 maker/investor approval 이후 readiness 검증을 통과했다. 실제
  공개 테스트넷 broadcast와 explorer verification은 네트워크 입력·faucet·
  credential 주입 후 수행한다.
- `DEMO-015 — RFQ Session History and Targeted Claim Expiry`: My RFQs가 세션의
  firm quote를 누적하되 사용자에게는 현재 지갑이 taker인 기록만 표시하고,
  Admin만 세션 전체를 조회한다. mock market은 fill 횟수마다 같은 tick을 쓰지
  않고 실제 RWA 체결수량에 비례한 scenario impact/cap으로 다음 가격을
  계산한다. 차트는 전체 기간만 표시하고 체결점의 방향·가격·수량·시간은
  hover/focus에서 확인한다. Claim 만료는 Enforcement Cases로 통합했으며 준비
  직후 B는 10분간 계속 적격이고, 1시간 quote 발급 후 Anvil을 15분 전진해야
  B만 만료되고 A는 계속 허용된다. `Maker 관리`는 다중 Maker 기능이 아니라
  현재 단일 Maker의 승인 철회 보안 시연으로 명확히 했다. Admin claim 변경은
  실제 operator transaction의 block/hash를 API와 UI에 노출해 단순 브라우저
  상태 변경과 구분한다. Node 20 전체 `scripts/check.sh`(Forge 669/669 포함),
  BUIDL-like RFQ live E2E와
  `git diff --check`를 통과했다.
- `DEMO-014 — RFQ Counter-Amount Preview`: RFQ 생성 화면에서 매수·매도 방향별
  지불 자산, backend pre-check가 계산한 반대 페어 예상 수령량과 현재 단가를
  함께 표시한다. 입력이 바뀌면 이전 값을 지우고 최신 `amountOut` 응답으로만
  갱신하므로 고정 가격이나 임의 UI 계산을 사용하지 않는다. Operator Dashboard
  smoke와 `git diff --check`를 통과했다.
- `DEMO-013 — Deployment-to-DEX Showcase Handoff`: production script와 local
  reference stack이 온체인 helper를 별도로 배포하지 않는
  `ProductionCoreDeployer.deployCore()` 구현을 공유한다. versioned showcase
  config와 plan/run entry point가 profile, scenario, loopback host와 네 개의
  runtime port를 검증하고 core 배포 → demo-only ERC-3643/Mock TA/policy/venue/
  inventory activation → artifact → RFQ backend → Operator API/Dashboard 순서를
  재현한다. Studio의 Deploy/Verify 이후에도 같은 project artifact, scenario와
  배포 RPC를 세 서비스에 직접 넘기는 Start/Open/Stop DEX handoff를 추가했다.
  Studio 최초 Start는 기존 CLI `toolkit-onboard`를 재사용해 선택한 demo
  Manifest/venue를 동일 배포물에서 활성화하고 완료 상태를 기록하므로 재시작 때
  불필요한 retire/re-onboard를 반복하지 않는다.
  다른 RPC나 변경된 artifact를 거부하며 실제 integration에서 Studio artifact의
  Router와 backend가 사용하는 Router가 같음을 검증했다. artifact lineage는
  backend와 Dashboard에 표시되며 local fixture가 production evidence가 아님을
  명시한다. Node 20 + Foundry v1.7.1 전체
  check(Forge 669/669, deploy-v3 10/10), target service smoke, showcase plan,
  별도 포트 BUIDL-like RFQ E2E와 `git diff --check`를 통과했다.
- `DEPLOY-001 — Production Deployment Workflow`: fixture/token/policy activation이
  없는 core-only Foundry script, external Ledger/Foundry account signer CLI,
  Safe proxy/singleton/code hash + exact owner `M`/threshold `N` preflight,
  existing ERC-3643 technical wiring preflight와 Studio signer-free planning
  target을 구현했다. approved RPC host, reviewed commit, deterministic contract
  bundle hash, dry-run/fork evidence를 deploy 전에 재검증하고, 배포 후에는 exact
  runtime bytecode hash, Safe ownership/operator와 Router/Engine binding을
  fail-closed로 검증한다. 실제 ERC-3643 claim/trusted issuer/legal policy
  onboarding과 production transaction은 별도 issuer/Safe evidence가 필요하다.
  Node 20 + Foundry v1.7.1 전체 check(Forge 669/669, deploy-v3 10/10), targeted
  service/Foundry tests, `git diff --check`와 독립 code review를 통과했다.
- `STUDIO-001 — Local Deployment Studio`: 실제 Toolkit JSON과 CLI를 사용하는
  local/demo control surface를 추가했다. 운영자가 주입한 host/port, workspace,
  CLI entry, RPC, broadcast network/host allowlist와 Operations URL을 기준으로
  project create → doctor → dry-run → guarded reference deploy → artifact verify →
  handoff를 수행한다. 브라우저 secret 입력과 production broadcast는 제공하지
  않으며, config/integration/scenario 변경 시 verify evidence를 무효화한다.
  API/UI smoke, Node 20 + Foundry v1.7.1 전체 check(Forge 665/665), 실제 별도
  Anvil 포트 배포·verify, Chrome interaction smoke와 visual verdict 91/100을
  통과했다. 후속 UX pass에서 library/reference/existing-backend의 실제 이용
  경계, account/governance role label, production plan-only network와 module
  preset/custom adapter 의미를 contextual help로 노출하고 Activation이 수동
  evidence checklist임을 명확히 했다. Anvil-only server/UI gate와 production
  runtime 오설정 회귀 테스트를 추가했고, 최종 desktop/mobile visual verdict
  9/10을 통과했다.
- `SDK-002 — Standalone Integration and Deployment Workflow`: 단일 CLI로
  library-only, reference-service, existing-backend 프로젝트를 생성하고
  doctor, deploy, verify와 RFQ module conformance를 실행할 수 있게 했다.
  source checkout은 미배포 npm package에 의존하지 않도록 CLI와 RFQ SDK를
  자동 vendoring하며, package artifact는 필요한 contract source만 포함한다.
  실제 maker를 복구하는 EIP-712 conformance, clean external install/build,
  독립 Anvil broadcast/verify와 전체 repository check(Forge 665/665,
  deploy-v3 10/10)를 통과했다.
- `RFQ-003 — Maker Authorizer and Regulated Amount Cap`: maker settlement
  account와 quote signer를 immutable versioned authorizer로 분리했다. maker
  직접 ECDSA, delayed governed delegate, immediate revoke와 ERC-1271을 fill
  시점에 검증한다. compliance decision은 `maxAmountToken`을 함께 bind하고
  Router는 regulated token이 tokenIn인 매도와 tokenOut인 매수에 finite cap을
  적용하며 잘못된 cap axis는 fail-closed한다. 전체 repository check
  (Forge 665/665), service/deploy-v3 checks와 BUIDL-like RFQ E2E를 통과했다.
- `RFQ-POLICY-001 — Production RFQ Policy`: ADR-009로 protocol non-custodial,
  exact full-fill v1, maker/signer 분리, durable nonce/idempotency, time-bounded
  inventory reservation, pricing/risk 역할 분리와 Router fill-time compliance를
  accepted baseline으로 확정했다. owner/trust matrix, quote lifecycle/reorg,
  signer rotation, incident flow와 hostile test matrix를 component spec에 기록하고
  후속 구현을 #65(authorizer/cap), #66(durable coordinator), #67(service
  hardening)로 분리했다. local link check, `git diff --check`, independent
  architect review와 adversarial critic 재검토를 통과했다.
- `SDK-001 — Modular Integration and Deployment Toolkit`: RFQ pricing, risk,
  signer와 nonce를 versioned capability module로 교체할 수 있게 하고 reference와
  custom 구현이 같은 conformance suite를 사용하도록 했다. Toolkit/CLI는 reference
  RFQ service 또는 기존 backend 연결 프로젝트를 secret 없이 생성하며, 기본 생성물은
  RFQ SDK source를 vendoring해 저장소 밖과 선택형 Docker context에서도 재현 가능하다.
  RFQ·Toolkit·CLI·demo backend test, pinned Foundry 기준 repository check
  (Forge 643/643), BUIDL-like RFQ E2E, clean generated-project install/build와
  독립 code review를 통과했다. 선택형 Compose config, generated Docker image
  build와 container 내부 signed quote HTTP runtime도 검증했다.
- `DEMO-012 — Enforcement Case Workflow`: Admin에 단계형 Enforcement Cases
  워크스페이스를 추가했다. Adapter 직접 호출, quote 이후 claim 만료, quote 이후
  Maker 취소를 기준 상태→quote→정책 변경→실행→증거→복구로 분리하며, 실제 실패
  transaction receipt, reasonCode/selector, 실패 전후 잔액 불변과 trace를
  표시한다. backend/dashboard smoke, `git diff --check`, 기본 및 비 1:1 가격·
  변경된 지갑별 QP 상태를 주입한 별도 포트 BUIDL-like RFQ E2E에서 체결과 세 차단
  경로를 검증했다. E2E는 사용 중인 Anvil/backend 포트에 잘못 접속하지 않고
  시작 전에 fail-closed한다.
- `DEMO-011 — Multi-resolution History and Repeat Liquidity`: 시간별로 주입한
  NAV/indicative anchor를 1분 간격으로 보간해 기본 scenario에서 421개 sample을
  제공한다. 따라서 1분·5분·1시간·전체는 서로 다른 관측 수를 표시한다. 투자자
  초기 quote/RWA와 maker 양방향 inventory를 반복 시연용으로 확대했고, backend/
  dashboard smoke, `git diff --check`, 별도 포트 BUIDL-like E2E에서 동일
  투자자의 실제 Router 매수 4회·매도 4회 연속 체결을 검증했다.
- `DEMO-010 — RFQ Chart Range and Fill Evidence`: 사용자 차트에 1분·5분·
  1시간·전체 구간 전환을 추가하고, 실제 Router fill을 매수/매도와 체결 단가가
  표시된 marker로 렌더링한다. 선택 구간의 fill tape는 실제 RWA 수량, chain
  timestamp와 transaction hash를 제공하며 fixture line과 구분한다. Dashboard
  smoke, `git diff --check`, 별도 포트 BUIDL-like RFQ E2E에서 실제 양방향
  체결 history가 계속 생성되는 것을 검증했다.
- `DEMO-009 — Resilient Repeated-Trade UX`: 현재 runtime 가격, 최소 RWA
  수량과 scenario buffer로 다음 매수·매도의 권장 입력값을 backend에서
  재계산한다. 새 RFQ와 방향 전환은 이 값을 사용해 반복 체결 후에도 기본
  pre-check가 통과하고, 수동으로 더 작은 값을 넣으면 minimum-investment
  정책은 그대로 거부한다. 차트는 짧은 시간의 체결을 실행 순서로 분리하고
  실제 timestamp는 tooltip에 보존하며 최소 1% 가격축과 10 bps mock impact로
  작은 변화를 과장하지 않는다. backend/dashboard smoke, `git diff --check`,
  별도 포트 BUIDL-like RFQ E2E에서 첫 매수 후 권장값 증가와 다음 매수
  pre-check, 양방향 체결 및 전체 거부 시나리오를 검증했다.
- `DEMO-008 — RWA-aware RFQ Market Chart`: scenario가 Mock NAV/oracle,
  indicative-mid history와 spread를 주입하고 `/demo/market-history`가 이를 실제
  Router fill과 분리해 제공한다. 사용자 Dashboard는 두 선, spread band, 매수·
  매도 fill point, 실제 거래량을 표시한다. quote signer와 pre-check가 동일한
  runtime market을 사용하도록 pricing instance 분리 버그도 수정했다. backend/
  dashboard smoke, `git diff --check`, 별도 포트 BUIDL-like RFQ E2E에서
  초기 history, 매수·매도 체결점, 거래량과 다음 firm quote 가격 반영을 검증했다.
- `DEMO-007 — Law-first QP and Dynamic RFQ Market Demo`: Admin UI는 내부
  `A-13-v1`보다 ICA §3(c)(7), §2(a)(51) QP와 Rule 3c-5 KE 예외를 우선
  표시한다. scenario에 초기 가격과 fill당 impact bps를 주입하고 성공한 매수는
  다음 가격을 올리고 매도는 내리도록 backend pricing, pre-check, firm quote와
  Dashboard 참고가격을 하나의 runtime market state로 연결했다. backend/dashboard
  smoke, `git diff --check`, 별도 포트 BUIDL-like RFQ E2E에서 매수 후 상승과
  매도 후 하락을 확인했다.
- RFQ 데모의 기본 수량을 표시용 천 단위 문자열이 아닌 파싱 가능한 decimal
  input으로 분리해 적격 지갑의 pre-check 오차단을 제거했다. Admin은 더 이상
  적격 결과를 토글하지 않고 QP basis, signature, trusted issuer, look-through와
  fund binding claim 사실을 A-13에 기록하며, Element가 적격 여부와 상세 실패
  사유를 계산한다. backend/dashboard smoke와 별도 포트 BUIDL-like RFQ E2E가
  claim 변경·재판정, 정상 체결, 비적격/만료/maker 차단을 모두 통과했다.
- 첫 체결 후 modal Accept 버튼의 disabled 상태가 다음 quote와 다른 지갑에도
  남던 dashboard session bug를 제거했다. 새 RFQ 시작은 consumed quote와 UI
  상태를 초기화하고, 새 firm quote를 검토할 때 Accept를 다시 활성화한다.
- UI 전용 `12480 KRW` reference-price fixture를 제거했다. Dashboard 참고가격은
  RFQ quote와 동일한 injected fixed-rate mock의 numerator/denominator 및
  asset/quote decimals에서 `quote asset / RWA` 단가를 계산한다. 이 단가를
  매수 quote는 역산하고 매도 quote는 정방향 적용하므로 표시 가격과 양방향
  firm quote pricing source가 분리되거나 서로 역전되지 않는다.
- `HE-001 — Harness Baseline`
- `DOC-001 — Imported Architecture Alignment`
- `FND-001 — Foundry Product Foundation`
- `RFQ-001 — Reference RFQ Settlement`
- `DEMO-001 — BUIDL-like ERC-3643 Demo Asset`
- `RFQ-002 — RFQ v2 Hardening`
- `CMP-001 — Reg D 506(c) 9-element Recipe`(illustrative element library + recipe
  9-element 확장, version 2)
- `CMP-002 — Manifest Lifecycle & Operator Approval Flow`(validated state machine,
  setStatus 제거, engine positive-allowlist default-deny, clearUnregulated,
  factory register→approve)
- `DOC-002 — RFQ SDK and MVP Demo Planning`
- `RFQ-SDK-001 — RFQ Backend SDK Interfaces`
- `DEMO-002 — MVP RFQ Demo Backend`(selectable asset profile + local HTTP quote
  API + CLI/backend→Router live settlement)
- 사용자 중심 RFQ 데모 화면(Dashboard → RFQ 거래 → My RFQs → Portfolio,
  Security/Operator Advanced 유지)
- `TOOLKIT-001 — Versioned Config Foundation`
- `OPS-001 — High-severity Solidity Lint Gate`
- `OPS-002 — Repository-wide CI Parity`
- `DOC-003 — Goal Completion and Operations Alignment`
- `PROD-001 — Production Control Plane`(central global/asset/venue pause,
  delayed unpause와 Manifest resume/update, monotonic version/history,
  Factory governance forwarding)
- `DATA-001 — Compliance Data Layer Foundation`(provider-neutral TA lot resolver,
  expiring attested acquisition snapshot, fail-closed Lockup, idempotent
  person-group state와 hash-chain rejection/surveillance audit)
- `MANIFEST-002 — RecipeBinding Manifest Migration`(bounded registry-backed
  bindings, required/path/flag 평가, delayed lifecycle update와 CLI/demo ABI migration)
- `AMM-001 — Canonical Uniswap v3 Pool E2E`(pinned core artifact factory/pool,
  CREATE2 preflight, real mint/swap callback와 ERC-3643 protected buy/sell)
- RFQ-first MVP demo refinement(`scripts/e2e-anvil.sh --mode rfq` + Trader /
  Security / Operator dashboard + `docs/rfq-demo-guide.md`)
- multi-venue 아키텍처와 책임 문서 작성
- Corner Store용 Uniswap v3 최소 배포 profile 분리와 테스트
- ExecutionRouter/VenueRegistry/VenueSelector와 AMM reference adapter skeleton
- router now rejects requests whose `context.venueType` mismatches the registered
  `VenueConfig.venueType` (closes the PR-12 review medium finding)
- RFQ-002: operator-curated maker approval allowlist(`setMakerApproved`,
  `RFQMakerNotApproved`), maker-initiated nonce-scoped idempotent cancellation
  (`cancelQuoteNonce`/`cancelQuoteNonces`, `RFQQuoteCancelled`), venueType binding
  fix, `docs/rfq-threat-model.md` 위협 모델과 D008 결정 기록
- legacy mock element(Sanctions A-01, AccreditedInvestor A-03, QualifiedPurchaser
  A-13)의 attestation setter를 `Governed`/`onlyOperator` + 이벤트로 정렬해 CMP-001
  이후 hardening divergence를 닫았다(Lockup C-01은 settable mutator가 없어 변경 없음).
- RFQ integration: RFQ 벤처를 protected router path(`ExecutionRouter → ComplianceEngine
  → RFQAdapter`)로 real ERC-3643 스택 위에서 end-to-end 커버(`test/integration/RFQFlow.t.sol`,
  fill/maker-unapproved/cancel/non-compliant/direct-call bypass 5 시나리오) — RFQ-002 deferred follow-up 완료.
- `E2E-001 — Live Anvil E2E & Demo Runner`(`scripts/e2e-anvil.sh` +
  `script/DeployStack.s.sol` + `script/DemoScenarios.s.sol`): fresh Anvil에 전체 스택
  배포 후 7-scenario demo suite 구동, scenario별 PASS/FAIL. T-REX 배포 코어를
  `test/fixtures/TREXCore.sol`로 추출해 fixture/script 공유. src/ 변경 없음. runbook은
  `docs/demo.md`.
- `CLI-001 — corner-store Reference CLI`(`services/cli/` + `script/KycInvestor.s.sol`):
  live 노드 대상 인터랙티브 CLI(status/onboard/manifest/attest/investor-setup/kyc/
  buy/rfq-quote/rfq-cancel/maker/reason). ethers 기반, services/rfq EIP-712 서명
  라이브러리 재사용, reason-table 자동 디코딩. src/ 변경 없음(신규 Solidity는 KYC
  forge 스크립트 하나). smoke + fresh-account live walkthrough로 검증. README는
  `services/cli/README.md`.
- `CLI-002 — corner-store CLI v2`(`services/cli/**` + 문서만, 제품 코드/스크립트 변경
  없음): preflight `check`(per-element + engine verdict, asset-side 라벨, rejected면
  exit 1), AMM `sell`, `balances`, 이벤트 tail `watch`, `faucet`, anvil
  `snapshot`/`restore`, `quote-inspect`(서명자 복구/만료/nonce·승인, 실패 시 exit 1).
  reason 디코딩·EIP-712 복구는 기존 lib 재사용. smoke(quote-inspect valid+tampered) +
  full live walkthrough로 검증. `forge test --offline` 238/238 유지.
- `OPS-003 — Operator Deployment and Manifest Snapshot`(read-only Dashboard에
  execution/control-plane 주소와 onboarding Manifest status/version/RecipeBinding
  snapshot 표시, CLI nonce refresh와 전체 BUIDL-like RFQ walkthrough 검증).
- `DEMO-003 — Role-aware RFQ Compliance Walkthrough`(Admin/적격 A·B/비적격
  persona, 실제 QP·maker·asset pre-check, Admin 온체인 fixture 제어와
  비적격 signed quote의 fill-time Router 거부 증명).
- `DEMO-004 — Injectable Temporal RFQ Scenario`(scenario JSON 기반 자산 표시값,
  지갑/QP fixture와 시간 조건 주입, quote-time 적격 claim 만료 후 동일 signed
  quote의 fill-time Router 거부 증명).
- `DEMO-005 — Bidirectional RFQ Demo`(매수 qUSD→RWA와 매도 RWA→qUSD를 동일
  backend/Router/RFQAdapter 경로로 체결하고 두 자산의 실제 잔액 증감을 표시).
- `DEMO-006 — Deployment-bound Injectable RFQ Fixtures`(계정 binding, 초기
  inventory, 기본 매수·매도 수량, TTL과 mock price를 versioned scenario로
  주입하고 deployment artifact의 schema/hash로 backend 입력을 고정).

- `CMP-004 — Wave-3 Illustrative Element Library`(illustrative element 6개 +
  per-element unit test + `tools/deploy-wave3` opt-in deploy script): A-06
  Affiliate, A-12 Red Flag Knowledge Bar, E-03 Bad Actor Disqualification,
  F-01 Operator Self-Dealing, F-03 Fraud Surveillance, F-04 Reg M
  restricted-period buying gate. operator-gated setter, fail-closed default,
  monitoring element(A-12/F-03) non-blocking. active recipe/DeployStack 미변경.
  `forge test --offline` 770/770.

## Blocked

- 없음

## Next

1. DEPLOY-001 구현 검증을 완료하고 passing 전환 여부는 targeted Forge/service
   tests, 전체 `scripts/check.sh`, diff/review evidence로 판단한다. 실제 production
   network deployment success는 별도 deployment evidence가 생기기 전까지
   주장하지 않는다.
2. 실제 TA provider API/authorization, amount-specific lot allocation과 production
   WORM/indexer를 별도 refinement로 구현한다.
3. ADR-009 순서에 따라 durable nonce와 production pricing/risk·endpoint
   hardening을 독립 feature로 구현한다.
4. 실제 Uniswap v3 pool 배포를 demo/E2E에 연결한다(현재 AMM venue는 MockPool;
   `tools/deploy-v3` vendor isolation 유지).
5. Order Book은 matching/custody/surveillance 모델 결정 후 구현한다.
6. production 환경의 TLS, secret rotation, 실제 multisig provider와 live RPC
   finality/recovery 정책을 별도 운영 feature로 구체화한다.

## Last Session Summary

- RFQ maker settlement account와 signer authority를 분리했다. delegate 권한
  추가는 1일 delay, revoke는 즉시 적용하며 direct maker ECDSA와 ERC-1271도
  동일한 fill-time authorizer 경계에서 검증한다.
- finite compliance cap의 대상 regulated token을 decision hash에 포함하고,
  Router가 매수·매도의 실제 regulated quantity를 비교하도록 migration했다.
- deployment artifact, CLI quote inspection, Toolkit preflight와 RFQ demo backend를
  새 authorizer/cap ABI로 갱신했다. repository check에서 Forge 665/665와 모든
  service/deploy-v3 검사가 통과했다.
- production RFQ v1을 non-custodial exact full-fill로 고정하고 maker settlement
  account와 signer authority, Operator/dealer/TA/host/surveillance 책임을 분리했다.
- durable quote lifecycle은 nonce와 inventory lease를 원자적으로 예약하고
  observed/finalized fill·cancel 및 reorg recovery를 추적하도록 명세했다.
- 구현은 #65 maker authorizer/cap, #66 durable coordinator, #67 audit/service
  hardening으로 나눴다. partial fill은 새 quote/adapter version 전까지 비활성이다.
- RFQ pricing/risk/signer/nonce 교체 경계와 공통 conformance suite를 추가하고,
  demo backend를 같은 module contract의 reference consumer로 전환했다.
- CLI가 독립 실행 가능한 reference RFQ service 또는 기존 backend 연결 scaffold를
  생성한다. 기본 출력은 local absolute path 없이 SDK source를 포함하며 Docker
  Compose는 선택적으로만 생성된다.
- 전체 repository check, BUIDL-like RFQ E2E와 clean generated-project build를
  통과했다. Docker daemon에서 Compose config, generated image build와 container
  signed quote runtime까지 추가 검증했다.
- RFQ 데모의 실행 상태를 schema-v2 scenario로 통합했다. 배포 스크립트가 계정과
  초기 qUSD/RWA 물량을 실제 mint/approval에 사용하고, backend와 CLI는 같은
  scenario의 가격·수량·TTL·signer binding을 사용한다.
- deployment artifact에 scenario schema version과 content hash를 기록해 다른
  fixture로 backend를 시작하면 fail-closed하도록 했으며, 화면의 투자자와 maker
  잔액은 fixture 숫자가 아니라 배포 후 실제 `balanceOf`로 표시한다.
- 기본 BUIDL-like 전체 7/7 시나리오와 양방향 RFQ E2E가 통과했다. 별도로
  investor/maker 계정, 초기 물량과 2:1 가격을 바꾼 custom scenario에서도
  quote 발급부터 Router 체결까지 통과했고, `scripts/check.sh`는 Foundry
  643/643 및 모든 service/deploy-v3 검사를 통과했다.
- RFQ quote API와 대시보드에 `buy | sell` 방향을 추가했다. 매도 quote는
  `tokenIn=RWA`, `tokenOut=결제 자산`으로 서명되며 E2E에서 투자자 RWA 감소와
  결제 자산 증가를 검증했다.
- fresh 배포가 투자자 RWA와 maker 결제 자산 inventory 및 양방향 allowance를
  준비하므로 매수를 먼저 하지 않아도 매도 데모를 바로 실행할 수 있다.
- `ComplianceEngine.commit`이 regulated token 위치에 따라 실제 이동 방향을
  기록하도록 수정해, tokenIn 매도의 stateful accounting을 buyer→seller로 맞췄다.
- RFQ 데모의 사용자명, maker/preview 표시, 기준가격, 최소금액, 초기 QP 상태와
  freshness/시간 경과 조건을 validated scenario JSON으로 분리했다. 최상위
  `scripts/demo.sh --scenario <path>`와 E2E가 같은 입력을 사용하고 주소는 fresh
  deployment artifact와 funded Anvil signer mapping으로 검증한다.
- Admin temporal flow가 짧은 QP freshness를 실제 트랜잭션으로 주입하고 Anvil
  chain time을 전진시킨다. 견적은 아직 유효하지만 투자자 claim만 만료된 상태에서
  동일 EIP-712 quote가 Router의 최신 `ComplianceEngine` 검사로 거부됨을 E2E로
  증명했고, 이후 baseline fixture 복원도 확인했다.
- `scripts/check.sh` 전체 게이트(Foundry 641/641, 모든 TypeScript/dashboard smoke,
  deploy-v3 10/10)와 explicit scenario BUIDL-like RFQ E2E가 통과했다.
- RFQ 데모에 Admin, 적격투자자 A/B와 비적격투자자 persona를 추가했다. 선택된
  지갑별 실제 Anvil signer로 quote와 Router transaction을 실행하고, QP·maker·
  Manifest/minimum 정책을 생성·수락 전에 검사한다. 비적격 일반 거래는 UI에서
  차단되며 별도 proof는 signed quote도 최종 Router 검사에서
  `Qualified Purchaser claim missing`으로 거부됨을 증명한다.
- Admin 화면의 investor claim 편집과 maker 취소/복구는 cosmetic fixture가 아니라
  `QualifiedPurchaser.setQpClaim`과 `RFQAdapter.setMakerApproved` 트랜잭션이다.
  RFQ-only live E2E가 적격 B pre-check, 비적격 pre-check/최종 거부, Admin claim
  round-trip/A-13 재판정, 정상 체결과 maker revoke 거부를 모두 통과했다.
- RFQ 데모를 운영자 도구 중심에서 사용자 중심 4단계 흐름으로 재구성했다. 실제
  실행 가능한 Meridian quote와 Falcon/Nomos preview fixture를 구분하고, exact quote
  검토 후 Router 체결, Portfolio의 실제 session balance delta까지 연결했다.
- long-lived backend가 CLI와 동일한 Anvil 계정을 사용할 때 발생하던 stale nonce를
  제거했다. transaction마다 pending nonce를 조회하고 settlement action을 직렬화했으며,
  E2E가 UI와 동일한 exact quote 제출 및 CLI activity 이후 backend 재체결을 검증한다.
- custom port에서도 동작하는 dashboard same-origin RFQ proxy를 추가하고, backend가
  caller-provided quote의 deployment binding과 maker signature를 재검증하도록
  hardening했다. tampered token quote 거부와 proxy 경유 실제 체결을 live E2E로 확인했다.
- `scripts/demo.sh`는 사용 중인 포트를 사전에 거부하고, 실패한 `--keep` E2E는
  프로세스를 남기지 않도록 정리해 반복 데모의 예측 가능성을 높였다.
- 대시보드의 모든 정적·동적 버튼을 endpoint/상태 전이와 대조하고 연결 회귀 검사를
  추가했다. 체결된 single-use quote의 재실행을 차단하고 Operator API 오류 처리,
  탭 활성 상태와 중복 실행 방지를 보강했으며, 헤더 **?**에서 정상 거래·Security
  demo·live/fixture 경계·버튼별 연결을 바로 확인하는 접근 가능한 presenter guide를
  제공한다. dashboard smoke와 fresh-port BUIDL-like RFQ E2E(setup, settle,
  revoke rejection, state persistence, restore)가 통과했다.
- RFQ MVP dashboard의 준비·상태 확인·quote 요청·검토·Router 체결·maker revoke·
  명시적 restore를 실제 local backend와 온체인 상태에 연결했다. revoke는 restore
  전까지 유지되고 Operator event index에 settlement와 maker false/true 전이가
  기록된다. live quote rate와 추가 maker preview를 제공하되, 외부 market
  feed나 실제 multi-maker 연결이 없는 값은 fixture/preview로 명확히 구분했다. 브라우저에는
  private key가 전달되지 않는다. `scripts/check.sh`
  (641/641 Foundry 포함)과 RFQ-only live E2E가 통과했다.
- `AMM-001`에서 vendored pinned Uniswap v3 core artifact로 canonical factory와
  pool을 배포하고 CREATE2 주소, 초기화, 실제 liquidity mint/swap callback,
  Router-protected ERC-3643 buy/sell을 검증했다. Adapter는 pool token 방향과
  callback positive delta를 binding해 잘못된 token pull을 거부한다.
  `scripts/check.sh`가 Foundry 641/641, 모든 service smoke와 deploy-v3 10/10을
  통과했고 독립 리뷰 지적은 exact compliance reason 회귀로 반영했다.
- `MANIFEST-002`에서 고정 issuance/fund 두 필드 대신 bounded
  `RecipeBinding[]`를 runtime source of truth로 도입했다. required AND,
  path-group OR/그룹 간 AND, non-blocking flag bitmap과 deterministic failure를
  구현하고, `FLAG_ONLY` stateful hook이 settlement를 되돌리지 못하도록
  trade-critical commit에서 분리했다. `scripts/check.sh`(Foundry 634/634, 모든
  service smoke, deploy-v3 10/10)와 `buidl-like`/`reg-d` live E2E(각 7/7 +
  delayed recovery + CLI onboarding + backend RFQ)가 통과했다.
- `DATA-001`에서 per-lot acquisition/완납/lineage를 검증하는 provider-neutral SDK,
  operator-attested on-chain snapshot과 missing/broken/stale/immature를 구분하는
  fail-closed Lockup을 구현했다. `SECONDARY` lot의 과거 lineage 상속을 거부하고,
  cyclic lineage, holder 상태 변경, conflicting replay와 audit 변조 회귀를 고정했다.
  `scripts/check.sh`(Foundry 618/618, 모든 service smoke, deploy-v3 10/10)와
  `buidl-like`/`reg-d` live E2E(각 7/7 + delayed recovery + AMM/RFQ)가 통과했다.
  실제 Securitize API, amount-specific allocation과 production WORM은 외부 계약
  확정 전까지 후속 범위다.
- `PROD-001`에서 `OperatorRegistry`를 global/asset/venue pause source of truth로
  만들고 Router의 nonce/evaluation 전에 fail-closed enforcement를 추가했다.
  unpause와 Manifest resume/update는 owner schedule + 1일 timelock으로 분리했고,
  version/history hash와 governance event를 보존한다. registry ownership이
  Factory로 이전된 실제 배포에서도 schedule이 가능하도록 governance forwarding을
  추가했다. `scripts/check.sh`(Foundry 609/609, 모든 service smoke, deploy-v3
  10/10)와 `buidl-like`/`reg-d` live E2E(각 7/7 + 실제 delayed resume 후 AMM/RFQ)가
  통과했다.
- `DOC-003`에서 ROADMAP의 Toolkit/API/dashboard/live E2E 완료 상태와 production
  후속 범위를 정렬하고 incident-response runbook을 추가했다. 최신 main에서
  `buidl-like`와 `reg-d`가 각각 7/7 scenario, Toolkit preflight/checkpoint,
  backend-signed RFQ settlement와 revoked-maker rejection을 통과했다.
- `OPS-002`에서 GitHub Actions가 local `scripts/check.sh`와 동일한 repository-wide
  gate를 실행하도록 통합했다. Foundry fmt/high-severity lint/build와 582/582 tests,
  RFQ SDK·CLI·demo backend·Toolkit·Operator API/dashboard smoke, vendored deploy-v3
  10/10 tests와 whitespace 검사가 통과했다. deploy-v3 dependency는 vendor directory의
  `yarn.lock`으로만 설치해 격리 경계를 유지한다.
- `OPS-001`에서 production `src`의 Foundry high-severity lint를 local check와
  GitHub Actions에 fail-closed gate로 연결했다. `VenueSelector`의 venue bitmask를
  명시적 `uint256(1)` shift로 고쳐 high-severity warning을 제거했다.
  `forge lint --severity high --deny warnings src`, 전체 Foundry 582/582와
  `scripts/check.sh`가 통과했다. test fixture의 medium/low warning과 Slither는
  후속 warning-budget/security-analysis 범위다.
- `ComplianceEngine`의 pair evaluation과 element collection 상태를
  `ActivePairState`/`ElementAccumulator`로 묶고 recipe별 append를 helper로 분리했다.
  `DecisionHashLib`는 기존 static ABI encoding과 동일한 두 구간 결합으로 stack
  사용량을 낮추고 canonical hash 회귀 테스트를 추가했다. 이에 `via_ir = false`로
  전환했으며 Foundry stable v1.7.1 기준 clean full build(186 files)가 27.96초
  (wall 29.72초)에 통과했다. targeted Engine 23/23, decision hash 1/1과 전체
  `forge test --offline` 582/582가 통과했다. 제품 동작 변경이 없는 내부
  리팩터이므로 live Anvil E2E는 재실행하지 않았다.
- 기존 `DEMO-002` 작업은 `services/rfq-demo-backend` local HTTP quote API와
  CLI `rfq-quote --backend`를 추가했다.
- issue #40 정합화 작업에서 live runner와 CLI에 `buidl-like | reg-d` profile
  선택을 추가하고, BUIDL-like를 기본 데모로 지정했다.
- runner가 backend quote 발급 → CLI 제출 → protected RFQ settlement와
  revoked-maker 거부를 자동 수행하도록 확장했다.
- Foundry v1.7.1 clean build에서 `buidl-like`과 `reg-d` live runner가
  각각 7/7 scenario와 backend RFQ success/failure path를 통과했다.
- backend는 live-Anvil deployment artifact의 maker/pair/venue/RFQAdapter에 고정되고
  RFQ SDK의 fixed pricing, in-memory nonce와 no-op risk fixture를 사용한다.
- 당시 feature에서 production signer custody, persistent nonce, pricing/inventory와
  hosting은 범위 밖이었다. 후속 기준은 ADR-009이며 최종 compliance는 Router fill
  시점에 유지한다.
- `scripts/check.sh` 통과: Foundry 248/248, RFQ SDK, CLI/backend smoke, deploy-v3.
- 기존 Foundry `1.4.0-nightly` build cache의 constructor decode 오류는
  Foundry v1.7.1 clean rebuild로 해소했고, 실제 protected Router walkthrough를 완료했다.
- Toolkit 통합 후 `scripts/e2e-anvil.sh --profile buidl-like`와 `--profile reg-d`가
  각각 실제 artifact preflight와 immutable checkpoint, 7/7 scenario, CLI/backend
  RFQ success와 revoked-maker failure를 통과했다.
- Toolkit config에 governance multisig alias와 required approval 수를 명시하고,
  signer material은 설정에서 제외했다.
