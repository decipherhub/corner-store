// SPDX-License-Identifier: GPL-3.0
pragma solidity 0.8.17;

import {BaseRecipe} from "./BaseRecipe.sol";

/// @dev Legacy immutable recipe retained so historical version-1 bindings remain
///      reproducible. New deployments use QualifiedPurchaserMinimumAmountRecipe
///      version 2 with Manifest-owned parameters; this recipe is not registered
///      by the current BUIDL-like demo profile.
contract BuidlLikeFundRecipe is BaseRecipe {
    constructor() BaseRecipe(3, 1, _elementsBuidlLikeFund()) {}

    function _elementsBuidlLikeFund() private pure returns (bytes32[] memory e) {
        e = new bytes32[](2);
        e[0] = "A-13-v1";
        e[1] = "BUIDL-MIN-v1";
    }

    function isApplicable(bytes calldata context) external pure override returns (bool) {
        uint256 factsPacked = abi.decode(context, (uint256));
        return (factsPacked & 1) == 1;
    }
}
