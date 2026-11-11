# Progress

## 2026-11-12 Session: OPS-004 Explicit Production Compiler

Fixed CI run 43045358878's packed production compiler lookup failure.
`services/toolkit/src/production-evidence.ts:346` selects `FOUNDRY_SOLC` before
home-based lookup and verifies its exact compiler version. Missing, empty,
non-executable and wrong-version overrides fail closed without fallback.
Unset-variable SVM/system behavior is unchanged. The packed consumer uses the
selected compiler and checks its binary SHA-256 commitment. D041 records the
consequence; evidence formats, legacy readers and protected demo paths are
unchanged. OPS-004 remains the sole active feature.

Toolkit/CLI regressions cover an empty HOME with a valid 0.8.17 binary, its
committed hash, invalid overrides despite valid SVM fallback, and unset-variable
lookup. Toolkit checks all three existing SVM locations and rejects 0.8.170.
Before implementation, Toolkit had two expected failures and one passing fallback
test; CLI had one expected failure. The empty-HOME packed run reproduced
`AssertionError: pinned Solc is required`. All targeted cases pass after the fix.
An initial CLI green attempt stopped at TypeScript environment-type inference;
an explicit `NodeJS.ProcessEnv` annotation fixed it before the passing rerun.

Commands use `source scripts/assurance/env.sh` with local Node 20.20.2 and
Foundry 1.7.1, except the repository command which loads it through BASH_ENV.

| Command | Actual result |
| --- | --- |
| Both service builds plus `node --test --test-name-pattern="FOUNDRY_SOLC"` on their compiled production-evidence tests, before fix | Expected exit 1 each; Toolkit 2 failed/1 passed, CLI 1 failed |
| Same targeted commands, after fix | Exit 0 each; Toolkit 3/3, CLI 1/1 selected tests |
| Empty-HOME `npm run test:production-package --prefix services/cli`, before fix | Expected exit 1; reproduced the CI assertion after 10 commitment assertions |
| `npm test --prefix services/toolkit` | Exit 0; smoke and 77/77 named tests |
| `npm test --prefix services/cli` | Exit 0; smoke and 21/21 named tests |
| `node --test scripts/test-production-legacy-artifacts.mjs` | Exit 0; 2/2, exact artifact bytes preserved |
| `python3 -m unittest discover -s scripts/assurance -p 'test_*.py'` | Exit 0; 27/27 |
| `HOME="$fixture_home" BASH_ENV="$PWD/scripts/assurance/env.sh" scripts/check.sh --repository-only` | Exit 0, first attempt; 1,200/1,200 Foundry tests, all service/package checks, 10 packed commitment plus 41 live assertions, legacy 2/2 and deploy-v3 10/10 |
| `git diff --check` and protected-path `git diff --exit-code` | Exit 0 |

`fixture_home` was freshly created under `.assurance/tmp/check-home.xzpSgJ`.
No inherited XDG/Foundry-home or Git identity overrides were present, and none
were injected. No additional home-state dependency was found. Logs are retained
under `/private/tmp/w156-solc-*.log`, including `w156-solc-empty-home-check.log`.
Separate E2E scripts, coverage/Slither/mutation and container gates were not rerun;
hosted Linux CI and prior pending OPS-004 acceptance items remain UNVERIFIED.
Next: review the working tree and rerun hosted CI. No commit, push, branch change
or external publication was performed.

## 2026-11-11 Session: OPS-004 Nested Bash Environment Guard

Fixed the confirmed CI run 43039507031 environment reapplication defect in
`scripts/assurance/env.sh:3`. An exported guard binds successful initialization
to the physically resolved repository root. Re-sourcing through BASH_ENV or an
explicit source in the same worktree preserves PATH and exported overrides;
another worktree still applies its own tools. Both `ci.yml` and
`assurance-job.yml` use this shared script and retain BASH_ENV unchanged.
Pre-existing deployment-wrapper tests are unchanged. No product boundary or
decision policy changed. OPS-004 remains the sole active feature.

`scripts/assurance/test_gates.py:14` adds isolated fake-worktree regressions for
nested Bash stub precedence, exported overrides, repeat sourcing and switching
worktrees. Before the fix, the preservation regression failed with pinned forge
selected instead of the stub; the worktree-switch regression passed. After the
fix, both pass.

| Command | Actual result |
| --- | --- |
| `python3 -m unittest discover -s scripts/assurance -p 'test_gates.py' -k EnvironmentTests` before fix | Expected exit 1; 1 failed, 1 passed |
| Same targeted command after fix | Exit 0; 2/2 |
| `python3 -m unittest discover -s scripts/assurance -p 'test_*.py'` | Exit 0; 27/27 |
| `BASH_ENV=$PWD/scripts/assurance/env.sh bash scripts/test-deploy-testnet-rfq.sh` | Exit 0; argument tests passed |
| `BASH_ENV=$PWD/scripts/assurance/env.sh scripts/check.sh --repository-only` first attempt | Exit 1 after 1,200/1,200 Foundry tests; only the documented RFQ initial-store race flake failed |
| Same repository command, single unchanged rerun | Exit 0; 1,200/1,200 Foundry tests, all repository/service/packed-consumer checks, deployment-wrapper arguments, legacy readers and deploy-v3 tests passed |
| `git diff --check` | Exit 0 |

Logs are retained in
`/private/tmp/w156-env-repository-check.log` and
`/private/tmp/w156-env-repository-check-rerun.log`. Separate live E2Es, assurance
analysis/deep campaigns and container smoke checks are not rerun for this shell
fix. Hosted CI is UNVERIFIED locally; prior pending acceptance items remain.
No commit, push, branch change or external publication was performed.

## 2026-11-11 Session: OPS-004 F1 Commit-Failure Rollback Coverage

Fixed the confirmed F1 assurance gap only. OPS-004 remains the sole active
feature. Production source, deployment scripts, public demo artifacts and
`test/integration/Invariants.t.sol` are unchanged. No product boundary or
decision policy changed.

`test/invariant/handlers/SettlementHandler.sol:49` adds
`commitFailureThenRetry`: temporarily revoke the real surveillance Element's
engine authorization, reject through `_reject`, restore authorization and retry
the identical request. `_reject` checks exact revert, balance/state digest,
Router/RFQ nonces and surveillance count. The per-venue counter advances only
after rejection; the complete action must also pass its retry and ghost model.
`test/invariant/Settlement.invariant.t.sol:10` seeds both directions for AMM and
RFQ v2/v3, targets the new selector and requires two commit-failure rejections
per venue in `invariant_atomicSettlementCommit`. The existing
`testFuzz_exactAmountsAndRollback` also exercises the new action.

`assurance/sentinels.json:49` adds PR sentinel `router-commit-swallow`, mapped
only to the atomic invariant. Its match includes the preceding assignment to
keep a distinct, unique site; the production source hash is unchanged. Current
sets are 15 PR / 21 expanded; current count references in D041, testing, feature
and quality documentation match. Historical 14/20 results below remain historical.

All commands use Bash with `source scripts/assurance/env.sh`, the pinned local
Foundry 1.7.1, Node 20.20.2 and other assurance tools. Logs are retained under
`/private/tmp/w156-f1-*.log` and ignored `.assurance/reports/f1-*/`.

| Command | Actual result |
| --- | --- |
| `forge fmt --check` | Exit 0 |
| `forge test --offline --match-path test/invariant/Settlement.invariant.t.sol` | Exit 0; 4/4, including three 64 x 32 invariants and 256 fuzz cases |
| `forge test --offline` | Exit 0; 1,200/1,200 across 75 suites, zero failed/skipped; the full gate repeated this on the final setup code |
| `python3 -m unittest discover -s scripts/assurance -p 'test_*.py'` | Exit 0; 25/25 |
| `python scripts/assurance/mutation.py --only router-commit-swallow --output .assurance/reports/f1-red` | Expected exit 1; pre-fix mapped baseline and mutant pass, 0/1 killed, mutant survives |
| `forge test --offline --json --match-path 'test/invariant/*.t.sol'` in disposable pre-fix baseline/mutant workspaces | Both exit 0; 15/15 in five suites each, confirming the full pre-fix invariant suite survives; hashed logs in `f1-red-full-invariants/` |
| `python scripts/assurance/mutation.py --only router-commit-swallow --output .assurance/reports/f1-green-final` | Exit 0; baseline passes, mutant killed by the named atomic invariant assertion, 1/1 killed, zero survivors; diagnostic subset, not a release verdict |
| `forge test --offline --match-path test/invariant/Settlement.invariant.t.sol --match-test testFuzz_exactAmountsAndRollback --fuzz-runs 1 -vvvvv` | Exit 0; 1/1. Inspected all six deterministic traces: both Transfer events precede `commit` and the real `onTransfer` authorization revert |
| `scripts/check.sh` | Exit 0, first run; 1,200/1,200 Foundry tests, all service/packed checks, legacy 2/2, deploy-v3 10/10, and all three assurance gates below |
| `scripts/assurance/run.sh coverage` (inside check.sh) | Exit 0; primary 1,199/1,199, production EIP-170 1/1, supplemental 5/5; all floors passed with unchanged production scope measurements; 567.222 seconds |
| `scripts/assurance/run.sh slither` (inside check.sh) | Exit 0; complete normalized baseline, 179 findings and all 102 detectors; 28.618 seconds |
| `scripts/assurance/run.sh mutation` (inside check.sh) | Exit 0; 15/15 PR sentinels killed, 15 passing baselines, zero survivors, 100%; 104.508 seconds |
| `python .assurance/reports/documentation/verify-f1.py` | Exit 0; nine text files, 12 local links, current 15/21 counts, sole active feature, nine hashed result sets, diagnostic red/green and full pre-fix invariant log hashes verified |
| `git diff --check` and protected-path `git diff --exit-code` | Exit 0; no whitespace or protected production/demo/#160 path changes |

The first post-fix mutation attempt failed closed on unmapped `setUp()` output.
Setup now catches only the new witness calls, leaving missing counts to fail
the atomic invariant before fuzzing. The successful rerun reports the mapped
property's assertion failure. The mutation runner and its strict classifier
are unchanged. The final-code full gate's atomic property exercised the new
action 344 times with zero handler reverts (64 runs / 2,048 calls total).

Separate four-profile live E2Es, the full nightly 1,024 x 128 campaign and the
21-sentinel expanded campaign were not rerun for this test-only fix. Prior
results below do not verify the new action at nightly depth. Hosted/container
checks and prerequisite/Reporter integration remain UNVERIFIED or pending as
previously recorded. No commit, push or external publication was performed.

## 2026-11-11 Session: OPS-004 Release Evidence and Full Verification

OPS-004 is the sole active feature and is not passing. Scope: approved #156
step 3, canonical release evidence/template, D040-D042 and fresh full/local E2E
verification. Steps 1 and 2 are committed as 51cebdb and bb23c12. No production
source, deployed artifact, protected public demo path or external #160 test was
changed. No adjacent runtime work, custody/key/multisig expansion or vendor
integration was added. All defaults are adopted as team-to-confirm.

Added `docs/release-assurance.md` and `docs/release-evidence.v1.template.json`.
The versioned manual review record binds clean frozen commit, tools, chain/config,
deployment evidence version 2 evidenceId/trusted recordDigest, exact report
hashes, seeds and workflow results. It is separate from CLI authorization.
External audit owner/reviewer remain TBD before first production release. Audit
scope/report/remediation/retest and chain recovery transactions/fund reconciliation/
safe-resumption/sign-off remain MISSING. Proposed drill cadence is before first
launch, quarterly and after material changes. Production release stays BLOCKED.
The active execution plan records the unmet checks rather than claiming completion.

Migrated durable slice decisions and verification into canonical documents and
removed SLICE_NOTES.md. Updated FEATURES, DECISIONS, QUALITY, testing/security,
production deployment, tooling and document indexes. Corrected the former manual
E2E-only description to match separate PR and scheduled/manual assurance jobs.
There is no new test code in this documentation slice. Existing 25 gate-harness
regressions ran before documentation edits; a retained local validation script checks
template/status/tool/inventory bindings, links, new text and report hashes.

### Fresh step 3 commands and results

All checks used repository-local pinned Node 20.20.2/Yarn 1.22.22, Foundry 1.7.1,
Solc 0.8.17, Python 3.12.12 and Slither 0.11.6. For commands below, the shared Bash
wrapper is `bash -c 'source scripts/assurance/env.sh && <command>'`; run.sh also
sources that environment internally. This uses the exact checksum-pinned Node
and Yarn archives instead of an unpinned npx download. Logs are under
`/private/tmp/w156-step3-*.log`; hashed job reports are in ignored
`.assurance/reports/<task>/`.

| Command inside the wrapper | Actual result |
| --- | --- |
| `scripts/check.sh` | Exit 0; 1,200/1,200 Foundry tests in 75 suites, all service/packed checks, legacy 2/2, deploy-v3 10/10, plus all three independent gates below |
| `scripts/assurance/run.sh coverage` (invoked by check.sh) | Exit 0; primary 1,199/1,199 in 75 suites, production EIP-170 1/1, supplemental 5/5; every floor passed; 592.966 seconds |
| `scripts/assurance/run.sh slither` (invoked by check.sh) | Exit 0; 179 complete normalized findings, all 102 detectors; 29.229 seconds |
| `scripts/assurance/run.sh mutation` (invoked by check.sh) | Exit 0; 14/14 PR sentinels killed, 14 passing baselines, zero survivors, 100%; 77.220 seconds |
| `scripts/assurance/run.sh e2e-buidl` | Exit 0; 7/7 chain scenarios plus runtime RFQ/UI/CLI checks; 26.405 seconds |
| `scripts/assurance/run.sh e2e-reg-d` | Exit 0; 7/7 chain scenarios plus runtime RFQ/UI/CLI checks; 22.281 seconds |
| `scripts/assurance/run.sh e2e-context` | Exit 0; 12/12 live cases; 14.095 seconds |
| `scripts/assurance/run.sh e2e-identity` | Exit 0; 40/40 live cases; 22.989 seconds |
| `python -m unittest discover -s scripts/assurance -p "test_*.py"` | Exit 0; 25/25, zero failures; 1.574 seconds |
| `scripts/production-container-smoke.sh` | Exit 1; Docker daemon unavailable, no image/runtime pass |
| `scripts/hackathon-monad-container-smoke.sh` | Exit 1; Docker daemon unavailable, no image/runtime pass |
| `python .assurance/reports/documentation/verify-step3.py` | Exit 0 on final check; 13 text files, 60 local links, sole active feature, unique decisions, template/tool/sentinel bindings and nine hashed result sets |
| `git diff --exit-code feat/154-append-only-deploy-evidence -- deployments/public services/testnet-rfq-demo deploy/hackathon-monad test/integration/Invariants.t.sol src script && git diff --check` | Exit 0 on final check; no protected-path, production-source or whitespace differences |

The full check started before documentation edits. No implementation or test
changed during it. Its repository provenance-sensitive tests ran while tracked
files were held steady. These remain dirty development results rather than
frozen clean-release evidence. The known RFQ race did not occur in the completed
30/30 RFQ stage. No rerun was needed. Both E2E profiles ran with distinct
workspace/port pairs. The final check log ends with `All checks passed.`
Service named tests: RFQ 30/30, RFQ host 24/24, Toolkit 74/74, CLI 20/20 and
compliance-data 25/25; all other service/dashboard/rehearsal smokes passed.
Packed consumers passed 50 production assertions (10 commitments plus 40 live
28-transaction deployment/verification/tamper/recovery checks), eight Solidity
adapter assertions and six RFQ v3/onboarding assertions. The full gate includes
25/25 harness regressions. New-gate runs used seed `0x156`.

Fresh coverage used seed `0x156`; its primary compile took 507.14 seconds and
tests took 79.15 seconds. Production-only scope measurements:

| Scope | Measured line | Measured branch | Required line/branch |
| --- | --- | --- | --- |
| execution | 332/336, 98.81% | 74/82, 90.24% | 95/90 |
| registry | 558/570, 97.89% | 106/116, 91.38% | 95/90 |
| compliance | 1396/1461, 95.55% | 331/384, 86.20% | 90/85 |
| auth | 5/5, 100% | 1/1, 100% | 90/80 |
| libraries | 58/58, 100% | 9/9, 100% | 90/80 |
| factory | 49/49, 100% | 2/2, 100% | 90/80 |
| production deployment | 101/101, 100% | 10/10, 100% | 90/80 |

The independent analyzer's fresh output is complete: 5 high, 73 medium, 76 low,
24 informational and one optimization result. It matches the committed baseline;
all 78 medium/high suppressions remain separately reviewed and source-bound.
Codex is the initial reviewer, with human confirmation pending. This is not an
external audit completion claim.

Documentation validation initially rejected inherited em dash characters in
historical DECISIONS text, then caught an incorrect draft count of PR sentinels.
Restricted character checking to added text and corrected the documentation to
the actual manifest: 14 PR and 20 expanded. No gate or production source changed.
The corrected checker passed on all then-changed files and six retained report
sets; final cleanup validation covers 13 files, 60 links and nine hashed sets.
Retained the validation script under ignored reports and removed the slice's
draft directory. SLICE_NOTES.md is absent; HEAD remains bb23c12.

### Prior-slice evidence verified again, not rerun claims

Step 2 full nightly `scripts/assurance/run.sh invariants --deep`: 15/15 tests in
five suites, eight invariants at 1,024 x 128, 131,072 calls per property and
1,048,576 calls total, zero handler reverts; six fuzz functions at 256 cases and
one named suspended-activation regression. Seed:
`0x0b07357560d4c55e29d488f321fc6053a98a8f020377b2d80f3ae47469dcfb06`.
Runner: 2,165.782 seconds. Checked actual final log and all three run-record hashes;
copied unchanged to `.assurance/reports/step2-invariants/` before any new runs.
Old development counterexamples with changed target selectors were ignored by
Foundry, as its log records; they are not new production failures.

