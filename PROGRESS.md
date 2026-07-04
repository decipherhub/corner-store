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
- multi-venue 아키텍처와 책임 문서 작성
- Corner Store용 Uniswap v3 최소 배포 profile 분리와 테스트
- ExecutionRouter/VenueRegistry/VenueSelector와 AMM reference adapter skeleton
- router now rejects requests whose `context.venueType` mismatches the registered
  `VenueConfig.venueType` (closes the PR-12 review medium finding)
- RFQ-002: operator-curated maker approval allowlist(`setMakerApproved`,
  `RFQMakerNotApproved`), maker-initiated nonce-scoped idempotent cancellation
  (`cancelQuoteNonce`/`cancelQuoteNonces`, `RFQQuoteCancelled`), venueType binding
  fix, `docs/rfq-threat-model.md` 위협 모델과 D007 결정 기록

## Blocked

- 없음

## Next

1. Compliance module buildout을 최우선으로 진행한다(사용자/steering 결정):
   reference Reg D 506(c) set을 향한 Element library → Recipe 확장 → Manifest
   lifecycle/operator approval flow.
2. RFQ integration-test 시나리오(router-path maker-approval/cancellation coverage)를
   추가한다 — 이번 feature에서 deferred된 follow-up.
3. acquisition/lot data source와 holding-period Recipe 활성화 조건을 결정한다.
4. live Anvil deployment/E2E를 추가한다.
5. Order Book은 matching/custody/surveillance 모델 결정 후 구현한다.
6. CI hardening(static analysis 등)을 강화한다.

## Last Session Summary

- 변경한 파일(docs/bookkeeping only, 이번 세션):
  - `docs/rfq-threat-model.md`(신규 위협 모델)
  - `docs/security.md`(RFQ Safety에 위협 모델 링크)
  - `docs/README.md`(doc index 항목)
  - `DECISIONS.md`(D007), `FEATURES.md`(RFQ-002), `PROGRESS.md`
- 앞선 코드 세션(RFQ-002)에서 landed:
  - RFQAdapter maker approval gate(`setMakerApproved`, `approvedMaker`,
    `RFQMakerNotApproved`), maker-initiated cancellation(`cancelQuoteNonce`,
    `cancelQuoteNonces`, `RFQQuoteCancelled`), router venueType binding fix
  - RFQAdapter/Router Foundry tests(9 RFQ + 1 router venueType)
- 실행한 명령:
  - `forge fmt`
  - `forge test --offline`
  - `cd services/rfq && npm test`
- 통과한 검증:
  - `forge test --offline` 133/133 유지(이번 task는 코드 변경 없음)
  - RFQ service smoke check
  - `docs/rfq-threat-model.md` 존재와 링크 무결성
- 남은 리스크:
  - signer key custody와 operator key management(multisig/HSM/rotation)은 open
    decision이다.
  - partial fill, dealer inventory, shared dealer registry는 범위 밖이다.
  - cancel-vs-fill race는 first-lander로 해소되며 cancel은 확정 전까지 best-effort다.
  - RFQ router-path integration-test 시나리오는 deferred follow-up이다.
