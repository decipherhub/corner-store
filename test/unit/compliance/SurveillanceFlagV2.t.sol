// SPDX-License-Identifier: GPL-3.0
pragma solidity 0.8.17;

import {Test} from "forge-std/Test.sol";
import {SurveillanceFlagV2} from "../../../src/compliance/elements/SurveillanceFlagV2.sol";
import {Errors} from "../../../src/libraries/Errors.sol";

contract SurveillanceFlagV2Test is Test {
    SurveillanceFlagV2 internal surveillance;
    address internal operator = address(0x0B);
    address internal stranger = address(0xBAD);

    function setUp() public {
        surveillance = new SurveillanceFlagV2();
    }

    function test_owner_can_set_threshold() public {
        surveillance.setThreshold(7);
        assertEq(surveillance.threshold(), 7);
    }

    function test_operator_can_set_threshold() public {
        surveillance.setOperator(operator, true);
        vm.prank(operator);
        surveillance.setThreshold(7);
        assertEq(surveillance.threshold(), 7);
    }

    function test_unauthorized_account_cannot_set_threshold() public {
        vm.prank(stranger);
        vm.expectRevert(Errors.NotAuthorized.selector);
        surveillance.setThreshold(type(uint256).max);
    }

    function test_only_owner_can_manage_operators() public {
        vm.prank(stranger);
        vm.expectRevert(Errors.NotAuthorized.selector);
        surveillance.setOperator(stranger, true);
    }
}
