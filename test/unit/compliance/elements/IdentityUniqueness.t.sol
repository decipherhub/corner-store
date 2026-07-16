// SPDX-License-Identifier: GPL-3.0
pragma solidity 0.8.17;

import {Test} from "forge-std/Test.sol";
import {IdentityUniqueness} from "../../../../src/compliance/elements/IdentityUniqueness.sol";
import {
    ElementMetadata,
    ElementCategory,
    TemporalNature,
    Decidability,
    ObligationTiming,
    Statefulness
} from "../../../../src/types/ComplianceTypes.sol";
import {Errors} from "../../../../src/libraries/Errors.sol";
import {ReasonCodes} from "../../../../src/libraries/ReasonCodes.sol";

contract IdentityUniquenessTest is Test {
    // Re-declared with identical signatures to IdentityUniqueness's own events so
    // vm.expectEmit can match by topic0 — Solidity 0.8.17 has no `emit
    // Contract.Event(...)` syntax for events declared on another contract.
    event IdentityBound(address indexed wallet, bytes32 indexed identityId);
    event IdentityUnbound(address indexed wallet, bytes32 indexed identityId);
    event KycClaimSet(
        bytes32 indexed identityId,
        bool exists,
        bool signatureValid,
        bool issuerTrusted,
        uint64 verifiedAt,
        uint64 maxAge
    );
    event IdentityStatusSet(bytes32 indexed identityId, IdentityUniqueness.IdentityStatus status);
    event DedupStatusSet(bytes32 indexed identityId, IdentityUniqueness.DedupStatus status);
    event EnforceCounterpartySet(bool enabled);

    IdentityUniqueness internal id;

    address internal operator = address(0xBEEF);
    address internal stranger = address(0xDEAD);
    address internal wallet = address(0xA11CE);
    address internal otherWallet = address(0xB0B);
    address internal asset = address(0x7000);
    bytes32 internal identityId = keccak256("investor-1");
    bytes32 internal otherIdentityId = keccak256("investor-2");

    function setUp() public {
        id = new IdentityUniqueness();
        id.setOperator(operator, true);
    }

    // --- metadata ---

    function test_metadata_fields() public view {
        ElementMetadata memory m = id.elementMetadata();
        assertEq(m.elementId, bytes32("A-04-v1"));
        assertEq(uint256(m.category), uint256(ElementCategory.INVESTOR_ATTRIBUTE));
        assertEq(uint256(m.decidability), uint256(Decidability.DETERMINISTIC));
        assertEq(uint256(m.statefulness), uint256(Statefulness.STATELESS));
    }

    // --- setter auth ---

    function test_bindIdentity_reverts_for_non_operator() public {
        vm.prank(stranger);
        vm.expectRevert(Errors.NotAuthorized.selector);
        id.bindIdentity(wallet, identityId);
    }

    function test_unbindIdentity_reverts_for_non_operator() public {
        vm.prank(operator);
        id.bindIdentity(wallet, identityId);

        vm.prank(stranger);
        vm.expectRevert(Errors.NotAuthorized.selector);
        id.unbindIdentity(wallet);
    }

    // --- setter state change + events ---

    function test_bindIdentity_setsState_and_emitsEvent() public {
        vm.expectEmit(true, true, false, true);
        emit IdentityBound(wallet, identityId);

        vm.prank(operator);
        id.bindIdentity(wallet, identityId);

        assertEq(id.identityOf(wallet), identityId);
        assertEq(id.walletOf(identityId), wallet);
    }

    function test_unbindIdentity_clearsState_and_emitsEvent() public {
        vm.prank(operator);
        id.bindIdentity(wallet, identityId);

        vm.expectEmit(true, true, false, true);
        emit IdentityUnbound(wallet, identityId);

        vm.prank(operator);
        id.unbindIdentity(wallet);

        assertEq(id.identityOf(wallet), bytes32(0));
        assertEq(id.walletOf(identityId), address(0));
    }

    // --- check pass/fail ---

    function test_check_fails_when_unbound() public view {
        (bool passed, bytes32 rc) = id.check(wallet, address(0), asset, 0, "");
        assertFalse(passed);
        assertTrue(rc != bytes32(0));
    }

    function test_check_passes_when_bound() public {
        vm.prank(operator);
        id.bindIdentity(wallet, identityId);

        (bool passed, bytes32 rc) = id.check(wallet, address(0), asset, 0, "");
        assertTrue(passed);
        assertEq(rc, bytes32(0));
    }

    function test_unbind_then_check_fails_again() public {
        vm.prank(operator);
        id.bindIdentity(wallet, identityId);

        vm.prank(operator);
        id.unbindIdentity(wallet);

        (bool passed,) = id.check(wallet, address(0), asset, 0, "");
        assertFalse(passed);
    }

    // --- uniqueness invariant ---

    function test_bindIdentity_rebind_sameWalletSameIdentity_isIdempotent() public {
        vm.prank(operator);
        id.bindIdentity(wallet, identityId);

        vm.prank(operator);
        id.bindIdentity(wallet, identityId);

        assertEq(id.identityOf(wallet), identityId);
        assertEq(id.walletOf(identityId), wallet);
    }

    function test_bindIdentity_reverts_whenIdentityAlreadyBoundToDifferentWallet() public {
        vm.prank(operator);
        id.bindIdentity(wallet, identityId);

        vm.prank(operator);
        vm.expectRevert(IdentityUniqueness.IdentityBindingConflict.selector);
        id.bindIdentity(otherWallet, identityId);
    }

    function test_bindIdentity_reverts_whenWalletAlreadyBoundToDifferentIdentity() public {
        vm.prank(operator);
        id.bindIdentity(wallet, identityId);

        vm.prank(operator);
        vm.expectRevert(IdentityUniqueness.IdentityBindingConflict.selector);
        id.bindIdentity(wallet, otherIdentityId);
    }

    function test_bindIdentity_reverts_onZeroIdentity() public {
        vm.prank(operator);
        vm.expectRevert(IdentityUniqueness.IdentityBindingConflict.selector);
        id.bindIdentity(wallet, bytes32(0));
    }

    // =====================================================================
    // A-04 walkthrough-spec upgrade (doc §5.2/§5.3/§6.2): KYC claim pipeline,
    // identity status, dedup status, opt-in counterparty gate.
    // =====================================================================

    function code(uint32 n) internal pure returns (bytes32) {
        return ReasonCodes.encode(0, bytes32("A-04-v1"), n);
    }

    function bind(address w) internal {
        vm.prank(operator);
        id.bindIdentity(w, identityId);
    }

    function claimOf(bytes32 idty) internal view returns (IdentityUniqueness.KycClaim memory c) {
        (c.exists, c.signatureValid, c.issuerTrusted, c.verifiedAt, c.maxAge) = id.kycClaimOf(idty);
    }

    function setClaim(bytes32 idty, bool exists, bool sig, bool trusted, uint64 verifiedAt, uint64 maxAge) internal {
        vm.prank(operator);
        id.setKycClaim(
            idty,
            IdentityUniqueness.KycClaim({
                exists: exists, signatureValid: sig, issuerTrusted: trusted, verifiedAt: verifiedAt, maxAge: maxAge
            })
        );
    }

    // --- legacy code-1 meaning + bind seeding invariant ---

    function test_check_unbound_returnsCode1() public view {
        (bool passed, bytes32 rc) = id.check(wallet, address(0), asset, 0, "");
        assertFalse(passed);
        assertEq(rc, code(1));
    }

    function test_bindIdentity_seedsValidKycClaim() public {
        vm.warp(1000);
        bind(wallet);

        IdentityUniqueness.KycClaim memory c = claimOf(identityId);
        assertTrue(c.exists);
        assertTrue(c.signatureValid);
        assertTrue(c.issuerTrusted);
        assertEq(c.verifiedAt, 1000);
        assertEq(c.maxAge, 0);
    }

    function test_bindIdentity_doesNotOverwrite_operatorCustomizedClaim() public {
        bind(wallet);
        setClaim(identityId, true, false, true, uint64(block.timestamp), 0);

        // Idempotent rebind must not clobber the customized (exists=true) claim.
        bind(wallet);
        IdentityUniqueness.KycClaim memory c = claimOf(identityId);
        assertFalse(c.signatureValid);
    }

    function test_bindIdentity_reseedsClaim_whenClaimMarkedNonexistent() public {
        bind(wallet);
        setClaim(identityId, false, false, false, 0, 0);
        vm.prank(operator);
        id.unbindIdentity(wallet);

        // Re-bind must restore the legacy guarantee: bound => passes.
        bind(wallet);
        (bool passed, bytes32 rc) = id.check(wallet, address(0), asset, 0, "");
        assertTrue(passed);
        assertEq(rc, bytes32(0));
    }

    function test_boundOnlyWallet_passes_withDefaults() public {
        bind(wallet);
        // Defaults: seeded claim + ACTIVE + UNIQUE (enum zero) — legacy compat.
        assertEq(uint256(id.identityStatusOf(identityId)), uint256(IdentityUniqueness.IdentityStatus.ACTIVE));
        assertEq(uint256(id.dedupStatusOf(identityId)), uint256(IdentityUniqueness.DedupStatus.UNIQUE));

        (bool passed, bytes32 rc) = id.check(wallet, address(0), asset, 0, "");
        assertTrue(passed);
        assertEq(rc, bytes32(0));
    }

    // --- setter auth for the new operator setters ---

    function test_setKycClaim_reverts_for_non_operator() public {
        vm.prank(stranger);
        vm.expectRevert(Errors.NotAuthorized.selector);
        id.setKycClaim(
            identityId,
            IdentityUniqueness.KycClaim({
                exists: true, signatureValid: true, issuerTrusted: true, verifiedAt: 0, maxAge: 0
            })
        );
    }

    function test_setIdentityStatus_reverts_for_non_operator() public {
        vm.prank(stranger);
        vm.expectRevert(Errors.NotAuthorized.selector);
        id.setIdentityStatus(identityId, IdentityUniqueness.IdentityStatus.FROZEN);
    }

    function test_setDedupStatus_reverts_for_non_operator() public {
        vm.prank(stranger);
        vm.expectRevert(Errors.NotAuthorized.selector);
        id.setDedupStatus(identityId, IdentityUniqueness.DedupStatus.CONFIRMED_DUPLICATE);
    }

    function test_setEnforceCounterparty_reverts_for_non_operator() public {
        vm.prank(stranger);
        vm.expectRevert(Errors.NotAuthorized.selector);
        id.setEnforceCounterparty(true);
    }

    // --- setter events ---

    function test_setKycClaim_emitsEvent() public {
        vm.expectEmit(true, false, false, true);
        emit KycClaimSet(identityId, true, false, true, 123, 456);
        setClaim(identityId, true, false, true, 123, 456);
    }

    function test_setIdentityStatus_emitsEvent_andStoresState() public {
        vm.expectEmit(true, false, false, true);
        emit IdentityStatusSet(identityId, IdentityUniqueness.IdentityStatus.FROZEN);
        vm.prank(operator);
        id.setIdentityStatus(identityId, IdentityUniqueness.IdentityStatus.FROZEN);
        assertEq(uint256(id.identityStatusOf(identityId)), uint256(IdentityUniqueness.IdentityStatus.FROZEN));
    }

    function test_setDedupStatus_emitsEvent_andStoresState() public {
        vm.expectEmit(true, false, false, true);
        emit DedupStatusSet(identityId, IdentityUniqueness.DedupStatus.SUSPECTED_DUPLICATE);
        vm.prank(operator);
        id.setDedupStatus(identityId, IdentityUniqueness.DedupStatus.SUSPECTED_DUPLICATE);
        assertEq(uint256(id.dedupStatusOf(identityId)), uint256(IdentityUniqueness.DedupStatus.SUSPECTED_DUPLICATE));
    }

    function test_setEnforceCounterparty_emitsEvent_andStoresState() public {
        vm.expectEmit(false, false, false, true);
        emit EnforceCounterpartySet(true);
        vm.prank(operator);
        id.setEnforceCounterparty(true);
        assertTrue(id.enforceCounterparty());
    }

    // --- pipeline failure codes 2..9 ---

    function test_check_code2_whenClaimMissing() public {
        bind(wallet);
        setClaim(identityId, false, false, false, 0, 0);

        (bool passed, bytes32 rc) = id.check(wallet, address(0), asset, 0, "");
        assertFalse(passed);
        assertEq(rc, code(2));
    }

    function test_check_code3_whenSignatureInvalid() public {
        bind(wallet);
        setClaim(identityId, true, false, true, uint64(block.timestamp), 0);

        (bool passed, bytes32 rc) = id.check(wallet, address(0), asset, 0, "");
        assertFalse(passed);
        assertEq(rc, code(3));
    }

    function test_check_code4_whenIssuerUntrusted() public {
        bind(wallet);
        setClaim(identityId, true, true, false, uint64(block.timestamp), 0);

        (bool passed, bytes32 rc) = id.check(wallet, address(0), asset, 0, "");
        assertFalse(passed);
        assertEq(rc, code(4));
    }

    function test_check_code5_whenClaimExpired() public {
        vm.warp(1000);
        bind(wallet);
        setClaim(identityId, true, true, true, 1000, 100);

        vm.warp(1101); // age 101 > maxAge 100
        (bool passed, bytes32 rc) = id.check(wallet, address(0), asset, 0, "");
        assertFalse(passed);
        assertEq(rc, code(5));
    }

    function test_check_freshnessBoundary_exactlyMaxAge_passes() public {
        vm.warp(1000);
        bind(wallet);
        setClaim(identityId, true, true, true, 1000, 100);

        vm.warp(1100); // age 100 == maxAge — strict `>` discipline: still fresh
        (bool passed, bytes32 rc) = id.check(wallet, address(0), asset, 0, "");
        assertTrue(passed);
        assertEq(rc, bytes32(0));
    }

    function test_check_maxAgeZero_neverExpires() public {
        vm.warp(1000);
        bind(wallet);

        vm.warp(1000 + 3650 days);
        (bool passed,) = id.check(wallet, address(0), asset, 0, "");
        assertTrue(passed);
    }

    function test_check_code6_whenIdentityFrozen() public {
        bind(wallet);
        vm.prank(operator);
        id.setIdentityStatus(identityId, IdentityUniqueness.IdentityStatus.FROZEN);

        (bool passed, bytes32 rc) = id.check(wallet, address(0), asset, 0, "");
        assertFalse(passed);
        assertEq(rc, code(6));
    }

    function test_check_code7_whenIdentityRevoked() public {
        bind(wallet);
        vm.prank(operator);
        id.setIdentityStatus(identityId, IdentityUniqueness.IdentityStatus.REVOKED);

        (bool passed, bytes32 rc) = id.check(wallet, address(0), asset, 0, "");
        assertFalse(passed);
        assertEq(rc, code(7));
    }

    function test_check_passesAgain_afterUnfreeze() public {
        bind(wallet);
        vm.prank(operator);
        id.setIdentityStatus(identityId, IdentityUniqueness.IdentityStatus.FROZEN);
        vm.prank(operator);
        id.setIdentityStatus(identityId, IdentityUniqueness.IdentityStatus.ACTIVE);

        (bool passed,) = id.check(wallet, address(0), asset, 0, "");
        assertTrue(passed);
    }

    function test_check_code8_whenConfirmedDuplicate() public {
        bind(wallet);
        vm.prank(operator);
        id.setDedupStatus(identityId, IdentityUniqueness.DedupStatus.CONFIRMED_DUPLICATE);

        (bool passed, bytes32 rc) = id.check(wallet, address(0), asset, 0, "");
        assertFalse(passed);
        assertEq(rc, code(8));
    }

    // Doc §6.2: SUSPECTED is REVIEW (not FAIL) off-chain; on-chain the element
    // has only pass/fail, so the distinction lives in the code number (9 vs 8).
    function test_check_code9_whenSuspectedDuplicate() public {
        bind(wallet);
        vm.prank(operator);
        id.setDedupStatus(identityId, IdentityUniqueness.DedupStatus.SUSPECTED_DUPLICATE);

        (bool passed, bytes32 rc) = id.check(wallet, address(0), asset, 0, "");
        assertFalse(passed);
        assertEq(rc, code(9));
    }

    function test_check_passesAgain_afterSuspicionClearedToUnique() public {
        bind(wallet);
        vm.prank(operator);
        id.setDedupStatus(identityId, IdentityUniqueness.DedupStatus.SUSPECTED_DUPLICATE);
        vm.prank(operator);
        id.setDedupStatus(identityId, IdentityUniqueness.DedupStatus.UNIQUE);

        (bool passed,) = id.check(wallet, address(0), asset, 0, "");
        assertTrue(passed);
    }

    // --- check-order precedence (doc §5.2: earlier stage wins) ---

    function test_checkOrder_invalidSig_beatsUntrustedIssuer() public {
        bind(wallet);
        setClaim(identityId, true, false, false, uint64(block.timestamp), 0);

        (, bytes32 rc) = id.check(wallet, address(0), asset, 0, "");
        assertEq(rc, code(3));
    }

    function test_checkOrder_expired_beatsFrozen() public {
        vm.warp(1000);
        bind(wallet);
        setClaim(identityId, true, true, true, 1000, 10);
        vm.prank(operator);
        id.setIdentityStatus(identityId, IdentityUniqueness.IdentityStatus.FROZEN);

        vm.warp(2000);
        (, bytes32 rc) = id.check(wallet, address(0), asset, 0, "");
        assertEq(rc, code(5));
    }

    function test_checkOrder_frozen_beatsConfirmedDuplicate() public {
        bind(wallet);
        vm.prank(operator);
        id.setIdentityStatus(identityId, IdentityUniqueness.IdentityStatus.FROZEN);
        vm.prank(operator);
        id.setDedupStatus(identityId, IdentityUniqueness.DedupStatus.CONFIRMED_DUPLICATE);

        (, bytes32 rc) = id.check(wallet, address(0), asset, 0, "");
        assertEq(rc, code(6));
    }

    // --- opt-in counterparty gate ---

    function test_counterpartyGate_offByDefault_unboundCounterpartyPasses() public {
        bind(wallet);
        assertFalse(id.enforceCounterparty());

        // e.g. an AMM pool address with no identity — must not block the trade.
        (bool passed, bytes32 rc) = id.check(wallet, otherWallet, asset, 0, "");
        assertTrue(passed);
        assertEq(rc, bytes32(0));
    }

    function test_counterpartyGate_on_unboundCounterparty_failsCode1() public {
        bind(wallet);
        vm.prank(operator);
        id.setEnforceCounterparty(true);

        (bool passed, bytes32 rc) = id.check(wallet, otherWallet, asset, 0, "");
        assertFalse(passed);
        assertEq(rc, code(1));
    }

    function test_counterpartyGate_on_bothBound_passes() public {
        bind(wallet);
        vm.prank(operator);
        id.bindIdentity(otherWallet, otherIdentityId);
        vm.prank(operator);
        id.setEnforceCounterparty(true);

        (bool passed, bytes32 rc) = id.check(wallet, otherWallet, asset, 0, "");
        assertTrue(passed);
        assertEq(rc, bytes32(0));
    }

    function test_counterpartyGate_on_counterpartyPipelineCodePropagates() public {
        bind(wallet);
        vm.prank(operator);
        id.bindIdentity(otherWallet, otherIdentityId);
        vm.prank(operator);
        id.setDedupStatus(otherIdentityId, IdentityUniqueness.DedupStatus.CONFIRMED_DUPLICATE);
        vm.prank(operator);
        id.setEnforceCounterparty(true);

        (bool passed, bytes32 rc) = id.check(wallet, otherWallet, asset, 0, "");
        assertFalse(passed);
        assertEq(rc, code(8));
    }

    function test_counterpartyGate_userFailure_takesPrecedence_overCounterparty() public {
        // user unbound(1), counterparty bound-but-frozen(6): user leg runs first.
        vm.prank(operator);
        id.bindIdentity(otherWallet, otherIdentityId);
        vm.prank(operator);
        id.setIdentityStatus(otherIdentityId, IdentityUniqueness.IdentityStatus.FROZEN);
        vm.prank(operator);
        id.setEnforceCounterparty(true);

        (bool passed, bytes32 rc) = id.check(wallet, otherWallet, asset, 0, "");
        assertFalse(passed);
        assertEq(rc, code(1));
    }
}
