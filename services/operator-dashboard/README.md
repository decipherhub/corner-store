# Corner Store Operator Dashboard

This is a static, read-only operator view for `services/operator-api`.

- It displays the selected asset profile, enabled venues and indexed events.
- It never accepts or stores a private key.
- It does not submit transactions.
- Governance changes must be prepared as an external multisig proposal and reviewed
  against the deployment artifact before execution.

Serve this directory behind the same origin as the read-only API in a local/demo
environment. Production hosting, authentication, CSRF policy and multisig provider
integration remain deployment-specific work.
