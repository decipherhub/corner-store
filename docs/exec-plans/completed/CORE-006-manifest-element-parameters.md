# CORE-006 — Manifest-bound Element Parameters

## Goal

Remove the BUIDL demo's asset-specific minimum amount from immutable Element
bytecode and express it as an auditable, token-scoped Manifest input without
breaking existing manifests or deployed recipe versions.

## Scope

- Add bounded `ElementParameter[]` inputs to Manifest registration/update.
- Compile parameter bytes beside immutable Element rules and commit them into
  each binding plan hash.
- Preserve the existing `IComplianceElement.check` ABI for legacy Elements.
- Add generic `MIN-TRADE-v1` and a standalone minimum-trade Recipe.
- Recompose the BUIDL-like demo from generic Reg D, 3(c)(7), and minimum-trade
  bindings; keep legacy BUIDL v1 contracts only for deployed compatibility.
- Update Factory/demo/testnet wiring, tests, product docs, decisions, feature
  state, and progress.

## Behavior Lock

- Existing manifests with no parameters receive the legacy `abi.encode(ctx)`
  Element context and continue to evaluate unchanged.
- The BUIDL-like demo still rejects regulated-asset trade amounts below
  `5,000,000 ether` and accepts the inclusive boundary.
- Parameter changes require the existing Manifest update timelock and change
  `compiledPlanHashOf(token)`.
- Missing or malformed parameters for `MIN-TRADE-v1` fail closed.

## Verification

1. Targeted registry, Factory, generic minimum, legacy recipe compatibility and
   BUIDL integration tests: 82/82 passed.
2. Full `forge test --offline`: 878/878 passed.
3. Toolkit and CLI build/smoke tests: passed.
4. BUIDL-like Anvil E2E: 7/7 scenarios plus dashboard, bidirectional RFQ, QP
   expiry/recovery and CLI settlement passed.
5. Isolated `/tmp` `scripts/check.sh`: passed after correcting only the
   pre-existing `script/DeployProductionCore.s.sol` formatting drift in the
   disposable copy. The original-tree gate stops at that unrelated drift.
6. Scoped `forge fmt` and `git diff --check`: passed.

## Non-goals

- Rewriting all existing configurable Elements in one change.
- Changing the stable Element interface or normalizing all predicate types.
- Claiming live BlackRock/Securitize BUIDL compatibility.
- Resolving whether a commercial minimum is subscription-only, buy-only,
  post-trade-balance, or per-secondary-trade; v1 preserves current per-trade
  regulated-asset quantity behavior and names it accurately.
