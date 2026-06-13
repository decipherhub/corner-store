// SPDX-License-Identifier: GPL-3.0
pragma solidity 0.8.17;

import {IComplianceEngine} from "../interfaces/compliance/IComplianceEngine.sol";
import {ITokenPolicyRegistry} from "../interfaces/compliance/ITokenPolicyRegistry.sol";
import {IElementRegistry} from "../interfaces/compliance/IElementRegistry.sol";
import {IRecipeRegistry} from "../interfaces/compliance/IRecipeRegistry.sol";
import {IRecipe} from "../interfaces/compliance/IRecipe.sol";
import {IComplianceElement, IStatefulElement} from "../interfaces/compliance/IComplianceElement.sol";
import {
    ComplianceContext,
    ComplianceDecision,
    ManifestCore,
    PolicyStatus,
    ElementMetadata,
    Statefulness
} from "../types/ComplianceTypes.sol";
import {DecisionHashLib} from "../libraries/DecisionHashLib.sol";
import {ReasonCodes} from "../libraries/ReasonCodes.sol";
import {Errors} from "../libraries/Errors.sol";

/// @dev Multi-recipe cumulative-AND compliance engine. Resolves the regulated
///      token from a context, collects applicable recipes, unions their required
///      elements, and ANDs every element's check. Fail-closed on UNKNOWN/SUSPENDED.
contract ComplianceEngine is IComplianceEngine {
    ITokenPolicyRegistry public immutable policyReg;
    IElementRegistry public immutable elementReg;
    IRecipeRegistry public immutable recipeReg;

    constructor(ITokenPolicyRegistry policyReg_, IElementRegistry elementReg_, IRecipeRegistry recipeReg_) {
        policyReg = policyReg_;
        elementReg = elementReg_;
        recipeReg = recipeReg_;
    }

    // ---------------------------------------------------------------------
    // Regulated-token identification rule (documented, deterministic):
    // The RWA token is whichever side has a non-UNKNOWN manifest. We check
    // tokenOut first, then tokenIn; the first with statusOf != UNKNOWN is the
    // regulated asset. If neither is registered (both UNKNOWN) we treat the
    // trade as involving no regulated token (handled by status branch below).
    // ---------------------------------------------------------------------
    function _regulatedToken(ComplianceContext calldata ctx)
        internal
        view
        returns (address token, PolicyStatus status)
    {
        PolicyStatus outStatus = policyReg.statusOf(ctx.tokenOut);
        if (outStatus != PolicyStatus.UNKNOWN) {
            return (ctx.tokenOut, outStatus);
        }
        PolicyStatus inStatus = policyReg.statusOf(ctx.tokenIn);
        if (inStatus != PolicyStatus.UNKNOWN) {
            return (ctx.tokenIn, inStatus);
        }
        return (address(0), PolicyStatus.UNKNOWN);
    }

    function evaluate(ComplianceContext calldata ctx) external view override returns (ComplianceDecision memory) {
        (address token, PolicyStatus status) = _regulatedToken(ctx);

        // Both sides unregistered (UNKNOWN). Pass through ONLY if both are
        // explicitly UNREGULATED; otherwise fail-closed below.
        if (token == address(0)) {
            bool bothUnregulated = policyReg.statusOf(ctx.tokenOut) == PolicyStatus.UNREGULATED
                && policyReg.statusOf(ctx.tokenIn) == PolicyStatus.UNREGULATED;
            if (bothUnregulated) {
                return _passThrough(ctx);
            }
            // UNKNOWN on both → fail-closed.
            return _rejectPolicy(ctx, status);
        }

        if (status == PolicyStatus.UNREGULATED) {
            return _passThrough(ctx);
        }
        if (status != PolicyStatus.ACTIVE) {
            // UNKNOWN / SUSPENDED → fail-closed.
            return _rejectPolicy(ctx, status);
        }

        // ACTIVE: evaluate recipes.
        ManifestCore memory m = policyReg.manifestOf(token);
        return _evaluateActive(ctx, token, m);
    }

    function _evaluateActive(ComplianceContext calldata ctx, address token, ManifestCore memory m)
        internal
        view
        returns (ComplianceDecision memory d)
    {
        // Collect applicable element ids (union + dedup) and remember the
        // contributing recipeId per element for reasonCode attribution.
        (bytes32[] memory elementIds, uint16[] memory contributingRecipe, uint256 count) = _applicableElements(ctx, m);

        (bool allowed, bytes32 reasonCode) = _runChecks(ctx, token, elementIds, contributingRecipe, count);

        return _buildDecision(ctx, m, allowed, reasonCode);
    }

    /// @dev Resolve recipes → union/dedup their required elements. coverageScope
    ///      subtraction omitted in skeleton (no bit→elementId map).
    function _applicableElements(ComplianceContext calldata ctx, ManifestCore memory m)
        internal
        view
        returns (bytes32[] memory elementIds, uint16[] memory contributingRecipe, uint256 count)
    {
        bytes memory recipeContext = abi.encode(m.factsPacked, ctx);
        elementIds = new bytes32[](_maxElements(m));
        contributingRecipe = new uint16[](elementIds.length);

        uint16[2] memory candidates = [m.issuanceRecipeId, m.fundRecipeId];
        for (uint256 c = 0; c < candidates.length; c++) {
            uint16 rid = candidates[c];
            if (rid == 0) continue; // fundRecipeId 0 = absent
            address recipeAddr = recipeReg.recipeOf(rid);
            if (recipeAddr == address(0)) continue;
            IRecipe recipe = IRecipe(recipeAddr);
            if (!recipe.isApplicable(recipeContext)) continue;

            bytes32[] memory req = recipe.requiredElements();
            for (uint256 i = 0; i < req.length; i++) {
                if (!_seen(elementIds, count, req[i])) {
                    elementIds[count] = req[i];
                    contributingRecipe[count] = rid;
                    count++;
                }
            }
        }
    }

    /// @dev Cumulative AND across every unique element. First failure stops.
    function _runChecks(
        ComplianceContext calldata ctx,
        address token,
        bytes32[] memory elementIds,
        uint16[] memory contributingRecipe,
        uint256 count
    ) internal view returns (bool allowed, bytes32 reasonCode) {
        // RWA-side amount: amountOut when the regulated token is tokenOut,
        // else amountIn. This is the amount of the regulated asset moving.
        uint256 rwaAmount = token == ctx.tokenOut ? ctx.amountOut : ctx.amountIn;
        bytes memory elementContext = abi.encode(ctx);
        for (uint256 i = 0; i < count; i++) {
            address el = elementReg.elementOf(elementIds[i]);
            if (el == address(0)) revert Errors.ElementNotRegistered(elementIds[i]);
            (bool passed,) = IComplianceElement(el).check(ctx.buyer, ctx.seller, token, rwaAmount, elementContext);
            if (!passed) {
                return (false, ReasonCodes.encode(contributingRecipe[i], elementIds[i], 1));
            }
        }
        return (true, bytes32(0));
    }

    function _buildDecision(ComplianceContext calldata ctx, ManifestCore memory m, bool allowed, bytes32 reasonCode)
        internal
        view
        returns (ComplianceDecision memory d)
    {
        d.allowed = allowed;
        d.policyId = bytes32(uint256(m.issuanceRecipeId));
        d.policyVersion = m.issuanceRecipeVersion;
        d.validUntil = uint64(block.timestamp + 1 days);
        d.maxAmount = type(uint256).max; // skeleton: no quantitative cap
        // Map supported-engine bits → VenueType bits. Skeleton 1:1 mapping:
        // engine bit i corresponds to VenueType bit i (AMM=0, ORDER_BOOK=1, RFQ=2).
        d.allowedVenueTypes = uint256(m.supportedEngines);
        d.allowedVenuesHash = bytes32(0); // 0 = any registered venue (skeleton)
        d.reasonCode = reasonCode;
        d.reliedClaims = bytes32(0); // mock
        d.decisionHash = _hash(ctx, d);
    }

    /// @dev Compute decisionHash from the assembled decision. Isolated to keep
    ///      stack depth low (avoids spilling many locals at the call site).
    function _hash(ComplianceContext calldata ctx, ComplianceDecision memory d) private pure returns (bytes32) {
        return DecisionHashLib.compute(
            ctx, d.maxAmount, d.allowedVenueTypes, d.allowedVenuesHash, d.policyVersion, d.validUntil
        );
    }

    function _passThrough(ComplianceContext calldata ctx) internal view returns (ComplianceDecision memory d) {
        d.allowed = true;
        d.policyId = bytes32(0);
        d.policyVersion = 0;
        d.validUntil = uint64(block.timestamp + 1 days);
        d.maxAmount = type(uint256).max;
        d.allowedVenueTypes = type(uint256).max; // permissive default for unregulated
        d.allowedVenuesHash = bytes32(0);
        d.reasonCode = bytes32(0);
        d.reliedClaims = bytes32(0);
        d.decisionHash = _hash(ctx, d);
    }

    function _rejectPolicy(ComplianceContext calldata ctx, PolicyStatus status)
        internal
        view
        returns (ComplianceDecision memory d)
    {
        d.allowed = false;
        d.reasonCode = ReasonCodes.encode(0, bytes32("POLICY"), uint32(status));
        d.validUntil = uint64(block.timestamp + 1 days);
        d.maxAmount = 0;
        d.allowedVenueTypes = 0;
        d.allowedVenuesHash = bytes32(0);
        d.reliedClaims = bytes32(0);
        d.decisionHash = _hash(ctx, d);
    }

    /// @dev commit: post-trade hook. Recompute applicable element set; for each
    ///      STATEFUL element call onTransfer(seller, buyer, rwaAmount).
    function commit(ComplianceContext calldata ctx) external override {
        (address token, PolicyStatus status) = _regulatedToken(ctx);
        if (token == address(0) || status != PolicyStatus.ACTIVE) return;

        ManifestCore memory m = policyReg.manifestOf(token);
        uint256 rwaAmount = token == ctx.tokenOut ? ctx.amountOut : ctx.amountIn;

        (bytes32[] memory elementIds,, uint256 count) = _applicableElements(ctx, m);

        for (uint256 i = 0; i < count; i++) {
            address el = elementReg.elementOf(elementIds[i]);
            if (el == address(0)) revert Errors.ElementNotRegistered(elementIds[i]);
            if (IComplianceElement(el).elementMetadata().statefulness == Statefulness.STATEFUL) {
                IStatefulElement(el).onTransfer(ctx.seller, ctx.buyer, rwaAmount);
            }
        }
    }

    // ---- helpers ----

    function _seen(bytes32[] memory ids, uint256 count, bytes32 id) private pure returns (bool) {
        for (uint256 i = 0; i < count; i++) {
            if (ids[i] == id) return true;
        }
        return false;
    }

    /// @dev Upper bound on distinct elements: sum of required-element counts of
    ///      all candidate recipes. We don't know counts statically, so use a
    ///      generous fixed cap; dedup keeps the live count correct.
    function _maxElements(ManifestCore memory) private pure returns (uint256) {
        return 32;
    }
}
