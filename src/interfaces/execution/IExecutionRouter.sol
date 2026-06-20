// SPDX-License-Identifier: GPL-3.0
pragma solidity 0.8.17;

import {ExecutionRequest, ExecutionResult} from "../../types/ExecutionTypes.sol";

interface IExecutionRouter {
    function execute(ExecutionRequest calldata req) external returns (ExecutionResult memory);
}
