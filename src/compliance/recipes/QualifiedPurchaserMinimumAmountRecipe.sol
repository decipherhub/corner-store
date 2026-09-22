// SPDX-License-Identifier: GPL-3.0
pragma solidity 0.8.17;

import {BaseRecipe} from "./BaseRecipe.sol";

/// @notice Asset-independent qualified-purchaser plus minimum-trade recipe.
/// @dev Version 2 of recipe family 3 preserves the prior QP+minimum semantics
///      while replacing the BUIDL-specific hard-coded Element with the generic,
///      Manifest-parameterized MIN-AMOUNT-v1 Element.
contract QualifiedPurchaserMinimumAmountRecipe is BaseRecipe {
    constructor() BaseRecipe(3, 2, _requiredElements()) {}

    function _requiredElements() private pure returns (bytes32[] memory elements) {
        elements = new bytes32[](2);
        elements[0] = "A-13-v1";
        elements[1] = "MIN-AMOUNT-v1";
    }

    function isApplicable(bytes calldata context) external pure override returns (bool) {
        uint256 factsPacked = abi.decode(context, (uint256));
        return (factsPacked & 1) == 1;
    }
}
