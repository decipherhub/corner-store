# SDK Integration

Corner Store is consumed in three layers. Integrators do not need to deploy or
host every repository component.

| Layer | Required | Purpose |
| --- | --- | --- |
| Solidity core and execution interfaces | yes for protected settlement | compliance evaluation, Router enforcement and Adapter contracts |
| RFQ TypeScript SDK | only for RFQ operators | quote shape, EIP-712 binding and replaceable module contracts |
| reference apps and deployment exports | optional | local demo backend, CLI, dashboard and Docker Compose example |

## Unified CLI Workflow

The external CLI workflow is:

```sh
corner-store create ./my-corner-store --template dex-integration
cd my-corner-store
npm install
npm run validate
npm run simulate
npm test
npm run doctor
npm run deploy
npm run verify   # after a deployment artifact exists
```

`create` writes a standalone project. It includes `corner-store.config.json`,
`corner-store.project.json`, `corner-store.integration.json`,
`corner-store.scenario.json`, `.env.example`, TypeScript policy/RFQ sources and
the public RFQ module conformance file. It never
overwrites an existing target directory.

`init` is for an existing directory that does not already have a config:

```sh
corner-store init corner-store.config.json
```

The generated `package.json` scripts map to the same CLI commands:

| Script or command | Purpose |
| --- | --- |
| `corner-store create <target>` | create a clean integration project |
| `corner-store init [path]` | create a versioned Toolkit config in an existing project |
| `corner-store doctor [path]` | check Node, npm, Foundry, config, contract bundle, optional artifact and template-aware Docker readiness |
| `npm run validate` | validate the versioned project config without deployment side effects |
| `npm run simulate` | compile and simulate the policy values used by the generated project |
| `corner-store deploy [path]` | print the deployment plan by default; `--broadcast` submits the local/demo Foundry deployment |
| `corner-store verify [path]` | preflight config and deployment artifact bindings after an artifact exists |
| `corner-store test-module <path>` | run the public RFQ module conformance suite against a built CommonJS module |
| `npm test` | build the generated project and run `corner-store test-module dist/module-conformance.js` |
| `npm run policy:explain` | compile/simulate/explain the shared config and show missing artifact remediation |

`deploy` uses `DeployStack.s.sol`. It is a dry-run unless `--broadcast` is
passed. Docker is not required for deployment.

## Purpose Templates

Prefer `create --template` so a user chooses the intended outcome before the
internal RFQ integration shape:

| Template | Outcome | Compatibility mode |
| --- | --- | --- |
| `sandbox` | evaluate the reference policy and RFQ boundary | `reference-service` |
| `dex-integration` | connect policy/RFQ helpers to an existing venue | `library-only` |
| `asset-onboarding` | prepare dry-run and unsigned onboarding work | `library-only` |
| `rfq-service` | connect replaceable RFQ modules | `reference-service` |

The `sandbox` template generates the complete local reference environment by
default. It bundles only the allowlisted Corner Store sources needed to build the
Anvil deployment, RFQ backend, Operator API/dashboard and Deployment Studio; a
repository checkout is not required.

```sh
corner-store create ./corner-store-sandbox --template sandbox
cd ./corner-store-sandbox
npm install
npm run validate
npm run simulate
npm run doctor
npm run dev
npm run status
```

The default `buidl-like` fixture is available at `http://127.0.0.1:8790`, with
Deployment Studio at `http://127.0.0.1:8791`. Use
`CORNER_STORE_PROFILE=reg-d npm run dev` for the Reg D fixture.
Anvil readiness and the one-shot deployment gate all dependent services, and the
RFQ backend fails closed when the chain, deployment artifact or scenario do not
match. Run `docker compose down --volumes --remove-orphans` to discard a previous
demo chain and artifact together before switching profiles. For startup failures,
inspect `npm run status` and `docker compose logs deployer rfq operator-api`.

