// SPDX-License-Identifier: GPL-3.0
pragma solidity 0.8.17;

import {Governed} from "../auth/Governed.sol";
import {IRecipeRegistry} from "../interfaces/compliance/IRecipeRegistry.sol";
import {IRecipe} from "../interfaces/compliance/IRecipe.sol";
import {Errors} from "../libraries/Errors.sol";
import {Events} from "../libraries/Events.sol";

contract RecipeRegistry is IRecipeRegistry, Governed {
    bytes32 public constant RECIPE_KEY_DOMAIN = keccak256("corner-store.recipe-key.v1");

    mapping(uint16 => bytes32) internal _legacyKeys;
    mapping(uint16 => address) internal _latestRecipes;
    mapping(uint16 => uint16) internal _latestVersions;
    mapping(bytes32 => mapping(uint16 => address)) internal _recipes;
    mapping(bytes32 => bytes32) internal _aliasToKey;
    mapping(bytes32 => bytes32) internal _keyToAlias;
    mapping(bytes32 => uint16) internal _keyToRecipeId;

    function registerRecipe(uint16 recipeId, uint16 version, address recipe) external onlyOwner {
        bytes32 aliasHash = keccak256(abi.encodePacked("legacy:", recipeId));
        _registerRecipe(aliasHash, deriveRecipeKey(aliasHash), recipeId, version, recipe);
    }

    function registerRecipe(bytes32 aliasHash, bytes32 recipeKey, uint16 recipeId, uint16 version, address recipe)
        external
        onlyOwner
    {
        _registerRecipe(aliasHash, recipeKey, recipeId, version, recipe);
    }

    function _registerRecipe(bytes32 aliasHash, bytes32 recipeKey, uint16 recipeId, uint16 version, address recipe)
        internal
    {
        if (aliasHash == bytes32(0) || recipeKey == bytes32(0) || recipeKey != deriveRecipeKey(aliasHash)) {
            revert Errors.InvalidRecipeAlias(aliasHash, recipeKey);
        }
        if (recipeId == 0 || version == 0 || recipe == address(0) || recipe.code.length == 0) {
            revert Errors.InvalidRecipeBinding();
        }

        IRecipe r = IRecipe(recipe);
        uint16 actualId = r.recipeId();
        uint16 actualVersion = r.version();
        if (actualId != recipeId || actualVersion != version) {
            revert Errors.RecipeVersionMismatch(recipeId, version, actualVersion);
        }
        bytes32[] memory elements = r.requiredElements();
        if (elements.length == 0 || elements.length > 32) {
            revert Errors.TooManyRecipeElements(recipeId, elements.length, 32);
        }

        bytes32 existingKey = _aliasToKey[aliasHash];
        if (existingKey != bytes32(0) && existingKey != recipeKey) {
            revert Errors.RecipeAliasCollision(aliasHash, existingKey);
        }
        bytes32 existingAlias = _keyToAlias[recipeKey];
        if (existingAlias != bytes32(0) && existingAlias != aliasHash) {
            revert Errors.RecipeAliasCollision(aliasHash, recipeKey);
        }
        bytes32 legacyKey = _legacyKeys[recipeId];
        if (legacyKey != bytes32(0) && legacyKey != recipeKey) {
            revert Errors.RecipeAliasCollision(aliasHash, legacyKey);
        }
        uint16 existingRecipeId = _keyToRecipeId[recipeKey];
        if (existingRecipeId != 0 && existingRecipeId != recipeId) {
            revert Errors.RecipeKeyIdCollision(recipeKey, existingRecipeId, recipeId);
        }
        if (_recipes[recipeKey][version] != address(0)) revert Errors.RecipeAlreadyRegistered(recipeKey, version);

        _aliasToKey[aliasHash] = recipeKey;
        _keyToAlias[recipeKey] = aliasHash;
        if (legacyKey == bytes32(0)) _legacyKeys[recipeId] = recipeKey;
        if (existingRecipeId == 0) _keyToRecipeId[recipeKey] = recipeId;
        _recipes[recipeKey][version] = recipe;
        if (version > _latestVersions[recipeId]) {
            _latestVersions[recipeId] = version;
            _latestRecipes[recipeId] = recipe;
        }

        emit Events.RecipeRegistered(recipeId, version, recipe);
        emit Events.RecipeRegisteredV2(recipeKey, aliasHash, recipeId, version, recipe);
    }

    function recipeOf(uint16 recipeId) external view returns (address) {
        return _latestRecipes[recipeId];
    }

    function recipeOf(uint16 recipeId, uint16 version) external view returns (address) {
        return _recipes[_legacyKeys[recipeId]][version];
    }

    function recipeOf(bytes32 recipeKey, uint16 version) external view returns (address) {
        return _recipes[recipeKey][version];
    }

    function recipeKeyOf(uint16 recipeId) external view returns (bytes32) {
        return _legacyKeys[recipeId];
    }

    function recipeKeyOfAlias(bytes32 aliasHash) external view returns (bytes32) {
        return _aliasToKey[aliasHash];
    }

    function aliasHashOf(bytes32 recipeKey) external view returns (bytes32) {
        return _keyToAlias[recipeKey];
    }

    function deriveRecipeKey(bytes32 aliasHash) public pure returns (bytes32) {
        return keccak256(abi.encode(RECIPE_KEY_DOMAIN, aliasHash));
    }
}
