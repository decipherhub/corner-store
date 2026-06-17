#!/usr/bin/env sh
set -eu

ROOT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)

cd "$ROOT_DIR"

echo "==> Checking Solidity formatting"
forge fmt --check

echo "==> Building Solidity"
forge build

echo "==> Running Foundry tests"
forge test --offline

echo "==> Running vendored deploy-v3 tests"
(
  cd tools/deploy-v3
  yarn test
)

echo "==> Checking whitespace errors"
git diff --check

echo "All checks passed."
