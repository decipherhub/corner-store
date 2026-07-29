# Features

## State Rules

- `not-started` → `active`: 해당 feature 작업을 시작할 때
- `active` → `passing`: 모든 Verification이 통과했을 때
- `active` → `blocked`: 외부 정보나 결정이 없어 진행할 수 없을 때
- `blocked` → `active`: 차단 사유가 해소되었을 때

동시에 하나의 feature만 `active` 상태로 둔다.

## HE-001 — Harness Baseline

### Behavior

- 새 세션이 저장소만 읽고 현재 상태와 다음 작업을 복구할 수 있다.
- 필수 명령과 완료 조건이 한 곳에서 안내된다.
- feature, progress, decision과 quality 상태가 저장소에 기록된다.
- 전체 검증을 한 명령으로 실행할 수 있다.

### Verification

- `scripts/check.sh`
- `git diff --check`
- Harness 필수 문서와 링크 수동 검토

### State

passing

### Notes

- 완료 계획: `docs/exec-plans/completed/HE-001-harness-baseline.md`
- 제품 아키텍처 내용은 이 feature에서 변경하지 않는다.

## DOC-001 — Imported Architecture Alignment

### Behavior

- imported 문서에서 확정된 제품 방향과 변경 요청을 구분한다.
- 공식 제품 명세가 Compliance Core, Execution Integration Kit, reference DEX와
  4-Layer 모델을 일관되게 설명한다.
- pair 거래에서 양쪽 자산의 classification과 Manifest를 누락하지 않는다.
- 기존 문서의 충돌하는 용어와 가정을 정리한다.
- 열린 설계 결정은 확정된 구현처럼 표현하지 않는다.

### Verification

- 관련 문서 간 용어·책임·흐름 교차 검토
- Markdown 링크 확인
- `scripts/check.sh`
- `git diff --check`

### State

passing

### Notes

- 입력 분류: 완료 Exec Plan의 `Input Classification`
- 완료 계획: `docs/exec-plans/completed/DOC-001-imported-architecture-alignment.md`
- 확정 방향과 개발팀이 결정해야 할 change request를 구분해 반영한다.

## FND-001 — Foundry Product Foundation

### Behavior

- Foundry template를 제품 개발 구조로 교체한다.
- 제품 interface, type, error와 mock fixture를 컴파일할 수 있다.
- 이후 compliance와 execution feature가 재사용할 테스트 기반을 제공한다.

### Verification

- `forge fmt --check`
- `forge build`
- `forge test --offline`

### State

passing

### Notes

- 현재 제품 구조는 Compliance Core, Execution Integration Kit, reference adapters와
  Foundry unit/integration fixture를 포함한다.
- production Manifest lifecycle, RFQ dealer/custody, OrderBook은 별도 feature다.

## RFQ-001 — Reference RFQ Settlement

### Behavior

- RFQ가 AMM과 같은 `ExecutionRouter`/Adapter slot에 등록·교체될 수 있다.
- RFQ quote는 maker가 EIP-712로 서명하고 chainId, RFQAdapter, maker, taker,
  token, amount, venue, nonce, expiry에 바인딩된다.
- RFQAdapter는 Router-only로 동작하고 direct adapter bypass를 거부한다.
- 매 fill은 Router의 최신 compliance evaluation 이후 full-fill/exact-taker로만
  settlement된다.
- reference TypeScript service는 quote 생성, expiry/nonce 부여, EIP-712 signing
  요청만 담당한다.

### Verification

- `forge fmt`
- `forge build`
- `forge test --offline --match-path test/unit/execution/RFQAdapter.t.sol -vv`
- `forge test --offline`
- `cd services/rfq && npm test`
- `git diff --check`

### State

passing

### Notes

- Non-goals: partial fill, orderbook, production pricing engine, dealer inventory,
  custody 확장, websocket/order discovery.

## DEMO-001 — BUIDL-like ERC-3643 Demo Asset

### Behavior

- `src/demo/BuidlLikeDemoAsset.sol`이 Giwa MVP용 BUIDL-like asset profile을 제공한다.
- 테스트 fixture가 profile의 이름/심볼로 실제 ERC-3643/T-REX 토큰을 배포한다.
- profile Manifest는 Reg D 506(c) 발행 Recipe와 ICA 3(c)(7) fund Recipe를 동시에 바인딩한다.
- `factsPacked` fund bit가 켜진 자산에서는 BUIDL-like fund Recipe가 A-13 Qualified Purchaser와 minimum investment 검사를 활성화한다.
- BUIDL-like flow test는 실제 Securitize/TA 연결 대신 `MockSecuritizeTA` fixture로 investor facts를 만들고, 그 결과를 ERC-3643 registry와 Corner Store Elements에 sync한다.
- protected Router 경로에서 QP buyer는 체결되고, accredited-only/non-QP buyer는 토큰 이동 전 거절된다.
- sanctioned QP buyer는 token movement 전에 compliance reject된다.
- QP buyer라도 BUIDL-like minimum investment 미만이면 token movement 전에 compliance reject된다.
- expired TA profile은 current eligibility로 sync되지 않고 token movement 전에 compliance reject된다.
- engine-level AI/QP flags가 통과해도 ERC-3643-unverified recipient는 settlement에서 rollback된다.
- QP/규제 로직은 BUIDL 전용 토큰 override가 아니라 Manifest/Recipe/Element에 남긴다.
- DS Protocol/Securitize-style Compliance Service는 profile 문서에서 adapter seam으로 매핑한다.
- 현실 BlackRock BUIDL 연동, Securitize claim 연동, NAV/redemption/distribution rail은 범위 밖이다.

### Verification

- `forge fmt --check src/demo/BuidlLikeDemoAsset.sol test/fixtures/TREXSuite.sol test/fixtures/MockSecuritizeTA.sol test/integration/IntegrationBase.sol test/integration/BUIDLLikeFlow.t.sol src/compliance/elements/BuidlMinimumInvestment.sol src/compliance/recipes/BuidlLikeFundRecipe.sol test/unit/compliance/BuidlLikeFundRecipe.t.sol`
- `forge test --offline --match-path test/integration/BUIDLLikeFlow.t.sol -vv`
- `forge test --offline --match-path test/unit/compliance/BuidlLikeFundRecipe.t.sol -vv`
- `forge test --offline`

