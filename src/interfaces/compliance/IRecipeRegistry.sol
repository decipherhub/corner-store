// SPDX-License-Identifier: GPL-3.0
pragma solidity 0.8.17;

interface IRecipeRegistry {
    function registerRecipe(uint16 recipeId, uint16 version, address recipe) external;

    function registerRecipe(bytes32 aliasHash, bytes32 recipeKey, uint16 recipeId, uint16 version, address recipe)
        external;

    function recipeOf(uint16 recipeId) external view returns (address);

    function recipeOf(uint16 recipeId, uint16 version) external view returns (address);

    function recipeOf(bytes32 recipeKey, uint16 version) external view returns (address);

    function recipeKeyOf(uint16 recipeId) external view returns (bytes32);

    function recipeKeyOfAlias(bytes32 aliasHash) external view returns (bytes32);

    function aliasHashOf(bytes32 recipeKey) external view returns (bytes32);

    function deriveRecipeKey(bytes32 aliasHash) external pure returns (bytes32);
}
