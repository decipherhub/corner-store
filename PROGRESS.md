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
- `TOOLKIT-001 — Versioned Config Foundation`
- `OPS-001 — High-severity Solidity Lint Gate`
- `OPS-002 — Repository-wide CI Parity`
- `DOC-003 — Goal Completion and Operations Alignment`
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

## Blocked

- 없음

## Next

1. RFQ production policy를 별도 feature로 분리한다: custody, partial fill,
   production dealer/operator 책임.
2. acquisition/lot data source와 holding-period Recipe 활성화 조건을 결정한다
   (C-01 Lockup은 현재 fixture-only mock acquisition source).
3. 실제 Uniswap v3 pool 배포를 demo/E2E에 연결한다(현재 AMM venue는 MockPool;
   `tools/deploy-v3` vendor isolation 유지).
4. Order Book은 matching/custody/surveillance 모델 결정 후 구현한다.
5. production 환경의 TLS, secret rotation, 실제 multisig provider와 live RPC
   finality/recovery 정책을 별도 운영 feature로 구체화한다.

## Last Session Summary

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
- production signer custody, persistent nonce, pricing/inventory와 hosting은 범위 밖이며
  최종 compliance는 Router fill 시점에 유지한다.
- `scripts/check.sh` 통과: Foundry 248/248, RFQ SDK, CLI/backend smoke, deploy-v3.
- 기존 Foundry `1.4.0-nightly` build cache의 constructor decode 오류는
  Foundry v1.7.1 clean rebuild로 해소했고, 실제 protected Router walkthrough를 완료했다.
- Toolkit 통합 후 `scripts/e2e-anvil.sh --profile buidl-like`와 `--profile reg-d`가
  각각 실제 artifact preflight와 immutable checkpoint, 7/7 scenario, CLI/backend
  RFQ success와 revoked-maker failure를 통과했다.
- Toolkit config에 governance multisig alias와 required approval 수를 명시하고,
  signer material은 설정에서 제외했다.
