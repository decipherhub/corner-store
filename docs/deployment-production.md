# Production Deployment Runbook

## Purpose

This runbook defines the production deployment workflow for Corner Store
contracts and reference adapters. It separates production core activation from
local demo tooling.

Production deployment is not a browser workflow. Operators prepare validated
configuration, run dry-run and fork checks, submit external multisig payloads,
verify on-chain state, then activate venues, makers, signers and inventory in
staged steps.

## Scope

In scope:

- ERC-3643 token and ONCHAINID onboarding checks before Corner Store activation
- Safe-style governance address verification, expected owner count `M` and
  threshold `N`
- externally controlled deployment and governance signing
- legal-approved Element, Recipe and Asset Compliance Manifest activation
- venue, maker, signer and inventory activation sequencing
- dry-run, fork, multisig proposal and monitoring evidence

Out of scope:

- browser-triggered mainnet or production broadcast
- private key, mnemonic, HSM or remote signer custody implementation
- legal approval of a policy package
- production RFQ pricing, inventory risk, custody or durable nonce hosting
- replacing the issuer's ERC-3643 / ONCHAINID responsibilities

## Production vs Demo

| Area | Demo / local | Production |
| --- | --- | --- |
| Chain mutation | Anvil-only runner and guarded local broadcast | external signer and multisig execution |
| Browser role | local configuration and evidence UI | read-only review only; no mainnet broadcast |
| Scenario data | `corner-store.scenario.json` fixture | not used |
| ERC-3643 identity | fixture trusted issuer and claims | issuer-approved ONCHAINID / trusted issuer system |
| Policy package | illustrative recipes and fixtures | legal-approved Element, Recipe and Manifest package |
| RFQ maker | demo maker and fixed pricing | approved maker account, authorized signer and inventory controls |
| Monitoring | local event index | production indexer, finality and incident runbook |

`services/deployment-studio` is a local control surface. It supports production
configuration, Safe/ERC-3643 preflight and signer-free execution-plan export,
but it must not submit production transactions from the browser.

## Required Inputs

Before any production mutation, collect and freeze:

- target chain ID, RPC endpoint policy and confirmation depth
- approved RPC host list, source commit and deterministic contract bundle hash
- deployment config hash and RFQ integration manifest hash, if RFQ is enabled
- Safe address, expected owner count `M`, expected threshold `N` and owner list
- approved Safe singleton/mastercopy address and Safe proxy runtime code hash
- deployer address or external deployment signer address
- final owner / governance Safe address
- operator address, emergency role address and allowed role transitions
- ERC-3643 token address, identity registry address and trusted issuer evidence
- legal-approved Element, Recipe and Asset Compliance Manifest bundle hash
- venue address set and maker/signer/inventory activation plan
- monitoring, alerting and incident-response endpoints

Do not record secret values in deployment manifests, checkpoints, proposals or
documentation.

## ERC-3643 Onboarding Checks

Corner Store treats ERC-3643 and ONCHAINID as an external trust boundary. The
issuer or its delegated operator must onboard the token and identities before
Corner Store advertises production enforcement.

Required evidence:

- token address, implementation identity and chain ID match the deployment input
- identity registry and claim topics are the issuer-approved production registry
- trusted issuer set is populated by the issuer's governance process
- investor identity claims exist for the intended pilot accounts
- issuer token-level transfer enforcement rejects identities that should not
  receive or send the ERC-3643 asset
- direct token transfer policy is either issuer-enforced, controlled by venue
  design or explicitly documented as outside Corner Store router-mediated
  guarantees
- Corner Store Asset Compliance Manifest refers to the same token and does not
  override issuer identity or token enforcement

Do not use local fixture claims, mock transfer agents or demo identities as
production onboarding evidence.

## Safe And Signer Verification

Production authority must be verified before preparing governance payloads.

The current workflow consumes an **existing Safe**. The operator enters the Safe
proxy address, complete expected owner list (`M`), expected threshold (`N`),
approved singleton/mastercopy address and expected proxy runtime code hash.
Preflight verifies the proxy code hash, `masterCopy()`, singleton code,
`getOwners()` and `getThreshold()` and fails if any live value differs.
Entering these values does not create or reconfigure a Safe. Safe creation or
owner/threshold changes remain a separate Safe-governed operation and must be
completed before this workflow.

