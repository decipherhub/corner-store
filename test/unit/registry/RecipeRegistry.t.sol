// SPDX-License-Identifier: GPL-3.0
pragma solidity 0.8.17;

import {Test} from "forge-std/Test.sol";
import {RecipeRegistry} from "../../../src/registry/RecipeRegistry.sol";
import {Events} from "../../../src/libraries/Events.sol";

contract RecipeRegistryTest is Test {
    RecipeRegistry internal reg;

    address internal recipe = address(0xC0FFEE);
    address internal stranger = address(0xDEAD);

    function setUp() public {
        reg = new RecipeRegistry();
    }

    function test_register_and_read() public {
        vm.expectEmit(true, false, false, true);
        emit Events.RecipeRegistered(7, 1, recipe);
        reg.registerRecipe(7, 1, recipe);
        assertEq(reg.recipeOf(7), recipe);
    }

    function test_unregistered_returns_zero() public {
        assertEq(reg.recipeOf(99), address(0));
    }

    function test_registerRecipe_reverts_for_non_owner() public {
        vm.prank(stranger);
        vm.expectRevert();
        reg.registerRecipe(7, 1, recipe);
    }
}
