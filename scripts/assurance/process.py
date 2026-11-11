"""Bounded commands terminate the whole process group, including Anvil and compiler children."""
import os
import signal
import subprocess

from gates import GateError


def interrupted(signum, frame):
    raise InterruptedError('assurance command interrupted by signal ' + str(signum))


def run_command(command, cwd, output, timeout, env=None):
    previous = signal.signal(signal.SIGTERM, interrupted)
    try:
        try:
            process = subprocess.Popen(command, cwd=cwd, stdout=output, stderr=subprocess.STDOUT,
                                       env=env, start_new_session=True)
        except OSError as error:
            raise GateError('missing/failed command: ' + str(error)) from error
        try:
            return process.wait(timeout=timeout)
        except BaseException as error:
            try:
                os.killpg(process.pid, signal.SIGTERM)
                process.wait(timeout=5)
            except (ProcessLookupError, subprocess.TimeoutExpired):
                pass
            finally:
                # The parent can exit before a child that ignored TERM. Reap the entire group.
                try: os.killpg(process.pid, signal.SIGKILL)
                except ProcessLookupError: pass
                process.wait()
            if isinstance(error, subprocess.TimeoutExpired):
                raise GateError('command timeout: ' + str(command)) from error
            raise
    finally:
        signal.signal(signal.SIGTERM, previous)
