import copy
import datetime
import hashlib
import io
import json
import os
from pathlib import Path
import subprocess
import tarfile
import tempfile
import unittest

from gates import GateError, coverage_gate, normalize_slither, review_dependencies, review_slither, replace_coverage_source
from install import archive_tree_digest, install_archive, installed_tree_digest
from mutation import apply_mutation, classify_forge, classify_node, parse_forge_output, validate_manifest


class EnvironmentTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.root = Path(self.tmp.name).resolve()

    def environment_script(self, name):
        root = self.root / name
        script = root / 'scripts/assurance/env.sh'
        script.parent.mkdir(parents=True)
        script.write_text((Path(__file__).parent / 'env.sh').read_text())
        forge = root / '.assurance/tools/foundry/forge'
        forge.parent.mkdir(parents=True)
        forge.write_text('#!/bin/sh\necho pinned\n')
        forge.chmod(0o755)
        return script

    def run_bash(self, script, command, *args):
        env = dict(os.environ, BASH_ENV=str(script))
        result = subprocess.run(['bash', '-eu', '-c', command, 'test', *map(str, args)],
                                env=env, text=True, capture_output=True)
        self.assertEqual(result.returncode, 0, result.stderr)
        return result.stdout.splitlines()

    def test_nested_bash_preserves_path_override_and_exported_variables(self):
        script = self.environment_script('first')
        stub = self.root / 'stub/forge'
        stub.parent.mkdir()
        stub.write_text('#!/bin/sh\necho stub\n')
        stub.chmod(0o755)
        output = self.run_bash(script, '''
export PATH="$1:$PATH"
export FOUNDRY_OFFLINE=overridden TMPDIR="$1"
bash -eu -c 'source "$BASH_ENV"; command -v forge; forge; printf "%s\\n" "$FOUNDRY_OFFLINE" "$TMPDIR" "$PATH"'
printf '%s\\n' "$PATH"
''', stub.parent)
        self.assertEqual(output[:4], [str(stub), 'stub', 'overridden', str(stub.parent)])
        self.assertEqual(output[4], output[5])

    def test_nested_bash_applies_different_worktree_environment(self):
        first = self.environment_script('first')
        second = self.environment_script('second')
        output = self.run_bash(first, '''
export BASH_ENV="$1"
bash -eu -c 'command -v forge; printf "%s\\n" "$FOUNDRY_SOLC"'
''', second)
        tools = second.parents[2] / '.assurance/tools'
        self.assertEqual(output, [str(tools / 'foundry/forge'), str(tools / 'solc/solc')])


class CoverageTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.root = Path(self.tmp.name)
        (self.root / 'src/execution').mkdir(parents=True)
        (self.root / 'src/execution/A.sol').write_text('contract A {}\n')
        self.scopes = [{'name': 'execution', 'patterns': ['src/execution/**'], 'line': 95, 'branch': 90}]
        self.lcov = 'SF:src/execution/A.sol\nDA:1,1\nBRDA:1,0,0,1\nend_of_record\n'

    def test_complete_instrumentation_passes(self):
        self.assertEqual(coverage_gate(self.root, self.lcov, self.scopes)[0]['line'], 100)

    def test_missing_file_fails(self):
        (self.root / 'src/execution/B.sol').write_text('contract B {}\n')
        with self.assertRaisesRegex(GateError, 'instrumentation'):
            coverage_gate(self.root, self.lcov, self.scopes)

    def test_below_floor_fails(self):
        with self.assertRaisesRegex(GateError, 'floor'):
            coverage_gate(self.root, self.lcov.replace('DA:1,1', 'DA:1,0'), self.scopes)

    def test_missing_branches_fail(self):
        with self.assertRaisesRegex(GateError, 'branch'):
            coverage_gate(self.root, self.lcov.replace('BRDA:1,0,0,1\n', ''), self.scopes)

    def test_truncated_or_duplicate_records_fail(self):
        for data in [self.lcov.replace('end_of_record\n', ''), self.lcov * 2, '']:
            with self.assertRaises(GateError):
                coverage_gate(self.root, data, self.scopes)

    def test_unknown_or_escaping_paths_fail(self):
        with self.assertRaises(GateError):
            coverage_gate(self.root, self.lcov.replace('src/execution/A.sol', '../A.sol'), self.scopes)

    def test_branch_floor_and_negative_counters_fail(self):
        for data in [self.lcov.replace('BRDA:1,0,0,1', 'BRDA:1,0,0,-'),
                     self.lcov.replace('DA:1,1', 'DA:1,-1')]:
            with self.assertRaises(GateError): coverage_gate(self.root, data, self.scopes)

    def test_exemptions_require_unchanged_source_and_reason(self):
        item = dict(path='src/execution/B.sol', sha256='wrong', reason='constants only')
        (self.root / item['path']).write_text('library B {}\n')
        with self.assertRaises(GateError): coverage_gate(self.root, self.lcov, self.scopes, [item])

    def test_supplemental_measurement_can_replace_only_its_exact_source(self):
        extra = self.lcov.replace('A.sol', 'Other.sol')
        measured = self.lcov.replace('DA:1,1', 'DA:1,2')
        self.assertEqual(replace_coverage_source(self.lcov + extra, measured, 'src/execution/A.sol'), measured + extra)
        for incomplete in ['', measured * 2, measured.replace('end_of_record\n', '')]:
            with self.assertRaises(GateError): replace_coverage_source(self.lcov, incomplete, 'src/execution/A.sol')


class AnalysisTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.root = Path(self.tmp.name)
        (self.root / 'src').mkdir()
        (self.root / 'src/A.sol').write_text('contract A { function f() public {} }\n')
        self.raw = {'success': True, 'error': None, 'results': {'detectors': [{
            'check': 'reentrancy-eth', 'impact': 'Medium', 'confidence': 'High', 'description': 'example',
            'elements': [{'type': 'function', 'name': 'f', 'source_mapping': {
                'filename_relative': 'src/A.sol', 'start': 0, 'length': 36, 'lines': [1]}}]}]}}
        self.today = datetime.date(2026, 11, 11)

    def findings(self):
        return normalize_slither(self.root, self.raw)

    def suppression(self):
        f = self.findings()[0]
        return dict(fingerprint=f['fingerprint'], detector=f['detector'], impact='Medium',
                    justification='Reviewed external call ordering', reviewer='repo owner, team-to-confirm',
                    tracking_issue='#156', expiry='2026-12-11', status='approved')

    def test_baseline_does_not_suppress(self):
        with self.assertRaisesRegex(GateError, 'unsuppressed'):
            review_slither(self.findings(), self.findings(), [], self.today)

    def test_reviewed_suppression_passes(self):
        review_slither(self.findings(), self.findings(), [self.suppression()], self.today)

    def test_expired_missing_duplicate_and_unknown_suppressions_fail(self):
        for update in [{'expiry': '2026-11-11'}, {'reviewer': ''}, {'fingerprint': 'unknown'},
                       {'status': 'pending-human-review'}]:
            s = self.suppression(); s.update(update)
            with self.assertRaises(GateError):
                review_slither(self.findings(), self.findings(), [s], self.today)
        with self.assertRaises(GateError):
            review_slither(self.findings(), self.findings(), [self.suppression()] * 2, self.today)

    def test_upgrade_and_new_finding_fail(self):
        upgraded = copy.deepcopy(self.findings()); upgraded[0]['impact'] = 'High'
        with self.assertRaises(GateError):
            review_slither(upgraded, self.findings(), [self.suppression()], self.today)
        with self.assertRaises(GateError):
            review_slither(self.findings(), [], [self.suppression()], self.today)

    def test_error_incomplete_output_or_unknown_severity_fails(self):
        for raw in [{}, {'success': False}, {'success': True, 'results': {}},
                    {'success': True, 'error': 'partial', 'results': {'detectors': []}}]:
            with self.assertRaises(GateError):
                normalize_slither(self.root, raw)
        self.raw['results']['detectors'][0]['impact'] = 'Unknown'
        with self.assertRaises(GateError): self.findings()

    def test_source_drift_changes_fingerprint(self):
        before = self.findings()[0]['fingerprint']
        (self.root / 'src/A.sol').write_text('contract A { function f() public { revert(); } }\n')
        self.assertNotEqual(before, self.findings()[0]['fingerprint'])

    def test_duplicate_call_paths_are_normalized_deterministically(self):
        duplicate = copy.deepcopy(self.raw['results']['detectors'][0])
        duplicate['description'] = 'another call path'
        self.raw['results']['detectors'].append(duplicate)
        before = self.findings()
        self.raw['results']['detectors'].reverse()
        self.assertEqual(before, self.findings())
        self.assertEqual(len(before), 1)


