#!/usr/bin/env python3
"""One independently required assurance job with retained command/seed evidence."""
import argparse
import hashlib
import json
import os
from pathlib import Path
import secrets
import shutil
import subprocess
import tempfile
import time

from gates import GateError
from mutation import prepare
from process import run_command
from verify_tools import verify_tools

ROOT = Path(__file__).resolve().parents[2]
TASKS = ['coverage', 'slither', 'mutation', 'invariants', 'e2e-buidl', 'e2e-reg-d', 'e2e-context', 'e2e-identity']


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('task', choices=TASKS)
    parser.add_argument('--deep', action='store_true')
    args = parser.parse_args()
    versions = verify_tools()
    output = ROOT / '.assurance/reports' / args.task
    output.mkdir(parents=True, exist_ok=True)
    seed = os.environ.get('FOUNDRY_FUZZ_SEED') or ('0x' + secrets.token_hex(32) if args.deep else '0x156')
    env = os.environ.copy()
    env['FOUNDRY_FUZZ_SEED'] = seed
    env['FOUNDRY_PROFILE'] = 'nightly' if args.deep else 'default'
    started = time.monotonic()
    report = {'schemaVersion': 1, 'task': args.task, 'deep': args.deep, 'seed': seed, 'tools': versions, 'passed': False}
    report['commit'] = subprocess.check_output(['git', 'rev-parse', 'HEAD'], cwd=ROOT, text=True).strip()
    report['dirty'] = bool(subprocess.check_output(['git', 'status', '--porcelain'], cwd=ROOT, text=True).strip())
    workspace = None
    command = None
    try:
        if args.task.startswith('e2e-'):
            workspace = tempfile.TemporaryDirectory(prefix=args.task + '-', dir=ROOT / '.assurance/tmp')
            cwd = Path(workspace.name)
            prepare(cwd)
            shutil.copytree(ROOT / 'scripts', cwd / 'scripts')
            # A separate artifact tree per profile; no legacy shared file is written in ROOT.
            if args.task == 'e2e-buidl': command = ['bash', 'scripts/e2e-anvil.sh', '--profile', 'buidl-like', '--port', '18545', '--backend-port', '18787']
            elif args.task == 'e2e-reg-d': command = ['bash', 'scripts/e2e-anvil.sh', '--profile', 'reg-d', '--port', '18546', '--backend-port', '18788']
            elif args.task == 'e2e-context': command = ['bash', 'scripts/e2e-context-provenance.sh', '--port', '18547']
            else: command = ['bash', 'scripts/e2e-identity-evidence.sh', '--port', '18548']
            env['FOUNDRY_ROOT'] = str(cwd)
        else:
            cwd = ROOT
            if args.task == 'invariants':
                command = ['forge', 'test', '--offline', '--match-path', 'test/invariant/*.t.sol']
            elif args.task == 'mutation':
                command = [str(ROOT / '.assurance/venv/bin/python'), 'scripts/assurance/mutation.py', '--profile', 'expanded' if args.deep else 'pr']
            else:
                command = [str(ROOT / '.assurance/venv/bin/python'), 'scripts/assurance/' + ('coverage.py' if args.task == 'coverage' else 'analyze.py')]
        report['command'] = command
        with (output / 'run.log').open('w') as log:
            code = run_command(command, cwd, log, 3300 if args.deep else 840, env)
        report['exit_code'] = code
        if code != 0: raise GateError(args.task + ' failed; see ' + str(output / 'run.log'))
        report['passed'] = True
    except Exception as error:
        report['error'] = str(error)
        raise
    finally:
        if workspace:
            for name in ['deployments', 'broadcast', 'cache/invariant']:
                source = Path(workspace.name) / name
                if source.is_dir(): shutil.copytree(source, output / name, dirs_exist_ok=True)
            workspace.cleanup()
        elif args.task == 'invariants' and (ROOT / 'cache/invariant').is_dir():
            shutil.copytree(ROOT / 'cache/invariant', output / 'counterexamples', dirs_exist_ok=True)
        report['seconds'] = round(time.monotonic() - started, 3)
        report['artifacts'] = {p.relative_to(output).as_posix(): hashlib.sha256(p.read_bytes()).hexdigest()
                               for p in sorted(output.rglob('*')) if p.is_file() and p.name != 'run.json'}
        (output / 'run.json').write_text(json.dumps(report, indent=2) + '\n')
        print(json.dumps({k: report[k] for k in ['task', 'seed', 'passed', 'seconds']}), flush=True)


if __name__ == '__main__':
    main()
