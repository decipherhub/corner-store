// SPDX-License-Identifier: GPL-3.0
pragma solidity 0.8.17;

import {IExecutionAdapter} from "../../src/interfaces/execution/IExecutionAdapter.sol";
import {IExecutionRouter} from "../../src/interfaces/execution/IExecutionRouter.sol";
import {ExecutionRequest, ExecutionResult} from "../../src/types/ExecutionTypes.sol";
import {ComplianceDecision} from "../../src/types/ComplianceTypes.sol";

/// @notice Malicious adapter that re-enters the router's execute during its own execute.
/// Used to prove the router's nonReentrant guard.
contract ReentrantAdapter is IExecutionAdapter {
    IExecutionRouter public immutable router;

    constructor(IExecutionRouter _router) {
        router = _router;
    }

    function execute(ExecutionRequest calldata req, ComplianceDecision calldata)
        external
        returns (ExecutionResult memory)
    {
        // Re-enter — should revert via ReentrancyGuard, bubbling up to the original call.
        router.execute(req);
        return ExecutionResult({amountOut: 0, executionId: bytes32(0)});
    }
}
