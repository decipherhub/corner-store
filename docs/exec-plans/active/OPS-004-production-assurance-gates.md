# OPS-004: Production Assurance Gates

Issue #156. Approved sequential plan, started 2026-11-11. D040-D042 are adopted
defaults, team-to-confirm. OPS-004 is the sole active feature; it is not passing.

## Goal and boundaries

Add stateful invariants, mutation sensitivity, independent production analysis,
coverage/CI gates and explicit release evidence. Work only in this worktree.
Production contracts, deployed artifacts, public Monad demo paths, external
PR #160's test/integration/Invariants.t.sol, key management, custody, multisig
expansion and vendor integration stay outside this task. No commit, push,
external publication or production broadcast is authorized.

The stack inherits #163-#166 over origin/main 7893021. Prerequisites #161/#162
are absent from this checkout. No merge or history rewrite was attempted.
The real Reporter suite and sentinel require #161; no mock can satisfy them.

## Sequential implementation

1. Stateful suites, commit 51cebdb: Settlement, Replay, Governance, Context and
   Identity with dedicated explicit-selector handlers, real Engine/registry/
   ERC-3643 fixtures, independent ghost models, non-vacuity counters and six
   parameterized fuzz tests. Eight of nine planned properties exist. Keep
   Reporter.invariant.t.sol pending #161. Fixed PR 64 x 32; nightly 1,024 x 128,
   check every call, unexpected reverts fail, retain rotating seeds/failures.
2. Assurance tooling, commit bb23c12: hash-checked isolated mutation harness,
   14 PR/20 expanded compiling sentinels, Slither 0.11.6 with independent baseline
   and reviewed suppressions, complete production coverage and unchanged proposed
   floors, checksum/hash-locked worktree-local tools and CI/E2E isolation.
   Reporter redaction remains explicitly excluded pending its actual source.
   Step 2 measured full coverage and the full nightly campaign; their retained
   artifacts were hash-verified again in step 3. See PROGRESS.md for limitations.
3. Release documentation and full verification: add release-assurance.md and a
   versioned evidence template binding commit/tools/deployment commitments,
   hashes/seeds/workflow results. Record external audit owner/reviewer TBD before
   first production release and chain recovery before launch, quarterly and after
   material changes. Keep artifacts MISSING and release BLOCKED. Update canonical
   feature/decisions/progress/quality/testing/security/production docs; remove
   SLICE_NOTES.md after migrating its durable decisions and verification record.

## Verification and acceptance

Use Bash with `source scripts/assurance/env.sh` for the pinned Node/Yarn/tools.
Run scripts/check.sh plus all four isolated E2E tasks (the existing BUIDL/Reg D,
context and identity scripts), expanded mutations and bounded invariants. Retain
the already completed full nightly evidence rather than claim a second campaign.
Run both existing container scripts; an unavailable daemon is an unmet check.
Inspect actual reports, commands, counts, seeds and hashes. Only the documented
sole RFQ store flake permits one unchanged rerun. Actual results belong in
PROGRESS.md, with no missing check represented as passing.

- [x] Real parameterized fuzz functions and explicit stateful handlers/properties.
- [x] Reviewed compiling sentinel mutations killed, baselines pass (step 2).
- [x] Normalized analyzer baseline and independent per-finding review artifacts.
- [x] Release contract separates automated, external audit and recovery evidence.
- [x] Fresh local repository/coverage/Slither/PR mutations, all four isolated
  E2Es and protected-path/link/template checks; counts in PROGRESS.md.
- [ ] Both container smoke jobs; local Docker daemon is unavailable.
- [ ] Hosted clean-checkout jobs, 15-minute PR budgets and required-check settings.
- [ ] Prerequisite reconciliation and real Reporter invariant/redaction sentinel.

The release template stays BLOCKED until all required matching frozen-release
evidence, external audit/retest and chain-specific recovery/sign-off exist.
These manual artifacts are deliberately MISSING; documenting them does not
claim completion. Do not move this plan to completed or mark OPS-004 passing
while feature verification items remain unmet.

## Known boundaries

No production-chain, external audit, recovery drill or hosting-service
configuration is verified here. Codex is the initial suppression reviewer;
human confirmation is pending. The initial suppressions expire exclusively on
2026-12-11. Coverage uses documented coverage-only compiler adjustments, including
one exact-source supplemental assembly measurement. No production implementation,
compiler setting, threshold or protected demo path changes to satisfy a gate.
