// SPDX-License-Identifier: GPL-3.0
pragma solidity 0.8.17;

import {Test} from "forge-std/Test.sol";
import {Vm} from "forge-std/Vm.sol";
import {FraudSurveillance} from "../../../../src/compliance/elements/FraudSurveillance.sol";
import {Errors} from "../../../../src/libraries/Errors.sol";
import {
    ElementMetadata,
    ElementCategory,
    Decidability,
    ObligationTiming,
    Statefulness,
    TemporalNature
} from "../../../../src/types/ComplianceTypes.sol";

contract FraudSurveillanceTest is Test {
    // Re-declared to match FraudSurveillance's events for vm.expectEmit (Solidity
    // 0.8.17 cannot reference a non-library contract's event by qualified name in
    // an `emit` statement; that requires >=0.8.22).
    event OperatorSet(address indexed operator, bool enabled);
    event IdentityGroupSet(address indexed wallet, bytes32 indexed group);
    event StructuringWindowSet(uint64 window);
    event FlagLifecycle(uint256 indexed flagId, FraudSurveillance.FlagState state, bytes32 reasonCode);
    event DeadlineExtended(uint256 indexed flagId, uint64 newDeadline);

    bytes32 internal constant ELEMENT_ID = "F-03-v1";

    address internal engine = address(0xE11E);
    address internal operator = address(0x0733);
    address internal stranger = address(0xBAD);
    address internal buyer = address(0xB0B);

    // A-04-linked disguised wallets (one identity) for structuring (doc §7.1).
    address internal w1 = address(0xA1);
    address internal w2 = address(0xA2);
    address internal w3 = address(0xA3);
    bytes32 internal constant GROUP = keccak256("identity-42");

    // Fixed epoch anchor so every timeline is deterministic.
    uint64 internal constant START = 1_700_000_000;

    FraudSurveillance internal element;

    function setUp() public {
        element = new FraudSurveillance();
        element.setEngine(engine); // owner (this test contract) wires the engine
        vm.warp(START);
    }

    function _code(uint32 n) internal pure returns (bytes32) {
        return keccak256(abi.encode(uint16(0), ELEMENT_ID, n));
    }

    // =================================================================
    // Metadata
    // =================================================================

    function test_metadata_fields() public {
        ElementMetadata memory m = element.elementMetadata();
        assertEq(m.elementId, ELEMENT_ID);
        assertEq(uint256(m.category), uint256(ElementCategory.CONDUCT_MONITORING));
        assertEq(uint256(m.decidability), uint256(Decidability.MONITORING_BASED));
        assertEq(uint256(m.timing), uint256(ObligationTiming.EX_POST_TRIGGER));
        assertEq(uint256(m.statefulness), uint256(Statefulness.STATEFUL));
        assertEq(uint256(m.temporal), uint256(TemporalNature.CUMULATIVE));
    }

    function test_statutory_constants() public {
        assertEq(element.SAR_THRESHOLD(), 5000); // 31 CFR §1023.320(a)(2)
        assertEq(uint256(element.FILE_DEADLINE()), uint256(30 days)); // (b)(3)
        assertEq(uint256(element.MAX_DEADLINE()), uint256(60 days)); // (b)(3)
    }

    // =================================================================
    // Auth: onTransfer onlyEngine; setters onlyOperator/onlyOwner; events
    // =================================================================

    function test_onTransfer_revertsForStranger() public {
        vm.prank(stranger);
        vm.expectRevert(Errors.NotAuthorized.selector);
        element.onTransfer(w1, buyer, 6000);
    }

    function test_onTransfer_engineCanCall() public {
        vm.prank(engine);
        element.onTransfer(w1, buyer, 500000);
        assertEq(element.flagCount(), 0); // large-but-single => not structuring
    }

    function test_setOperator_revertsForNonOwner() public {
        vm.prank(stranger);
        vm.expectRevert(Errors.NotAuthorized.selector);
        element.setOperator(operator, true);
    }

    function test_setOperator_operatorCannotSet_ownerOnly() public {
        element.setOperator(operator, true);
        // an operator is NOT governance: setOperator is onlyOwner
        vm.prank(operator);
        vm.expectRevert(Errors.NotAuthorized.selector);
        element.setOperator(stranger, true);
    }

    function test_setOperator_ownerCanSet_emitsEvent() public {
        vm.expectEmit(true, false, false, true);
        emit OperatorSet(operator, true);
        element.setOperator(operator, true);
        assertTrue(element.isOperator(operator));
    }

    function test_setIdentityGroup_operatorGated_andEmits() public {
        vm.prank(stranger);
        vm.expectRevert(Errors.NotAuthorized.selector);
        element.setIdentityGroup(w1, GROUP);

        vm.expectEmit(true, true, false, false);
        emit IdentityGroupSet(w1, GROUP);
        element.setIdentityGroup(w1, GROUP); // owner counts as operator
        assertEq(element.identityGroupOf(w1), GROUP);
    }

    function test_setStructuringWindow_operatorGated_andEmits() public {
        vm.prank(stranger);
        vm.expectRevert(Errors.NotAuthorized.selector);
        element.setStructuringWindow(2 days);

        vm.expectEmit(false, false, false, true);
        emit StructuringWindowSet(2 days);
        element.setStructuringWindow(2 days);
        assertEq(uint256(element.structuringWindow()), uint256(2 days));
    }

    function test_attestSuspicion_revertsForStranger() public {
        vm.prank(stranger);
        vm.expectRevert(Errors.NotAuthorized.selector);
        element.attestSuspicion(w1, FraudSurveillance.SuspicionCategory.ILLICIT_FUNDS, 10000, false, true);
    }

    function test_attestSuspicion_operatorCanCall() public {
        element.setOperator(operator, true);
        vm.prank(operator);
        uint256 id = element.attestSuspicion(w1, FraudSurveillance.SuspicionCategory.ILLICIT_FUNDS, 10000, false, true);
        assertEq(id, 1);
    }

    // Confidential views are operator-gated (doc §6.4) — a trade party cannot
    // read flag state at all.
    function test_flagOf_revertsForStranger() public {
        element.attestSuspicion(w1, FraudSurveillance.SuspicionCategory.ILLICIT_FUNDS, 10000, false, true);
        vm.prank(stranger);
        vm.expectRevert(Errors.NotAuthorized.selector);
        element.flagOf(1);
    }

    // =================================================================
    // doc §7 Test 1 — obvious suspicion (structuring pattern), auto-detected
    // =================================================================

    function test_doc7_test1_structuringPatternFlagged() public {
        // A-04 links the three wallets to one identity so they aggregate.
        element.setIdentityGroup(w1, GROUP);
        element.setIdentityGroup(w2, GROUP);
        element.setIdentityGroup(w3, GROUP);

        // 3 x $2,000, 6 minutes apart. Each single < $5,000; aggregate = $6,000.
        vm.prank(engine);
        element.onTransfer(w1, buyer, 2000);
        assertEq(element.flagCount(), 0);

        vm.warp(START + 6 minutes);
        vm.prank(engine);
        element.onTransfer(w2, buyer, 2000);
        assertEq(element.flagCount(), 0);

        vm.warp(START + 12 minutes);
        vm.prank(engine);
        element.onTransfer(w3, buyer, 2000); // aggregate crosses $5,000 => FLAG

        assertEq(element.flagCount(), 1);
        FraudSurveillance.Flag memory f = element.flagOf(1);
        assertEq(uint256(f.category), uint256(FraudSurveillance.SuspicionCategory.STRUCTURING_EVASION));
        assertEq(uint256(f.state), uint256(FraudSurveillance.FlagState.DETECTED));
        assertEq(f.subject, w3);
        assertEq(uint256(f.detectedAt), uint256(START + 12 minutes)); // initial detection clock (doc §5.4)
        assertEq(uint256(f.deadline), uint256(START + 12 minutes + 30 days)); // 30d (doc §5.3)
        assertEq(element.reasonCodeOf(1), _code(2)); // STRUCTURING_EVASION => code 2

        // Party-facing surface reveals nothing (doc §6.4/§7.5).
        (bool passed, bytes32 rc) = element.check(w3, buyer, address(0), 2000, "");
        assertTrue(passed);
        assertEq(rc, bytes32(0));
    }

    // Aggregate exactly $5,000 also crosses (>=, inclusive — doc §5.3).
    function test_doc7_test1_structuringAggregateExactly5000Flags() public {
        element.setIdentityGroup(w1, GROUP);
        element.setIdentityGroup(w2, GROUP);

        vm.prank(engine);
        element.onTransfer(w1, buyer, 2000);
        vm.prank(engine);
        element.onTransfer(w2, buyer, 3000); // aggregate == 5000 exactly

        assertEq(element.flagCount(), 1);
        FraudSurveillance.Flag memory f = element.flagOf(1);
        assertEq(uint256(f.category), uint256(FraudSurveillance.SuspicionCategory.STRUCTURING_EVASION));
    }

    // Sub-threshold pieces that never aggregate to $5,000 are NOT flagged.
    function test_structuringBelowAggregate_notFlagged() public {
        element.setIdentityGroup(w1, GROUP);
        element.setIdentityGroup(w2, GROUP);

        vm.prank(engine);
        element.onTransfer(w1, buyer, 2000);
        vm.prank(engine);
        element.onTransfer(w2, buyer, 2000); // aggregate 4000 < 5000

        assertEq(element.flagCount(), 0);
    }

    // Pieces separated by more than the window do NOT aggregate.
    function test_structuringOutsideWindow_notFlagged() public {
        element.setIdentityGroup(w1, GROUP);
        element.setIdentityGroup(w2, GROUP);

        vm.prank(engine);
        element.onTransfer(w1, buyer, 4000);
        vm.warp(START + 2 days); // window (1 day default) has elapsed
        vm.prank(engine);
        element.onTransfer(w2, buyer, 4000); // fresh window: 4000 < 5000

        assertEq(element.flagCount(), 0);
    }

    // =================================================================
    // doc §7 Test 2 — clearly normal: large single trade is NOT flagged
    // =================================================================

    function test_doc7_test2_largeNormalTradeNotFlagged() public {
        vm.prank(engine);
        element.onTransfer(w1, buyer, 500000); // QP buys BUIDL $500K, ordinary

        assertEq(element.flagCount(), 0); // above threshold, but no category hit
        (bool passed, bytes32 rc) = element.check(w1, buyer, address(0), 500000, "");
        assertTrue(passed);
        assertEq(rc, bytes32(0));
    }

    // =================================================================
    // doc §7 Test 3 — boundaries: $5,000-exactly and 30-day-exactly
    // =================================================================

    // (a) amount boundary: exactly $5,000 opens (>=, inclusive).
    function test_doc7_test3_amountExactly5000Opens() public {
        uint256 id =
            element.attestSuspicion(w1, FraudSurveillance.SuspicionCategory.NO_LAWFUL_PURPOSE, 5000, false, true);
        assertEq(id, 1);
        FraudSurveillance.Flag memory f = element.flagOf(1);
        assertEq(uint256(f.state), uint256(FraudSurveillance.FlagState.DETECTED));
    }

    // (a) amount boundary: $4,999 does NOT open (below threshold => NO_FLAG).
    function test_doc7_test3_amountBelow5000DoesNotOpen() public {
        uint256 id =
            element.attestSuspicion(w1, FraudSurveillance.SuspicionCategory.NO_LAWFUL_PURPOSE, 4999, false, true);
        assertEq(id, 0);
        assertEq(element.flagCount(), 0);
    }

    // (b) deadline boundary: filing on day 30 exactly is timely (<=, inclusive).
    function test_doc7_test3_filingOnDay30IsTimely() public {
        element.attestSuspicion(w1, FraudSurveillance.SuspicionCategory.NO_LAWFUL_PURPOSE, 5000, false, true);
        vm.warp(START + 30 days); // exactly day 30
        element.fileSar(1);

        assertTrue(element.filedOnTime(1));
        FraudSurveillance.Flag memory f = element.flagOf(1);
        assertEq(uint256(f.state), uint256(FraudSurveillance.FlagState.SAR_FILED));
    }

    // (b) deadline boundary: past day 30 is late (BSA violation, 1023.320(g)).
    function test_doc7_test3_filingPastDay30IsLate() public {
        element.attestSuspicion(w1, FraudSurveillance.SuspicionCategory.NO_LAWFUL_PURPOSE, 5000, false, true);
        vm.warp(START + 30 days + 1);
        assertTrue(element.isOverdue(1)); // escalation view flags it before filing
        element.fileSar(1);
        assertFalse(element.filedOnTime(1));
    }

    // =================================================================
    // doc §7 Test 4 — attempted (unsettled) + no economic purpose
    // =================================================================

    function test_doc7_test4_attemptedNoLawfulPurpose_reviewedThenCleared() public {
        // Unsettled attempts never reach onTransfer; the Operator attests them.
        uint256 id =
            element.attestSuspicion(w1, FraudSurveillance.SuspicionCategory.NO_LAWFUL_PURPOSE, 8000, true, false);
        FraudSurveillance.Flag memory f = element.flagOf(id);
        assertTrue(f.attempted);
        assertEq(uint256(f.category), uint256(FraudSurveillance.SuspicionCategory.NO_LAWFUL_PURPOSE));
        assertEq(element.reasonCodeOf(id), _code(3));

        element.openReview(id); // DETECTED -> UNDER_REVIEW
        assertEq(uint256(element.flagOf(id).state), uint256(FraudSurveillance.FlagState.UNDER_REVIEW));

        // Operator finds a reasonable explanation (doc §5.5) -> CLEARED.
        element.clearFlag(id);
        assertEq(uint256(element.flagOf(id).state), uint256(FraudSurveillance.FlagState.CLEARED));
    }

    // =================================================================
    // doc §7 Test 5 — no-tipping-off (party-facing surface stays clean)
    // =================================================================

    // The party-facing surface (`check`) reveals nothing even for a flagged
    // subject, and flag state is unreadable by a trade party.
    function test_doc7_test5_partyFacingSurfaceRevealsNothing() public {
        element.attestSuspicion(w1, FraudSurveillance.SuspicionCategory.ILLICIT_FUNDS, 100000, false, true);

        // check() returns clean for the flagged subject and for anyone else.
        (bool passed1, bytes32 rc1) = element.check(w1, buyer, address(0), 100000, "");
        (bool passed2, bytes32 rc2) = element.check(buyer, w1, address(0), 1, "");
        assertTrue(passed1);
        assertTrue(passed2);
        assertEq(rc1, bytes32(0));
        assertEq(rc2, bytes32(0));

        // A trade party cannot read any flag surface.
        vm.startPrank(stranger);
        vm.expectRevert(Errors.NotAuthorized.selector);
        element.flagOf(1);
        vm.expectRevert(Errors.NotAuthorized.selector);
        element.reasonCodeOf(1);
        vm.expectRevert(Errors.NotAuthorized.selector);
        element.flagCount();
        vm.stopPrank();
    }

    // onTransfer opens a flag WITHOUT emitting any event — an event in the
    // settlement transaction would itself tip off that tx's parties (doc §6.4).
    function test_doc7_test5_onTransferEmitsNoEvent() public {
        element.setIdentityGroup(w1, GROUP);
        element.setIdentityGroup(w2, GROUP);

        vm.prank(engine);
        element.onTransfer(w1, buyer, 3000);

        vm.recordLogs();
        vm.prank(engine);
        element.onTransfer(w2, buyer, 3000); // this opens the structuring flag
        Vm.Log[] memory logs = vm.getRecordedLogs();

        assertEq(element.flagCount(), 1); // flag WAS opened
        assertEq(logs.length, 0); // ...but silently (no on-chain trace)
    }

    // =================================================================
    // Every flag code (§1023.320(a)(2) categories 1..4) at least once
    // =================================================================

    // code 1 — ILLICIT_FUNDS (a)(2)(i)
    function test_code1_illicitFunds_emitsAndStoresCode() public {
        vm.expectEmit(true, false, false, true);
        emit FlagLifecycle(1, FraudSurveillance.FlagState.DETECTED, _code(1));
        uint256 id = element.attestSuspicion(w1, FraudSurveillance.SuspicionCategory.ILLICIT_FUNDS, 9000, false, true);
        assertEq(element.reasonCodeOf(id), _code(1));
    }

    // code 2 — STRUCTURING_EVASION (a)(2)(ii): asserted in test1 (auto path).
    // Re-asserted here via the operator path so the emitted code is checked too.
    function test_code2_structuring_operatorPath() public {
        vm.expectEmit(true, false, false, true);
        emit FlagLifecycle(1, FraudSurveillance.FlagState.DETECTED, _code(2));
        element.attestSuspicion(w1, FraudSurveillance.SuspicionCategory.STRUCTURING_EVASION, 7000, false, true);
    }

    // code 3 — NO_LAWFUL_PURPOSE (a)(2)(iii)
    function test_code3_noLawfulPurpose_emitsAndStoresCode() public {
        vm.expectEmit(true, false, false, true);
        emit FlagLifecycle(1, FraudSurveillance.FlagState.DETECTED, _code(3));
        uint256 id =
            element.attestSuspicion(w1, FraudSurveillance.SuspicionCategory.NO_LAWFUL_PURPOSE, 5000, false, true);
        assertEq(element.reasonCodeOf(id), _code(3));
    }

    // code 4 — CRIME_FACILITATION (a)(2)(iv)
    function test_code4_crimeFacilitation_emitsAndStoresCode() public {
        vm.expectEmit(true, false, false, true);
        emit FlagLifecycle(1, FraudSurveillance.FlagState.DETECTED, _code(4));
        uint256 id =
            element.attestSuspicion(w1, FraudSurveillance.SuspicionCategory.CRIME_FACILITATION, 50000, false, true);
        assertEq(element.reasonCodeOf(id), _code(4));
    }

    function test_attestSuspicion_categoryNoneReverts() public {
        vm.expectRevert(Errors.NotAuthorized.selector);
        element.attestSuspicion(w1, FraudSurveillance.SuspicionCategory.NONE, 9000, false, true);
    }

    // =================================================================
    // Flag lifecycle states (doc §6.2) + escalation (doc §6.3)
    // =================================================================

    function test_lifecycle_underReviewThenSarFiled() public {
        uint256 id = element.attestSuspicion(w1, FraudSurveillance.SuspicionCategory.ILLICIT_FUNDS, 9000, false, true);

        vm.expectEmit(true, false, false, true);
        emit FlagLifecycle(id, FraudSurveillance.FlagState.UNDER_REVIEW, _code(1));
        element.openReview(id);

        vm.expectEmit(true, false, false, true);
        emit FlagLifecycle(id, FraudSurveillance.FlagState.SAR_FILED, _code(1));
        element.fileSar(id);
        assertEq(uint256(element.flagOf(id).state), uint256(FraudSurveillance.FlagState.SAR_FILED));
    }

    function test_lifecycle_noAction_exception() public {
        uint256 id =
            element.attestSuspicion(w1, FraudSurveillance.SuspicionCategory.NO_LAWFUL_PURPOSE, 6000, false, true);
        // §1023.320(c) exception: closed with no SAR, basis retained off-chain.
        vm.expectEmit(true, false, false, true);
        emit FlagLifecycle(id, FraudSurveillance.FlagState.NO_ACTION, _code(3));
        element.closeNoAction(id);
        assertEq(uint256(element.flagOf(id).state), uint256(FraudSurveillance.FlagState.NO_ACTION));
    }

    // Terminal states are terminal: no re-transition.
    function test_lifecycle_cannotTransitionAfterFiled() public {
        uint256 id = element.attestSuspicion(w1, FraudSurveillance.SuspicionCategory.ILLICIT_FUNDS, 9000, false, true);
        element.fileSar(id);
        vm.expectRevert(Errors.NotAuthorized.selector);
        element.clearFlag(id);
    }

    function test_openReview_onlyFromDetected() public {
        uint256 id = element.attestSuspicion(w1, FraudSurveillance.SuspicionCategory.ILLICIT_FUNDS, 9000, false, true);
        element.openReview(id);
        vm.expectRevert(Errors.NotAuthorized.selector); // already UNDER_REVIEW
        element.openReview(id);
    }

    // =================================================================
    // Deadline extension: +30d (max 60d) when suspect unidentified (doc §5.3)
    // =================================================================

    function test_extendDeadline_suspectUnknown_extendsToSixtyDays() public {
        uint256 id =
            element.attestSuspicion(w1, FraudSurveillance.SuspicionCategory.NO_LAWFUL_PURPOSE, 6000, false, false);
        FraudSurveillance.Flag memory f0 = element.flagOf(id);
        assertEq(uint256(f0.deadline), uint256(START + 30 days));

        vm.expectEmit(true, false, false, true);
        emit DeadlineExtended(id, START + 60 days);
        element.extendDeadline(id);
        assertEq(uint256(element.flagOf(id).deadline), uint256(START + 60 days));

        // A day-45 filing is now timely (within the extended 60d window).
        vm.warp(START + 45 days);
        element.fileSar(id);
        assertTrue(element.filedOnTime(id));
    }

    function test_extendDeadline_revertsWhenSuspectIdentified() public {
        uint256 id =
            element.attestSuspicion(w1, FraudSurveillance.SuspicionCategory.NO_LAWFUL_PURPOSE, 6000, false, true);
        vm.expectRevert(Errors.NotAuthorized.selector); // suspect known => no +30d
        element.extendDeadline(id);
    }

    function test_extendDeadline_cannotExtendTwice() public {
        uint256 id =
            element.attestSuspicion(w1, FraudSurveillance.SuspicionCategory.NO_LAWFUL_PURPOSE, 6000, false, false);
        element.extendDeadline(id);
        vm.expectRevert(Errors.NotAuthorized.selector);
        element.extendDeadline(id);
    }

    function test_identifySuspect_closesExtensionPath() public {
        uint256 id =
            element.attestSuspicion(w1, FraudSurveillance.SuspicionCategory.NO_LAWFUL_PURPOSE, 6000, false, false);
        element.identifySuspect(id);
        vm.expectRevert(Errors.NotAuthorized.selector);
        element.extendDeadline(id);
    }
}
