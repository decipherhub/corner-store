# Production Service Containers

Corner Store provides OCI build targets for the hardened RFQ HTTP boundary and
the authenticated, read-only Operator API. These images package a process
contract; they do **not** package a production RFQ system or make an environment
production-ready by themselves.

The generated Reference DEX sandbox is a separate demo product. It uses local
fixtures and disposable state. Never promote its images, keys, in-memory
adapters or Compose file into a production environment.

## Build and release

Build each target from the repository root:

```sh
docker build -f deploy/production/Dockerfile --target rfq-host \
  -t registry.example/corner-store/rfq-host:<release> .
docker build -f deploy/production/Dockerfile --target operator-api \
  -t registry.example/corner-store/operator-api:<release> .
scripts/production-container-smoke.sh
```

The Dockerfile pins the base image by digest, performs lockfile installs in
multi-stage builders and copies only compiled application files plus production
dependencies. Both runtime targets use UID/GID `10001:10001` and provide an OCI
healthcheck. Publish the resulting images, record their digests, and deploy by
`repository@sha256:digest`; a mutable tag is not a deployment identity.

`deploy/production/compose.example.yaml` is a security-contract example, not an
HA topology. It demonstrates digest-only images, a read-only root filesystem,
all capabilities dropped, `no-new-privileges`, bounded resources, a small
temporary filesystem and SIGTERM grace periods. It deliberately publishes no
host ports. Production TLS, ingress, network policy, replicas, disruption
budgets and service discovery belong to the operator platform.

## RFQ host contract

The RFQ image has no fallback authenticator, signer, pricing engine, risk
engine, nonce store, inventory store, policy resolver or audit sink. Startup
requires an absolute CommonJS bootstrap module path. The module must implement
contract version `1.0.0`, explicitly declare every capability, and return every
dependency below:

| Capability | Required production behavior |
| --- | --- |
| durable coordinator | transactional external database for idempotency, nonce and inventory reservation; restart-safe reconciliation |
| production authentication | trusted identity/session/mTLS binding that returns the exact taker claim |
| shared rate limit | multi-replica limiter keyed by bounded principal hashes |
| fresh pricing/risk | available, versioned, time-bounded evidence; stale or unavailable evidence fails closed |
| external signer | KMS/HSM or equivalent custody plus local result verification |
| live policy resolver | trusted RPC/indexer read of the current on-chain policy ID |
| strict audit | PII-free durable/WORM write completed before a quote response |
| incident monitoring | bounded-label metrics and non-recursive incident delivery |

Use `deploy/production/bootstrap.example.cjs` only as a shape reference. It
intentionally throws instead of starting with mock dependencies. Bundle the
operator implementation and its pinned packages outside this repository, mount
the bundle read-only, and inject credentials through the platform secret
manager. Never put credentials in the bootstrap source or image.

The bootstrap readiness probe must report all of these components:
`audit`, `authentication`, `coordinator`, `policy`, `pricing`, `rate_limit`,
`risk`, and `signer`. `GET /health` reports process liveness. `GET /ready`
reports only bounded component names and booleans. Quote issuance calls the same
probe and returns `503` before policy lookup or signing whenever readiness is
false, invalid, timed out or unavailable.

### Exact RFQ environment schema

Unknown variables beginning with `CORNER_STORE_RFQ_` reject startup without
printing their values.

| Variable | Required/default | Contract |
| --- | --- | --- |
| `CORNER_STORE_RFQ_CONFIG_VERSION` | required, `1` | runtime schema version |
| `CORNER_STORE_RFQ_BOOTSTRAP_MODULE` | required | absolute mounted module path |
| `CORNER_STORE_RFQ_HOST` | `127.0.0.1` | non-loopback requires explicit acknowledgement |
| `CORNER_STORE_RFQ_PORT` | `8787` | integer, `1..65535` |
| `CORNER_STORE_RFQ_PUBLIC_BIND_ACKNOWLEDGED` | `0` | exactly `0` or `1`; set only behind the approved TLS/proxy boundary |
| `CORNER_STORE_RFQ_MAX_BODY_BYTES` | `16384` | `1..1048576` |
| `CORNER_STORE_RFQ_FUTURE_SKEW_SECONDS` | `5` | `0..300` |
| `CORNER_STORE_RFQ_READINESS_TIMEOUT_MS` | `3000` | `1..30000` |
| `CORNER_STORE_RFQ_REQUEST_TIMEOUT_MS` | `30000` | `1..120000` |
| `CORNER_STORE_RFQ_HEADERS_TIMEOUT_MS` | `15000` | `1..60000` |
| `CORNER_STORE_RFQ_SHUTDOWN_TIMEOUT_MS` | `10000` | `1..60000` |

