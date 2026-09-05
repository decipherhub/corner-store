#!/usr/bin/env sh
set -eu

ROOT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
export npm_config_cache=${npm_config_cache:-"${TMPDIR:-/tmp}/corner-store-npm-cache"}

cd "$ROOT_DIR"

V3_FACTORY_ARTIFACT="tools/deploy-v3/node_modules/@uniswap/v3-core/artifacts/contracts/UniswapV3Factory.sol/UniswapV3Factory.json"
if [ ! -f "$V3_FACTORY_ARTIFACT" ]; then
  echo "==> Installing pinned deploy-v3 dependencies required by canonical pool E2E"
  (
    cd tools/deploy-v3
    yarn install --frozen-lockfile
  )
fi

echo "==> Checking Solidity formatting"
forge fmt --check

echo "==> Running high-severity Solidity lint"
forge lint --severity high --deny warnings src

echo "==> Building Solidity"
forge build

echo "==> Running Foundry tests"
forge test --offline

echo "==> Running RFQ service smoke test"
(
  cd services/rfq
  if [ ! -x node_modules/.bin/tsc ]; then
    npm ci
  fi
  npm test
)

echo "==> Running production RFQ host hardening smoke test"
(
  cd services/rfq-host
  if [ ! -x node_modules/.bin/tsc ]; then
    npm ci
  fi
  npm test
)

echo "==> Running Toolkit config build + smoke test"
(
  cd services/toolkit
  if [ ! -x node_modules/.bin/tsc ]; then
    npm ci
  fi
  npm test
)

echo "==> Running CLI build + smoke test"
(
  cd services/cli
  if [ ! -x node_modules/.bin/tsc ]; then
    npm ci
  fi
  npm test
)

echo "==> Running RFQ demo backend build + smoke test"
(
  cd services/rfq-demo-backend
  if [ ! -x node_modules/.bin/tsc ]; then
    npm ci
  fi
  npm test
)

echo "==> Running public-testnet RFQ demo build + smoke test"
(
  cd services/testnet-rfq-demo
  if [ ! -x node_modules/.bin/tsc ]; then
    npm ci
  fi
  npm test
)

echo "==> Running standalone SDK package consumer smoke test"
scripts/sdk-product-smoke.sh

echo "==> Running read-only Operator API smoke test"
(
  cd services/operator-api
  if [ ! -x node_modules/.bin/tsc ]; then
    npm ci
  fi
  npm test
)

echo "==> Running local Deployment Studio build + smoke test"
(
  cd services/deployment-studio
  if [ ! -x node_modules/.bin/tsc ]; then
    npm ci
  fi
  npm test
)

echo "==> Running compliance data SDK smoke test"
(
  cd services/compliance-data
  if [ ! -x node_modules/.bin/tsc ]; then
    npm ci
  fi
  npm test
)

echo "==> Running read-only Operator dashboard smoke test"
(
  cd services/operator-dashboard
  npm test
)

echo "==> Running investor and issuer product portal smoke test"
(
  cd services/product-portal-demo
  npm test
)

echo "==> Validating deployment-to-DEX showcase plan"
SHOWCASE_PLAN=$(scripts/showcase.sh --plan)
node -e '
const value = JSON.parse(process.argv[1]);
if (
  value.plan?.boundary?.coreImplementation !== "DeployProductionCore.deployCore" ||
  value.plan?.boundary?.productionEvidence !== false ||
  value.plan?.sequence?.length !== 8
) process.exit(1);
' "$SHOWCASE_PLAN"

echo "==> Running vendored deploy-v3 tests"
(
  cd tools/deploy-v3
  if [ ! -x node_modules/.bin/mocha ]; then
    yarn install --frozen-lockfile
  fi
  yarn test
)

echo "==> Checking whitespace errors"
git diff --check

echo "All checks passed."
