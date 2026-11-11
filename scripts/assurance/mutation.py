#!/usr/bin/env python3
"""Run reviewed single-site sentinels in disposable workspaces."""
import argparse
import difflib
import hashlib
import json
import os
from pathlib import Path
import re
import shutil
import subprocess
import tempfile
import time

from gates import GateError
from process import run_command
from verify_tools import verify_tools

ROOT = Path(__file__).resolve().parents[2]


def apply_mutation(source, item):
    if hashlib.sha256(source.encode()).hexdigest() != item['sha256']:
        raise GateError('mutation source hash mismatch')
    if not item['before'] or source.count(item['before']) != 1 or item['before'] == item['after']:
        raise GateError('mutation must change exactly one unique site')
    return source.replace(item['before'], item['after'], 1)


def validate_manifest(data):
    items = data.get('sentinels')
    if data.get('schemaVersion') != 1 or not isinstance(items, list) or not items:
        raise GateError('empty/invalid mutation manifest')
    ids = set()
    for item in items:
        for field in ['id', 'path', 'sha256', 'before', 'tests', 'review', 'tier', 'runner']:
            if not item.get(field): raise GateError('unreviewed/incomplete mutation: ' + field)
        if item['id'] in ids or not re.fullmatch('[a-z0-9-]+', item['id']): raise GateError('invalid mutation id')
        ids.add(item['id'])
        if item['runner'] not in ['forge', 'node'] or item['tier'] not in ['pr', 'expanded']:
            raise GateError('invalid mutation runner/tier')
        if item['path'].startswith('/') or '..' in Path(item['path']).parts: raise GateError('unsafe mutation path')
        if not isinstance(item['tests'], list) or not all(isinstance(t, str) and t for t in item['tests']):
            raise GateError('mutation needs mapped tests')
        if item['runner'] == 'forge' and not item.get('match_path'): raise GateError('mutation needs mapped test path')
        if item['runner'] == 'node' and (not item.get('build') or not item.get('test_file')):
            raise GateError('mutation needs node build/test mapping')
    for exclusion in data.get('exclusions', []):
        if not all(exclusion.get(k) for k in ['id', 'reason', 'tracking_issue', 'status']):
            raise GateError('unjustified mutation exclusion')
    return items


def classify_forge(returncode, raw, expected):
    if not isinstance(raw, dict) or not raw: raise GateError('missing Forge test output')
    if any(not isinstance(suite, dict) or not isinstance(suite.get('test_results'), dict) for suite in raw.values()):
        raise GateError('incomplete Forge suite output')
    results = [(name.split('(')[0], result) for suite in raw.values()
               for name, result in suite.get('test_results', {}).items()]
    if not results or len(results) != len(expected) or set(n for n, _ in results) != set(expected):
        raise GateError('missing or unmapped Forge tests')
    failed = []
    for name, result in results:
        status = result.get('status')
        if status not in ['Success', 'Failure']: raise GateError('skipped/incomplete mutation test')
        if status == 'Failure':
            reason = result.get('reason') or ''
            if not any(marker in reason.lower() for marker in ['assertion failed', 'did not revert as expected',
                       'call reverted as expected, but without data', 'error != expected error', 'log != expected log']):
                raise GateError('unexpected non-assertion failure: ' + name + ': ' + reason)
            failed.append(name)
    if returncode == 0 and not failed: return 'survived'
    if returncode != 1 or not failed: raise GateError('Forge infrastructure failure')
    return 'killed'


def classify_node(returncode, output, expected):
    blocks = re.findall(r'^(?:not )?ok \d+ - (.+?)(?=\n(?:# Subtest:|(?:not )?ok \d+ -|1\.\.|# tests)|\Z)', output, re.M | re.S)
    blocks = [b for b in blocks if ' # SKIP test name does not match pattern' not in b.splitlines()[0]]
    names = [b.splitlines()[0] for b in blocks]
    if not names or len(names) != len(expected) or set(names) != set(expected) or any(' # SKIP' in n for n in names):
        raise GateError('missing, skipped or unmapped Node tests')
    failures = re.findall(r'^not ok \d+ - (.+?)(?=\n(?:# Subtest:|(?:not )?ok \d+ -|1\.\.|# tests)|\Z)', output, re.M | re.S)
    if any('ERR_ASSERTION' not in b for b in failures): raise GateError('unexpected Node non-assertion failure')
    if returncode == 0 and not failures: return 'survived'
    if returncode != 1 or not failures: raise GateError('Node infrastructure failure')
    return 'killed'


def run(command, workspace, log, timeout=240):
    with log.open('w') as output:
        return run_command(command, workspace, output, timeout, os.environ.copy())


