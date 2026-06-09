# Progress

## Current Status

저장소는 SDK/reference DEX 아키텍처·개발 계획 문서, Foundry Counter scaffold와
vendored Uniswap v3 배포 도구를 포함한다. 제품 Solidity 컨트랙트는 아직 구현되지
않았다.

공식 문서는 DEX-level compliance SDK, Corner Store reference DEX,
Element/Recipe/Manifest/Operator 4-Layer와 cumulative multi-Recipe 모델을
source of truth로 사용한다.

## Active Feature

- 없음
- 다음 작업은 `FND-001 — Foundry Product Foundation`이다.

## Completed

- `HE-001 — Harness Baseline`
- `DOC-001 — Imported Architecture Alignment`
- multi-venue 아키텍처와 책임 문서 작성
- Corner Store용 Uniswap v3 최소 배포 profile 분리와 테스트

## Blocked

- 없음

## Next

1. `FND-001 — Foundry Product Foundation`의 Exec Plan을 작성한다.
2. Compliance Core, Execution Integration Kit와 Corner Store reference Adapter의
   디렉터리·의존 방향을 확정한다.
3. 공통 context, interface, error와 mock fixture를 구현한다.
4. stateful Element commit hook과 acquisition data source는 구현 전에 별도 결정한다.

## Last Session Summary

- 변경한 파일:
  - 제품 baseline, root architecture와 README
  - 4-Layer compliance, Asset Manifest, execution/venue 책임 문서
  - 구현 roadmap, decisions, security와 testing 기준
  - DOC-001 Exec Plan과 Harness 상태 문서
  - review에서 확인된 pair 평가, SDK/reference DEX 경계와 provenance 문제 수정
- 실행한 명령:
  - current 문서 legacy 용어 검색
  - Markdown 로컬 링크 검사
  - `git diff --check`
  - `scripts/check.sh`
- 통과한 검증:
  - current 문서에서 이전 architecture terminology와 pending migration 표현 제거
  - 비커밋 입력 경로에 대한 current 문서 직접 의존 제거
  - 로컬 Markdown 경로 29개 파일 확인
  - policy plugin과 execution Adapter plugin 경계 교차 검토
  - mixed pair와 regulated-regulated pair의 양쪽 Manifest 평가 규칙 확인
  - `forge fmt --check`
  - `forge build`
  - Foundry Counter 테스트 2개
  - `tools/deploy-v3` 테스트 10개
  - `git diff --check`
- 남은 리스크:
  - 제품 Solidity는 Counter template 상태다.
  - CI, 제품 integration/E2E와 정적 분석이 아직 없다.
  - acquisition data, stateful Element commit hook과 reject logging은 열린 결정이다.
  - production Element와 engine 허용 조건은 법률 승인 전 활성화할 수 없다.
  - concrete Adapter는 reference DEX 소유이고 generic Router/Adapter 경계는 SDK
    소유라는 구조를 구현 디렉터리에 반영해야 한다.
