// SPDX-License-Identifier: GPL-3.0
pragma solidity 0.8.17;

import {Test} from "forge-std/Test.sol";
import {AttestedAcquisitionSource} from "../../../src/registry/AttestedAcquisitionSource.sol";
import {IAcquisitionSource} from "../../../src/interfaces/compliance/IAcquisitionSource.sol";
import {Lockup} from "../../../src/compliance/elements/Lockup.sol";
import {Errors} from "../../../src/libraries/Errors.sol";
import {ReasonCodes} from "../../../src/libraries/ReasonCodes.sol";

contract AcquisitionSourceTest is Test {
    AttestedAcquisitionSource internal source;
    Lockup internal lockup;
    address internal holder = address(0xA11CE);
    address internal asset = address(0xBEEF);
    address internal operator = address(0x0B);
    uint64 internal constant LOCKUP = 100;

    function setUp() public {
        vm.warp(1_000);
        source = new AttestedAcquisitionSource();
        source.setOperator(operator, true);
        lockup = new Lockup(address(source), LOCKUP);
    }

    function test_validSnapshot_passesAfterLockup() public {
        _setValid(800, 2_000);
        (bool passed, bytes32 reasonCode) = lockup.check(holder, address(0), asset, 0, "");
        assertTrue(passed);
        assertEq(reasonCode, bytes32(0));
    }

    function test_missingSnapshot_failsClosed() public view {
        (bool passed, bytes32 reasonCode) = lockup.check(holder, address(0), asset, 0, "");
        assertFalse(passed);
        assertEq(reasonCode, ReasonCodes.encode(0, bytes32("C-01-v1"), 1));
    }

    function test_brokenLineage_failsClosed() public {
        vm.prank(operator);
        source.setSnapshot(
            holder, asset, 0, 2_000, keccak256("broken"), IAcquisitionSource.AcquisitionStatus.LINEAGE_BROKEN
        );
        (bool passed, bytes32 reasonCode) = lockup.check(holder, address(0), asset, 0, "");
        assertFalse(passed);
        assertEq(reasonCode, ReasonCodes.encode(0, bytes32("C-01-v1"), 2));
    }

    function test_expiredSnapshot_failsClosed() public {
        _setValid(800, 1_100);
        vm.warp(1_101);
        (bool passed, bytes32 reasonCode) = lockup.check(holder, address(0), asset, 0, "");
        assertFalse(passed);
        assertEq(reasonCode, ReasonCodes.encode(0, bytes32("C-01-v1"), 3));
    }

    function test_immatureSnapshot_failsClosed() public {
        _setValid(950, 2_000);
        (bool passed, bytes32 reasonCode) = lockup.check(holder, address(0), asset, 0, "");
        assertFalse(passed);
        assertEq(reasonCode, ReasonCodes.encode(0, bytes32("C-01-v1"), 4));
    }

    function test_clearSnapshot_restoresMissingState() public {
        _setValid(800, 2_000);
        vm.prank(operator);
        source.clearSnapshot(holder, asset);
        IAcquisitionSource.AcquisitionSnapshot memory snapshot = source.acquisitionOf(holder, asset);
        assertEq(uint256(snapshot.status), uint256(IAcquisitionSource.AcquisitionStatus.MISSING));
    }

    function test_setSnapshot_revertsForNonOperator() public {
        vm.prank(address(0xBAD));
        vm.expectRevert(Errors.NotAuthorized.selector);
        source.setSnapshot(holder, asset, 800, 2_000, keccak256("source"), IAcquisitionSource.AcquisitionStatus.VALID);
    }

    function test_setSnapshot_rejectsInvalidInputs() public {
        vm.startPrank(operator);
        vm.expectRevert(Errors.ZeroAddress.selector);
        source.setSnapshot(
            address(0), asset, 800, 2_000, keccak256("source"), IAcquisitionSource.AcquisitionStatus.VALID
        );
        vm.expectRevert(Errors.ZeroAddress.selector);
        source.setSnapshot(
            holder, address(0), 800, 2_000, keccak256("source"), IAcquisitionSource.AcquisitionStatus.VALID
        );
        vm.expectRevert(Errors.InvalidAcquisitionSnapshot.selector);
        source.setSnapshot(holder, asset, 0, 2_000, keccak256("source"), IAcquisitionSource.AcquisitionStatus.MISSING);
        vm.expectRevert(Errors.InvalidAcquisitionSnapshot.selector);
        source.setSnapshot(holder, asset, 0, 2_000, keccak256("source"), IAcquisitionSource.AcquisitionStatus.VALID);
        vm.expectRevert(Errors.InvalidAcquisitionSnapshot.selector);
        source.setSnapshot(holder, asset, 1_001, 2_000, keccak256("source"), IAcquisitionSource.AcquisitionStatus.VALID);
        vm.expectRevert(Errors.InvalidAcquisitionSnapshot.selector);
        source.setSnapshot(
            holder, asset, 800, 2_000, keccak256("source"), IAcquisitionSource.AcquisitionStatus.LINEAGE_BROKEN
        );
        vm.expectRevert(Errors.InvalidAcquisitionSnapshot.selector);
        source.setSnapshot(holder, asset, 800, 1_000, keccak256("source"), IAcquisitionSource.AcquisitionStatus.VALID);
        vm.expectRevert(Errors.InvalidAcquisitionSnapshot.selector);
        source.setSnapshot(holder, asset, 800, 2_000, bytes32(0), IAcquisitionSource.AcquisitionStatus.VALID);
        vm.stopPrank();
    }

    function _setValid(uint64 clockStart, uint64 expiresAt) internal {
        vm.prank(operator);
        source.setSnapshot(
            holder, asset, clockStart, expiresAt, keccak256("source"), IAcquisitionSource.AcquisitionStatus.VALID
        );
    }
}
