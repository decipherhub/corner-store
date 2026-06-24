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
- multi-venue 아키텍처와 책임 문서 작성
- Corner Store용 Uniswap v3 최소 배포 profile 분리와 테스트
- ExecutionRouter/VenueRegistry/VenueSelector와 AMM reference adapter skeleton

## Blocked

- 없음

## Next

1. RFQ production hardening은 별도 feature로 분리한다: dealer/operator approval,
   custody, quote cancellation, partial fill 정책.
2. production Asset Compliance Manifest lifecycle/schema와 operator approval flow를
   구현한다.
3. acquisition/lot data source와 holding-period Recipe 활성화 조건을 결정한다.
4. live Anvil deployment/E2E와 security threat model을 추가한다.
5. Order Book은 matching/custody/surveillance 모델 결정 후 구현한다.

## Last Session Summary

- 변경한 파일:
  - RFQAdapter, RFQQuote type, RFQ-specific errors
  - RFQAdapter Foundry tests
  - `services/rfq` 최소 TypeScript quote signer reference
  - RFQ v1 scope/non-goals 문서
- 실행한 명령:
  - `forge build`
  - `forge test --offline --match-path test/unit/execution/RFQAdapter.t.sol -vv`
  - `cd services/rfq && npm test`
  - `git diff --check`
  - `scripts/check.sh`
- 통과한 검증:
  - RFQAdapter compile
  - valid signed quote settlement
  - invalid signature, expired quote, replay, wrong taker, mismatch, direct bypass,
    compliance rejection 거부
  - RFQ service typed-data/smoke check
  - 전체 repo check 통과
- 남은 리스크:
  - production dealer approval, custody, quote cancellation, partial fill은 RFQ v1
    범위 밖이다.
  - production Manifest lifecycle과 acquisition/lot source는 아직 결정·구현 전이다.
  - live deployment/E2E와 static analysis는 아직 부족하다.
  - production Element와 engine 허용 조건은 법률 승인 전 활성화할 수 없다.