## RFQ-002 — RFQ v2 Hardening

### Behavior

- maker(dealer) approval이 operator-curated allowlist로 강제된다. 미승인 maker의
  quote는 서명이 유효해도 settlement에서 거부된다(`RFQMakerNotApproved`).
- `setMakerApproved(address,bool)`는 `onlyOperator`이며 `MakerApprovalSet` event를
  emit한다.
- maker는 자신의 nonce namespace에 대해 `cancelQuoteNonce`/`cancelQuoteNonces`로
  outstanding quote를 취소할 수 있다. idempotent(used nonce는 no-op)하며 상태
  전이 시에만 `RFQQuoteCancelled` event를 emit한다.
- router는 `context.venueType`이 등록된 `VenueConfig.venueType`와 불일치하면
  거부한다(`VenueTypeMismatch`).
- venue 위협 모델이 `docs/rfq-threat-model.md`에 문서화된다.

### Verification

- `forge test --offline`(전체 133/133 유지)
- RFQAdapter unit test: `test_execute_revertsWhenMakerNotApproved`,
  `test_setMakerApproved_onlyOperator`, `test_setMakerApproved_setsAndEmits`,
  `test_execute_revertsAfterApprovalRevoked`,
  `test_cancelQuoteNonce_blocksSubsequentFill`,
  `test_cancelQuoteNonce_emitsOnFirstCancelOnly`,
  `test_cancelQuoteNonce_scopedToCaller`, `test_cancelQuoteNonces_batchCancels`,
  `test_cancelQuoteNonce_afterFillIsNoOp`
- Router unit test: `test_execute_revertsWhenVenueTypeMismatchesRegistry`
- `cd services/rfq && npm test`(unchanged-service guard)
- `docs/rfq-threat-model.md` 존재와 `docs/security.md`/`docs/README.md` 링크 무결성

### State

passing

### Notes

- 정책 결정: D008(maker approval adapter-local, full-fill, non-custodial,
  nonce-scoped idempotent cancel).
- Non-goals: partial fill, dealer inventory, signer key custody, shared dealer
  registry.
- Deferred follow-up (완료): router-path maker-approval/cancellation
  integration-test 시나리오를 `test/integration/RFQFlow.t.sol`에서 real ERC-3643
  스택 위 protected path로 커버한다.

## CMP-001 — Reg D 506(c) 9-element Recipe

### Behavior

- illustrative Reg D 506(c) element library가 reference 9-element set을 커버한다:
  A-01 sanctions, A-02 jurisdiction, A-03 accredited, A-04 identity uniqueness,
  A-05 US-tax-resident 제외, B-01 asset classification(REG_D), B-02
  ERC-3643-native asset, C-01 Rule 144 lockup, E-01 Form D filing.
- `RegD506cRecipe`는 이 9-element set을 요구한다(id 1, version 2,
  always-applicable). illustrative reference wiring이며 approved production
  policy가 아니다.
- 새 element의 attestation setter는 operator-gated(`Governed`/`onlyOperator`)이며
  production data source(OFAC/ONCHAINID/ERC-165/EDGAR)는 approval-gated seam으로
  남는다.
- C-01 Lockup은 injected mock acquisition source를 통해 test fixture에서만
  활성화된다. production holding-period 활성화 default는 변경하지 않는다.
- 완전히 attested된 buyer + asset은 real ERC-3643 router 경로로 settle되고,
  element family별로 하나를 깨면 그 element의 reasonCode로 거부된다.

### Verification

- `forge test --offline`(전체 195/195, pre-task 189 + 신규 6).
- Recipe unit test: `test_regd_ids_and_elements`(9 element, version 2, id 1,
  always-applicable).
- 통합 test `test/integration/RegD506cElements.t.sol`:
  `test_happyPath_nineElements_buySucceeds`,
  `test_reject_jurisdictionDisallowed`, `test_reject_jurisdictionUnset`,
  `test_reject_identityUnbound`, `test_reject_usTaxResidentFlagged`,
  `test_reject_assetNotClassifiedRegD`.
- 기존 통합/unit fixture(MultiRecipe, Surveillance, EmergencyPause, Invariants,
  SwapFlow, Engine)는 shared setup helper로 9-element attestation을 추가해 유지.
- `forge fmt`.

## DOC-002 — RFQ SDK and MVP Demo Planning

### Behavior

- RFQ backend 운영을 Corner Store가 제공하지 않는다는 제품 경계를 명확히 한다.
- RFQ backend SDK, local reference example, MVP demo backend를 서로 다른 레이어로 분리한다.
- 구현 순서는 SDK interface 정리 → local reference example → MVP demo backend로 기록한다.
- production RFQ hardening(dealer approval, custody, cancellation, partial fill)은 별도 트랙으로 유지한다.
- roadmap과 product spec index에서 RFQ SDK/MVP backend 후속 작업을 찾을 수 있다.

### Verification

- RFQ venue architecture, product-spec index, roadmap, FEATURES, PROGRESS 교차 검토
- `git diff --check`

### State

passing

### Notes

- 데모 문서: `docs/compliance/07-buidl-implementation.md`
- Profile spec: `docs/product-specs/buidl-like-demo-profile.md`
- 현재 구현은 local BUIDL-like profile + fixture다. 실제 BUIDL 온보딩은 법률 확정, issuer/trusted-claim 연동, 1차/2차 rail 분리 후 별도 feature로 진행한다.

- 정책 결정: D009(9-element in-place 확장, operator-gated setter, Lockup은
  fixture-only mock acquisition source).
- Deferred follow-up: ungated legacy mock element(A-01/A-03/QP)의 operator-gate
  정렬, production data source 연결, acquisition/lot data source와 holding-period
  활성화 조건 결정.
- Non-goals: production legal 활성화, direction-aware element application.

## E2E-001 — Live Anvil E2E & Demo Runner

### Behavior

