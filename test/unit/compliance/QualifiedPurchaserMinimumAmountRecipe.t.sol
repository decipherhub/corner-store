// SPDX-License-Identifier: GPL-3.0
pragma solidity 0.8.17;

import {Test} from "forge-std/Test.sol";
import {
    QualifiedPurchaserMinimumAmountRecipe
} from "../../../src/compliance/recipes/QualifiedPurchaserMinimumAmountRecipe.sol";
import {MinimumTradeAmount} from "../../../src/compliance/elements/MinimumTradeAmount.sol";

contract QualifiedPurchaserMinimumAmountRecipeTest is Test {
    QualifiedPurchaserMinimumAmountRecipe internal recipe;
    MinimumTradeAmount internal minimumAmount;

    function setUp() public {
        recipe = new QualifiedPurchaserMinimumAmountRecipe();
        minimumAmount = new MinimumTradeAmount();
    }

    function test_metadata_preservesFamilyAndUsesGenericElement() public view {
        assertEq(recipe.recipeId(), 3);
        assertEq(recipe.version(), 2);
        bytes32[] memory elements = recipe.requiredElements();
        assertEq(elements.length, 2);
        assertEq(elements[0], bytes32("A-13-v1"));
        assertEq(elements[1], bytes32("MIN-AMOUNT-v1"));
        assertEq(minimumAmount.elementMetadata().parameterSchemaId, minimumAmount.PARAMETER_SCHEMA_ID());
    }

    function test_applicability_usesFundFact() public view {
        assertTrue(recipe.isApplicable(abi.encode(uint256(1))));
        assertFalse(recipe.isApplicable(abi.encode(uint256(0))));
    }

    function test_minimumAmount_isManifestParameterized() public view {
        uint256 threshold = 5_000_000 ether;
        (bool below,) =
            minimumAmount.check(address(0), address(0), address(0), threshold - 1, "", abi.encode(threshold));
        (bool exact,) = minimumAmount.check(address(0), address(0), address(0), threshold, "", abi.encode(threshold));
        assertFalse(below);
        assertTrue(exact);
    }
}
