#!/usr/bin/env python3
import json
from pathlib import Path
import subprocess
import shutil
import tempfile
import time

from gates import coverage_gate, replace_coverage_source, GateError
from verify_tools import verify_tools
from mutation import classify_forge

ROOT = Path(__file__).resolve().parents[2]


def main():
    versions = verify_tools()
    output = ROOT / '.assurance/reports/coverage'
    output.mkdir(parents=True, exist_ok=True)
    lcov = output / 'lcov.info'
    lcov.unlink(missing_ok=True)
    started = time.monotonic()
    with (output / 'production-size.log').open('w') as log:
        result = subprocess.run(['forge', 'test', '--offline', '--json', '--match-path', 'test/integration/IdentitySettlementBinding.t.sol',
                                 '--match-test', 'test_identityPolicyRegistry_fitsEip170'], cwd=ROOT,
                                stdout=log, stderr=subprocess.STDOUT, timeout=180)
    if classify_forge(result.returncode, json.loads((output / 'production-size.log').read_text()),
                      ['test_identityPolicyRegistry_fitsEip170']) != 'survived':
        raise GateError('production EIP-170 size check failed')
    # Coverage only: default non-IR compilation fails stack-too-deep without optimization.
    # Never use this compiler adjustment for production bytecode or deployment evidence.
    with (output / 'forge.log').open('w') as log:
        subprocess.run(['forge', 'coverage', '--offline', '--ir-minimum', '--report', 'lcov', '--report', 'summary',
                        '--no-match-test', 'test_identityPolicyRegistry_fitsEip170',
                        '--report-file', str(lcov)], cwd=ROOT, stdout=log, stderr=subprocess.STDOUT, check=True, timeout=840)
    predicate = 'src/libraries/PredicateValidation.sol'
    with tempfile.TemporaryDirectory(prefix='coverage-assembly-', dir=ROOT / '.assurance/tmp') as directory:
        workspace = Path(directory)
        shutil.copytree(ROOT / 'lib', workspace / 'lib')
        for name in ['foundry.toml', 'remappings.txt', predicate, 'test/unit/libraries/PredicateValidation.t.sol']:
            target = workspace / name
            target.parent.mkdir(parents=True, exist_ok=True)
            shutil.copyfile(ROOT / name, target)
        with (output / 'assembly.log').open('w') as log:
            subprocess.run(['forge', 'coverage', '--root', str(workspace), '--offline', '--report', 'lcov', '--report', 'summary'],
                           cwd=workspace, stdout=log, stderr=subprocess.STDOUT, check=True, timeout=120)
        measured = (workspace / 'lcov.info').read_text()
        (output / 'assembly-lcov.info').write_text(measured)
        merged = replace_coverage_source(lcov.read_text(), measured, predicate)
        (output / 'merged-lcov.info').write_text(merged)
    config = json.loads((ROOT / 'assurance/coverage.json').read_text())
    report = {'schemaVersion': 1, 'tools': versions, 'compiler_adjustment': '--ir-minimum, coverage only',
              'production_size_check': 'test_identityPolicyRegistry_fitsEip170, production compiler, required pass',
              'supplemental': {'source': predicate, 'compiler': 'unoptimized, no IR, coverage only'}, 'passed': False}
    try:
        report['scopes'] = coverage_gate(ROOT, merged, config['scopes'], config['instrumentation_exemptions'])
        report['passed'] = True
    except Exception as error:
        report['error'] = str(error)
        raise
    finally:
        report['seconds'] = round(time.monotonic() - started, 3)
        (output / 'report.json').write_text(json.dumps(report, indent=2) + '\n')
    print(json.dumps(report, indent=2))


if __name__ == '__main__':
    main()
