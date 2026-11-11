# Production assurance tooling (OPS-004, step 2)

These are implemented defaults, team-to-confirm. A passing automated gate does
not replace independent review, external audit evidence or an operator recovery
drill. Canonical release documentation and feature status are deferred to step 3.

Provision the supported Linux x86_64 or macOS ARM64 host without a global install:

```sh
python3 scripts/assurance/install.py
source scripts/assurance/env.sh
python scripts/assurance/verify_tools.py
python scripts/assurance/install.py --offline
scripts/assurance/install-deps.sh
python -m unittest discover -s scripts/assurance -p 'test_*.py'
scripts/assurance/run.sh slither
scripts/assurance/run.sh mutation
scripts/assurance/run.sh coverage
scripts/assurance/run.sh e2e-buidl
scripts/assurance/run.sh e2e-context
scripts/assurance/run.sh e2e-identity
```

Use Bash when sourcing `env.sh`. It pins all command tools and cache/temp paths
inside `.assurance/`; it does not change the user's home or global toolchains.
`toolchain.json` pins archive checksums, including Python 3.12.12, Foundry 1.7.1,
Solc 0.8.17, Node 20.20.2 and Yarn 1.22.22. On macOS the compiler comes from the
immutable Alloy solc-builds commit used by solc-select for native ARM builds.
Linux uses the Solidity solc-bin release. All 47 Slither 0.11.6 Python packages
are version/hash locked in `requirements.lock`. The installer downloads binary
wheels before an offline, hash-checked, no-dependency-resolution install and runs
`pip check`. No global pip, solc-select or npm installation is needed. A missing
archive, wheel, compiler or tool fails; there is no optional-success fallback.

`scripts/check.sh` provisions these tools, runs harness regressions, the existing
repository checks, then coverage, Slither and PR mutations. `--repository-only`
explicitly omits those three independent gates for CI, where they run as separate
required jobs. It is not a complete production assurance verdict. CI retains both
existing container smoke checks. Configure the Production assurance job results
as required branch/release checks in the hosting service; repository YAML cannot
set repository branch protection. Hosted CI has not been benchmarked locally.

## Mutation evidence

`sentinels.json` lists single-site, whole-source-SHA256-checked business-rule
patches, mapped test files/names and a review rationale for each non-equivalent
sentinel. PRs run the `pr` set; scheduled/manual runs include `expanded` entries.
Each patch runs in a disposable copy with its own generated output. Dependencies
are provisioned once and reused read-only; no build writes to source services.
Every mapped test must pass unchanged before applying its patch. Only mapped
assertion failures kill a compiling mutant. Compilation failures, missing tests,
skips, unexpected execution errors and timeouts fail separately. The gate
requires 100% kills and retains patches, baseline/mutated logs, mapped tests,
survivors and exclusions under `.assurance/reports/mutation/`.

`python scripts/assurance/mutation.py --profile expanded` runs the full set.
`--only id,...` is diagnostic and always marks its report as a subset, never a
full verdict. The recovery sentinel deliberately injects a signing subprocess;
the regression mocks that subprocess before invoking recovery, so the mutant
cannot broadcast. Reporter redaction remains explicitly blocked until #161's
real Reporter source exists. It is not represented by a mock or a killed mutant.

## Independent analysis

The Slither driver compiles all `src/**/*.sol` and exactly
`script/{DeployProductionCore.s.sol,ProductionCoreDeployer.sol}` in a fresh
workspace, retains imported library context, checks the source inventory, and
runs every shipped detector with inline ignores disabled. Analyzer errors and
partial parsing fail. Raw and normalized output remain artifacts. The version
and detector inventories are checked against `slither-baseline.json`.

Slither 0.11.6 cannot resolve `Vm.serializeBytes32` overloads for `.codehash`
on deployment-struct fields. `slither-compatibility.json` applies uniquely matched,
source-hash-checked explicit `bytes32` casts only in the disposable analysis input.
These are identity casts on expressions whose Solidity type is already bytes32.
Reports retain original input hashes, exact patches and the adjusted input hash.
The production source file is never edited. Any drift requires explicit review;
this compatibility adjustment cannot suppress analyzer errors or findings.

Baseline membership grants no suppression. `slither-suppressions.json` separately
records each reviewed medium/high result, its exact source/function fingerprint,
severity, rationale, reviewer, issue and expiry. The initial reviewer is Codex;
human team confirmation remains pending. The proposed initial review window ends
2026-12-11. An expiry is exclusive: the gate fails on that day. New or upgraded
medium/high findings, changed fingerprints, stale/duplicate suppressions and
incomplete review records fail closed. Low/informational findings remain visible.
Refresh a candidate with `python scripts/assurance/analyze.py --capture-baseline`,
then review findings individually. This flag never updates the committed baseline
or suppressions and never establishes a gate pass.

## Coverage and CI evidence

`coverage.json` defines the proposed production line/branch floors and the exact
production deployment allowlist. A missing source record or empty instrumentation
fails; scopes cannot silently vanish. Source-hash-bound exemptions are only for
reviewed files with no executable code, never for uncovered logic. Coverage
thresholds do not establish correctness or security. Compiler adjustments used
only for coverage must be retained in its report; production compiler settings
remain unchanged.

The primary measurement uses `--ir-minimum` because the unoptimized full project
does not compile. Its EIP-170 assertion runs separately under the production
compiler and must pass as exactly one named test; coverage bytecode size is not
production bytecode size. Minimal-IR source maps also miss executed assembly
loads in `PredicateValidation.sol`. A second isolated coverage run compiles that
unchanged library and its real tests without IR or optimization. Only that exact
file's LCOV record replaces the primary record, with both raw reports retained.
There are no executable-line exclusions or lowered thresholds. Auth, libraries
and factory each enforce their own floor.

PR jobs use fixed seed `0x156` and a 15-minute timeout target. Scheduled and manual
runs rotate and retain a 256-bit seed, use the nightly 1,024 x 128 invariant
profile, run expanded mutations and add Reg D to the BUIDL/context/identity E2Es.
Run them locally with `run.sh invariants --deep`, `run.sh mutation --deep` and
`run.sh e2e-reg-d`. E2Es run in separate workspaces on ports 18545 through 18548,
with separate backend ports, so legacy artifact filenames do not collide.
Reports include commands, versions, commit/dirty state, seed, elapsed time, exit
status and artifact hashes. CI retains them for 30 days even on failure. Replay a
retained counterexample/seed and turn confirmed regressions into named tests.
No real-network deployment, external audit or recovery drill is claimed here.

Upstream references: [Slither 0.11.6](https://github.com/crytic/slither/releases/tag/0.11.6),
[Foundry coverage implementation](https://github.com/foundry-rs/foundry/blob/v1.7.1/crates/forge/src/cmd/coverage.rs).