class DependencyReviewTests(unittest.TestCase):
    def setUp(self):
        self.today = datetime.date(2026, 11, 18)
        self.lock = 'alpha==1.2.3 --hash=sha256:abc\n'
        self.inventory = {
            'schemaVersion': 1,
            'reviewedAt': '2026-11-18',
            'reviewExpires': '2027-02-16',
            'policy': {'allowedMaintenanceStatuses': ['current-release'], 'licenseReview': 'tooling only'},
            'dependencies': [{
                'name': 'Alpha', 'version': '1.2.3', 'license': 'MIT',
                'upstream': 'https://example.com/alpha', 'pypi': 'https://pypi.org/project/alpha/1.2.3/',
                'pinnedReleaseDate': '2026-11-17', 'latestVersionAtReview': '1.2.3',
                'maintenanceStatus': 'current-release', 'purpose': 'analysis', 'distribution': 'not bundled'
            }]
        }

    def test_inventory_matches_exact_lock(self):
        self.assertEqual(review_dependencies(self.lock, self.inventory, self.today), 1)

    def test_inventory_rejects_expiry_drift_and_incomplete_review(self):
        for mutate in [
            lambda data: data.update(reviewExpires='2026-11-18'),
            lambda data: data['dependencies'][0].update(version='2.0.0'),
            lambda data: data['dependencies'][0].update(license=''),
            lambda data: data['dependencies'][0].update(maintenanceStatus='yanked'),
            lambda data: data['dependencies'][0].update(upstream='http://example.com/alpha'),
        ]:
            candidate = copy.deepcopy(self.inventory)
            mutate(candidate)
            with self.assertRaises(GateError):
                review_dependencies(self.lock, candidate, self.today)


