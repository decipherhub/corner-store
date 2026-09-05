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
- Manifest의 `RecipeBinding[]`에 따라 필수 Recipe는 AND, 같은 path group의
  대안 Recipe는 OR, 비차단 Recipe는 flag로 실행 전에 평가한다.
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

- [`docs/WHITEPAPER.md`](./docs/WHITEPAPER.md): product architecture and technical whitepaper
- [`docs/README.md`](./docs/README.md): documentation map and source-of-truth rules
- [`docs/MVP-v2-multi-venue.md`](./docs/MVP-v2-multi-venue.md): current product scope
- [`docs/architecture/README.md`](./docs/architecture/README.md): responsibility boundaries
- [`docs/ROADMAP.md`](./docs/ROADMAP.md): implementation phases and completion criteria
- [`howtodeploy.md`](./howtodeploy.md): GIWA Sepolia testnet deployment quickstart
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

- Foundry v1.7.1 (`forge`, `anvil`; CI and live E2E verification baseline)
- Node.js and npm for the TypeScript services under `services/`, including RFQ,
  CLI, Toolkit, Operator API and Compliance Data SDK
- Yarn for `tools/deploy-v3`

Foundry 버전을 바꾼 뒤 script broadcast에서 constructor decoding 오류가 나면
서로 다른 버전의 build artifact가 섞이지 않도록 `forge clean` 후 재실행한다.

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
SDK. It reads addresses from the live Anvil deployment artifact and presentation,
wallet, initial qualification and temporal-expiry fixtures from a validated
scenario JSON. It uses the configured mock maker and fixed-rate pricing and
returns `RFQAdapter`-compatible signed quotes. It is not a hosted or production
RFQ operator service.

```shell
scripts/e2e-anvil.sh --profile buidl-like --keep
```

For the short RFQ-first stakeholder walkthrough, omit the AMM scenario suite:

```shell
scripts/e2e-anvil.sh --profile buidl-like --mode rfq
```

Use another versioned local fixture without editing application code. Schema v2
can replace account bindings, initial balances, fixed mock pricing, default
buy/sell amounts, wallet/QP facts and presentation values:

```shell
scripts/showcase.sh --plan
scripts/showcase.sh
```

The showcase config injects the profile, scenario, mode and all local runtime
ports. It deploys the core through the same `DeployProductionCore.deployCore()`
implementation used by the production workflow, then visibly separates the
local ERC-3643, Mock TA, policy, venue and inventory activation. See
[`docs/showcase-runbook.md`](./docs/showcase-runbook.md).

The selected scenario is copied into the deployment runtime input and its hash is
written to the deployment artifact. The backend refuses a mismatched scenario,
while balances displayed after deployment are read from the live token contracts.

`--keep` leaves both Anvil and the RFQ demo backend running. Open the printed
dashboard URL, choose a demo wallet, select **매수** or **매도**, request a firm
quote and settle it through the protected Router; no CLI copy/paste is required.
Buy moves the settlement asset to the maker and RWA to the investor. Sell
reverses those token legs, and Portfolio shows both live balance deltas.

For a terminal-only flow, request and settle the quote directly:

```shell
# 5,000,000 is the tracked default scenario amount.
node services/cli/dist/cli/src/index.js rfq-quote \
  --backend http://127.0.0.1:8787 --amount-in 5000000 --out quote.json
node services/cli/dist/cli/src/index.js buy 0 --venue rfq --quote quote.json
```

See [`services/rfq-demo-backend/README.md`](./services/rfq-demo-backend/README.md)
for the complete local flow and production replacement boundaries.

### Standalone SDK Integration

The CLI exposes a unified external workflow for clean consumer projects:
`create`, `init`, `doctor`, `deploy`, `verify` and `test-module`. A consumer can
start with only the RFQ library, a minimal reference RFQ service, or a wrapper
for an existing backend. Docker is optional and is generated only for the
reference-service mode.

```shell
cd services/cli
npm test

node dist/cli/src/index.js create ../../my-corner-store \
  --mode library-only
node dist/cli/src/index.js create ../../my-rfq-service \
  --mode reference-service --docker
node dist/cli/src/index.js create ../../my-existing-backend \
  --mode existing-backend

cd ../../my-corner-store
npm install
npm run doctor
npm run deploy              # dry-run; add -- --broadcast only for local/demo submission
npm run verify              # after a deployment artifact exists
npm test                         # builds, then runs corner-store test-module
```

When generated from this repository, the scaffold vendors the RFQ SDK source and
a local CLI tarball, so the default `npm install` path does not depend on
unpublished registry packages. Packaged consumers can use a published package,
Git URL or explicit local package with `--sdk <specifier>` and
`--cli <specifier>`.
Packaged CLI deployments use the bundled contract source, or an explicit
`--contracts <path>` / `CORNER_STORE_CONTRACTS_ROOT` override.

See [`docs/sdk-integration.md`](./docs/sdk-integration.md) for package
boundaries, the three integration modes, generated files, deployment checks and
the common conformance suite.

