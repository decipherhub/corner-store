// SPDX-License-Identifier: GPL-3.0
pragma solidity 0.8.17;

import {IRFQAdapter} from "../../../interfaces/execution/adapters/IRFQAdapter.sol";
import {ExecutionRequest, ExecutionResult} from "../../../types/ExecutionTypes.sol";
import {ComplianceDecision} from "../../../types/ComplianceTypes.sol";
import {Errors} from "../../../libraries/Errors.sol";
import {Governed} from "../../../auth/Governed.sol";

/// @title RFQAdapter
/// @notice Stub. RFQ execution is not implemented in the skeleton.
/// @dev Even as a stub, RFQ keeps the production security invariant: settlement
///      may only be entered through the router, never directly by maker/taker.
contract RFQAdapter is IRFQAdapter, Governed {
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
        revert("RFQ: not implemented");
    }
}
