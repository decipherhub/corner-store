# Deployment Studio

## Purpose

Deployment Studio visualizes the existing Corner Store standalone workflow
without creating a second deployment schema:

```text
create
  -> corner-store.config.json
  -> corner-store.integration.json
  -> corner-store.scenario.json (demo only)
  -> doctor
  -> deployment dry-run
  -> guarded local Anvil broadcast
  -> deployment artifact
  -> verify
  -> Operations Dashboard
```

`services/toolkit` remains the schema and validation owner. `services/cli`
remains the command/deployment adapter. The Studio Local Control API confines
project writes to one configured workspace and exposes structured results to a
same-origin browser UI.

## Configuration ownership

| Input | Owner | Studio behavior |
| --- | --- | --- |
| Toolkit config | `corner-store.config.json` | validated and persisted through the Toolkit schema |
| RFQ module binding | `corner-store.integration.json` | capability-validated; environment variable names only |
| demo fixtures | `corner-store.scenario.json` | visually isolated from production configuration |
| RPC endpoint | runtime/process configuration | entered or injected; not forced into Toolkit config |
| service host/port | runtime/process configuration | injected through environment variables |
| deployment addresses | configured deployment artifact | read-only source of truth after broadcast |

## Guided configuration semantics

The three integration modes describe how the generated project enters an
integrator's runtime; they do not select different Solidity stacks:

- `library-only` provides SDK/module boundaries without generating an HTTP
  service;
- `reference-service` provides the minimal replaceable RFQ HTTP service and an
  optional Docker reference;
- `existing-backend` keeps an integrator's API, authentication, database and
  deployment boundary while binding Corner Store module capabilities.

The network selector contains local, public testnet, Arbitrum and organization
EVM examples such as GIWA. A preset is a configuration aid, not a claim that a
production chain has been certified. Direct Studio broadcast is hard-limited
to the Anvil demo profile plus the operator RPC allowlist; changing the runtime
network setting cannot enable Arbitrum, GIWA or another production target.
Every non-Anvil target remains configuration and dry-run review only.

The `operator`, `investor`, `maker` and governance fields are role labels in the
current Toolkit config. They are not browser signer inputs. The reference
`DeployStack` obtains funded Anvil accounts from the demo scenario, while a
future production adapter must bind real addresses, external signer custody and
multisig authority.

RFQ module controls expose known reference IDs and explicit custom adapter
slots. Selecting or entering a module ID does not download executable code.
Custom runtimes must provide implementations that satisfy the listed
capability. The activation controls are a manual evidence checklist and do not
execute Maker approval, signer authorization, token allowance or governance
transactions.

The Studio does not render secret-value fields. The initial RPC, direct-broadcast
network, allowed RPC hosts, Operations URL, workspace and CLI entry are server
runtime inputs rather than frontend constants.

Use `scripts/studio.sh` to inject these values as flags or environment variables.
The browser talks only to same-origin `/api/v1/*` routes, so changing the Studio
bind address or reverse-proxy route does not require rebuilding frontend assets.

## Safety gates

- direct broadcast requires the Anvil demo profile and an allowlisted RPC host;
- state-changing API requests require the HttpOnly same-site Studio session,
  same-origin browser requests and `application/json`;
- required doctor failures keep deployment disabled;
- server-side doctor and dry-run evidence must match the current project files
  and exact RPC before broadcast;
- arbitrary project paths and artifact paths outside the selected project are rejected;
- `verify` is basic artifact/profile/address binding evidence, not production
  bytecode, governance or legal approval certification;
- Operations handoff is enabled only after artifact verification.
- changing config, integration bindings or demo fixtures invalidates prior
  verification evidence; persisted verification survives a Studio process restart
  only while config, integration, scenario and artifact hashes still match.

## Production boundary

The bundled `DeployStack.s.sol` remains a reference/demo deployment. Studio now
also includes a **Production core** planning target that saves
`corner-store.production.json`, validates an existing Safe proxy/singleton/code
hash plus owner `M`/threshold `N`, runs technical ERC-3643 wiring preflight and
exports a signer-free plan.

The production config also freezes an approved RPC hostname list and a reviewed
release `{sourceCommit, contractsHash}`. Runtime RPC overrides outside that
list are rejected, and the CLI recomputes the contract source bundle hash
before any external signer is invoked.

Studio does not sign or broadcast production transactions. Full production
onboarding, Safe proposal execution, HSM/secret custody, legal-approved policy
activation and monitoring require the CLI/external operations workflow in
[`deployment-production.md`](./deployment-production.md).
