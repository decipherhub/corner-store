# EXEC-002: Venue-Authoritative Execution Context

## Goal

Authenticate policy context before evaluation through opt-in RouterV2/RFQ v3
deployments, preserving legacy signatures, events, API responses and public Monad.
Tracks issue #157 and decisions D028/D029.

## In Scope

- Venue context verifier, registration evidence and reviewed immutable activation
- Actual-sender current A-06 evidence commitment and explicit flow constraints
- RFQ v3 ordered EIP-712 type/domain and newly deployed AMM context binding
- SDK/module/coordinator, opt-in host/CLI and onboarding schema 6 support
- Compatibility/migration specs, isolated live v3 fixture and full delivery gates

## Out of Scope

- Public deployment/artifact changes or automatic migration of existing traffic
- Key management, multisig/custody expansion or proxy-aware activation
- Partial fills, delegated AMM, redemption and per-asset affiliate context
- Independent factual verification of A-06 operator attestations
- Changes to recipes, existing events or the C-01-family/AMM prohibition

## Steps

1. Provenance foundation: RouterV2 preflight, separate registry evidence and shared
   ContextEvidence, with targeted Router/Registry/evidence tests and build.
2. Venue implementations: RFQAdapterV3 and AMM context validation, bidirectional
   real ERC-3643/canonical Uniswap integration, signed-field/lifecycle/rollback
   regressions and full offline Forge tests.
3. SDK/onboarding: explicit v3 exports/capabilities, schema 2 coordinator recovery,
   opt-in host/CLI, schema 6 activation order/verifier and packed consumers.
4. Delivery: isolated `scripts/e2e-context-provenance.sh`, ownership/wire/migration
   documentation, D028/D029, feature/progress records and all delivery gates.

## Acceptance Evidence

| Criterion | Proof |
| --- | --- |
| Field ownership and both directions | Provenance spec matrix; real ERC-3643, canonical Uniswap and live v3 E2E |
| Disagreement rejected before evaluation | RouterV2/RFQ v3 mutation and ordering tests; mined live mismatch receipts |
| EIP-712 migration | Exact type/domain tests, v2/v3 cross-rejection and packed consumers |
| AMM authority | Target/venue/seller, membership/token-order tests and schema 6 verifier |
| Current affiliation | Sender-specific evidence, refresh/revoke/expiry/decay and dual-status tests |
| Delivery | Full repository gate, two legacy Anvil profiles and isolated v3 gate |
| Monad preservation | Protected-path diff and unchanged v2 runtime tests |

Actual final commands/counts are recorded in the 2026-11-11 session entry in
`PROGRESS.md`. Live Anvil gates remain manual, matching the existing CI boundary.
The six defaults in the provenance spec remain open for team confirmation.
