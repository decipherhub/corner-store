// SPDX-License-Identifier: GPL-3.0
pragma solidity 0.8.17;

import {Governed} from "../auth/Governed.sol";
import {IOperatorRegistry} from "../interfaces/compliance/IOperatorRegistry.sol";
import {Errors} from "../libraries/Errors.sol";
import {Events} from "../libraries/Events.sol";

contract OperatorRegistry is IOperatorRegistry, Governed {
    uint64 public constant MIN_UNPAUSE_DELAY = 1 days;
    bytes32 internal constant GLOBAL_SCOPE = "GLOBAL";
    bytes32 internal constant ASSET_SCOPE = "ASSET";
    bytes32 internal constant VENUE_SCOPE = "VENUE";

    struct PendingUnpause {
        uint64 effectiveTime;
        bytes32 reasonCode;
    }

    bool internal _globalPaused;
    PendingUnpause internal _pendingGlobalUnpause;
    mapping(address => bool) internal _assetSuspended;
    mapping(address => PendingUnpause) internal _pendingAssetUnpause;
    mapping(address => bool) internal _venueSuspended;
    mapping(address => PendingUnpause) internal _pendingVenueUnpause;
    bytes32 public pauseHistoryHash;

    function setGlobalPaused(bool paused, bytes32 reasonCode) external onlyOperator {
        if (paused) {
            bool oldValue = _globalPaused;
            _globalPaused = true;
            delete _pendingGlobalUnpause;
            emit Events.GlobalSuspended(reasonCode);
            _recordPause(GLOBAL_SCOPE, address(0), oldValue, true, reasonCode, bytes32(0), uint64(block.timestamp));
            return;
        }
        if (msg.sender != owner()) revert Errors.NotAuthorized();
        _executeGlobalUnpause();
    }

    function scheduleGlobalUnpause(bytes32 reasonCode) external onlyOwner {
        if (!_globalPaused) revert Errors.InvalidManifestTransition();
        if (_pendingGlobalUnpause.effectiveTime != 0) revert Errors.PendingActionExists();
        _pendingGlobalUnpause = PendingUnpause(_readyTime(), reasonCode);
        emit Events.GlobalUnpauseScheduled(msg.sender, reasonCode, _pendingGlobalUnpause.effectiveTime);
    }

    function cancelGlobalUnpause() external onlyOwner {
        if (_pendingGlobalUnpause.effectiveTime == 0) revert Errors.PendingActionNotFound();
        delete _pendingGlobalUnpause;
        emit Events.GlobalUnpauseCancelled(msg.sender);
    }

    function executeGlobalUnpause() external onlyOwner {
        _executeGlobalUnpause();
    }

    function setAssetSuspended(address token, bool suspended, bytes32 reasonCode) external onlyOperator {
        if (suspended) {
            bool oldValue = _assetSuspended[token];
            _assetSuspended[token] = true;
            delete _pendingAssetUnpause[token];
            emit Events.AssetSuspended(token, reasonCode);
            _recordPause(ASSET_SCOPE, token, oldValue, true, reasonCode, bytes32(0), uint64(block.timestamp));
            return;
        }
        if (msg.sender != owner()) revert Errors.NotAuthorized();
        _executeAssetUnpause(token);
    }

    function scheduleAssetUnpause(address token, bytes32 reasonCode) external onlyOwner {
        if (!_assetSuspended[token]) revert Errors.InvalidManifestTransition();
        if (_pendingAssetUnpause[token].effectiveTime != 0) revert Errors.PendingActionExists();
        _pendingAssetUnpause[token] = PendingUnpause(_readyTime(), reasonCode);
        emit Events.AssetUnpauseScheduled(token, msg.sender, reasonCode, _pendingAssetUnpause[token].effectiveTime);
    }

    function cancelAssetUnpause(address token) external onlyOwner {
        if (_pendingAssetUnpause[token].effectiveTime == 0) revert Errors.PendingActionNotFound();
        delete _pendingAssetUnpause[token];
        emit Events.AssetUnpauseCancelled(token, msg.sender);
    }

    function executeAssetUnpause(address token) external onlyOwner {
        _executeAssetUnpause(token);
    }

    function setVenueSuspended(address venue, bool suspended, bytes32 reasonCode) external onlyOperator {
        if (suspended) {
            bool oldValue = _venueSuspended[venue];
            _venueSuspended[venue] = true;
            delete _pendingVenueUnpause[venue];
            emit Events.VenueSuspended(venue, reasonCode);
            _recordPause(VENUE_SCOPE, venue, oldValue, true, reasonCode, bytes32(0), uint64(block.timestamp));
            return;
        }
        if (msg.sender != owner()) revert Errors.NotAuthorized();
        _executeVenueUnpause(venue);
    }

    function scheduleVenueUnpause(address venue, bytes32 reasonCode) external onlyOwner {
        if (!_venueSuspended[venue]) revert Errors.InvalidManifestTransition();
        if (_pendingVenueUnpause[venue].effectiveTime != 0) revert Errors.PendingActionExists();
        _pendingVenueUnpause[venue] = PendingUnpause(_readyTime(), reasonCode);
        emit Events.VenueUnpauseScheduled(venue, msg.sender, reasonCode, _pendingVenueUnpause[venue].effectiveTime);
    }

    function cancelVenueUnpause(address venue) external onlyOwner {
        if (_pendingVenueUnpause[venue].effectiveTime == 0) revert Errors.PendingActionNotFound();
        delete _pendingVenueUnpause[venue];
        emit Events.VenueUnpauseCancelled(venue, msg.sender);
    }

    function executeVenueUnpause(address venue) external onlyOwner {
        _executeVenueUnpause(venue);
    }

    function isGlobalPaused() external view returns (bool) {
        return _globalPaused;
    }

    function isAssetSuspended(address token) external view returns (bool) {
        return _assetSuspended[token];
    }

    function isVenueSuspended(address venue) external view returns (bool) {
        return _venueSuspended[venue];
    }

    function _executeGlobalUnpause() internal {
        PendingUnpause memory pending = _pendingGlobalUnpause;
        _requireReady(pending.effectiveTime);
        _globalPaused = false;
        delete _pendingGlobalUnpause;
        emit Events.GlobalUnpaused(msg.sender);
        _recordPause(GLOBAL_SCOPE, address(0), true, false, pending.reasonCode, bytes32(0), pending.effectiveTime);
    }

    function _executeAssetUnpause(address token) internal {
        PendingUnpause memory pending = _pendingAssetUnpause[token];
        _requireReady(pending.effectiveTime);
        _assetSuspended[token] = false;
        delete _pendingAssetUnpause[token];
        emit Events.AssetUnpaused(token, msg.sender);
        _recordPause(ASSET_SCOPE, token, true, false, pending.reasonCode, bytes32(0), pending.effectiveTime);
    }

    function _executeVenueUnpause(address venue) internal {
        PendingUnpause memory pending = _pendingVenueUnpause[venue];
        _requireReady(pending.effectiveTime);
        _venueSuspended[venue] = false;
        delete _pendingVenueUnpause[venue];
        emit Events.VenueUnpaused(venue, msg.sender);
        _recordPause(VENUE_SCOPE, venue, true, false, pending.reasonCode, bytes32(0), pending.effectiveTime);
    }

    function _readyTime() internal view returns (uint64) {
        return uint64(block.timestamp + MIN_UNPAUSE_DELAY);
    }

    function _requireReady(uint64 readyAt) internal view {
        if (readyAt == 0) revert Errors.PendingActionNotFound();
        if (block.timestamp < readyAt) revert Errors.TimelockNotReady(readyAt);
    }

    function _recordPause(
        bytes32 scope,
        address target,
        bool oldValue,
        bool newValue,
        bytes32 reasonCode,
        bytes32 reasonHash,
        uint64 effectiveTime
    ) internal {
        bytes32 nextHistoryHash = keccak256(
            abi.encode(
                address(this),
                pauseHistoryHash,
                scope,
                target,
                oldValue,
                newValue,
                msg.sender,
                reasonCode,
                reasonHash,
                effectiveTime
            )
        );
        pauseHistoryHash = nextHistoryHash;
        emit Events.PauseActionRecorded(
            scope, target, oldValue, newValue, msg.sender, reasonCode, reasonHash, effectiveTime, nextHistoryHash
        );
    }
}
