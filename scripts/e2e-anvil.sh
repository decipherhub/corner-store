#!/usr/bin/env bash
#
# Live-Anvil E2E runner + stakeholder demo driver.
#
# Starts a fresh Anvil node, deploys the FULL Corner Store stack (DeployStack),
# runs the 7-scenario demo suite (DemoScenarios), prints the PASS/FAIL summary,
# and tears the node down on exit. Runs fully offline.
#
# Usage:
#   scripts/e2e-anvil.sh [--port N] [--backend-port N] [--profile buidl-like|reg-d] [--mode full|rfq] [--pid-file PATH] [--keep]
#
#   --port N   Anvil port (default 8545).
#   --backend-port N  RFQ demo backend port (default 8787).
#   --profile  Asset profile (default buidl-like; alternative reg-d).
#   --mode     full runs the 7-scenario suite plus RFQ; rfq runs the concise
#              backend/CLI/Router RFQ walkthrough only (default full).
#   --pid-file  write Anvil and RFQ backend PIDs for a supervising launcher.
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
DEMO_MODE=full
PID_FILE=""
while [ $# -gt 0 ]; do
  case "$1" in
    --port) PORT="$2"; shift 2 ;;
    --port=*) PORT="${1#*=}"; shift ;;
    --profile) ASSET_PROFILE="$2"; shift 2 ;;
    --profile=*) ASSET_PROFILE="${1#*=}"; shift ;;
    --backend-port) BACKEND_PORT="$2"; shift 2 ;;
    --backend-port=*) BACKEND_PORT="${1#*=}"; shift ;;
    --mode) DEMO_MODE="$2"; shift 2 ;;
    --mode=*) DEMO_MODE="${1#*=}"; shift ;;
    --pid-file) PID_FILE="$2"; shift 2 ;;
    --pid-file=*) PID_FILE="${1#*=}"; shift ;;
    --keep) KEEP=1; shift ;;
    -h|--help) grep '^#' "$0" | sed 's/^# \{0,1\}//'; exit 0 ;;
    *) echo "unknown argument: $1" >&2; exit 2 ;;
  esac
done

case "$ASSET_PROFILE" in
  buidl-like|reg-d) ;;
  *) echo "invalid --profile: $ASSET_PROFILE (expected buidl-like or reg-d)" >&2; exit 2 ;;
esac

case "$DEMO_MODE" in
  full|rfq) ;;
  *) echo "invalid --mode: $DEMO_MODE (expected full or rfq)" >&2; exit 2 ;;
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
    if [ -n "$PID_FILE" ]; then
      printf '%s\n%s\n' "$ANVIL_PID" "$BACKEND_PID" > "$PID_FILE"
    fi
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
if [ "$KEEP" -eq 1 ]; then
  nohup anvil --port "$PORT" --silent >"$ANVIL_LOG" 2>&1 </dev/null &
else
  anvil --port "$PORT" --silent >"$ANVIL_LOG" 2>&1 &
fi
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

if [ "$DEMO_MODE" = "full" ]; then
  echo ""
  echo "==> Running the full 7-scenario demo suite (script/DemoScenarios.s.sol)"
  forge script script/DemoScenarios.s.sol:DemoScenarios \
    --rpc-url "$RPC" --broadcast --offline
else
  echo "==> RFQ mode: skipping AMM/lifecycle/surveillance scenarios"
fi

echo ""
echo "==> Building CLI and RFQ demo backend"
npm run build --prefix services/cli >/dev/null
npm run build --prefix services/rfq-demo-backend >/dev/null

CLI=(node services/cli/dist/cli/src/index.js --rpc "$RPC" --artifact deployments/anvil-e2e.json)
if [ "$DEMO_MODE" = "full" ]; then
  echo "==> Advancing the live chain through the manifest recovery timelock"
  cast rpc --rpc-url "$RPC" evm_increaseTime 86400 >/dev/null
  cast rpc --rpc-url "$RPC" evm_mine >/dev/null
  "${CLI[@]}" manifest resume
  "${CLI[@]}" buy 5000000 --venue amm
  echo "    PASS: delayed manifest recovery restored AMM settlement"
fi

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
if [ "$KEEP" -eq 1 ]; then
  nohup env RFQ_DEMO_ENABLE_SETTLEMENT=1 node services/rfq-demo-backend/dist/rfq-demo-backend/src/index.js \
    --port "$BACKEND_PORT" --rpc "$RPC" >"$BACKEND_LOG" 2>&1 </dev/null &
else
  RFQ_DEMO_ENABLE_SETTLEMENT=1 node services/rfq-demo-backend/dist/rfq-demo-backend/src/index.js \
    --port "$BACKEND_PORT" --rpc "$RPC" >"$BACKEND_LOG" 2>&1 &
fi
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

echo "==> Proving the dashboard's click-through settlement endpoint"
DEMO_READY=$(curl -fsS -X POST "http://127.0.0.1:${BACKEND_PORT}/demo/setup" \
  -H "content-type: application/json" \
  -d '{}')
node -e 'const value=JSON.parse(process.argv[1]); if (!value.ready || !value.makerApproved) { console.error(value); process.exit(1); } console.log("    PASS: dashboard setup prepared the on-chain maker");' "$DEMO_READY"
DEMO_SETTLED=$(curl -fsS -X POST "http://127.0.0.1:${BACKEND_PORT}/demo/trade" \
  -H "content-type: application/json" \
  -d '{"amountIn":"5000000000000000000000000","action":"settle"}')
node -e 'const value=JSON.parse(process.argv[1]); if (!value.transaction?.hash || BigInt(value.transaction.rwaDelta) <= 0n) process.exit(1); console.log(`    PASS: dashboard trade settled in block ${value.transaction.blockNumber}`);' "$DEMO_SETTLED"
DEMO_REJECTED=$(curl -sS -X POST "http://127.0.0.1:${BACKEND_PORT}/demo/trade" \
  -H "content-type: application/json" \
  -d '{"amountIn":"5000000000000000000000000","action":"revoked-maker"}')
node -e 'const value=JSON.parse(process.argv[1]); if (value.rejection !== "RFQMakerNotApproved") { console.error(value); process.exit(1); } console.log("    PASS: dashboard maker-revocation returned RFQMakerNotApproved");' "$DEMO_REJECTED"
DEMO_REVOKED_STATE=$(curl -fsS "http://127.0.0.1:${BACKEND_PORT}/demo/state")
node -e 'const value=JSON.parse(process.argv[1]); if (value.makerApproved) { console.error(value); process.exit(1); } console.log("    PASS: maker remains revoked until an explicit restore");' "$DEMO_REVOKED_STATE"
DEMO_RESTORED=$(curl -fsS -X POST "http://127.0.0.1:${BACKEND_PORT}/demo/restore" \
  -H "content-type: application/json" \
  -d '{}')
node -e 'const value=JSON.parse(process.argv[1]); if (!value.ready || !value.makerApproved) { console.error(value); process.exit(1); } console.log("    PASS: dashboard restore re-approved the maker on chain");' "$DEMO_RESTORED"

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

if [ "$KEEP" -eq 1 ]; then
  echo "==> Restoring the demo maker for the interactive session"
  "${CLI[@]}" maker approve 0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC
  echo "    maker restored: request another RFQ quote in a second terminal"
fi

echo ""
if [ "$DEMO_MODE" = "full" ]; then
  echo "==> E2E demo complete: scenario suite + backend/CLI/Router RFQ flow passed."
else
  echo "==> RFQ demo complete: mock TA profile + toolkit/CLI + backend/Router RFQ flow passed."
fi
