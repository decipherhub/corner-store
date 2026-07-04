// SPDX-License-Identifier: GPL-3.0
pragma solidity 0.8.17;

import {ManifestCore, PolicyStatus} from "../../types/ComplianceTypes.sol";

// ITokenPolicyRegistry  (Manifest store)
interface ITokenPolicyRegistry {
    function registerManifest(address token, ManifestCore calldata m) external; // -> PROPOSED

    function approveManifest(address token) external; // PROPOSED -> ACTIVE

    function suspendManifest(address token, bytes32 reasonCode) external; // ACTIVE -> SUSPENDED

    function resumeManifest(address token) external; // SUSPENDED -> ACTIVE

    function retireManifest(address token, bytes32 reasonCode) external; // ACTIVE/SUSPENDED -> RETIRED

    function setUnregulated(address token) external; // UNKNOWN -> UNREGULATED

    function manifestOf(address token) external view returns (ManifestCore memory);

    function statusOf(address token) external view returns (PolicyStatus);

    function setFact(address token, uint256 factsPacked) external; // strengthen-only
}
