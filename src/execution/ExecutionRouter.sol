// SPDX-License-Identifier: GPL-3.0
pragma solidity 0.8.17;

import {ReentrancyGuard} from "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import {Governed} from "../auth/Governed.sol";
import {IExecutionRouter} from "../interfaces/execution/IExecutionRouter.sol";
import {IExecutionAdapter} from "../interfaces/execution/IExecutionAdapter.sol";
import {IVenueRegistry} from "../interfaces/execution/IVenueRegistry.sol";
import {IVenueSelector} from "../interfaces/execution/IVenueSelector.sol";
import {IComplianceEngine} from "../interfaces/compliance/IComplianceEngine.sol";
import {IOperatorRegistry} from "../interfaces/compliance/IOperatorRegistry.sol";
import {ExecutionRequest, ExecutionResult} from "../types/ExecutionTypes.sol";
import {ComplianceDecision} from "../types/ComplianceTypes.sol";
import {VenueConfig} from "../types/VenueTypes.sol";
import {Errors} from "../libraries/Errors.sol";
import {Events} from "../libraries/Events.sol";

/// @title ExecutionRouter
/// @notice Single entry point for trade execution. Orchestrates the gate sequence
/// (deadline -> nonce -> compliance -> amount bound -> venue suspension -> venue policy
/// binding -> adapter dispatch -> post-trade commit) and delegates the actual swap to
/// the venue's registered adapter. Non-custodial: the router never holds tokens.
contract ExecutionRouter is IExecutionRouter, Governed, ReentrancyGuard {
    IComplianceEngine public immutable engine;
    IVenueRegistry public immutable venueReg;
    IVenueSelector public immutable selector;
    IOperatorRegistry public immutable operatorReg;

    /// @dev replay protection scoped per caller.
    mapping(address => mapping(uint256 => bool)) public usedNonce;

    constructor(
        IComplianceEngine _engine,
        IVenueRegistry _venueReg,
        IVenueSelector _selector,
        IOperatorRegistry _operatorReg
    ) {
        engine = _engine;
        venueReg = _venueReg;
        selector = _selector;
        operatorReg = _operatorReg;
    }

    function execute(ExecutionRequest calldata req) external nonReentrant returns (ExecutionResult memory) {
        // 1. deadline
        if (block.timestamp > req.deadline) revert Errors.DeadlineExpired();

        // 2. nonce replay protection (per caller)
        if (usedNonce[msg.sender][req.nonce]) revert Errors.NonceUsed();
        usedNonce[msg.sender][req.nonce] = true;

        // 3. compliance evaluation
        ComplianceDecision memory d = engine.evaluate(req.context);
        if (!d.allowed) revert Errors.ComplianceRejected(d.reasonCode);

        // 4. amount bound — the decision constrains the input notional (RWA-side amountIn).
        if (req.context.amountIn > d.maxAmount) revert Errors.MaxAmountExceeded();

        // 5. operator venue-suspension kill switch
        if (operatorReg.isVenueSuspended(req.context.venue)) revert Errors.VenueSuspended();

        // 6. venue policy binding (type mask + venues-hash)
        if (!selector.validate(req.context.venue, req.context.venueType, d)) revert Errors.VenueNotAllowed();

        // 7. resolve adapter
        VenueConfig memory cfg = venueReg.venueOf(req.context.venue);
        if (!cfg.active || cfg.adapter == address(0)) revert Errors.AdapterNotRegistered();

        // 8. dispatch to adapter (performs the swap; non-custodial)
        ExecutionResult memory r = IExecutionAdapter(cfg.adapter).execute(req, d);

        // 8a. slippage bound — the realized output must meet the caller's minimum.
        if (r.amountOut < req.amountOutMin) revert Errors.SlippageExceeded();

        // 9. post-trade commit hook (stateful element updates)
        engine.commit(req.context);

        // 10. emit + return
        emit Events.Executed(r.executionId, req.context.venue, r.amountOut);
        return r;
    }
}
