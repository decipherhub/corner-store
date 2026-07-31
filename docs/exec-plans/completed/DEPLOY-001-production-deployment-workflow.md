# DEPLOY-001 — Production Deployment Workflow

## Goal

Implement and document a production deployment workflow that is separate from
the existing local/demo stack.

The workflow must separate demo execution from production core activation and
make external signer, Safe verification, legal policy approval, ERC-3643
onboarding, dry-run/fork simulation, multisig execution and monitoring evidence
explicit.

## In Scope

1. Create `docs/deployment-production.md` as the production deployment runbook.
2. Link the runbook from root and documentation indexes.
3. Align deployment architecture docs with the no-browser-mainnet-broadcast
   boundary.
4. Record the production deployment decision in `DECISIONS.md`.
5. Track `DEPLOY-001` as the only active feature during implementation, then
   mark it passing after verification.
6. Add a core-only Foundry deployment script with no demo token, mock venue,
   fixture account or illustrative legal policy activation.
7. Add CLI/Toolkit production plan, Safe/ERC-3643 preflight, external-signer
   deployment and post-deployment verification.
8. Extend Deployment Studio with production configuration, preflight and plan
   export while retaining the no-browser-broadcast boundary.

## Out of Scope

- executing a production deployment
- claiming deployment verification is passing
- selecting a real Safe provider, custody vendor, RPC vendor or legal counsel
- production RFQ durable nonce, pricing, inventory risk or hosted middleware
- changing Deployment Studio into a production broadcaster

## Required Content

The runbook must cover:

- ERC-3643 and ONCHAINID onboarding as an external issuer trust boundary
- Safe address verification with expected `M` owners and threshold `N`
- external signer and no browser mainnet broadcast
- legal-approved Element, Recipe and Asset Compliance Manifest package
- venue, maker, signer and inventory activation order
- dry-run, fork simulation, multisig proposal and monitoring evidence

## Safety Invariants

- `corner-store.scenario.json` and local Anvil fixtures are demo-only.
- Browser UI may review configuration and evidence but must not hold production
  keys or broadcast production transactions.
- Asset Compliance Manifest activation starts from legal approval, not from demo
  recipe availability.
- ERC-3643 token and ONCHAINID enforcement remain issuer-owned external systems.
- Production authority is verified against Safe address, owner list and
  threshold before any payload is signed.
- No documentation states that production deployment has passed.

## Execution

1. Read required repository guidance and existing deployment docs.
2. Draft the production runbook with required boundaries and activation order.
3. Add the active execution plan.
4. Update README, architecture and docs indexes with links.
5. Update deployment operations and decisions with production activation policy.
6. Update feature/progress state with DEPLOY-001 active only during execution.
7. Add core-only Foundry deployment and ownership-handoff tests.
8. Add Toolkit/CLI production config, plan, Safe/ERC-3643 preflight, external
   signer deployment and post-deployment verification.
9. Add Studio production config, preflight and signer-free plan export.
10. Run targeted and repository-wide verification and record remaining
    production activation dependencies.

## Verification

- Manual cross-document consistency review for deployment, security and feature
  state.
- `forge test --offline --match-path test/unit/deployment/DeployProductionCore.t.sol`
- Toolkit, CLI and Deployment Studio smoke tests
- `scripts/check.sh`
- `git diff --check`
- Link target existence review for new internal links.

## Completion Evidence

- `docs/deployment-production.md` exists and covers the required workflow.
- DEPLOY-001 is passing in `FEATURES.md`.
- `PROGRESS.md` records DEPLOY-001 under Completed and distinguishes tooling
  completion from any real production-chain deployment.
- `DECISIONS.md` records the production deployment boundary.
- root/docs architecture indexes link the runbook.
- production deployment script unit tests pass.
- Toolkit, CLI and Deployment Studio smoke tests pass.
- production post-deployment verification checks code, ownership, operator and
  Router bindings, exact runtime code hashes and release provenance.
- `git diff --check` passes.

## Non-Completion Evidence

The following are not claimed by this plan:

- production deployment transaction success
- Safe proposal execution success
- legal approval of any real policy package
- production RFQ endpoint readiness
- production monitoring live status
