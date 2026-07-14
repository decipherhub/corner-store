# ADR-007: Accept PD-1~PD-7 architecture decisions

Date: 2026-07-14

## Status

Accepted

## Context

Phase 1 requires implementation-level agreement on the structural decisions that shape Manifest schema, Recipe evaluation, post-trade state, identity claims, enforcement actions, governance, and lifecycle controls.

These decisions are architecture-level foundations. They should be recorded separately from BUIDL-like demo work and RFQ/API implementation work.

## Decision

Corner Store accepts PD-1~PD-7 as the Phase 1 architecture baseline.

### PD-1: Manifest schema and extensibility

Use an explicit `ManifestCore` for stable, human-readable asset state, and move policy-specific requirements into registry-backed `RecipeBinding` entries.

- `ManifestCore` keeps only common core fields.
- New regulatory policies should not require adding fixed fields to `ManifestCore`.
- Policy requirements are attached through `RecipeBinding[]`.
- Recipe identifiers should move toward canonical `bytes32 recipeKey` values managed by a registry.
- Raw recipe keys should not be exposed directly to normal users/operators.
- Onboarding should use curated profiles, validation, and simulation.
- Trade-time execution should use a precompiled compliance plan, not dynamic alias/key resolution.

Open implementation details:

- canonical recipe key naming convention
- `factsPacked` bit layout ownership
- gas-bound caps such as max recipes and max elements per evaluation
- exact compiled plan struct shape

### PD-2: Multi-Recipe evaluation model

Use a Manifest-level multi-Recipe binding model.

Recipes define reusable compliance checks. A Manifest decides how each Recipe is applied through `RecipeBinding`.

`RecipeBinding` must support:

- `REQUIRED_BLOCKING`: mandatory blocking checks. Multiple required recipes are evaluated as AND.
- `PATH_OPTION`: alternative compliance paths. Recipes with the same `pathGroupId` form an OR group. Each path group passes if at least one recipe in that group passes. Multiple path groups are combined as AND across groups.
- `FLAG_ONLY`: non-blocking surveillance, reporting, or warning checks. Failure does not block execution but must be logged or surfaced.

Failure reporting must use deterministic `reasonCode` severity, not array order. Binding priority may be used only as a tie-breaker if needed.

The current `issuanceRecipeId + fundRecipeId` layout is transitional. The target model is `RecipeBinding[]`.

### PD-3: Post-trade state model and commit semantics

Use a dual-path state model with post-trade commit.

- Acquisition timestamp is anchored to successful token transfer.
- Router execution timestamp is recorded separately as execution context.
- Reliance logs use event-first recording with minimal on-chain commitment hashes.
- Post-trade commits are idempotent by `executionId`.
- Replaying the same commit with the same `commitHash` is a no-op.
- Reusing the same `executionId` with different commit data must revert.

### PD-4: Investor qualification claims and TA integration

Use the ERC-3643/T-REX identity model as the primary interface for investor qualification.

Corner Store should not invent a separate AI/QP identity model. AI, QP, KYC, AML, sanctions, and similar investor facts should be represented as required claim topics checked through the ERC-3643-style identity pipeline:

- Identity Registry resolves wallet to ONCHAINID.
- Claim Topics Registry defines which claim topics are required for a token/profile.
- Trusted Issuers Registry defines which issuers may issue those claims.
- ONCHAINID/IERC735 claims provide topic, issuer, signature, data, and URI.

Claim topic direction:

- AI and QP are explicit claim topics in the project-level claim topic registry.
- Use ERC-3643-compatible `uint256` claim topic identifiers.
- Do not assume AI/QP topic numbers are globally standardized.
- Initial project topics are `ACCREDITED_INVESTOR = 1001` and `QUALIFIED_PURCHASER = 1002`.

Expiry/freshness direction:

- Claim data should include `issuedAt` and `expiresAt` where the issuer provides structured data.
- Elements may also apply max-age/freshness rules by claim type.
- If an external issuer does not expose structured expiry data, the adapter must define how freshness is derived or mark the integration as unsupported for production.

Fixture and TA integration direction:

- Tests should use a generic ERC-3643-style TrustedIssuer fixture.
- BUIDL-like demos may label that fixture as a Securitize-like Transfer Agent profile for explanation only.
- The fixture must not imply real Securitize compatibility unless an actual integration adapter is implemented and verified.
- Securitize/DS Protocol integration should be supported through an adapter boundary, not by replacing the ERC-3643 identity model.
- Actual Securitize/TA integration is deferred to a follow-up refinement issue because it requires official/current details for issuer addresses, claim/topic mapping, revocation, expiry, and production authorization.

### PD-5: Enforcement actions and result handling

Use an explicit enforcement action model with a small closed set of core actions for v1.

V1 core actions:

- `BLOCK`: failed result blocks execution.
- `FLAG_ONLY`: failed result does not block execution. The finding must be surfaced through flags and events.
- `OPERATOR_REVIEW`: v1 treats this as blocking. Pending execution or delayed approval is out of scope for v1.

Default action and override:

