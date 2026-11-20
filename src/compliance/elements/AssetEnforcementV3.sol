// SPDX-License-Identifier: GPL-3.0
pragma solidity 0.8.17;

import {BaseElement} from "./BaseElement.sol";
import {
    ElementMetadata,
    ElementCategory,
    TemporalNature,
    Decidability,
    ObligationTiming,
    Statefulness,
    EvidenceType,
    EnforcementAction
} from "../../types/ComplianceTypes.sol";
import {ReasonCodes} from "../../libraries/ReasonCodes.sol";
import {AssetFlow} from "../libraries/AssetFlow.sol";
import {
    IAssetEnforcement,
    AssetEnforcementRequest,
    AssetEnforcementResult,
    AssetEnforcementFailure
} from "../../interfaces/asset/IAssetEnforcement.sol";

/// @notice B-02-v3 delegates the asset's native transfer decision to a
///         provider-neutral adapter selected by immutable Manifest policy bytes.
contract AssetEnforcementV3 is BaseElement {
    bytes32 internal constant ELEMENT_ID = "B-02-v3";
    bytes32 public constant PARAMETER_SCHEMA_ID = keccak256("corner-store.element.asset-enforcement.v1");
    uint16 public constant PARAMETER_SCHEMA_VERSION = 1;
    uint32 public constant PARAMETER_BYTES = 128;

    struct AdapterBinding {
        address adapter;
        uint16 interfaceVersion;
        bytes32 runtimeCodehash;
        bytes32 bindingDigest;
    }

    constructor()
        BaseElement(ElementMetadata({
                elementId: ELEMENT_ID,
                category: ElementCategory.ASSET_ATTRIBUTE,
                version: "B-02-v3",
                temporal: TemporalNature.REALTIME,
                decidability: Decidability.DETERMINISTIC,
                timing: ObligationTiming.AT_TRADE_GATE,
                statefulness: Statefulness.STATELESS,
                evidenceType: EvidenceType.COMPOSITE,
                defaultEnforcement: EnforcementAction.BLOCK,
                parameterSchemaId: PARAMETER_SCHEMA_ID,
                parameterSchemaVersion: PARAMETER_SCHEMA_VERSION,
                maxParameterBytes: PARAMETER_BYTES,
                parametersRequired: true
            }))
    {}

    function _check(address, address, address asset, uint256 amount, bytes calldata context, bytes calldata parameters)
        internal
        view
        override
        returns (bool passed, bytes32 reasonCode)
    {
        if (parameters.length != PARAMETER_BYTES) return (false, _code(1));
        AdapterBinding memory binding = abi.decode(parameters, (AdapterBinding));
        if (
            binding.adapter == address(0) || binding.interfaceVersion == 0 || binding.runtimeCodehash == bytes32(0)
                || binding.bindingDigest == bytes32(0)
        ) return (false, _code(3));
        if (binding.adapter.codehash != binding.runtimeCodehash) return (false, _code(2));

        (address from, address to) = AssetFlow.resolve(asset, context);
        AssetEnforcementRequest memory request = AssetEnforcementRequest({
            asset: asset, from: from, to: to, amount: amount, contextHash: keccak256(context)
        });
        return _evaluate(binding, request);
    }

    function _evaluate(AdapterBinding memory binding, AssetEnforcementRequest memory request)
        private
        view
        returns (bool passed, bytes32 reasonCode)
    {
        bytes32 requestDigest = keccak256(abi.encode(request));

        try IAssetEnforcement(binding.adapter).enforcementVersion() returns (uint16 actualVersion) {
            if (actualVersion != binding.interfaceVersion) return (false, _code(2));
        } catch {
            return (false, _code(1));
        }
        try IAssetEnforcement(binding.adapter).bindingDigest(request.asset) returns (bytes32 actualDigest) {
            if (actualDigest != binding.bindingDigest) return (false, _code(2));
        } catch {
            return (false, _code(1));
        }

        try IAssetEnforcement(binding.adapter).willAllow(request) returns (AssetEnforcementResult memory result) {
            if (result.requestDigest != requestDigest) return (false, _code(1));
            if (result.bindingDigest != binding.bindingDigest) return (false, _code(2));
            if (result.allowed && result.failure == AssetEnforcementFailure.NONE) return (true, ReasonCodes.OK);
            if (!result.allowed && result.failure == AssetEnforcementFailure.TOKEN_REJECTED) {
                return (false, _code(4));
            }
            if (!result.allowed && result.failure == AssetEnforcementFailure.UNSUPPORTED) {
                return (false, _code(3));
            }
            if (!result.allowed && result.failure == AssetEnforcementFailure.CONFIGURATION_DRIFT) {
                return (false, _code(2));
            }
            return (false, _code(1));
        } catch {
            return (false, _code(1));
        }
    }

    /// @dev 1 unavailable/malformed, 2 binding drift, 3 unsupported, 4 token rejection.
    function _code(uint32 n) internal pure returns (bytes32) {
        return ReasonCodes.encode(0, ELEMENT_ID, n);
    }
}
