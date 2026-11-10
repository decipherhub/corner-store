// SPDX-License-Identifier: GPL-3.0
pragma solidity 0.8.17;

import {ExecutionRouterBase} from "./ExecutionRouterBase.sol";
import {IVenueRegistry} from "../interfaces/execution/IVenueRegistry.sol";
import {IVenueSelector} from "../interfaces/execution/IVenueSelector.sol";
import {IComplianceEngine} from "../interfaces/compliance/IComplianceEngine.sol";
import {IOperatorRegistry} from "../interfaces/compliance/IOperatorRegistry.sol";

/// @title ExecutionRouter
/// @notice Legacy execution entry point with fresh evaluation and exact settlement.
contract ExecutionRouter is ExecutionRouterBase {
    constructor(
        IComplianceEngine _engine,
        IVenueRegistry _venueReg,
        IVenueSelector _selector,
        IOperatorRegistry _operatorReg
    ) ExecutionRouterBase(_engine, _venueReg, _selector, _operatorReg) {}
}
