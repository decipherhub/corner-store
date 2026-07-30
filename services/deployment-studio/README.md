# Corner Store Deployment Studio

The Deployment Studio is a local/demo-only web control surface over the existing
Corner Store JSON and CLI contracts. It does not implement a production
deployment orchestrator and never accepts browser-managed signing secrets.

## Runtime topology

```text
browser (same origin)
  -> Deployment Studio Local Control API
  -> @corner-store/cli
  -> Toolkit config / DeployStack / deployment artifact
  -> existing Operations Dashboard
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

Defaults are local examples, not product constants. Production operators should
inject explicit values through their process manager. Direct Studio broadcast is
still limited to the configured demo network and allowlisted RPC hosts.

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

Use `scripts/studio.sh --help` for the complete host, port, CLI entry,
broadcast-network and RPC-host allowlist options. Environment variables and CLI
flags are equivalent; a process manager can inject the same values without
editing repository files.

## Current boundary

- project create, config/integration/demo scenario editing
- doctor, read-only deployment plan, guarded Anvil broadcast and verify
- deployment job event stream, artifact viewer and activation checklist
- handoff to the existing runtime dashboard after verification
- persisted handoff verification bound to config/integration/scenario/artifact hashes

Existing production ERC-3643 onboarding, mainnet broadcast, multisig/HSM
execution, policy mutation and secret custody are intentionally not provided.
