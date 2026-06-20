// SPDX-License-Identifier: GPL-3.0
pragma solidity 0.8.17;

import {IOrderBookAdapter} from "../../../interfaces/execution/adapters/IOrderBookAdapter.sol";
import {ExecutionRequest, ExecutionResult} from "../../../types/ExecutionTypes.sol";
import {ComplianceDecision} from "../../../types/ComplianceTypes.sol";

/// @title OrderBookAdapter
/// @notice Stub. Order-book execution is not implemented in the skeleton.
contract OrderBookAdapter is IOrderBookAdapter {
    function execute(ExecutionRequest calldata, ComplianceDecision calldata)
        external
        pure
        returns (ExecutionResult memory)
    {
        revert("OrderBook: not implemented");
    }
}
