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

contract IdentityUniquenessTest is Test {
    // Re-declared with identical signatures to IdentityUniqueness's own events so
    // vm.expectEmit can match by topic0 — Solidity 0.8.17 has no `emit
    // Contract.Event(...)` syntax for events declared on another contract.
    event IdentityBound(address indexed wallet, bytes32 indexed identityId);
    event IdentityUnbound(address indexed wallet, bytes32 indexed identityId);

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
}
