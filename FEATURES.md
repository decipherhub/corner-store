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

- 정책 결정: D007(maker approval adapter-local, full-fill, non-custodial,
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

### State

passing

### Notes

- 정책 결정: D008(9-element in-place 확장, operator-gated setter, Lockup은
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

### State

passing

### Notes

- 정책 결정: D009(lifecycle state machine, enum-append, setStatus 제거, engine
  positive-allowlist default-deny, clearUnregulated correction path, declaredBy=
  msg.sender와 factory consequence).
- Non-goals: direction-aware element application, production onboarding governance
  key management.
