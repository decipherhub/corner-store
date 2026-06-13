// SPDX-License-Identifier: GPL-3.0
pragma solidity 0.8.17;

import {BaseElement} from "./BaseElement.sol";
import {
    ElementMetadata,
    ElementCategory,
    TemporalNature,
    Decidability,
    ObligationTiming,
    Statefulness
} from "../../types/ComplianceTypes.sol";
import {ReasonCodes} from "../../libraries/ReasonCodes.sol";

/// @dev A-03-v1 Accredited investor attestation (mock). Settable per-user flag
///      stands in for a real claim (existence + issuer + expiry, Pattern B).
contract AccreditedInvestor is BaseElement {
    bytes32 internal constant ELEMENT_ID = "A-03-v1";

    mapping(address => bool) public accredited;

    constructor()
        BaseElement(ElementMetadata({
                elementId: ELEMENT_ID,
                category: ElementCategory.INVESTOR_ATTRIBUTE,
                version: "A-03-v1",
                temporal: TemporalNature.ONE_TIME,
                decidability: Decidability.ATTESTATION_BASED,
                timing: ObligationTiming.EX_ANTE_VERIFY,
                statefulness: Statefulness.STATELESS
            }))
    {}

    function setAccredited(address user, bool isAccredited) external {
        accredited[user] = isAccredited;
    }

    function check(address user, address, address, uint256, bytes calldata)
        external
        view
        override
        returns (bool passed, bytes32 reasonCode)
    {
        passed = accredited[user];
        reasonCode = passed ? bytes32(0) : ReasonCodes.encode(0, ELEMENT_ID, 1);
    }
}