Step 2 expanded `scripts/assurance/run.sh mutation --deep`: 20/20 compiling
sentinels killed with 20 unchanged passing baselines, zero survivors, 226.532
seconds. Seed:
`0xfa2d243831ee6fc90952adf4caf3c9c3f007071aec96614aae00809752b1e93c`.
Checked all 66 recorded artifact hashes; retained unchanged in
`.assurance/reports/step2-mutation/`. Earlier assertion-classifier tightening
reclassified 40 result streams, not a second mutation campaign.

Step 2 coverage passed 1,199 primary tests plus the separate production size test
1/1 and supplemental assembly tests 5/5. Minimal-IR was needed after actual
stack-too-deep/Yul failures; production size assertions use production bytecode.
Meaningful public-input/lifecycle/authorization regressions filled gaps without
executable-source exemptions or lowered floors. Step 3's fresh measurement
belongs in the final result below, rather than being inferred from these notes.

Prior offline proof installed all 47 hash-locked packages into a previously
absent local venv from retained wheels with `--no-index --require-hashes
--only-binary=:all: --no-deps`, then passed pip check. Source-bound Slither input
casts address an actual overload-resolution failure; partial analyzer output was
never accepted. Initial normalization: 179 findings, 5 high/73 medium individually
reviewed by Codex, human confirmation pending, exclusive expiry 2026-12-11.

### Remaining verification and next action

UNVERIFIED: hosted Linux clean-checkout CI, 15-minute PR budgets including tool
provisioning/uploads, required branch/release-check settings and both Docker
container jobs. Prerequisites #161/#162 and inherited-stack merge reconciliation
remain pending; origin/main is still locally recorded as 7893021. The real
Reporter observational invariant/redaction sentinel cannot be added against
absent source and no mock counts. The #160-owned test is untouched. Refresh
source-bound inventories/baselines/suppressions/mutations after integration and
rerun full gates. Do not mark OPS-004 passing or move its plan to completed yet.

External audit and chain-specific recovery artifacts are MISSING; no production
network, legal conclusion, audit or drill completion is claimed. User reviews
the working tree. No commit, push, GitHub comment/review or external publication.

## 2026-11-11 Session: DEPLOY-004 Publication Trust Boundary

DEPLOY-004 is passing. Scope: remaining publication findings from
`../out-review-154-fix.md`, trust preconditions, best-effort mismatch cleanup,
tests and D038/runbook evidence. This supersedes the earlier publication safety
claim: inode checks alone do not prevent ancestor substitution or cleanup races.

`services/toolkit/src/production-publication.ts:36` checks staging/output ancestry
through the root for current-uid/root ownership and safe modes. Only ancestors
may be writable with the sticky bit. Output trust is checked before reservation;
both paths are rechecked at publication/recovery. Inode pinning remains, and
`:211` limits mismatch cleanup to verified output ancestry, preserving the
original error on cleanup failure. D038 and the runbook explicitly trust root
and exclude concurrent operator-uid processes, which already hold signing material.

Tests first: seven new rejection/cleanup cases failed against the prior source;
the sticky acceptance case and all 12 existing publication cases passed. All
20 now pass. New cases at `services/toolkit/test/production-publication.ts:16`
cover group-writable, world-writable non-sticky and foreign-owned ancestors,
foreign-owned/writable output directories, sticky ancestor acceptance, trust
rechecks before linking/recovery and refusing cleanup in an untrusted output
directory. Ownership uses injected `stat.uid`; mode/sticky tests use real modes.

All Node commands below used
`npx --yes -p node@20 -p yarn@1.22.22 -c '<command>'` with Node 20.20.2,
Yarn 1.22.22 and Foundry 1.7.1. Logs use `/private/tmp/w154-trust-`.

| Command inside the wrapper | Actual result | Log suffix |
| --- | --- | --- |
| `npm run build --prefix services/toolkit && node --test services/toolkit/dist/test/production-publication.js` before implementation | Exit 1; 13 passed, seven new cases failed | `red.log` |
| `npm test --prefix services/toolkit && npm test --prefix services/cli && node --test scripts/test-production-legacy-artifacts.mjs` | Exit 0; smokes, Toolkit 74/74, CLI 19/19, legacy 2/2, zero failures/skips | `focused-stable.log` |
| `scripts/check.sh` | Exit 0; 1,171 Foundry tests, all service checks, 50 packed production assertions including live 28-transaction Anvil deployment/recovery, legacy 2/2 and deploy-v3 10/10 | `check.log` |

Intermediate runs failed on ownership error wording and an in-flight tracked-doc
edit caught by the CLI provenance guard. Corrected wording and held the working
tree unchanged for both successful runs. The full gate passed on its first run;
the known RFQ flake did not occur. Separate legacy profile/context/identity E2E
scripts were not repeated for this filesystem-only change; packed live production
deployment/recovery supplied runtime coverage. Whitespace and protected-path
comparisons against HEAD pass. No contract/public/demo changes, commit, push or
external publication. Next: user reviews the working tree. Same-uid concurrency
and other filesystems/power-loss durability remain outside verified guarantees.

## 2026-11-11 Session: DEPLOY-004 Confirmed Review Fixes

DEPLOY-004 is passing. Scope: F1 publication path replacement and F2 hidden Git
input edits from `../out-review-154.md`, regression tests and related evidence
wording. No contract, legacy artifact, public/demo path, custody or signing change.

F1: `services/toolkit/src/production-publication.ts:160` holds a no-follow file
descriptor across validation/linking, verifies final regular-file device/inode/size,
and rechecks the created entry before mismatch cleanup and directory fsync.
Staging ownership, permissions, ancestry and directory identity are checked.
Missing staging before completion fails closed; recovery never overwrites finals.
F2: `services/toolkit/src/production-evidence.ts:105` compares every captured
input's raw bytes with HEAD blobs through committed submodule gitlinks, independent
of index flags. Missing/different blobs cannot grant clean provenance or broadcast.

Tests first: six targeted Toolkit cases failed against the original implementation
(three publication cases and three provenance cases); both CLI index-flag cases
failed by reaching RPC preflight instead of refusing provenance. Added cleanup
replacement and missing-HEAD guards afterward. All ten new cases now pass, plus
existing interruption/SIGKILL/recovery cases. Test names and locations:
`services/toolkit/test/production-publication.ts:131`,
`services/toolkit/test/production-evidence.ts:144` and
`services/cli/test/production-evidence.ts:145`.

All Node commands used `npx --yes -p node@20 -p yarn@1.22.22 -c '<command>'`
(Node 20.20.2, Yarn 1.22.22); Foundry 1.7.1. Logs use `/private/tmp/w154-review-`.

| Command inside the wrapper | Actual result | Log suffix |
| --- | --- | --- |
| `npm test --prefix services/toolkit && npm test --prefix services/cli && node --test scripts/test-production-legacy-artifacts.mjs` | Exit 0; smokes, Toolkit 66/66, CLI 19/19, legacy 2/2, zero failures/skips | `focused-catfile.log` |
| `scripts/check.sh` | Exit 0; 1,171 Foundry tests, all service checks, 50 packed production assertions including 28-transaction deployment/recovery, legacy 2/2 and deploy-v3 10/10 | `check-final.log` |
| `scripts/e2e-anvil.sh && scripts/e2e-anvil.sh --profile reg-d && scripts/e2e-context-provenance.sh && scripts/e2e-identity-evidence.sh` | Exit 0; both profiles 7/7 plus runtime flows, context 12/12, identity 40/40 | `e2e.log` |
| `npm test --prefix services/rfq` | Exit 0; smoke and 30/30 named tests after the unrelated assertion failure below | `rfq-rerun.log` |

Earlier attempts are not passes: stdin-based Git hashing stalled full-source
capture, so those runs were interrupted and replaced by direct HEAD-blob reads.
The next full check failed at RFQ's unchanged concurrent nonce-order assertion
(`check-catfile.log`), also present on origin/main; isolated RFQ and the complete
rerun passed. No RFQ source was changed. Red logs: `red.log`, `cli-red.log`.

D037/D038 and the production runbook clarify the enforced behavior. Whitespace,
protected-path comparisons against `feat/159-identity-decisions` and original v1
example preservation pass. No commit, push or external publication. Next: user
reviews this working tree. Other filesystems and power-loss durability remain
unverified, as before.

## 2026-11-11 Session: DEPLOY-004 Step 3 Release Finalization

DEPLOY-004 is passing after all required release gates. Scope: issue #154 step 3,
D037-D039 (adopted defaults, team-to-confirm), deployment/testing documentation,
versioned example, public-artifact compatibility and full verification. Out of
scope: deployed contracts, protected demo paths, custody/key management/multisig
expansion, vendors, commits/pushes and external publication.

Steps 1-2 are committed as c38d9d5 and 652cc70. Their slice notes are transferred
to the runbook, decisions, feature and execution plan; SLICE_NOTES.md is removed.
The remote main sequencing check (`git ls-remote origin refs/heads/main`) exited
0 and still returned 7893021ecc001041cdf6ee44f22de0d88909c932. Prerequisite merges
remain a release constraint; this work follows the user's explicit stacked-slice
instruction. Public records retain their original schema and exact bytes.

Tests first: added two public-artifact compatibility cases, both passing against
existing CLI/Operator API readers. The v2 example regression first failed to
compile due to an incorrect test signer field, corrected from account to name;
then it failed as expected with ENOENT for the absent v2 example (0 passed,
1 failed, 15 name-filter skips). Added a source-only diagnostic v2 example,
retaining the original v1 example. This example cannot authorize broadcast.

All service/script commands below used Node 20.20.2 and Yarn 1.22.22 through
`npx --yes -p node@20 -p yarn@1.22.22 -c '<command>'`; Foundry is 1.7.1.
Logs are under `/private/tmp/w154-step3-`, with the suffixes in the table.
The exact shell redirection after each wrapped command was
`> /private/tmp/w154-step3-<suffix> 2>&1`, substituting the listed suffix.

| Exact command inside the Node wrapper | Actual result | Log suffix |
| --- | --- | --- |
| `npm run build --prefix services/cli && npm test --prefix services/operator-api && node --test scripts/test-production-legacy-artifacts.mjs` | Exit 0; CLI build, Operator API smoke and 2/2 public compatibility tests passed before integration | `legacy.log` |
| `npm run build --prefix services/toolkit && node --test --test-name-pattern="legacy review example" services/toolkit/dist/test/production-evidence.js` | First exit 2 on the test signer field; corrected run exit 1 with ENOENT, 0 passed/1 failed/15 skipped before adding the v2 example | `example-red.log` (corrected run) |
| `npm test --prefix services/toolkit && npm test --prefix services/cli && node --test scripts/test-production-legacy-artifacts.mjs` | Exit 0; Toolkit smoke + 58/58 named tests, CLI smoke + 17/17 named tests, public compatibility 2/2; zero failed/skipped | `focused.log` |
| `scripts/check.sh` | Exit 0, first run; 1,171/1,171 Foundry tests across 70 suites; fmt/high-severity lint/build; RFQ/host/Toolkit/CLI/compliance-data 30/24/58/17/25 named tests, zero failed/skipped; all service smokes/provider conformance; two external adapter consumers 4/4 Foundry tests each; packed version assertions 6/6; packed production assertions 50/50 (10 commitments + 40 live cases, including real production dry-run/fork and 28-transaction deployment); public compatibility 2/2; showcase plan; deploy-v3 10/10 | `check.log` |
| `scripts/e2e-anvil.sh` | Exit 0, first run; BUIDL-like 7/7 scenarios plus backend/CLI/Router, repeated buys/sells, negative cases and temporal runtime flow | `buidl.log` |
| `scripts/e2e-anvil.sh --profile reg-d` | Exit 0, first run; Reg D 7/7 scenarios plus backend/CLI/Router and runtime checks | `regd.log` |
| `scripts/e2e-context-provenance.sh` | Exit 0, first run; 12/12 live cases, zero failures | `context.log` |
| `scripts/e2e-identity-evidence.sh` | Exit 0, first run; 40/40 live cases, zero failures, normal EIP-170 limits | `identity.log` |
| `node --version && yarn --version` | Exit 0; v20.20.2 and 1.22.22 | terminal |

New coverage: two named public-artifact tests plus one Toolkit legacy/v2 example
regression. The public gate enumerates tracked records, pins the published Monad
SHA-256 `c43cef9e5857a8887d8e8648cbdc7e48e52bd28f4dd685c528a5fa13906e1263`,
reads each exact file through CLI and Operator API and checks listing/hashes/bytes
afterward. No live-chain readiness is used as a compatibility oracle. The original
v1 review example is unchanged. No RFQ flake or full-gate rerun occurred.

Changed files in step 3:

- `FEATURES.md`, `DECISIONS.md`, `PROGRESS.md`
- `docs/deployment-production.md`, `docs/testing.md`
- `docs/exec-plans/completed/DEPLOY-004-append-only-production-evidence.md`
- `scripts/check.sh`, `scripts/test-production-legacy-artifacts.mjs`
- `services/toolkit/test/production-evidence.ts`
- `services/toolkit/examples/production-evidence-v2.example.json`

`SLICE_NOTES.md` was an untracked input and has been removed. The active-plan
index returns to its original no-active-plan state. No production runtime source
or deployed contract changed in step 3.

Final `git diff --check`,
`git diff --exit-code feat/159-identity-decisions -- deployments/public services/testnet-rfq-demo deploy/hackathon-monad`,
`git diff --exit-code HEAD -- services/toolkit/examples/production-evidence.example.json`,
`sh -n scripts/check.sh` and
`node --check scripts/test-production-legacy-artifacts.mjs` exited 0.
Relative documentation link targets exist; added lines/new files contain no em
dash; no active feature or slice-note file remains. Packed consumer and E2E
runners performed normal cleanup of their temporary processes/keys/artifacts.

UNVERIFIED: real production networks, Ledger/hardware/interactive signer behavior,
actual power-loss durability and filesystems other than this local host. Docker
container smoke was not rerun because no image/container contract changed.
Passing the tooling does not establish production deployment readiness. No
production-chain/public Monad mutation, commit, push or external publication was
performed. Next: user reviews the working tree, confirms D037-D039 defaults and
merges prerequisites in the approved order before release.

## 2026-11-11 Session: DATA-004 Assessment Reference Collision Fix

DATA-004 is passing. Scope: the confirmed P2 HTTP v2 assessment-reference
collision, regression tests and conformance coverage. The assessment reference
now uses the keyed source commitment under the separate assessment domain, so
identity/wallet/asset binding, status, facts and revision inputs participate.
Same-case/same-time revocation reaches the existing replacement ordering,
persists negative evidence, blocks acceptance export and survives stale positive
replay. The immutable identical-reference conflict guard is unchanged.

The non-example demo v2 adapter already commits binding and source evidence in
its assessment reference. The v2 conformance runner now shares one store between
eligible/ineligible checks to detect references reused across bindings.
No product boundary, v1 adapter, contract or protected public Monad path changed.

Tests first, against unchanged adapter/conformance code: 22 passed, three failed.
`v2 HTTP same-case revocation persists and blocks acceptance export and stale
approval replay` returned STORE_CONFLICT instead of REVOKED; `v2 HTTP one case
materializes independently for two assets` rejected asset B with STORE_CONFLICT;
`v2 conformance rejects assessment references reused across bindings` incorrectly
reported passed. `v2 identical assessment reference still rejects conflicting
negative content` passed both before and after the fix. All four pass afterward.

Commands ran through
`npx --yes -p node@20 -p yarn@1.22.22 -c '<command>'` (Node 20.20.2,
Foundry 1.7.1). Logs are under `/private/tmp/w159-p2-` with the suffixes below.

| Command | Actual result | Log suffix |
| --- | --- | --- |
| `node --version && npm test --prefix services/compliance-data` (before fix) | Exit 1; smoke/provider checks passed, 22 named tests passed, three failed | `before.log` |
| `npm test --prefix services/compliance-data` | Exit 0; smoke/provider checks and 25/25 named tests passed | `compliance-data.log` |
| `npm test --prefix services/toolkit` | Exit 0; smoke and 30/30 named tests passed | `toolkit.log` |
| `scripts/check.sh` | Exit 0, first run; 1,171 Foundry tests, service/packed-consumer checks and 10 deploy-v3 tests passed | `check.log` |
| `scripts/e2e-identity-evidence.sh` | Exit 0, first run; 40/40 live cases passed | `identity.log` |

`git diff --check` and
`git diff --exit-code HEAD -- deployments/public services/testnet-rfq-demo deploy/hackathon-monad`
both exited 0 after the final documentation edits. Legacy Anvil profile/context
E2Es were not rerun for this adapter/conformance-only fix; their passing release
baseline is recorded below. No commit, push or external publication was performed.
Next: user reviews the working tree.

## 2026-11-11 Session: DATA-004 Step 4 Release Finalization

DATA-004 is passing after all required gates. Scope: issue #159 P1 release
finalization, D031-D036, four separate November P2 PR slots, SDK/versioning and
A-01/A-04/A-11 documentation, release verification and slice-note cleanup.
Out of scope: P2 implementation, settlement contract changes, public Monad paths,
production providers/durable storage, key management, custody and multisig.

Steps 1-3 are already committed on this branch. Their deferred state-document
entries are now finalized: explicit DIRECT/schema 7 topology guards; separate
A-04-v2 evidence/issuer trust; SPI 2.0.0 operator acceptance, local compliance-data
HMAC and optional LEI; opt-in Reg D v4 and named settlement proofs. D036 records
scheduled design only. Reserved upstream decision/feature IDs were not reused.
A-04-v1, existing recipes/quote schemas/API responses and A-11 expiry arithmetic
retain their meanings. No deployed contract was upgraded.

The first full gate provided the red baseline for one stale packed-consumer
assertion: `PRODUCTION_ONBOARDING_SCHEMA_VERSION` was 7, expected 6. Updated only
that assertion and its result label in `scripts/sdk-product-smoke.sh`, then reran
the complete gate successfully. No product runtime code changed in step 4 and no
new behavior tests were added. The known RFQ store flake did not occur.

All service/script commands below used Node 20.20.2 and Yarn 1.22.22 through
`npx --yes -p node@20 -p yarn@1.22.22 -c '<command>'`; Foundry is 1.7.1.

