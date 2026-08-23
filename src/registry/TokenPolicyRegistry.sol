// SPDX-License-Identifier: GPL-3.0
pragma solidity 0.8.17;

import {Governed} from "../auth/Governed.sol";
import {ITokenPolicyRegistry} from "../interfaces/compliance/ITokenPolicyRegistry.sol";
import {IElementRegistry} from "../interfaces/compliance/IElementRegistry.sol";
import {IRecipeRegistry} from "../interfaces/compliance/IRecipeRegistry.sol";
import {IRecipe} from "../interfaces/compliance/IRecipe.sol";
import {
    CompiledElementRule,
    ElementEnforcementOverride,
    EnforcementAction,
    EnforcementOverrideMode,
    ManifestCore,
    PolicyStatus,
    RecipeBinding,
    RecipeBindingMode
} from "../types/ComplianceTypes.sol";
import {Errors} from "../libraries/Errors.sol";
import {Events} from "../libraries/Events.sol";

/// @title TokenPolicyRegistry
/// @notice Manifest store + lifecycle state machine. Manifest recipe bindings are
///         compiled against immutable recipe/element registries when registered
///         or scheduled, so the engine evaluates decision-bound compiled plans
///         rather than mutable latest recipe/element lookups.
contract TokenPolicyRegistry is ITokenPolicyRegistry, Governed {
    uint64 public constant MIN_MANIFEST_DELAY = 1 days;
    uint256 public constant MAX_RECIPE_BINDINGS = 8;
    uint256 public constant MAX_ELEMENTS_PER_RECIPE = 32;
    uint256 public constant MAX_ENFORCEMENT_OVERRIDES = MAX_RECIPE_BINDINGS * MAX_ELEMENTS_PER_RECIPE;

    struct PendingManifestUpdate {
        ManifestCore manifest;
        uint64 effectiveTime;
        bytes32 reasonCode;
        bytes32 planHash;
    }

    struct PendingResume {
        uint64 effectiveTime;
        bytes32 reasonCode;
    }

    struct CompiledBindingPlan {
        RecipeBinding binding;
        bytes32 recipeKey;
        bytes32 planHash;
        CompiledElementRule[] rules;
    }

    IRecipeRegistry public immutable recipeReg;
    IElementRegistry public immutable elementReg;

    mapping(address => ManifestCore) internal _manifests;
    mapping(address => RecipeBinding[]) internal _recipeBindings;
    mapping(address => CompiledBindingPlan[]) internal _compiledPlans;
    mapping(address => uint64) internal _manifestVersions;
    mapping(address => bytes32) internal _manifestHistoryHashes;
    mapping(address => bytes32) internal _compiledPlanHashes;
    mapping(address => PendingManifestUpdate) internal _pendingManifestUpdates;
    mapping(address => RecipeBinding[]) internal _pendingManifestBindings;
    mapping(address => CompiledBindingPlan[]) internal _pendingCompiledPlans;
    mapping(address => PendingResume) internal _pendingManifestResumes;

    constructor(IRecipeRegistry recipeReg_, IElementRegistry elementReg_) {
        recipeReg = recipeReg_;
        elementReg = elementReg_;
    }

    function registerManifest(address token, ManifestCore calldata m, RecipeBinding[] calldata bindings)
        external
        onlyOwner
    {
        ElementEnforcementOverride[] memory overrides_ = new ElementEnforcementOverride[](0);
        _registerManifest(token, m, bindings, overrides_);
    }

    function registerManifest(
        address token,
        ManifestCore calldata m,
        RecipeBinding[] calldata bindings,
        ElementEnforcementOverride[] calldata overrides_
    ) external onlyOwner {
        _registerManifest(token, m, bindings, overrides_);
    }

    function registerManifest(address token, ManifestCore calldata m) external onlyOwner {
        ElementEnforcementOverride[] memory overrides_ = new ElementEnforcementOverride[](0);
        _registerManifest(token, m, _legacyBindings(m), overrides_);
    }

    function _registerManifest(
        address token,
        ManifestCore memory m,
        RecipeBinding[] memory bindings,
        ElementEnforcementOverride[] memory overrides_
    ) internal {
        _validateBindings(bindings);
        bytes32 planHash = _compileInto(_compiledPlans[token], bindings, overrides_);
        PolicyStatus current = _manifests[token].status;
        bytes32 oldHash = _manifests[token].fullManifestHash;
        if (current != PolicyStatus.UNKNOWN && current != PolicyStatus.RETIRED) {
            revert Errors.InvalidManifestTransition();
        }
        _manifests[token] = m;
        _manifests[token].status = PolicyStatus.PROPOSED;
        _manifests[token].declaredBy = msg.sender;
        _manifests[token].approvedBy = address(0);
        _compiledPlanHashes[token] = planHash;
        _replaceBindings(_recipeBindings[token], bindings);
        _recordHistory(
            token,
            current,
            PolicyStatus.PROPOSED,
            oldHash,
            _manifests[token].fullManifestHash,
            bytes32(0),
            planHash,
            uint64(block.timestamp),
            true
        );
        emit Events.ManifestRegistered(token, planHash, msg.sender);
        emit Events.ManifestStatusChanged(token, PolicyStatus.PROPOSED, bytes32(0));
    }

    function approveManifest(address token) external onlyOperator {
        ManifestCore storage mm = _manifests[token];
        if (mm.status != PolicyStatus.PROPOSED) revert Errors.InvalidManifestTransition();
        if (_compiledPlans[token].length == 0) revert Errors.InvalidRecipeBinding();
        mm.status = PolicyStatus.ACTIVE;
        mm.approvedBy = msg.sender;
        _recordHistory(
            token,
            PolicyStatus.PROPOSED,
            PolicyStatus.ACTIVE,
            mm.fullManifestHash,
            mm.fullManifestHash,
            bytes32(0),
            _compiledPlanHashes[token],
            uint64(block.timestamp),
            false
        );
        emit Events.ManifestStatusChanged(token, PolicyStatus.ACTIVE, bytes32(0));
    }

    function suspendManifest(address token, bytes32 reasonCode) external onlyOperator {
        if (_manifests[token].status != PolicyStatus.ACTIVE) revert Errors.InvalidManifestTransition();
        _manifests[token].status = PolicyStatus.SUSPENDED;
        delete _pendingManifestResumes[token];
        _recordHistory(
            token,
            PolicyStatus.ACTIVE,
            PolicyStatus.SUSPENDED,
            _manifests[token].fullManifestHash,
            _manifests[token].fullManifestHash,
            reasonCode,
            _compiledPlanHashes[token],
            uint64(block.timestamp),
            false
        );
        emit Events.ManifestStatusChanged(token, PolicyStatus.SUSPENDED, reasonCode);
    }

    function scheduleManifestResume(address token, bytes32 reasonCode) external onlyOwner {
        if (_manifests[token].status != PolicyStatus.SUSPENDED) revert Errors.InvalidManifestTransition();
        if (_pendingManifestResumes[token].effectiveTime != 0) revert Errors.PendingActionExists();
        _pendingManifestResumes[token] = PendingResume(_readyTime(), reasonCode);
        emit Events.ManifestResumeScheduled(token, reasonCode, _pendingManifestResumes[token].effectiveTime);
    }

    function cancelManifestResume(address token) external onlyOwner {
        if (_pendingManifestResumes[token].effectiveTime == 0) revert Errors.PendingActionNotFound();
        delete _pendingManifestResumes[token];
        emit Events.ManifestResumeCancelled(token);
    }

    function resumeManifest(address token) external onlyOperator {
        if (_manifests[token].status != PolicyStatus.SUSPENDED) revert Errors.InvalidManifestTransition();
        PendingResume memory pending = _pendingManifestResumes[token];
        _requireReady(pending.effectiveTime);
        _manifests[token].status = PolicyStatus.ACTIVE;
        delete _pendingManifestResumes[token];
        _recordHistory(
            token,
            PolicyStatus.SUSPENDED,
            PolicyStatus.ACTIVE,
            _manifests[token].fullManifestHash,
            _manifests[token].fullManifestHash,
            pending.reasonCode,
            _compiledPlanHashes[token],
            pending.effectiveTime,
            false
        );
        emit Events.ManifestStatusChanged(token, PolicyStatus.ACTIVE, pending.reasonCode);
    }

    function scheduleManifestUpdate(
        address token,
        ManifestCore calldata m,
        RecipeBinding[] calldata bindings,
        bytes32 reasonCode
    ) external onlyOwner {
        ElementEnforcementOverride[] memory overrides_ = new ElementEnforcementOverride[](0);
        _scheduleManifestUpdate(token, m, bindings, overrides_, reasonCode);
    }

    function scheduleManifestUpdate(
        address token,
        ManifestCore calldata m,
        RecipeBinding[] calldata bindings,
        ElementEnforcementOverride[] calldata overrides_,
        bytes32 reasonCode
    ) external onlyOwner {
        _scheduleManifestUpdate(token, m, bindings, overrides_, reasonCode);
    }

    function scheduleManifestUpdate(address token, ManifestCore calldata m, bytes32 reasonCode) external onlyOwner {
        ElementEnforcementOverride[] memory overrides_ = new ElementEnforcementOverride[](0);
        _scheduleManifestUpdate(token, m, _legacyBindings(m), overrides_, reasonCode);
    }

    function _scheduleManifestUpdate(
        address token,
        ManifestCore memory m,
        RecipeBinding[] memory bindings,
        ElementEnforcementOverride[] memory overrides_,
        bytes32 reasonCode
    ) internal {
        _validateBindings(bindings);
        PolicyStatus current = _manifests[token].status;
        if (current != PolicyStatus.ACTIVE && current != PolicyStatus.SUSPENDED) {
            revert Errors.InvalidManifestTransition();
        }
        if (_pendingManifestUpdates[token].effectiveTime != 0) revert Errors.PendingActionExists();
        if (m.fullManifestHash == bytes32(0) || m.fullManifestHash == _manifests[token].fullManifestHash) {
            revert Errors.InvalidManifestHash();
        }
        uint64 effectiveTime = _readyTime();
        bytes32 planHash = _compileInto(_pendingCompiledPlans[token], bindings, overrides_);
        _pendingManifestUpdates[token] = PendingManifestUpdate(m, effectiveTime, reasonCode, planHash);
        _replaceBindings(_pendingManifestBindings[token], bindings);
        emit Events.ManifestSemanticUpdateScheduled(
            token,
            _manifestVersions[token],
            _manifestVersions[token] + 1,
            _manifests[token].fullManifestHash,
            m.fullManifestHash,
            reasonCode,
            effectiveTime
        );
    }

    function cancelManifestUpdate(address token) external onlyOwner {
        if (_pendingManifestUpdates[token].effectiveTime == 0) revert Errors.PendingActionNotFound();
        delete _pendingManifestUpdates[token];
        delete _pendingManifestBindings[token];
        _clearCompiled(_pendingCompiledPlans[token]);
        emit Events.ManifestSemanticUpdateCancelled(token);
    }

    function activateManifestUpdate(address token) external onlyOperator {
        PolicyStatus current = _manifests[token].status;
        if (current != PolicyStatus.ACTIVE && current != PolicyStatus.SUSPENDED) {
            revert Errors.InvalidManifestTransition();
        }
        PendingManifestUpdate storage pending = _pendingManifestUpdates[token];
        _requireReady(pending.effectiveTime);

        uint64 oldVersion = _manifestVersions[token];
        bytes32 oldHash = _manifests[token].fullManifestHash;
        bytes32 newHash = pending.manifest.fullManifestHash;
        bytes32 reasonCode = pending.reasonCode;
        uint64 effectiveTime = pending.effectiveTime;
        bytes32 planHash = pending.planHash;

        ManifestCore memory next = pending.manifest;
        next.status = current;
        next.declaredBy = owner();
        next.approvedBy = msg.sender;
        _manifests[token] = next;
        _copyBindings(_recipeBindings[token], _pendingManifestBindings[token]);
        _copyCompiled(_compiledPlans[token], _pendingCompiledPlans[token]);
        _compiledPlanHashes[token] = planHash;
        uint64 newVersion =
            _recordHistory(token, current, current, oldHash, newHash, reasonCode, planHash, effectiveTime, true);
        delete _pendingManifestUpdates[token];
        delete _pendingManifestBindings[token];
        _clearCompiled(_pendingCompiledPlans[token]);

        emit Events.ManifestSemanticUpdateActivated(
            token, oldVersion, newVersion, oldHash, newHash, reasonCode, effectiveTime
        );
    }

    function retireManifest(address token, bytes32 reasonCode) external onlyOperator {
        PolicyStatus current = _manifests[token].status;
        if (current != PolicyStatus.ACTIVE && current != PolicyStatus.SUSPENDED) {
            revert Errors.InvalidManifestTransition();
        }
        _manifests[token].status = PolicyStatus.RETIRED;
        delete _pendingManifestUpdates[token];
        delete _pendingManifestBindings[token];
        _clearCompiled(_pendingCompiledPlans[token]);
        delete _pendingManifestResumes[token];
        _recordHistory(
            token,
            current,
            PolicyStatus.RETIRED,
            _manifests[token].fullManifestHash,
            _manifests[token].fullManifestHash,
            reasonCode,
            _compiledPlanHashes[token],
            uint64(block.timestamp),
            false
        );
        emit Events.ManifestStatusChanged(token, PolicyStatus.RETIRED, reasonCode);
    }

    function setUnregulated(address token) external onlyOwner {
        if (_manifests[token].status != PolicyStatus.UNKNOWN) revert Errors.InvalidManifestTransition();
        _manifests[token].status = PolicyStatus.UNREGULATED;
        _recordHistory(
            token,
            PolicyStatus.UNKNOWN,
            PolicyStatus.UNREGULATED,
            bytes32(0),
            bytes32(0),
            bytes32(0),
            bytes32(0),
            uint64(block.timestamp),
            false
        );
        emit Events.ManifestStatusChanged(token, PolicyStatus.UNREGULATED, bytes32(0));
    }

    function clearUnregulated(address token) external onlyOwner {
        if (_manifests[token].status != PolicyStatus.UNREGULATED) revert Errors.InvalidManifestTransition();
        _manifests[token].status = PolicyStatus.UNKNOWN;
        _recordHistory(
            token,
            PolicyStatus.UNREGULATED,
            PolicyStatus.UNKNOWN,
            bytes32(0),
            bytes32(0),
            bytes32(0),
            bytes32(0),
            uint64(block.timestamp),
            false
        );
        emit Events.ManifestStatusChanged(token, PolicyStatus.UNKNOWN, bytes32(0));
    }

    function manifestOf(address token) external view returns (ManifestCore memory) {
        return _manifests[token];
    }

    function recipeBindingsOf(address token) external view returns (RecipeBinding[] memory) {
        return _recipeBindings[token];
    }

    function statusOf(address token) external view returns (PolicyStatus) {
        return _manifests[token].status;
    }

    function manifestVersionOf(address token) external view returns (uint64) {
        return _manifestVersions[token];
    }

    function manifestHistoryHashOf(address token) external view returns (bytes32) {
        return _manifestHistoryHashes[token];
    }

    function compiledPlanHashOf(address token) external view returns (bytes32) {
        return _compiledPlanHashes[token];
    }

    function compiledBindingCountOf(address token) external view returns (uint256) {
        return _compiledPlans[token].length;
    }

    function compiledBindingOf(address token, uint256 index)
        external
        view
        returns (RecipeBinding memory binding, bytes32 recipeKey, bytes32 bindingPlanHash)
    {
        CompiledBindingPlan storage plan = _compiledPlans[token][index];
        return (plan.binding, plan.recipeKey, plan.planHash);
    }

    function compiledRulesOf(address token, uint256 bindingIndex)
        external
        view
        returns (CompiledElementRule[] memory rules)
    {
        CompiledBindingPlan storage plan = _compiledPlans[token][bindingIndex];
        rules = new CompiledElementRule[](plan.rules.length);
        for (uint256 i = 0; i < plan.rules.length; i++) {
            rules[i] = plan.rules[i];
        }
    }

    function pendingManifestUpdateOf(address token)
        external
        view
        returns (
            ManifestCore memory manifest,
            RecipeBinding[] memory bindings,
            uint64 effectiveTime,
            bytes32 reasonCode
        )
    {
        PendingManifestUpdate storage pending = _pendingManifestUpdates[token];
        return (pending.manifest, _pendingManifestBindings[token], pending.effectiveTime, pending.reasonCode);
    }

    function pendingManifestResumeOf(address token) external view returns (uint64 effectiveTime, bytes32 reasonCode) {
        PendingResume storage pending = _pendingManifestResumes[token];
        return (pending.effectiveTime, pending.reasonCode);
    }

    function setFact(address token, uint256 factsPacked) external onlyOperator {
        PolicyStatus current = _manifests[token].status;
        if (current != PolicyStatus.PROPOSED) revert Errors.InvalidManifestTransition();
        uint256 old = _manifests[token].factsPacked;
        if (factsPacked & old != old) revert Errors.LooseningForbidden();
        _manifests[token].factsPacked = factsPacked;
    }

    function _compileInto(
        CompiledBindingPlan[] storage target,
        RecipeBinding[] memory bindings,
        ElementEnforcementOverride[] memory overrides_
    ) internal returns (bytes32 planHash) {
        if (overrides_.length > MAX_ENFORCEMENT_OVERRIDES) {
            revert Errors.TooManyEnforcementOverrides(overrides_.length, MAX_ENFORCEMENT_OVERRIDES);
        }
        _clearCompiled(target);
        bytes32 acc;
        for (uint256 i = 0; i < bindings.length; i++) {
            RecipeBinding memory binding = bindings[i];
            bytes32 recipeKey = recipeReg.recipeKeyOf(binding.recipeId);
            address recipeAddress = recipeReg.recipeOf(binding.recipeId, binding.recipeVersion);
            if (recipeAddress == address(0) || recipeKey == bytes32(0)) {
                revert Errors.RecipeNotRegistered(binding.recipeId);
            }
            IRecipe recipe = IRecipe(recipeAddress);
            uint16 actualVersion = recipe.version();
            if (actualVersion != binding.recipeVersion || recipe.recipeId() != binding.recipeId) {
                revert Errors.RecipeVersionMismatch(binding.recipeId, binding.recipeVersion, actualVersion);
            }
            bytes32[] memory required = recipe.requiredElements();
            if (required.length == 0 || required.length > MAX_ELEMENTS_PER_RECIPE) {
                revert Errors.TooManyRecipeElements(binding.recipeId, required.length, MAX_ELEMENTS_PER_RECIPE);
            }
            CompiledElementRule[] memory rules = new CompiledElementRule[](required.length);
            for (uint256 j = 0; j < required.length; j++) {
                if (elementReg.elementOf(required[j]) == address(0)) revert Errors.ElementNotRegistered(required[j]);
                rules[j] = CompiledElementRule(
                    required[j], _compiledAction(overrides_, i, required[j], elementReg.defaultActionOf(required[j]))
                );
            }
            _rejectUnusedOrDuplicateOverrides(overrides_, i, required);
            bytes32 bindingPlanHash = keccak256(abi.encode(binding, recipeKey, rules));
            _pushCompiled(target, binding, recipeKey, bindingPlanHash, rules);
            acc = keccak256(abi.encode(acc, bindingPlanHash));
        }
        _rejectOutOfRangeOverrides(overrides_, bindings.length);
        return acc;
    }

    function _pushCompiled(
        CompiledBindingPlan[] storage target,
        RecipeBinding memory binding,
        bytes32 recipeKey,
        bytes32 bindingPlanHash,
        CompiledElementRule[] memory rules
    ) internal {
        target.push();
        CompiledBindingPlan storage stored = target[target.length - 1];
        stored.binding = binding;
        stored.recipeKey = recipeKey;
        stored.planHash = bindingPlanHash;
        for (uint256 i = 0; i < rules.length; i++) {
            stored.rules.push(rules[i]);
        }
    }

    function _compiledAction(
        ElementEnforcementOverride[] memory overrides_,
        uint256 bindingIndex,
        bytes32 elementId,
        EnforcementAction defaultAction
    ) internal pure returns (EnforcementAction action) {
        action = defaultAction;
        for (uint256 i = 0; i < overrides_.length; i++) {
            if (overrides_[i].bindingIndex != bindingIndex || overrides_[i].elementId != elementId) continue;
            EnforcementOverrideMode mode = overrides_[i].mode;
            if (mode == EnforcementOverrideMode.USE_ELEMENT_DEFAULT) return defaultAction;
            if (mode == EnforcementOverrideMode.ESCALATE_TO_BLOCK) return EnforcementAction.BLOCK;
            if (mode == EnforcementOverrideMode.ESCALATE_TO_OPERATOR_REVIEW) {
                if (defaultAction == EnforcementAction.BLOCK) revert Errors.LooseningForbidden();
                return EnforcementAction.OPERATOR_REVIEW;
            }
            if (mode == EnforcementOverrideMode.FORCE_FLAG_ONLY) {
                if (defaultAction != EnforcementAction.FLAG_ONLY) revert Errors.LooseningForbidden();
                return EnforcementAction.FLAG_ONLY;
            }
            revert Errors.InvalidEnforcementOverride();
        }
    }

    function _rejectUnusedOrDuplicateOverrides(
        ElementEnforcementOverride[] memory overrides_,
        uint256 bindingIndex,
        bytes32[] memory required
    ) internal pure {
        for (uint256 i = 0; i < overrides_.length; i++) {
            if (overrides_[i].bindingIndex != bindingIndex) continue;
            bool member;
            for (uint256 r = 0; r < required.length; r++) {
                if (required[r] == overrides_[i].elementId) member = true;
            }
            if (!member) revert Errors.InvalidEnforcementOverride();
            for (uint256 j = 0; j < i; j++) {
                if (
                    overrides_[j].bindingIndex == overrides_[i].bindingIndex
                        && overrides_[j].elementId == overrides_[i].elementId
                ) {
                    revert Errors.DuplicateElementOverride(bindingIndex, overrides_[i].elementId);
                }
            }
        }
    }

    function _rejectOutOfRangeOverrides(ElementEnforcementOverride[] memory overrides_, uint256 bindingCount)
        internal
        pure
    {
        for (uint256 i = 0; i < overrides_.length; i++) {
            if (overrides_[i].bindingIndex >= bindingCount) revert Errors.InvalidEnforcementOverride();
        }
    }

    function _recordHistory(
        address token,
        PolicyStatus oldStatus,
        PolicyStatus newStatus,
        bytes32 oldManifestHash,
        bytes32 newManifestHash,
        bytes32 reasonCode,
        bytes32 reasonHash,
        uint64 effectiveTime,
        bool incrementVersion
    ) internal returns (uint64 newVersion) {
        newVersion = _manifestVersions[token];
        if (incrementVersion) newVersion += 1;
        bytes32 historyHash = keccak256(
            abi.encode(
                address(this),
                token,
                _manifestHistoryHashes[token],
                oldStatus,
                newStatus,
                oldManifestHash,
                newManifestHash,
                newVersion,
                msg.sender,
                reasonCode,
                reasonHash,
                effectiveTime
            )
        );
        _manifestVersions[token] = newVersion;
        _manifestHistoryHashes[token] = historyHash;
        emit Events.ManifestHistoryAppended(
            token,
            newVersion,
            oldStatus,
            newStatus,
            oldManifestHash,
            newManifestHash,
            historyHash,
            msg.sender,
            reasonCode,
            reasonHash,
            effectiveTime
        );
    }

    function _validateBindings(RecipeBinding[] memory bindings) internal pure {
        if (bindings.length == 0) revert Errors.InvalidRecipeBinding();
        if (bindings.length > MAX_RECIPE_BINDINGS) {
            revert Errors.TooManyRecipeBindings(bindings.length, MAX_RECIPE_BINDINGS);
        }
        bool hasBlockingBinding;
        for (uint256 i = 0; i < bindings.length; i++) {
            RecipeBinding memory binding = bindings[i];
            if (binding.recipeId == 0 || binding.recipeVersion == 0) revert Errors.InvalidRecipeBinding();
            if (binding.mode == RecipeBindingMode.PATH_OPTION) {
                if (binding.pathGroupId == 0) revert Errors.InvalidRecipeBinding();
                hasBlockingBinding = true;
            } else {
                if (binding.pathGroupId != 0) revert Errors.InvalidRecipeBinding();
                if (binding.mode == RecipeBindingMode.REQUIRED_BLOCKING) hasBlockingBinding = true;
            }
            for (uint256 j = 0; j < i; j++) {
                if (bindings[j].recipeId == binding.recipeId) revert Errors.DuplicateRecipeBinding(binding.recipeId);
            }
        }
        if (!hasBlockingBinding) revert Errors.InvalidRecipeBinding();
    }

    function _replaceBindings(RecipeBinding[] storage target, RecipeBinding[] memory source) internal {
        while (target.length != 0) target.pop();
        for (uint256 i = 0; i < source.length; i++) {
            target.push(source[i]);
        }
    }

    function _copyBindings(RecipeBinding[] storage target, RecipeBinding[] storage source) internal {
        while (target.length != 0) target.pop();
        for (uint256 i = 0; i < source.length; i++) {
            target.push(source[i]);
        }
    }

    function _clearCompiled(CompiledBindingPlan[] storage target) internal {
        while (target.length != 0) target.pop();
    }

    function _copyCompiled(CompiledBindingPlan[] storage target, CompiledBindingPlan[] storage source) internal {
        _clearCompiled(target);
        for (uint256 i = 0; i < source.length; i++) {
            target.push();
            CompiledBindingPlan storage dst = target[target.length - 1];
            dst.binding = source[i].binding;
            dst.recipeKey = source[i].recipeKey;
            dst.planHash = source[i].planHash;
            for (uint256 j = 0; j < source[i].rules.length; j++) {
                dst.rules.push(source[i].rules[j]);
            }
        }
    }

    function _legacyBindings(ManifestCore memory manifest) internal pure returns (RecipeBinding[] memory bindings) {
        uint256 count = manifest.issuanceRecipeId == 0 ? 0 : (manifest.fundRecipeId == 0 ? 1 : 2);
        bindings = new RecipeBinding[](count);
        if (count == 0) return bindings;
        uint16 issuanceVersion = manifest.issuanceRecipeVersion == 0 ? 1 : manifest.issuanceRecipeVersion;
        bindings[0] =
            RecipeBinding(manifest.issuanceRecipeId, issuanceVersion, RecipeBindingMode.REQUIRED_BLOCKING, 0, 100);
        if (count == 2) {
            bindings[1] = RecipeBinding(manifest.fundRecipeId, 1, RecipeBindingMode.REQUIRED_BLOCKING, 0, 90);
        }
    }

    function _readyTime() internal view returns (uint64) {
        return uint64(block.timestamp + MIN_MANIFEST_DELAY);
    }

    function _requireReady(uint64 readyAt) internal view {
        if (readyAt == 0) revert Errors.PendingActionNotFound();
        if (block.timestamp < readyAt) revert Errors.TimelockNotReady(readyAt);
    }
}
