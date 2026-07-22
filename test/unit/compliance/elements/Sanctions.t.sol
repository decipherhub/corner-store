// SPDX-License-Identifier: GPL-3.0
pragma solidity 0.8.17;

import {Test} from "forge-std/Test.sol";
import {Sanctions} from "../../../../src/compliance/elements/Sanctions.sol";
import {Errors} from "../../../../src/libraries/Errors.sol";
import {LookThroughStatus} from "../../../../src/interfaces/compliance/ILookThroughSource.sol";
import {
    ElementMetadata,
    ElementCategory,
    TemporalNature,
    Decidability,
    ObligationTiming,
    Statefulness
} from "../../../../src/types/ComplianceTypes.sol";

/// @dev A-01 Sanctions upgrade tests. Legacy wallet-only cases live in
///      test/unit/compliance/Elements.t.sol and stay green via the default-off
///      claim regime; this file covers dual-party wallet screening and the full
///      Pattern B claim pipeline (codes 1-10, doc §5.2/§6/§7).
contract SanctionsTest is Test {
    // Re-declared for vm.expectEmit; the enum ltStatus param canonicalizes to
    // uint8 in the signature (Solidity 0.8.17 cannot `emit` a contract event by name).
    event SanctionsBlockedSet(address indexed account, bool blocked);
    event ClaimRegimeSet(bool claimRegimeEnabled, bool enforceCounterpartyClaim);
    event CurrentListVersionSet(uint32 version);
    event ScreeningThresholdsSet(uint16 reviewThresholdBps, uint16 blockThresholdBps);
    event ScreeningClaimSet(
        address indexed subject, bool exists, bool isEntity, uint16 identityMatchBps, uint8 ltStatus
    );

    address internal buyer = address(0xB0B);
    address internal seller = address(0x5E11E7);
    address internal asset = address(0xA55E7);
    address internal operator = address(0x0733);
    address internal stranger = address(0xBAD);

    Sanctions internal s;

    function setUp() public {
        s = new Sanctions();
    }

    // --- helpers ---------------------------------------------------------

    function _code(uint32 n) internal pure returns (bytes32) {
        return keccak256(abi.encode(uint16(0), bytes32("A-01-v1"), uint32(n)));
    }

    /// @dev A fully-valid claim: exists/trusted/signed, no expiry, list version 0
    ///      (matches default currentListVersion), zero match score, natural person.
    function _validClaim() internal pure returns (Sanctions.ScreeningClaim memory) {
        return Sanctions.ScreeningClaim({
            exists: true,
            issuerTrusted: true,
            signatureValid: true,
            expiry: 0,
            screenedListVersion: 0,
            identityMatchBps: 0,
            isEntity: false,
            ltStatus: LookThroughStatus.NONE,
            blockedOwnershipBps: 0
        });
    }

    function _check() internal view returns (bool passed, bytes32 reasonCode) {
        return s.check(buyer, seller, asset, 0, "");
    }

    function _assertPass() internal {
        (bool passed, bytes32 rc) = _check();
        assertTrue(passed);
        assertEq(rc, bytes32(0));
    }

    function _assertFail(uint32 n) internal {
        (bool passed, bytes32 rc) = _check();
        assertFalse(passed);
        assertEq(rc, _code(n));
    }

    // --- metadata --------------------------------------------------------

    function test_metadata_unchanged() public {
        ElementMetadata memory m = s.elementMetadata();
        assertEq(m.elementId, bytes32("A-01-v1"));
        assertEq(uint256(m.category), uint256(ElementCategory.INVESTOR_ATTRIBUTE));
        assertEq(uint256(m.temporal), uint256(TemporalNature.REALTIME));
        assertEq(uint256(m.decidability), uint256(Decidability.DETERMINISTIC));
        assertEq(uint256(m.timing), uint256(ObligationTiming.AT_TRADE_GATE));
        assertEq(uint256(m.statefulness), uint256(Statefulness.STATELESS));
    }

    function test_defaults() public {
        assertFalse(s.claimRegimeEnabled());
        assertFalse(s.enforceCounterpartyClaim());
        assertEq(s.currentListVersion(), 0);
        assertEq(s.reviewThresholdBps(), 7500);
        assertEq(s.blockThresholdBps(), 9500);
    }

    // --- auth ------------------------------------------------------------

    function test_setBlocked_revertsForNonOperator() public {
        vm.prank(stranger);
        vm.expectRevert(Errors.NotAuthorized.selector);
        s.setBlocked(buyer, true);
    }

    function test_setClaim_revertsForNonOperator() public {
        vm.prank(stranger);
        vm.expectRevert(Errors.NotAuthorized.selector);
        s.setClaim(buyer, _validClaim());
    }

    function test_setClaimRegime_revertsForNonOperator() public {
        vm.prank(stranger);
        vm.expectRevert(Errors.NotAuthorized.selector);
        s.setClaimRegime(true, false);
    }

    function test_setCurrentListVersion_revertsForNonOperator() public {
        vm.prank(stranger);
        vm.expectRevert(Errors.NotAuthorized.selector);
        s.setCurrentListVersion(2);
    }

    function test_setScreeningThresholds_revertsForNonOperator() public {
        vm.prank(stranger);
        vm.expectRevert(Errors.NotAuthorized.selector);
        s.setScreeningThresholds(1000, 2000);
    }

    function test_operatorCanSetClaimRegime() public {
        s.setOperator(operator, true);
        vm.prank(operator);
        s.setClaimRegime(true, true);
        assertTrue(s.claimRegimeEnabled());
        assertTrue(s.enforceCounterpartyClaim());
    }

    // --- events ----------------------------------------------------------

    function test_setClaimRegime_emits() public {
        vm.expectEmit(false, false, false, true);
        emit ClaimRegimeSet(true, true);
        s.setClaimRegime(true, true);
    }

    function test_setCurrentListVersion_emits() public {
        vm.expectEmit(false, false, false, true);
        emit CurrentListVersionSet(5);
        s.setCurrentListVersion(5);
    }

    function test_setScreeningThresholds_emits() public {
        vm.expectEmit(false, false, false, true);
        emit ScreeningThresholdsSet(6000, 8000);
        s.setScreeningThresholds(6000, 8000);
        assertEq(s.reviewThresholdBps(), 6000);
        assertEq(s.blockThresholdBps(), 8000);
    }

    function test_setScreeningThresholds_revertsIfReviewAboveBlock() public {
        vm.expectRevert("review>block");
        s.setScreeningThresholds(9000, 8000);
    }

    function test_setClaim_emits() public {
        Sanctions.ScreeningClaim memory c = _validClaim();
        c.isEntity = true;
        c.identityMatchBps = 1234;
        c.ltStatus = LookThroughStatus.COMPLETED;
        vm.expectEmit(true, false, false, true);
        emit ScreeningClaimSet(buyer, true, true, 1234, uint8(LookThroughStatus.COMPLETED));
        s.setClaim(buyer, c);
    }

    // --- Pattern A: wallet screening (always on) -------------------------

    function test_wallet_defaultPass() public {
        _assertPass();
    }

    function test_wallet_userBlocked_code1() public {
        s.setBlocked(buyer, true);
        _assertFail(1);
    }

    function test_wallet_counterpartyBlocked_code1() public {
        // Buyer clean, seller in SDN set => still FAIL (both parties screened).
        s.setBlocked(seller, true);
        _assertFail(1);
    }

    function test_wallet_unlistedCounterpartyPasses() public {
        // An unlisted counterparty (e.g. AMM pool) does not block a clean buyer.
        (bool passed,) = s.check(buyer, address(0xF00D), asset, 0, "");
        assertTrue(passed);
    }

    function test_wallet_blockUnblockRoundTrip() public {
        s.setBlocked(buyer, true);
        _assertFail(1);
        s.setBlocked(buyer, false);
        _assertPass();
    }

    // --- regime OFF: claims ignored -------------------------------------

    function test_regimeOff_unattestedUserPasses() public {
        // No claim set, regime off (default) => wallet-only => PASS.
        _assertPass();
    }

    function test_regimeOff_badClaimIgnored() public {
        // Even a claim that would fail is ignored while the regime is off.
        s.setClaim(buyer, _validClaim()); // exists but regime off
        Sanctions.ScreeningClaim memory bad; // all-zero => exists=false
        s.setClaim(seller, bad);
        _assertPass();
    }

    // --- regime ON: claim pipeline codes --------------------------------

    function _enableRegime() internal {
        s.setClaimRegime(true, false);
    }

    function test_code4_noClaim() public {
        _enableRegime();
        _assertFail(4);
    }

    function test_code5_untrustedIssuer() public {
        _enableRegime();
        Sanctions.ScreeningClaim memory c = _validClaim();
        c.issuerTrusted = false;
        s.setClaim(buyer, c);
        _assertFail(5);
    }

    function test_code6_invalidSignature() public {
        _enableRegime();
        Sanctions.ScreeningClaim memory c = _validClaim();
        c.signatureValid = false;
        s.setClaim(buyer, c);
        _assertFail(6);
    }

    function test_code7_expired_strict() public {
        _enableRegime();
        Sanctions.ScreeningClaim memory c = _validClaim();
        c.expiry = 100;
        s.setClaim(buyer, c);
        vm.warp(101); // 101 > 100 => expired
        _assertFail(7);
    }

    function test_code7_exactlyAtExpiryPasses() public {
        _enableRegime();
        Sanctions.ScreeningClaim memory c = _validClaim();
        c.expiry = 100;
        s.setClaim(buyer, c);
        vm.warp(100); // strict > : exactly at expiry is NOT expired
        _assertPass();
    }

    function test_expiryZeroNeverExpires() public {
        _enableRegime();
        s.setClaim(buyer, _validClaim()); // expiry 0
        vm.warp(1_000_000_000);
        _assertPass();
    }

    function test_code8_staleList() public {
        _enableRegime();
        s.setClaim(buyer, _validClaim()); // screenedListVersion 0
        s.setCurrentListVersion(1); // bump => claim now stale
        _assertFail(8);
    }

    function test_code8_matchingListVersionPasses() public {
        _enableRegime();
        s.setCurrentListVersion(7);
        Sanctions.ScreeningClaim memory c = _validClaim();
        c.screenedListVersion = 7;
        s.setClaim(buyer, c);
        _assertPass();
    }

    function test_code2_identityBlockMatch() public {
        _enableRegime();
        Sanctions.ScreeningClaim memory c = _validClaim();
        c.identityMatchBps = 9600; // >= blockThresholdBps (9500)
        s.setClaim(buyer, c);
        _assertFail(2);
    }

    function test_code10_identityReviewBand() public {
        _enableRegime();
        Sanctions.ScreeningClaim memory c = _validClaim();
        c.identityMatchBps = 8000; // [7500, 9500) => review
        s.setClaim(buyer, c);
        _assertFail(10);
    }

    // --- name-match boundaries (doc §5.2) -------------------------------

    function test_boundary_exactlyBlockBps_code2() public {
        _enableRegime();
        Sanctions.ScreeningClaim memory c = _validClaim();
        c.identityMatchBps = 9500; // exactly blockThresholdBps => block (2)
        s.setClaim(buyer, c);
        _assertFail(2);
    }

    function test_boundary_exactlyReviewBps_code10() public {
        _enableRegime();
        Sanctions.ScreeningClaim memory c = _validClaim();
        c.identityMatchBps = 7500; // exactly reviewThresholdBps => review (10)
        s.setClaim(buyer, c);
        _assertFail(10);
    }

    function test_boundary_justBelowReviewBps_passes() public {
        _enableRegime();
        Sanctions.ScreeningClaim memory c = _validClaim();
        c.identityMatchBps = 7499; // below review band => PASS
        s.setClaim(buyer, c);
        _assertPass();
    }

    // --- entity 50%-Rule leg (codes 9, 3) -------------------------------

    function test_code9_lookThroughPending() public {
        _enableRegime();
        Sanctions.ScreeningClaim memory c = _validClaim();
        c.isEntity = true;
        c.ltStatus = LookThroughStatus.PENDING; // != COMPLETED => 9
        s.setClaim(buyer, c);
        _assertFail(9);
    }

    function test_code9_lookThroughNone() public {
        _enableRegime();
        Sanctions.ScreeningClaim memory c = _validClaim();
        c.isEntity = true;
        c.ltStatus = LookThroughStatus.NONE; // != COMPLETED => 9
        s.setClaim(buyer, c);
        _assertFail(9);
    }

    function test_code3_fiftyPctRule() public {
        _enableRegime();
        Sanctions.ScreeningClaim memory c = _validClaim();
        c.isEntity = true;
        c.ltStatus = LookThroughStatus.COMPLETED;
        c.blockedOwnershipBps = 6000; // >= 5000 => 3
        s.setClaim(buyer, c);
        _assertFail(3);
    }

    function test_boundary_exactly5000Bps_code3() public {
        _enableRegime();
        Sanctions.ScreeningClaim memory c = _validClaim();
        c.isEntity = true;
        c.ltStatus = LookThroughStatus.COMPLETED;
        c.blockedOwnershipBps = 5000; // INCLUSIVE >= => 3
        s.setClaim(buyer, c);
        _assertFail(3);
    }

    function test_boundary_4999Bps_passes() public {
        _enableRegime();
        Sanctions.ScreeningClaim memory c = _validClaim();
        c.isEntity = true;
        c.ltStatus = LookThroughStatus.COMPLETED;
        c.blockedOwnershipBps = 4999; // below 50% => PASS
        s.setClaim(buyer, c);
        _assertPass();
    }

    function test_entityCompletedCleanPasses() public {
        _enableRegime();
        Sanctions.ScreeningClaim memory c = _validClaim();
        c.isEntity = true;
        c.ltStatus = LookThroughStatus.COMPLETED;
        c.blockedOwnershipBps = 0;
        s.setClaim(buyer, c);
        _assertPass();
    }

    function test_regimeOn_validClaimPasses() public {
        _enableRegime();
        s.setClaim(buyer, _validClaim());
        _assertPass();
    }

    // --- wallet leg precedes claim leg ----------------------------------

    function test_walletMatchBeatsValidClaim() public {
        // Even with a valid claim and regime on, an SDN wallet FAILs at code 1.
        _enableRegime();
        s.setClaim(buyer, _validClaim());
        s.setBlocked(buyer, true);
        _assertFail(1);
    }

    // --- counterparty claim gating --------------------------------------

    function test_counterpartyClaimSkippedWhenNotEnforced() public {
        // Regime on, enforceCounterparty off: seller has NO claim but is not
        // screened via the claim pipeline => PASS (buyer has a valid claim).
        s.setClaimRegime(true, false);
        s.setClaim(buyer, _validClaim());
        _assertPass();
    }

    function test_counterpartyClaimEnforced_missingClaim_code4() public {
        // Regime on + enforceCounterparty on: seller has no claim => code 4.
        s.setClaimRegime(true, true);
        s.setClaim(buyer, _validClaim());
        _assertFail(4);
    }

    function test_counterpartyClaimEnforced_bothValid_passes() public {
        s.setClaimRegime(true, true);
        s.setClaim(buyer, _validClaim());
        s.setClaim(seller, _validClaim());
        _assertPass();
    }

    function test_userClaimEvaluatedBeforeCounterparty() public {
        // Both parties lack claims; the user's failure (code 4) is returned first.
        s.setClaimRegime(true, true);
        _assertFail(4);
    }
}
