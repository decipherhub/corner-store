# SDK Package Versioning and Migration

Corner Store publishes three independent npm package boundaries:

| Package | Public contract |
| --- | --- |
| `@corner-store/cli` | project creation, doctor, deploy/verify and conformance commands |
| `@corner-store/toolkit` | versioned configuration, onboarding plans and Safe exports |
| `@corner-store/rfq-service` | RFQ types, modules, coordinator and conformance helpers |

## Semantic Versioning

All three packages use SemVer. A patch release may fix implementation defects
without changing accepted inputs or observable output shapes. A minor release may
add optional fields, exports or commands while preserving existing behavior. A
major release is required for removed/renamed exports, newly required config,
changed wire/calldata meaning, or stricter behavior that rejects previously valid
inputs.

Schema and capability versions are separate from npm versions. Changing a
schema/capability requires an explicit parser or adapter and tests for both the old
and new versions; an npm version bump alone must never reinterpret persisted data.
CLI, Toolkit and RFQ releases are tested as a compatible set, but consumers may pin
them independently when their declared schemas and capabilities match.

## Release Gate

Before publishing, run package tests and `scripts/sdk-product-smoke.sh`. The smoke
test builds tarballs, installs all three packages in temporary clean projects,
imports the Toolkit package, runs RFQ conformance through the generated project,
executes CLI doctor/deploy dry-runs, and builds the packaged contract bundle. No
step may resolve package code through a repository-relative path.

## Migration Guide

1. Pin current package versions and preserve the current config, integration and
   deployment evidence files.
2. Read the target release notes for npm, schema and capability version changes.
3. Upgrade one package boundary at a time in a clean branch; do not edit persisted
   schema numbers manually.
4. Apply the documented config adapter or regenerate a project and transfer only
   operator-owned values. Never copy secrets into generated files.
5. Run package tests, `corner-store doctor`, RFQ module conformance and the SDK
   product smoke before deployment planning.
6. Compare generated calldata/Safe proposals and post-deployment expectations.
   Governance review is required before submission.
7. Roll back by restoring the pinned packages and preserved inputs. On-chain
   registrations remain immutable and require a new version rather than rebinding.

Version `0.x` packages remain pre-1.0: any incompatible public change still needs
a documented migration and a minor-version bump at minimum. Production operators
should pin exact versions and promote only artifacts that passed the release gate.

### RecipeRegistry exact-version lookup migration

Recipe implementation lookup no longer exposes `recipeOf(uint16 recipeId)` or
`recipeOf(uint16 recipeId, uint16 version)`. Consumers must resolve the immutable
compatibility alias and then request the Manifest-bound exact version:

```ts
const recipeKey = await recipeRegistry.recipeKeyOf(binding.recipeId);
const implementation = await recipeRegistry.recipeOf(recipeKey, binding.recipeVersion);
```

A zero key or zero implementation is a fail-closed configuration error. Catalogs
may read `latestRegisteredVersionOf(recipeKey)`, but that value is display and
upgrade-discovery metadata only. It must be labelled separately from the active
Manifest version and must never select an execution implementation. Upgrading an
asset requires the normal Manifest semantic-update, review, timelock and activation
lifecycle; registering a new Recipe version alone has no effect on active policy.

### Element metadata and onboarding schema v3 migration

`ElementMetadata` now commits `evidenceType` and `defaultEnforcement`. This is a
contract ABI change: regenerate ABI/types and deploy a new immutable Element and
Registry set rather than treating an older deployment as compatible. Element
registration fails when evidence type is `UNSPECIFIED` or an explicitly supplied
default action differs from metadata.

Production onboarding schema v3 requires every Element entry to declare its
PII-free evidence source class. Schema v1 and v2 inputs remain parseable under
their original meanings; the Toolkit does not silently add evidence types to old
files. Migrate by copying a reviewed v2 file, setting `schemaVersion` to `3`,
adding one of `TRANSACTION_CONTEXT`, `ONCHAIN_STATE`, `PROVIDER_ATTESTATION` or
`COMPOSITE` to each Element, regenerating metadata hashes and running the read-only
production verifier. The verifier compares both evidence type and metadata default
against live Registry metadata before activation material is accepted.

### RFQ EIP-712 v2 policy binding migration

RFQ quote schema and EIP-712 domain version changed from `1` to `2`. `RFQQuote`,
`RFQQuoteRequest` and `RFQQuoteIntent` now require a `bytes32 policyId` immediately
before `nonce`. Existing v1 signatures cannot be replayed as v2 signatures and must
not be translated or re-signed without issuing a fresh quote.

Production hosts must resolve `policyId` from a trusted on-chain
`ComplianceEngine.policyHashesOf(regulatedToken)` path after authentication and
rate limiting. The client does not choose this field. Settlement compares the
signed value with the fresh `ComplianceDecision.policyId` and rejects a mismatch.

Migration steps:

1. deploy/use the v2 RFQAdapter and regenerate ABI/types;
2. add the host `resolvePolicyId` integration and fail closed on RPC/read errors;
3. pass the resolved value through coordinator persistence and signing;
4. expire or cancel outstanding v1 quotes rather than converting them;
5. run RFQ SDK/host conformance, Foundry RFQ tests and a Router settlement E2E.
