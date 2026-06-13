// SPDX-License-Identifier: GPL-3.0
pragma solidity 0.8.17;

import {Test} from "forge-std/Test.sol";
import {ComplianceEngine} from "../../../src/compliance/ComplianceEngine.sol";
import {ElementRegistry} from "../../../src/registry/ElementRegistry.sol";
import {RecipeRegistry} from "../../../src/registry/RecipeRegistry.sol";
import {TokenPolicyRegistry} from "../../../src/registry/TokenPolicyRegistry.sol";
import {Sanctions} from "../../../src/compliance/elements/Sanctions.sol";
import {AccreditedInvestor} from "../../../src/compliance/elements/AccreditedInvestor.sol";
import {QualifiedPurchaser} from "../../../src/compliance/elements/QualifiedPurchaser.sol";
import {SurveillanceFlag} from "../../../src/compliance/elements/SurveillanceFlag.sol";
import {RegD506cRecipe} from "../../../src/compliance/recipes/RegD506cRecipe.sol";
import {Fund3c7Recipe} from "../../../src/compliance/recipes/Fund3c7Recipe.sol";
import {
    ComplianceContext,
    ComplianceDecision,
    ManifestCore,
    PolicyStatus,
    VenueType,
    FlowType
} from "../../../src/types/ComplianceTypes.sol";
import {Errors} from "../../../src/libraries/Errors.sol";
import {Events} from "../../../src/libraries/Events.sol";

