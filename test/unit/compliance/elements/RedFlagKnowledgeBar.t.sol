// SPDX-License-Identifier: GPL-3.0
pragma solidity 0.8.17;

import {Test} from "forge-std/Test.sol";
import {RedFlagKnowledgeBar} from "../../../../src/compliance/elements/RedFlagKnowledgeBar.sol";
import {Errors} from "../../../../src/libraries/Errors.sol";
import {
    ElementMetadata,
    ElementCategory,
    Decidability,
    ObligationTiming,
    Statefulness,
    TemporalNature
} from "../../../../src/types/ComplianceTypes.sol";

/// @dev A-12 Red Flag Knowledge Bar unit tests.
///
///      Disposition wording (doc §5.2/§6.1/§7). Doc §7 states "disposition =
///      REVIEW" for a flagged trade; doc §6.1 defines FLAG (categorized) vs
///      REVIEW (uncertain/composite) as distinct dispositions that BOTH route to
///      the operator review queue (doc §6.3). This element returns the §6.1
///      disposition value and exposes `routesToReview()` for doc §5.2/§7's
///      "routed to review" sense. Each doc §7 case below therefore asserts (a)
///      the specific flag code, (b) the §6.1 disposition, (c) routesToReview,
///      and — the load-bearing consequence — (d) that check() never blocks.
contract RedFlagKnowledgeBarTest is Test {
    // Re-declared for vm.expectEmit (0.8.17 cannot `emit` a library/other
    // contract's event by qualified name). Must match Events.SurveillanceFlag
    // and RedFlagKnowledgeBar.ReviewResolved exactly.
    event SurveillanceFlag(bytes32 indexed elementId, address indexed subject, bytes32 reasonCode);
    event ReviewResolved(address indexed seller, address indexed buyer, RedFlagKnowledgeBar.Resolution resolution);

    bytes32 internal constant ELEMENT_ID = "A-12-v1";

    address internal seller = address(0x5E11E7);
    address internal buyer = address(0xB0B);
    address internal operator = address(0x0733);
    address internal stranger = address(0xBAD);

    RedFlagKnowledgeBar internal element;

    function setUp() public {
        element = new RedFlagKnowledgeBar();
    }

    // reasonCode as the engine/off-chain audit recomputes it: encode(0, id, n).
    function _code(uint32 n) internal pure returns (bytes32) {
        return keccak256(abi.encode(uint16(0), ELEMENT_ID, n));
    }

    function _bit(RedFlagKnowledgeBar.RedFlag flag) internal pure returns (uint8) {
        return uint8(1) << uint8(flag);
    }

    // ---------------------------------------------------------------
    // Metadata
    // ---------------------------------------------------------------

    function test_metadata_fields() public {
        ElementMetadata memory m = element.elementMetadata();
        assertEq(m.elementId, ELEMENT_ID);
        assertEq(m.version, "A-12-v1");
        // Pattern C surveillance element.
        assertEq(uint256(m.category), uint256(ElementCategory.CONDUCT_MONITORING));
        assertEq(uint256(m.decidability), uint256(Decidability.MONITORING_BASED));
        // Pre-trade, per-transaction, no cross-trade accrual (doc §2, §5.4).
        assertEq(uint256(m.timing), uint256(ObligationTiming.AT_TRADE_GATE));
        assertEq(uint256(m.temporal), uint256(TemporalNature.REALTIME));
        assertEq(uint256(m.statefulness), uint256(Statefulness.STATELESS));
    }

    // ---------------------------------------------------------------
    // Auth (Governed onlyOperator: owner + operators pass, strangers revert).
    // A-12 is STATELESS: no onTransfer / onlyEngine write path exists.
    // ---------------------------------------------------------------

    function test_raiseFlag_revertsForStranger() public {
        vm.prank(stranger);
        vm.expectRevert(Errors.NotAuthorized.selector);
        element.raiseFlag(seller, buyer, RedFlagKnowledgeBar.RedFlag.RESALE_INTENT);
    }

    function test_markUncertain_revertsForStranger() public {
        vm.prank(stranger);
        vm.expectRevert(Errors.NotAuthorized.selector);
        element.markUncertain(seller, buyer);
    }

    function test_resolveReview_revertsForStranger() public {
        vm.prank(stranger);
        vm.expectRevert(Errors.NotAuthorized.selector);
        element.resolveReview(seller, buyer, RedFlagKnowledgeBar.Resolution.CLEARED_FALSE_POSITIVE);
    }

    function test_raiseFlag_ownerCanRaise() public {
        // The deploying test contract is owner.
        element.raiseFlag(seller, buyer, RedFlagKnowledgeBar.RedFlag.WASH_CLUSTER);
        (uint8 mask,,) = element.assessmentOf(seller, buyer);
        assertEq(mask, _bit(RedFlagKnowledgeBar.RedFlag.WASH_CLUSTER));
    }

    function test_raiseFlag_operatorCanRaise() public {
        element.setOperator(operator, true);
        vm.prank(operator);
        element.raiseFlag(seller, buyer, RedFlagKnowledgeBar.RedFlag.STRUCTURING);
        (uint8 mask,,) = element.assessmentOf(seller, buyer);
        assertEq(mask, _bit(RedFlagKnowledgeBar.RedFlag.STRUCTURING));
    }

    // ---------------------------------------------------------------
    // check() NEVER blocks and NEVER leaks (doc §5.5, §6.4) — the core
    // Pattern-C consequence. True both with and without a raised flag.
    // ---------------------------------------------------------------

    function test_check_passes_whenClear() public {
        (bool passed, bytes32 reasonCode) = element.check(buyer, seller, address(0), 0, "");
        assertTrue(passed);
        assertEq(reasonCode, bytes32(0));
    }

    function test_check_passes_evenWhenFlagged_andLeaksNothing() public {
        element.raiseFlag(seller, buyer, RedFlagKnowledgeBar.RedFlag.WASH_CLUSTER);
        // Engine calls check(ctx.buyer, ctx.seller, ...): user=buyer, counterparty=seller.
        (bool passed, bytes32 reasonCode) = element.check(buyer, seller, address(0), 0, "");
        assertTrue(passed); // A-12 alone never rejects a trade
        assertEq(reasonCode, bytes32(0)); // party-facing surface carries no red-flag detail
    }

    // ---------------------------------------------------------------
    // doc §7 Test 1 — CLEAR (no red flag).
    // ---------------------------------------------------------------

    function test_doc7_case1_clear() public {
        (RedFlagKnowledgeBar.Disposition d, uint8 mask) = element.screen(seller, buyer);
        assertEq(uint256(d), uint256(RedFlagKnowledgeBar.Disposition.CLEAR));
        assertEq(mask, 0);
        assertFalse(element.routesToReview(seller, buyer));

        (bool passed,) = element.check(buyer, seller, address(0), 0, "");
        assertTrue(passed);
    }

    // ---------------------------------------------------------------
    // doc §7 Test 2 — FLAG_RESALE_INTENT (affiliate seller flips 3-day lot to a
    // FOR_OTHERS buyer → conduit). The immediate-flip + purpose judgment is the
    // off-chain screen (mock boundary); on-chain we record the mark.
    // ---------------------------------------------------------------

    function test_doc7_case2_flagResaleIntent() public {
        vm.expectEmit(true, true, false, true);
        emit SurveillanceFlag(ELEMENT_ID, seller, _code(1));
        element.raiseFlag(seller, buyer, RedFlagKnowledgeBar.RedFlag.RESALE_INTENT);

        (RedFlagKnowledgeBar.Disposition d, uint8 mask) = element.screen(seller, buyer);
        assertEq(uint256(d), uint256(RedFlagKnowledgeBar.Disposition.FLAG));
        assertEq(mask, _bit(RedFlagKnowledgeBar.RedFlag.RESALE_INTENT));
        assertTrue(element.routesToReview(seller, buyer)); // doc §7 "→ REVIEW" (routed)

        (bool passed,) = element.check(buyer, seller, address(0), 0, "");
        assertTrue(passed); // not blocked by A-12
    }

    // ---------------------------------------------------------------
    // doc §7 Test 3 — boundary: threshold-adjacent structuring. Each split leg
    // PASSes C-08/D-01 (A-12 does not judge the ">" threshold, doc §7.3), yet
    // A-12 marks the near-threshold splitting pattern.
    // ---------------------------------------------------------------

    function test_doc7_case3_boundaryStructuring() public {
        vm.expectEmit(true, true, false, true);
        emit SurveillanceFlag(ELEMENT_ID, seller, _code(5));
        element.raiseFlag(seller, buyer, RedFlagKnowledgeBar.RedFlag.STRUCTURING);

        (RedFlagKnowledgeBar.Disposition d, uint8 mask) = element.screen(seller, buyer);
        assertEq(uint256(d), uint256(RedFlagKnowledgeBar.Disposition.FLAG));
        assertEq(mask, _bit(RedFlagKnowledgeBar.RedFlag.STRUCTURING));
        assertTrue(element.routesToReview(seller, buyer));

        (bool passed,) = element.check(buyer, seller, address(0), 0, "");
        assertTrue(passed);
    }

    // ---------------------------------------------------------------
    // doc §7 Test 4 — FLAG_WASH_CLUSTER (both parties one owner cluster per A-04).
    // ---------------------------------------------------------------

    function test_doc7_case4_flagWashCluster() public {
        vm.expectEmit(true, true, false, true);
        emit SurveillanceFlag(ELEMENT_ID, seller, _code(4));
        element.raiseFlag(seller, buyer, RedFlagKnowledgeBar.RedFlag.WASH_CLUSTER);

        (RedFlagKnowledgeBar.Disposition d, uint8 mask) = element.screen(seller, buyer);
        assertEq(uint256(d), uint256(RedFlagKnowledgeBar.Disposition.FLAG));
        assertEq(mask, _bit(RedFlagKnowledgeBar.RedFlag.WASH_CLUSTER));
        assertTrue(element.routesToReview(seller, buyer));

        (bool passed,) = element.check(buyer, seller, address(0), 0, "");
        assertTrue(passed);
    }

    // ---------------------------------------------------------------
    // doc §7 Test 5 — false positive → operator CLEAR. The Test-4 wash-cluster
    // mark turns out to be a legit self-transfer; the operator resolves it as a
    // false positive → disposition normalizes to CLEAR, but the raw flag mask is
    // RETAINED as the reasonable-inquiry audit trail (doc §7.5).
    // ---------------------------------------------------------------

    function test_doc7_case5_falsePositiveOperatorClear() public {
        element.raiseFlag(seller, buyer, RedFlagKnowledgeBar.RedFlag.WASH_CLUSTER);

        vm.expectEmit(true, true, false, true);
        emit ReviewResolved(seller, buyer, RedFlagKnowledgeBar.Resolution.CLEARED_FALSE_POSITIVE);
        element.resolveReview(seller, buyer, RedFlagKnowledgeBar.Resolution.CLEARED_FALSE_POSITIVE);

        (RedFlagKnowledgeBar.Disposition d, uint8 mask) = element.screen(seller, buyer);
        assertEq(uint256(d), uint256(RedFlagKnowledgeBar.Disposition.CLEAR)); // normalized
        assertEq(mask, _bit(RedFlagKnowledgeBar.RedFlag.WASH_CLUSTER)); // raw signal retained
        assertFalse(element.routesToReview(seller, buyer));

        // The audit record still shows the raw flag + the operator's resolution.
        (uint8 rawMask, bool uncertain, RedFlagKnowledgeBar.Resolution res) = element.assessmentOf(seller, buyer);
        assertEq(rawMask, _bit(RedFlagKnowledgeBar.RedFlag.WASH_CLUSTER));
        assertFalse(uncertain);
        assertEq(uint256(res), uint256(RedFlagKnowledgeBar.Resolution.CLEARED_FALSE_POSITIVE));

        (bool passed,) = element.check(buyer, seller, address(0), 0, "");
        assertTrue(passed);
    }

    // ---------------------------------------------------------------
    // REVIEW_REDFLAG_UNCERTAIN — ambiguous/composite goes straight to REVIEW
    // (doc §6.2, §11.4). Distinct disposition value from FLAG.
    // ---------------------------------------------------------------

    function test_markUncertain_yieldsReviewDisposition() public {
        vm.expectEmit(true, true, false, true);
        emit SurveillanceFlag(ELEMENT_ID, seller, _code(8));
        element.markUncertain(seller, buyer);

        (RedFlagKnowledgeBar.Disposition d,) = element.screen(seller, buyer);
        assertEq(uint256(d), uint256(RedFlagKnowledgeBar.Disposition.REVIEW));
        assertTrue(element.routesToReview(seller, buyer));

        (bool passed,) = element.check(buyer, seller, address(0), 0, "");
        assertTrue(passed);
    }

    // ---------------------------------------------------------------
    // Every flag code fires at least once, in doc §6.2 order: RedFlag(i) => n=i+1,
    // plus REVIEW_REDFLAG_UNCERTAIN => n=8. Also pins the flag->axis mapping.
    // ---------------------------------------------------------------

    function test_everyFlagCode_encodesInDocOrder_andMapsAxis() public {
        for (uint8 i = 0; i <= uint8(RedFlagKnowledgeBar.RedFlag.SUSPICIOUS_PATTERN); i++) {
            RedFlagKnowledgeBar.RedFlag flag = RedFlagKnowledgeBar.RedFlag(i);
            assertEq(element.reasonCodeFor(flag), _code(uint32(i) + 1));

            RedFlagKnowledgeBar.Axis expectedAxis = i <= uint8(RedFlagKnowledgeBar.RedFlag.AI_INCONSISTENT)
                ? RedFlagKnowledgeBar.Axis.RESALE
                : RedFlagKnowledgeBar.Axis.MARKET_CONDUCT;
            assertEq(uint256(element.axisOf(flag)), uint256(expectedAxis));
        }
        assertEq(element.reviewUncertainCode(), _code(8));
    }

    function test_everyFlagCode_emitsWhenRaised() public {
        // Distinct (seller,buyer) per category so each mark is independent.
        for (uint8 i = 0; i <= uint8(RedFlagKnowledgeBar.RedFlag.SUSPICIOUS_PATTERN); i++) {
            RedFlagKnowledgeBar.RedFlag flag = RedFlagKnowledgeBar.RedFlag(i);
            address s = address(uint160(0x1000 + i));
            address b = address(uint160(0x2000 + i));

            vm.expectEmit(true, true, false, true);
            emit SurveillanceFlag(ELEMENT_ID, s, _code(uint32(i) + 1));
            element.raiseFlag(s, b, flag);

            (RedFlagKnowledgeBar.Disposition d, uint8 mask) = element.screen(s, b);
            assertEq(uint256(d), uint256(RedFlagKnowledgeBar.Disposition.FLAG));
            assertEq(mask, _bit(flag));
        }
    }

    // ---------------------------------------------------------------
    // Multiple categories accumulate in the mask (doc §5.2 appends flags).
    // ---------------------------------------------------------------

    function test_multipleFlags_accumulateInMask() public {
        element.raiseFlag(seller, buyer, RedFlagKnowledgeBar.RedFlag.RESALE_INTENT);
        element.raiseFlag(seller, buyer, RedFlagKnowledgeBar.RedFlag.CONTROL_UNDISCLOSED);

        (RedFlagKnowledgeBar.Disposition d, uint8 mask) = element.screen(seller, buyer);
        assertEq(uint256(d), uint256(RedFlagKnowledgeBar.Disposition.FLAG));
        assertEq(
            mask,
            _bit(RedFlagKnowledgeBar.RedFlag.RESALE_INTENT) | _bit(RedFlagKnowledgeBar.RedFlag.CONTROL_UNDISCLOSED)
        );
    }

    // Re-raising the same category is idempotent (bit OR, no double-set).
    function test_raiseFlag_idempotentPerCategory() public {
        element.raiseFlag(seller, buyer, RedFlagKnowledgeBar.RedFlag.PRICE_ANOMALY);
        element.raiseFlag(seller, buyer, RedFlagKnowledgeBar.RedFlag.PRICE_ANOMALY);
        (uint8 mask,,) = element.assessmentOf(seller, buyer);
        assertEq(mask, _bit(RedFlagKnowledgeBar.RedFlag.PRICE_ANOMALY));
    }

    // ---------------------------------------------------------------
    // resolveReview outcomes other than false-positive: A-12 records them but
    // does NOT clear the disposition and NEVER blocks (doc §5.5, §6.1). Suspend/
    // SAR is a Recipe/operator action outside this element.
    // ---------------------------------------------------------------

    function test_resolveReview_riskConfirmed_keepsFlag_andDoesNotBlock() public {
        element.raiseFlag(seller, buyer, RedFlagKnowledgeBar.RedFlag.SUSPICIOUS_PATTERN);
        element.resolveReview(seller, buyer, RedFlagKnowledgeBar.Resolution.RISK_CONFIRMED);

        (RedFlagKnowledgeBar.Disposition d,) = element.screen(seller, buyer);
        assertEq(uint256(d), uint256(RedFlagKnowledgeBar.Disposition.FLAG)); // still flagged
        assertTrue(element.routesToReview(seller, buyer));

        (bool passed,) = element.check(buyer, seller, address(0), 0, "");
        assertTrue(passed); // A-12 never blocks, even on confirmed risk
    }

    // A fresh mark after a false-positive clear reopens triage (resolution -> PENDING).
    function test_raiseFlag_afterClear_reopensReview() public {
        element.raiseFlag(seller, buyer, RedFlagKnowledgeBar.RedFlag.WASH_CLUSTER);
        element.resolveReview(seller, buyer, RedFlagKnowledgeBar.Resolution.CLEARED_FALSE_POSITIVE);
        // Cleared -> CLEAR.
        (RedFlagKnowledgeBar.Disposition dCleared,) = element.screen(seller, buyer);
        assertEq(uint256(dCleared), uint256(RedFlagKnowledgeBar.Disposition.CLEAR));

        // A new, different signal reopens the review.
        element.raiseFlag(seller, buyer, RedFlagKnowledgeBar.RedFlag.PRICE_ANOMALY);
        (RedFlagKnowledgeBar.Disposition dReopened, uint8 mask) = element.screen(seller, buyer);
        assertEq(uint256(dReopened), uint256(RedFlagKnowledgeBar.Disposition.FLAG));
        assertEq(mask, _bit(RedFlagKnowledgeBar.RedFlag.WASH_CLUSTER) | _bit(RedFlagKnowledgeBar.RedFlag.PRICE_ANOMALY));
        (,, RedFlagKnowledgeBar.Resolution res) = element.assessmentOf(seller, buyer);
        assertEq(uint256(res), uint256(RedFlagKnowledgeBar.Resolution.PENDING));
    }
}
