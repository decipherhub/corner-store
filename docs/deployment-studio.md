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

The Studio does not render secret-value fields. The initial RPC, direct-broadcast
network, allowed RPC hosts, Operations URL, workspace and CLI entry are server
runtime inputs rather than frontend constants.

Use `scripts/studio.sh` to inject these values as flags or environment variables.
The browser talks only to same-origin `/api/v1/*` routes, so changing the Studio
bind address or reverse-proxy route does not require rebuilding frontend assets.

## Safety gates

- direct broadcast requires the configured demo network and an allowlisted RPC host;
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

The bundled `DeployStack.s.sol` is a reference/demo deployment. Mainnet
deployment, production ERC-3643 token onboarding, multisig execution, HSM/secret
custody and general policy mutation require separate production components.