contract EngineTest is Test {
    ElementRegistry internal elementReg;
    RecipeRegistry internal recipeReg;
    TokenPolicyRegistry internal policyReg;
    ComplianceEngine internal engine;

    Sanctions internal sanctions;
    AccreditedInvestor internal accredited;
    QualifiedPurchaser internal qp;
    SurveillanceFlag internal surveillance;

    address internal constant RWA = address(0xBEEF);
    address internal constant CASH = address(0xCA54);
    address internal constant BUYER = address(0xB0B);
    address internal constant SELLER = address(0x5E11E2);

    function setUp() public {
        elementReg = new ElementRegistry();
        recipeReg = new RecipeRegistry();
        policyReg = new TokenPolicyRegistry();

        sanctions = new Sanctions();
        accredited = new AccreditedInvestor();
        qp = new QualifiedPurchaser();
        surveillance = new SurveillanceFlag();

        elementReg.registerElement(bytes32("A-01-v1"), address(sanctions));
        elementReg.registerElement(bytes32("A-03-v1"), address(accredited));
        elementReg.registerElement(bytes32("A-13-v1"), address(qp));
        elementReg.registerElement(bytes32("F-02-v1"), address(surveillance));

        RegD506cRecipe regd = new RegD506cRecipe();
        Fund3c7Recipe fund = new Fund3c7Recipe();
        recipeReg.registerRecipe(1, 1, address(regd));
        recipeReg.registerRecipe(2, 1, address(fund));

        engine = new ComplianceEngine(policyReg, elementReg, recipeReg);
    }

    // --- manifest helpers ---

    function _activeManifest(uint16 fundRecipeId, uint256 factsPacked) internal pure returns (ManifestCore memory m) {
        m.status = PolicyStatus.ACTIVE;
        m.issuanceRecipeId = 1;
        m.issuanceRecipeVersion = 1;
        m.fundRecipeId = fundRecipeId;
        m.supportedEngines = 0x01; // AMM bit
        m.factsPacked = factsPacked;
    }

    function _registerRWA(uint16 fundRecipeId, uint256 factsPacked) internal {
        policyReg.registerManifest(RWA, _activeManifest(fundRecipeId, factsPacked));
    }

    function _ctxBuy() internal pure returns (ComplianceContext memory c) {
        // buyer acquires RWA: tokenOut = RWA.
        c.initiator = BUYER;
        c.buyer = BUYER;
        c.seller = SELLER;
        c.tokenIn = CASH;
        c.tokenOut = RWA;
        c.amountIn = 1000;
        c.amountOut = 50;
        c.venueType = VenueType.AMM;
        c.venue = address(0x7E47);
        c.flowType = FlowType.SECONDARY_TRADE;
        c.sellerIsAffiliate = false;
    }

    // --- cases ---

    function test_active_regd_allows_when_accredited_and_clean() public {
        _registerRWA(0, 0);
        accredited.setAccredited(BUYER, true);

        ComplianceDecision memory d = engine.evaluate(_ctxBuy());
        assertTrue(d.allowed);
        assertEq(d.reasonCode, bytes32(0));
        assertTrue(d.decisionHash != bytes32(0));
        assertEq(d.policyId, bytes32(uint256(1)));
        assertEq(d.policyVersion, 1);
    }

    function test_active_rejects_when_not_accredited() public {
        _registerRWA(0, 0);
        // buyer not accredited (default false), not sanctioned.
        ComplianceDecision memory d = engine.evaluate(_ctxBuy());
        assertFalse(d.allowed);
        assertTrue(d.reasonCode != bytes32(0));
    }

    function test_active_rejects_when_sanctioned() public {
        _registerRWA(0, 0);
        accredited.setAccredited(BUYER, true);
        sanctions.setBlocked(BUYER, true);
        ComplianceDecision memory d = engine.evaluate(_ctxBuy());
        assertFalse(d.allowed);
    }

    function test_fund_recipe_conditional_activation_requires_qp() public {
        // fundRecipeId=2 and factsPacked bit0 set → Fund3c7 applies → QP required.
        _registerRWA(2, 1);
        accredited.setAccredited(BUYER, true);
        // not qp yet → AND fails.
        ComplianceDecision memory d = engine.evaluate(_ctxBuy());
        assertFalse(d.allowed);

        // grant qp → now allowed (proves cumulative AND across two recipes).
        qp.setQp(BUYER, true);
        d = engine.evaluate(_ctxBuy());
        assertTrue(d.allowed);
    }

    function test_fund_recipe_not_applicable_when_bit0_clear() public {
        // fundRecipeId=2 set but factsPacked bit0 NOT set → Fund3c7 not applicable.
        _registerRWA(2, 0);
        accredited.setAccredited(BUYER, true);
        // qp NOT set, but QP not required since fund recipe inapplicable.
        ComplianceDecision memory d = engine.evaluate(_ctxBuy());
        assertTrue(d.allowed);
    }

    function test_unknown_token_fails_closed() public {
        // RWA never registered → UNKNOWN on both sides → fail-closed.
        ComplianceDecision memory d = engine.evaluate(_ctxBuy());
        assertFalse(d.allowed);
        assertTrue(d.reasonCode != bytes32(0));
    }

    function test_both_unregulated_passes_through() public {
        // Both sides explicitly UNREGULATED → pass through.
        ManifestCore memory unreg;
        unreg.status = PolicyStatus.UNREGULATED;
        policyReg.registerManifest(RWA, unreg);
        policyReg.registerManifest(CASH, unreg);

        ComplianceDecision memory d = engine.evaluate(_ctxBuy());
        assertTrue(d.allowed);
        assertEq(d.reasonCode, bytes32(0));
        assertEq(d.maxAmount, type(uint256).max);
    }

    function test_suspended_fails_closed() public {
        ManifestCore memory m = _activeManifest(0, 0);
        m.status = PolicyStatus.SUSPENDED;
        policyReg.registerManifest(RWA, m);
        accredited.setAccredited(BUYER, true);

        ComplianceDecision memory d = engine.evaluate(_ctxBuy());
        assertFalse(d.allowed);
        assertTrue(d.reasonCode != bytes32(0));
    }

    function test_decisionHash_binds_amount() public {
        _registerRWA(0, 0);
        accredited.setAccredited(BUYER, true);

        ComplianceContext memory c = _ctxBuy();
        ComplianceDecision memory d1 = engine.evaluate(c);
        c.amountIn = c.amountIn + 1;
        ComplianceDecision memory d2 = engine.evaluate(c);
        assertTrue(d1.decisionHash != d2.decisionHash);
    }

    function test_element_not_registered_reverts() public {
        // Recipe 3 references an element id that is not registered.
        bytes32[] memory missing = new bytes32[](1);
        missing[0] = bytes32("Z-99-v1");
        UnregisteredElementRecipe bad = new UnregisteredElementRecipe(missing);
        recipeReg.registerRecipe(3, 1, address(bad));

        ManifestCore memory m = _activeManifest(0, 0);
        m.issuanceRecipeId = 3; // point issuance at the bad recipe
        policyReg.registerManifest(RWA, m);

        vm.expectRevert(abi.encodeWithSelector(Errors.ElementNotRegistered.selector, bytes32("Z-99-v1")));
        engine.evaluate(_ctxBuy());
    }

    function test_commit_emits_surveillance_flag() public {
        // Build a recipe whose required elements include the stateful F-02-v1.
        bytes32[] memory els = new bytes32[](2);
        els[0] = bytes32("A-03-v1");
        els[1] = bytes32("F-02-v1");
        UnregisteredElementRecipe surveilRecipe = new UnregisteredElementRecipe(els);
        recipeReg.registerRecipe(4, 1, address(surveilRecipe));

        ManifestCore memory m = _activeManifest(0, 0);
        m.issuanceRecipeId = 4;
        policyReg.registerManifest(RWA, m);

        accredited.setAccredited(BUYER, true);
        surveillance.setThreshold(0); // first onTransfer triggers

        // commit on seller→buyer. RWA-side amount = amountOut (tokenOut == RWA).
        vm.expectEmit(true, true, false, true);
        emit Events.SurveillanceFlag(
            bytes32("F-02-v1"), SELLER, keccak256(abi.encode(uint16(0), bytes32("F-02-v1"), uint32(1)))
        );
        engine.commit(_ctxBuy());
        assertEq(surveillance.transferCount(), 1);
    }
}

/// @dev Test-only recipe with a configurable required-element list, always applicable.
contract UnregisteredElementRecipe {
    bytes32[] internal _elements;

    constructor(bytes32[] memory elements) {
        _elements = elements;
    }

    function recipeId() external pure returns (uint16) {
        return 99;
    }

    function version() external pure returns (uint16) {
        return 1;
    }

    function isApplicable(bytes calldata) external pure returns (bool) {
        return true;
    }

    function requiredElements() external view returns (bytes32[] memory) {
        return _elements;
    }
}
