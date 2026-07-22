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
import {LookThroughStatus} from "../../interfaces/compliance/ILookThroughSource.sol";

/// @dev A-13-v1 Qualified purchaser attestation (mock). Activated conditionally
///      by the ICA 3(c)(7) fund recipe (R3). Stands in for the off-chain
///      Trusted-Issuer determination of whether a *buyer* is a qualified
///      purchaser under 15 U.S.C. 80a-2(a)(51)(A) and the SEC rules thereunder.
///      The QP determination is a legal judgment (family relationship, trust
///      formation intent, investments valuation) that cannot run on-chain
///      (doc 5.5); Rule 2a51-1(h) reasonable-belief lets a Relying Person's
///      signed claim stand in for it. So `check` is a pure, deterministic
///      confirmation of a stored claim in the doc 5.2 order: existence/forgery
///      -> issuer trust -> freshness -> basis branch. The dollar thresholds
///      ($5M natural/family, $25M institutional, inclusive per doc 5.3) are
///      PRE-JUDGED by the Trusted Issuer off-chain — never computed here, so no
///      amounts appear on-chain (doc 5.2 step-4).
///
///      Reason code map — `n` in `ReasonCodes.encode(0, ELEMENT_ID, n)` -> doc
///      6.2 failure-code name:
///        1 | FAIL_NOT_QP                        (no claim, or forged signature)
///        2 | FAIL_QP_CLAIM_EXPIRED              (freshness cap exceeded, strict >)
///        3 | FAIL_UNTRUSTED_QP_CLAIM_ISSUER     (issuer not in trusted registry)
///        4 | FAIL_QP_LOOKTHROUGH_REQUIRED       (family/trust, look-through NONE)
///        5 | FAIL_QP_LOOKTHROUGH_NOT_COMPLETED  (family/trust, look-through PENDING)
///        6 | FAIL_TRUST_DISQUALIFIED            (trust, look-through FAILED)
///        7 | FAIL_FAMILY_CO_NOT_QP              (family company, look-through FAILED)
///        8 | FAIL_KNOWLEDGEABLE_EMP_NOT_QUALIFIED (KE covered company != fund key)
///        9 | REVIEW_QP_UNCERTAIN                (basis OTHER — manual review)
contract QualifiedPurchaser is BaseElement, Governed {
    bytes32 internal constant ELEMENT_ID = "A-13-v1";

    /// @dev The five QP-qualifying paths (doc 3.1.1) plus the KE exclusion and an
    ///      OTHER catch-all for boundary cases routed to manual review. NATURAL =
    ///      2(a)(51)(A)(i), FAMILY_COMPANY = (ii), TRUST = (iii), INSTITUTIONAL =
    ///      (iv) $25M any-person, QIB = Rule 2a51-1(g)(1) deemed, and
    ///      KNOWLEDGEABLE_EMPLOYEE = Rule 3c-5 exclusion.
    enum QpBasis {
        NONE,
        NATURAL,
        FAMILY_COMPANY,
        TRUST,
        INSTITUTIONAL,
        QIB,
        KNOWLEDGEABLE_EMPLOYEE,
        OTHER
    }

    struct QpClaim {
        QpBasis basis; // NONE => code 1 (no QP claim)
        bool signatureValid; // false => code 1 (doc folds forgery into NOT_QP)
        bool issuerTrusted; // false => code 3
        uint64 verifiedAt; // freshness anchor (block.timestamp at issuance)
        LookThroughStatus ltStatus; // FAMILY_COMPANY / TRUST beneficial-owner cascade (A-09)
        bytes32 coveredCompany; // KE only: must equal the asset's fund key
    }

    /// @notice buyer => attested QP claim (default: basis NONE => code 1).
    mapping(address => QpClaim) public claimOf;

    /// @notice POLICY (operator-settable). Max age of a QP claim measured from
    ///         `verifiedAt`, implementing the 3(c)(7)(A) "at the time of
    ///         acquisition" requirement as a freshness cap (doc 5.3). Decipher
    ///         RECOMMENDS 1 year; a 5-year conservative option is available per
    ///         doc 5.3 — tune via `setFreshnessCap`. Coordinated with the Claim
    ///         Freshness element (A-11).
    uint64 public freshnessCap = 365 days;

    event QualifiedPurchaserSet(address indexed investor, bool isQp);
    // Enum params canonicalize to uint8 in the event signature; tests re-declare
    // with uint8 to match (Solidity 0.8.17 cannot `emit` a non-library contract's
    // event by qualified name; that needs >=0.8.22).
    event QpClaimSet(
        address indexed investor,
        QpBasis basis,
        bool signatureValid,
        bool issuerTrusted,
        uint64 verifiedAt,
        LookThroughStatus ltStatus,
        bytes32 coveredCompany
    );
    event FreshnessCapSet(uint64 cap);

    constructor()
        BaseElement(ElementMetadata({
                elementId: ELEMENT_ID,
                category: ElementCategory.INVESTOR_ATTRIBUTE,
                version: "A-13-v1",
                temporal: TemporalNature.ONE_TIME,
                decidability: Decidability.ATTESTATION_BASED,
                timing: ObligationTiming.EX_ANTE_VERIFY,
                statefulness: Statefulness.STATELESS
            }))
    {}

    /// @notice Legacy setter (compatibility-preserving). `true` writes a fully
    ///         valid natural-person claim {NATURAL, valid signature, trusted
    ///         issuer, verifiedAt = now, no look-through, no covered company} so
    ///         a bare `setQp(user, true)` still PASSes `check`; `false` clears.
    function setQp(address user, bool isQp) external onlyOperator {
        if (isQp) {
            claimOf[user] = QpClaim({
                basis: QpBasis.NATURAL,
                signatureValid: true,
                issuerTrusted: true,
                verifiedAt: uint64(block.timestamp),
                ltStatus: LookThroughStatus.NONE,
                coveredCompany: bytes32(0)
            });
        } else {
            delete claimOf[user];
        }
        emit QualifiedPurchaserSet(user, isQp);
    }

    /// @notice Writes the operator-attested rich QP claim for `user`.
    function setQpClaim(address user, QpClaim calldata claim) external onlyOperator {
        claimOf[user] = claim;
        emit QpClaimSet(
            user,
            claim.basis,
            claim.signatureValid,
            claim.issuerTrusted,
            claim.verifiedAt,
            claim.ltStatus,
            claim.coveredCompany
        );
    }

    /// @notice Operator-settable POLICY freshness cap (see `freshnessCap`).
    function setFreshnessCap(uint64 cap) external onlyOperator {
        freshnessCap = cap;
        emit FreshnessCapSet(cap);
    }

    /// @notice Coarse legacy view: does `user` hold any QP claim. Preserves the
    ///         old `mapping(address => bool) public qp` getter shape for callers.
    function qp(address user) public view returns (bool) {
        return claimOf[user].basis != QpBasis.NONE;
    }

    /// @dev `user` = prospective buyer; `asset` = the fund token (its address is
    ///      the fund identifier for the KE covered-company match). Returns the
    ///      first failing reason code in the doc 5.2 order.
    function check(address user, address, address asset, uint256, bytes calldata)
        external
        view
        override
        returns (bool passed, bytes32 reasonCode)
    {
        uint32 code = _evaluate(user, asset);
        return (code == 0, code == 0 ? bytes32(0) : ReasonCodes.encode(0, ELEMENT_ID, code));
    }

    /// @dev doc 5.2 pipeline. 0 = PASS.
    function _evaluate(address user, address asset) internal view returns (uint32) {
        QpClaim memory c = claimOf[user];

        // Step 1: existence + forgery (doc folds a forged signature into NOT_QP).
        if (c.basis == QpBasis.NONE || !c.signatureValid) return 1;

        // Step 2: issuer trust.
        if (!c.issuerTrusted) return 3;

        // Step 3: freshness — strict `>`, so exactly-at-cap PASSes (doc 5.3). Age
        // is 0 for a future/equal anchor, avoiding underflow.
        if (block.timestamp > c.verifiedAt && block.timestamp - c.verifiedAt > freshnessCap) {
            return 2;
        }

        // Step 4: basis branch. NATURAL/INSTITUTIONAL/QIB pass directly — their
        // $5M/$25M thresholds and QIB status are pre-judged by the Trusted Issuer
        // off-chain (doc 5.2 step-4), so no on-chain amount check.
        if (c.basis == QpBasis.NATURAL || c.basis == QpBasis.INSTITUTIONAL || c.basis == QpBasis.QIB) {
            return 0;
        }

        // Family company / trust require a settled beneficial-owner look-through
        // (A-09). NONE = no cascade recorded, PENDING = still running (suspend,
        // not reject). FAILED disqualifies with a branch-specific code so the
        // trust (6) vs family-company (7) distinction survives on-chain.
        if (c.basis == QpBasis.FAMILY_COMPANY) {
            if (c.ltStatus == LookThroughStatus.NONE) return 4;
            if (c.ltStatus == LookThroughStatus.PENDING) return 5;
            if (c.ltStatus == LookThroughStatus.FAILED) return 7;
            return 0; // COMPLETED
        }

        if (c.basis == QpBasis.TRUST) {
            if (c.ltStatus == LookThroughStatus.NONE) return 4;
            if (c.ltStatus == LookThroughStatus.PENDING) return 5;
            if (c.ltStatus == LookThroughStatus.FAILED) return 6;
            return 0; // COMPLETED
        }

        // Knowledgeable Employee (Rule 3c-5): the exclusion is valid only for the
        // buyer's own fund, so the claim's covered company must equal the fund
        // key. The asset address IS the fund identifier for this mock.
        if (c.basis == QpBasis.KNOWLEDGEABLE_EMPLOYEE) {
            if (c.coveredCompany != bytes32(uint256(uint160(asset)))) return 8;
            return 0;
        }

        // basis == OTHER: cannot be auto-decided -> manual review.
        return 9;
    }
}
