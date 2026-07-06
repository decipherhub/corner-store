# corner-store CLI (CLI-001)

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
```

`node_modules/` and `dist/` are gitignored. Chain interaction uses `ethers`;
EIP-712 RFQ quotes REUSE the sibling `services/rfq` signer library.

## Global options

| flag | default | meaning |
| --- | --- | --- |
| `--rpc <url>` | `http://127.0.0.1:8545` | JSON-RPC endpoint |
| `--artifact <path>` | `<repo>/deployments/anvil-e2e.json` | deployment artifact (auto-resolved from the repo root) |
| `--account <0-9>` | command-specific (operator=0, buyer=1) | Anvil mnemonic account index |
| `--key <hex>` | — | explicit private key (overrides `--account`) |

Admin commands (`onboard`, `manifest`, `attest`, `investor-setup`, `maker`)
default to the operator (account 0). `buy` defaults to the buyer (account 1).

## Commands

```
corner-store status [address] [--json]           # addresses, manifest, venues, per-element attestation state
corner-store onboard [--engines amm,rfq]         # factory one-call onboarding (retires+re-onboards if ACTIVE)
corner-store manifest <status|suspend|resume|retire> [--reason <str>]
corner-store attest <element> <subject> [value...]   # element in: sanctions,jurisdiction,accredited,identity,us-tax,qp,asset-class,erc3643,form-d
corner-store investor-setup <addr> [--fund <ether>]  # Reg D happy-path attestations + C-01 seed + QUOTE funding
corner-store kyc <addr>                           # ERC-3643 identity + KYC claim (forge script; run from repo root)
corner-store buy <amountIn> [--venue amm|rfq] [--min <amountOut>] [--quote <file>]
corner-store rfq-quote --maker-account N --amount-in X --amount-out Y [--taker <addr>] [--expiry <sec>] [--out <file>]
corner-store rfq-cancel <nonce> --maker-account N
corner-store maker <approve|revoke> <addr>
corner-store reason <bytes32> [--json]
```

Amounts are given in ether units (18 decimals). Failed transactions exit
non-zero and print the decoded revert; any `ComplianceRejected(bytes32)` is
auto-decoded against the precomputed reason table (`reason` also decodes a code
standalone).

## CLI demo (walkthrough)

Start a live node and deploy the stack. Either run the full E2E and keep the
node, or just deploy:

```sh
scripts/e2e-anvil.sh --keep                       # full suite, then leaves Anvil up
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
$CS investor-setup $ACCT4                          # jurisdiction/identity/accredited/sanctions + C-01 seed + QUOTE
$CS kyc $ACCT4                                     # ERC-3643 identity + KYC claim (forge script)
$CS --account 4 buy 100                            # AMM buy -> PASS (+100 RWA)

# element rejection (auto-decoded)
$CS attest jurisdiction $ACCT4 ZZ                  # flip to a disallowed jurisdiction
$CS --account 4 buy 100                            # FAIL: ComplianceRejected -> recipe 1 / A-02-v1 / Jurisdiction
$CS attest jurisdiction $ACCT4 US                  # restore

# manifest lifecycle
$CS manifest suspend --reason DEMO-SUSPEND
$CS --account 4 buy 100                            # FAIL: ComplianceRejected -> POLICY / SUSPENDED
$CS manifest resume
$CS --account 4 buy 100                            # PASS again

# RFQ venue
$CS rfq-quote --maker-account 2 --amount-in 120 --amount-out 200 --taker $ACCT4 --out quote.json
$CS --account 4 buy 0 --venue rfq --quote quote.json   # PASS (+200 RWA, EIP-712 verified on-chain)
$CS maker revoke 0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC
$CS rfq-quote --maker-account 2 --amount-in 120 --amount-out 200 --taker $ACCT4 --out quote2.json
$CS --account 4 buy 0 --venue rfq --quote quote2.json  # FAIL: RFQMakerNotApproved
```

`kyc` shells out to `script/KycInvestor.s.sol` via `forge script ... --offline
--broadcast` and MUST be able to reach the repo root (the CLI sets forge's cwd
to the repo root automatically). It re-binds to the already-deployed ERC-3643
stack discovered from the artifact's `rwaToken` — no redeploy.

## Accounts (Anvil well-known mnemonic)

0 = deployer/operator, 1 = investor, 2 = RFQ maker (approved), 3 = unapproved
maker. Use account 4+ for a fresh investor walkthrough.