- `scripts/e2e-anvil.sh`가 fresh Anvil 노드를 띄우고 전체 스택을 배포
  (`script/DeployStack.s.sol`)한 뒤 7-scenario demo suite
  (`script/DemoScenarios.s.sol`)를 구동하고, scenario별 narrative + evidence +
  `PASS`/`FAIL`을 출력한 다음 노드를 teardown한다. 완전히 offline로 동작하고,
  하나라도 실패하면 스크립트가 non-zero로 종료한다. `--port`, `--keep` 플래그를
  지원한다(`--keep`은 이후 Anvil을 계속 실행해 인터랙티브 demo/UI attach 가능).
- `DeployStack`은 registries(Element/Recipe/TokenPolicy/Operator),
  ComplianceEngine, ExecutionRouter+VenueRegistry+VenueSelector,
  CornerStoreFactory, 11개 element, 두 recipe(RegD 506(c) id 1, 3(c)(7) id 2) +
  surveillance-enabled RegD 변형(id 7), MockPool AMM venue, RFQAdapter venue,
  그리고 REAL ERC-3643 token + OnchainID 스택을 live 노드에 배포하고 주소를
  `deployments/anvil-e2e.json`(gitignore)로 기록한다. T-REX 배포 코어는
  `test/fixtures/TREXCore.sol`로 추출해 test fixture와 script가 공유한다.
- 7 scenario: (1) factory 1-call onboarding(propose→approve+venue), (2) compliant
  trade 성공, (3) live element rejection(A-02 flip → `ComplianceRejected`, off-chain
  reason-code 재계산 후 복원), (4) manifest lifecycle(suspend 차단 → resume 재거래),
  (5) RFQ venue(EIP-712 quote 서명 → `RFQFilled`, 미승인 maker `RFQMakerNotApproved`),
  (6) surveillance(threshold 초과 시 `SurveillanceFlag`), (7) bypass 시도(direct
  adapter.execute → `NotAuthorized`).
- src/(제품 코드) 변경 없음. `tools/deploy-v3`에 의존하지 않는다(vendor isolation);
  AMM venue는 MockPool을 쓰고, 실제 Uniswap v3 pool 배포는 별도 follow-up으로 남는다.

### Verification

- `scripts/e2e-anvil.sh`(fresh + repeat) 2회 실행, 각 7/7 PASS + exit 0.
- `scripts/e2e-anvil.sh --keep` 실행 후 Anvil이 계속 살아 있음을 확인.
- `forge test --offline`(238/238 유지; TREXSuite→TREXCore 추출 후에도 green).
- `forge fmt --check`.

### State

passing

### Notes

- runbook: `docs/demo.md`(실행법, scenario 순서, reason-code 재계산, mock/real 구분).
- 관련 결정: D008/D009(illustrative element library, manifest lifecycle). 실제
  Uniswap v3 pool 배포와 production data source 연결은 out-of-scope.
- Non-goals: 실 Uniswap v3 pool, production governance key management,
  direction-aware element application.

## CMP-002 — Manifest Lifecycle & Operator Approval Flow

### Behavior

- Manifest는 validated state machine을 따른다: UNKNOWN --register--> PROPOSED
  --approve--> ACTIVE, ACTIVE <--resume--/--suspend--> SUSPENDED,
  {ACTIVE, SUSPENDED} --retire--> RETIRED(terminal), UNKNOWN --setUnregulated-->
  UNREGULATED --clearUnregulated--> UNKNOWN. 그 외 모든 transition은
  `InvalidManifestTransition`으로 revert한다.
- `registerManifest`는 caller-supplied status를 무시하고 항상 PROPOSED로 착지하며
  `declaredBy = msg.sender`를 기록한다. `approveManifest`는 `approvedBy`를 기록하고
  issuance recipe가 비어 있으면 revert한다. raw `setStatus`는 제거되었다.
- owner가 자산을 classify(register/setUnregulated/clearUnregulated)하고 operator가
  기존 manifest의 lifecycle(approve/suspend/resume/retire)을 구동한다.
- `ComplianceEngine.evaluate`는 side별 positive allowlist(UNREGULATED 또는 ACTIVE만
  허용)로 default-deny한다. UNKNOWN/SUSPENDED/PROPOSED/RETIRED와 미래 member는
  fail-closed하며, both-UNREGULATED fast-path는 유지된다.
- `CornerStoreFactory.registerRWAToken`은 register→approve를 한 governed call에서
  실행하고 token은 ACTIVE로 끝난다(`declaredBy`/`approvedBy` = factory).

### Verification

- `forge test --offline`(전체 227/227, pre-task 212 + 신규 15).
- Engine unit test(default-deny fail-closed): `test_proposed_against_unregulated_fails_closed`,
  `test_retired_against_unregulated_fails_closed`, `test_proposed_against_active_fails_closed`,
  `test_retired_against_active_fails_closed_both_orderings`(양방향 ordering).
- Registry unit test(clearUnregulated + onlyOwner-vs-onlyOperator):
  `test_clearUnregulated_from_UNREGULATED`, `test_clearUnregulated_then_register_ok`,
  `test_clearUnregulated_reverts_when_UNKNOWN`, `test_clearUnregulated_reverts_when_PROPOSED`,
  `test_clearUnregulated_reverts_when_ACTIVE`, `test_clearUnregulated_reverts_for_non_owner`,
  `test_clearUnregulated_reverts_for_operator`, `test_setUnregulated_reverts_for_operator`.
- 통합 test `test/integration/EmergencyPause.t.sol`(router end-to-end):
  `test_proposedPolicy_failsClosed`, `test_retiredPolicy_failsClosed`,
  `test_suspendThenResume_tradesAgain`.
- 기존 registry lifecycle state-machine unit test(Task 1, 25 tests)는 유지.
- `forge fmt`.

- Product spec: `docs/product-specs/rfq-backend-sdk-and-demo.md`
- 이 feature는 문서 계획 작업이며 `services/rfq` 구현은 후속 feature에서 진행한다.

## RFQ-SDK-001 — RFQ Backend SDK Interfaces

### Behavior

- `services/rfq`가 RFQ backend를 만들기 위한 TypeScript SDK helper를 제공한다.
- integrator는 `createRFQService(...).quote(...)` high-level API로 taker/token/amount/venue만 넣고 `RFQAdapter` 호환 signed quote를 받을 수 있다.
- SDK는 EIP-712 typed-data shape, chainId/verifyingContract binding, nonce, expiry, amount validation과 signature flow를 처리한다.
- signer, nonce store, pricing provider, inventory/risk check는 교체 가능한 interface로 제공한다.
- local reference component는 `InMemoryNonceStore`, `FixedRatePricingProvider`, `NoopInventoryRiskCheck`로 제한한다.
- production server, hosted backend, pricing strategy, signer custody, inventory management와 compliance final decision은 범위 밖이다.

