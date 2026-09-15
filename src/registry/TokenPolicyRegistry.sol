// SPDX-License-Identifier: GPL-3.0
pragma solidity 0.8.17;

import {Governed} from "../auth/Governed.sol";
import {ITokenPolicyRegistry} from "../interfaces/compliance/ITokenPolicyRegistry.sol";
import {IElementRegistry} from "../interfaces/compliance/IElementRegistry.sol";
import {IRecipeRegistry} from "../interfaces/compliance/IRecipeRegistry.sol";
import {IRecipe} from "../interfaces/compliance/IRecipe.sol";
import {
    CompiledElementRule,
    ElementMetadata,
    ElementPolicyParameter,
    ElementEnforcementOverride,
    EnforcementAction,
    EnforcementOverrideMode,
    ManifestCore,
    ManifestPolicyConfig,
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
    uint16 internal constant POLICY_CONFIG_SCHEMA_VERSION = 1;
    uint256 internal constant MAX_POLICY_PARAMETERS = MAX_ENFORCEMENT_OVERRIDES;
    uint256 internal constant MAX_TOTAL_PARAMETER_BYTES = 16_384;
    bytes32 internal constant POLICY_CONFIG_DOMAIN = keccak256("CORNER_STORE_MANIFEST_POLICY_CONFIG_V1");

    struct PendingManifestUpdate {
        ManifestCore manifest;
        uint64 effectiveTime;
        bytes32 reasonCode;
        bytes32 planHash;
        bytes32 configHash;
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
        bytes[] parameters;
    }

    IRecipeRegistry public immutable recipeReg;
    IElementRegistry public immutable elementReg;

    mapping(address => ManifestCore) internal _manifests;
    mapping(address => RecipeBinding[]) internal _recipeBindings;
    mapping(address => CompiledBindingPlan[]) internal _compiledPlans;
    mapping(address => uint64) internal _manifestVersions;
    mapping(address => bytes32) internal _manifestHistoryHashes;
    mapping(address => bytes32) internal _compiledPlanHashes;
    mapping(address => bytes32) internal _policyConfigHashes;
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
        _registerManifest(token, m, bindings, overrides_, _emptyPolicyConfig());
    }

    function registerManifest(
        address token,
        ManifestCore calldata m,
        RecipeBinding[] calldata bindings,
        ElementEnforcementOverride[] calldata overrides_
    ) external onlyOwner {
        _registerManifest(token, m, bindings, overrides_, _emptyPolicyConfig());
    }

    function registerManifest(
        address token,
        ManifestCore calldata m,
        RecipeBinding[] calldata bindings,
        ElementEnforcementOverride[] calldata overrides_,
        ManifestPolicyConfig calldata config
    ) external onlyOwner {
        _registerManifest(token, m, bindings, overrides_, config);
    }

    function _registerManifest(
        address token,
        ManifestCore memory m,
        RecipeBinding[] memory bindings,
        ElementEnforcementOverride[] memory overrides_,
        ManifestPolicyConfig memory config
    ) internal {
        _validateBindings(bindings);
        bytes32 configHash = _validateAndHashPolicyConfig(config, bindings);
        bytes32 planHash = _compileInto(_compiledPlans[token], bindings, overrides_, config, configHash);
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
        _policyConfigHashes[token] = configHash;
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
        _scheduleManifestUpdate(token, m, bindings, overrides_, _emptyPolicyConfig(), reasonCode);
    }

    function scheduleManifestUpdate(
        address token,
        ManifestCore calldata m,
        RecipeBinding[] calldata bindings,
        ElementEnforcementOverride[] calldata overrides_,
        ManifestPolicyConfig calldata config,
        bytes32 reasonCode
    ) external onlyOwner {
        _scheduleManifestUpdate(token, m, bindings, overrides_, config, reasonCode);
    }

    function _scheduleManifestUpdate(
        address token,
        ManifestCore memory m,
        RecipeBinding[] memory bindings,
        ElementEnforcementOverride[] memory overrides_,
        ManifestPolicyConfig memory config,
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
        bytes32 configHash = _validateAndHashPolicyConfig(config, bindings);
        bytes32 planHash = _compileInto(_pendingCompiledPlans[token], bindings, overrides_, config, configHash);
        _pendingManifestUpdates[token] = PendingManifestUpdate(m, effectiveTime, reasonCode, planHash, configHash);
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
        _policyConfigHashes[token] = pending.configHash;
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
        return _compiledPlans[token][bindingIndex].rules;
    }

    function compiledParametersOf(address token, uint256 bindingIndex) external view returns (bytes[] memory values) {
        return _compiledPlans[token][bindingIndex].parameters;
    }

    function policyConfigHashOf(address token) external view returns (bytes32) {
        return _policyConfigHashes[token];
    }

    function pendingCompiledPlanHashOf(address token) external view returns (bytes32) {
        return _pendingManifestUpdates[token].planHash;
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
        ElementEnforcementOverride[] memory overrides_,
        ManifestPolicyConfig memory config,
        bytes32 configHash
    ) internal returns (bytes32 planHash) {
        if (overrides_.length > MAX_ENFORCEMENT_OVERRIDES) {
            revert Errors.TooManyEnforcementOverrides(overrides_.length, MAX_ENFORCEMENT_OVERRIDES);
        }
        _clearCompiled(target);
        bytes32 acc = configHash;
        for (uint256 i = 0; i < bindings.length; i++) {
            bytes32 bindingPlanHash = _compileBinding(target, bindings[i], i, overrides_, config);
            acc = keccak256(abi.encode(acc, bindingPlanHash));
        }
        _rejectOutOfRangeOverrides(overrides_, bindings.length);
        return acc;
    }

    function _compileBinding(
        CompiledBindingPlan[] storage target,
        RecipeBinding memory binding,
        uint256 bindingIndex,
        ElementEnforcementOverride[] memory overrides_,
        ManifestPolicyConfig memory config
    ) internal returns (bytes32 bindingPlanHash) {
        (bytes32 recipeKey, bytes32[] memory required) = _recipeElements(binding);
        if (required.length == 0 || required.length > MAX_ELEMENTS_PER_RECIPE) {
            revert Errors.TooManyRecipeElements(binding.recipeId, required.length, MAX_ELEMENTS_PER_RECIPE);
        }
        CompiledElementRule[] memory rules = new CompiledElementRule[](required.length);
        bytes[] memory parameters = new bytes[](required.length);
        for (uint256 i = 0; i < required.length; i++) {
            (rules[i], parameters[i]) = _compileElement(overrides_, config, bindingIndex, required[i]);
        }
        _rejectUnusedOrDuplicateOverrides(overrides_, bindingIndex, required);
        _rejectUnknownParameters(config, bindingIndex, required);
        bindingPlanHash = keccak256(abi.encode(binding, recipeKey, rules, parameters));
        _pushCompiled(target, binding, recipeKey, bindingPlanHash, rules, parameters);
    }

    function _recipeElements(RecipeBinding memory binding)
        internal
        view
        returns (bytes32 recipeKey, bytes32[] memory required)
    {
        recipeKey = recipeReg.recipeKeyOf(binding.recipeId);
        address recipeAddress = recipeReg.recipeOf(binding.recipeId, binding.recipeVersion);
        if (recipeAddress == address(0) || recipeKey == bytes32(0)) {
            revert Errors.RecipeNotRegistered(binding.recipeId);
        }
        IRecipe recipe = IRecipe(recipeAddress);
        uint16 actualVersion = recipe.version();
        if (actualVersion != binding.recipeVersion || recipe.recipeId() != binding.recipeId) {
            revert Errors.RecipeVersionMismatch(binding.recipeId, binding.recipeVersion, actualVersion);
        }
        required = recipe.requiredElements();
    }

    function _compileElement(
        ElementEnforcementOverride[] memory overrides_,
        ManifestPolicyConfig memory config,
        uint256 bindingIndex,
        bytes32 elementId
    ) internal view returns (CompiledElementRule memory rule, bytes memory parameters) {
        if (elementReg.elementOf(elementId) == address(0)) {
            revert Errors.ElementNotRegistered(elementId);
        }
        rule = CompiledElementRule(
            elementId, _compiledAction(overrides_, bindingIndex, elementId, elementReg.defaultActionOf(elementId))
        );
        parameters = _parameterFor(config, bindingIndex, elementId, elementReg.metadataOf(elementId));
    }

    function _pushCompiled(
        CompiledBindingPlan[] storage target,
        RecipeBinding memory binding,
        bytes32 recipeKey,
        bytes32 bindingPlanHash,
        CompiledElementRule[] memory rules,
        bytes[] memory parameters
    ) internal {
        target.push();
        CompiledBindingPlan storage stored = target[target.length - 1];
        stored.binding = binding;
        stored.recipeKey = recipeKey;
        stored.planHash = bindingPlanHash;
        for (uint256 i = 0; i < rules.length; i++) {
            stored.rules.push(rules[i]);
            stored.parameters.push(parameters[i]);
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

    function _validateAndHashPolicyConfig(ManifestPolicyConfig memory config, RecipeBinding[] memory bindings)
        internal
        pure
        returns (bytes32)
    {
        if (config.schemaVersion != POLICY_CONFIG_SCHEMA_VERSION) revert Errors.InvalidPolicyConfig();
        if (config.elementParameters.length > MAX_POLICY_PARAMETERS) {
            revert Errors.TooManyPolicyParameters(config.elementParameters.length, MAX_POLICY_PARAMETERS);
        }
        uint256 totalBytes;
        for (uint256 i = 0; i < config.elementParameters.length; i++) {
            ElementPolicyParameter memory item = config.elementParameters[i];
            if (item.bindingIndex >= bindings.length || item.elementId == bytes32(0)) {
                revert Errors.InvalidPolicyParameter(item.bindingIndex, item.elementId);
            }
            totalBytes += item.parameters.length;
            if (totalBytes > MAX_TOTAL_PARAMETER_BYTES) {
                revert Errors.PolicyParametersTooLarge(totalBytes, MAX_TOTAL_PARAMETER_BYTES);
            }
            for (uint256 j = 0; j < i; j++) {
                ElementPolicyParameter memory prior = config.elementParameters[j];
                if (prior.bindingIndex == item.bindingIndex && prior.elementId == item.elementId) {
                    revert Errors.DuplicatePolicyParameter(item.bindingIndex, item.elementId);
                }
            }
        }
        return keccak256(abi.encode(POLICY_CONFIG_DOMAIN, config));
    }

    function _parameterFor(
        ManifestPolicyConfig memory config,
        uint256 bindingIndex,
        bytes32 elementId,
        ElementMetadata memory metadata
    ) internal pure returns (bytes memory) {
        for (uint256 i = 0; i < config.elementParameters.length; i++) {
            ElementPolicyParameter memory item = config.elementParameters[i];
            if (item.bindingIndex != bindingIndex || item.elementId != elementId) continue;
            if (
                metadata.parameterSchemaId == bytes32(0) || item.schemaId != metadata.parameterSchemaId
                    || item.schemaVersion != metadata.parameterSchemaVersion || item.parameters.length == 0
                    || item.parameters.length > metadata.maxParameterBytes
            ) revert Errors.InvalidPolicyParameter(bindingIndex, elementId);
            return item.parameters;
        }
        if (metadata.parametersRequired) revert Errors.InvalidPolicyParameter(bindingIndex, elementId);
        return bytes("");
    }

    function _rejectUnknownParameters(
        ManifestPolicyConfig memory config,
        uint256 bindingIndex,
        bytes32[] memory required
    ) internal pure {
        for (uint256 i = 0; i < config.elementParameters.length; i++) {
            ElementPolicyParameter memory item = config.elementParameters[i];
            if (item.bindingIndex != bindingIndex) continue;
            bool found;
            for (uint256 j = 0; j < required.length; j++) {
                if (required[j] == item.elementId) found = true;
            }
            if (!found) revert Errors.InvalidPolicyParameter(bindingIndex, item.elementId);
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
                dst.parameters.push(source[i].parameters[j]);
            }
        }
    }

    function _emptyPolicyConfig() internal pure returns (ManifestPolicyConfig memory config) {
        config.schemaVersion = POLICY_CONFIG_SCHEMA_VERSION;
        config.elementParameters = new ElementPolicyParameter[](0);
    }

    function _readyTime() internal view returns (uint64) {
        return uint64(block.timestamp + MIN_MANIFEST_DELAY);
    }

    function _requireReady(uint64 readyAt) internal view {
        if (readyAt == 0) revert Errors.PendingActionNotFound();
        if (block.timestamp < readyAt) revert Errors.TimelockNotReady(readyAt);
    }
}
