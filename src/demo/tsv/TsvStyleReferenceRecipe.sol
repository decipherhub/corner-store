// SPDX-License-Identifier: GPL-3.0
pragma solidity 0.8.17;

import {BaseRecipe} from "../../compliance/recipes/BaseRecipe.sol";

/// @title TsvStyleReferenceRecipe (recipe 40 v1, demo)
/// @notice Illustrative rule set for a freely tradable tokenized listed stock traded in a
///         permissioned pool operated by a venue customer.
/// @dev Demo/illustrative only. Not a legal policy and not a statement that any
///      venue qualifies for, is registered under, or is approved under any
///      exemption. It deliberately contains no C-01 family element.
///      Restricted shares of a listed issuer can still carry a holding period
///      and do not belong under this rule set.
///
///      Elements:
///        A-01-v1      sanctions-list screen of both parties
///        A-04-v2      operator-accepted identity evidence, TSV/DIRECT policy
///        B-02-v2      the token's own ERC-3643 transfer rules
///        TSV-PAIR-v1  Manifest-owned permitted paired asset/category
///        TSV-VOL-v1   per-stock period volume limit (Manifest parameter)
///      Public notice, trade publication, halt-data integration, entity
///      requirements and books/records remain venue-operator responsibilities.
contract TsvStyleReferenceRecipe is BaseRecipe {
    uint16 public constant RECIPE_ID = 40;
    uint16 public constant RECIPE_VERSION = 1;
    bytes32 public constant ALIAS_HASH = keccak256("demo:tsv-style-amm");

    constructor() BaseRecipe(RECIPE_ID, RECIPE_VERSION, _elementsTsvStyle()) {}

    function _elementsTsvStyle() private pure returns (bytes32[] memory e) {
        e = new bytes32[](5);
        e[0] = "A-01-v1";
        e[1] = "A-04-v2";
        e[2] = "B-02-v2";
        e[3] = "TSV-PAIR-v1";
        e[4] = "TSV-VOL-v1";
    }
}
