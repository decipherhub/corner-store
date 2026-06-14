// SPDX-License-Identifier: GPL-3.0
pragma solidity 0.8.17;

import {BaseRecipe} from "./BaseRecipe.sol";

/// @dev 3(c)(7) fund recipe (mock): requires qualified purchaser. Conditionally
///      applicable — only when the manifest's factsPacked bit 0 ("fund") is set.
contract Fund3c7Recipe is BaseRecipe {
    constructor() BaseRecipe(2, 1, _elements3c7()) {}

    function _elements3c7() private pure returns (bytes32[] memory e) {
        e = new bytes32[](1);
        e[0] = "A-13-v1";
    }

    /// @dev The engine passes `abi.encode(factsPacked, ctx)`; we decode only the
    ///      leading word and gate on bit 0. Keep this consistent with the engine.
    function isApplicable(bytes calldata context) external view override returns (bool) {
        uint256 factsPacked = abi.decode(context, (uint256));
        return (factsPacked & 1) == 1;
    }
}
