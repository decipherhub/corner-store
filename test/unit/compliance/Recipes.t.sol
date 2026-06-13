// SPDX-License-Identifier: GPL-3.0
pragma solidity 0.8.17;

import {Test} from "forge-std/Test.sol";
import {RegD506cRecipe} from "../../../src/compliance/recipes/RegD506cRecipe.sol";
import {Fund3c7Recipe} from "../../../src/compliance/recipes/Fund3c7Recipe.sol";
import {ComplianceContext, VenueType, FlowType} from "../../../src/types/ComplianceTypes.sol";

contract RecipesTest is Test {
    RegD506cRecipe internal regd;
    Fund3c7Recipe internal fund;

    function setUp() public {
        regd = new RegD506cRecipe();
        fund = new Fund3c7Recipe();
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
        c.sellerIsAffiliate = false;
    }

    function test_regd_ids_and_elements() public {
        assertEq(regd.recipeId(), uint16(1));
        assertEq(regd.version(), uint16(1));
        bytes32[] memory e = regd.requiredElements();
        assertEq(e.length, 2);
        assertEq(e[0], bytes32("A-01-v1"));
        assertEq(e[1], bytes32("A-03-v1"));
        assertTrue(regd.isApplicable(""));
    }

    function test_fund_ids_and_elements() public {
        assertEq(fund.recipeId(), uint16(2));
        assertEq(fund.version(), uint16(1));
        bytes32[] memory e = fund.requiredElements();
        assertEq(e.length, 1);
        assertEq(e[0], bytes32("A-13-v1"));
    }

    function test_fund_isApplicable_gated_on_bit0() public {
        // Engine encodes abi.encode(factsPacked, ctx) — replicate exactly.
        ComplianceContext memory c = _ctx();

        bytes memory notFund = abi.encode(uint256(0), c);
        assertFalse(fund.isApplicable(notFund));

        bytes memory isFund = abi.encode(uint256(1), c);
        assertTrue(fund.isApplicable(isFund));

        // bit 0 set among other bits.
        bytes memory mixed = abi.encode(uint256(0xFF), c);
        assertTrue(fund.isApplicable(mixed));

        // bit 0 clear but other bits set.
        bytes memory otherBits = abi.encode(uint256(2), c);
        assertFalse(fund.isApplicable(otherBits));
    }
}
