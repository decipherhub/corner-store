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

## CLI-001 — corner-store Reference CLI

### Behavior

- `services/cli/`에 TypeScript CLI(`corner-store`)를 추가해, forge 스크립트를 직접
  다루지 않고 터미널에서 live 노드 대상으로 전체 스택을 구동한다: onboarding,
  attestation, manifest lifecycle, AMM/RFQ 거래, reason-code 디코딩. 기대 환경은
  Anvil E2E 배포(`scripts/e2e-anvil.sh --keep` + `deployments/anvil-e2e.json`).
- 명령: `status`(주소/manifest/venue/per-element attestation 상태, `--json`),
  `onboard`(factory 1-call, ACTIVE면 retire→register→approve),
  `manifest <status|suspend|resume|retire>`, `attest <element> <subject> [value...]`
  (9개 element setter), `investor-setup <addr>`(Reg D happy-path attestation +
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
  (PASS, +200 RWA) → `maker revoke` → `buy --venue rfq`(FAIL, `RFQMakerNotApproved`).
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

## CMP-003 — Wave-2 Illustrative Elements (A-08/A-09/A-11/B-03/B-04/D-01)

### Behavior

- 6개의 신규 illustrative mock element를 element library에 추가한다: A-08
  EntityEligibility(entity-level AI/QP 자격 판정, look-through consumer), A-09
  EquityOwnerLookThrough(recursive ownership-graph 결과 기록,
  `ILookThroughSource` 구현), A-11 ClaimFreshness(AI/QP claim의
  verifiedAt/issuerExpiry freshness gate), B-03 TransferRestrictionMetadata
  (asset-side 양도제한 legend 선언의 완전성/일관성 검사), B-04
  EngineSelection(trade-context 기반 허용 execution engine 게이트;
  `ComplianceContext`를 디코딩하는 유일한 element), D-01 HolderCount(STATEFUL;
  §12(g)/§3(c)(1)/506(b) holder-count cap).
- 각 element는 기존 illustrative library와 동일한 패턴을 따른다:
  `BaseElement`(D-01은 `BaseStatefulElement`) + operator-gated attestation
  setter + 전용 Foundry unit test.
- `script/DeployStack.s.sol`이 6개 element 전부를 `ElementRegistry`에 등록한다:
  A-09를 먼저 배포해 그 주소를 A-08 생성자에 `ILookThroughSource`로 주입하고,
  D-01은 A-04(IdentityUniqueness)/A-03(AccreditedInvestor) 주소와
  `CapMode.TWELVE_G`로 생성한 뒤 engine 생성 이후 `setEngine`으로 post-trade
  write path를 연결한다(F-02 SurveillanceFlag와 동일 패턴).
- 이 wave는 element library 확장에 한정된다: 어떤 recipe의
  `requiredElements`에도 연결하지 않는다(recipe 부착은 별도 feature).

### Verification

- 개별 unit test: `test/unit/compliance/elements/{EntityEligibility,
  EquityOwnerLookThrough,ClaimFreshness,TransferRestrictionMetadata,
  EngineSelection,HolderCount}.t.sol`.
- `forge build --offline`.
- `forge test --offline`(전체 399/399 유지; `DeployStack.s.sol`은 forge test
  경로에서 실행되지 않으므로 등록 변경으로 인한 기존 test 회귀 없음).
- `forge fmt script/DeployStack.s.sol`.

### State

passing

### Notes

- Non-goals: 이번 wave의 recipe/manifest 연결(어떤 recipe도 새 element를
  요구하지 않음), production legal 활성화, look-through graph 실제 순회.
- Deferred follow-up: 6개 element를 실제 recipe(`requiredElements`)에 연결할지,
  연결한다면 어떤 recipe에 붙일지는 별도 feature에서 결정한다.

## CMP-004 — Wave-2b In-Place Element Upgrades (A-01/A-03/A-04/A-13/B-01/B-02) + CLI Decode

### Behavior

- 기존 6개 illustrative mock element — A-01 Sanctions, A-03 AccreditedInvestor,
  A-04 IdentityUniqueness, A-13 QualifiedPurchaser, B-01 AssetClassification,
  B-02 Erc3643Native — 를 동일 contract 파일·registry ID·recipe 배선을 유지한
  채 각 element walkthrough 문서의 전체 실패코드 taxonomy로 in-place
  업그레이드했다: A-01 10개, A-03/A-04/A-13 각 9개, B-01/B-02 각 6개
  reasonCode(`ReasonCodes.encode(0, ELEMENT_ID, n)`, n -> doc §6.x 이름 —
  각 contract 헤더 주석 테이블 참고).
- 호환성 규칙(non-negotiable): 기존 operator setter —
  `Sanctions.setBlocked`, `AccreditedInvestor.setAccredited`,
  `IdentityUniqueness.bindIdentity`, `QualifiedPurchaser.setQp`,
  `AssetClassification.setClassification`, `Erc3643Native.setErc3643Native`
  — 는 시그니처와 legacy happy-path 효과(그 호출만으로 `check` PASS)를
  그대로 유지한다: 각 setter가 내부적으로 완전히 유효한
  claim/card(trusted issuer, valid signature, no expiry)를 대신 기록한다.
- 새로 추가된 strictness(claim pipeline, look-through 게이트, 시간/신선도
  경계, B-02 live-wiring 등)는 전부 operator-gated opt-in이며 기본값
  off(`false`/`0`)다 — 이 config를 건드리지 않는 기존 흐름은 legacy 동작
  그대로 유지된다.
- `services/cli/src/reason.ts`의 reason-code decode table을 확장했다:
  - 업그레이드된 6개 element의 신규 code range를 각 contract 헤더의
    doc-name으로 채운 `ELEMENT_CODE_NAMES` 테이블을 추가(예: A-01 code 4 ->
    `FAIL_NO_SANCTIONS_CLAIM`).
  - `ELEMENT_LABELS`에서 누락돼 있던 wave-2(CMP-003) 6개 element(A-08 1-8,
    A-09 1-2, A-11 1-5, B-03 1-6, B-04 1-7, D-01 1-4)도 등록해
    `DeployStack`이 실제로 등록하는 17개 element 전체와 맞췄다(이전 주석은
    "11개 element"라고 잘못 명시하고 있었음).
  - 신규 code가 없는 5개 element(A-02/A-05/C-01/E-01/F-02)는 기존처럼
    code 1 fallback을 유지한다.
  - **recipeId 축 추가**: `ComplianceEngine._runChecks`는 실패 시 항상
    `encode(contributingRecipe[i], elementId, 1)`로 code를 1로 재-encode
    하므로(엔진 코드 미변경 범위), recipe-scoped(`{1,2,7}`) 조합에서 실제로
    도달 가능한 code는 여전히 1뿐이다. 반면 각 element의 `check()`는 항상
    `ReasonCodes.encode(0, ELEMENT_ID, n)`으로 스스로를 self-encode하며(실제
    상세 코드가 나타나는 지점), D-01 HolderCount의 `onTransfer`는 이 값으로
    직접 `Errors.ComplianceRejected`를 revert한다. 따라서 recipeId 0 축을
    별도로 추가해(엔진과 무관하게 element 직접 호출·revert·이벤트에서 실제로
    관측되는 값) 신규 code들이 실질적으로 디코딩되도록 했다(기존 recipeId
    `{1,2,7}` 축도 audit-matching 용도로 유지, code 범위만 확장).

### Verification

- `forge build --offline`.
- `forge test --offline`: 39 suites, 579 passed, 0 failed, 0 skipped(레거시
  `test/unit/compliance/Elements.t.sol`의 Sanctions/AccreditedInvestor/
  QualifiedPurchaser 케이스 불변 + 각 element 전용
  `test/unit/compliance/elements/{Sanctions,AccreditedInvestor,
  IdentityUniqueness,QualifiedPurchaser,AssetClassification,
  Erc3643Native}.t.sol`에 신규 code·경계 테스트 다수 추가 — 개별 U1-U6
  커밋에서 이미 작성·통과).
- `cd services/cli && npm test`: reason-table 크기 회귀를
  `4 * 86(elements 코드 합) + 6(policy)` = 350으로 갱신하고, `cast keccak`로
  독립 검증한 신규 ground-truth(A-01 direct code 4, D-01 direct code 3)
  decode 회귀 및 A-01 code 1 legacy 의미 보존 회귀를 추가.
- `cd services/rfq && npm test`.
- 수동 확인(코드 변경 없음): `script/DeployStack.s.sol`의 KYC/investor-setup
  헬퍼(`setClassification`, `setErc3643Native`, `bindIdentity`,
  `setAccredited`)와 `test/integration/IntegrationBase.sol`의 9-element
  attestation 헬퍼(`setAccredited`/`setQp`/`setBlocked`/`bindIdentity`)가
  legacy 시그니처 그대로 호출됨을 확인; `scripts/e2e-anvil.sh`는 CLI를
  전혀 호출하지 않고 `DeployStack`/`DemoScenarios` forge script만
  구동하므로 이번 CLI 변경과 무관함을 확인.

### State

passing

### Notes

- Non-goals: 이번 entry는 U1-U6에서 이미 완료된 6개 element 자체의 스펙
  변경(claim pipeline, look-through 등, 커밋 `a99f4ae`..`5a36111`)을 다시
  구현하지 않는다 — CLI decode table 확장과 통합 문서화·전체 검증에
  한정된다.
- `ComplianceEngine`의 코드-1 하드코딩(재-encode) 자체는 엔진 파일 편집 금지
  범위 밖이라 이번 wave에서 고치지 않았다 — richer per-element propagation은
  별도 feature로 이연.
- Deferred follow-up: CMP-003과 동일하게 wave-2 6개 element의 recipe 연결
  여부는 미결.
