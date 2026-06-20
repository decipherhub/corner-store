// SPDX-License-Identifier: GPL-3.0
pragma solidity 0.8.17;

import {IRecipe} from "../../interfaces/compliance/IRecipe.sol";

/// @dev Stores a recipe id/version and its required element id list. `isApplicable`
///      defaults to true and is virtual so subclasses can gate on context facts.
abstract contract BaseRecipe is IRecipe {
    uint16 internal immutable _recipeId;
    uint16 internal immutable _version;
    bytes32[] internal _elements;

    constructor(uint16 id, uint16 ver, bytes32[] memory elements) {
        _recipeId = id;
        _version = ver;
        _elements = elements;
    }

    function recipeId() external view override returns (uint16) {
        return _recipeId;
    }

    function version() external view override returns (uint16) {
        return _version;
    }

    function requiredElements() external view override returns (bytes32[] memory) {
        return _elements;
    }

    function isApplicable(bytes calldata) external view virtual override returns (bool) {
        return true;
    }
}
