#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)
cd "$ROOT_DIR"

command -v docker >/dev/null 2>&1 || {
  echo "ERROR: docker is required for the Monad hackathon container smoke" >&2
  exit 1
}
docker info >/dev/null 2>&1 || {
  echo "ERROR: Docker daemon is unavailable" >&2
  exit 1
}

RUN_ID="${GITHUB_RUN_ID:-$$}"
IMAGE="corner-store-monad-hackathon-smoke:${RUN_ID}"
TMP_DIR=$(mktemp -d "${TMPDIR:-/tmp}/corner-store-monad-container.XXXXXX")

cleanup() {
  docker image rm --force "$IMAGE" >/dev/null 2>&1 || true
  rm -rf -- "$TMP_DIR"
}
trap cleanup EXIT

printf '{}\n' >"$TMP_DIR/deployment.json"
printf 'disposable-testnet-key-placeholder\n' >"$TMP_DIR/maker-key"

echo "==> Building Monad hackathon demo image"
docker build \
  --file deploy/hackathon-monad/Dockerfile \
  --tag "$IMAGE" \
  .

IMAGE_USER=$(docker image inspect --format '{{.Config.User}}' "$IMAGE")
[[ "$IMAGE_USER" == "10001:10001" ]] || {
  echo "ERROR: image user is '$IMAGE_USER', expected 10001:10001" >&2
  exit 1
}

HEALTHCHECK=$(docker image inspect --format '{{json .Config.Healthcheck.Test}}' "$IMAGE")
[[ "$HEALTHCHECK" == *"127.0.0.1:8791/health"* ]] || {
  echo "ERROR: image healthcheck does not target the local service health endpoint" >&2
  exit 1
}

echo "==> Validating Monad hackathon Compose contract"
CORNER_STORE_TESTNET_ARTIFACT="$TMP_DIR/deployment.json" \
CORNER_STORE_TESTNET_RPC_URL="https://testnet-rpc.monad.xyz" \
CORNER_STORE_TESTNET_MAKER_KEY_FILE="$TMP_DIR/maker-key" \
docker compose -f deploy/hackathon-monad/compose.example.yaml config --format json \
  >"$TMP_DIR/compose.json"

node - "$TMP_DIR/compose.json" <<'NODE'
const fs = require("fs");
const config = JSON.parse(fs.readFileSync(process.argv[2], "utf8"));
const demo = config.services?.demo;
if (!demo) throw new Error("demo service is missing");
if (demo.user !== "10001:10001") throw new Error("demo service must run as 10001:10001");
if (demo.read_only !== true) throw new Error("demo service root filesystem must be read-only");
if (!demo.cap_drop?.includes("ALL")) throw new Error("demo service must drop all capabilities");
if (!demo.security_opt?.includes("no-new-privileges:true")) {
  throw new Error("demo service must disable privilege escalation");
}
if (!demo.environment?.CORNER_STORE_TESTNET_API_REQUESTS_PER_MINUTE) {
  throw new Error("global API budget is missing");
}
if (!demo.environment?.CORNER_STORE_TESTNET_QUOTE_REQUESTS_PER_MINUTE) {
  throw new Error("quote budget is missing");
}
if (!demo.volumes?.some((mount) => mount.type === "bind" && mount.read_only === true)) {
  throw new Error("deployment artifact must be mounted read-only");
}
if (!demo.secrets?.some((secret) => secret.source === "maker_key")) {
  throw new Error("Maker key must be injected as a secret");
}
if (!demo.ports?.some((port) => port.host_ip === "127.0.0.1" && port.target === 8791)) {
  throw new Error("demo port must remain loopback-bound by default");
}
NODE

echo "Monad hackathon container smoke passed."