### Verification

- `cd services/rfq && npm test`
- `scripts/check.sh`
- `git diff --check`

### State

passing

### Notes

- SDK README: `services/rfq/README.md`
- Product spec: `docs/product-specs/rfq-backend-sdk-and-demo.md`
- MVP demo backend는 이 SDK를 기반으로 후속 feature에서 구현한다.

## DEMO-002 — MVP RFQ Demo Backend

### Behavior

- `services/rfq-demo-backend`가 RFQ SDK를 사용해 local Anvil용 signed quote HTTP API를 제공한다.
- backend는 deployment artifact의 approved maker, RFQ adapter, venue와 QUOTE/RWA pair에 고정되며 mock fixed-rate pricing을 사용한다.
- CLI `rfq-quote --backend <url>`가 backend quote를 기존 quote JSON 형식으로 저장하고 기존 `buy --venue rfq` protected Router flow에서 사용한다.
- live runner와 CLI는 `buidl-like | reg-d` asset profile을 선택하며, issue #40의
  기본값은 BUIDL-like metadata + Reg D/QP/minimum-investment Manifest다.
- live runner가 backend quote → CLI → Router/RFQAdapter 성공과 revoked-maker
  실패를 자동 실행한다.
- `scripts/e2e-anvil.sh --mode rfq`는 AMM·lifecycle·surveillance 설명을 건너뛰고
  mock TA profile → Toolkit/CLI → backend-signed quote → protected RFQ settlement
  → revoked-maker rejection만 보여주는 짧은 MVP 시연 경로를 제공한다.
- Dashboard는 사용자 중심의 Dashboard → RFQ 거래 → My RFQs → Portfolio 흐름을
  기본 navigation으로 제공하고 Security proof와 read-only Operator view는 Advanced로
  분리한다. 사용자는 local backend에서 exact signed quote를 요청·비교·검토한 뒤
  protected Router settlement를 실행하고 실제 session balance delta를 Portfolio에서
  확인한다. Security proof는 on-chain maker revoke 상태를
  명시적 restore 전까지 유지해 현재 정책 enforcement를 가시화한다. 브라우저에는
  private key가 전달되지 않는다.
- Trader의 live firm rate는 `/demo/quote` 금액에서 계산한다. 비교 maker, 가격 곡선,
  spread와 활동 통계는 multi-maker/market-data API가 생기기 전까지 명시적으로
  `Demo fixture data`와 `Preview only`로 표시해 실제 실행 가능 quote와 구분한다.
- 헤더의 **?** presenter guide가 정상 거래, maker-revocation 보안 시나리오,
  live/fixture 경계와 각 버튼의 실제 backend/Operator API 연결을 대시보드 안에서
  설명한다.
- backend는 pricing, signing과 nonce 발급만 담당하며 compliance 최종 판단을 하지 않는다.
- long-lived demo backend는 CLI와 동일한 Anvil 계정을 함께 사용해도 각 transaction의
  pending nonce를 다시 조회하고 settlement action을 직렬화해 stale nonce와 중복 제출을
  방지한다. live E2E는 UI와 동일하게 quote 요청 후 그 exact quote를 trade endpoint에
  제출하고, CLI activity 이후 backend 재체결까지 검증한다.
- dashboard는 `/rfq-api` same-origin proxy로 backend에 연결되어 custom launcher
  port에서도 frontend 수정 없이 동작한다. trade endpoint는 제출된 quote의
  maker/taker/token pair/venue/domain/signature를 deployment artifact와 대조한 뒤에만
  local settlement를 실행한다.
- production pricing, signer custody, persistent nonce, inventory/risk control과 hosted operation은 명시적으로 범위 밖이다.

### Verification

- `cd services/rfq-demo-backend && npm test`
- `cd services/cli && npm test`
- `scripts/check.sh`
- `scripts/e2e-anvil.sh --profile buidl-like`
- `scripts/e2e-anvil.sh --profile reg-d`
- `scripts/e2e-anvil.sh --profile buidl-like --mode rfq`
- `git diff --check`

### State

passing

### Notes

- `scripts/check.sh` 통과: Foundry 248/248, RFQ SDK, CLI, RFQ demo backend와 deploy-v3.
- backend smoke가 HTTP quote, fixed pricing, maker signature, monotonic nonce와 invalid amount를 검증한다.
- CLI smoke가 `--backend` request path를 검증하고 기존 `RFQFlow.t.sol`이 protected Router settlement의 성공/거부 경로를 검증한다.
- Foundry v1.7.1 clean build에서 `buidl-like`과 `reg-d` 두 profile 모두
  통과: 각각 7/7 scenarios, backend-signed quote settlement, revoked-maker 거부.
- RFQ-first dashboard/runbook: `services/operator-dashboard`의 사용자 중심 4개
  기본 화면과 2개 Advanced 화면, local HTTP server smoke, `--mode rfq` live E2E를
  검증했다. 시연 순서는
  `docs/rfq-demo-guide.md`를 기준으로 한다.

## CLI-001 — corner-store Reference CLI

### Behavior

- `services/cli/`에 TypeScript CLI(`corner-store`)를 추가해, forge 스크립트를 직접
  다루지 않고 터미널에서 live 노드 대상으로 전체 스택을 구동한다: onboarding,
  attestation, manifest lifecycle, AMM/RFQ 거래, reason-code 디코딩. 기대 환경은
  Anvil E2E 배포(`scripts/e2e-anvil.sh --keep` + `deployments/anvil-e2e.json`).
