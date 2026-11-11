# SDK Package Versioning and Migration

Corner Store publishes three independent npm package boundaries:

| Package | Public contract |
| --- | --- |
| `@corner-store/cli` | project creation, doctor, deploy/verify and conformance commands |
| `@corner-store/toolkit` | versioned configuration, purpose templates, policy facade, onboarding plans and Safe exports |
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
imports the Toolkit package, runs the policy facade and RFQ conformance through the generated project,
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

### Production onboarding schema v5 migration

Schema v5 is additive and does not reinterpret v1-v4 inputs. Use it when a policy
contains `ManifestPolicyConfig` parameters or when exporting a semantic UPDATE.

1. add `lifecycle` with `REGISTER` version 1, or `UPDATE` with the intended next
   version, previous artifact hash, non-zero reason code and expected post-status;
2. copy each live Element parameter capability from reviewed Registry metadata and
   declare whether the object is newly registered;
3. add schema v1 `policyConfig`, including exact bytes only for the binding/Element
   pairs that accept or require them;
4. create and store an artifact whose lifecycle, previous hash, compiled plan and
   parameter bytes match the config;
5. regenerate the immutable Safe plan rather than editing v4 calldata;
6. for UPDATE, run the pre-activation verifier after scheduling and the normal
   production verifier after delayed activation/checkpoint.

Do not change only the schema number: v5 deliberately fails closed when lifecycle
or Element capability data is absent.

### Opt-in identity evidence / onboarding schema 7 migration

DATA-004 adds explicit versions without publishing a package. npm versions stay
`0.1.0`; package SemVer, provider SPI, onboarding schema, Element and Recipe
versions are independent.

| Boundary | Preserved path | Explicit identity opt-in |
| --- | --- | --- |
| Identity Element | A-04-v1, five-field KycClaim ABI and seeded legacy claims | Separately deployed A-04-v2 with `IIdentityEvidenceV2` evidence and issuer trust |
| Provider SPI / records | SPI 1.0.0, v1 hashes and persisted records | SPI 2.0.0, schema 2 records, HMAC v2 domains, provenance and optional LEI |
| Compliance-data imports | Root v1 names, `/spi`, `/demo`, `/conformance` | Explicit v2 names at root or `/v2`, `/spi-v2`, `/demo-v2`, `/conformance-v2` |
| Onboarding | Schemas 1-6 retain their meanings | Schema 7, per-recipe identityPolicy, required exact A-04-v2 parameters; inherits schema 6 context checks |
| Recipe | Existing versions, including Reg D v3 / A-04-v1 | Reg D family 1 version 4 / A-04-v2; REQUIRED_BLOCKING and BLOCK |
| Acceptance calldata | Legacy setters remain unchanged | Separate `acceptEvidence` selector `0x9b3e5df6` and explicit Toolkit v2 codecs |
| RFQ quote / public demo | Existing RFQ v2/v3 schemas and Monad v2 deployment | No new quote schema or public deployment required by DATA-004 |

1. Preserve v1 stores, deployments, recipes and artifacts. Do not relabel a v1
   hash/record as v2: the store validators reject the other record shape. Refresh
   from the provider under SPI 2.0.0 with explicit operator acceptance.
2. Load exactly one local key using `CORNER_STORE_KYC_HMAC_KEY` or
   `CORNER_STORE_KYC_HMAC_KEY_FILE` in compliance-data. Inject its hashing
   capability into adapters/coordinator/store/translator. There is no unkeyed
   fallback, operator-api key dependency or automatic key rotation.
3. Register the separate Element/Recipe and prepare schema 7 with explicit
   RFQ/TSV track and DIRECT topology. Schemas 1-6 cannot select A-04-v2;
   schema 7 identity recipes cannot substitute A-04-v1. Commit the 64-byte
   parameter encoding in the existing ManifestPolicyConfig and audit artifact.
4. Use normal REGISTER or delayed UPDATE proposal/activation and read-only
   verification. Bind wallets, configure issuer trust, export and submit new
   acceptance calldata. Never infer accepted evidence from an identity binding.
   Configure bilateral evidence explicitly when required.
5. Run all DATA-004 gates in `testing.md`. Obtain fresh policy-bound RFQ quotes
   after activation; registering a newer Recipe alone changes no active policy.
   Rollback uses reviewed routing and the existing policy lifecycle, never
   rewriting v2 records, downgrading hashes or silently changing a Manifest.

Current trust-basis equality is checked on every trade. Removing/changing issuer
trust invalidates evidence; restoring the exact basis can re-enable an unexpired
record. Revoke individual records explicitly when reinstatement is unwanted.
The reference store is in-process; production must preserve its conflict and
monotonic revocation semantics transactionally. Key management, multisig and
custody remain deferred. See the [P2 schedule](./product-specs/identity-p2-schedule.md)
for MEMBER, pseudonyms, cards and jurisdictional sanctions bundles.

### Opt-in execution context / RFQ v3 migration

EXEC-002 adds new exports and deployments without changing legacy defaults.
Current development package versions are still `0.1.0`; these changes do not
publish packages. Apply the release policy above before publishing a version.

