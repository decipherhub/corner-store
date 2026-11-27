// SPDX-License-Identifier: GPL-3.0
pragma solidity 0.8.17;

import {BaseElement} from "../../compliance/elements/BaseElement.sol";
import {
    ElementMetadata,
    ElementCategory,
    TemporalNature,
    Decidability,
    ObligationTiming,
    Statefulness,
    EvidenceType,
    EnforcementAction,
    ComplianceContext
} from "../../types/ComplianceTypes.sol";
import {ReasonCodes} from "../../libraries/ReasonCodes.sol";

/// @title PairedAssetRestriction (TSV-PAIR-v1, demo)
/// @notice Illustrative gate requiring the other trade leg to match the
///         Manifest-owned paired-asset declaration.
/// @dev Demo/illustrative only. The paired asset and its operator-determined
///      category are immutable for one Manifest version and therefore included
///      in the compiled plan and policy identity. Changing either value uses the
///      normal Manifest update/timelock path. The category is an operator input,
///      not an on-chain legal classification or exemption determination.
///
///      Parameters: abi.encode(address pairedAsset, uint8 category)
///        category 1  NON_SECURITY_CRYPTO_ASSET
///        category 2  TOKENIZED_MONEY_MARKET_FUND
///        category 3  TOKENIZED_LISTED_STOCK
///
///      reasonCode table (n in ReasonCodes.encode(0, ELEMENT_ID, n)):
///        1  PAIRED_ASSET_NOT_PERMITTED
///        2  ASSET_NOT_IN_TRADE
///        3  CONTEXT_MALFORMED
contract PairedAssetRestriction is BaseElement {
    bytes32 public constant ELEMENT_ID = "TSV-PAIR-v1";
    bytes32 public constant PARAMETER_SCHEMA_ID = keccak256("corner-store.demo.tsv-style.paired-asset.v1");

    /// @dev abi.encode(ComplianceContext) is 11 static words.
    uint256 internal constant CONTEXT_BYTES = 11 * 32;

    enum PairedAssetCategory {
        NONE,
        NON_SECURITY_CRYPTO_ASSET,
        TOKENIZED_MONEY_MARKET_FUND,
        TOKENIZED_LISTED_STOCK
    }

    constructor()
        BaseElement(ElementMetadata({
                elementId: ELEMENT_ID,
                category: ElementCategory.RESALE_TRANSACTION,
                version: "TSV-PAIR-v1",
                temporal: TemporalNature.REALTIME,
                decidability: Decidability.ATTESTATION_BASED,
                timing: ObligationTiming.AT_TRADE_GATE,
                statefulness: Statefulness.STATELESS,
                evidenceType: EvidenceType.COMPOSITE,
                defaultEnforcement: EnforcementAction.BLOCK,
                parameterSchemaId: PARAMETER_SCHEMA_ID,
                parameterSchemaVersion: 1,
                maxParameterBytes: 64,
                parametersRequired: true
            }))
    {}

    function _check(address, address, address asset, uint256, bytes calldata context, bytes calldata parameters)
        internal
        pure
        override
        returns (bool passed, bytes32 reasonCode)
    {
        (bool valid, address permittedPair) = _decodeParameters(parameters);
        if (!valid) return (false, ReasonCodes.invalidElementParameters(ELEMENT_ID));
        if (context.length != CONTEXT_BYTES) return (false, ReasonCodes.encode(0, ELEMENT_ID, 3));
        ComplianceContext memory ctx = abi.decode(context, (ComplianceContext));

        address paired;
        if (asset == ctx.tokenOut) paired = ctx.tokenIn;
        else if (asset == ctx.tokenIn) paired = ctx.tokenOut;
        else return (false, ReasonCodes.encode(0, ELEMENT_ID, 2));

        passed = paired == permittedPair;
        reasonCode = passed ? bytes32(0) : ReasonCodes.encode(0, ELEMENT_ID, 1);
    }

    function _decodeParameters(bytes calldata parameters) private pure returns (bool valid, address pairedAsset) {
        if (parameters.length != 64) return (false, address(0));
        uint256 assetWord;
        uint256 categoryWord;
        assembly {
            assetWord := calldataload(parameters.offset)
            categoryWord := calldataload(add(parameters.offset, 32))
        }
        if (
            assetWord == 0 || assetWord > type(uint160).max || categoryWord == 0
                || categoryWord > uint256(PairedAssetCategory.TOKENIZED_LISTED_STOCK)
        ) return (false, address(0));
        return (true, address(uint160(assetWord)));
    }
}