- 명령: `status`(주소/manifest/venue/per-element attestation 상태, `--json`),
  `onboard`(factory 1-call, ACTIVE면 retire→register→approve),
  `manifest <status|suspend|resume|retire>`, `attest <element> <subject> [value...]`
  (9개 element setter), `investor-setup <addr> --profile ...`(선택 profile attestation +
  C-01 acquisition seed + QUOTE funding), `kyc <addr>`(ERC-3643 identity/claim,
  `script/KycInvestor.s.sol` forge 스크립트로 위임), `buy <amountIn>`
  (`--venue amm|rfq`, `--min`, `--quote`), `rfq-quote`/`rfq-cancel`(services/rfq
  EIP-712 서명 라이브러리 재사용), `maker <approve|revoke>`, `reason <bytes32>`.
- reason 디코딩은 `(recipeId∈{1,2,7}) × (11 element) × code 1` + engine의 policy-status
  거부(`encode(0,"POLICY",status)`)를 오프라인 사전계산해 매칭한다. `ComplianceRejected`
  를 잡는 모든 명령이 자동 디코딩하고, 실패 tx는 디코딩된 reason과 함께 non-zero 종료.
- chain 상호작용은 ethers(services/rfq에는 web3 라이브러리가 없어 CLI가 유일하게 도입),
  ABI는 `src/abi.ts`의 hand-written fragment(`out/` 비의존). src/ 제품 코드 변경 없음;
  신규 Solidity는 `script/KycInvestor.s.sol` 하나(shared `TREXCore` 재사용, 이미 배포된
  T-REX 스택에 re-bind).

### Verification

- `npm test`(services/cli): reason-table decode round-trip(`cast keccak` ground-truth
  대조) + quote-file round-trip 스모크, 네트워크 불필요.
- Live 노드 walkthrough(fresh account 4): `status` → `onboard` → `investor-setup` →
  `kyc` → `buy`(AMM PASS, +100 RWA) → `attest jurisdiction ZZ` → `buy`(FAIL, decoded
  `recipe 1 / A-02-v1 / Jurisdiction`) → restore → `manifest suspend` → `buy`(FAIL,
  `POLICY / SUSPENDED`) → `resume` → `buy`(PASS) → `rfq-quote` → `buy --venue rfq`
  (PASS) → `maker revoke` → `buy --venue rfq`(FAIL, `RFQMakerNotApproved`).
  전 실패 경로 non-zero 종료 + 디코딩 확인.
- `forge test --offline` 238/238 유지(Solidity 측 추가는 `KycInvestor.s.sol`뿐).

### State

passing

### Notes

- runbook: `services/cli/README.md`("CLI demo" 레시피), `docs/demo.md`의
  "CLI로 직접 해보기" 섹션.
- `kyc`는 repo root에서 실행해야 한다(상대 fs_permissions + 스크립트 경로). CLI가
  forge cwd를 repo root로 설정하고 artifact를 root-상대 경로로 전달한다.
- Non-goals: 프로덕션 key 관리, out/ ABI 커플링, 두 번째 web3 라이브러리 도입.

## CLI-002 — corner-store CLI v2 (preflight · trade surface · observability)

### Behavior

- 기존 `services/cli`에 명령 7개를 더한다(제품 코드/스크립트 변경 없음, `services/cli/**`
  + 문서만):
  - `check <buyer> [--venue amm|rfq] [--amount n] [--json]` — 거래 없이 per-element
    preflight. active manifest의 recipe id → `requiredElements()` →
    `ElementRegistry.elementOf` → 각 element `check(buyer, seller, rwa, amount, "")`를
    eth_call로 실행하고, `engine.evaluate(ctx)`(view)로 전체 verdict를 낸다. 표(id/name/
    PASS·FAIL)+verdict 라인, FAIL 행은 디코딩된 reason, verdict가 rejected면 exit 1.
    엔진은 `ctx.buyer`만 스크리닝(비-direction-aware)하므로 subject를 무시하는 asset-side
    원소(B-01/B-02/E-01)는 표에 `[asset-side]`로 표기해 per-buyer FAIL 오독을 막는다.
  - `sell <amountIn> [--min]` — AMM 매도(tokenIn=RWA, tokenOut=QUOTE). `buy`를 미러링하되
    `test/integration/SwapFlow.t.sol::test_sell_shaped_success`의 컨텍스트(ctx.buyer=매도자,
    venueData=zeroForOne=false)를 그대로 따른다.
  - `balances [addr...] [--json]` — RWA/QUOTE 잔고 + amm/rfq adapter allowance(기본: 5개
    well-known 역할).
  - `watch [--from block]` — `eth_getLogs` 폴링(~2s) 이벤트 tail: Executed, RFQFilled,
    RFQQuoteCancelled, MakerApprovalSet, ManifestRegistered, ManifestStatusChanged,
    SurveillanceFlag. reason/label·status·elementId 디코딩, `--from`은 히스토리 재생.
  - `faucet <addr> <amount>` — QUOTE 민팅(MockERC20.mint permissionless, demo 전용).
  - `snapshot` / `restore <id>` — anvil `evm_snapshot`/`evm_revert`(RPC 미지원 시 명확한 에러).
  - `quote-inspect <file> [--json]` — 서명 quote 디코딩: services/rfq 타입드데이터로 서명자
    복구(==maker PASS/FAIL), 만료 카운트다운, on-chain `usedQuoteNonce`/`approvedMaker`.
    실패 검사가 하나라도 있으면 exit 1.
- 재사용 원칙 준수: reason 디코딩은 기존 `reason.ts`, EIP-712 복구는 services/rfq lib의
  domain+types로 `ethers.verifyTypedData`(타입 문자열 재선언 없음). ABI fragment는 계속
  hand-written(`out/` 비의존)이며 실제 컨트랙트 소스와 대조해 추가했다.

### Verification

- `npm test`(services/cli): quote-inspect 서명자 복구 round-trip(valid + tampered) +
  reason-decode 회귀(check가 쓰는 recipe-aware per-element code) 스모크, 네트워크 불필요.
- Live walkthrough(`scripts/e2e-anvil.sh --keep`, fresh account 4): `check`(미attested →
  A-02/A-03/A-04/C-01 FAIL + rejected, exit 1) → `investor-setup`+`kyc` → `check`(전 PASS,
  ALLOWED) → `faucet` → `buy`(+100 RWA) → `sell 40`(RWA -40, QUOTE +40) → `balances`
  전/후 → `snapshot`(0x11) → `attest jurisdiction ZZ` → `check`(정확히 A-02 하나 FAIL,
  exit 1) → `restore 0x11` → `check`(ALLOWED) → `watch --from 0`(세션 이벤트 디코딩 재생,
  라이브 MakerApprovalSet tail) → `rfq-quote` → `quote-inspect`(전 PASS) → 파일 서명
  변조 → `quote-inspect`(signature FAIL, exit 1).
