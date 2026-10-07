# Public Testnet RFQ Deployment

## Purpose

This runbook deploys a working, RFQ-only Corner Store reference stack to a
public EVM testnet for hackathon review. It creates:

- a real T-REX ERC-3643 token and ONCHAINID registry fixture;
- mock Trusted Issuer KYC claims for externally supplied test wallets;
- the Corner Store Element, Recipe, Manifest, Engine and Router contracts;
- the RFQ adapter, maker authorizer and RFQ venue;
- an unregulated test quote token and initial two-way inventory;
- an active BUIDL-like reference Manifest with one approved maker.

The deployment proves the protocol on a public chain. It is **not** a production
issuer onboarding, legal approval, real BUIDL deployment or Securitize
integration.

The existing local Anvil scripts remain unchanged:

- `script/DeployStack.s.sol`
- `scripts/e2e-anvil.sh`
- `scripts/showcase.sh`

## Security Boundaries

- The deployer signs with a Foundry keystore or Ledger. No deployment private
  key is read from a repository config.
- `CORNER_STORE_TESTNET_ISSUER_KEY` signs mock ONCHAINID claim payloads during
  deployment. It is a disposable test fixture secret, not a production TA key.
- Maker and investor addresses are external wallets. The deployment script
  mints test inventory to them but cannot approve tokens on their behalf.
- Every participant must separately approve the deployed RFQ adapter.
- Browser-triggered public-network deployment remains disabled.
- Mainnet and legally approved ERC-3643 onboarding continue to use
  [`deployment-production.md`](./deployment-production.md).

## 1. Choose the Testnet

Obtain the official values from the hackathon or network operator:

- RPC URL;
- chain ID;
- explorer and source-verification method;
- faucet;
- per-transaction and block gas limits.

Do not infer these values from the network name. The deployment wrapper checks
that the RPC-reported chain ID exactly matches `--chain-id`.

### Monad Onchain Finance hackathon profile

The current official Monad developer resources list the following public
testnet values. Re-check them before broadcast because public endpoints can
change:

| Input | Value |
| --- | --- |
| network | Monad Testnet |
| chain ID | `10143` |
| public RPC | `https://testnet-rpc.monad.xyz` |
| explorer | `https://testnet.monadexplorer.com` |
| faucet | `https://faucet.monad.xyz` |

