#!/usr/bin/env bash
#
# Live-Anvil E2E runner + stakeholder demo driver.
#
# Starts a fresh Anvil node, deploys the FULL Corner Store stack (DeployStack),
# runs the 7-scenario demo suite (DemoScenarios), prints the PASS/FAIL summary,
# and tears the node down on exit. Runs fully offline.
#
# Usage:
#   scripts/e2e-anvil.sh [--port N] [--backend-port N] [--profile buidl-like|reg-d] [--keep]
#
#   --port N   Anvil port (default 8545).
#   --backend-port N  RFQ demo backend port (default 8787).
#   --profile  Asset profile (default buidl-like; alternative reg-d).
#   --keep     Leave Anvil running after the suite (attach a UI / continue the
#              demo interactively). Otherwise Anvil is killed on exit.
#
# Exit code is non-zero if any scenario fails (DemoScenarios reverts).
set -euo pipefail

ROOT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
cd "$ROOT_DIR"

PORT=8545
KEEP=0
ASSET_PROFILE=buidl-like
BACKEND_PORT=8787
while [ $# -gt 0 ]; do
  case "$1" in
    --port) PORT="$2"; shift 2 ;;
    --port=*) PORT="${1#*=}"; shift ;;
    --profile) ASSET_PROFILE="$2"; shift 2 ;;
    --profile=*) ASSET_PROFILE="${1#*=}"; shift ;;
    --backend-port) BACKEND_PORT="$2"; shift 2 ;;
    --backend-port=*) BACKEND_PORT="${1#*=}"; shift ;;
    --keep) KEEP=1; shift ;;
    -h|--help) grep '^#' "$0" | sed 's/^# \{0,1\}//'; exit 0 ;;
    *) echo "unknown argument: $1" >&2; exit 2 ;;
  esac
done

case "$ASSET_PROFILE" in
  buidl-like|reg-d) ;;
  *) echo "invalid --profile: $ASSET_PROFILE (expected buidl-like or reg-d)" >&2; exit 2 ;;
esac

RPC="http://127.0.0.1:${PORT}"
ANVIL_LOG=$(mktemp -t corner-store-anvil.XXXXXX)
ANVIL_PID=""
BACKEND_LOG=$(mktemp -t corner-store-rfq-backend.XXXXXX)
BACKEND_PID=""
QUOTE_FILE=$(mktemp -t corner-store-rfq-quote.XXXXXX)
REJECTED_QUOTE_FILE=$(mktemp -t corner-store-rfq-rejected.XXXXXX)
CHECKPOINT_FILE="${TMPDIR:-/tmp}/corner-store-e2e-checkpoint.$$"

cleanup() {
  if [ "$KEEP" -eq 1 ]; then
    if [ -n "$ANVIL_PID" ]; then
      echo ""
      echo "==> --keep set: Anvil left running (pid ${ANVIL_PID}) on ${RPC}"
      echo "    stop it with: kill ${ANVIL_PID}"
    fi
    if [ -n "$BACKEND_PID" ]; then
      echo "    RFQ backend left running (pid ${BACKEND_PID}) on http://127.0.0.1:${BACKEND_PORT}"
      echo "    stop it with: kill ${BACKEND_PID}"
    fi
    return
  fi
  if [ -n "$BACKEND_PID" ] && kill -0 "$BACKEND_PID" 2>/dev/null; then
    kill "$BACKEND_PID" 2>/dev/null || true
    wait "$BACKEND_PID" 2>/dev/null || true
  fi
  if [ -n "$ANVIL_PID" ] && kill -0 "$ANVIL_PID" 2>/dev/null; then
    kill "$ANVIL_PID" 2>/dev/null || true
    wait "$ANVIL_PID" 2>/dev/null || true
  fi
  rm -f "$ANVIL_LOG" "$BACKEND_LOG" "$QUOTE_FILE" "$REJECTED_QUOTE_FILE" "$CHECKPOINT_FILE"
}
trap cleanup EXIT INT TERM

mkdir -p deployments

echo "==> Starting Anvil on ${RPC} (offline, deterministic mnemonic)"
anvil --port "$PORT" --silent >"$ANVIL_LOG" 2>&1 &
ANVIL_PID=$!