The sandbox uses public Anvil development identities, reference pricing/risk and
mock qualification data. It is never a production deployment, never accepts
production credentials, and does not replace the existing non-Docker Anvil or
GIWA testnet flows.

The `dex-integration` template additionally generates:

- `contracts/CornerStoreVenueAdapter.sol`: Router-only, exact-target starter;
- `src/venue-client.ts`: base-unit execution request builder;
- `corner-store.venue.json`: versioned integration and responsibility descriptor;
- `test/CornerStoreVenueAdapter.t.sol`: common allow/reject/direct-call/rollback
  conformance using the real `ExecutionRouter` ordering.

The starter deliberately delegates settlement to the external venue. Integrators
must implement and audit token movement, callback origin checks, venue-specific
slippage/accounting and custody behavior; passing conformance does not certify
those responsibilities.

## Unified TypeScript Facade

`@corner-store/toolkit` exports `connectCornerStore({config, artifact})`. The
returned `policy` facade exposes `validate`, `compile`, `simulate`, `explain`, and
`verify` over the same config/artifact source. `explain` presents profile, venues,
network and governance values first and keeps Element/Recipe/Manifest/Operator as
advanced detail. `verify` is read-only, fails closed without an artifact, and
returns `expected`, `actual`, and `remediation` per check.

## Legacy Integration Modes

`create --mode` supports three modes:

| Mode | Use when | Generated runtime |
| --- | --- | --- |
| `library-only` | the app only needs RFQ SDK types/helpers and will own its own service boundary | `src/index.ts` re-exports `@corner-store/rfq-service`; no HTTP server |
| `reference-service` | the operator wants a minimal local RFQ quote service to replace module by module | `POST /rfq/quote` HTTP service with fixed-rate pricing, noop risk, signer binding and in-memory nonce |
| `existing-backend` | an existing backend already owns HTTP/RPC/queue handling | `createCornerStoreRFQ(...)` composition helper for existing pricing, risk, signer and nonce modules |

Docker Compose is optional and only valid with `reference-service`:

```sh
corner-store create ./my-rfq-service --template rfq-service --docker
```

The `rfq-service --docker` output contains the smaller RFQ-only `Dockerfile` and
`compose.yaml`. It reads `.env`; it does not embed signer keys, RPC credentials
or production secrets. The `sandbox` template instead includes its full Compose
environment automatically and uses only documented demo identities.

## RFQ Module Contract

`services/rfq` owns the versioned module contract. Each module declares an ID,
semantic version, kind, capabilities, maturity and the names of configuration and
secret inputs. Configuration values and secret material are never included in the
descriptor.

| Kind | Required capability | Replace with |
| --- | --- | --- |
| pricing | `rfq.price.v1` | operator price or market-data service |
| risk | `rfq.risk.pre-sign.v1` | inventory and exposure policy |
| signer | `rfq.sign.eip712.v1` | KMS, HSM or custody signer |
| nonce | `rfq.nonce.maker-scoped.v1` | durable database/Redis allocator |

`createRFQServiceFromModules()` validates all capabilities before creating a
quote service. This backend composition does not decide final compliance.
`ExecutionRouter` and `ComplianceEngine` always evaluate the current state again
when a quote is filled.

## Generate a Purpose-driven Integration

When working inside this repository, build the CLI, then choose a purpose:

```sh
cd services/cli
npm test

node dist/cli/src/index.js create ../../my-rfq-lib \
  --template dex-integration

node dist/cli/src/index.js create ../../my-rfq \
  --template rfq-service --docker

node dist/cli/src/index.js create ../../my-onboarding \
  --template asset-onboarding
```

When the CLI runs inside this repository it copies the RFQ SDK source into a
self-contained `vendor/rfq-service` package so the generated project and Docker
context do not depend on an absolute host path or prebuilt `dist`. A packaged
CLI can instead use a published package, Git URL or explicit local package
through `--sdk <specifier>`. The generated package can also pin the Toolkit and
CLI through `--toolkit <specifier>` and `--cli <specifier>`.
For an unpublished source checkout, `create` automatically packs the current
Toolkit and CLI into `vendor/`; the generated project therefore installs without
registry-published packages.

