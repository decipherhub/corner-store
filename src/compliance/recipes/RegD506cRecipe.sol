// SPDX-License-Identifier: GPL-3.0
pragma solidity 0.8.17;

import {BaseRecipe} from "./BaseRecipe.sol";

/// @dev Reg D 506(c) issuance recipe (mock): requires sanctions clear + accredited.
///      Always applicable.
contract RegD506cRecipe is BaseRecipe {
    constructor() BaseRecipe(1, 1, _elements506c()) {}

    function _elements506c() private pure returns (bytes32[] memory e) {
        e = new bytes32[](2);
        e[0] = "A-01-v1";
        e[1] = "A-03-v1";
    }
}
