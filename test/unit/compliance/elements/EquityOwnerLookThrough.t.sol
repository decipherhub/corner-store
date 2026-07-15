// SPDX-License-Identifier: GPL-3.0
pragma solidity 0.8.17;

import {Test} from "forge-std/Test.sol";
import {EquityOwnerLookThrough} from "../../../../src/compliance/elements/EquityOwnerLookThrough.sol";
import {Errors} from "../../../../src/libraries/Errors.sol";
import {
    ElementMetadata,
    ElementCategory,
    Decidability,
    ObligationTiming,
    Statefulness,
    TemporalNature
} from "../../../../src/types/ComplianceTypes.sol";
import {ILookThroughSource, LookThroughStatus} from "../../../../src/interfaces/compliance/ILookThroughSource.sol";

contract EquityOwnerLookThroughTest is Test {
    // Re-declared to match EquityOwnerLookThrough.LookThroughStatusSet for
    // vm.expectEmit (Solidity 0.8.17 cannot reference a non-library contract's
    // event by qualified name in an `emit` statement; that requires >=0.8.22).
    event LookThroughStatusSet(address indexed subject, LookThroughStatus status);

    bytes32 internal constant ELEMENT_ID = "A-09-v1";

    address internal subject = address(0xA11CE);
    address internal operator = address(0x0733);
    address internal stranger = address(0xBAD);

    EquityOwnerLookThrough internal element;

    function setUp() public {
        element = new EquityOwnerLookThrough();
    }

    function _reasonCode(uint32 n) internal pure returns (bytes32) {
        return keccak256(abi.encode(uint16(0), ELEMENT_ID, n));
    }

    function test_metadata_fields() public {
        ElementMetadata memory m = element.elementMetadata();
        assertEq(m.elementId, ELEMENT_ID);
        assertEq(uint256(m.category), uint256(ElementCategory.INVESTOR_ATTRIBUTE));
        assertEq(uint256(m.decidability), uint256(Decidability.ATTESTATION_BASED));
        assertEq(uint256(m.timing), uint256(ObligationTiming.EX_ANTE_VERIFY));
        assertEq(uint256(m.statefulness), uint256(Statefulness.STATELESS));
        assertEq(uint256(m.temporal), uint256(TemporalNature.ONE_TIME));
    }

    function test_setLookThroughStatus_revertsForNonOperator() public {
        vm.prank(stranger);
        vm.expectRevert(Errors.NotAuthorized.selector);
        element.setLookThroughStatus(subject, LookThroughStatus.COMPLETED);
    }

    function test_setLookThroughStatus_ownerCanSet_andEmitsEvent_andUpdatesStorage() public {
        vm.expectEmit(true, false, false, true);
        emit LookThroughStatusSet(subject, LookThroughStatus.COMPLETED);
        element.setLookThroughStatus(subject, LookThroughStatus.COMPLETED);

        assertEq(uint256(element.statusOf(subject)), uint256(LookThroughStatus.COMPLETED));
    }

    function test_setLookThroughStatus_operatorCanSet() public {
        element.setOperator(operator, true);

        vm.prank(operator);
        element.setLookThroughStatus(subject, LookThroughStatus.PENDING);

        assertEq(uint256(element.statusOf(subject)), uint256(LookThroughStatus.PENDING));
    }

    // --- default / dormancy -------------------------------------------------

    function test_check_defaultStatusIsNone_andPasses() public {
        assertEq(uint256(element.statusOf(subject)), uint256(LookThroughStatus.NONE));

        (bool passed, bytes32 reasonCode) = element.check(subject, address(0), address(0), 0, "");
        assertTrue(passed);
        assertEq(reasonCode, bytes32(0));
    }

    // --- all four statuses through check ------------------------------------

    function test_check_passesWhenCompleted() public {
        element.setLookThroughStatus(subject, LookThroughStatus.COMPLETED);

        (bool passed, bytes32 reasonCode) = element.check(subject, address(0), address(0), 0, "");
        assertTrue(passed);
        assertEq(reasonCode, bytes32(0));
    }

    function test_check_failsWithCode1WhenPending() public {
        element.setLookThroughStatus(subject, LookThroughStatus.PENDING);

        (bool passed, bytes32 reasonCode) = element.check(subject, address(0), address(0), 0, "");
        assertFalse(passed);
        assertEq(reasonCode, _reasonCode(1));
    }

    function test_check_failsWithCode2WhenFailed() public {
        element.setLookThroughStatus(subject, LookThroughStatus.FAILED);

        (bool passed, bytes32 reasonCode) = element.check(subject, address(0), address(0), 0, "");
        assertFalse(passed);
        assertEq(reasonCode, _reasonCode(2));
    }

    // --- status transitions + revocation ------------------------------------

    function test_statusTransition_pendingToCompleted_thenCheckPasses() public {
        element.setLookThroughStatus(subject, LookThroughStatus.PENDING);
        (bool passedPending,) = element.check(subject, address(0), address(0), 0, "");
        assertFalse(passedPending);

        vm.expectEmit(true, false, false, true);
        emit LookThroughStatusSet(subject, LookThroughStatus.COMPLETED);
        element.setLookThroughStatus(subject, LookThroughStatus.COMPLETED);

        (bool passedCompleted,) = element.check(subject, address(0), address(0), 0, "");
        assertTrue(passedCompleted);
    }

    function test_revocation_completedBackToNone_emitsEvent_andPasses() public {
        element.setLookThroughStatus(subject, LookThroughStatus.COMPLETED);

        // Explicit reset to NONE is a valid revocation, not a no-op skip, and
        // must emit like any other transition.
        vm.expectEmit(true, false, false, true);
        emit LookThroughStatusSet(subject, LookThroughStatus.NONE);
        element.setLookThroughStatus(subject, LookThroughStatus.NONE);

        assertEq(uint256(element.statusOf(subject)), uint256(LookThroughStatus.NONE));

        (bool passed, bytes32 reasonCode) = element.check(subject, address(0), address(0), 0, "");
        assertTrue(passed);
        assertEq(reasonCode, bytes32(0));
    }

    function test_revocation_failedBackToNone_unblocksCheck() public {
        element.setLookThroughStatus(subject, LookThroughStatus.FAILED);
        (bool blocked,) = element.check(subject, address(0), address(0), 0, "");
        assertFalse(blocked);

        element.setLookThroughStatus(subject, LookThroughStatus.NONE);

        (bool passed,) = element.check(subject, address(0), address(0), 0, "");
        assertTrue(passed);
    }

    // --- interface conformance -----------------------------------------------

    function test_interfaceConformance_ILookThroughSource() public {
        element.setLookThroughStatus(subject, LookThroughStatus.FAILED);

        LookThroughStatus status = ILookThroughSource(address(element)).statusOf(subject);
        assertEq(uint256(status), uint256(LookThroughStatus.FAILED));
    }

    function test_check_ignoresCounterpartyAssetAmountAndContext() public {
        element.setLookThroughStatus(subject, LookThroughStatus.COMPLETED);

        (bool passed1,) = element.check(subject, address(0), address(0), 0, "");
        (bool passed2,) = element.check(subject, address(0xDEAD), address(0xBEEF), 12345, "abc");
        assertTrue(passed1);
        assertTrue(passed2);
        assertEq(passed1, passed2);
    }
}
