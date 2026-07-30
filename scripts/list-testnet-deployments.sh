#!/usr/bin/env bash
set -euo pipefail

ROOT=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)
PUBLIC_DIR="$ROOT/deployments/public"
OUTPUT_MODE="${1:-table}"

if [[ "$OUTPUT_MODE" != "table" && "$OUTPUT_MODE" != "--json" ]]; then
  echo "Usage: scripts/list-testnet-deployments.sh [--json]" >&2
  exit 2
fi

if [[ ! -d "$PUBLIC_DIR" ]]; then
  if [[ "$OUTPUT_MODE" == "--json" ]]; then
    printf '[]\n'
  else
    echo "No committed public testnet deployments."
  fi
  exit 0
fi

FILES=()
while IFS= read -r file; do
  FILES+=("$file")
done < <(find "$PUBLIC_DIR" -maxdepth 1 -type f -name '*.json' | sort)
if [[ ${#FILES[@]} -eq 0 ]]; then
  if [[ "$OUTPUT_MODE" == "--json" ]]; then
    printf '[]\n'
  else
    echo "No committed public testnet deployments."
  fi
  exit 0
fi

node - "$OUTPUT_MODE" "${FILES[@]}" <<'NODE'
const fs = require("fs");
const path = require("path");
const [mode, ...files] = process.argv.slice(2);
const records = files.map((file) => {
  const value = JSON.parse(fs.readFileSync(file, "utf8"));
  return {
    file: path.relative(process.cwd(), file),
    deploymentId: value.deploymentId,
    chainId: value.chainId,
    createdAt: value.createdAt,
    transactionCount: value.transactionCount,
    rwaToken: value.rwaToken,
    router: value.router,
    engine: value.engine,
    rfqAdapter: value.rfqAdapter,
    makerAuthorizer: value.makerAuthorizer
  };
});

if (mode === "--json") {
  process.stdout.write(`${JSON.stringify(records, null, 2)}\n`);
} else {
  console.table(records);
}
NODE
