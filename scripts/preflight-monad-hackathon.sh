#!/usr/bin/env bash
set -euo pipefail

RPC_URL="${CORNER_STORE_TESTNET_RPC_URL:-https://testnet-rpc.monad.xyz}"
EXPECTED_CHAIN_ID=10143
REQUIRE_DEPLOYMENT_INPUTS=0

usage() {
  cat <<'EOF'
Usage: scripts/preflight-monad-hackathon.sh [--rpc-url URL] [--deployment-ready]

Runs read-only Monad testnet and local toolchain checks. With
--deployment-ready it also checks that deployment inputs are present and actor
addresses are valid and unique. Secret values are never printed.
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --rpc-url)
      [[ -n "${2-}" ]] || { echo "ERROR: --rpc-url requires a value" >&2; exit 2; }
      RPC_URL="$2"
      shift 2
      ;;
    --deployment-ready) REQUIRE_DEPLOYMENT_INPUTS=1; shift ;;
    -h|--help) usage; exit 0 ;;
    *) echo "ERROR: unknown argument: $1" >&2; usage >&2; exit 2 ;;
  esac
done

for command in cast forge node; do
  command -v "$command" >/dev/null || { echo "ERROR: $command is required" >&2; exit 1; }
done

CHAIN_ID=$(cast chain-id --rpc-url "$RPC_URL")
[[ "$CHAIN_ID" == "$EXPECTED_CHAIN_ID" ]] || {
  echo "ERROR: RPC chain id $CHAIN_ID does not match Monad testnet $EXPECTED_CHAIN_ID" >&2
  exit 1
}
BLOCK_NUMBER=$(cast block-number --rpc-url "$RPC_URL")

if [[ "$REQUIRE_DEPLOYMENT_INPUTS" -eq 1 ]]; then
  required=(
    CORNER_STORE_TESTNET_DEPLOYER
    CORNER_STORE_TESTNET_MAKER
    CORNER_STORE_TESTNET_INVESTOR
    CORNER_STORE_TESTNET_INVESTOR_B
    CORNER_STORE_TESTNET_INELIGIBLE_INVESTOR
    CORNER_STORE_TESTNET_ISSUER_KEY
  )
  for name in "${required[@]}"; do
    [[ -n "${!name:-}" ]] || { echo "ERROR: $name is required" >&2; exit 2; }
  done

  node - <<'NODE'
const {getAddress} = require("./services/testnet-rfq-demo/node_modules/ethers");
const names = [
  "CORNER_STORE_TESTNET_DEPLOYER",
  "CORNER_STORE_TESTNET_MAKER",
  "CORNER_STORE_TESTNET_INVESTOR",
  "CORNER_STORE_TESTNET_INVESTOR_B",
  "CORNER_STORE_TESTNET_INELIGIBLE_INVESTOR"
];
const addresses = names.map((name) => {
  try { return getAddress(process.env[name]); }
  catch { throw new Error(`${name} is not a valid address`); }
});
if (new Set(addresses.map((value) => value.toLowerCase())).size !== addresses.length) {
  throw new Error("deployer and participant addresses must be unique");
}
NODE

  BALANCE=$(cast balance "$CORNER_STORE_TESTNET_DEPLOYER" --rpc-url "$RPC_URL")
  [[ "$BALANCE" != "0" ]] || {
    echo "ERROR: deployer has no native Monad testnet balance" >&2
    exit 1
  }
  echo "deployment inputs: present; actor addresses: valid and unique; deployer balance: non-zero"
fi

echo "Monad testnet preflight passed: chain=$CHAIN_ID block=$BLOCK_NUMBER"
