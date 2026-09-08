// SPDX-License-Identifier: GPL-3.0
pragma solidity 0.8.17;

import {BaseElement} from "./BaseElement.sol";
import {
    ComplianceContext,
    ElementMetadata,
    ElementCategory,
    TemporalNature,
    Decidability,
    ObligationTiming,
    Statefulness
} from "../../types/ComplianceTypes.sol";
import {ReasonCodes} from "../../libraries/ReasonCodes.sol";

/// @title MinimumTradeAmount
/// @notice Reusable threshold predicate whose token-specific amount is supplied
///         by the Manifest's compiled Element parameters.
/// @dev v1 deliberately preserves the former BUIDL demo semantics: the regulated
///      asset quantity for every evaluated trade direction must be at least the
///      configured amount. Subscription-only or post-trade-balance semantics
///      require a separately reviewed Element/version.
contract MinimumTradeAmount is BaseElement {
    bytes32 internal constant ELEMENT_ID = "MIN-TRADE-v1";

    uint32 internal constant REASON_MISSING_OR_MALFORMED_PARAMETER = 1;
    uint32 internal constant REASON_BELOW_MINIMUM = 2;

    constructor()
        BaseElement(ElementMetadata({
                elementId: ELEMENT_ID,
                category: ElementCategory.ASSET_ATTRIBUTE,
                version: "MIN-TRADE-v1",
                temporal: TemporalNature.REALTIME,
                decidability: Decidability.DETERMINISTIC,
                timing: ObligationTiming.AT_TRADE_GATE,
                statefulness: Statefulness.STATELESS
            }))
    {}

    function check(address, address, address, uint256 amount, bytes calldata context)
        external
        pure
        override
        returns (bool passed, bytes32 reasonCode)
    {
        // abi.encode(ComplianceContext, bytes) contains a 12-word head, then
        // the byte length and payload. A uint256 setting is exactly 32 bytes.
        if (context.length != 448) {
            return (false, ReasonCodes.encode(0, ELEMENT_ID, REASON_MISSING_OR_MALFORMED_PARAMETER));
        }
        (, bytes memory parameter) = abi.decode(context, (ComplianceContext, bytes));
        if (parameter.length != 32) {
            return (false, ReasonCodes.encode(0, ELEMENT_ID, REASON_MISSING_OR_MALFORMED_PARAMETER));
        }
        uint256 minimumAmount = abi.decode(parameter, (uint256));
        if (minimumAmount == 0) {
            return (false, ReasonCodes.encode(0, ELEMENT_ID, REASON_MISSING_OR_MALFORMED_PARAMETER));
        }
        passed = amount >= minimumAmount;
        reasonCode = passed ? bytes32(0) : ReasonCodes.encode(0, ELEMENT_ID, REASON_BELOW_MINIMUM);
    }
}
