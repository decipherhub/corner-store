// SPDX-License-Identifier: GPL-3.0
pragma solidity 0.8.17;

import {Test} from "forge-std/Test.sol";
import {ComplianceEngine} from "../../../src/compliance/ComplianceEngine.sol";
import {ComplianceReporter} from "../../../src/compliance/ComplianceReporter.sol";
import {BaseElement} from "../../../src/compliance/elements/BaseElement.sol";
import {ElementRegistry} from "../../../src/registry/ElementRegistry.sol";
import {RecipeRegistry} from "../../../src/registry/RecipeRegistry.sol";
import {TokenPolicyRegistry} from "../../../src/registry/TokenPolicyRegistry.sol";
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
    VenueType
} from "../../../src/types/ComplianceTypes.sol";
import {ComplianceReport, RequirementStatus} from "../../../src/types/ComplianceReportTypes.sol";

contract AssuranceReporterElement is BaseElement {
    uint8 public outcome;

    constructor(bytes32 id)
        BaseElement(ElementMetadata({
                elementId: id,
                category: ElementCategory.INVESTOR_ATTRIBUTE,
                version: "1.0.0",
                temporal: TemporalNature.REALTIME,
                decidability: Decidability.DETERMINISTIC,
                timing: ObligationTiming.AT_TRADE_GATE,
                statefulness: Statefulness.STATELESS,
                evidenceType: EvidenceType.TRANSACTION_CONTEXT,
                defaultEnforcement: EnforcementAction.BLOCK,
                parameterSchemaId: bytes32(0),
                parameterSchemaVersion: 0,
                maxParameterBytes: 0,
                parametersRequired: false
            }))
    {}

    function setOutcome(uint8 value) external {
        outcome = value % 3;
    }

    function _check(address, address, address, uint256, bytes calldata, bytes calldata)
        internal
        view
        override
        returns (bool, bytes32)
    {
        require(outcome != 2, "private provider error");
        return (outcome == 0, outcome == 0 ? bytes32(0) : bytes32("PRIVATE-FAILURE"));
    }
}

contract AssuranceReporterRecipe {
    uint16 public constant recipeId = 1;
    uint16 public constant version = 1;
    bytes32[] private elements;

    constructor(bytes32[] memory ids) {
        elements = ids;
    }

    function requiredElements() external view returns (bytes32[] memory) {
        return elements;
    }

    function isApplicable(bytes calldata) external pure returns (bool) {
        return true;
    }
}

