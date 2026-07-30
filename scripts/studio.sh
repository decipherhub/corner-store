#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
cd "$ROOT_DIR"

STUDIO_HOST=${CORNER_STORE_STUDIO_HOST:-${HOST:-127.0.0.1}}
STUDIO_PORT=${CORNER_STORE_STUDIO_PORT:-${PORT:-8791}}
WORKSPACE_ROOT=${CORNER_STORE_STUDIO_ROOT:-"$ROOT_DIR/.corner-store/studio-projects"}
CLI_ENTRY=${CORNER_STORE_CLI_ENTRY:-"$ROOT_DIR/services/cli/dist/cli/src/index.js"}
DEFAULT_RPC=${CORNER_STORE_DEFAULT_RPC:-http://127.0.0.1:8545}
BROADCAST_NETWORK=${CORNER_STORE_BROADCAST_NETWORK:-anvil}
ALLOWED_RPC_HOSTS=${CORNER_STORE_ALLOWED_RPC_HOSTS:-127.0.0.1,localhost,::1}
OPERATIONS_URL=${CORNER_STORE_OPERATIONS_URL:-}
DEX_BIND_HOST=${CORNER_STORE_DEX_BIND_HOST:-127.0.0.1}
DEX_PUBLIC_HOST=${CORNER_STORE_DEX_PUBLIC_HOST:-127.0.0.1}
RFQ_BACKEND_PORT=${CORNER_STORE_RFQ_BACKEND_PORT:-8787}
OPERATOR_API_PORT=${CORNER_STORE_OPERATOR_API_PORT:-8788}
DASHBOARD_PORT=${CORNER_STORE_DASHBOARD_PORT:-8790}
DEX_CHAIN_ID=${CORNER_STORE_DEX_CHAIN_ID:-31337}
SKIP_BUILD=0

usage() {
  cat <<'EOF'
Usage: scripts/studio.sh [options]

Options:
  --host HOST                   Studio bind host
  --port PORT                   Studio bind port
  --workspace PATH              Writable generated-project workspace
  --cli-entry PATH              Built Corner Store CLI entry
  --rpc URL                     Initial deployment RPC
  --broadcast-network NAME      Only network eligible for direct demo broadcast
  --allowed-rpc-hosts LIST      Comma-separated direct-broadcast RPC hostnames
  --operations-url URL          Verified deployment handoff URL
  --dex-bind-host HOST          Integrated DEX services bind host
  --dex-public-host HOST        Browser-visible DEX services host
  --rfq-backend-port PORT       Integrated RFQ backend port
  --operator-api-port PORT      Integrated Operator API port
  --dashboard-port PORT         Integrated DEX Dashboard port
  --dex-chain-id ID             Integrated local DEX chain ID
  --skip-build                  Use existing CLI and Studio builds
  -h, --help                    Show this help

Every option also has a CORNER_STORE_* environment variable equivalent.
The defaults are local reference values, not production deployment policy.
EOF
}

require_value() {
  if [ -z "${2-}" ]; then
    echo "$1 requires a value." >&2
    usage >&2
    exit 2
  fi
}

while [ $# -gt 0 ]; do
  case "$1" in
    --host) require_value "$1" "${2-}"; STUDIO_HOST="$2"; shift 2 ;;
    --port) require_value "$1" "${2-}"; STUDIO_PORT="$2"; shift 2 ;;
    --workspace) require_value "$1" "${2-}"; WORKSPACE_ROOT="$2"; shift 2 ;;
    --cli-entry) require_value "$1" "${2-}"; CLI_ENTRY="$2"; shift 2 ;;
    --rpc) require_value "$1" "${2-}"; DEFAULT_RPC="$2"; shift 2 ;;
    --broadcast-network) require_value "$1" "${2-}"; BROADCAST_NETWORK="$2"; shift 2 ;;
    --allowed-rpc-hosts) require_value "$1" "${2-}"; ALLOWED_RPC_HOSTS="$2"; shift 2 ;;
    --operations-url) require_value "$1" "${2-}"; OPERATIONS_URL="$2"; shift 2 ;;
    --dex-bind-host) require_value "$1" "${2-}"; DEX_BIND_HOST="$2"; shift 2 ;;
    --dex-public-host) require_value "$1" "${2-}"; DEX_PUBLIC_HOST="$2"; shift 2 ;;
    --rfq-backend-port) require_value "$1" "${2-}"; RFQ_BACKEND_PORT="$2"; shift 2 ;;
    --operator-api-port) require_value "$1" "${2-}"; OPERATOR_API_PORT="$2"; shift 2 ;;
    --dashboard-port) require_value "$1" "${2-}"; DASHBOARD_PORT="$2"; shift 2 ;;
    --dex-chain-id) require_value "$1" "${2-}"; DEX_CHAIN_ID="$2"; shift 2 ;;
    --skip-build) SKIP_BUILD=1; shift ;;
    -h|--help) usage; exit 0 ;;
    *) echo "unknown argument: $1" >&2; usage >&2; exit 2 ;;
  esac
