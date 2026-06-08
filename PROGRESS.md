# Progress

## Current Status

저장소는 아키텍처·개발 계획 문서, Foundry Counter scaffold와 vendored Uniswap v3
배포 도구를 포함한다. 제품 Solidity 컨트랙트는 아직 구현되지 않았다.

Harness Engineering 기반 문서와 통합 검증 루프를 구축했다.

## Active Feature

- 없음
- 다음 작업은 `DOC-001 — Imported Architecture Alignment`다.

## Completed

- `HE-001 — Harness Baseline`
- multi-venue 아키텍처와 책임 문서 작성
- Corner Store용 Uniswap v3 최소 배포 profile 분리와 테스트

## Blocked

- 없음

## Next

1. `DOC-001 — Imported Architecture Alignment`의 Exec Plan을 작성한다.
2. `importedDouments/`의 확정 방향, change request와 열린 결정을 구분한다.
3. 공식 제품 명세, 아키텍처와 roadmap을 일관되게 갱신한다.
4. 문서 간 용어, 책임과 실행 흐름을 교차 검증한다.

## Last Session Summary

- 변경한 파일:
  - 루트 Harness 문서와 문서 라우터
  - `docs/testing.md`, `docs/security.md`, 제품 명세 인덱스
  - Exec Plan 구조와 `scripts/check.sh`
- 실행한 명령:
  - `git diff --check`
  - `forge test --offline`
  - `scripts/check.sh`
- 통과한 검증:
  - `forge fmt --check`
  - `forge build`
  - Foundry Counter 테스트 2개
  - `tools/deploy-v3` 테스트 10개
  - `git diff --check`
- 실패 후 해결:
  - `forge test`가 macOS 시스템 프록시를 초기화하는 Foundry nightly 버그로
    중단되어, 결정적 로컬 검증을 위해 `forge test --offline`으로 고정했다.
- 남은 리스크:
  - 현재 source-of-truth 문서는 imported 아키텍처 입력을 아직 반영하지 않았다.
  - 제품 Solidity는 Counter template 상태다.
  - CI, 제품 integration/E2E와 정적 분석이 아직 없다.
