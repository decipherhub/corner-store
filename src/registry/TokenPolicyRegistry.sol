// SPDX-License-Identifier: GPL-3.0
pragma solidity 0.8.17;

import {Governed} from "../auth/Governed.sol";
import {ITokenPolicyRegistry} from "../interfaces/compliance/ITokenPolicyRegistry.sol";
import {ManifestCore, PolicyStatus} from "../types/ComplianceTypes.sol";
import {Errors} from "../libraries/Errors.sol";
import {Events} from "../libraries/Events.sol";

contract TokenPolicyRegistry is ITokenPolicyRegistry, Governed {
    mapping(address => ManifestCore) internal _manifests;

    function registerManifest(address token, ManifestCore calldata m) external onlyOwner {
        _manifests[token] = m;
        emit Events.ManifestRegistered(token, m.issuanceRecipeId, m.declaredBy);
    }

    function manifestOf(address token) external view returns (ManifestCore memory) {
        return _manifests[token];
    }

    function statusOf(address token) external view returns (PolicyStatus) {
        return _manifests[token].status;
    }

    function setStatus(address token, PolicyStatus status, bytes32 reasonCode) external onlyOperator {
        _manifests[token].status = status;
        emit Events.ManifestStatusChanged(token, status, reasonCode);
    }

    function setFact(address token, uint256 factsPacked) external onlyOperator {
        uint256 old = _manifests[token].factsPacked;
        if (factsPacked & old != old) revert Errors.LooseningForbidden();
        _manifests[token].factsPacked = factsPacked;
    }
}
