#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
RFQ_IMAGE="corner-store/rfq-host:container-smoke"
OPERATOR_IMAGE="corner-store/operator-api:container-smoke"
RUN_ID="${PPID}-$$"
RFQ_CONTAINER="corner-store-rfq-smoke-${RUN_ID}"
OPERATOR_CONTAINER="corner-store-operator-smoke-${RUN_ID}"
TMP_DIR="$(mktemp -d "${TMPDIR:-/tmp}/corner-store-container-smoke.XXXXXX")"

cleanup() {
  docker rm -f "$RFQ_CONTAINER" "$OPERATOR_CONTAINER" >/dev/null 2>&1 || true
  rm -rf "$TMP_DIR"
}
trap cleanup EXIT

fail() {
  echo "production container smoke failed: $*" >&2
  exit 1
}

wait_http() {
  local url="$1"
  local expected="$2"
  local attempt status
  for attempt in $(seq 1 40); do
    status="$(curl -sS -o /dev/null -w '%{http_code}' "$url" 2>/dev/null || true)"
    if [[ "$status" == "$expected" ]]; then return 0; fi
    sleep 0.25
  done
  fail "${url} did not return ${expected}"
}

mapped_port() {
  docker inspect --format "{{(index (index .NetworkSettings.Ports \"$1/tcp\") 0).HostPort}}" "$2"
}

assert_image_contract() {
  local image="$1"
  local service_path="$2"
  [[ "$(docker image inspect --format '{{.Config.User}}' "$image")" == "10001:10001" ]] \
    || fail "$image is not pinned to uid/gid 10001"
  [[ "$(docker image inspect --format '{{json .Config.Healthcheck}}' "$image")" != "null" ]] \
    || fail "$image has no healthcheck"
  if docker image inspect --format '{{range .Config.Env}}{{println .}}{{end}}' "$image" \
      | grep -Eiq '(PRIVATE_KEY|AUTH_TOKEN|API_KEY|SECRET)='; then
    fail "$image embeds a credential-shaped environment variable"
  fi
  if docker run --rm --entrypoint sh "$image" -c "test -d '$service_path/src'"; then
    fail "$image contains Corner Store TypeScript source"
  fi
}

cat >"$TMP_DIR/bootstrap.cjs" <<'EOF'
const components = [
  "audit", "authentication", "coordinator", "policy",
  "pricing", "rate_limit", "risk", "signer"
];
module.exports = {
  contractVersion: "1.0.0",
  capabilities: {
    durable_coordinator: true,
    external_signer: true,
    fresh_pricing_risk: true,
    incident_monitoring: true,
    live_policy_resolver: true,
    production_authentication: true,
    shared_rate_limit: true,
    strict_audit: true
  },
  createProductionRFQDependencies() {
    return {
      coordinator: {quoteWithEvidence() { throw new Error("not used by runtime smoke"); }},
      authenticator: {authenticate() { throw new Error("not used by runtime smoke"); }},
      resolvePolicyId() { throw new Error("not used by runtime smoke"); },
      rateLimiter: {check() { return {allowed: false}; }},
      audit: {record() {}},
      metrics: {increment() {}, timing() {}},
      incident: {notify() {}},
      readiness: {
        check() {
          return {ready: true, components: components.map((component) => ({component, ready: true}))};
        }
      }
    };
  }
};
EOF

cat >"$TMP_DIR/failing-bootstrap.cjs" <<'EOF'
module.exports = {
  contractVersion: "1.0.0",
  capabilities: {
    durable_coordinator: true,
    external_signer: true,
    fresh_pricing_risk: true,
    incident_monitoring: true,
    live_policy_resolver: true,
    production_authentication: true,
    shared_rate_limit: true,
    strict_audit: true
  },
  createProductionRFQDependencies() {
    throw new Error("do-not-log-this-bootstrap-secret");
  }
};
EOF

cp "$ROOT_DIR/services/toolkit/examples/corner-store.config.json" "$TMP_DIR/config.json"
printf '%s\n' '{"schemaVersion":1,"network":"container-smoke"}' >"$TMP_DIR/deployment.json"
printf '%s\n' 'container-smoke-token-that-is-long-enough' >"$TMP_DIR/operator-token"
chmod 0400 "$TMP_DIR/operator-token"

cd "$ROOT_DIR"
CORNER_STORE_RFQ_IMAGE_REPOSITORY=example.invalid/corner-store/rfq-host \
CORNER_STORE_RFQ_IMAGE_DIGEST="$(printf '0%.0s' {1..64})" \
CORNER_STORE_RFQ_BOOTSTRAP_DIR="$TMP_DIR" \
CORNER_STORE_OPERATOR_IMAGE_REPOSITORY=example.invalid/corner-store/operator-api \
CORNER_STORE_OPERATOR_IMAGE_DIGEST="$(printf '1%.0s' {1..64})" \
CORNER_STORE_OPERATOR_CONFIG_DIR="$TMP_DIR" \
CORNER_STORE_OPERATOR_API_TOKEN_FILE="$TMP_DIR/operator-token" \
docker compose -f deploy/production/compose.example.yaml config >/dev/null

