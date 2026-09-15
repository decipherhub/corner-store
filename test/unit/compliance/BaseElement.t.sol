// SPDX-License-Identifier: GPL-3.0
pragma solidity 0.8.17;

import {Test} from "forge-std/Test.sol";
import {BaseElement} from "../../../src/compliance/elements/BaseElement.sol";
import {
    ElementMetadata,
    ElementCategory,
    TemporalNature,
    Decidability,
    ObligationTiming,
    Statefulness,
    EvidenceType,
    EnforcementAction
} from "../../../src/types/ComplianceTypes.sol";
import {ReasonCodes} from "../../../src/libraries/ReasonCodes.sol";

contract ParameterCapabilityElement is BaseElement {
    constructor(bytes32 schemaId, uint16 schemaVersion, uint32 maxBytes, bool required)
        BaseElement(ElementMetadata({
                elementId: bytes32("PARAMETER-TEST"),
                category: ElementCategory.ASSET_ATTRIBUTE,
                version: "1.0.0",
                temporal: TemporalNature.REALTIME,
                decidability: Decidability.DETERMINISTIC,
                timing: ObligationTiming.AT_TRADE_GATE,
                statefulness: Statefulness.STATELESS,
                evidenceType: EvidenceType.TRANSACTION_CONTEXT,
                defaultEnforcement: EnforcementAction.BLOCK,
                parameterSchemaId: schemaId,
                parameterSchemaVersion: schemaVersion,
                maxParameterBytes: maxBytes,
                parametersRequired: required
            }))
    {}

    function _check(address, address, address, uint256, bytes calldata, bytes calldata parameters)
        internal
        pure
        override
        returns (bool, bytes32)
    {
        return (true, keccak256(parameters));
    }
}

contract BaseElementTest is Test {
    bytes32 internal constant ELEMENT_ID = bytes32("PARAMETER-TEST");
    bytes32 internal constant SCHEMA_ID = keccak256("corner-store.test.parameter-schema");

    function test_parameterlessElement_accepts_empty_parameters() public {
        ParameterCapabilityElement element = new ParameterCapabilityElement(bytes32(0), 0, 0, false);

        (bool passed, bytes32 reasonCode) = element.check(address(1), address(2), address(3), 4, "context", "");

        assertTrue(passed);
        assertEq(reasonCode, keccak256(""));
    }

    function test_parameterlessElement_rejects_nonEmpty_parameters() public {
        ParameterCapabilityElement element = new ParameterCapabilityElement(bytes32(0), 0, 0, false);

        (bool passed, bytes32 reasonCode) = element.check(address(1), address(2), address(3), 4, "context", hex"01");

        assertFalse(passed);
        assertEq(reasonCode, ReasonCodes.encode(0, ELEMENT_ID, type(uint32).max));
    }

    function test_requiredParameters_reject_empty_and_delegate_valid_payload() public {
        ParameterCapabilityElement element = new ParameterCapabilityElement(SCHEMA_ID, 1, 4, true);

        (bool missingPassed, bytes32 missingReason) =
            element.check(address(1), address(2), address(3), 4, "context", "");
        (bool validPassed, bytes32 validReason) =
            element.check(address(1), address(2), address(3), 4, "context", hex"01020304");

        assertFalse(missingPassed);
        assertEq(missingReason, ReasonCodes.encode(0, ELEMENT_ID, type(uint32).max));
        assertTrue(validPassed);
        assertEq(validReason, keccak256(hex"01020304"));
    }

    function test_parameters_reject_payload_over_declared_bound() public {
        ParameterCapabilityElement element = new ParameterCapabilityElement(SCHEMA_ID, 1, 3, false);

        (bool passed, bytes32 reasonCode) =
            element.check(address(1), address(2), address(3), 4, "context", hex"01020304");

        assertFalse(passed);
        assertEq(reasonCode, ReasonCodes.encode(0, ELEMENT_ID, type(uint32).max));
    }

    function test_optionalParameters_accept_empty_payload() public {
        ParameterCapabilityElement element = new ParameterCapabilityElement(SCHEMA_ID, 1, 4, false);

        (bool passed, bytes32 reasonCode) = element.check(address(1), address(2), address(3), 4, "context", "");

        assertTrue(passed);
        assertEq(reasonCode, keccak256(""));
    }
}
