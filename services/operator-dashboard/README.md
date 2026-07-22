# Corner Store Operator Dashboard

This dashboard has two modes:

- **Operator view** is a read-only view backed by `services/operator-api` through
  the dashboard's same-origin proxy.
- **RFQ demo** requests a live firm quote, lets the trader review the exact
  signed payload, and settles that same quote through the protected Router.
  Additional maker rows are explicitly preview fixtures until multi-maker
  backend support exists.
- **Security demo** is an independent flow: create a signed quote, revoke the
  maker, and submit the stored quote to prove the Router rejects it at fill
  time. It does not require first visiting the Trader view.

- It displays the selected asset profile, enabled venues and indexed events.
- It displays the deployment artifact and the read-only Manifest snapshot generated
  after demo onboarding.
- It never accepts or stores a private key.
- It submits only the local demo transaction through the backend; it does not
  hold a private key or expose one to the browser.
- Governance changes must be prepared as an external multisig proposal and reviewed
  against the deployment artifact before execution.

For the RFQ-first MVP demo, use the one-command launcher:

```sh
scripts/demo.sh --profile buidl-like
```

Open the printed URL and select a view. Press Ctrl-C to stop all local services.
For manual composition, start Operator API on port 8788 and set
`CORNER_STORE_OPERATOR_API` to its URL. If the API uses authentication, set
`CORNER_STORE_API_TOKEN` on the dashboard process; the token stays server side
and is never exposed to the browser.

Set `CORNER_STORE_MANIFEST` on the Operator API to the onboarding snapshot path
when running the API manually.

Production hosting, authentication, CSRF policy and multisig provider
integration remain deployment-specific work.
