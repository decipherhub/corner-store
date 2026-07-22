// SPDX-License-Identifier: GPL-3.0
pragma solidity 0.8.17;

import {BaseElement} from "./BaseElement.sol";
import {Governed} from "../../auth/Governed.sol";
import {
    ElementMetadata,
    ElementCategory,
    TemporalNature,
    Decidability,
    ObligationTiming,
    Statefulness
} from "../../types/ComplianceTypes.sol";
import {ReasonCodes} from "../../libraries/ReasonCodes.sol";

/// @dev A-06-v1 Affiliate / Rule 144 control-person determination (mock). Decides
///      whether `subject` is an affiliate of `asset`'s issuer at trade time and
///      exposes the effective status for the resale cascade to consume. This
///      element only DETERMINES status — it never blocks an affiliate trade; the
///      Rule 144 5-constraint enforcement (holding period 144(d), current info
///      144(c), volume 144(e), manner-of-sale 144(f), Form 144 144(h)) is the
///      recipe's job (doc §5.3). PASS_AFFILIATE and PASS_NON_AFFILIATE therefore
///      both pass this gate; the split is surfaced via `effectiveStatus()` and read
///      by the cascade (C-01 Rule 144 paths, Recipe R2 — doc §9.1), never wired here.
///
///      MOCK BOUNDARY. Production A-06 consumes a Trusted-Issuer-signed, registry-
///      cross-checked claim (doc §4 collection flow, §8.2 Issuer Registry). Here an
///      operator-set claim stands in for that whole pipeline: the off-chain facts-
///      and-circumstances judgment (control / family / indirect chain / Rule 405
///      "power to direct" — doc §5.4, §1.4) is trusted at face value, and A-06 runs
///      only deterministic arithmetic (freshness + Rule 144(b) look-back) on top,
///      exactly like A-11 ClaimFreshness. Liability for a wrong determination sits
///      with the issuer/attester (doc §10.3). Two pipeline steps are modelled so
///      their failure paths are reachable: the claim's freshness anchor, and
///      TrustedIssuerRegistry.contains() (doc §5.1 step 2) via `isTrustedClaimIssuer`.
///      Claim signature verification (doc §5.1 step 2) is NOT modelled.
///
///      NO ON-CHAIN BRIGHT LINE (A-06.md checklist C3/C4, error pattern 2). No
///      ownership percentage or officer/director role is ever turned into a
///      PASS/FAIL rule here. `AffiliateBasis` records the ATTESTED evidentiary basis
///      of an off-chain conclusion — e.g. `BENEFICIAL_OWNER_10PLUS` means the
///      Trusted Issuer concluded affiliate ON a 10%+ ownership basis, NOT that this
///      contract classifies 10% holders as affiliates. Rule 405 control has no
///      quantitative threshold (A-06.md §1.2, §2). The ICA §2(a)(3)/(a)(9) bright
///      lines (≥5%, officer/director auto, >25% presumption) and the Exchange Act
///      §16 >10%/§12-registration insider regime belong to OTHER statutory axes and
///      are deliberately NOT imported (A-06.md checklist C4/C10/C11).
///
///      Reason code numbers (doc §6.1 names), in `check()` evaluation order:
///        1 = FAIL_AFFILIATE_STATUS_UNKNOWN         no claim for this (subject,asset)
///                                                  — never attested, OR a claim that
///                                                  exists only for a different asset
///                                                  (affiliate status is asset-
///                                                  specific, doc §4.4). Fail-closed:
///                                                  an ABSENT claim is NOT a silent
///                                                  non-affiliate pass (the dangerous
///                                                  false negative of doc §10.3).
///        2 = FAIL_UNTRUSTED_AFFILIATE_CLAIM_ISSUER claim.claimIssuer ∉ trusted set
///        3 = FAIL_AFFILIATE_CLAIM_EXPIRED          verifiedAt past the 90-day reuse cap
///        4 = REVIEW_AFFILIATE_UNCERTAIN            UNCERTAIN_AFFILIATE (or any basis
///                                                  this gate cannot resolve) — routed
///                                                  to manual review, fail-closed
///
///      PASS_AFFILIATE / PASS_NON_AFFILIATE carry reasonCode 0 with passed=true (see
///      above). `effectiveStatus()` exposes which of the two, with decay applied.
contract Affiliate is BaseElement, Governed {
    bytes32 internal constant ELEMENT_ID = "A-06-v1";

    /// @dev Evidentiary basis of an off-chain affiliate determination (doc §3.4, 9
    ///      values) plus a leading UNSET sentinel so the zero-value default of an
    ///      unrecorded claim is fail-closed (never a valid basis). UNSET is the
    ///      on-chain "claim == null" of doc §5.1 step 1; NOT_AFFILIATE is the
    ///      distinct affirmative determination "checked, and not an affiliate".
    enum AffiliateBasis {
        UNSET, // 0 = no claim recorded (fail-closed default)
        OFFICER_DIRECTOR, // executive officer / director (Wolfson + Rule 405)
        GENERAL_PARTNER, // general partner (Rule 405)
        BENEFICIAL_OWNER_10PLUS, // 10%+ beneficial owner (practice guideline)
        FAMILY_OF_AFFILIATE, // family member of an affiliate (Wolfson inference)
        INDIRECT_CONTROL, // control via intermediary — LLC/trust (Rule 144(a)(1))
        COMMON_CONTROL, // under common control with the issuer (Rule 405)
        FORMER_AFFILIATE_DECAY, // recently an affiliate, inside the decay tail
        NOT_AFFILIATE, // affirmatively determined non-affiliate
        UNCERTAIN_AFFILIATE // undeterminable — manual review (doc §6.3)
    }

    /// @dev Evidence source of the determination (doc §3.5, 7 values) plus an
    ///      UNSPECIFIED sentinel. Recorded for audit provenance; this deterministic
    ///      gate does NOT branch on it (doc §5.1 branches on basis only). SELF_-
    ///      ATTESTATION is the weakest source (doc §3.5, Layer 1 only, §10.1) —
    ///      rejecting a bare self-attested source is an off-chain issuance-time
    ///      control, not encoded in this trade-time gate.
    enum DeterminationSource {
        UNSPECIFIED, // 0 = no source recorded
        ISSUER_REGISTRY, // issuer-provided affiliate registry (strongest, doc §8.2)
        SCHEDULE_13D_13G_FILING, // SEC EDGAR Schedule 13D/13G
        SECTION_16_FILING, // Section 16 insider filing
        KYC_BENEFICIAL_OWNERSHIP, // Trusted-Issuer-collected beneficial ownership
        CORPORATE_DOCUMENT, // board minutes / operating agreement
        SELF_ATTESTATION, // buyer self-attestation (weakest)
        EXTERNAL_SPOT_CHECK // random audit / third-party verification
    }

    /// @dev Resolved effective status at the current block, single source of truth
    ///      for both `check()` (→ pass/fail + code) and `effectiveStatus()` (→ the
    ///      value downstream reads), so the gate verdict and the exposed status can
    ///      never diverge.
    enum EffectiveStatus {
        UNKNOWN, // no claim for this (subject, asset)
        UNTRUSTED, // claim issuer not in the trusted set
        EXPIRED, // claim past the freshness cap
        NON_AFFILIATE, // PASS_NON_AFFILIATE (incl. decay complete)
        AFFILIATE, // PASS_AFFILIATE (incl. decay in progress)
        UNCERTAIN // REVIEW_AFFILIATE_UNCERTAIN
    }

    struct AffiliateClaim {
        AffiliateBasis basis;
        DeterminationSource source;
        address claimIssuer; // attesting Trusted Issuer (checked against the trusted set)
        uint64 verifiedAt; // 0 = no claim recorded (freshness anchor + null sentinel)
        uint64 decayStartedAt; // FORMER_AFFILIATE_DECAY: role-exit/divestiture instant; else 0
    }

    /// @dev Rule 144(b)(2) affiliate tail — "any time during the 90 days immediately
    ///      before the sale". STATUTORY, and a day-count (fixed 90 days).
    uint64 public constant TAIL_144B2 = 90 days;

    /// @dev Rule 144(b)(1)(i)/(ii) non-affiliate qualification look-back — "has not
    ///      been an affiliate during the preceding three months". STATUTORY, but the
    ///      statute counts CALENDAR months (89–92 days, date-dependent), NOT a fixed
    ///      day-count, and it is a DISTINCT period from the (b)(2) 90-day tail
    ///      (A-06.md §1.3-1.4, §2, checklist C5). Collapsing the two into one 90-day
    ///      number is the doc-flagged #1 misimplementation (A-06.md §4 pattern 1). On
    ///      chain we cannot resolve calendar-month boundaries cheaply, so this is a
    ///      Decipher-POLICY conservative encoding: the 92-day upper bound of any
    ///      3-consecutive-calendar-month span, so the flip to non-affiliate never
    ///      fires early regardless of which months the decay spanned. NOT the literal
    ///      statutory text.
    uint64 public constant LOOKBACK_144B1 = 92 days;

    /// @dev Claim reuse window (freshness). Decipher-POLICY, NOT statute: affiliate
    ///      status turns over frequently — role change, share divestiture (doc §5.2,
    ///      §8.1) — so the reuse window is deliberately short (90 days) and drives the
    ///      periodic re-attestation duty (doc §8.1, §11.2). Must never be described as
    ///      a legal requirement. Numerically equal to TAIL_144B2 but a distinct
    ///      concept (claim freshness, not the statutory look-back); kept separate.
    uint64 public constant FRESHNESS_CAP = 90 days;

    /// @notice subject => asset => attested claim. Keyed by asset because affiliate
    ///         status is asset-specific: the same person may be an affiliate of
    ///         issuer X and a non-affiliate of issuer Y (doc §4.4, §7.2). A claim for
    ///         a different asset is simply absent here (→ STATUS_UNKNOWN), which is
    ///         the doc §5.1 assetIdentifier-mismatch outcome.
    mapping(address => mapping(address => AffiliateClaim)) public claimOf;

    /// @notice Trusted-issuer set — mock of TrustedIssuerRegistry.contains() (doc
    ///         §5.1 step 2, §8.2). A claim whose issuer is not (or is no longer) in
    ///         this set fails FAIL_UNTRUSTED_AFFILIATE_CLAIM_ISSUER at gate time.
    mapping(address => bool) public isTrustedClaimIssuer;

    event ClaimSet(
        address indexed subject,
        address indexed asset,
        AffiliateBasis basis,
        DeterminationSource source,
        address claimIssuer,
        uint64 verifiedAt,
        uint64 decayStartedAt
    );
    event TrustedClaimIssuerSet(address indexed issuer, bool trusted);

    constructor()
        BaseElement(ElementMetadata({
                elementId: ELEMENT_ID,
                category: ElementCategory.INVESTOR_ATTRIBUTE,
                version: "A-06-v1",
                temporal: TemporalNature.PERIODIC,
                decidability: Decidability.ATTESTATION_BASED,
                timing: ObligationTiming.EX_ANTE_VERIFY,
                statefulness: Statefulness.STATELESS
            }))
    {}

    /// @notice Records (or overwrites) the attested affiliate claim for `subject` on
    ///         `asset`.
    /// @dev The whole claim is attested off-chain by the Trusted Issuer that ran the
    ///      Rule 405 "power to direct" analysis (doc §5.4); A-06 trusts basis/source/
    ///      decayStartedAt at face value. `decayStartedAt` is meaningful only for
    ///      FORMER_AFFILIATE_DECAY and is the fixed role-exit/divestiture instant;
    ///      `verifiedAt` is refreshed on each periodic re-attestation (doc §8.1) and
    ///      is independent of it.
    function setClaim(
        address subject,
        address asset,
        AffiliateBasis basis,
        DeterminationSource source,
        address claimIssuer,
        uint64 verifiedAt,
        uint64 decayStartedAt
    ) external onlyOperator {
        claimOf[subject][asset] = AffiliateClaim({
            basis: basis,
            source: source,
            claimIssuer: claimIssuer,
            verifiedAt: verifiedAt,
            decayStartedAt: decayStartedAt
        });
        emit ClaimSet(subject, asset, basis, source, claimIssuer, verifiedAt, decayStartedAt);
    }

    /// @notice Add/remove an issuer from the trusted-claim-issuer set.
    function setTrustedClaimIssuer(address issuer, bool trusted) external onlyOperator {
        isTrustedClaimIssuer[issuer] = trusted;
        emit TrustedClaimIssuerSet(issuer, trusted);
    }

    /// @notice Current effective affiliate status of `subject` for `asset`, with the
    ///         Rule 144(b) decay look-back applied at the current block.
    /// @dev Read-only surface for the resale cascade (doc §9.1: C-01 Rule 144 paths,
    ///      Recipe R2). This element determines status; it does NOT wire into or gate
    ///      those consumers — they read this view.
    function effectiveStatus(address subject, address asset) external view returns (EffectiveStatus) {
        return _resolve(subject, asset);
    }

    /// @dev `counterparty`, `amount`, `context` are ignored: the subject is `user`
    ///      (doc §5.1 "prospective_buyer") and asset-specificity comes from `asset`
    ///      (the RWA token the engine is checking), so no context decode is needed.
    ///      Determination-succeeded (AFFILIATE or NON_AFFILIATE) passes this gate;
    ///      only undeterminable/uncertain states fail (doc §5.3).
    function check(address user, address, address asset, uint256, bytes calldata)
        external
        view
        override
        returns (bool passed, bytes32 reasonCode)
    {
        EffectiveStatus s = _resolve(user, asset);

        if (s == EffectiveStatus.UNKNOWN) {
            return (false, ReasonCodes.encode(0, ELEMENT_ID, 1)); // FAIL_AFFILIATE_STATUS_UNKNOWN
        }
        if (s == EffectiveStatus.UNTRUSTED) {
            return (false, ReasonCodes.encode(0, ELEMENT_ID, 2)); // FAIL_UNTRUSTED_AFFILIATE_CLAIM_ISSUER
        }
        if (s == EffectiveStatus.EXPIRED) {
            return (false, ReasonCodes.encode(0, ELEMENT_ID, 3)); // FAIL_AFFILIATE_CLAIM_EXPIRED
        }
        if (s == EffectiveStatus.UNCERTAIN) {
            return (false, ReasonCodes.encode(0, ELEMENT_ID, 4)); // REVIEW_AFFILIATE_UNCERTAIN
        }
        // AFFILIATE / NON_AFFILIATE — status determined; the gate passes and the
        // recipe reads effectiveStatus() to apply (or waive) the Rule 144 constraints.
        return (true, bytes32(0));
    }

    /// @dev doc §5.1 order: (1) claim present for this (subject,asset), (2) issuer
    ///      trusted, (3) fresh, (4) AffiliateBasis branch. First failing step wins.
    function _resolve(address subject, address asset) internal view returns (EffectiveStatus) {
        AffiliateClaim memory c = claimOf[subject][asset];

        // (1) doc §5.1 step 1 + step 4 (asset mismatch): an unrecorded claim (or one
        //     recorded only for a different asset) has verifiedAt==0 / basis==UNSET.
        //     Fail-closed to UNKNOWN — absence is never a non-affiliate pass.
        if (c.verifiedAt == 0 || c.basis == AffiliateBasis.UNSET) {
            return EffectiveStatus.UNKNOWN;
        }

        // (2) doc §5.1 step 2: TrustedIssuerRegistry.contains() mock.
        if (!isTrustedClaimIssuer[c.claimIssuer]) {
            return EffectiveStatus.UNTRUSTED;
        }

        // (3) doc §5.1 step 3: freshness. Strict `>` — exactly at the cap is still
        //     fresh (inclusive reuse window, matches A-11 ClaimFreshness §5.3).
        if (block.timestamp > uint256(c.verifiedAt) + FRESHNESS_CAP) {
            return EffectiveStatus.EXPIRED;
        }

        // (4) doc §5.1 step 5: AffiliateBasis branch.
        if (c.basis == AffiliateBasis.NOT_AFFILIATE) {
            return EffectiveStatus.NON_AFFILIATE;
        }
        if (c.basis == AffiliateBasis.FORMER_AFFILIATE_DECAY) {
            return _resolveDecay(c.decayStartedAt);
        }
        if (
            c.basis == AffiliateBasis.OFFICER_DIRECTOR || c.basis == AffiliateBasis.GENERAL_PARTNER
                || c.basis == AffiliateBasis.BENEFICIAL_OWNER_10PLUS || c.basis == AffiliateBasis.FAMILY_OF_AFFILIATE
                || c.basis == AffiliateBasis.INDIRECT_CONTROL || c.basis == AffiliateBasis.COMMON_CONTROL
        ) {
            return EffectiveStatus.AFFILIATE;
        }
        // UNCERTAIN_AFFILIATE, or any basis a future revision appends and this gate
        // does not yet resolve → manual review, fail-closed (doc §5.1 else-branch).
        return EffectiveStatus.UNCERTAIN;
    }

    /// @dev FORMER_AFFILIATE_DECAY resolution. Decay is complete — the person may be
    ///      treated as a non-affiliate — only once BOTH Rule 144 look-backs have run:
    ///      the (b)(2) 90-day tail AND the (b)(1) "preceding three months"
    ///      qualification (encoded as 92 days, LOOKBACK_144B1). We require the later
    ///      of the two, i.e. max(TAIL_144B2, LOOKBACK_144B1) (A-06.md checklist C5/C6).
    ///      Inclusive boundary: at exactly `decayEnd` the person becomes NON_AFFILIATE
    ///      (doc §9.3 Case 2 — decay_remaining==0 flips to non-affiliate).
    function _resolveDecay(uint64 decayStartedAt) internal view returns (EffectiveStatus) {
        // Malformed claim: FORMER_AFFILIATE_DECAY with no decay start cannot prove any
        // tail has run. Fail-closed → stay AFFILIATE (Rule 144 constraints persist);
        // never flip to the laxer non-affiliate path on missing data (doc §10.3).
        if (decayStartedAt == 0) {
            return EffectiveStatus.AFFILIATE;
        }
        uint256 tailEnd = uint256(decayStartedAt) + TAIL_144B2;
        uint256 lookbackEnd = uint256(decayStartedAt) + LOOKBACK_144B1;
        uint256 decayEnd = tailEnd >= lookbackEnd ? tailEnd : lookbackEnd;
        if (block.timestamp >= decayEnd) {
            return EffectiveStatus.NON_AFFILIATE;
        }
        return EffectiveStatus.AFFILIATE;
    }
}
