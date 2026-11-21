// SPDX-License-Identifier: GPL-3.0
pragma solidity 0.8.17;

import {ExecutionRouterV2} from "./ExecutionRouterV2.sol";
import {IExternalSettlementTarget} from "../interfaces/execution/IExternalSettlementTarget.sol";
import {IVenueRegistry} from "../interfaces/execution/IVenueRegistry.sol";
import {IVenueSelector} from "../interfaces/execution/IVenueSelector.sol";
import {IComplianceEngine} from "../interfaces/compliance/IComplianceEngine.sol";
import {IOperatorRegistry} from "../interfaces/compliance/IOperatorRegistry.sol";
import {ExecutionRequest, ExecutionResult} from "../types/ExecutionTypes.sol";
import {ComplianceDecision} from "../types/ComplianceTypes.sol";
import {VenueConfig} from "../types/VenueTypes.sol";
import {Errors} from "../libraries/Errors.sol";

/// @notice Compliance settlement gate for an existing external venue target.
/// @dev The inherited lifecycle remains authoritative. Only dispatch differs from
/// the reference Router: the reviewed target need not implement IExecutionAdapter.
contract ExternalSettlementGate is ExecutionRouterV2 {
    constructor(
        IComplianceEngine _engine,
        IVenueRegistry _venueReg,
        IVenueSelector _selector,
        IOperatorRegistry _operatorReg
    ) ExecutionRouterV2(_engine, _venueReg, _selector, _operatorReg) {}

    function _beforeEvaluate(ExecutionRequest calldata req) internal view override {
        _externalTarget(_resolveVenue(req));
        super._beforeEvaluate(req);
    }

    function _executeVenue(ExecutionRequest calldata req, ComplianceDecision memory, VenueConfig memory cfg)
        internal
        override
        returns (ExecutionResult memory)
    {
        return _externalTarget(cfg).settle(req);
    }

    function _externalTarget(VenueConfig memory cfg) private view returns (IExternalSettlementTarget target) {
        if (cfg.adapter == address(0) || cfg.adapter != cfg.target) revert Errors.InvalidContextEvidence();
        target = IExternalSettlementTarget(cfg.target);
        if (!target.gateEnforced()) revert Errors.InvalidContextEvidence();
    }
}
