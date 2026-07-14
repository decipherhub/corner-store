// SPDX-License-Identifier: GPL-3.0
pragma solidity 0.8.17;

import {Test} from "forge-std/Test.sol";
import {FormDFiling} from "../../../../src/compliance/elements/FormDFiling.sol";
import {Errors} from "../../../../src/libraries/Errors.sol";
import {
    ElementMetadata,
    ElementCategory,
    TemporalNature,
    Decidability,
    ObligationTiming,
    Statefulness
} from "../../../../src/types/ComplianceTypes.sol";

contract FormDFilingTest is Test {
    address internal user = address(0xA11CE);
    address internal counterparty = address(0xC0FFEE);
    address internal asset = address(0xBEEF);
    address internal operator = address(0x0BADBEEF01);
    address internal stranger = address(0xBAD);

    event FormDFilingSet(address indexed asset, bool filed, bytes32 ref);

    FormDFiling internal element;

    function setUp() public {
        element = new FormDFiling();
        element.setOperator(operator, true);
    }

    function test_metadata_fields() public {
        ElementMetadata memory m = element.elementMetadata();
        assertEq(m.elementId, bytes32("E-01-v1"));
        assertEq(uint256(m.category), uint256(ElementCategory.ISSUER_STATUS));
        assertEq(uint256(m.decidability), uint256(Decidability.ATTESTATION_BASED));
        assertEq(uint256(m.temporal), uint256(TemporalNature.ONE_TIME));
        assertEq(uint256(m.timing), uint256(ObligationTiming.EX_ANTE_VERIFY));
        assertEq(uint256(m.statefulness), uint256(Statefulness.STATELESS));
    }

    function test_setFormDFiled_revertsForNonOperatorNonOwner() public {
        vm.prank(stranger);
        vm.expectRevert(Errors.NotAuthorized.selector);
        element.setFormDFiled(asset, true, bytes32("edgar-accession-1"));
    }

    function test_setFormDFiled_ownerCanCall() public {
        // owner (this test contract, the deployer) is also authorized via onlyOperator.
        element.setFormDFiled(asset, true, bytes32("edgar-accession-1"));
        assertTrue(element.formDFiled(asset));
    }

    function test_setFormDFiled_stateChangeAndEvent() public {
        bytes32 ref = bytes32("edgar-accession-42");
        vm.expectEmit(true, false, false, true);
        emit FormDFilingSet(asset, true, ref);
        vm.prank(operator);
        element.setFormDFiled(asset, true, ref);

        assertTrue(element.formDFiled(asset));
        assertEq(element.filingRef(asset), ref);
    }

    function test_check_failsClosed_whenUnattested() public {
        (bool passed, bytes32 reasonCode) = element.check(user, counterparty, asset, 0, "");
        assertFalse(passed);
        assertTrue(reasonCode != bytes32(0));
    }

    function test_check_passes_whenFormDFiled() public {
        vm.prank(operator);
        element.setFormDFiled(asset, true, bytes32("edgar-accession-99"));

        (bool passed, bytes32 reasonCode) = element.check(user, counterparty, asset, 0, "");
        assertTrue(passed);
        assertEq(reasonCode, bytes32(0));
    }

    function test_check_isPerAsset_notPerUser() public {
        address otherAsset = address(0xDEAD);
        vm.prank(operator);
        element.setFormDFiled(asset, true, bytes32("edgar-accession-7"));

        (bool passedForFiledAsset,) = element.check(user, counterparty, asset, 0, "");
        (bool passedForOtherAsset,) = element.check(user, counterparty, otherAsset, 0, "");
        assertTrue(passedForFiledAsset);
        assertFalse(passedForOtherAsset);
    }

    function test_fileThenRevoke_roundTrip() public {
        bytes32 ref = bytes32("edgar-accession-123");

        // File with a nonzero ref → passes, and filingRef is readable.
        vm.prank(operator);
        element.setFormDFiled(asset, true, ref);
        (bool passed,) = element.check(user, counterparty, asset, 0, "");
        assertTrue(passed);
        assertEq(element.filingRef(asset), ref);

        // Revoke with (false, bytes32(0)) → fails again, ref cleared.
        vm.prank(operator);
        element.setFormDFiled(asset, false, bytes32(0));
        (passed,) = element.check(user, counterparty, asset, 0, "");
        assertFalse(passed);
        assertEq(element.filingRef(asset), bytes32(0));
    }
}
