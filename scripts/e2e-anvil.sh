#!/usr/bin/env bash
#
# Live-Anvil E2E runner + stakeholder demo driver.
#
# Starts a fresh Anvil node, deploys the FULL Corner Store stack (DeployStack),
# runs the 7-scenario demo suite (DemoScenarios), prints the PASS/FAIL summary,
# and tears the node down on exit. Runs fully offline.
#
# Usage:
#   scripts/e2e-anvil.sh [--port N] [--backend-port N] [--profile buidl-like|reg-d] [--mode full|rfq]
#                        [--scenario PATH] [--bind-host HOST] [--public-host HOST]
#                        [--pid-file PATH] [--keep]
#
#   --port N   Anvil port (default 8545).
#   --backend-port N  RFQ demo backend port (default 8787).
#   --profile  Asset profile (default buidl-like; alternative reg-d).
#   --mode     full runs the 7-scenario suite plus RFQ; rfq runs the concise
#              backend/CLI/Router RFQ walkthrough only (default full).
#   --scenario  injected demo data and temporal transaction scenario JSON.
#   --bind-host  service bind host (default 127.0.0.1).
#   --public-host host used by local clients (default 127.0.0.1).
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
BIND_HOST=127.0.0.1
PUBLIC_HOST=127.0.0.1
DEMO_MODE=full
PID_FILE=""
SCENARIO_FILE="services/rfq-demo-backend/config/demo-scenario.json"
while [ $# -gt 0 ]; do
  case "$1" in
    --port) PORT="$2"; shift 2 ;;
    --port=*) PORT="${1#*=}"; shift ;;
    --profile) ASSET_PROFILE="$2"; shift 2 ;;
    --profile=*) ASSET_PROFILE="${1#*=}"; shift ;;
    --backend-port) BACKEND_PORT="$2"; shift 2 ;;
    --backend-port=*) BACKEND_PORT="${1#*=}"; shift ;;
    --bind-host) BIND_HOST="$2"; shift 2 ;;
    --public-host) PUBLIC_HOST="$2"; shift 2 ;;
    --mode) DEMO_MODE="$2"; shift 2 ;;
    --mode=*) DEMO_MODE="${1#*=}"; shift ;;
    --scenario) SCENARIO_FILE="$2"; shift 2 ;;
    --scenario=*) SCENARIO_FILE="${1#*=}"; shift ;;
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

case "$BIND_HOST:$PUBLIC_HOST" in
  127.0.0.1:127.0.0.1|localhost:localhost|127.0.0.1:localhost|localhost:127.0.0.1) ;;
  *)
    echo "ERROR: the unauthenticated local E2E only accepts loopback hosts." >&2
    exit 2
    ;;
esac

for port in "$PORT" "$BACKEND_PORT"; do
  case "$port" in
    *[!0-9]*|"") echo "ERROR: E2E ports must be integers." >&2; exit 2 ;;
  esac
  if [ "$port" -lt 1024 ] || [ "$port" -gt 65535 ]; then
    echo "ERROR: E2E ports must be between 1024 and 65535." >&2
    exit 2
  fi
done
if [ "$PORT" -eq "$BACKEND_PORT" ]; then
  echo "ERROR: Anvil and RFQ backend ports must be different." >&2
  exit 2
fi

require_available_port() {
  local port=$1
  local label=$2
  if lsof -nP -iTCP:"$port" -sTCP:LISTEN >/dev/null 2>&1; then
    echo "ERROR: ${label} port ${port} is already in use." >&2
    echo "Stop the existing demo or choose another port." >&2
    exit 1
  fi
}

require_available_port "$PORT" "Anvil"
require_available_port "$BACKEND_PORT" "RFQ backend"

RPC="http://${PUBLIC_HOST}:${PORT}"
BACKEND_BASE="http://${PUBLIC_HOST}:${BACKEND_PORT}"
ANVIL_LOG=$(mktemp -t corner-store-anvil.XXXXXX)
ANVIL_PID=""
BACKEND_LOG=$(mktemp -t corner-store-rfq-backend.XXXXXX)
BACKEND_PID=""
QUOTE_FILE=$(mktemp -t corner-store-rfq-quote.XXXXXX)
REJECTED_QUOTE_FILE=$(mktemp -t corner-store-rfq-rejected.XXXXXX)
CHECKPOINT_FILE="${TMPDIR:-/tmp}/corner-store-e2e-checkpoint.$$"

