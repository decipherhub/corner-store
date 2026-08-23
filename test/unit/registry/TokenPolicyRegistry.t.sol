// SPDX-License-Identifier: GPL-3.0
pragma solidity 0.8.17;

import {Test} from "forge-std/Test.sol";
import {TokenPolicyRegistry} from "../../../src/registry/TokenPolicyRegistry.sol";
import {ElementRegistry} from "../../../src/registry/ElementRegistry.sol";
import {RecipeRegistry} from "../../../src/registry/RecipeRegistry.sol";
import {IComplianceElement} from "../../../src/interfaces/compliance/IComplianceElement.sol";
import {IRecipe} from "../../../src/interfaces/compliance/IRecipe.sol";
import {
    ElementMetadata,
    ElementCategory,
    TemporalNature,
    Decidability,
    ObligationTiming,
    Statefulness,
    ManifestCore,
    PolicyStatus,
    RecipeBinding,
    RecipeBindingMode,
    EnforcementAction,
    EnforcementOverrideMode,
    ElementEnforcementOverride,
    CompiledElementRule
} from "../../../src/types/ComplianceTypes.sol";
import {Errors} from "../../../src/libraries/Errors.sol";
import {Events} from "../../../src/libraries/Events.sol";

contract TokenPolicyRegistryElementMock is IComplianceElement {
    bytes32 internal immutable _id;

    constructor(bytes32 id_) {
        _id = id_;
    }

    function check(address, address, address, uint256, bytes calldata) external pure returns (bool, bytes32) {
        return (true, bytes32(0));
    }

    function elementMetadata() external view returns (ElementMetadata memory m) {
        m.elementId = _id;
        m.category = ElementCategory.INVESTOR_ATTRIBUTE;
        m.version = "1.0.0";
        m.temporal = TemporalNature.ONE_TIME;
        m.decidability = Decidability.DETERMINISTIC;
        m.timing = ObligationTiming.AT_TRADE_GATE;
        m.statefulness = Statefulness.STATELESS;
    }
}

contract TokenPolicyRegistryRecipeMock is IRecipe {
    uint16 internal immutable _id;
    uint16 internal immutable _version;
    bytes32 internal immutable _elementId;

    constructor(uint16 id_, uint16 version_, bytes32 elementId_) {
        _id = id_;
        _version = version_;
        _elementId = elementId_;
    }

    function recipeId() external view returns (uint16) {
        return _id;
    }

    function version() external view returns (uint16) {
        return _version;
    }

    function isApplicable(bytes calldata) external pure returns (bool) {
        return true;
    }

    function requiredElements() external view returns (bytes32[] memory elements) {
        elements = new bytes32[](1);
        elements[0] = _elementId;
    }
}

