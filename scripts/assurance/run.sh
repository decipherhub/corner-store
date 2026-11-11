#!/usr/bin/env bash
set -euo pipefail
ROOT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")/../.." && pwd)
cd "$ROOT_DIR"
source scripts/assurance/env.sh
if [ ! -x .assurance/venv/bin/python ]; then
  echo 'Pinned assurance tools missing; run python3 scripts/assurance/install.py' >&2
  exit 1
fi
python scripts/assurance/verify_tools.py
exec python scripts/assurance/run.py "$@"
