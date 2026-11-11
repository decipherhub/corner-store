# Production Deployment Runbook

## Purpose

This runbook defines the production deployment workflow for Corner Store
contracts and reference adapters. It separates production core activation from
local demo tooling.

Production deployment is not a browser workflow. Operators prepare validated
configuration, run dry-run and fork checks, submit external multisig payloads,
verify on-chain state, then activate venues, makers, signers and inventory in
staged steps.

Production RFQ host and read-only Operator API packaging, dependency injection,
health/readiness and OCI release gates are defined separately in
[`production-containers.md`](./production-containers.md). Deploying those images
does not replace the activation evidence in this runbook.

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
- ComplianceEngine/Registry and exact Recipe/Element implementation addresses plus
  expected runtime code hashes for final policy execution binding
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

- core deployment uses the existing local Foundry account outside the browser;
  governance execution uses the configured existing Safe. Key management,
  custody and multisig expansion remain deferred
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
- Recipe IDs, versions, implementation addresses/runtime code hashes, required
  Element set and path/flag behavior
- Asset Compliance Manifest version, binding list and full manifest hash
- legal approval reference and approval date
- data-source requirements for each Element
- fail-closed behavior for stale, missing or invalid provider data
- operator responsibilities for attestations, pause, suspend, resume and retire

The current supported production profile uses immutable ComplianceEngine,
Registry, Recipe and Element implementations. CREATE2 expected addresses are
pre-deployment review aids only; activation evidence must include deployed runtime
code hashes. Proxy deployments require a separate approved implementation-slot
verifier and are not covered by the current readiness claim.

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
input remains accepted for local/demo compatibility, and v2/v3 remain readable for
existing canonical Recipe/enforcement plans. New production registration must use
v4 or v5 stored policy-audit readiness fields. Parameterized registration and
semantic update must use v5. The v3 example remains the base policy
configuration shape:
[`services/toolkit/examples/corner-store.production-onboarding.json`](../services/toolkit/examples/corner-store.production-onboarding.json).
It generates deterministic calldata and Safe-compatible unsigned drafts for the
reviewed Element, Recipe, Manifest, venue, maker and signer activation sequence.
The v3 onboarding config must include governance Safe metadata (`safe` and bounded
`requiredApprovals`), an explicit `operatorExecutor`, each Element's default
enforcement action and evidence type, each Recipe's normalized alias/aliasHash/recipeKey and
required Element set, bounded strengthen-only enforcement overrides, at least one active
venue and at least one read-only inventory requirement. Active RFQ venues additionally require an approved maker,
a signer delegate for an approved maker and inventory for an approved maker.

Before rendering a v4 plan, build and store the canonical PII-free artifact. Set
the onboarding config's `artifactHash` to the printed `sha256:<digest>` and
`manifest.fullManifestHash` to the printed `0x<digest>`. The artifact must carry
the same config/legal/compiled-plan, Manifest, binding/override, Element/Recipe
and deployment runtime-code commitments. Full schema and reconciliation details
are in [`policy-audit.md`](./policy-audit.md):

```sh
corner-store policy-audit-build policy-audit.input.json --out policy-audit.json
corner-store policy-audit-store policy-audit.json --store ./policy-audit-store
corner-store policy-audit-verify policy-audit.json --store ./policy-audit-store
corner-store production-onboarding-plan corner-store.production-onboarding.json \
  --audit-artifact policy-audit.json --audit-store ./policy-audit-store \
  --out safe-onboarding.json
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
exact Manifest hash/fields/bindings, compiled plan hash/rules, nonzero live
policyId/version for v4,
ACTIVE Manifest with non-zero declarer/approver, global/asset/venue pause gates,
venue config, maker approval, active signer delegate and inventory minima. A
pending signer delay is reported but is not considered ready.

### Schema v5 parameter policy and UPDATE export

Schema v5 adds an explicit `lifecycle`, immutable Element parameter capabilities,
per-object `register` intent and a bounded `policyConfig`. The Toolkit rejects
missing required parameters, schema mismatches, non-member Elements, duplicate
entries, per-Element size violations and more than 16,384 total parameter bytes
before any calldata is exported. Parameterless Elements use zero capability and
remain compatible through an empty config.
An UPDATE also declares `expectedPostStatus`: use `SUSPENDED` for incident
replacement and `ACTIVE` only for an already-active routine update. Verification
does not treat suspension as failure when the reviewed lifecycle expects it.

For `UPDATE`, the reviewed audit artifact must use the same intended policy
version, `previousArtifactHash`, compiled plan and exact parameter bytes. The Safe
lane contains only new immutable Element/Recipe registrations and
`scheduleManifestUpdate`; the operator lane contains delayed activation followed
by the audit checkpoint. Existing venue, maker and signer activation is not
silently replayed. The plan reports parameter byte count, exact Manifest calldata
size and the worst-case calldata-only gas bound; this is not an execution-gas or
target network fee quote.

```sh
corner-store production-onboarding-plan corner-store.production-policy-update.json \
  --audit-artifact update-policy.json --audit-store ./policy-audit-store \
  --out safe-policy-update.json

