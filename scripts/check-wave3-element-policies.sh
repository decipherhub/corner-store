#!/usr/bin/env sh
set -eu

ROOT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
SOURCE="$ROOT_DIR/tools/deploy-wave3/DeployWave3Elements.s.sol"

# Wave-3 intentionally sits outside the default Foundry compile graph. Normalize
# whitespace so formatting changes cannot silently weaken this policy check.
NORMALIZED=$(tr -d '[:space:]' < "$SOURCE")
EXPECTED='registry.registerElement(bytes32("A-12-v1"),address(newRedFlagKnowledgeBar()),EnforcementAction.FLAG_ONLY);'

case "$NORMALIZED" in
  *"$EXPECTED"*) ;;
  *)
    echo "A-12-v1 must be registered explicitly with EnforcementAction.FLAG_ONLY" >&2
    exit 1
    ;;
esac

echo "Wave-3 element registration policies are valid."
