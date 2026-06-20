// SPDX-License-Identifier: GPL-3.0
pragma solidity 0.8.17;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {Errors} from "../libraries/Errors.sol";

// owner = governance/admin. operators = state-input writers (write-gate).
abstract contract Governed is Ownable {
    mapping(address => bool) public isOperator;

    event OperatorSet(address indexed operator, bool enabled);

    modifier onlyOperator() {
        if (!isOperator[msg.sender] && msg.sender != owner()) revert Errors.NotAuthorized();
        _;
    }

    function setOperator(address op, bool enabled) external onlyOwner {
        isOperator[op] = enabled;
        emit OperatorSet(op, enabled);
    }
}
