// SPDX-License-Identifier: GPL-3.0
pragma solidity 0.8.17;

import {Test} from "forge-std/Test.sol";
import {EngineSelection} from "../../../../src/compliance/elements/EngineSelection.sol";
import {Errors} from "../../../../src/libraries/Errors.sol";
import {
    ElementMetadata,
    ElementCategory,
    TemporalNature,
    Decidability,
    ObligationTiming,
    Statefulness,
    ComplianceContext,
    VenueType
} from "../../../../src/types/ComplianceTypes.sol";

contract EngineSelectionTest is Test {
    // Re-declared to match EngineSelection's events for vm.expectEmit (Solidity
    // 0.8.17 cannot reference a non-library contract's event by qualified name in
    // an `emit` statement; that requires >=0.8.22).
    event SupportedEnginesSet(address indexed asset, uint8 engines);
    event MarketMakerClaimSet(address indexed buyer, bool hasClaim);
    event NoGsEngineSetUpdated(uint8 engineSet);
    event AffiliateEngineSetUpdated(uint8 engineSet);

    // Manifest bit convention: bit i == VenueType(i) (AMM=0, ORDER_BOOK=1, RFQ=2).
    uint8 internal constant AMM_BIT = 0x01;
    uint8 internal constant OB_BIT = 0x02;
    uint8 internal constant RFQ_BIT = 0x04;
    uint8 internal constant CARD_RFQ_OB = OB_BIT | RFQ_BIT; // BUIDL-like: {RFQ, OB}
    uint8 internal constant CARD_ALL = AMM_BIT | OB_BIT | RFQ_BIT;

    address internal asset = address(0xBEEF);
    address internal operator = address(0x0733);
    address internal stranger = address(0xBAD);
    address internal buyer = address(0xB0B); // stands in for the counterparty
    address internal seller = address(0xA11CE);

    EngineSelection internal element;

    function setUp() public {
        element = new EngineSelection();
        element.setSupportedEngines(asset, CARD_RFQ_OB);
    }

    // ── helpers ────────────────────────────────────────────────────────────
    function _reason(uint32 n) internal pure returns (bytes32) {
        return keccak256(abi.encode(uint16(0), bytes32("B-04-v1"), uint32(n)));
    }

    function _ctx(VenueType v, address buyer_, bool affiliate) internal pure returns (bytes memory) {
        ComplianceContext memory c;
        c.buyer = buyer_;
        c.seller = address(0xA11CE);
        c.venueType = v;
        c.sellerIsAffiliate = affiliate;
        return abi.encode(c);
    }

    function _check(address asset_, VenueType v, address buyer_, bool affiliate)
        internal
        view
        returns (bool passed, bytes32 reasonCode)
    {
        return element.check(seller, buyer_, asset_, 0, _ctx(v, buyer_, affiliate));
    }

    // ── metadata / construction ─────────────────────────────────────────────
    function test_metadata_fields() public {
        ElementMetadata memory m = element.elementMetadata();
        assertEq(m.elementId, bytes32("B-04-v1"));
        assertEq(uint256(m.category), uint256(ElementCategory.RESALE_TRANSACTION));
        assertEq(uint256(m.temporal), uint256(TemporalNature.REALTIME));
        assertEq(uint256(m.decidability), uint256(Decidability.DETERMINISTIC));
        assertEq(uint256(m.timing), uint256(ObligationTiming.AT_TRADE_GATE));
        assertEq(uint256(m.statefulness), uint256(Statefulness.STATELESS));
    }

    function test_constructor_initsGovernanceSetsToRfqOnly() public {
        assertEq(element.noGsEngineSet(), RFQ_BIT);
        assertEq(element.affiliateEngineSet(), RFQ_BIT);
    }

    // ── operator gating + setter events ──────────────────────────────────────
    function test_setSupportedEngines_revertsForNonOperator() public {
        vm.prank(stranger);
        vm.expectRevert(Errors.NotAuthorized.selector);
        element.setSupportedEngines(asset, CARD_ALL);
    }

    function test_setMarketMakerClaim_revertsForNonOperator() public {
        vm.prank(stranger);
        vm.expectRevert(Errors.NotAuthorized.selector);
        element.setMarketMakerClaim(buyer, true);
    }

    function test_setNoGsEngineSet_revertsForNonOperator() public {
        vm.prank(stranger);
        vm.expectRevert(Errors.NotAuthorized.selector);
        element.setNoGsEngineSet(CARD_ALL);
    }

    function test_setSupportedEngines_emitsEvent_andUpdatesStorage() public {
        vm.expectEmit(true, false, false, true);
        emit SupportedEnginesSet(asset, CARD_ALL);
        element.setSupportedEngines(asset, CARD_ALL);
        assertEq(element.supportedEnginesOf(asset), CARD_ALL);
    }

    function test_setMarketMakerClaim_emitsEvent_andUpdatesStorage() public {
        vm.expectEmit(true, false, false, true);
        emit MarketMakerClaimSet(buyer, true);
        element.setMarketMakerClaim(buyer, true);
        assertTrue(element.mmClaimOf(buyer));
    }

    function test_setGovernanceSets_emitEvents() public {
        vm.expectEmit(false, false, false, true);
        emit NoGsEngineSetUpdated(CARD_ALL);
        element.setNoGsEngineSet(CARD_ALL);
        assertEq(element.noGsEngineSet(), CARD_ALL);

        vm.expectEmit(false, false, false, true);
        emit AffiliateEngineSetUpdated(CARD_ALL);
        element.setAffiliateEngineSet(CARD_ALL);
        assertEq(element.affiliateEngineSet(), CARD_ALL);
    }

    function test_operatorCanSet() public {
        element.setOperator(operator, true);
        vm.prank(operator);
        element.setSupportedEngines(asset, CARD_ALL);
        assertEq(element.supportedEnginesOf(asset), CARD_ALL);
    }

    // ── T1: non-affiliate order-book pass ────────────────────────────────────
    function test_T1_nonAffiliateOrderBook_pass() public {
        (bool passed, bytes32 rc) = _check(asset, VenueType.ORDER_BOOK, buyer, false);
        assertTrue(passed);
        assertEq(rc, bytes32(0));
    }

    // ── T2: undeclared engine => code 4 ──────────────────────────────────────
    function test_T2_undeclaredEngine_fails4() public {
        // AMM is not in the {RFQ, OB} card; G③ blocks before any overlay.
        (bool passed, bytes32 rc) = _check(asset, VenueType.AMM, buyer, false);
        assertFalse(passed);
        assertEq(rc, _reason(4));
    }

    // ── T3: affiliate + order-book => code 6 (even though OB is declared) ─────
    function test_T3_affiliateOrderBook_fails6() public {
        // 김 부장 scenario: OB is in the declared set (G③ passes) but not in the
        // affiliate manner-of-sale set, so G⑤a closes it for this seller.
        (bool passed, bytes32 rc) = _check(asset, VenueType.ORDER_BOOK, buyer, true);
        assertFalse(passed);
        assertEq(rc, _reason(6));
    }

    // ── T4: affiliate + RFQ + buyer MM claim => PASS (김 부장) ────────────────
    function test_T4_affiliateRfqWithMmClaim_pass() public {
        element.setMarketMakerClaim(buyer, true);
        (bool passed, bytes32 rc) = _check(asset, VenueType.RFQ, buyer, true);
        assertTrue(passed);
        assertEq(rc, bytes32(0));
    }

    // ── T5: affiliate + RFQ, no MM claim => code 7 ───────────────────────────
    function test_T5_affiliateRfqNoMmClaim_fails7() public {
        (bool passed, bytes32 rc) = _check(asset, VenueType.RFQ, buyer, true);
        assertFalse(passed);
        assertEq(rc, _reason(7));
    }

    // ── DEBT carve-out: affiliate + order-book on debt security => PASS ──────
    function test_debtSecurity_affiliateOrderBook_pass() public {
        element.setDebtSecurity(asset, true);
        // Rule 144(f)(3)(ii): (f) does not apply to debt securities, so the
        // affiliate overlay is skipped entirely and OB (declared) passes.
        (bool passed, bytes32 rc) = _check(asset, VenueType.ORDER_BOOK, buyer, true);
        assertTrue(passed);
        assertEq(rc, bytes32(0));
    }

    // ── T6: path overlay pair + intersection ─────────────────────────────────
    function test_T6a_sec4a7OrderBook_fails5() public {
        element.setSec4a7Path(asset, true);
        (bool passed, bytes32 rc) = _check(asset, VenueType.ORDER_BOOK, buyer, false);
        assertFalse(passed);
        assertEq(rc, _reason(5));
    }

    function test_T6b_rule144OrderBook_pass() public {
        // Asymmetry regression: the logic that blocks the SEC4A7+OB case in T6a
        // must NOT block a Rule 144 (sec4a7=false) OB sale — no manner axis there.
        (bool passed, bytes32 rc) = _check(asset, VenueType.ORDER_BOOK, buyer, false);
        assertTrue(passed);
        assertEq(rc, bytes32(0));
    }

    function test_T6c_sec4a7Amm_fails5() public {
        // AMM must be declared to reach G④; use the all-engines card.
        element.setSupportedEngines(asset, CARD_ALL);
        element.setSec4a7Path(asset, true);
        (bool passed, bytes32 rc) = _check(asset, VenueType.AMM, buyer, false);
        assertFalse(passed);
        assertEq(rc, _reason(5));
    }

    function test_T6d_sec4a7Rfq_pass() public {
        element.setSec4a7Path(asset, true);
        (bool passed, bytes32 rc) = _check(asset, VenueType.RFQ, buyer, false);
        assertTrue(passed);
        assertEq(rc, bytes32(0));
    }

    // Intersection: both G④ and G⑤ active. Engine must be in BOTH sets. This is
    // pinned even though noGsEngineSet == affiliateEngineSet == {RFQ} today, so a
    // future union-implementation bug surfaces when the sets diverge (doc §5.3).
    function test_T6_intersection_affiliateSec4a7RfqWithMmClaim_pass() public {
        element.setSec4a7Path(asset, true);
        element.setMarketMakerClaim(buyer, true);
        (bool passed, bytes32 rc) = _check(asset, VenueType.RFQ, buyer, true);
        assertTrue(passed);
        assertEq(rc, bytes32(0));
    }

    function test_T6_intersection_minusMmClaim_fails7() public {
        element.setSec4a7Path(asset, true);
        (bool passed, bytes32 rc) = _check(asset, VenueType.RFQ, buyer, true);
        assertFalse(passed);
        assertEq(rc, _reason(7));
    }

    // ── T7: card regression (missing / unknown bit) ──────────────────────────
    function test_T7a_missingDeclaration_fails1() public {
        element.setSupportedEngines(asset, 0);
        (bool passed, bytes32 rc) = _check(asset, VenueType.RFQ, buyer, false);
        assertFalse(passed);
        assertEq(rc, _reason(1));
    }

    function test_T7b_unknownBit_fails2() public {
        // bit3 (0x08) is outside VALID_ENGINES; must NOT be silently AND-masked.
        element.setSupportedEngines(asset, 0x08 | RFQ_BIT);
        (bool passed, bytes32 rc) = _check(asset, VenueType.RFQ, buyer, false);
        assertFalse(passed);
        assertEq(rc, _reason(2));
    }

    // ── empty context => code 3 (fail-closed safety pin) ─────────────────────
    function test_emptyContext_fails3() public {
        (bool passed, bytes32 rc) = element.check(seller, buyer, asset, 0, "");
        assertFalse(passed);
        assertEq(rc, _reason(3));
    }

    // ── T8: 90-day affiliate tail — flag true blocks, flag false passes ──────
    function test_T8_affiliateTail_blocksThenPasses() public {
        // A-06 keeps sellerIsAffiliate = true through the 90-day tail even after a
        // director resigns; the OB sale must still fail while the flag is set.
        (bool blocked, bytes32 rc) = _check(asset, VenueType.ORDER_BOOK, buyer, true);
        assertFalse(blocked);
        assertEq(rc, _reason(6));

        // Once the tail lapses (flag cleared upstream), the same OB sale passes.
        (bool passed, bytes32 rc2) = _check(asset, VenueType.ORDER_BOOK, buyer, false);
        assertTrue(passed);
        assertEq(rc2, bytes32(0));
    }

    // ── validateEngineDeclaration (listing-time V1/V2) ───────────────────────
    function test_validateEngineDeclaration_ok() public {
        (bool ok, bytes32 rc) = element.validateEngineDeclaration(asset);
        assertTrue(ok);
        assertEq(rc, bytes32(0));
    }

    function test_validateEngineDeclaration_missing_code1() public {
        (bool ok, bytes32 rc) = element.validateEngineDeclaration(address(0xDEAD));
        assertFalse(ok);
        assertEq(rc, _reason(1));
    }

    function test_validateEngineDeclaration_invalid_code2() public {
        element.setSupportedEngines(asset, 0x08);
        (bool ok, bytes32 rc) = element.validateEngineDeclaration(asset);
        assertFalse(ok);
        assertEq(rc, _reason(2));
    }
}
