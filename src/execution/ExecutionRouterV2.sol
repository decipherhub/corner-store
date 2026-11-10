// SPDX-License-Identifier: GPL-3.0
pragma solidity 0.8.17;

import {ExecutionRouterBase} from "./ExecutionRouterBase.sol";
import {ContextEvidence} from "./ContextEvidence.sol";
import {IExecutionContextVerifier} from "../interfaces/execution/IExecutionContextVerifier.sol";
import {IVenueRegistry} from "../interfaces/execution/IVenueRegistry.sol";
import {IVenueSelector} from "../interfaces/execution/IVenueSelector.sol";
import {IComplianceEngine} from "../interfaces/compliance/IComplianceEngine.sol";
import {ITokenPolicyRegistry} from "../interfaces/compliance/ITokenPolicyRegistry.sol";
import {IOperatorRegistry} from "../interfaces/compliance/IOperatorRegistry.sol";
import {ExecutionRequest} from "../types/ExecutionTypes.sol";
import {VenueConfig, VenueContextEvidence} from "../types/VenueTypes.sol";
import {Errors} from "../libraries/Errors.sol";

interface IContextEngineRegistry {
    function policyReg() external view returns (ITokenPolicyRegistry);
}

/// @notice Versioned Router requiring venue authentication before policy evaluation.
contract ExecutionRouterV2 is ExecutionRouterBase {
    ITokenPolicyRegistry public immutable policyReg;

    constructor(
        IComplianceEngine _engine,
        IVenueRegistry _venueReg,
        IVenueSelector _selector,
        IOperatorRegistry _operatorReg
    ) ExecutionRouterBase(_engine, _venueReg, _selector, _operatorReg) {
        policyReg = IContextEngineRegistry(address(_engine)).policyReg();
        if (address(policyReg).code.length == 0) revert Errors.InvalidContextEvidence();
    }

    function _beforeEvaluate(ExecutionRequest calldata req) internal view override {
        VenueConfig memory cfg = _resolveVenue(req);
        VenueContextEvidence memory evidence = venueReg.contextEvidenceOf(req.context.venue);
        if (evidence.adapterCodeHash == bytes32(0) || evidence.policyRegistry != address(policyReg)) {
            revert Errors.InvalidContextEvidence();
        }
        if (!venueReg.isContextImplementationApproved(
                evidence.adapterCodeHash, evidence.adapterVersion, evidence.contextVersion
            )) revert Errors.ContextImplementationNotApproved();
        ContextEvidence.validateBinding(cfg, evidence);
        IExecutionContextVerifier verifier = IExecutionContextVerifier(cfg.adapter);
        if (verifier.router() != address(this)) revert Errors.InvalidContextEvidence();
        ContextEvidence.affiliateEvidenceHash(req.context, policyReg, evidence.affiliateSource);
        verifier.validateContext(req, cfg);
    }
}
