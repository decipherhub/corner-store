#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
cd "$ROOT_DIR"

PORT=8545
BACKEND_PORT=8787
BIND_HOST=127.0.0.1
PUBLIC_HOST=127.0.0.1
KEEP=0
PID_FILE=""
SCENARIO_FILE="services/rfq-demo-backend/config/tsv-style-scenario.json"

while [ $# -gt 0 ]; do
  case "$1" in
    --port) PORT="$2"; shift 2 ;;
    --backend-port) BACKEND_PORT="$2"; shift 2 ;;
    --bind-host) BIND_HOST="$2"; shift 2 ;;
    --public-host) PUBLIC_HOST="$2"; shift 2 ;;
    --scenario) SCENARIO_FILE="$2"; shift 2 ;;
    --pid-file) PID_FILE="$2"; shift 2 ;;
    --keep) KEEP=1; shift ;;
    -h|--help)
      echo "Usage: scripts/e2e-tsv-style.sh [--port N] [--backend-port N] [--scenario PATH] [--keep]"
      exit 0
      ;;
    *) echo "unknown argument: $1" >&2; exit 2 ;;
  esac
done

case "$BIND_HOST:$PUBLIC_HOST" in
  127.0.0.1:127.0.0.1|localhost:localhost|127.0.0.1:localhost|localhost:127.0.0.1) ;;
  *) echo "ERROR: the unauthenticated TSV demo only accepts loopback hosts." >&2; exit 2 ;;
esac

for port in "$PORT" "$BACKEND_PORT"; do
  case "$port" in *[!0-9]*|"") echo "ERROR: ports must be integers." >&2; exit 2 ;; esac
  if [ "$port" -lt 1024 ] || [ "$port" -gt 65535 ]; then
    echo "ERROR: ports must be between 1024 and 65535." >&2
    exit 2
  fi
  if lsof -nP -iTCP:"$port" -sTCP:LISTEN >/dev/null 2>&1; then
    echo "ERROR: port ${port} is already in use." >&2
    exit 1
  fi
done
if [ "$PORT" -eq "$BACKEND_PORT" ]; then
  echo "ERROR: Anvil and backend ports must differ." >&2
  exit 2
fi

mkdir -p deployments
test -f "$SCENARIO_FILE" || { echo "ERROR: scenario not found: $SCENARIO_FILE" >&2; exit 2; }
cp "$SCENARIO_FILE" deployments/anvil-e2e-scenario.json

RPC="http://${PUBLIC_HOST}:${PORT}"
BACKEND_BASE="http://${PUBLIC_HOST}:${BACKEND_PORT}"
ANVIL_LOG=$(mktemp -t corner-store-tsv-anvil.XXXXXX)
BACKEND_LOG=$(mktemp -t corner-store-tsv-backend.XXXXXX)
ANVIL_PID=""
BACKEND_PID=""

cleanup() {
  local status=$?
  if [ "$KEEP" -eq 1 ] && [ "$status" -eq 0 ]; then
    if [ -n "$PID_FILE" ]; then printf '%s\n%s\n' "$ANVIL_PID" "$BACKEND_PID" > "$PID_FILE"; fi
    echo "==> TSV-style Anvil and read-only demo backend left running"
    return
  fi
  [ -z "$BACKEND_PID" ] || ! kill -0 "$BACKEND_PID" 2>/dev/null || kill "$BACKEND_PID" 2>/dev/null || true
  [ -z "$ANVIL_PID" ] || ! kill -0 "$ANVIL_PID" 2>/dev/null || kill "$ANVIL_PID" 2>/dev/null || true
  rm -f "$ANVIL_LOG" "$BACKEND_LOG"
}
trap cleanup EXIT INT TERM

echo "==> Starting deterministic local Anvil"
anvil --host "$BIND_HOST" --port "$PORT" --silent >"$ANVIL_LOG" 2>&1 &
ANVIL_PID=$!
for _ in $(seq 1 50); do
  cast block-number --rpc-url "$RPC" >/dev/null 2>&1 && break
  sleep 0.2
