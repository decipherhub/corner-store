// SPDX-License-Identifier: GPL-3.0
pragma solidity 0.8.17;

import {Test} from "forge-std/Test.sol";
import {BadActorDisqualification} from "../../../../src/compliance/elements/BadActorDisqualification.sol";
import {ReasonCodes} from "../../../../src/libraries/ReasonCodes.sol";
import {Errors} from "../../../../src/libraries/Errors.sol";
import {
    ElementMetadata,
    ElementCategory,
    TemporalNature,
    Decidability,
    ObligationTiming,
    Statefulness
} from "../../../../src/types/ComplianceTypes.sol";

contract BadActorDisqualificationTest is Test {
    BadActorDisqualification internal element;

    address internal buyer = address(0xA11CE);
    address internal seller = address(0xC0FFEE);
    address internal asset = address(0xBEEF);
    address internal operator = address(0x0BADBEEF01);
    address internal stranger = address(0xBAD);

    // L2 factual-inquiry verifiers.
    address internal trustedIssuer = address(0x11550ED);
    address internal rogueIssuer = address(0xFA15E);

    bytes32 internal constant ELEMENT_ID = "E-03-v1";
    bytes32 internal constant OFFERING_ID = keccak256("O1");
    bytes32 internal constant ROSTER_HASH = keccak256("roster-O1");
    bytes32 internal constant DISCLOSED_MATTERS = keccak256("2012-injunction-disclosure");

    // Mirror the header's n -> code map so assertions read by name.
    uint32 internal constant N_ROSTER_MISSING = 1;
    uint32 internal constant N_ROSTER_INCOMPLETE = 2;
    uint32 internal constant N_CLEARANCE_MISSING = 3;
    uint32 internal constant N_506E_PENDING = 4;
    uint32 internal constant N_ISSUER_UNTRUSTED = 5;
    uint32 internal constant N_SCOPE_MISMATCH = 6;
    uint32 internal constant N_CLEARANCE_STALE = 7;
    uint32 internal constant N_REVOKED = 8;
    uint32 internal constant N_506E_DISCLOSURE_MISSING = 9;

    event OfferingDeclared(
        address indexed asset, bytes32 offeringId, bytes32 coveredPersonRosterHash, bool rosterComplete
    );
    event ClearanceSet(
        address indexed asset,
        address indexed attestingIssuer,
        bytes32 offeringScope,
        uint64 expiry,
        bool disclosure506eRequired,
        bytes32 disclosedMattersHash,
        bool disclosureFurnished,
        bool noDisqualifyingEvent
    );
    event ClearanceRevocationSet(address indexed asset, bool revoked);
    event TrustedBadActorIssuerSet(address indexed issuer, bool trusted);

    function setUp() public {
        element = new BadActorDisqualification();
        element.setOperator(operator, true);
        // Anchor a definite "now" so freshness math is unambiguous.
        vm.warp(1_700_000_000);
        vm.prank(operator);
        element.setTrustedBadActorIssuer(trustedIssuer, true);
    }

    // ---- helpers -----------------------------------------------------------

    function _future() internal view returns (uint64) {
        return uint64(block.timestamp + 365 days);
    }

    function _code(uint32 n) internal pure returns (bytes32) {
        return ReasonCodes.encode(0, ELEMENT_ID, n);
    }

    function _run() internal view returns (bool passed, bytes32 reasonCode) {
        return element.check(buyer, seller, asset, 0, "");
    }

    /// @dev A fully-clean offering: roster declared+complete, valid clearance
    ///      from the trusted issuer, no pre-2013 matter, fresh, not revoked.
    function _declareCleanOffering() internal {
        vm.startPrank(operator);
        element.setOffering(asset, OFFERING_ID, ROSTER_HASH, true);
        element.setClearance(asset, trustedIssuer, OFFERING_ID, _future(), false, bytes32(0), false, true);
        vm.stopPrank();
    }

    // ---- metadata ----------------------------------------------------------

    function test_metadata_fields() public {
        ElementMetadata memory m = element.elementMetadata();
        assertEq(m.elementId, ELEMENT_ID);
        assertEq(m.version, "E-03-v1");
        assertEq(uint256(m.category), uint256(ElementCategory.ISSUER_STATUS));
        assertEq(uint256(m.temporal), uint256(TemporalNature.PERIODIC));
        assertEq(uint256(m.decidability), uint256(Decidability.ATTESTATION_BASED));
        assertEq(uint256(m.timing), uint256(ObligationTiming.EX_ANTE_VERIFY));
        assertEq(uint256(m.statefulness), uint256(Statefulness.STATELESS));
    }

    // ---- setter authorization ---------------------------------------------

    function test_setOffering_revertsForStranger() public {
        vm.prank(stranger);
        vm.expectRevert(Errors.NotAuthorized.selector);
        element.setOffering(asset, OFFERING_ID, ROSTER_HASH, true);
    }

    function test_setClearance_revertsForStranger() public {
        vm.prank(stranger);
        vm.expectRevert(Errors.NotAuthorized.selector);
        element.setClearance(asset, trustedIssuer, OFFERING_ID, _future(), false, bytes32(0), false, true);
    }

    function test_setClearanceRevoked_revertsForStranger() public {
        vm.prank(stranger);
        vm.expectRevert(Errors.NotAuthorized.selector);
        element.setClearanceRevoked(asset, true);
    }

    function test_setTrustedBadActorIssuer_revertsForStranger() public {
        vm.prank(stranger);
        vm.expectRevert(Errors.NotAuthorized.selector);
        element.setTrustedBadActorIssuer(rogueIssuer, true);
    }

    function test_owner_canCallSetters() public {
        // The deployer (this contract) is owner and is authorized via onlyOperator.
        element.setOffering(asset, OFFERING_ID, ROSTER_HASH, true);
        element.setClearance(asset, trustedIssuer, OFFERING_ID, _future(), false, bytes32(0), false, true);
        (,,, uint64 expiry,,,,,) = element.clearanceOf(asset);
        assertEq(expiry, _future());
    }

    function test_operator_canCallSetters() public {
        vm.startPrank(operator);
        element.setOffering(asset, OFFERING_ID, ROSTER_HASH, true);
        element.setClearance(asset, trustedIssuer, OFFERING_ID, _future(), false, bytes32(0), false, true);
        vm.stopPrank();
        (bool exists,,,,,,,,) = element.clearanceOf(asset);
        assertTrue(exists);
    }

    // ---- setter events -----------------------------------------------------

    function test_setOffering_emits() public {
        vm.expectEmit(true, false, false, true);
        emit OfferingDeclared(asset, OFFERING_ID, ROSTER_HASH, true);
        vm.prank(operator);
        element.setOffering(asset, OFFERING_ID, ROSTER_HASH, true);
    }

    function test_setClearance_emits() public {
        vm.expectEmit(true, true, false, true);
        emit ClearanceSet(asset, trustedIssuer, OFFERING_ID, _future(), false, bytes32(0), false, true);
        vm.prank(operator);
        element.setClearance(asset, trustedIssuer, OFFERING_ID, _future(), false, bytes32(0), false, true);
    }

    function test_setClearanceRevoked_emits() public {
        _declareCleanOffering();
        vm.expectEmit(true, false, false, true);
        emit ClearanceRevocationSet(asset, true);
        vm.prank(operator);
        element.setClearanceRevoked(asset, true);
    }

    function test_setTrustedBadActorIssuer_emits() public {
        vm.expectEmit(true, false, false, true);
        emit TrustedBadActorIssuerSet(rogueIssuer, true);
        vm.prank(operator);
        element.setTrustedBadActorIssuer(rogueIssuer, true);
    }

    // ---- doc §7 test cases -------------------------------------------------

    /// Test 1 — Pass (valid clearance, no disqualifying event, 506(c) mint).
    function test_T1_validClearance_passes() public {
        _declareCleanOffering();
        (bool passed, bytes32 reasonCode) = _run();
        assertTrue(passed);
        assertEq(reasonCode, bytes32(0));
    }

    /// Test 2 — Fail (absent clearance fails closed).
    function test_T2_absentClearance_fails() public {
        // Roster declared+complete, but no clearance attestation on file.
        vm.prank(operator);
        element.setOffering(asset, OFFERING_ID, ROSTER_HASH, true);
        (bool passed, bytes32 reasonCode) = _run();
        assertFalse(passed);
        assertEq(reasonCode, _code(N_CLEARANCE_MISSING));
    }

    /// Test 3 — Fail (self-claimed clearance: unauthorized issuer).
    function test_T3_untrustedIssuer_fails() public {
        vm.startPrank(operator);
        element.setOffering(asset, OFFERING_ID, ROSTER_HASH, true);
        // Operator records a clearance, but it names a non-authorized issuer.
        element.setClearance(asset, rogueIssuer, OFFERING_ID, _future(), false, bytes32(0), false, true);
        vm.stopPrank();
        (bool passed, bytes32 reasonCode) = _run();
        assertFalse(passed);
        assertEq(reasonCode, _code(N_ISSUER_UNTRUSTED));
    }

    /// Test 4 — Fail (mid-offering cancellation: clear at open, then revoked).
    function test_T4_midOfferingRevocation_fails() public {
        _declareCleanOffering();
        // Clear before revocation.
        (bool passedBefore,) = _run();
        assertTrue(passedBefore);

        vm.prank(operator);
        element.setClearanceRevoked(asset, true);

        (bool passed, bytes32 reasonCode) = _run();
        assertFalse(passed);
        assertEq(reasonCode, _code(N_REVOKED));
    }

    /// Test 5 — Boundary (exactly-20% voting owner). The ≥20% inclusion is an L2
    /// determination sealed into coveredPersonRosterHash; the gate cannot and does
    /// not recompute voting power — it consumes the seal + sealed conclusion.
    function test_T5_exactly20PercentOwner_passes() public {
        bytes32 rosterWith20 = keccak256("roster-includes-exactly-20pct-owner-P");
        vm.startPrank(operator);
        element.setOffering(asset, rosterWith20, rosterWith20, true);
        // offeringId reused as rosterWith20 above is intentional only for T5's
        // scope anchor; set clearance scope to match.
        element.setClearance(asset, trustedIssuer, rosterWith20, _future(), false, bytes32(0), false, true);
        vm.stopPrank();
        (bool passed, bytes32 reasonCode) = _run();
        assertTrue(passed);
        assertEq(reasonCode, bytes32(0));
    }

    /// Test 6 — Pass (pre-2013 event + 506(e) disclosure furnished).
    function test_T6_pre2013EventDisclosed_passes() public {
        vm.startPrank(operator);
        element.setOffering(asset, OFFERING_ID, ROSTER_HASH, true);
        element.setClearance(asset, trustedIssuer, OFFERING_ID, _future(), true, DISCLOSED_MATTERS, true, true);
        vm.stopPrank();
        (bool passed, bytes32 reasonCode) = _run();
        assertTrue(passed);
        assertEq(reasonCode, bytes32(0));
    }

    /// Test 7 — Fail (pre-2013 event + 506(e) disclosure NOT furnished). (e) has
    /// no waiver, so this is an unconditional gate.
    function test_T7_pre2013EventNotDisclosed_fails() public {
        vm.startPrank(operator);
        element.setOffering(asset, OFFERING_ID, ROSTER_HASH, true);
        // Disclosure doc prepared (hash present) but not furnished.
        element.setClearance(asset, trustedIssuer, OFFERING_ID, _future(), true, DISCLOSED_MATTERS, false, true);
        vm.stopPrank();
        (bool passed, bytes32 reasonCode) = _run();
        assertFalse(passed);
        assertEq(reasonCode, _code(N_506E_DISCLOSURE_MISSING));
    }

    /// Test 8 — Cascade (entity covered person + affiliated-issuer timing
    /// exception). Both the A-08/A-09 entity look-through and the (d)(3) timing /
    /// control determination (A-06) are performed at L2 and sealed as clean; the
    /// gate consumes only the sealed conclusion (noDisqualifyingEvent) via a valid
    /// clearance.
    function test_T8_entityLookThroughAndAffiliatedIssuer_passes() public {
        bytes32 rosterWithEntities = keccak256("roster-entity-20pct-owner-and-affiliated-issuer");
        vm.startPrank(operator);
        element.setOffering(asset, OFFERING_ID, rosterWithEntities, true);
        element.setClearance(asset, trustedIssuer, OFFERING_ID, _future(), false, bytes32(0), false, true);
        vm.stopPrank();
        (bool passed, bytes32 reasonCode) = _run();
        assertTrue(passed);
        assertEq(reasonCode, bytes32(0));
    }

    // ---- remaining failure / review codes ----------------------------------

    /// V1 — roster never declared (fail-closed default).
    function test_rosterMissing_fails() public {
        // No offering declared at all: rosterHash == 0.
        vm.prank(operator);
        element.setClearance(asset, trustedIssuer, OFFERING_ID, _future(), false, bytes32(0), false, true);
        (bool passed, bytes32 reasonCode) = _run();
        assertFalse(passed);
        assertEq(reasonCode, _code(N_ROSTER_MISSING));
    }

    /// V2 — roster declared but not marked complete (HOLD, fail-closed at gate).
    function test_rosterIncomplete_review() public {
        vm.startPrank(operator);
        element.setOffering(asset, OFFERING_ID, ROSTER_HASH, false);
        element.setClearance(asset, trustedIssuer, OFFERING_ID, _future(), false, bytes32(0), false, true);
        vm.stopPrank();
        (bool passed, bytes32 reasonCode) = _run();
        assertFalse(passed);
        assertEq(reasonCode, _code(N_ROSTER_INCOMPLETE));
    }

    /// V4 — pre-2013 matter present but disclosure document not yet prepared
    /// (hash == 0): surfaces as PENDING (HOLD), ahead of the G6 furnished check.
    function test_506ePending_review() public {
        vm.startPrank(operator);
        element.setOffering(asset, OFFERING_ID, ROSTER_HASH, true);
        element.setClearance(asset, trustedIssuer, OFFERING_ID, _future(), true, bytes32(0), false, true);
        vm.stopPrank();
        (bool passed, bytes32 reasonCode) = _run();
        assertFalse(passed);
        assertEq(reasonCode, _code(N_506E_PENDING));
    }

    /// G3 — clearance scoped to a different offering.
    function test_scopeMismatch_fails() public {
        vm.startPrank(operator);
        element.setOffering(asset, OFFERING_ID, ROSTER_HASH, true);
        element.setClearance(
            asset, trustedIssuer, keccak256("OTHER-OFFERING"), _future(), false, bytes32(0), false, true
        );
        vm.stopPrank();
        (bool passed, bytes32 reasonCode) = _run();
        assertFalse(passed);
        assertEq(reasonCode, _code(N_SCOPE_MISMATCH));
    }

    /// G4 — clearance past its re-inquiry window.
    function test_clearanceStale_fails() public {
        vm.startPrank(operator);
        element.setOffering(asset, OFFERING_ID, ROSTER_HASH, true);
        element.setClearance(
            asset, trustedIssuer, OFFERING_ID, uint64(block.timestamp - 1), false, bytes32(0), false, true
        );
        vm.stopPrank();
        (bool passed, bytes32 reasonCode) = _run();
        assertFalse(passed);
        assertEq(reasonCode, _code(N_CLEARANCE_STALE));
    }

    /// G4 boundary — exactly at expiry passes (inclusive window).
    function test_clearanceAtExactExpiry_passes() public {
        vm.startPrank(operator);
        element.setOffering(asset, OFFERING_ID, ROSTER_HASH, true);
        element.setClearance(asset, trustedIssuer, OFFERING_ID, uint64(block.timestamp), false, bytes32(0), false, true);
        vm.stopPrank();
        (bool passed, bytes32 reasonCode) = _run();
        assertTrue(passed);
        assertEq(reasonCode, bytes32(0));
    }

    // ---- keyed-by-asset / precedence sanity --------------------------------

    /// Gate is keyed by ASSET (offering), not by buyer: any buyer sees the same
    /// verdict for the same asset.
    function test_check_isPerAsset_notPerBuyer() public {
        _declareCleanOffering();
        (bool p1,) = element.check(buyer, seller, asset, 0, "");
        (bool p2,) = element.check(address(0xDEAD), address(0xF00D), asset, 0, "");
        assertTrue(p1);
        assertTrue(p2);

        // A different, undeclared asset fails closed (roster missing).
        (bool p3, bytes32 rc3) = element.check(buyer, seller, address(0xABCD), 0, "");
        assertFalse(p3);
        assertEq(rc3, _code(N_ROSTER_MISSING));
    }

    /// Revocation round-trip: re-setting the clearance clears the revoked flag.
    function test_revokeThenReissue_roundTrip() public {
        _declareCleanOffering();
        vm.prank(operator);
        element.setClearanceRevoked(asset, true);
        (bool revokedPass, bytes32 rc) = _run();
        assertFalse(revokedPass);
        assertEq(rc, _code(N_REVOKED));

        // Re-issuance (setClearance) resets revoked=false.
        vm.prank(operator);
        element.setClearance(asset, trustedIssuer, OFFERING_ID, _future(), false, bytes32(0), false, true);
        (bool reissuedPass,) = _run();
        assertTrue(reissuedPass);
    }
}