corner-store production-policy-update-preactivation \
  corner-store.production-policy-update.json --rpc-url https://approved-rpc.example

corner-store production-onboarding-verify \
  corner-store.production-policy-update.json --rpc-url https://approved-rpc.example
```

The input shape is illustrated by
[`services/toolkit/examples/corner-store.production-policy-update.json`](../services/toolkit/examples/corner-store.production-policy-update.json).
Its hashes and addresses are placeholders, not approval evidence.

The tool still cannot infer legal requirements from a token address. The issuer/
legal-approved mapping, PII-free evidence hashes and reviewed onboarding
transactions are required deployment inputs.

#### BUIDL-like profile boundary

The local `buidl-like` reference profile uses generic `MIN-AMOUNT-v1` through
recipe family 3 version 2 and supplies `5,000,000` demo units with
`BuidlLikeDemoAsset.demoPolicyConfig()`. That helper is intentionally demo-only.
Do not copy its value into a production config. A production BUIDL-related
activation must use schema v5 with issuer/legal-approved parameter semantics,
legal package hash and a stored matching policy-audit artifact. Until those
inputs exist, no production activation plan is valid; the demo passing does not
change that fail-closed boundary.

## Deployment Flow

Before production release, complete the separate
[release-assurance evidence contract](./release-assurance.md). Its
[version 1 template](./release-evidence.v1.template.json) binds the clean frozen
commit/toolchain and workflow/report hashes to this runbook's deployment evidence
version 2 `evidenceId` and trusted `recordDigest`. It is a manual review record,
not a CLI authorization format. Missing/failed evidence blocks release.

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
7. Record version 2 reviewed evidence containing the exact plan `identity` and
   `evidenceId`, `configHash`, release `sourceCommit`/`contractsHash`, successful
   dry-run chain ID, fork chain ID/block and review timestamp. Rebuild and compare
   the evidence before signing. Production broadcast requires clean Git provenance.
8. Generate immutable onboarding Safe drafts with `production-onboarding-plan`;
   review target addresses, calldata, stage dependencies, chain ID, Safe address,
   operator executor, required approvals, deterministic proposal IDs, config hash,
   artifact hash, legal package hash and onboarding hash.
9. Execute the core deployment through an external Foundry signer. The script's
   final deployment phase hands all governed contracts to the preflighted Safe;
   it activates no asset or venue.
10. Before publication, verify successful canonical receipts, receipt-derived
    addresses, transaction inputs/order, compiled creation/runtime bytecode,
    owners/operators, Safe and complete Router/Engine bindings. Independently
    retain the printed `recordDigest` for subsequent `production-verify` calls.
11. Execute the reviewed Safe/operator onboarding transactions in order:
    Element/Recipe registration, Manifest registration, Manifest approval, policy
    audit checkpoint, venue
    registration, RFQ maker approval, signer scheduling and owner-only delayed signer execution.
12. Wait the signer authorization delay before executing the signer activation
    transaction; pending authorization is not production-ready.
13. Run `production-onboarding-verify` and stop on any failed read, mismatch,
    safe-owner target owner mismatch, missing operator role, pause/suspension or inventory minimum failure.
14. Start monitoring, indexer finality tracking, alert routing and incident
    response readiness.
15. Record immutable deployment evidence and update the production manifest.

Every later Manifest suspend/resume/update/retire operation must be followed by
`recordPolicyAuditCheckpoint(token)` and indexed reconciliation. A missing
checkpoint is an operations incident and blocks readiness claims; the event does
not replace the underlying Manifest lifecycle authority.

### Version 2 source, build and provenance contract

New production deployments require evidence version 2. The production config
schema remains version 1; it is distinct from the evidence/envelope version.
`production-source-hash` resolves the production entry point's actual offline
compiler inputs, including `script/ProductionCoreDeployer.sol` and all transitive
Solidity sources. It requires the pinned Forge/Solc toolchain, even for diagnostics.

The source manifest binds normalized relative paths, exact byte lengths/hashes,
`foundry.toml`, explicit remappings, CLI/Toolkit/RFQ orchestration sources,
package preparation, service manifests/lockfiles/tsconfigs and compiler Standard
JSON input. Missing/duplicate paths, symlinks, escaping imports/remappings and
unsupported compiler profiles fail closed. Only the explicit default Foundry
profile and pinned Solc are supported; inherited build overrides, dotenv, global
Foundry configuration and automatic remappings are excluded.

The build commitment records Forge, Solc, Node and TypeScript versions and
executable/package hashes, installed runtime dependency bytes, executed JavaScript,
compiler settings (optimizer, via-IR, EVM, metadata and libraries) and creation/
runtime bytecode templates with link/immutable references. Compilation uses a
captured isolated workspace; the manifest is rechecked before execution. Package
and runtime copies preserve and verify the same source/build commitments.

Git provenance is explicit: `clean`, `dirty`, `source-only` or `unavailable`.
Staged, unstaged, untracked and recursive submodule changes participate in its
commitment. Every captured input must also match its HEAD blob, including inputs
under committed submodule gitlinks. This comparison reads raw blob and working
bytes without filters or index flags, so `assume-unchanged`, `skip-worktree` and
ignored inputs missing from HEAD cannot grant clean provenance. A bundle without
Git metadata is source-only even if its config
claims an upstream commit. Only the reviewed clean Git-backed source can authorize
broadcast. Diagnostics and unsigned exports may represent the other states.
Changing provenance changes evidenceId even when source/build hashes agree.

One domain-separated canonical SHA-256 `evidenceId` binds source/build/provenance,
canonical config, deployment ID, chain and deployer/governance/operator/venue
wiring. The final envelope additionally carries the complete source/build
commitments, original script artifact, its `artifactDigest`, transaction inputs
and receipts. `recordDigest` binds that record without circular self-hashing.
These commitments establish input identity, not policy approval.

### Reviewed evidence and operator commands

Keep the source release clean and the consumer config/evidence outside that
source tree. Set `release.sourceCommit` and `release.contractsHash` from the
source-hash result, then generate the plan and unsigned export using the same
Node/Forge/Solc/dependency environment:

```sh
corner-store production-source-hash --contracts /path/to/clean-release
corner-store production-plan corner-store.production.json \
  --contracts /path/to/clean-release --out unsigned-core.json