done
cast block-number --rpc-url "$RPC" >/dev/null

echo "==> Deploying dedicated tsv-style profile"
ASSET_PROFILE=tsv-style forge script script/DeployStack.s.sol:DeployStack \
  --rpc-url "$RPC" --broadcast --offline >/dev/null

node - <<'NODE'
const fs = require("fs");
const artifact = JSON.parse(fs.readFileSync("deployments/anvil-e2e.json", "utf8"));
if (artifact.assetProfile !== "tsv-style" || artifact.tsvStyleEnabled !== true) throw Error("TSV profile missing");
if (Number(artifact.tsvStyleRecipeId) !== 40 || !artifact.tsvStyleVenue) throw Error("TSV deployment evidence missing");
if (!artifact.tsvStyleIdentityEvidence || !artifact.tsvStylePairedAssetElement || !artifact.tsvStyleVolumeLimit) {
  throw Error("TSV element evidence missing");
}
NODE

RWA=$(node -p 'require("./deployments/anvil-e2e.json").rwaToken')
POLICY=$(node -p 'require("./deployments/anvil-e2e.json").policyReg')
STATUS=$(cast call "$POLICY" 'statusOf(address)(uint8)' "$RWA" --rpc-url "$RPC")
test "$STATUS" = "2"
echo "    PASS: Recipe 40 manifest is ACTIVE and bound to the AMM profile"

echo "==> Executing one real Router -> AMM settlement"
npm run build --prefix services/cli >/dev/null
INVESTOR=$(node -p 'require("./deployments/anvil-e2e.json").investor')
VOLUME=$(node -p 'require("./deployments/anvil-e2e.json").tsvStyleVolumeLimit')
BEFORE_BALANCE=$(cast call "$RWA" 'balanceOf(address)(uint256)' "$INVESTOR" --rpc-url "$RPC" | awk '{print $1}')
BEFORE_VOLUME=$(cast call "$VOLUME" 'currentPeriodVolume()(uint256)' --rpc-url "$RPC" | awk '{print $1}')
TRADE_OUTPUT=$(node services/cli/dist/cli/src/index.js --rpc "$RPC" --artifact deployments/anvil-e2e.json \
  --account 1 buy 250 --venue amm)
printf '%s\n' "$TRADE_OUTPUT" >/dev/null
AFTER_BALANCE=$(cast call "$RWA" 'balanceOf(address)(uint256)' "$INVESTOR" --rpc-url "$RPC" | awk '{print $1}')
AFTER_VOLUME=$(cast call "$VOLUME" 'currentPeriodVolume()(uint256)' --rpc-url "$RPC" | awk '{print $1}')
node -e '
const [beforeBalance, afterBalance, beforeVolume, afterVolume] = process.argv.slice(1).map(BigInt);
if (afterBalance <= beforeBalance || afterVolume <= beforeVolume) process.exit(1);
' "$BEFORE_BALANCE" "$AFTER_BALANCE" "$BEFORE_VOLUME" "$AFTER_VOLUME"

set +e
BLOCKED_OUTPUT=$(node services/cli/dist/cli/src/index.js --rpc "$RPC" --artifact deployments/anvil-e2e.json \
  --account 1 buy 1 --venue amm 2>&1)
BLOCKED_STATUS=$?
set -e
if [ "$BLOCKED_STATUS" -eq 0 ]; then
  echo "ERROR: trade above the TSV demo period limit unexpectedly settled" >&2
  exit 1
fi
POST_BLOCK_BALANCE=$(cast call "$RWA" 'balanceOf(address)(uint256)' "$INVESTOR" --rpc-url "$RPC" | awk '{print $1}')
POST_BLOCK_VOLUME=$(cast call "$VOLUME" 'currentPeriodVolume()(uint256)' --rpc-url "$RPC" | awk '{print $1}')
test "$POST_BLOCK_BALANCE" = "$AFTER_BALANCE"
test "$POST_BLOCK_VOLUME" = "$AFTER_VOLUME"

