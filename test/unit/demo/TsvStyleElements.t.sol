// SPDX-License-Identifier: GPL-3.0
pragma solidity 0.8.17;

import {Test} from "forge-std/Test.sol";
import {BaseRecipe} from "../../../src/compliance/recipes/BaseRecipe.sol";
import {PairedAssetRestriction} from "../../../src/demo/tsv/PairedAssetRestriction.sol";
import {VenueVolumeLimit} from "../../../src/demo/tsv/VenueVolumeLimit.sol";
import {TsvStyleReferenceRecipe} from "../../../src/demo/tsv/TsvStyleReferenceRecipe.sol";
import {RecipeRegistry} from "../../../src/registry/RecipeRegistry.sol";
import {ComplianceContext, Statefulness} from "../../../src/types/ComplianceTypes.sol";
import {ReasonCodes} from "../../../src/libraries/ReasonCodes.sol";
import {Errors} from "../../../src/libraries/Errors.sol";

contract ConflictingTsvDemoRecipe is BaseRecipe {
    constructor() BaseRecipe(41, 1, _ids()) {}

    function _ids() private pure returns (bytes32[] memory ids) {
        ids = new bytes32[](1);
        ids[0] = "A-01-v1";
    }
}

contract TsvStyleElementsTest is Test {
    PairedAssetRestriction internal pairRule;
    VenueVolumeLimit internal volumeLimit;

    address internal constant STOCK = address(0x5700C);
    address internal constant STABLE = address(0x57AB1E);
    address internal constant OTHER = address(0x07E12);
    address internal constant ENGINE = address(0xE2612E);

    function setUp() public {
        pairRule = new PairedAssetRestriction();
        volumeLimit = new VenueVolumeLimit();
        volumeLimit.setEngine(ENGINE);
    }

    function _ctx(address tokenIn, address tokenOut) internal pure returns (bytes memory) {
        ComplianceContext memory ctx;
        ctx.tokenIn = tokenIn;
        ctx.tokenOut = tokenOut;
        return abi.encode(ctx);
    }

    function _pair(address asset, PairedAssetRestriction.PairedAssetCategory category)
        internal
        pure
        returns (bytes memory)
    {
        return abi.encode(asset, uint8(category));
    }

    // --- recipe -----------------------------------------------------------

    function test_recipe_metadata() public {
        TsvStyleReferenceRecipe recipe = new TsvStyleReferenceRecipe();
        assertEq(recipe.recipeId(), 40);
        assertEq(recipe.version(), 1);
        assertEq(recipe.ALIAS_HASH(), keccak256("demo:tsv-style-amm"));
        bytes32[] memory e = recipe.requiredElements();
        assertEq(e.length, 5);
        assertEq(e[0], bytes32("A-01-v1"));
        assertEq(e[1], bytes32("A-04-v2"));
        assertEq(e[2], bytes32("B-02-v2"));
        assertEq(e[3], bytes32("TSV-PAIR-v1"));
        assertEq(e[4], bytes32("TSV-VOL-v1"));
    }

    function test_recipe_canonicalAliasRejectsIdCollision() public {
        RecipeRegistry registry = new RecipeRegistry();
        TsvStyleReferenceRecipe recipe = new TsvStyleReferenceRecipe();
        bytes32 aliasHash = recipe.ALIAS_HASH();
        bytes32 recipeKey = registry.deriveRecipeKey(aliasHash);
        registry.registerRecipe(aliasHash, recipeKey, recipe.RECIPE_ID(), recipe.RECIPE_VERSION(), address(recipe));
        assertEq(registry.recipeKeyOf(recipe.RECIPE_ID()), recipeKey);
        assertEq(registry.recipeKeyOfAlias(aliasHash), recipeKey);
        assertEq(registry.aliasHashOf(recipeKey), aliasHash);

        ConflictingTsvDemoRecipe conflicting = new ConflictingTsvDemoRecipe();
        vm.expectRevert(abi.encodeWithSelector(Errors.RecipeKeyIdCollision.selector, recipeKey, uint16(40), uint16(41)));
        registry.registerRecipe(aliasHash, recipeKey, 41, 1, address(conflicting));
    }

    // --- paired asset -----------------------------------------------------

    function test_pair_metadataIsManifestParameterized() public view {
        assertEq(pairRule.elementMetadata().parameterSchemaId, pairRule.PARAMETER_SCHEMA_ID());
        assertEq(pairRule.elementMetadata().parameterSchemaVersion, 1);
        assertEq(pairRule.elementMetadata().maxParameterBytes, 64);
        assertTrue(pairRule.elementMetadata().parametersRequired);
    }

    function test_pair_permittedCategory_passes_bothDirections() public view {
        bytes memory parameters = _pair(STABLE, PairedAssetRestriction.PairedAssetCategory.NON_SECURITY_CRYPTO_ASSET);
        (bool buy,) = pairRule.check(address(0), address(0), STOCK, 1, _ctx(STABLE, STOCK), parameters);
        (bool sell,) = pairRule.check(address(0), address(0), STOCK, 1, _ctx(STOCK, STABLE), parameters);
        assertTrue(buy);
        assertTrue(sell);
    }

    function test_pair_otherAsset_fails_code1() public view {
        (bool passed, bytes32 reason) = pairRule.check(
            address(0),
            address(0),
            STOCK,
            1,
            _ctx(OTHER, STOCK),
            _pair(STABLE, PairedAssetRestriction.PairedAssetCategory.NON_SECURITY_CRYPTO_ASSET)
        );
        assertFalse(passed);
        assertEq(reason, ReasonCodes.encode(0, bytes32("TSV-PAIR-v1"), 1));
    }

    function test_pair_assetNotInTrade_fails_code2() public view {
        (bool passed, bytes32 reason) = pairRule.check(
            address(0),
            address(0),
            STOCK,
            1,
            _ctx(STABLE, OTHER),
            _pair(STABLE, PairedAssetRestriction.PairedAssetCategory.NON_SECURITY_CRYPTO_ASSET)
        );
        assertFalse(passed);
        assertEq(reason, ReasonCodes.encode(0, bytes32("TSV-PAIR-v1"), 2));
    }

    function test_pair_malformedContext_fails_code3() public view {
        (bool passed, bytes32 reason) = pairRule.check(
            address(0),
            address(0),
            STOCK,
            1,
            hex"1234",
            _pair(STABLE, PairedAssetRestriction.PairedAssetCategory.NON_SECURITY_CRYPTO_ASSET)
        );
        assertFalse(passed);
        assertEq(reason, ReasonCodes.encode(0, bytes32("TSV-PAIR-v1"), 3));
    }

    function test_pair_invalidParameters_failClosed() public view {
        bytes[] memory invalid = new bytes[](6);
        invalid[0] = bytes("");
        invalid[1] = abi.encode(address(0), uint8(1));
        invalid[2] = abi.encode(STABLE, uint8(0));
        invalid[3] = abi.encode(STABLE, uint8(4));
        invalid[4] = abi.encode(uint256(type(uint160).max) + 1, uint256(1));
        invalid[5] = abi.encode(STABLE);
        for (uint256 i; i < invalid.length; ++i) {
            (bool passed, bytes32 reason) =
                pairRule.check(address(0), address(0), STOCK, 1, _ctx(STABLE, STOCK), invalid[i]);
            assertFalse(passed);
            assertEq(reason, ReasonCodes.invalidElementParameters(bytes32("TSV-PAIR-v1")));
        }
    }

    // --- volume limit -----------------------------------------------------

    function test_volume_metadataIsStatefulAndParameterized() public view {
        assertEq(uint8(volumeLimit.elementMetadata().statefulness), uint8(Statefulness.STATEFUL));
        assertEq(volumeLimit.elementMetadata().parameterSchemaId, volumeLimit.PARAMETER_SCHEMA_ID());
    }

    function test_volume_boundary_exactLimitPasses_overFails() public {
        bytes memory limit = abi.encode(uint256(100));
        vm.prank(ENGINE);
        volumeLimit.onTransfer(address(1), address(2), 60);

        (bool exact,) = volumeLimit.check(address(0), address(0), STOCK, 40, "", limit);
        (bool over, bytes32 reason) = volumeLimit.check(address(0), address(0), STOCK, 41, "", limit);
        assertTrue(exact);
        assertFalse(over);
        assertEq(reason, ReasonCodes.encode(0, bytes32("TSV-VOL-v1"), 1));
    }

    function test_volume_loweredLimitBelowUsed_fails() public {
        vm.prank(ENGINE);
        volumeLimit.onTransfer(address(1), address(2), 60);
        (bool passed,) = volumeLimit.check(address(0), address(0), STOCK, 1, "", abi.encode(uint256(50)));
        assertFalse(passed);
    }

    function test_volume_newPeriodResets() public {
        vm.prank(ENGINE);
        volumeLimit.onTransfer(address(1), address(2), 100);
        assertEq(volumeLimit.currentPeriodVolume(), 100);
        vm.warp(block.timestamp + 1 days);
        assertEq(volumeLimit.currentPeriodVolume(), 0);
        (bool passed,) = volumeLimit.check(address(0), address(0), STOCK, 100, "", abi.encode(uint256(100)));
        assertTrue(passed);
    }

    function test_volume_missingOrZeroLimit_failsClosed() public view {
        (bool missing, bytes32 r1) = volumeLimit.check(address(0), address(0), STOCK, 1, "", "");
        (bool zero, bytes32 r2) = volumeLimit.check(address(0), address(0), STOCK, 1, "", abi.encode(uint256(0)));
        assertFalse(missing);
        assertFalse(zero);
        assertEq(r1, ReasonCodes.invalidElementParameters(bytes32("TSV-VOL-v1")));
        assertEq(r2, ReasonCodes.invalidElementParameters(bytes32("TSV-VOL-v1")));
    }

    function test_volume_hugeAmount_doesNotOverflow() public view {
        (bool passed,) =
            volumeLimit.check(address(0), address(0), STOCK, type(uint256).max, "", abi.encode(uint256(100)));
        assertFalse(passed);
    }

    function test_volume_onlyEngineWrites() public {
        vm.expectRevert(Errors.NotAuthorized.selector);
        volumeLimit.onTransfer(address(1), address(2), 1);
    }
}
