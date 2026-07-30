# DEMO-013 — Deployment-to-DEX Showcase Handoff

## Goal

Connect the production core deployment implementation to the existing RFQ DEX
showcase without presenting mock token, identity, policy or inventory setup as
production activation.

## In Scope

1. Reuse `DeployProductionCore.deployCore()` from the reference `DeployStack`.
2. Keep demo-only ERC-3643, Mock TA, policy, venue and inventory activation
   visibly separate from core deployment.
3. Add one versioned showcase configuration for profile, scenario, mode and
   local runtime ports.
4. Add plan and run entry points that expose the exact preparation order.
5. Make deployment artifact lineage and local-rehearsal boundaries explicit.
6. Document the operator walkthrough from deployment through DEX settlement.

## Out of Scope

- using mock identities or fixtures on a production chain
- browser-based production signing
- automatically deriving a legal policy from an ERC-3643 token address
- reusing local Anvil addresses in a production deployment
- production RFQ pricing, custody, inventory or monitoring

## Execution Order

1. Validate showcase config and demo scenario.
2. Start a clean local Anvil runtime.
3. Deploy the production core contract set through its public deployment seam.
4. Activate demo-only ERC-3643/ONCHAINID, policy, venues, maker and inventory.
5. Write and verify the exact deployment artifact.
6. Onboard the selected demo asset profile.
7. Start RFQ backend, Operator API and Dashboard from the same artifact.
8. Execute successful and expected-rejection settlement scenarios.

## Verification

- `scripts/showcase.sh --plan`
- `forge test --offline --match-path test/unit/deployment/DeployProductionCore.t.sol`
- `scripts/e2e-anvil.sh --profile buidl-like --mode rfq`
- `scripts/check.sh`
- `git diff --check`

## Outcome

- production and demo scripts share `ProductionCoreDeployer.deployCore()`
  without broadcasting an on-chain script helper.
- `scripts/showcase.sh` validates the versioned inputs and prints or executes the
  complete preparation order.
- the deployment artifact supplies core lineage and exact addresses to the RFQ
  backend and Dashboard.
- Deployment Studio can start, open and stop the DEX services after verification;
  the first start reuses the CLI onboarding flow to activate the selected demo
  Manifest and venues on that deployment, then the services consume the same
  project artifact, scenario and deployment RPC rather than deploying a second
  stack. Later runtime restarts do not repeat onboarding.
- the local BUIDL-like RFQ E2E proved successful buy/sell settlement, repeated
  liquidity and the ineligible-investor, expired-claim, maker-revocation and
  direct-adapter rejection paths.
- full repository check passed with Forge 669/669 and deploy-v3 10/10.
