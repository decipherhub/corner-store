# Venue-Authoritative Execution Context

## Scope

EXEC-002 (issue #157, D028/D029) adds an opt-in provenance boundary through
separate `ExecutionRouterV2` and `RFQAdapterV3` deployments. Legacy Router/RFQ v2
contracts, recipes, events, HTTP responses and the public Monad runtime retain
their existing meanings. Context version 1 verifies the supplied context before
policy evaluation; it does not replace the context or accept a generic context
hash as authority.

## Field Ownership

| Context | RFQ authority | AMM authority |
| --- | --- | --- |
| `initiator` | Router caller | Router caller |
| `buyer` | Signed taker equals caller | Self-directed payer/recipient equals caller |
| `seller` | Signed maker | Registered pool/target |
| `tokenIn/tokenOut` | Signed quote | Canonical pool tokens and swap direction |
| `amountIn/amountOut` | Signed exact fill | Requested exact fill, independently measured by Router |
| `venue/venueType` | Signed venue plus registry | Registry and registered pool |
| `flowType` | Signed class plus active Manifest authority | Secondary only |
| `sellerIsAffiliate` | Current pinned A-06 evidence for actual security sender | Same |

For every security asset, `tokenOut` moves seller to buyer and `tokenIn` moves
buyer to seller. The legacy boolean name does not change this direction rule.
Enum values remain `SECONDARY_TRADE=0`, `PRIMARY_DISTRIBUTION=1`, `REDEMPTION=2`.

RFQ supports secondary trades in both directions and conditional primary
distribution. Primary requires an explicitly UNREGULATED input, ACTIVE output
security and a unique nonzero distributor from active compiled C-01-v2 Manifest
parameters matching the signed maker. Missing/conflicting parameters or pending
authority reject. AMM supports self-directed secondary trades only. Redemption,
unknown classes, identical-token pairs and delegated AMM execution reject. The
C-01-family/AMM prohibition remains in force.

## Authentication and Settlement Order

1. RouterV2 checks caller, deadline/replay, pause, venue registration and type.
2. It verifies reviewed implementation approval, runtime/configuration evidence,
   its own policy registry binding and current A-06 status/boolean agreement.
3. The adapter's view-only `validateContext(req, cfg)` authenticates the venue
   fields. RFQ additionally checks maker approval, current signer authorization,
   expiry, unused quote nonce, supported flow and every quote/context equality.
4. The Engine evaluates current Manifest-bound policy. Preview decisions are
   informational and never grant execution authority.
5. Settlement repeats adapter validation and compares signed `policyId` to the
   fresh decision, consumes the quote nonce and transfers both legs.
6. Router independently measures buyer balances, enforces exact full fill and
   commits stateful policy before emitting the existing execution events.

A failure atomically rolls back token movement, Router/quote nonces, adapter and
policy state. Partial fills, fee-on-transfer/rebasing assets and price-tolerant
AMM settlement are unsupported. ERC-3643/ONCHAINID remain external token and
identity trust boundaries; direct token/pool transfers are outside Router policy.

## RFQ v3 Wire Contract

```solidity
struct RFQQuoteV3 {
    address maker;
    address taker;
    address tokenIn;
    address tokenOut;
    uint256 amountIn;
    uint256 amountOut;
    address venue;
    bytes32 policyId;
    uint8 flowType;
    bytes32 affiliateEvidenceHash;
    uint256 nonce;
    uint64 expiry;
}
```

The EIP-712 primary type is `RFQQuoteV3`, with exactly this field order and these
types. Domain: `{name: "CornerStoreRFQ", version: "3", chainId,
verifyingContract: RFQAdapterV3}`. Venue calldata encodes `(RFQQuoteV3, bytes
signature)`. The v2 struct and domain remain unchanged. Existing signatures must
expire or be cancelled; never translate or silently re-sign them as v3 quotes.

## Affiliate Evidence Commitment

For every ACTIVE leg, the pinned A-06 source must return AFFILIATE or
NON_AFFILIATE for the actual sender. Missing, unknown, uncertain, expired,
untrusted, malformed or unavailable evidence rejects. Source, issuer and
verification timestamp must be present; future timestamps and missing/future
decay starts reject. A-06 remains operator-attested evidence, with no independent
investigation of its factual accuracy added here.

```text
leg = keccak256(abi.encode(
  asset, sender, affiliateSource, claim.basis, claim.source, claim.claimIssuer,
  claim.verifiedAt, claim.decayStartedAt, uint8(effectiveStatus)
))
aggregate = keccak256(abi.encode(
  keccak256("corner-store.affiliate-evidence.v1"), inputLeg, outputLeg
))
```

An explicitly UNREGULATED leg contributes zero; other inactive classifications
reject. Both regulated legs must have matching effective statuses because this
context version has one boolean. A fully unregulated pair requires false. RFQ
signs the aggregate and checks it against current state in preflight and
settlement. Any commitment change invalidates the old quote immediately,
including a refresh that preserves the effective status. The SDK resolver reads
the current status and claim at one block snapshot and authenticates deployment
bindings; custom resolvers remain an integrator trust boundary.

## Registration and Activation Evidence

`VenueConfig` retains its ABI. Separate `VenueContextEvidence` pins adapter and
context versions, adapter runtime hash, A-06 source/address/runtime hash, policy
registry/address/runtime hash and configuration commitment. Re-registering a
venue deletes its prior evidence, including identical re-registration.

```text
configurationHash = keccak256(abi.encode(
  keccak256("corner-store.venue-context-config.v1"), cfg,
  adapter.contextConfigHash()
))
```

Owner-only implementation approval is a review of immutable code and dependencies,
separate from an adapter's self-declared capability. A runtime hash alone cannot
prove immutability or correctness. Governance-approved malicious code remains
inside the governance trust boundary. Proxy-aware activation is unsupported.

RFQ commits Router, authorizer, registries and affiliate source. AMM commits
Router and `poolConfigurationNonce`. Every `setPool`, even a redundant edit or
remove/re-add, increments that nonce and invalidates all venues sharing the
adapter. Complete Router wiring and all pool edits before pinning final evidence;
re-pin every affected venue after later edits. AMM also requires
`target == venue == seller`, registered pool membership and canonical token order.

Onboarding schema 6 requires explicit Router runtime evidence and reviewed
per-venue bindings. REGISTER plans order wiring/pool changes before registration,
implementation approval and pinning, then maker activation. UPDATE verifies
existing bindings without resetting pool state. `verifyVenueContext` checks
versions, runtime/configuration, approval, source ownership, authorizer, Router
dependencies and AMM membership/token order; missing/unavailable reads fail closed.
Schema 6 extends the existing unsigned plan format and adds no signing or custody.

## Migration and Verification

Follow the compatibility matrix and explicit migration in
[`../sdk-versioning.md`](../sdk-versioning.md). Package versions remain 0.1.0 in
this unpublished development branch; no package or deployment is promoted by these
changes. Reference/operator signing uses one local env/file key. Key management,
multisig and custody expansion remain deferred.

The delivery gates are `scripts/check.sh`, both legacy `scripts/e2e-anvil.sh`
profiles and `scripts/e2e-context-provenance.sh`. The isolated v3 runner uses real
ERC-3643/ONCHAINID plus a minimal B-02-v2 token-wiring recipe, mock cash/pricing
and local host/store/auth adapters. It proves both directions, mined mismatch
rejections with unchanged balances/nonces and fresh-evidence settlement. It is not
production infrastructure or a replacement for the Reg D integration tests.
See [`../testing.md`](../testing.md) for the manual/CI gate boundary.

## Open Items: Team to Confirm

The authorized implementation adopts these defaults pending team confirmation:

1. Conditional primary distribution with the active Manifest distributor above.
2. Matching statuses for dual-regulated pairs until a per-asset context version.
3. Mandatory A-06 evidence on every regulated v3 leg.
4. Immediate invalidation on any current evidence commitment change.
5. Reviewed immutable implementations only, with no proxy-aware activation.
6. Opt-in migration timing and separate deployments, retaining RFQ v2 on Monad.
