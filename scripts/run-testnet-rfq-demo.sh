#!/usr/bin/env bash
set -euo pipefail

ROOT=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)
cd "$ROOT"

: "${CORNER_STORE_TESTNET_ARTIFACT:?set CORNER_STORE_TESTNET_ARTIFACT to a verified deployments/public JSON file}"
: "${CORNER_STORE_TESTNET_RPC_URL:?set CORNER_STORE_TESTNET_RPC_URL}"
: "${CORNER_STORE_TESTNET_MAKER_KEY:?set CORNER_STORE_TESTNET_MAKER_KEY to the disposable testnet Maker key}"

[[ -f "$CORNER_STORE_TESTNET_ARTIFACT" ]] || {
  echo "ERROR: artifact not found: $CORNER_STORE_TESTNET_ARTIFACT" >&2
  exit 1
}
CORNER_STORE_TESTNET_ARTIFACT=$(
  cd "$(dirname "$CORNER_STORE_TESTNET_ARTIFACT")"
  printf '%s/%s\n' "$PWD" "$(basename "$CORNER_STORE_TESTNET_ARTIFACT")"
)
export CORNER_STORE_TESTNET_ARTIFACT

CHAIN_ID=$(node -e '
const fs = require("fs");
const value = JSON.parse(fs.readFileSync(process.argv[1], "utf8"));
if (!Number.isSafeInteger(value.chainId) || value.chainId <= 0) process.exit(2);
process.stdout.write(String(value.chainId));
' "$CORNER_STORE_TESTNET_ARTIFACT")

RPC_CHAIN_ID=$(cast chain-id --rpc-url "$CORNER_STORE_TESTNET_RPC_URL")
if [[ "$RPC_CHAIN_ID" != "$CHAIN_ID" ]]; then
  echo "ERROR: RPC chain $RPC_CHAIN_ID does not match artifact chain $CHAIN_ID" >&2
  exit 1
fi

echo "==> Verifying artifact-bound contracts and activation"
CORNER_STORE_ARTIFACT="$CORNER_STORE_TESTNET_ARTIFACT" \
forge script script/VerifyTestnetRFQ.s.sol:VerifyTestnetRFQ \
  --rpc-url "$CORNER_STORE_TESTNET_RPC_URL" \
  --chain-id "$CHAIN_ID"

if [[ ! -x services/testnet-rfq-demo/node_modules/.bin/tsc ]]; then
  npm ci --prefix services/testnet-rfq-demo
fi
npm run build --prefix services/testnet-rfq-demo

echo "==> Starting wallet-signed public-testnet RFQ demo"
exec npm run start --prefix services/testnet-rfq-demo
