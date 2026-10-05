#!/usr/bin/env sh
set -eu

ROOT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
WORK_DIR=$(mktemp -d "${TMPDIR:-/tmp}/corner-store-sdk-product.XXXXXX")
export npm_config_cache=${npm_config_cache:-"${TMPDIR:-/tmp}/corner-store-npm-cache"}
PACK_DIR="$WORK_DIR/packages"
BOOT_DIR="$WORK_DIR/bootstrap"
TARGET_DIR="$WORK_DIR/consumer"
LOCAL_TARGET_DIR="$WORK_DIR/local-consumer"
SANDBOX_DIR="$WORK_DIR/reference-sandbox"

cleanup() {
  rm -rf "$WORK_DIR"
}
trap cleanup EXIT HUP INT TERM

mkdir -p "$PACK_DIR" "$BOOT_DIR"

RFQ_TARBALL_NAME=$(
  cd "$ROOT_DIR"
  npm pack ./services/rfq --pack-destination "$PACK_DIR" --silent | tail -n 1
)
CLI_TARBALL_NAME=$(
  cd "$ROOT_DIR"
  npm pack ./services/cli --pack-destination "$PACK_DIR" --silent | tail -n 1
)
TOOLKIT_TARBALL_NAME=$(
  cd "$ROOT_DIR"
  npm pack ./services/toolkit --pack-destination "$PACK_DIR" --silent | tail -n 1
)
RFQ_TARBALL="$PACK_DIR/$RFQ_TARBALL_NAME"
CLI_TARBALL="$PACK_DIR/$CLI_TARBALL_NAME"
TOOLKIT_TARBALL="$PACK_DIR/$TOOLKIT_TARBALL_NAME"

node "$ROOT_DIR/services/cli/dist/cli/src/index.js" create "$LOCAL_TARGET_DIR" \
  --template dex-integration \
  --sdk "file:$RFQ_TARBALL" >/dev/null
(
  cd "$LOCAL_TARGET_DIR"
  npm install --prefer-offline --silent
  npm test
  npm run policy:explain >/dev/null
)

(
  cd "$BOOT_DIR"
  npm init -y >/dev/null
  npm install --prefer-offline --silent "$CLI_TARBALL" "$TOOLKIT_TARBALL"
  node -e 'const t = require("@corner-store/toolkit"); const c = t.validateConfig(t.defaultConfig()); if (c.schemaVersion !== t.TOOLKIT_SCHEMA_VERSION || t.simulateConfig(c).venues.length === 0) process.exit(1)'
  ./node_modules/.bin/corner-store create "$TARGET_DIR" \
    --template dex-integration \
    --sdk "file:$RFQ_TARBALL" \
    --toolkit "file:$TOOLKIT_TARBALL" \
    --cli "file:$CLI_TARBALL" >/dev/null
  ./node_modules/.bin/corner-store create "$SANDBOX_DIR" \
    --template sandbox \
    --sdk "file:$RFQ_TARBALL" \
    --toolkit "file:$TOOLKIT_TARBALL" \
    --cli "file:$CLI_TARBALL" >/dev/null
)

test -f "$SANDBOX_DIR/sandbox/contracts/script/DeployStack.s.sol"
test -f "$SANDBOX_DIR/sandbox/services/deployment-studio/web/index.html"
grep -q "condition: service_completed_successfully" "$SANDBOX_DIR/compose.yaml"
grep -q "USER node" "$SANDBOX_DIR/Dockerfile"
if command -v docker >/dev/null 2>&1 && docker compose version >/dev/null 2>&1; then
  (cd "$SANDBOX_DIR" && docker compose config >/dev/null)
fi

