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
import {Governed} from "../auth/Governed.sol";

/// @dev Multi-recipe cumulative-AND compliance engine. Resolves the regulated
///      token from a context, collects applicable recipes, unions their required
///      elements, and ANDs every element's check. Fail-closed on UNKNOWN/SUSPENDED.
contract ComplianceEngine is IComplianceEngine, Governed {
    ITokenPolicyRegistry public immutable policyReg;
    IElementRegistry public immutable elementReg;
    IRecipeRegistry public immutable recipeReg;

    /// @dev The sole authorized caller of `commit` (the post-trade write path).
    ///      Set once by the owner after the router is deployed (the router takes
    ///      the engine in its constructor, so the engine cannot know it at
    ///      construction time). Gating `commit` enforces spec §6: runtime counters
    ///      are written only via engine commit driven by the router, never forged
    ///      directly by an operator/EOA.
    address public router;

    /// @dev `commit` mutates stateful elements; only the router may drive it.
    modifier onlyRouter() {
        if (msg.sender != router) revert Errors.NotAuthorized();
        _;
    }

    constructor(ITokenPolicyRegistry policyReg_, IElementRegistry elementReg_, IRecipeRegistry recipeReg_) {
        policyReg = policyReg_;
        elementReg = elementReg_;
        recipeReg = recipeReg_;
    }

    /// @dev One-time/owner-gated router wiring. Concrete-only (not on
    ///      IComplianceEngine): `evaluate`/`commit` signatures are unchanged.
    function setRouter(address r) external onlyOwner {
        router = r;
    }

    // ---------------------------------------------------------------------
    // Regulated-token evaluation rule (two-sided, documented, deterministic):
    // We read BOTH sides' status and decide the pair outcome fail-closed:
    //   * EITHER side SUSPENDED → reject.
    //   * EITHER side UNKNOWN (unregistered) → reject; quote/cash tokens must be
    //     EXPLICITLY registered UNREGULATED, we never infer an absent manifest.
    //   * BOTH UNREGULATED → pass through (fast path).
    //   * At least one ACTIVE → every ACTIVE side's manifest/recipes are
    //     evaluated against the full context. Regulated-regulated pairs combine
    //     both sides rather than choosing one.
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
        return _evaluateActivePair(ctx, statusIn, statusOut);
    }

    function _evaluateActivePair(ComplianceContext calldata ctx, PolicyStatus statusIn, PolicyStatus statusOut)
        internal
        view
        returns (ComplianceDecision memory d)
    {
        ManifestCore memory mIn;
        ManifestCore memory mOut;
        uint256 cap;
        uint256 allowedVenueTypes = type(uint256).max;
        uint64 policyVersion;
        bytes32 policyId;

        if (statusIn == PolicyStatus.ACTIVE) {
            mIn = policyReg.manifestOf(ctx.tokenIn);
            cap += _maxElements(mIn);
            allowedVenueTypes &= uint256(mIn.supportedEngines);
            policyVersion = _max64(policyVersion, mIn.issuanceRecipeVersion);
            policyId = _accumulatePolicyId(policyId, ctx.tokenIn, mIn);
        }
        if (statusOut == PolicyStatus.ACTIVE) {
            mOut = policyReg.manifestOf(ctx.tokenOut);
            cap += _maxElements(mOut);
            allowedVenueTypes &= uint256(mOut.supportedEngines);
            policyVersion = _max64(policyVersion, mOut.issuanceRecipeVersion);
            policyId = _accumulatePolicyId(policyId, ctx.tokenOut, mOut);
        }

        bytes32[] memory elementIds = new bytes32[](cap);
        address[] memory tokens = new address[](cap);
        uint16[] memory contributingRecipe = new uint16[](cap);
        uint256 count;

        if (statusIn == PolicyStatus.ACTIVE) {
            count = _appendApplicableElements(ctx, ctx.tokenIn, mIn, elementIds, tokens, contributingRecipe, count);
        }
        if (statusOut == PolicyStatus.ACTIVE) {
            count = _appendApplicableElements(ctx, ctx.tokenOut, mOut, elementIds, tokens, contributingRecipe, count);
        }

        (bool allowed, bytes32 reasonCode) = _runChecks(ctx, elementIds, tokens, contributingRecipe, count);

        return _buildDecision(ctx, policyId, policyVersion, allowedVenueTypes, allowed, reasonCode);
    }

    /// @dev Resolve recipes → union/dedup their required elements. coverageScope
    ///      subtraction omitted in skeleton (no bit→elementId map).
    function _appendApplicableElements(
        ComplianceContext calldata ctx,
        address token,
        ManifestCore memory m,
        bytes32[] memory elementIds,
        address[] memory tokens,
        uint16[] memory contributingRecipe,
        uint256 count
    ) internal view returns (uint256) {
        bytes memory recipeContext = abi.encode(m.factsPacked, ctx);
        uint16[2] memory candidates = [m.issuanceRecipeId, m.fundRecipeId];
        for (uint256 c = 0; c < candidates.length; c++) {
            uint16 rid = candidates[c];
            if (rid == 0) {
                if (c == 0) revert Errors.RecipeNotRegistered(rid);
                continue; // fundRecipeId 0 = absent
            }
            address recipeAddr = recipeReg.recipeOf(rid);
            if (recipeAddr == address(0)) revert Errors.RecipeNotRegistered(rid);
            IRecipe recipe = IRecipe(recipeAddr);
            if (!recipe.isApplicable(recipeContext)) continue;

            bytes32[] memory req = recipe.requiredElements();
            for (uint256 i = 0; i < req.length; i++) {
                if (!_seenForToken(elementIds, tokens, count, req[i], token)) {
                    elementIds[count] = req[i];
                    tokens[count] = token;
                    contributingRecipe[count] = rid;
                    count++;
                }
            }
        }
        return count;
    }

    /// @dev Cumulative AND across every unique element. First failure stops.
    function _runChecks(
        ComplianceContext calldata ctx,
        bytes32[] memory elementIds,
        address[] memory tokens,
        uint16[] memory contributingRecipe,
        uint256 count
    ) internal view returns (bool allowed, bytes32 reasonCode) {
        bytes memory elementContext = abi.encode(ctx);
        for (uint256 i = 0; i < count; i++) {
            address token = tokens[i];
            // RWA-side amount: amountOut when the regulated token is tokenOut,
            // else amountIn. This is the amount of the regulated asset moving.
            uint256 rwaAmount = token == ctx.tokenOut ? ctx.amountOut : ctx.amountIn;
            address el = elementReg.elementOf(elementIds[i]);
            if (el == address(0)) revert Errors.ElementNotRegistered(elementIds[i]);
            (bool passed,) = IComplianceElement(el).check(ctx.buyer, ctx.seller, token, rwaAmount, elementContext);
            if (!passed) {
                return (false, ReasonCodes.encode(contributingRecipe[i], elementIds[i], 1));
            }
        }
        return (true, bytes32(0));
    }

    function _buildDecision(
        ComplianceContext calldata ctx,
        bytes32 policyId,
        uint64 policyVersion,
        uint256 allowedVenueTypes,
        bool allowed,
        bytes32 reasonCode
    ) internal view returns (ComplianceDecision memory d) {
        d.allowed = allowed;
        // policyId derivation remains a SKELETON PLACEHOLDER, but it now binds
        // every ACTIVE side included in this pair-level decision rather than
        // choosing only one side. A real implementation still needs the full
        // versioned policy-set derivation.
        d.policyId = policyId;
        d.policyVersion = policyVersion;
        d.validUntil = uint64(block.timestamp + 1 days);
        d.maxAmount = type(uint256).max; // skeleton: no quantitative cap
        // Map supported-engine bits → VenueType bits. Skeleton 1:1 mapping:
        // engine bit i corresponds to VenueType bit i (AMM=0, ORDER_BOOK=1, RFQ=2).
        d.allowedVenueTypes = allowedVenueTypes;
        d.allowedVenuesHash = bytes32(0); // 0 = any registered venue (skeleton)
        d.reasonCode = reasonCode;
        d.reliedClaims = bytes32(0); // mock
        // decisionHash is a FORWARD-LOOKING SEAM, not the live replay guard. The
        // router calls engine.evaluate(ctx) fresh on every execute and never
        // stores or verifies a decision, so REUSE IS STRUCTURALLY IMPOSSIBLE; the
        // live replay guard is the per-caller `usedNonce` nonce gate in the
        // router. decisionHash (and Errors.DecisionMismatch/DecisionExpired) exist
        // for a future flow where a signed/pre-computed decision is passed in and
        // verified against a recompute. Kept intentionally; do not remove.
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
    ///      onlyRouter: this is the authenticated runtime-counter write path
    ///      (spec §6). Only the wired router may record post-trade state; an
    ///      EOA/operator cannot forge surveillance counters by calling commit.
    function commit(ComplianceContext calldata ctx) external override onlyRouter {
        // Mirror evaluate's two-sided rule: STATEFUL post-trade hooks run for
        // every ACTIVE regulated side. Any SUSPENDED/UNKNOWN side or
        // both-UNREGULATED → nothing to commit.
        PolicyStatus statusIn = policyReg.statusOf(ctx.tokenIn);
        PolicyStatus statusOut = policyReg.statusOf(ctx.tokenOut);
        if (statusIn == PolicyStatus.SUSPENDED || statusOut == PolicyStatus.SUSPENDED) return;
        if (statusIn == PolicyStatus.UNKNOWN || statusOut == PolicyStatus.UNKNOWN) return;
        if (statusIn != PolicyStatus.ACTIVE && statusOut != PolicyStatus.ACTIVE) {
            return;
        }

        if (statusIn == PolicyStatus.ACTIVE) {
            _commitActiveSide(ctx, ctx.tokenIn, policyReg.manifestOf(ctx.tokenIn));
        }
        if (statusOut == PolicyStatus.ACTIVE) {
            _commitActiveSide(ctx, ctx.tokenOut, policyReg.manifestOf(ctx.tokenOut));
        }
    }

    function _commitActiveSide(ComplianceContext calldata ctx, address token, ManifestCore memory m) internal {
        uint256 rwaAmount = token == ctx.tokenOut ? ctx.amountOut : ctx.amountIn;

        uint256 cap = _maxElements(m);
        bytes32[] memory elementIds = new bytes32[](cap);
        address[] memory tokens = new address[](cap);
        uint16[] memory contributingRecipe = new uint16[](cap);
        uint256 count = _appendApplicableElements(ctx, token, m, elementIds, tokens, contributingRecipe, 0);

        for (uint256 i = 0; i < count; i++) {
            address el = elementReg.elementOf(elementIds[i]);
            if (el == address(0)) revert Errors.ElementNotRegistered(elementIds[i]);
            if (IComplianceElement(el).elementMetadata().statefulness == Statefulness.STATEFUL) {
                IStatefulElement(el).onTransfer(ctx.seller, ctx.buyer, rwaAmount);
            }
        }
    }

    // ---- helpers ----

    function _seenForToken(bytes32[] memory ids, address[] memory tokens, uint256 count, bytes32 id, address token)
        private
        pure
        returns (bool)
    {
        for (uint256 i = 0; i < count; i++) {
            if (ids[i] == id && tokens[i] == token) return true;
        }
        return false;
    }

    function _accumulatePolicyId(bytes32 acc, address token, ManifestCore memory m) private pure returns (bytes32) {
        return keccak256(
            abi.encode(
                acc,
                token,
                m.issuanceRecipeId,
                m.issuanceRecipeVersion,
                m.fundRecipeId,
                m.supportedEngines,
                m.factsPacked,
                m.coverageScope,
                m.fullManifestHash
            )
        );
    }

    function _max64(uint64 a, uint64 b) private pure returns (uint64) {
        return a >= b ? a : b;
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