class ToolIntegrityTests(unittest.TestCase):
    def test_archive_identity_detects_cached_tool_mutation(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            archive = root / 'tool.tar.gz'
            with tarfile.open(archive, 'w:gz') as tar:
                info = tarfile.TarInfo('bin/tool')
                info.mode = 0o755
                payload = b'#!/bin/sh\necho pinned\n'
                info.size = len(payload)
                tar.addfile(info, io.BytesIO(payload))
            destination = root / 'installed'
            archive_hash = hashlib.sha256(archive.read_bytes()).hexdigest()
            install_archive(archive, destination, archive_hash)
            self.assertEqual(archive_tree_digest(archive), installed_tree_digest(destination))
            (destination / 'bin/tool').write_text('#!/bin/sh\necho changed\n')
            with self.assertRaisesRegex(RuntimeError, 'content mismatch'):
                install_archive(archive, destination, archive_hash)

    def test_archive_tree_digest_rejects_duplicate_member_names(self):
        with tempfile.TemporaryDirectory() as directory:
            archive = Path(directory) / 'tool.tar.gz'
            with tarfile.open(archive, 'w:gz') as tar:
                for name, payload in (('./bin/tool', b'first'), ('bin/tool', b'second')):
                    info = tarfile.TarInfo(name)
                    info.size = len(payload)
                    tar.addfile(info, io.BytesIO(payload))
            with self.assertRaisesRegex(RuntimeError, 'duplicate tool archive member'):
                archive_tree_digest(archive)


class MutationTests(unittest.TestCase):
    def test_forge_event_stream_selects_test_results(self):
        event = {'event': 'failure', 'reason': 'assertion failed'}
        results = {'suite': {'test_results': {'invariant_x()': {'status': 'Failure'}}}}
        self.assertEqual(parse_forge_output(json.dumps(event) + '\n' + json.dumps(results) + '\n'), results)
        with self.assertRaises(GateError):
            parse_forge_output(json.dumps(event))

    def test_only_expected_assertions_count_as_kills(self):
        self.assertEqual(classify_forge(1, {'X': {'test_results': {'test_guard()': {
            'status': 'Failure', 'reason': 'next call did not revert as expected'}}}}, ['test_guard']), 'killed')
        for reason in ['EvmError: Revert', 'setup failed', 'panic: arithmetic underflow or overflow (0x11)']:
            with self.assertRaises(GateError):
                classify_forge(1, {'X': {'test_results': {'test_guard()': {
                    'status': 'Failure', 'reason': reason}}}}, ['test_guard'])

    def test_survivor_empty_skipped_and_unmapped_failures(self):
        self.assertEqual(classify_forge(0, {'X': {'test_results': {'test_guard()': {'status': 'Success'}}}}, ['test_guard']), 'survived')
        for results in [{}, {'test_guard()': {'status': 'Skipped'}}, {'test_other()': {'status': 'Failure', 'reason': 'assertion failed'}}]:
            with self.assertRaises(GateError):
                classify_forge(1, {'X': {'test_results': results}}, ['test_guard'])
        duplicate = {'test_results': {'test_guard()': {'status': 'Success'}}}
        with self.assertRaises(GateError):
            classify_forge(0, {'X': duplicate, 'Y': duplicate}, ['test_guard'])

    def test_node_requires_mapped_assertion(self):
        tap = '# Subtest: refuses overwrite\nnot ok 1 - refuses overwrite\n  ---\n  code: ERR_ASSERTION\n  ...\n# tests 1\n# pass 0\n# fail 1\n'
        self.assertEqual(classify_node(1, tap, ['refuses overwrite']), 'killed')
        for data in [tap.replace('ERR_ASSERTION', 'EACCES'), tap.replace('refuses overwrite', 'other'), '']:
            with self.assertRaises(GateError): classify_node(1, data, ['refuses overwrite'])

    def test_node_skips_only_unselected_named_tests(self):
        tap = 'ok 1 - other # SKIP test name does not match pattern\n  ---\n  duration_ms: 1\n  ...\n# Subtest: selected\nok 2 - selected\n  ---\n  duration_ms: 1\n  ...\n1..2\n# tests 2\n# pass 1\n# fail 0\n# skipped 1\n'
        self.assertEqual(classify_node(0, tap, ['selected']), 'survived')
        with self.assertRaises(GateError): classify_node(0, tap, ['other'])

    def test_compile_errors_missing_tools_and_timeouts_are_not_kills(self):
        import sys
        from mutation import run
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            for command in [[str(root / 'missing')], [sys.executable, '-c', 'import time; time.sleep(1)']]:
                with self.assertRaises(GateError): run(command, root, root / 'log', timeout=0.01)
        with self.assertRaises(GateError): classify_forge(1, {'errors': 'compiler failed'}, ['test_guard'])

    def test_timeout_also_stops_spawned_children(self):
        import sys
        import time
        from mutation import run
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            child = 'import time; from pathlib import Path; time.sleep(0.3); Path("orphan").touch()'
            parent = 'import subprocess, sys, time; subprocess.Popen([sys.executable, "-c", sys.argv[1]]); time.sleep(2)'
            with self.assertRaises(GateError):
                run([sys.executable, '-c', parent, child], root, root / 'log', timeout=0.1)
            time.sleep(0.4)
            self.assertFalse((root / 'orphan').exists())

    def test_timeout_unwinds_nested_command_groups(self):
        import sys
        import time
        from mutation import run
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            child = 'import time; from pathlib import Path; time.sleep(0.6); Path("orphan").touch()'
            parent = 'import sys; sys.path.insert(0, sys.argv[1]); from process import run_command; run_command([sys.executable, "-c", sys.argv[2]], ".", sys.stdout, 5)'
            with self.assertRaises(GateError):
                run([sys.executable, '-c', parent, str(Path(__file__).parent), child], root, root / 'log', timeout=0.3)
            time.sleep(0.7)
            self.assertFalse((root / 'orphan').exists())

    def test_patch_requires_hash_and_unique_site(self):
        import hashlib
        data = 'guard();\n'
        item = dict(sha256=hashlib.sha256(data.encode()).hexdigest(), before='guard();', after='')
        self.assertEqual(apply_mutation(data, item), '\n')
        with self.assertRaises(GateError): apply_mutation(data + data, item)
        item['before'] = 'absent'
        with self.assertRaises(GateError): apply_mutation(data, item)

    def test_manifest_rejects_empty_or_unreviewed_set(self):
        for data in [{'sentinels': []}, {'sentinels': [{'id': 'a'}]}]:
            with self.assertRaises(GateError): validate_manifest(data)


if __name__ == '__main__':
    unittest.main()
