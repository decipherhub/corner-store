# RFQ MVP Demo Guide

This guide demonstrates the Corner Store MVP without a real TA/Securitize
integration or AMM execution. The run uses the BUIDL-like ERC-3643 profile,
mock TA-seeded investor facts, a local RFQ quote backend and the protected
Router settlement path.

## One-command demo

```sh
scripts/demo.sh --profile buidl-like
```

The launcher starts Anvil, deploys the selected profile, starts the RFQ backend,
starts the read-only Operator API and serves the dashboard. Open the printed URL
and press Ctrl-C to stop all local services.

The command exits non-zero on failure. A successful run proves, in order:

1. the selected asset profile is valid for the deployed stack;
2. the Toolkit preflight and checkpoint accept its configuration;
3. the CLI onboards the ERC-3643 asset and policy Manifest;
4. the RFQ backend creates an EIP-712-signed quote;
5. the CLI settles that quote only through `ExecutionRouter → RFQAdapter`;
6. revoking the maker prevents a newly signed quote from settling.

## Presenter flow

For an interactive session, leave Anvil and the demo backend running:

```sh
scripts/e2e-anvil.sh --profile buidl-like --mode rfq --keep
```

Then start the existing operator dashboard in a second terminal and open
`http://127.0.0.1:8790`:

```sh
npm run start --prefix services/operator-dashboard
```

Select **Trader · RFQ** and click **Check & prepare demo**. Then request a firm
quote, select it for review, and execute the selected quote. The four visible
stages show the mock TA profile, EIP-712 quote, Router policy decision and
on-chain ERC-3643 balance change. The price-context panel marks the live firm
rate returned by the backend. Its comparison curves, spread statistics and
additional makers are presentation fixtures and are labeled accordingly; they
are not executable quotes or an external market-data feed.

Open **Security demo**, create a fresh test quote, then click **Revoke maker &
execute**. The maker approval is changed on chain and the stored quote is
rejected at fill time. The maker deliberately stays revoked so the UI and
Operator event log show the real state transition. Click **Restore maker**
before returning to normal trading. The browser never holds a private key.

The dashboard performs the quote request and Router settlement itself; no CLI
copy/paste is needed for the normal demo. If you prefer the terminal instead,
request and settle a new quote with:

```sh
node services/cli/dist/cli/src/index.js \
  --rpc http://127.0.0.1:8545 \
  --artifact deployments/anvil-e2e.json \
  rfq-quote --backend http://127.0.0.1:8787 --amount-in 5000000 --out quote.json

node services/cli/dist/cli/src/index.js \
  --rpc http://127.0.0.1:8545 \
  --artifact deployments/anvil-e2e.json \
  buy 0 --venue rfq --quote quote.json
```

What to say while showing it:

- “TA/Securitize is represented by a mock trusted source in this MVP; real
  provider integration is intentionally not claimed.”
- “The backend only prices and signs. It cannot approve a transaction.”
- “The settlement contract evaluates the latest policy at fill time, then
  delivers the ERC-3643 token only through the Router.”
- “When the maker is revoked, a newly signed quote is rejected. A signature
  alone is not permission to trade.”

## Scope boundary

This is a local Anvil demonstration. The fixed-price backend, deterministic
maker account and mock TA data are not production services. Production signer
custody, persistent nonce storage, pricing/inventory, real TA integration and
operator authentication remain separate work.