| Boundary | Legacy | Explicit opt-in |
| --- | --- | --- |
| Router deployment | `ExecutionRouter`, existing ABI/order | Separate `ExecutionRouterV2`, preflight before evaluation |
| RFQ deployment/domain | `RFQAdapter`, CornerStoreRFQ version `2` | Separate `RFQAdapterV3`, CornerStoreRFQ version `3` |
| Quote type/calldata | `RFQQuote`, `(RFQQuote,bytes)` | `RFQQuoteV3`, `(RFQQuoteV3,bytes)`; ordered `flowType` and `affiliateEvidenceHash` before nonce |
| Adapter/context capability | No provenance requirement | RFQ adapter `3` / context `1`; newly deployed AMM adapter `2` / context `1` |
| Venue ABI | Existing `VenueConfig` | Same tuple, separate `VenueContextEvidence` and implementation approval APIs |
| SDK builders | `domain`, `typedData`, `RFQQuoteService`, `createRFQService` | `domainV3`, `typedDataV3`, `RFQQuoteServiceV3`, `RFQBackendSDKV3`, `createRFQServiceV3` |
| Module signing | Existing `signerModule` and capabilities | `signerModuleV3`, `RFQ_V3_MODULE_CAPABILITIES`, explicit `rfq.sign.eip712.v3` |
| Module composition/conformance | Existing module helpers | `createRFQServiceV3FromModules`, `runRFQV3ModuleConformance` |
| Coordinator records | Schema 1 | Schema 2, `quoteVersion: 3`, exact domain and context evidence |
| Local store container | Legacy-only writes remain schema 1 | Reads 1/2; first v3 reservation writes container 2, retaining legacy records/accounting |
| Host route | `/rfq/quote`, unchanged v2 response | `/rfq/v3/quote` only with `config.v3`; requires `flowType`, derives policy/evidence server-side |
| Production bootstrap/config | Contract `1.0.0` / config `1` | Same versions plus `v3_context_provenance: true`, v3 dependencies and ready `context` component |
| CLI | Existing quote commands/artifacts | `rfq-v3-quote --request <file>` and explicit v3 artifact addresses |
| Onboarding | Schema 1-5 under original meanings | Schema 6 with Router/runtime, immutable context and source authority evidence |

The exact EIP-712 field order, domain and evidence encoding are defined in
[`product-specs/execution-context-provenance.md`](./product-specs/execution-context-provenance.md).
V2 and v3 signatures cross-reject; never reinterpret old calldata or signatures.

1. Preserve pinned v2 artifacts, packages and outstanding quotes. The live public
   Monad stack, `services/testnet-rfq-demo` and existing host route stay on v2.
2. Use `createContextDeploymentPlan` to prepare unsigned constructor intents for
   separate RouterV2/RFQAdapterV3 and, if needed, a new UniswapV3Adapter. Review
   immutable adapter/source/registry implementations and ownership first.
3. Use `createContextOnboardingTemplate` with explicit schema 5 input and new
   bindings to produce schema 6. `parseLegacyProductionOnboardingConfig` accepts
   only schemas 1-5; those parsers reject v6-only fields. The packaged v6 example
   contains placeholders and is not activation evidence.
4. Wire the Engine and adapter to the new Router, complete every pool edit, then
   register venues, approve implementation versions/runtime hashes and pin the
   final post-configuration commitment. Activate makers after pinning. Re-pin
   all venues on an AMM adapter after any later `setPool` operation.
5. Verify post-state using `verifyVenueContext` and the schema 6 production
   verifier. Provide current trusted A-06 claims for actual senders on every
   regulated leg. Missing or unavailable reads stop activation/signing.
6. Install an `OnchainRFQContextResolver` with `ethersContextReader` (or an
   explicitly reviewed custom resolver), v3 signing/module/coordinator and the
   optional host route. `affiliateEvidenceCommitment` provides the same encoding
   as Solidity. Run the v3 conformance suite before enabling the route.
7. CLI artifacts must explicitly contain `routerV2`, `rfqV3Adapter`, `rfqV3Venue`
   and `affiliateSource`, with `venueReg`/`policyReg`. Legacy fields do not imply
   v3 support. Request JSON uses raw integer amount strings. `--auth-env` can
   name a local bearer-token environment variable for the host path.
8. Run the full repository and three manual Anvil gates in `testing.md`, plus
   packed-consumer smoke, before routing traffic. Expire/cancel legacy quotes;
   obtain fresh v3 quotes instead of converting records or signatures.

V3 RESERVED recovery revalidates exact domain/version, current evidence and the
reserved nonce before signing. Changed/missing/unavailable context revokes the
reservation and releases inventory. PUBLISHED replay returns the identical
persisted quote without re-signing; it can subsequently fail on chain if evidence
changed. To return to v2, restore pinned routing/packages/artifacts and reconcile
outstanding v3 records separately; do not downgrade a schema 2 store by hand.
Reference signing uses one local env/file key; key management, multisig and
custody expansion remain deferred. The six team-to-confirm defaults remain open
in the provenance specification and D028/D029.
