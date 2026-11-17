#!/usr/bin/env bash
# Isolated local evidence-v2 -> unsigned calldata -> RFQ v2/v3 settlement test.
set -euo pipefail

ROOT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
cd "$ROOT_DIR"
PORT=8548
while [ $# -gt 0 ]; do
  case "$1" in
    --port) PORT="$2"; shift 2 ;;
    -h|--help) head -2 "$0"; exit 0 ;;
    *) echo "unknown argument: $1" >&2; exit 2 ;;
  esac
done
case "$PORT" in
  *[!0-9]*|"") echo "port must be an integer" >&2; exit 2 ;;
esac
if [ "$PORT" -lt 1024 ] || [ "$PORT" -gt 65535 ]; then
  echo "port must be between 1024 and 65535" >&2
  exit 2
fi
if lsof -nP -iTCP:"$PORT" -sTCP:LISTEN >/dev/null 2>&1; then
  echo "Anvil port $PORT is already in use" >&2
  exit 1
fi
RPC="http://127.0.0.1:${PORT}"
RUN_DIR=$(mktemp -d "${TMPDIR:-/tmp}/corner-store-identity.XXXXXX")
ARTIFACT="deployments/identity-evidence-$$.json"
ANVIL_PID=""
cleanup() {
  if [ -n "$ANVIL_PID" ] && kill -0 "$ANVIL_PID" 2>/dev/null; then
    kill "$ANVIL_PID" 2>/dev/null || true
    wait "$ANVIL_PID" 2>/dev/null || true
  fi
  rm -f "$ARTIFACT"
  rm -rf "$RUN_DIR"
}
trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM

for service in compliance-data toolkit rfq; do
  if [ ! -x "services/$service/node_modules/.bin/tsc" ]; then
    npm ci --prefix "services/$service"
  fi
  npm run build --prefix "services/$service"
done
echo "==> Starting isolated Anvil on $RPC"
anvil --host 127.0.0.1 --port "$PORT" --chain-id 31337 --silent >"$RUN_DIR/anvil.log" 2>&1 &
ANVIL_PID=$!
READY=0
for _ in $(seq 1 50); do
  if ! kill -0 "$ANVIL_PID" 2>/dev/null; then break; fi
  if cast block-number --rpc-url "$RPC" >/dev/null 2>&1; then READY=1; break; fi
  sleep 0.2
done
if [ "$READY" -ne 1 ]; then
  cat "$RUN_DIR/anvil.log" >&2
  exit 1
fi
mkdir -p deployments
echo "==> Deploying isolated ERC-3643 identity evidence fixture"
IDENTITY_EVIDENCE_ARTIFACT="$ARTIFACT" forge script \
  script/IdentityEvidenceFixture.s.sol:IdentityEvidenceFixture \
  --rpc-url "$RPC" --broadcast --slow --offline >"$RUN_DIR/deploy.log" 2>&1 || {
    cat "$RUN_DIR/deploy.log" >&2
    exit 1
  }
node scripts/e2e-identity-evidence.mjs "$RPC" "$ARTIFACT"
