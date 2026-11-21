// SPDX-License-Identifier: GPL-3.0
pragma solidity 0.8.17;

import {IExecutionContextVerifier} from "./IExecutionContextVerifier.sol";
import {ExecutionRequest, ExecutionResult} from "../../types/ExecutionTypes.sol";

/// @notice Settlement boundary for an existing ATS/OMS integration.
/// @dev This is deliberately not IExecutionAdapter. A production implementation
/// must enforce that only its configured ExternalSettlementGate may settle.
interface IExternalSettlementTarget is IExecutionContextVerifier {
    function gateEnforced() external view returns (bool);

    function settle(ExecutionRequest calldata req) external returns (ExecutionResult memory);
}
