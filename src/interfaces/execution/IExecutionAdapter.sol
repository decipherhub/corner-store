// SPDX-License-Identifier: GPL-3.0
pragma solidity 0.8.17;

import {ExecutionRequest, ExecutionResult} from "../../types/ExecutionTypes.sol";
import {ComplianceDecision} from "../../types/ComplianceTypes.sol";

interface IExecutionAdapter {
    /// @dev Security invariant: production adapters/settlement contracts MUST
    /// only accept calls from ExecutionRouter or an equivalent authorized
    /// dispatcher. Direct end-user calls bypass ComplianceEngine.evaluate(),
    /// router nonce/venue checks, and ComplianceEngine.commit().
    function execute(ExecutionRequest calldata req, ComplianceDecision calldata decision)
        external
        returns (ExecutionResult memory);
}
