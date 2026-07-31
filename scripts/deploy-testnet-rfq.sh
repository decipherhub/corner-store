#!/usr/bin/env bash
set -euo pipefail

ROOT=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)
cd "$ROOT"

RPC_URL=""
CHAIN_ID=""
ACCOUNT=""
KEYSTORE=""
PASSWORD_FILE=""
USE_LEDGER=0
BROADCAST=0
VERIFY=0
ARTIFACT="${CORNER_STORE_ARTIFACT:-}"
FINAL_ARTIFACT=""

usage() {
  cat <<'EOF'
Usage:
  scripts/deploy-testnet-rfq.sh --rpc-url URL --chain-id ID \
    (--account NAME | --keystore FILE [--password-file FILE] | --ledger) \
    [--broadcast] [--verify]

Required environment:
  CORNER_STORE_TESTNET_DEPLOYER
  CORNER_STORE_TESTNET_MAKER
  CORNER_STORE_TESTNET_INVESTOR
  CORNER_STORE_TESTNET_INVESTOR_B
  CORNER_STORE_TESTNET_INELIGIBLE_INVESTOR
  CORNER_STORE_TESTNET_ISSUER_KEY

Optional environment:
  CORNER_STORE_GOVERNANCE             defaults to deployer
  CORNER_STORE_OPERATOR               defaults to deployer
  CORNER_STORE_ARTIFACT               optional explicit artifact path
  CORNER_STORE_DEPLOYMENT_ID
  CORNER_STORE_TESTNET_*_QUOTE/RWA    initial balance overrides

The command is a simulation unless --broadcast is explicitly supplied.
Secrets are supplied by Foundry keystore/Ledger and environment, never config.
EOF
}

require_value() {
  if [[ -z "${2-}" ]]; then
    echo "ERROR: $1 requires a value" >&2
    exit 2
  fi
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --rpc-url) require_value "$1" "${2-}"; RPC_URL="$2"; shift 2 ;;
    --chain-id) require_value "$1" "${2-}"; CHAIN_ID="$2"; shift 2 ;;
    --account) require_value "$1" "${2-}"; ACCOUNT="$2"; shift 2 ;;
    --keystore) require_value "$1" "${2-}"; KEYSTORE="$2"; shift 2 ;;
    --password-file) require_value "$1" "${2-}"; PASSWORD_FILE="$2"; shift 2 ;;
    --ledger) USE_LEDGER=1; shift ;;
    --broadcast) BROADCAST=1; shift ;;
    --verify) VERIFY=1; shift ;;
    -h|--help) usage; exit 0 ;;
    *) echo "ERROR: unknown argument: $1" >&2; usage >&2; exit 2 ;;
  esac
done

[[ -n "$RPC_URL" ]] || { echo "ERROR: --rpc-url is required" >&2; exit 2; }
[[ "$CHAIN_ID" =~ ^[0-9]+$ ]] || { echo "ERROR: --chain-id must be a positive integer" >&2; exit 2; }
SIGNER_COUNT=0
[[ -n "$ACCOUNT" ]] && SIGNER_COUNT=$((SIGNER_COUNT + 1))
[[ -n "$KEYSTORE" ]] && SIGNER_COUNT=$((SIGNER_COUNT + 1))
[[ "$USE_LEDGER" -eq 1 ]] && SIGNER_COUNT=$((SIGNER_COUNT + 1))
if [[ "$SIGNER_COUNT" -ne 1 ]]; then
  echo "ERROR: choose exactly one of --account, --keystore or --ledger" >&2
  exit 2
fi
if [[ -n "$PASSWORD_FILE" && -z "$KEYSTORE" ]]; then
  echo "ERROR: --password-file requires --keystore" >&2
  exit 2
fi

for name in \
  CORNER_STORE_TESTNET_DEPLOYER \
  CORNER_STORE_TESTNET_MAKER \
  CORNER_STORE_TESTNET_INVESTOR \
  CORNER_STORE_TESTNET_INVESTOR_B \
  CORNER_STORE_TESTNET_INELIGIBLE_INVESTOR \
  CORNER_STORE_TESTNET_ISSUER_KEY
do
  [[ -n "${!name:-}" ]] || { echo "ERROR: $name is required" >&2; exit 2; }
done

RPC_CHAIN_ID=$(cast chain-id --rpc-url "$RPC_URL")
if [[ "$RPC_CHAIN_ID" != "$CHAIN_ID" ]]; then
  echo "ERROR: RPC chain id $RPC_CHAIN_ID does not match --chain-id $CHAIN_ID" >&2
  exit 1
fi

DEPLOYMENT_ID="${CORNER_STORE_DEPLOYMENT_ID:-hackathon-testnet-rfq}"
[[ "$DEPLOYMENT_ID" =~ ^[A-Za-z0-9._-]+$ ]] || {
  echo "ERROR: CORNER_STORE_DEPLOYMENT_ID may contain only letters, numbers, dot, underscore and dash" >&2
  exit 2
}
if [[ -z "$ARTIFACT" ]]; then
  if [[ "$BROADCAST" -eq 1 ]]; then
    ARTIFACT="deployments/public/${DEPLOYMENT_ID}-${CHAIN_ID}.json"
  else
    ARTIFACT="deployments/.testnet-rfq-plan.json"
  fi