TX_HASH=$(printf '%s\n' "$TRADE_OUTPUT" | sed -n 's/.*execute: \(0x[0-9a-fA-F]*\).*/\1/p' | head -n 1)
BLOCK_NUMBER=$(printf '%s\n' "$TRADE_OUTPUT" | sed -n 's/.*(block \([0-9][0-9]*\), status.*/\1/p' | head -n 1)
ENGINE=$(node -p 'require("./deployments/anvil-e2e.json").engine')
POLICY_ID=$(cast call "$ENGINE" 'policyHashesOf(address)(bytes32,bytes32,bytes32)' "$RWA" --rpc-url "$RPC" | tail -n 1 | awk '{print $1}')
BLOCK_TIMESTAMP=$(cast block "$BLOCK_NUMBER" --field timestamp --rpc-url "$RPC" | awk '{print $1}')
node - "$TX_HASH" "$BLOCK_NUMBER" "$BLOCK_TIMESTAMP" "$INVESTOR" "$POLICY_ID" "$AFTER_VOLUME" <<'NODE'
const fs = require("fs");
const [txHash, blockNumber, timestamp, buyer, policyId, periodVolume] = process.argv.slice(2);
if (!/^0x[0-9a-fA-F]{64}$/.test(txHash || "")) throw Error("missing TSV settlement transaction hash");
const path = "deployments/anvil-e2e.json";
const artifact = JSON.parse(fs.readFileSync(path, "utf8"));
artifact.tsvStylePeriodVolume = periodVolume;
artifact.tsvStyleLastSettlement = {
  transactionHash: txHash,
  executionId: txHash,
  blockNumber: Number(blockNumber),
  timestamp: Number(timestamp),
  buyer,
  asset: "tORRN",
  amount: "250",
  policyId
};
artifact.tsvStyleBlockedProbe = {
  attemptedAmount: "1",
  reason: "TSV-VOL period limit exceeded",
  reverted: true,
  recordedOnChain: false
};
fs.writeFileSync(path, `${JSON.stringify(artifact, null, 2)}\n`);
NODE
echo "    PASS: exact period limit settled; the next trade reverted without asset movement"

echo "==> Starting read-only evidence backend"
npm run build --prefix services/rfq-demo-backend >/dev/null
RFQ_DEMO_ENABLE_SETTLEMENT=0 node services/rfq-demo-backend/dist/rfq-demo-backend/src/index.js \
  --host "$BIND_HOST" --port "$BACKEND_PORT" --rpc "$RPC" \
  --scenario deployments/anvil-e2e-scenario.json >"$BACKEND_LOG" 2>&1 &
BACKEND_PID=$!
BACKEND_READY=0
for _ in $(seq 1 50); do
  if curl -fsS "${BACKEND_BASE}/health" >/dev/null 2>&1; then
    BACKEND_READY=1
    break
  fi
  kill -0 "$BACKEND_PID" 2>/dev/null || break
  sleep 0.2
done
if [ "$BACKEND_READY" -ne 1 ]; then
  cat "$BACKEND_LOG" >&2 || true
  exit 1
fi
curl -fsS "${BACKEND_BASE}/health" >/dev/null
STATE=$(curl -fsS "${BACKEND_BASE}/demo/state")
node -e 'const s=JSON.parse(process.argv[1]); if (s.assetProfile !== "tsv-style") process.exit(1);' "$STATE"
STATUS_CODE=$(curl -sS -o /dev/null -w '%{http_code}' -X POST \
  -H 'content-type: application/json' -d '{}' "${BACKEND_BASE}/demo/setup")
test "$STATUS_CODE" = "403"
echo "    PASS: read-only state is available while RFQ/browser mutations remain disabled"

if [ "$KEEP" -eq 1 ]; then
  echo "TSV backend: ${BACKEND_BASE}"
  exit 0
fi