contract TokenPolicyRegistryTest is Test {
    TokenPolicyRegistry internal reg;
    ElementRegistry internal elementReg;
    RecipeRegistry internal recipeReg;
    bytes32 internal constant ELEMENT_ID = bytes32("TP-ELEMENT-v1");

    address internal owner = address(this);
    address internal operator = address(0xBEEF);
    address internal stranger = address(0xDEAD);
    address internal token = address(0x7000);

    function setUp() public {
        _reset();
    }

    /// @dev A well-formed manifest whose caller-supplied status is deliberately
    ///      ACTIVE, to prove registerManifest ignores it and lands in PROPOSED.
    function _manifest() internal view returns (ManifestCore memory m) {
        m.status = PolicyStatus.ACTIVE;
        m.issuanceRecipeId = 7;
        m.issuanceRecipeVersion = 1;
        m.declaredBy = owner;
    }

    function _bindings() internal pure returns (RecipeBinding[] memory bindings) {
        bindings = new RecipeBinding[](1);
        bindings[0] = RecipeBinding(7, 1, RecipeBindingMode.REQUIRED_BLOCKING, 0, 100);
    }

    /// @dev Drive a token to ACTIVE the legal way (register -> approve).
    function _activate(address t) internal {
        reg.registerManifest(t, _manifest());
        vm.prank(operator);
        reg.approveManifest(t);
    }

    // --- baseline reads ---------------------------------------------------

    function test_unregistered_is_UNKNOWN() public {
        assertEq(uint256(reg.statusOf(token)), uint256(PolicyStatus.UNKNOWN));
    }

    // --- register ---------------------------------------------------------

    function test_register_lands_PROPOSED_ignoring_caller_status() public {
        ManifestCore memory m = _manifest(); // m.status == ACTIVE on purpose
        reg.registerManifest(token, m);

        ManifestCore memory got = reg.manifestOf(token);
        assertEq(uint256(got.status), uint256(PolicyStatus.PROPOSED), "always PROPOSED");
        assertEq(got.issuanceRecipeId, 7);
        assertEq(got.issuanceRecipeVersion, 1);
        assertEq(got.declaredBy, owner, "declaredBy = register caller");
        assertEq(got.approvedBy, address(0), "not yet approved");
        assertEq(uint256(reg.statusOf(token)), uint256(PolicyStatus.PROPOSED));
        assertEq(reg.manifestVersionOf(token), 1, "first semantic version");
        assertNotEq(reg.manifestHistoryHashOf(token), bytes32(0), "history anchored");
    }

    function test_register_records_caller_as_declaredBy() public {
        ManifestCore memory m = _manifest();
        m.declaredBy = stranger; // caller-supplied value must be overwritten
        reg.registerManifest(token, m);
        assertEq(reg.manifestOf(token).declaredBy, owner);
    }

    function test_registerManifest_reverts_for_non_owner() public {
        vm.prank(stranger);
        vm.expectRevert(); // Ownable: caller is not the owner
        reg.registerManifest(token, _manifest());
    }

    // --- approve ----------------------------------------------------------

    function test_approve_PROPOSED_to_ACTIVE_records_approver() public {
        reg.registerManifest(token, _manifest());
        vm.expectEmit(true, false, false, true);
        emit Events.ManifestStatusChanged(token, PolicyStatus.ACTIVE, bytes32(0));
        vm.prank(operator);
        reg.approveManifest(token);

        assertEq(uint256(reg.statusOf(token)), uint256(PolicyStatus.ACTIVE));
        assertEq(reg.manifestOf(token).approvedBy, operator, "approvedBy = approve caller");
    }

    function test_register_reverts_when_recipe_set_empty() public {
        RecipeBinding[] memory bindings = new RecipeBinding[](0);
        vm.expectRevert(Errors.InvalidRecipeBinding.selector);
        reg.registerManifest(token, _manifest(), bindings);
    }

    function test_register_rejects_oversized_binding_plan() public {
        RecipeBinding[] memory bindings = new RecipeBinding[](reg.MAX_RECIPE_BINDINGS() + 1);
        for (uint256 i = 0; i < bindings.length; i++) {
            bindings[i] =
                RecipeBinding(uint16(i + 1), 1, RecipeBindingMode.REQUIRED_BLOCKING, 0, uint8(bindings.length - i));
        }
        vm.expectRevert(
            abi.encodeWithSelector(Errors.TooManyRecipeBindings.selector, bindings.length, reg.MAX_RECIPE_BINDINGS())
        );
        reg.registerManifest(token, _manifest(), bindings);
    }

    function test_register_rejects_duplicate_recipe_binding() public {
        RecipeBinding[] memory bindings = new RecipeBinding[](2);
        bindings[0] = RecipeBinding(7, 1, RecipeBindingMode.REQUIRED_BLOCKING, 0, 100);
        bindings[1] = RecipeBinding(7, 1, RecipeBindingMode.FLAG_ONLY, 0, 10);
        vm.expectRevert(abi.encodeWithSelector(Errors.DuplicateRecipeBinding.selector, uint16(7)));
        reg.registerManifest(token, _manifest(), bindings);
    }

    function test_register_rejects_path_without_group() public {
        RecipeBinding[] memory bindings = new RecipeBinding[](1);
        bindings[0] = RecipeBinding(7, 1, RecipeBindingMode.PATH_OPTION, 0, 100);
        vm.expectRevert(Errors.InvalidRecipeBinding.selector);
        reg.registerManifest(token, _manifest(), bindings);
    }

    function test_register_rejects_flagOnly_plan_without_blocking_gate() public {
        RecipeBinding[] memory bindings = new RecipeBinding[](1);
        bindings[0] = RecipeBinding(7, 1, RecipeBindingMode.FLAG_ONLY, 0, 10);
        vm.expectRevert(Errors.InvalidRecipeBinding.selector);
        reg.registerManifest(token, _manifest(), bindings);
    }

    function test_register_stores_recipeBindings() public {
        RecipeBinding[] memory expected = _bindings();
        reg.registerManifest(token, _manifest(), expected);
        RecipeBinding[] memory actual = reg.recipeBindingsOf(token);
        assertEq(keccak256(abi.encode(actual)), keccak256(abi.encode(expected)));
    }

    function test_approve_reverts_for_non_operator() public {
        reg.registerManifest(token, _manifest());
        vm.prank(stranger);
        vm.expectRevert(Errors.NotAuthorized.selector);
        reg.approveManifest(token);
    }

    // --- suspend / resume -------------------------------------------------

    function test_suspend_ACTIVE_to_SUSPENDED() public {
        _activate(token);
        bytes32 reason = bytes32("HALT");
        vm.expectEmit(true, false, false, true);
        emit Events.ManifestStatusChanged(token, PolicyStatus.SUSPENDED, reason);
        vm.prank(operator);
        reg.suspendManifest(token, reason);
        assertEq(uint256(reg.statusOf(token)), uint256(PolicyStatus.SUSPENDED));
    }

    function test_resume_SUSPENDED_to_ACTIVE() public {
        _activate(token);
        vm.prank(operator);
        reg.suspendManifest(token, bytes32("HALT"));
        reg.scheduleManifestResume(token, bytes32("RECOVERED"));
        vm.warp(block.timestamp + reg.MIN_MANIFEST_DELAY());
        vm.startPrank(operator);
        vm.expectEmit(true, false, false, true);
        emit Events.ManifestStatusChanged(token, PolicyStatus.ACTIVE, bytes32("RECOVERED"));
        reg.resumeManifest(token);
        vm.stopPrank();
        assertEq(uint256(reg.statusOf(token)), uint256(PolicyStatus.ACTIVE));
    }

    function test_resume_requiresScheduleAndDelay() public {
        _activate(token);
        vm.prank(operator);
        reg.suspendManifest(token, bytes32("HALT"));

        vm.prank(operator);
        vm.expectRevert(Errors.PendingActionNotFound.selector);
        reg.resumeManifest(token);

        reg.scheduleManifestResume(token, bytes32("RECOVERED"));
        vm.prank(operator);
        vm.expectPartialRevert(Errors.TimelockNotReady.selector);
        reg.resumeManifest(token);
    }

    function test_suspend_reverts_for_non_operator() public {
        _activate(token);
        vm.prank(stranger);
        vm.expectRevert(Errors.NotAuthorized.selector);
        reg.suspendManifest(token, bytes32("HALT"));
    }

    function test_resume_reverts_for_non_operator() public {
        _activate(token);
        vm.prank(operator);
        reg.suspendManifest(token, bytes32("HALT"));
        vm.prank(stranger);
        vm.expectRevert(Errors.NotAuthorized.selector);
        reg.resumeManifest(token);
    }

    function test_resume_schedule_reverts_for_non_owner() public {
        _activate(token);
        vm.prank(operator);
        reg.suspendManifest(token, bytes32("HALT"));
        vm.prank(operator);
        vm.expectRevert("Ownable: caller is not the owner");
        reg.scheduleManifestResume(token, bytes32("RECOVERED"));
    }

    function test_resume_cancelInvalidatesPendingResume() public {
        _activate(token);
        vm.prank(operator);
        reg.suspendManifest(token, bytes32("HALT"));
        reg.scheduleManifestResume(token, bytes32("RECOVERED"));
        reg.cancelManifestResume(token);
        vm.warp(block.timestamp + reg.MIN_MANIFEST_DELAY());
        vm.prank(operator);
        vm.expectRevert(Errors.PendingActionNotFound.selector);
        reg.resumeManifest(token);
        assertEq(uint256(reg.statusOf(token)), uint256(PolicyStatus.SUSPENDED));
    }

    // --- retire -----------------------------------------------------------

    function test_retire_from_ACTIVE() public {
        _activate(token);
        bytes32 reason = bytes32("EOL");
        vm.expectEmit(true, false, false, true);
        emit Events.ManifestStatusChanged(token, PolicyStatus.RETIRED, reason);
        vm.prank(operator);
        reg.retireManifest(token, reason);
        assertEq(uint256(reg.statusOf(token)), uint256(PolicyStatus.RETIRED));
    }

    function test_retire_from_SUSPENDED() public {
        _activate(token);
        vm.startPrank(operator);
        reg.suspendManifest(token, bytes32("HALT"));
        reg.retireManifest(token, bytes32("EOL"));
        vm.stopPrank();
        assertEq(uint256(reg.statusOf(token)), uint256(PolicyStatus.RETIRED));
    }

    function test_retire_reverts_for_non_operator() public {
        _activate(token);
        vm.prank(stranger);
        vm.expectRevert(Errors.NotAuthorized.selector);
        reg.retireManifest(token, bytes32("EOL"));
    }

    // --- re-registration --------------------------------------------------

    function test_reregister_from_RETIRED_ok() public {
        _activate(token);
        vm.prank(operator);
        reg.retireManifest(token, bytes32("EOL"));
        // Re-issue: allowed from RETIRED, lands PROPOSED again with a fresh slate.
        reg.registerManifest(token, _manifest());
        assertEq(uint256(reg.statusOf(token)), uint256(PolicyStatus.PROPOSED));
        assertEq(reg.manifestOf(token).approvedBy, address(0), "approver cleared on re-register");
        assertEq(reg.manifestVersionOf(token), 2, "reissue increments semantic version");
    }

    function test_reregister_from_PROPOSED_reverts() public {
        reg.registerManifest(token, _manifest());
        vm.expectRevert(Errors.InvalidManifestTransition.selector);
        reg.registerManifest(token, _manifest());
    }

    function test_reregister_from_ACTIVE_reverts() public {
        _activate(token);
        vm.expectRevert(Errors.InvalidManifestTransition.selector);
        reg.registerManifest(token, _manifest());
    }

    function test_reregister_over_UNREGULATED_reverts() public {
        reg.setUnregulated(token);
        vm.expectRevert(Errors.InvalidManifestTransition.selector);
        reg.registerManifest(token, _manifest());
    }

    // --- setUnregulated ---------------------------------------------------

    function test_setUnregulated_from_UNKNOWN() public {
        vm.expectEmit(true, false, false, true);
        emit Events.ManifestStatusChanged(token, PolicyStatus.UNREGULATED, bytes32(0));
        reg.setUnregulated(token);
        assertEq(uint256(reg.statusOf(token)), uint256(PolicyStatus.UNREGULATED));
    }

    function test_setUnregulated_reverts_when_not_UNKNOWN() public {
        reg.registerManifest(token, _manifest()); // now PROPOSED
        vm.expectRevert(Errors.InvalidManifestTransition.selector);
        reg.setUnregulated(token);
    }

    function test_setUnregulated_reverts_for_non_owner() public {
        vm.prank(stranger);
        vm.expectRevert(); // Ownable: caller is not the owner
        reg.setUnregulated(token);
    }

    /// @dev setUnregulated is onlyOwner, NOT onlyOperator: a mere operator (not
    ///      the owner) must be rejected, proving the classification/lifecycle
    ///      gate distinction.
    function test_setUnregulated_reverts_for_operator() public {
        vm.prank(operator);
        vm.expectRevert(); // Ownable: operator is not the owner
        reg.setUnregulated(token);
    }

    // --- clearUnregulated -------------------------------------------------

    function test_clearUnregulated_from_UNREGULATED() public {
        reg.setUnregulated(token); // UNKNOWN -> UNREGULATED
        vm.expectEmit(true, false, false, true);
        emit Events.ManifestStatusChanged(token, PolicyStatus.UNKNOWN, bytes32(0));
        reg.clearUnregulated(token);
        assertEq(uint256(reg.statusOf(token)), uint256(PolicyStatus.UNKNOWN));
    }

    /// @dev After clearing, the token is a clean slate again and can be declared
    ///      as a regulated manifest (lands PROPOSED).
    function test_clearUnregulated_then_register_ok() public {
        reg.setUnregulated(token);
        reg.clearUnregulated(token);
        reg.registerManifest(token, _manifest());
        assertEq(uint256(reg.statusOf(token)), uint256(PolicyStatus.PROPOSED));
    }

    function test_clearUnregulated_reverts_when_UNKNOWN() public {
        // never tagged → still UNKNOWN → illegal.
        vm.expectRevert(Errors.InvalidManifestTransition.selector);
        reg.clearUnregulated(token);
    }

    function test_clearUnregulated_reverts_when_PROPOSED() public {
        reg.registerManifest(token, _manifest()); // PROPOSED
        vm.expectRevert(Errors.InvalidManifestTransition.selector);
        reg.clearUnregulated(token);
    }

    function test_clearUnregulated_reverts_when_ACTIVE() public {
        _activate(token);
        vm.expectRevert(Errors.InvalidManifestTransition.selector);
        reg.clearUnregulated(token);
    }

    function test_clearUnregulated_reverts_for_non_owner() public {
        reg.setUnregulated(token);
        vm.prank(stranger);
        vm.expectRevert(); // Ownable: caller is not the owner
        reg.clearUnregulated(token);
    }

    /// @dev clearUnregulated is onlyOwner, NOT onlyOperator: an operator (not the
    ///      owner) must be rejected, symmetric with setUnregulated.
    function test_clearUnregulated_reverts_for_operator() public {
        reg.setUnregulated(token);
        vm.prank(operator);
        vm.expectRevert(); // Ownable: operator is not the owner
        reg.clearUnregulated(token);
    }

    // --- illegal-transition table -----------------------------------------

    /// @dev Move `token` into `from`, then assert the named mutator reverts
    ///      InvalidManifestTransition. Encodes every illegal (state, action)
    ///      pair for approve/suspend/resume/retire across all six states.
    function _seed(PolicyStatus from) internal {
        if (from == PolicyStatus.UNKNOWN) {
            return;
        } else if (from == PolicyStatus.UNREGULATED) {
            reg.setUnregulated(token);
        } else if (from == PolicyStatus.PROPOSED) {
            reg.registerManifest(token, _manifest());
        } else if (from == PolicyStatus.ACTIVE) {
            _activate(token);
        } else if (from == PolicyStatus.SUSPENDED) {
            _activate(token);
            vm.prank(operator);
            reg.suspendManifest(token, bytes32("HALT"));
        } else if (from == PolicyStatus.RETIRED) {
            _activate(token);
            vm.prank(operator);
            reg.retireManifest(token, bytes32("EOL"));
        }
    }

    function test_illegalTransitions_allRevert() public {
        // approve is legal ONLY from PROPOSED.
        PolicyStatus[5] memory approveFrom = [
            PolicyStatus.UNKNOWN,
            PolicyStatus.UNREGULATED,
            PolicyStatus.ACTIVE,
            PolicyStatus.SUSPENDED,
            PolicyStatus.RETIRED
        ];
        for (uint256 i = 0; i < approveFrom.length; i++) {
            _seed(approveFrom[i]);
            vm.prank(operator);
            vm.expectRevert(Errors.InvalidManifestTransition.selector);
            reg.approveManifest(token);
            _reset();
        }

        // suspend is legal ONLY from ACTIVE.
        PolicyStatus[5] memory suspendFrom = [
            PolicyStatus.UNKNOWN,
            PolicyStatus.UNREGULATED,
            PolicyStatus.PROPOSED,
            PolicyStatus.SUSPENDED,
            PolicyStatus.RETIRED
        ];
        for (uint256 i = 0; i < suspendFrom.length; i++) {
            _seed(suspendFrom[i]);
            vm.prank(operator);
            vm.expectRevert(Errors.InvalidManifestTransition.selector);
            reg.suspendManifest(token, bytes32("HALT"));
            _reset();
        }

        // resume is legal ONLY from SUSPENDED.
        PolicyStatus[5] memory resumeFrom = [
            PolicyStatus.UNKNOWN,
            PolicyStatus.UNREGULATED,
            PolicyStatus.PROPOSED,
            PolicyStatus.ACTIVE,
            PolicyStatus.RETIRED
        ];
        for (uint256 i = 0; i < resumeFrom.length; i++) {
            _seed(resumeFrom[i]);
            vm.prank(operator);
            vm.expectRevert(Errors.InvalidManifestTransition.selector);
            reg.resumeManifest(token);
            _reset();
        }

        // retire is legal ONLY from ACTIVE or SUSPENDED.
        PolicyStatus[4] memory retireFrom =
            [PolicyStatus.UNKNOWN, PolicyStatus.UNREGULATED, PolicyStatus.PROPOSED, PolicyStatus.RETIRED];
        for (uint256 i = 0; i < retireFrom.length; i++) {
            _seed(retireFrom[i]);
            vm.prank(operator);
            vm.expectRevert(Errors.InvalidManifestTransition.selector);
            reg.retireManifest(token, bytes32("EOL"));
            _reset();
        }
    }

    /// @dev Fresh registry between table iterations so `token` is UNKNOWN again.
    function _reset() internal {
        elementReg = new ElementRegistry();
        recipeReg = new RecipeRegistry();
        elementReg.registerElement(ELEMENT_ID, address(new TokenPolicyRegistryElementMock(ELEMENT_ID)));
        recipeReg.registerRecipe(7, 1, address(new TokenPolicyRegistryRecipeMock(7, 1, ELEMENT_ID)));
        recipeReg.registerRecipe(7, 2, address(new TokenPolicyRegistryRecipeMock(7, 2, ELEMENT_ID)));
        recipeReg.registerRecipe(8, 2, address(new TokenPolicyRegistryRecipeMock(8, 2, ELEMENT_ID)));
        reg = new TokenPolicyRegistry(recipeReg, elementReg);
        reg.setOperator(operator, true);
    }

    // --- setFact (unchanged strengthen-only behavior) ---------------------

    function test_setFact_strengthen_ok() public {
        reg.registerManifest(token, _manifest());
        vm.startPrank(operator);
        reg.setFact(token, 0x0F); // 0000_1111
        reg.setFact(token, 0x1F); // superset: 0001_1111
        vm.stopPrank();
        assertEq(reg.manifestOf(token).factsPacked, 0x1F);
    }

    function test_setFact_loosen_reverts() public {
        reg.registerManifest(token, _manifest());
        vm.startPrank(operator);
        reg.setFact(token, 0x0F);
        vm.expectRevert(Errors.LooseningForbidden.selector);
        reg.setFact(token, 0x07); // drops a bit -> not a superset
        vm.stopPrank();
    }

    function test_setFact_reverts_for_non_operator() public {
        reg.registerManifest(token, _manifest());
        vm.prank(stranger);
        vm.expectRevert(Errors.NotAuthorized.selector);
        reg.setFact(token, 0x0F);
    }

    // --- compiled enforcement plans ---------------------------------------

    function test_register_compiles_deterministic_plan_hash_and_rules() public {
        RecipeBinding[] memory bindings = _bindings();
        reg.registerManifest(token, _manifest(), bindings);
        bytes32 firstHash = reg.compiledPlanHashOf(token);
        assertTrue(firstHash != bytes32(0));
        assertEq(reg.compiledBindingCountOf(token), 1);
        (RecipeBinding memory binding, bytes32 recipeKey, bytes32 bindingPlanHash) = reg.compiledBindingOf(token, 0);
        assertEq(binding.recipeId, 7);
        assertEq(recipeKey, recipeReg.recipeKeyOf(7));
        assertTrue(bindingPlanHash != bytes32(0));
        CompiledElementRule[] memory rules = reg.compiledRulesOf(token, 0);
        assertEq(rules.length, 1);
        assertEq(rules[0].elementId, ELEMENT_ID);
        assertEq(uint256(rules[0].action), uint256(EnforcementAction.BLOCK));

        address token2 = address(0x7001);
        reg.registerManifest(token2, _manifest(), bindings);
        assertEq(reg.compiledPlanHashOf(token2), firstHash, "same bindings compile deterministically");
    }

    function test_overrides_reject_length_above_bounded_limit_before_compilation() public {
        ElementEnforcementOverride[] memory tooMany =
            new ElementEnforcementOverride[](reg.MAX_ENFORCEMENT_OVERRIDES() + 1);
        for (uint256 i = 0; i < tooMany.length; i++) {
            tooMany[i] = ElementEnforcementOverride(0, ELEMENT_ID, EnforcementOverrideMode.ESCALATE_TO_BLOCK);
        }
        RecipeBinding[] memory missingRecipeBinding = new RecipeBinding[](1);
        missingRecipeBinding[0] = RecipeBinding(77, 1, RecipeBindingMode.REQUIRED_BLOCKING, 0, 100);

        vm.expectRevert(
            abi.encodeWithSelector(
                Errors.TooManyEnforcementOverrides.selector, tooMany.length, reg.MAX_ENFORCEMENT_OVERRIDES()
            )
        );
        reg.registerManifest(token, _manifest(), missingRecipeBinding, tooMany);
    }

    function test_overrides_reject_duplicate_nonmember_outOfRange_and_weakening() public {
        ElementEnforcementOverride[] memory dup = new ElementEnforcementOverride[](2);
        dup[0] = ElementEnforcementOverride(0, ELEMENT_ID, EnforcementOverrideMode.ESCALATE_TO_BLOCK);
        dup[1] = ElementEnforcementOverride(0, ELEMENT_ID, EnforcementOverrideMode.ESCALATE_TO_BLOCK);
        vm.expectRevert(abi.encodeWithSelector(Errors.DuplicateElementOverride.selector, uint256(0), ELEMENT_ID));
        reg.registerManifest(token, _manifest(), _bindings(), dup);

        ElementEnforcementOverride[] memory nonmember = new ElementEnforcementOverride[](1);
        nonmember[0] = ElementEnforcementOverride(0, bytes32("NOPE"), EnforcementOverrideMode.ESCALATE_TO_BLOCK);
        vm.expectRevert(Errors.InvalidEnforcementOverride.selector);
        reg.registerManifest(token, _manifest(), _bindings(), nonmember);

        ElementEnforcementOverride[] memory outOfRange = new ElementEnforcementOverride[](1);
        outOfRange[0] = ElementEnforcementOverride(1, ELEMENT_ID, EnforcementOverrideMode.ESCALATE_TO_BLOCK);
        vm.expectRevert(Errors.InvalidEnforcementOverride.selector);
        reg.registerManifest(token, _manifest(), _bindings(), outOfRange);

        ElementEnforcementOverride[] memory weak = new ElementEnforcementOverride[](1);
        weak[0] = ElementEnforcementOverride(0, ELEMENT_ID, EnforcementOverrideMode.FORCE_FLAG_ONLY);
        vm.expectRevert(Errors.LooseningForbidden.selector);
        reg.registerManifest(token, _manifest(), _bindings(), weak);
    }

    function test_forceFlagOnly_allowed_only_when_element_default_is_flagOnly() public {
        bytes32 flagElement = bytes32("TP-FLAG-v1");
        elementReg.registerElement(
            flagElement, address(new TokenPolicyRegistryElementMock(flagElement)), EnforcementAction.FLAG_ONLY
        );
        recipeReg.registerRecipe(9, 1, address(new TokenPolicyRegistryRecipeMock(9, 1, flagElement)));
        RecipeBinding[] memory bindings = new RecipeBinding[](1);
        bindings[0] = RecipeBinding(9, 1, RecipeBindingMode.REQUIRED_BLOCKING, 0, 100);
        ElementEnforcementOverride[] memory overrides_ = new ElementEnforcementOverride[](1);
        overrides_[0] = ElementEnforcementOverride(0, flagElement, EnforcementOverrideMode.FORCE_FLAG_ONLY);
        reg.registerManifest(token, _manifest(), bindings, overrides_);
        CompiledElementRule[] memory rules = reg.compiledRulesOf(token, 0);
        assertEq(uint256(rules[0].action), uint256(EnforcementAction.FLAG_ONLY));
    }

    // --- delayed semantic update -----------------------------------------

    function test_manifestUpdate_activatesAfterDelayAndIncrementsVersion() public {
        ManifestCore memory initial = _manifest();
        initial.fullManifestHash = keccak256("manifest-v1");
        reg.registerManifest(token, initial);
        vm.prank(operator);
        reg.approveManifest(token);
        bytes32 historyBefore = reg.manifestHistoryHashOf(token);

        ManifestCore memory next = initial;
        next.issuanceRecipeVersion = 2;
        next.fullManifestHash = keccak256("manifest-v2");
        reg.scheduleManifestUpdate(token, next, bytes32("REGULATORY_UPDATE"));

        (,, uint64 effectiveTime, bytes32 reasonCode) = reg.pendingManifestUpdateOf(token);
        assertEq(reasonCode, bytes32("REGULATORY_UPDATE"));
        vm.prank(operator);
        vm.expectPartialRevert(Errors.TimelockNotReady.selector);
        reg.activateManifestUpdate(token);

        vm.warp(effectiveTime);
        vm.prank(operator);
        reg.activateManifestUpdate(token);

        assertEq(reg.manifestVersionOf(token), 2);
        assertEq(reg.manifestOf(token).fullManifestHash, next.fullManifestHash);
        assertEq(uint256(reg.statusOf(token)), uint256(PolicyStatus.ACTIVE));
        assertNotEq(reg.manifestHistoryHashOf(token), historyBefore);
    }

    function test_manifestUpdate_changesBindingsOnlyAfterActivation() public {
        ManifestCore memory initial = _manifest();
        initial.fullManifestHash = keccak256("manifest-v1");
        RecipeBinding[] memory oldBindings = _bindings();
        reg.registerManifest(token, initial, oldBindings);
        vm.prank(operator);
        reg.approveManifest(token);

        ManifestCore memory next = initial;
        next.fullManifestHash = keccak256("manifest-v2");
        RecipeBinding[] memory nextBindings = new RecipeBinding[](2);
        nextBindings[0] = oldBindings[0];
        nextBindings[1] = RecipeBinding(8, 2, RecipeBindingMode.FLAG_ONLY, 0, 10);
        reg.scheduleManifestUpdate(token, next, nextBindings, bytes32("BINDING_UPDATE"));

        assertEq(keccak256(abi.encode(reg.recipeBindingsOf(token))), keccak256(abi.encode(oldBindings)));
        (, RecipeBinding[] memory pending, uint64 effectiveTime,) = reg.pendingManifestUpdateOf(token);
        assertEq(keccak256(abi.encode(pending)), keccak256(abi.encode(nextBindings)));

        vm.warp(effectiveTime);
        vm.prank(operator);
        reg.activateManifestUpdate(token);
        assertEq(keccak256(abi.encode(reg.recipeBindingsOf(token))), keccak256(abi.encode(nextBindings)));
        assertEq(reg.manifestVersionOf(token), 2);
    }

    function test_manifestUpdate_preservesSuspendedState() public {
        ManifestCore memory initial = _manifest();
        initial.fullManifestHash = keccak256("manifest-v1");
        reg.registerManifest(token, initial);
        vm.startPrank(operator);
        reg.approveManifest(token);
        reg.suspendManifest(token, bytes32("INCIDENT"));
        vm.stopPrank();

        ManifestCore memory next = initial;
        next.fullManifestHash = keccak256("manifest-v2");
        reg.scheduleManifestUpdate(token, next, bytes32("RECIPE_UPDATE"));
        vm.warp(block.timestamp + reg.MIN_MANIFEST_DELAY());
        vm.prank(operator);
        reg.activateManifestUpdate(token);
        assertEq(uint256(reg.statusOf(token)), uint256(PolicyStatus.SUSPENDED));
    }

    function test_manifestUpdate_rejectsMissingOrUnchangedHash() public {
        _activate(token);
        ManifestCore memory next = _manifest();
        vm.expectRevert(Errors.InvalidManifestHash.selector);
        reg.scheduleManifestUpdate(token, next, bytes32("RECIPE_UPDATE"));
    }

    function test_manifestUpdate_scheduleRevertsForNonOwner() public {
        _activate(token);
        ManifestCore memory next = _manifest();
        next.fullManifestHash = keccak256("manifest-v2");
        vm.prank(operator);
        vm.expectRevert("Ownable: caller is not the owner");
        reg.scheduleManifestUpdate(token, next, bytes32("RECIPE_UPDATE"));
    }

    function test_manifestUpdate_cancelPreservesManifestAndVersion() public {
        ManifestCore memory initial = _manifest();
        initial.fullManifestHash = keccak256("manifest-v1");
        bytes32 initialHash = initial.fullManifestHash;
        reg.registerManifest(token, initial);
        vm.prank(operator);
        reg.approveManifest(token);

        ManifestCore memory next = initial;
        next.fullManifestHash = keccak256("manifest-v2");
        reg.scheduleManifestUpdate(token, next, bytes32("RECIPE_UPDATE"));
        reg.cancelManifestUpdate(token);
        vm.warp(block.timestamp + reg.MIN_MANIFEST_DELAY());
        vm.prank(operator);
        vm.expectRevert(Errors.PendingActionNotFound.selector);
        reg.activateManifestUpdate(token);

        assertEq(reg.manifestVersionOf(token), 1);
        assertEq(reg.manifestOf(token).fullManifestHash, initialHash);
        assertEq(uint256(reg.statusOf(token)), uint256(PolicyStatus.ACTIVE));
    }

    function test_setFact_revertsWhenActive_toPreventTimelockBypass() public {
        _activate(token);
        vm.prank(operator);
        vm.expectRevert(Errors.InvalidManifestTransition.selector);
        reg.setFact(token, 0x0F);
    }

    function test_setFact_revertsWhenRetired_toPreserveHistory() public {
        _activate(token);
        vm.prank(operator);
        reg.retireManifest(token, bytes32("EOL"));
        vm.prank(operator);
        vm.expectRevert(Errors.InvalidManifestTransition.selector);
        reg.setFact(token, 0x0F);
    }
}
