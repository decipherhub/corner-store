# DEPLOY-004: Complete and Append-Only Production Evidence

Issue #154. Started 2026-11-11. Decisions D037-D039 are adopted plan defaults,
team-to-confirm. DEPLOY-004 is passing after the required gates below.

## Goal and boundaries

Bind every production implementation/build/wiring input to reviewed version 2
evidence, publish complete artifacts exclusively, and preserve legacy readers.
Scope is production evidence, packaging, publication, verification and docs.
Deployed contracts, public Monad artifacts/runtime/infrastructure, key management,
custody, multisig expansion and external vendors are outside scope.

The user authorized three sequential slices on the supplied stack. Remote main
remains 7893021ecc001041cdf6ee44f22de0d88909c932 at the step 3 check. Prerequisite
PRs #161/#162 and the inherited stack still need merge sequencing before release.
No commit, push, GitHub comment or external publication is authorized here.

## Execution and acceptance criteria

1. Source/build/provenance identity, completed in c38d9d5. Resolve the actual
   production compiler inputs, including ProductionCoreDeployer and transitive
   sources; bind normalized manifest bytes, orchestration, tool/dependency/build
   settings and bytecode templates with canonical domain-separated SHA-256.
   Capture Git state explicitly; dirty/source-only/unavailable cannot broadcast.
   Build captured isolated inputs and verify package/runtime copies. AC1-2.
2. Exclusive publication and recovery, completed in 652cc70. Reserve before
   signing/broadcast, stage privately, verify receipts/addresses/compiled bytecode
   and ownership/operator/wiring/Safe, fsync/close and hard-link exclusively.
   Journal recovery revalidates without signing/rebroadcast or final replacement.
   Version 2 verify requires reviewed identity and trusted record digest. AC3-5.
3. Document decisions and examples, protect compatibility and run full gates.
   Keep version 1 example/readers; add diagnostic version 2 example. Snapshot and
   enumerate existing public records, read exact bytes with existing CLI/Operator
   API, assert unchanged bytes without live-chain readiness. Update deployment
   runbook, testing, FEATURES/DECISIONS/PROGRESS and remove SLICE_NOTES.md. AC6-7.

## Verification

Tests first for new behavior and compatibility. Earlier focused gates passed:
57 Toolkit and 17 CLI named tests plus smokes; packed consumer 50 assertions
(10 package/runtime commitment and 40 live production checks); production Forge
4 tests; standalone SDK consumers 8 Foundry and 6 version assertions. These are
prior-slice results, not substitutes for this slice's full gate.

Run all five commands through
`npx --yes -p node@20 -p yarn@1.22.22 -c '<command>'`:

- `scripts/check.sh` including packed production dry-run/fork/deploy/verify and
  public-artifact compatibility regression.
- `scripts/e2e-anvil.sh`
- `scripts/e2e-anvil.sh --profile reg-d`
- `scripts/e2e-context-provenance.sh`
- `scripts/e2e-identity-evidence.sh`

Then run `git diff --check`, compare protected paths to the branch base and
confirm no unrelated changes. Only the known isolated RFQ store flake permits
one unchanged rerun. Mark passing and move this plan to completed only after
all gates pass. Actual commands/counts/results belong in PROGRESS.md.

## Limitations

No production-chain execution/readiness claim. Ledger/hardware signing, real
power-loss durability and filesystems other than this host remain unverified.
Repository/package/runtime source/build equality does not make their differing
Git provenance identities equal. The v2 example is source-only and cannot
substitute for reviewed clean Git evidence.

## Completion evidence (2026-11-11)

All gates passed on their first full invocation. `scripts/check.sh` passed
1,171 Foundry tests across 70 suites, 58 Toolkit and 17 CLI named tests,
50 packed production assertions, two public compatibility tests, service smokes,
external consumer checks and 10 deploy-v3 tests. Both legacy Anvil profiles
passed 7/7 scenarios plus runtime flows; context passed 12/12 and identity 40/40.
The documented RFQ flake did not occur. PROGRESS.md records exact commands,
counts and log paths. Whitespace/protected-path checks passed, and slice notes
were removed after transfer. D037-D039 remain team-to-confirm defaults.

New step 3 coverage consists of two public artifact listing/reader/byte-preservation
cases and one legacy/v2 example broadcast-boundary regression. No deployed core
contract or protected demo path changed. No production-chain broadcast, commit,
push or external publication was performed. Prerequisite merge sequencing and
the unverified operational boundaries above remain release limitations.
