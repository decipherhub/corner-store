# Provider-neutral asset enforcement

## Product boundary

Corner Store owns venue-level policy evaluation. An asset-enforcement adapter
reports whether the asset's own transfer machine would allow the authoritative
`from -> to` settlement amount. The adapter does not define legal policy and an
unavailable, malformed, unsupported or drifted adapter never produces an allow.

`B-02-v3` receives one canonical 128-byte `ManifestPolicyConfig` value:

```text
(adapter address, interface version, runtime code hash, binding digest)
```

These bytes are compiled into the Manifest policy plan and change only through
the normal proposal/timelock/activation lifecycle. There is no separate mutable
adapter registry in the Element. Runtime evaluation also binds the exact request
and result with `keccak256(abi.encode(asset, from, to, amount, contextHash))`.

## Implementations

- `Erc3643AssetEnforcement` wraps the existing `B-02-v2` Element. Its binding
  digest commits the legacy Element address/code and the asset's declaration,
  Identity Registry, compliance module and token implementation commitment.
- `ReferenceAllowlistAssetEnforcement` proves the same interface without
  ERC-3643-specific fields. It is reference-only and production onboarding
  export rejects configurations that mark an adapter `referenceOnly=true`.

Provider credentials, private APIs and production vendor selection remain
outside the public repository. ERC-3643/ONCHAINID and any future issuer/TA
adapter remain external trust boundaries.

## Failure disclosure

Public decisions expose only four bounded classes: unavailable/malformed,
binding drift, unsupported capability and asset transfer rejected. They do not
publish identity, sanctions, compliance-module or provider payload details.