def prepare(workspace):
    for name in ['src', 'script', 'test', 'lib', 'services']:
        shutil.copytree(ROOT / name, workspace / name,
                        ignore=shutil.ignore_patterns('node_modules', 'dist', 'bundle', '__pycache__'))
    for name in ['foundry.toml', 'remappings.txt']:
        shutil.copyfile(ROOT / name, workspace / name)
    (workspace / 'deployments').mkdir()
    # Immutable dependencies are installed before execution; generated output is never shared.
    for package in (ROOT / 'services').iterdir():
        if (package / 'node_modules').is_dir():
            (workspace / 'services' / package.name / 'node_modules').symlink_to(package / 'node_modules', target_is_directory=True)
    (workspace / 'tools/deploy-v3').mkdir(parents=True)
    (workspace / 'tools/deploy-v3/node_modules').symlink_to(ROOT / 'tools/deploy-v3/node_modules', target_is_directory=True)
    # Reuse unchanged compilation artifacts; Forge invalidates the source-hash-checked patch.
    for name in ['out', 'cache']:
        if (ROOT / name).is_dir():
            shutil.copytree(ROOT / name, workspace / name, ignore=shutil.ignore_patterns('invariant', 'fuzz'))


def execute_tests(workspace, item, log):
    if item['runner'] == 'forge':
        command = ['forge', 'test', '--root', str(workspace), '--offline', '--json', '--match-path', item['match_path'],
                   '--match-test', '^(' + '|'.join(re.escape(n) for n in item['tests']) + r')(\(.*\))?$']
        code = run(command, workspace, log)
        try: raw = json.loads(log.read_text())
        except ValueError: raise GateError('Forge compile/infrastructure failure: ' + str(log))
        return classify_forge(code, raw, item['tests'])
    build_log = log.with_suffix('.build.log')
    if run(item['build'], workspace, build_log) != 0:
        raise GateError('TypeScript compile failure: ' + str(build_log))
    command = ['node', '--test', '--test-name-pattern', '^(' + '|'.join(re.escape(n) for n in item['tests']) + ')$', item['test_file']]
    code = run(command, workspace, log)
    return classify_node(code, log.read_text(), item['tests'])


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--profile', choices=['pr', 'expanded'], default='pr')
    parser.add_argument('--only', help='diagnostic subset; never a release verdict')
    parser.add_argument('--output', default='.assurance/reports/mutation')
    args = parser.parse_args()
    versions = verify_tools()
    manifest = json.loads((ROOT / 'assurance/sentinels.json').read_text())
    items = validate_manifest(manifest)
    if args.profile == 'pr': items = [i for i in items if i['tier'] == 'pr']
    if args.only: items = [i for i in items if i['id'] in args.only.split(',')]
    if not items: raise GateError('no selected mutation sentinels')
    output = ROOT / args.output
    output.mkdir(parents=True, exist_ok=True)
    report = {'schemaVersion': 1, 'profile': args.profile, 'tools': versions, 'diagnostic_subset': bool(args.only),
              'sentinels': [], 'exclusions': manifest.get('exclusions', []), 'passed': False}
    started = time.monotonic()
    try:
        for item in items:
            source = (ROOT / item['path']).read_bytes().decode('utf-8')
            mutated = apply_mutation(source, item)
            patch = ''.join(difflib.unified_diff(source.splitlines(True), mutated.splitlines(True),
                                                fromfile=item['path'], tofile=item['path']))
            (output / (item['id'] + '.patch')).write_text(patch)
            row = {'id': item['id'], 'tests': item['tests'], 'result': 'infrastructure-error'}
            report['sentinels'].append(row)
            with tempfile.TemporaryDirectory(prefix='mutation-', dir=ROOT / '.assurance/tmp') as directory:
                workspace = Path(directory)
                prepare(workspace)
                if execute_tests(workspace, item, output / (item['id'] + '.baseline.log')) != 'survived':
                    raise GateError('unchanged mutation baseline failed: ' + item['id'])
                (workspace / item['path']).write_bytes(mutated.encode('utf-8'))
                row['result'] = execute_tests(workspace, item, output / (item['id'] + '.mutated.log'))
                print(item['id'] + ': ' + row['result'], flush=True)
        survivors = [r['id'] for r in report['sentinels'] if r['result'] != 'killed']
        report['killed'] = len(items) - len(survivors)
        report['total'] = len(items)
        report['kill_rate'] = report['killed'] / len(items)
        report['survivors'] = survivors
        if survivors: raise GateError('surviving sentinels: ' + ', '.join(survivors))
        report['passed'] = not bool(args.only)
    finally:
        report['seconds'] = round(time.monotonic() - started, 3)
        (output / 'report.json').write_text(json.dumps(report, indent=2) + '\n')


if __name__ == '__main__':
    main()
