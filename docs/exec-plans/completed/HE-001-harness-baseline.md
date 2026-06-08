# Exec Plan: Harness Baseline

## Goal

Corner Store 저장소만 읽어도 새 세션이 프로젝트 상태, 현재 작업, 검증 명령과 다음
단계를 복구할 수 있는 최소 Harness Engineering 기반을 만든다.

## Scope

### In Scope

- 루트 진입 문서와 Harness 상태 문서 정비
- 현재 아키텍처 문서를 연결하는 인덱스 작성
- Foundry와 vendored `deploy-v3`를 포함한 통합 검증 명령 제공
- 다음 아키텍처 문서 갱신 작업을 feature와 progress에 기록

### Out of Scope

- `importedDouments/`의 변경 내용을 제품 문서에 반영
- Solidity 제품 컨트랙트 구현
- 기존 Counter scaffold 제거
- CI와 production 배포 환경 구성

## Current State

- 제품 범위와 아키텍처는 `docs/`에 문서화되어 있다.
- Solidity 코드는 Foundry Counter template 상태다.
- `tools/deploy-v3`는 독립적인 vendored Uniswap v3 배포 도구다.
- 세션 상태, feature 상태, 결정 이유와 통합 검증 명령을 관리하는 Harness 문서가
  없다.

## Target State

- `AGENTS.md`가 필수 문서와 명령을 안내하는 짧은 라우터 역할을 한다.
- `FEATURES.md`, `PROGRESS.md`, `DECISIONS.md`, `QUALITY.md`가 작업 상태를
  저장소 안에 보존한다.
- `scripts/check.sh` 하나로 현재 저장소의 전체 검증을 실행할 수 있다.
- 다음 세션은 imported 문서 반영 작업을 바로 시작할 수 있다.

## Steps

1. 현재 문서와 실행 가능한 명령을 조사한다.
2. Harness 핵심 문서와 디렉터리를 만든다.
3. `AGENTS.md`와 `README.md`를 새 구조에 연결한다.
4. 통합 검증 스크립트를 추가한다.
5. 전체 검증을 실행하고 상태 문서를 갱신한다.

## Verification

- `scripts/check.sh`
- Harness 필수 파일 존재 확인
- Markdown 내부 경로와 명령 수동 검토
- `git diff --check`

## Risks

- 현재 제품 문서는 곧 imported 문서 기준으로 변경될 예정이므로 아키텍처 내용을
  Harness 문서에 중복 작성하면 빠르게 낡을 수 있다.
- `tools/deploy-v3`는 오래된 Node/Yarn 의존성을 사용하므로 환경에 따라 테스트
  실행이 실패할 수 있다.

## Rollback Plan

이번 작업은 문서와 스크립트 추가가 중심이다. 문제가 있으면 추가된 Harness 파일과
라우터 변경만 되돌리고 기존 `docs/` 제품 문서는 유지한다.

## Completion Criteria

- Harness 핵심 문서가 존재하고 서로 연결된다.
- 동시에 하나의 feature만 `active` 상태다.
- 통합 검증 결과가 `PROGRESS.md`에 기록된다.
- 다음 작업과 범위가 저장소 안에 남는다.

## Result

- Status: completed
- Completed: 2026-06-09
- Integrated verification: `scripts/check.sh`
- Passed:
  - `forge fmt --check`
  - `forge build`
  - `forge test --offline` — 2 tests
  - `tools/deploy-v3` `yarn test` — 10 tests
  - `git diff --check`
- Note: plain `forge test` triggered a Foundry nightly macOS system-proxy crash.
  Offline mode avoids the external signature lookup and passed.