- `forge test --offline` 238/238 유지(Solidity 변경 없음).

### State

passing

### Notes

- runbook: `services/cli/README.md`(CLI v2 명령/주의), `docs/demo.md`.
- `check`는 엔진이 direction-aware가 아니라는 점을 도움말·표기로 명시(asset-side 라벨).
- `snapshot`/`restore`는 anvil 전용; `restore`는 이후 스냅샷을 무효화(문서화).
- Non-goals: CLI-001과 동일(프로덕션 key 관리, out/ ABI 커플링, 2차 web3 라이브러리).

## TOOLKIT-001 — Versioned Config Foundation

### Behavior

- 사용자가 자산 profile과 사용할 venue를 JSON 설정에서 선택한다.
- `schemaVersion`으로 설정 형식을 고정하고, 잘못된 profile·venue·operator 계정은
  배포 전에 fail-closed 검증한다.
- `services/toolkit`의 validator를 CLI가 재사용한다.
- `corner-store toolkit-init`과 `corner-store toolkit-validate`로 설정 생성·검증을
  같은 인터페이스에서 수행한다.
- `corner-store toolkit-simulate`로 artifact/profile/venue binding과 read-only 실행
  순서를 트랜잭션 전에 확인한다.
- `corner-store toolkit-preflight`로 실제 deployment artifact의 주소와 선택 profile,
  venue 구성을 mutation 전에 검증한다.
- `corner-store toolkit-onboard`가 같은 config를 preflight한 뒤에만 선택한 profile과
  venue를 manifest에 반영한다.
- `corner-store toolkit-checkpoint`가 config/artifact hash와 deployment state를
  secret-free immutable JSON으로 기록하고 기존 checkpoint 덮어쓰기를 거부한다.
- `corner-store toolkit-proposal`이 target/calldata/reason/artifact hash를 담은
  draft governance proposal만 생성하며 multisig 실행은 수행하지 않는다.
- draft proposal을 Safe-compatible transaction payload로 export할 수 있지만, Toolkit은
  서명·제출·승인 상태 변경을 수행하지 않는다.
- `corner-store toolkit-deploy`가 기존 `DeployStack.s.sol`을 config profile에 맞춰
  호출하며, 기본은 dry-run이고 `--broadcast`를 명시해야만 mutation한다.
- `corner-store toolkit-test`가 동일한 사용자 진입점에서 repository-wide
  `scripts/check.sh`를 실행한다.
- live Anvil E2E가 실제 deployment artifact에 대해 Toolkit preflight와 immutable
  checkpoint를 실행한 뒤 CLI onboarding/RFQ settlement를 수행한다.
- BUIDL-like와 Reg D profile별 Toolkit config fixture를 각각 검증한다.
- Toolkit config는 governance multisig alias와 required approval 수를 명시하며 private key나
  signer material은 포함하지 않는다.
- Element/Recipe/Adapter/provider 템플릿과 required input/trust-boundary 검증을
  제공해 확장 시 기존 compliance/router 경계를 복사하지 않도록 한다.
- private key를 받지 않는 read-only Operator API로 config/deployment snapshot과
  normalized event index를 제공한다.
- read-only Operator dashboard가 profile/venue/event snapshot을 표시하고,
  변경은 외부 multisig proposal 검토 후 실행하도록 경계를 둔다.
- Operator API가 local/demo in-memory index와 교체 가능한 file-backed event index를
  제공하며 마지막 block cursor를 보존한다.
- finality-aware indexer가 confirmation depth 이후 block만 저장하고 finalized block
  hash가 바뀌면 fail-closed로 중단한다.
- Operator API가 선택적 Bearer token 인증을 지원하며 health endpoint 외 조회를
  인증 없이 노출하지 않는다.
- `/metrics`가 요청 수·인증 실패·indexed event count를 Prometheus 형식으로
  노출하며 주소·token 값은 포함하지 않는다.
- Wave-2 illustrative elements는 기본 Foundry script discovery 경로 밖의
  `tools/deploy-wave2/DeployWave2Elements.s.sol`에서 opt-in으로 등록해 기본
  BUIDL-like/Reg D demo의 배포 범위와 컴파일 그래프를 보존한다.

### Verification

- `cd services/toolkit && npm test` (simulation/template/preflight mismatch 포함)
- `cd services/operator-api && npm test`
- `cd services/operator-dashboard && npm test`
- `cd services/cli && npm test`
- `scripts/check.sh`

### State

passing

### Scope

이번 단계에서 공통 설정 계약, validation/simulation, preflight/onboard/deploy/test,
checkpoint와 governance handoff, operator API/indexer 및 read-only dashboard까지
구현·검증했다. production TLS/secret rotation, 실제 multisig provider, live RPC
finality/recovery와 production RFQ custody는 별도 후속 feature다.

## OPS-001 — High-severity Solidity Lint Gate

### Behavior

- production Solidity source에 Foundry의 high-severity lint를 실행한다.
- high-severity warning이 하나라도 있으면 local repository check와 CI가 실패한다.
- test fixture의 medium/low 경고는 별도 warning-budget feature로 분리한다.
- venue bitmask는 명시적 `uint256(1)`을 사용해 shift operand 폭을 고정한다.

### Verification

- `forge lint --severity high --deny warnings src`
- `forge test --offline`
- `scripts/check.sh`

### State

passing

### Scope

새 정적 분석 의존성을 추가하지 않고 Foundry stable에 내장된 production lint만
fail-closed gate로 도입한다. Slither와 medium warning 정리는 후속 범위다.

## OPS-002 — Repository-wide CI Parity

### Behavior

- GitHub Actions가 local `scripts/check.sh`와 동일한 repository-wide gate를 실행한다.
- RFQ SDK, CLI, demo backend, Toolkit, Operator API/dashboard와 vendored deploy-v3가
  pull request마다 검증된다.
