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
    Statefulness,
    EnforcementAction,
    EvidenceType
} from "../../../src/types/ComplianceTypes.sol";
import {Errors} from "../../../src/libraries/Errors.sol";
import {Events} from "../../../src/libraries/Events.sol";

contract MockElement is IComplianceElement {
    bytes32 internal immutable id;

    constructor(bytes32 id_) {
        id = id_;
    }

    function check(address, address, address, uint256, bytes calldata, bytes calldata)
        external
        pure
        returns (bool, bytes32)
    {
        return (true, bytes32(0));
    }

    function elementMetadata() public view virtual returns (ElementMetadata memory m) {
        m.elementId = id;
        m.category = ElementCategory.INVESTOR_ATTRIBUTE;
        m.version = "1.0.0";
        m.temporal = TemporalNature.ONE_TIME;
        m.decidability = Decidability.DETERMINISTIC;
        m.timing = ObligationTiming.AT_TRADE_GATE;
        m.statefulness = Statefulness.STATELESS;
        m.evidenceType = EvidenceType.TRANSACTION_CONTEXT;
        m.defaultEnforcement = EnforcementAction.BLOCK;
    }
}

contract MockFlagElement is MockElement {
    constructor(bytes32 id_) MockElement(id_) {}

    function elementMetadata() public view override returns (ElementMetadata memory m) {
        m = super.elementMetadata();
        m.defaultEnforcement = EnforcementAction.FLAG_ONLY;
    }
}

contract MockUnspecifiedEvidenceElement is MockElement {
    constructor(bytes32 id_) MockElement(id_) {}

    function elementMetadata() public view override returns (ElementMetadata memory m) {
        m = super.elementMetadata();
        m.evidenceType = EvidenceType.UNSPECIFIED;
    }
}

