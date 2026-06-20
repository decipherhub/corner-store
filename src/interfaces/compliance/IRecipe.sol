// SPDX-License-Identifier: GPL-3.0
pragma solidity 0.8.17;

interface IRecipe {
    function recipeId() external view returns (uint16);

    function version() external view returns (uint16);

    function isApplicable(bytes calldata context) external view returns (bool);

    function requiredElements() external view returns (bytes32[] memory);
}
