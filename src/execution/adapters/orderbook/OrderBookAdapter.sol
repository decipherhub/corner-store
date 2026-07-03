// SPDX-License-Identifier: GPL-3.0
pragma solidity 0.8.17;

import {IOrderBookAdapter} from "../../../interfaces/execution/adapters/IOrderBookAdapter.sol";
import {ExecutionRequest, ExecutionResult} from "../../../types/ExecutionTypes.sol";
import {ComplianceDecision} from "../../../types/ComplianceTypes.sol";
import {Errors} from "../../../libraries/Errors.sol";
import {Governed} from "../../../auth/Governed.sol";

/// @title OrderBookAdapter
/// @notice Stub. Order-book execution is not implemented in the skeleton.
/// @dev Even as a stub, order-book settlement keeps the production security
///      invariant: fills may only be entered through the router, never directly
///      by maker/taker.
contract OrderBookAdapter is IOrderBookAdapter, Governed {
    address public router;

    event RouterSet(address indexed router);

    modifier onlyRouter() {
        if (msg.sender != router) revert Errors.NotAuthorized();
        _;
    }

    function setRouter(address router_) external onlyOwner {
        router = router_;
        emit RouterSet(router_);
    }

    function execute(ExecutionRequest calldata, ComplianceDecision calldata)
        external
        view
        onlyRouter
        returns (ExecutionResult memory)
    {
        revert("OrderBook: not implemented");
    }
}
