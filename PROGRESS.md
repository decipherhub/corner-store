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

## Last Session Summary

- #35 merge preparation includes `DEMO-001 — BUIDL-like ERC-3643 Demo Asset` on top of current main.
- 변경한 파일:
  - `src/demo/BuidlLikeDemoAsset.sol`
  - `src/compliance/elements/BuidlMinimumInvestment.sol`
  - `src/compliance/recipes/BuidlLikeFundRecipe.sol`
  - `test/fixtures/MockSecuritizeTA.sol`
  - `test/integration/IntegrationBase.sol`
  - `test/integration/BUIDLLikeFlow.t.sol`
  - `docs/product-specs/buidl-like-demo-profile.md`
  - `FEATURES.md`, `PROGRESS.md`
- 완료한 작업:
  - BUIDL-like ERC-3643 demo asset profile 추가
  - Mock Securitize/TA fixture로 investor facts를 주입하고 Element flags로 sync
  - QP/minimum investment/sanctions/expiry/ERC-3643 recipient verification 시나리오 추가
  - 최신 Manifest lifecycle에 맞춰 BUIDL-like manifest도 register→approve flow로 정합화
- 실행한 검증:
  - original PR CI/checks passed before retarget
  - conflict reconciliation checked with `git diff --check`
- 남은 리스크:
  - 실제 BlackRock BUIDL/Securitize/TA 연결은 구현 범위가 아니다.
  - AI/QP는 아직 production ONCHAINID claim이 아니라 mock TA에서 sync되는 test flag다.
  - NAV, redemption rail, monthly distribution, production claim issuer 연동은 별도 feature다.
