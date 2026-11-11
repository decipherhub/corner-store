#!/usr/bin/env python3
"""Provision checksummed tools under .assurance, never in a user tool/cache directory."""
import argparse
import hashlib
import json
import os
from pathlib import Path
import platform
import shutil
import subprocess
import tarfile
import urllib.request

ROOT = Path(__file__).resolve().parents[2]
LOCAL = ROOT / '.assurance'


def download(spec, offline):
    url, expected = spec
    target = LOCAL / 'downloads' / expected
    target.parent.mkdir(parents=True, exist_ok=True)
    if not target.exists():
        if offline:
            raise RuntimeError('missing offline tool archive: ' + url)
        with urllib.request.urlopen(url, timeout=120) as response:
            data = response.read()
        if hashlib.sha256(data).hexdigest() != expected:
            raise RuntimeError('tool checksum mismatch: ' + url)
        target.write_bytes(data)
    if hashlib.sha256(target.read_bytes()).hexdigest() != expected:
        raise RuntimeError('cached tool checksum mismatch: ' + url)
    return target


def unpack(archive, destination):
    destination.mkdir(parents=True, exist_ok=True)
    with tarfile.open(archive) as tar:
        base = destination.resolve()
        for member in tar.getmembers():
            resolved = (base / member.name).resolve()
            if not resolved.is_relative_to(base) or member.isdev():
                raise RuntimeError('unsafe tool archive')
            if member.issym() or member.islnk():
                link = (resolved.parent if member.issym() else base) / member.linkname
                if not link.resolve().is_relative_to(base):
                    raise RuntimeError('unsafe tool archive link')
        tar.extractall(destination)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--offline', action='store_true')
    parser.add_argument('--bootstrap-only', action='store_true', help='maintainer lock generation only')
    args = parser.parse_args()
    config = json.loads((ROOT / 'assurance/toolchain.json').read_text())
    key = platform.system() + '-' + platform.machine()
    if key not in config['platforms']:
        raise RuntimeError('unsupported pinned tool platform: ' + key)
    for tool, spec in config['platforms'][key].items():
        archive = download(spec, args.offline)
        destination = LOCAL / 'tools' / tool
        if tool == 'solc':
            destination.mkdir(parents=True, exist_ok=True)
            shutil.copyfile(archive, destination / 'solc')
            (destination / 'solc').chmod(0o755)
        elif not (destination / '.archive-sha256').exists():
            unpack(archive, destination)
            (destination / '.archive-sha256').write_text(spec[1])
        elif (destination / '.archive-sha256').read_text() != spec[1]:
            raise RuntimeError('installed tool identity mismatch: ' + tool)
    yarn = download(config['yarn'], args.offline)
    if not (LOCAL / 'tools/yarn/package/bin/yarn.js').exists():
        unpack(yarn, LOCAL / 'tools/yarn')
    python = LOCAL / 'tools/python/python/bin/python3'
    env = os.environ.copy()
    env.update(PIP_CACHE_DIR=str(LOCAL / 'pip-cache'), PYTHONNOUSERSITE='1',
               PIP_DISABLE_PIP_VERSION_CHECK='1', PIP_CONFIG_FILE=os.devnull,
               TMPDIR=str(LOCAL / 'tmp'))
    (LOCAL / 'tmp').mkdir(exist_ok=True)
    subprocess.run([str(python), '-c', 'import sys; assert sys.version_info[:3] == (3,12,12)'], check=True, env=env)
    if not (LOCAL / 'venv/bin/python').exists():
        subprocess.run([str(python), '-m', 'venv', str(LOCAL / 'venv')], check=True, env=env)
    if not args.bootstrap_only:
        common = ['--require-hashes', '--only-binary=:all:', '--no-deps', '-r', str(ROOT / 'assurance/requirements.lock')]
        if not args.offline:
            subprocess.run([str(LOCAL / 'venv/bin/python'), '-m', 'pip', 'download',
                            '--dest', str(LOCAL / 'wheels')] + common, check=True, env=env)
        command = [str(LOCAL / 'venv/bin/python'), '-m', 'pip', 'install', '--no-index',
                   '--find-links', str(LOCAL / 'wheels')] + common
        subprocess.run(command, check=True, env=env)
        subprocess.run([str(LOCAL / 'venv/bin/python'), '-m', 'pip', 'check'], check=True, env=env)
    print('Pinned tools provisioned under ' + str(LOCAL))


if __name__ == '__main__':
    main()
