// SPDX-License-Identifier: GPL-3.0
pragma solidity 0.8.17;

import {Test} from "forge-std/Test.sol";
import {Jurisdiction} from "../../../../src/compliance/elements/Jurisdiction.sol";
import {Errors} from "../../../../src/libraries/Errors.sol";
import {
    ElementMetadata,
    ElementCategory,
    TemporalNature,
    Decidability,
    ObligationTiming,
    Statefulness
} from "../../../../src/types/ComplianceTypes.sol";

contract JurisdictionTest is Test {
    Jurisdiction internal j;

    address internal operator = address(0xBEEF);
    address internal stranger = address(0xDEAD);
    address internal user = address(0xA11CE);
    address internal asset = address(0xF00D);

    bytes32 internal constant US = bytes32("US");
    bytes32 internal constant KP = bytes32("KP");

    event JurisdictionSet(address indexed investor, bytes32 code);
    event JurisdictionAllowedSet(bytes32 indexed code, bool allowed);

    function setUp() public {
        j = new Jurisdiction();
        j.setOperator(operator, true);
    }

    // --- metadata ---

    function test_metadata_fields() public view {
        ElementMetadata memory m = j.elementMetadata();
        assertEq(m.elementId, bytes32("A-02-v1"));
        assertEq(uint256(m.category), uint256(ElementCategory.INVESTOR_ATTRIBUTE));
        assertEq(uint256(m.decidability), uint256(Decidability.DETERMINISTIC));
        assertEq(uint256(m.temporal), uint256(TemporalNature.REALTIME));
        assertEq(uint256(m.timing), uint256(ObligationTiming.AT_TRADE_GATE));
        assertEq(uint256(m.statefulness), uint256(Statefulness.STATELESS));
    }

    // --- setter auth ---

    function test_setJurisdiction_reverts_for_non_operator() public {
        vm.prank(stranger);
        vm.expectRevert(Errors.NotAuthorized.selector);
        j.setJurisdiction(user, US);
    }

    function test_setJurisdictionAllowed_reverts_for_non_operator() public {
        vm.prank(stranger);
        vm.expectRevert(Errors.NotAuthorized.selector);
        j.setJurisdictionAllowed(US, true);
    }

    function test_owner_may_call_setters_without_being_operator() public {
        // The test contract is the owner (deployer) and is not explicitly
        // added as an operator, but Governed's onlyOperator allows owner too.
        j.setJurisdiction(user, US);
        assertEq(j.jurisdictionOf(user), US);
    }

    // --- setter state change + events ---

    function test_setJurisdiction_updates_state_and_emits() public {
        vm.expectEmit(true, false, false, true);
        emit JurisdictionSet(user, US);
        vm.prank(operator);
        j.setJurisdiction(user, US);
        assertEq(j.jurisdictionOf(user), US);
    }

    function test_setJurisdictionAllowed_updates_state_and_emits() public {
        vm.expectEmit(true, false, false, true);
        emit JurisdictionAllowedSet(US, true);
        vm.prank(operator);
        j.setJurisdictionAllowed(US, true);
        assertTrue(j.allowedJurisdiction(US));
    }

    // --- check: pass path ---

    function test_check_passes_when_jurisdiction_set_and_allowed() public {
        vm.startPrank(operator);
        j.setJurisdiction(user, US);
        j.setJurisdictionAllowed(US, true);
        vm.stopPrank();

        (bool passed, bytes32 reasonCode) = j.check(user, address(0), asset, 0, "");
        assertTrue(passed);
        assertEq(reasonCode, bytes32(0));
    }

    // --- check: fail paths ---

    function test_check_fails_when_jurisdiction_unset() public view {
        // Default/unset jurisdiction is bytes32(0) — fail-closed even though
        // nothing has explicitly disallowed the investor.
        (bool passed, bytes32 reasonCode) = j.check(user, address(0), asset, 0, "");
        assertFalse(passed);
        assertTrue(reasonCode != bytes32(0));
    }

    function test_check_fails_when_jurisdiction_set_but_not_allowed() public {
        vm.prank(operator);
        j.setJurisdiction(user, KP);
        // KP was never added to the allowed set.

        (bool passed, bytes32 reasonCode) = j.check(user, address(0), asset, 0, "");
        assertFalse(passed);
        assertTrue(reasonCode != bytes32(0));
    }

    function test_check_fails_even_if_unset_code_is_marked_allowed() public {
        // Fail-closed on unset jurisdiction: even if bytes32(0) were ever
        // marked allowed, an investor with no recorded jurisdiction must
        // still fail.
        vm.prank(operator);
        j.setJurisdictionAllowed(bytes32(0), true);

        (bool passed,) = j.check(user, address(0), asset, 0, "");
        assertFalse(passed);
    }

    // --- allowed-then-disallowed transition ---

    function test_check_allowed_then_disallowed_jurisdiction() public {
        vm.startPrank(operator);
        j.setJurisdiction(user, US);
        j.setJurisdictionAllowed(US, true);
        vm.stopPrank();

        (bool passed,) = j.check(user, address(0), asset, 0, "");
        assertTrue(passed);

        vm.prank(operator);
        j.setJurisdictionAllowed(US, false);

        (passed,) = j.check(user, address(0), asset, 0, "");
        assertFalse(passed);
    }
}
