# Corner Store

Corner Store is a Solidity SDK and reference execution system for DEX-level
compliance of tokenized assets. The SDK models market access with reusable
Element, Recipe, Manifest, and Operator boundaries. The Corner Store reference
DEX proves the model across AMM, RFQ, and future Order Book adapters.

The SDK has two extension axes: policies are registered through
Element/Recipe/Manifest, while execution venues or external DEX integrations
are registered through a generic Router/Adapter boundary. Concrete Corner Store
adapters and deployment configuration are reference implementations.

The repository currently contains the architecture and development plan, a
vendored Uniswap v3 deployment tool, the Foundry product scaffold, and initial
reference execution adapters including AMM and RFQ settlement paths.

## Main Use Cases

- 제3의 DEX가 재사용할 수 있는 compliance interface와 registry 모델을 제공한다.
- Router를 수정하지 않고 정책과 execution Adapter를 등록·교체한다.
- 자산 Manifest와 거래 context로 applicable Recipe를 식별한다.
- 여러 Recipe의 Element를 cumulative AND로 실행 전에 평가한다.
- 허용된 venue adapter로 거래를 전달한다.
- ERC-3643 token transfer enforcement와 Corner Store 거래 정책의 실패를
  원자적으로 처리한다.
- Corner Store DEX로 SDK의 testnet 실행 흐름을 증명한다.

## Repository Guide

- [`AGENTS.md`](./AGENTS.md): 세션 운영 규칙과 필수 명령
- [`ARCHITECTURE.md`](./ARCHITECTURE.md): 시스템 경계와 디렉터리 라우터
- [`FEATURES.md`](./FEATURES.md): feature behavior, verification과 state
- [`PROGRESS.md`](./PROGRESS.md): 현재 상태와 다음 작업
- [`DECISIONS.md`](./DECISIONS.md): 주요 결정과 이유
- [`QUALITY.md`](./QUALITY.md): 모듈별 품질 상태
- [`docs/testing.md`](./docs/testing.md): 테스트와 완료 기준
- [`docs/security.md`](./docs/security.md): 보안 규칙

## Product Documentation

- [`docs/README.md`](./docs/README.md): documentation map and source-of-truth rules
- [`docs/MVP-v2-multi-venue.md`](./docs/MVP-v2-multi-venue.md): current product scope
- [`docs/architecture/README.md`](./docs/architecture/README.md): responsibility boundaries
- [`docs/ROADMAP.md`](./docs/ROADMAP.md): implementation phases and completion criteria
- [`tools/deploy-v3/UPSTREAM.md`](./tools/deploy-v3/UPSTREAM.md): vendored upstream provenance

## Tech Stack

- Contracts: Solidity + Foundry
- Tests: Forge
- Local chain: Anvil
- RFQ reference service: TypeScript
- RFQ demo backend and reference CLI: TypeScript
- Vendored deployment tooling: TypeScript, Yarn, ethers v5

## Local Setup

Required tools:

- Foundry (`forge`, `anvil`)
- Node.js and npm for `services/rfq`, `services/rfq-demo-backend` and `services/cli`
- Yarn for `tools/deploy-v3`

Install or refresh the vendored tool dependencies when needed:

```shell
cd tools/deploy-v3
yarn install --frozen-lockfile
```

## Development Commands

The product contracts use Foundry. The current scaffold contains the Compliance
Core, Execution Integration Kit, AMM reference adapter, RFQ v1 reference
settlement adapter, and related fixtures/tests.

### Build

```shell
forge build
```

### Test

```shell
forge test --offline
```

### Format

```shell
forge fmt
```

### Local Node

```shell
anvil
```

### RFQ TypeScript SDK

`services/rfq` provides TypeScript SDK helpers for RFQ quote backends. It builds
the same EIP-712 typed data that `RFQAdapter` verifies, assigns expiry and
nonce, signs quotes through a caller-provided signer, and exposes pricing, nonce
and risk-check interfaces for integrators. It is not a hosted production RFQ
server, dealer, pricing engine, inventory manager, custody service, websocket
feed, orderbook, or compliance decision engine.

```shell
cd services/rfq
npm ci
npm test
```

### Local RFQ Demo Backend

`services/rfq-demo-backend` is a local-only HTTP application built from the RFQ
SDK. It reads the live Anvil deployment artifact, uses the configured mock maker
and fixed-rate pricing, and returns `RFQAdapter`-compatible signed quotes. It is
not a hosted or production RFQ operator service.

```shell
scripts/e2e-anvil.sh --keep

cd services/rfq-demo-backend
npm ci
npm start
```

In another terminal, request and settle the quote through the protected Router
path:

```shell
node services/cli/dist/cli/src/index.js rfq-quote \
  --backend http://127.0.0.1:8787 --amount-in 120 --out quote.json
node services/cli/dist/cli/src/index.js buy 0 --venue rfq --quote quote.json
```

See [`services/rfq-demo-backend/README.md`](./services/rfq-demo-backend/README.md)
for the complete local flow and production replacement boundaries.

### Check All

```shell
scripts/check.sh
```

The vendored Uniswap deployment tool has its own commands and scope:

```shell
cd tools/deploy-v3
yarn test
```

Read
[`tools/deploy-v3/CORNER_STORE_PROFILE.md`](./tools/deploy-v3/CORNER_STORE_PROFILE.md)
before changing the deployment profile.

## Runtime Notes

- local Anvil runtime과 자동 E2E는 `scripts/e2e-anvil.sh`로 제공한다.
- `tools/deploy-v3`는 제품 배포 orchestrator가 아니라 독립 vendored module이다.
- 현재 작업 상태와 다음 feature는 `PROGRESS.md`와 `FEATURES.md`를 기준으로 한다.
