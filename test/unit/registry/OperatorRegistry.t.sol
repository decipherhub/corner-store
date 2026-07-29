// SPDX-License-Identifier: GPL-3.0
pragma solidity 0.8.17;

import {Test} from "forge-std/Test.sol";
import {OperatorRegistry} from "../../../src/registry/OperatorRegistry.sol";
import {Errors} from "../../../src/libraries/Errors.sol";
import {Events} from "../../../src/libraries/Events.sol";

contract OperatorRegistryTest is Test {
    OperatorRegistry internal reg;

    address internal operator = address(0xBEEF);
    address internal stranger = address(0xDEAD);
    address internal venue = address(0x7000);

    function setUp() public {
        reg = new OperatorRegistry();
        reg.setOperator(operator, true);
    }

    function test_unregistered_not_suspended() public {
        assertFalse(reg.isVenueSuspended(venue));
    }

    function test_suspend_and_read() public {
        bytes32 reason = bytes32("HALT");
        vm.expectEmit(true, false, false, true);
        emit Events.VenueSuspended(venue, reason);
        vm.prank(operator);
        reg.setVenueSuspended(venue, true, reason);
        assertTrue(reg.isVenueSuspended(venue));
    }

    function test_unsuspend_requiresOwnerScheduleAndDelay() public {
        vm.prank(operator);
        reg.setVenueSuspended(venue, true, bytes32("HALT"));
        reg.scheduleVenueUnpause(venue, bytes32("RECOVERED"));
        vm.expectPartialRevert(Errors.TimelockNotReady.selector);
        reg.executeVenueUnpause(venue);
        vm.warp(block.timestamp + reg.MIN_UNPAUSE_DELAY());
        reg.executeVenueUnpause(venue);
        assertFalse(reg.isVenueSuspended(venue));
    }

    function test_globalUnpause_requiresOwnerScheduleAndDelay() public {
        vm.prank(operator);
        reg.setGlobalPaused(true, bytes32("HALT"));
        reg.scheduleGlobalUnpause(bytes32("RECOVERED"));
        vm.expectPartialRevert(Errors.TimelockNotReady.selector);
        reg.executeGlobalUnpause();
        vm.warp(block.timestamp + reg.MIN_UNPAUSE_DELAY());
        reg.executeGlobalUnpause();
        assertFalse(reg.isGlobalPaused());
    }

    function test_assetUnpause_requiresOwnerScheduleAndDelay() public {
        address asset = address(0xA55E7);
        vm.prank(operator);
        reg.setAssetSuspended(asset, true, bytes32("HALT"));
        reg.scheduleAssetUnpause(asset, bytes32("RECOVERED"));
        vm.expectPartialRevert(Errors.TimelockNotReady.selector);
        reg.executeAssetUnpause(asset);
        vm.warp(block.timestamp + reg.MIN_UNPAUSE_DELAY());
        reg.executeAssetUnpause(asset);
        assertFalse(reg.isAssetSuspended(asset));
    }

    function test_unpauseSchedule_revertsForNonOwner() public {
        vm.prank(operator);
        reg.setGlobalPaused(true, bytes32("HALT"));
        vm.prank(operator);
        vm.expectRevert("Ownable: caller is not the owner");
        reg.scheduleGlobalUnpause(bytes32("RECOVERED"));
    }

    function test_operatorCannotBypassVenueUnpauseTimelock() public {
        vm.startPrank(operator);
        reg.setVenueSuspended(venue, true, bytes32("HALT"));
        vm.expectRevert(Errors.NotAuthorized.selector);
        reg.setVenueSuspended(venue, false, bytes32("RECOVERED"));
        vm.stopPrank();
        assertTrue(reg.isVenueSuspended(venue));
    }

    function test_globalAndAssetPauseReadbacks() public {
        vm.startPrank(operator);
        reg.setGlobalPaused(true, bytes32("GLOBAL"));
        reg.setAssetSuspended(address(0xA55E7), true, bytes32("ASSET"));
        vm.stopPrank();
        assertTrue(reg.isGlobalPaused());
        assertTrue(reg.isAssetSuspended(address(0xA55E7)));
        assertNotEq(reg.pauseHistoryHash(), bytes32(0));
    }

    function test_repauseCancelsPendingUnpause() public {
        vm.prank(operator);
        reg.setVenueSuspended(venue, true, bytes32("HALT"));
        reg.scheduleVenueUnpause(venue, bytes32("RECOVERED"));
        vm.prank(operator);
        reg.setVenueSuspended(venue, true, bytes32("NEW_INCIDENT"));
        vm.warp(block.timestamp + reg.MIN_UNPAUSE_DELAY());
        vm.expectRevert(Errors.PendingActionNotFound.selector);
        reg.executeVenueUnpause(venue);
    }

    function test_globalRePauseCancelsPendingUnpause() public {
        vm.prank(operator);
        reg.setGlobalPaused(true, bytes32("HALT"));
        reg.scheduleGlobalUnpause(bytes32("RECOVERED"));
        vm.prank(operator);
        reg.setGlobalPaused(true, bytes32("NEW_INCIDENT"));
        vm.warp(block.timestamp + reg.MIN_UNPAUSE_DELAY());
        vm.expectRevert(Errors.PendingActionNotFound.selector);
        reg.executeGlobalUnpause();
    }

    function test_assetRePauseCancelsPendingUnpause() public {
        address asset = address(0xA55E7);
        vm.prank(operator);
        reg.setAssetSuspended(asset, true, bytes32("HALT"));
        reg.scheduleAssetUnpause(asset, bytes32("RECOVERED"));
        vm.prank(operator);
        reg.setAssetSuspended(asset, true, bytes32("NEW_INCIDENT"));
        vm.warp(block.timestamp + reg.MIN_UNPAUSE_DELAY());
        vm.expectRevert(Errors.PendingActionNotFound.selector);
        reg.executeAssetUnpause(asset);
    }

    function test_setVenueSuspended_reverts_for_non_operator() public {
        vm.prank(stranger);
        vm.expectRevert(Errors.NotAuthorized.selector);
        reg.setVenueSuspended(venue, true, bytes32("HALT"));
    }
}
