// SPDX-License-Identifier: GPL-3.0
pragma solidity 0.8.17;

/// @title DemoAmmReferenceRecipe
/// @notice Demo/test-only AMM policy that deliberately excludes C-01.
/// @dev This is not a Reg D recipe. It exists so AMM plumbing can be exercised
///      without weakening the product invariant that every C-01 family recipe
///      is AMM-incompatible.
contract DemoAmmReferenceRecipe {
    function recipeId() external pure returns (uint16) {
        return 8;
    }

    function version() external pure returns (uint16) {
        return 1;
    }

    function isApplicable(bytes calldata) external pure returns (bool) {
        return true;
    }

    function requiredElements() external pure returns (bytes32[] memory ids) {
        ids = new bytes32[](8);
        ids[0] = bytes32("A-01-v1");
        ids[1] = bytes32("A-02-v1");
        ids[2] = bytes32("A-03-v1");
        ids[3] = bytes32("A-04-v1");
        ids[4] = bytes32("A-05-v1");
        ids[5] = bytes32("B-01-v1");
        ids[6] = bytes32("B-02-v2");
        ids[7] = bytes32("E-01-v1");
    }
}
