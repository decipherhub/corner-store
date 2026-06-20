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

/// @dev A-01-v1 Sanctions screen (mock). Blocks listed users at the trade gate.
///      Real list management is out of scope — a settable mapping stands in.
contract Sanctions is BaseElement {
    bytes32 internal constant ELEMENT_ID = "A-01-v1";

    mapping(address => bool) public blocked;

    constructor()
        BaseElement(ElementMetadata({
                elementId: ELEMENT_ID,
                category: ElementCategory.INVESTOR_ATTRIBUTE,
                version: "A-01-v1",
                temporal: TemporalNature.REALTIME,
                decidability: Decidability.DETERMINISTIC,
                timing: ObligationTiming.AT_TRADE_GATE,
                statefulness: Statefulness.STATELESS
            }))
    {}

    function setBlocked(address user, bool isBlocked) external {
        blocked[user] = isBlocked;
    }

    function check(address user, address, address, uint256, bytes calldata)
        external
        view
        override
        returns (bool passed, bytes32 reasonCode)
    {
        passed = !blocked[user];
        // recipeId 0 is a placeholder; the engine re-encodes with the real recipeId.
        reasonCode = passed ? bytes32(0) : ReasonCodes.encode(0, ELEMENT_ID, 1);
    }
}
