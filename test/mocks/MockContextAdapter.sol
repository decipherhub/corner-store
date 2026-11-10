// SPDX-License-Identifier: GPL-3.0
pragma solidity 0.8.17;

import {MockAdapter} from "./MockAdapter.sol";
import {IExecutionContextVerifier} from "../../src/interfaces/execution/IExecutionContextVerifier.sol";
import {ExecutionRequest} from "../../src/types/ExecutionTypes.sol";
import {VenueConfig} from "../../src/types/VenueTypes.sol";
import {Errors} from "../../src/libraries/Errors.sol";

contract MockContextAdapter is MockAdapter, IExecutionContextVerifier {
    uint16 public constant adapterVersion = 3;
    uint16 public constant contextVersion = 1;
    address public router;
    bytes32 public configuration;
    bool public rejectContext;

    function setRouter(address value) external {
        router = value;
    }

    function setConfiguration(bytes32 value) external {
        configuration = value;
    }

    function setRejectContext(bool value) external {
        rejectContext = value;
    }

    function contextConfigHash() external view returns (bytes32) {
        return keccak256(abi.encode(router, configuration));
    }

    function validateContext(ExecutionRequest calldata, VenueConfig calldata) external view {
        if (rejectContext) revert Errors.InvalidExecutionContext();
    }
}
