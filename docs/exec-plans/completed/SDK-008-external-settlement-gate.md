# SDK-008 External Settlement Gate and OMS Precheck

## Goal

Deliver issue #169 as one stable integration path for an existing ATS/OMS while
preserving every existing Router and demo path.

## Scope

1. Add an internal Router dispatch seam with the legacy adapter call as default.
2. Add the external settlement target interface, gate and reference one-shot target.
3. Prove authoritative context, direct-call rejection, atomic measurement/commit,
   pause/replay/max-amount and concurrent-precheck behavior in Foundry.
4. Add PII-free advisory OMS precheck and deterministic unsigned activation plus
   verification to the public Toolkit.
5. Add a packed clean-project integration/conformance path and update product,
   architecture, security, testing and progress documentation.

## Constraints

- No changes to deployed demo contracts, scripts or public testnet state.
- No new dependency.
- No mixin or Uniswap v4 hook in this feature.
- The target must not implement `IExecutionAdapter`.
- One active feature only.

## Verification

- Targeted Forge and Toolkit tests after each implementation slice.
- Packed clean-project install/build/conformance.
- `scripts/check.sh`.
- Existing `buidl-like` and `reg-d` Anvil E2E because Router base changes.
- `git diff --check` and independent review before PR.

## Exit

Move this plan to `completed/`, mark `SDK-008` passing and record exact evidence in
`PROGRESS.md` only after all required checks pass.