The verified [`monad-developers`](https://github.com/monad-developers)
organization links the canonical docs, testnet hub, faucet and explorer. Before
loading any signer, run the read-only preflight:

```sh
scripts/preflight-monad-hackathon.sh
```

After loading the local deployment environment, add `--deployment-ready` to
validate required inputs, distinct actor addresses and a non-zero deployer gas
balance without printing any secret value.

Use a unique append-only deployment id for the hackathon record:

```sh
export CORNER_STORE_DEPLOYMENT_ID=monad-onchain-finance-rfq-v1
export CORNER_STORE_TESTNET_INVESTOR_B_HOLDING_PERIOD_PENDING=true
export CORNER_STORE_TESTNET_TOKEN_NAME="Mock Restricted Stock"
export CORNER_STORE_TESTNET_TOKEN_SYMBOL=mRSTK
# Optional fourth scene:
export CORNER_STORE_TESTNET_EXPIRED_INVESTOR=0x...
```

Do not put a faucet wallet key, Maker key or credential-bearing fallback RPC in
the deployment artifact or repository config.

The optional investor-B flag changes only that wallet's acquisition clock. It
creates a deterministic Sell rejection with an onchain-derived availability
time while leaving the existing GIWA and default public-testnet fixture
behavior unchanged.

When `CORNER_STORE_TESTNET_EXPIRED_INVESTOR` is present, the fixture registers
that separate wallet with valid mock identity wiring and a QP claim whose
`verifiedAt` is 366 days before deployment. The default one-year freshness cap
therefore produces `FAIL_QP_CLAIM_EXPIRED` without changing the cap for other
wallets. The wallet must be unique; omitting it preserves older deployment
inputs and disables only the fourth judge scene.

## 2. Prepare Wallets

Prepare five required externally controlled wallets and one optional scenario
wallet:

| Wallet | Purpose | Needs native test gas |
| --- | --- | --- |
| deployer | deploys and initializes the reference stack | yes, substantial |
| maker | signs quotes, supplies RWA/quote inventory | yes |
| eligible investor A | normal success scenario | yes |
| eligible investor B | holding-period scenario when the optional flag is enabled | yes |
| ineligible investor | rejection scenario | yes |
| expired-claim investor | optional claim-expiry pre-check | no transaction required |

Governance and operator may equal the deployer for a short-lived hackathon
fixture. They should be separate controlled addresses for longer-lived
environments. Control-plane addresses must not be reused as maker or investor
addresses.

Import only the deployer into a Foundry keystore:

```sh
cast wallet import corner-store-testnet --interactive
```

Participant wallets can use their existing wallet software. They do not need to
expose keys to the deployment script.

## 3. Configure Runtime Inputs

From the repository root:

```sh
cp .env.testnet.example .env.testnet
```

Fill the blank values locally, then load them without committing the file:

```sh
set -a
source .env.testnet
set +a
```

Generate a disposable mock issuer key with an approved secret-generation tool
and place it only in `CORNER_STORE_TESTNET_ISSUER_KEY`. The issuer wallet does
not need native gas because it signs claim payloads off-chain during the
deployment script.

## 4. Build and Simulate

Run the wrapper without `--broadcast` first:

```sh
scripts/deploy-testnet-rfq.sh \
  --rpc-url "$RPC_URL" \
  --chain-id "$CHAIN_ID" \
  --account corner-store-testnet
```

This executes a Foundry simulation. Review the contract list, sender, gas
estimate and target chain before continuing.

## 5. Broadcast

```sh
scripts/deploy-testnet-rfq.sh \
  --rpc-url "$RPC_URL" \
  --chain-id "$CHAIN_ID" \
  --account corner-store-testnet \
  --broadcast
```

For a Ledger, replace `--account corner-store-testnet` with `--ledger`.
CI or an isolated operator machine may instead use
`--keystore /secure/path/key.json --password-file /secure/path/password`; keep
both files outside the repository.

The script writes an append-only, commit-safe public deployment artifact:

```text
deployments/public/<deployment-id>-<chain-id>.json
```

The artifact records chain ID, actors, every named protocol/identity address,
the exact checked-out source commit, the full Foundry deployment transaction
list, and a `deployedContracts` index. It never contains private keys or RPC
credentials. Broadcast refuses a dirty worktree or a source-commit override
that differs from `HEAD`. The wrapper enriches a private candidate, verifies
that complete candidate against the chain, and then publishes it atomically to
`deployments/public/`; failed or partial broadcasts cannot become published
deployment records.

The wrapper uses Foundry's sequential broadcast mode because this fixture emits
many dependent initialization and governance-handoff transactions. This is
slower than batch submission but avoids public-RPC nonce propagation races.

Do not reuse a deployment ID on the same chain. The wrapper refuses to
overwrite an existing public record. List every recorded deployment and its
main addresses at any time:

```sh
scripts/list-testnet-deployments.sh
scripts/list-testnet-deployments.sh --json
```

## 6. Approve Participant Inventory

The maker and every investor that will trade must run the approval script with
their own signer. Example for a Foundry keystore:

```sh
CORNER_STORE_ARTIFACT=deployments/public/<deployment-id>-<chain-id>.json \
forge script script/ApproveTestnetRFQ.s.sol:ApproveTestnetRFQ \
  --rpc-url "$RPC_URL" \
  --chain-id "$CHAIN_ID" \
  --account <participant-keystore> \
  --broadcast
```

The script grants the exact deployed RFQ adapter allowance for both the RWA and
quote token. It does not transfer inventory or change compliance claims.

## 7. Verify On-chain Readiness

Before approvals, verify deployment and activation:

```sh
CORNER_STORE_ARTIFACT=deployments/public/<deployment-id>-<chain-id>.json \
forge script script/VerifyTestnetRFQ.s.sol:VerifyTestnetRFQ \
  --rpc-url "$RPC_URL" \
  --chain-id "$CHAIN_ID"
```

After the maker and primary investor approve:

```sh
CORNER_STORE_ARTIFACT=deployments/public/<deployment-id>-<chain-id>.json \
CORNER_STORE_REQUIRE_APPROVALS=true \
forge script script/VerifyTestnetRFQ.s.sol:VerifyTestnetRFQ \
  --rpc-url "$RPC_URL" \
  --chain-id "$CHAIN_ID"
```

The verifier fails closed on:

- chain/artifact mismatch;
- missing runtime code;
- governance ownership mismatch;
- missing operator authorization;
- Engine, policy registry, Router, selector, venue registry or RFQ adapter
  wiring that differs from the artifact;
- inactive Manifest or RFQ venue;
- RFQ venue type or adapter mismatch;
- unapproved maker;
- missing maker/investor inventory;
- an optional expired-claim wallet whose identity, inventory or exact QP expiry
  result does not match the published fixture;
- missing allowances when requested.

## 8. Explorer Source Verification

If the selected explorer is supported by Foundry, set its API key in the
environment and add `--verify` to the broadcast command:

```sh
export ETHERSCAN_API_KEY=...

scripts/deploy-testnet-rfq.sh \
  --rpc-url "$RPC_URL" \
  --chain-id "$CHAIN_ID" \
  --account corner-store-testnet \
  --broadcast \
  --verify
```

GIWA Sepolia uses Blockscout and requires its official verifier endpoint:

```sh
export BLOCKSCOUT_API_URL=https://sepolia-explorer.giwa.io/api

scripts/deploy-testnet-rfq.sh \
  --rpc-url "$RPC_URL" \
  --chain-id "$CHAIN_ID" \
  --account corner-store-giwa \
  --broadcast \
  --verify \
  --verifier blockscout \
  --verifier-url "$BLOCKSCOUT_API_URL"
```

Other custom explorers may require a different verifier URL or Sourcify. Use
the network's official instructions; never commit explorer credentials.

## Deployment Outputs for a Hackathon Submission

Publish:

- network name and chain ID;
- deployment transaction hashes;
- verified contract links;
- `rwaToken`, `router`, `engine`, `rfqAdapter` and `makerAuthorizer` addresses;
- the non-secret deployment artifact;
- one successful Router RFQ transaction;
- expected rejection transactions or simulation evidence;
- an explicit statement that the TA, claims, quote asset and inventory are
  public-testnet fixtures.

The public-testnet demo runtime that consumes this artifact is maintained as a
separate integration surface. The local Anvil demo does not silently switch to
public networks.

## 9. Run the Artifact-bound Browser Demo

After the public artifact is committed and participant allowances are ready,
load the same `.env.testnet` and set:

```sh
export CORNER_STORE_TESTNET_ARTIFACT=deployments/public/<deployment-id>-<chain-id>.json
export CORNER_STORE_TESTNET_RPC_URL=https://...
export CORNER_STORE_TESTNET_EXPLORER_URL=https://...
export CORNER_STORE_TESTNET_MAKER_KEY=... # disposable testnet Maker only
```

Then run:

```sh
scripts/run-testnet-rfq-demo.sh
```

Open the printed URL and connect an artifact-listed investor wallet. Before it
listens, the runtime checks the artifact schema and chain plus runtime code,
governance owners, operator roles, core contract wiring, RFQ venue activation,
maker approval and fixture inventory. The backend signs a
Maker quote using the existing RFQ SDK; it does **not** sign for the investor.
The browser wallet submits its own token approval and final Router transaction.
The page exposes the exact artifact addresses, current Manifest/Maker
readiness, balances, QP pre-check, signed quote, transaction hash and block.
It also renders the non-secret judge scenario addresses and measures wallet
transaction confirmation time from submission to receipt. Test-wallet secrets
must be delivered out of band and are never rendered by the service.
For chain ID 10143 the page shows the official Monad testnet wallet settings;
the backend's configured RPC URL remains private and is never returned.
After a successful Router settlement, download the generated JSON evidence. It
binds the deployment/source commit, chain, public wallet and contract addresses,
amounts, transaction hash, block and measured submission-to-confirmation time.
Review the file before attaching it to the hackathon submission; it contains no
private key, RPC URL or quote signature.
When a pre-check is rejected, the page also presents a plain-language reason,
the required user/operator action and an unlock or evidence-expiry time only
when those values can be derived from current chain evidence.
Holding-period countdowns advance from the latest observed chain timestamp,
not the judge browser's local clock.

For an external judge URL, keep this Node service on a private application
port behind an HTTPS reverse proxy. The public edge must enforce a bounded
request rate and body size; the disposable Maker key remains available only to
the server process. Do not expose the Maker environment, artifact filesystem or
RPC credentials as static assets.

`GET /health` verifies that the process can still read the configured chain and
returns the latest observed block number; it does not expose local paths or
credentials.

The repository includes a portable non-root/read-only OCI target and Compose
contract for this boundary. The container consumes the verified artifact and a
Docker secret at runtime; neither is copied into the image:

```sh
export CORNER_STORE_TESTNET_ARTIFACT="$PWD/deployments/public/<deployment-id>-10143.json"
export CORNER_STORE_TESTNET_RPC_URL=https://testnet-rpc.monad.xyz
export CORNER_STORE_TESTNET_EXPLORER_URL=https://testnet.monadexplorer.com
export CORNER_STORE_TESTNET_MAKER_KEY_FILE=/secure/path/disposable-maker-key

docker compose -f deploy/hackathon-monad/compose.example.yaml up --build -d
curl --fail http://127.0.0.1:8791/health
```

Terminate HTTPS at the selected hosting platform or reverse proxy and forward
only to port 8791. The application enforces a 16 KiB request limit, bounded
request/header/keep-alive timeouts, a global budget for every chain-reading
`/health` or `/api/*` request, a stricter global signed-quote budget, browser
security headers and an explicit `hackathon-testnet-only` acknowledgement for
non-loopback binding. Because the application deliberately does not trust
forwarded client-IP headers, the HTTPS edge must add its own client-aware rate
limit. These are demo safeguards, not a replacement for the production RFQ
host.

This is separate from the feature-rich local Anvil demo:

- `scripts/showcase.sh` remains the deterministic presenter/security demo;
- `scripts/run-testnet-rfq-demo.sh` proves that a committed public deployment
  can be consumed without deploying a second stack;
- no local account derivation, operator mutation or private investor key is
  available to the public-testnet service.
