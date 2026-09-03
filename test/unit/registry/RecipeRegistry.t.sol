// SPDX-License-Identifier: GPL-3.0
pragma solidity 0.8.17;

import {Test} from "forge-std/Test.sol";
import {RecipeRegistry} from "../../../src/registry/RecipeRegistry.sol";
import {Events} from "../../../src/libraries/Events.sol";
import {Errors} from "../../../src/libraries/Errors.sol";
import {IRecipe} from "../../../src/interfaces/compliance/IRecipe.sol";

contract RecipeRegistryRecipeMock is IRecipe {
    uint16 internal immutable _id;
    uint16 internal immutable _version;

    constructor(uint16 id_, uint16 version_) {
        _id = id_;
        _version = version_;
    }

    function recipeId() external view returns (uint16) {
        return _id;
    }

    function version() external view returns (uint16) {
        return _version;
    }

    function isApplicable(bytes calldata) external pure returns (bool) {
        return true;
    }

    function requiredElements() external pure returns (bytes32[] memory elements) {
        elements = new bytes32[](1);
        elements[0] = bytes32("E-v1");
    }
}

contract RecipeRegistryTest is Test {
    RecipeRegistry internal reg;

    address internal recipe;
    address internal stranger = address(0xDEAD);

    function setUp() public {
        reg = new RecipeRegistry();
        recipe = address(new RecipeRegistryRecipeMock(7, 1));
    }

    function test_register_and_read() public {
        vm.expectEmit(true, false, false, true);
        emit Events.RecipeRegistered(7, 1, recipe);
        reg.registerRecipe(7, 1, recipe);
        assertEq(reg.recipeOf(7), recipe);
        assertEq(reg.recipeOf(7, 1), recipe);
        assertTrue(reg.recipeKeyOf(7) != bytes32(0));
    }

    function test_canonical_alias_registration_and_collision_guards() public {
        bytes32 aliasHash = keccak256("reg-d-506c");
        bytes32 key = reg.deriveRecipeKey(aliasHash);
        reg.registerRecipe(aliasHash, key, 7, 1, recipe);
        assertEq(reg.recipeKeyOfAlias(aliasHash), key);
        assertEq(reg.aliasHashOf(key), aliasHash);

        vm.expectRevert(abi.encodeWithSelector(Errors.RecipeAlreadyRegistered.selector, key, uint16(1)));
        reg.registerRecipe(aliasHash, key, 7, 1, recipe);

        address v2 = address(new RecipeRegistryRecipeMock(7, 2));
        bytes32 otherAlias = keccak256("other");
        vm.expectRevert(abi.encodeWithSelector(Errors.InvalidRecipeAlias.selector, otherAlias, key));
        reg.registerRecipe(otherAlias, key, 7, 2, v2);
    }

    function test_legacy_id_alias_is_first_write_immutable_across_versions() public {
        reg.registerRecipe(7, 1, recipe);
        bytes32 key = reg.recipeKeyOf(7);
        address v2 = address(new RecipeRegistryRecipeMock(7, 2));
        reg.registerRecipe(7, 2, v2);
        assertEq(reg.recipeKeyOf(7), key);
        assertEq(reg.recipeOf(7, 1), recipe);
        assertEq(reg.recipeOf(7, 2), v2);
        assertEq(reg.recipeOf(7), v2, "legacy latest mirror updates only for tooling");
    }

    function test_same_alias_key_cannot_be_registered_under_different_recipeId() public {
        bytes32 aliasHash = keccak256("reg-d-506c");
        bytes32 key = reg.deriveRecipeKey(aliasHash);
        reg.registerRecipe(aliasHash, key, 7, 1, recipe);

        address recipe8v2 = address(new RecipeRegistryRecipeMock(8, 2));
        vm.expectRevert(abi.encodeWithSelector(Errors.RecipeKeyIdCollision.selector, key, uint16(7), uint16(8)));
        reg.registerRecipe(aliasHash, key, 8, 2, recipe8v2);
    }

    function test_legacy_latest_recipeOf_does_not_regress_when_older_version_registered_later() public {
        address v2 = address(new RecipeRegistryRecipeMock(7, 2));
        reg.registerRecipe(7, 2, v2);
        reg.registerRecipe(7, 1, recipe);
        assertEq(reg.recipeOf(7), v2, "latest mirror remains monotonic by version");
        assertEq(reg.recipeOf(7, 1), recipe);
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
