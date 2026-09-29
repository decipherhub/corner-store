# CORE-013 — RWA Flow Direction and Surveillance Authorization

## Goal

Resolve the immediately actionable findings 1, 2, and 10 from issue #132
without mutating the semantics of already-versioned Element IDs.

## Scope

- Add a shared context decoder for the regulated asset's actual `from` and `to`.
- Introduce `C-01-v2` so holding-period evidence follows the RWA transfer source.
- Introduce `B-02-v2` so ERC-3643 balance, recipient, and `canTransfer` probes use
  the actual RWA direction for both buys and sells.
- Introduce `F-02-v2` with owner/operator-gated threshold changes.
- Add an immutable Reg D recipe version that binds the new Element versions.
- Permit primary-distribution lockup exemption only when the flow marker and the
  optional Manifest-bound actual RWA distributor both match.
- Enable B-02-v2 live wiring in reference, integration and public-testnet deployment
  paths and prove that a post-onboarding wiring change fails closed.
- Move reference/demo deployment and tests to the new versions while preserving
  the old contracts for historical deployments.

## Out of Scope

- Primary-distribution lockup policy.
- Production TA data-source selection or live ERC-3643 wiring activation.
- The remaining findings and questions in #132.
- Changes to other developers' open PRs #130 and #131.

## Verification

- Targeted new Element/Recipe suites: 39/39 pass.
- Engine: 44/44; RFQ integration: 9/9; canonical Uniswap v3: 5/5 pass.
- Full Foundry: 942/942 pass.
- CLI smoke and full `scripts/check.sh` pass, including clean SDK consumer and
  deploy-v3 10/10.
- BUIDL-like and Reg-D Anvil E2E: each 7/7 scenarios plus dashboard/CLI/RFQ
  buy/sell flows pass.
- `git diff --check` pass.

## Result

Completed. Reference, local demo, public-testnet RFQ and CLI profile paths now
bind Reg D recipe version 3 and B/C/F v2 Elements. Legacy v1 contracts and decode
tables remain available for historical deployments. Primary-distribution policy
and the remaining issue #132 findings stay explicitly out of scope.
