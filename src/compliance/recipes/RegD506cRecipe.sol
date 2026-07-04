// SPDX-License-Identifier: GPL-3.0
pragma solidity 0.8.17;

import {BaseRecipe} from "./BaseRecipe.sol";

/// @dev Reg D 506(c) issuance recipe (illustrative reference wiring, NOT approved
///      production policy). Requires the full 9-element reference set from the
///      strategy report (note-14): sanctions (A-01), jurisdiction (A-02),
///      accredited investor (A-03), identity uniqueness (A-04), US-tax-resident
///      exclusion (A-05), asset classification (B-01), ERC-3643-native asset
///      (B-02), Rule 144 lockup (C-01) and Form D filing (E-01). Version 2 (id 1
///      unchanged). Always applicable. Production legal criteria remain
///      approval-gated per docs/ROADMAP.md Phase 1.
contract RegD506cRecipe is BaseRecipe {
    constructor() BaseRecipe(1, 2, _elements506c()) {}

    function _elements506c() private pure returns (bytes32[] memory e) {
        e = new bytes32[](9);
        e[0] = "A-01-v1";
        e[1] = "A-02-v1";
        e[2] = "A-03-v1";
        e[3] = "A-04-v1";
        e[4] = "A-05-v1";
        e[5] = "B-01-v1";
        e[6] = "B-02-v1";
        e[7] = "C-01-v1";
        e[8] = "E-01-v1";
    }
}
