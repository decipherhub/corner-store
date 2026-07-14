// SPDX-License-Identifier: GPL-3.0
pragma solidity 0.8.17;

import {ManifestCore, PolicyStatus} from "../types/ComplianceTypes.sol";

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
    uint16 internal constant ISSUANCE_RECIPE_VERSION = 1;
    uint16 internal constant FUND_RECIPE_ID = 2; // ICA 3(c)(7)
    uint16 internal constant FUND_RECIPE_VERSION = 1;

    bytes32 internal constant PROFILE_KEY = keccak256("CORNER_STORE.PROFILE.BUIDL_LIKE_DEMO_V1");
    bytes32 internal constant SECURITIZE_DS_ADAPTER_SEAM = keccak256("CORNER_STORE.ADAPTER.SECURITIZE_DS_PROTOCOL");
    uint256 internal constant CLAIM_TOPIC_ACCREDITED_INVESTOR = 1001;
    uint256 internal constant CLAIM_TOPIC_QUALIFIED_PURCHASER = 1002;

    // Current skeleton convention: factsPacked bit0 means the fund recipe is applicable.
    uint256 internal constant FACT_FUND_APPLICABLE = 1;

    function manifest(uint8 supportedEngines) internal pure returns (ManifestCore memory m) {
        m.status = PolicyStatus.ACTIVE;
        m.issuanceRecipeId = ISSUANCE_RECIPE_ID;
        m.issuanceRecipeVersion = ISSUANCE_RECIPE_VERSION;
        m.fundRecipeId = FUND_RECIPE_ID;
        m.supportedEngines = supportedEngines;
        m.factsPacked = FACT_FUND_APPLICABLE;
        m.fullManifestHash = keccak256(
            abi.encode(
                PROFILE_KEY,
                SECURITIZE_DS_ADAPTER_SEAM,
                CLAIM_TOPIC_ACCREDITED_INVESTOR,
                CLAIM_TOPIC_QUALIFIED_PURCHASER
            )
        );
    }
}
