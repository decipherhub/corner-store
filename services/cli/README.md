# corner-store CLI

An interactive TypeScript reference client for driving the whole Corner Store
compliance-gated DEX stack against a live node from the terminal — onboarding,
attestations, manifest lifecycle, AMM/RFQ trades, and reason-code decoding —
without touching the forge scripts. The Anvil E2E deploy
(`script/DeployStack.s.sol` → `deployments/anvil-e2e.json`) is the expected
environment.

## Install / build

```sh
cd services/cli
npm install
npm run build          # tsc -> dist/
npm test               # offline smoke: reason-table + quote-file round-trips
npm link               # one-time: puts the `corner-store` command on your PATH
```

Without `npm link`, invoke it as `node dist/cli/src/index.js <command>` from
`services/cli` instead. Undo the global link anytime with
`npm unlink -g @corner-store/cli`.

`node_modules/` and `dist/` are gitignored. Chain interaction uses `ethers`;
EIP-712 RFQ quotes REUSE the sibling `services/rfq` signer library.

## Standalone SDK workflow

External consumers should start with the unified SDK commands:

```sh
corner-store create ./my-corner-store --mode library-only
corner-store create ./my-rfq-service --mode reference-service --docker
corner-store create ./my-existing-backend --mode existing-backend
```

Generated projects include `corner-store.config.json`,
`corner-store.integration.json`, `corner-store.scenario.json`, `.env.example`,
`src/index.ts`, `src/module-conformance.ts`, `package.json`, `tsconfig.json` and
the RFQ SDK source in `vendor/rfq-service` when generated from this repository.
`create` refuses to overwrite an existing target directory.
For an unpublished source checkout, `create` also writes
`vendor/corner-store-cli.tgz`, so the generated project does not depend on a
registry-published CLI.

Inside a generated project:

```sh
npm install
npm test
npm run doctor
npm run deploy
npm run verify   # after a deployment artifact exists
```

`npm test` builds the generated TypeScript and runs
`corner-store test-module dist/module-conformance.js`. `npm run deploy` is a
dry-run by default; pass `-- --broadcast` only for a local/demo transaction
submission. `npm run verify` requires the configured deployment artifact.

### Integration modes

| mode | purpose | notes |
| --- | --- | --- |
| `library-only` | import RFQ SDK helpers without generating a service | no HTTP server, no Docker |
| `reference-service` | run a minimal local `POST /rfq/quote` service | fixed-rate pricing, noop risk and in-memory nonce are reference modules |
| `existing-backend` | add Corner Store RFQ quote creation to an existing backend | exposes `createCornerStoreRFQ(...)` for caller-owned HTTP/RPC/queue handling |

Docker Compose is optional and only valid for `reference-service`. Compose reads
`.env`; generated files include empty secret slots only.

### Unified commands

```
corner-store create <target> [--mode library-only|reference-service|existing-backend] [--docker] [--sdk <specifier>] [--cli <specifier>]
corner-store init [path]
corner-store doctor [path]
corner-store deploy [path] [--broadcast]
corner-store verify [path]
corner-store test-module <built-commonjs-module>
```

`doctor` checks Node, npm, Foundry, config, contract bundle, optional deployment
artifact and optional Docker. `verify` preflights the config against the
deployment artifact. `deploy` uses `DeployStack.s.sol`; Docker is not required.
Packaged deployments resolve contract sources from `--contracts`, then
`CORNER_STORE_CONTRACTS_ROOT`, then `.corner-store/contracts`, then the packaged
`bundle/contracts`.

## Global options

| flag | default | meaning |
| --- | --- | --- |
| `--rpc <url>` | `http://127.0.0.1:8545` | JSON-RPC endpoint |
| `--artifact <path>` | `<repo>/deployments/anvil-e2e.json` | deployment artifact (auto-resolved from the repo root) |
| `--account <0-9>` | command-specific (operator=0, buyer=1) | Anvil mnemonic account index |
| `--key <hex>` | — | explicit private key (overrides `--account`) |

Toolkit workflows use the same versioned config file rather than repeating
profile and venue flags. The `toolkit-*` commands remain available for source
checkout and compatibility workflows:

```sh
corner-store toolkit-init corner-store.config.json
corner-store toolkit-validate corner-store.config.json
corner-store toolkit-simulate corner-store.config.json
corner-store --artifact deployments/anvil-e2e.json toolkit-preflight corner-store.config.json
corner-store --artifact deployments/anvil-e2e.json toolkit-onboard corner-store.config.json
corner-store --artifact deployments/anvil-e2e.json toolkit-checkpoint corner-store.config.json --output deployments/checkpoint.json
corner-store toolkit-proposal --target 0x... --calldata 0x... --reason "policy review" --artifact-hash sha256:... --output proposal.json
corner-store toolkit-safe-proposal --target 0x... --calldata 0x... --reason "policy review" --artifact-hash sha256:... --chain-id 42161
corner-store toolkit-deploy corner-store.config.json                         # dry-run only
corner-store --rpc http://127.0.0.1:8545 toolkit-deploy corner-store.config.json --broadcast # explicit local/demo deployment
corner-store toolkit-test                                                   # full deterministic repository check
```

`toolkit-onboard` always runs the read-only preflight first. A profile or required
venue address mismatch stops before a lifecycle transaction is sent.
`toolkit-checkpoint` writes a secret-free immutable record and refuses to overwrite
an existing deployment id/path.
`toolkit-proposal` only writes a draft for an external multisig; it never signs or
submits the proposal.
`toolkit-safe-proposal` exports the same draft in Safe-compatible format only.
`toolkit-deploy` reuses `DeployStack.s.sol`; without `--broadcast` it only prints the
plan. Production orchestration, signer policy and ownership handoff remain separate.
`toolkit-test` always runs the full repository check rather than a partial user-selected
scope, so Solidity, SDK, CLI, API and dashboard regressions are not hidden.

Admin commands (`onboard`, `manifest`, `attest`, `investor-setup`, `maker`)
default to the operator (account 0). `buy` defaults to the buyer (account 1).
The asset is selected when the stack is deployed. `onboard --profile` and
`investor-setup --profile` reject a value that conflicts with the deployment
artifact, so a BUIDL-like token cannot be rebound to a weaker Reg D manifest.

## Commands

```
corner-store status [address] [--json]           # addresses, manifest, venues, per-element attestation state
corner-store onboard [--profile buidl-like|reg-d] [--engines amm,rfq] # profile must match deployment artifact
corner-store manifest <status|suspend|resume|retire> [--reason <str>]
corner-store attest <element> <subject> [value...]   # element in: sanctions,jurisdiction,accredited,identity,us-tax,qp,asset-class,erc3643,form-d
corner-store investor-setup <addr> [--profile buidl-like|reg-d] [--fund <ether>] # profile attestations + funding
corner-store kyc <addr>                           # ERC-3643 identity + KYC claim (forge script; run from repo root)
corner-store buy <amountIn> [--venue amm|rfq] [--min <amountOut>] [--quote <file>]
corner-store rfq-quote --backend <url> --amount-in X [--taker <addr>] [--expiry <sec>] [--out <file>]
corner-store rfq-quote --maker-account N --amount-in X --amount-out Y [--taker <addr>] [--expiry <sec>] [--out <file>]
corner-store rfq-cancel <nonce> --maker-account N
corner-store maker <approve|revoke> <addr>
corner-store reason <bytes32> [--json]
```

CLI v2 (CLI-002) adds preflight, the sell direction, and observability:

```
corner-store check <buyer> [--venue amm|rfq] [--amount <n>] [--json]   # per-element compliance preflight (no trade) + engine verdict; exit 1 if rejected
corner-store sell <amountIn> [--min <amountOut>]                        # AMM sell (tokenIn=RWA, tokenOut=QUOTE); defaults to investor account 1
corner-store balances [addr...] [--json]                               # RWA/QUOTE balances + adapter allowances (default: the 5 well-known roles)
corner-store watch [--from <block>]                                    # live event tail (Executed/RFQFilled/RFQQuoteCancelled/MakerApprovalSet/Manifest*/ComplianceFlags/SurveillanceFlag); Ctrl-C to stop
corner-store faucet <addr> <amount>                                    # mint QUOTE (MockERC20.mint is permissionless — demo-only)
corner-store snapshot                                                  # anvil evm_snapshot -> prints id
corner-store restore <id>                                              # anvil evm_revert (invalidates later snapshots)
corner-store quote-inspect <file> [--json]                             # decode a signed RFQ quote: recover signer, expiry, on-chain nonce/approval; exit 1 on any failed check
```