The legacy scaffold command remains available for RFQ-only generation:

```sh
corner-store toolkit-scaffold-rfq ./my-rfq --mode reference-service
```

The target directory must not already exist. The generator never overwrites an
existing integration.

## Generated Contract

Every scaffold includes:

- `corner-store.integration.json`: versioned mode and module binding metadata
- `corner-store.project.json`: versioned purpose, maturity, shared config/artifact paths and next steps
- `corner-store.config.json`: standalone deployment config when generated with `create`
- `corner-store.scenario.json`: standalone local/demo scenario input when generated with `create`
- `.env.example`: variable names and empty secret slots only
- `src/index.ts`: reference service or existing-backend composition example
- `src/policy.ts`: shared `connectCornerStore()` policy facade example
- `src/venue-client.ts`, `contracts/CornerStoreVenueAdapter.sol` and adapter
  conformance files for the `dex-integration` template
- `src/module-conformance.ts`: public RFQ module conformance entrypoint
- `package.json` and `tsconfig.json`
- `vendor/rfq-service`: self-contained SDK source when generated from this repository
- `vendor/corner-store-cli.tgz`: self-contained local CLI package when generated
  from an unpublished source checkout
- `vendor/corner-store-toolkit.tgz`: self-contained Toolkit package when generated
  from an unpublished source checkout
- optional `Dockerfile` and `compose.yaml`

Docker is an export choice, not a required Corner Store runtime. Generated
Compose reads `.env`; it does not embed a signer key, RPC credential or production
secret.

## Recovery Contract

`doctor` emits a remediation for every failed check. Docker and Compose v2 are
required only by the `sandbox` template; library-oriented templates report them
as optional. A sandbox profile change must start from `npm run clean`, followed
by `npm run dev` with the new `CORNER_STORE_PROFILE`.

`verify` fails closed when the deployment artifact is missing or bound to a
different profile/network/config. Correct or regenerate that artifact, then rerun
the same `npm run verify` command. The output includes `expected`, `actual` and
`remediation`, so recovery does not require copying contract addresses by hand.

## Contract Bundle Resolution

Packaged CLI deployments need contract sources for `DeployStack.s.sol`. The CLI
looks for them in this order:

1. `--contracts <path>`
2. `CORNER_STORE_CONTRACTS_ROOT`
3. `.corner-store/contracts` in the consumer project
4. the packaged `bundle/contracts`
5. this repository root when run from the source checkout

`doctor` reports the resolved path. `deploy --broadcast` copies the bundle into
`.corner-store/runtime/contracts` when the consumer project is outside the source
repository, runs the Foundry script there, then copies the deployment artifact
back to the configured `deployment.artifact` path.

## Conformance

Custom modules must run the same public suite as reference modules:

```ts
import {assertRFQModuleConformance} from "@corner-store/rfq-service";

await assertRFQModuleConformance(modules, fixture);
```

Generated projects expose the same gate through the CLI:

```sh
npm test
# or after build:
corner-store test-module dist/module-conformance.js
```

The suite verifies capability declarations, positive base-unit pricing,
maker/domain/current-policy field binding, expiry, module order, risk fail-closed behavior,
65-byte signature shape and maker recovery, and maker-scoped monotonic nonce
behavior.

Passing conformance proves compatibility with the RFQ SDK contract. It does not
certify a pricing model, risk policy, signer custody, persistence durability or
legal compliance for production.

Package compatibility, release sequencing and migration requirements are defined
in [`sdk-versioning.md`](./sdk-versioning.md). The standalone product smoke packs
and installs the CLI, Toolkit and RFQ packages into temporary clean projects; it
must not resolve package code through repository-relative paths.
