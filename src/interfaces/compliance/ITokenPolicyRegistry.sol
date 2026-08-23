// SPDX-License-Identifier: GPL-3.0
pragma solidity 0.8.17;

import {
    CompiledElementRule,
    ElementEnforcementOverride,
    ManifestCore,
    PolicyStatus,
    RecipeBinding
} from "../../types/ComplianceTypes.sol";

// ITokenPolicyRegistry  (Manifest store)
interface ITokenPolicyRegistry {
    function MIN_MANIFEST_DELAY() external view returns (uint64);

    function registerManifest(address token, ManifestCore calldata m, RecipeBinding[] calldata bindings) external; // -> PROPOSED

    function registerManifest(
        address token,
        ManifestCore calldata m,
        RecipeBinding[] calldata bindings,
        ElementEnforcementOverride[] calldata overrides
    ) external;

    function approveManifest(address token) external; // PROPOSED -> ACTIVE

    function suspendManifest(address token, bytes32 reasonCode) external; // ACTIVE -> SUSPENDED

    function scheduleManifestResume(address token, bytes32 reasonCode) external; // SUSPENDED -> pending ACTIVE

    function cancelManifestResume(address token) external;

    function resumeManifest(address token) external; // executes pending SUSPENDED -> ACTIVE after delay

    function scheduleManifestUpdate(
        address token,
        ManifestCore calldata m,
        RecipeBinding[] calldata bindings,
        bytes32 reasonCode
    ) external;

    function scheduleManifestUpdate(
        address token,
        ManifestCore calldata m,
        RecipeBinding[] calldata bindings,
        ElementEnforcementOverride[] calldata overrides,
        bytes32 reasonCode
    ) external;

    function cancelManifestUpdate(address token) external;

    function activateManifestUpdate(address token) external;

    function retireManifest(address token, bytes32 reasonCode) external; // ACTIVE/SUSPENDED -> RETIRED

    function setUnregulated(address token) external; // UNKNOWN -> UNREGULATED

    function clearUnregulated(address token) external; // UNREGULATED -> UNKNOWN

    function manifestOf(address token) external view returns (ManifestCore memory);

    function recipeBindingsOf(address token) external view returns (RecipeBinding[] memory);

    function statusOf(address token) external view returns (PolicyStatus);

    function manifestVersionOf(address token) external view returns (uint64);

    function manifestHistoryHashOf(address token) external view returns (bytes32);

    function compiledPlanHashOf(address token) external view returns (bytes32);

    function compiledBindingCountOf(address token) external view returns (uint256);

    function compiledBindingOf(address token, uint256 index)
        external
        view
        returns (RecipeBinding memory binding, bytes32 recipeKey, bytes32 bindingPlanHash);

    function compiledRulesOf(address token, uint256 bindingIndex) external view returns (CompiledElementRule[] memory);

    function pendingManifestUpdateOf(address token)
        external
        view
        returns (
            ManifestCore memory manifest,
            RecipeBinding[] memory bindings,
            uint64 effectiveTime,
            bytes32 reasonCode
        );

    function pendingManifestResumeOf(address token) external view returns (uint64 effectiveTime, bytes32 reasonCode);

    function setFact(address token, uint256 factsPacked) external; // strengthen-only
}
