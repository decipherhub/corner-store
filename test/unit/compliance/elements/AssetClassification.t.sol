// SPDX-License-Identifier: GPL-3.0
pragma solidity 0.8.17;

import {Test} from "forge-std/Test.sol";
import {AssetClassification} from "../../../../src/compliance/elements/AssetClassification.sol";
import {Errors} from "../../../../src/libraries/Errors.sol";
import {ElementMetadata, ElementCategory, Decidability, Statefulness} from "../../../../src/types/ComplianceTypes.sol";

contract AssetClassificationTest is Test {
    // Re-declared to match AssetClassification.ClassificationSet for vm.expectEmit
    // (Solidity 0.8.17 cannot reference a non-library contract's event by
    // qualified name in an `emit` statement; that requires >=0.8.22).
    event ClassificationSet(address indexed asset, bytes32 classification);

    bytes32 internal constant REG_D = bytes32("REG_D");
    bytes32 internal constant REG_A = bytes32("REG_A");

    address internal asset = address(0xBEEF);
    address internal otherAsset = address(0xCAFE);
    address internal operator = address(0x0733);
    address internal stranger = address(0xBAD);

    AssetClassification internal element;

    function setUp() public {
        element = new AssetClassification(REG_D);
    }

    function test_constructor_setsRequiredClassification() public {
        assertEq(element.requiredClassification(), REG_D);
    }

    function test_constructor_revertsOnZeroRequiredClassification() public {
        vm.expectRevert(AssetClassification.ZeroRequiredClassification.selector);
        new AssetClassification(bytes32(0));
    }

    function test_metadata_fields() public {
        ElementMetadata memory m = element.elementMetadata();
        assertEq(m.elementId, bytes32("B-01-v1"));
        assertEq(uint256(m.category), uint256(ElementCategory.ASSET_ATTRIBUTE));
        assertEq(uint256(m.decidability), uint256(Decidability.DETERMINISTIC));
        assertEq(uint256(m.statefulness), uint256(Statefulness.STATELESS));
    }

    function test_setClassification_revertsForNonOperator() public {
        vm.prank(stranger);
        vm.expectRevert(Errors.NotAuthorized.selector);
        element.setClassification(asset, REG_D);
    }

    function test_setClassification_ownerCanSet_andEmitsEvent_andUpdatesStorage() public {
        vm.expectEmit(true, false, false, true);
        emit ClassificationSet(asset, REG_D);
        element.setClassification(asset, REG_D);

        assertEq(element.classificationOf(asset), REG_D);
    }

    function test_setClassification_operatorCanSet() public {
        element.setOperator(operator, true);

        vm.prank(operator);
        element.setClassification(asset, REG_D);

        assertEq(element.classificationOf(asset), REG_D);
    }

    function test_check_passesWhenAssetHasRequiredClassification() public {
        element.setClassification(asset, REG_D);

        (bool passed, bytes32 reasonCode) = element.check(address(0xA11CE), address(0), asset, 0, "");
        assertTrue(passed);
        assertEq(reasonCode, bytes32(0));
    }

    function test_check_failsWhenAssetUnclassified() public {
        // Default classification for any never-set asset is bytes32(0), which
        // must fail because requiredClassification (REG_D) is non-zero.
        (bool passed, bytes32 reasonCode) = element.check(address(0xA11CE), address(0), otherAsset, 0, "");
        assertFalse(passed);
        assertTrue(reasonCode != bytes32(0));
    }

    function test_check_failsWhenAssetHasWrongClassification() public {
        element.setClassification(asset, REG_A);

        (bool passed, bytes32 reasonCode) = element.check(address(0xA11CE), address(0), asset, 0, "");
        assertFalse(passed);
        assertTrue(reasonCode != bytes32(0));
    }

    function test_check_ignoresUserParameter() public {
        element.setClassification(asset, REG_D);

        (bool passed1,) = element.check(address(0xA11CE), address(0), asset, 0, "");
        (bool passed2,) = element.check(address(0xB0B), address(0xDEAD), asset, 12345, "");
        assertTrue(passed1);
        assertTrue(passed2);
        assertEq(passed1, passed2);

        // Same holds on the fail path (unclassified asset), regardless of user.
        (bool failed1,) = element.check(address(0x1111), address(0), otherAsset, 0, "");
        (bool failed2,) = element.check(address(0x2222), address(0x3333), otherAsset, 999, "");
        assertFalse(failed1);
        assertFalse(failed2);
        assertEq(failed1, failed2);
    }
}
