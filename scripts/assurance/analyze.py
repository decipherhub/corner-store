#!/usr/bin/env python3
"""Analyze all production source and deployment entry points, retaining library context."""
import argparse
import inspect
import json
import logging
import os
from pathlib import Path
import shutil
import subprocess
import tempfile
import time

from gates import GateError, digest, normalize_slither, review_slither
from verify_tools import verify_tools

ROOT = Path(__file__).resolve().parents[2]
DEPLOYMENT = ['script/DeployProductionCore.s.sol', 'script/ProductionCoreDeployer.sol']


class AnalyzerErrors(logging.Handler):
    def __init__(self):
        super().__init__(logging.ERROR)
        self.errors = []

    def emit(self, record):
        if record.levelno >= logging.ERROR:
            self.errors.append(record.getMessage())


def analyze(output):
    from slither import Slither
    from slither.detectors import all_detectors
    from slither.detectors.abstract_detector import AbstractDetector
    errors = AnalyzerErrors()
    logging.getLogger().addHandler(errors)
    inventory = {p.relative_to(ROOT).as_posix(): digest(p.read_text()) for p in (ROOT / 'src').rglob('*.sol')}
    inventory.update({p: digest((ROOT / p).read_text()) for p in DEPLOYMENT})
    compatibility = json.loads((ROOT / 'assurance/slither-compatibility.json').read_text())
    compatibility_source = (ROOT / compatibility['path']).read_text()
    if digest(compatibility_source) != compatibility['sha256']:
        raise GateError('Slither compatibility source hash changed; review required')
    for patch in compatibility['patches']:
        if compatibility_source.count(patch['before']) != 1:
            raise GateError('Slither compatibility patch is not unique')
        compatibility_source = compatibility_source.replace(patch['before'], patch['after'], 1)
    with tempfile.TemporaryDirectory(prefix='slither-', dir=ROOT / '.assurance/tmp') as directory:
        workspace = Path(directory)
        for name in ['src', 'lib']:
            shutil.copytree(ROOT / name, workspace / name)
        for name in ['foundry.toml', 'remappings.txt'] + DEPLOYMENT:
            target = workspace / name
            target.parent.mkdir(parents=True, exist_ok=True)
            shutil.copyfile(ROOT / name, target)
        (workspace / compatibility['path']).write_text(compatibility_source)
        with (output / 'compile.log').open('w') as log:
            subprocess.run(['forge', 'build', '--root', str(workspace), '--offline', '--force', '--build-info', '--ast'], cwd=workspace,
                           stdout=log, stderr=subprocess.STDOUT, timeout=240, check=True)
        previous = Path.cwd()
        try:
            os.chdir(workspace)
            slither = Slither(str(workspace), foundry_ignore_compile=True, show_ignored_findings=True, disallow_partial=True)
            parsed = {Path(str(path)).resolve().relative_to(workspace).as_posix() for path in slither.source_code}
            if not set(inventory).issubset(parsed):
                raise GateError('incomplete analysis source inventory: ' + str(set(inventory) - parsed))
            detectors = sorted({value for value in vars(all_detectors).values() if inspect.isclass(value)
                                and issubclass(value, AbstractDetector) and value is not AbstractDetector},
                               key=lambda detector: detector.ARGUMENT)
            if len(detectors) < 90: raise GateError('incomplete analyzer detector inventory')
            for detector in detectors: slither.register_detector(detector)
            # No detector/path exclusion and no inline ignore grants approval.
            results = [item for group in slither.run_detectors() for item in group]
            if errors.errors:
                raise GateError('analyzer errors: ' + '\n'.join(errors.errors))
            raw = {'success': True, 'error': None, 'results': {'detectors': results}}
            (output / 'raw.json').write_text(json.dumps(raw, indent=2) + '\n')
            normalized = normalize_slither(workspace, raw)
            findings = [f for f in normalized if any(loc['path'] in inventory for loc in f['locations'])]
        finally:
            os.chdir(previous)
            logging.getLogger().removeHandler(errors)
    return {'schemaVersion': 1, 'complete': True, 'sources': inventory,
            'compatibility': dict(compatibility, analysis_sha256=digest(compatibility_source)),
            'detectors': [d.ARGUMENT for d in detectors], 'findings': findings}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--capture-baseline', action='store_true', help='write an unapproved candidate; never suppresses findings')
    args = parser.parse_args()
    versions = verify_tools()
    started = time.monotonic()
    output = ROOT / '.assurance/reports/slither'
    output.mkdir(parents=True, exist_ok=True)
    result = analyze(output)
    result['tools'] = versions
    result['seconds'] = round(time.monotonic() - started, 3)
    (output / 'normalized.json').write_text(json.dumps(result, indent=2, sort_keys=True) + '\n')
    if args.capture_baseline:
        (output / 'baseline.candidate.json').write_text(json.dumps(result, indent=2, sort_keys=True) + '\n')
        print('Unapproved candidate: ' + str(output / 'baseline.candidate.json'))
        return
    baseline = json.loads((ROOT / 'assurance/slither-baseline.json').read_text())
    suppressions = json.loads((ROOT / 'assurance/slither-suppressions.json').read_text())
    if baseline.get('schemaVersion') != 1 or baseline.get('complete') is not True or baseline.get('tools') != versions:
        raise GateError('invalid analyzer baseline/tool identity')
    if baseline.get('detectors') != result['detectors']:
        raise GateError('analyzer detector inventory changed; review required')
    if suppressions.get('schemaVersion') != 1:
        raise GateError('invalid suppression artifact')
    review_slither(result['findings'], baseline['findings'], suppressions['suppressions'])
    print('Slither: ' + str(len(result['findings'])) + ' normalized findings reviewed')


if __name__ == '__main__':
    main()
