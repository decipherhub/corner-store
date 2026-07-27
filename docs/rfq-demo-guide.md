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
and press Ctrl-C to stop all local services. The same presenter sequence and a
button-to-endpoint map are available from the **?** button in the dashboard
header. Non-default ports are supported because the browser uses the dashboard's
same-origin RFQ proxy rather than a hardcoded backend origin.

The command exits non-zero on failure. A successful run proves, in order:

1. the selected asset profile is valid for the deployed stack;
2. the Toolkit preflight and checkpoint accept its configuration;
3. the CLI onboards the ERC-3643 asset and policy Manifest;
4. the RFQ backend creates an EIP-712-signed quote;
5. the dashboard-style API path submits that exact quote through
   `ExecutionRouter → RFQAdapter`;
6. eligible investor B passes and the ineligible investor fails live pre-check;
7. a signed quote for the ineligible investor is rejected by the Router's final
   `ComplianceEngine` evaluation;
8. Admin can change and restore the local QP fixture on chain;
9. revoking the maker prevents a stored signed quote from settling;
10. the backend can settle again after CLI activity without reusing a stale
   account nonce.

## Presenter flow

Use the one-command launcher and open `http://127.0.0.1:8790`.

1. Select **비적격투자자**. Show the failed QP pre-check and run **최종 온체인
   거부 시연** to prove that a signed quote still cannot bypass the Router.
2. Select **적격투자자 A**. Request a fresh quote, compare it with disabled
   preview fixtures and settle it through the Router.
3. Request another eligible quote, switch to **Admin**, revoke Meridian in
   **Maker 관리**, then return to the same eligible wallet and submit the stored
   quote. The final fill-time check rejects it.
4. In **사용자/화이트리스트**, show that QP fixture changes are actual local-chain
   transactions. Restore any changed state before ending the demo.
5. Open **Portfolio** to show that holdings remain readable even when trading is
   blocked.

The additional makers and portfolio valuation are presentation fixtures and
are labeled accordingly; they are not executable quotes, persistent account
data or an external market-data feed.

The browser never holds a private key. Quotes are taker-bound: switching to a
different investor does not transfer ownership of an existing quote. Return to
the original taker or request a fresh quote.

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
