// SPDX-License-Identifier: GPL-3.0
pragma solidity 0.8.17;

import {Test} from "forge-std/Test.sol";
import {IdentityUniquenessV2} from "../../../../src/compliance/elements/IdentityUniquenessV2.sol";
import {IdentityUniqueness} from "../../../../src/compliance/elements/IdentityUniqueness.sol";
import {ElementMetadata, EnforcementAction} from "../../../../src/types/ComplianceTypes.sol";
import {ReasonCodes} from "../../../../src/libraries/ReasonCodes.sol";

contract IdentityUniquenessV2Test is Test {
    IdentityUniquenessV2 internal element;
    bytes32 internal constant ELEMENT_ID = "A-04-v2";

    function setUp() public {
        element = new IdentityUniquenessV2();
    }

    function test_topology_metadataRequiresExactVersionedParameters() public view {
        ElementMetadata memory m = element.elementMetadata();
        assertEq(m.elementId, ELEMENT_ID);
        assertEq(m.parameterSchemaId, keccak256("corner-store.element.identity-policy.v1"));
        assertEq(m.parameterSchemaVersion, 1);
        assertEq(m.maxParameterBytes, 64);
        assertTrue(m.parametersRequired);
        assertEq(uint256(m.defaultEnforcement), uint256(EnforcementAction.BLOCK));
    }

    function test_topology_missingMalformedAndMemberFailBeforeEvidence() public view {
        _assertInvalid("");
        _assertInvalid(hex"01");
        _assertInvalid(abi.encode(uint8(1)));
        _assertInvalid(abi.encode(uint8(1), uint8(2)));
        _assertInvalid(abi.encode(uint8(2), uint8(2)));
        _assertInvalid(abi.encode(uint8(1), uint8(0)));
        _assertInvalid(abi.encode(uint8(1), uint8(3)));
        _assertInvalid(abi.encode(uint8(0), uint8(1)));
        _assertInvalid(abi.encode(uint8(3), uint8(1)));
        _assertInvalid(abi.encode(uint256(257), uint8(1)));
        _assertInvalid(abi.encode(uint8(1), uint8(1), uint8(0)));
    }

    function testFuzz_topology_neverTruncatesNoncanonicalWords(uint256 track, uint256 topology) public view {
        vm.assume((track != 1 && track != 2) || topology != 1);
        _assertInvalid(abi.encode(track, topology));
    }

    function test_topology_directStillFailsWithoutAcceptedEvidence() public view {
        for (uint8 track = 1; track <= 2; track++) {
            (bool passed, bytes32 reason) =
                element.check(address(1), address(2), address(3), 1, "", abi.encode(track, uint8(1)));
            assertFalse(passed);
            assertEq(reason, ReasonCodes.encode(0, ELEMENT_ID, 2));
        }
    }

    function test_topology_v1RemainsParameterlessAndKeepsLegacyBindingBehavior() public {
        IdentityUniqueness legacy = new IdentityUniqueness();
        legacy.bindIdentity(address(1), bytes32("legacy"));
        (bool passed,) = legacy.check(address(1), address(2), address(3), 1, "", "");
        assertTrue(passed);
        assertEq(legacy.elementMetadata().elementId, bytes32("A-04-v1"));
        assertEq(legacy.elementMetadata().maxParameterBytes, 0);
    }

    function _assertInvalid(bytes memory parameters) internal view {
        (bool passed, bytes32 reason) = element.check(address(1), address(2), address(3), 1, "", parameters);
        assertFalse(passed);
        assertEq(reason, ReasonCodes.invalidElementParameters(ELEMENT_ID));
    }
}
