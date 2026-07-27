# Corner Store RFQ Demo Dashboard

The primary demo is a user journey with four screens:

- **Dashboard** shows presentation fixtures separately from current-session
  live RFQ and settlement counts, and prepares the local demo environment.
- **RFQ 거래** requests a live firm quote for the BUIDL-like asset.
- **My RFQs** compares the executable quote with visibly disabled preview
  fixtures, then requires review of the exact signed payload before settlement.
- **Portfolio** shows fixture holdings plus the real balance delta produced by
  the current session's Router settlement.

Two advanced views preserve implementation and enforcement evidence:

- **Security proof** signs a quote, revokes the maker, and submits that exact
  stored quote to prove current Router policy rejects it at fill time.
- **Operator view** reads deployment, Manifest and indexed demo events from
  `services/operator-api` through the dashboard's same-origin proxy.

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

Open the printed URL, prepare the environment and follow the four primary
screens. Press Ctrl-C to stop all local services. Use the **?** button in the
dashboard header for the presenter flow, the
security scenario, live-versus-fixture labeling, and a button-to-endpoint map.
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
