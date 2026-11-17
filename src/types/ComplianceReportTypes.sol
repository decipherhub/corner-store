// SPDX-License-Identifier: GPL-3.0
pragma solidity 0.8.17;

import {ComplianceDecision, RecipeBindingMode, EnforcementAction} from "./ComplianceTypes.sol";

enum RequirementStatus {
    PASS,
    FAIL,
    UNDETERMINED,
    NOT_APPLICABLE
}

struct RequirementResult {
    address token;
    uint8 bindingIndex;
    uint16 recipeId;
    uint16 recipeVersion;
    RecipeBindingMode mode;
    uint16 pathGroupId;
    bytes32 elementId;
    EnforcementAction action;
    RequirementStatus status;
    bytes32 reasonCode;
}

struct ComplianceReport {
    uint16 version;
    uint256 blockNumber;
    uint256 timestamp;
    bool complete;
    RequirementStatus status;
    RequirementStatus engineStatus;
    ComplianceDecision decision;
    bool decisionRedacted;
    RequirementStatus restrictedStatus;
    RequirementResult[] requirements;
}