docker build -f deploy/production/Dockerfile --target rfq-host -t "$RFQ_IMAGE" .
docker build -f deploy/production/Dockerfile --target operator-api -t "$OPERATOR_IMAGE" .

assert_image_contract "$RFQ_IMAGE" /opt/corner-store/services/rfq-host
assert_image_contract "$OPERATOR_IMAGE" /opt/corner-store/services/operator-api

if docker run --rm --read-only --cap-drop ALL --security-opt no-new-privileges \
    -v "$TMP_DIR/failing-bootstrap.cjs:/run/corner-store/bootstrap.cjs:ro" \
    -e CORNER_STORE_RFQ_CONFIG_VERSION=1 \
    -e CORNER_STORE_RFQ_BOOTSTRAP_MODULE=/run/corner-store/bootstrap.cjs \
    "$RFQ_IMAGE" >"$TMP_DIR/failing-rfq.log" 2>&1; then
  fail "RFQ image started with unavailable bootstrap dependencies"
fi
grep -q '"code":"BOOTSTRAP_DEPENDENCIES_INVALID"' "$TMP_DIR/failing-rfq.log" \
  || fail "RFQ bootstrap failure did not return a stable error code"
if grep -q 'do-not-log-this-bootstrap-secret' "$TMP_DIR/failing-rfq.log"; then
  fail "RFQ bootstrap failure leaked adapter exception text"
fi

docker run -d --name "$RFQ_CONTAINER" --read-only --cap-drop ALL \
  --security-opt no-new-privileges --tmpfs /tmp:rw,noexec,nosuid,nodev,size=16m \
  -p 127.0.0.1::8787 \
  -v "$TMP_DIR/bootstrap.cjs:/run/corner-store/bootstrap.cjs:ro" \
  -e CORNER_STORE_RFQ_CONFIG_VERSION=1 \
  -e CORNER_STORE_RFQ_BOOTSTRAP_MODULE=/run/corner-store/bootstrap.cjs \
  -e CORNER_STORE_RFQ_HOST=0.0.0.0 \
  -e CORNER_STORE_RFQ_PUBLIC_BIND_ACKNOWLEDGED=1 \
  "$RFQ_IMAGE" >/dev/null
RFQ_PORT="$(mapped_port 8787 "$RFQ_CONTAINER")"
wait_http "http://127.0.0.1:${RFQ_PORT}/health" 200
wait_http "http://127.0.0.1:${RFQ_PORT}/ready" 200
docker stop --time 15 "$RFQ_CONTAINER" >/dev/null
grep -q '"event":"rfq_host_stopped"' <(docker logs "$RFQ_CONTAINER" 2>&1) \
  || fail "RFQ image did not complete graceful shutdown"

docker run -d --name "$OPERATOR_CONTAINER" --read-only --cap-drop ALL \
  --security-opt no-new-privileges --tmpfs /tmp:rw,noexec,nosuid,nodev,size=16m \
  -p 127.0.0.1::8788 \
  -v "$TMP_DIR/config.json:/run/corner-store/config.json:ro" \
  -v "$TMP_DIR/deployment.json:/run/corner-store/deployment.json:ro" \
  -v "$TMP_DIR/operator-token:/run/secrets/operator-token:ro" \
  -e CORNER_STORE_OPERATOR_CONFIG_VERSION=1 \
  -e CORNER_STORE_OPERATOR_HOST=0.0.0.0 \
  -e CORNER_STORE_OPERATOR_PUBLIC_BIND_ACKNOWLEDGED=1 \
  -e CORNER_STORE_OPERATOR_CONFIG_FILE=/run/corner-store/config.json \
  -e CORNER_STORE_OPERATOR_ARTIFACT_FILE=/run/corner-store/deployment.json \
  -e CORNER_STORE_OPERATOR_AUTH_TOKEN_FILE=/run/secrets/operator-token \
  "$OPERATOR_IMAGE" >/dev/null
OPERATOR_PORT="$(mapped_port 8788 "$OPERATOR_CONTAINER")"
wait_http "http://127.0.0.1:${OPERATOR_PORT}/api/v1/health" 200
wait_http "http://127.0.0.1:${OPERATOR_PORT}/api/v1/ready" 200
[[ "$(curl -sS -o /dev/null -w '%{http_code}' "http://127.0.0.1:${OPERATOR_PORT}/api/v1/deployment")" == "401" ]] \
  || fail "Operator API allowed an unauthenticated data request"
[[ "$(curl -sS -o /dev/null -w '%{http_code}' \
  -H 'Authorization: Bearer container-smoke-token-that-is-long-enough' \
  "http://127.0.0.1:${OPERATOR_PORT}/api/v1/deployment")" == "200" ]] \
  || fail "Operator API rejected the mounted token"
docker stop --time 15 "$OPERATOR_CONTAINER" >/dev/null
OPERATOR_LOGS="$(docker logs "$OPERATOR_CONTAINER" 2>&1)"
[[ "$OPERATOR_LOGS" == *'"event":"operator_api_stopped"'* ]] \
  || fail "Operator API image did not complete graceful shutdown"
[[ "$OPERATOR_LOGS" != *'container-smoke-token-that-is-long-enough'* ]] \
  || fail "Operator API logs leaked the mounted token"

echo "corner-store production container smoke ok"
