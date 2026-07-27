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
    -h|--help)
      echo "Usage: scripts/demo.sh [--profile buidl-like|reg-d] [--mode rfq|full]"
      echo "       [--port N] [--backend-port N] [--operator-api-port N] [--dashboard-port N]"
      exit 0
      ;;
    *) echo "unknown argument: $1" >&2; exit 2 ;;
  esac
done

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
    mapfile -t DEMO_PIDS < "$PID_FILE"
    for pid in "${DEMO_PIDS[@]}"; do
      if [ -n "$pid" ] && kill -0 "$pid" 2>/dev/null; then
        kill "$pid" 2>/dev/null || true
      fi
    done
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
  --port "$ANVIL_PORT" --backend-port "$BACKEND_PORT" --pid-file "$PID_FILE" --keep

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
node services/operator-api/dist/src/index.js >"$STATE_DIR/operator-api.log" 2>&1 &
OPERATOR_API_PID=$!

echo "==> Starting dashboard"
CORNER_STORE_OPERATOR_API="http://127.0.0.1:${OPERATOR_API_PORT}" \
CORNER_STORE_RFQ_BACKEND="http://127.0.0.1:${BACKEND_PORT}" \
PORT="$DASHBOARD_PORT" \
npm run start --prefix services/operator-dashboard >"$STATE_DIR/dashboard.log" 2>&1 &
DASHBOARD_PID=$!

DASHBOARD_READY=0
for _ in $(seq 1 25); do
  if curl -fsS "http://127.0.0.1:${DASHBOARD_PORT}/health" >/dev/null 2>&1; then
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
echo "Demo is ready: http://127.0.0.1:${DASHBOARD_PORT}"
echo "RFQ backend: http://127.0.0.1:${BACKEND_PORT}"
echo "Press Ctrl-C to stop all demo services."
wait "$DASHBOARD_PID"
