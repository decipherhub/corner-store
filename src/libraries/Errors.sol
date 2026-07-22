// SPDX-License-Identifier: GPL-3.0
pragma solidity 0.8.17;

library Errors {
    error NotAuthorized();
    error PolicyNotActive(); // UNKNOWN/SUSPENDED
    error ComplianceRejected(bytes32 reasonCode);
    error GlobalPaused();
    error TokenInPaused();
    error TokenOutPaused();
    error VenueNotAllowed();
    error VenueTypeMismatch();
    error VenueSuspended();
    error AdapterNotRegistered();
    error DeadlineExpired();
    error NonceUsed();
    error DecisionExpired();
    error DecisionMismatch(); // decisionHash != recomputed
    error MaxAmountExceeded();
    error SlippageExceeded();
    error RFQInvalidSignature();
    error RFQQuoteExpired();
    error RFQQuoteUsed();
    error RFQQuoteMismatch();
    error RFQMakerNotApproved();
    error ElementNotRegistered(bytes32 elementId);
    error RecipeNotRegistered(uint16 recipeId);
    error LooseningForbidden(); // strengthen-only override
    error InvalidManifestTransition(); // illegal PolicyStatus lifecycle move
    error TimelockNotReady(uint256 readyAt);
    error PendingActionNotFound();
    error PendingActionExists();
    error InvalidManifestHash();
    error ZeroAddress();
    error InvalidAcquisitionSnapshot();
    error InvalidRecipeBinding();
    error TooManyRecipeBindings(uint256 supplied, uint256 maximum);
    error TooManyRecipeElements(uint16 recipeId, uint256 supplied, uint256 maximum);
    error DuplicateRecipeBinding(uint16 recipeId);
    error RecipeVersionMismatch(uint16 recipeId, uint16 expected, uint16 actual);
}