| Exact command inside the Node wrapper | Actual result |
| --- | --- |
| `scripts/check.sh` (first run) | Exit 1 at packed-consumer schema assertion, actual 7 vs expected 6; preceding 1,171 Foundry and RFQ/host/Toolkit/CLI tests passed. Log: `/private/tmp/w159-step4-check.log`. |
| `scripts/check.sh` (after assertion fix) | Exit 0; 1,171/1,171 Foundry tests across 70 suites; format/high-severity lint/build; RFQ/host/Toolkit/CLI/compliance-data 30/24/30/8/21 named tests, all zero failed/skipped; all service smokes, provider conformance, packed consumers (6 version assertions), showcase plan, and 10/10 deploy-v3 tests passed. Log: `/private/tmp/w159-step4-check-final.log`. |
| `scripts/e2e-anvil.sh` | Exit 0, first run; BUIDL-like 7/7 scenarios plus backend/CLI/Router, repeat trades, negative cases and temporal runtime flow passed. Log: `/private/tmp/w159-step4-buidl.log`. |
| `scripts/e2e-anvil.sh --profile reg-d` | Exit 0, first run; Reg D 7/7 scenarios plus backend/CLI/Router and runtime checks passed. Log: `/private/tmp/w159-step4-regd.log`. |
| `scripts/e2e-context-provenance.sh` | Exit 0, first run; 12/12 live cases, zero failed. Log: `/private/tmp/w159-step4-context.log`. |
| `scripts/e2e-identity-evidence.sh` | Exit 0, first run; 40/40 live cases, zero failed, normal EIP-170 limits. Log: `/private/tmp/w159-step4-identity.log`. |
| `node --version && yarn --version` | Exit 0; v20.20.2 and 1.22.22. |

Exact log redirections used after each wrapped invocation were respectively
`> /private/tmp/w159-step4-check.log 2>&1`,
`> /private/tmp/w159-step4-check-final.log 2>&1`,
`> /private/tmp/w159-step4-buidl.log 2>&1`,
`> /private/tmp/w159-step4-regd.log 2>&1`,
`> /private/tmp/w159-step4-context.log 2>&1` and
`> /private/tmp/w159-step4-identity.log 2>&1`.

Additional checks outside the wrapper:

- `forge --version`: exit 0, 1.7.1-Homebrew.
- `git diff --check`: exit 0, including final documentation edits.
- `git diff --exit-code HEAD -- deployments/public services/testnet-rfq-demo deploy/hackathon-monad`:
  exit 0; protected paths unchanged in the working tree.
- `git diff --exit-code feat/155-rfq-quote-bounds -- deployments/public services/testnet-rfq-demo deploy/hackathon-monad`:
  exit 0; protected paths unchanged across all issue #159 slices.
- Final Python document/link/state/character checks: exit 0; added local Markdown
  links resolve, D031-D036 occur once each, DATA-004 is passing with no active
  feature, and added lines contain no em dash. Slice notes were removed after
  transferring their durable decisions, evidence and operating constraints here
  and into the product specs.

The release gate retains steps 1-3's v1 compatibility, full-word topology fuzzing,
issuer trust/lifecycle, HMAC/LEI/privacy, store conflict/audit failure and codecs.
It includes 42 named settlement-binding invariants plus recipe/missing-evidence/
size tests. Identity live cases cover two acceptances, 32 mined rejections, four
settlements, Manifest parameters and privacy. The step 2 fixture's historical gas
measurements are retained in `docs/product-specs/identity-evidence-v2.md`; gas was
not remeasured in step 4.

November P2 slots are documented in `docs/product-specs/identity-p2-schedule.md`
and linked from the roadmap: MEMBER institution/attestation support with wallet
sanctions in both modes; venue pseudonyms/private wallet mapping/same-identity
blocking before TSV launch; issuer/AML-owner/freeze-scope asset cards; and separate
A-01-v2 list bundles with per-list invalidation and mandatory OFAC for TSV.
They remain unimplemented. Team to confirm calendar dates/assignees; no PRs were
opened. No item blocks this P1 release.

Material operating constraints: bilateral A-04-v2 screening remains explicit;
restoring the exact issuer basis can restore unexpired accepted evidence unless
individually revoked; the reference store is in-process. TokenPolicyRegistry is
24,536 bytes with the pinned compiler, leaving only 40 bytes of EIP-170 headroom.
Its deployed-size regression passed; further growth needs explicit size work.

UNVERIFIED: A-04-v2 with a canonical Uniswap pool in live Anvil (named AMM tests
use a callback mock; existing canonical-pool regressions passed); RFQ-host HTTP
with the new recipe (context-provenance HTTP passed separately); production
providers/durable storage, public/external networks and Docker/container runtime.
No external publication, commit, push or branch operation was performed. Next:
user reviews the working tree; P2 proceeds as separate November PR work.

## 2026-11-11 Session: RFQ-006 Nested TTL Review Fix

RFQ-006 is passing. Scope: the confirmed P3 pre-authentication recursive TTL hash in the production
RFQ host. Non-number TTL values now contribute only `null` to the preliminary
audit request hash; the original TTL still reaches validation after authentication
and rate limiting. No product boundary, coordinator or contract behavior changed.

Tests first: six HTTP regressions named `v{2,3} nested TTL preserves authentication
and limiting before {401,429,400} rejection` send 6,000 nested arrays in a body
below 16 KB. Against unchanged production code, all six failed with actual 500;
14 unrelated tests were skipped by the name filter. After the one-line fix,
the host smoke and all 24 named tests passed, including all six regressions.
They assert bounded errors, exact authentication/limiter/incident/audit order,
no quote records and the audit rejection reason.

Commands use Node 20.20.2 and Yarn 1.22.22 through
`npx --yes -p node@20 -p yarn@1.22.22 -c '<command>'`:

- `npm run build --prefix services/rfq-host && node --test --test-name-pattern="nested TTL" services/rfq-host/dist/test/authorization.js`:
  exit 1 before the fix, six failed with 500. Log: `/private/tmp/w155-nested-before.log`.
- `npm test --prefix services/rfq-host`: exit 0, smoke plus 24 named tests.
  Log: `/private/tmp/w155-nested-host.log`.
- `npm test --prefix services/rfq`: exit 0 on the first run, smoke plus 30 named tests.
  Log: `/private/tmp/w155-nested-rfq.log`.
- `scripts/check.sh`: exit 0 on the first run, including 1,100 Foundry tests,
  service and packed-consumer checks and 10 deploy-v3 tests.
  Log: `/private/tmp/w155-nested-check.log`.
- `git diff --check`: exit 0.
- `git diff --exit-code HEAD -- deployments/public services/testnet-rfq-demo deploy/hackathon-monad`:
  exit 0; protected paths unchanged.

Runtime validation uses real loopback HTTP requests on both endpoints. Anvil E2E
was not rerun because this fix only bounds pre-authentication hashing of malformed
TTL; signing, settlement and contracts are unchanged. Prior E2E evidence remains
in the entry below. Next: user reviews the working tree.
No commit, push or external publication was performed.

## 2026-11-11 Session: RFQ-006 Confirmed Review Fixes

RFQ-006 is passing after all requested gates. Scope: confirmed review findings
F1-F3 for issue #155, production host ordering, evidence API replay authority and
terminal retry classification. Out of scope: contracts, public Monad/demo paths,
key management and the known multi-process store creation flake.

- F1: bounded body parsing remains before authentication; authentication/taker
  binding and rate limiting now precede TTL/product authorization. Parent rejection
  auditing, incidents and audit-failure handling remain in place. Both endpoints
  count authentication, limiter, audit, incident, pricing, reservation, risk and
  signer calls for unauthenticated, limited, invalid-TTL and unsupported-product
  requests, with successful and failing audit sinks.
- F2: current catalog policy is compared only after lookup establishes a new
  request. Both evidence APIs validate replay against the persisted request/grant.
  Eight v2/v3 PUBLISHED/RESERVED matrix cases cover policy drift, original quote,
  expiry/grant preservation, conflicts, new-request policy denial and missing grants.
- F3: `TERMINAL_REPLAY` maps expected unsigned signing-failure, expiry and revocation
  retries to the parent's bounded 400 response. Same-key HTTP retries after signer
  failure and after reservation expiry cover both versions; unexpected coordinator
  failure still returns a bounded 500.
- Updated D030, the production policy spec, host README and feature evidence.

Tests first: after correcting test-only TypeScript typing, the focused Node 20
build/regressions ran against unchanged production code: 18 passed, 13 failed.
After the fixes, all 31 focused cases passed. Logs: `/private/tmp/w155-review-*.log`.
Standalone `forge fmt --check` and Node 20 RFQ/host/Toolkit/CLI tests passed on the
first run (smoke plus 30/18/15/5 named tests); no flake retry was needed.

All service/script commands below ran with Node 20.20.2 and Yarn 1.22.22 through
`npx --yes -p node@20 -p yarn@1.22.22 -c '<command>'`; Foundry is 1.7.1.

| Command | Actual result |
| --- | --- |
| `forge fmt --check` | Exit 0. |
| `npm test --prefix services/rfq` | Exit 0; smoke + 30 named tests. |
| `npm test --prefix services/rfq-host` | Exit 0; smoke + 18 named tests. |
| `npm test --prefix services/toolkit` | Exit 0; smoke + 15 named tests. |
| `npm test --prefix services/cli` | Exit 0; smoke + 5 named tests. |
| `scripts/check.sh` | Exit 0, first run; 1,100 Foundry tests, all service/packed-consumer gates and 10 deploy-v3 tests passed. |
| `scripts/e2e-anvil.sh` | Exit 0; BUIDL-like scenario suite and backend/CLI/Router/runtime checks passed. |
| `scripts/e2e-anvil.sh --profile reg-d` | Exit 0; Reg D scenario suite and backend/CLI/Router/runtime checks passed. |
| `scripts/e2e-context-provenance.sh` | Exit 0; 12 passed, 0 failed. |
| `git diff --check` | Exit 0. |
| `git diff --exit-code HEAD -- deployments/public services/testnet-rfq-demo deploy/hackathon-monad` | Exit 0; protected paths unchanged. |
| Python added-character check | Exit 0; no added em dash characters. |

This entry supersedes the original delivery's ordering claims below. All requested
checks passed without reruns. UNVERIFIED: Docker/container execution and public or
production integrations, outside this fix scope. Next: user reviews the working
tree. No commit, push or external publication was performed.

## 2026-11-11 Session: RFQ-006 Issue #155 Delivery

RFQ-006 is passing. Scope: production RFQ coordinator/host v2/v3 authorization,
lifetime validation, persistence/replay and failure taxonomy. Out of scope:
contracts, recipes, key management/custody, pricing strategy, public deployment
and the pre-existing multi-process store creation race. HACK-001 closure is in
approved upstream PR #162; this work allocates only RFQ-006 and D030.

- Wrote `PLAN_155.md` before tests/implementation, then removed it after delivery;
  the final handoff includes its contents. D030 records the implemented decision.
- Added a bounded local catalog binding maker, ordered pair, venue, policy,
  version capability and flow. Both host endpoints require explicit catalogs.
  TTL and product rejection precede authentication, limiter, readiness, store,
  policy, pricing, risk, context and signer calls. Live resolved policy must match
  the catalog before pricing a new request.
- Default TTL/max are 60/300 seconds, tunable through bootstrap coordinator
  configuration with positive safe integers and default <= max <= 3600. Invalid
  config fails construction/startup, invalid TTL fails before dependencies.
- Persist schema-1 `productAuthorization` alongside existing record schemas 1/2,
  request hash, nonce and lease. Host replay/conflicts use original authorization
  and policy without resolver/pricing/risk recalls or replacement signatures;
  RESERVED recovery keeps original expiry and freshness/context revalidation.
- Added bounded typed 400 invalid-request, 403 product-denial, 500 configuration
  and 503 dependency codes, preserving existing conflict/risk/signer/audit codes.
  Known resolver denials/config errors stay terminal; untyped provider exceptions
  remain retryable. Diagnostic reason/module labels redact provider messages.
- Added 9 coordinator and 6 host named tests for invalid/boundary TTL, unsupported
  products and versions/flows, zero dependency calls, restart/policy drift,
  conflicts, concurrent retry, RESERVED recovery, altered/missing stored grants,
  configuration validation and dependency/taxonomy redaction on both endpoints.
- Updated production fixtures with explicit catalog grants, local context E2E
  with explicit 600s default/max and both directions/versions, and the container
  readiness smoke double with the required coordinator methods. Deployed contracts,
  existing quote types/success responses and protected Monad paths are unchanged.

### Verification Commands and Actual Results

Foundry 1.7.1 and Node 20.20.2. Logs are local `/private/tmp/w155-*.log`, outside
the working tree. Service test commands ran inside the Node 20/Yarn wrapper below.

| Command | Actual result |
| --- | --- |
| `forge fmt --check` | Exit 0. No Solidity edits. |
| `forge test --offline` | Exit 0; 1,100 passed, 66 suites, 0 failed/skipped. |
| `npm test --prefix services/rfq` | Final exit 0; smoke plus 22 named tests passed. |
| `npm test --prefix services/rfq-host` | Final exit 0; smoke plus 10 named tests passed. |
| `npm test --prefix services/toolkit` | Exit 0; smoke plus 15 named tests passed. |
| `npm test --prefix services/cli` | Exit 0; smoke plus 5 named tests passed. |
| `npx --yes -p node@20 -p yarn@1.22.22 -c 'scripts/check.sh'` | Exit 0 on first full run; all format/lint/build/Foundry/service/packed-consumer/vendor/whitespace gates passed. Vendored deploy-v3: 10 passed. |
| `npx --yes -p node@20 -c 'scripts/e2e-anvil.sh'` | Exit 0; BUIDL-like 7-scenario suite and backend/CLI/Router/runtime checks passed. |
| `npx --yes -p node@20 -c 'scripts/e2e-anvil.sh --profile reg-d'` | Exit 0; Reg D 7-scenario suite and backend/CLI/Router/runtime checks passed. |
| `npx --yes -p node@20 -c 'scripts/e2e-context-provenance.sh'` | Exit 0; 12 passed, including 10 mined rejections with unchanged balances/nonces and 2 exact-fill settlements. |
| `git diff --check` | Exit 0. |
| `git diff --exit-code HEAD -- deployments/public services/testnet-rfq-demo deploy/hackathon-monad` | Exit 0; protected paths unchanged. |
| `bash -n scripts/production-container-smoke.sh` | Exit 0. |
| `npx --yes -p node@20 -c 'node --check scripts/e2e-context-provenance.mjs'` | Exit 0. |
| Extracted container bootstrap + Node 20 `startProductionRFQRuntime()` harness | Exit 0; HTTP health/ready 200 and graceful shutdown passed with the exact updated smoke fixture. |
| Python local-doc-link and added-character checks | Exit 0; 5 local links valid, no added em dash characters. |

The exact standalone service invocation was:

```sh
npx --yes -p node@20 -p yarn@1.22.22 -c 'for service in rfq rfq-host toolkit cli; do npm test --prefix "services/$service" > "/private/tmp/w155-final-$service.log" 2>&1; check_status=$?; echo "$service exit $check_status"; tail -12 "/private/tmp/w155-final-$service.log"; if [ "$check_status" -ne 0 ]; then exit "$check_status"; fi; done'
```

Tests-first evidence: the initial RFQ build failed on missing API/types, and
`npx --yes -p node@20 -c 'node --test services/rfq/dist/test/authorization.js'`
then ran the emitted regressions against baseline code: 0 passed, 6 failed. The
initial host build failed on the missing product/configuration error codes.
During implementation, a focused run exposed a missing-grant hashing bug (5/6
passed), which was fixed. One intermediate `npm test --prefix services/rfq`
run hit the known `multi-process initial store creation is race-safe` flake with
`Unexpected end of JSON input` (`w155-rfq-test-2.log`). The single requested retry
passed that race check but exposed a fresh RESERVED test fixture missing its new
grant (`w155-rfq-test-2-retry.log`). Adding that explicit fixture grant fixed the
migration. The next service run passed all then-current 19 named tests, and the
final standalone/full-gate runs passed all 22. The store creation implementation
was not changed. No full-gate rerun was needed.

### Limits and Next Work

- UNVERIFIED: Docker image/container execution and public/production deployment
  were not run. The changed container fixture was syntax-checked and exercised
  through the real local runtime; no image/release change was made.
- Production operator catalog approval, HA store, live pricing/risk/auth/provider
  integrations and WORM retention remain operator boundaries. Production evidence
  callers must add explicit catalogs; records without historical grants must be
  drained/expired and isolated under a fresh request namespace/store, never
  automatically backfilled. Current tuple support/TTL caps still gate retries.
- Next: user reviews the working tree. No commit, push, GitHub comment, public
  broadcast or publication was performed.

## 2026-11-11 Session: EXEC-002 Confirmed Review Fixes

Scope: F1 recipient MM-claim selection and F2 reverse Engine/Router activation
binding. Existing B-04-v1, its tests, default recipes and public Monad v2 paths
are unchanged. EXEC-002 remains passing after the checks below.

- F1: added opt-in immutable `EngineSelectionV2` (`B-04-v2`) using `AssetFlow`
  for each security recipient. V3 integration/live fixtures register and bind
  it explicitly. RouterV2 regressions cover both asymmetric affiliate sells and
  buy parity with v1; unit coverage adds 256-run buy parity fuzzing, exemptions
  and fail-closed context. Schema 6 scans every active compiled binding and
  rejects B-04-v1 or unavailable/malformed reads, allowing policies without B-04.
- F2: activation now requires `ComplianceEngine.router() == executionRouter`,
  including unreadable-read rejection with all other bindings correct. REGISTER
  plans add unsigned Engine wiring before adapter wiring. D028 and the product
  spec require a separate v3 Engine because its Router authorization is single;
  UPDATE continues to verify existing bindings without rebinding.
- Tests first: with the original B-04, the two asymmetric sell regressions
  failed and the other 11 integration tests passed. The initial Toolkit run
  exposed all five new activation/wiring gaps (9 passed, 5 failed). Final
  passing runs include the fixes and additional compiled-policy coverage.

