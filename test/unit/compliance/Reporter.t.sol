// SPDX-License-Identifier: GPL-3.0
pragma solidity 0.8.17;

import {Test} from "forge-std/Test.sol";
import {ComplianceEngine} from "../../../src/compliance/ComplianceEngine.sol";
import {ComplianceReporter} from "../../../src/compliance/ComplianceReporter.sol";
import {ElementRegistry} from "../../../src/registry/ElementRegistry.sol";
import {RecipeRegistry} from "../../../src/registry/RecipeRegistry.sol";
import {TokenPolicyRegistry} from "../../../src/registry/TokenPolicyRegistry.sol";
import {BaseElement} from "../../../src/compliance/elements/BaseElement.sol";
import {MinimumTradeAmount} from "../../../src/compliance/elements/MinimumTradeAmount.sol";
import {
    ComplianceContext,
    ComplianceDecision,
    ManifestCore,
    PolicyStatus,
    RecipeBinding,
    RecipeBindingMode,
    ElementMetadata,
    ElementCategory,
    TemporalNature,
    Decidability,
    ObligationTiming,
    Statefulness,
    EnforcementAction,
    EvidenceType,
    VenueType,
    ManifestPolicyConfig,
    ElementPolicyParameter,
    ElementEnforcementOverride
} from "../../../src/types/ComplianceTypes.sol";
import {ComplianceReport, RequirementStatus} from "../../../src/types/ComplianceReportTypes.sol";
import {ReasonCodes} from "../../../src/libraries/ReasonCodes.sol";

contract ReporterElement is BaseElement {
    mapping(address => uint8) public outcomes;
    mapping(address => uint8) public subjectOutcomes;
    bool public zeroReason;

    constructor(bytes32 id, EnforcementAction action)
        BaseElement(ElementMetadata({
                elementId: id,
                category: ElementCategory.INVESTOR_ATTRIBUTE,
                version: "1.0.0",
                temporal: TemporalNature.REALTIME,
                decidability: Decidability.DETERMINISTIC,
                timing: ObligationTiming.AT_TRADE_GATE,
                statefulness: Statefulness.STATELESS,
                evidenceType: EvidenceType.TRANSACTION_CONTEXT,
                defaultEnforcement: action,
                parameterSchemaId: bytes32(0),
                parameterSchemaVersion: 0,
                maxParameterBytes: 0,
                parametersRequired: false
            }))
    {}

    function setOutcome(address token, uint8 outcome) external {
        outcomes[token] = outcome;
    }

    function setSubjectOutcome(address subject, uint8 outcome) external {
        subjectOutcomes[subject] = outcome;
    }

    function setZeroReason() external {
        zeroReason = true;
    }

    function _check(
        address buyer,
        address seller,
        address token,
        uint256 amount,
        bytes calldata context,
        bytes calldata
    ) internal view override returns (bool, bytes32) {
        ComplianceContext memory ctx = abi.decode(context, (ComplianceContext));
        require(buyer == ctx.buyer && seller == ctx.seller, "wrong subjects");
        require(amount == (token == ctx.tokenOut ? ctx.amountOut : ctx.amountIn), "wrong leg amount");
        uint8 outcome = outcomes[token] == 0 ? subjectOutcomes[buyer] : outcomes[token];
        require(outcome != 2, "private provider error");
        bool passed = outcome == 0;
        return (passed, passed || zeroReason ? bytes32(0) : ReasonCodes.encode(0, _meta.elementId, 7));
    }
}

contract ReporterRecipe {
    uint16 public recipeId;
    uint16 public constant version = 1;
    bytes32[] private elements;
    uint8 public applicability;

    constructor(uint16 id, bytes32[] memory ids) {
        recipeId = id;
        elements = ids;
    }

    function requiredElements() external view returns (bytes32[] memory) {
        return elements;
    }

    function setApplicability(uint8 value) external {
        applicability = value;
    }

    function isApplicable(bytes calldata) external view returns (bool) {
        require(applicability != 2, "private applicability error");
        return applicability == 0;
    }
}

