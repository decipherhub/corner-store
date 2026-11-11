#!/usr/bin/env bash
set -euo pipefail
ROOT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")/../.." && pwd)
cd "$ROOT_DIR"
source scripts/assurance/env.sh
python scripts/assurance/verify_tools.py
if [ "$#" -ne 0 ]; then
  echo 'Usage: scripts/assurance/install-deps.sh' >&2
  exit 2
fi
for service in rfq rfq-host cli toolkit compliance-data rfq-demo-backend; do
  npm ci --prefix "services/$service" --no-audit --no-fund
done
yarn --cwd tools/deploy-v3 install --frozen-lockfile
