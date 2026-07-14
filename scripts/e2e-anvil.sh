#!/usr/bin/env bash
#
# Live-Anvil E2E runner + stakeholder demo driver.
#
# Starts a fresh Anvil node, deploys the FULL Corner Store stack (DeployStack),
# runs the 7-scenario demo suite (DemoScenarios), prints the PASS/FAIL summary,
# and tears the node down on exit. Runs fully offline.
#
# Usage:
#   scripts/e2e-anvil.sh [--port N] [--keep]
#
#   --port N   Anvil port (default 8545).
#   --keep     Leave Anvil running after the suite (attach a UI / continue the
#              demo interactively). Otherwise Anvil is killed on exit.
#
# Exit code is non-zero if any scenario fails (DemoScenarios reverts).
set -euo pipefail

ROOT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
cd "$ROOT_DIR"

PORT=8545
KEEP=0
while [ $# -gt 0 ]; do
  case "$1" in
    --port) PORT="$2"; shift 2 ;;
    --port=*) PORT="${1#*=}"; shift ;;
    --keep) KEEP=1; shift ;;
    -h|--help) grep '^#' "$0" | sed 's/^# \{0,1\}//'; exit 0 ;;
    *) echo "unknown argument: $1" >&2; exit 2 ;;
  esac
done

RPC="http://127.0.0.1:${PORT}"
ANVIL_LOG=$(mktemp -t corner-store-anvil.XXXXXX)
ANVIL_PID=""

cleanup() {
  if [ "$KEEP" -eq 1 ]; then
    if [ -n "$ANVIL_PID" ]; then
      echo ""
      echo "==> --keep set: Anvil left running (pid ${ANVIL_PID}) on ${RPC}"
      echo "    stop it with: kill ${ANVIL_PID}"
    fi
    return
  fi
  if [ -n "$ANVIL_PID" ] && kill -0 "$ANVIL_PID" 2>/dev/null; then
    kill "$ANVIL_PID" 2>/dev/null || true
    wait "$ANVIL_PID" 2>/dev/null || true
  fi
  rm -f "$ANVIL_LOG"
}
trap cleanup EXIT INT TERM

mkdir -p deployments

echo "==> Starting Anvil on ${RPC} (offline, deterministic mnemonic)"
anvil --port "$PORT" --silent >"$ANVIL_LOG" 2>&1 &
ANVIL_PID=$!

echo "==> Waiting for Anvil to accept connections"
READY=0
for _ in $(seq 1 50); do
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
forge script script/DeployStack.s.sol:DeployStack \
  --rpc-url "$RPC" --broadcast --offline

echo ""
echo "==> Running the demo scenario suite (script/DemoScenarios.s.sol)"
forge script script/DemoScenarios.s.sol:DemoScenarios \
  --rpc-url "$RPC" --broadcast --offline

echo ""
echo "==> E2E demo complete: all scenarios passed."