contract ReporterTest is Test {
    ElementRegistry private elements;
    RecipeRegistry private recipes;
    TokenPolicyRegistry private policies;
    ComplianceEngine private engine;
    ComplianceReporter private reporter;
    ReporterElement private first;
    ReporterElement private second;
    address private constant RWA = address(0x100);
    address private constant OTHER = address(0x200);
    bytes32 private constant FIRST = "A-03-v1";
    bytes32 private constant SECOND = "A-13-v1";

    function setUp() public {
        elements = new ElementRegistry();
        recipes = new RecipeRegistry();
        policies = new TokenPolicyRegistry(recipes, elements);
        engine = new ComplianceEngine(policies, elements, recipes);
        reporter = new ComplianceReporter(engine);
        first = _element(FIRST, EnforcementAction.BLOCK);
        second = _element(SECOND, EnforcementAction.BLOCK);
    }

    function _element(bytes32 id, EnforcementAction action) private returns (ReporterElement element) {
        element = new ReporterElement(id, action);
        elements.registerElement(id, address(element));
    }

    function _recipe(uint16 id, bytes32 a, bytes32 b) private returns (ReporterRecipe recipe) {
        bytes32[] memory ids = new bytes32[](b == bytes32(0) ? 1 : 2);
        ids[0] = a;
        if (ids.length == 2) ids[1] = b;
        recipe = new ReporterRecipe(id, ids);
        recipes.registerRecipe(id, 1, address(recipe));
    }

    function _bindings(uint16 count) private pure returns (RecipeBinding[] memory bindings) {
        bindings = new RecipeBinding[](count);
        for (uint16 i = 0; i < count; i++) {
            bindings[i] = RecipeBinding(i + 1, 1, RecipeBindingMode.REQUIRED_BLOCKING, 0, 100);
        }
    }

    function _manifest() private pure returns (ManifestCore memory m) {
        m.status = PolicyStatus.ACTIVE;
        m.supportedEngines = 7;
        m.fullManifestHash = bytes32("MANIFEST");
    }

    function _activate(address token, RecipeBinding[] memory bindings) private {
        policies.registerManifest(token, _manifest(), bindings);
        policies.approveManifest(token);
    }

    function _setupSingle() private {
        _recipe(1, FIRST, SECOND);
        _activate(RWA, _bindings(1));
        policies.setUnregulated(OTHER);
    }

    function _ctx() private pure returns (ComplianceContext memory ctx) {
        ctx.initiator = address(1);
        ctx.buyer = address(2);
        ctx.seller = address(3);
        ctx.tokenIn = OTHER;
        ctx.tokenOut = RWA;
        ctx.amountIn = 10;
        ctx.amountOut = 20;
        ctx.venueType = VenueType.RFQ;
    }

    function _parity(ComplianceContext memory ctx) private view returns (ComplianceReport memory r) {
        r = reporter.report(ctx);
        ComplianceDecision memory decision = engine.evaluate(ctx);
        assertEq(uint8(r.engineStatus), uint8(decision.allowed ? RequirementStatus.PASS : RequirementStatus.FAIL));
        assertEq(r.decision.allowed, decision.allowed);
        assertEq(r.decision.policyId, decision.policyId);
        assertEq(r.decision.decisionHash, decision.decisionHash);
        if (!r.decisionRedacted) assertEq(abi.encode(r.decision), abi.encode(decision));
        if (!decision.allowed) assertEq(uint8(r.status), uint8(RequirementStatus.FAIL));
        if (r.complete && r.status == RequirementStatus.PASS) assertTrue(decision.allowed);
    }

    function test_multipleFailures_continuePastEngineFirstFailure() public {
        _setupSingle();
        first.setOutcome(RWA, 1);
        second.setOutcome(RWA, 1);
        ComplianceReport memory r = _parity(_ctx());
        assertTrue(r.complete);
        assertEq(r.requirements.length, 2);
        assertEq(uint8(r.requirements[0].status), uint8(RequirementStatus.FAIL));
        assertEq(uint8(r.requirements[1].status), uint8(RequirementStatus.FAIL));
        assertEq(r.requirements[1].reasonCode, ReasonCodes.encode(0, SECOND, 7));
    }

    function test_bothRegulatedLegs_useExactContextAndAmounts() public {
        _recipe(1, FIRST, SECOND);
        _activate(OTHER, _bindings(1));
        _activate(RWA, _bindings(1));
        first.setOutcome(OTHER, 1);
        second.setOutcome(RWA, 1);
        ComplianceReport memory r = _parity(_ctx());
        assertTrue(r.complete);
        assertEq(r.requirements.length, 4);
        assertEq(r.requirements[0].token, OTHER);
        assertEq(r.requirements[2].token, RWA);
        assertEq(uint8(r.requirements[0].status), uint8(RequirementStatus.FAIL));
        assertEq(uint8(r.requirements[2].status), uint8(RequirementStatus.PASS));
        assertEq(uint8(r.requirements[3].status), uint8(RequirementStatus.FAIL));
    }

    function test_pathOptions_reportFailedAlternativeWithoutChangingEnginePermission() public {
        _recipe(1, FIRST, bytes32(0));
        _recipe(2, SECOND, bytes32(0));
        RecipeBinding[] memory bindings = _bindings(2);
        bindings[0].mode = RecipeBindingMode.PATH_OPTION;
        bindings[1].mode = RecipeBindingMode.PATH_OPTION;
        bindings[0].pathGroupId = 7;
        bindings[1].pathGroupId = 7;
        _activate(RWA, bindings);
        policies.setUnregulated(OTHER);
        first.setOutcome(RWA, 1);
        ComplianceReport memory r = _parity(_ctx());
        assertTrue(r.decision.allowed);
        assertEq(uint8(r.status), uint8(RequirementStatus.FAIL));
        assertEq(r.requirements[1].bindingIndex, 1);
        assertEq(r.requirements[1].pathGroupId, 7);
        second.setOutcome(RWA, 1);
        assertFalse(_parity(_ctx()).decision.allowed);
    }

    function test_flagOnlyBinding_andCompiledFlagOnlyRule_areNonblocking() public {
        ReporterElement flag = _element("PUBLIC-FLAG-v1", EnforcementAction.FLAG_ONLY);
        _recipe(1, FIRST, bytes32(0));
        _recipe(2, "PUBLIC-FLAG-v1", bytes32(0));
        RecipeBinding[] memory bindings = _bindings(2);
        bindings[0].mode = RecipeBindingMode.FLAG_ONLY;
        _activate(RWA, bindings);
        policies.setUnregulated(OTHER);
        first.setOutcome(RWA, 1);
        flag.setOutcome(RWA, 1);
        ComplianceReport memory r = _parity(_ctx());
        assertTrue(r.decision.allowed);
        assertEq(r.decision.flagsBitmap, 3);
        assertEq(uint8(r.requirements[0].status), uint8(RequirementStatus.FAIL));
        assertEq(uint8(r.requirements[1].status), uint8(RequirementStatus.FAIL));
    }

    function test_notApplicable_doesNotCallFailingProviders() public {
        ReporterRecipe recipe = _recipe(1, FIRST, SECOND);
        recipe.setApplicability(1);
        _activate(RWA, _bindings(1));
        policies.setUnregulated(OTHER);
        first.setOutcome(RWA, 2);
        ComplianceReport memory r = _parity(_ctx());
        assertTrue(r.complete);
        assertTrue(r.decision.allowed);
        assertEq(uint8(r.requirements[0].status), uint8(RequirementStatus.NOT_APPLICABLE));
    }

    function test_allPathOptionsNotApplicable_stillReflectsEngineBlock() public {
        ReporterRecipe recipe = _recipe(1, FIRST, bytes32(0));
        recipe.setApplicability(1);
        RecipeBinding[] memory bindings = _bindings(1);
        bindings[0].mode = RecipeBindingMode.PATH_OPTION;
        bindings[0].pathGroupId = 7;
        _activate(RWA, bindings);
        policies.setUnregulated(OTHER);
        assertFalse(_parity(_ctx()).decision.allowed);
    }

    function test_providerRevert_isUndeterminedAndLaterFailureStillReported() public {
        _setupSingle();
        first.setOutcome(RWA, 2);
        second.setOutcome(RWA, 1);
        ComplianceReport memory r = reporter.report(_ctx());
        assertFalse(r.complete);
        assertEq(uint8(r.engineStatus), uint8(RequirementStatus.UNDETERMINED));
        assertEq(uint8(r.requirements[0].status), uint8(RequirementStatus.UNDETERMINED));
        assertEq(r.requirements[0].reasonCode, bytes32(0));
        assertEq(uint8(r.requirements[1].status), uint8(RequirementStatus.FAIL));
    }

    function test_applicabilityRevert_isUndetermined() public {
        ReporterRecipe recipe = _recipe(1, FIRST, bytes32(0));
        _activate(RWA, _bindings(1));
        policies.setUnregulated(OTHER);
        recipe.setApplicability(2);
        ComplianceReport memory r = reporter.report(_ctx());
        assertFalse(r.complete);
        assertEq(uint8(r.status), uint8(RequirementStatus.UNDETERMINED));
        assertEq(uint8(r.requirements[0].status), uint8(RequirementStatus.UNDETERMINED));
    }

    function test_unsupportedVenue_evenForNonApplicableFlagBinding_reflectsEngineBlock() public {
        _element("C-01-v9", EnforcementAction.BLOCK);
        ReporterRecipe recipe = _recipe(1, "C-01-v9", bytes32(0));
        recipe.setApplicability(1);
        _recipe(2, FIRST, bytes32(0));
        RecipeBinding[] memory bindings = _bindings(2);
        bindings[0].mode = RecipeBindingMode.FLAG_ONLY;
        _activate(RWA, bindings);
        policies.setUnregulated(OTHER);
        ComplianceContext memory ctx = _ctx();
        ctx.venueType = VenueType.AMM;
        ComplianceReport memory r = _parity(ctx);
        assertFalse(r.decision.allowed);
        assertEq(r.decision.reasonCode, ReasonCodes.unsupportedVenue(1, "C-01-v9"));
    }

    function test_restrictedFamilies_areOneOpaqueOutcomeAndDecisionIsRedacted() public {
        ReporterElement sanctions = _element("A-01-v8", EnforcementAction.BLOCK);
        ReporterElement redFlag = _element("A-12-v8", EnforcementAction.BLOCK);
        ReporterElement fraud = _element("F-03-v8", EnforcementAction.BLOCK);
        _recipe(1, "A-01-v8", "A-12-v8");
        _recipe(2, "F-03-v8", FIRST);
        _activate(RWA, _bindings(2));
        policies.setUnregulated(OTHER);
        sanctions.setOutcome(RWA, 1);
        ComplianceReport memory r = _parity(_ctx());
        assertEq(r.requirements.length, 1);
        assertEq(r.requirements[0].elementId, FIRST);
        assertTrue(r.decisionRedacted);
        assertEq(r.decision.reasonCode, bytes32(0));
        assertEq(r.decision.flagsBitmap, 0);
        assertEq(uint8(r.restrictedStatus), uint8(RequirementStatus.FAIL));
        sanctions.setOutcome(RWA, 0);
        fraud.setOutcome(RWA, 1);
        assertEq(abi.encode(r), abi.encode(_parity(_ctx())));
        fraud.setOutcome(RWA, 0);
        redFlag.setOutcome(RWA, 2);
        r = reporter.report(_ctx());
        assertEq(uint8(r.restrictedStatus), uint8(RequirementStatus.UNDETERMINED));
        assertFalse(r.complete);
    }

    function test_restrictedSubjectOutcome_doesNotChangePublicRows() public {
        ReporterElement sanctions = _element("A-01-v8", EnforcementAction.BLOCK);
        _element("A-12-v8", EnforcementAction.BLOCK);
        _element("F-03-v8", EnforcementAction.BLOCK);
        _recipe(1, "A-01-v8", "A-12-v8");
        _recipe(2, "F-03-v8", FIRST);
        _recipe(3, SECOND, bytes32(0));
        _activate(RWA, _bindings(3));
        policies.setUnregulated(OTHER);
        ComplianceContext memory ctx = _ctx();
        sanctions.setSubjectOutcome(ctx.buyer, 1);
        ComplianceReport memory sanctioned = _parity(ctx);
        ctx.buyer = address(4);
        ComplianceReport memory clean = _parity(ctx);

        assertTrue(sanctioned.complete);
        assertTrue(clean.complete);
        assertTrue(sanctioned.decisionRedacted);
        assertTrue(clean.decisionRedacted);
        assertEq(sanctioned.requirements.length, 2);
        assertEq(clean.requirements.length, sanctioned.requirements.length);
        assertEq(clean.requirements[0].bindingIndex, 1);
        assertEq(clean.requirements[0].recipeId, 2);
        assertEq(clean.requirements[0].elementId, FIRST);
        assertEq(clean.requirements[1].bindingIndex, 2);
        assertEq(clean.requirements[1].recipeId, 3);
        assertEq(clean.requirements[1].elementId, SECOND);
        assertEq(abi.encode(sanctioned.requirements), abi.encode(clean.requirements));
        assertEq(uint8(sanctioned.restrictedStatus), uint8(RequirementStatus.FAIL));
        assertEq(uint8(clean.restrictedStatus), uint8(RequirementStatus.PASS));
        assertEq(uint8(sanctioned.engineStatus), uint8(RequirementStatus.FAIL));
        assertEq(uint8(clean.engineStatus), uint8(RequirementStatus.PASS));
        assertEq(sanctioned.decision.reasonCode, bytes32(0));
        assertEq(clean.decision.reasonCode, bytes32(0));
        assertEq(sanctioned.decision.flagsBitmap, 0);
        assertEq(clean.decision.flagsBitmap, 0);
        assertEq(sanctioned.decision.reliedClaims, bytes32(0));
        assertEq(clean.decision.reliedClaims, bytes32(0));
    }

    function test_restrictedFlag_isOpaqueAndNonblocking_andSupportsPassAndNonapplicable() public {
        ReporterElement flag = _element("F-02-v9", EnforcementAction.FLAG_ONLY);
        ReporterRecipe recipe = _recipe(1, FIRST, "F-02-v9");
        _activate(RWA, _bindings(1));
        policies.setUnregulated(OTHER);
        flag.setOutcome(RWA, 1);
        ComplianceReport memory r = _parity(_ctx());
        assertTrue(r.decision.allowed);
        assertEq(r.decision.flagsBitmap, 0);
        assertTrue(r.decisionRedacted);
        assertEq(r.requirements.length, 1);
        assertEq(uint8(r.restrictedStatus), uint8(RequirementStatus.FAIL));
        flag.setOutcome(RWA, 0);
        r = _parity(_ctx());
        assertTrue(r.complete);
        assertEq(uint8(r.status), uint8(RequirementStatus.PASS));
        assertEq(uint8(r.restrictedStatus), uint8(RequirementStatus.PASS));
        recipe.setApplicability(1);
        r = _parity(_ctx());
        assertTrue(r.decisionRedacted);
        assertEq(uint8(r.restrictedStatus), uint8(RequirementStatus.NOT_APPLICABLE));
    }

    function test_zeroFailureReason_usesEngineFallback() public {
        _setupSingle();
        first.setOutcome(RWA, 1);
        first.setZeroReason();
        ComplianceReport memory r = _parity(_ctx());
        assertEq(r.requirements[0].reasonCode, ReasonCodes.encode(1, FIRST, 1));
    }

    function test_policyStatusGate_isReflectedWithoutRequirements() public {
        ComplianceReport memory r = _parity(_ctx());
        assertFalse(r.decision.allowed);
        assertEq(r.requirements.length, 0);
        policies.setUnregulated(RWA);
        policies.setUnregulated(OTHER);
        r = _parity(_ctx());
        assertTrue(r.complete);
        assertEq(uint8(r.status), uint8(RequirementStatus.PASS));
    }

    function test_runtimeCodeDrift_isUndetermined() public {
        _setupSingle();
        vm.etch(address(first), hex"00");
        ComplianceReport memory r = reporter.report(_ctx());
        assertFalse(r.complete);
        assertEq(uint8(r.engineStatus), uint8(RequirementStatus.UNDETERMINED));
        assertEq(uint8(r.requirements[0].status), uint8(RequirementStatus.UNDETERMINED));
    }

    function test_parameterChangeBetweenSnapshots_usesOnlyActiveCompiledParameters() public {
        MinimumTradeAmount minimum = new MinimumTradeAmount();
        elements.registerElement(minimum.ELEMENT_ID(), address(minimum));
        _recipe(1, minimum.ELEMENT_ID(), bytes32(0));
        ManifestPolicyConfig memory config;
        config.schemaVersion = 1;
        config.elementParameters = new ElementPolicyParameter[](1);
        config.elementParameters[0] =
            ElementPolicyParameter(0, minimum.ELEMENT_ID(), minimum.PARAMETER_SCHEMA_ID(), 1, abi.encode(uint256(15)));
        policies.registerManifest(RWA, _manifest(), _bindings(1), new ElementEnforcementOverride[](0), config);
        policies.approveManifest(RWA);
        policies.setUnregulated(OTHER);
        ComplianceReport memory beforeUpdate = _parity(_ctx());
        assertEq(uint8(beforeUpdate.status), uint8(RequirementStatus.PASS));
        config.elementParameters[0].parameters = abi.encode(uint256(25));
        ManifestCore memory next = _manifest();
        next.fullManifestHash = bytes32("UPDATED");
        policies.scheduleManifestUpdate(RWA, next, _bindings(1), new ElementEnforcementOverride[](0), config, "TIGHTEN");
        assertEq(_parity(_ctx()).decision.policyId, beforeUpdate.decision.policyId);
        vm.warp(block.timestamp + policies.MIN_MANIFEST_DELAY());
        vm.roll(block.number + 1);
        policies.activateManifestUpdate(RWA);
        ComplianceReport memory afterUpdate = _parity(_ctx());
        assertFalse(afterUpdate.decision.allowed);
        assertTrue(afterUpdate.decision.policyId != beforeUpdate.decision.policyId);
        assertGt(afterUpdate.blockNumber, beforeUpdate.blockNumber);
        assertGt(afterUpdate.timestamp, beforeUpdate.timestamp);
    }

    function testFuzz_completeAllPassImpliesEnginePermission_andBlockIsReflected(bool failFirst, bool failSecond)
        public
    {
        _setupSingle();
        first.setOutcome(RWA, failFirst ? 1 : 0);
        second.setOutcome(RWA, failSecond ? 1 : 0);
        ComplianceReport memory r = _parity(_ctx());
        assertTrue(r.complete);
        assertEq(r.status == RequirementStatus.PASS, !failFirst && !failSecond);
    }
}
