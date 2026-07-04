// SPDX-License-Identifier: GPL-3.0
pragma solidity 0.8.17;

import {Test} from "forge-std/Test.sol";
import {Erc3643Native} from "../../../../src/compliance/elements/Erc3643Native.sol";
import {
    ElementMetadata,
    ElementCategory,
    TemporalNature,
    Decidability,
    ObligationTiming,
    Statefulness
} from "../../../../src/types/ComplianceTypes.sol";
import {Errors} from "../../../../src/libraries/Errors.sol";

contract Erc3643NativeTest is Test {
    Erc3643Native internal element;

    address internal owner = address(this);
    address internal operator = address(0xBEEF);
    address internal stranger = address(0xDEAD);
    address internal asset = address(0x7000);
    address internal user = address(0xA11CE);
    address internal counterparty = address(0xB0B);

    event Erc3643NativeSet(address indexed asset, bool native_);

    function setUp() public {
        element = new Erc3643Native();
        element.setOperator(operator, true);
    }

    function test_metadata_fields() public {
        ElementMetadata memory m = element.elementMetadata();
        assertEq(m.elementId, bytes32("B-02-v1"));
        assertEq(uint256(m.category), uint256(ElementCategory.ASSET_ATTRIBUTE));
        assertEq(uint256(m.decidability), uint256(Decidability.DETERMINISTIC));
        assertEq(uint256(m.statefulness), uint256(Statefulness.STATELESS));
    }

    function test_setErc3643Native_reverts_for_non_operator() public {
        vm.prank(stranger);
        vm.expectRevert(Errors.NotAuthorized.selector);
        element.setErc3643Native(asset, true);
    }

    function test_setErc3643Native_updates_state_and_emits_event() public {
        vm.expectEmit(true, false, false, true);
        emit Erc3643NativeSet(asset, true);
        vm.prank(operator);
        element.setErc3643Native(asset, true);
        assertTrue(element.erc3643Native(asset));
    }

    function test_owner_may_also_set_via_onlyOperator_gate() public {
        // owner passes the onlyOperator gate even without being added as operator.
        element.setErc3643Native(asset, true);
        assertTrue(element.erc3643Native(asset));
    }

    function test_check_fails_when_unattested_default_state() public {
        (bool passed, bytes32 reasonCode) = element.check(user, counterparty, asset, 100, "");
        assertFalse(passed);
        assertTrue(reasonCode != bytes32(0));
    }

    function test_check_passes_after_attestation() public {
        vm.prank(operator);
        element.setErc3643Native(asset, true);

        (bool passed, bytes32 reasonCode) = element.check(user, counterparty, asset, 100, "");
        assertTrue(passed);
        assertEq(reasonCode, bytes32(0));
    }

    function test_check_fails_after_attestation_revoked() public {
        vm.prank(operator);
        element.setErc3643Native(asset, true);
        (bool passed,) = element.check(user, counterparty, asset, 100, "");
        assertTrue(passed);

        vm.prank(operator);
        element.setErc3643Native(asset, false);
        (bool passedAfterRevoke, bytes32 reasonCode) = element.check(user, counterparty, asset, 100, "");
        assertFalse(passedAfterRevoke);
        assertTrue(reasonCode != bytes32(0));
    }

    function test_check_ignores_user_and_counterparty() public {
        vm.prank(operator);
        element.setErc3643Native(asset, true);

        (bool passedA,) = element.check(user, counterparty, asset, 1, "");
        (bool passedB,) = element.check(address(0x1234), address(0x5678), asset, 999_999, "");
        assertTrue(passedA);
        assertTrue(passedB);

        // A different, unattested asset still fails regardless of user/counterparty.
        address otherAsset = address(0x9999);
        (bool passedC,) = element.check(address(0x1234), address(0x5678), otherAsset, 1, "");
        assertFalse(passedC);
    }
}
