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

## Blocked

- 없음

## Next

1. MVP RFQ demo backend milestone/user flow를 별도 문서·feature로 구체화한다.
   PR #29/#30이 머지되면 기존 live-Anvil E2E/CLI 경로를 재사용한다.
2. pending RFQ/E2E/CLI/BUIDL PR stack(#29/#30/#35)이 머지된 뒤
   roadmap과 feature 상태를 재조정한다.
3. 남은 RFQ production policy를 별도 feature로 분리한다: custody, partial fill,
   production dealer/operator 책임.
4. acquisition/lot data source와 holding-period Recipe 활성화 조건을 결정한다
   (C-01 Lockup은 현재 fixture-only mock acquisition source).
5. Order Book은 matching/custody/surveillance 모델 결정 후 구현한다.

## Last Session Summary

- #28 merge preparation includes RFQ protected-router integration scenarios on top of current main.
- RFQFlow integration now covers router → compliance → RFQAdapter settlement plus maker-unapproved, cancellation, non-compliant buyer, and direct-call bypass scenarios.
- RFQ-002, CMP-001, CMP-002, legacy gating, and RFQ-SDK records are preserved during this stacked merge reconciliation.
- 실행한 검증:
  - original PR CI/checks passed before retarget
  - conflict reconciliation checked with `git diff --check`
- 남은 리스크:
  - MVP HTTP/CLI backend는 아직 구현하지 않았다.
  - production signer custody, persistent nonce store, pricing, inventory/risk는 integrator/operator 책임이다.
  - C-01 Lockup은 fixture-only mock acquisition source에 의존한다.

## RFQ-002 Merge Note

- RFQ-002 hardening from PR #24 is included in this branch update: maker approval, maker nonce cancellation, venueType binding, and RFQ threat-model documentation.
- The deferred router-path maker-approval/cancellation integration coverage is completed by PR #28.
