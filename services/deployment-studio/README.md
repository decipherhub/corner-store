# Corner Store Deployment Studio

The Deployment Studio is a local control surface over the existing Corner Store
JSON and CLI contracts. Its reference target can execute an allowlisted local
demo deployment. Its production-core target saves Toolkit production config,
runs Safe/ERC-3643 preflight and exports a signer-free plan. It never accepts
browser-managed signing secrets or broadcasts production transactions.

## Runtime topology

```text
browser (same origin)
  -> Deployment Studio Local Control API
  -> @corner-store/cli
  -> Toolkit config / DeployStack or production-plan / deployment artifact
  -> verified artifact + exact deployment RPC
  -> RFQ backend + Operator API + DEX Dashboard
```

All environment-specific locations and endpoints are runtime configuration:

| Variable | Local default | Purpose |
| --- | --- | --- |
| `CORNER_STORE_STUDIO_HOST` (`HOST` fallback) | `127.0.0.1` | Studio bind host |
| `CORNER_STORE_STUDIO_PORT` (`PORT` fallback) | `8791` | Studio bind port |
| `CORNER_STORE_STUDIO_ROOT` | `<repo>/.corner-store/studio-projects` | only writable project parent |
| `CORNER_STORE_CLI_ENTRY` | built repository CLI entry | CLI executable JavaScript |
| `CORNER_STORE_DEFAULT_RPC` | `http://127.0.0.1:8545` | initial RPC form value |
| `CORNER_STORE_BROADCAST_NETWORK` | `anvil` | only config network eligible for direct broadcast |
| `CORNER_STORE_ALLOWED_RPC_HOSTS` | `127.0.0.1,localhost,::1` | comma-separated direct-broadcast RPC hosts |
| `CORNER_STORE_OPERATIONS_URL` | `http://127.0.0.1:8790` | verified deployment handoff URL |
| `CORNER_STORE_DEX_BIND_HOST` | `127.0.0.1` | integrated DEX service bind host |
| `CORNER_STORE_DEX_PUBLIC_HOST` | `127.0.0.1` | browser-visible DEX service host |
| `CORNER_STORE_RFQ_BACKEND_PORT` | `8787` | integrated RFQ backend port |
| `CORNER_STORE_OPERATOR_API_PORT` | `8788` | integrated Operator API port |
| `CORNER_STORE_DASHBOARD_PORT` | `8790` | integrated Dashboard port |
| `CORNER_STORE_DEX_CHAIN_ID` | `31337` | local EIP-712 chain ID |

Defaults are local examples, not product constants. Production operators should
inject explicit values through their process manager. Direct Studio broadcast is
still limited to the configured demo network and allowlisted RPC hosts.
Production-core target controls never broadcast, sign or collect private keys.

## Run

Start the local server through the parameterized launcher:

```sh
scripts/studio.sh \
  --workspace "$PWD/.corner-store/studio-projects" \
  --rpc "http://127.0.0.1:8545" \
  --operations-url "http://127.0.0.1:8790"
```

Open the printed URL. The UI uses same-origin `/api/v1/*` routes and does not
hardcode a control API host or port.

The server issues an HttpOnly `SameSite=Strict` local session cookie. Every
state-changing API request must present that session, use same-origin semantics
and send JSON. Doctor and dry-run evidence are held server-side and must match
the current project-file fingerprint and exact RPC before a broadcast starts.
After verification, `Start DEX demo` launches all three DEX services with that
project's artifact, scenario and deployment RPC. A different RPC, mutated
artifact or unverified project is rejected; no second stack is deployed.

Use `scripts/studio.sh --help` for the complete host, port, CLI entry,
broadcast-network and RPC-host allowlist options. Environment variables and CLI
flags are equivalent; a process manager can inject the same values without
editing repository files.

## Current boundary

- project create, config/integration/demo scenario editing
- doctor, read-only deployment plan, guarded Anvil broadcast and verify
- production-core config editing in Toolkit shape:
  `{schemaVersion, network:{name,chainId,rpcUrl,approvedRpcHosts}, release:{sourceCommit,contractsHash}, deploymentId, deployer, operator, venues:{amm,rfq}, safe:{address,expectedOwners,threshold,expectedSingleton,proxyCodeHash}, deployment:{artifact,evidence}, erc3643?:{token?}}`
- production-preflight execution and production-plan preview/export
- deployment job event stream, artifact viewer and activation checklist
- first-start CLI onboarding of the selected demo Manifest/venues on the verified
  deployment, followed by start/open/stop of its artifact-bound local RFQ DEX runtime
- persisted handoff verification bound to config/integration/scenario/artifact hashes

Existing production ERC-3643 onboarding, mainnet broadcast, multisig/HSM
execution, policy mutation and secret custody are intentionally not provided by
the browser Studio.
