// SPDX-License-Identifier: GPL-3.0
pragma solidity 0.8.17;

import {IRFQAdapter} from "../../../interfaces/execution/adapters/IRFQAdapter.sol";
import {ExecutionRequest, ExecutionResult} from "../../../types/ExecutionTypes.sol";
import {ComplianceDecision} from "../../../types/ComplianceTypes.sol";

/// @title RFQAdapter
/// @notice Stub. RFQ execution is not implemented in the skeleton.
contract RFQAdapter is IRFQAdapter {
    function execute(ExecutionRequest calldata, ComplianceDecision calldata)
        external
        pure
        returns (ExecutionResult memory)
    {
        revert("RFQ: not implemented");
    }
}
