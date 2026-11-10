// SPDX-License-Identifier: GPL-3.0
pragma solidity 0.8.17;

import {IntegrationBase} from "./IntegrationBase.sol";
import {RedFlagKnowledgeBarV2} from "../../src/compliance/elements/RedFlagKnowledgeBarV2.sol";
import {RegD506cRecipeV4} from "../../src/compliance/recipes/RegD506cRecipeV4.sol";
import {Errors} from "../../src/libraries/Errors.sol";
import {
    ComplianceContext,
    ComplianceDecision,
    CompiledElementRule,
    EnforcementAction,
    ManifestCore,
    RecipeBinding,
    RecipeBindingMode,
    VenueType
} from "../../src/types/ComplianceTypes.sol";

contract RegD506cV4Test is IntegrationBase {
    RedFlagKnowledgeBarV2 internal redFlag;

    function setUp() public {
        deployRegDStack();
        setupBuyer(alice);
        fundPoolRWA(1000);
    }

    function test_registrationAlone_preservesActiveV3PolicyAndBehavior() public {
        ComplianceDecision memory beforeRegistration = engine.evaluate(_context());
        assertTrue(beforeRegistration.allowed);
        bytes32 planBefore = policyReg.compiledPlanHashOf(address(rwaToken));
        _registerV4();
        redFlag.raiseFlag(address(pool), alice, RedFlagKnowledgeBarV2.RedFlag.AI_INCONSISTENT);
        redFlag.markUncertain(address(pool), alice);

        assertEq(policyReg.recipeBindingsOf(address(rwaToken))[0].recipeVersion, 3);
        assertEq(policyReg.compiledRulesOf(address(rwaToken), 0).length, 9);
        assertEq(policyReg.compiledPlanHashOf(address(rwaToken)), planBefore);
        ComplianceDecision memory afterRegistration = engine.evaluate(_context());
        assertTrue(afterRegistration.allowed);
        assertEq(afterRegistration.policyId, beforeRegistration.policyId);
        assertEq(afterRegistration.reasonCode, beforeRegistration.reasonCode);

        accredited.setAccredited(alice, false);
        assertFalse(engine.evaluate(_context()).allowed, "v3 accreditation gate remains effective");
    }

    function test_migrationV3ToV4_isDelayedAndCompilesTenElements() public {
        _registerV4();
        ComplianceDecision memory beforeUpdate = engine.evaluate(_context());
        bytes32 planBefore = policyReg.compiledPlanHashOf(address(rwaToken));
        _scheduleV4();
        assertEq(policyReg.recipeBindingsOf(address(rwaToken))[0].recipeVersion, 3);
        assertEq(policyReg.compiledPlanHashOf(address(rwaToken)), planBefore);
        assertEq(engine.evaluate(_context()).policyId, beforeUpdate.policyId);
        vm.expectPartialRevert(Errors.TimelockNotReady.selector);
        policyReg.activateManifestUpdate(address(rwaToken));

        _activateV4();
        assertEq(policyReg.recipeBindingsOf(address(rwaToken))[0].recipeVersion, 4);
        assertEq(policyReg.manifestVersionOf(address(rwaToken)), 2);
        CompiledElementRule[] memory rules = policyReg.compiledRulesOf(address(rwaToken), 0);
        assertEq(rules.length, 10);
        for (uint256 i = 0; i < 9; i++) {
            assertEq(uint256(rules[i].action), uint256(EnforcementAction.BLOCK));
        }
        assertEq(rules[9].elementId, bytes32("A-12-v2"));
        assertEq(uint256(rules[9].action), uint256(EnforcementAction.FLAG_ONLY));
        assertNotEq(policyReg.compiledPlanHashOf(address(rwaToken)), planBefore);
        ComplianceDecision memory afterUpdate = engine.evaluate(_context());
        assertTrue(afterUpdate.allowed);
        assertNotEq(afterUpdate.policyId, beforeUpdate.policyId);
    }

    function test_flaggedAssessment_staysNonblockingAndSeparate() public {
        _migrateV4();
        redFlag.raiseFlag(address(pool), alice, RedFlagKnowledgeBarV2.RedFlag.AI_INCONSISTENT);
        assertEq(uint256(redFlag.dispositionOf(address(pool), alice)), uint256(RedFlagKnowledgeBarV2.Disposition.FLAG));
        _assertNeutralDecision();
        redFlag.resolveReview(address(pool), alice, RedFlagKnowledgeBarV2.Resolution.RISK_CONFIRMED);
        _assertNeutralDecision();
    }

    function test_uncertainAssessment_staysNonblockingAndSeparate() public {
        _migrateV4();
        redFlag.markUncertain(address(pool), alice);
        assertEq(
            uint256(redFlag.dispositionOf(address(pool), alice)), uint256(RedFlagKnowledgeBarV2.Disposition.REVIEW)
        );
        _assertNeutralDecision();
        redFlag.resolveReview(address(pool), alice, RedFlagKnowledgeBarV2.Resolution.BOUNDARY_ESCALATED);
        _assertNeutralDecision();
    }

    function test_v4_preservesExistingBlockingGate() public {
        _migrateV4();
        redFlag.markUncertain(address(pool), alice);
        accredited.setAccredited(alice, false);
        assertFalse(engine.evaluate(_context()).allowed, "A-12 membership cannot bypass accreditation");
    }

    function _registerV4() internal {
        redFlag = new RedFlagKnowledgeBarV2();
        elementReg.registerElement(bytes32("A-12-v2"), address(redFlag), EnforcementAction.FLAG_ONLY);
        recipeReg.registerRecipe(1, 4, address(new RegD506cRecipeV4()));
    }

    function _scheduleV4() internal {
        ManifestCore memory manifest = policyReg.manifestOf(address(rwaToken));
        manifest.fullManifestHash = keccak256("reg-d-v4-reference-policy");
        RecipeBinding[] memory bindings = new RecipeBinding[](1);
        bindings[0] = RecipeBinding(1, 4, RecipeBindingMode.REQUIRED_BLOCKING, 0, 100);
        policyReg.scheduleManifestUpdate(address(rwaToken), manifest, bindings, bytes32("ADD_A12"));
    }

    function _activateV4() internal {
        (,, uint64 readyAt,) = policyReg.pendingManifestUpdateOf(address(rwaToken));
        vm.warp(readyAt);
        policyReg.activateManifestUpdate(address(rwaToken));
    }

    function _migrateV4() internal {
        _registerV4();
        _scheduleV4();
        _activateV4();
    }

    function _assertNeutralDecision() internal view {
        assertTrue(redFlag.routesToReview(address(pool), alice));
        ComplianceDecision memory decision = engine.evaluate(_context());
        assertTrue(decision.allowed);
        assertEq(decision.reasonCode, bytes32(0));
        assertEq(decision.flagsBitmap, 0, "review assessments remain outside Engine check results");
    }

    function _context() internal view returns (ComplianceContext memory ctx) {
        ctx.initiator = alice;
        ctx.buyer = alice;
        ctx.seller = address(pool);
        ctx.tokenIn = address(quote);
        ctx.tokenOut = address(rwaToken);
        ctx.amountIn = 100;
        ctx.amountOut = 100;
        ctx.venueType = VenueType.RFQ;
    }
}
