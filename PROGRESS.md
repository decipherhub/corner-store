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
- `DOC-002 — RFQ SDK and MVP Demo Planning`
- multi-venue 아키텍처와 책임 문서 작성
- Corner Store용 Uniswap v3 최소 배포 profile 분리와 테스트
- ExecutionRouter/VenueRegistry/VenueSelector와 AMM reference adapter skeleton

## Blocked

- 없음

## Next

1. RFQ backend SDK interface를 구현한다: signer, nonce store, pricing provider,
   validation과 local reference example.
2. MVP RFQ demo backend milestone/user flow를 별도 문서·feature로 구체화한다.
   PR #29/#30이 머지되면 기존 live-Anvil E2E/CLI 경로를 재사용한다.
3. pending RFQ/E2E/CLI/BUIDL PR stack(#24/#28/#29/#30/#35)이 머지된 뒤
   roadmap과 feature 상태를 재조정한다.
4. 남은 RFQ production policy를 별도 feature로 분리한다: custody, partial fill,
   production dealer/operator 책임.
5. production Asset Compliance Manifest lifecycle/schema와 operator approval flow를
   구현한다.
6. acquisition/lot data source와 holding-period Recipe 활성화 조건을 결정한다.
7. Order Book은 matching/custody/surveillance 모델 결정 후 구현한다.

## Last Session Summary

- 변경한 파일:
  - `docs/product-specs/rfq-backend-sdk-and-demo.md`
  - `docs/product-specs/index.md`
  - `docs/ROADMAP.md`
  - `FEATURES.md`
  - `PROGRESS.md`
- 완료한 작업:
  - RFQ backend를 production server 제공이 아니라 SDK + local reference example + 후속 MVP demo backend로 분리한 계획 문서 추가
  - RFQ SDK interface, local reference example, MVP demo backend의 단계별 deliverable과 non-goal 정리
  - roadmap near-term issue 순서에 RFQ SDK와 MVP demo backend planning을 추가
  - product-spec index에 RFQ backend SDK/demo 계획 문서 등록
  - 열린 PR #24/#28/#29/#30/#35를 RFQ SDK/MVP backend 계획의 pending upstream context로 반영
  - 전반 문서 점검 결과를 RFQ planning 문서에 기록
- 실행한 검증:
  - product-spec index, ROADMAP, RFQ venue architecture, FEATURES, PROGRESS 교차 검토
  - `git diff --check`
- 남은 리스크:
  - 아직 `services/rfq` 구현 변경은 하지 않았다.
  - MVP demo backend의 HTTP/CLI/UI 선택은 후속 문서·feature에서 정하되, PR #29/#30이 머지되면 기존 E2E/CLI 경로를 재사용해야 한다.
  - production RFQ dealer approval, custody, cancellation, partial fill은 별도 hardening track이다.
