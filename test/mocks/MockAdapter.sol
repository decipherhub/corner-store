// SPDX-License-Identifier: GPL-3.0
pragma solidity 0.8.17;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {IExecutionAdapter} from "../../src/interfaces/execution/IExecutionAdapter.sol";
import {ExecutionRequest, ExecutionResult} from "../../src/types/ExecutionTypes.sol";
import {ComplianceDecision} from "../../src/types/ComplianceTypes.sol";

/// @notice Test double adapter. Records the call and returns a settable amountOut.
contract MockAdapter is IExecutionAdapter {
    using SafeERC20 for IERC20;

    uint256 public amountIn;
    uint256 public amountOut = 1000;
    uint256 public reportedAmountOut;
    bool public amountInOverridden;
    bool public amountOutOverridden;
    bool public reportedAmountOutOverridden;
    bool public called;
    uint256 public callCount;
    bytes32 public lastReasonCode; // captured from decision to prove decision is forwarded

    function setAmountIn(uint256 a) external {
        amountIn = a;
        amountInOverridden = true;
    }

    function setAmountOut(uint256 a) external {
        amountOut = a;
        amountOutOverridden = true;
    }

    function setReportedAmountOut(uint256 a) external {
        reportedAmountOut = a;
        reportedAmountOutOverridden = true;
    }

    function execute(ExecutionRequest calldata req, ComplianceDecision calldata decision)
        external
        virtual
        returns (ExecutionResult memory)
    {
        called = true;
        callCount++;
        lastReasonCode = decision.reasonCode;
        uint256 settledAmountIn = amountInOverridden ? amountIn : req.context.amountIn;
        uint256 settledAmountOut = amountOutOverridden ? amountOut : req.context.amountOut;
        IERC20(req.context.tokenIn).safeTransferFrom(req.context.buyer, address(this), settledAmountIn);
        IERC20(req.context.tokenOut).safeTransfer(req.context.buyer, settledAmountOut);

        uint256 resultAmountOut = reportedAmountOutOverridden ? reportedAmountOut : settledAmountOut;
        return ExecutionResult({amountOut: resultAmountOut, executionId: keccak256(abi.encode(req, block.number))});
    }
}
