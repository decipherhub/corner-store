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

/// @dev A-05-v1 US tax residency exclusion (mock). Phase 1·2 scope excludes US
///      tax residents (IRS Substantial Presence Test), so `check` FAILS for a
///      flagged resident. Settable per-user flag stands in for a real ONCHAINID
///      claim. NOTE the exclusion shape: an unflagged/default user PASSES —
///      absence of a flag is treated as "not a US tax resident". A production
///      implementation would instead require a positive non-residency
///      attestation (Pattern B, claim existence + issuer + expiry) rather than
///      inferring non-residency from the mere absence of a flag.
contract UsTaxResident is BaseElement, Governed {
    bytes32 internal constant ELEMENT_ID = "A-05-v1";

    mapping(address => bool) public usTaxResident;

    event UsTaxResidentSet(address indexed investor, bool isResident);

    constructor()
        BaseElement(ElementMetadata({
                elementId: ELEMENT_ID,
                category: ElementCategory.INVESTOR_ATTRIBUTE,
                version: "A-05-v1",
                temporal: TemporalNature.ONE_TIME,
                decidability: Decidability.DETERMINISTIC,
                timing: ObligationTiming.EX_ANTE_VERIFY,
                statefulness: Statefulness.STATELESS
            }))
    {}

    function setUsTaxResident(address investor, bool isResident) external onlyOperator {
        usTaxResident[investor] = isResident;
        emit UsTaxResidentSet(investor, isResident);
    }

    function check(address user, address, address, uint256, bytes calldata)
        external
        view
        override
        returns (bool passed, bytes32 reasonCode)
    {
        passed = !usTaxResident[user];
        reasonCode = passed ? bytes32(0) : ReasonCodes.encode(0, ELEMENT_ID, 1);
    }
}
