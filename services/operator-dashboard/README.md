# Corner Store RFQ Demo Dashboard

The primary demo is a role-aware journey. The header switches between Admin and
the wallet personas injected by the selected demo scenario. The tracked default
contains two eligible investors and one ineligible investor. This is a local
Anvil persona selector, not authentication.

- **Dashboard** shows presentation fixtures separately from current-session
  live RFQ and settlement counts, and prepares the local demo environment.
- **RFQ 거래** requests either a buy quote (settlement asset → RWA) or a sell
  quote (RWA → settlement asset).
- **My RFQs** keeps every quote requested during the browser session, but a user
  sees only records whose signed taker is the currently selected wallet. Admin
  may see the complete session. Users can reopen the exact taker-bound signed
  payload and separately see quoted, settled, rejected and expired requests.
- **Portfolio** shows both actual local-chain balances and the opposite RWA /
  settlement-asset deltas produced by each Router settlement.

Admin gets separate monitoring, user/QP fixture control, a single configured
Maker approval-revocation proof and transaction-history screens. The Maker
screen is not multi-maker onboarding or dealer administration. Post-quote claim
expiry is available only as a staged Enforcement Case, not as a duplicate
standalone control. These controls send real local-chain transactions or advance
local Anvil time; they are not cosmetic browser state.

**Enforcement Cases** is the operator investigation workspace. It treats direct
Adapter calls, post-quote claim expiry and post-quote Maker revocation as
separate cases. The operator prepares a baseline, issues the relevant quote,
changes policy state, submits the execution and reviews the resulting failed
receipt, rejection code, unchanged balances and trace before restoring state.
The stages are deliberately separate; there is no “run every proof” button.

The executable flow requests a live firm quote, lets the trader review the exact
signed payload, and settles that same quote through the protected Router.
Additional maker rows are explicitly preview fixtures until multi-maker backend
support exists. The UI does not claim an external market-data feed.

- It displays the selected asset profile, enabled venues and indexed events.
- It displays the deployment artifact and the read-only Manifest snapshot generated
  after demo onboarding.
- It never accepts or stores a private key.
- It submits only the local demo transaction through the backend; it does not
  hold a private key or expose one to the browser.
- **Check & prepare demo**, maker revoke and maker restore are connected to the
  local demo backend and show the resulting on-chain state; they are not
  cosmetic dashboard state changes.
- Governance changes must be prepared as an external multisig proposal and reviewed
  against the deployment artifact before execution.

For the RFQ-first MVP demo, use the one-command launcher:

```sh
scripts/demo.sh --profile buidl-like
```

Use `--scenario /path/to/scenario.json` to replace presentation values, wallet
personas and initial QP states, preview rows, and temporal-expiry parameters
without editing frontend code. Addresses remain bound to the fresh deployment
artifact and deterministic funded Anvil accounts.

Open the printed URL, prepare the environment and follow the four primary
screens. Toggle **매수 / 매도** before requesting a quote; either direction can
run first because the deployment seeds both sides of the demo inventory. Switch
to the ineligible fixture to show pre-check failure and the
explicit final-enforcement proof. Switch to Admin to change QP or maker state.
The temporal proof ages only the configured target investor's claim while
preserving the global freshness policy and every other investor claim. Preparing
the case leaves the target eligible for ten minutes. It then issues a one-hour
quote, advances Anvil by fifteen minutes and shows that same still-live quote
fail the Router's latest-policy check. Other eligible investors remain usable as
the control group.
The user market chart intentionally provides one full-history view. Successful
Router fills expose side, exact execution price, amount and time on hover/focus;
rejected requests never become fill points or volume.
Use **Enforcement Cases** when the audience needs durable execution evidence
rather than only the trader-facing rejection message.
Press Ctrl-C to stop all local services. Use the **?** button for the presenter
sequence and the taker-binding warning.
The launcher refuses to start when one of its ports is already occupied instead
of accidentally attaching to a stale local process. Browser RFQ calls use the
dashboard's `/rfq-api` same-origin proxy, so custom launcher ports do not require
editing frontend source or weakening backend CORS.

For manual composition, start Operator API on port 8788 and set
`CORNER_STORE_OPERATOR_API` to its URL. If the API uses authentication, set
`CORNER_STORE_API_TOKEN` on the dashboard process; the token stays server side
and is never exposed to the browser.

Set `CORNER_STORE_MANIFEST` on the Operator API to the onboarding snapshot path
when running the API manually.

Production hosting, authentication, CSRF policy and multisig provider
integration remain deployment-specific work.