Safe verification:

- verify the Safe address on the target chain
- verify Safe bytecode and proxy/mastercopy expectations with the selected Safe
  provider
- verify the owner list exactly matches the expected `M` owners
- verify the threshold exactly equals expected `N`
- verify proposed payload target addresses, calldata, nonce and chain ID before
  collecting signatures
- record the Safe transaction hash or proposal identifier in the deployment
  evidence

Signer verification:

- deployment and governance signing must use an external signer, hardware
  wallet, HSM or approved remote signing boundary
- browser applications must not receive private keys and must not broadcast
  production transactions
- RFQ quote signing must be separated from maker settlement inventory when RFQ
  is enabled
- signer authorization must be checked at fill time through the production
  maker authorizer path
- signer addition must follow governance delay; signer revoke must be available
  as an immediate containment action

## Legal Policy Package

Production activation requires a legal-approved package. Illustrative demo
recipes are not production approval.

For each package, record:

- Element IDs, versions, implementation addresses and source hashes
- Recipe IDs, versions, required Element set and path/flag behavior
- Asset Compliance Manifest version, binding list and full manifest hash
- legal approval reference and approval date
- data-source requirements for each Element
- fail-closed behavior for stale, missing or invalid provider data
- operator responsibilities for attestations, pause, suspend, resume and retire

No Element, Recipe or Manifest should be activated because it appears in a demo
profile. Production activation starts from legal approval, then maps to the
technical package.

## Existing ERC-3643 Asset Onboarding

Entering a token address does not immediately onboard it. The production
**technical wiring preflight** checks that the token, `identityRegistry()` and
`compliance()` addresses have code, and that the Identity Registry exposes
non-zero `topicsRegistry()`, `issuersRegistry()` and `identityStorage()`
dependencies. It does not certify claim topics, trusted issuers or investor
claims. Those require issuer/TA evidence and separate Safe-reviewed onboarding:

1. register the legal-approved Element implementations and versions;
2. register the approved Recipe implementations and versions;
3. construct the token-specific Manifest and `RecipeBinding[]`;
4. register the Manifest for the exact ERC-3643 token address;
5. approve the Manifest through the designated operator;
6. register only approved venues and adapters;
7. configure maker, signer, inventory and allowances for the selected venue;
8. run a compliant settlement and expected-rejection smoke test before opening
   user access.

The Toolkit accepts explicit, versioned production onboarding files. Legacy v1
input remains accepted for local/demo compatibility; production onboarding
should use v2 canonical policy fields such
as
[`services/toolkit/examples/corner-store.production-onboarding.json`](../services/toolkit/examples/corner-store.production-onboarding.json).
It generates deterministic calldata and Safe-compatible unsigned drafts for the
reviewed Element, Recipe, Manifest, venue, maker and signer activation sequence.
The v2 onboarding config must include governance Safe metadata (`safe` and bounded
`requiredApprovals`), an explicit `operatorExecutor`, each Element's default
enforcement action, each Recipe's normalized alias/aliasHash/recipeKey and
required Element set, bounded strengthen-only enforcement overrides, at least one active
venue and at least one read-only inventory requirement. Active RFQ venues additionally require an approved maker,
a signer delegate for an approved maker and inventory for an approved maker:

```sh
corner-store production-onboarding-plan corner-store.production-onboarding.json --out safe-onboarding.json
corner-store production-onboarding-verify corner-store.production-onboarding.json --rpc-url https://approved-rpc.example
```

