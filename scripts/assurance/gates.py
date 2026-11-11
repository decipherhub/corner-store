"""Fail-closed report validation shared by the assurance commands."""
import datetime
import fnmatch
import hashlib
import json
from pathlib import Path


class GateError(RuntimeError):
    pass


def digest(value):
    return hashlib.sha256(value.encode()).hexdigest()


def coverage_gate(root, lcov, scopes, exemptions=None):
    root = Path(root).resolve()
    records = {}
    current = None
    for line in lcov.splitlines():
        if line.startswith('SF:'):
            if current is not None:
                raise GateError('truncated coverage record')
            name = line[3:]
            path = Path(name)
            if path.is_absolute():
                try: name = path.resolve().relative_to(root).as_posix()
                except ValueError: raise GateError('coverage path outside root')
            if '..' in Path(name).parts or name in records:
                raise GateError('duplicate or escaping coverage path: ' + name)
            current = {'name': name, 'lines': {}, 'branches': {}}
        elif line.startswith(('DA:', 'BRDA:')):
            if current is None:
                raise GateError('coverage counters without file')
            fields = line.split(':', 1)[1].split(',')
            try:
                if line.startswith('DA:'):
                    key, hit = int(fields[0]), int(fields[1])
                    table = current['lines']
                else:
                    if len(fields) != 4: raise ValueError()
                    key, hit = tuple(fields[:3]), 0 if fields[3] == '-' else int(fields[3])
                    table = current['branches']
                if key in table or hit < 0: raise ValueError()
                table[key] = hit
            except (ValueError, IndexError):
                raise GateError('invalid coverage counter')
        elif line == 'end_of_record':
            if current is None: raise GateError('empty coverage record')
            records[current['name']] = current
            current = None
    if current is not None or not records:
        raise GateError('incomplete coverage output')
    exemptions = exemptions or []
    exempt = {}
    for item in exemptions:
        path = root / item['path']
        if not item.get('reason') or not path.is_file() or digest(path.read_text()) != item['sha256']:
            raise GateError('invalid coverage instrumentation exemption: ' + str(path))
        if item['path'] in exempt: raise GateError('duplicate coverage exemption')
        exempt[item['path']] = item
    report = []
    failures = []
    used_exemptions = set()
    for scope in scopes:
        paths = sorted({p.relative_to(root).as_posix() for pattern in scope['patterns']
                        for p in root.glob(pattern + '/*.sol' if pattern.endswith('/**') else pattern) if p.is_file() and p.suffix == '.sol'})
        if not paths: raise GateError('missing production coverage scope: ' + scope['name'])
        selected = []
        for path in paths:
            if path in exempt:
                used_exemptions.add(path)
                continue
            if path not in records or not records[path]['lines']:
                raise GateError('missing coverage instrumentation: ' + path)
            selected.append(records[path])
        lines = [n for r in selected for n in r['lines'].values()]
        branches = [n for r in selected for n in r['branches'].values()]
        if not lines or not branches:
            raise GateError('missing line/branch instrumentation: ' + scope['name'])
        result = {'name': scope['name'], 'files': len(selected),
                  'line_hit': sum(n > 0 for n in lines), 'line_total': len(lines),
                  'branch_hit': sum(n > 0 for n in branches), 'branch_total': len(branches)}
        result['line'] = 100 * result['line_hit'] / result['line_total']
        result['branch'] = 100 * result['branch_hit'] / result['branch_total']
        result['required_line'] = scope['line']; result['required_branch'] = scope['branch']
        report.append(result)
        if result['line'] < scope['line'] or result['branch'] < scope['branch']:
            failures.append(scope['name'])
    if set(exempt) != used_exemptions:
        raise GateError('unused coverage instrumentation exemption')
    if failures:
        raise GateError('coverage floor failed: ' + ', '.join(failures) + '\n' + json.dumps(report, indent=2))
    return report


IMPACTS = {'Informational': 0, 'Optimization': 0, 'Low': 1, 'Medium': 2, 'High': 3}


