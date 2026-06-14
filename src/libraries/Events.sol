// SPDX-License-Identifier: GPL-3.0
pragma solidity 0.8.17;

import "../types/ComplianceTypes.sol";

library Events {
    event ManifestRegistered(address indexed token, uint16 issuanceRecipeId, address declaredBy);
    event ManifestStatusChanged(address indexed token, PolicyStatus status, bytes32 reasonCode);
    event ElementRegistered(bytes32 indexed elementId, address element);
    event RecipeRegistered(uint16 indexed recipeId, uint16 version, address recipe);
    event VenueRegistered(address indexed venue, VenueType venueType, address adapter);
    event VenueSuspended(address indexed venue, bytes32 reasonCode);
    event ComplianceEvaluated(bytes32 indexed decisionHash, bool allowed, bytes32 reasonCode);
    event Executed(bytes32 indexed executionId, address indexed venue, uint256 amountOut);
    event SurveillanceFlag(bytes32 indexed elementId, address indexed subject, bytes32 reasonCode);
}
