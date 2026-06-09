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
vendored Uniswap v3 deployment tool, and the initial Foundry project scaffold.
Product Solidity contracts are not implemented yet.

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
- Vendored deployment tooling: TypeScript, Yarn, ethers v5

## Local Setup

Required tools:

- Foundry (`forge`, `anvil`)
- Node.js and Yarn for `tools/deploy-v3`

Install or refresh the vendored tool dependencies when needed:

```shell
cd tools/deploy-v3
yarn install --frozen-lockfile
```

## Development Commands

The product contracts use Foundry. The template `Counter` files remain only
until Roadmap Phase 0 replaces them with the product structure and fixtures.

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

- 제품 runtime과 자동 E2E 환경은 아직 구성되지 않았다.
- `tools/deploy-v3`는 제품 배포 orchestrator가 아니라 독립 vendored module이다.
- 현재 작업 상태와 다음 feature는 `PROGRESS.md`와 `FEATURES.md`를 기준으로 한다.
