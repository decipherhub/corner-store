// SPDX-License-Identifier: GPL-3.0
pragma solidity 0.8.17;

import {BaseRecipe} from "./BaseRecipe.sol";

/// @dev Opt-in reference Reg D composition using provider-neutral B-02-v3.
///      Legal criteria remain illustrative and require an approved legal package.
contract RegD506cRecipeV6 is BaseRecipe {
    constructor() BaseRecipe(1, 6, _elements506c()) {}

    function _elements506c() private pure returns (bytes32[] memory e) {
        e = new bytes32[](9);
        e[0] = "A-01-v1";
        e[1] = "A-02-v1";
        e[2] = "A-03-v1";
        e[3] = "A-04-v2";
        e[4] = "A-05-v1";
        e[5] = "B-01-v1";
        e[6] = "B-02-v3";
        e[7] = "C-01-v2";
        e[8] = "E-01-v1";
    }
}
