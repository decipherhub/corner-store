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
import {Lockup} from "../../../src/compliance/elements/Lockup.sol";
import {Jurisdiction} from "../../../src/compliance/elements/Jurisdiction.sol";
import {IdentityUniqueness} from "../../../src/compliance/elements/IdentityUniqueness.sol";
import {UsTaxResident} from "../../../src/compliance/elements/UsTaxResident.sol";
import {AssetClassification} from "../../../src/compliance/elements/AssetClassification.sol";
import {Erc3643Native} from "../../../src/compliance/elements/Erc3643Native.sol";
import {FormDFiling} from "../../../src/compliance/elements/FormDFiling.sol";
import {IAcquisitionSource} from "../../../src/interfaces/compliance/IAcquisitionSource.sol";
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
    // 9-element Reg D 506(c) reference set (RegD506cRecipe is now version 2).
    Jurisdiction internal jurisdiction; // A-02-v1
    IdentityUniqueness internal identity; // A-04-v1
    UsTaxResident internal usTax; // A-05-v1
    AssetClassification internal assetClass; // B-01-v1
    Erc3643Native internal erc3643; // B-02-v1
    Lockup internal lockup; // C-01-v1
    FormDFiling internal formD; // E-01-v1
    MockAcquisitionSource internal acqSource;

    bytes32 internal constant ALLOWED_JX = bytes32("US");
    bytes32 internal constant REG_D_CLASS = bytes32("REG_D");
    uint64 internal constant LOCKUP_SECONDS = 365 days;

    address internal constant RWA = address(0xBEEF);
    address internal constant RWA2 = address(0xBEE2);
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

        // Remaining 9-element Reg D 506(c) reference set (RegD506cRecipe v2).
        jurisdiction = new Jurisdiction();
        identity = new IdentityUniqueness();
        usTax = new UsTaxResident();
        assetClass = new AssetClassification(REG_D_CLASS);
        erc3643 = new Erc3643Native();
        formD = new FormDFiling();
        acqSource = new MockAcquisitionSource();
        lockup = new Lockup(address(acqSource), LOCKUP_SECONDS);
        elementReg.registerElement(bytes32("A-02-v1"), address(jurisdiction));
        elementReg.registerElement(bytes32("A-04-v1"), address(identity));
        elementReg.registerElement(bytes32("A-05-v1"), address(usTax));
        elementReg.registerElement(bytes32("B-01-v1"), address(assetClass));
        elementReg.registerElement(bytes32("B-02-v1"), address(erc3643));
        elementReg.registerElement(bytes32("C-01-v1"), address(lockup));
        elementReg.registerElement(bytes32("E-01-v1"), address(formD));

        // Asset-side attestations for the RWA tokens + allowed jurisdiction.
        jurisdiction.setJurisdictionAllowed(ALLOWED_JX, true);
        _attestAsset(RWA);
        _attestAsset(RWA2);
        // Warp past the lockup window so buyers with a genesis (t=1) acquisition
        // time pass C-01. (No deadlines are built in these unit tests.)
        vm.warp(uint256(LOCKUP_SECONDS) + 1);

        RegD506cRecipe regd = new RegD506cRecipe();
        Fund3c7Recipe fund = new Fund3c7Recipe();
        recipeReg.registerRecipe(1, 2, address(regd));
        recipeReg.registerRecipe(2, 1, address(fund));

        engine = new ComplianceEngine(policyReg, elementReg, recipeReg);

        // This test contract calls engine.commit(...) directly, so authorize it
        // as the router. The engine drives surveillance.onTransfer from commit,
        // so wire the surveillance element's engine to the engine address.
        engine.setRouter(address(this));
        surveillance.setEngine(address(engine));
    }

    /// @dev Asset-side attestations so `asset` satisfies B-01/B-02/E-01.
    function _attestAsset(address asset) internal {
        assetClass.setClassification(asset, REG_D_CLASS);
        erc3643.setErc3643Native(asset, true);
        formD.setFormDFiled(asset, true, bytes32("EDGAR"));
    }

    /// @dev All investor-side pass-conditions for BUYER EXCEPT accreditation
    ///      (A-02 jurisdiction, A-04 identity, C-01 lockup on both RWA tokens).
    ///      A-01 sanctions / A-05 US-tax pass by default.
    function _attestBuyerBase() internal {
        jurisdiction.setJurisdiction(BUYER, ALLOWED_JX);
        identity.bindIdentity(BUYER, keccak256(abi.encode("ID", BUYER)));
        acqSource.setAcquiredAt(BUYER, RWA, uint64(1));
        acqSource.setAcquiredAt(BUYER, RWA2, uint64(1));
    }

    /// @dev BUYER passes every investor-side element in the 9-element recipe.
    function _makeBuyerCompliant() internal {
        _attestBuyerBase();
        accredited.setAccredited(BUYER, true);
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
        _registerCashUnregulated();
    }

    /// @dev Under fail-closed pair-status rules, an ACTIVE RWA trade only proceeds
    ///      if the counterparty (quote/cash) token is EXPLICITLY UNREGULATED. The
    ///      engine never infers UNREGULATED from an absent manifest, so every
    ///      ACTIVE-side test must register CASH as UNREGULATED.
    function _registerCashUnregulated() internal {
        ManifestCore memory unreg;
        unreg.status = PolicyStatus.UNREGULATED;
        policyReg.registerManifest(CASH, unreg);
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

    function _ctxRegulatedPair() internal pure returns (ComplianceContext memory c) {
        // buyer sends one regulated token and receives another. Both ACTIVE
        // sides must be evaluated; neither manifest may mask the other.
        c.initiator = BUYER;
        c.buyer = BUYER;
        c.seller = SELLER;
        c.tokenIn = RWA;
        c.tokenOut = RWA2;
        c.amountIn = 10;
        c.amountOut = 20;
        c.venueType = VenueType.AMM;
        c.venue = address(0x7E47);
        c.flowType = FlowType.SECONDARY_TRADE;
    }

    // --- cases ---

    function test_active_regd_allows_when_accredited_and_clean() public {
        _registerRWA(0, 0);
        _makeBuyerCompliant();

        ComplianceDecision memory d = engine.evaluate(_ctxBuy());
        assertTrue(d.allowed);
        assertEq(d.reasonCode, bytes32(0));
        assertTrue(d.decisionHash != bytes32(0));
        assertTrue(d.policyId != bytes32(0));
        assertEq(d.policyVersion, 1);
    }

    function test_active_rejects_when_not_accredited() public {
        _registerRWA(0, 0);
        // buyer passes every element EXCEPT accreditation → reject isolated at A-03.
        _attestBuyerBase();
        ComplianceDecision memory d = engine.evaluate(_ctxBuy());
        assertFalse(d.allowed);
        assertTrue(d.reasonCode != bytes32(0));
    }

    function test_active_rejects_when_sanctioned() public {
        _registerRWA(0, 0);
        _makeBuyerCompliant();
        sanctions.setBlocked(BUYER, true);
        ComplianceDecision memory d = engine.evaluate(_ctxBuy());
        assertFalse(d.allowed);
    }

    function test_fund_recipe_conditional_activation_requires_qp() public {
        // fundRecipeId=2 and factsPacked bit0 set → Fund3c7 applies → QP required.
        _registerRWA(2, 1);
        _makeBuyerCompliant();
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
        _makeBuyerCompliant();
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
        _makeBuyerCompliant();

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
        _registerCashUnregulated();

        vm.expectRevert(abi.encodeWithSelector(Errors.ElementNotRegistered.selector, bytes32("Z-99-v1")));
        engine.evaluate(_ctxBuy());
    }

    function test_missing_issuance_recipe_reverts() public {
        ManifestCore memory m = _activeManifest(0, 0);
        m.issuanceRecipeId = 77; // manifest points at a recipe that was never registered
        policyReg.registerManifest(RWA, m);
        _registerCashUnregulated();

        vm.expectRevert(abi.encodeWithSelector(Errors.RecipeNotRegistered.selector, uint16(77)));
        engine.evaluate(_ctxBuy());
    }

    function test_regulated_regulated_pair_evaluates_both_sides() public {
        // tokenIn requires RegD + Fund3c7 (QP). tokenOut requires only RegD.
        // Old single-side selection could choose tokenOut and incorrectly allow
        // without QP. The pair-level rule must reject until both sides pass.
        policyReg.registerManifest(RWA, _activeManifest(2, 1));
        policyReg.registerManifest(RWA2, _activeManifest(0, 0));
        _makeBuyerCompliant();

        ComplianceDecision memory d = engine.evaluate(_ctxRegulatedPair());
        assertFalse(d.allowed, "tokenIn fund recipe must also be enforced");

        qp.setQp(BUYER, true);
        d = engine.evaluate(_ctxRegulatedPair());
        assertTrue(d.allowed, "pair should allow only after both active sides pass");
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
        _registerCashUnregulated();

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

    // Auth: a non-router caller cannot drive the post-trade write path. The
    // engine only accepts commit from the wired router (here the test contract);
    // any stranger must revert NotAuthorized.
    function test_commit_revertsForNonRouter() public {
        _registerRWA(0, 0);
        accredited.setAccredited(BUYER, true);

        vm.prank(address(0xDEAD));
        vm.expectRevert(Errors.NotAuthorized.selector);
        engine.commit(_ctxBuy());
    }

    // Auth: a non-engine caller cannot forge a stateful element's runtime
    // counter. SurveillanceFlag.onTransfer is gated to its wired engine.
    function test_onTransfer_revertsForNonEngine() public {
        SurveillanceFlag s = new SurveillanceFlag();
        s.setEngine(address(engine)); // only the engine is authorized

        vm.prank(address(0xDEAD));
        vm.expectRevert(Errors.NotAuthorized.selector);
        s.onTransfer(SELLER, BUYER, 1);
    }

    // (a) Dedup: an element required by BOTH applicable recipes is checked once,
    // and toggling that shared element flips the whole decision. RegD506c (issuance)
    // requires A-01-v1 (sanctions) + A-03-v1 (accredited). We register an
    // always-applicable fund recipe that ALSO requires A-01-v1, so the union has a
    // duplicate. The engine must dedup (no double-count / crash) and a single
    // sanctions block must reject.
    function test_dedup_shared_element_across_recipes() public {
        bytes32[] memory overlap = new bytes32[](1);
        overlap[0] = bytes32("A-01-v1"); // shared with RegD506c's sanctions element
        UnregisteredElementRecipe shared = new UnregisteredElementRecipe(overlap);
        recipeReg.registerRecipe(5, 1, address(shared));

        // issuance=RegD506c (1), fund=overlapping recipe (5), applicable regardless of facts.
        _registerRWA(5, 0);
        _makeBuyerCompliant();

        // Buyer passes both recipes; the shared element is checked, union evaluates true.
        ComplianceDecision memory d = engine.evaluate(_ctxBuy());
        assertTrue(d.allowed, "union with overlapping element should allow when buyer passes");

        // Toggle the shared element to block → whole decision must fail-close.
        sanctions.setBlocked(BUYER, true);
        d = engine.evaluate(_ctxBuy());
        assertFalse(d.allowed, "blocking the shared element must reject the trade");
        assertTrue(d.reasonCode != bytes32(0));
    }

    // (b) Mixed UNREGULATED/UNKNOWN status. tokenOut (RWA) is UNREGULATED,
    // tokenIn (CASH) left UNKNOWN (unregistered). Per fail-closed pair-status
    // rules, ONLY both-UNREGULATED passes through; a single UNKNOWN side must
    // reject — we never infer UNREGULATED from an absent manifest.
    function test_mixed_unregulated_unknown_fails_closed() public {
        ManifestCore memory unreg;
        unreg.status = PolicyStatus.UNREGULATED;
        policyReg.registerManifest(RWA, unreg);
        // CASH intentionally NOT registered → UNKNOWN.

        ComplianceDecision memory d = engine.evaluate(_ctxBuy());
        assertFalse(d.allowed, "a single UNKNOWN side must fail-closed");
        assertTrue(d.reasonCode != bytes32(0));
    }

    // (b2) ACTIVE RWA (tokenOut) traded against an UNKNOWN cash token (tokenIn
    // not registered). The previously fail-OPEN path: an ACTIVE side must NOT
    // pass merely because its recipes would pass — the UNKNOWN counterparty
    // makes the pair fail-closed before any recipe runs.
    function test_active_against_unknown_cash_fails_closed() public {
        policyReg.registerManifest(RWA, _activeManifest(0, 0));
        // CASH intentionally NOT registered → UNKNOWN.
        accredited.setAccredited(BUYER, true); // would otherwise satisfy RegD506c.

        ComplianceDecision memory d = engine.evaluate(_ctxBuy());
        assertFalse(d.allowed, "ACTIVE side with UNKNOWN counterparty must fail-closed");
        assertTrue(d.reasonCode != bytes32(0));
    }

    // (c) Lockup through the engine end-to-end, exercising the IAcquisitionSource
    // injection seam. Register Lockup (C-01-v1) wired to a MockAcquisitionSource and a
    // recipe that requires it. Before lockup elapses → reject; after warp → allow.
    function test_lockup_through_engine_time_gated() public {
        uint64 lockupSeconds = 365 days;
        uint64 acquiredAt = uint64(block.timestamp);

        MockAcquisitionSource acqSource = new MockAcquisitionSource();
        acqSource.setAcquiredAt(BUYER, RWA, acquiredAt);

        Lockup lockup = new Lockup(address(acqSource), lockupSeconds);
        elementReg.registerElement(bytes32("C-01-v1"), address(lockup));

        bytes32[] memory els = new bytes32[](1);
        els[0] = bytes32("C-01-v1");
        UnregisteredElementRecipe lockupRecipe = new UnregisteredElementRecipe(els);
        recipeReg.registerRecipe(6, 1, address(lockupRecipe));

        ManifestCore memory m = _activeManifest(0, 0);
        m.issuanceRecipeId = 6; // point issuance at the lockup-only recipe
        policyReg.registerManifest(RWA, m);
        _registerCashUnregulated();

        // Before lockup elapses → reject.
        ComplianceDecision memory dBefore = engine.evaluate(_ctxBuy());
        assertFalse(dBefore.allowed, "lockup not elapsed must reject");
        assertTrue(dBefore.reasonCode != bytes32(0));

        // Warp past acquiredAt + lockupSeconds → allow.
        vm.warp(uint256(acquiredAt) + lockupSeconds + 1);
        ComplianceDecision memory dAfter = engine.evaluate(_ctxBuy());
        assertTrue(dAfter.allowed, "lockup elapsed must allow");
        assertEq(dAfter.reasonCode, bytes32(0));
    }
}

/// @dev Test-only settable acquisition-time source for the Lockup element seam.
contract MockAcquisitionSource is IAcquisitionSource {
    mapping(bytes32 => uint64) internal _acquiredAt;

    function setAcquiredAt(address holder, address asset, uint64 ts) external {
        _acquiredAt[keccak256(abi.encode(holder, asset))] = ts;
    }

    function acquiredAt(address holder, address asset) external view override returns (uint64) {
        return _acquiredAt[keccak256(abi.encode(holder, asset))];
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
