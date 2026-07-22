#!/usr/bin/env sh
set -eu

ROOT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)

cd "$ROOT_DIR"

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

echo "==> Running Toolkit config build + smoke test"
(
  cd services/toolkit
  if [ ! -x node_modules/.bin/tsc ]; then
    npm ci
  fi
  npm test
)

echo "==> Running read-only Operator API smoke test"
(
  cd services/operator-api
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
