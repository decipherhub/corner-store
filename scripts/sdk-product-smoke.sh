#!/usr/bin/env sh
set -eu

ROOT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
WORK_DIR=$(mktemp -d "${TMPDIR:-/tmp}/corner-store-sdk-product.XXXXXX")
export npm_config_cache=${npm_config_cache:-"${TMPDIR:-/tmp}/corner-store-npm-cache"}
PACK_DIR="$WORK_DIR/packages"
BOOT_DIR="$WORK_DIR/bootstrap"
TARGET_DIR="$WORK_DIR/consumer"
LOCAL_TARGET_DIR="$WORK_DIR/local-consumer"

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
  --mode library-only \
  --sdk "file:$RFQ_TARBALL" >/dev/null
(
  cd "$LOCAL_TARGET_DIR"
  npm install --prefer-offline --silent
  npm test
)

(
  cd "$BOOT_DIR"
  npm init -y >/dev/null
  npm install --prefer-offline --silent "$CLI_TARBALL" "$TOOLKIT_TARBALL"
  node -e 'const t = require("@corner-store/toolkit"); const c = t.validateConfig(t.defaultConfig()); if (c.schemaVersion !== t.TOOLKIT_SCHEMA_VERSION || t.simulateConfig(c).venues.length === 0) process.exit(1)'
  ./node_modules/.bin/corner-store create "$TARGET_DIR" \
    --mode library-only \
    --sdk "file:$RFQ_TARBALL" \
    --cli "file:$CLI_TARBALL" >/dev/null
)

(
  cd "$TARGET_DIR"
  npm install --prefer-offline --silent
  npm test
  npm run doctor
  npm run deploy
)

CLI_PACKAGE="$BOOT_DIR/node_modules/@corner-store/cli"
if ! forge build --offline --root "$CLI_PACKAGE/bundle/contracts" >"$WORK_DIR/forge-build.log" 2>&1; then
  cat "$WORK_DIR/forge-build.log"
  exit 1
fi

echo "Corner Store standalone SDK product smoke passed."