fi
if [[ "$BROADCAST" -eq 1 && -e "$ARTIFACT" ]]; then
  echo "ERROR: deployment artifact already exists: $ARTIFACT" >&2
  echo "Use a new CORNER_STORE_DEPLOYMENT_ID; public deployment records are append-only." >&2
  exit 1
fi

if [[ "$BROADCAST" -eq 1 ]]; then
  FINAL_ARTIFACT="$ARTIFACT"
  ARTIFACT="deployments/.pending-${DEPLOYMENT_ID}-${CHAIN_ID}.json"
fi

export CORNER_STORE_ARTIFACT="$ARTIFACT"
export CORNER_STORE_DEPLOYMENT_ID="$DEPLOYMENT_ID"
export CORNER_STORE_SOURCE_COMMIT="${CORNER_STORE_SOURCE_COMMIT:-$(git rev-parse HEAD)}"
mkdir -p "$(dirname "$ARTIFACT")"

SIGNER_ARGS=()
if [[ "$USE_LEDGER" -eq 1 ]]; then
  SIGNER_ARGS+=(--ledger)
elif [[ -n "$KEYSTORE" ]]; then
  SIGNER_ARGS+=(--keystore "$KEYSTORE")
  [[ -n "$PASSWORD_FILE" ]] && SIGNER_ARGS+=(--password-file "$PASSWORD_FILE")
else
  SIGNER_ARGS+=(--account "$ACCOUNT")
fi

MUTATION_ARGS=()
if [[ "$BROADCAST" -eq 1 ]]; then
  # The fixture deploys many contracts and initialization transactions. Submit
  # sequentially so public RPC nonce propagation cannot reorder the handoff.
  MUTATION_ARGS+=(--broadcast --slow)
else
  echo "==> Simulation only. Add --broadcast after reviewing the transaction plan."
fi
if [[ "$VERIFY" -eq 1 ]]; then
  MUTATION_ARGS+=(--verify)
fi

forge script script/DeployTestnetRFQ.s.sol:DeployTestnetRFQ \
  --rpc-url "$RPC_URL" \
  --chain-id "$CHAIN_ID" \
  --sender "$CORNER_STORE_TESTNET_DEPLOYER" \
  "${SIGNER_ARGS[@]}" \
  "${MUTATION_ARGS[@]}"

if [[ "$BROADCAST" -eq 1 ]]; then
  forge script script/VerifyTestnetRFQ.s.sol:VerifyTestnetRFQ \
    --rpc-url "$RPC_URL" \
    --chain-id "$CHAIN_ID"

  BROADCAST_FILE="broadcast/DeployTestnetRFQ.s.sol/${CHAIN_ID}/run-latest.json"
  [[ -f "$BROADCAST_FILE" ]] || {
    echo "ERROR: Foundry broadcast record not found: $BROADCAST_FILE" >&2
    exit 1
  }

  node - "$ARTIFACT" "$FINAL_ARTIFACT" "$BROADCAST_FILE" <<'NODE'
const fs = require("fs");
const path = require("path");
const [pendingPath, finalPath, broadcastPath] = process.argv.slice(2);
const artifact = JSON.parse(fs.readFileSync(pendingPath, "utf8"));
const broadcast = JSON.parse(fs.readFileSync(broadcastPath, "utf8"));
const receipts = new Map(
  (broadcast.receipts ?? []).map((receipt) => [
    receipt.transactionHash?.toLowerCase(),
    receipt
  ])
);

artifact.broadcastFile = broadcastPath;
artifact.transactionCount = broadcast.transactions.length;
artifact.deploymentTransactions = broadcast.transactions.map((entry) => {
  const receipt = receipts.get(entry.hash.toLowerCase());
  return {
    hash: entry.hash,
    transactionType: entry.transactionType,
    contractName: entry.contractName ?? null,
    contractAddress: entry.contractAddress ?? null,
    function: entry.function ?? null,
    blockNumber: receipt?.blockNumber ?? null,
    status: receipt?.status ?? null
  };
});
artifact.deployedContracts = broadcast.transactions
  .filter((entry) => entry.transactionType === "CREATE" && entry.contractAddress)
  .map((entry) => ({
    name: entry.contractName,
    address: entry.contractAddress,
    transactionHash: entry.hash
  }));

fs.mkdirSync(path.dirname(finalPath), { recursive: true });
fs.writeFileSync(finalPath, `${JSON.stringify(artifact, null, 2)}\n`, {
  flag: "wx"
});
fs.unlinkSync(pendingPath);
NODE

  export CORNER_STORE_ARTIFACT="$FINAL_ARTIFACT"
  forge script script/VerifyTestnetRFQ.s.sol:VerifyTestnetRFQ \
    --rpc-url "$RPC_URL" \
    --chain-id "$CHAIN_ID"

  echo "==> Saved verified append-only public deployment record: $FINAL_ARTIFACT"
  echo "    List records with: scripts/list-testnet-deployments.sh"
fi
