#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
cd "$ROOT_DIR"

CONFIG="services/toolkit/examples/corner-store.showcase.json"
PLAN_ONLY=0

while [ $# -gt 0 ]; do
  case "$1" in
    --config) CONFIG="$2"; shift 2 ;;
    --config=*) CONFIG="${1#*=}"; shift ;;
    --plan) PLAN_ONLY=1; shift ;;
    -h|--help)
      cat <<'EOF'
Usage: scripts/showcase.sh [--config PATH] [--plan]

--plan validates the injected showcase inputs and prints the complete execution
order without starting Anvil or submitting transactions.
EOF
      exit 0
      ;;
    *) echo "unknown argument: $1" >&2; exit 2 ;;
  esac
done

if [ ! -f "$CONFIG" ]; then
  echo "ERROR: showcase config not found: $CONFIG" >&2
  exit 2
fi

SHOWCASE_PLAN=$(node - "$CONFIG" <<'NODE'
const fs = require("fs");
const path = require("path");
const file = process.argv[2];
const value = JSON.parse(fs.readFileSync(file, "utf8"));
const fail = (message) => { throw new Error(`invalid showcase config: ${message}`); };
if (value.schemaVersion !== 1) fail("schemaVersion must be 1");
if (typeof value.showcaseId !== "string" || !/^[a-zA-Z0-9][a-zA-Z0-9_.-]{0,63}$/.test(value.showcaseId)) {
  fail("showcaseId must be a conservative identifier");
}
if (!["buidl-like", "reg-d"].includes(value.profile)) fail("profile must be buidl-like or reg-d");
if (!["rfq", "full"].includes(value.mode)) fail("mode must be rfq or full");
if (typeof value.scenario !== "string" || value.scenario.length === 0 || value.scenario.includes("\0")) {
  fail("scenario path is required");
}
if (!fs.existsSync(path.resolve(value.scenario))) fail(`scenario does not exist: ${value.scenario}`);
const runtime = value.runtime;
if (!runtime || typeof runtime !== "object") fail("runtime is required");
for (const key of ["bindHost", "publicHost"]) {
  if (typeof runtime[key] !== "string" || runtime[key].length === 0) fail(`runtime.${key} is required`);
}
const loopback = new Set(["127.0.0.1", "localhost"]);
if (!loopback.has(runtime.bindHost) || !loopback.has(runtime.publicHost)) {
  fail("local showcase hosts must be loopback; production exposure requires a separately secured service");
}
const ports = ["anvilPort", "backendPort", "operatorApiPort", "dashboardPort"];
for (const key of ports) {
  if (!Number.isSafeInteger(runtime[key]) || runtime[key] < 1024 || runtime[key] > 65535) {
    fail(`runtime.${key} must be an integer between 1024 and 65535`);
  }
}
if (new Set(ports.map((key) => runtime[key])).size !== ports.length) fail("runtime ports must be unique");
const scenario = JSON.parse(fs.readFileSync(path.resolve(value.scenario), "utf8"));
if (scenario.schemaVersion !== 2) fail("scenario schemaVersion must be 2");
const plan = {
  schema: "corner-store-showcase-plan",
  showcaseId: value.showcaseId,
  boundary: {
    network: "local-anvil-only",
    coreImplementation: "DeployProductionCore.deployCore",
    activation: "demo-only ERC-3643, Mock TA, policy, maker and inventory fixtures",
    productionEvidence: false
  },
  injected: {
    profile: value.profile,
    mode: value.mode,
    scenario: path.resolve(value.scenario),
    scenarioSchemaVersion: scenario.schemaVersion,
    runtime
  },
  outputs: {
    deploymentArtifact: "deployments/anvil-e2e.json",
    operatorManifest: "deployments/operator-manifest.json",
    dashboardUrl: `http://${runtime.publicHost}:${runtime.dashboardPort}`
  },
  sequence: [
    "validate toolchain, scenario and local ports",
    "start clean Anvil",
    "deploy production core contracts through DeployProductionCore.deployCore",
    "activate demo-only ERC-3643/ONCHAINID, policy, venues, maker and inventory",
    "verify deployment artifact and onboard selected asset profile",
    "start RFQ backend from the same artifact",
    "start read-only Operator API and user/operator Dashboard",
    "run Router settlement and expected compliance rejection scenarios"
  ]
};
process.stdout.write(JSON.stringify({config: value, plan}, null, 2));
NODE
)

if [ "$PLAN_ONLY" -eq 1 ]; then
  printf '%s\n' "$SHOWCASE_PLAN"
  exit 0
fi

read_config() {
  node -e 'const value=JSON.parse(process.argv[1]); let out=value.config; for (const key of process.argv[2].split(".")) out=out[key]; process.stdout.write(String(out));' "$SHOWCASE_PLAN" "$1"
}

PROFILE=$(read_config profile)
MODE=$(read_config mode)
SCENARIO=$(read_config scenario)
BIND_HOST=$(read_config runtime.bindHost)
PUBLIC_HOST=$(read_config runtime.publicHost)
ANVIL_PORT=$(read_config runtime.anvilPort)
BACKEND_PORT=$(read_config runtime.backendPort)
OPERATOR_API_PORT=$(read_config runtime.operatorApiPort)
DASHBOARD_PORT=$(read_config runtime.dashboardPort)

echo "$SHOWCASE_PLAN"
echo ""
echo "==> Executing validated showcase plan"
exec scripts/demo.sh \
  --profile "$PROFILE" \
  --mode "$MODE" \
  --scenario "$SCENARIO" \
  --bind-host "$BIND_HOST" \
  --public-host "$PUBLIC_HOST" \
  --port "$ANVIL_PORT" \
  --backend-port "$BACKEND_PORT" \
  --operator-api-port "$OPERATOR_API_PORT" \
  --dashboard-port "$DASHBOARD_PORT"
