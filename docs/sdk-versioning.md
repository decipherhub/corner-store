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
