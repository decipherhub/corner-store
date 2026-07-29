# Modular SDK Integration

Corner Store is consumed in three layers. Integrators do not need to deploy or
host every repository component.

| Layer | Required | Purpose |
| --- | --- | --- |
| Solidity core and execution interfaces | yes for protected settlement | compliance evaluation, Router enforcement and Adapter contracts |
| RFQ TypeScript SDK | only for RFQ operators | quote shape, EIP-712 binding and replaceable module contracts |
| reference apps and deployment exports | optional | local demo backend, CLI, dashboard and Docker Compose example |

## RFQ Module Contract

`services/rfq` owns the versioned module contract. Each module declares an ID,
semantic version, kind, capabilities, maturity and the names of configuration and
secret inputs. Configuration values and secret material are never included in the
descriptor.

| Kind | Required capability | Replace with |
| --- | --- | --- |
| pricing | `rfq.price.v1` | operator price or market-data service |
| risk | `rfq.risk.pre-sign.v1` | inventory and exposure policy |
| signer | `rfq.sign.eip712.v1` | KMS, HSM or custody signer |
| nonce | `rfq.nonce.maker-scoped.v1` | durable database/Redis allocator |

`createRFQServiceFromModules()` validates all capabilities before creating a
quote service. This backend composition does not decide final compliance.
`ExecutionRouter` and `ComplianceEngine` always evaluate the current state again
when a quote is filled.

## Generate an Integration

Build the CLI, then choose one mode:

```sh
cd services/cli
npm test

node dist/cli/src/index.js toolkit-scaffold-rfq ../../my-rfq \
  --mode reference-service --docker

node dist/cli/src/index.js toolkit-scaffold-rfq ../../my-backend-rfq \
  --mode existing-backend
```

When the CLI runs inside this repository it copies the RFQ SDK source into a
self-contained `vendor/rfq-service` package so the generated project and Docker
context do not depend on an absolute host path or prebuilt `dist`. A packaged
CLI can instead use a published package, Git URL or explicit local package
through `--sdk <specifier>`.

The target directory must not already exist. The generator never overwrites an
existing integration.

## Generated Contract

Every scaffold includes:

- `corner-store.integration.json`: versioned mode and module binding metadata
- `.env.example`: variable names and empty secret slots only
- `src/index.ts`: reference service or existing-backend composition example
- `package.json` and `tsconfig.json`
- `vendor/rfq-service`: self-contained SDK source when generated from this repository
- optional `Dockerfile` and `compose.yaml`

Docker is an export choice, not a required Corner Store runtime. Generated
Compose reads `.env`; it does not embed a signer key, RPC credential or production
secret.

## Conformance

Custom modules must run the same public suite as reference modules:

```ts
import {assertRFQModuleConformance} from "@corner-store/rfq-service";

await assertRFQModuleConformance(modules, fixture);
```

The suite verifies capability declarations, positive base-unit pricing,
maker/domain/field binding, expiry, module order, risk fail-closed behavior,
65-byte signature shape and maker-scoped monotonic nonce behavior.

Passing conformance proves compatibility with the RFQ SDK contract. It does not
certify a pricing model, risk policy, signer custody, persistence durability or
legal compliance for production.
