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

    function test_unsuspend() public {
        vm.startPrank(operator);
        reg.setVenueSuspended(venue, true, bytes32("HALT"));
        reg.setVenueSuspended(venue, false, bytes32(0));
        vm.stopPrank();
        assertFalse(reg.isVenueSuspended(venue));
    }

    function test_setVenueSuspended_reverts_for_non_operator() public {
        vm.prank(stranger);
        vm.expectRevert(Errors.NotAuthorized.selector);
        reg.setVenueSuspended(venue, true, bytes32("HALT"));
    }
}
