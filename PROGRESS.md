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
- `CMP-003 — Wave-2 Illustrative Elements`(A-08 EntityEligibility, A-09
  EquityOwnerLookThrough, A-11 ClaimFreshness, B-03 TransferRestrictionMetadata,
  B-04 EngineSelection, D-01 HolderCount 6개 mock element + 전용 unit test):
  `script/DeployStack.s.sol`에 전부 등록(A-09 → A-08 생성자 주입, D-01은
  A-04/A-03 주소 + `CapMode.TWELVE_G`로 생성 후 engine 생성 이후 `setEngine`).
  어떤 recipe의 `requiredElements`에도 연결하지 않음(별도 feature로 이연).
  `forge test --offline` 399/399 유지.
- `CMP-004 — Wave-2b In-Place Element Upgrades + CLI Decode`(A-01 Sanctions,
  A-03 AccreditedInvestor, A-04 IdentityUniqueness, A-13 QualifiedPurchaser,
  B-01 AssetClassification, B-02 Erc3643Native를 동일 ID·배선을 유지한 채
  walkthrough-doc 실패코드 taxonomy로 in-place 업그레이드, legacy setter
  호환·신규 strictness는 opt-in default-off; `services/cli/src/reason.ts`
  decode table을 신규 code range + 누락됐던 wave-2 6개 element로 확장하고
  recipeId 0(element 직접 self-encode) 축을 추가):
  `forge test --offline` 579/579, `services/cli`/`services/rfq` npm test
  통과.

## Blocked

- 없음

## Next

1. MVP RFQ demo backend milestone/user flow를 별도 문서·feature로 구체화한다.
   기존 live-Anvil E2E/CLI 경로를 재사용한다.
2. pending PR stack 정리 후 roadmap과 feature 상태를 재조정한다.
3. 남은 RFQ production policy를 별도 feature로 분리한다: custody, partial fill,
   production dealer/operator 책임.
4. acquisition/lot data source와 holding-period Recipe 활성화 조건을 결정한다
   (C-01 Lockup은 현재 fixture-only mock acquisition source).
5. 실제 Uniswap v3 pool 배포를 demo/E2E에 연결한다(현재 AMM venue는 MockPool;
   `tools/deploy-v3` vendor isolation 유지).
6. Order Book은 matching/custody/surveillance 모델 결정 후 구현한다.
7. CMP-003의 6개 wave-2 element(A-08/A-09/A-11/B-03/B-04/D-01)를 실제 recipe
   `requiredElements`에 연결할지, 연결한다면 어떤 recipe에 붙일지 결정한다.
8. `ComplianceEngine._runChecks`가 실패한 element의 실제 reasonCode 대신 항상
   code 1로 재-encode하는 한계(CMP-004에서 확인)를 해소할지 결정한다 — richer
   per-element propagation을 엔진에 배선하면 CLI/off-chain audit가 recipe-scoped
   경로에서도 신규 실패코드(A-01 code 2-10 등)를 직접 관측할 수 있다.

## Last Session Summary

- `CMP-004 — Wave-2b In-Place Element Upgrades + CLI Decode` (U7 integration
  task, `feat/element-upgrades` branch): 6개 element(A-01/A-03/A-04/A-13/B-01/
  B-02) 자체의 walkthrough-doc 업그레이드는 이전 세션들(U1-U6, 커밋
  `a99f4ae`..`5a36111`)에서 이미 완료돼 있었고, 이번 세션은 그 위에 CLI decode
  table 확장 + 통합 문서화 + 전체 회귀 검증을 수행했다.
- 변경한 파일:
  - `services/cli/src/reason.ts`
  - `services/cli/test/smoke.ts`
  - `FEATURES.md`, `PROGRESS.md`
- 완료한 작업:
  - `reason.ts`에 6개 업그레이드 element의 신규 code range를 각 contract
    헤더 doc-name으로 채운 `ELEMENT_CODE_NAMES` 테이블 추가.
  - `ELEMENT_LABELS`에서 누락돼 있던 wave-2(CMP-003) 6개 element(A-08/A-09/
    A-11/B-03/B-04/D-01)를 등록해 `DeployStack`이 실제 등록하는 17개 element
    전체와 일치시킴(이전 주석의 "11개 element"는 stale이었음).
  - 코드 추적 결과 `ComplianceEngine._runChecks`가 실패 시 항상 code 1로
    재-encode함을 확인 — recipe-scoped(`{1,2,7}`) 조합에서 code 2+ 는 오늘
    실제로 도달 불가능하다. 반면 모든 element의 `check()`는 스스로
    `ReasonCodes.encode(0, ELEMENT_ID, n)`으로 self-encode하고(D-01
    HolderCount는 이 값으로 직접 revert), 이것이 신규 code들이 실제로 관측되는
    경로다. 그래서 recipeId 0 축(element 직접 코드)을 테이블에 별도로
    추가했다 — 기존 recipe-scoped 축(code 1만, audit-matching 용도)은 그대로 유지.
  - `smoke.ts`의 reason-table 크기 회귀를 `4 * 86 + 6 = 350`으로 갱신하고,
    `cast keccak`로 독립 검증한 신규 ground-truth(A-01 direct code 4, D-01
    direct code 3) decode 회귀와 A-01 code 1 legacy 의미 보존 회귀를 추가.
  - `script/DeployStack.s.sol`(KYC/investor-setup 헬퍼)과
    `test/integration/IntegrationBase.sol`(9-element attestation 헬퍼)이
    legacy setter 시그니처 그대로 호출됨을 확인 — 코드 변경 없음.
    `scripts/e2e-anvil.sh`는 CLI를 전혀 호출하지 않으므로(순수
    `DeployStack`/`DemoScenarios` forge script 구동) 이번 변경과 무관함을 확인.
- 실행한 검증:
  - `forge build --offline`
  - `forge test --offline`: 39 suites, 579 passed, 0 failed, 0 skipped
  - `cd services/cli && npm test`
  - `cd services/rfq && npm test`
  - `forge fmt` 대상 없음(.sol 변경 없음)
- 남은 리스크:
  - `ComplianceEngine`의 code-1 하드코딩(위 참고)은 이번 세션에서 고치지
    않았다 — 엔진 파일 편집은 이 wave의 범위 밖. richer per-element
    propagation을 원한다면 별도 feature로 분리해야 한다(Next #8).
  - CMP-003의 wave-2 6개 element는 여전히 어떤 recipe에도 연결돼 있지 않다
    (Next #7, 변경 없음).