contract MockCapabilityElement is IComplianceElement {
    bytes32 internal immutable id;
    bytes32 internal immutable schemaId;
    uint16 internal immutable schemaVersion;
    uint32 internal immutable maxBytes;
    bool internal immutable required;

    constructor(bytes32 id_, bytes32 schemaId_, uint16 schemaVersion_, uint32 maxBytes_, bool required_) {
        id = id_;
        schemaId = schemaId_;
        schemaVersion = schemaVersion_;
        maxBytes = maxBytes_;
        required = required_;
    }

    function check(address, address, address, uint256, bytes calldata, bytes calldata)
        external
        pure
        returns (bool, bytes32)
    {
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
        m.evidenceType = EvidenceType.TRANSACTION_CONTEXT;
        m.defaultEnforcement = EnforcementAction.BLOCK;
        m.parameterSchemaId = schemaId;
        m.parameterSchemaVersion = schemaVersion;
        m.maxParameterBytes = maxBytes;
        m.parametersRequired = required;
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
        assertEq(uint256(m.evidenceType), uint256(EvidenceType.TRANSACTION_CONTEXT));
        assertEq(uint256(m.defaultEnforcement), uint256(EnforcementAction.BLOCK));
        assertEq(m.parameterSchemaId, bytes32(0));
        assertEq(m.parameterSchemaVersion, 0);
        assertEq(m.maxParameterBytes, 0);
        assertFalse(m.parametersRequired);
    }

    function test_registerElement_is_immutable_and_stores_default_action() public {
        reg.registerElement(ELEMENT_ID, address(element));
        assertEq(uint256(reg.defaultActionOf(ELEMENT_ID)), uint256(EnforcementAction.BLOCK));
        assertEq(reg.versionHashOf(ELEMENT_ID), keccak256(bytes("1.0.0")));
        assertTrue(reg.metadataHashOf(ELEMENT_ID) != bytes32(0));

        MockElement replacement = new MockElement(ELEMENT_ID);
        vm.expectRevert(abi.encodeWithSelector(Errors.ElementAlreadyRegistered.selector, ELEMENT_ID));
        reg.registerElement(ELEMENT_ID, address(replacement));
    }

    function test_registration_uses_metadataDefault_and_rejectsCallerMismatch() public {
        MockFlagElement flag = new MockFlagElement(ELEMENT_ID);
        reg.registerElement(ELEMENT_ID, address(flag));
        assertEq(uint256(reg.defaultActionOf(ELEMENT_ID)), uint256(EnforcementAction.FLAG_ONLY));

        bytes32 otherId = bytes32("OTHER");
        MockFlagElement other = new MockFlagElement(otherId);
        vm.expectRevert(abi.encodeWithSelector(Errors.InvalidElementMetadata.selector, otherId));
        reg.registerElement(otherId, address(other), EnforcementAction.BLOCK);
    }

    function test_registration_rejects_unspecifiedEvidenceType() public {
        MockUnspecifiedEvidenceElement unspecified = new MockUnspecifiedEvidenceElement(ELEMENT_ID);
        vm.expectRevert(abi.encodeWithSelector(Errors.InvalidElementMetadata.selector, ELEMENT_ID));
        reg.registerElement(ELEMENT_ID, address(unspecified));
    }

    function test_registerElement_rejects_metadata_id_mismatch_and_no_code() public {
        MockElement mismatch = new MockElement(bytes32("OTHER"));
        vm.expectRevert(abi.encodeWithSelector(Errors.InvalidElementMetadata.selector, ELEMENT_ID));
        reg.registerElement(ELEMENT_ID, address(mismatch));

        vm.expectRevert(abi.encodeWithSelector(Errors.InvalidElementMetadata.selector, ELEMENT_ID));
        reg.registerElement(ELEMENT_ID, address(0xC0FFEE));
    }

    function test_metadataOf_reverts_when_unregistered() public {
        vm.expectRevert(abi.encodeWithSelector(Errors.ElementNotRegistered.selector, bytes32("NOPE")));
        reg.metadataOf(bytes32("NOPE"));
    }

    function test_registerElement_accepts_bounded_parameter_schema_and_binds_metadata_hash() public {
        bytes32 schemaId = keccak256("corner-store.test.schema");
        MockCapabilityElement capable = new MockCapabilityElement(ELEMENT_ID, schemaId, 2, 128, true);

        reg.registerElement(ELEMENT_ID, address(capable));

        ElementMetadata memory m = reg.metadataOf(ELEMENT_ID);
        assertEq(m.parameterSchemaId, schemaId);
        assertEq(m.parameterSchemaVersion, 2);
        assertEq(m.maxParameterBytes, 128);
        assertTrue(m.parametersRequired);
        assertEq(
            reg.metadataHashOf(ELEMENT_ID),
            keccak256(
                abi.encode(
                    m.elementId,
                    m.category,
                    keccak256(bytes(m.version)),
                    m.temporal,
                    m.decidability,
                    m.timing,
                    m.statefulness,
                    m.evidenceType,
                    m.defaultEnforcement,
                    m.parameterSchemaId,
                    m.parameterSchemaVersion,
                    m.maxParameterBytes,
                    m.parametersRequired
                )
            )
        );
    }

    function test_registerElement_rejects_incoherent_parameter_capabilities() public {
        bytes32 schemaId = keccak256("corner-store.test.schema");

        _expectInvalid(new MockCapabilityElement(ELEMENT_ID, bytes32(0), 1, 0, false));
        _expectInvalid(new MockCapabilityElement(ELEMENT_ID, bytes32(0), 0, 1, false));
        _expectInvalid(new MockCapabilityElement(ELEMENT_ID, bytes32(0), 0, 0, true));
        _expectInvalid(new MockCapabilityElement(ELEMENT_ID, schemaId, 0, 1, false));
        _expectInvalid(new MockCapabilityElement(ELEMENT_ID, schemaId, 1, 0, false));
        _expectInvalid(new MockCapabilityElement(ELEMENT_ID, schemaId, 1, reg.MAX_ELEMENT_PARAMETER_BYTES() + 1, false));
    }

    function _expectInvalid(IComplianceElement invalidElement) internal {
        vm.expectRevert(abi.encodeWithSelector(Errors.InvalidElementMetadata.selector, ELEMENT_ID));
        reg.registerElement(ELEMENT_ID, address(invalidElement));
    }
}