done

case "$STUDIO_PORT" in
  ''|*[!0-9]*) echo "Studio port must be an integer." >&2; exit 2 ;;
esac
if [ "$STUDIO_PORT" -lt 1 ] || [ "$STUDIO_PORT" -gt 65535 ]; then
  echo "Studio port must be between 1 and 65535." >&2
  exit 2
fi
if [ -z "$STUDIO_HOST" ] || [ -z "$DEFAULT_RPC" ] || [ -z "$ALLOWED_RPC_HOSTS" ] ||
   [ -z "$DEX_BIND_HOST" ] || [ -z "$DEX_PUBLIC_HOST" ]; then
  echo "Host, RPC URL and allowed RPC hosts must not be empty." >&2
  exit 2
fi
if [ -z "$OPERATIONS_URL" ]; then
  OPERATIONS_URL="http://${DEX_PUBLIC_HOST}:${DASHBOARD_PORT}"
fi
for runtime_port in "$RFQ_BACKEND_PORT" "$OPERATOR_API_PORT" "$DASHBOARD_PORT"; do
  case "$runtime_port" in
    ''|*[!0-9]*) echo "DEX runtime ports must be integers." >&2; exit 2 ;;
  esac
  if [ "$runtime_port" -lt 1024 ] || [ "$runtime_port" -gt 65535 ]; then
    echo "DEX runtime ports must be between 1024 and 65535." >&2
    exit 2
  fi
done
case "$DEX_CHAIN_ID" in
  ''|*[!0-9]*|0) echo "DEX chain ID must be a positive integer." >&2; exit 2 ;;
esac
if [ "$(printf '%s\n' "$STUDIO_PORT" "$RFQ_BACKEND_PORT" "$OPERATOR_API_PORT" "$DASHBOARD_PORT" | sort -u | wc -l | tr -d ' ')" -ne 4 ]; then
  echo "Studio and DEX runtime ports must be unique." >&2
  exit 2
fi
if command -v lsof >/dev/null 2>&1 && lsof -nP -iTCP:"$STUDIO_PORT" -sTCP:LISTEN >/dev/null 2>&1; then
  echo "Studio port $STUDIO_PORT is already in use. Choose --port or CORNER_STORE_STUDIO_PORT." >&2
  exit 1
fi

if [ "$SKIP_BUILD" -eq 0 ]; then
  echo "==> Building Corner Store CLI"
  npm run build --prefix services/cli
  echo "==> Building RFQ demo backend"
  npm run build --prefix services/rfq-demo-backend
  echo "==> Building Operator API"
  npm run build --prefix services/operator-api
  echo "==> Building Deployment Studio"
  npm run build --prefix services/deployment-studio
fi

echo "==> Starting Deployment Studio"
echo "    bind:       http://${STUDIO_HOST}:${STUDIO_PORT}"
echo "    workspace:  ${WORKSPACE_ROOT}"
echo "    RPC input:  ${DEFAULT_RPC}"
echo "    broadcast:  ${BROADCAST_NETWORK} via ${ALLOWED_RPC_HOSTS}"
echo "    DEX handoff: http://${DEX_PUBLIC_HOST}:${DASHBOARD_PORT}"
echo "    DEX services: RFQ ${RFQ_BACKEND_PORT}, Operator API ${OPERATOR_API_PORT}"

export CORNER_STORE_STUDIO_HOST="$STUDIO_HOST"
export CORNER_STORE_STUDIO_PORT="$STUDIO_PORT"
export CORNER_STORE_STUDIO_ROOT="$WORKSPACE_ROOT"
export CORNER_STORE_CLI_ENTRY="$CLI_ENTRY"
export CORNER_STORE_DEFAULT_RPC="$DEFAULT_RPC"
export CORNER_STORE_BROADCAST_NETWORK="$BROADCAST_NETWORK"
export CORNER_STORE_ALLOWED_RPC_HOSTS="$ALLOWED_RPC_HOSTS"
export CORNER_STORE_OPERATIONS_URL="$OPERATIONS_URL"
export CORNER_STORE_DEX_BIND_HOST="$DEX_BIND_HOST"
export CORNER_STORE_DEX_PUBLIC_HOST="$DEX_PUBLIC_HOST"
export CORNER_STORE_RFQ_BACKEND_PORT="$RFQ_BACKEND_PORT"
export CORNER_STORE_OPERATOR_API_PORT="$OPERATOR_API_PORT"
export CORNER_STORE_DASHBOARD_PORT="$DASHBOARD_PORT"
export CORNER_STORE_DEX_CHAIN_ID="$DEX_CHAIN_ID"

exec npm run start --prefix services/deployment-studio
