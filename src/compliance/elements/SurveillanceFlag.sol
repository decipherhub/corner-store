// SPDX-License-Identifier: GPL-3.0
pragma solidity 0.8.17;

import {BaseStatefulElement} from "./BaseStatefulElement.sol";
import {BaseElement} from "./BaseElement.sol";
import {IComplianceElement} from "../../interfaces/compliance/IComplianceElement.sol";
import {
    ElementMetadata,
    ElementCategory,
    TemporalNature,
    Decidability,
    ObligationTiming,
    Statefulness
} from "../../types/ComplianceTypes.sol";
import {ReasonCodes} from "../../libraries/ReasonCodes.sol";
import {Events} from "../../libraries/Events.sol";

/// @dev F-02-v1 Conduct surveillance (mock, STATEFUL). Flag-not-block: `check`
///      always passes; `onTransfer` accumulates a counter and emits a flag event
///      once it exceeds a settable threshold (post-trade, EX_POST_TRIGGER).
contract SurveillanceFlag is BaseStatefulElement {
    bytes32 internal constant ELEMENT_ID = "F-02-v1";

    uint256 public transferCount;
    uint256 public threshold;

    constructor()
        BaseStatefulElement(ElementMetadata({
                elementId: ELEMENT_ID,
                category: ElementCategory.CONDUCT_MONITORING,
                version: "F-02-v1",
                temporal: TemporalNature.CUMULATIVE,
                decidability: Decidability.MONITORING_BASED,
                timing: ObligationTiming.EX_POST_TRIGGER,
                statefulness: Statefulness.STATEFUL
            }))
    {}

    function setThreshold(uint256 threshold_) external {
        threshold = threshold_;
    }

    /// @dev Never blocks — monitoring elements only flag.
    function check(address, address, address, uint256, bytes calldata)
        external
        pure
        override(BaseElement, IComplianceElement)
        returns (bool passed, bytes32 reasonCode)
    {
        return (true, bytes32(0));
    }

    function onTransfer(address from, address, uint256) external override {
        transferCount += 1;
        if (transferCount > threshold) {
            emit Events.SurveillanceFlag(ELEMENT_ID, from, ReasonCodes.encode(0, ELEMENT_ID, 1));
        }
    }
}
