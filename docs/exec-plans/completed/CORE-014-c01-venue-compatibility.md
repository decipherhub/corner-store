# CORE-014 — C-01 Venue Compatibility Guard

## Goal

Make `AMM + C-01-*` an environment-independent invalid configuration while
preserving RFQ execution for holding-period policies and AMM coverage for
policies that do not contain C-01.

## Scope

- Shared Toolkit validation for bundled profiles and exact production recipes.
- CLI onboarding defaults and venue registration.
- On-chain runtime backstop in `ComplianceEngine`.
- Reference/demo split between legal profile bindings and AMM plumbing policy.
- Tests, operator documentation and decision record.

## Implementation

1. Added `policy-compatibility.ts` and reused it from Toolkit config and
   production onboarding validation. Schema v1 AMM onboarding fails closed;
   schema v2+ inspects the exact bound Recipe elements.
2. Changed bundled `buidl-like`/`reg-d` defaults and direct CLI onboarding to
   RFQ-only.
3. Added Factory onboarding and Engine runtime checks over compiled rules. The
   Factory rejects either an AMM venue or an AMM Manifest bit with C-01; any AMM
   evaluation whose bound element ID begins with `C-01-` returns a deterministic
   unsupported-venue reason before element execution.
4. Added `DemoAmmReferenceRecipe`, explicitly excluding C-01, for AMM adapter
   and lifecycle plumbing tests. Real Reg D RFQ integration continues to use
   the full Recipe including C-01.
5. Updated the live demo so selected Reg D/BUIDL profiles run RFQ-only throughout.
   The C-01-free AMM reference Recipe remains isolated to integration coverage.

## Verification

- Red/green Toolkit test for bundled profile rejection and production
  onboarding rejection.
- Engine tests for current C-01, future C-01 family versions, C-01-free AMM and
  Reg D RFQ behavior.
- Affected integration suites, CLI/Toolkit smoke, full repository check and
  both profile E2E runs.

## Out of Scope

- Changing legal meaning or evidence requirements of C-01.
- Removing AMM support from Corner Store generally.
- Treating the demo AMM Recipe as a production legal profile.