| Command | Actual result |
| --- | --- |
| `forge fmt --check` | Exit 0. Changed Solidity files were formatted with targeted `forge fmt` first. |
| `forge build` | Exit 0; compiler/lint warnings remain. |
| `forge test --offline` | Exit 0; 1,100 passed across 66 suites, 0 failed, 0 skipped. |
| `npx --yes -p node@20 -p yarn@1.22.22 -c 'npm test --prefix services/toolkit'` | Exit 0; smoke gate and 15 provenance tests passed, 0 failed. |
| `npx --yes -p node@20 -c 'scripts/e2e-context-provenance.sh'` | Exit 0; 12 passed: 10 mined rejections with unchanged balances/nonces and 2 affiliate settlements with recipient MM claims only. |
| `git diff --check` | Exit 0. Protected-path diff against origin/main and legacy B-04/tests/recipe diff checks also exited 0. |

Logs are local `/private/tmp/w157-fixes-*.log` files. UNVERIFIED in this fix
session: the broader `scripts/check.sh`, legacy Anvil profiles and public or
production activation were not rerun. Prior delivery evidence below is historical.
Next: review these working-tree fixes and run the documented activation checks
for each separately deployed v3 stack and onboarded security. No commit, push,
publication or GitHub comment was performed.

## 2026-11-11 Session: EXEC-002 Delivery and Full Verification