- npm 서비스는 각 lockfile을 cache key와 deterministic install에 사용한다.
- vendored deploy-v3는 자체 `yarn.lock`과 directory boundary 안에서만 설치·검증한다.

### Verification

- `scripts/check.sh`
- GitHub Actions `Run repository-wide checks`

### State

passing

### Scope

기존 local gate와 CI의 범위를 일치시킨다. live Anvil E2E는 별도 실행 비용과
환경 격리가 필요하므로 이 feature의 PR gate에는 포함하지 않는다.

## DOC-003 — Goal Completion and Operations Alignment

### Behavior

- ROADMAP이 이미 구현된 Toolkit, Operator API/dashboard와 profile별 live E2E를
  완료 상태로 기록하고 production 후속 범위와 구분한다.
- incident response가 현재의 asset/venue/maker containment 경로, 외부
  ERC-3643/ONCHAINID boundary와 multisig/timelock recovery gate를 따른다.
- 미구현 central pause, production custody/hosting/finality를 구현된 기능처럼
  표현하지 않는다.

### Verification

- `scripts/e2e-anvil.sh --profile buidl-like`
- `scripts/e2e-anvil.sh --profile reg-d`
- Markdown link와 `git diff --check` 검토

### State

passing

### Scope

문서 정합화와 운영 runbook만 추가한다. contract, API 또는 production 운영 정책은
변경하지 않는다.

## PROD-001 — Production Control Plane

### Behavior

- `OperatorRegistry`가 global, asset, venue pause의 단일 source of truth가 된다.
- operator는 위험을 즉시 중단할 수 있지만 unpause는 owner가 예약한 뒤 최소
  timelock이 지난 후에만 실행할 수 있다.
- `ExecutionRouter`는 compliance evaluation과 venue dispatch 전에 global, 양쪽
  asset, venue pause를 fail-closed로 검사한다.
- Manifest lifecycle은 현재 version, pending update, full manifest hash와
  append-only history hash를 보존한다.
- ACTIVE/SUSPENDED Manifest의 semantic update는 별도 pending proposal로 저장되고
  timelock 이후 승인되며, suspended asset을 update만으로 재개할 수 없다.
- lifecycle/pause 변경은 actor, old/new value, reasonCode/reasonHash와 effective time을
  event로 남긴다.

### Verification

- `forge fmt --check`
- `forge lint --severity high --deny warnings src`
- `forge test --offline --match-path test/unit/registry/OperatorRegistry.t.sol -vv`
- `forge test --offline --match-path test/unit/registry/TokenPolicyRegistry.t.sol -vv`
- `forge test --offline --match-path test/unit/execution/Router.t.sol -vv`
- `forge test --offline --match-path test/integration/EmergencyPause.t.sol -vv`
- `forge test --offline`
- `scripts/check.sh`

### State

passing

### Notes

- 완료 계획: `docs/exec-plans/completed/PROD-001-production-control-plane.md`
- governance owner는 외부 Safe-style multisig를 전제로 하며 컨트랙트 내부에
  n-of-m signer 로직을 구현하지 않는다.
- issuer disable, production multisig provider와 chain별 timelock 값은 후속 운영
  설정이며, 현재 manifest에 issuer identity가 없으므로 asset pause로 fail-closed한다.

## DATA-001 — Compliance Data Layer Foundation

### Behavior

- ADR-008의 Transfer Agent 경계를 provider-neutral TypeScript SDK로 제공한다.
- per-lot acquisition 입력은 lineage, 완납일과 freshness를 검증하고 보수적인
  holder×asset snapshot으로 컴파일한다.
- `Lockup`은 operator-attested snapshot의 상태와 만료를 fail-closed로 검사한다.
- 거절 시도와 router 밖 transfer finding은 PII 없이 hash-chain audit trail에
  append할 수 있다.
- person-group 단위 volume/holder state는 execution idempotency를 보장한다.
- 실제 Securitize API, WORM storage와 production surveillance hosting은 adapter
  교체 지점으로 남기며 구현되었다고 주장하지 않는다.

### Verification

- `forge fmt --check`
- `forge test --offline --match-path test/unit/compliance/AcquisitionSource.t.sol -vv`
- `forge test --offline --match-path test/unit/compliance/Elements.t.sol -vv`
- `cd services/compliance-data && npm test`
- `scripts/check.sh`

### State

passing

### Notes

- 완료 계획: `docs/exec-plans/completed/DATA-001-compliance-data-layer.md`
- 실제 Securitize/TA field mapping은 공식 API 계약이 제공될 때 별도 provider
  adapter로 구현한다.
- 단일 holder×asset snapshot은 모든 현재 lot 중 가장 늦은 clock을 사용하므로
  amount-specific lot allocation 전까지 일부 mature lot 매도를 보수적으로 막을 수 있다.

### Related Files

- `services/compliance-data/`
- `src/registry/AttestedAcquisitionSource.sol`
- `src/compliance/elements/Lockup.sol`
- `test/unit/compliance/AcquisitionSource.t.sol`

## MANIFEST-002 — RecipeBinding Manifest Migration

### Behavior

- 자산 Manifest는 고정 `issuanceRecipeId + fundRecipeId` 대신 bounded
  `RecipeBinding[]`를 registry에 저장한다.
- `REQUIRED_BLOCKING` Recipe는 AND, 같은 `pathGroupId`의 `PATH_OPTION`은 OR,
  서로 다른 path group은 AND로 평가한다.
- `FLAG_ONLY` 실패는 거래를 막지 않고 `ComplianceDecision.flagsBitmap`과 Router
  event로 노출한다.
- binding 변경은 full manifest hash 변경과 기존 timelock/version/history를 거친다.
- binding 수, recipe/version, path group과 duplicate 입력은 등록 시 fail-closed로
  검증한다.

### Verification

- RecipeBinding registry/lifecycle unit tests
- REQUIRED/PATH/FLAG engine regression tests
- pair-side, stateful commit와 Router event integration tests
- `scripts/check.sh`
- `buidl-like` / `reg-d` live E2E

### State

passing

### Notes

- 완료 계획: `docs/exec-plans/completed/MANIFEST-002-recipe-binding-migration.md`
- canonical `bytes32 recipeKey` alias와 per-element enforcement override compiler는
  별도 versioned refinement로 남긴다.

