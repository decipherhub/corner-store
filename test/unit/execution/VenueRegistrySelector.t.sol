// SPDX-License-Identifier: GPL-3.0
pragma solidity 0.8.17;

import {Test} from "forge-std/Test.sol";
import {VenueRegistry} from "../../../src/execution/VenueRegistry.sol";
import {VenueSelector} from "../../../src/execution/VenueSelector.sol";
import {VenueConfig, CustodyModel} from "../../../src/types/VenueTypes.sol";
import {ComplianceDecision, VenueType} from "../../../src/types/ComplianceTypes.sol";
import {Errors} from "../../../src/libraries/Errors.sol";
import {Events} from "../../../src/libraries/Events.sol";

contract VenueRegistrySelectorTest is Test {
    VenueRegistry internal reg;
    VenueSelector internal sel;

    address internal constant VENUE = address(0xCAFE);
    address internal constant ADAPTER = address(0xADA);
    address internal constant ALICE = address(0xA11CE);

    function setUp() public {
        reg = new VenueRegistry();
        sel = new VenueSelector();
    }

    // ----- Registry -----

    function _cfg(address adapter, bool active) internal pure returns (VenueConfig memory) {
        return VenueConfig({
            venueType: VenueType.AMM,
            adapter: adapter,
            target: address(0xBEEF),
            operator: address(0),
            custody: CustodyModel.POOL,
            active: active
        });
    }

    function test_registerAndRead() public {
        vm.expectEmit(true, false, false, true);
        emit Events.VenueRegistered(VENUE, VenueType.AMM, ADAPTER);
        reg.registerVenue(VENUE, _cfg(ADAPTER, true));

        VenueConfig memory got = reg.venueOf(VENUE);
        assertEq(got.adapter, ADAPTER);
        assertTrue(got.active);
        assertEq(uint256(got.venueType), uint256(VenueType.AMM));
    }

    function test_unregisteredReadsZeroConfig() public {
        VenueConfig memory got = reg.venueOf(address(0xDEAD));
        assertEq(got.adapter, address(0));
        assertFalse(got.active);
    }

    function test_registerOnlyOwner() public {
        vm.prank(ALICE);
        vm.expectRevert("Ownable: caller is not the owner");
        reg.registerVenue(VENUE, _cfg(ADAPTER, true));
    }

    // ----- Selector truth table -----

    function _decision(bool allowed, uint256 venueTypes, bytes32 venuesHash)
        internal
        pure
        returns (ComplianceDecision memory d)
    {
        d.allowed = allowed;
        d.allowedVenueTypes = venueTypes;
        d.allowedVenuesHash = venuesHash;
    }

    function _mask(VenueType vt) internal pure returns (uint256) {
        return 1 << uint256(vt);
    }

    function test_selector_notAllowed_false() public {
        ComplianceDecision memory d = _decision(false, _mask(VenueType.AMM), bytes32(0));
        assertFalse(sel.validate(VENUE, VenueType.AMM, d));
    }

    function test_selector_typeMaskHit_anyVenue() public {
        ComplianceDecision memory d = _decision(true, _mask(VenueType.AMM), bytes32(0));
        assertTrue(sel.validate(VENUE, VenueType.AMM, d));
    }

    function test_selector_typeMaskMiss_false() public {
        // mask only permits RFQ, but the venue is AMM
        ComplianceDecision memory d = _decision(true, _mask(VenueType.RFQ), bytes32(0));
        assertFalse(sel.validate(VENUE, VenueType.AMM, d));
    }

    function test_selector_venuesHashExactMatch_true() public {
        bytes32 h = keccak256(abi.encode(VENUE));
        ComplianceDecision memory d = _decision(true, _mask(VenueType.AMM), h);
        assertTrue(sel.validate(VENUE, VenueType.AMM, d));
    }

    function test_selector_venuesHashMismatch_false() public {
        bytes32 h = keccak256(abi.encode(address(0xBEEF)));
        ComplianceDecision memory d = _decision(true, _mask(VenueType.AMM), h);
        assertFalse(sel.validate(VENUE, VenueType.AMM, d));
    }

    function test_selector_multiTypeMask() public {
        uint256 mask = _mask(VenueType.AMM) | _mask(VenueType.RFQ);
        ComplianceDecision memory d = _decision(true, mask, bytes32(0));
        assertTrue(sel.validate(VENUE, VenueType.AMM, d));
        assertTrue(sel.validate(VENUE, VenueType.RFQ, d));
        assertFalse(sel.validate(VENUE, VenueType.ORDER_BOOK, d));
    }
}