corner-store production-preflight corner-store.production.json
```

Run the printed signer-free plan command from the clean contract source root
using the pinned default profile/toolchain, against the approved RPC and a
reviewed fork. Record the actual successful runs. Construct the reviewed file by
copying the exact plan fields, without editing its identity:

```js
const review = {
  schemaVersion: 2,
  configHash: plan.configHash,
  sourceCommit: config.release.sourceCommit,
  contractsHash: config.release.contractsHash,
  identity: plan.identity,
  evidenceId: plan.evidenceId,
  dryRun: {passed: true, chainId: config.network.chainId},
  forkSimulation: {passed: true, chainId: config.network.chainId, blockNumber},
  reviewedAt: new Date().toISOString()
};
```

The example
[`production-evidence-v2.example.json`](../services/toolkit/examples/production-evidence-v2.example.json)
is illustrative source-only evidence with placeholder commitments. Its shape is
readable but it cannot authorize broadcast. Replace it with actual reviewed plan
fields and execution results. The original
[`production-evidence.example.json`](../services/toolkit/examples/production-evidence.example.json)
remains a legacy version 1 example; it cannot authorize a new deployment.

Use the existing locally stored Foundry account. Key management, custody and
multisig expansion remain deferred; no vendor is required. Existing Safe owner,
threshold and singleton checks still apply. Hardware signer support is not part
of the verified release evidence.

```sh
corner-store production-deploy corner-store.production.json \
  --contracts /path/to/clean-release --account release-deployer \
  --password-file /path/to/local-password-file --confirm production-deploy
corner-store production-verify corner-store.production.json \
  --contracts /path/to/clean-release \
  --expected-record-digest 'sha256:<independently-retained-record-digest>'
