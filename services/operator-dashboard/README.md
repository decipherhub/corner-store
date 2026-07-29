# Corner Store Operator Dashboard

This dashboard has two modes:

- **Operator view** is a read-only view backed by `services/operator-api` through
  the dashboard's same-origin proxy.
- **RFQ demo** requests a quote from the local `services/rfq-demo-backend`, then
  downloads it and copies the protected CLI settlement command.

- It displays the selected asset profile, enabled venues and indexed events.
- It never accepts or stores a private key.
- It does not submit transactions.
- Governance changes must be prepared as an external multisig proposal and reviewed
  against the deployment artifact before execution.

For the RFQ-first MVP demo, use the one-command launcher:

```sh
scripts/demo.sh --profile buidl-like
```

Open the printed URL and select a view. Press Ctrl-C to stop all local services.
For manual composition, start Operator API on port 8788 or set
`CORNER_STORE_OPERATOR_API` to its URL. If the API uses authentication, set
`CORNER_STORE_API_TOKEN` on the dashboard process; the token stays server side
and is never exposed to the browser.

Production hosting, authentication, CSRF policy and multisig provider
integration remain deployment-specific work.
