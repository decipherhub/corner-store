// SPDX-License-Identifier: GPL-3.0
pragma solidity 0.8.17;

import {Test} from "forge-std/Test.sol";

import {CornerStoreFactory} from "../../../src/factory/CornerStoreFactory.sol";
import {UniswapV3VenueFactory} from "../../../src/factory/UniswapV3VenueFactory.sol";
import {TokenPolicyRegistry} from "../../../src/registry/TokenPolicyRegistry.sol";
import {VenueRegistry} from "../../../src/execution/VenueRegistry.sol";
import {ITokenPolicyRegistry} from "../../../src/interfaces/compliance/ITokenPolicyRegistry.sol";
import {IVenueRegistry} from "../../../src/interfaces/execution/IVenueRegistry.sol";
import {ManifestCore, PolicyStatus, VenueType} from "../../../src/types/ComplianceTypes.sol";
import {VenueConfig, CustodyModel} from "../../../src/types/VenueTypes.sol";

contract FactoryTest is Test {
    CornerStoreFactory internal factory;
    TokenPolicyRegistry internal tpr;
    VenueRegistry internal vr;

    address internal rwa = address(0x4001);
    address internal venue = address(0x4E51E);
    address internal adapter = address(0xADA9);

    function setUp() public {
        tpr = new TokenPolicyRegistry();
        vr = new VenueRegistry();
        factory = new CornerStoreFactory(ITokenPolicyRegistry(address(tpr)), IVenueRegistry(address(vr)));

        // factory must own both registries to write to them
        tpr.setOperator(address(this), true);
        tpr.transferOwnership(address(factory));
        vr.transferOwnership(address(factory));
    }

    function _manifest() internal view returns (ManifestCore memory m) {
        m.status = PolicyStatus.ACTIVE;
        m.issuanceRecipeId = 506;
        m.issuanceRecipeVersion = 1;
        m.declaredBy = address(this);
    }

    function _venueCfg() internal view returns (VenueConfig memory c) {
        c.venueType = VenueType.AMM;
        c.adapter = adapter;
        c.target = venue;
        c.custody = CustodyModel.POOL;
        c.active = true;
    }

    function test_registerRWAToken_registersManifest() public {
        factory.registerRWAToken(rwa, _manifest(), venue, _venueCfg());

        ManifestCore memory stored = tpr.manifestOf(rwa);
        assertEq(uint8(stored.status), uint8(PolicyStatus.ACTIVE));
        assertEq(stored.issuanceRecipeId, 506);
        // registerManifest records the caller (the factory) as declaredBy.
        assertEq(stored.declaredBy, address(factory));
    }

    function test_registerRWAToken_registersVenue() public {
        factory.registerRWAToken(rwa, _manifest(), venue, _venueCfg());

        VenueConfig memory stored = vr.venueOf(venue);
        assertEq(uint8(stored.venueType), uint8(VenueType.AMM));
        assertEq(stored.adapter, adapter);
        assertTrue(stored.active);
        assertEq(uint8(stored.custody), uint8(CustodyModel.POOL));
    }

    function test_registerRWAToken_onlyOperator() public {
        vm.prank(address(0xBEEF));
        vm.expectRevert();
        factory.registerRWAToken(rwa, _manifest(), venue, _venueCfg());
    }

    function test_scheduleManifestResume_forwardsRegistryOwnerCall() public {
        factory.registerRWAToken(rwa, _manifest(), venue, _venueCfg());
        tpr.suspendManifest(rwa, bytes32("SUSPENDED"));

        factory.scheduleManifestResume(rwa, bytes32("RECOVERED"));

        (uint64 effectiveTime, bytes32 reasonCode) = tpr.pendingManifestResumeOf(rwa);
        assertEq(effectiveTime, block.timestamp + tpr.MIN_MANIFEST_DELAY());
        assertEq(reasonCode, bytes32("RECOVERED"));
    }

    function test_scheduleManifestResume_onlyFactoryOwner() public {
        factory.registerRWAToken(rwa, _manifest(), venue, _venueCfg());
        tpr.suspendManifest(rwa, bytes32("SUSPENDED"));

        vm.prank(address(0xBEEF));
        vm.expectRevert("Ownable: caller is not the owner");
        factory.scheduleManifestResume(rwa, bytes32("RECOVERED"));
    }

    function test_scheduleManifestUpdate_forwardsRegistryOwnerCall() public {
        ManifestCore memory initial = _manifest();
        initial.fullManifestHash = keccak256("manifest-v1");
        factory.registerRWAToken(rwa, initial, venue, _venueCfg());

        ManifestCore memory next = initial;
        next.fullManifestHash = keccak256("manifest-v2");
        factory.scheduleManifestUpdate(rwa, next, bytes32("LEGAL-UPDATE"));

        (ManifestCore memory pending, uint64 effectiveTime, bytes32 reasonCode) = tpr.pendingManifestUpdateOf(rwa);
        assertEq(pending.fullManifestHash, next.fullManifestHash);
        assertEq(effectiveTime, block.timestamp + tpr.MIN_MANIFEST_DELAY());
        assertEq(reasonCode, bytes32("LEGAL-UPDATE"));
    }

    function test_cancelManifestActions_forwardsRegistryOwnerCalls() public {
        ManifestCore memory initial = _manifest();
        initial.fullManifestHash = keccak256("manifest-v1");
        factory.registerRWAToken(rwa, initial, venue, _venueCfg());
        tpr.suspendManifest(rwa, bytes32("SUSPENDED"));

        factory.scheduleManifestResume(rwa, bytes32("RECOVERED"));
        factory.cancelManifestResume(rwa);
        (uint64 resumeTime,) = tpr.pendingManifestResumeOf(rwa);
        assertEq(resumeTime, 0);

        ManifestCore memory next = initial;
        next.fullManifestHash = keccak256("manifest-v2");
        factory.scheduleManifestUpdate(rwa, next, bytes32("LEGAL-UPDATE"));
        factory.cancelManifestUpdate(rwa);
        (, uint64 updateTime,) = tpr.pendingManifestUpdateOf(rwa);
        assertEq(updateTime, 0);
    }

    function test_computePoolAddress_isDeterministic() public view {
        address a = factory.computePoolAddress(address(0x1), address(0x2), 3000);
        address b = factory.computePoolAddress(address(0x1), address(0x2), 3000);
        assertEq(a, b, "same inputs => same address");
    }

    function test_computePoolAddress_tokenOrderInvariant() public view {
        // sorting means (A,B) and (B,A) give the same pool
        address a = factory.computePoolAddress(address(0x1), address(0x2), 3000);
        address b = factory.computePoolAddress(address(0x2), address(0x1), 3000);
        assertEq(a, b, "token order invariant");
    }

    function test_computePoolAddress_feeSensitive() public view {
        address a = factory.computePoolAddress(address(0x1), address(0x2), 3000);
        address b = factory.computePoolAddress(address(0x1), address(0x2), 500);
        assertTrue(a != b, "different fee => different address");
    }

    function test_venueFactory_stubReverts() public {
        UniswapV3VenueFactory vf = new UniswapV3VenueFactory();
        vm.expectRevert(bytes("UniswapV3VenueFactory: not implemented (stub)"));
        vf.createAndRegisterPool(rwa, address(0xCA54), 3000);
    }
}
