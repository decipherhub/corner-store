// SPDX-License-Identifier: GPL-3.0
pragma solidity 0.8.17;

import {Test} from "forge-std/Test.sol";
import {VenueRegistry} from "../../../src/execution/VenueRegistry.sol";
import {VenueSelector} from "../../../src/execution/VenueSelector.sol";
import {VenueConfig, VenueContextEvidence, CustodyModel} from "../../../src/types/VenueTypes.sol";
import {ComplianceDecision, VenueType} from "../../../src/types/ComplianceTypes.sol";
import {Errors} from "../../../src/libraries/Errors.sol";
import {Events} from "../../../src/libraries/Events.sol";
import {MockContextAdapter} from "../../mocks/MockContextAdapter.sol";
import {ContextEvidence} from "../../../src/execution/ContextEvidence.sol";

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

contract VenueContextRegistryTest is Test {
    VenueRegistry internal reg;
    MockContextAdapter internal adapter;
    VenueConfig internal cfg;
    VenueContextEvidence internal evidence;
    address internal constant VENUE = address(0xCAFE);

    function setUp() public {
        reg = new VenueRegistry();
        adapter = new MockContextAdapter();
        adapter.setRouter(address(this));
        cfg = VenueConfig(VenueType.RFQ, address(adapter), VENUE, address(0), CustodyModel.NONE, true);
        reg.registerVenue(VENUE, cfg);
        reg.setContextImplementation(address(adapter).codehash, 3, 1, true);
        evidence = VenueContextEvidence({
            adapterVersion: 3,
            contextVersion: 1,
            adapterCodeHash: address(adapter).codehash,
            affiliateSource: address(reg),
            affiliateSourceCodeHash: address(reg).codehash,
            policyRegistry: address(reg),
            policyRegistryCodeHash: address(reg).codehash,
            configurationHash: ContextEvidence.configurationHash(cfg)
        });
    }

    function test_evidenceRoundTrip() public {
        reg.setVenueContextEvidence(VENUE, evidence);
        assertEq(abi.encode(reg.contextEvidenceOf(VENUE)), abi.encode(evidence));
    }

    function test_evidenceOnlyOwner() public {
        vm.prank(address(0xBAD));
        vm.expectRevert("Ownable: caller is not the owner");
        reg.setVenueContextEvidence(VENUE, evidence);
    }

    function test_implementationReviewOnlyOwner() public {
        vm.prank(address(0xBAD));
        vm.expectRevert("Ownable: caller is not the owner");
        reg.setContextImplementation(address(adapter).codehash, 3, 1, true);
    }

    function test_reregistrationInvalidatesEvidenceEvenIfConfigUnchanged() public {
        reg.setVenueContextEvidence(VENUE, evidence);
        reg.registerVenue(VENUE, cfg);
        assertEq(reg.contextEvidenceOf(VENUE).adapterCodeHash, bytes32(0));
    }

    function test_changedRegistrationInvalidatesEvidence() public {
        reg.setVenueContextEvidence(VENUE, evidence);
        cfg.target = address(0xBAD);
        reg.registerVenue(VENUE, cfg);
        assertEq(reg.contextEvidenceOf(VENUE).configurationHash, bytes32(0));
    }

    function test_unreviewedNoOpVerifierCannotSelfDeclareSupport() public {
        reg.setContextImplementation(address(adapter).codehash, 3, 1, false);
        vm.expectRevert(Errors.ContextImplementationNotApproved.selector);
        reg.setVenueContextEvidence(VENUE, evidence);
    }

    function test_approvalBindsExactVersions() public {
        evidence.adapterVersion = 4;
        vm.expectRevert(Errors.ContextImplementationNotApproved.selector);
        reg.setVenueContextEvidence(VENUE, evidence);
    }

    function test_unsupportedContextVersionRejectsEvenIfReviewed() public {
        reg.setContextImplementation(address(adapter).codehash, 3, 2, true);
        evidence.contextVersion = 2;
        vm.expectRevert(Errors.InvalidContextEvidence.selector);
        reg.setVenueContextEvidence(VENUE, evidence);
    }

    function test_staleConfigurationCommitmentRejects() public {
        adapter.setConfiguration(bytes32("changed"));
        vm.expectRevert(Errors.InvalidContextEvidence.selector);
        reg.setVenueContextEvidence(VENUE, evidence);
    }

    function test_wrongRuntimeEvidenceRejects() public {
        evidence.affiliateSourceCodeHash = bytes32("wrong");
        vm.expectRevert(Errors.InvalidContextEvidence.selector);
        reg.setVenueContextEvidence(VENUE, evidence);
    }

    function test_missingSourceRejects() public {
        evidence.affiliateSource = address(0);
        vm.expectRevert(Errors.InvalidContextEvidence.selector);
        reg.setVenueContextEvidence(VENUE, evidence);
    }

    function test_inactiveVenueCannotActivateEvidence() public {
        cfg.active = false;
        reg.registerVenue(VENUE, cfg);
        vm.expectRevert(Errors.AdapterNotRegistered.selector);
        reg.setVenueContextEvidence(VENUE, evidence);
    }

    function test_eoaCannotActivateAsVerifier() public {
        cfg.adapter = address(0xBAD);
        reg.registerVenue(VENUE, cfg);
        evidence.adapterCodeHash = cfg.adapter.codehash;
        reg.setContextImplementation(evidence.adapterCodeHash, 3, 1, true);
        vm.expectRevert(Errors.InvalidContextEvidence.selector);
        reg.setVenueContextEvidence(VENUE, evidence);
    }

    function test_fallbackOnlyVerifierRejectsDespiteReview() public {
        FallbackContextVerifier fallbackVerifier = new FallbackContextVerifier();
        cfg.adapter = address(fallbackVerifier);
        reg.registerVenue(VENUE, cfg);
        evidence.adapterCodeHash = address(fallbackVerifier).codehash;
        reg.setContextImplementation(evidence.adapterCodeHash, 3, 1, true);
        vm.expectRevert();
        reg.setVenueContextEvidence(VENUE, evidence);
    }
}

contract FallbackContextVerifier {
    fallback() external {}
}
