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
        assertEq(stored.declaredBy, address(this));
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
