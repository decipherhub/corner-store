// SPDX-License-Identifier: GPL-3.0
pragma solidity 0.8.17;

import {Governed} from "../auth/Governed.sol";
import {IRecipeRegistry} from "../interfaces/compliance/IRecipeRegistry.sol";
import {Events} from "../libraries/Events.sol";

contract RecipeRegistry is IRecipeRegistry, Governed {
    mapping(uint16 => address) internal _recipes;

    function registerRecipe(uint16 recipeId, uint16 version, address recipe) external onlyOwner {
        _recipes[recipeId] = recipe;
        emit Events.RecipeRegistered(recipeId, version, recipe);
    }

    function recipeOf(uint16 recipeId) external view returns (address) {
        return _recipes[recipeId];
    }
}
