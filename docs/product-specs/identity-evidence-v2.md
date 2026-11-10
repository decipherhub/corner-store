# Operator-accepted identity evidence v2

DATA-004, issue #159 decisions 25, 26 and 28, D032, D033 and D035. This opt-in
version preserves A-04-v1, SPI v1, their persisted records and all existing recipes. Trading integration and named settlement invariants are
specified in [identity-settlement-binding.md](./identity-settlement-binding.md).
The topology contract remains
[identity-policy-topology.md](./identity-policy-topology.md).

## On-chain enforcement

`IdentityUniquenessV2` implements `IIdentityEvidenceV2`. Governance can authorize
operators through the existing `Governed` boundary. Only operators or the owner
can bind/unbind identities, change issuer trust, accept/revoke evidence, set
identity/dedup status or enable counterparty checks. Binding is one wallet per
identity and one identity per wallet. Binding never creates evidence. Unbinding
invalidates every asset's evidence for that wallet using a binding generation;
rebinding even the same pair requires new operator acceptance.

`setTrustedIssuer(issuerId, trustBasisHash)` changes the current trust basis and
emits `TrustedIssuerSet`. A zero basis removes trust. Issuer IDs and trust-basis
references are non-personal commitments supplied by the operator. A trust-basis
change or issuer removal invalidates existing evidence during each trade check.
Restoring the exact basis explicitly restores otherwise valid evidence; revoking
an individual record uses `revokeEvidence(wallet, asset)`.

`acceptEvidence(wallet, asset, Evidence)` accepts these compact enforcement fields:

| Field | Encoding |
| --- | --- |
| identityId | nonzero bytes32 keyed identity reference matching the current binding |
| issuerId | nonzero bytes32 issuer identifier |
| trustBasisHash | nonzero bytes32 matching the current trusted issuer basis |
| evidenceHash | nonzero bytes32 HMAC evidence commitment from compliance-data |
| issuedAt | uint64, positive and not in the future |
| expiresAt | uint64, strictly after issuedAt and the current timestamp |
| attestationType | uint8: 1 PUBLIC_LOOKUP, 2 SOURCE_REATTEST, 3 SELECTIVE_DISCLOSURE |

Evidence is keyed by wallet, identity, asset and binding generation. Expiry is
exclusive: `issuedAt <= now < expiresAt`. A record from another wallet, asset or
binding does not satisfy the check. Acceptance emits `EvidenceAccepted` with the
wallet, asset, identity reference and keyed commitment. Revocation deletes the
current record and emits `EvidenceRevoked`. No source documents, provider case
references, LEI or hashing keys enter these calls or events.

Checks first validate the exact DIRECT parameters, then evidence, current trust,
time window, attestation type and identity/dedup status. Counterparty screening is
explicitly enabled by the operator for bilateral venues; its pipeline is identical.
A-04-v2 reason suffixes are 2 missing/unbound evidence, 4 removed/untrusted issuer,
5 outside the time window, 6 frozen identity, 7 revoked identity, 8 confirmed
duplicate, 9 suspected duplicate, 10 unsupported type and 11 changed trust basis.
Setter validation prevents invalid windows/types from being accepted. A-04-v1's
reason codes, ABI and automatically seeded claims are unchanged.

This is a decision based on evidence the operator accepted. The contract does not
verify external claim signatures, decide whether an issuer's delegation is sound,
receive a hashing key or recompute an HMAC. ERC-3643 and ONCHAINID remain external
trust boundaries. Existing A-11 policy-cap and issuer-expiry arithmetic is unchanged.

## Compliance-data SPI v2

The root adds explicit v2 exports. Separate package entry points are `/v2`,
`/spi-v2`, `/demo-v2` and `/conformance-v2`. Existing root v1 exports, `/spi`,
`/demo` and `/conformance` retain their original behavior. V2 declares SPI 2.0.0,
refuses other majors and keeps a frozen validated metadata snapshot. The root
and v2 entry points do not load either demo adapter or read a key at import time.
V1 and v2 stores reject each other's record shapes; no automatic migration occurs.

V2 requests require wallet (`subject`), bytes32 identity commitment, asset and a
request reference. Assessments add `provenance = {issuerId, issuedAt, expiresAt,
trustBasisHash, attestationType}` and optional `lei`. Assessment validity must fit
inside the provenance window. Source and assessment references are keyed at the
adapter boundary. Raw provider records stay inside the adapter. Request references
belong to the refresh audit, not to persisted assessment commitments, so retrying
the same assessment under a new request reference does not create a store conflict.