- Elements define default enforcement actions.
- `RecipeBinding` may override enforcement only through constrained override modes.
- Override changes how an Element result is applied; it does not modify the Element logic itself.
- Accepted override modes are `USE_ELEMENT_DEFAULT`, `ESCALATE_TO_BLOCK`, `ESCALATE_TO_OPERATOR_REVIEW`, and `FORCE_FLAG_ONLY`.
- Escalation is allowed by default.
- Downgrading a blocking result to `FLAG_ONLY` is governance-restricted and must not be available through normal onboarding.

`evaluate()` should return both blocking status and non-blocking findings:

```solidity
struct EvaluationResult {
    bool allowed;
    uint16 blockReason;
    uint256 flagsBitmap;
    bytes32 evaluationHash;
}
```

Enforcement overrides must be resolved into a bounded compiled plan at registration/update time. Trade-time evaluation must not perform dynamic recipe compilation or unbounded override resolution.

Core actions are intentionally not open-ended because each action has execution semantics the Router must understand. Future extensions should first use `reasonCode`, `actionDetail`, or `flagsBitmap`. New execution semantics require a versioned extension and explicit Router support.

### PD-6: Governance, timelock, and emergency authority

Use a role-separated governance model with multisig, timelock, and emergency guardrails.

Signer configuration:

- Governance authority is assigned to an external Safe-style multisig.
- Corner Store contracts should not implement `n-of-m` signer logic directly.
- Signer set and threshold changes are handled by the multisig itself without Corner Store contract upgrades.
- V1 operational target is `2-of-3` for practicality.
- Production regulated deployments should consider `3-of-5` or stronger separation across protocol, compliance, legal, operations, and external/audit roles.

Governance principle:

- Tightening or stopping risk may be immediate.
- Relaxing compliance, reopening execution, or expanding trust must require timelock.

Emergency pause reason codes:

- `SECURITY_INCIDENT`
- `COMPLIANCE_INCIDENT`
- `IDENTITY_OR_CLAIM_FAILURE`
- `LEGAL_REQUEST`
- `MARKET_INTEGRITY`
- `OPERATOR_ERROR`
- `OTHER`

Immediate actions are limited to tightening or stopping risk:

- global pause
- asset pause
- venue pause
- issuer disable
- enforcement escalation

The following require multisig plus timelock:

- unpause
- compliance relaxation
- trusted issuer addition
- required claim removal
- recipe removal
- `BLOCK` to `FLAG_ONLY` downgrade
- router / engine / registry replacement
- manifest major version changes

All governance actions must emit append-only events with actor, old value, new value, reason code or reason hash, and effective time.

### PD-7: Lifecycle versioning, pause, and record preservation

Use a versioned lifecycle and record-preservation model.

Manifest versioning:

- Manifest version increments when compliance semantics change.
- Non-semantic metadata changes are tracked separately.
- Compliance semantic changes include `RecipeBinding` changes, required claim topic changes, TrustedIssuer changes, enforcement action changes, supported venue/engine changes, and manifest major profile changes.

Lifecycle history events should use structured reason codes plus optional reason hashes.

Recommended lifecycle reason codes:

- `REGULATORY_UPDATE`
- `LEGAL_REQUEST`
- `ISSUER_UPDATE`
- `CLAIM_TOPIC_UPDATE`
- `RECIPE_UPDATE`
- `VENUE_UPDATE`
- `SECURITY_INCIDENT`
- `COMPLIANCE_INCIDENT`
- `IDENTITY_OR_CLAIM_FAILURE`
- `OPERATOR_ERROR`
- `MIGRATION`
- `OTHER`

All Corner Store DEX executions must enter through an approved Router. The Router is the primary enforcement point for global, asset, and venue pause checks.

Pause state should be stored in a central `PauseController` or lifecycle registry so future routers/adapters share the same source of truth.

Intended split:

- Router: execution entrypoint and pause enforcement point.
- PauseController / lifecycle registry: pause state and lifecycle history source of truth.

On-chain record preservation is limited to critical state, hashes, and append-only events:

- current manifest version
- current manifest hash
- old/new manifest hash events
- reasonCode
- reasonHash
- actor
- effective time
- execution / reliance commit hash

Full manifest documents, recipe details, legal/compliance memos, claim evidence, operator tickets, and indexer-exported transaction reports are preserved off-chain and anchored by hashes.

## Consequences

- PD-1~PD-7 are no longer open structural questions for Phase 1; remaining work is implementation specification and follow-up issues.
- Current code that still uses transitional structures, such as `issuanceRecipeId + fundRecipeId`, should be migrated through separate implementation work.
- Securitize/TA integration remains an adapter/refinement issue, not a hard dependency of the Phase 1 architecture baseline.

## References

- [Phase 1 structural decisions](../architecture/phase1-structural-decisions-proposed.md)
- [Decision register](./decision-register.md)
- [ERC-3643 Claim Topics Registry](https://docs.erc3643.org/erc-3643/smart-contracts-library/onchain-identities/claim-topics-registry)
- [ERC-3643 Trusted Issuers Registry](https://docs.erc3643.org/erc-3643/smart-contracts-library/onchain-identities/trusted-issuers-registry)
- [ERC-3643 ONCHAINID Interface](https://docs.erc3643.org/erc-3643/smart-contracts-library/onchain-identities/onchainid-interface)
- [Securitize DS Protocol Compliance Service](https://medium.com/securitize/ds-protocol-the-compliance-service-b6fe472d625d)
