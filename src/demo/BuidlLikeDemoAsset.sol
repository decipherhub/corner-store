// SPDX-License-Identifier: GPL-3.0
pragma solidity 0.8.17;

import {
    ElementParameter,
    ManifestCore,
    PolicyStatus,
    RecipeBinding,
    RecipeBindingMode
} from "../types/ComplianceTypes.sol";

/// @title BuidlLikeDemoAsset
/// @notice Giwa MVP demo profile for a local BUIDL-like ERC-3643 asset.
///
/// This intentionally does NOT subclass or fork the ERC-3643 token. The token
/// remains the standard T-REX Token; this profile packages the asset-specific
/// metadata and Manifest binding that make the demo asset BUIDL-like.
///
/// Keep compliance rules in Manifest/Recipe/Element, not in a one-off token
/// override. That is the product point: asset onboarding is configuration plus
/// policy binding, not bespoke transfer logic per asset.
library BuidlLikeDemoAsset {
    string internal constant TOKEN_NAME = "BUIDL-like ERC-3643 Demo Asset";
    string internal constant TOKEN_SYMBOL = "bBUIDL";

    uint16 internal constant ISSUANCE_RECIPE_ID = 1; // Reg D 506(c)
    uint16 internal constant ISSUANCE_RECIPE_VERSION = 2;
    uint16 internal constant FUND_RECIPE_ID = 2; // generic ICA 3(c)(7)
    uint16 internal constant FUND_RECIPE_VERSION = 1;
    uint16 internal constant MINIMUM_TRADE_RECIPE_ID = 3; // generic threshold predicate
    uint16 internal constant MINIMUM_TRADE_RECIPE_VERSION = 2;

    bytes32 internal constant PROFILE_KEY = keccak256("CORNER_STORE.PROFILE.BUIDL_LIKE_DEMO_V1");
    bytes32 internal constant SECURITIZE_DS_ADAPTER_SEAM = keccak256("CORNER_STORE.ADAPTER.SECURITIZE_DS_PROTOCOL");
    uint256 internal constant CLAIM_TOPIC_ACCREDITED_INVESTOR = 1001;
    uint256 internal constant CLAIM_TOPIC_QUALIFIED_PURCHASER = 1002;
    uint256 internal constant MINIMUM_TRADE_AMOUNT = 5_000_000 ether;
    // Source-compatibility alias for existing demo callers. The enforced rule is
    // explicitly a per-trade amount, not a claim about subscription semantics.
    uint256 internal constant MINIMUM_INVESTMENT_AMOUNT = MINIMUM_TRADE_AMOUNT;

    // Current skeleton convention: factsPacked bit0 means the fund recipe is applicable.
    uint256 internal constant FACT_FUND_APPLICABLE = 1;

    function manifest(uint8 supportedEngines) internal pure returns (ManifestCore memory m) {
        m.status = PolicyStatus.ACTIVE;
        m.supportedEngines = supportedEngines;
        m.factsPacked = FACT_FUND_APPLICABLE;
        m.fullManifestHash = keccak256(
            abi.encode(
                PROFILE_KEY,
                SECURITIZE_DS_ADAPTER_SEAM,
                CLAIM_TOPIC_ACCREDITED_INVESTOR,
                CLAIM_TOPIC_QUALIFIED_PURCHASER,
                MINIMUM_TRADE_AMOUNT
            )
        );
    }

    function recipeBindings() internal pure returns (RecipeBinding[] memory bindings) {
        bindings = new RecipeBinding[](3);
        bindings[0] =
            RecipeBinding(ISSUANCE_RECIPE_ID, ISSUANCE_RECIPE_VERSION, RecipeBindingMode.REQUIRED_BLOCKING, 0, 100);
        bindings[1] = RecipeBinding(FUND_RECIPE_ID, FUND_RECIPE_VERSION, RecipeBindingMode.REQUIRED_BLOCKING, 0, 90);
        bindings[2] = RecipeBinding(
            MINIMUM_TRADE_RECIPE_ID, MINIMUM_TRADE_RECIPE_VERSION, RecipeBindingMode.REQUIRED_BLOCKING, 0, 80
        );
    }

    function elementParameters() internal pure returns (ElementParameter[] memory parameters) {
        parameters = new ElementParameter[](1);
        parameters[0] = ElementParameter(bytes32("MIN-TRADE-v1"), abi.encode(MINIMUM_TRADE_AMOUNT));
    }
}
