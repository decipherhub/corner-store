# Corner Store Operator API

This service exposes authenticated, read-only snapshots of reviewed Corner
Store configuration, deployment artifacts, optional Manifest evidence and an
optional finality-aware event snapshot. It is not a governance, signing,
deployment or transaction-submission service.

`src/index.ts` is the compatibility/reference entrypoint. Production operators
must use `npm run start:production`, which requires exact versioned environment
configuration, an authentication token mounted as a file, mandatory config and
deployment artifacts, separated liveness/readiness and bounded graceful
shutdown. It refuses a public bind without explicit acknowledgement.

See [`../../docs/production-containers.md`](../../docs/production-containers.md)
for the environment schema, image build, runtime hardening and operator-owned
controls.

```sh
npm test
```
