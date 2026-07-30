#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
cd "$ROOT_DIR"

PROFILE=buidl-like
MODE=rfq
ANVIL_PORT=8545
BACKEND_PORT=8787
OPERATOR_API_PORT=8788
DASHBOARD_PORT=8790
BIND_HOST=127.0.0.1
PUBLIC_HOST=127.0.0.1
SCENARIO_FILE="services/rfq-demo-backend/config/demo-scenario.json"

while [ $# -gt 0 ]; do
  case "$1" in
    --profile) PROFILE="$2"; shift 2 ;;
    --profile=*) PROFILE="${1#*=}"; shift ;;
    --mode) MODE="$2"; shift 2 ;;
    --mode=*) MODE="${1#*=}"; shift ;;
    --port) ANVIL_PORT="$2"; shift 2 ;;
    --backend-port) BACKEND_PORT="$2"; shift 2 ;;
    --operator-api-port) OPERATOR_API_PORT="$2"; shift 2 ;;
    --dashboard-port) DASHBOARD_PORT="$2"; shift 2 ;;
    --bind-host) BIND_HOST="$2"; shift 2 ;;
    --public-host) PUBLIC_HOST="$2"; shift 2 ;;
    --scenario) SCENARIO_FILE="$2"; shift 2 ;;
    --scenario=*) SCENARIO_FILE="${1#*=}"; shift ;;
    -h|--help)
      echo "Usage: scripts/demo.sh [--profile buidl-like|reg-d] [--mode rfq|full]"
      echo "       [--port N] [--backend-port N] [--operator-api-port N] [--dashboard-port N]"
      echo "       [--scenario PATH] [--bind-host HOST] [--public-host HOST]"
      exit 0
      ;;
    *) echo "unknown argument: $1" >&2; exit 2 ;;
  esac
done

case "$BIND_HOST:$PUBLIC_HOST" in
  127.0.0.1:127.0.0.1|localhost:localhost|127.0.0.1:localhost|localhost:127.0.0.1) ;;
  *)
    echo "ERROR: the unauthenticated local demo only accepts loopback hosts." >&2
    exit 2
    ;;
esac

for port in "$ANVIL_PORT" "$BACKEND_PORT" "$OPERATOR_API_PORT" "$DASHBOARD_PORT"; do
  case "$port" in
    *[!0-9]*|"") echo "ERROR: demo ports must be integers." >&2; exit 2 ;;
  esac
  if [ "$port" -lt 1024 ] || [ "$port" -gt 65535 ]; then
    echo "ERROR: demo ports must be between 1024 and 65535." >&2
    exit 2
  fi
done
if [ "$(printf '%s\n' "$ANVIL_PORT" "$BACKEND_PORT" "$OPERATOR_API_PORT" "$DASHBOARD_PORT" | sort -u | wc -l | tr -d ' ')" -ne 4 ]; then
  echo "ERROR: demo ports must be unique." >&2
  exit 2
fi

STATE_DIR=$(mktemp -d "${TMPDIR:-/tmp}/corner-store-demo.XXXXXX")
PID_FILE="$STATE_DIR/pids"
EVENTS_FILE="$STATE_DIR/events.json"
OPERATOR_API_PID=""
DASHBOARD_PID=""

require_available_port() {
  local port=$1
  local label=$2
  if lsof -nP -iTCP:"$port" -sTCP:LISTEN >/dev/null 2>&1; then
    echo "ERROR: ${label} port ${port} is already in use." >&2
    echo "Stop the existing demo with Ctrl-C or choose another port." >&2
    exit 1
  fi
}

cleanup() {
  if [ -n "$DASHBOARD_PID" ] && kill -0 "$DASHBOARD_PID" 2>/dev/null; then
    kill "$DASHBOARD_PID" 2>/dev/null || true
    wait "$DASHBOARD_PID" 2>/dev/null || true
  fi
  if [ -n "$OPERATOR_API_PID" ] && kill -0 "$OPERATOR_API_PID" 2>/dev/null; then
    kill "$OPERATOR_API_PID" 2>/dev/null || true
    wait "$OPERATOR_API_PID" 2>/dev/null || true
  fi
  if [ -s "$PID_FILE" ]; then
    while IFS= read -r pid; do
      if [ -n "$pid" ] && kill -0 "$pid" 2>/dev/null; then
        kill "$pid" 2>/dev/null || true
      fi
    done < "$PID_FILE"
  fi
  rm -rf "$STATE_DIR"
}
trap cleanup EXIT INT TERM

require_available_port "$ANVIL_PORT" "Anvil"
require_available_port "$BACKEND_PORT" "RFQ backend"
require_available_port "$OPERATOR_API_PORT" "Operator API"
require_available_port "$DASHBOARD_PORT" "Dashboard"

echo "==> Starting Corner Store local demo"
CORNER_STORE_EVENTS="$EVENTS_FILE" scripts/e2e-anvil.sh --profile "$PROFILE" --mode "$MODE" \
  --port "$ANVIL_PORT" --backend-port "$BACKEND_PORT" --scenario "$SCENARIO_FILE" \
  --bind-host "$BIND_HOST" --public-host "$PUBLIC_HOST" --pid-file "$PID_FILE" --keep

echo "==> Starting read-only Operator API"
npm run build --prefix services/operator-api >/dev/null
CORNER_STORE_CONFIG="services/toolkit/examples/corner-store.config.json"
if [ "$PROFILE" = "reg-d" ]; then
  CORNER_STORE_CONFIG="services/toolkit/examples/corner-store.reg-d.config.json"
fi
CORNER_STORE_CONFIG="$CORNER_STORE_CONFIG" \
CORNER_STORE_ARTIFACT="deployments/anvil-e2e.json" \
CORNER_STORE_MANIFEST="deployments/operator-manifest.json" \
CORNER_STORE_EVENTS="$EVENTS_FILE" \
PORT="$OPERATOR_API_PORT" \
HOST="$BIND_HOST" \
node services/operator-api/dist/src/index.js >"$STATE_DIR/operator-api.log" 2>&1 &
OPERATOR_API_PID=$!

echo "==> Starting dashboard"
CORNER_STORE_OPERATOR_API="http://${PUBLIC_HOST}:${OPERATOR_API_PORT}" \
CORNER_STORE_RFQ_BACKEND="http://${PUBLIC_HOST}:${BACKEND_PORT}" \
HOST="$BIND_HOST" \
PORT="$DASHBOARD_PORT" \
npm run start --prefix services/operator-dashboard >"$STATE_DIR/dashboard.log" 2>&1 &
DASHBOARD_PID=$!

DASHBOARD_READY=0
for _ in $(seq 1 25); do
  if curl -fsS "http://${PUBLIC_HOST}:${DASHBOARD_PORT}/health" >/dev/null 2>&1; then
    DASHBOARD_READY=1
    break
  fi
  sleep 0.2
done
if [ "$DASHBOARD_READY" -ne 1 ]; then
  cat "$STATE_DIR/dashboard.log" >&2 || true
  exit 1
fi

echo ""
echo "Demo is ready: http://${PUBLIC_HOST}:${DASHBOARD_PORT}"
echo "RFQ backend: http://${PUBLIC_HOST}:${BACKEND_PORT}"
echo "Press Ctrl-C to stop all demo services."
wait "$DASHBOARD_PID"
