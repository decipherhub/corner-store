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

/// @dev B-03-v1 Transfer restriction metadata declaration (mock). Stands in for
///     the digital equivalent of a Rule 502(d)(3) restrictive legend: it does
///     not compute whether a given resale is permitted (that is C-00/C-01's
///     job) — it only checks that the asset's per-class restriction
///     declaration is present, internally consistent with the issuance
///     framework, and complete enough for those downstream elements to read.
///     ASSET-side check: it inspects `asset`, not `user`/`counterparty`
///     (contrast with the investor-attribute elements; same shape as
///     AssetClassification).
///
///     `check` is inherited as `view` from `BaseElement`/`IComplianceElement`
///     and that file may not be edited, so this element cannot emit events
///     from inside `check` (Solidity forbids emitting logs from a `view`
///     override). The doc's §5.2 pseudocode calls for (a) a PASS event
///     carrying a snapshot hash of the declaration and (b) a non-blocking
///     `ReviewQueued` event when a NON_REPORTING asset overclaims
///     `currentInfoRequired` (§5.2 step ④, "hardening overclaim = ops
///     hygiene"). Both are dropped from the runtime check as a consequence of
///     the interface constraint — the underlying PASS/FAIL semantics (the
///     overclaim never blocks the trade) are preserved exactly, only the
///     diagnostic event emission is omitted. Declared as a deviation from the
///     doc's pseudocode.
contract TransferRestrictionMetadata is BaseElement, Governed {
    bytes32 internal constant ELEMENT_ID = "B-03-v1";

    // Reason code map — n in ReasonCodes.encode(0, ELEMENT_ID, n) --> doc §6.2 name:
    // 1 = RESTRICTION_DECL_MISSING   (gate ① — declaration block absent; missing != false)
    // 2 = RESTRICTION_STATUS_CONFLICT(gate ② — framework requires restricted, flag says false)
    // 3 = RESTRICTION_TAGS_INCOMPLETE(gate ③ — a required tag is empty/unset/mismatched)
    // 4 = RESTRICTION_TAG_INVALID    (gate ③ — a tag holds a value outside its legal set)
    // 5 = RESTRICTION_TAG_CONFLICT   (gate ④ — tags contradict each other in the relaxing direction)
    // 6 = UNRESTRICT_BASIS_MISSING   (gate ⑤ — flag=false claimed without an approved exit basis)

    /// @dev Card-external legend value: distinguishes non-reporting (12-month
    ///     Rule 144(d)(1)(ii) floor) from reporting-for-90-days (6-month
    ///     144(d)(1)(i) floor). UNSET (0) is the fail-closed default for an
    ///     undeclared/incomplete card and is never a valid final value.
    enum ReportingStatus {
        UNSET,
        NON_REPORTING,
        REPORTING_90D
    }

    /// @dev Per-asset (per-class) restriction declaration — the digital legend.
    ///     `declared` is a distinct tri-state presence flag: a card that never
    ///     had a declaration block written (`declared == false`) is a
    ///     different failure (DECL_MISSING) from one that explicitly declares
    ///     `restrictedFlag == false` (a STATUS_CONFLICT candidate) — collapsing
    ///     the two by treating "missing" as "false" is the doc's flagged
    ///     regression (§5.3 row ①).
    struct RestrictionDecl {
        bool declared;
        bool restrictedFlag;
        bytes32 issuanceFramework;
        uint32 enabledResalePaths; // bitmask; 0 = no path declared
        uint8 holdingPeriodMonths; // legal set {6, 12} — SET MEMBERSHIP, not a magnitude comparison
        ReportingStatus reportingStatus;
        bool currentInfoRequired;
        bytes32 legendRef; // 0 = missing citation anchor
        bytes32 classRef; // must equal legalClassId (§4(a)(7)(d)(3)(C) — declaration binds to a specific class)
        bytes32 legalClassId;
        bytes32 unrestrictBasisRef; // 0 = no exit basis registered
    }

    /// @notice asset => restriction declaration (default: all-zero => undeclared).
    mapping(address => RestrictionDecl) public declarationOf;

    /// @notice Governance constant, kept OUTSIDE the card (self-reference
    ///     guard, doc §5.2/§4.2): issuance framework => whether Rule
    ///     144(a)(3)-derived status requires `restrictedFlag == true`.
    mapping(bytes32 => bool) public requiresRestricted;

    /// @notice Governance constant: bitmask of resale-path enum values the
    ///     system currently recognizes as valid (`enabledResalePaths` must be
    ///     a non-empty subset of this mask).
    uint32 public validPathsMask;

    /// @notice Governance constant: basis references (opinion letter + TA
    ///     confirmation, registered off-chain and referenced by hash) approved
    ///     to support an `unrestrictBasisRef` exit claim.
    mapping(bytes32 => bool) public approvedUnrestrictBasis;

    event DeclarationSet(address indexed asset, bytes32 declarationHash);
    event RequiresRestrictedSet(bytes32 indexed issuanceFramework, bool required);
    event ValidPathsMaskSet(uint32 mask);
    event ApprovedUnrestrictBasisSet(bytes32 indexed basisRef, bool approved);

    constructor()
        BaseElement(ElementMetadata({
                elementId: ELEMENT_ID,
                category: ElementCategory.ASSET_ATTRIBUTE,
                version: "B-03-v1",
                temporal: TemporalNature.ONE_TIME,
                decidability: Decidability.DETERMINISTIC,
                timing: ObligationTiming.AT_TRADE_GATE,
                statefulness: Statefulness.STATELESS
            }))
    {}

    /// @notice Writes (or clears, by passing a zeroed struct) the restriction
    ///     declaration for `asset` as one atomic block.
    function setDeclaration(address asset, RestrictionDecl calldata decl) external onlyOperator {
        declarationOf[asset] = decl;
        emit DeclarationSet(asset, keccak256(abi.encode(decl)));
    }

    /// @notice Sets whether `issuanceFramework` requires `restrictedFlag == true`
    ///     (Rule 144(a)(3) status derivation, held off the card).
    function setRequiresRestricted(bytes32 issuanceFramework, bool required) external onlyOperator {
        requiresRestricted[issuanceFramework] = required;
        emit RequiresRestrictedSet(issuanceFramework, required);
    }

    /// @notice Sets the system-recognized valid resale-path bitmask.
    function setValidPathsMask(uint32 mask) external onlyOperator {
        validPathsMask = mask;
        emit ValidPathsMaskSet(mask);
    }

    /// @notice Approves (or revokes approval of) an unrestrict exit basis
    ///     reference for use in gate ⑤.
    function setApprovedUnrestrictBasis(bytes32 basisRef, bool approved) external onlyOperator {
        approvedUnrestrictBasis[basisRef] = approved;
        emit ApprovedUnrestrictBasisSet(basisRef, approved);
    }

    /// @dev Evaluates the doc §5.2 gates ①–⑤ in order against `asset`'s
    ///     declaration, returning the FIRST failing code. `user`, `counterparty`,
    ///     `amount` and `context` are ignored — asset-side check (AssetClassification
    ///     precedent).
    function check(address, address, address asset, uint256, bytes calldata)
        external
        view
        override
        returns (bool passed, bytes32 reasonCode)
    {
        RestrictionDecl memory d = declarationOf[asset];

        // ① existence — a legend slot that was never written is a distinct
        //    failure from one explicitly declaring restrictedFlag = false.
        if (!d.declared) {
            return (false, ReasonCodes.encode(0, ELEMENT_ID, 1));
        }

        // ② status conflict — Rule 144(a)(3) derivation vs. declared flag.
        //    Direction rule: only the RELAXING mismatch (required=true,
        //    flag=false) is blocked. required=false with flag=true is a
        //    HARDENING (conservative) declaration and passes — there is no
        //    symmetric check in the other direction.
        if (requiresRestricted[d.issuanceFramework] && !d.restrictedFlag) {
            return (false, ReasonCodes.encode(0, ELEMENT_ID, 2));
        }

        if (d.restrictedFlag) {
            // ③ required-tag completeness and validity (Rule 502(d)(3) elements).
            if (d.enabledResalePaths == 0) {
                // Non-zero check is separate from the subset check below: the
                // empty set is (vacuously) a subset of validPathsMask, so a
                // subset-only test would let an empty declaration through —
                // the doc's flagged regression (§5.3 row ③a).
                return (false, ReasonCodes.encode(0, ELEMENT_ID, 3));
            }
            if (d.enabledResalePaths & ~validPathsMask != 0) {
                return (false, ReasonCodes.encode(0, ELEMENT_ID, 4));
            }
            if (d.holdingPeriodMonths != 6 && d.holdingPeriodMonths != 12) {
                // Rule 144(d)(1) gives exactly two lawful values — this is
                // SET MEMBERSHIP, never "holdingPeriodMonths >= 6" or any
                // other magnitude comparison (doc §5.3 row ③b).
                return (false, ReasonCodes.encode(0, ELEMENT_ID, 4));
            }
            if (d.reportingStatus == ReportingStatus.UNSET) {
                return (false, ReasonCodes.encode(0, ELEMENT_ID, 3));
            }
            if (d.classRef != d.legalClassId) {
                return (false, ReasonCodes.encode(0, ELEMENT_ID, 3));
            }
            if (d.legendRef == bytes32(0)) {
                return (false, ReasonCodes.encode(0, ELEMENT_ID, 3));
            }

            // ④ internal tag consistency — relaxing-direction contradictions
            //    only (Rule 144(d)(1)/(b)(1)).
            if (d.reportingStatus == ReportingStatus.NON_REPORTING && d.holdingPeriodMonths == 6) {
                // Non-reporting issuer's floor is 12 months; a 6-month tag
                // relaxes that floor and would misdirect C-01.
                return (false, ReasonCodes.encode(0, ELEMENT_ID, 5));
            }
            // NON_REPORTING && currentInfoRequired == true is a HARDENING
            // overclaim (the asset asserts a stricter info requirement than
            // its non-reporting status demands) — doc §5.2 sends this to a
            // non-blocking REVIEW queue, not a FAIL. As noted in the
            // contract-level @dev comment, `check` cannot emit the doc's
            // `ReviewQueued` event because it must remain `view`; the
            // non-blocking behavior itself (falling through without
            // reverting/failing) is preserved.
            if (d.reportingStatus == ReportingStatus.REPORTING_90D && !d.currentInfoRequired) {
                return (false, ReasonCodes.encode(0, ELEMENT_ID, 5));
            }
        } else {
            // ⑤ unrestrict exit basis — reached only when gate ② allows
            //    restrictedFlag == false. Requires both presence AND approved-
            //    chain membership; checking presence alone would let an
            //    unapproved basis reference flag the asset unrestricted
            //    (doc §5.3 row ⑤).
            if (d.unrestrictBasisRef == bytes32(0) || !approvedUnrestrictBasis[d.unrestrictBasisRef]) {
                return (false, ReasonCodes.encode(0, ELEMENT_ID, 6));
            }
        }

        return (true, bytes32(0));
    }
}
