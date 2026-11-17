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
MARKERS = {'.archive-sha256'}


def _stable_path(path):
    parts = Path(path).parts
    return not any(part == '__pycache__' for part in parts) and not str(path).endswith('.pyc') and Path(path).name not in MARKERS


def _tree_record(kind, name, mode, payload):
    return b'\0'.join([kind.encode(), name.encode(), str(mode & 0o111).encode(), payload]) + b'\n'


def archive_tree_digest(archive):
    """Derive an installed-tree identity directly from the checksum-pinned archive."""
    result = hashlib.sha256()
    with tarfile.open(archive) as tar:
        members = []
        for member in tar.getmembers():
            name = member.name.removeprefix('./').rstrip('/')
            if not name or member.isdir() or not _stable_path(name):
                continue
            members.append((name, member))
        for name, member in sorted(members):
            if member.issym():
                result.update(_tree_record('symlink', name, member.mode, member.linkname.encode()))
            elif member.isfile() or member.islnk():
                stream = tar.extractfile(member)
                if stream is None:
                    raise RuntimeError('unreadable tool archive member: ' + name)
                result.update(_tree_record('file', name, member.mode, hashlib.sha256(stream.read()).digest()))
            else:
                raise RuntimeError('unsupported tool archive member: ' + name)
    return result.hexdigest()


def installed_tree_digest(destination):
    result = hashlib.sha256()
    destination = Path(destination)
    for path in sorted(destination.rglob('*'), key=lambda item: item.relative_to(destination).as_posix()):
        name = path.relative_to(destination).as_posix()
        if path.is_dir() or not _stable_path(name):
            continue
        mode = path.lstat().st_mode
        if path.is_symlink():
            result.update(_tree_record('symlink', name, mode, os.readlink(path).encode()))
        elif path.is_file():
            result.update(_tree_record('file', name, mode, hashlib.sha256(path.read_bytes()).digest()))
        else:
            raise RuntimeError('unsupported installed tool entry: ' + str(path))
    return result.hexdigest()


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


def install_archive(archive, destination, archive_sha256):
    marker = destination / '.archive-sha256'
    if destination.exists():
        if marker.exists() and (not marker.is_file() or marker.read_text() != archive_sha256):
            raise RuntimeError('installed tool identity mismatch: ' + destination.name)
    else:
        unpack(archive, destination)
    expected = archive_tree_digest(archive)
    actual = installed_tree_digest(destination)
    if actual != expected:
        raise RuntimeError('installed tool content mismatch: ' + destination.name)
    if not marker.exists():
        marker.write_text(archive_sha256)


def verify_cached_installations(config, key):
    for tool, spec in config['platforms'][key].items():
        archive = download(spec, True)
        destination = LOCAL / 'tools' / tool
        if tool == 'solc':
            binary = destination / 'solc'
            if not binary.is_file() or hashlib.sha256(binary.read_bytes()).hexdigest() != spec[1]:
                raise RuntimeError('installed tool content mismatch: solc')
        else:
            install_archive(archive, destination, spec[1])
    yarn = download(config['yarn'], True)
    install_archive(yarn, LOCAL / 'tools/yarn', config['yarn'][1])


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
            binary = destination / 'solc'
            if binary.exists() and hashlib.sha256(binary.read_bytes()).hexdigest() != spec[1]:
                raise RuntimeError('installed tool content mismatch: solc')
            if not binary.exists():
                shutil.copyfile(archive, binary)
                binary.chmod(0o755)
        else:
            install_archive(archive, destination, spec[1])
    yarn = download(config['yarn'], args.offline)
    install_archive(yarn, LOCAL / 'tools/yarn', config['yarn'][1])
    python = LOCAL / 'tools/python/python/bin/python3'
    env = os.environ.copy()
    env.update(PIP_CACHE_DIR=str(LOCAL / 'pip-cache'), PYTHONNOUSERSITE='1',
               PIP_DISABLE_PIP_VERSION_CHECK='1', PIP_CONFIG_FILE=os.devnull,
               TMPDIR=str(LOCAL / 'tmp'))
    (LOCAL / 'tmp').mkdir(exist_ok=True)
    subprocess.run([str(python), '-c', 'import sys; assert sys.version_info[:3] == (3,12,12)'], check=True, env=env)
    if not args.bootstrap_only and (LOCAL / 'venv').exists():
        shutil.rmtree(LOCAL / 'venv')
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
