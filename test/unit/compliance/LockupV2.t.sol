// SPDX-License-Identifier: GPL-3.0
pragma solidity 0.8.17;

import {Test} from "forge-std/Test.sol";
import {LockupV2} from "../../../src/compliance/elements/LockupV2.sol";
import {AttestedAcquisitionSource} from "../../../src/registry/AttestedAcquisitionSource.sol";
import {IAcquisitionSource} from "../../../src/interfaces/compliance/IAcquisitionSource.sol";
import {ComplianceContext, ElementMetadata, VenueType, FlowType} from "../../../src/types/ComplianceTypes.sol";
import {ReasonCodes} from "../../../src/libraries/ReasonCodes.sol";

contract LockupV2Test is Test {
    AttestedAcquisitionSource internal source;
    LockupV2 internal lockup;

    address internal buyer = address(0xA11CE);
    address internal seller = address(0xB0B);
    address internal rwa = address(0x7000);
    address internal quote = address(0xCA5);
    uint64 internal constant LOCKUP = 100;

    function setUp() public {
        vm.warp(1_000);
        source = new AttestedAcquisitionSource();
        lockup = new LockupV2(address(source), LOCKUP);
    }

    function test_buy_uses_seller_snapshot_and_allows_first_time_buyer() public {
        _setValid(seller);

        (bool passed, bytes32 reasonCode) = lockup.check(buyer, seller, rwa, 10, _context(true), "");

        assertTrue(passed);
        assertEq(reasonCode, bytes32(0));
        assertEq(
            uint256(source.acquisitionOf(buyer, rwa).status), uint256(IAcquisitionSource.AcquisitionStatus.MISSING)
        );
    }

    function test_buy_fails_when_seller_snapshot_is_missing_even_if_buyer_has_one() public {
        _setValid(buyer);

        (bool passed, bytes32 reasonCode) = lockup.check(buyer, seller, rwa, 10, _context(true), "");

        assertFalse(passed);
        assertEq(reasonCode, ReasonCodes.encode(0, bytes32("C-01-v2"), 1));
    }

    function test_sell_uses_investor_snapshot() public {
        _setValid(buyer);

        (bool passed, bytes32 reasonCode) = lockup.check(buyer, seller, rwa, 10, _context(false), "");

        assertTrue(passed);
        assertEq(reasonCode, bytes32(0));
    }

    function test_primary_distribution_bypasses_lockup_for_manifest_bound_distributor() public view {
        (bool passed, bytes32 reasonCode) =
            lockup.check(buyer, seller, rwa, 10, _context(true, FlowType.PRIMARY_DISTRIBUTION), abi.encode(seller));

        assertTrue(passed);
        assertEq(reasonCode, bytes32(0));
    }

    function test_primary_distribution_does_not_bypass_for_unbound_sender() public view {
        (bool passed, bytes32 reasonCode) = lockup.check(
            buyer, seller, rwa, 10, _context(true, FlowType.PRIMARY_DISTRIBUTION), abi.encode(address(0xDEAD))
        );

        assertFalse(passed);
        assertEq(reasonCode, ReasonCodes.encode(0, bytes32("C-01-v2"), 1));
    }

    function test_primary_distribution_marker_alone_does_not_bypass() public view {
        (bool passed, bytes32 reasonCode) =
            lockup.check(buyer, seller, rwa, 10, _context(true, FlowType.PRIMARY_DISTRIBUTION), "");

        assertFalse(passed);
        assertEq(reasonCode, ReasonCodes.encode(0, bytes32("C-01-v2"), 1));
    }

    function test_primary_distribution_does_not_bypass_reverse_rwa_leg() public view {
        (bool passed, bytes32 reasonCode) =
            lockup.check(buyer, seller, rwa, 10, _context(false, FlowType.PRIMARY_DISTRIBUTION), abi.encode(buyer));

        assertFalse(passed);
        assertEq(reasonCode, ReasonCodes.encode(0, bytes32("C-01-v2"), 1));
    }

    function test_invalid_primary_distributor_parameter_fails_closed() public view {
        (bool passed, bytes32 reasonCode) =
            lockup.check(buyer, seller, rwa, 10, _context(true, FlowType.PRIMARY_DISTRIBUTION), hex"01");

        assertFalse(passed);
        assertEq(reasonCode, ReasonCodes.invalidElementParameters(bytes32("C-01-v2")));
    }

    function test_metadata_declares_optional_manifest_parameter() public view {
        ElementMetadata memory metadata = lockup.elementMetadata();
        assertEq(metadata.parameterSchemaId, lockup.PARAMETER_SCHEMA_ID());
        assertEq(metadata.parameterSchemaVersion, 1);
        assertEq(metadata.maxParameterBytes, 32);
        assertFalse(metadata.parametersRequired);
    }

    function _setValid(address holder) internal {
        source.setSnapshot(
            holder,
            rwa,
            800,
            2_000,
            keccak256(abi.encode("test-source", holder)),
            IAcquisitionSource.AcquisitionStatus.VALID
        );
    }

    function _context(bool rwaIsOutput) internal view returns (bytes memory) {
        return _context(rwaIsOutput, FlowType.SECONDARY_TRADE);
    }

    function _context(bool rwaIsOutput, FlowType flowType) internal view returns (bytes memory) {
        ComplianceContext memory ctx;
        ctx.initiator = buyer;
        ctx.buyer = buyer;
        ctx.seller = seller;
        ctx.tokenIn = rwaIsOutput ? quote : rwa;
        ctx.tokenOut = rwaIsOutput ? rwa : quote;
        ctx.amountIn = 10;
        ctx.amountOut = 10;
        ctx.venueType = VenueType.RFQ;
        ctx.venue = address(0x7001);
        ctx.flowType = flowType;
        return abi.encode(ctx);
    }
}
