# Progress

## Current Status

저장소는 SDK/reference DEX 아키텍처·개발 계획 문서, Foundry product scaffold,
reference execution contracts와 vendored Uniswap v3 배포 도구를 포함한다.

공식 문서는 DEX-level compliance SDK, Corner Store reference DEX,
Element/Recipe/Manifest/Operator 4-Layer와 cumulative multi-Recipe 모델을
source of truth로 사용한다.

## Active Feature

- 없음

## Completed

- `HE-001 — Harness Baseline`
- `DOC-001 — Imported Architecture Alignment`
- `FND-001 — Foundry Product Foundation`
- `RFQ-001 — Reference RFQ Settlement`
- `RFQ-002 — RFQ v2 Hardening`
- `CMP-001 — Reg D 506(c) 9-element Recipe`(illustrative element library + recipe
  9-element 확장, version 2)
- `CMP-002 — Manifest Lifecycle & Operator Approval Flow`(validated state machine,
  setStatus 제거, engine positive-allowlist default-deny, clearUnregulated,
  factory register→approve)
- multi-venue 아키텍처와 책임 문서 작성
- Corner Store용 Uniswap v3 최소 배포 profile 분리와 테스트
- ExecutionRouter/VenueRegistry/VenueSelector와 AMM reference adapter skeleton
- router now rejects requests whose `context.venueType` mismatches the registered
  `VenueConfig.venueType` (closes the PR-12 review medium finding)
- RFQ-002: operator-curated maker approval allowlist(`setMakerApproved`,
  `RFQMakerNotApproved`), maker-initiated nonce-scoped idempotent cancellation
  (`cancelQuoteNonce`/`cancelQuoteNonces`, `RFQQuoteCancelled`), venueType binding
  fix, `docs/rfq-threat-model.md` 위협 모델과 D007 결정 기록
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

## Blocked

- 없음

## Next

1. acquisition/lot data source와 holding-period Recipe 활성화 조건을 결정한다
   (C-01 Lockup은 현재 fixture-only mock acquisition source).
2. 실제 Uniswap v3 pool 배포를 demo/E2E에 연결한다(현재 AMM venue는 MockPool;
   `tools/deploy-v3` vendor isolation 유지).
3. Order Book은 matching/custody/surveillance 모델 결정 후 구현한다.
4. CI hardening(static analysis 등)을 강화한다.

## Last Session Summary

- `E2E-001` (Live Anvil E2E & Demo Runner)을 landing했다. src/ 변경 없이 forge
  script 두 개 + 셸 러너 + T-REX 배포 코어 추출로 live-Anvil E2E/demo를 구현했다.
- 변경한 파일:
  - script: `script/DeployStack.s.sol`(전체 스택 live 배포 + JSON artifact),
    `script/DemoScenarios.s.sol`(7-scenario 러너), `script/DemoConstants.sol`(공유
    상수)
  - runner: `scripts/e2e-anvil.sh`(anvil 기동/배포/scenario/teardown, `--port`/
    `--keep`, offline)
  - fixture refactor: `test/fixtures/TREXCore.sol`(신규, `is CommonBase`,
    admin-parameterized, prank-free) + `test/fixtures/TREXSuite.sol`(thin facade
    `is Test, TREXCore`) — test suite green 유지
  - config: `foundry.toml`(fs_permissions read-write, JSON artifact),
    `.gitignore`(`deployments/`)
  - docs: `docs/demo.md`(runbook), `docs/testing.md`(E2E 섹션), `docs/README.md`
  - bookkeeping: `FEATURES.md`(E2E-001), `PROGRESS.md`
- 설계 요점:
  - broadcast(pk)로 persist해야 하는 상태 전이/거래를, prank(addr)+try/catch로
    revert 기대 시나리오(compliance/policy/authz 거부)를 구동. reason code는
    off-chain 재계산 후 revert data와 비교.
  - onboarding은 scenario 1에서 factory가 수행하도록 deploy 시 manifest를 UNKNOWN로
    남기고 policyReg/venueReg 소유권을 factory로 이전, deployer는 policyReg operator로
    남겨 lifecycle(suspend/resume/retire) 구동 가능하게 함.
  - anvil genesis timestamp가 실제 wall-clock이라 C-01 Rule 144 lockup(t=1 seed)이
    on-chain에서 자연 통과 → vm.warp 불필요.
- 실행한 명령:
  - `forge fmt` / `forge fmt --check`
  - `forge test --offline`
  - `scripts/e2e-anvil.sh`(fresh + repeat, `--keep`)
- 통과한 검증:
  - `forge test --offline` 238/238(TREXCore 추출 후에도 green).
  - `scripts/e2e-anvil.sh` 2회 실행 모두 7/7 PASS, exit 0. `--keep`로 anvil 잔존 확인.
- 남은 리스크:
  - AMM venue는 MockPool(1:1); 실제 Uniswap v3 pool 배포는 별도 follow-up(vendor
    isolation). demo는 `tools/deploy-v3`에 의존하지 않는다.
  - C-01 Lockup은 fixture/demo mock acquisition source에 의존; production
    acquisition/lot data source와 holding-period 활성화 default는 미결정.
  - production data source(OFAC/ONCHAINID/ERC-165/EDGAR) 연결과 legal 활성화는
    approval-gated로 열려 있다.
  - engine은 direction-aware가 아니다(기존 문서화된 concern).
  - production onboarding governance key management(factory ownership/multisig)는
    미결정.