The plan command creates an immutable JSON output and refuses to overwrite an
existing file. Safe-owner drafts are restricted to `authority == safe-owner` and carry `chainId`,
`safe`, `requiredApprovals`, a deterministic `proposalId`, `expectedArtifactHash`,
`legalPackageHash` and the stable onboarding identity hash. Operator-authority
steps are exported separately as `operatorTransactions` with `chainId`, explicit
`executor`, deterministic `proposalId`, artifact/legal/onboarding identity and a
label; the tool does not assume the Safe is an operator. It never signs, submits, broadcasts, transfers
assets or generates ERC-20 approvals. Inventory activation is represented as a read-only verification
stage that checks balance, allowance and PII-free risk evidence before service
open. V2 plans also include PII-free canonical alias/key commitments and the
compiled plan hash/rules so reviewers can replay exactly what the runtime will
enforce; these technical commitments do not prove legal correctness. The verify
command reads chain state through RPC and fails closed on any
unavailable or mismatched value: ERC-3643 token wiring, Identity Registry
dependencies, governance Safe ownership of safe-owner targets, registered Elements/Recipes, recipe alias/key mapping, Element default action/version hashes,
exact Manifest hash/fields/bindings, compiled plan hash/rules,
ACTIVE Manifest with non-zero declarer/approver, global/asset/venue pause gates,
venue config, maker approval, active signer delegate and inventory minima. A
pending signer delay is reported but is not considered ready.

The tool still cannot infer legal requirements from a token address. The issuer/
legal-approved mapping, PII-free evidence hashes and reviewed onboarding
transactions are required deployment inputs.

## Deployment Flow

1. Freeze release commit, artifacts and production configuration.
2. Verify Safe address, expected `M` owners, threshold `N`, deployer signer and
   operator roles.
3. Verify ERC-3643 token, identity registry, trusted issuers and pilot identity
   claims.
4. Verify the legal-approved Element, Recipe and Manifest bundle.
5. Run deployment dry-run against the target network configuration without
   broadcast.
6. Run fork simulation with the frozen config, expected Safe and expected
   existing contract state.
7. Record a production evidence file containing the current plan `configHash`,
   release `sourceCommit` and `contractsHash`, successful dry-run chain ID, successful fork
   simulation chain ID/block and review timestamp. `production-deploy` rejects
   missing, stale or mismatched evidence.
8. Generate immutable onboarding Safe drafts with `production-onboarding-plan`;
   review target addresses, calldata, stage dependencies, chain ID, Safe address,
   operator executor, required approvals, deterministic proposal IDs, config hash,
   artifact hash, legal package hash and onboarding hash.
9. Execute the core deployment through an external Foundry signer. The script's
   final deployment phase hands all governed contracts to the preflighted Safe;
   it activates no asset or venue.
10. Verify bytecode, owners, roles and complete Router/Engine bindings against
    the production artifact. Verification compares each deployed runtime
    bytecode hash with the hash written by the reviewed deployment script.
11. Execute the reviewed Safe/operator onboarding transactions in order:
    Element/Recipe registration, Manifest registration, Manifest approval, venue
    registration, RFQ maker approval, signer scheduling and owner-only delayed signer execution.
12. Wait the signer authorization delay before executing the signer activation
    transaction; pending authorization is not production-ready.
13. Run `production-onboarding-verify` and stop on any failed read, mismatch,
    safe-owner target owner mismatch, missing operator role, pause/suspension or inventory minimum failure.
14. Start monitoring, indexer finality tracking, alert routing and incident
    response readiness.
15. Record immutable deployment evidence and update the production manifest.

The evidence file has this minimum shape:

```json
{
  "schemaVersion": 1,
  "configHash": "sha256:<production-plan output>",
  "sourceCommit": "<40-character lowercase git commit>",
  "contractsHash": "sha256:<production-source-hash output>",
  "dryRun": {"passed": true, "chainId": 42161},
  "forkSimulation": {"passed": true, "chainId": 42161, "blockNumber": 123456789},
  "reviewedAt": "2026-07-31T00:00:00.000Z"
}
```

[`services/toolkit/examples/production-evidence.example.json`](../services/toolkit/examples/production-evidence.example.json)
is illustrative only. Replace its commit, block, timestamp and config hash with
reviewed evidence from the exact release. `production-source-hash` computes the
deterministic hash of the Foundry source bundle, and `production-plan` prints
the required config hash. `production-deploy` recomputes the source bundle hash
and rejects a different RPC provider host, source tree or evidence file.

## What An Operator Enters

