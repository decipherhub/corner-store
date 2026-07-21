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
import {ILookThroughSource, LookThroughStatus} from "../../interfaces/compliance/ILookThroughSource.sol";

/// @dev A-08-v1 Buyer-side entity-level eligibility (mock). Stands in for the
///      off-chain Trusted-Issuer determination of whether a *buyer entity* meets
///      the entity-level requirements of the qualification a trade demands —
///      accredited-investor (R1, Reg D 506(c)) and/or qualified-purchaser (R3,
///      ICA 3(c)(7)) — and, where a category qualifies only through its members,
///      routes to the equity-owner look-through element (A-09) via the INJECTED
///      ILookThroughSource seam. All entity facts (category, investments,
///      formed-for-purpose, QIB status, per-category direct reqs) are attested
///      off-chain and written as a claim by an operator; `check` is a pure,
///      deterministic evaluation of the stored claim in the doc §5.2 order.
///
///      Natural persons are out of scope (A-03/A-13 decide them directly): a
///      buyer whose claim is not `isEntity` is dormant (PASS). Which track(s)
///      the trade actually requires is a per-asset, trade-context decision the
///      operator writes into `requiredTracksOf` (doc §5.4); the element only
///      enforces what is switched on — a token's past issuance framework does
///      NOT auto-arm the AI track.
///
///      Comparison operators are load-bearing (doc §5.3) and fixed as part of
///      each threshold's meaning: the AI direct-asset $5M is STRICT `>` (exactly
///      $5,000,000 FAILs); the QP family-company $5M and institutional $25M are
///      INCLUSIVE `>=` (exactly at threshold PASSes). A single `>=` for all
///      three would mis-decide the AI boundary to the cent.
///
///      Reason code map — `n` in `ReasonCodes.encode(0, ELEMENT_ID, n)` -> doc
///      §6.2 failure-code name:
///        1 | ENTITY_CATEGORY_MISMATCH   (claimed basis not in an active track)
///        2 | ENTITY_THRESHOLD_NOT_MET   (assets/investments below threshold, op applied)
///        3 | ENTITY_QIB_UNCONFIRMED     (QP_QIB path, QIB status not confirmed)
///        4 | ENTITY_FORMED_FOR_PURPOSE  (AI direct path barred / QP trust no-cure)
///        5 | ENTITY_LOOKTHROUGH_REQUIRED (A-09 status NONE/PENDING — wait, not reject)
///        6 | ENTITY_LOOKTHROUGH_FAILED  (A-09 found a non-qualifying member)
///        7 | ENTITY_DIRECT_REQ_MISSING  (per-category extra req not attested)
///        8 | ENTITY_AND_GATE_FAIL       (R1 and R3 both active, at least one fails)
contract EntityEligibility is BaseElement, Governed {
    bytes32 internal constant ELEMENT_ID = "A-08-v1";

    // 501(a)(3)/(7)/(9)/(12) direct-asset path collapsed into DIRECT_ASSETS; (a)(8) = ALL_OWNERS_AI.
    enum AiBasis {
        NONE,
        DIRECT_ASSETS,
        ALL_OWNERS_AI
    }

    // 2(a)(51)(A)(ii) family company | (iv) institutional | 2a51-1(g)(1) QIB | (iii) trust.
    enum QpBasis {
        NONE,
        FAMILY_COMPANY,
        INSTITUTIONAL,
        QIB,
        TRUST
    }

    struct EntityClaim {
        bool isEntity; // false => dormant for this buyer (natural persons: A-03/A-13)
        AiBasis aiBasis;
        QpBasis qpBasis;
        uint256 investmentsUsd; // whole USD, off-chain computed per Rule 2a51-1(b)-(f)
        bool formedForPurpose; // "formed for the specific purpose of acquiring" — verifier-attested
        bool qibConfirmed; // Rule 144A QIB status + account capacity + carve-out, verifier-confirmed
        bool directReqsMet; // per-category extra reqs (sophistication/knowledgeability/family/discretion)
    }

    /// @dev Track activation bits for `requiredTracksOf`. bit0 = R1/AI, bit1 = R3/QP.
    uint8 internal constant TRACK_AI = 1;
    uint8 internal constant TRACK_QP = 2;

    /// @dev Thresholds with their comparison operator baked into meaning (doc §5.3).
    uint256 internal constant AI_DIRECT_MIN_USD = 5_000_000; // PASS iff investments >  5M (STRICT)
    uint256 internal constant QP_FAMILY_MIN_USD = 5_000_000; // PASS iff investments >= 5M (INCLUSIVE)
    uint256 internal constant QP_INSTITUTIONAL_MIN_USD = 25_000_000; // PASS iff investments >= 25M (INCLUSIVE)

    /// @dev Thrown if constructed with a zero look-through source: the ALL_OWNERS_AI,
    ///      QP_TRUST and formed-for-purpose company paths cannot resolve without it.
    error ZeroLookThroughSource();

    /// @notice Injected A-09 seam — settled recursive look-through outcome per subject.
    ILookThroughSource public immutable lookThroughSource;

    /// @notice buyer => attested entity claim (default: isEntity=false => dormant).
    mapping(address => EntityClaim) public claims;

    /// @notice asset => required tracks bitmask (bit0=R1/AI, bit1=R3/QP; 0 = dormant).
    ///         Per-asset, trade-context activation decided off-chain (doc §5.4).
    mapping(address => uint8) public requiredTracksOf;

    // Enum params canonicalize to uint8 in the event signature; tests re-declare
    // with uint8 to match (Solidity 0.8.17 cannot `emit` a non-library contract's
    // event by qualified name; that needs >=0.8.22).
    event EntityClaimSet(
        address indexed user,
        bool isEntity,
        AiBasis aiBasis,
        QpBasis qpBasis,
        uint256 investmentsUsd,
        bool formedForPurpose,
        bool qibConfirmed,
        bool directReqsMet
    );
    event RequiredTracksSet(address indexed asset, uint8 tracks);

    /// @dev Per-track diagnostic for the AND-gate (doc §6.4 buyer-facing category
    ///      vs internal field diagnosis). `check` is `view` per IComplianceElement
    ///      and cannot emit — and a view call in the gating path would not persist
    ///      logs anyway — so the per-track codes underlying a code-8 verdict are
    ///      surfaced through the non-view `diagnose` companion instead.
    event EntityAndGateDiagnostic(address indexed user, address indexed asset, uint32 aiCode, uint32 qpCode);

    constructor(ILookThroughSource lookThroughSource_)
        BaseElement(ElementMetadata({
                elementId: ELEMENT_ID,
                category: ElementCategory.INVESTOR_ATTRIBUTE,
                version: "A-08-v1",
                temporal: TemporalNature.ONE_TIME,
                decidability: Decidability.ATTESTATION_BASED,
                timing: ObligationTiming.EX_ANTE_VERIFY,
                statefulness: Statefulness.STATELESS
            }))
    {
        if (address(lookThroughSource_) == address(0)) {
            revert ZeroLookThroughSource();
        }
        lookThroughSource = lookThroughSource_;
    }

    /// @notice Writes the operator-attested entity claim for `user`.
    function setEntityClaim(address user, EntityClaim calldata claim) external onlyOperator {
        claims[user] = claim;
        emit EntityClaimSet(
            user,
            claim.isEntity,
            claim.aiBasis,
            claim.qpBasis,
            claim.investmentsUsd,
            claim.formedForPurpose,
            claim.qibConfirmed,
            claim.directReqsMet
        );
    }

    /// @notice Sets the per-asset required-tracks bitmask (bit0=R1/AI, bit1=R3/QP).
    function setRequiredTracks(address asset, uint8 tracks) external onlyOperator {
        requiredTracksOf[asset] = tracks;
        emit RequiredTracksSet(asset, tracks);
    }

    /// @dev Buyer-facing gate. `user` is the buyer entity; `asset` selects the
    ///      active tracks. Returns the first failing reason code; code 8 when both
    ///      tracks are active and either fails (per-track detail via `diagnose`).
    function check(address user, address, address asset, uint256, bytes calldata)
        external
        view
        override
        returns (bool passed, bytes32 reasonCode)
    {
        (bool aiActive, bool qpActive, uint32 aiCode, uint32 qpCode, bool dormant) = _tracksAndCodes(user, asset);
        (bool ok, uint32 code) = _verdict(aiActive, qpActive, aiCode, qpCode, dormant);
        return (ok, ok ? bytes32(0) : ReasonCodes.encode(0, ELEMENT_ID, code));
    }

    /// @notice Same verdict as `check`, but emits the per-track diagnostic for an
    ///         AND-gate failure so the underlying codes reach the audit log. This
    ///         is the on-chain home for the doc §5.2 step-3 diagnostic event that
    ///         a `view` `check` cannot emit.
    function diagnose(address user, address asset) external returns (bool passed, bytes32 reasonCode) {
        (bool aiActive, bool qpActive, uint32 aiCode, uint32 qpCode, bool dormant) = _tracksAndCodes(user, asset);
        (bool ok, uint32 code) = _verdict(aiActive, qpActive, aiCode, qpCode, dormant);
        if (aiActive && qpActive && (aiCode != 0 || qpCode != 0)) {
            emit EntityAndGateDiagnostic(user, asset, aiCode, qpCode);
        }
        return (ok, ok ? bytes32(0) : ReasonCodes.encode(0, ELEMENT_ID, code));
    }

    /// @dev Resolves which tracks are active for `asset` and each active track's
    ///      first-failure code (0 = ok). `dormant` short-circuits to PASS when no
    ///      track is required or the buyer is not an entity (doc §5.2 step 0-1).
    function _tracksAndCodes(address user, address asset)
        internal
        view
        returns (bool aiActive, bool qpActive, uint32 aiCode, uint32 qpCode, bool dormant)
    {
        uint8 tracks = requiredTracksOf[asset];
        if (tracks == 0) return (false, false, 0, 0, true);

        EntityClaim memory c = claims[user];
        if (!c.isEntity) return (false, false, 0, 0, true);

        aiActive = tracks & TRACK_AI != 0;
        qpActive = tracks & TRACK_QP != 0;
        if (aiActive) aiCode = _checkAi(user, c);
        if (qpActive) qpCode = _checkQp(user, c);
    }

    /// @dev Combines the per-track outcomes (doc §5.2 step 3). Both tracks active
    ///      => AND (both must pass, else code 8). Single track => its own code.
    function _verdict(bool aiActive, bool qpActive, uint32 aiCode, uint32 qpCode, bool dormant)
        internal
        pure
        returns (bool passed, uint32 code)
    {
        if (dormant) return (true, 0);
        if (aiActive && qpActive) {
            if (aiCode == 0 && qpCode == 0) return (true, 0);
            return (false, 8);
        }
        uint32 single = aiActive ? aiCode : qpCode;
        return (single == 0, single);
    }

    /// @dev AI (R1) track. Order: category -> formed-for-purpose (direct path
    ///      barred, cure is (a)(8) reclassification) -> STRICT `>` threshold ->
    ///      (a)(8) member look-through -> per-category direct req.
    function _checkAi(address user, EntityClaim memory c) internal view returns (uint32) {
        AiBasis b = c.aiBasis;
        if (b == AiBasis.NONE) return 1;

        if (b == AiBasis.DIRECT_ASSETS) {
            // (a)(3)/(7)/(9)/(12) carry "not formed for the specific purpose" in
            // the statute itself: a formed-for-purpose entity cannot pass the
            // direct path at all; its only cure is reclassifying to (a)(8).
            if (c.formedForPurpose) return 4;
            if (c.investmentsUsd <= AI_DIRECT_MIN_USD) return 2; // STRICT `>`: exactly 5M FAILs
        } else {
            // ALL_OWNERS_AI ((a)(8)) — no formed-for-purpose bar; qualifies only
            // through every equity owner being AI, confirmed by A-09.
            LookThroughStatus s = lookThroughSource.statusOf(user);
            if (s == LookThroughStatus.NONE || s == LookThroughStatus.PENDING) return 5;
            if (s == LookThroughStatus.FAILED) return 6;
        }

        if (!c.directReqsMet) return 7;
        return 0;
    }

    /// @dev QP (R3) track. Order: category -> trust (formed-for-purpose has NO
    ///      cure; else member look-through) / family|institutional (INCLUSIVE
    ///      `>=` threshold; formed-for-purpose cured by 2a51-3 look-through
    ///      COMPLETED) / QIB (status) -> per-category direct req.
    function _checkQp(address user, EntityClaim memory c) internal view returns (uint32) {
        QpBasis b = c.qpBasis;
        if (b == QpBasis.NONE) return 1;

        if (b == QpBasis.TRUST) {
            // §2(a)(51)(A)(iii): "not formed for the specific purpose" is a
            // statute requirement, and 2a51-3's all-owners-QP cure covers (ii)/(iv)
            // companies only — a formed-for-purpose trust has NO look-through cure.
            if (c.formedForPurpose) return 4;
            LookThroughStatus s = lookThroughSource.statusOf(user);
            if (s == LookThroughStatus.NONE || s == LookThroughStatus.PENDING) return 5;
            if (s == LookThroughStatus.FAILED) return 6;
        } else if (b == QpBasis.FAMILY_COMPANY || b == QpBasis.INSTITUTIONAL) {
            uint256 min = b == QpBasis.FAMILY_COMPANY ? QP_FAMILY_MIN_USD : QP_INSTITUTIONAL_MIN_USD;
            if (c.investmentsUsd < min) return 2; // INCLUSIVE `>=`: exactly at threshold PASSes
            if (c.formedForPurpose) {
                // 2a51-3(a): a formed-for-purpose (ii)/(iv) company qualifies only
                // if every beneficial owner is a QP (A-09 look-through COMPLETED).
                LookThroughStatus s = lookThroughSource.statusOf(user);
                if (s == LookThroughStatus.NONE || s == LookThroughStatus.PENDING) return 5;
                if (s == LookThroughStatus.FAILED) return 6;
            }
        } else {
            // QIB (2a51-1(g)(1)) — deemed QP with no investments computation.
            if (!c.qibConfirmed) return 3;
        }

        if (!c.directReqsMet) return 7;
        return 0;
    }
}