EXEC-002 (issue #157) is passing after all four approved implementation slices
and the delivery gates below. This session changed only delivery fixtures,
documentation and tracking. Earlier slices are commits `31efdb1`, `a3d9d21` and
`64f4326`; their implementation is verified by this session's full gate, rather
than relying only on the slice notes. HACK-001 and other feature entries are
preserved: upstream #162 owns HACK-001 completion and #161 owns
CORE-015/D024-D027. This session allocates only EXEC-002 and D028/D029.

### Scope and Delivered Behavior

- Added an isolated loopback chain-31337 deployment fixture with real
  ERC-3643/ONCHAINID and a minimal B-02-v2 live-wiring recipe, mock cash/pricing
  and reference local host/auth/store/audit adapters. It deploys separate
  RouterV2/RFQAdapterV3 and never replaces the legacy deployment artifact.
- The v3 HTTP host/coordinator uses the on-chain context resolver, signs current
  actual-sender evidence and settles both directions. Eight mismatches produce
  exact-error static rejections plus mined status-0 receipts with unchanged
  balances and Router/quote nonces. Fresh quotes after evidence refresh settle
  exact token deltas with nonce consumption and zero custody balances.
- Published the ownership matrix, authentication order, exact ordered RFQ v3
  type/domain/encoding, A-06 leg/aggregate commitments, immutable approval and
  final post-configuration evidence rules. Added compatibility and migration for
  SDK exports/modules, coordinator schema 2, opt-in host capability/route, CLI
  artifacts and onboarding schema 6, preserving explicit legacy parsers.
- Added the EXEC-002 execution plan and D028/D029. The six adopted defaults
  remain open for team confirmation: conditional primary, matching statuses for
  dual-regulated pairs, mandatory A-06 on every regulated leg, immediate
  evidence-change invalidation, immutable-only activation and opt-in migration
  timing. A-06 remains operator-attested. Reference/operator signing uses one
  local env/file key; key management, multisig and custody expansion are deferred.
- Existing recipes/events/API defaults and public Monad RFQ v2 are preserved.
  All three live Anvil scripts remain documented manual delivery/release gates,
  matching the current CI boundary. No extra live deployment is added to CI.

### Verification Commands and Actual Results

Foundry 1.7.1, solc 0.8.17 and Node 20.20.2. Full command output was captured in
local `/private/tmp/w157-*.log` files, outside the working tree.

| Exact command | Actual result |
| --- | --- |
| `npx --yes -p node@20 -p yarn@1.22.22 -c 'scripts/check.sh'` | Exit 0 on first full run. Forge: 1,090 passed across 65 suites, 0 failed, 0 skipped. RFQ/host/Toolkit/CLI provenance: 13/4/9/5 passed (31 total), 0 failed. Packed consumers: 6 v3/schema 6 assertions and 8 generated adapter Forge tests passed. Vendored deploy-v3: 10 passed. All remaining legacy service/smoke gates passed; they do not report assertion counts. |
| `npx --yes -p node@20 -c 'scripts/e2e-anvil.sh'` | Exit 0; BUIDL-like 7/7 scenarios plus 30 additional printed PASS checks. Existing v2 backend/CLI/Router flow passed. |
| `npx --yes -p node@20 -c 'scripts/e2e-anvil.sh --profile reg-d'` | Exit 0; Reg D 7/7 scenarios plus 20 additional printed PASS checks. Existing v2 backend/CLI/Router flow passed. |
| `npx --yes -p node@20 -c 'scripts/e2e-context-provenance.sh'` | Final exit 0; 10/10 live cases passed: 8 mined mismatch rejections and 2 bidirectional exact-fill settlements. |
| `forge fmt script/ContextProvenanceFixture.s.sol` | Exit 0; only the new fixture formatted. |
| `forge fmt --check` | Exit 0. |
| `git diff --check` | Exit 0. |
| `bash -n scripts/e2e-context-provenance.sh` | Exit 0. |
| `npx --yes -p node@20 -c 'node --check scripts/e2e-context-provenance.mjs'` | Exit 0. |
| `git diff --exit-code origin/main -- deployments/public services/testnet-rfq-demo deploy/hackathon-monad` | Exit 0; all three protected paths unchanged across this branch. |

The first new-E2E attempt failed compiling the fixture with stack-too-deep;
moving deployment references into fixture storage fixed it. The next failed
before any E2E case because the request fixture omitted `amountOutMin`; adding
the explicit exact-output minimum fixed it. A subsequent burst broadcast stalled
with one pending Anvil transaction and was interrupted (exit 130); sequential
`--slow` broadcast completed and all 10 cases passed. These were fixture/runner
issues; no product source or existing tests were changed in this session.
The known RFQ multi-process initial-store race did not occur in the full gate,
so no full-check rerun or flake fix was needed.
Final read-only Python validation resolved all 51 local Markdown links in changed
documents, found no added em dash characters and confirmed slice-note removal.
`lsof` found no listeners remaining on E2E ports 8545, 8547 or 8787.

### Limits and Next Work

- UNVERIFIED: public/production v3 deployment, production infrastructure and
  Docker container smoke gates were not run in this session. No public
  broadcast, package publication, commit, push or GitHub comment was performed.
- The local fixture proves protocol delivery with reference dependencies. It
  does not validate a production TA provider, custom resolver, HA store, pricing
  quality, proxy activation or non-Router enforcement.
- Next: team confirms the six defaults, upstream #161/#162 merge, then any
  explicitly authorized migration follows schema 6/post-state verification and
  the documented manual delivery gates. Existing Monad traffic stays on v2.
- `SLICE_NOTES.md` is removed after consolidating its intended product/tracking
  text here and in FEATURES/D028/D029. No temporary debug files are added.

## Current Status

저장소는 SDK/reference DEX 아키텍처·개발 계획 문서, Foundry product scaffold,
reference execution contracts와 vendored Uniswap v3 배포 도구를 포함한다.

공식 문서는 DEX-level compliance SDK, Corner Store reference DEX,
Element/Recipe/Manifest/Operator 4-Layer와 mode-aware `RecipeBinding[]` 모델을
source of truth로 사용한다.

## Current Feature

`RFQ-006: Bounded Lifetime and Pre-Pricing Product Authorization` (issue #155).
RFQ-006 is passing after all requested gates. HACK-001 closure is in approved
upstream PR #162; the historical HACK-001 notes below are retained.

### Upstream HACK-001 history

`HACK-001 — Monad Onchain Finance RFQ Demo` (issue #145)

- `hackathon/monad-onchain-finance`를 최신 `origin/main`의 별도 worktree에서
  시작했다. 기존 root checkout과 미추적 개인 파일은 변경하지 않았다.
- public-testnet browser runtime의 pre-check 결과에 차단 사유, 사용자/운영자
  조치와 근거 있는 해제·증거 만료 시각을 반환하는 explanation 경계를 추가했다.
  C-01-v2 보유기간은 acquisition snapshot과 immutable lockupSeconds로 실제
  availability를 계산하며, QP claim expiry는 자동 해제가 아니라 재발급이 필요함을
  구분한다.
- Monad 전용 opt-in fixture가 investor B의 취득 시계를 배포 시점에서 시작해
  Sell 보유기간 거부 장면을 재현한다. 화면에는 success/qualification/holding-period
  심사 시나리오와 공개 주소만 표시하며, 지갑 비밀값은 별도 전달한다. 실제 임시
  Anvil 배포와 HTTP pre-check에서 `HOLDING_PERIOD_NOT_ELAPSED`의 onchain unlock
  time 및 `FAIL_NOT_QP`를 확인했다.
- 성공 체결 후 deployment/source commit, chain, 공개 주소·금액, transaction/block와
  submission-to-confirmation 시간을 묶은 PII/secret-free JSON 증거를 브라우저에서
  다운로드할 수 있다. 실제 Monad 수치는 public-chain 체결 후 채운다.
- Monad 배포에서는 정책 profile을 fork하지 않고 ERC-3643 token 표시 이름만
  `Demo Restricted Security (DRS)`로 주입할 수 있다. 기본값은 기존 BUIDL-like 이름을
  유지하므로 기존 testnet 입력에는 영향이 없다.
- 선택형 expired-claim 지갑은 다른 투자자의 QP freshness cap을 바꾸지 않고
  366일 전 mock 증빙을 받아 네 번째 거부 장면을 만든다. 임시 Anvil 실제 배포와
  HTTP API에서 `Demo Restricted Security (DRS)` 표시, 활성화된 네 번째 scenario와
  `FAIL_QP_CLAIM_EXPIRED`/과거 expiry 근거를 함께 확인했다. read-only deployment
  verifier도 선택형 지갑의 identity, inventory와 정확한 QP expiry reason을
  fail-closed 검증한다.
- judge-facing terminology는 내부 정책 vocabulary를 우선한다. `Compliance`,
  `Venue`, `Qualified Purchaser`는 각각 기술 평가 단계, execution layer와 실제
  A-13 rule 이름으로 유지하되 reference/demo 경계와 비법률판정 면책을 함께
  표시한다. 공개 자산명은 실상품 연상을 피하도록 `Demo Restricted Security
  (DRS)`로 통일했고, 사용자 조치와 test operator 조치를 구분했다.
- 외부 judge URL용으로 non-root/read-only OCI target, read-only artifact mount,
  Docker secret Maker key, `/health`, 16 KiB body limit, quote rate limit과 browser
  security headers를 추가했다. 로컬 Docker daemon은 실행 중이 아니지만 GitHub CI
  builder에서 clean-context image build와 final runtime module load가 통과했다.
- public broadcast는 dirty checkout과 잘못된 source commit override를 거절하고,
  transaction metadata를 포함한 candidate artifact를 read-only 검증한 뒤에만
  append-only final record를 원자적으로 발행한다. Node runtime도 listen 전에
  owner/operator, Engine/Registry/Router/RFQ wiring, token/Identity Registry와 wallet별
  ONCHAINID binding, venue, maker, participant inventory와 선택형 expired fixture를
  chain에서 다시 대조한다.
- `/health`와 모든 `/api/*` chain read에는 proxy topology와 무관한 global request
  budget, quote에는 더 낮은 별도 budget을 적용하고 request/header/keep-alive timeout을
  제한했다. API 내부 오류는 allowlist된 입력 오류 외에는 공개하지 않으며 quote TTL은
  운영자가 설정한 최대값을 넘길 수 없다. 보유기간 countdown은 browser 시간이 아닌
  관측 chain timestamp를 사용하며, acquisition timing evidence를 읽지 못하면
  "표시된 시간"을 가정하지 않고 재조회/operator 확인으로 fail closed한다.
- API validation 실패는 안전한 입력 메시지와 함께 400으로, RPC/runtime dependency
  실패는 원문을 숨긴 503, 분류되지 않은 내부 오류는 500으로 분리한다. server failure는
  raw error·URL·address 없이 method와 normalized surface만 포함한 operator event를
  남겨 공개 정보 노출 없이 장애와 사용자 오류를 구분한다.
- judge quick start에서 공개 Monad metadata를 이용해 wallet network를 추가·전환할 수
  있다. account 또는 chain이 바뀌면 이전 account의 pre-check, quote와 signer 상태를
  폐기하고 새 지갑을 다시 동기화하므로 여러 fixture 장면 사이에 상태가 섞이지 않는다.
- `scripts/rehearse-monad-judge-url.mjs`는 배포 후 공개 URL을 읽기 전용으로 검사한다.
  public HTTPS/same-origin/security header, chain 10143, startup attestation,
  Maker·Manifest·inventory readiness와 필수 세 장면을 확인하고, 선택형 claim-expiry
  장면은 별도로 보고한다. 브라우저에서 내려받은 settlement evidence를 주면 live
  deployment/source/contracts/participant/token과 transaction block·측정 시간을 함께
  대조하므로 잘못된 URL이나 다른 배포의 증거를 제출 전에 거절한다.
- public-testnet fixture의 기존 participant에 한정된 evidence refresh 도구를 추가했다.
  QP는 `qualified` 또는 `clear`, acquisition은 기존 `VALID` 또는
  `LINEAGE_BROKEN` 의미와 모든 timestamp/sourceRef를 명시해야 한다. 기본은 dry-run이며,
  broadcast는 artifact operator와 일치하는 외부 Foundry signer를 요구하고 순차 제출 뒤
  별도 read-only verifier로 정확한 claim/snapshot을 확인한다. artifact, identity,
  inventory, approval과 policy는 변경하지 않는다.
- 임시 Anvil 실제 배포에서 Solidity verifier와 Node startup attestation을 통과했고,
  wiring을 바꾼 artifact는 listen 전에 거절되며 `/health`·API 공통 budget이 429를
  반환함을 확인했다. pinned Foundry 1.7.1 전체 `scripts/check.sh`도 Foundry 960/960,
  모든 service/clean-project/deploy-v3 검사와 함께 통과했다.
- 로컬 Docker daemon이 꺼진 환경에서도 image build 회귀를 놓치지 않도록 CI에
  `scripts/hackathon-monad-container-smoke.sh`를 추가했다. pinned image build 뒤
  network-off/read-only/non-root 조건에서 packaged demo/RFQ runtime을 실제 load하고,
  healthcheck와 Compose의 read-only filesystem, capability drop, loopback port,
  artifact/secret mount 및 API budget 계약을 검증한다.
- CLI reason catalog가 C-01-v2의 missing/broken/stale/not-matured 코드를 정확히
  해석하도록 갱신했다. testnet panel이 사용하는 stable reason subset과 CLI decoder의
  이름 parity도 `scripts/check.sh`에서 검증한다. targeted testnet-demo/CLI smoke, 임시 Anvil 실제 배포와
  HTTP explanation/display/expiry E2E, pinned Foundry 1.7.1 전체 `scripts/check.sh`(Foundry
  960/960 포함), Compose config와 `git diff --check`가 통과했다. 시스템 PATH의
  Foundry 1.4.0 nightly는 기존 main 파일 포맷을 다르게 판정하므로 전체 검증에는
  저장소 기준 1.7.1을 사용했다.
- Monad 공식 public RPC `https://testnet-rpc.monad.xyz`가 chain ID 10143과 현재
  block을 반환하는 것을 새 preflight script로 확인했다. 기존 비공개 `.env.testnet`은
  다른 testnet chain 설정이므로 수정하지 않았지만, 포함된 공개 actor 주소의 Monad
  형식·중복·deployer gas balance는 읽기 전용 preflight를 통과했다. 실제 broadcast는
  로컬 keystore unlock과 Monad 전용 deployment id/config가, HTTPS hosting은 target이
  준비되는 즉시 진행한다.
- 2026-10-08 Monad testnet deployment `monad-onchain-finance-rfq-v1` from source commit
  `e7345b3`: 128/128 transactions with status 1 for 9.29 MON. Token
  `Demo Restricted Security (DRS)`, quote `Testnet Quote USD (tqUSD)`, Router
  `0xc7dA74CB5c924152255f20510411de44f852c271`, RFQ adapter
  `0x7065C17fD83e3b3aBdBd243E689e976Fc3104b66`. The maker and investors A, B and
  ineligible approved the RFQ adapter. Against the local runtime on loopback, the rehearsal
  gate reported ready with the claim-expiry scene enabled, and 5,000,000 DRS pre-checks
  returned allowed, `FAIL_NOT_QP`, `HOLDING_PERIOD_NOT_ELAPSED` (unlock 2027-10-08) and
  `FAIL_QP_CLAIM_EXPIRED`. Investor A settled one 5,000,000 tqUSD → DRS Router RFQ trade
  with a headless signer (tx
  `0xa28dc68c3d02dfe411c6ba3d6d915705cbe88df4564a79fe9422fc7f914073f0`, block 69205198):
  pre-check 329 ms, quote 524 ms, submit 418 ms, submit to receipt 4.3 s with ethers
  default receipt polling.
  검증: `scripts/preflight-monad-hackathon.sh --deployment-ready`; broadcast with the
  built-in `VerifyTestnetRFQ`; `VerifyTestnetRFQ` with `CORNER_STORE_REQUIRE_APPROVALS=true`;
  `node scripts/rehearse-monad-judge-url.mjs --url http://127.0.0.1:8791`.

## Completed

- `EXEC-001 — Canonical Settlement Amount Binding` (issue #153): Router가 adapter
  호출 전후 authenticated buyer의 `tokenIn`/`tokenOut` 잔액 차이로 실제 정산량을
  직접 측정한다. 현재 execution version은 exact full fill만 허용하며 measured
  input/output, 사전 평가된 context 수량과 adapter 보고 output이 모두 일치해야
  stateful commit한다. 불일치 시 token 이동, nonce, adapter와 compliance 상태가
  원자적으로 rollback된다. 기존 execution ID 형식은 유지하고 canonical Uniswap
  test는 snapshot quote로 exact request를 구성한다. 체결 후 전체 Element를
  다시 평가하면 pre-transfer balance를 읽는 Element 의미가 깨질 수 있어 사용하지
  않았다. fee-on-transfer/rebasing token은 onboarding에서 금지하며 partial fill,
  price-tolerant AMM과 venue-authoritative seller/flow/affiliate provenance는 별도
  versioned 후속 범위다. 검증: Router 30/30, RFQAdapter 25/25, RFQFlow 9/9,
  SwapFlow 8/8, canonical
  Uniswap 5/5와 전체 Foundry 975/975 통과. pinned Foundry v1.7.1 전체
  `scripts/check.sh`, packed clean-project adapter conformance, `buidl-like`와
  `reg-d` Anvil E2E(각 7/7 + backend/CLI/Router RFQ flow), `git diff --check` 통과.

- `DATA-003: Isolated Demo and Production TA/KYC Provider Adapters` (issue #128):
  `services/compliance-data` now defines KYC provider SPI 1.0.0 (`/spi`) with adapter metadata
  (SPI version, providerId, schema versions, fact capabilities, environment) and typed
  `KycProviderError` codes. `KycEvidenceCoordinator` requires `mode`, snapshots validated
  metadata at construction, refuses other SPI majors/newer minors and, in production mode, any
  adapter not declared `production`. Undeclared providerId/schema/optional facts fail closed as
  `PROVIDER_INCOMPATIBLE`; timeouts are `PROVIDER_TIMEOUT`. The deterministic demo adapter is
  reachable only through `/demo`; `/conformance` runs the same suite against the demo adapter and
  a production-style HTTP example. Evidence hash domain and store semantics are unchanged.
  검증: `npm test --prefix services/compliance-data` pass (local and Node 20.20.2);
  `scripts/check.sh` pass under Node 20 with yarn 1.22.22 after rebasing onto `a5199b8`
  (Foundry 956/956, all service smokes, deploy-v3 10/10); `scripts/e2e-anvil.sh` buidl-like 7/7
  plus RFQ/backend/CLI flow passed on the pre-rebase base and is pending re-run on this base;
  `git diff --check` pass. Independent Codex and Opus reviews found no
  blocking issue; two pre-existing coordinator gaps they reported (hostile request getters,
  store-return re-read) are fixed in a separate PR.

- `AMM-002 — Self-Directed Actor Consistency`: 현재 AMM 모델에서 initiator, payer와
  output recipient가 하나의 authenticated buyer로 일치하도록 adapter 경계를
  명확히 했다. 불일치 context는 pool 실행 전에 거부하고, 위임 실행은
  principal/actor/asset/action/amount/expiry를 검증하는 별도 versioned component
  전까지 지원하지 않는다. unit test와 real Router/ERC-3643 integration test가 actor
  consistency와 balance 불변성을 고정한다. 검증: targeted AMM
  unit 9/9, SwapFlow integration 8/8, stable Foundry 전체 956/956 및
  `scripts/check.sh`, `git diff --check` 통과.

- `SDK-007 — External User Golden Path Acceptance`: issue #117의 외부 사용자 기준을
  packed clean-project acceptance로 고정했다. 목적별 생성 프로젝트는 공통
  validate/simulate/doctor/deploy/verify 계약을 제공하고, direct Compose sandbox는
  create→cd→up 세 명령으로 host npm/Foundry 없이 시작한다. Doctor는 project
  descriptor를 fail-closed 검증하고 sandbox에서 Compose v2와 daemon만 필수로,
  library path에서는 Docker를 선택 사항으로 진단한다. stale/wrong-profile
  reference artifact는 remediation 후 같은 verify로 복구되며, venue 정책 값 변경은
  compiled commitment와 allow/reject 설명을 함께 변경한다. Production verifier는
  chain/address/runtime code-hash mismatch에 remediation을 반환한다. 검증: Toolkit·CLI
  smoke, packed clean-project sandbox/DEX acceptance, full Foundry 954/954, 전체
  `scripts/check.sh`, deploy-v3 10/10, `git diff --check` 통과.

- `CORE-014 — C-01 Venue Compatibility Guard`: issue #132의 후속 합의대로
  `AMM + C-01-*`를 warning이 아닌 공통 hard rejection으로 구현했다. Toolkit profile,
  CLI onboarding, production onboarding/Safe export와 `ComplianceEngine`이 같은
  family-level 규칙을 적용하고, bundled `buidl-like`/`reg-d` demo는 RFQ-only로
  실행한다. AMM adapter coverage는 C-01을 제외한 명시적 demo-only Recipe로
  분리해 Reg D/BUIDL 정책으로 오인되지 않게 했다. 검증: Engine 48/48, affected
  integration 44/44, Toolkit/CLI smoke, BUIDL-like/Reg-D full Anvil E2E 각각 7/7와
  RFQ buy/sell, full Foundry 954/954, 전체 `scripts/check.sh`, canonical Uniswap v3
  5/5, deploy-v3 10/10, clean SDK consumer와 `git diff --check` 통과.
  PR #140 후속 리뷰를 반영해 venue incompatibility를 normal Recipe composition보다
  먼저 처리하고 모든 지원 binding mode에서 동일한 결과를 보장한다.
  Factory는 token의 primary venue를 기록하고 두 Manifest update overload가 pending
  compiled plan을 검사한 뒤 호환되지 않는 update를 같은 transaction에서 되돌린다.
  후속 검증: Engine 50/50, Factory 16/16, Registry 56/56, full Foundry 960/960,
  pinned Foundry 1.7.1 `scripts/check.sh`와 `git diff --check` 통과.

- `DEPLOY-002 — Production Service Container Contract`: issue #115 범위로 demo
  sandbox와 분리된 pinned multi-stage RFQ host/Operator API OCI target을 추가했다.
  RFQ production entrypoint는 versioned bootstrap을 통해 durable coordinator,
  production authentication, shared limiter, fresh pricing/risk, external signer,
  live policy resolver, strict WORM audit와 incident monitoring을 전부 주입받아야
  하며, readiness가 unavailable/stale이면 policy lookup과 signing 전에 quote를
  fail-closed한다. Operator API는 mounted token과 immutable JSON evidence만 읽고,
  변경/누락/손상 시 readiness를 내린다. 두 image는 non-root/read-only, dropped
  capabilities, bounded resource/timeout와 SIGTERM shutdown contract를 가지며
  secret/error text를 로그에 남기지 않는다. 검증: service runtime smoke,
   production OCI build/read-only runtime/auth/readiness/graceful shutdown smoke,
   Compose config, full `scripts/check.sh`(Foundry 950/950), BUIDL-like RFQ E2E,
   `git diff --check` 통과.

- `SDK-006 — Reference DEX Sandbox`: issue #114를 구현해 packed CLI의
  `create --template sandbox`가 repository checkout 없이 Anvil, one-shot deployment,
  artifact-bound RFQ backend, read-only Operator API/dashboard와 Deployment Studio를
  포함하는 self-contained Compose project를 생성한다. pinned Node/Foundry multi-stage
  image와 non-root runtime을 사용하고, health/dependency gate로 현재 chain deployment가
  성공하기 전에는 service가 시작되지 않는다. 기본 BUIDL-like와 opt-in Reg D fixture는
  동일 이미지와 실행 계약을 공유하며 external provider/production credential은 포함하지
  않는다. 검증: packed clean-project 생성·build·conformance, BUIDL-like/Reg D live
  Docker deployment와 6-service health/artifact binding, Toolkit·CLI·Deployment Studio
  smoke, full Foundry 950/950, 전체 `scripts/check.sh`, deploy-v3 10/10,
  `git diff --check` 통과.

- `SDK-005 — External DEX Adapter Starter and Conformance`: 이슈 #116을 구현해
  `dex-integration` template이 Router-only Solidity Adapter, TypeScript request
  builder, versioned venue descriptor와 실제 ExecutionRouter conformance를 생성한다.
  허용 거래는 venue 실행 뒤 commit되고, compliance 거절은 venue에 도달하지 않으며,
  direct Adapter 호출과 venue 실패 시 nonce/commit 상태가 원자적으로 되돌아간다.
  특정 venue settlement와 token/callback/slippage 보장은 integrator 책임으로 남겼다.
  검증: generated external project Adapter 4/4, clean package smoke, full Foundry
  950/950, 전체 `scripts/check.sh`, deploy-v3 10/10, `git diff --check` 통과.

- `SDK-004 — Purpose-driven SDK Entry Point`: 이슈 #113의 사용자 목적 중심 진입점을
  구현했다. `create --template`이 sandbox, dex-integration, asset-onboarding,
  rfq-service를 versioned project descriptor로 고정하고 기존 `--mode`는 compatibility
  alias로 유지한다. `connectCornerStore()`는 하나의 immutable config/artifact에서
  `policy.validate/compile/simulate/explain/verify`를 제공하며 값 우선 설명과
  expected/actual/remediation 검증을 반환한다. source checkout은 CLI와 Toolkit
  tarball을 함께 vendor하고 packed external project도 repository-relative import 없이
  install/build/conformance/policy explain/doctor/deploy dry-run을 통과한다. 검증:
  Toolkit·CLI smoke, clean SDK product smoke, full Foundry 950/950, 전체
  `scripts/check.sh`, deploy-v3 10/10, `git diff --check` 통과. #114 full Compose
  sandbox와 #116 VenueAdapter starter는 의도적으로 후속 범위에 남겼다.

- `CORE-013 — RWA Flow Direction and Surveillance Authorization`: issue #132의
  즉시 수정 항목 1·2·10을 immutable replacement로 해결했다. `AssetFlow`가 RWA
  tokenOut buy를 seller→buyer, tokenIn sell을 buyer→seller로 해석하고,
  `C-01-v2`는 실제 sender의 취득 증빙을, `B-02-v2`는 같은 방향의 잔액·recipient
  identity·`canTransfer`를 검증한다. `F-02-v2` threshold는 owner/operator만
  변경한다. Reg D recipe family 1 version 3과 reference/demo/testnet/CLI를 새
  exact binding으로 이전하고 v1 계약/reason decode는 보존했다. 후속 합의에 따라
  1차 발행은 `PRIMARY_DISTRIBUTION` 표지만 신뢰하지 않고 Manifest-bound 실제
  distributor까지 일치할 때만 C-01을 생략한다. reference/demo/public-testnet은
  실제 Identity Registry·Modular Compliance·token code hash를 B-02에 봉인하며,
  integration test가 배선 변경과 미검증 recipient를 adapter 실행 전에 거절함을
  증명한다. 검증: LockupV2 9/9, Engine 45/45, Swap 7/7, RFQ 9/9,
  canonical Uniswap v3 5/5, full Foundry 950/950, CLI smoke, 전체 `scripts/check.sh`, clean SDK consumer,
  deploy-v3 10/10, BUIDL-like/Reg-D E2E 각 7/7 및 dashboard/CLI/RFQ buy/sell,
  `git diff --check` 통과. #132의 나머지 finding/question은 별도 후속 범위로 남는다.

- `PROFILE-002 — Generic-parameter BUIDL-like Demo Migration`: 신규 BUIDL-like
  deployment에서 legacy `BUIDL-MIN-v1`과 recipe family 3 version 1 wiring을
  제거하고 asset-independent `MIN-AMOUNT-v1`, 같은 의미의 immutable recipe
  version 2와 binding별 `ManifestPolicyConfig`로 이전했다. 5,000,000-token 값은
  `demoPolicyConfig()`에만 존재하는 local behavior lock이며 production default가
  아니다. Factory/CLI/testnet onboarding은 config-aware path를 사용하고 Reg-D의
  parameterless path는 유지한다. 검증: targeted 23/23, full Foundry 906/906,
  전체 `scripts/check.sh`, clean SDK consumer, BUIDL-like/Reg-D E2E 각각 7/7 및
  dashboard/CLI/RFQ flow, `git diff --check` 통과.

- `TOOLKIT-003 — Parameter-aware Production Safe Export`: schema v5가 Element
  parameter capability와 bounded `ManifestPolicyConfig`를 검증하고, exact parameter
  bytes와 compiled-plan commitment가 audit artifact에 일치할 때만 REGISTER 또는
  delayed UPDATE용 unsigned Safe/operator plan을 생성한다. UPDATE는 owner schedule,
  timelock 이후 activation, permissionless checkpoint를 분리하며 pending/live 상태,
  policy version/status, runtime code hash와 compiled parameters를 fail-closed 검증한다.
  최대 256 entries·16,384 raw parameter bytes의 exact calldata는 100,292 bytes,
  calldata-only upper bound는 1,604,672 gas로 측정했다. 검증: Toolkit/CLI targeted
  smoke, clean external SDK consumer install/build/conformance, full Foundry 902/902,
  전체 `scripts/check.sh`, BUIDL-like/Reg-D E2E 각각 7/7 및 dashboard/CLI/RFQ flow,
  `git diff --check` 통과.

- `CORE-012 — Safe Element Emergency Replacement`: 사고 자산을 즉시 suspend한 뒤
  새 immutable Element ID와 exact Recipe version을 등록하고, full policy config와
  override를 보존한 delayed Manifest update로 영향 자산만 교체하는 절차를 완성했다.
  update activation은 SUSPENDED 상태를 보존하며 별도 delayed resume 전 checkpoint,
  artifact와 unaffected-asset 불변성을 검증한다. known RFQ nonce 취소에 더해 old
  policy-bound quote가 settlement에서 fail-closed하도록 회귀를 고정했다. 검증:
  Factory 12/12, RFQFlow 9/9, Engine 44/44, Registry targeted suites, full Foundry
  902/902, 전체 `scripts/check.sh`, BUIDL-like/Reg-D E2E 각각 7/7 및
  dashboard/CLI/RFQ flow. ComplianceEngine 19,583 bytes, TokenPolicyRegistry
  24,035 bytes(EIP-170 margin 541), CornerStoreFactory 4,740 bytes,
  `git diff --check` 통과.

- `CORE-011 — Policy Audit Artifact`: domain-separated canonical PII-free policy
  artifact와 content-addressed local reference store를 추가했다. production
  onboarding schema v4는 저장·재검증된 artifact가 config/legal/compiled plan,
  Manifest, binding/override, Element/Recipe와 Engine/Registry runtime code hash에
  모두 일치해야 unsigned plan을 생성한다. artifact SHA-256은
  `fullManifestHash`에 원자적으로 고정되고, 승인 직후 permissionless Engine
  checkpoint가 final policyId/version/status/history와 연결한다. local store는
  production WORM/retention을 주장하지 않으며 operator-owned durable adapter는
  운영 책임으로 남겼다. 기존 schema v1~v3와 demo는 유지했다. 검증: Toolkit/CLI
  artifact smoke, Engine 44/44, full Foundry 899/899, 전체 `scripts/check.sh`, clean
  SDK consumer, deploy-v3 10/10, BUIDL-like/Reg-D E2E 각각 7/7 및
  dashboard/CLI/RFQ flow. ComplianceEngine runtime 19,583 bytes(EIP-170 margin
  4,993), TokenPolicyRegistry 24,035 bytes 유지, `git diff --check` 통과.
- `CORE-010 — Policy Execution Binding`: logical policy와 chain/Engine/Registry/
  Recipe/Element runtime deployment를 domain-separated hash로 결합하고, Registry가
  등록 시점 code hash를 고정해 live drift를 fail-closed하도록 했다. final
  `policyId`는 `decisionHash`와 RFQ EIP-712 v2 quote에 포함되며 host가 인증·rate-limit
  이후 server-owned resolver로 현재 값을 가져온다. settlement는 fresh decision과
  quote policy가 다르면 token 이동 전에 거부한다. 기본 production 경계는 immutable
  implementation이며 CREATE2 주소 예측은 runtime 검증을 대체하지 않는다.
  검증: PolicyHash/DecisionHash 4/4, Engine 42/42, RFQAdapter 25/25, RFQFlow 8/8,
  RFQ/host/CLI/demo/testnet/Toolkit smoke, full Foundry 897/897, 전체
  `scripts/check.sh`, clean SDK consumer, deploy-v3 10/10, BUIDL-like/Reg-D E2E 각각
  7/7 및 dashboard/CLI/RFQ buy/sell. ComplianceEngine runtime 18,640 bytes,
  TokenPolicyRegistry 24,035 bytes(EIP-170 margin 541 bytes).
- `CORE-009 — Bounded Predicate and Element Conformance`: Element metadata에
  PII-free evidence source class와 immutable default enforcement를 포함하고,
  Registry가 metadata/default 불일치를 fail-closed하도록 고정했다. exact-length와
  range를 검증하는 BoolClaim/BoundedUint/TimestampWindow/SetMembership primitive와
  Manifest-owned parameter를 사용하는 generic `MinimumTradeAmount`를 추가했다.
  Toolkit onboarding schema v3는 evidence type을 검증하며 v1/v2를 재해석 없이
  읽는다. 범용 DSL과 BUIDL-like 실제 profile migration(#109)은 범위 밖으로 유지했다.
  검증: targeted ElementRegistry 11/11, PredicateValidation 4/4,
  MinimumTradeAmount 2/2, Engine 40/40, existing Element 579/579,
  TokenPolicyRegistry 56/56, Factory 11/11, full Foundry 891/891, 전체
  `scripts/check.sh`, clean SDK consumer, deploy-v3 10/10, BUIDL-like/Reg-D E2E
  각각 7/7 및 dashboard/CLI/RFQ flow. `TokenPolicyRegistry` runtime은 24,035
  bytes(EIP-170 margin 541 bytes)다.
- `CORE-008 — Exact Recipe Key and Version Resolution`: 모호한 latest-address 및
  numeric-address Recipe 조회를 제거하고 Registry, TokenPolicyRegistry, Engine,
  CLI와 Toolkit을 canonical `recipeKey + exact version`으로 통일했다. numeric
  `recipeId`는 immutable key alias로만 남고 `latestRegisteredVersionOf(recipeKey)`는
  catalog metadata로 active Manifest version과 명확히 분리된다. 새 Recipe version
  등록만으로 기존 ACTIVE policy ID/version/평가 결과가 바뀌지 않는 회귀를 추가했다.
  검증: RecipeRegistry 7/7, TokenPolicyRegistry 56/56, Engine 39/39, full Foundry
  882/882, 전체 `scripts/check.sh`, CLI/Toolkit smoke, clean SDK consumer,
  deploy-v3 10/10, BUIDL-like/Reg-D E2E 각각 7/7 및 dashboard/CLI/RFQ flow.
  `TokenPolicyRegistry` runtime은 23,978 bytes(EIP-170 margin 598 bytes)다.
- `CORE-007 — Versioned Manifest Policy Config`: 자산별 Element 정책값을 schema v1
  `ManifestPolicyConfig`로 분리하고 Manifest 등록/semantic update에만 결합했다.
  Registry는 최대 256 entry, 총 16,384 bytes, binding/Recipe membership, 중복,
  immutable schema ID/version, required와 Element별 길이 상한을 activation 전에
  fail-closed 검증한다. config hash와 binding별 aligned parameter bytes는 compiled
  plan/history/Engine policy ID에 포함되고, Engine은 동적 lookup 없이 정확한 bytes를
  Element에 전달한다. pending plan은 timelock 동안 active 상태와 분리되며 activation
  transaction에서 Manifest version/bindings/enforcement/config hash/parameters가 함께
  교체된다. config 원문은 Safe calldata/PII-free artifact 경계에 남기고 온체인은
  active hash와 실행 bytes만 보존한다. EIP-170 초과를 E2E에서 발견해 legacy
  contract-only overload와 중복 config storage/getter를 제거했으며 최종
  TokenPolicyRegistry runtime은 23,980 bytes(596-byte margin)로 실제 배포됐다.
  검증: Registry 56/56, Engine 38/38, full Foundry 881/881, 전체
  `scripts/check.sh`, BUIDL-like/Reg-D E2E 각각 7/7 및 dashboard/CLI/RFQ flow,
  `git diff --check` 통과. full check에서는 main의 기존 두 script formatter drift만
  검증 중 임시 포맷 후 원복했다.

- `CORE-006 — Unified Element Parameter Interface`: 모든 in-repo Element와
  Engine/CLI/demo call site를 단일 `check(..., context, parameters)` ABI로
  migration했다. immutable metadata가 schema ID/version, required와 최대 bytes를
  선언하고 Registry가 incoherent 또는 4096-byte 초과 capability를 등록 전에
  거절한다. `BaseElement`는 parameterless non-empty, required empty와 선언 길이
  초과를 공통 reason으로 fail-closed하며 CLI도 이를 decode한다. 현재 Engine은
  #103 전까지 empty parameters만 전달해 기존 Element 판정과 reason code를
  유지한다. 검증: BaseElement 5/5, Registry 9/9, Engine 37/37, 전체 Element
  577/577, full Foundry 877/877, CLI/Toolkit/RFQ demo/testnet package tests,
  전체 `scripts/check.sh`, `buidl-like`와 `reg-d` Anvil E2E 각각 7/7 및
  dashboard/CLI/RFQ flow, `git diff --check` 통과. 로컬 nightly formatter가
  main의 기존 두 script와 다른 형식을 요구해 full check 동안만 임시 포맷하고
  이후 원복했다. Manifest별 schema/parameter 저장·hash·전달은 #103 범위다.

- `DOCS-011 — ADR-010 Production Policy Decisions`: Q1~Q8과 D-5에서 선택한
  Manifest-owned versioned config, bounded parameter 단일 Element ABI,
  주소+runtime code hash execution binding, 온체인 lifecycle+PII-free artifact
  감사, 안전우선 불변 버전 교체, exact Recipe version과 제한적 predicate
  정규화를 accepted ADR로 기록했다. 구현은 GitHub epic #101 및 #102~#110의
  의존성 순서로 분리했다. 이 slice는 문서·이슈 추적만 변경하므로 executable
  test와 E2E는 실행하지 않고 link/status review와 `git diff --check`로 검증한다.

- `CMP-005 — A-12 Registration Safety`: opt-in wave-3 배포 스크립트가 A-12를
  2-인자 기본 `BLOCK` 경로로 등록하던 문제를 수정해 명시적 `FLAG_ONLY`로
  등록한다. wave-3가 기본 Foundry compile graph 밖에 있는 경계를 유지하면서도
  `scripts/check-wave3-element-policies.sh`가 one-shot 등록 action의 회귀를
  fail-closed로 검사한다. 오래된 A-12 명세의 "컨트랙트 미구현" 상태를 현재
  illustrative reference 구현과 production data-source/Recipe 미배선 경계로
  정렬했다. 검증: policy check 통과, wave-3 script 단독 build 통과,
  ElementRegistry 7/7 및 전체 Foundry 870/870 통과, 기존 main의 formatting
  drift(`script/DeployProductionCore.s.sol`, `script/DemoScenarios.s.sol`)만 검증
  복사본에서 임시 포맷한 전체 `scripts/check.sh` 통과, `git diff --check` 통과.
  active Recipe 활성화와 production surveillance 연동은 범위 밖이며 실제
  broadcast/E2E는 수행하지 않았다.

- `SDK-003 — Publishable Package Release Contract`: CLI, Toolkit과 RFQ SDK를
  독립 npm tarball로 build/pack하고 Node 20 clean temporary projects에 설치하는
  release gate를 완성했다. Toolkit packed export/config simulation, generated
  RFQ module conformance, packaged CLI doctor/deploy dry-run과 contract bundle
  Foundry build를 repository-relative package resolution 없이 검증한다. SemVer,
  npm version과 persisted schema/capability version의 분리, release/rollback 및
  immutable on-chain version migration 절차를 `docs/sdk-versioning.md`에 기록했다.
  검증: Toolkit/RFQ/CLI package tests pass; Node 20
  `scripts/sdk-product-smoke.sh` pass; Node 16 doctor fail-closed 확인;
  `git diff --check` pass. `scripts/check.sh`는 실행했으나 G006과 무관한 기존
  formatting drift(`script/DeployProductionCore.s.sol`,
  `script/DemoScenarios.s.sol`)에서 중단됐다.

- `CORE-005 — Compliance Core Production Hardening`: Compliance Core registry
  semantics were hardened for production onboarding. Element registration is now
  immutable per `elementId`, pins metadata/version hashes and records default
  enforcement action. Recipe registration accepts canonical normalized aliases,
  stores version-independent `recipeKey` commitments, preserves immutable legacy
  numeric aliases and rejects collisions/overwrites. `TokenPolicyRegistry`
  compiles bounded per-binding Element enforcement rules at registration/update
  time and rejects normal onboarding overrides that weaken an Element's default
  action; `FORCE_FLAG_ONLY` remains limited to Elements that default to
  `FLAG_ONLY`. Engine rejection now preserves exact nonzero Element reason codes
  and only falls back to recipe-scoped code `1` for zero reasons. Toolkit/CLI
  production onboarding v2 now validates alias/key derivation, default actions,
  bounded overrides and compiled plan commitments, emits additive v2 calldata,
  and verifies alias/key, default action and compiled-plan state fail-closed while
  legacy v1 configs/calldata remain accepted. 검증: targeted registry tests 86
  pass, Engine tests 37 pass, RegD integration tests 6 pass, full
  `forge test --offline` 870/870 pass, `npm test --prefix services/toolkit`
  pass, `npm test --prefix services/cli` pass, isolated `/tmp` full
  `scripts/check.sh` pass(after formatting only the pre-existing
  `script/DeployProductionCore.s.sol` and `script/DemoScenarios.s.sol` drift in
  the copy and running fresh `npm ci` for copied stale `node_modules`; this full
  check was before the final Solidity-only bijection guard and post-fix full
  `forge test --offline` 870/870 passed), full Anvil E2E `buidl-like` and
  `reg-d` pass with 7/7 scenarios and RFQ flows, and
  `git diff --check` pass. Original-tree `scripts/check.sh` remains blocked by
  pre-existing formatting drift in `script/DeployProductionCore.s.sol` and
  `script/DemoScenarios.s.sol`; `DemoScenarios` contains only the scoped G005
  reason-contract edit and was not broad-formatted in the original tree.

- `DEPLOY-003 — Production ERC-3643 Asset Onboarding`: production core deployment과
  local Anvil demo onboarding을 분리한 production-only asset onboarding Toolkit/CLI
  surface를 추가했다. `corner-store.production-onboarding.json`은 exact schema로
  ERC-3643 token→IdentityRegistry→Compliance wiring, Identity Registry dependency,
  Corner Store registry/adapter/operator addresses, legalPackageHash, Element/Recipe/
  Manifest/RecipeBinding, governance Safe metadata, explicit operator executor,
  active venue, RFQ maker/signer delegate and read-only inventory requirements를 받는다. Validator는 unknown fields,
  duplicate ids/addresses, unsupported codeHashes key, PII/secret shaped input,
  omitted/empty venue or inventory, active RFQ venue without approved maker/signer
  delegate/approved-maker inventory, RFQ config without RFQ venue를 fail-closed한다.
  `production-onboarding-plan`은 deterministic calldata와 Safe-owner/operator-authority
  drafts를 분리한다. Safe drafts에는 Safe/required approval/proposal identity가,
  operator drafts에는 explicit executor/proposal identity가 포함되며 immutable output으로
  쓰고 governance-owner/governance-delayed/operator authority를 분리하고 transfer/approval/
  broadcast를 생성하지 않는다.
  `production-onboarding-verify`는 injected reader/JsonRpcProvider로 ERC-3643 wiring,
  code hash, registry state, exact Manifest hash/fields/bindings, ACTIVE
  declaredBy/approvedBy, governance Safe ownership of safe-owner targets, global/asset/venue pause gates, TokenPolicyRegistry/RFQAdapter operator executor
  authorization, maker approval, active signer and inventory balance/allowance를
  read-only 검증한다. Pending signer는
  detail로 보고하지만 ready가 아니다. 검증: `npm test --prefix services/toolkit`,
  `npm test --prefix services/cli`, production onboarding example validation,
  `git diff --check` 통과. `scripts/check.sh`는 실행했으나 known pre-existing
  Solidity formatting blocker(`script/DeployProductionCore.s.sol`,
  `script/DemoScenarios.s.sol`)에서 실패했다. Anvil E2E는 기존 untracked
  `deployments/` 보호를 위해 이 slice에서 실행하지 않았다.

- `DATA-002 — Provider-Neutral TA/KYC Evidence`: `services/compliance-data`에
  provider-neutral TA/KYC evidence coordinator와 replaceable store port를 추가했다.
  요청/결과는 subject, optional ONCHAINID identity, asset, request/evidence hashes와
  bounded provider/status/fact fields만 사용하며 raw name/email/document/SSN/provider
  subject/webhook payload는 core I/O·snapshot·audit에 저장하지 않는다. coordinator는
  provider result의 exact binding, freshness/future skew, explicit revoke/ineligible,
  sanctions/KYC facts와 provider timeout을 fail-closed로 검증하고 canonical domain-separated evidenceHash를
  계산한다. eligible snapshot은 strict success audit이 성공한 뒤에만 store에 publish하고 store 반환값을 재검증한다. provider outage/timeout/malformed request·result/stale/future/mismatch/revoked/ineligible/
  conflict/audit failure는 eligible materialization을 반환하지 않으며 cached last-good
  snapshot으로 outage를 숨기지 않는다. `InMemoryKycEvidenceStore`는 single-process
  reference/conformance store로 idempotent replay, same-assessment conflict, newer/revoked
  monotonic semantics를 검증하며 production HA/WORM/claim-write adapter는 operator 교체
  지점으로 남겼다. 검증: `npm test --prefix services/compliance-data`,
  `git diff --check` 통과. E2E는 이 provider-boundary feature 범위가 아니어서 실행하지
  않았다.

- `RFQ-005 — Production RFQ Host Hardening`: `services/rfq-host`를 새
  production-separable HTTP host boundary로 추가했다. local Anvil demo backend는
  그대로 두고, host는 request-size/JSON/schema validation, authenticator port와
  exact taker binding, hashed-principal rate limit, pricing/risk freshness gate,
  durable coordinator issuance, strict PII-free audit, bounded metrics와
  incident hook을 순서대로 적용한다. stale/missing/future/unavailable
  pricing·risk dependency는 nonce reservation과 signer 호출 전에 fail-closed하며,
  external signer verification failure와 audit sink failure는 quote response를
  내지 않고 incident로 기록한다. `/health`는 secret/config를 노출하지 않고,
  public bind는 operator TLS/trusted-proxy acknowledgement 없이는 거부한다.
  검증: baseline 및 final `npm test --prefix services/rfq`,
  `npm test --prefix services/rfq-host`, `npm test --prefix services/rfq-demo-backend`,
  `git diff --check` 통과. E2E는 기존 untracked `deployments/` 보호를 위해
  이 feature 범위에서 실행하지 않았다. `scripts/check.sh`는 이 stacked 작업에서
  known unrelated Solidity formatting gate가 있어 실행하지 않았고, RFQ hardening과
  무관한 Solidity 파일은 수정하지 않았다.

- `RFQ-004 — Durable Quote Coordinator`: `services/rfq`에 production-separable
  `RFQQuoteCoordinator`와 `QuoteCoordinatorStore` 포트를 추가했다. coordinator는
  pricing/risk가 통과한 뒤에만 `(chainId, adapter, maker)` scope nonce와
  idempotency/request hash, maker outgoing inventory lease를 원자적으로 예약하고,
  external signer 결과를 로컬 EIP-712 검증 후 durable record에 저장한다. 같은
  idempotency key+request는 service restart/new coordinator instance 이후에도 같은
  signed quote를 반환하고, 다른 request hash는 conflict로 거부된다. signer failure,
  expiry, revoke, finalized fill/cancel은 lease를 정확히 한 번 해제하며 nonce gap은
  허용하되 재사용하지 않는다. fill/cancel observation은 block/hash를 기록하고
  configured finality 이후 terminal 처리하며, reorg는 observed 상태를 `PUBLISHED`로
  되돌리고 lease를 유지한다. durable record에는 raw idempotency key나 signer ref를
  저장하지 않는다. 함께 추가한 `LocalFileQuoteCoordinatorStore`는 Node built-ins 기반
  reference/single-host file adapter이며 production HA는 동일 포트를 operator
  transactional DB와 indexer/reconciliation worker로 구현해야 한다. 검증: baseline 및
  final `npm test --prefix services/rfq` 통과, `git diff --check` 통과.

- `STUDIO-002 — Localized Evidence-Gated Workflow`: Deployment Studio의 기본
  언어를 한국어로 제공하고 English 전환 선택을 유지한다. 설정 저장부터 Doctor,
  계획, 배포, Artifact 검증, DEX 실행까지 실제 evidence와 선행 단계가 모두
  충족된 경우에만 완료로 표시하도록 workflow 상태를 fail-closed했다.
  Deployment Studio smoke test와 `git diff --check`를 통과했다.
- `DOC-004 — Product Architecture and Technical Whitepaper`: current
  source-of-truth와 구현을 기준으로 외부 공유용 기술 백서를 작성했다. 문제 정의,
  제품 경계, Element/Recipe/Manifest/Operator, Router fill-time enforcement,
  RFQ backend module, trust boundary, control/execution plane, 핵심 ABI와
  protocol invariant, 통합자별 adoption path, architectural trade-off, current
  implementation과 production gap을 11개의 Mermaid diagram과 함께 설명한다.
  GitBook/GitHub에서 직접 읽을 수 있도록 루트 README와 문서 인덱스에 연결하고,
  공식 1차 자료와 claim-to-evidence matrix를 추가했다. 내부 링크, Mermaid
  fence/diagram 구성, Engine 34/34, RFQ integration 8/8, RFQ SDK smoke와
  `git diff --check`를 검증했다.
- `DEMO-016 — Artifact-bound Public Testnet RFQ Demo`: 기존 local Anvil
  facilitator를 변경하지 않고 committed public deployment artifact를 읽는 별도
  browser demo를 추가했다. runtime은 RPC chain/bytecode와 artifact Maker를
  검증하고 RFQ SDK로 Maker quote만 서명한다. investor는 브라우저 지갑으로
  allowance와 Router settlement를 직접 제출하며 deployment lineage, contract
  주소, token/Manifest/Maker 상태, balance/QP pre-check, quote와 receipt를
  확인할 수 있다. isolated Anvil에서 149-transaction artifact를 배포·승격하고
  Maker/investor approvals 후 API state/pre-check/quote, external investor
  Router static call과 block 154 settlement를 통과했다. 전체
  `scripts/check.sh`(Forge 669/669, 모든 service smoke, deploy-v3 10/10)도
  통과했다.
- `DEPLOY-002 — Public Testnet RFQ Reference Deployment`: 기존 Anvil 데모를
  변경하지 않고 외부 RPC·chain ID·actor 주소와 Foundry keystore/Ledger signer를
  사용하는 RFQ-only public-testnet deployment를 추가했다. 실제 T-REX
  ERC-3643/ONCHAINID fixture, illustrative BUIDL-like Manifest, Engine/Router/RFQ,
  mock quote token, claim과 inventory를 배포하며 participant allowance는 각
  wallet이 별도 승인한다. read-only verifier는 chain/artifact, code, ownership,
  operator, Manifest/venue/maker/inventory/allowance를 fail-closed로 확인한다.
  검증된 배포만 append-only public artifact로 승격하며 모든 named 주소와
  deployment transaction/CREATE index를 보존해 후속 runtime에서 재사용한다.
  전체 `scripts/check.sh`(Forge 669/669, 모든 service smoke, deploy-v3 10/10),
  별도 Anvil external-keystore broadcast, governance/operator handoff, artifact
  승격·조회와 maker/investor approval 이후 readiness 검증을 통과했다. 실제
  공개 테스트넷 broadcast와 explorer verification은 네트워크 입력·faucet·
  credential 주입 후 수행한다.
- `DEMO-015 — RFQ Session History and Targeted Claim Expiry`: My RFQs가 세션의
  firm quote를 누적하되 사용자에게는 현재 지갑이 taker인 기록만 표시하고,
  Admin만 세션 전체를 조회한다. mock market은 fill 횟수마다 같은 tick을 쓰지
  않고 실제 RWA 체결수량에 비례한 scenario impact/cap으로 다음 가격을
  계산한다. 차트는 전체 기간만 표시하고 체결점의 방향·가격·수량·시간은
  hover/focus에서 확인한다. Claim 만료는 Enforcement Cases로 통합했으며 준비
  직후 B는 10분간 계속 적격이고, 1시간 quote 발급 후 Anvil을 15분 전진해야
  B만 만료되고 A는 계속 허용된다. `Maker 관리`는 다중 Maker 기능이 아니라
  현재 단일 Maker의 승인 철회 보안 시연으로 명확히 했다. Admin claim 변경은
  실제 operator transaction의 block/hash를 API와 UI에 노출해 단순 브라우저
  상태 변경과 구분한다. Node 20 전체 `scripts/check.sh`(Forge 669/669 포함),
  BUIDL-like RFQ live E2E와
  `git diff --check`를 통과했다.
- `DEMO-014 — RFQ Counter-Amount Preview`: RFQ 생성 화면에서 매수·매도 방향별
  지불 자산, backend pre-check가 계산한 반대 페어 예상 수령량과 현재 단가를
  함께 표시한다. 입력이 바뀌면 이전 값을 지우고 최신 `amountOut` 응답으로만
  갱신하므로 고정 가격이나 임의 UI 계산을 사용하지 않는다. Operator Dashboard
  smoke와 `git diff --check`를 통과했다.
- `DEMO-013 — Deployment-to-DEX Showcase Handoff`: production script와 local
  reference stack이 온체인 helper를 별도로 배포하지 않는
  `ProductionCoreDeployer.deployCore()` 구현을 공유한다. versioned showcase
  config와 plan/run entry point가 profile, scenario, loopback host와 네 개의
  runtime port를 검증하고 core 배포 → demo-only ERC-3643/Mock TA/policy/venue/
  inventory activation → artifact → RFQ backend → Operator API/Dashboard 순서를
  재현한다. Studio의 Deploy/Verify 이후에도 같은 project artifact, scenario와
  배포 RPC를 세 서비스에 직접 넘기는 Start/Open/Stop DEX handoff를 추가했다.
  Studio 최초 Start는 기존 CLI `toolkit-onboard`를 재사용해 선택한 demo
  Manifest/venue를 동일 배포물에서 활성화하고 완료 상태를 기록하므로 재시작 때
  불필요한 retire/re-onboard를 반복하지 않는다.
  다른 RPC나 변경된 artifact를 거부하며 실제 integration에서 Studio artifact의
  Router와 backend가 사용하는 Router가 같음을 검증했다. artifact lineage는
  backend와 Dashboard에 표시되며 local fixture가 production evidence가 아님을
  명시한다. Node 20 + Foundry v1.7.1 전체
  check(Forge 669/669, deploy-v3 10/10), target service smoke, showcase plan,
  별도 포트 BUIDL-like RFQ E2E와 `git diff --check`를 통과했다.
- `DEPLOY-001 — Production Deployment Workflow`: fixture/token/policy activation이
  없는 core-only Foundry script, external Ledger/Foundry account signer CLI,
  Safe proxy/singleton/code hash + exact owner `M`/threshold `N` preflight,
  existing ERC-3643 technical wiring preflight와 Studio signer-free planning
  target을 구현했다. approved RPC host, reviewed commit, deterministic contract
  bundle hash, dry-run/fork evidence를 deploy 전에 재검증하고, 배포 후에는 exact
  runtime bytecode hash, Safe ownership/operator와 Router/Engine binding을
  fail-closed로 검증한다. 실제 ERC-3643 claim/trusted issuer/legal policy
  onboarding과 production transaction은 별도 issuer/Safe evidence가 필요하다.
  Node 20 + Foundry v1.7.1 전체 check(Forge 669/669, deploy-v3 10/10), targeted
  service/Foundry tests, `git diff --check`와 독립 code review를 통과했다.
- `STUDIO-001 — Local Deployment Studio`: 실제 Toolkit JSON과 CLI를 사용하는
  local/demo control surface를 추가했다. 운영자가 주입한 host/port, workspace,
  CLI entry, RPC, broadcast network/host allowlist와 Operations URL을 기준으로
  project create → doctor → dry-run → guarded reference deploy → artifact verify →
  handoff를 수행한다. 브라우저 secret 입력과 production broadcast는 제공하지
  않으며, config/integration/scenario 변경 시 verify evidence를 무효화한다.
  API/UI smoke, Node 20 + Foundry v1.7.1 전체 check(Forge 665/665), 실제 별도
  Anvil 포트 배포·verify, Chrome interaction smoke와 visual verdict 91/100을
  통과했다. 후속 UX pass에서 library/reference/existing-backend의 실제 이용
  경계, account/governance role label, production plan-only network와 module
  preset/custom adapter 의미를 contextual help로 노출하고 Activation이 수동
  evidence checklist임을 명확히 했다. Anvil-only server/UI gate와 production
  runtime 오설정 회귀 테스트를 추가했고, 최종 desktop/mobile visual verdict
  9/10을 통과했다.
- `SDK-002 — Standalone Integration and Deployment Workflow`: 단일 CLI로
  library-only, reference-service, existing-backend 프로젝트를 생성하고
  doctor, deploy, verify와 RFQ module conformance를 실행할 수 있게 했다.
  source checkout은 미배포 npm package에 의존하지 않도록 CLI와 RFQ SDK를
  자동 vendoring하며, package artifact는 필요한 contract source만 포함한다.
  실제 maker를 복구하는 EIP-712 conformance, clean external install/build,
  독립 Anvil broadcast/verify와 전체 repository check(Forge 665/665,
  deploy-v3 10/10)를 통과했다.
- `RFQ-003 — Maker Authorizer and Regulated Amount Cap`: maker settlement
  account와 quote signer를 immutable versioned authorizer로 분리했다. maker
  직접 ECDSA, delayed governed delegate, immediate revoke와 ERC-1271을 fill
  시점에 검증한다. compliance decision은 `maxAmountToken`을 함께 bind하고
  Router는 regulated token이 tokenIn인 매도와 tokenOut인 매수에 finite cap을
  적용하며 잘못된 cap axis는 fail-closed한다. 전체 repository check
  (Forge 665/665), service/deploy-v3 checks와 BUIDL-like RFQ E2E를 통과했다.
- `RFQ-POLICY-001 — Production RFQ Policy`: ADR-009로 protocol non-custodial,
  exact full-fill v1, maker/signer 분리, durable nonce/idempotency, time-bounded
  inventory reservation, pricing/risk 역할 분리와 Router fill-time compliance를
  accepted baseline으로 확정했다. owner/trust matrix, quote lifecycle/reorg,
  signer rotation, incident flow와 hostile test matrix를 component spec에 기록하고
  후속 구현을 #65(authorizer/cap), #66(durable coordinator), #67(service
  hardening)로 분리했다. local link check, `git diff --check`, independent
  architect review와 adversarial critic 재검토를 통과했다.
- `SDK-001 — Modular Integration and Deployment Toolkit`: RFQ pricing, risk,
  signer와 nonce를 versioned capability module로 교체할 수 있게 하고 reference와
  custom 구현이 같은 conformance suite를 사용하도록 했다. Toolkit/CLI는 reference
  RFQ service 또는 기존 backend 연결 프로젝트를 secret 없이 생성하며, 기본 생성물은
  RFQ SDK source를 vendoring해 저장소 밖과 선택형 Docker context에서도 재현 가능하다.
  RFQ·Toolkit·CLI·demo backend test, pinned Foundry 기준 repository check
  (Forge 643/643), BUIDL-like RFQ E2E, clean generated-project install/build와
  독립 code review를 통과했다. 선택형 Compose config, generated Docker image
  build와 container 내부 signed quote HTTP runtime도 검증했다.
- `DEMO-012 — Enforcement Case Workflow`: Admin에 단계형 Enforcement Cases
  워크스페이스를 추가했다. Adapter 직접 호출, quote 이후 claim 만료, quote 이후
  Maker 취소를 기준 상태→quote→정책 변경→실행→증거→복구로 분리하며, 실제 실패
  transaction receipt, reasonCode/selector, 실패 전후 잔액 불변과 trace를
  표시한다. backend/dashboard smoke, `git diff --check`, 기본 및 비 1:1 가격·
  변경된 지갑별 QP 상태를 주입한 별도 포트 BUIDL-like RFQ E2E에서 체결과 세 차단
  경로를 검증했다. E2E는 사용 중인 Anvil/backend 포트에 잘못 접속하지 않고
  시작 전에 fail-closed한다.
- `DEMO-011 — Multi-resolution History and Repeat Liquidity`: 시간별로 주입한
  NAV/indicative anchor를 1분 간격으로 보간해 기본 scenario에서 421개 sample을
  제공한다. 따라서 1분·5분·1시간·전체는 서로 다른 관측 수를 표시한다. 투자자
  초기 quote/RWA와 maker 양방향 inventory를 반복 시연용으로 확대했고, backend/
  dashboard smoke, `git diff --check`, 별도 포트 BUIDL-like E2E에서 동일
  투자자의 실제 Router 매수 4회·매도 4회 연속 체결을 검증했다.
- `DEMO-010 — RFQ Chart Range and Fill Evidence`: 사용자 차트에 1분·5분·
  1시간·전체 구간 전환을 추가하고, 실제 Router fill을 매수/매도와 체결 단가가
  표시된 marker로 렌더링한다. 선택 구간의 fill tape는 실제 RWA 수량, chain
  timestamp와 transaction hash를 제공하며 fixture line과 구분한다. Dashboard
  smoke, `git diff --check`, 별도 포트 BUIDL-like RFQ E2E에서 실제 양방향
  체결 history가 계속 생성되는 것을 검증했다.
- `DEMO-009 — Resilient Repeated-Trade UX`: 현재 runtime 가격, 최소 RWA
  수량과 scenario buffer로 다음 매수·매도의 권장 입력값을 backend에서
  재계산한다. 새 RFQ와 방향 전환은 이 값을 사용해 반복 체결 후에도 기본
  pre-check가 통과하고, 수동으로 더 작은 값을 넣으면 minimum-investment
  정책은 그대로 거부한다. 차트는 짧은 시간의 체결을 실행 순서로 분리하고
  실제 timestamp는 tooltip에 보존하며 최소 1% 가격축과 10 bps mock impact로
  작은 변화를 과장하지 않는다. backend/dashboard smoke, `git diff --check`,
  별도 포트 BUIDL-like RFQ E2E에서 첫 매수 후 권장값 증가와 다음 매수
  pre-check, 양방향 체결 및 전체 거부 시나리오를 검증했다.
- `DEMO-008 — RWA-aware RFQ Market Chart`: scenario가 Mock NAV/oracle,
  indicative-mid history와 spread를 주입하고 `/demo/market-history`가 이를 실제
  Router fill과 분리해 제공한다. 사용자 Dashboard는 두 선, spread band, 매수·
  매도 fill point, 실제 거래량을 표시한다. quote signer와 pre-check가 동일한
  runtime market을 사용하도록 pricing instance 분리 버그도 수정했다. backend/
  dashboard smoke, `git diff --check`, 별도 포트 BUIDL-like RFQ E2E에서
  초기 history, 매수·매도 체결점, 거래량과 다음 firm quote 가격 반영을 검증했다.
- `DEMO-007 — Law-first QP and Dynamic RFQ Market Demo`: Admin UI는 내부
  `A-13-v1`보다 ICA §3(c)(7), §2(a)(51) QP와 Rule 3c-5 KE 예외를 우선
  표시한다. scenario에 초기 가격과 fill당 impact bps를 주입하고 성공한 매수는
  다음 가격을 올리고 매도는 내리도록 backend pricing, pre-check, firm quote와
  Dashboard 참고가격을 하나의 runtime market state로 연결했다. backend/dashboard
  smoke, `git diff --check`, 별도 포트 BUIDL-like RFQ E2E에서 매수 후 상승과
  매도 후 하락을 확인했다.
- RFQ 데모의 기본 수량을 표시용 천 단위 문자열이 아닌 파싱 가능한 decimal
  input으로 분리해 적격 지갑의 pre-check 오차단을 제거했다. Admin은 더 이상
  적격 결과를 토글하지 않고 QP basis, signature, trusted issuer, look-through와
  fund binding claim 사실을 A-13에 기록하며, Element가 적격 여부와 상세 실패
  사유를 계산한다. backend/dashboard smoke와 별도 포트 BUIDL-like RFQ E2E가
  claim 변경·재판정, 정상 체결, 비적격/만료/maker 차단을 모두 통과했다.
- 첫 체결 후 modal Accept 버튼의 disabled 상태가 다음 quote와 다른 지갑에도
  남던 dashboard session bug를 제거했다. 새 RFQ 시작은 consumed quote와 UI
  상태를 초기화하고, 새 firm quote를 검토할 때 Accept를 다시 활성화한다.
- UI 전용 `12480 KRW` reference-price fixture를 제거했다. Dashboard 참고가격은
  RFQ quote와 동일한 injected fixed-rate mock의 numerator/denominator 및
  asset/quote decimals에서 `quote asset / RWA` 단가를 계산한다. 이 단가를
  매수 quote는 역산하고 매도 quote는 정방향 적용하므로 표시 가격과 양방향
  firm quote pricing source가 분리되거나 서로 역전되지 않는다.
- `HE-001 — Harness Baseline`
- `DOC-001 — Imported Architecture Alignment`
- `FND-001 — Foundry Product Foundation`
- `RFQ-001 — Reference RFQ Settlement`
- `DEMO-001 — BUIDL-like ERC-3643 Demo Asset`
- `RFQ-002 — RFQ v2 Hardening`
- `CMP-001 — Reg D 506(c) 9-element Recipe`(illustrative element library + recipe
  9-element 확장, version 2)
- `CMP-002 — Manifest Lifecycle & Operator Approval Flow`(validated state machine,
  setStatus 제거, engine positive-allowlist default-deny, clearUnregulated,
  factory register→approve)
- `DOC-002 — RFQ SDK and MVP Demo Planning`
- `RFQ-SDK-001 — RFQ Backend SDK Interfaces`
- `DEMO-002 — MVP RFQ Demo Backend`(selectable asset profile + local HTTP quote
  API + CLI/backend→Router live settlement)
- 사용자 중심 RFQ 데모 화면(Dashboard → RFQ 거래 → My RFQs → Portfolio,
  Security/Operator Advanced 유지)
- `TOOLKIT-001 — Versioned Config Foundation`
- `OPS-001 — High-severity Solidity Lint Gate`
- `OPS-002 — Repository-wide CI Parity`
- `DOC-003 — Goal Completion and Operations Alignment`
- `PROD-001 — Production Control Plane`(central global/asset/venue pause,
  delayed unpause와 Manifest resume/update, monotonic version/history,
  Factory governance forwarding)
- `DATA-001 — Compliance Data Layer Foundation`(provider-neutral TA lot resolver,
  expiring attested acquisition snapshot, fail-closed Lockup, idempotent
  person-group state와 hash-chain rejection/surveillance audit)
- `MANIFEST-002 — RecipeBinding Manifest Migration`(bounded registry-backed
  bindings, required/path/flag 평가, delayed lifecycle update와 CLI/demo ABI migration)
- `AMM-001 — Canonical Uniswap v3 Pool E2E`(pinned core artifact factory/pool,
  CREATE2 preflight, real mint/swap callback와 ERC-3643 protected buy/sell)
- RFQ-first MVP demo refinement(`scripts/e2e-anvil.sh --mode rfq` + Trader /
  Security / Operator dashboard + `docs/rfq-demo-guide.md`)
- multi-venue 아키텍처와 책임 문서 작성
- Corner Store용 Uniswap v3 최소 배포 profile 분리와 테스트
- ExecutionRouter/VenueRegistry/VenueSelector와 AMM reference adapter skeleton
- router now rejects requests whose `context.venueType` mismatches the registered
  `VenueConfig.venueType` (closes the PR-12 review medium finding)
- RFQ-002: operator-curated maker approval allowlist(`setMakerApproved`,
  `RFQMakerNotApproved`), maker-initiated nonce-scoped idempotent cancellation
  (`cancelQuoteNonce`/`cancelQuoteNonces`, `RFQQuoteCancelled`), venueType binding
  fix, `docs/rfq-threat-model.md` 위협 모델과 D008 결정 기록
- legacy mock element(Sanctions A-01, AccreditedInvestor A-03, QualifiedPurchaser
  A-13)의 attestation setter를 `Governed`/`onlyOperator` + 이벤트로 정렬해 CMP-001
  이후 hardening divergence를 닫았다(Lockup C-01은 settable mutator가 없어 변경 없음).
- RFQ integration: RFQ 벤처를 protected router path(`ExecutionRouter → ComplianceEngine
  → RFQAdapter`)로 real ERC-3643 스택 위에서 end-to-end 커버(`test/integration/RFQFlow.t.sol`,
  fill/maker-unapproved/cancel/non-compliant/direct-call bypass 5 시나리오) — RFQ-002 deferred follow-up 완료.
- `E2E-001 — Live Anvil E2E & Demo Runner`(`scripts/e2e-anvil.sh` +
  `script/DeployStack.s.sol` + `script/DemoScenarios.s.sol`): fresh Anvil에 전체 스택
  배포 후 7-scenario demo suite 구동, scenario별 PASS/FAIL. T-REX 배포 코어를
  `test/fixtures/TREXCore.sol`로 추출해 fixture/script 공유. src/ 변경 없음. runbook은
  `docs/demo.md`.
- `CLI-001 — corner-store Reference CLI`(`services/cli/` + `script/KycInvestor.s.sol`):
  live 노드 대상 인터랙티브 CLI(status/onboard/manifest/attest/investor-setup/kyc/
  buy/rfq-quote/rfq-cancel/maker/reason). ethers 기반, services/rfq EIP-712 서명
  라이브러리 재사용, reason-table 자동 디코딩. src/ 변경 없음(신규 Solidity는 KYC
  forge 스크립트 하나). smoke + fresh-account live walkthrough로 검증. README는
  `services/cli/README.md`.
- `CLI-002 — corner-store CLI v2`(`services/cli/**` + 문서만, 제품 코드/스크립트 변경
  없음): preflight `check`(per-element + engine verdict, asset-side 라벨, rejected면
  exit 1), AMM `sell`, `balances`, 이벤트 tail `watch`, `faucet`, anvil
  `snapshot`/`restore`, `quote-inspect`(서명자 복구/만료/nonce·승인, 실패 시 exit 1).
  reason 디코딩·EIP-712 복구는 기존 lib 재사용. smoke(quote-inspect valid+tampered) +
  full live walkthrough로 검증. `forge test --offline` 238/238 유지.
- `OPS-003 — Operator Deployment and Manifest Snapshot`(read-only Dashboard에
  execution/control-plane 주소와 onboarding Manifest status/version/RecipeBinding
  snapshot 표시, CLI nonce refresh와 전체 BUIDL-like RFQ walkthrough 검증).
- `DEMO-003 — Role-aware RFQ Compliance Walkthrough`(Admin/적격 A·B/비적격
  persona, 실제 QP·maker·asset pre-check, Admin 온체인 fixture 제어와
  비적격 signed quote의 fill-time Router 거부 증명).
- `DEMO-004 — Injectable Temporal RFQ Scenario`(scenario JSON 기반 자산 표시값,
  지갑/QP fixture와 시간 조건 주입, quote-time 적격 claim 만료 후 동일 signed
  quote의 fill-time Router 거부 증명).
- `DEMO-005 — Bidirectional RFQ Demo`(매수 qUSD→RWA와 매도 RWA→qUSD를 동일
  backend/Router/RFQAdapter 경로로 체결하고 두 자산의 실제 잔액 증감을 표시).
- `DEMO-006 — Deployment-bound Injectable RFQ Fixtures`(계정 binding, 초기
  inventory, 기본 매수·매도 수량, TTL과 mock price를 versioned scenario로
  주입하고 deployment artifact의 schema/hash로 backend 입력을 고정).

- `CMP-004 — Wave-3 Illustrative Element Library`(illustrative element 6개 +
  per-element unit test + `tools/deploy-wave3` opt-in deploy script): A-06
  Affiliate, A-12 Red Flag Knowledge Bar, E-03 Bad Actor Disqualification,
  F-01 Operator Self-Dealing, F-03 Fraud Surveillance, F-04 Reg M
  restricted-period buying gate. operator-gated setter, fail-closed default,
  monitoring element(A-12/F-03) non-blocking. active recipe/DeployStack 미변경.
  `forge test --offline` 770/770.

## Blocked

- 없음

## Next

1. DEPLOY-001 구현 검증을 완료하고 passing 전환 여부는 targeted Forge/service
   tests, 전체 `scripts/check.sh`, diff/review evidence로 판단한다. 실제 production
   network deployment success는 별도 deployment evidence가 생기기 전까지
   주장하지 않는다.
2. 실제 TA provider API/authorization, amount-specific lot allocation과 production
   WORM/indexer를 별도 refinement로 구현한다.
3. ADR-009 순서에 따라 durable nonce와 production pricing/risk·endpoint
   hardening을 독립 feature로 구현한다.
4. 실제 Uniswap v3 pool 배포를 demo/E2E에 연결한다(현재 AMM venue는 MockPool;
   `tools/deploy-v3` vendor isolation 유지).
5. Order Book은 matching/custody/surveillance 모델 결정 후 구현한다.
6. production 환경의 TLS, secret rotation, 실제 multisig provider와 live RPC
   finality/recovery 정책을 별도 운영 feature로 구체화한다.

## Last Session Summary

- RFQ maker settlement account와 signer authority를 분리했다. delegate 권한
  추가는 1일 delay, revoke는 즉시 적용하며 direct maker ECDSA와 ERC-1271도
  동일한 fill-time authorizer 경계에서 검증한다.
- finite compliance cap의 대상 regulated token을 decision hash에 포함하고,
  Router가 매수·매도의 실제 regulated quantity를 비교하도록 migration했다.
- deployment artifact, CLI quote inspection, Toolkit preflight와 RFQ demo backend를
  새 authorizer/cap ABI로 갱신했다. repository check에서 Forge 665/665와 모든
  service/deploy-v3 검사가 통과했다.
- production RFQ v1을 non-custodial exact full-fill로 고정하고 maker settlement
  account와 signer authority, Operator/dealer/TA/host/surveillance 책임을 분리했다.
- durable quote lifecycle은 nonce와 inventory lease를 원자적으로 예약하고
  observed/finalized fill·cancel 및 reorg recovery를 추적하도록 명세했다.
- 구현은 #65 maker authorizer/cap, #66 durable coordinator, #67 audit/service
  hardening으로 나눴다. partial fill은 새 quote/adapter version 전까지 비활성이다.
- RFQ pricing/risk/signer/nonce 교체 경계와 공통 conformance suite를 추가하고,
  demo backend를 같은 module contract의 reference consumer로 전환했다.
- CLI가 독립 실행 가능한 reference RFQ service 또는 기존 backend 연결 scaffold를
  생성한다. 기본 출력은 local absolute path 없이 SDK source를 포함하며 Docker
  Compose는 선택적으로만 생성된다.
- 전체 repository check, BUIDL-like RFQ E2E와 clean generated-project build를
  통과했다. Docker daemon에서 Compose config, generated image build와 container
  signed quote runtime까지 추가 검증했다.
- RFQ 데모의 실행 상태를 schema-v2 scenario로 통합했다. 배포 스크립트가 계정과
  초기 qUSD/RWA 물량을 실제 mint/approval에 사용하고, backend와 CLI는 같은
  scenario의 가격·수량·TTL·signer binding을 사용한다.
- deployment artifact에 scenario schema version과 content hash를 기록해 다른
  fixture로 backend를 시작하면 fail-closed하도록 했으며, 화면의 투자자와 maker
  잔액은 fixture 숫자가 아니라 배포 후 실제 `balanceOf`로 표시한다.
- 기본 BUIDL-like 전체 7/7 시나리오와 양방향 RFQ E2E가 통과했다. 별도로
  investor/maker 계정, 초기 물량과 2:1 가격을 바꾼 custom scenario에서도
  quote 발급부터 Router 체결까지 통과했고, `scripts/check.sh`는 Foundry
  643/643 및 모든 service/deploy-v3 검사를 통과했다.
- RFQ quote API와 대시보드에 `buy | sell` 방향을 추가했다. 매도 quote는
  `tokenIn=RWA`, `tokenOut=결제 자산`으로 서명되며 E2E에서 투자자 RWA 감소와
  결제 자산 증가를 검증했다.
- fresh 배포가 투자자 RWA와 maker 결제 자산 inventory 및 양방향 allowance를
  준비하므로 매수를 먼저 하지 않아도 매도 데모를 바로 실행할 수 있다.
- `ComplianceEngine.commit`이 regulated token 위치에 따라 실제 이동 방향을
  기록하도록 수정해, tokenIn 매도의 stateful accounting을 buyer→seller로 맞췄다.
- RFQ 데모의 사용자명, maker/preview 표시, 기준가격, 최소금액, 초기 QP 상태와
  freshness/시간 경과 조건을 validated scenario JSON으로 분리했다. 최상위
  `scripts/demo.sh --scenario <path>`와 E2E가 같은 입력을 사용하고 주소는 fresh
  deployment artifact와 funded Anvil signer mapping으로 검증한다.
- Admin temporal flow가 짧은 QP freshness를 실제 트랜잭션으로 주입하고 Anvil
  chain time을 전진시킨다. 견적은 아직 유효하지만 투자자 claim만 만료된 상태에서
  동일 EIP-712 quote가 Router의 최신 `ComplianceEngine` 검사로 거부됨을 E2E로
  증명했고, 이후 baseline fixture 복원도 확인했다.
- `scripts/check.sh` 전체 게이트(Foundry 641/641, 모든 TypeScript/dashboard smoke,
  deploy-v3 10/10)와 explicit scenario BUIDL-like RFQ E2E가 통과했다.
- RFQ 데모에 Admin, 적격투자자 A/B와 비적격투자자 persona를 추가했다. 선택된
  지갑별 실제 Anvil signer로 quote와 Router transaction을 실행하고, QP·maker·
  Manifest/minimum 정책을 생성·수락 전에 검사한다. 비적격 일반 거래는 UI에서
  차단되며 별도 proof는 signed quote도 최종 Router 검사에서
  `Qualified Purchaser claim missing`으로 거부됨을 증명한다.
- Admin 화면의 investor claim 편집과 maker 취소/복구는 cosmetic fixture가 아니라
  `QualifiedPurchaser.setQpClaim`과 `RFQAdapter.setMakerApproved` 트랜잭션이다.
  RFQ-only live E2E가 적격 B pre-check, 비적격 pre-check/최종 거부, Admin claim
  round-trip/A-13 재판정, 정상 체결과 maker revoke 거부를 모두 통과했다.
- RFQ 데모를 운영자 도구 중심에서 사용자 중심 4단계 흐름으로 재구성했다. 실제
  실행 가능한 Meridian quote와 Falcon/Nomos preview fixture를 구분하고, exact quote
  검토 후 Router 체결, Portfolio의 실제 session balance delta까지 연결했다.
- long-lived backend가 CLI와 동일한 Anvil 계정을 사용할 때 발생하던 stale nonce를
  제거했다. transaction마다 pending nonce를 조회하고 settlement action을 직렬화했으며,
  E2E가 UI와 동일한 exact quote 제출 및 CLI activity 이후 backend 재체결을 검증한다.
- custom port에서도 동작하는 dashboard same-origin RFQ proxy를 추가하고, backend가
  caller-provided quote의 deployment binding과 maker signature를 재검증하도록
  hardening했다. tampered token quote 거부와 proxy 경유 실제 체결을 live E2E로 확인했다.
- `scripts/demo.sh`는 사용 중인 포트를 사전에 거부하고, 실패한 `--keep` E2E는
  프로세스를 남기지 않도록 정리해 반복 데모의 예측 가능성을 높였다.
- 대시보드의 모든 정적·동적 버튼을 endpoint/상태 전이와 대조하고 연결 회귀 검사를
  추가했다. 체결된 single-use quote의 재실행을 차단하고 Operator API 오류 처리,
  탭 활성 상태와 중복 실행 방지를 보강했으며, 헤더 **?**에서 정상 거래·Security
  demo·live/fixture 경계·버튼별 연결을 바로 확인하는 접근 가능한 presenter guide를
  제공한다. dashboard smoke와 fresh-port BUIDL-like RFQ E2E(setup, settle,
  revoke rejection, state persistence, restore)가 통과했다.
- RFQ MVP dashboard의 준비·상태 확인·quote 요청·검토·Router 체결·maker revoke·
  명시적 restore를 실제 local backend와 온체인 상태에 연결했다. revoke는 restore
  전까지 유지되고 Operator event index에 settlement와 maker false/true 전이가
  기록된다. live quote rate와 추가 maker preview를 제공하되, 외부 market
  feed나 실제 multi-maker 연결이 없는 값은 fixture/preview로 명확히 구분했다. 브라우저에는
  private key가 전달되지 않는다. `scripts/check.sh`
  (641/641 Foundry 포함)과 RFQ-only live E2E가 통과했다.
- `AMM-001`에서 vendored pinned Uniswap v3 core artifact로 canonical factory와
  pool을 배포하고 CREATE2 주소, 초기화, 실제 liquidity mint/swap callback,
  Router-protected ERC-3643 buy/sell을 검증했다. Adapter는 pool token 방향과
  callback positive delta를 binding해 잘못된 token pull을 거부한다.
  `scripts/check.sh`가 Foundry 641/641, 모든 service smoke와 deploy-v3 10/10을
  통과했고 독립 리뷰 지적은 exact compliance reason 회귀로 반영했다.
- `MANIFEST-002`에서 고정 issuance/fund 두 필드 대신 bounded
  `RecipeBinding[]`를 runtime source of truth로 도입했다. required AND,
  path-group OR/그룹 간 AND, non-blocking flag bitmap과 deterministic failure를
  구현하고, `FLAG_ONLY` stateful hook이 settlement를 되돌리지 못하도록
  trade-critical commit에서 분리했다. `scripts/check.sh`(Foundry 634/634, 모든
  service smoke, deploy-v3 10/10)와 `buidl-like`/`reg-d` live E2E(각 7/7 +
  delayed recovery + CLI onboarding + backend RFQ)가 통과했다.
- `DATA-001`에서 per-lot acquisition/완납/lineage를 검증하는 provider-neutral SDK,
  operator-attested on-chain snapshot과 missing/broken/stale/immature를 구분하는
  fail-closed Lockup을 구현했다. `SECONDARY` lot의 과거 lineage 상속을 거부하고,
  cyclic lineage, holder 상태 변경, conflicting replay와 audit 변조 회귀를 고정했다.
  `scripts/check.sh`(Foundry 618/618, 모든 service smoke, deploy-v3 10/10)와
  `buidl-like`/`reg-d` live E2E(각 7/7 + delayed recovery + AMM/RFQ)가 통과했다.
  실제 Securitize API, amount-specific allocation과 production WORM은 외부 계약
  확정 전까지 후속 범위다.
- `PROD-001`에서 `OperatorRegistry`를 global/asset/venue pause source of truth로
  만들고 Router의 nonce/evaluation 전에 fail-closed enforcement를 추가했다.
  unpause와 Manifest resume/update는 owner schedule + 1일 timelock으로 분리했고,
  version/history hash와 governance event를 보존한다. registry ownership이
  Factory로 이전된 실제 배포에서도 schedule이 가능하도록 governance forwarding을
  추가했다. `scripts/check.sh`(Foundry 609/609, 모든 service smoke, deploy-v3
  10/10)와 `buidl-like`/`reg-d` live E2E(각 7/7 + 실제 delayed resume 후 AMM/RFQ)가
  통과했다.
- `DOC-003`에서 ROADMAP의 Toolkit/API/dashboard/live E2E 완료 상태와 production
  후속 범위를 정렬하고 incident-response runbook을 추가했다. 최신 main에서
  `buidl-like`와 `reg-d`가 각각 7/7 scenario, Toolkit preflight/checkpoint,
  backend-signed RFQ settlement와 revoked-maker rejection을 통과했다.
- `OPS-002`에서 GitHub Actions가 local `scripts/check.sh`와 동일한 repository-wide
  gate를 실행하도록 통합했다. Foundry fmt/high-severity lint/build와 582/582 tests,
  RFQ SDK·CLI·demo backend·Toolkit·Operator API/dashboard smoke, vendored deploy-v3
  10/10 tests와 whitespace 검사가 통과했다. deploy-v3 dependency는 vendor directory의
  `yarn.lock`으로만 설치해 격리 경계를 유지한다.
- `OPS-001`에서 production `src`의 Foundry high-severity lint를 local check와
  GitHub Actions에 fail-closed gate로 연결했다. `VenueSelector`의 venue bitmask를
  명시적 `uint256(1)` shift로 고쳐 high-severity warning을 제거했다.
  `forge lint --severity high --deny warnings src`, 전체 Foundry 582/582와
  `scripts/check.sh`가 통과했다. test fixture의 medium/low warning과 Slither는
  후속 warning-budget/security-analysis 범위다.
- `ComplianceEngine`의 pair evaluation과 element collection 상태를
  `ActivePairState`/`ElementAccumulator`로 묶고 recipe별 append를 helper로 분리했다.
  `DecisionHashLib`는 기존 static ABI encoding과 동일한 두 구간 결합으로 stack
  사용량을 낮추고 canonical hash 회귀 테스트를 추가했다. 이에 `via_ir = false`로
  전환했으며 Foundry stable v1.7.1 기준 clean full build(186 files)가 27.96초
  (wall 29.72초)에 통과했다. targeted Engine 23/23, decision hash 1/1과 전체
  `forge test --offline` 582/582가 통과했다. 제품 동작 변경이 없는 내부
  리팩터이므로 live Anvil E2E는 재실행하지 않았다.
- 기존 `DEMO-002` 작업은 `services/rfq-demo-backend` local HTTP quote API와
  CLI `rfq-quote --backend`를 추가했다.
- issue #40 정합화 작업에서 live runner와 CLI에 `buidl-like | reg-d` profile
  선택을 추가하고, BUIDL-like를 기본 데모로 지정했다.
- runner가 backend quote 발급 → CLI 제출 → protected RFQ settlement와
  revoked-maker 거부를 자동 수행하도록 확장했다.
- Foundry v1.7.1 clean build에서 `buidl-like`과 `reg-d` live runner가
  각각 7/7 scenario와 backend RFQ success/failure path를 통과했다.
- backend는 live-Anvil deployment artifact의 maker/pair/venue/RFQAdapter에 고정되고
  RFQ SDK의 fixed pricing, in-memory nonce와 no-op risk fixture를 사용한다.
- 당시 feature에서 production signer custody, persistent nonce, pricing/inventory와
  hosting은 범위 밖이었다. 후속 기준은 ADR-009이며 최종 compliance는 Router fill
  시점에 유지한다.
- `scripts/check.sh` 통과: Foundry 248/248, RFQ SDK, CLI/backend smoke, deploy-v3.
- 기존 Foundry `1.4.0-nightly` build cache의 constructor decode 오류는
  Foundry v1.7.1 clean rebuild로 해소했고, 실제 protected Router walkthrough를 완료했다.
- Toolkit 통합 후 `scripts/e2e-anvil.sh --profile buidl-like`와 `--profile reg-d`가
  각각 실제 artifact preflight와 immutable checkpoint, 7/7 scenario, CLI/backend
  RFQ success와 revoked-maker failure를 통과했다.
- Toolkit config에 governance multisig alias와 required approval 수를 명시하고,
  signer material은 설정에서 제외했다.