```

Treat the digest placeholder as a value to replace and quote for the shell.
Retain the deployment/review digest independently; copying a digest from an
untrusted artifact provides no trusted expected identity. Verification rebuilds
local commitments, compares reviewed evidence, checks the record/artifact digests
and validates chain/addresses/receipts/bytecode/wiring. Missing or mismatched
inputs fail closed. Supplying a version 2 digest cannot downgrade verification
to the legacy path. Legacy artifact readers retain their original schema and
verification path, without acquiring version 2 guarantees retroactively.

### Exclusive publication and recovery

Production deployment rejects an occupied final path and exclusively reserves
its destination before signing or broadcast. Each operation uses a unique sibling
0700 staging directory and durable immutable journal events. Before reservation,
the output directory and every existing ancestor must be owned by the current
uid or root. Neither the output nor staging directory may be group- or
world-writable. Ancestors may have these write bits only with the sticky bit set,
as on `/tmp`, which prevents other users from renaming/deleting operator-owned
entries. Foreign ownership is rejected even with the sticky bit. Missing output
directories are checked again after creation and before reservation. The same
checks cover staging ancestry and run again before publication and recovery;
errors name the offending path. Application symlinked ancestry stays rejected;
the existing macOS `/tmp` and `/var` system aliases also have their `/private`
target ancestry checked. A changed staging directory identity is rejected. The
Solidity script writes only `deployments/production-core.candidate.json` in the
captured workspace.
Production bypasses the shared reference runtime cleanup path.

This is an explicit filesystem trust boundary similar to OpenSSH StrictModes.
Publication is safe against other local principals under these owner/mode
preconditions, with root trusted. Concurrent processes running as the operator's
own uid are outside the threat model because they already hold the operator's
signing material. Node has no fd-based `linkat`/`unlinkat`; inode checks alone
cannot make path-based operations safe against writers within that trust boundary.

The complete envelope is exclusively created with no-follow semantics and mode
0600, then fsynced. Publication opens it without following symlinks and validates
bytes read from that descriptor, keeping the descriptor open across the exclusive
hard link. The final entry must be a regular file with the descriptor's device,
inode and size. A mismatch removes the created entry only if its identity still
matches the observed entry and the output directory and its ancestry pass the
trust checks again. This cleanup and its parent fsync are best effort; failure
preserves the original publication error and may leave an entry for investigation.
The identity observation and unlink are separate path operations, so cleanup does
not protect against same-uid replacement immediately before unlink. Parent fsync,
staging-link removal and another fsync complete successful publication. Replacing
rename is forbidden. Unsupported hard-link/fsync semantics fail closed. Proposal,
Safe, onboarding, policy and production plan exports use the same publisher;
imported signed bytes are preserved exactly by the raw-byte Toolkit publisher.

A failure before linking leaves no final artifact. A crash after linking leaves
the journal for revalidation; recovery never trusts a final name alone. A staged
envelope must remain available until the complete journal event is durable.
Recovery refuses symlinks and mismatched file identities and never replaces an
occupied final, even when its bytes match. Existing files and application symlinks
are never replaced. Inspect the printed operation journal path after a failure:

```sh
corner-store production-recover corner-store.production.json \
  --contracts /path/to/clean-release --operation /path/to/retained-operation
```

Recovery rebuilds reviewed commitments and revalidates staged evidence, receipts
and current chain state. It may retrieve missing receipt snapshots by recorded
transaction hash. It publishes or completes cleanup only after verification;
it never signs, automatically rebroadcasts or rewrites a final. Incomplete or
unavailable evidence leaves the operation unresolved. Retain the journal and
captured workspace for investigation. Local crash/fault tests do not establish
power-loss durability on other filesystems.

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
   approved and active with the expected hash/version. Read
   `policyHashesOf(token)` and archive its logical hash, execution binding hash and
   final policy ID.
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
- logical policy hash, execution binding hash and final policy ID for each active
  regulated token, with runtime code-hash verification evidence
- venue registry and pause status
- maker approval and signer authorization status
- RFQ nonce/idempotency health if RFQ is enabled
- failed compliance decision audit path without PII
- incident-response contacts and pause/unpause procedure; Element 구현 결함은
  [`operations/element-emergency-replacement.md`](./operations/element-emergency-replacement.md)의
  immutable version 교체와 delayed resume 절차까지 사전 승인한다.

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
monitoring and finality evidence exists, together with successful matching
automated assurance, independent external audit/remediation/retest and
chain-specific recovery-drill/sign-off artifacts. Audit owner/reviewer are TBD
before first production release; drill cadence is before first launch, quarterly
and after material changes (adopted defaults, team-to-confirm). Those manual
artifacts are currently MISSING and production release remains BLOCKED. Passing
repository tooling does not claim that any mainnet deployment has passed.

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
