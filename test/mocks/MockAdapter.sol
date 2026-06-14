// SPDX-License-Identifier: GPL-3.0
pragma solidity 0.8.17;

import {IExecutionAdapter} from "../../src/interfaces/execution/IExecutionAdapter.sol";
import {ExecutionRequest, ExecutionResult} from "../../src/types/ExecutionTypes.sol";
import {ComplianceDecision} from "../../src/types/ComplianceTypes.sol";

/// @notice Test double adapter. Records the call and returns a settable amountOut.
contract MockAdapter is IExecutionAdapter {
    uint256 public amountOut = 1000;
    bool public called;
    uint256 public callCount;
    bytes32 public lastReasonCode; // captured from decision to prove decision is forwarded

    function setAmountOut(uint256 a) external {
        amountOut = a;
    }

    function execute(ExecutionRequest calldata req, ComplianceDecision calldata decision)
        external
        virtual
        returns (ExecutionResult memory)
    {
        called = true;
        callCount++;
        lastReasonCode = decision.reasonCode;
        return ExecutionResult({amountOut: amountOut, executionId: keccak256(abi.encode(req, block.number))});
    }
}
