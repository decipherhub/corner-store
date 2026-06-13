// SPDX-License-Identifier: GPL-3.0
pragma solidity 0.8.17;

import {Events} from "../libraries/Events.sol";

/// @title ExecutionLogger
/// @notice Append-only audit emitter for trade-execution outcomes. Holds NO
/// state; every call emits a canonical `Events` audit event. Not yet wired into
/// the router (Task E may wire it or assert it emits).
contract ExecutionLogger {
    /// @notice Emit the result of a settled execution against a venue.
    function logExecution(bytes32 executionId, address venue, uint256 amountOut) external {
        emit Events.Executed(executionId, venue, amountOut);
    }
}
