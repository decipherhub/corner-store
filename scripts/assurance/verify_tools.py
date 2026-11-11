import importlib.metadata
import json
import os
from pathlib import Path
import platform
import re
import shutil
import subprocess
import sys

from gates import GateError


def verify_tools():
    root = Path(__file__).resolve().parents[2]
    versions = json.loads((root / 'assurance/toolchain.json').read_text())['versions']
    if platform.python_version() != versions['python'] or importlib.metadata.version('slither-analyzer') != versions['slither-analyzer']:
        raise GateError('pinned Python/Slither missing; run python3 scripts/assurance/install.py')
    if not Path(sys.executable).is_relative_to(root / '.assurance'):
        raise GateError('assurance Python must be worktree-local')
    for tool, expected in [('forge', '1.7.1'), ('anvil', '1.7.1'), ('cast', '1.7.1'),
                           ('solc', '0.8.17+commit.8df45f5f'), ('node', 'v20.20.2'), ('yarn', '1.22.22')]:
        resolved = shutil.which(tool)
        if not resolved or not Path(resolved).is_relative_to(root / '.assurance'):
            raise GateError('tool must be provisioned under .assurance: ' + tool)
        try:
            result = subprocess.run([tool, '--version'], capture_output=True, text=True, timeout=15, check=True)
        except (OSError, subprocess.SubprocessError) as error:
            raise GateError('missing/failed pinned tool: ' + tool) from error
        suffix = r'(?![\w])' if tool == 'solc' else r'(?![\w.])'
        if not re.search(r'(?<![\w.])' + re.escape(expected) + suffix, result.stdout):
            raise GateError('tool version mismatch: ' + tool + ': ' + result.stdout)
    if os.environ.get('FOUNDRY_SOLC') != str(root / '.assurance/tools/solc/solc'):
        raise GateError('explicit pinned Solc required; source scripts/assurance/env.sh')
    return versions


if __name__ == '__main__':
    print(json.dumps(verify_tools(), sort_keys=True))
