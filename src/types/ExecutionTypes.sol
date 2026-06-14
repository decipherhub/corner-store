// SPDX-License-Identifier: GPL-3.0
pragma solidity 0.8.17;

import {ComplianceContext} from "./ComplianceTypes.sol";

struct ExecutionRequest {
    ComplianceContext context;
    uint256 amountOutMin;
    uint64 deadline;
    uint256 nonce;
    bytes venueData;
}

struct ExecutionResult {
    uint256 amountOut;
    bytes32 executionId;
}
