// SPDX-License-Identifier: GPL-3.0
pragma solidity 0.8.17;

import {ExecutionRequest, ExecutionResult} from "../../types/ExecutionTypes.sol";
import {ComplianceDecision} from "../../types/ComplianceTypes.sol";

interface IExecutionAdapter {
    function execute(ExecutionRequest calldata req, ComplianceDecision calldata decision)
        external
        returns (ExecutionResult memory);
}