### Local Deployment Studio

`services/deployment-studio` presents the same standalone SDK workflow as a
local web control surface: project mode, validated JSON configuration, doctor,
dry-run, guarded reference deployment, artifact verification and Operations
Dashboard handoff. Server bind values, workspace, CLI entry, RPC endpoint,
broadcast network/allowlist and handoff URL are runtime inputs rather than
frontend constants.

```shell
scripts/studio.sh --rpc http://127.0.0.1:8545
```

Direct browser-triggered broadcast remains restricted to the operator-injected
demo network and RPC allowlist. Mainnet deployment, signing secrets and
production ERC-3643 onboarding are outside this control surface. See
[`docs/deployment-studio.md`](./docs/deployment-studio.md).

### Investor and Issuer Product Portal Demo

`services/product-portal-demo`는 Figma와 `INTERACTION_SPEC.md`의 투자자 자격 신청,
RFQ 주문, 발행사 자산 등록과 증빙 준비 흐름을 1440px desktop reference UI로
재현한다. wallet session, KYC/TA connector, multi-dealer quote/signature와
settlement receipt는 실제 외부 권한 없이 product-like sandbox facade로 동작한다.
ABCF를 포함한 Figma catalog는 처음부터 보이며, 발행사에서 거래를 시작하면 같은
browser origin의 투자자 화면에 activation 상태와 알림이 반영된다.

```shell
npm start --prefix services/product-portal-demo
```

이 서비스는 외부 wallet, 실제 KYC/TA, 파일 전송, signer와 RPC를 호출하지 않는다.
화면의 연결·서명·체결 증거는 sandbox fixture다. 상세 boundary와 시연 경로는
[`docs/product-portal-demo.md`](./docs/product-portal-demo.md)를 참조한다.

### Production Deployment

Production core deployment is implemented separately from the local/demo
Studio path. It requires ERC-3643/ONCHAINID issuer onboarding evidence, Safe
proxy/singleton/code-hash and owner/threshold verification, external signing,
legal-approved
Element/Recipe/Manifest packages, staged venue/maker/signer/inventory
activation, dry-run/fork checks, multisig review and monitoring evidence.
Browser-triggered mainnet broadcast is out of scope.

### Public Testnet RFQ Deployment

Hackathon reviewers can inspect a working RFQ-only reference stack on a public
EVM testnet without changing the local Anvil demo. The testnet path accepts all
actors and network values at runtime, signs deployment transactions through a
Foundry keystore or Ledger, writes a non-secret artifact, and provides separate
participant approval and read-only verification scripts.

```shell
cp .env.testnet.example .env.testnet
# Fill and source the local file, then simulate first.
scripts/deploy-testnet-rfq.sh \
  --rpc-url "$RPC_URL" \
  --chain-id "$CHAIN_ID" \
  --account corner-store-testnet

# Repeat with --broadcast after reviewing the simulation.
```

This path deploys a mock-TA BUIDL-like ERC-3643 fixture plus the real Corner
Store Router/Engine/RFQ contracts. It is a public testnet reference deployment,
not production legal onboarding. See
[`docs/testnet-deployment.md`](./docs/testnet-deployment.md).

After broadcast, participant approvals and artifact verification, the separate
wallet-signed browser demo consumes the committed artifact without redeploying:

```shell
scripts/run-testnet-rfq-demo.sh
```

The local Anvil showcase remains unchanged and does not share its deterministic
account facilitator with this public-network runtime.

From this repository:

```shell
npm run build --prefix services/cli
cp services/toolkit/examples/corner-store.production.json corner-store.production.json
node services/cli/dist/cli/src/index.js production-source-hash
node services/cli/dist/cli/src/index.js production-plan corner-store.production.json
node services/cli/dist/cli/src/index.js production-preflight corner-store.production.json
```

Copy the printed source commit/contract hash into `release`, then freeze the
approved RPC hosts, existing Safe address, full owner list `M`, threshold `N`
and optional existing ERC-3643 token address. The plan prints the config hash used by
`deployment.evidence`. After dry-run and target-chain fork review, an external
operator can execute `production-deploy` with a Foundry Ledger or named
keystore account. The browser Studio cannot sign or broadcast this path.

See [`docs/deployment-production.md`](./docs/deployment-production.md).

### Compliance Data SDK

`services/compliance-data` implements the provider-neutral ADR-008 foundation:
TA lot/lineage resolution, conservative acquisition snapshots, person-group
state and tamper-evident rejection/surveillance records. It does not include or
claim compatibility with an undocumented production Securitize API.

```shell
cd services/compliance-data
npm ci
npm test
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

- local Anvil runtime과 자동 E2E는 `scripts/e2e-anvil.sh`로 제공한다.
- `tools/deploy-v3`는 제품 배포 orchestrator가 아니라 독립 vendored module이다.
- 현재 작업 상태와 다음 feature는 `PROGRESS.md`와 `FEATURES.md`를 기준으로 한다.
