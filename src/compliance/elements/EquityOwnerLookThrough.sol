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

/// @dev A-09-v1 Equity owner recursive look-through (mock). Stands in for the
///      off-chain recursive ownership-graph walk (doc §5.2: depth/graph guard,
///      natural-person base case, entity-independent-qualification shortcut,
///      trust/family-company/formed-for-purpose branches) performed by a
///      Trusted Issuer. On-chain this element only records that walk's settled
///      outcome per subject and gates on it — it does not itself traverse
///      ownership graphs.
///
///      NONE => dormant: no look-through was required/recorded for this
///      subject, so `check` PASSes. A-09 does not decide whether a look-through
///      was actually owed; A-08 (entity eligibility) is the consumer that
///      treats NONE as a missing prerequisite when the buyer's claimed category
///      requires one. Operators may reset a subject back to NONE (revocation).
///
///      Reason codes collapse the doc §6.2 REVIEW_*/FAIL_* families into two
///      on-chain outcomes (fine-grained internal cause stays off-chain, per the
///      buyer-facing-vs-internal-record split in doc §6.4):
///        n | doc §6.2 code(s) collapsed in
///        1 | REVIEW_OWNERSHIP_GRAPH_INCOMPLETE, REVIEW_LOOKTHROUGH_DEPTH_EXCEEDED,
///          | REVIEW_FAMILY_OWNERSHIP_ATTRIBUTION, REVIEW_AI_LOOKTHROUGH_PENDING,
///          | REVIEW_TRUST_QP_IV_INDEPENDENT, PARTIAL_REVIEW  (graph incomplete => review/wait)
///        2 | FAIL_LOOKTHROUGH_OWNER_NOT_QUALIFIED, FAIL_AI_OWNER_NOT_ACCREDITED,
///          | FAIL_FORMED_FOR_SPECIFIC_PURPOSE_NON_QP, FAIL_FAMILY_COMPOSITION_NOT_MET
///          | (non-qualifying owner found)
contract EquityOwnerLookThrough is BaseElement, Governed, ILookThroughSource {
    bytes32 internal constant ELEMENT_ID = "A-09-v1";

    /// @dev subject => settled recursive look-through outcome. Default (unset)
    ///      is NONE, matching ILookThroughSource's documented dormant default.
    mapping(address => LookThroughStatus) public statusOf;

    event LookThroughStatusSet(address indexed subject, LookThroughStatus status);

    constructor()
        BaseElement(ElementMetadata({
                elementId: ELEMENT_ID,
                category: ElementCategory.INVESTOR_ATTRIBUTE,
                version: "A-09-v1",
                temporal: TemporalNature.ONE_TIME,
                decidability: Decidability.ATTESTATION_BASED,
                timing: ObligationTiming.EX_ANTE_VERIFY,
                statefulness: Statefulness.STATELESS
            }))
    {}

    /// @notice Records the Trusted Issuer's settled look-through outcome for
    ///         `subject`. Setting NONE is a valid, explicit revocation.
    function setLookThroughStatus(address subject, LookThroughStatus status) external onlyOperator {
        statusOf[subject] = status;
        emit LookThroughStatusSet(subject, status);
    }

    /// @dev NONE/COMPLETED PASS; PENDING/FAILED FAIL with the collapsed codes
    ///      documented on the contract (doc §6.2).
    function check(address user, address, address, uint256, bytes calldata)
        external
        view
        override
        returns (bool passed, bytes32 reasonCode)
    {
        LookThroughStatus status = statusOf[user];

        if (status == LookThroughStatus.NONE || status == LookThroughStatus.COMPLETED) {
            return (true, bytes32(0));
        }
        if (status == LookThroughStatus.PENDING) {
            return (false, ReasonCodes.encode(0, ELEMENT_ID, 1));
        }
        // status == LookThroughStatus.FAILED
        return (false, ReasonCodes.encode(0, ELEMENT_ID, 2));
    }
}