`check` screens `ctx.buyer` (the engine is not direction-aware); asset-side
elements (B-01/B-02/E-01) ignore the subject and are labelled as such so a
per-buyer FAIL on them is not misread. `check`/`quote-inspect` exit non-zero when
the verdict is rejected / any check fails, so they compose in scripts.
`snapshot`/`restore` require an anvil-style RPC and error clearly otherwise.

Amounts are given in ether units (18 decimals). Failed transactions exit
non-zero and print the decoded revert; any `ComplianceRejected(bytes32)` is
auto-decoded against the precomputed reason table (`reason` also decodes a code
standalone).

## CLI demo (walkthrough)

Start a live node and deploy the stack. Either run the full E2E and keep the
node, or just deploy:

```sh
scripts/e2e-anvil.sh --profile buidl-like --keep  # default BUIDL-like suite, then leaves Anvil/backend up
# ---- or, for a clean pre-onboarding manifest: ----
anvil --silent &
forge script script/DeployStack.s.sol:DeployStack --rpc-url http://127.0.0.1:8545 --broadcast --offline
```

Then drive a FRESH investor (Anvil account 4,
`0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65`) from the repo root:

```sh
CS="node services/cli/dist/cli/src/index.js"
ACCT4=0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65

$CS status $ACCT4                                  # manifest UNKNOWN, account 4 unattested
$CS onboard                                        # factory: propose -> approve + AMM venue (manifest ACTIVE)
$CS investor-setup $ACCT4                          # artifact profile: Reg D + QP for BUIDL-like + C-01 + QUOTE
$CS kyc $ACCT4                                     # ERC-3643 identity + KYC claim (forge script)
$CS --account 4 buy 5000000                        # AMM buy -> PASS (BUIDL-like minimum)

# element rejection (auto-decoded)
$CS attest jurisdiction $ACCT4 ZZ                  # flip to a disallowed jurisdiction
$CS --account 4 buy 5000000                        # FAIL: recipe 1 / A-02-v1 / Jurisdiction
$CS attest jurisdiction $ACCT4 US                  # restore

# manifest lifecycle
$CS manifest suspend --reason DEMO-SUSPEND
$CS --account 4 buy 5000000                        # FAIL: POLICY / SUSPENDED
$CS manifest resume                               # first call schedules timelocked resume
# after the reported delay:
$CS manifest resume                               # second call executes resume
$CS --account 4 buy 5000000                        # PASS again

# RFQ venue
$CS rfq-quote --backend http://127.0.0.1:8787 --amount-in 5000000 --taker $ACCT4 --out quote.json
# or sign locally without the demo backend:
$CS rfq-quote --maker-account 2 --amount-in 5000000 --amount-out 5000000 --taker $ACCT4 --out quote.json
$CS --account 4 buy 0 --venue rfq --quote quote.json   # PASS (EIP-712 verified on-chain)
$CS maker revoke 0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC
$CS rfq-quote --maker-account 2 --amount-in 5000000 --amount-out 5000000 --taker $ACCT4 --out quote2.json
$CS --account 4 buy 0 --venue rfq --quote quote2.json  # FAIL: RFQMakerNotApproved
```

`kyc` shells out to `script/KycInvestor.s.sol` via `forge script ... --offline
--broadcast` and MUST be able to reach the repo root (the CLI sets forge's cwd
to the repo root automatically). It re-binds to the already-deployed ERC-3643
stack discovered from the artifact's `rwaToken` — no redeploy.

## Accounts (Anvil well-known mnemonic)

0 = deployer/operator, 1 = investor, 2 = RFQ maker (approved), 3 = unapproved
maker. Use account 4+ for a fresh investor walkthrough.

## RFQ integration scaffold

Generate an RFQ integration without copying the demo backend:

```sh
corner-store create ./my-rfq-lib \
  --mode library-only

corner-store create ./my-rfq \
  --mode reference-service --docker

corner-store create ./my-backend-rfq \
  --mode existing-backend

corner-store toolkit-scaffold-rfq ./my-rfq \
  --mode reference-service --docker

corner-store toolkit-scaffold-rfq ./my-backend-rfq \
  --mode existing-backend
```

Inside this repository the CLI vendors the RFQ SDK source into the generated
project, so it builds without a host-specific path or prebuilt SDK `dist`.
Packaged consumers can pass `--sdk <npm|git|file specifier>`. The generator
refuses to overwrite a directory and emits only `.env.example`, never a real
secret.
