# RFQ PostgreSQL dependency review

Reviewed: 2026-11-21

| Package | Pinned version | License | Upstream | Purpose | Maintenance assessment |
| --- | --- | --- | --- | --- | --- |
| `pg` | `8.23.1` | MIT | `brianc/node-postgres` / npm `pg` | PostgreSQL protocol, pooling and transactions in the optional adapter | Current maintained release; isolated from core/runtime packages that do not select PostgreSQL |
| `@types/pg` | `8.23.1` | MIT | DefinitelyTyped / npm `@types/pg` | Compile-time types only | Version-aligned development dependency |

`typescript` and `@types/node` reuse the repository's existing build-tool choices. The
lockfile pins the full transitive graph. `npm audit` reported zero known vulnerabilities at
review time. No dependency code is copied into Solidity, browser, CLI or the core RFQ SDK.

Re-review the direct packages, licenses, maintenance status and transitive lock whenever
`services/rfq-postgres/package-lock.json` changes.
