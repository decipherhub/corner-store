# Production release assurance

OPS-004, issue #156. D040-D042 are implemented plan defaults, team-to-confirm.
This document defines release evidence; it does not declare a production release
ready. Automated checks, external audit and operator recovery evidence are
separate requirements. Any missing, failed, stale or mismatched requirement
blocks production release.

## Freeze and bind the evidence

Copy [release-evidence.v1.template.json](./release-evidence.v1.template.json) to
the operator's release evidence directory outside the clean source checkout.
Keep `schemaVersion: 1`. This envelope version is independent of production
deployment evidence version 2. The template is a manual review record, not a
CLI authorization input or an implemented release verifier. No placeholder is
approval. `MISSING` means no acceptable artifact exists; use `FAILED` for a
failed check and `UNVERIFIED` for an unconfirmed claim. Record `PASS` only after
reviewing the actual artifacts. Empty arrays, `TBD` owners and omitted fields do
not waive requirements. Keep overall status `BLOCKED` until all requirements
and the named release reviewer are satisfied.

Freeze a full Git commit after prerequisite integration, with clean provenance,
then run checks against that exact tree. Dirty worktree results are development
evidence only. Record the repository, commit, chain ID, configuration digest,
deployment version 2 `evidenceId` and independently trusted `recordDigest`.
Use the [production verifier](./deployment-production.md#reviewed-evidence-and-operator-commands)
to bind those deployment values; never substitute the release envelope's own
hash. Retain the deployment record and its digest alongside the envelope.

Every artifact reference contains a location and SHA-256 of its exact bytes.
Record commands, exit status, timestamps, tool versions, seed, run/depth counts,
workflow URL/job/result and report hashes. A result from a different commit,
chain or configuration requires a documented scope comparison and renewed
review; do not silently carry forward a green status. Hashes detect substitution
only when their expected values are held independently of the artifact.
Export and review evidence for secrets and PII. Keep private source documents,
credentials and keys outside this envelope and general logs.

## Automated evidence

Provision supported Linux x86_64 or macOS ARM64 hosts with repository-local tools:

```sh
python3 scripts/assurance/install.py
source scripts/assurance/env.sh
python scripts/assurance/verify_tools.py
scripts/assurance/install-deps.sh
python scripts/assurance/install.py --offline
scripts/check.sh
scripts/assurance/run.sh invariants --deep
scripts/assurance/run.sh mutation --deep
scripts/assurance/run.sh e2e-buidl
scripts/assurance/run.sh e2e-reg-d
scripts/assurance/run.sh e2e-context
scripts/assurance/run.sh e2e-identity
scripts/production-container-smoke.sh
scripts/hackathon-monad-container-smoke.sh
```

Use Bash for `source`. The wrapper pins Node 20.20.2 and Yarn 1.22.22 along with
Python 3.12.12, Slither 0.11.6, Foundry 1.7.1 and Solc 0.8.17. All analysis tools,
archives, wheels, venvs and caches live in ignored `.assurance/`. Missing tools
or incomplete analyzer/coverage/mutation output fail closed. Python packages are
hash locked; service installs use their committed lockfiles. See
[tooling details](../assurance/README.md) for offline provisioning and reports.

`check.sh` includes repository checks plus coverage, Slither and PR mutations.
`--repository-only` omits those independent gates and cannot establish a full
assurance pass. The four E2E tasks invoke the existing `e2e-anvil.sh` BUIDL/Reg D,
`e2e-context-provenance.sh` and `e2e-identity-evidence.sh` scripts in separate
workspaces on distinct ports. Container checks also require a running Docker
daemon. A local Docker failure is missing container evidence, not an exemption.

| Evidence | Required review |
| --- | --- |
| Repository and package checks | Build, format/lint, Foundry and services, packed consumers, legacy artifact byte preservation and vendored deploy-v3 |
| Stateful invariants | Eight implemented properties, five real-engine suites, explicit handler selectors, independent ghost models and successful-action counters; Reporter remains pending #161 |
| PR profile | 64 runs x 32 depth per property, fixed seed `0x156`, check after every call, unexpected handler reverts fail |
| Scheduled/manual profile | 1,024 x 128, rotating retained 256-bit seed, counterexamples and named replay regressions |
| Mutation | All reviewed compiling non-equivalent sentinels killed, unchanged mapped baselines pass; compiler errors, timeouts and infrastructure failures are failures |
| Independent analyzer | All production sources and deployment entry points, every shipped Slither detector, raw/normalized findings and individually reviewed suppressions |
| Coverage | Complete production inventory and the floors below, raw and merged LCOV plus compiler adjustment evidence |
| Runtime and containers | BUIDL, Reg D, context and identity Anvil results, both existing container smoke jobs |
| CI | Successful workflow/job URLs for the frozen commit, including required manual pre-release deep jobs and hosting-service required-check configuration evidence |

| Production scope | Minimum line / branch |
| --- | --- |
| execution | 95% / 90% |
| registry | 95% / 90% |
| compliance | 90% / 85% |
| auth, libraries, factory, each separately | 90% / 80% |
| DeployProductionCore.s.sol and ProductionCoreDeployer.sol | 90% / 80% |

Coverage uses `--ir-minimum` only for instrumentation. The EIP-170 size assertion
must pass separately with the production compiler. An unoptimized non-IR
measurement replaces only PredicateValidation's mis-mapped assembly coverage;
both reports remain evidence. Five source-hash-bound non-executable-file
exemptions are reviewed in `assurance/coverage.json`. No executable-line waiver
or reduced floor is implied. Coverage percentages are not a security proof.

Baseline membership does not suppress a Slither finding. Each medium/high
suppression binds detector, source/function fingerprint, severity, rationale,
reviewer, tracking issue and exclusive expiry. The initial reviewer is Codex;
human confirmation is pending. The initial window expires on 2026-12-11.
New/upgraded findings, changed sources, duplicate/stale/expired suppressions,
partial analysis or analyzer errors fail. Low/informational findings stay visible.
The hash-checked Slither overload compatibility casts apply only to disposable
analysis inputs, with original and adjusted hashes retained.

PR jobs target 15 minutes, including provisioning and uploads; deep jobs allow
60 minutes. Local command limits are 14/55 minutes. Hosted runtime acceptance
and branch/release required-check settings require actual hosting-service
evidence. SHA-pinned actions and `ubuntu-24.04` do not freeze hosted image patch
levels. CI retains logs/reports/seeds/hashes for 30 days. Export the reviewed
release package to operator-controlled durable storage before that expires;
the team must confirm production retention/access rules before launch.

The Reporter observational invariant and redaction sentinel cannot be satisfied
by a mock, an exclusion or the other eight invariants. Integrate prerequisite
#161, implement them against the real Reporter, reconcile #160 without editing
its owned test in this task, refresh source-bound artifacts and rerun all gates.
Reporting must remain observational and redact restricted details; aggregate
diagnostics must not be confused with Engine authorization. The supplied stack
also requires #162 and inherited PR merge reconciliation before release.

## External audit evidence

Default: owner and independent reviewer/vendor **TBD before first production
release**, team-to-confirm. No vendor integration is required now. Keep status
**MISSING** until actual artifacts exist. A maintained analyzer is automated
independent analysis; its green output and Codex suppression review are not an
external audit.

Record reviewer/vendor identity, scope and exclusions, frozen audited commit,
dated report and its hash, finding dispositions, remediation commits/diffs,
retest report/hash and independent reviewer sign-off. Reconcile every difference
between the audited and release commits. Unresolved findings or unreviewed
material changes block release. A team member must own scheduling and artifact
collection; no named reviewer, completed audit or remediation is asserted here.

## Chain-specific operator recovery evidence

Default cadence: **before first launch, quarterly, and after material changes**,
team-to-confirm. Material changes include settlement/authorization, governance
delays, evidence lifecycle, deployment/recovery or chain-finality assumptions.
Use the [incident runbook](./operations/incident-response.md) and
[Element replacement runbook](./operations/element-emergency-replacement.md)
for the selected chain. A generic local Anvil E2E is not this drill.

Record chain ID/network, environment and fork height if applicable, deployed
addresses/policy versions, named operators/reviewer, scenario and assumptions,
UTC start/end timestamps, pause and recovery transaction hashes/blocks/receipts,
finality observations, and before/after balances/nonces/surveillance. Reconcile
actor, maker, pool and protocol funds, including known gas/fees and donations.
Record discrepancies and prove safe resumption: authorized delayed recovery,
fresh context/identity/policy evidence, successful settlement and replay/blocked
settlement checks. Bind report, reconciliation and sign-off hashes to the same
deployment identity. An unavailable transaction or unexplained fund delta blocks
completion. Publication journal recovery without rebroadcast does not alone
prove incident recovery of the deployed protocol.

Set status **MISSING** until the chain-specific report and reviewer sign-off
exist. Key management, custody and multisig expansion remain deferred; this
evidence contract adds no new signing system or production transaction authority.

## Current evidence boundary

Local development measurements are in [PROGRESS.md](../PROGRESS.md). OPS-004
remains active while Reporter/prerequisite integration and hosted/container
verification are pending. The template intentionally remains **BLOCKED** with
manual and frozen-release evidence **MISSING**. No external audit, recovery drill,
hosted required-check configuration or production launch is claimed complete.