`KycEvidenceCoordinatorV2` validates metadata, schema, binding, facts, provenance,
freshness and status. For positive evidence it requires an explicit operator
`accept(assessment)` callback returning exactly `true`, then a successful strict
audit before publication. Missing/failed/rejected acceptance fails closed. The
callback receives a detached assessment and cannot change the assessed facts.
Strict audit cannot be disabled. Freshness is rechecked after asynchronous
acceptance, audit and store operations. Timeout, revocation, sanctions hits,
malformed output, incompatible providers, audit failure and store conflicts never
return eligible evidence or fall back to a previous successful refresh.

Records have `schemaVersion: 2`, `operatorAccepted`, `evidenceHash`, `materializedAt`
and derived `eligible` in addition to the assessment. Negative evidence is stored
with `operatorAccepted: false` to prevent stale positive replay. The reference store
validates HMACs on every write, clones inputs/outputs, rejects same-assessment
conflicts and older/same-time positive replacement after revocation. It is an
in-process reference, not a transactional durable production store.

## Local hashing dependency

The compliance-data runtime loads exactly one 32-byte hex key through
`loadLocalKycCommitmentsV2`, using `CORNER_STORE_KYC_HMAC_KEY` or
`CORNER_STORE_KYC_HMAC_KEY_FILE`. Missing, malformed, unreadable or ambiguous
configuration is a startup error. There is no unkeyed fallback. The returned
capability exposes only `hash(domain, value)`, with the key held in a closure.
Inject that capability into adapters, coordinator, store and calldata translation;
never pass it to operator-api. No new host, custody, KMS/HSM or rotation machinery
is introduced.

`createKycCommitmentsV2` computes HMAC-SHA-256 over canonical JSON
`{domain: "corner-store/kyc/<purpose>/v2", value}`, with purposes `identity`,
`source`, `assessment` and `evidence`. Object keys sort recursively and undefined
optional fields are omitted. The evidence commitment includes schema 2, normalized
assessment/provenance, optional LEI and explicit acceptance. Changing the key,
purpose or committed input changes the commitment. This does not implement
venue pseudonyms or an off-chain wallet mapping; those remain P2.

## Optional LEI

V2 evidence optionally records LEI off-chain. Validation requires
`^[A-Z0-9]{18}[0-9]{2}$` and ISO/IEC 7064 MOD-97-10: convert letters A through Z
to 10 through 35 and require the complete numeric string's remainder modulo 97
to equal 1. This follows [ISO 17442-1:2020 clauses 4-5](https://cdn.standards.iteh.ai/samples/78829/91dbf00ce17b4b4293a06e5e1312c6a8/ISO-17442-1-2020.pdf).
Omission is valid. LEI changes the canonical evidence commitment and survives
store round trips. No policy requires LEI; it does not replace eligibility,
beneficial-ownership or sanctions facts. It is omitted from public audit records
and on-chain calldata.

## Unsigned acceptance export

`identityEvidenceAcceptanceV2(snapshot, commitments, now)` revalidates the keyed
record, acceptance, eligibility and current validity. It returns only public call
fields and unsigned `acceptEvidence` calldata. Expiry is the earlier of assessment
validity and provenance expiry. The runtime keeps the full evidence and optional
LEI in its private store. The operator submits calldata separately; exporting it
does not bind an identity, trust an issuer, sign or broadcast a transaction.

Toolkit exports `IDENTITY_EVIDENCE_V2_ABI`, `ATTESTATION_TYPE_V2`, the public types,
`encodeAcceptIdentityEvidenceV2` and `decodeAcceptIdentityEvidenceV2`. The codec
rejects extra/private fields, zero commitments, malformed windows/types, legacy
KycClaim calldata, noncanonical words and trailing data. Its separate selector is
`0x9b3e5df6`; the static acceptance payload is 292 bytes including the selector.

## Verification and measured fixture gas

`test/unit/compliance/elements/IdentityEvidenceV2.t.sol` covers authorization,
trust, time windows, binding generations and acceptance/check gas. The step 2
fixture measured `acceptEvidence` at 149,617 gas and `check` at 31,730 in the
Foundry function gas report; deployment was 1,772,449 gas / 8,393 bytes. Separate
uninstrumented harness deltas were 132,944 and 16,988 respectively. These are
fixture measurements, not fee or savings guarantees; report instrumentation and
warm/cold access change the observed cost.

Executed release results are recorded in [PROGRESS.md](../../PROGRESS.md), and
repeatable gates in [testing.md](../testing.md). See the
[P2 schedule](./identity-p2-schedule.md) for deferred work. No deployed contract,
existing recipe, API response or public Monad artifact is migrated.
