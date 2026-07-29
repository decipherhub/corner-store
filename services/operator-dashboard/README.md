# Corner Store RFQ Demo Dashboard

The primary demo is a role-aware journey. The header switches between Admin and
the wallet personas injected by the selected demo scenario. The tracked default
contains two eligible investors and one ineligible investor. This is a local
Anvil persona selector, not authentication.

- **Dashboard** shows presentation fixtures separately from current-session
  live RFQ and settlement counts, and prepares the local demo environment.
- **RFQ 거래** requests a live firm quote for the scenario asset.
- **My RFQs** compares the executable quote with visibly disabled preview
  fixtures, then requires review of the exact signed payload before settlement.
- **Portfolio** shows the selected wallet's actual local-chain token balance and
  the real balance delta produced by the current session's Router settlement.

Admin gets separate monitoring, user/QP fixture control, maker control,
temporal-eligibility proof and transaction-history screens. Those controls send
real local-chain transactions or advance local Anvil time; they are not cosmetic
browser state.

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
screens. Switch to the ineligible fixture to show pre-check failure and the
explicit final-enforcement proof. Switch to Admin to change QP or maker state.
The temporal proof issues a quote while the configured investor is eligible,
advances Anvil beyond the injected claim freshness window, and then shows the
same still-live quote fail the Router's latest-policy check.
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
