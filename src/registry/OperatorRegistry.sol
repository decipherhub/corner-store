// SPDX-License-Identifier: GPL-3.0
pragma solidity 0.8.17;

import {Governed} from "../auth/Governed.sol";
import {IOperatorRegistry} from "../interfaces/compliance/IOperatorRegistry.sol";
import {Events} from "../libraries/Events.sol";

contract OperatorRegistry is IOperatorRegistry, Governed {
    mapping(address => bool) internal _suspended;

    function setVenueSuspended(address venue, bool suspended, bytes32 reasonCode) external onlyOperator {
        _suspended[venue] = suspended;
        if (suspended) emit Events.VenueSuspended(venue, reasonCode);
    }

    function isVenueSuspended(address venue) external view returns (bool) {
        return _suspended[venue];
    }
}
