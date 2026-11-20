# CORE-016 Provider-neutral asset enforcement

## Goal

Implement issue #168 without changing the existing B-02-v2 meaning, local demo
profiles or deployed ERC-3643 reference flows.

## Scope

1. Define a bounded `IAssetEnforcement` request/result contract.
2. Add opt-in B-02-v3 with adapter/version/code/config commitments owned by
   `ManifestPolicyConfig` rather than mutable Element storage.
3. Wrap B-02-v2 for ERC-3643 and add a clearly labelled reference allowlist
   adapter proving the boundary is provider neutral.
4. Add onboarding schema 8 validation, export evidence and live drift checks.
5. Prove direction, amount, outage, malformed response and drift behavior.

## Non-goals

- Selecting a production issuer, TA, KYC provider or ATS.
- Migrating existing B-02-v2 Manifests automatically.
- Adding credentials or partner-private APIs.
- Claiming protection for settlement paths that bypass Corner Store.

## Stop condition

Targeted Solidity/Toolkit tests, required E2E profiles and `scripts/check.sh`
pass while existing public demo paths remain byte-for-byte unchanged.

## Outcome

Completed on 2026-11-21. `B-02-v3` delegates asset-owned transfer restrictions
through a bounded provider-neutral interface, while the adapter address,
capability version, runtime codehash and asset-specific configuration digest are
owned by immutable Manifest policy bytes. The existing `B-02-v2` path and public
demo deployments remain unchanged.

Toolkit onboarding schema 8 enforces exact agreement between readable adapter
declarations and `ManifestPolicyConfig`, rejects reference-only production
exports and verifies deployed adapter code/version/binding. `scripts/check.sh`
passed with 1,223 Foundry tests and all service, package, clean-project and
deployment gates. Both `buidl-like` and `reg-d` Anvil E2E profiles passed their
seven scenarios and interactive RFQ flows.

No production provider, custody system, credentials or live-network deployment
was selected or verified. Those remain operator integration and independent
security-review responsibilities.

