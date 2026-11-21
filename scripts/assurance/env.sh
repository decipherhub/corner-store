#!/usr/bin/env bash
# Source this after provisioning to use only the worktree-local pinned tools.
ASSURANCE_ROOT=$(CDPATH= cd -- "$(dirname -- "${BASH_SOURCE[0]}")/../.." && pwd -P)
if [ "${ASSURANCE_ENV_ROOT:-}" = "$ASSURANCE_ROOT" ]; then
  return 0
fi
case $(uname -m) in
  arm64) ASSURANCE_NODE_ARCH=arm64 ;;
  x86_64) ASSURANCE_NODE_ARCH=x64 ;;
  *) echo 'Unsupported assurance architecture' >&2; return 1 ;;
esac
ASSURANCE_NODE_OS=$(uname -s | tr '[:upper:]' '[:lower:]')
export PATH="$ASSURANCE_ROOT/.assurance/tools/foundry:$ASSURANCE_ROOT/.assurance/tools/solc:$ASSURANCE_ROOT/.assurance/tools/node/node-v20.20.2-$ASSURANCE_NODE_OS-$ASSURANCE_NODE_ARCH/bin:$ASSURANCE_ROOT/.assurance/tools/yarn/package/bin:$ASSURANCE_ROOT/.assurance/venv/bin:$PATH"
export FOUNDRY_SOLC="$ASSURANCE_ROOT/.assurance/tools/solc/solc"
export FOUNDRY_OFFLINE=true
export VIRTUAL_ENV="$ASSURANCE_ROOT/.assurance/venv"
export npm_config_cache="$ASSURANCE_ROOT/.assurance/npm-cache"
export YARN_CACHE_FOLDER="$ASSURANCE_ROOT/.assurance/yarn-cache"
export YARN_GLOBAL_FOLDER="$ASSURANCE_ROOT/.assurance/yarn-global"
export YARN_DISABLE_SELF_UPDATE_CHECK=true
export npm_config_update_notifier=false
export PIP_CACHE_DIR="$ASSURANCE_ROOT/.assurance/pip-cache"
export PIP_CONFIG_FILE=/dev/null
export PIP_DISABLE_PIP_VERSION_CHECK=1
export PYTHONNOUSERSITE=1
export PYTHONDONTWRITEBYTECODE=1
export TMPDIR="$ASSURANCE_ROOT/.assurance/tmp"
export ASSURANCE_ENV_ROOT="$ASSURANCE_ROOT"