echo "==> Waiting for Anvil to accept connections"
READY=0
for _ in $(seq 1 50); do
  if ! kill -0 "$ANVIL_PID" 2>/dev/null; then
    break
  fi
  if cast block-number --rpc-url "$RPC" >/dev/null 2>&1; then
    READY=1
    break
  fi
  sleep 0.2
done
if [ "$READY" -ne 1 ]; then
  echo "ERROR: Anvil did not become ready" >&2
  cat "$ANVIL_LOG" >&2 || true
  exit 1
fi

echo "==> Deploying the full stack (script/DeployStack.s.sol)"
ASSET_PROFILE="$ASSET_PROFILE" forge script script/DeployStack.s.sol:DeployStack \
  --rpc-url "$RPC" --broadcast --offline

echo ""
echo "==> Running the demo scenario suite (script/DemoScenarios.s.sol)"
forge script script/DemoScenarios.s.sol:DemoScenarios \
  --rpc-url "$RPC" --broadcast --offline

echo ""
echo "==> Building CLI and RFQ demo backend"
npm run build --prefix services/cli >/dev/null
npm run build --prefix services/rfq-demo-backend >/dev/null

CLI=(node services/cli/dist/cli/src/index.js --rpc "$RPC" --artifact deployments/anvil-e2e.json)
echo "==> Advancing the live chain through the manifest recovery timelock"
cast rpc --rpc-url "$RPC" evm_increaseTime 86400 >/dev/null
cast rpc --rpc-url "$RPC" evm_mine >/dev/null
"${CLI[@]}" manifest resume
"${CLI[@]}" buy 5000000 --venue amm
echo "    PASS: delayed manifest recovery restored AMM settlement"

echo "==> Running Toolkit artifact preflight and immutable checkpoint"
if [ "$ASSET_PROFILE" = "reg-d" ]; then
  TOOLKIT_CONFIG=services/toolkit/examples/corner-store.reg-d.config.json
else
  TOOLKIT_CONFIG=services/toolkit/examples/corner-store.config.json
fi
"${CLI[@]}" toolkit-preflight "$TOOLKIT_CONFIG"
"${CLI[@]}" toolkit-checkpoint "$TOOLKIT_CONFIG" \
  --output "$CHECKPOINT_FILE" --deployment-id "e2e-${ASSET_PROFILE}-${PORT}"
test -s "$CHECKPOINT_FILE"
echo "==> Re-onboarding the selected asset profile through the CLI"
"${CLI[@]}" onboard --profile "$ASSET_PROFILE"

echo "==> Starting RFQ demo backend on http://127.0.0.1:${BACKEND_PORT}"
node services/rfq-demo-backend/dist/rfq-demo-backend/src/index.js \
  --port "$BACKEND_PORT" --rpc "$RPC" >"$BACKEND_LOG" 2>&1 &
BACKEND_PID=$!

BACKEND_READY=0
for _ in $(seq 1 50); do
  if ! kill -0 "$BACKEND_PID" 2>/dev/null; then
    break
  fi
  if curl -fsS "http://127.0.0.1:${BACKEND_PORT}/health" >/dev/null 2>&1; then
    BACKEND_READY=1
    break
  fi
  sleep 0.2
done
if [ "$BACKEND_READY" -ne 1 ]; then
  echo "ERROR: RFQ demo backend did not become ready" >&2
  cat "$BACKEND_LOG" >&2 || true
  exit 1
fi

echo "==> Requesting and filling a backend-signed RFQ quote through the Router"
"${CLI[@]}" rfq-quote --backend "http://127.0.0.1:${BACKEND_PORT}" \
  --amount-in 5000000 --out "$QUOTE_FILE"
"${CLI[@]}" buy 0 --venue rfq --quote "$QUOTE_FILE"

echo "==> Proving a current maker-policy failure on the same backend flow"
"${CLI[@]}" maker revoke 0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC
"${CLI[@]}" rfq-quote --backend "http://127.0.0.1:${BACKEND_PORT}" \
  --amount-in 5000000 --out "$REJECTED_QUOTE_FILE"
if "${CLI[@]}" buy 0 --venue rfq --quote "$REJECTED_QUOTE_FILE"; then
  echo "ERROR: revoked maker quote unexpectedly settled" >&2
  exit 1
fi
echo "    PASS: revoked maker quote was rejected"

echo ""
echo "==> E2E demo complete: scenario suite + backend/CLI/Router RFQ flow passed."