## Read-only Operator API contract

The Operator API exposes deployment/configuration evidence but has no mutation
route. Health and readiness responses contain no mounted paths or credentials;
all data and metrics routes require the mounted bearer token. The process starts
only when the token and mandatory JSON files are readable and valid. Readiness
becomes `503` if a mounted dependency later disappears or becomes invalid.

The token is read from a file so that Compose/Kubernetes secrets need not be
copied into environment metadata. It must be 32–512 characters. The image does
not include a default token. Mounted files are hashed at startup; any later
replacement makes readiness fail until an explicit process restart reloads the
reviewed snapshot and token.

### Exact Operator API environment schema

Unknown variables beginning with `CORNER_STORE_OPERATOR_` reject startup.

| Variable | Required/default | Contract |
| --- | --- | --- |
| `CORNER_STORE_OPERATOR_CONFIG_VERSION` | required, `1` | runtime schema version |
| `CORNER_STORE_OPERATOR_HOST` | `127.0.0.1` | non-loopback requires explicit acknowledgement |
| `CORNER_STORE_OPERATOR_PORT` | `8788` | integer, `1..65535` |
| `CORNER_STORE_OPERATOR_PUBLIC_BIND_ACKNOWLEDGED` | `0` | exactly `0` or `1` |
| `CORNER_STORE_OPERATOR_CONFIG_FILE` | required | absolute, read-only JSON path |
| `CORNER_STORE_OPERATOR_ARTIFACT_FILE` | required | absolute, read-only JSON path |
| `CORNER_STORE_OPERATOR_MANIFEST_FILE` | optional | absolute, read-only JSON path |
| `CORNER_STORE_OPERATOR_EVENTS_FILE` | optional | absolute, read-only JSON snapshot path |
| `CORNER_STORE_OPERATOR_AUTH_TOKEN_FILE` | required | absolute mounted secret path |
| `CORNER_STORE_OPERATOR_REQUEST_TIMEOUT_MS` | `30000` | `1..120000` |
| `CORNER_STORE_OPERATOR_HEADERS_TIMEOUT_MS` | `15000` | `1..60000` |
| `CORNER_STORE_OPERATOR_SHUTDOWN_TIMEOUT_MS` | `10000` | `1..60000` |

## Shutdown and failure behavior

Both processes handle SIGINT/SIGTERM once, stop accepting new requests, close
their adapters where applicable and bound shutdown by the configured timeout.
Startup and shutdown logs are structured events. Bootstrap/adapter exception
text, bearer tokens, secret paths, request bodies and stack traces are not
logged. Missing dependencies, malformed mounted evidence and stale readiness
always fail closed; operators should alert on repeated `503`, startup error
codes and shutdown timeouts.

## Release evidence and supply-chain gates

Container smoke is mandatory for an image-changing PR. A release pipeline must
also generate an SBOM, scan the immutable image digest, sign/attest the image
according to the operator policy, and retain those artifacts with the release.
The repository does not force a scanner vendor or add one as an application
dependency. Typical external hooks are:

```sh
syft registry.example/corner-store/rfq-host@sha256:<digest> \
  -o cyclonedx-json=rfq-host.sbom.cdx.json
trivy image --exit-code 1 --severity HIGH,CRITICAL \
  registry.example/corner-store/rfq-host@sha256:<digest>
```

Repeat the gates for the Operator API. Scanner exceptions require a documented
owner, reason and expiry. An image may be deployed only after the external DB,
KMS/HSM, RPC, pricing/risk, shared limiter, WORM audit, secrets, TLS, monitoring,
backup/restore and incident-response controls have independent production
evidence.
