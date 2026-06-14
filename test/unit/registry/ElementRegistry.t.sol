// SPDX-License-Identifier: GPL-3.0
pragma solidity 0.8.17;

import {Test} from "forge-std/Test.sol";
import {ElementRegistry} from "../../../src/registry/ElementRegistry.sol";
import {IComplianceElement} from "../../../src/interfaces/compliance/IComplianceElement.sol";
import {
    ElementMetadata,
    ElementCategory,
    TemporalNature,
    Decidability,
    ObligationTiming,
    Statefulness
} from "../../../src/types/ComplianceTypes.sol";
import {Errors} from "../../../src/libraries/Errors.sol";
import {Events} from "../../../src/libraries/Events.sol";

contract MockElement is IComplianceElement {
    bytes32 internal immutable id;

    constructor(bytes32 id_) {
        id = id_;
    }

    function check(address, address, address, uint256, bytes calldata) external pure returns (bool, bytes32) {
        return (true, bytes32(0));
    }

    function elementMetadata() external view returns (ElementMetadata memory m) {
        m.elementId = id;
        m.category = ElementCategory.INVESTOR_ATTRIBUTE;
        m.version = "1.0.0";
        m.temporal = TemporalNature.ONE_TIME;
        m.decidability = Decidability.DETERMINISTIC;
        m.timing = ObligationTiming.AT_TRADE_GATE;
        m.statefulness = Statefulness.STATELESS;
    }
}

contract ElementRegistryTest is Test {
    ElementRegistry internal reg;
    MockElement internal element;

    bytes32 internal constant ELEMENT_ID = bytes32("KYC");
    address internal stranger = address(0xDEAD);

    function setUp() public {
        reg = new ElementRegistry();
        element = new MockElement(ELEMENT_ID);
    }

    function test_register_and_read() public {
        vm.expectEmit(true, false, false, true);
        emit Events.ElementRegistered(ELEMENT_ID, address(element));
        reg.registerElement(ELEMENT_ID, address(element));
        assertEq(reg.elementOf(ELEMENT_ID), address(element));
    }

    function test_unregistered_returns_zero() public {
        assertEq(reg.elementOf(bytes32("NOPE")), address(0));
    }

    function test_registerElement_reverts_for_non_owner() public {
        vm.prank(stranger);
        vm.expectRevert();
        reg.registerElement(ELEMENT_ID, address(element));
    }

    function test_metadataOf_delegates() public {
        reg.registerElement(ELEMENT_ID, address(element));
        ElementMetadata memory m = reg.metadataOf(ELEMENT_ID);
        assertEq(m.elementId, ELEMENT_ID);
        assertEq(uint256(m.category), uint256(ElementCategory.INVESTOR_ATTRIBUTE));
        assertEq(m.version, "1.0.0");
        assertEq(uint256(m.statefulness), uint256(Statefulness.STATELESS));
    }

    function test_metadataOf_reverts_when_unregistered() public {
        vm.expectRevert(abi.encodeWithSelector(Errors.ElementNotRegistered.selector, bytes32("NOPE")));
        reg.metadataOf(bytes32("NOPE"));
    }
}
