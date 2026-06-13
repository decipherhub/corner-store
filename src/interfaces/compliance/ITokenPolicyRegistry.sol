// SPDX-License-Identifier: GPL-3.0
pragma solidity 0.8.17;

import {ManifestCore, PolicyStatus} from "../../types/ComplianceTypes.sol";

// ITokenPolicyRegistry  (Manifest store)
interface ITokenPolicyRegistry {
    function registerManifest(address token, ManifestCore calldata m) external;

    function manifestOf(address token) external view returns (ManifestCore memory);

    function statusOf(address token) external view returns (PolicyStatus);

    function setStatus(address token, PolicyStatus status, bytes32 reasonCode) external; // write-gate

    function setFact(address token, uint256 factsPacked) external; // strengthen-only
}
