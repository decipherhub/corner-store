// SPDX-License-Identifier: GPL-3.0
pragma solidity 0.8.17;

import {Test} from "forge-std/Test.sol";
import {RedFlagKnowledgeBar} from "../../../../src/compliance/elements/RedFlagKnowledgeBar.sol";
import {RedFlagKnowledgeBarV2} from "../../../../src/compliance/elements/RedFlagKnowledgeBarV2.sol";
import {ElementRegistry} from "../../../../src/registry/ElementRegistry.sol";
import {Errors} from "../../../../src/libraries/Errors.sol";
import {ReasonCodes} from "../../../../src/libraries/ReasonCodes.sol";
import {EnforcementAction} from "../../../../src/types/ComplianceTypes.sol";

contract RedFlagKnowledgeBarV2Test is Test {
    event SurveillanceFlag(bytes32 indexed elementId, address indexed subject, bytes32 reasonCode);

    address internal constant SELLER = address(1);
    address internal constant BUYER = address(2);
    RedFlagKnowledgeBarV2 internal element;

    function setUp() public {
        element = new RedFlagKnowledgeBarV2();
    }

    function test_registration_acceptsFlagOnlyMetadata() public {
        ElementRegistry registry = new ElementRegistry();
        registry.registerElement(bytes32("A-12-v2"), address(element), EnforcementAction.FLAG_ONLY);
        assertEq(registry.elementOf(bytes32("A-12-v2")), address(element));
        assertEq(uint256(registry.defaultActionOf(bytes32("A-12-v2"))), uint256(EnforcementAction.FLAG_ONLY));
        assertEq(element.elementMetadata().version, "A-12-v2");
    }

    function test_legacyRegistration_metadataMismatchReproduced() public {
        ElementRegistry registry = new ElementRegistry();
        RedFlagKnowledgeBar legacy = new RedFlagKnowledgeBar();
        vm.expectRevert(abi.encodeWithSelector(Errors.InvalidElementMetadata.selector, bytes32("A-12-v1")));
        registry.registerElement(bytes32("A-12-v1"), address(legacy), EnforcementAction.FLAG_ONLY);
        assertEq(uint256(legacy.elementMetadata().defaultEnforcement), uint256(EnforcementAction.BLOCK));
    }

    function testFuzz_assessments_preserveV1Behavior(uint8 category, bool uncertain, uint8 resolution) public {
        category = uint8(bound(category, 0, 6));
        resolution = uint8(bound(resolution, 0, 3));
        RedFlagKnowledgeBar legacy = new RedFlagKnowledgeBar();
        legacy.raiseFlag(SELLER, BUYER, RedFlagKnowledgeBar.RedFlag(category));
        element.raiseFlag(SELLER, BUYER, RedFlagKnowledgeBarV2.RedFlag(category));
        if (uncertain) {
            legacy.markUncertain(SELLER, BUYER);
            element.markUncertain(SELLER, BUYER);
        }
        legacy.resolveReview(SELLER, BUYER, RedFlagKnowledgeBar.Resolution(resolution));
        element.resolveReview(SELLER, BUYER, RedFlagKnowledgeBarV2.Resolution(resolution));

        (RedFlagKnowledgeBar.Disposition oldDisposition, uint8 oldMask) = legacy.screen(SELLER, BUYER);
        (RedFlagKnowledgeBarV2.Disposition disposition, uint8 mask) = element.screen(SELLER, BUYER);
        assertEq(uint256(disposition), uint256(oldDisposition));
        assertEq(mask, oldMask);
        assertEq(element.routesToReview(SELLER, BUYER), legacy.routesToReview(SELLER, BUYER));
        (uint8 rawMask, bool rawUncertain, RedFlagKnowledgeBarV2.Resolution rawResolution) =
            element.assessmentOf(SELLER, BUYER);
        assertEq(rawMask, uint8(1) << category);
        assertEq(rawUncertain, uncertain);
        assertEq(uint256(rawResolution), resolution);
        (bool passed, bytes32 reason) = element.check(BUYER, SELLER, address(3), 100, "", "");
        assertTrue(passed);
        assertEq(reason, bytes32(0));
    }

    function test_eventsAndReasonCodes_useV2Identity() public {
        bytes32 flagCode = ReasonCodes.encode(0, bytes32("A-12-v2"), 3);
        assertEq(element.reasonCodeFor(RedFlagKnowledgeBarV2.RedFlag.AI_INCONSISTENT), flagCode);
        vm.expectEmit(true, true, false, true, address(element));
        emit SurveillanceFlag(bytes32("A-12-v2"), SELLER, flagCode);
        element.raiseFlag(SELLER, BUYER, RedFlagKnowledgeBarV2.RedFlag.AI_INCONSISTENT);

        bytes32 uncertainCode = ReasonCodes.encode(0, bytes32("A-12-v2"), 8);
        assertEq(element.reviewUncertainCode(), uncertainCode);
        vm.expectEmit(true, true, false, true, address(element));
        emit SurveillanceFlag(bytes32("A-12-v2"), SELLER, uncertainCode);
        element.markUncertain(SELLER, BUYER);
    }

    function test_operatorAuthorization_andReopenedReview() public {
        vm.startPrank(address(99));
        vm.expectRevert(Errors.NotAuthorized.selector);
        element.raiseFlag(SELLER, BUYER, RedFlagKnowledgeBarV2.RedFlag.WASH_CLUSTER);
        vm.expectRevert(Errors.NotAuthorized.selector);
        element.markUncertain(SELLER, BUYER);
        vm.expectRevert(Errors.NotAuthorized.selector);
        element.resolveReview(SELLER, BUYER, RedFlagKnowledgeBarV2.Resolution.CLEARED_FALSE_POSITIVE);
        vm.stopPrank();

        element.setOperator(address(99), true);
        vm.startPrank(address(99));
        element.raiseFlag(SELLER, BUYER, RedFlagKnowledgeBarV2.RedFlag.WASH_CLUSTER);
        element.resolveReview(SELLER, BUYER, RedFlagKnowledgeBarV2.Resolution.CLEARED_FALSE_POSITIVE);
        assertFalse(element.routesToReview(SELLER, BUYER));
        element.markUncertain(SELLER, BUYER);
        assertTrue(element.routesToReview(SELLER, BUYER));
        (,, RedFlagKnowledgeBarV2.Resolution resolution) = element.assessmentOf(SELLER, BUYER);
        assertEq(uint256(resolution), uint256(RedFlagKnowledgeBarV2.Resolution.PENDING));
        vm.stopPrank();
    }

    function test_parameterEnvelope_preservesV1Rejection() public {
        (bool passed, bytes32 reason) = element.check(BUYER, SELLER, address(3), 100, "", hex"01");
        assertFalse(passed);
        assertEq(reason, ReasonCodes.invalidElementParameters(bytes32("A-12-v2")));
    }
}
