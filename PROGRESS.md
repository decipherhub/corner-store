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

## Blocked

- 없음

## Next

1. acquisition/lot data source와 holding-period Recipe 활성화 조건을 결정한다
   (C-01 Lockup은 현재 fixture-only mock acquisition source).
2. live Anvil deployment/E2E를 추가한다.
3. Order Book은 matching/custody/surveillance 모델 결정 후 구현한다.
4. CI hardening(static analysis 등)을 강화한다.

## Last Session Summary

- CMP-002 (Manifest Lifecycle & Operator Approval Flow)을 landing했다. Task 1
  (registry state machine)에 이어 Task 2에서 engine fail-open을 닫고 factory/seam
  finalization, 통합 시나리오, bookkeeping을 완료했다.
- 변경한 파일:
  - product: `src/compliance/ComplianceEngine.sol`(evaluate positive-allowlist
    default-deny + commit 주석), `src/registry/TokenPolicyRegistry.sol` +
    `src/interfaces/compliance/ITokenPolicyRegistry.sol`(clearUnregulated),
    `src/factory/CornerStoreFactory.sol`(register→approve natspec)
  - test: `test/unit/compliance/Engine.t.sol`(신규 4 default-deny),
    `test/unit/registry/TokenPolicyRegistry.t.sol`(신규 8 clearUnregulated+auth),
    `test/integration/EmergencyPause.t.sol`(신규 3 router E2E),
    `test/integration/IntegrationBase.sol`/`Surveillance.t.sol`(seam 정리)
  - bookkeeping: `DECISIONS.md`(D009), `FEATURES.md`(CMP-002), `PROGRESS.md`
  - Task 1(앞선 커밋): `src/types/ComplianceTypes.sol`(enum append),
    `src/libraries/Errors.sol`(InvalidManifestTransition), registry state machine
- TDD: engine 4개 default-deny 테스트가 먼저 RED로 오늘의 fail-open(PROPOSED/
  RETIRED × UNREGULATED/ACTIVE가 allowed=true)을 증명한 뒤 positive-allowlist로
  GREEN 전환.
- 실행한 명령:
  - `forge fmt`
  - `forge test --offline`
- 통과한 검증:
  - `forge test --offline` 227/227(pre-task 212 + 신규 15).
  - engine default-deny(양방향 ordering 포함), registry clearUnregulated +
    onlyOwner-vs-onlyOperator auth, 통합 PROPOSED/RETIRED reject + suspend→resume
    재거래.
- 남은 리스크:
  - ungated legacy mock element(A-01/A-03/QP)와 새 operator-gated element 사이
    hardening divergence — follow-up으로 정렬(CMP-001 deferred).
  - C-01 Lockup은 fixture-only mock acquisition source에 의존; production
    acquisition/lot data source와 holding-period 활성화 default는 미결정.
  - production data source(OFAC/ONCHAINID/ERC-165/EDGAR) 연결과 legal 활성화는
    approval-gated로 열려 있다.
  - engine은 direction-aware가 아니다(기존 문서화된 concern).
  - production onboarding governance key management(factory ownership/multisig)는
    미결정.
