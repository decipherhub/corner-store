# Opt-in identity policy topology

Status: DATA-004 step 1, issue #159, intended decision D031. Evidence acceptance
and integration are later steps of the approved plan. This is an enforcement
configuration contract, with no judgment about an operator's legal obligations.

Schema 7 production onboarding adds `recipes[].identityPolicy` for recipes that
require `A-04-v2`:

```json
{"track": "RFQ", "kycTopology": "DIRECT"}
```

Both fields are explicit. `track` is `RFQ` or `TSV`. RFQ has no default topology;
TSV is fixed to `DIRECT`. Missing, unknown and `MEMBER` topology values are
rejected. Full MEMBER institution/attestation support is deferred to P2, including
wallet-level sanctions screening in both modes. This slice adds no sanctions
behavior.

The declaration must match the binding's existing `ManifestPolicyConfig` entry.
The shared Manifest and RecipeBinding ABI tuples do not change:

| Field | Value |
| --- | --- |
| Element ID | `bytes32("A-04-v2")` |
| Parameter schema ID | `keccak256("corner-store.element.identity-policy.v1")` |
| Parameter schema version | `1` |
| Parameters required | `true` |
| Maximum/exact parameter bytes | `64` |
| Encoding | `abi.encode(uint8 track, uint8 kycTopology)` |
| Track values | `1 = RFQ`, `2 = TSV`; all other values rejected |
| Topology values | `1 = DIRECT`; `0`, `2 = MEMBER` and all other values rejected |

Decoders check the full words and exact byte length, including dirty high bits
and trailing bytes. The Toolkit exports `IdentityPolicyInput`,
`IDENTITY_POLICY_ELEMENT_ID`, `IDENTITY_POLICY_SCHEMA_ID`,
`IDENTITY_POLICY_TRACK`, `KYC_TOPOLOGY`, `encodeIdentityPolicyParameters` and
`decodeIdentityPolicyParameters`. The CLI uses the same parser and planner in
`production-onboarding-plan`, including REGISTER and UPDATE exports.

Every binding that includes A-04-v2 must be `REQUIRED_BLOCKING`, with A-04-v2's
`BLOCK` enforcement. FLAG_ONLY and PATH_OPTION bindings cannot carry this gate:
an alternate successful recipe must not bypass the declared identity policy.
Other recipes may retain their normal composition semantics. The registry
validates every A-04-v2 parameter at registration and update scheduling, including
mixed legacy/new binding sets. Invalid input reverts without changing active or
pending state. Valid updates use the existing timelock and atomic activation.

Schema 7 retains every schema 6 execution-context check, activation dependency
and verifier read. Audit artifacts commit the declaration through exact parameter
bytes, their hash and the compiled plan hash. Detached or modified track/topology
commitments fail artifact validation. No separate uncommitted topology field is
added to the audit artifact.

Schemas 1 through 6 retain their existing meaning and cannot opt into A-04-v2 or
`identityPolicy`. Schema 7 identity recipes use A-04-v2 explicitly; substituting
A-04-v1 is rejected. A-04-v1's ABI, automatically seeded legacy claim behavior,
existing recipes and published RFQ v2 deployments remain unchanged.

The step 1 A-04-v2 implementation is a fail-closed topology foundation. Even valid
DIRECT parameters return A-04-v2 reason 2 (missing accepted evidence). There is no
accepted-evidence setter or trading integration in this slice. Step 2 adds the
separate evidence record and lifecycle before any v2 activation; step 3 supplies
the opt-in recipe and settlement verification. No v2 deployment is performed by
step 1.