(
  cd "$SANDBOX_DIR"
  npm install --prefer-offline --silent
  npm test
  npm run validate >/dev/null
  npm run simulate >/dev/null
  if npm run --silent doctor >"$WORK_DIR/sandbox-doctor.json"; then
    : # A host with Compose v2 and a running daemon is sandbox-ready.
  else
    : # Missing Docker is an expected, actionable external-user state.
  fi
)
node -e '
const result = require(process.argv[1]);
const docker = result.checks.find((check) => check.name === "docker");
const daemon = result.checks.find((check) => check.name === "docker-daemon");
const unexpected = result.checks.filter((check) => check.required && !check.pass && !["docker", "docker-daemon"].includes(check.name));
if (!docker || docker.required !== true || !docker.remediation) process.exit(1);
if (!daemon || daemon.required !== true || !daemon.remediation) process.exit(1);
if (unexpected.length > 0) process.exit(1);
' "$WORK_DIR/sandbox-doctor.json"

(
  cd "$TARGET_DIR"
  npm install --prefer-offline --silent
  npm test
  npm run validate >/dev/null
  npm run simulate >/dev/null
  npm run policy:explain >/dev/null
  npm run doctor
  npm run deploy

  mkdir -p deployments
  node - <<'NODE'
const fs = require("fs");
fs.writeFileSync("deployments/anvil-e2e.json", JSON.stringify({
  assetProfile: "reg-d",
  rwaToken: "0x1111111111111111111111111111111111111111",
  router: "0x2222222222222222222222222222222222222222",
  rfqAdapter: "0x3333333333333333333333333333333333333333",
  makerAuthorizer: "0x4444444444444444444444444444444444444444",
  rfqVenue: "0x5555555555555555555555555555555555555555"
}, null, 2));
NODE
  if npm run --silent verify >"$WORK_DIR/stale-artifact.log" 2>&1; then
    echo "stale artifact unexpectedly passed verification" >&2
    exit 1
  fi
  grep -q '"remediation"' "$WORK_DIR/stale-artifact.log"
  grep -q 'same asset profile' "$WORK_DIR/stale-artifact.log"

  node - <<'NODE'
const fs = require("fs");
const path = "deployments/anvil-e2e.json";
const artifact = JSON.parse(fs.readFileSync(path, "utf8"));
artifact.assetProfile = "buidl-like";
fs.writeFileSync(path, `${JSON.stringify(artifact, null, 2)}\n`);
NODE
  npm run --silent verify >"$WORK_DIR/recovered-artifact.log"
  grep -q '"ready": true' "$WORK_DIR/recovered-artifact.log"

  npm run --silent policy:explain >"$WORK_DIR/policy-before.json"
  node - <<'NODE'
const fs = require("fs");
const path = "corner-store.config.json";
const config = JSON.parse(fs.readFileSync(path, "utf8"));
  config.venues.rfq = false;
  config.venues.orderBook = true;
fs.writeFileSync(path, `${JSON.stringify(config, null, 2)}\n`);
NODE
  npm run --silent policy:explain >"$WORK_DIR/policy-after.json"
)

node - <<'NODE' "$WORK_DIR/policy-before.json" "$WORK_DIR/policy-after.json"
const fs = require("fs");
const before = JSON.parse(fs.readFileSync(process.argv[2], "utf8"));
const after = JSON.parse(fs.readFileSync(process.argv[3], "utf8"));
if (before.compiled.configHash === after.compiled.configHash) process.exit(1);
if (before.explanation.decisions.rfq.allowed !== true) process.exit(1);
if (after.explanation.decisions.rfq.allowed !== false) process.exit(1);
if (after.explanation.decisions.rfq.reasonCode !== "VENUE_DISABLED") process.exit(1);
NODE

CLI_PACKAGE="$BOOT_DIR/node_modules/@corner-store/cli"
if ! forge build --offline --root "$CLI_PACKAGE/bundle/contracts" >"$WORK_DIR/forge-build.log" 2>&1; then
  cat "$WORK_DIR/forge-build.log"
  exit 1
fi

echo "Corner Store standalone SDK product smoke passed."