## AMM-001 — Canonical Uniswap v3 Pool E2E

### Behavior

- vendored `@uniswap/v3-core` artifact로 canonical factory/pool을 배포한다.
- CREATE2 예상 주소와 factory가 생성한 pool 주소가 일치해야 한다.
- 실제 pool을 verified ERC-3643 holder, venue와 adapter allowlist에 등록한다.
- 초기화·유동성 공급 후 `ExecutionRouter → UniswapV3Adapter → pool` exact-input
  swap이 실제 callback과 ERC-3643 transfer를 거쳐 성공한다.
- 미등록 pool/callback은 계속 fail-closed이고 Router/Adapter는 잔액을 보유하지 않는다.

### Verification

- canonical factory/pool deployment와 CREATE2 preflight integration test
- protected buy/sell, compliance rejection와 callback authorization tests
- `scripts/check.sh`

### State

passing

### Notes

- 완료 계획: `docs/exec-plans/completed/AMM-001-real-uniswap-v3-e2e.md`
- vendored Solidity source를 제품 `src/`로 복사하지 않는다.
- production fee-tier 승인, LP 운영 정책과 unified deploy CLI는 별도 후속 범위다.

## OPS-003 — Operator Deployment and Manifest Snapshot

### Behavior

- read-only Operator Dashboard가 배포 artifact의 execution/control-plane 주소를 표시한다.
- Demo onboarding 직후 Manifest status, version과 RecipeBinding 수를 snapshot으로 저장한다.
- Operator API가 snapshot을 `/api/v1/manifest`로 제공하고 Dashboard가 이를 표시한다.
- Dashboard, CLI와 RFQ backend가 연결된 local BUIDL-like walkthrough를 한 번에 실행할 수 있다.

### Verification

- `npm test --prefix services/operator-api`
- `npm test --prefix services/operator-dashboard`
- `npm test --prefix services/cli`
- `forge build --offline --jobs 1`
- `scripts/e2e-anvil.sh --profile buidl-like`
- `git diff --check`

### State

passing

### Notes

- snapshot은 demo/reference checkpoint이며 production indexer나 live RPC provider가 아니다.
- production Manifest lifecycle mutation과 governance action은 별도 범위다.

## DEMO-003 — Role-aware RFQ Compliance Walkthrough

### Behavior

- 헤더에서 Admin, 적격투자자 A/B와 비적격투자자 fixture를 전환한다.
- 사용자 RFQ 생성·수락 전에 현재 온체인 QP, maker 승인과 자산 정책을 pre-check한다.
- quote는 선택한 taker 지갑에 EIP-712로 binding되고 다른 지갑이 재사용할 수 없다.
- 비적격 사용자의 일반 quote 요청은 차단되며, 별도 proof action은 signed quote도
  Router의 최신 `ComplianceEngine` 검사에서 거부됨을 보여준다.
- Admin은 로컬 Anvil의 QP fixture와 maker 승인을 실제 트랜잭션으로 변경하고,
  체결·거부·정책 변경 내역을 조회한다.

### Verification

- `npm test --prefix services/rfq-demo-backend`
- `npm test --prefix services/operator-dashboard`
- `forge build --offline --force`
- `forge test --offline`
- `scripts/e2e-anvil.sh --profile buidl-like --mode rfq`
- `git diff --check`

### State

passing

### Notes

- 지갑 선택은 local demo persona이며 production authentication/custody가 아니다.
- pre-check는 UX용 사전 판단이고 최종 권한은 Router fill-time evaluation에 있다.

## DEMO-004 — Injectable Temporal RFQ Scenario

### Behavior

- 데모 자산 표시값, maker 이름, 지갑 persona, 초기 QP 상태, preview quote와
  freshness 시간 조건을 versioned scenario JSON으로 주입한다.
- 주소는 UI에 하드코딩하지 않고 fresh Anvil 배포 artifact와 scenario의
  `artifactKey` mapping으로 확인한다.
- `scripts/demo.sh --scenario <path>`와 E2E가 동일한 scenario를 사용한다.
- scenario 준비는 초기 QP 상태와 freshness cap을 실제 로컬 Anvil 트랜잭션으로
  기록한다.
- quote 발급 당시 적격이던 투자자의 QP claim만 만료시키고, 아직 유효한 동일
  signed quote가 Router의 fill-time 검사에서 거부되는 것을 보여준다.

### Verification

- `npm test --prefix services/rfq-demo-backend`
- `npm test --prefix services/operator-dashboard`
- `scripts/e2e-anvil.sh --profile buidl-like --mode rfq`
- `scripts/check.sh`
- `git diff --check`

### State

passing

### Notes

- scenario는 local deterministic fixture이며 실제 identity provider가 아니다.
- 임의 주소를 UI에서 가장하지 않는다. 거래 지갑은 배포 artifact와 일치하는
  funded Anvil signer여야 한다.

## DEMO-005 — Bidirectional RFQ Demo

### Behavior

- 매수는 taker의 결제 자산을 maker에게 보내고 maker의 ERC-3643 RWA를 받는다.
- 매도는 token pair를 반대로 binding해 taker의 RWA를 maker에게 보내고 maker의
  결제 자산을 받는다.
- scenario가 RWA와 결제 자산의 표시 정보/decimals를 주입하며 UI 주소나 자산
  symbol에 의존하지 않는다.
- 배포 fixture는 매수·매도를 어느 순서로 실행해도 되도록 양쪽 inventory와
  RFQAdapter allowance를 준비한다.
- Portfolio와 체결 결과는 RWA 및 결제 자산의 실제 온체인 증감량을 함께 표시한다.
- stateful commit은 RWA가 tokenOut이면 maker→taker, tokenIn이면 taker→maker로
  실제 regulated transfer 방향을 기록한다.

### Verification

- `forge test --offline --match-contract RFQFlowTest`
- `npm test --prefix services/rfq-demo-backend`
- `npm test --prefix services/operator-dashboard`
- `scripts/e2e-anvil.sh --profile buidl-like --mode rfq`
- `git diff --check`

### State

passing

### Notes

- RFQ 가격은 여전히 local demo fixed-rate provider이며 production pricing,
  inventory/risk engine과 multi-maker aggregation은 후속 범위다.
