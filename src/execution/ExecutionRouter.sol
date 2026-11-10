// SPDX-License-Identifier: GPL-3.0
pragma solidity 0.8.17;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import {Governed} from "../auth/Governed.sol";
import {IExecutionRouter} from "../interfaces/execution/IExecutionRouter.sol";
import {IExecutionAdapter} from "../interfaces/execution/IExecutionAdapter.sol";
import {IVenueRegistry} from "../interfaces/execution/IVenueRegistry.sol";
import {IVenueSelector} from "../interfaces/execution/IVenueSelector.sol";
import {IComplianceEngine} from "../interfaces/compliance/IComplianceEngine.sol";
import {IOperatorRegistry} from "../interfaces/compliance/IOperatorRegistry.sol";
import {ExecutionRequest, ExecutionResult} from "../types/ExecutionTypes.sol";
import {ComplianceContext, ComplianceDecision} from "../types/ComplianceTypes.sol";
import {VenueConfig} from "../types/VenueTypes.sol";
import {Errors} from "../libraries/Errors.sol";
import {Events} from "../libraries/Events.sol";

/// @title ExecutionRouter
/// @notice Single entry point for trade execution. Orchestrates the gate sequence
/// (deadline -> nonce -> compliance -> amount bound -> venue suspension -> venue policy
/// binding -> venue type binding -> adapter dispatch -> post-trade commit) and delegates the actual swap to
/// the venue's registered adapter. Non-custodial: the router never holds tokens.
contract ExecutionRouter is IExecutionRouter, Governed, ReentrancyGuard {
    IComplianceEngine public immutable engine;
    IVenueRegistry public immutable venueReg;
    IVenueSelector public immutable selector;
    IOperatorRegistry public immutable operatorReg;

    /// @dev replay protection scoped per authenticated initiator/caller.
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

        // 2. caller/request binding + nonce replay protection. The router is
        //    the only public execution entry point, so the caller must be the
        //    request initiator that compliance and the decision hash bind.
        if (req.context.initiator == address(0) || msg.sender != req.context.initiator) {
            revert Errors.NotAuthorized();
        }

        // 2a. central production pause gates. These run before nonce consumption
        //     so a closed control plane does not burn user replay slots.
        if (operatorReg.isGlobalPaused()) revert Errors.GlobalPaused();
        if (operatorReg.isAssetSuspended(req.context.tokenIn)) revert Errors.TokenInPaused();
        if (operatorReg.isAssetSuspended(req.context.tokenOut)) revert Errors.TokenOutPaused();
        if (operatorReg.isVenueSuspended(req.context.venue)) revert Errors.VenueSuspended();

        // 2b. nonce replay protection (per authenticated initiator/caller)
        if (usedNonce[msg.sender][req.nonce]) revert Errors.NonceUsed();
        usedNonce[msg.sender][req.nonce] = true;

        // 3. compliance evaluation. The router evaluates FRESH on every execute
        //    and never stores or verifies a prior decision, so a decision cannot be
        //    replayed — REUSE IS STRUCTURALLY IMPOSSIBLE. The live replay guard is
        //    the `usedNonce` gate above; d.decisionHash (and
        //    Errors.DecisionMismatch/DecisionExpired) are a forward-looking seam for
        //    a future flow where a signed/pre-computed decision is passed in and
        //    verified here, not the current replay defense.
        ComplianceDecision memory d = engine.evaluate(req.context);
        emit Events.ComplianceEvaluated(d.decisionHash, d.allowed, d.reasonCode);
        if (d.flagsBitmap != 0) emit Events.ComplianceFlags(d.decisionHash, d.flagsBitmap);
        if (!d.allowed) revert Errors.ComplianceRejected(d.reasonCode);

        // 4. finite amount bound. The decision explicitly binds the cap to the
        //    regulated token so buy (tokenOut) and sell (tokenIn) use the same
        //    policy meaning. Unlimited decisions do not require an axis.
        if (d.maxAmount != type(uint256).max) {
            uint256 regulatedAmount;
            if (d.maxAmountToken == req.context.tokenIn) {
                regulatedAmount = req.context.amountIn;
            } else if (d.maxAmountToken == req.context.tokenOut) {
                regulatedAmount = req.context.amountOut;
            } else {
                revert Errors.InvalidAmountCapToken();
            }
            if (regulatedAmount > d.maxAmount) revert Errors.MaxAmountExceeded();
        }

        // 5. venue policy binding (type mask + venues-hash)
        if (!selector.validate(req.context.venue, req.context.venueType, d)) revert Errors.VenueNotAllowed();

        // 6. resolve adapter
        VenueConfig memory cfg = venueReg.venueOf(req.context.venue);
        if (!cfg.active || cfg.adapter == address(0)) revert Errors.AdapterNotRegistered();

        // 6a. bind the caller-supplied venue type to the registry's stored config.
        //     Step 6 validated req.context.venueType against the decision's type mask;
        //     without this check a caller could misreport venueType and route a venue
        //     of a disallowed type through an allowed-type bit.
        if (cfg.venueType != req.context.venueType) revert Errors.VenueTypeMismatch();

        // 7. Snapshot the authenticated payer/recipient's balances, then dispatch
        //    to the adapter. Adapters remain authorized settlement components, but
        //    their reported amount is not accepted as the accounting source of truth.
        uint256 tokenInBefore = IERC20(req.context.tokenIn).balanceOf(req.context.buyer);
        uint256 tokenOutBefore = IERC20(req.context.tokenOut).balanceOf(req.context.buyer);
        ExecutionResult memory r = IExecutionAdapter(cfg.adapter).execute(req, d);

        // 7a. Measure the actual settlement at the payer/recipient boundary. The
        //     current execution contract supports exact full fills of standard,
        //     non-rebasing ERC-20 tokens only. Token onboarding must prohibit
        //     transfer-fee/rebasing assets; payer/recipient deltas alone cannot
        //     prove every intermediate settlement balance. AMM price movement away
        //     from the pre-authorized quantities is rejected until a separately
        //     versioned preview/settlement-aware compliance contract is introduced.
        uint256 tokenInAfter = IERC20(req.context.tokenIn).balanceOf(req.context.buyer);
        uint256 tokenOutAfter = IERC20(req.context.tokenOut).balanceOf(req.context.buyer);
        if (tokenInAfter > tokenInBefore || tokenOutAfter < tokenOutBefore) {
            revert Errors.SettlementAmountMismatch();
        }

        uint256 realizedAmountIn = tokenInBefore - tokenInAfter;
        uint256 realizedAmountOut = tokenOutAfter - tokenOutBefore;
        if (
            realizedAmountIn != req.context.amountIn || realizedAmountOut != req.context.amountOut
                || r.amountOut != realizedAmountOut
        ) {
            revert Errors.SettlementAmountMismatch();
        }

        // 7b. slippage bound — the independently measured output must meet the
        //     caller's minimum.
        if (realizedAmountOut < req.amountOutMin) revert Errors.SlippageExceeded();

        // 8. Post-trade commit uses the same measured quantities that were bound
        //    by the pre-trade compliance decision.
        ComplianceContext memory settledContext = req.context;
        settledContext.amountIn = realizedAmountIn;
        settledContext.amountOut = realizedAmountOut;
        engine.commit(settledContext);

        // 9. emit + return
        emit Events.Executed(r.executionId, req.context.venue, r.amountOut);
        return r;
    }
}