def normalize_slither(root, raw):
    root = Path(root).resolve()
    if raw.get('success') is not True or raw.get('error') or not isinstance(raw.get('results', {}).get('detectors'), list):
        raise GateError('incomplete or failed analyzer output')
    findings = {}
    for item in raw['results']['detectors']:
        if item.get('impact') not in IMPACTS or not item.get('check') or not isinstance(item.get('elements'), list):
            raise GateError('malformed analyzer finding')
        locations = []
        for element in item['elements']:
            mapping = element.get('source_mapping', {})
            name = mapping.get('filename_relative')
            if not name: raise GateError('finding missing source mapping')
            path = Path(name)
            if path.is_absolute():
                try: path = path.resolve().relative_to(root)
                except ValueError: raise GateError('analyzer source outside root')
            if '..' in path.parts: raise GateError('analyzer source escapes root')
            source = root / path
            if not source.is_file(): raise GateError('analyzer source missing: ' + str(path))
            locations.append({'path': path.as_posix(), 'symbol': element.get('name', ''),
                              'kind': element.get('type', ''), 'source_sha256': digest(source.read_text()),
                              'start': mapping.get('start'), 'length': mapping.get('length')})
        if not locations: raise GateError('analyzer finding without locations')
        locations = sorted({json.dumps(loc, sort_keys=True) for loc in locations})
        identity = {'detector': item['check'], 'locations': [json.loads(loc) for loc in locations]}
        fingerprint = digest(json.dumps(identity, sort_keys=True, separators=(',', ':')))
        result = dict(identity, fingerprint=fingerprint, impact=item['impact'], confidence=item['confidence'],
                      description=item.get('description', ''))
        if fingerprint in findings:
            previous = findings[fingerprint]
            if any(previous[k] != result[k] for k in ['impact', 'confidence']):
                raise GateError('conflicting analyzer findings')
            # Slither may emit the same source/function set in different traversal orders.
            result['description'] = min(previous['description'], result['description'])
        findings[fingerprint] = result
    return [findings[key] for key in sorted(findings)]


def review_slither(findings, baseline, suppressions, today=None):
    today = today or datetime.date.today()
    known = {f['fingerprint']: f for f in baseline}
    current = {f['fingerprint']: f for f in findings}
    if len(known) != len(baseline) or len(current) != len(findings):
        raise GateError('duplicate analyzer baseline/finding')
    approved = {}
    for suppression in suppressions:
        required = ['fingerprint', 'detector', 'impact', 'justification', 'reviewer', 'tracking_issue', 'expiry']
        if any(not isinstance(suppression.get(k), str) or not suppression[k].strip() for k in required):
            raise GateError('incomplete reviewed suppression')
        try: expiry = datetime.date.fromisoformat(suppression['expiry'])
        except ValueError: raise GateError('invalid suppression expiry')
        key = suppression['fingerprint']
        if expiry <= today or key in approved or key not in known or key not in current:
            raise GateError('expired, duplicate or stale suppression: ' + key)
        if suppression['detector'] != current[key]['detector'] or suppression['impact'] != current[key]['impact']:
            raise GateError('suppression detector/severity mismatch: ' + key)
        approved[key] = suppression
    failures = []
    for key, finding in current.items():
        if finding['impact'] not in IMPACTS: raise GateError('unknown analyzer severity')
        if IMPACTS[finding['impact']] < 2: continue
        old = known.get(key)
        if old is None or IMPACTS[finding['impact']] > IMPACTS[old['impact']] or key not in approved:
            failures.append(finding['detector'] + ':' + key)
    if failures:
        raise GateError('new, upgraded or unsuppressed analyzer findings: ' + ', '.join(failures))


def replace_coverage_source(primary, supplemental, source):
    def records(data):
        result = []
        for chunk in data.split('end_of_record\n')[:-1]:
            names = [line[3:] for line in chunk.splitlines() if line.startswith('SF:')]
            if len(names) != 1: raise GateError('invalid supplemental coverage record')
            result.append((names[0], chunk + 'end_of_record\n'))
        if not data.endswith('end_of_record\n') or not result:
            raise GateError('incomplete supplemental coverage output')
        return result
    original = records(primary)
    measured = [chunk for name, chunk in records(supplemental) if name == source]
    if len(measured) != 1 or sum(name == source for name, _ in original) != 1:
        raise GateError('supplemental coverage must replace exactly one source')
    return ''.join(measured[0] if name == source else chunk for name, chunk in original)
