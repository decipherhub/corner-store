// SPDX-License-Identifier: GPL-3.0
pragma solidity 0.8.17;

import {Test} from "forge-std/Test.sol";
import {MinimumTradeAmountRecipe} from "../../../src/compliance/recipes/MinimumTradeAmountRecipe.sol";
import {MinimumTradeAmount} from "../../../src/compliance/elements/MinimumTradeAmount.sol";
import {ComplianceContext, VenueType, FlowType} from "../../../src/types/ComplianceTypes.sol";

contract MinimumTradeAmountRecipeTest is Test {
    MinimumTradeAmountRecipe internal recipe;
    MinimumTradeAmount internal minimum;

    function setUp() public {
        recipe = new MinimumTradeAmountRecipe();
        minimum = new MinimumTradeAmount();
    }

    function _ctx() internal pure returns (ComplianceContext memory c) {
        c.initiator = address(1);
        c.buyer = address(2);
        c.seller = address(3);
        c.tokenIn = address(4);
        c.tokenOut = address(5);
        c.amountIn = 10;
        c.amountOut = 20;
        c.venueType = VenueType.AMM;
        c.venue = address(6);
        c.flowType = FlowType.SECONDARY_TRADE;
    }

    function test_recipe_is_standalone_and_generic() public view {
        assertEq(recipe.recipeId(), uint16(3));
        assertEq(recipe.version(), uint16(2));
        bytes32[] memory e = recipe.requiredElements();
        assertEq(e.length, 1);
        assertEq(e[0], bytes32("MIN-TRADE-v1"));
        assertTrue(recipe.isApplicable(""));
    }

    function test_minimumTradeAmount_uses_injected_inclusive_boundary() public view {
        ComplianceContext memory c = _ctx();
        uint256 configured = 250_000 ether;
        bytes memory context = abi.encode(c, abi.encode(configured));

        (bool below,) = minimum.check(address(1), address(2), address(3), configured - 1, context);
        assertFalse(below);

        (bool exact,) = minimum.check(address(1), address(2), address(3), configured, context);
        assertTrue(exact);

        (bool above,) = minimum.check(address(1), address(2), address(3), configured + 1, context);
        assertTrue(above);
    }

    function test_minimumTradeAmount_failsClosed_without_valid_parameter() public view {
        ComplianceContext memory c = _ctx();
        (bool missing,) = minimum.check(address(1), address(2), address(3), type(uint256).max, abi.encode(c));
        assertFalse(missing);

        (bool malformed,) = minimum.check(address(1), address(2), address(3), type(uint256).max, abi.encode(c, hex"01"));
        assertFalse(malformed);

        (bool zero,) =
            minimum.check(address(1), address(2), address(3), type(uint256).max, abi.encode(c, abi.encode(0)));
        assertFalse(zero);
    }
}
