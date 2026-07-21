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

현재 제품 테스트는 compliance registry/engine, execution router, AMM adapter,
RFQ adapter와 TREX fixture 기반 integration path를 포함한다.
`--offline`은 외부 시그니처 조회를 차단해 로컬 검증을 결정적으로 유지하고,
일부 macOS 환경의 Foundry nightly 프록시 초기화 충돌을 피한다.

RFQ TypeScript SDK smoke test:

```sh
cd services/rfq
npm ci
npm test
```

이 smoke test는 EIP-712 typed-data shape, high-level SDK quote flow, pricing/nonce/risk seams, expiry/nonce 부여, unsafe JavaScript number 거부와 monotonic nonce fallback을 검증한다.

RFQ demo backend와 CLI smoke test:

```sh
cd services/rfq-demo-backend && npm ci && npm test
cd services/cli && npm ci && npm test
```

Backend smoke는 ephemeral HTTP server의 health/quote API, fixed-rate pricing,
maker signature, monotonic nonce와 numeric amount 거부를 검증한다. CLI smoke는
backend quote request path와 기존 quote-file/서명 검증 경로를 함께 검증한다.

Vendored deploy tool 테스트:

```sh
cd tools/deploy-v3
yarn test
```

### Integration Tests

Foundry integration tests는 mock/ERC-3643 fixture를 사용해 regulated swap,
multi-Recipe, surveillance, emergency pause와 invariant path를 검증한다.
`tools/deploy-v3`의 Corner Store profile은 unit test로 구성과 순서를 검증하며,
과거 수동 Anvil 배포 검증 기록은 `tools/deploy-v3/CORNER_STORE_PROFILE.md`에 있다.

자동화된 live Anvil deployment/E2E는 `scripts/e2e-anvil.sh`로 제공된다(아래 E2E
Tests 및 `docs/demo.md` 참조).

### E2E Tests

live Anvil E2E는 `scripts/e2e-anvil.sh`로 자동화되어 있다(features `E2E-001`,
`DEMO-002`). 이 러너는 fresh Anvil 노드에 선택한 asset profile의 전체 스택을
배포(`script/DeployStack.s.sol`)하고 7-scenario demo suite를 구동
(`script/DemoScenarios.s.sol`)한다. 이어서 CLI로 선택 profile을 재온보딩하고
RFQ demo backend를 띄워 quote를 요청한 뒤 Router/RFQAdapter를 통한 성공과
revoked-maker 실패까지 실행한다.
단계별 observable evidence와 `PASS`/`FAIL`을 출력하며 하나라도 실패하면 non-zero로
종료한다. 실행 방법과 scenario 순서, reason code 재계산, mock/real 구분은
`docs/demo.md`(demo runbook)를 참조한다.

```sh
scripts/e2e-anvil.sh            # BUIDL-like 배포 → scenario → backend RFQ → teardown
scripts/e2e-anvil.sh --profile reg-d
scripts/e2e-anvil.sh --keep     # 이후 Anvil을 계속 실행(인터랙티브 demo)
```

이 러너가 커버하는 최소 E2E는 다음을 포함한다.

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
- `buidl-like | reg-d` asset profile 선택과 동일한 protected execution path
- backend-signed quote의 CLI 요청과 Router/RFQAdapter settlement
- backend quote 발급 후 maker revoke 시 fill-time 거부

### Integrated Check

```sh
scripts/check.sh
```

이 명령은 현재 저장소에서 지원하는 format, build와 test를 순서대로 실행한다.
현재 포함 범위는 Foundry fmt/build/test, RFQ SDK·demo backend·CLI smoke,
vendored deploy-v3 test와 whitespace check다.

## Manual Verification

문서-only 변경은 다음을 추가 확인한다.

- source-of-truth 링크가 유효한가
- 같은 개념이 서로 다른 이름이나 책임으로 설명되지 않는가
- 확정된 결정과 열린 질문이 구분되는가
- `git diff --check`가 통과하는가

## Completion Rule

feature의 `Verification`에 적힌 모든 검증이 통과해야 `passing`으로 변경할 수 있다.
실행할 수 없는 검증은 생략하지 말고 `PROGRESS.md`에 원인과 대체 검증을 기록한다.
