// SPDX-License-Identifier: GPL-3.0
pragma solidity 0.8.17;

import {BaseRecipe} from "./BaseRecipe.sol";

/// @dev BUIDL-like fund recipe for the local ERC-3643 test issuance profile.
///      Requires QP plus the demo minimum-investment Element. Conditionally
///      applicable when Manifest.factsPacked bit0 marks the asset as a fund.
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
