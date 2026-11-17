// SPDX-License-Identifier: GPL-3.0
pragma solidity 0.8.17;

import {Test} from "forge-std/Test.sol";
import {EngineSelection} from "../../../../src/compliance/elements/EngineSelection.sol";
import {EngineSelectionV2} from "../../../../src/compliance/elements/EngineSelectionV2.sol";
import {AssetFlow} from "../../../../src/compliance/libraries/AssetFlow.sol";
import {ComplianceContext, VenueType} from "../../../../src/types/ComplianceTypes.sol";
import {ReasonCodes} from "../../../../src/libraries/ReasonCodes.sol";

contract EngineSelectionV2Test is Test {
    EngineSelectionV2 internal element;
    address internal constant ASSET = address(0xA55E7);
    address internal constant BUYER = address(0xB0B);
    address internal constant SELLER = address(0x5E11);

    function setUp() public {
        element = new EngineSelectionV2();
        element.setSupportedEngines(ASSET, 7);
    }

    function _context(bool sell) internal pure returns (ComplianceContext memory ctx) {
        ctx.buyer = BUYER;
        ctx.seller = SELLER;
        ctx.tokenIn = sell ? ASSET : address(0xCA5);
        ctx.tokenOut = sell ? address(0xCA5) : ASSET;
        ctx.venueType = VenueType.RFQ;
        ctx.sellerIsAffiliate = true;
    }

    function _check(ComplianceContext memory ctx) internal view returns (bool passed, bytes32 reason) {
        return element.check(BUYER, SELLER, ASSET, 1, abi.encode(ctx), "");
    }

    function test_versionAndReasonUseNewElementId() public {
        assertEq(element.elementMetadata().elementId, bytes32("B-04-v2"));
        assertEq(element.elementMetadata().version, "B-04-v2");
        (bool passed, bytes32 reason) = _check(_context(true));
        assertFalse(passed);
        assertEq(reason, ReasonCodes.encode(0, "B-04-v2", 7));
    }

    function test_assetOutsideBothLegsFailsClosed() public {
        ComplianceContext memory ctx = _context(true);
        ctx.tokenIn = address(0xBAD);
        element.setMarketMakerClaim(SELLER, true);
        vm.expectRevert(abi.encodeWithSelector(AssetFlow.AssetNotInContext.selector, ASSET));
        element.check(BUYER, SELLER, ASSET, 1, abi.encode(ctx), "");
    }

    function test_shortContextFailsClosed() public {
        (bool passed, bytes32 reason) = element.check(BUYER, SELLER, ASSET, 1, "", "");
        assertFalse(passed);
        assertEq(reason, ReasonCodes.encode(0, "B-04-v2", 3));
    }

    function test_debtSecurityRetainsClaimExemption() public {
        element.setDebtSecurity(ASSET, true);
        (bool passed,) = _check(_context(true));
        assertTrue(passed);
    }

    function test_nonAffiliateRetainsClaimExemption() public {
        ComplianceContext memory ctx = _context(true);
        ctx.sellerIsAffiliate = false;
        (bool passed,) = _check(ctx);
        assertTrue(passed);
    }

    function testFuzz_buyParityWithLegacy(uint8 flags, uint8 venue, uint8 declared, uint8 noGs, uint8 affiliateSet)
        public
    {
        EngineSelection legacy = new EngineSelection();
        element.setSupportedEngines(ASSET, declared);
        legacy.setSupportedEngines(ASSET, declared);
        element.setNoGsEngineSet(noGs);
        legacy.setNoGsEngineSet(noGs);
        element.setAffiliateEngineSet(affiliateSet);
        legacy.setAffiliateEngineSet(affiliateSet);
        element.setSec4a7Path(ASSET, flags & 1 != 0);
        legacy.setSec4a7Path(ASSET, flags & 1 != 0);
        element.setDebtSecurity(ASSET, flags & 2 != 0);
        legacy.setDebtSecurity(ASSET, flags & 2 != 0);
        element.setMarketMakerClaim(BUYER, flags & 4 != 0);
        legacy.setMarketMakerClaim(BUYER, flags & 4 != 0);
        element.setMarketMakerClaim(SELLER, flags & 8 != 0);
        legacy.setMarketMakerClaim(SELLER, flags & 8 != 0);
        ComplianceContext memory ctx = _context(false);
        ctx.venueType = VenueType(venue % 3);
        ctx.sellerIsAffiliate = flags & 16 != 0;
        (bool oldPassed, bytes32 oldReason) = legacy.check(BUYER, SELLER, ASSET, 1, abi.encode(ctx), "");
        (bool newPassed, bytes32 newReason) = _check(ctx);
        assertEq(newPassed, oldPassed);
        if (oldPassed) {
            assertEq(newReason, oldReason);
        } else {
            bool matched;
            for (uint32 n = 1; n <= 7; n++) {
                if (oldReason == ReasonCodes.encode(0, "B-04-v1", n)) {
                    assertEq(newReason, ReasonCodes.encode(0, "B-04-v2", n));
                    matched = true;
                }
            }
            assertTrue(matched);
        }
    }
}
