// SPDX-License-Identifier: GPL-3.0
pragma solidity 0.8.17;

import {Test} from "forge-std/Test.sol";
import {ClaimFreshness} from "../../../../src/compliance/elements/ClaimFreshness.sol";
import {Errors} from "../../../../src/libraries/Errors.sol";
import {
    ElementMetadata,
    ElementCategory,
    Decidability,
    ObligationTiming,
    Statefulness,
    TemporalNature
} from "../../../../src/types/ComplianceTypes.sol";

contract ClaimFreshnessTest is Test {
    // Re-declared to match ClaimFreshness.ClaimSet for vm.expectEmit (Solidity
    // 0.8.17 cannot reference a non-library contract's event by qualified name
    // in an `emit` statement; that requires >=0.8.22).
    event ClaimSet(
        address indexed user, ClaimFreshness.FreshClaimType claimType, uint64 verifiedAt, uint64 issuerExpiry
    );

    bytes32 internal constant ELEMENT_ID = "A-11-v1";

    address internal user = address(0xA11CE);
    address internal operator = address(0x0733);
    address internal stranger = address(0xBAD);

    // Arbitrary fixed epoch anchor so every test's timeline is deterministic
    // regardless of the harness's default block.timestamp.
    uint64 internal constant START = 1_700_000_000;

    ClaimFreshness internal element;

    function setUp() public {
        element = new ClaimFreshness();
        vm.warp(START);
    }

    function _code(uint32 n) internal pure returns (bytes32) {
        return keccak256(abi.encode(uint16(0), ELEMENT_ID, n));
    }

    // ---------------------------------------------------------------
    // Metadata + auth
    // ---------------------------------------------------------------

    function test_metadata_fields() public {
        ElementMetadata memory m = element.elementMetadata();
        assertEq(m.elementId, ELEMENT_ID);
        assertEq(uint256(m.category), uint256(ElementCategory.INVESTOR_ATTRIBUTE));
        assertEq(uint256(m.decidability), uint256(Decidability.DETERMINISTIC));
        assertEq(uint256(m.timing), uint256(ObligationTiming.AT_TRADE_GATE));
        assertEq(uint256(m.statefulness), uint256(Statefulness.STATELESS));
        assertEq(uint256(m.temporal), uint256(TemporalNature.PERIODIC));
    }

    function test_setClaim_revertsForNonOperator() public {
        vm.prank(stranger);
        vm.expectRevert(Errors.NotAuthorized.selector);
        element.setClaim(user, ClaimFreshness.FreshClaimType.AI, START, 0);
    }

    function test_setClaim_ownerCanSet_andEmitsEvent_andUpdatesStorage() public {
        vm.expectEmit(true, false, false, true);
        emit ClaimSet(user, ClaimFreshness.FreshClaimType.AI, START, 0);
        element.setClaim(user, ClaimFreshness.FreshClaimType.AI, START, 0);

        (ClaimFreshness.FreshClaimType claimType, uint64 verifiedAt, uint64 issuerExpiry) = element.claimOf(user);
        assertEq(uint256(claimType), uint256(ClaimFreshness.FreshClaimType.AI));
        assertEq(verifiedAt, START);
        assertEq(issuerExpiry, 0);
    }

    function test_setClaim_operatorCanSet() public {
        element.setOperator(operator, true);

        vm.prank(operator);
        element.setClaim(user, ClaimFreshness.FreshClaimType.QP, START, 0);

        (ClaimFreshness.FreshClaimType claimType,,) = element.claimOf(user);
        assertEq(uint256(claimType), uint256(ClaimFreshness.FreshClaimType.QP));
    }

    // ---------------------------------------------------------------
    // doc §7 Test 1 — Pass-AI
    // ---------------------------------------------------------------

    function test_check_passesAi_wellWithinFiveYearCap() public {
        element.setClaim(user, ClaimFreshness.FreshClaimType.AI, START, 0);
        vm.warp(START + 2 * 365 days);

        (bool passed, bytes32 reasonCode) = element.check(user, address(0), address(0), 0, "");
        assertTrue(passed);
        assertEq(reasonCode, bytes32(0));
    }

    // doc §7 Test 2 — Pass-QP
    function test_check_passesQp_wellWithinOneYearCap() public {
        element.setClaim(user, ClaimFreshness.FreshClaimType.QP, START, 0);
        vm.warp(START + 300 days); // ~10 months

        (bool passed, bytes32 reasonCode) = element.check(user, address(0), address(0), 0, "");
        assertTrue(passed);
        assertEq(reasonCode, bytes32(0));
    }

    // doc §7 Test 3 — Fail-AI-stale
    function test_check_failsAi_afterFiveYearCap() public {
        element.setClaim(user, ClaimFreshness.FreshClaimType.AI, START, 0);
        vm.warp(START + 6 * 365 days);

        (bool passed, bytes32 reasonCode) = element.check(user, address(0), address(0), 0, "");
        assertFalse(passed);
        assertEq(reasonCode, _code(2));
    }

    // doc §7 Test 4 — Fail-QP-stale (policy cap, not statutory)
    function test_check_failsQp_afterOneYearPolicyCap() public {
        element.setClaim(user, ClaimFreshness.FreshClaimType.QP, START, 0);
        vm.warp(START + 14 * 30 days); // ~14 months

        (bool passed, bytes32 reasonCode) = element.check(user, address(0), address(0), 0, "");
        assertFalse(passed);
        assertEq(reasonCode, _code(3));
    }

    // ---------------------------------------------------------------
    // doc §7 Test 5 — boundary: exactly-at-cap PASSes, cap+1s FAILs.
    // Pinned for both claim types since the comparison operator (strict `>`)
    // is the heart of this element's spec.
    // ---------------------------------------------------------------

    function test_check_boundary_ai_exactlyAtCapPasses() public {
        element.setClaim(user, ClaimFreshness.FreshClaimType.AI, START, 0);
        vm.warp(START + element.CAP_AI());

        (bool passed, bytes32 reasonCode) = element.check(user, address(0), address(0), 0, "");
        assertTrue(passed);
        assertEq(reasonCode, bytes32(0));
    }

    function test_check_boundary_ai_oneSecondPastCapFails() public {
        element.setClaim(user, ClaimFreshness.FreshClaimType.AI, START, 0);
        vm.warp(START + element.CAP_AI() + 1);

        (bool passed, bytes32 reasonCode) = element.check(user, address(0), address(0), 0, "");
        assertFalse(passed);
        assertEq(reasonCode, _code(2));
    }

    function test_check_boundary_qp_exactlyAtCapPasses() public {
        element.setClaim(user, ClaimFreshness.FreshClaimType.QP, START, 0);
        vm.warp(START + element.CAP_QP());

        (bool passed, bytes32 reasonCode) = element.check(user, address(0), address(0), 0, "");
        assertTrue(passed);
        assertEq(reasonCode, bytes32(0));
    }

    function test_check_boundary_qp_oneSecondPastCapFails() public {
        element.setClaim(user, ClaimFreshness.FreshClaimType.QP, START, 0);
        vm.warp(START + element.CAP_QP() + 1);

        (bool passed, bytes32 reasonCode) = element.check(user, address(0), address(0), 0, "");
        assertFalse(passed);
        assertEq(reasonCode, _code(3));
    }

    // ---------------------------------------------------------------
    // doc §7 Test 6 — issuer-set expiry interplay.
    // ---------------------------------------------------------------

    // Shorter issuer expiry wins over the (longer) regulatory/policy cap.
    function test_check_issuerExpiryShorterThanCap_winsOverRegulatoryCap() public {
        uint64 issuerExpiry = START + 365 days; // 1y, shorter than the 5y AI cap
        element.setClaim(user, ClaimFreshness.FreshClaimType.AI, START, issuerExpiry);
        vm.warp(START + 13 * 30 days); // ~13 months: past issuer expiry, well within 5y cap

        (bool passed, bytes32 reasonCode) = element.check(user, address(0), address(0), 0, "");
        assertFalse(passed);
        assertEq(reasonCode, _code(4));
    }

    function test_check_issuerExpiry_exactlyAtBoundaryPasses() public {
        uint64 issuerExpiry = START + 365 days;
        element.setClaim(user, ClaimFreshness.FreshClaimType.AI, START, issuerExpiry);
        vm.warp(issuerExpiry);

        (bool passed, bytes32 reasonCode) = element.check(user, address(0), address(0), 0, "");
        assertTrue(passed);
        assertEq(reasonCode, bytes32(0));
    }

    function test_check_issuerExpiry_oneSecondPastFails() public {
        uint64 issuerExpiry = START + 365 days;
        element.setClaim(user, ClaimFreshness.FreshClaimType.AI, START, issuerExpiry);
        vm.warp(issuerExpiry + 1);

        (bool passed, bytes32 reasonCode) = element.check(user, address(0), address(0), 0, "");
        assertFalse(passed);
        assertEq(reasonCode, _code(4));
    }

    // Longer issuer expiry than the regulatory cap is ignored entirely — the
    // stale code fires at the cap boundary, NOT the issuer-expired code.
    function test_check_issuerExpiryLongerThanCap_isIgnored() public {
        uint64 issuerExpiry = START + 6 * 365 days; // longer than the 5y AI cap
        element.setClaim(user, ClaimFreshness.FreshClaimType.AI, START, issuerExpiry);
        vm.warp(START + 6 * 365 days); // past the 5y regulatory cap, still before issuerExpiry

        (bool passed, bytes32 reasonCode) = element.check(user, address(0), address(0), 0, "");
        assertFalse(passed);
        assertEq(reasonCode, _code(2)); // STALE_AI, not CLAIM_EXPIRED
    }

    // ---------------------------------------------------------------
    // doc §7 Test 7 — missing verifiedAt
    // ---------------------------------------------------------------

    function test_check_failsWhenVerifiedAtMissing() public {
        // No setClaim call: default FreshnessClaim{UNKNOWN, 0, 0}.
        (bool passed, bytes32 reasonCode) = element.check(user, address(0), address(0), 0, "");
        assertFalse(passed);
        assertEq(reasonCode, _code(1));
    }

    // Unknown claim type — fail-closed, must never default to the laxer AI cap.
    function test_check_failsWhenClaimTypeUnknown() public {
        element.setClaim(user, ClaimFreshness.FreshClaimType.UNKNOWN, START, 0);
        vm.warp(START + 1);

        (bool passed, bytes32 reasonCode) = element.check(user, address(0), address(0), 0, "");
        assertFalse(passed);
        assertEq(reasonCode, _code(5));
    }

    // ---------------------------------------------------------------
    // doc §7 Test 8 — A-11 is a pure time gate: identical result regardless
    // of counterparty/asset/amount identity.
    // ---------------------------------------------------------------

    function test_check_ignoresCounterpartyAssetAmount() public {
        element.setClaim(user, ClaimFreshness.FreshClaimType.AI, START, 0);
        vm.warp(START + 2 * 365 days);

        (bool passed1,) = element.check(user, address(0), address(0), 0, "");
        (bool passed2,) = element.check(user, address(0xB0B), address(0xDEAD), 12345, "");
        assertTrue(passed1);
        assertTrue(passed2);
        assertEq(passed1, passed2);
    }
}
