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
    CompiledElementRule,
    EnforcementAction,
    RecipeBinding,
    RecipeBindingMode,
    Statefulness
} from "../types/ComplianceTypes.sol";
import {DecisionHashLib} from "../libraries/DecisionHashLib.sol";
import {ReasonCodes} from "../libraries/ReasonCodes.sol";
import {Errors} from "../libraries/Errors.sol";
import {Governed} from "../auth/Governed.sol";

/// @notice Bounded RecipeBinding evaluator for both sides of a pair.
/// @dev REQUIRED bindings compose as AND. PATH_OPTION bindings compose as OR
///      inside a pathGroupId and as AND across groups. FLAG_ONLY failures are
///      surfaced in flagsBitmap without changing the blocking verdict.
contract ComplianceEngine is IComplianceEngine, Governed {
    uint256 public constant MAX_RECIPE_BINDINGS = 8;
    uint256 public constant MAX_ELEMENTS_PER_RECIPE = 32;

    struct EvaluationState {
        bool allowed;
        bytes32 reasonCode;
        uint8 reasonPriority;
        uint256 flagsBitmap;
    }

    struct PathState {
        uint16[] ids;
        bool[] passed;
        bytes32[] reasonCodes;
        uint8[] priorities;
        uint256 count;
    }

    struct ElementAccumulator {
        bytes32[] ids;
        address[] tokens;
        uint256 count;
    }

    struct CommitPathState {
        uint16[] ids;
        uint256[] selected;
        uint8[] priorities;
        uint256 count;
    }

    ITokenPolicyRegistry public immutable policyReg;
    IElementRegistry public immutable elementReg;
    IRecipeRegistry public immutable recipeReg;
    address public router;

    modifier onlyRouter() {
        if (msg.sender != router) revert Errors.NotAuthorized();
        _;
    }

    constructor(ITokenPolicyRegistry policyReg_, IElementRegistry elementReg_, IRecipeRegistry recipeReg_) {
        policyReg = policyReg_;
        elementReg = elementReg_;
        recipeReg = recipeReg_;
    }

    function setRouter(address r) external onlyOwner {
        router = r;
    }

    function evaluate(ComplianceContext calldata ctx) external view override returns (ComplianceDecision memory) {
        PolicyStatus statusIn = policyReg.statusOf(ctx.tokenIn);
        PolicyStatus statusOut = policyReg.statusOf(ctx.tokenOut);
        if (!_isPermitted(statusIn)) return _rejectPolicy(ctx, statusIn);
        if (!_isPermitted(statusOut)) return _rejectPolicy(ctx, statusOut);
        if (statusIn == PolicyStatus.UNREGULATED && statusOut == PolicyStatus.UNREGULATED) {
            return _passThrough(ctx);
        }
        return _evaluateActivePair(ctx, statusIn, statusOut);
    }

    function _isPermitted(PolicyStatus status) private pure returns (bool) {
        return status == PolicyStatus.UNREGULATED || status == PolicyStatus.ACTIVE;
    }

    function _evaluateActivePair(ComplianceContext calldata ctx, PolicyStatus statusIn, PolicyStatus statusOut)
        internal
        view
        returns (ComplianceDecision memory)
    {
        EvaluationState memory state;
        state.allowed = true;
        uint256 allowedVenueTypes = type(uint256).max;
        uint64 policyVersion;
        bytes32 policyId;
        uint256 bindingOffset;

        if (statusIn == PolicyStatus.ACTIVE) {
            ManifestCore memory manifestIn = policyReg.manifestOf(ctx.tokenIn);
            RecipeBinding[] memory bindingsIn = policyReg.recipeBindingsOf(ctx.tokenIn);
            allowedVenueTypes &= uint256(manifestIn.supportedEngines);
            policyVersion = _max64(policyVersion, policyReg.manifestVersionOf(ctx.tokenIn));
            policyId = _accumulatePolicyId(policyId, ctx.tokenIn, manifestIn, bindingsIn);
            _evaluateBindings(ctx, ctx.tokenIn, manifestIn, bindingsIn, bindingOffset, state);
            bindingOffset += bindingsIn.length;
        }
        if (statusOut == PolicyStatus.ACTIVE) {
            ManifestCore memory manifestOut = policyReg.manifestOf(ctx.tokenOut);
            RecipeBinding[] memory bindingsOut = policyReg.recipeBindingsOf(ctx.tokenOut);
            allowedVenueTypes &= uint256(manifestOut.supportedEngines);
            policyVersion = _max64(policyVersion, policyReg.manifestVersionOf(ctx.tokenOut));
            policyId = _accumulatePolicyId(policyId, ctx.tokenOut, manifestOut, bindingsOut);
            _evaluateBindings(ctx, ctx.tokenOut, manifestOut, bindingsOut, bindingOffset, state);
        }

        return _buildDecision(
            ctx,
            policyId,
            policyVersion,
            _singleRegulatedToken(ctx, statusIn, statusOut),
            allowedVenueTypes,
            state.allowed,
            state.reasonCode,
            state.flagsBitmap
        );
    }

    function _evaluateBindings(
        ComplianceContext calldata ctx,
        address token,
        ManifestCore memory manifest,
        RecipeBinding[] memory bindings,
        uint256 bindingOffset,
        EvaluationState memory state
    ) internal view {
        if (bindings.length == 0) revert Errors.InvalidRecipeBinding();
        if (bindings.length > MAX_RECIPE_BINDINGS) {
            revert Errors.TooManyRecipeBindings(bindings.length, MAX_RECIPE_BINDINGS);
        }
        PathState memory paths;
        paths.ids = new uint16[](bindings.length);
        paths.passed = new bool[](bindings.length);
        paths.reasonCodes = new bytes32[](bindings.length);
        paths.priorities = new uint8[](bindings.length);

        bytes memory recipeContext = abi.encode(manifest.factsPacked, ctx);
        for (uint256 i = 0; i < bindings.length; i++) {
            RecipeBinding memory binding = bindings[i];
            (bool applicable, bool passed, bool flagged, bytes32 reasonCode) =
                _evaluateRecipe(ctx, token, binding, i, recipeContext);

            if (binding.mode == RecipeBindingMode.FLAG_ONLY) {
                if (applicable && (!passed || flagged)) state.flagsBitmap |= uint256(1) << (bindingOffset + i);
                continue;
            }
            if (binding.mode == RecipeBindingMode.REQUIRED_BLOCKING) {
                if (applicable && flagged) state.flagsBitmap |= uint256(1) << (bindingOffset + i);
                if (applicable && !passed) _selectFailure(state, reasonCode, binding.priority);
                continue;
            }

            uint256 pathIndex = _pathIndex(paths, binding.pathGroupId);
            if (applicable && flagged) state.flagsBitmap |= uint256(1) << (bindingOffset + i);
            if (applicable && passed) paths.passed[pathIndex] = true;
            if (applicable && !passed) {
                (paths.reasonCodes[pathIndex], paths.priorities[pathIndex]) = _preferredFailure(
                    paths.reasonCodes[pathIndex], paths.priorities[pathIndex], reasonCode, binding.priority
                );
            }
        }

        for (uint256 i = 0; i < paths.count; i++) {
            if (paths.passed[i]) continue;
            bytes32 reasonCode = paths.reasonCodes[i];
            if (reasonCode == bytes32(0)) reasonCode = ReasonCodes.encode(0, bytes32("PATH"), paths.ids[i]);
            _selectFailure(state, reasonCode, paths.priorities[i]);
        }
    }

    function _evaluateRecipe(
        ComplianceContext calldata ctx,
        address token,
        RecipeBinding memory binding,
        uint256 bindingIndex,
        bytes memory recipeContext
    ) internal view returns (bool applicable, bool passed, bool flagged, bytes32 reasonCode) {
        address recipeAddress = recipeReg.recipeOf(binding.recipeId, binding.recipeVersion);
        if (recipeAddress == address(0)) revert Errors.RecipeNotRegistered(binding.recipeId);
        IRecipe recipe = IRecipe(recipeAddress);
        uint16 actualVersion = recipe.version();
        if (actualVersion != binding.recipeVersion) {
            revert Errors.RecipeVersionMismatch(binding.recipeId, binding.recipeVersion, actualVersion);
        }
        applicable = recipe.isApplicable(recipeContext);
        if (!applicable) return (false, true, false, bytes32(0));

        (passed, flagged, reasonCode) = _checkCompiledRules(ctx, token, binding.recipeId, bindingIndex);
        return (true, passed, flagged, reasonCode);
    }

    function _checkCompiledRules(ComplianceContext calldata ctx, address token, uint16 recipeId, uint256 bindingIndex)
        private
        view
        returns (bool passed, bool flagged, bytes32 reasonCode)
    {
        CompiledElementRule[] memory rules = policyReg.compiledRulesOf(token, bindingIndex);
        if (rules.length == 0 || rules.length > MAX_ELEMENTS_PER_RECIPE) {
            revert Errors.TooManyRecipeElements(recipeId, rules.length, MAX_ELEMENTS_PER_RECIPE);
        }
        bytes memory elementContext = abi.encode(ctx);
        uint256 rwaAmount = token == ctx.tokenOut ? ctx.amountOut : ctx.amountIn;
        for (uint256 i = 0; i < rules.length; i++) {
            (bool elementPassed, bytes32 elementReason) =
                _checkElementRule(ctx, token, rwaAmount, elementContext, rules[i].elementId);
            if (elementPassed) continue;
            flagged = true;
            if (rules[i].action == EnforcementAction.FLAG_ONLY) continue;
            return (false, true, _reasonOrFallback(elementReason, recipeId, rules[i].elementId));
        }
        return (true, flagged, bytes32(0));
    }

    function _checkElementRule(
        ComplianceContext calldata ctx,
        address token,
        uint256 rwaAmount,
        bytes memory elementContext,
        bytes32 elementId
    ) private view returns (bool elementPassed, bytes32 elementReason) {
        address element = elementReg.elementOf(elementId);
        if (element == address(0)) revert Errors.ElementNotRegistered(elementId);
        return IComplianceElement(element).check(ctx.buyer, ctx.seller, token, rwaAmount, elementContext);
    }

    function _reasonOrFallback(bytes32 elementReason, uint16 recipeId, bytes32 elementId)
        private
        pure
        returns (bytes32)
    {
        if (elementReason != bytes32(0)) return elementReason;
        return ReasonCodes.encode(recipeId, elementId, 1);
    }

    function _pathIndex(PathState memory paths, uint16 pathGroupId) private pure returns (uint256) {
        for (uint256 i = 0; i < paths.count; i++) {
            if (paths.ids[i] == pathGroupId) return i;
        }
        uint256 index = paths.count;
        paths.ids[index] = pathGroupId;
        paths.count++;
        return index;
    }

    function _selectFailure(EvaluationState memory state, bytes32 reasonCode, uint8 priority) private pure {
        state.allowed = false;
        (state.reasonCode, state.reasonPriority) =
            _preferredFailure(state.reasonCode, state.reasonPriority, reasonCode, priority);
    }

    function _preferredFailure(bytes32 current, uint8 currentPriority, bytes32 candidate, uint8 candidatePriority)
        private
        pure
        returns (bytes32, uint8)
    {
        if (
            current == bytes32(0) || candidatePriority > currentPriority
                || (candidatePriority == currentPriority && uint256(candidate) < uint256(current))
        ) return (candidate, candidatePriority);
        return (current, currentPriority);
    }

    function _buildDecision(
        ComplianceContext calldata ctx,
        bytes32 policyId,
        uint64 policyVersion,
        address maxAmountToken,
        uint256 allowedVenueTypes,
        bool allowed,
        bytes32 reasonCode,
        uint256 flagsBitmap
    ) internal view returns (ComplianceDecision memory d) {
        d.allowed = allowed;
        d.policyId = policyId;
        d.policyVersion = policyVersion;
        d.validUntil = uint64(block.timestamp + 1 days);
        d.maxAmount = type(uint256).max;
        d.maxAmountToken = maxAmountToken;
        d.allowedVenueTypes = allowedVenueTypes;
        d.reasonCode = reasonCode;
        d.flagsBitmap = flagsBitmap;
        d.decisionHash = _hash(ctx, d);
    }

    function _hash(ComplianceContext calldata ctx, ComplianceDecision memory d) private pure returns (bytes32) {
        return DecisionHashLib.compute(
            ctx, d.maxAmount, d.maxAmountToken, d.allowedVenueTypes, d.allowedVenuesHash, d.policyVersion, d.validUntil
        );
    }

    function _passThrough(ComplianceContext calldata ctx) internal view returns (ComplianceDecision memory d) {
        d.allowed = true;
        d.validUntil = uint64(block.timestamp + 1 days);
        d.maxAmount = type(uint256).max;
        d.allowedVenueTypes = type(uint256).max;
        d.decisionHash = _hash(ctx, d);
    }

    function _singleRegulatedToken(ComplianceContext calldata ctx, PolicyStatus statusIn, PolicyStatus statusOut)
        private
        pure
        returns (address)
    {
        bool tokenInActive = statusIn == PolicyStatus.ACTIVE;
        bool tokenOutActive = statusOut == PolicyStatus.ACTIVE;
        if (tokenInActive == tokenOutActive) return address(0);
        return tokenInActive ? ctx.tokenIn : ctx.tokenOut;
    }

    function _rejectPolicy(ComplianceContext calldata ctx, PolicyStatus status)
        internal
        view
        returns (ComplianceDecision memory d)
    {
        d.reasonCode = ReasonCodes.encode(0, bytes32("POLICY"), uint32(status));
        d.validUntil = uint64(block.timestamp + 1 days);
        d.decisionHash = _hash(ctx, d);
    }

    function commit(ComplianceContext calldata ctx) external override onlyRouter {
        PolicyStatus statusIn = policyReg.statusOf(ctx.tokenIn);
        PolicyStatus statusOut = policyReg.statusOf(ctx.tokenOut);
        if (!_isPermitted(statusIn) || !_isPermitted(statusOut)) return;

        ElementAccumulator memory elements = _newAccumulator();
        if (statusIn == PolicyStatus.ACTIVE) _collectCommitElements(ctx, ctx.tokenIn, elements);
        if (statusOut == PolicyStatus.ACTIVE) _collectCommitElements(ctx, ctx.tokenOut, elements);

        for (uint256 i = 0; i < elements.count; i++) {
            address element = elementReg.elementOf(elements.ids[i]);
            if (IComplianceElement(element).elementMetadata().statefulness == Statefulness.STATEFUL) {
                bool isOutput = elements.tokens[i] == ctx.tokenOut;
                uint256 rwaAmount = isOutput ? ctx.amountOut : ctx.amountIn;
                // `buyer` is the screened subject, not an unconditional token
                // recipient. For tokenOut the regulated asset moves
                // seller→buyer; for tokenIn it moves buyer→seller.
                IStatefulElement(element)
                    .onTransfer(isOutput ? ctx.seller : ctx.buyer, isOutput ? ctx.buyer : ctx.seller, rwaAmount);
            }
        }
    }

    function _collectCommitElements(ComplianceContext calldata ctx, address token, ElementAccumulator memory elements)
        internal
        view
    {
        ManifestCore memory manifest = policyReg.manifestOf(token);
        RecipeBinding[] memory bindings = policyReg.recipeBindingsOf(token);
        if (bindings.length == 0) revert Errors.InvalidRecipeBinding();
        if (bindings.length > MAX_RECIPE_BINDINGS) {
            revert Errors.TooManyRecipeBindings(bindings.length, MAX_RECIPE_BINDINGS);
        }
        bytes memory recipeContext = abi.encode(manifest.factsPacked, ctx);
        CommitPathState memory paths;
        paths.ids = new uint16[](bindings.length);
        paths.selected = new uint256[](bindings.length);
        paths.priorities = new uint8[](bindings.length);

        for (uint256 i = 0; i < bindings.length; i++) {
            RecipeBinding memory binding = bindings[i];
            IRecipe recipe = _validatedRecipe(binding);
            if (!recipe.isApplicable(recipeContext)) continue;

            if (binding.mode == RecipeBindingMode.PATH_OPTION) {
                (bool passed,,) = _checkCompiledRules(ctx, token, binding.recipeId, i);
                if (passed) _selectCommitPath(paths, bindings, i);
                continue;
            }

            // FLAG_ONLY is observational by contract: neither its pre-trade
            // verdict nor a stateful post-trade hook may roll back settlement.
            // Non-blocking observations must use the emitted flags/event stream
            // rather than the trade-critical commit path.
            if (binding.mode == RecipeBindingMode.FLAG_ONLY) continue;

            _appendCompiledElements(elements, token, i);
        }

        for (uint256 i = 0; i < paths.count; i++) {
            uint256 selected = paths.selected[i];
            // A successful blocking evaluation guarantees one passing option
            // for every applicable path group. Keep commit fail-closed if that
            // invariant is ever broken by an incompatible caller or upgrade.
            if (selected == 0) revert Errors.InvalidRecipeBinding();
            _validatedRecipe(bindings[selected - 1]);
            _appendCompiledElements(elements, token, selected - 1);
        }
    }

    function _validatedRecipe(RecipeBinding memory binding) private view returns (IRecipe recipe) {
        address recipeAddress = recipeReg.recipeOf(binding.recipeId, binding.recipeVersion);
        if (recipeAddress == address(0)) revert Errors.RecipeNotRegistered(binding.recipeId);
        recipe = IRecipe(recipeAddress);
        uint16 actualVersion = recipe.version();
        if (actualVersion != binding.recipeVersion) {
            revert Errors.RecipeVersionMismatch(binding.recipeId, binding.recipeVersion, actualVersion);
        }
    }

    function _selectCommitPath(CommitPathState memory paths, RecipeBinding[] memory bindings, uint256 candidateIndex)
        private
        pure
    {
        RecipeBinding memory candidate = bindings[candidateIndex];
        uint256 pathIndex = _commitPathIndex(paths, candidate.pathGroupId);
        uint256 selected = paths.selected[pathIndex];
        if (
            selected == 0 || candidate.priority > paths.priorities[pathIndex]
                || (candidate.priority == paths.priorities[pathIndex]
                    && candidate.recipeId < bindings[selected - 1].recipeId)
        ) {
            paths.selected[pathIndex] = candidateIndex + 1;
            paths.priorities[pathIndex] = candidate.priority;
        }
    }

    function _commitPathIndex(CommitPathState memory paths, uint16 pathGroupId) private pure returns (uint256) {
        for (uint256 i = 0; i < paths.count; i++) {
            if (paths.ids[i] == pathGroupId) return i;
        }
        uint256 index = paths.count;
        paths.ids[index] = pathGroupId;
        paths.count++;
        return index;
    }

    function _appendCompiledElements(ElementAccumulator memory elements, address token, uint256 bindingIndex)
        private
        view
    {
        CompiledElementRule[] memory rules = policyReg.compiledRulesOf(token, bindingIndex);
        if (rules.length > MAX_ELEMENTS_PER_RECIPE) {
            revert Errors.TooManyRecipeElements(0, rules.length, MAX_ELEMENTS_PER_RECIPE);
        }
        for (uint256 i = 0; i < rules.length; i++) {
            if (rules[i].action == EnforcementAction.FLAG_ONLY) continue;
            if (!_seen(elements, rules[i].elementId, token)) {
                elements.ids[elements.count] = rules[i].elementId;
                elements.tokens[elements.count] = token;
                elements.count++;
            }
        }
    }

    function _newAccumulator() private pure returns (ElementAccumulator memory elements) {
        uint256 capacity = 2 * MAX_RECIPE_BINDINGS * MAX_ELEMENTS_PER_RECIPE;
        elements.ids = new bytes32[](capacity);
        elements.tokens = new address[](capacity);
    }

    function _seen(ElementAccumulator memory elements, bytes32 id, address token) private pure returns (bool) {
        for (uint256 i = 0; i < elements.count; i++) {
            if (elements.ids[i] == id && elements.tokens[i] == token) return true;
        }
        return false;
    }

    function _accumulatePolicyId(
        bytes32 acc,
        address token,
        ManifestCore memory manifest,
        RecipeBinding[] memory bindings
    ) private view returns (bytes32) {
        bindings;
        return keccak256(
            abi.encode(
                acc,
                token,
                policyReg.compiledPlanHashOf(token),
                manifest.supportedEngines,
                manifest.factsPacked,
                manifest.coverageScope,
                manifest.fullManifestHash
            )
        );
    }

    function _max64(uint64 a, uint64 b) private pure returns (uint64) {
        return a >= b ? a : b;
    }
}
