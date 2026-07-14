// SPDX-License-Identifier: GPL-3.0
pragma solidity 0.8.17;

import {Governed} from "../auth/Governed.sol";
import {ITokenPolicyRegistry} from "../interfaces/compliance/ITokenPolicyRegistry.sol";
import {ManifestCore, PolicyStatus} from "../types/ComplianceTypes.sol";
import {Errors} from "../libraries/Errors.sol";
import {Events} from "../libraries/Events.sol";

/// @title TokenPolicyRegistry
/// @notice Manifest store + lifecycle state machine. A manifest moves through an
///         explicit, operator-gated lifecycle instead of being overwritten by a
///         raw status setter:
///
///           UNKNOWN --registerManifest--> PROPOSED --approveManifest--> ACTIVE
///           ACTIVE  --suspendManifest--> SUSPENDED --resumeManifest--> ACTIVE
///           {ACTIVE, SUSPENDED} --retireManifest--> RETIRED (terminal)
///           UNKNOWN --setUnregulated--> UNREGULATED
///
///         Re-registration is allowed only from a clean slate (UNKNOWN) or a
///         terminal RETIRED manifest; every other transition that is not drawn
///         above reverts {Errors.InvalidManifestTransition}. Governance (owner)
///         declares/classifies a token (register, setUnregulated); an operator
///         drives the lifecycle of an existing manifest (approve/suspend/
///         resume/retire).
contract TokenPolicyRegistry is ITokenPolicyRegistry, Governed {
    mapping(address => ManifestCore) internal _manifests;

    /// @notice Declare a token's manifest. Always lands in PROPOSED regardless of
    ///         the caller-supplied `m.status`; records the declarer. Allowed only
    ///         from UNKNOWN (never declared) or RETIRED (terminal, being re-issued).
    function registerManifest(address token, ManifestCore calldata m) external onlyOwner {
        PolicyStatus current = _manifests[token].status;
        // Re-registration only from a clean slate (never declared) or a terminal
        // RETIRED manifest; an in-flight PROPOSED/ACTIVE/SUSPENDED manifest or an
        // UNREGULATED tag must not be silently overwritten.
        if (current != PolicyStatus.UNKNOWN && current != PolicyStatus.RETIRED) {
            revert Errors.InvalidManifestTransition();
        }
        _manifests[token] = m;
        _manifests[token].status = PolicyStatus.PROPOSED;
        _manifests[token].declaredBy = msg.sender;
        _manifests[token].approvedBy = address(0);
        emit Events.ManifestRegistered(token, m.issuanceRecipeId, msg.sender);
        emit Events.ManifestStatusChanged(token, PolicyStatus.PROPOSED, bytes32(0));
    }

    /// @notice Operator approval: PROPOSED -> ACTIVE, records the approver.
    function approveManifest(address token) external onlyOperator {
        ManifestCore storage mm = _manifests[token];
        if (mm.status != PolicyStatus.PROPOSED) revert Errors.InvalidManifestTransition();
        // Registry-level completeness floor: an approvable manifest must declare
        // at least an issuance recipe (id 0 = none). Deep validation stays the
        // engine's fail-closed job. Recipe id 0 is never a registered recipe.
        if (mm.issuanceRecipeId == 0) revert Errors.RecipeNotRegistered(0);
        mm.status = PolicyStatus.ACTIVE;
        mm.approvedBy = msg.sender;
        emit Events.ManifestStatusChanged(token, PolicyStatus.ACTIVE, bytes32(0));
    }

    /// @notice ACTIVE -> SUSPENDED (reversible kill switch).
    function suspendManifest(address token, bytes32 reasonCode) external onlyOperator {
        if (_manifests[token].status != PolicyStatus.ACTIVE) revert Errors.InvalidManifestTransition();
        _manifests[token].status = PolicyStatus.SUSPENDED;
        emit Events.ManifestStatusChanged(token, PolicyStatus.SUSPENDED, reasonCode);
    }

    /// @notice SUSPENDED -> ACTIVE (undo a suspension).
    function resumeManifest(address token) external onlyOperator {
        if (_manifests[token].status != PolicyStatus.SUSPENDED) revert Errors.InvalidManifestTransition();
        _manifests[token].status = PolicyStatus.ACTIVE;
        emit Events.ManifestStatusChanged(token, PolicyStatus.ACTIVE, bytes32(0));
    }

    /// @notice {ACTIVE, SUSPENDED} -> RETIRED (terminal; re-issue via re-register).
    function retireManifest(address token, bytes32 reasonCode) external onlyOperator {
        PolicyStatus current = _manifests[token].status;
        if (current != PolicyStatus.ACTIVE && current != PolicyStatus.SUSPENDED) {
            revert Errors.InvalidManifestTransition();
        }
        _manifests[token].status = PolicyStatus.RETIRED;
        emit Events.ManifestStatusChanged(token, PolicyStatus.RETIRED, reasonCode);
    }

    /// @notice Tag a token as out-of-scope (UNREGULATED). Only from UNKNOWN: a
    ///         token that has ever carried a manifest cannot be quietly re-tagged.
    function setUnregulated(address token) external onlyOwner {
        if (_manifests[token].status != PolicyStatus.UNKNOWN) revert Errors.InvalidManifestTransition();
        _manifests[token].status = PolicyStatus.UNREGULATED;
        emit Events.ManifestStatusChanged(token, PolicyStatus.UNREGULATED, bytes32(0));
    }

    /// @notice Undo an UNREGULATED tag: UNREGULATED -> UNKNOWN. Only from
    ///         UNREGULATED (any other state reverts). Lets a token mistagged
    ///         out-of-scope be returned to a clean slate so it can later be
    ///         registered as a regulated manifest. onlyOwner, symmetric with
    ///         setUnregulated (both are governance classification calls).
    function clearUnregulated(address token) external onlyOwner {
        if (_manifests[token].status != PolicyStatus.UNREGULATED) revert Errors.InvalidManifestTransition();
        _manifests[token].status = PolicyStatus.UNKNOWN;
        emit Events.ManifestStatusChanged(token, PolicyStatus.UNKNOWN, bytes32(0));
    }

    function manifestOf(address token) external view returns (ManifestCore memory) {
        return _manifests[token];
    }

    function statusOf(address token) external view returns (PolicyStatus) {
        return _manifests[token].status;
    }

    function setFact(address token, uint256 factsPacked) external onlyOperator {
        uint256 old = _manifests[token].factsPacked;
        if (factsPacked & old != old) revert Errors.LooseningForbidden();
        _manifests[token].factsPacked = factsPacked;
    }
}
