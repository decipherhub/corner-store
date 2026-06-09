# Corner Store Agent Guidance

## Project Overview

Corner Store는 ERC-3643 위에 DEX-level compliance를 제공하는 Solidity SDK와
reference execution 프로젝트다. 현재 저장소에는 제품 문서, Foundry scaffold와
독립적인 Uniswap v3 배포 도구가 있다. 공식 문서와 active feature를 먼저 확인한다.

## Must Read First

- `README.md`
- `ARCHITECTURE.md`
- `FEATURES.md`
- `PROGRESS.md`
- `DECISIONS.md`
- `docs/README.md`
- `docs/testing.md`
- `docs/security.md`

## Commands

- setup: toolchain과 의존성은 `README.md`의 Local Setup 참조
- format: `forge fmt`
- build: `forge build`
- test: `forge test --offline`
- deploy-v3 test: `cd tools/deploy-v3 && yarn test`
- check all: `scripts/check.sh`

## Hard Rules

- 검증 전 완료를 선언하지 않는다.
- 동시에 하나의 feature만 `active`로 둔다.
- 현재 feature와 무관한 구현이나 리팩터링을 하지 않는다.
- 제품 경계를 바꾸면 관련 spec, `DECISIONS.md`, `FEATURES.md`를 함께 갱신한다.
- `tools/deploy-v3`를 vendored Uniswap v3 인프라로 분리 유지한다.
- ERC-3643 / ONCHAINID를 외부 token/identity trust boundary로 취급한다.
- 레포지토리에 없는 요구사항은 추측하지 않고 질문하거나 blocked로 기록한다.
- `jobspace*.md`, `review.md` 같은 scratch 파일은 커밋하지 않는다.

## Session Start Routine

1. Must Read First 문서를 읽는다.
2. `FEATURES.md`에서 active 또는 next feature를 확인한다.
3. `PROGRESS.md`에서 이전 검증 결과와 다음 작업을 확인한다.
4. 필요한 product spec과 active Exec Plan을 읽는다.
5. 이번 세션의 in-scope와 out-of-scope를 명시한다.

## Session Exit Checklist

- [ ] 관련 build와 test 통과
- [ ] runtime/E2E 검증 수행 또는 미실행 이유 기록
- [ ] `FEATURES.md` 상태 갱신
- [ ] `PROGRESS.md` 결과와 다음 작업 갱신
- [ ] 필요한 경우 `DECISIONS.md`, `QUALITY.md` 갱신
- [ ] 임시 debug 파일 제거
- [ ] 관련 없는 변경 없음
