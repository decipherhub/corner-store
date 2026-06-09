# Testing Guide

## Test Layers

### Static Verification

```sh
forge fmt --check
forge build
```

현재 별도 Solidity linter나 static analyzer는 구성되어 있지 않다.

### Unit Tests

제품 Foundry 테스트:

```sh
forge test --offline
```

현재는 Counter template test만 존재한다.
`--offline`은 외부 시그니처 조회를 차단해 로컬 검증을 결정적으로 유지하고,
일부 macOS 환경의 Foundry nightly 프록시 초기화 충돌을 피한다.

Vendored deploy tool 테스트:

```sh
cd tools/deploy-v3
yarn test
```

### Integration Tests

현재 자동화된 제품 integration test는 없다. `tools/deploy-v3`의 Corner Store
profile은 unit test로 구성과 순서를 검증하며, 과거 수동 Anvil 배포 검증 기록은
`tools/deploy-v3/CORNER_STORE_PROFILE.md`에 있다.

### E2E Tests

아직 제품 E2E test가 없다. 향후 최소 E2E는 다음을 포함해야 한다.

- 허용된 거래의 실행 성공
- applicable Recipe 중 하나의 Element 거부에 따른 원자적 실패
- 여러 Recipe의 cumulative AND와 중복 Element 실행 의미
- Manifest lifecycle, version과 supported engine binding
- ERC-3643 transfer 거부의 원자적 실패
- 지원 Router 경로와 직접 venue 호출의 보장 차이
- `UNKNOWN`, explicit `UNREGULATED` public path와 regulated path의 보장 차이
- unregulated-regulated mixed pair의 regulated Manifest 적용
- regulated-regulated pair의 양쪽 Manifest/Recipe 누적 적용
- Adapter 등록·교체·중단 시 Router와 compliance policy 불변성

### Integrated Check

```sh
scripts/check.sh
```

이 명령은 현재 저장소에서 지원하는 format, build와 test를 순서대로 실행한다.

## Manual Verification

문서-only 변경은 다음을 추가 확인한다.

- source-of-truth 링크가 유효한가
- 같은 개념이 서로 다른 이름이나 책임으로 설명되지 않는가
- 확정된 결정과 열린 질문이 구분되는가
- `git diff --check`가 통과하는가

## Completion Rule

feature의 `Verification`에 적힌 모든 검증이 통과해야 `passing`으로 변경할 수 있다.
실행할 수 없는 검증은 생략하지 말고 `PROGRESS.md`에 원인과 대체 검증을 기록한다.
