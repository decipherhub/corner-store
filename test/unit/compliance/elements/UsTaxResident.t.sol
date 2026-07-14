// SPDX-License-Identifier: GPL-3.0
pragma solidity 0.8.17;

import {Test} from "forge-std/Test.sol";
import {UsTaxResident} from "../../../../src/compliance/elements/UsTaxResident.sol";
import {Errors} from "../../../../src/libraries/Errors.sol";
import {
    ElementMetadata,
    ElementCategory,
    TemporalNature,
    Decidability,
    ObligationTiming,
    Statefulness
} from "../../../../src/types/ComplianceTypes.sol";

contract UsTaxResidentTest is Test {
    // Mirrors UsTaxResident.UsTaxResidentSet's signature for vm.expectEmit matching
    // (solc 0.8.17 does not support qualified `ContractName.EventName` emit syntax).
    event UsTaxResidentSet(address indexed investor, bool isResident);

    address internal user = address(0xA11CE);
    address internal asset = address(0xBEEF);
    address internal operator = address(0x0F);
    address internal stranger = address(0x5A17E5);

    function test_metadata_fields() public {
        UsTaxResident e = new UsTaxResident();
        ElementMetadata memory m = e.elementMetadata();
        assertEq(m.elementId, bytes32("A-05-v1"));
        assertEq(uint256(m.category), uint256(ElementCategory.INVESTOR_ATTRIBUTE));
        assertEq(uint256(m.decidability), uint256(Decidability.DETERMINISTIC));
        assertEq(uint256(m.statefulness), uint256(Statefulness.STATELESS));
    }

    function test_defaultUnflagged_passes() public {
        UsTaxResident e = new UsTaxResident();
        // No attestation set at all — default-pass shape (mirrors Sanctions' default-pass).
        (bool passed, bytes32 rc) = e.check(user, address(0), asset, 0, "");
        assertTrue(passed);
        assertEq(rc, bytes32(0));
    }

    function test_setUsTaxResident_nonOperator_reverts() public {
        UsTaxResident e = new UsTaxResident();
        vm.prank(stranger);
        vm.expectRevert(Errors.NotAuthorized.selector);
        e.setUsTaxResident(user, true);
    }

    function test_setUsTaxResident_owner_succeeds_andEmits() public {
        UsTaxResident e = new UsTaxResident();
        vm.expectEmit(true, false, false, true);
        emit UsTaxResidentSet(user, true);
        e.setUsTaxResident(user, true);
        assertTrue(e.usTaxResident(user));
    }

    function test_setUsTaxResident_operator_succeeds() public {
        UsTaxResident e = new UsTaxResident();
        e.setOperator(operator, true);

        vm.prank(operator);
        e.setUsTaxResident(user, true);
        assertTrue(e.usTaxResident(user));
    }

    function test_check_flaggedResident_fails() public {
        UsTaxResident e = new UsTaxResident();
        e.setUsTaxResident(user, true);

        (bool passed, bytes32 rc) = e.check(user, address(0), asset, 0, "");
        assertFalse(passed);
        assertTrue(rc != bytes32(0));
    }

    function test_check_flagThenUnflag_passesAgain() public {
        UsTaxResident e = new UsTaxResident();

        e.setUsTaxResident(user, true);
        (bool passed,) = e.check(user, address(0), asset, 0, "");
        assertFalse(passed);

        e.setUsTaxResident(user, false);
        (passed,) = e.check(user, address(0), asset, 0, "");
        assertTrue(passed);
    }
}