contract ReporterHandler is Test {
    address private constant RWA = address(0x100);
    address private constant OTHER = address(0x200);
    bytes32 private constant SANCTIONS = "A-01-v8";
    bytes32 private constant RED_FLAG = "A-12-v8";
    bytes32 private constant FRAUD = "F-03-v8";
    bytes32 private constant PUBLIC = "A-03-v1";

    ComplianceEngine public immutable engine;
    ComplianceReporter public immutable reporter;
    AssuranceReporterElement[3] private restricted;
    AssuranceReporterElement private publicElement;
    uint256 public probes;

    constructor() {
        ElementRegistry elements = new ElementRegistry();
        RecipeRegistry recipes = new RecipeRegistry();
        TokenPolicyRegistry policies = new TokenPolicyRegistry(recipes, elements);
        engine = new ComplianceEngine(policies, elements, recipes);
        reporter = new ComplianceReporter(engine);

        bytes32[4] memory ids = [SANCTIONS, RED_FLAG, FRAUD, PUBLIC];
        bytes32[] memory required = new bytes32[](4);
        for (uint256 i; i < ids.length; ++i) {
            AssuranceReporterElement element = new AssuranceReporterElement(ids[i]);
            elements.registerElement(ids[i], address(element));
            required[i] = ids[i];
            if (i < 3) restricted[i] = element;
            else publicElement = element;
        }
        AssuranceReporterRecipe recipe = new AssuranceReporterRecipe(required);
        recipes.registerRecipe(1, 1, address(recipe));

        RecipeBinding[] memory bindings = new RecipeBinding[](1);
        bindings[0] = RecipeBinding(1, 1, RecipeBindingMode.REQUIRED_BLOCKING, 0, 100);
        ManifestCore memory manifest;
        manifest.status = PolicyStatus.ACTIVE;
        manifest.supportedEngines = 7;
        manifest.fullManifestHash = bytes32("REPORTER-INVARIANT");
        policies.registerManifest(RWA, manifest, bindings);
        policies.approveManifest(RWA);
        policies.setUnregulated(OTHER);
    }

    function setRestricted(uint8 index, uint8 outcome) external {
        restricted[index % 3].setOutcome(outcome);
        _probe();
    }

    function setPublic(uint8 outcome) external {
        publicElement.setOutcome(outcome);
        _probe();
    }

    function probe() external {
        _probe();
    }

    function assertState() external view {
        ComplianceContext memory ctx = _context();
        ComplianceReport memory first = reporter.report(ctx);
        ComplianceReport memory second = reporter.report(ctx);
        assertEq(keccak256(abi.encode(first)), keccak256(abi.encode(second)), "report changed state");
        assertTrue(first.decisionRedacted, "restricted decision exposed");
        assertEq(first.decision.reasonCode, bytes32(0));
        assertEq(first.decision.flagsBitmap, 0, "restricted flags exposed");
        assertEq(first.decision.reliedClaims, bytes32(0), "restricted claims exposed");
        assertEq(first.requirements.length, 1, "restricted requirement exposed");
        assertEq(first.requirements[0].elementId, PUBLIC, "wrong public requirement");

        RequirementStatus expectedRestricted = RequirementStatus.PASS;
        bool providerReverted;
        for (uint256 i; i < 3; ++i) {
            uint8 outcome = restricted[i].outcome();
            if (outcome == 1) {
                expectedRestricted = RequirementStatus.FAIL;
            } else if (outcome == 2 && expectedRestricted != RequirementStatus.FAIL) {
                expectedRestricted = RequirementStatus.UNDETERMINED;
            }
            providerReverted = providerReverted || outcome == 2;
        }
        uint8 publicOutcome = publicElement.outcome();
        RequirementStatus expectedPublic = publicOutcome == 0
            ? RequirementStatus.PASS
            : publicOutcome == 1 ? RequirementStatus.FAIL : RequirementStatus.UNDETERMINED;
        assertEq(uint8(first.restrictedStatus), uint8(expectedRestricted), "wrong restricted status");
        assertEq(uint8(first.requirements[0].status), uint8(expectedPublic), "wrong public status");
        assertEq(first.complete, !(providerReverted || publicOutcome == 2), "wrong completeness");

        try engine.evaluate(ctx) returns (ComplianceDecision memory decision) {
            assertEq(
                uint8(first.engineStatus),
                uint8(decision.allowed ? RequirementStatus.PASS : RequirementStatus.FAIL),
                "engine parity"
            );
            assertEq(first.decision.allowed, decision.allowed, "decision parity");
            assertEq(first.decision.policyId, decision.policyId, "policy parity");
            assertEq(first.decision.decisionHash, decision.decisionHash, "hash parity");
        } catch {
            assertEq(uint8(first.engineStatus), uint8(RequirementStatus.UNDETERMINED), "engine revert hidden");
            assertFalse(first.complete, "engine revert marked complete");
        }
    }

    function _probe() private {
        ++probes;
    }

    function _context() private pure returns (ComplianceContext memory ctx) {
        ctx.initiator = address(1);
        ctx.buyer = address(2);
        ctx.seller = address(3);
        ctx.tokenIn = OTHER;
        ctx.tokenOut = RWA;
        ctx.amountIn = 10;
        ctx.amountOut = 20;
        ctx.venueType = VenueType.RFQ;
    }
}
