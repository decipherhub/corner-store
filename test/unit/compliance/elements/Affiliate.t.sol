// SPDX-License-Identifier: GPL-3.0
pragma solidity 0.8.17;

import {Test} from "forge-std/Test.sol";
import {Affiliate} from "../../../../src/compliance/elements/Affiliate.sol";
import {Errors} from "../../../../src/libraries/Errors.sol";
import {
    ElementMetadata,
    ElementCategory,
    Decidability,
    ObligationTiming,
    Statefulness,
    TemporalNature
} from "../../../../src/types/ComplianceTypes.sol";

contract AffiliateTest is Test {
    // Re-declared to match Affiliate's events for vm.expectEmit (Solidity 0.8.17
    // cannot reference a non-library contract's event by qualified name in an
    // `emit` statement; that requires >=0.8.22).
    event ClaimSet(
        address indexed subject,
        address indexed asset,
        Affiliate.AffiliateBasis basis,
        Affiliate.DeterminationSource source,
        address claimIssuer,
        uint64 verifiedAt,
        uint64 decayStartedAt
    );
    event TrustedClaimIssuerSet(address indexed issuer, bool trusted);

    bytes32 internal constant ELEMENT_ID = "A-06-v1";

    address internal user = address(0xA06CE);
    address internal operator = address(0x0733);
    address internal stranger = address(0xBAD);
    address internal issuer = address(0x1550E); // trusted claim issuer
    address internal assetX = address(0x7011E); // issuer X's RWA token
    address internal assetY = address(0x7012E); // issuer Y's RWA token

    // Arbitrary fixed epoch anchor so every test's timeline is deterministic
    // regardless of the harness's default block.timestamp.
    uint64 internal constant START = 1_700_000_000;

    Affiliate internal element;

    function setUp() public {
        element = new Affiliate();
        vm.warp(START);
        element.setTrustedClaimIssuer(issuer, true);
    }

    function _code(uint32 n) internal pure returns (bytes32) {
        return keccak256(abi.encode(uint16(0), ELEMENT_ID, n));
    }

    // Set a claim signed by the default trusted issuer, source = ISSUER_REGISTRY.
    function _setClaim(
        address subject,
        address asset,
        Affiliate.AffiliateBasis basis,
        uint64 verifiedAt,
        uint64 decayStartedAt
    ) internal {
        element.setClaim(
            subject, asset, basis, Affiliate.DeterminationSource.ISSUER_REGISTRY, issuer, verifiedAt, decayStartedAt
        );
    }

    // ---------------------------------------------------------------
    // Metadata + auth
    // ---------------------------------------------------------------

    function test_metadata_fields() public {
        ElementMetadata memory m = element.elementMetadata();
        assertEq(m.elementId, ELEMENT_ID);
        assertEq(m.version, "A-06-v1");
        assertEq(uint256(m.category), uint256(ElementCategory.INVESTOR_ATTRIBUTE));
        assertEq(uint256(m.decidability), uint256(Decidability.ATTESTATION_BASED));
        assertEq(uint256(m.timing), uint256(ObligationTiming.EX_ANTE_VERIFY));
        assertEq(uint256(m.statefulness), uint256(Statefulness.STATELESS));
        assertEq(uint256(m.temporal), uint256(TemporalNature.PERIODIC));
    }

    function test_setClaim_revertsForNonOperator() public {
        vm.prank(stranger);
        vm.expectRevert(Errors.NotAuthorized.selector);
        _setClaim(user, assetX, Affiliate.AffiliateBasis.OFFICER_DIRECTOR, START, 0);
    }

    function test_setTrustedClaimIssuer_revertsForNonOperator() public {
        vm.prank(stranger);
        vm.expectRevert(Errors.NotAuthorized.selector);
        element.setTrustedClaimIssuer(issuer, true);
    }

    function test_setClaim_ownerCanSet_andEmitsEvent_andUpdatesStorage() public {
        vm.expectEmit(true, true, false, true);
        emit ClaimSet(
            user,
            assetX,
            Affiliate.AffiliateBasis.OFFICER_DIRECTOR,
            Affiliate.DeterminationSource.ISSUER_REGISTRY,
            issuer,
            START,
            0
        );
        _setClaim(user, assetX, Affiliate.AffiliateBasis.OFFICER_DIRECTOR, START, 0);

        (
            Affiliate.AffiliateBasis basis,
            Affiliate.DeterminationSource source,
            address claimIssuer,
            uint64 verifiedAt,
            uint64 decayStartedAt
        ) = element.claimOf(user, assetX);
        assertEq(uint256(basis), uint256(Affiliate.AffiliateBasis.OFFICER_DIRECTOR));
        assertEq(uint256(source), uint256(Affiliate.DeterminationSource.ISSUER_REGISTRY));
        assertEq(claimIssuer, issuer);
        assertEq(verifiedAt, START);
        assertEq(decayStartedAt, 0);
    }

    function test_setTrustedClaimIssuer_ownerCanSet_andEmitsEvent() public {
        address other = address(0xFEED);
        vm.expectEmit(true, false, false, true);
        emit TrustedClaimIssuerSet(other, true);
        element.setTrustedClaimIssuer(other, true);
        assertTrue(element.isTrustedClaimIssuer(other));
    }

    function test_setClaim_operatorCanSet() public {
        element.setOperator(operator, true);

        vm.prank(operator);
        _setClaim(user, assetX, Affiliate.AffiliateBasis.NOT_AFFILIATE, START, 0);

        (Affiliate.AffiliateBasis basis,,,,) = element.claimOf(user, assetX);
        assertEq(uint256(basis), uint256(Affiliate.AffiliateBasis.NOT_AFFILIATE));
    }

    // ---------------------------------------------------------------
    // doc §7 Test 1 — current affiliate (officer). PASS_AFFILIATE.
    // ---------------------------------------------------------------

    function test_check_test1_currentOfficerIsAffiliate() public {
        // 김 부장, COO of issuer X, resells token X.
        _setClaim(user, assetX, Affiliate.AffiliateBasis.OFFICER_DIRECTOR, START, 0);

        (bool passed, bytes32 reasonCode) = element.check(user, address(0), assetX, 2500, "");
        assertTrue(passed); // element only DETERMINES; recipe applies Rule 144
        assertEq(reasonCode, bytes32(0));
        assertEq(uint256(element.effectiveStatus(user, assetX)), uint256(Affiliate.EffectiveStatus.AFFILIATE));
    }

    // ---------------------------------------------------------------
    // doc §7 Test 2 — decay in progress (60 days after resignation) AND
    // asset-specificity: affiliate for issuer X, non-affiliate for issuer Y.
    // ---------------------------------------------------------------

    function test_check_test2_decayInProgress_andAssetSpecific() public {
        // Issuer X: former COO, resigned 60 days ago → still inside the decay tail.
        _setClaim(user, assetX, Affiliate.AffiliateBasis.FORMER_AFFILIATE_DECAY, START, START - 60 days);
        // Issuer Y: never an affiliate.
        _setClaim(user, assetY, Affiliate.AffiliateBasis.NOT_AFFILIATE, START, 0);

        (bool passedX,) = element.check(user, address(0), assetX, 0, "");
        assertTrue(passedX);
        assertEq(uint256(element.effectiveStatus(user, assetX)), uint256(Affiliate.EffectiveStatus.AFFILIATE));

        (bool passedY,) = element.check(user, address(0), assetY, 0, "");
        assertTrue(passedY);
        assertEq(uint256(element.effectiveStatus(user, assetY)), uint256(Affiliate.EffectiveStatus.NON_AFFILIATE));
    }

    // ---------------------------------------------------------------
    // doc §7 Test 3 — decay complete (95 days after resignation). The claim is
    // re-attested (fresh verifiedAt) while decayStartedAt stays at resignation.
    // PASS_NON_AFFILIATE (auto-resolved, doc §11.2).
    // ---------------------------------------------------------------

    function test_check_test3_decayComplete() public {
        _setClaim(user, assetX, Affiliate.AffiliateBasis.FORMER_AFFILIATE_DECAY, START, START - 95 days);

        (bool passed, bytes32 reasonCode) = element.check(user, address(0), assetX, 0, "");
        assertTrue(passed);
        assertEq(reasonCode, bytes32(0));
        assertEq(uint256(element.effectiveStatus(user, assetX)), uint256(Affiliate.EffectiveStatus.NON_AFFILIATE));
    }

    // ---------------------------------------------------------------
    // doc §7 Test 4 — indirect chain via family LLC. INDIRECT_CONTROL → AFFILIATE.
    // ---------------------------------------------------------------

    function test_check_test4_indirectControlFamilyLlc() public {
        address familyLlc = address(0xF00D);
        _setClaim(familyLlc, assetX, Affiliate.AffiliateBasis.INDIRECT_CONTROL, START, 0);

        (bool passed,) = element.check(familyLlc, address(0), assetX, 0, "");
        assertTrue(passed);
        assertEq(uint256(element.effectiveStatus(familyLlc, assetX)), uint256(Affiliate.EffectiveStatus.AFFILIATE));
    }

    // ---------------------------------------------------------------
    // doc §7 Test 5 — NOT_AFFILIATE pass (ordinary retail investor).
    // ---------------------------------------------------------------

    function test_check_test5_notAffiliatePass() public {
        _setClaim(user, assetX, Affiliate.AffiliateBasis.NOT_AFFILIATE, START, 0);

        (bool passed, bytes32 reasonCode) = element.check(user, address(0), assetX, 2000, "");
        assertTrue(passed);
        assertEq(reasonCode, bytes32(0));
        assertEq(uint256(element.effectiveStatus(user, assetX)), uint256(Affiliate.EffectiveStatus.NON_AFFILIATE));
    }

    // ---------------------------------------------------------------
    // A-06.md §2 판정표 — decay look-back boundary (rows for 144(b)(2) 90-day tail
    // vs 144(b)(1) "preceding three months"). verifiedAt is kept fresh (== START,
    // checked at START) so freshness never interferes; decayStartedAt is placed N
    // days in the past. Decay completes only once BOTH look-backs run — the binding
    // one is max(90d, 92d) = 92d (LOOKBACK_144B1). The 90-day row is the critical
    // regression: a naive single-90-day gate flips to NON_AFFILIATE at day 90, but
    // the (b)(1) three-calendar-month look-back is not yet satisfied there.
    // ---------------------------------------------------------------

    function _decayStatusAtDays(uint64 daysSinceResignation) internal returns (Affiliate.EffectiveStatus) {
        _setClaim(
            user, assetX, Affiliate.AffiliateBasis.FORMER_AFFILIATE_DECAY, START, START - daysSinceResignation * 1 days
        );
        return element.effectiveStatus(user, assetX);
    }

    function test_decayBoundary_day89_stillAffiliate() public {
        assertEq(uint256(_decayStatusAtDays(89)), uint256(Affiliate.EffectiveStatus.AFFILIATE));
    }

    // Day 90: 144(b)(2) tail just cleared, but 144(b)(1) 3-calendar-month look-back
    // (92d) has NOT — dual-period correctness (A-06.md checklist C5/C6, pattern 1).
    function test_decayBoundary_day90_tailClearedButLookbackNot_stillAffiliate() public {
        assertEq(uint256(_decayStatusAtDays(90)), uint256(Affiliate.EffectiveStatus.AFFILIATE));
    }

    function test_decayBoundary_day91_stillAffiliate() public {
        assertEq(uint256(_decayStatusAtDays(91)), uint256(Affiliate.EffectiveStatus.AFFILIATE));
    }

    // Day 92: both look-backs satisfied → NON_AFFILIATE. Inclusive boundary (doc §9.3
    // Case 2 — the moment the period elapses, the person flips to non-affiliate).
    function test_decayBoundary_day92_inclusive_becomesNonAffiliate() public {
        assertEq(uint256(_decayStatusAtDays(92)), uint256(Affiliate.EffectiveStatus.NON_AFFILIATE));
    }

    function test_decayBoundary_day93_nonAffiliate() public {
        assertEq(uint256(_decayStatusAtDays(93)), uint256(Affiliate.EffectiveStatus.NON_AFFILIATE));
    }

    // Malformed FORMER_AFFILIATE_DECAY (no decayStartedAt) cannot prove any tail ran
    // → fail-closed to AFFILIATE, never the laxer non-affiliate path (doc §10.3).
    function test_decay_missingStart_failsClosedToAffiliate() public {
        _setClaim(user, assetX, Affiliate.AffiliateBasis.FORMER_AFFILIATE_DECAY, START, 0);
        assertEq(uint256(element.effectiveStatus(user, assetX)), uint256(Affiliate.EffectiveStatus.AFFILIATE));
    }

    // ---------------------------------------------------------------
    // A-06.md §2 — freshness cap boundary (Decipher policy, strict `>`). Exactly at
    // the 90-day reuse cap is still fresh; one second past expires.
    // ---------------------------------------------------------------

    function test_freshness_exactlyAtCapPasses() public {
        _setClaim(user, assetX, Affiliate.AffiliateBasis.NOT_AFFILIATE, START, 0);
        vm.warp(START + element.FRESHNESS_CAP());

        (bool passed, bytes32 reasonCode) = element.check(user, address(0), assetX, 0, "");
        assertTrue(passed);
        assertEq(reasonCode, bytes32(0));
    }

    function test_freshness_oneSecondPastCapExpires() public {
        _setClaim(user, assetX, Affiliate.AffiliateBasis.NOT_AFFILIATE, START, 0);
        vm.warp(START + element.FRESHNESS_CAP() + 1);

        (bool passed, bytes32 reasonCode) = element.check(user, address(0), assetX, 0, "");
        assertFalse(passed);
        assertEq(reasonCode, _code(3)); // FAIL_AFFILIATE_CLAIM_EXPIRED
        assertEq(uint256(element.effectiveStatus(user, assetX)), uint256(Affiliate.EffectiveStatus.EXPIRED));
    }

    // ---------------------------------------------------------------
    // A-06.md §2 / checklist C3 — no on-chain bright line. BENEFICIAL_OWNER_10PLUS is
    // an ATTESTED evidentiary basis, not a percentage this gate computes; the element
    // never reads an ownership number, it consumes the off-chain conclusion.
    // ---------------------------------------------------------------

    function test_beneficialOwner10Plus_isAttestedBasis_notComputedThreshold() public {
        _setClaim(user, assetX, Affiliate.AffiliateBasis.BENEFICIAL_OWNER_10PLUS, START, 0);
        (bool passed,) = element.check(user, address(0), assetX, 0, "");
        assertTrue(passed);
        assertEq(uint256(element.effectiveStatus(user, assetX)), uint256(Affiliate.EffectiveStatus.AFFILIATE));
    }

    // ---------------------------------------------------------------
    // Failure / review codes — every one at least once.
    // ---------------------------------------------------------------

    // code 1 — no claim at all (fail-closed default state): absence is NOT a
    // non-affiliate pass.
    function test_failClosed_noClaim_statusUnknown() public {
        (bool passed, bytes32 reasonCode) = element.check(user, address(0), assetX, 0, "");
        assertFalse(passed);
        assertEq(reasonCode, _code(1)); // FAIL_AFFILIATE_STATUS_UNKNOWN
        assertEq(uint256(element.effectiveStatus(user, assetX)), uint256(Affiliate.EffectiveStatus.UNKNOWN));
    }

    // code 1 — asset mismatch: a claim exists for assetX but the trade is on assetY
    // (affiliate status is asset-specific, doc §4.4 / §5.1 step 4).
    function test_failClosed_assetMismatch_statusUnknown() public {
        _setClaim(user, assetX, Affiliate.AffiliateBasis.OFFICER_DIRECTOR, START, 0);

        (bool passed, bytes32 reasonCode) = element.check(user, address(0), assetY, 0, "");
        assertFalse(passed);
        assertEq(reasonCode, _code(1));
    }

    // code 2 — claim issuer not in the trusted set.
    function test_untrustedIssuer() public {
        address rogue = address(0xDEAD);
        element.setClaim(
            user,
            assetX,
            Affiliate.AffiliateBasis.OFFICER_DIRECTOR,
            Affiliate.DeterminationSource.ISSUER_REGISTRY,
            rogue,
            START,
            0
        );

        (bool passed, bytes32 reasonCode) = element.check(user, address(0), assetX, 0, "");
        assertFalse(passed);
        assertEq(reasonCode, _code(2)); // FAIL_UNTRUSTED_AFFILIATE_CLAIM_ISSUER
        assertEq(uint256(element.effectiveStatus(user, assetX)), uint256(Affiliate.EffectiveStatus.UNTRUSTED));

        // Trusting the issuer cures it.
        element.setTrustedClaimIssuer(rogue, true);
        (bool passedNow,) = element.check(user, address(0), assetX, 0, "");
        assertTrue(passedNow);
    }

    // Revoking trust after the fact turns a previously-passing claim untrusted.
    function test_untrustedIssuer_revocation() public {
        _setClaim(user, assetX, Affiliate.AffiliateBasis.OFFICER_DIRECTOR, START, 0);
        (bool passedBefore,) = element.check(user, address(0), assetX, 0, "");
        assertTrue(passedBefore);

        element.setTrustedClaimIssuer(issuer, false);
        (bool passedAfter, bytes32 reasonCode) = element.check(user, address(0), assetX, 0, "");
        assertFalse(passedAfter);
        assertEq(reasonCode, _code(2));
    }

    // code 3 — expired claim (covered at boundary above; explicit far-past case here).
    function test_expiredClaim() public {
        _setClaim(user, assetX, Affiliate.AffiliateBasis.OFFICER_DIRECTOR, START, 0);
        vm.warp(START + 200 days);

        (bool passed, bytes32 reasonCode) = element.check(user, address(0), assetX, 0, "");
        assertFalse(passed);
        assertEq(reasonCode, _code(3));
    }

    // code 4 — UNCERTAIN_AFFILIATE routes to manual review, fail-closed.
    function test_uncertainAffiliate_review() public {
        _setClaim(user, assetX, Affiliate.AffiliateBasis.UNCERTAIN_AFFILIATE, START, 0);

        (bool passed, bytes32 reasonCode) = element.check(user, address(0), assetX, 0, "");
        assertFalse(passed);
        assertEq(reasonCode, _code(4)); // REVIEW_AFFILIATE_UNCERTAIN
        assertEq(uint256(element.effectiveStatus(user, assetX)), uint256(Affiliate.EffectiveStatus.UNCERTAIN));
    }

    // ---------------------------------------------------------------
    // Evaluation-order pins: earlier steps win over later ones (doc §5.1 order).
    // ---------------------------------------------------------------

    // Untrusted issuer (step 2) beats an expired verifiedAt (step 3).
    function test_order_untrustedBeatsExpired() public {
        address rogue = address(0xDEAD);
        element.setClaim(
            user,
            assetX,
            Affiliate.AffiliateBasis.OFFICER_DIRECTOR,
            Affiliate.DeterminationSource.ISSUER_REGISTRY,
            rogue,
            START,
            0
        );
        vm.warp(START + 200 days); // also stale

        (bool passed, bytes32 reasonCode) = element.check(user, address(0), assetX, 0, "");
        assertFalse(passed);
        assertEq(reasonCode, _code(2)); // untrusted (step 2) wins over expired (step 3)
    }

    // ---------------------------------------------------------------
    // A-06 keys claims per (subject, asset); the identity args are otherwise inert
    // (counterparty / amount / context do not affect the verdict).
    // ---------------------------------------------------------------

    function test_check_ignoresCounterpartyAmountContext() public {
        _setClaim(user, assetX, Affiliate.AffiliateBasis.NOT_AFFILIATE, START, 0);

        (bool passed1,) = element.check(user, address(0), assetX, 0, "");
        (bool passed2,) = element.check(user, address(0xB0B), assetX, 999999, hex"deadbeef");
        assertTrue(passed1);
        assertEq(passed1, passed2);
    }
}
