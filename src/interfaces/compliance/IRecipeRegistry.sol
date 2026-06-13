// SPDX-License-Identifier: GPL-3.0
pragma solidity 0.8.17;

interface IRecipeRegistry {
    function registerRecipe(uint16 recipeId, uint16 version, address recipe) external;

    function recipeOf(uint16 recipeId) external view returns (address);
}
