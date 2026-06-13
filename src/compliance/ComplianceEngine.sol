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
    // Regulated-token selection rule (two-sided, documented, deterministic):
    // We read BOTH sides' status and decide the pair outcome fail-closed:
    //   * EITHER side SUSPENDED → reject.
    //   * EITHER side UNKNOWN (unregistered) → reject; quote/cash tokens must be
    //     EXPLICITLY registered UNREGULATED, we never infer an absent manifest.
    //   * BOTH UNREGULATED → pass through (fast path).
    //   * At least one ACTIVE → the regulated token is the ACTIVE side. Prefer
    //     tokenOut when it is ACTIVE, else tokenIn; that side's manifest/recipes
    //     are evaluated against the full context.
    // This selection is inlined in `evaluate` (see below); status reads are done
    // once there for both sides.
    // ---------------------------------------------------------------------
    function evaluate(ComplianceContext calldata ctx) external view override returns (ComplianceDecision memory) {
        PolicyStatus statusIn = policyReg.statusOf(ctx.tokenIn);
        PolicyStatus statusOut = policyReg.statusOf(ctx.tokenOut);

        // (1) EITHER side SUSPENDED → fail-closed.
        if (statusIn == PolicyStatus.SUSPENDED || statusOut == PolicyStatus.SUSPENDED) {
            return _rejectPolicy(ctx, PolicyStatus.SUSPENDED);
        }
        // (2) EITHER side UNKNOWN (unregistered) → fail-closed. We never infer
        //     UNREGULATED from an absent manifest.
        if (statusIn == PolicyStatus.UNKNOWN || statusOut == PolicyStatus.UNKNOWN) {
            return _rejectPolicy(ctx, PolicyStatus.UNKNOWN);
        }
        // (3) Both sides ∈ {UNREGULATED, ACTIVE}.
        //     Both UNREGULATED → fast path pass-through.
        if (statusOut == PolicyStatus.UNREGULATED && statusIn == PolicyStatus.UNREGULATED) {
            return _passThrough(ctx);
        }
        //     At least one ACTIVE → the ACTIVE side is the regulated token,
        //     preferring tokenOut when it is ACTIVE.
        address token = statusOut == PolicyStatus.ACTIVE ? ctx.tokenOut : ctx.tokenIn;

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
        // policyId derivation is a SKELETON PLACEHOLDER: it currently encodes only
        // issuanceRecipeId and is therefore LOSSY — it ignores fundRecipeId (and
        // recipe versions / factsPacked). Two manifests sharing an issuance recipe
        // but differing in fund recipe collapse to the same policyId. A real
        // implementation must derive policyId from the full applicable policy set.
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
    ///      NOTE: the hash binds INPUTS ONLY — the context plus the decision's
    ///      parameters (maxAmount, allowedVenueTypes, allowedVenuesHash,
    ///      policyVersion, validUntil). It deliberately does NOT cover the
    ///      outcome (allowed / reasonCode). It is a context-replay guard, not an
    ///      attestation of the verdict: the same inputs must hash the same way
    ///      regardless of whether the trade was allowed or rejected.
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
        // Mirror evaluate's two-sided selection: a STATEFUL post-trade hook runs
        // only when there is an ACTIVE regulated side (prefer tokenOut). Any
        // SUSPENDED/UNKNOWN side or both-UNREGULATED → nothing to commit.
        PolicyStatus statusIn = policyReg.statusOf(ctx.tokenIn);
        PolicyStatus statusOut = policyReg.statusOf(ctx.tokenOut);
        address token;
        if (statusOut == PolicyStatus.ACTIVE) {
            token = ctx.tokenOut;
        } else if (statusIn == PolicyStatus.ACTIVE) {
            token = ctx.tokenIn;
        } else {
            return;
        }

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
    ///      FAIL-CLOSED INVARIANT: if the union of required elements ever exceeds
    ///      this cap, `elementIds[count] = ...` in `_applicableElements` reverts
    ///      with an array out-of-bounds panic. That is intentional — it never
    ///      silently drops a required check. A future maintainer MUST NOT add a
    ///      `count < cap` guard around the write: truncating the element set
    ///      would let a trade skip a required compliance check (fail-open).
    function _maxElements(ManifestCore memory) private pure returns (uint256) {
        return 32;
    }
}
