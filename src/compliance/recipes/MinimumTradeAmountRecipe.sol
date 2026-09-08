// SPDX-License-Identifier: GPL-3.0
pragma solidity 0.8.17;

import {BaseRecipe} from "./BaseRecipe.sol";

/// @notice Standalone reusable commercial-term recipe. Fund eligibility is
///         composed separately through `Fund3c7Recipe` rather than hidden in an
///         asset-branded recipe.
contract MinimumTradeAmountRecipe is BaseRecipe {
    constructor() BaseRecipe(3, 2, _minimumTradeElements()) {}

    function _minimumTradeElements() private pure returns (bytes32[] memory e) {
        e = new bytes32[](1);
        e[0] = "MIN-TRADE-v1";
    }
}
