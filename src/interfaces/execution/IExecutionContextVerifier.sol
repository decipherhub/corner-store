// SPDX-License-Identifier: GPL-3.0
pragma solidity 0.8.17;

import {ExecutionRequest} from "../../types/ExecutionTypes.sol";
import {VenueConfig} from "../../types/VenueTypes.sol";

interface IExecutionContextVerifier {
    function adapterVersion() external view returns (uint16);

    function contextVersion() external view returns (uint16);

    function router() external view returns (address);

    /// @dev Commits mutable settlement configuration, including Router wiring and
    /// venue authority dependencies. This is not a hash of caller-supplied context.
    function contextConfigHash() external view returns (bytes32);

    /// @dev Authenticate the supplied fields without returning replacement context.
    /// Implementations must repeat validation at settlement and restrict execution
    /// to their configured Router. Version declarations alone do not establish trust.
    function validateContext(ExecutionRequest calldata req, VenueConfig calldata cfg) external view;
}
