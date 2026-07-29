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

The default presenter data is injected from
`services/rfq-demo-backend/config/demo-scenario.json`. To use another local test
set without editing the dashboard or backend:

```sh
scripts/demo.sh --profile buidl-like --scenario /path/to/scenario.json
```

The schema-v2 scenario supplies deployment account bindings, initial
investor/maker/pool balances, an initial mock price plus per-fill price impact,
buy/sell defaults and TTL,
plus labels, reference values, minimum base units, wallet personas, initial QP
states, preview quotes and temporal-expiry values. Contract addresses still come
from the fresh deployment artifact and wallet mappings are verified against
deterministic funded Anvil signers. The deployment artifact binds the exact
scenario hash, so the backend cannot silently use different test data.
Each successful buy moves the mock reference price up and each successful sell
moves it down by the scenario's `impactBpsPerFill`. Rejected trades do not move
the market. A new `/demo/setup` resets the price to the injected initial ratio.
The user Dashboard plots the scenario's mock NAV/oracle and indicative-mid
history, an indicative spread band, and actual Router fills as separate layers.
Only successful fills contribute to the displayed live volume.
After every fill, the backend recalculates `suggestedTradeAmounts` from the live
price, the asset minimum and `minimumTradeBufferBps`. A new RFQ or buy/sell
switch uses that suggestion, while a manually entered smaller amount still
demonstrates the minimum-investment rejection. Rapid fills keep their actual
timestamps in tooltips but are spaced by execution order, and the chart keeps a
stable minimum price range to avoid exaggerating small mock movements.
Use the `1분`, `5분`, `1시간`, and `전체` controls to change the visible window.
Each successful Router fill is annotated with its buy/sell side and execution
price. The fill tape below the chart shows the exact RWA amount, chain timestamp,
and transaction hash; fixture NAV and indicative lines never appear in that tape.
The default fixture retains hourly price anchors but samples the path every minute,
so each visible window contains a genuinely different number of observations.
The injected investor and maker balances are intentionally sized for repeated
minimum-size buys and sells during a single presentation.

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
8. Admin can change the local Trusted-Issuer claim facts on chain, while the
   A-13 Element independently derives and restores the QP result;
9. revoking the maker prevents a stored signed quote from settling;
10. a quote-time eligible investor becomes ineligible after the injected claim
    freshness window, and the still-live quote is rejected at Router fill time;
11. the backend can settle again after CLI activity without reusing a stale
   account nonce.
12. a direct `RFQAdapter.execute` transaction is mined with status `0`, and the
    caller's RWA and settlement balances remain unchanged.

## Enforcement case workflow

Switch to **Admin → Enforcement Cases** for the operator-facing proof workflow.
This is intentionally not a one-click demo. Open one case and execute its
controls in order:

1. **기준 상태 준비** records or restores the current wallet, maker and policy
   baseline.
2. **Firm quote 발급** creates the exact taker-bound quote to be tested. Direct
   Adapter cases skip this step because no valid settlement quote is needed.
3. **정책 상태 변경** expires the configured claim or revokes the Maker after
   quote issuance.
4. **실행 요청 제출** sends a real local transaction. The expected result is a
   mined status-`0` receipt, not a browser-only warning.
5. Review the rejection, reasonCode or selector, failed transaction, execution
   trace and before/after balances.
6. **케이스 종료 및 상태 복구** restores mutable demo state before another
   scenario.

The architecture strip explains which policy binding and execution boundary is
under test. The comparison table does not claim that Corner Store replaces
ERC-3643 token transfer enforcement: it shows the additional Router/Adapter
controls required for the supported DEX execution path.

## Presenter flow

Use the one-command launcher and open `http://127.0.0.1:8790`.

1. Select **비적격투자자**. Show the failed QP pre-check and run **최종 온체인
   거부 시연** to prove that a signed quote still cannot bypass the Router.
2. Select **적격투자자 A**. Request a fresh quote, compare it with disabled
   preview fixtures and settle it through the Router.
3. Request another eligible quote, switch to **Admin**, revoke Meridian in
   **Maker 관리**, then return to the same eligible wallet and submit the stored
   quote. The final fill-time check rejects it.
4. In **투자자 Claim 관리**, change the QP basis, issuer trust, signature or
   look-through facts. Show that Admin never sets an eligibility result:
   the A-13 Element recomputes it from the recorded claim. Restore the original
   claim facts before ending the demo.
5. For the temporal proof, click **만료 데모 준비**, switch to the configured
   target investor, request a quote, then return to Admin and click **시간
   경과시키기**. Return to the same investor and submit the stored quote. The
   quote TTL is still live, but the final Router check rejects the expired QP
   claim.
6. Open **Portfolio** to show that holdings remain readable even when trading is
   blocked.
7. For the strongest operator proof, open **Enforcement Cases** and run the
   three cases separately. Keep the failed receipt and unchanged-balance panel
   visible while explaining the control that rejected the request.

The additional makers and portfolio valuation are presentation fixtures and
are labeled accordingly; they are not executable quotes, persistent account
data or an external market-data feed. Investor and maker inventory shown by the
dashboard is live `balanceOf` data from the deployed tokens.

The browser never holds a private key. Quotes are taker-bound: switching to a
different investor does not transfer ownership of an existing quote. Return to
the original taker or request a fresh quote.

The dashboard performs the quote request and Router settlement itself; no CLI
copy/paste is needed for the normal demo. If you prefer the terminal instead,
request and settle a new quote with the tracked default scenario amount:

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
- “Eligibility is time-sensitive. Passing pre-check or receiving a quote does
  not reserve eligibility; the Router checks the current claim again at fill.”

## Scope boundary

This is a local Anvil demonstration. The scenario is a replaceable mock data
provider, not a production database. The fixed-price backend, deterministic
Anvil accounts and injected mock TA scenario are not production services.
Production signer custody, persistent nonce storage, pricing/inventory, real TA
integration and operator authentication remain separate work.
