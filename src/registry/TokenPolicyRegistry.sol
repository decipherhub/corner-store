// SPDX-License-Identifier: GPL-3.0
pragma solidity 0.8.17;

import {Governed} from "../auth/Governed.sol";
import {ITokenPolicyRegistry} from "../interfaces/compliance/ITokenPolicyRegistry.sol";
import {ManifestCore, PolicyStatus, RecipeBinding, RecipeBindingMode} from "../types/ComplianceTypes.sol";
import {Errors} from "../libraries/Errors.sol";
import {Events} from "../libraries/Events.sol";

/// @title TokenPolicyRegistry
/// @notice Manifest store + lifecycle state machine. A manifest moves through an
///         explicit, operator-gated lifecycle instead of being overwritten by a
///         raw status setter:
///
///           UNKNOWN --registerManifest--> PROPOSED --approveManifest--> ACTIVE
///           ACTIVE  --suspendManifest--> SUSPENDED --schedule/resume--> ACTIVE
///           {ACTIVE, SUSPENDED} --retireManifest--> RETIRED (terminal)
///           UNKNOWN --setUnregulated--> UNREGULATED
///
///         Re-registration is allowed only from a clean slate (UNKNOWN) or a
///         terminal RETIRED manifest; every other transition that is not drawn
///         above reverts {Errors.InvalidManifestTransition}. Governance (owner)
///         declares/classifies a token (register, setUnregulated); an operator
///         drives immediate tightening and delayed action execution. Governance
///         schedules reopening and semantic updates through the registry owner.
contract TokenPolicyRegistry is ITokenPolicyRegistry, Governed {
    uint64 public constant MIN_MANIFEST_DELAY = 1 days;
    uint256 public constant MAX_RECIPE_BINDINGS = 8;

    struct PendingManifestUpdate {
        ManifestCore manifest;
        uint64 effectiveTime;
        bytes32 reasonCode;
    }

    struct PendingResume {
        uint64 effectiveTime;
        bytes32 reasonCode;
    }

    mapping(address => ManifestCore) internal _manifests;
    mapping(address => RecipeBinding[]) internal _recipeBindings;
    mapping(address => uint64) internal _manifestVersions;
    mapping(address => bytes32) internal _manifestHistoryHashes;
    mapping(address => PendingManifestUpdate) internal _pendingManifestUpdates;
    mapping(address => RecipeBinding[]) internal _pendingManifestBindings;
    mapping(address => PendingResume) internal _pendingManifestResumes;

    /// @notice Declare a token's manifest. Always lands in PROPOSED regardless of
    ///         the caller-supplied `m.status`; records the declarer. Allowed only
    ///         from UNKNOWN (never declared) or RETIRED (terminal, being re-issued).
    function registerManifest(address token, ManifestCore calldata m, RecipeBinding[] calldata bindings)
        external
        onlyOwner
    {
        _registerManifest(token, m, bindings);
    }

    /// @dev Deprecated compatibility entrypoint. Runtime evaluation never reads
    ///      the legacy fields after they are compiled into RecipeBinding[].
    function registerManifest(address token, ManifestCore calldata m) external onlyOwner {
        _registerManifest(token, m, _legacyBindings(m));
    }

    function _registerManifest(address token, ManifestCore memory m, RecipeBinding[] memory bindings) internal {
        _validateBindings(bindings);
        PolicyStatus current = _manifests[token].status;
        bytes32 oldHash = _manifests[token].fullManifestHash;
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
        _replaceBindings(_recipeBindings[token], bindings);
        _recordHistory(
            token,
            current,
            PolicyStatus.PROPOSED,
            oldHash,
            _manifests[token].fullManifestHash,
            bytes32(0),
            bytes32(0),
            uint64(block.timestamp),
            true
        );
        emit Events.ManifestRegistered(token, keccak256(abi.encode(bindings)), msg.sender);
        emit Events.ManifestStatusChanged(token, PolicyStatus.PROPOSED, bytes32(0));
    }

    /// @notice Operator approval: PROPOSED -> ACTIVE, records the approver.
    function approveManifest(address token) external onlyOperator {
        ManifestCore storage mm = _manifests[token];
        if (mm.status != PolicyStatus.PROPOSED) revert Errors.InvalidManifestTransition();
        if (_recipeBindings[token].length == 0) revert Errors.InvalidRecipeBinding();
        mm.status = PolicyStatus.ACTIVE;
        mm.approvedBy = msg.sender;
        _recordHistory(
            token,
            PolicyStatus.PROPOSED,
            PolicyStatus.ACTIVE,
            mm.fullManifestHash,
            mm.fullManifestHash,
            bytes32(0),
            bytes32(0),
            uint64(block.timestamp),
            false
        );
        emit Events.ManifestStatusChanged(token, PolicyStatus.ACTIVE, bytes32(0));
    }

    /// @notice ACTIVE -> SUSPENDED (reversible kill switch).
    function suspendManifest(address token, bytes32 reasonCode) external onlyOperator {
        if (_manifests[token].status != PolicyStatus.ACTIVE) revert Errors.InvalidManifestTransition();
        _manifests[token].status = PolicyStatus.SUSPENDED;
        delete _pendingManifestResumes[token];
        _recordHistory(
            token,
            PolicyStatus.ACTIVE,
            PolicyStatus.SUSPENDED,
            _manifests[token].fullManifestHash,
            _manifests[token].fullManifestHash,
            reasonCode,
            bytes32(0),
            uint64(block.timestamp),
            false
        );
        emit Events.ManifestStatusChanged(token, PolicyStatus.SUSPENDED, reasonCode);
    }

    /// @notice Owner schedules a compliance reopening; execution is delayed.
    function scheduleManifestResume(address token, bytes32 reasonCode) external onlyOwner {
        if (_manifests[token].status != PolicyStatus.SUSPENDED) revert Errors.InvalidManifestTransition();
        if (_pendingManifestResumes[token].effectiveTime != 0) revert Errors.PendingActionExists();
        _pendingManifestResumes[token] = PendingResume(_readyTime(), reasonCode);
        emit Events.ManifestResumeScheduled(token, reasonCode, _pendingManifestResumes[token].effectiveTime);
    }

    function cancelManifestResume(address token) external onlyOwner {
        if (_pendingManifestResumes[token].effectiveTime == 0) revert Errors.PendingActionNotFound();
        delete _pendingManifestResumes[token];
        emit Events.ManifestResumeCancelled(token);
    }

    /// @notice Execute a scheduled SUSPENDED -> ACTIVE reopening after delay.
    function resumeManifest(address token) external onlyOperator {
        if (_manifests[token].status != PolicyStatus.SUSPENDED) revert Errors.InvalidManifestTransition();
        PendingResume memory pending = _pendingManifestResumes[token];
        _requireReady(pending.effectiveTime);
        _manifests[token].status = PolicyStatus.ACTIVE;
        delete _pendingManifestResumes[token];
        _recordHistory(
            token,
            PolicyStatus.SUSPENDED,
            PolicyStatus.ACTIVE,
            _manifests[token].fullManifestHash,
            _manifests[token].fullManifestHash,
            pending.reasonCode,
            bytes32(0),
            pending.effectiveTime,
            false
        );
        emit Events.ManifestStatusChanged(token, PolicyStatus.ACTIVE, pending.reasonCode);
    }

    /// @notice Owner proposes a hash-bearing manifest update for ACTIVE/SUSPENDED
    ///         manifests. Full legal/compliance docs remain offchain.
    function scheduleManifestUpdate(
        address token,
        ManifestCore calldata m,
        RecipeBinding[] calldata bindings,
        bytes32 reasonCode
    ) external onlyOwner {
        _scheduleManifestUpdate(token, m, bindings, reasonCode);
    }

    /// @dev Deprecated compatibility entrypoint; see {registerManifest}.
    function scheduleManifestUpdate(address token, ManifestCore calldata m, bytes32 reasonCode) external onlyOwner {
        _scheduleManifestUpdate(token, m, _legacyBindings(m), reasonCode);
    }

    function _scheduleManifestUpdate(
        address token,
        ManifestCore memory m,
        RecipeBinding[] memory bindings,
        bytes32 reasonCode
    ) internal {
        _validateBindings(bindings);
        PolicyStatus current = _manifests[token].status;
        if (current != PolicyStatus.ACTIVE && current != PolicyStatus.SUSPENDED) {
            revert Errors.InvalidManifestTransition();
        }
        if (_pendingManifestUpdates[token].effectiveTime != 0) revert Errors.PendingActionExists();
        if (m.fullManifestHash == bytes32(0) || m.fullManifestHash == _manifests[token].fullManifestHash) {
            revert Errors.InvalidManifestHash();
        }

        uint64 effectiveTime = _readyTime();
        _pendingManifestUpdates[token] = PendingManifestUpdate(m, effectiveTime, reasonCode);
        _replaceBindings(_pendingManifestBindings[token], bindings);
        emit Events.ManifestSemanticUpdateScheduled(
            token,
            _manifestVersions[token],
            _manifestVersions[token] + 1,
            _manifests[token].fullManifestHash,
            m.fullManifestHash,
            reasonCode,
            effectiveTime
        );
    }

    function cancelManifestUpdate(address token) external onlyOwner {
        if (_pendingManifestUpdates[token].effectiveTime == 0) revert Errors.PendingActionNotFound();
        delete _pendingManifestUpdates[token];
        delete _pendingManifestBindings[token];
        emit Events.ManifestSemanticUpdateCancelled(token);
    }

    /// @notice Activate a scheduled semantic update after delay. If the manifest
    ///         was SUSPENDED before activation, it remains SUSPENDED.
    function activateManifestUpdate(address token) external onlyOperator {
        PolicyStatus current = _manifests[token].status;
        if (current != PolicyStatus.ACTIVE && current != PolicyStatus.SUSPENDED) {
            revert Errors.InvalidManifestTransition();
        }

        PendingManifestUpdate storage pending = _pendingManifestUpdates[token];
        _requireReady(pending.effectiveTime);

        uint64 oldVersion = _manifestVersions[token];
        bytes32 oldHash = _manifests[token].fullManifestHash;
        bytes32 newHash = pending.manifest.fullManifestHash;
        bytes32 reasonCode = pending.reasonCode;
        uint64 effectiveTime = pending.effectiveTime;

        ManifestCore memory next = pending.manifest;
        next.status = current;
        next.declaredBy = owner();
        next.approvedBy = msg.sender;
        _manifests[token] = next;
        _copyBindings(_recipeBindings[token], _pendingManifestBindings[token]);
        uint64 newVersion =
            _recordHistory(token, current, current, oldHash, newHash, reasonCode, bytes32(0), effectiveTime, true);
        delete _pendingManifestUpdates[token];
        delete _pendingManifestBindings[token];

        emit Events.ManifestSemanticUpdateActivated(
            token, oldVersion, newVersion, oldHash, newHash, reasonCode, effectiveTime
        );
    }

    /// @notice {ACTIVE, SUSPENDED} -> RETIRED (terminal; re-issue via re-register).
    function retireManifest(address token, bytes32 reasonCode) external onlyOperator {
        PolicyStatus current = _manifests[token].status;
        if (current != PolicyStatus.ACTIVE && current != PolicyStatus.SUSPENDED) {
            revert Errors.InvalidManifestTransition();
        }
        _manifests[token].status = PolicyStatus.RETIRED;
        delete _pendingManifestUpdates[token];
        delete _pendingManifestBindings[token];
        delete _pendingManifestResumes[token];
        _recordHistory(
            token,
            current,
            PolicyStatus.RETIRED,
            _manifests[token].fullManifestHash,
            _manifests[token].fullManifestHash,
            reasonCode,
            bytes32(0),
            uint64(block.timestamp),
            false
        );
        emit Events.ManifestStatusChanged(token, PolicyStatus.RETIRED, reasonCode);
    }

    /// @notice Tag a token as out-of-scope (UNREGULATED). Only from UNKNOWN: a
    ///         token that has ever carried a manifest cannot be quietly re-tagged.
    function setUnregulated(address token) external onlyOwner {
        if (_manifests[token].status != PolicyStatus.UNKNOWN) revert Errors.InvalidManifestTransition();
        _manifests[token].status = PolicyStatus.UNREGULATED;
        _recordHistory(
            token,
            PolicyStatus.UNKNOWN,
            PolicyStatus.UNREGULATED,
            bytes32(0),
            bytes32(0),
            bytes32(0),
            bytes32(0),
            uint64(block.timestamp),
            false
        );
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
        _recordHistory(
            token,
            PolicyStatus.UNREGULATED,
            PolicyStatus.UNKNOWN,
            bytes32(0),
            bytes32(0),
            bytes32(0),
            bytes32(0),
            uint64(block.timestamp),
            false
        );
        emit Events.ManifestStatusChanged(token, PolicyStatus.UNKNOWN, bytes32(0));
    }

    function manifestOf(address token) external view returns (ManifestCore memory) {
        return _manifests[token];
    }

    function recipeBindingsOf(address token) external view returns (RecipeBinding[] memory) {
        return _recipeBindings[token];
    }

    function statusOf(address token) external view returns (PolicyStatus) {
        return _manifests[token].status;
    }

    function manifestVersionOf(address token) external view returns (uint64) {
        return _manifestVersions[token];
    }

    function manifestHistoryHashOf(address token) external view returns (bytes32) {
        return _manifestHistoryHashes[token];
    }

    function pendingManifestUpdateOf(address token)
        external
        view
        returns (
            ManifestCore memory manifest,
            RecipeBinding[] memory bindings,
            uint64 effectiveTime,
            bytes32 reasonCode
        )
    {
        PendingManifestUpdate storage pending = _pendingManifestUpdates[token];
        return (pending.manifest, _pendingManifestBindings[token], pending.effectiveTime, pending.reasonCode);
    }

    function pendingManifestResumeOf(address token) external view returns (uint64 effectiveTime, bytes32 reasonCode) {
        PendingResume storage pending = _pendingManifestResumes[token];
        return (pending.effectiveTime, pending.reasonCode);
    }

    function setFact(address token, uint256 factsPacked) external onlyOperator {
        PolicyStatus current = _manifests[token].status;
        if (current != PolicyStatus.PROPOSED) revert Errors.InvalidManifestTransition();
        uint256 old = _manifests[token].factsPacked;
        if (factsPacked & old != old) revert Errors.LooseningForbidden();
        _manifests[token].factsPacked = factsPacked;
    }

    function _recordHistory(
        address token,
        PolicyStatus oldStatus,
        PolicyStatus newStatus,
        bytes32 oldManifestHash,
        bytes32 newManifestHash,
        bytes32 reasonCode,
        bytes32 reasonHash,
        uint64 effectiveTime,
        bool incrementVersion
    ) internal returns (uint64 newVersion) {
        newVersion = _manifestVersions[token];
        if (incrementVersion) newVersion += 1;
        bytes32 historyHash = keccak256(
            abi.encode(
                address(this),
                token,
                _manifestHistoryHashes[token],
                oldStatus,
                newStatus,
                oldManifestHash,
                newManifestHash,
                newVersion,
                msg.sender,
                reasonCode,
                reasonHash,
                effectiveTime
            )
        );
        _manifestVersions[token] = newVersion;
        _manifestHistoryHashes[token] = historyHash;
        emit Events.ManifestHistoryAppended(
            token,
            newVersion,
            oldStatus,
            newStatus,
            oldManifestHash,
            newManifestHash,
            historyHash,
            msg.sender,
            reasonCode,
            reasonHash,
            effectiveTime
        );
    }

    function _validateBindings(RecipeBinding[] memory bindings) internal pure {
        if (bindings.length == 0) revert Errors.InvalidRecipeBinding();
        if (bindings.length > MAX_RECIPE_BINDINGS) {
            revert Errors.TooManyRecipeBindings(bindings.length, MAX_RECIPE_BINDINGS);
        }

        bool hasBlockingBinding;
        for (uint256 i = 0; i < bindings.length; i++) {
            RecipeBinding memory binding = bindings[i];
            if (binding.recipeId == 0 || binding.recipeVersion == 0) revert Errors.InvalidRecipeBinding();
            if (binding.mode == RecipeBindingMode.PATH_OPTION) {
                if (binding.pathGroupId == 0) revert Errors.InvalidRecipeBinding();
                hasBlockingBinding = true;
            } else {
                if (binding.pathGroupId != 0) revert Errors.InvalidRecipeBinding();
                if (binding.mode == RecipeBindingMode.REQUIRED_BLOCKING) hasBlockingBinding = true;
            }
            for (uint256 j = 0; j < i; j++) {
                if (bindings[j].recipeId == binding.recipeId) {
                    revert Errors.DuplicateRecipeBinding(binding.recipeId);
                }
            }
        }
        if (!hasBlockingBinding) revert Errors.InvalidRecipeBinding();
    }

    function _replaceBindings(RecipeBinding[] storage target, RecipeBinding[] memory source) internal {
        while (target.length != 0) target.pop();
        for (uint256 i = 0; i < source.length; i++) {
            target.push(source[i]);
        }
    }

    function _copyBindings(RecipeBinding[] storage target, RecipeBinding[] storage source) internal {
        while (target.length != 0) target.pop();
        for (uint256 i = 0; i < source.length; i++) {
            target.push(source[i]);
        }
    }

    function _legacyBindings(ManifestCore calldata manifest) internal pure returns (RecipeBinding[] memory bindings) {
        uint256 count = manifest.issuanceRecipeId == 0 ? 0 : (manifest.fundRecipeId == 0 ? 1 : 2);
        bindings = new RecipeBinding[](count);
        if (count == 0) return bindings;
        uint16 issuanceVersion = manifest.issuanceRecipeVersion == 0 ? 1 : manifest.issuanceRecipeVersion;
        bindings[0] =
            RecipeBinding(manifest.issuanceRecipeId, issuanceVersion, RecipeBindingMode.REQUIRED_BLOCKING, 0, 100);
        if (count == 2) {
            bindings[1] = RecipeBinding(manifest.fundRecipeId, 1, RecipeBindingMode.REQUIRED_BLOCKING, 0, 90);
        }
    }

    function _readyTime() internal view returns (uint64) {
        return uint64(block.timestamp + MIN_MANIFEST_DELAY);
    }

    function _requireReady(uint64 readyAt) internal view {
        if (readyAt == 0) revert Errors.PendingActionNotFound();
        if (block.timestamp < readyAt) revert Errors.TimelockNotReady(readyAt);
    }
}
