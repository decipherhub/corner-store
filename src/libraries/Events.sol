// SPDX-License-Identifier: GPL-3.0
pragma solidity 0.8.17;

import "../types/ComplianceTypes.sol";

library Events {
    event ManifestRegistered(address indexed token, bytes32 bindingsHash, address declaredBy);
    event ManifestStatusChanged(address indexed token, PolicyStatus status, bytes32 reasonCode);
    event ManifestSemanticUpdateScheduled(
        address indexed token,
        uint64 oldVersion,
        uint64 newVersion,
        bytes32 oldManifestHash,
        bytes32 newManifestHash,
        bytes32 reasonCode,
        uint64 effectiveTime
    );
    event ManifestSemanticUpdateCancelled(address indexed token);
    event ManifestSemanticUpdateActivated(
        address indexed token,
        uint64 oldVersion,
        uint64 newVersion,
        bytes32 oldManifestHash,
        bytes32 newManifestHash,
        bytes32 reasonCode,
        uint64 effectiveTime
    );
    event ManifestHistoryAppended(
        address indexed token,
        uint64 version,
        PolicyStatus oldStatus,
        PolicyStatus newStatus,
        bytes32 oldManifestHash,
        bytes32 newManifestHash,
        bytes32 historyHash,
        address actor,
        bytes32 reasonCode,
        bytes32 reasonHash,
        uint64 effectiveTime
    );
    event ManifestResumeScheduled(address indexed token, bytes32 reasonCode, uint64 effectiveTime);
    event ManifestResumeCancelled(address indexed token);
    event ElementRegistered(bytes32 indexed elementId, address element);
    event ElementRegisteredV2(
        bytes32 indexed elementId,
        address element,
        bytes32 metadataHash,
        bytes32 versionHash,
        EnforcementAction defaultAction
    );
    event RecipeRegistered(uint16 indexed recipeId, uint16 version, address recipe);
    event RecipeRegisteredV2(
        bytes32 indexed recipeKey, bytes32 indexed aliasHash, uint16 indexed recipeId, uint16 version, address recipe
    );
    event VenueRegistered(address indexed venue, VenueType venueType, address adapter);
    event GlobalSuspended(bytes32 reasonCode);
    event AssetSuspended(address indexed token, bytes32 reasonCode);
    event VenueSuspended(address indexed venue, bytes32 reasonCode);
    event GlobalUnpauseScheduled(address indexed actor, bytes32 reasonCode, uint64 effectiveTime);
    event AssetUnpauseScheduled(address indexed token, address indexed actor, bytes32 reasonCode, uint64 effectiveTime);
    event VenueUnpauseScheduled(address indexed venue, address indexed actor, bytes32 reasonCode, uint64 effectiveTime);
    event GlobalUnpauseCancelled(address indexed actor);
    event AssetUnpauseCancelled(address indexed token, address indexed actor);
    event VenueUnpauseCancelled(address indexed venue, address indexed actor);
    event GlobalUnpaused(address indexed actor);
    event AssetUnpaused(address indexed token, address indexed actor);
    event VenueUnpaused(address indexed venue, address indexed actor);
    event PauseActionRecorded(
        bytes32 indexed scope,
        address indexed target,
        bool oldValue,
        bool newValue,
        address actor,
        bytes32 reasonCode,
        bytes32 reasonHash,
        uint64 effectiveTime,
        bytes32 historyHash
    );
    event ComplianceEvaluated(bytes32 indexed decisionHash, bool allowed, bytes32 reasonCode);
    event ComplianceFlags(bytes32 indexed decisionHash, uint256 flagsBitmap);
    event Executed(bytes32 indexed executionId, address indexed venue, uint256 amountOut);
    event SurveillanceFlag(bytes32 indexed elementId, address indexed subject, bytes32 reasonCode);
}
