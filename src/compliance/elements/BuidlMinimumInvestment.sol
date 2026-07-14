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

/// @dev BUIDL-like demo minimum investment threshold.
///
/// This is a test-issuance rule for the Giwa MVP profile, not a claim that the
/// live BlackRock/Securitize BUIDL token can be integrated through this element.
/// The engine passes the regulated asset quantity as `amount`; in this demo the
/// BUIDL-like unit is treated as a $1 NAV share, so 5,000,000 tokens models the
/// public $5M minimum-investment fact documented in the product spec.
contract BuidlMinimumInvestment is BaseElement {
    bytes32 internal constant ELEMENT_ID = "BUIDL-MIN-v1";
    uint256 public constant MINIMUM_AMOUNT = 5_000_000 ether;

    constructor()
        BaseElement(ElementMetadata({
                elementId: ELEMENT_ID,
                category: ElementCategory.ASSET_ATTRIBUTE,
                version: "BUIDL-MIN-v1",
                temporal: TemporalNature.REALTIME,
                decidability: Decidability.DETERMINISTIC,
                timing: ObligationTiming.AT_TRADE_GATE,
                statefulness: Statefulness.STATELESS
            }))
    {}

    function check(address, address, address, uint256 amount, bytes calldata)
        external
        pure
        override
        returns (bool passed, bytes32 reasonCode)
    {
        passed = amount >= MINIMUM_AMOUNT;
        reasonCode = passed ? bytes32(0) : ReasonCodes.encode(0, ELEMENT_ID, 1);
    }
}