The workflow intentionally accepts existing production addresses rather than
silently creating authority:

- **Existing Safe address**: the deployed Safe proxy that will own Corner Store;
- **Owner list M**: every expected Safe owner address;
- **Threshold N**: the number of owner approvals required (`N <= M`);
- **Safe singleton and proxy code hash**: approved Safe implementation evidence;
- **Deployer address**: the address controlled by the external Ledger or
  Foundry keystore used for the core deployment;
- **Operator address**: the operational role allowed to pause/tighten configured
  surfaces without taking Safe ownership;
- **Existing ERC-3643 token address**: optional asset to inspect before a later
  token-specific onboarding proposal;
- **Approved RPC hosts**: provider hostnames allowed for this reviewed release.

The Studio saves and preflights these values. It does not create the Safe,
change `N-of-M`, sign with an owner, or infer legal policy from a token address.

If any verification step fails, stop activation and record the failed evidence.
Do not proceed by manually editing manifests or bypassing Safe review.

## Activation Order

Use staged activation so each layer can be paused or reverted before exposing
trade flow.

1. Core deployment verified: registries, engine, router and enabled adapters
   have expected bytecode and owner/operator assignments.
2. ERC-3643 onboarding verified: token, identity registry and trusted issuers
   match issuer evidence.
3. Manifest activation: legal-approved Asset Compliance Manifest is registered,
   approved and active with the expected hash/version.
4. Venue activation: venue address and adapter are registered, not paused and
   match the approved profile.
5. Maker activation: maker settlement account is approved only after inventory
   and allowance evidence exists.
6. Signer activation: signer is authorized under the maker authorizer policy and
   linked to the maker account.
7. Inventory activation: maker inventory and allowances are set by the maker/
   operator outside this tool, then verified read-only with risk-evidence hashes
   before accepting production RFQ requests.
8. Monitoring activation: event ingestion, finality policy, alerting and
   incident contacts are live before user-facing enablement.

## Monitoring And Evidence

Minimum monitoring evidence:

- deployment transaction hashes and Safe proposal identifiers
- finality-aware event indexer status and last finalized block
- owner/operator role snapshot
- Manifest status, version and full hash
- venue registry and pause status
- maker approval and signer authorization status
- RFQ nonce/idempotency health if RFQ is enabled
- failed compliance decision audit path without PII
- incident-response contacts and pause/unpause procedure

Monitoring must not log private keys, mnemonic material, raw identity documents
or sensitive transfer-agent payloads.

## Tooling Completion vs Deployment Completion

The repository workflow is complete when:

- this runbook and its source-of-truth links exist;
- the core-only Foundry deployment and ownership handoff tests pass;
- Toolkit/CLI config, plan, preflight, deploy and verify smoke tests pass;
- Studio can save production config, run preflight and export a signer-free
  plan without exposing a production broadcast or key input;
- repository-wide verification passes.

An individual production deployment is complete only after its chain-specific
transaction, Safe proposal, legal package, onboarding, fork simulation,
monitoring and finality evidence exists. Passing repository tooling does not
claim that any mainnet deployment has passed.

## Remaining Production Integrations

The repository now supplies fail-closed core deployment and ERC-3643 asset
onboarding plan/verify tooling, but a real launch still needs organization-
specific implementations and evidence:

1. Safe creation or adoption, owner verification and an approved `N-of-M`
   governance policy;
2. issuer/TA confirmation of claim topics, trusted issuers, investor ONCHAINID
   claims, expiry and revocation behavior;
3. a legal-approved Element → Recipe → Manifest package and reviewed
   `production-onboarding-plan` Safe drafts for the exact token;
4. production RFQ pricing, risk, durable maker-scoped nonce, signer custody,
   inventory and allowance controls;
5. target-chain fork simulation, explorer source verification and deployment
   transaction/Safe proposal review;
6. finality-aware indexing, compliance rejection monitoring, pause/incident
   procedures and audit retention.

Items 2 and 3 are the substantive ERC-3643 onboarding work. A token address
alone proves technical connectivity only; it does not prove that the asset,
issuer claims or investors satisfy the intended legal policy.
