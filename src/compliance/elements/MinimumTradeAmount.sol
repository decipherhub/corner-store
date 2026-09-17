// SPDX-License-Identifier: GPL-3.0
pragma solidity 0.8.17;

import {BaseElement} from "./BaseElement.sol";
import {
    ElementMetadata,
    ElementCategory,
    TemporalNature,
    Decidability,
    ObligationTiming,
    Statefulness,
    EvidenceType,
    EnforcementAction
} from "../../types/ComplianceTypes.sol";
import {PredicateValidation} from "../../libraries/PredicateValidation.sol";
import {ReasonCodes} from "../../libraries/ReasonCodes.sol";

/// @notice Asset-independent minimum trade amount gate.
/// @dev The threshold is Manifest-owned ABI-encoded uint256 policy data.
contract MinimumTradeAmount is BaseElement {
    bytes32 public constant ELEMENT_ID = "MIN-AMOUNT-v1";
    bytes32 public constant PARAMETER_SCHEMA_ID = keccak256("corner-store.element.minimum-trade-amount.v1");

    constructor()
        BaseElement(ElementMetadata({
                elementId: ELEMENT_ID,
                category: ElementCategory.RESALE_TRANSACTION,
                version: "MIN-AMOUNT-v1",
                temporal: TemporalNature.REALTIME,
                decidability: Decidability.DETERMINISTIC,
                timing: ObligationTiming.AT_TRADE_GATE,
                statefulness: Statefulness.STATELESS,
                evidenceType: EvidenceType.TRANSACTION_CONTEXT,
                defaultEnforcement: EnforcementAction.BLOCK,
                parameterSchemaId: PARAMETER_SCHEMA_ID,
                parameterSchemaVersion: 1,
                maxParameterBytes: 32,
                parametersRequired: true
            }))
    {}

    function _check(address, address, address, uint256 amount, bytes calldata, bytes calldata parameters)
        internal
        pure
        override
        returns (bool passed, bytes32 reasonCode)
    {
        (bool valid, uint256 minimumAmount) = PredicateValidation.boundedUint(parameters, 1, type(uint256).max);
        if (!valid) return (false, ReasonCodes.invalidElementParameters(ELEMENT_ID));
        passed = amount >= minimumAmount;
        reasonCode = passed ? bytes32(0) : ReasonCodes.encode(0, ELEMENT_ID, 1);
    }
}