cleanup() {
  local status=$?
  if [ "$KEEP" -eq 1 ] && [ "$status" -eq 0 ]; then
    if [ -n "$PID_FILE" ]; then
      printf '%s\n%s\n' "$ANVIL_PID" "$BACKEND_PID" > "$PID_FILE"
    fi
    if [ -n "$ANVIL_PID" ]; then
      echo ""
      echo "==> --keep set: Anvil left running (pid ${ANVIL_PID}) on ${RPC}"
      echo "    stop it with: kill ${ANVIL_PID}"
    fi
    if [ -n "$BACKEND_PID" ]; then
      echo "    RFQ backend left running (pid ${BACKEND_PID}) on ${BACKEND_BASE}"
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
if [ ! -f "$SCENARIO_FILE" ]; then
  echo "ERROR: demo scenario not found: $SCENARIO_FILE" >&2
  exit 2
fi
SCENARIO_FILE=$(CDPATH= cd -- "$(dirname -- "$SCENARIO_FILE")" && pwd)/$(basename -- "$SCENARIO_FILE")
RUNTIME_SCENARIO="deployments/anvil-e2e-scenario.json"
cp "$SCENARIO_FILE" "$RUNTIME_SCENARIO"
node -e '
const fs = require("fs");
const value = JSON.parse(fs.readFileSync(process.argv[1], "utf8"));
if (value.schemaVersion !== 2) throw Error("demo scenario schemaVersion must be 2");
for (const path of [
  ["execution", "defaultBuyAmountBaseUnits"],
  ["execution", "defaultSellAmountBaseUnits"],
  ["execution", "minimumTradeBufferBps"],
  ["execution", "defaultQuoteTtlSeconds"],
  ["marketHistory", "sampleIntervalSeconds"],
  ["deployment", "initialBalancesBaseUnits", "investorQuote"],
  ["deployment", "initialBalancesBaseUnits", "investorRwa"],
  ["deployment", "initialBalancesBaseUnits", "makerQuote"],
  ["deployment", "initialBalancesBaseUnits", "makerRwa"]
]) {
  let current = value;
  for (const key of path) current = current?.[key];
  if (current === undefined) throw Error(`demo scenario missing ${path.join(".")}`);
}
' "$RUNTIME_SCENARIO"

SCENARIO_BUY_AMOUNT=$(node -e 'const v=require("./"+process.argv[1]); process.stdout.write(v.execution.defaultBuyAmountBaseUnits);' "$RUNTIME_SCENARIO")
SCENARIO_SELL_AMOUNT=$(node -e 'const v=require("./"+process.argv[1]); process.stdout.write(v.execution.defaultSellAmountBaseUnits);' "$RUNTIME_SCENARIO")
SCENARIO_TTL=$(node -e 'const v=require("./"+process.argv[1]); process.stdout.write(String(v.execution.defaultQuoteTtlSeconds));' "$RUNTIME_SCENARIO")
SCENARIO_INVESTOR_ACCOUNT=$(node -e 'const v=require("./"+process.argv[1]); process.stdout.write(String(v.deployment.accounts.investor));' "$RUNTIME_SCENARIO")
SCENARIO_BUY_DISPLAY=$(node -e 'const v=require("./"+process.argv[1]); const a=BigInt(v.execution.defaultBuyAmountBaseUnits), d=BigInt(v.quoteAsset.decimals), s=10n**d; process.stdout.write(`${a/s}${a%s ? `.${(a%s).toString().padStart(Number(d),"0").replace(/0+$/,"")}` : ""}`);' "$RUNTIME_SCENARIO")

echo "==> Starting Anvil on ${RPC} (offline, deterministic mnemonic)"
if [ "$KEEP" -eq 1 ]; then
  nohup anvil --host "$BIND_HOST" --port "$PORT" --silent >"$ANVIL_LOG" 2>&1 </dev/null &
else
  anvil --host "$BIND_HOST" --port "$PORT" --silent >"$ANVIL_LOG" 2>&1 &
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

echo "==> Deploying production core + explicit local demo activation (script/DeployStack.s.sol)"
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
  "${CLI[@]}" --account "$SCENARIO_INVESTOR_ACCOUNT" buy "$SCENARIO_BUY_DISPLAY" --venue amm
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

echo "==> Starting RFQ demo backend on http://${PUBLIC_HOST}:${BACKEND_PORT}"
if [ "$KEEP" -eq 1 ]; then
  nohup env RFQ_DEMO_ENABLE_SETTLEMENT=1 node services/rfq-demo-backend/dist/rfq-demo-backend/src/index.js \
    --host "$BIND_HOST" --port "$BACKEND_PORT" --rpc "$RPC" --scenario "$RUNTIME_SCENARIO" >"$BACKEND_LOG" 2>&1 </dev/null &
else
  RFQ_DEMO_ENABLE_SETTLEMENT=1 node services/rfq-demo-backend/dist/rfq-demo-backend/src/index.js \
    --host "$BIND_HOST" --port "$BACKEND_PORT" --rpc "$RPC" --scenario "$RUNTIME_SCENARIO" >"$BACKEND_LOG" 2>&1 &
fi
BACKEND_PID=$!

BACKEND_READY=0
for _ in $(seq 1 50); do
  if ! kill -0 "$BACKEND_PID" 2>/dev/null; then
    break
  fi
  if curl -fsS "http://${PUBLIC_HOST}:${BACKEND_PORT}/health" >/dev/null 2>&1; then
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
DEMO_READY=$(curl -fsS -X POST "${BACKEND_BASE}/demo/setup" \
  -H "content-type: application/json" \
  -d '{}')
node -e 'const value=JSON.parse(process.argv[1]); if (!value.ready || !value.makerApproved) { console.error(value); process.exit(1); } console.log("    PASS: dashboard setup prepared the on-chain maker");' "$DEMO_READY"
DEMO_MARKET_READY=$(curl -fsS "${BACKEND_BASE}/demo/market-history")
node -e 'const value=JSON.parse(process.argv[1]); if (value.oracle?.length < 60 || value.indicative?.length !== value.oracle.length || value.fills?.length !== 0 || value.oracle[1].timestamp - value.oracle[0].timestamp !== 60) { console.error(value); process.exit(1); } console.log(`    PASS: ${value.oracle.length} one-minute NAV/indicative samples loaded with no synthetic fills`);' "$DEMO_MARKET_READY"

echo "==> Proving the RFQAdapter direct-call boundary with a failed transaction receipt"
ADAPTER_BOUNDARY=$(curl -fsS -X POST "${BACKEND_BASE}/demo/enforcement/adapter-boundary" \
  -H "content-type: application/json" \
  -d '{}')
node -e 'const value=JSON.parse(process.argv[1]); if (value.outcome !== "BLOCKED" || value.rejection !== "NotAuthorized" || !value.attemptedTransaction?.hash || value.attemptedTransaction.status !== 0 || !value.balanceEvidence?.unchanged) { console.error(value); process.exit(1); } console.log(`    PASS: direct Adapter call failed in block ${value.attemptedTransaction.blockNumber} and balances remained unchanged`);' "$ADAPTER_BOUNDARY"
DEMO_AMOUNT=$(node -e 'const value=JSON.parse(process.argv[1]); process.stdout.write(value.suggestedTradeAmounts.buyAmountIn);' "$DEMO_READY")
DEMO_SELL_AMOUNT=$(node -e 'const value=JSON.parse(process.argv[1]); process.stdout.write(value.suggestedTradeAmounts.sellAmountIn);' "$DEMO_READY")
DEMO_AMOUNT_DISPLAY="$SCENARIO_BUY_DISPLAY"
DEMO_MAKER=$(node -e 'const value=JSON.parse(process.argv[1]); process.stdout.write(value.maker);' "$DEMO_READY")
DEMO_INVESTOR=$(node -e 'const value=JSON.parse(process.argv[1]); process.stdout.write(value.investor);' "$DEMO_READY")
DEMO_QUOTE=$(curl -fsS -X POST "${BACKEND_BASE}/demo/quote" \
  -H "content-type: application/json" \
  -d "{\"amountIn\":\"${DEMO_AMOUNT}\",\"ttlSeconds\":${SCENARIO_TTL}}")
DEMO_TAMPER_BODY=$(node -e 'const quote=JSON.parse(process.argv[1]); quote.quote.tokenOut="0x0000000000000000000000000000000000000001"; process.stdout.write(JSON.stringify({amountIn:quote.quote.amountIn,action:"settle",quote}));' "$DEMO_QUOTE")
DEMO_TAMPERED=$(curl -sS -X POST "${BACKEND_BASE}/demo/trade" \
  -H "content-type: application/json" \
  -d "$DEMO_TAMPER_BODY")
node -e 'const value=JSON.parse(process.argv[1]); if (value.error !== "invalid_request" || !/token pair does not match/.test(value.message || "")) { console.error(value); process.exit(1); } console.log("    PASS: dashboard trade rejected a tampered quote payload");' "$DEMO_TAMPERED"
DEMO_TRADE_BODY=$(node -e 'const quote=JSON.parse(process.argv[1]); process.stdout.write(JSON.stringify({amountIn:quote.quote.amountIn,action:"settle",quote}));' "$DEMO_QUOTE")
DEMO_SETTLED=$(curl -sS -X POST "${BACKEND_BASE}/demo/trade" \
  -H "content-type: application/json" \
  -d "$DEMO_TRADE_BODY")
node -e 'const value=JSON.parse(process.argv[1]); if (!value.transaction?.hash || BigInt(value.transaction.rwaDelta) <= 0n) { console.error(value); process.exit(1); } console.log(`    PASS: dashboard trade settled in block ${value.transaction.blockNumber}`);' "$DEMO_SETTLED"
DEMO_AFTER_BUY=$(curl -fsS "${BACKEND_BASE}/demo/state")
node -e 'const before=JSON.parse(process.argv[1]), value=JSON.parse(process.argv[2]); const movedUp=BigInt(value.marketPrice.numerator)*BigInt(before.marketPrice.denominator)>BigInt(before.marketPrice.numerator)*BigInt(value.marketPrice.denominator); if (value.marketPrice?.lastMove !== "buy-up" || !movedUp || BigInt(value.suggestedTradeAmounts.buyAmountIn) <= 0n) { console.error(value); process.exit(1); } console.log(`    PASS: successful buy moved the market and recalculated the suggested input to ${value.suggestedTradeAmounts.buyAmountIn}`);' "$DEMO_READY" "$DEMO_AFTER_BUY"
DEMO_NEXT_BUY_AMOUNT=$(node -e 'const value=JSON.parse(process.argv[1]); process.stdout.write(value.suggestedTradeAmounts.buyAmountIn);' "$DEMO_AFTER_BUY")
DEMO_NEXT_BUY_PRECHECK=$(curl -fsS -X POST "${BACKEND_BASE}/demo/precheck" \
  -H "content-type: application/json" \
  -d "{\"taker\":\"${DEMO_INVESTOR}\",\"amountIn\":\"${DEMO_NEXT_BUY_AMOUNT}\",\"side\":\"buy\"}")
node -e 'const value=JSON.parse(process.argv[1]); if (!value.allowed) { console.error(value); process.exit(1); } console.log("    PASS: repeated buy suggestion remained above the live minimum-investment policy");' "$DEMO_NEXT_BUY_PRECHECK"
DEMO_MARKET_AFTER_BUY=$(curl -fsS "${BACKEND_BASE}/demo/market-history")
node -e 'const value=JSON.parse(process.argv[1]); if (value.fills?.length !== 1 || value.fills[0].side !== "buy" || !value.fills[0].transactionHash) { console.error(value); process.exit(1); } console.log("    PASS: market history recorded the real Router buy fill");' "$DEMO_MARKET_AFTER_BUY"
echo "==> Proving the dashboard's reverse RFQ sell flow"
DEMO_SELL_PRECHECK=$(curl -fsS -X POST "${BACKEND_BASE}/demo/precheck" \
  -H "content-type: application/json" \
  -d "{\"taker\":\"${DEMO_INVESTOR}\",\"amountIn\":\"${DEMO_SELL_AMOUNT}\",\"side\":\"sell\"}")
node -e 'const value=JSON.parse(process.argv[1]); if (!value.allowed || value.side !== "sell" || BigInt(value.amountOut) <= 0n) { console.error(value); process.exit(1); } console.log("    PASS: next sell pre-check used the current runtime price");' "$DEMO_SELL_PRECHECK"
DEMO_SELL_QUOTE=$(curl -fsS -X POST "${BACKEND_BASE}/demo/quote" \
  -H "content-type: application/json" \
  -d "{\"amountIn\":\"${DEMO_SELL_AMOUNT}\",\"side\":\"sell\",\"ttlSeconds\":${SCENARIO_TTL}}")
node -e 'const precheck=JSON.parse(process.argv[1]), value=JSON.parse(process.argv[2]); if (value.quote.amountOut !== precheck.amountOut || value.quote.amountIn !== precheck.amountIn) { console.error({precheck,value}); process.exit(1); } console.log("    PASS: firm quote signer used the same runtime price as pre-check");' "$DEMO_SELL_PRECHECK" "$DEMO_SELL_QUOTE"
DEMO_SELL_BODY=$(node -e 'const quote=JSON.parse(process.argv[1]); process.stdout.write(JSON.stringify({amountIn:quote.quote.amountIn,action:"settle",quote}));' "$DEMO_SELL_QUOTE")
DEMO_SOLD=$(curl -sS -X POST "${BACKEND_BASE}/demo/trade" \
  -H "content-type: application/json" \
  -d "$DEMO_SELL_BODY")
node -e 'const value=JSON.parse(process.argv[1]); if (value.side !== "sell" || !value.transaction?.hash || BigInt(value.transaction.rwaDelta) >= 0n || BigInt(value.transaction.quoteDelta) <= 0n) { console.error(value); process.exit(1); } console.log(`    PASS: dashboard sell moved RWA to maker and quote asset to investor in block ${value.transaction.blockNumber}`);' "$DEMO_SOLD"
DEMO_AFTER_SELL=$(curl -fsS "${BACKEND_BASE}/demo/state")
node -e 'const before=JSON.parse(process.argv[1]), value=JSON.parse(process.argv[2]); const movedDown=BigInt(value.marketPrice.numerator)*BigInt(before.marketPrice.denominator)<BigInt(before.marketPrice.numerator)*BigInt(value.marketPrice.denominator); if (value.marketPrice?.lastMove !== "sell-down" || !movedDown) { console.error(value); process.exit(1); } console.log(`    PASS: successful sell moved the injected market price down to ${value.marketPrice.numerator}/${value.marketPrice.denominator}`);' "$DEMO_AFTER_BUY" "$DEMO_AFTER_SELL"
DEMO_MARKET_AFTER_SELL=$(curl -fsS "${BACKEND_BASE}/demo/market-history")
node -e 'const value=JSON.parse(process.argv[1]); if (value.fills?.length !== 2 || value.fills[1].side !== "sell" || BigInt(value.fills[1].amountQuote) <= 0n) { console.error(value); process.exit(1); } console.log("    PASS: market history recorded both live fills and quote volume");' "$DEMO_MARKET_AFTER_SELL"
echo "==> Proving repeated buy/sell liquidity for the interactive demo"
for DEMO_REPEAT in 1 2 3; do
  DEMO_REPEAT_STATE=$(curl -fsS "${BACKEND_BASE}/demo/state")
  DEMO_REPEAT_AMOUNT=$(node -e 'const value=JSON.parse(process.argv[1]); process.stdout.write(value.suggestedTradeAmounts.buyAmountIn);' "$DEMO_REPEAT_STATE")
  DEMO_REPEAT_QUOTE=$(curl -fsS -X POST "${BACKEND_BASE}/demo/quote" \
    -H "content-type: application/json" \
    -d "{\"taker\":\"${DEMO_INVESTOR}\",\"amountIn\":\"${DEMO_REPEAT_AMOUNT}\",\"side\":\"buy\",\"ttlSeconds\":${SCENARIO_TTL}}")
  DEMO_REPEAT_BODY=$(node -e 'const quote=JSON.parse(process.argv[1]); process.stdout.write(JSON.stringify({amountIn:quote.quote.amountIn,action:"settle",quote}));' "$DEMO_REPEAT_QUOTE")
  DEMO_REPEAT_RESULT=$(curl -fsS -X POST "${BACKEND_BASE}/demo/trade" \
    -H "content-type: application/json" \
    -d "$DEMO_REPEAT_BODY")
  node -e 'const value=JSON.parse(process.argv[1]); if (value.side !== "buy" || !value.transaction?.hash) { console.error(value); process.exit(1); }' "$DEMO_REPEAT_RESULT"
done
for DEMO_REPEAT in 1 2 3; do
  DEMO_REPEAT_STATE=$(curl -fsS "${BACKEND_BASE}/demo/state")
  DEMO_REPEAT_AMOUNT=$(node -e 'const value=JSON.parse(process.argv[1]); process.stdout.write(value.suggestedTradeAmounts.sellAmountIn);' "$DEMO_REPEAT_STATE")
  DEMO_REPEAT_QUOTE=$(curl -fsS -X POST "${BACKEND_BASE}/demo/quote" \
    -H "content-type: application/json" \
    -d "{\"taker\":\"${DEMO_INVESTOR}\",\"amountIn\":\"${DEMO_REPEAT_AMOUNT}\",\"side\":\"sell\",\"ttlSeconds\":${SCENARIO_TTL}}")
  DEMO_REPEAT_BODY=$(node -e 'const quote=JSON.parse(process.argv[1]); process.stdout.write(JSON.stringify({amountIn:quote.quote.amountIn,action:"settle",quote}));' "$DEMO_REPEAT_QUOTE")
  DEMO_REPEAT_RESULT=$(curl -fsS -X POST "${BACKEND_BASE}/demo/trade" \
    -H "content-type: application/json" \
    -d "$DEMO_REPEAT_BODY")
  node -e 'const value=JSON.parse(process.argv[1]); if (value.side !== "sell" || !value.transaction?.hash) { console.error(value); process.exit(1); }' "$DEMO_REPEAT_RESULT"
done
DEMO_REPEAT_HISTORY=$(curl -fsS "${BACKEND_BASE}/demo/market-history")
node -e 'const value=JSON.parse(process.argv[1]); const buys=value.fills.filter((fill)=>fill.side==="buy").length; const sells=value.fills.filter((fill)=>fill.side==="sell").length; if (value.fills.length !== 8 || buys !== 4 || sells !== 4) { console.error(value); process.exit(1); } console.log("    PASS: four live buys and four live sells completed without exhausting demo inventory");' "$DEMO_REPEAT_HISTORY"
DEMO_REJECT_QUOTE=$(curl -fsS -X POST "${BACKEND_BASE}/demo/quote" \
  -H "content-type: application/json" \
  -d "{\"amountIn\":\"${DEMO_AMOUNT}\",\"ttlSeconds\":${SCENARIO_TTL}}")
DEMO_REJECT_BODY=$(node -e 'const quote=JSON.parse(process.argv[1]); process.stdout.write(JSON.stringify({amountIn:quote.quote.amountIn,action:"revoked-maker",quote}));' "$DEMO_REJECT_QUOTE")
DEMO_REJECTED=$(curl -sS -X POST "${BACKEND_BASE}/demo/trade" \
  -H "content-type: application/json" \
  -d "$DEMO_REJECT_BODY")
node -e 'const value=JSON.parse(process.argv[1]); const simulated=value.trace?.some((step)=>step.stage==="Revert simulation" && /RFQMakerNotApproved/.test(step.detail)); if (value.rejection !== "RFQMakerNotApproved" || !simulated || !value.attemptedTransaction?.hash || value.attemptedTransaction.status !== 0 || !value.balanceEvidence?.unchanged) { console.error(value); process.exit(1); } console.log("    PASS: maker-revocation produced a selector-verified failed receipt with unchanged balances");' "$DEMO_REJECTED"
DEMO_REVOKED_STATE=$(curl -fsS "${BACKEND_BASE}/demo/state")
node -e 'const value=JSON.parse(process.argv[1]); if (value.makerApproved) { console.error(value); process.exit(1); } console.log("    PASS: maker remains revoked until an explicit restore");' "$DEMO_REVOKED_STATE"
DEMO_RESTORED=$(curl -fsS -X POST "${BACKEND_BASE}/demo/restore" \
  -H "content-type: application/json" \
  -d '{}')
node -e 'const value=JSON.parse(process.argv[1]); if (!value.ready || !value.makerApproved) { console.error(value); process.exit(1); } console.log("    PASS: dashboard restore re-approved the maker on chain");' "$DEMO_RESTORED"

if [[ "$ASSET_PROFILE" == "buidl-like" ]]; then
  echo "==> Proving BUIDL-like role-aware pre-check and final compliance enforcement"
  DEMO_STATE=$(curl -fsS "${BACKEND_BASE}/demo/state")
  ELIGIBLE_B=$(node -e 'const value=JSON.parse(process.argv[1]); process.stdout.write(value.wallets.find((wallet) => wallet.qualifiedPurchaser).address);' "$DEMO_STATE")
  INELIGIBLE_ID=$(node -e 'const value=JSON.parse(process.argv[1]); process.stdout.write(value.wallets.find((wallet) => !wallet.qualifiedPurchaser).id);' "$DEMO_STATE")
  INELIGIBLE=$(node -e 'const value=JSON.parse(process.argv[1]); process.stdout.write(value.wallets.find((wallet) => !wallet.qualifiedPurchaser).address);' "$DEMO_STATE")
  ELIGIBLE_PRECHECK=$(curl -fsS -X POST "${BACKEND_BASE}/demo/precheck" \
    -H "content-type: application/json" \
    -d "{\"taker\":\"${ELIGIBLE_B}\",\"amountIn\":\"${DEMO_AMOUNT}\"}")
  node -e 'const value=JSON.parse(process.argv[1]); if (!value.allowed || !value.wallet.qualifiedPurchaser) { console.error(value); process.exit(1); } console.log("    PASS: eligible investor B passed the live pre-check");' "$ELIGIBLE_PRECHECK"
  INELIGIBLE_PRECHECK=$(curl -fsS -X POST "${BACKEND_BASE}/demo/precheck" \
    -H "content-type: application/json" \
    -d "{\"taker\":\"${INELIGIBLE}\",\"amountIn\":\"${DEMO_AMOUNT}\"}")
  node -e 'const value=JSON.parse(process.argv[1]); if (value.allowed || value.wallet.qualifiedPurchaser || value.verdict.reason !== "Qualified Purchaser claim missing") { console.error(value); process.exit(1); } console.log("    PASS: ineligible investor failed pre-check with the QP reason");' "$INELIGIBLE_PRECHECK"
  INELIGIBLE_QUOTE=$(curl -fsS -X POST "${BACKEND_BASE}/demo/quote" \
    -H "content-type: application/json" \
    -d "{\"taker\":\"${INELIGIBLE}\",\"amountIn\":\"${DEMO_AMOUNT}\",\"ttlSeconds\":300}")
  INELIGIBLE_TRADE_BODY=$(node -e 'const quote=JSON.parse(process.argv[1]); process.stdout.write(JSON.stringify({amountIn:quote.quote.amountIn,action:"compliance-proof",quote}));' "$INELIGIBLE_QUOTE")
  INELIGIBLE_REJECTED=$(curl -fsS -X POST "${BACKEND_BASE}/demo/trade" \
    -H "content-type: application/json" \
    -d "$INELIGIBLE_TRADE_BODY")
  node -e 'const value=JSON.parse(process.argv[1]); const simulated=value.trace?.some((step)=>step.stage==="Revert simulation" && /ComplianceRejected/.test(step.detail)); if (value.rejection !== "Qualified Purchaser claim missing" || !simulated || !value.reasonCode || !value.attemptedTransaction?.hash || value.attemptedTransaction.status !== 0 || !value.balanceEvidence?.unchanged) { console.error(value); process.exit(1); } console.log("    PASS: Router selector-verified the signed ineligible quote rejection without asset movement");' "$INELIGIBLE_REJECTED"
  ADMIN_ELIGIBLE=$(curl -fsS -X POST "${BACKEND_BASE}/demo/admin/claim" \
    -H "content-type: application/json" \
    -d "{\"walletId\":\"${INELIGIBLE_ID}\",\"claim\":{\"basis\":\"NATURAL\",\"signatureValid\":true,\"issuerTrusted\":true,\"lookThroughStatus\":\"NONE\",\"coveredCompanyMatchesFund\":false}}")
  node -e 'const value=JSON.parse(process.argv[1]); if (!value.qualifiedPurchaser) { console.error(value); process.exit(1); }' "$ADMIN_ELIGIBLE"
  ADMIN_RESTORED=$(curl -fsS -X POST "${BACKEND_BASE}/demo/admin/claim" \
    -H "content-type: application/json" \
    -d "{\"walletId\":\"${INELIGIBLE_ID}\",\"claim\":{\"basis\":\"NONE\",\"signatureValid\":false,\"issuerTrusted\":false,\"lookThroughStatus\":\"NONE\",\"coveredCompanyMatchesFund\":false}}")
  node -e 'const value=JSON.parse(process.argv[1]); if (value.qualifiedPurchaser) { console.error(value); process.exit(1); } console.log("    PASS: Admin claim facts changed and A-13 recomputed the live QP result");' "$ADMIN_RESTORED"

  echo "==> Proving quote-time eligibility can expire before fill"
  TEMPORAL_ID=$(node -e 'const value=JSON.parse(process.argv[1]); process.stdout.write(value.presentation.temporalEligibility.walletId);' "$DEMO_STATE")
  TEMPORAL_TTL=$(node -e 'const value=JSON.parse(process.argv[1]); process.stdout.write(String(value.presentation.temporalEligibility.quoteTtlSeconds));' "$DEMO_STATE")
  TEMPORAL_ADVANCE=$(node -e 'const value=JSON.parse(process.argv[1]); process.stdout.write(String(value.presentation.temporalEligibility.advanceSeconds));' "$DEMO_STATE")
  TEMPORAL_PREPARED=$(curl -fsS -X POST "${BACKEND_BASE}/demo/admin/temporal/prepare" \
    -H "content-type: application/json" \
    -d "{\"walletId\":\"${TEMPORAL_ID}\"}")
  TEMPORAL_WALLET=$(node -e 'const value=JSON.parse(process.argv[1]); const id=process.argv[2]; process.stdout.write(value.wallets.find((wallet) => wallet.id === id).address);' "$TEMPORAL_PREPARED" "$TEMPORAL_ID")
  TEMPORAL_CONTROL_WALLET=$(node -e 'const value=JSON.parse(process.argv[1]); const id=process.argv[2]; const wallet=value.wallets.find((candidate) => candidate.id !== id && candidate.qualifiedPurchaser); if (!wallet) process.exit(1); process.stdout.write(wallet.address);' "$TEMPORAL_PREPARED" "$TEMPORAL_ID")
  TEMPORAL_QUOTE=$(curl -fsS -X POST "${BACKEND_BASE}/demo/quote" \
    -H "content-type: application/json" \
    -d "{\"taker\":\"${TEMPORAL_WALLET}\",\"amountIn\":\"${DEMO_AMOUNT}\",\"ttlSeconds\":${TEMPORAL_TTL}}")
  curl -fsS -X POST "${BACKEND_BASE}/demo/admin/temporal/advance" \
    -H "content-type: application/json" \
    -d "{\"seconds\":${TEMPORAL_ADVANCE}}" >/dev/null
  TEMPORAL_PRECHECK=$(curl -fsS -X POST "${BACKEND_BASE}/demo/precheck" \
    -H "content-type: application/json" \
    -d "{\"taker\":\"${TEMPORAL_WALLET}\",\"amountIn\":\"${DEMO_AMOUNT}\"}")
  node -e 'const value=JSON.parse(process.argv[1]); if (value.allowed || value.verdict.reason !== "Qualified Purchaser claim expired") { console.error(value); process.exit(1); } console.log("    PASS: chain-time advance expired the previously valid QP claim");' "$TEMPORAL_PRECHECK"
  TEMPORAL_CONTROL_PRECHECK=$(curl -fsS -X POST "${BACKEND_BASE}/demo/precheck" \
    -H "content-type: application/json" \
    -d "{\"taker\":\"${TEMPORAL_CONTROL_WALLET}\",\"amountIn\":\"${DEMO_AMOUNT}\"}")
  node -e 'const value=JSON.parse(process.argv[1]); if (!value.allowed || !value.wallet.qualifiedPurchaser) { console.error(value); process.exit(1); } console.log("    PASS: another eligible investor remained valid under the unchanged global freshness policy");' "$TEMPORAL_CONTROL_PRECHECK"
  TEMPORAL_TRADE_BODY=$(node -e 'const quote=JSON.parse(process.argv[1]); process.stdout.write(JSON.stringify({amountIn:quote.quote.amountIn,action:"compliance-proof",quote}));' "$TEMPORAL_QUOTE")
  TEMPORAL_REJECTED=$(curl -fsS -X POST "${BACKEND_BASE}/demo/trade" \
    -H "content-type: application/json" \
    -d "$TEMPORAL_TRADE_BODY")
  node -e 'const value=JSON.parse(process.argv[1]); const simulated=value.trace?.some((step)=>step.stage==="Revert simulation" && /ComplianceRejected/.test(step.detail)); if (value.rejection !== "Qualified Purchaser claim expired" || !simulated || !value.reasonCode || !value.attemptedTransaction?.hash || value.attemptedTransaction.status !== 0 || !value.balanceEvidence?.unchanged) { console.error(value); process.exit(1); } console.log("    PASS: Router selector-verified the expired-claim rejection and preserved balances");' "$TEMPORAL_REJECTED"
  TEMPORAL_RESET=$(curl -fsS -X POST "${BACKEND_BASE}/demo/setup" \
    -H "content-type: application/json" \
    -d '{}')
  RESET_INVESTOR=$(node -e 'const value=JSON.parse(process.argv[1]); process.stdout.write(value.investor);' "$TEMPORAL_RESET")
  RESET_PRECHECK=$(curl -fsS -X POST "${BACKEND_BASE}/demo/precheck" \
    -H "content-type: application/json" \
    -d "{\"taker\":\"${RESET_INVESTOR}\",\"amountIn\":\"${DEMO_AMOUNT}\"}")
  node -e 'const value=JSON.parse(process.argv[1]); if (!value.allowed || !value.wallet.qualifiedPurchaser) { console.error(value); process.exit(1); } console.log("    PASS: injected baseline restored eligibility after the temporal scenario");' "$RESET_PRECHECK"
fi

echo "==> Requesting and filling a backend-signed RFQ quote through the Router"
"${CLI[@]}" rfq-quote --backend "${BACKEND_BASE}" \
  --amount-in "$DEMO_AMOUNT_DISPLAY" --out "$QUOTE_FILE"
"${CLI[@]}" --account "$SCENARIO_INVESTOR_ACCOUNT" buy 0 --venue rfq --quote "$QUOTE_FILE"

echo "==> Proving a current maker-policy failure on the same backend flow"
"${CLI[@]}" maker revoke "$DEMO_MAKER"
"${CLI[@]}" rfq-quote --backend "${BACKEND_BASE}" \
  --amount-in "$DEMO_AMOUNT_DISPLAY" --out "$REJECTED_QUOTE_FILE"
if "${CLI[@]}" --account "$SCENARIO_INVESTOR_ACCOUNT" buy 0 --venue rfq --quote "$REJECTED_QUOTE_FILE"; then
  echo "ERROR: revoked maker quote unexpectedly settled" >&2
  exit 1
fi
echo "    PASS: revoked maker quote was rejected"

echo "==> Restoring the demo maker and proving backend nonce refresh after CLI activity"
"${CLI[@]}" maker approve "$DEMO_MAKER"
POST_CLI_QUOTE=$(curl -fsS -X POST "${BACKEND_BASE}/demo/quote" \
  -H "content-type: application/json" \
  -d "{\"amountIn\":\"${DEMO_AMOUNT}\",\"ttlSeconds\":${SCENARIO_TTL}}")
POST_CLI_BODY=$(node -e 'const quote=JSON.parse(process.argv[1]); process.stdout.write(JSON.stringify({amountIn:quote.quote.amountIn,action:"settle",quote}));' "$POST_CLI_QUOTE")
POST_CLI_SETTLED=$(curl -fsS -X POST "${BACKEND_BASE}/demo/trade" \
  -H "content-type: application/json" \
  -d "$POST_CLI_BODY")
node -e 'const value=JSON.parse(process.argv[1]); if (!value.transaction?.hash || BigInt(value.transaction.rwaDelta) <= 0n) process.exit(1); console.log(`    PASS: backend settled again after CLI activity in block ${value.transaction.blockNumber}`);' "$POST_CLI_SETTLED"

if [ "$KEEP" -eq 1 ]; then
  echo "    maker restored: request another RFQ quote in a second terminal"
fi

echo ""
if [ "$DEMO_MODE" = "full" ]; then
  echo "==> E2E demo complete: scenario suite + backend/CLI/Router RFQ flow passed."
else
  echo "==> RFQ demo complete: mock TA profile + toolkit/CLI + backend/Router RFQ flow passed."
fi
