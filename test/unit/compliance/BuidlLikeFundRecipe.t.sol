// SPDX-License-Identifier: GPL-3.0
pragma solidity 0.8.17;

import {Test} from "forge-std/Test.sol";
import {BuidlLikeFundRecipe} from "../../../src/compliance/recipes/BuidlLikeFundRecipe.sol";
import {BuidlMinimumInvestment} from "../../../src/compliance/elements/BuidlMinimumInvestment.sol";
import {ComplianceContext, VenueType, FlowType} from "../../../src/types/ComplianceTypes.sol";

contract BuidlLikeFundRecipeTest is Test {
    BuidlLikeFundRecipe internal recipe;
    BuidlMinimumInvestment internal minimum;

    function setUp() public {
        recipe = new BuidlLikeFundRecipe();
        minimum = new BuidlMinimumInvestment();
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

    function test_buidlLikeFund_ids_and_elements() public {
        assertEq(recipe.recipeId(), uint16(3));
        assertEq(recipe.version(), uint16(1));
        bytes32[] memory e = recipe.requiredElements();
        assertEq(e.length, 2);
        assertEq(e[0], bytes32("A-13-v1"));
        assertEq(e[1], bytes32("BUIDL-MIN-v1"));
    }

    function test_buidlLikeFund_isApplicable_gated_on_fund_bit() public {
        ComplianceContext memory c = _ctx();
        assertFalse(recipe.isApplicable(abi.encode(uint256(0), c)));
        assertTrue(recipe.isApplicable(abi.encode(uint256(1), c)));
        assertTrue(recipe.isApplicable(abi.encode(uint256(0xFF), c)));
        assertFalse(recipe.isApplicable(abi.encode(uint256(2), c)));
    }

    function test_minimumInvestment_inclusive_boundary() public view {
        (bool below,) = minimum.check(address(1), address(2), address(3), minimum.MINIMUM_AMOUNT() - 1, "");
        assertFalse(below);

        (bool exact,) = minimum.check(address(1), address(2), address(3), minimum.MINIMUM_AMOUNT(), "");
        assertTrue(exact);

        (bool above,) = minimum.check(address(1), address(2), address(3), minimum.MINIMUM_AMOUNT() + 1, "");
        assertTrue(above);
    }
}
