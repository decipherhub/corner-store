// SPDX-License-Identifier: GPL-3.0
pragma solidity 0.8.17;

import {IntegrationBase} from "./IntegrationBase.sol";
import {RFQAdapterV3} from "../../src/execution/adapters/rfq/RFQAdapterV3.sol";
import {RFQQuoteV3} from "../../src/execution/adapters/rfq/RFQV3Types.sol";
import {ExecutionRouterV2} from "../../src/execution/ExecutionRouterV2.sol";
import {ContextEvidence} from "../../src/execution/ContextEvidence.sol";
import {MakerAuthorizer} from "../../src/registry/MakerAuthorizer.sol";
import {Affiliate} from "../../src/compliance/elements/Affiliate.sol";
import {ExecutionRequest} from "../../src/types/ExecutionTypes.sol";
import {
    ManifestCore,
    ManifestPolicyConfig,
    ElementPolicyParameter,
    ElementEnforcementOverride,
    VenueType,
    FlowType
} from "../../src/types/ComplianceTypes.sol";
import {VenueConfig, VenueContextEvidence, CustodyModel} from "../../src/types/VenueTypes.sol";
import {Errors} from "../../src/libraries/Errors.sol";

contract ContextProvenanceTest is IntegrationBase {
    uint256 internal constant MAKER_PK = 0xD311;
    address internal constant VENUE = address(0xF00D);
    address internal constant ISSUER = address(0x155);
    address internal maker;
    RFQAdapterV3 internal rfq;
    ExecutionRouterV2 internal routerV2;
    Affiliate internal affiliate;

    function setUp() public {
        maker = vm.addr(MAKER_PK);
        ManifestCore memory m = _activeManifest(0, 0);
        m.supportedEngines = uint8(1 << uint256(VenueType.RFQ));
        ManifestPolicyConfig memory config;
        config.schemaVersion = 1;
        config.elementParameters = new ElementPolicyParameter[](1);
        config.elementParameters[0] = ElementPolicyParameter(
            0, "C-01-v2", keccak256("corner-store.element.lockup.primary-distributor.v1"), 1, abi.encode(maker)
        );
        deployStackWithManifestAndConfig("Context RWA", "ctxRWA", m, _regDBindings(0), config);
        routerV2 = new ExecutionRouterV2(engine, venueReg, selector, operatorReg);
        engine.setRouter(address(routerV2));
        affiliate = new Affiliate();
        affiliate.setTrustedClaimIssuer(ISSUER, true);
        _claim(maker, Affiliate.AffiliateBasis.NOT_AFFILIATE);
        _claim(alice, Affiliate.AffiliateBasis.NOT_AFFILIATE);
        rfq = new RFQAdapterV3(new MakerAuthorizer(), venueReg, policyReg, address(affiliate));
        rfq.setRouter(address(routerV2));
        rfq.setMakerApproved(maker, true);
        VenueConfig memory cfg =
            VenueConfig(VenueType.RFQ, address(rfq), address(0), address(0), CustodyModel.NONE, true);
        venueReg.registerVenue(VENUE, cfg);
        venueReg.setContextImplementation(address(rfq).codehash, 3, 1, true);
        venueReg.setVenueContextEvidence(
            VENUE,
            VenueContextEvidence(
                3,
                1,
                address(rfq).codehash,
                address(affiliate),
                address(affiliate).codehash,
                address(policyReg),
                address(policyReg).codehash,
                ContextEvidence.configurationHash(cfg)
            )
        );
        setupBuyer(alice);
        verifyInvestor(maker);
        acqSource.setAcquiredAt(maker, address(rwaToken), 1);
        quote.mint(alice, 1000 ether);
        quote.mint(maker, 1000 ether);
        mint(maker, 1000 ether);
        mint(alice, 1000 ether);
        vm.startPrank(alice);
        quote.approve(address(rfq), type(uint256).max);
        rwaToken.approve(address(rfq), type(uint256).max);
        vm.stopPrank();
        vm.startPrank(maker);
        quote.approve(address(rfq), type(uint256).max);
        rwaToken.approve(address(rfq), type(uint256).max);
        vm.stopPrank();
    }

    function _claim(address sender, Affiliate.AffiliateBasis basis) internal {
        affiliate.setClaim(
            sender,
            address(rwaToken),
            basis,
            Affiliate.DeterminationSource.ISSUER_REGISTRY,
            ISSUER,
            uint64(block.timestamp),
            0
        );
    }

    function _request(bool sell, bool primary) internal view returns (ExecutionRequest memory req) {
        req.context.initiator = alice;
        req.context.buyer = alice;
        req.context.seller = maker;
        req.context.tokenIn = sell ? address(rwaToken) : address(quote);
        req.context.tokenOut = sell ? address(quote) : address(rwaToken);
        req.context.amountIn = 100 ether;
        req.context.amountOut = 100 ether;
        req.context.venue = VENUE;
        req.context.venueType = VenueType.RFQ;
        req.context.flowType = primary ? FlowType.PRIMARY_DISTRIBUTION : FlowType.SECONDARY_TRADE;
        req.deadline = uint64(block.timestamp + 1 hours);
        req.nonce = 1;
        RFQQuoteV3 memory q = RFQQuoteV3(
            maker,
            alice,
            req.context.tokenIn,
            req.context.tokenOut,
            req.context.amountIn,
            req.context.amountOut,
            VENUE,
            engine.evaluate(req.context).policyId,
            uint8(req.context.flowType),
            ContextEvidence.affiliateEvidenceHash(req.context, policyReg, address(affiliate)),
            7,
            req.deadline
        );
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(MAKER_PK, rfq.hashQuote(q));
        req.venueData = abi.encode(q, abi.encodePacked(r, s, v));
    }

    function _execute(ExecutionRequest memory req) internal {
        vm.prank(alice);
        routerV2.execute(req);
    }

    function _rollback() internal view {
        assertEq(quote.balanceOf(alice), 1000 ether);
        assertEq(quote.balanceOf(maker), 1000 ether);
        assertEq(rwaToken.balanceOf(alice), 1000 ether);
        assertEq(rwaToken.balanceOf(maker), 1000 ether);
        assertFalse(routerV2.usedNonce(alice, 1));
        assertFalse(rfq.usedQuoteNonce(maker, 7));
    }

    function test_v3BuyRealERC3643() public {
        _execute(_request(false, false));
        assertEq(quote.balanceOf(alice), 900 ether);
        assertEq(rwaToken.balanceOf(alice), 1100 ether);
        assertEq(rwaToken.balanceOf(address(rfq)), 0);
        assertTrue(rfq.usedQuoteNonce(maker, 7));
    }

    function test_v3SellRealERC3643() public {
        _execute(_request(true, false));
        assertEq(rwaToken.balanceOf(alice), 900 ether);
        assertEq(quote.balanceOf(alice), 1100 ether);
        assertEq(quote.balanceOf(address(rfq)), 0);
    }

    function test_primaryUsesActiveCompiledManifestAuthority() public {
        acqSource.setAcquiredAt(maker, address(rwaToken), uint64(block.timestamp));
        _execute(_request(false, true));
        assertEq(rwaToken.balanceOf(alice), 1100 ether);
    }

    function test_primaryCannotUsePendingAuthority() public {
        ExecutionRequest memory req = _request(false, true);
        ManifestCore memory m = policyReg.manifestOf(address(rwaToken));
        m.fullManifestHash = keccak256("replacement-primary-authority");
        ManifestPolicyConfig memory config;
        config.schemaVersion = 1;
        config.elementParameters = new ElementPolicyParameter[](1);
        config.elementParameters[0] =
            ElementPolicyParameter(0, "C-01-v2", lockup.PARAMETER_SCHEMA_ID(), 1, abi.encode(address(0xBAD)));
        // The pending distributor has no authority until the Manifest activates.
        policyReg.scheduleManifestUpdate(
            address(rwaToken), m, _regDBindings(0), new ElementEnforcementOverride[](0), config, bytes32("authority")
        );
        rfq.validateContext(req, venueReg.venueOf(VENUE));
        (,, uint64 readyAt,) = policyReg.pendingManifestUpdateOf(address(rwaToken));
        vm.warp(readyAt);
        policyReg.activateManifestUpdate(address(rwaToken));
        req.deadline = uint64(block.timestamp + 1 hours);
        (RFQQuoteV3 memory q,) = abi.decode(req.venueData, (RFQQuoteV3, bytes));
        q.expiry = req.deadline;
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(MAKER_PK, rfq.hashQuote(q));
        req.venueData = abi.encode(q, abi.encodePacked(r, s, v));
        vm.expectRevert(Errors.InvalidExecutionContext.selector);
        _execute(req);
        _rollback();
    }

    function test_authenticationPrecedesRealEngineEvaluation() public {
        ExecutionRequest memory req = _request(false, false);
        jurisdiction.setJurisdiction(alice, bytes32("ZZ"));
        req.context.flowType = FlowType.PRIMARY_DISTRIBUTION;
        vm.expectRevert(Errors.RFQQuoteMismatch.selector);
        _execute(req);
        _rollback();
    }

    function test_policyRejectionRollsBack() public {
        ExecutionRequest memory req = _request(false, false);
        jurisdiction.setJurisdiction(alice, bytes32("ZZ"));
        vm.expectPartialRevert(Errors.ComplianceRejected.selector);
        _execute(req);
        _rollback();
    }

    function test_ERC3643FreezeRejectsBeforeSettlementAndRetries() public {
        ExecutionRequest memory req = _request(false, false);
        rwaToken.setAddressFrozen(alice, true);
        vm.expectRevert();
        _execute(req);
        _rollback();
        rwaToken.setAddressFrozen(alice, false);
        _execute(req);
    }

    function test_ERC3643AllowanceFailureRollsBackBothLegsAndNonces() public {
        ExecutionRequest memory req = _request(false, false);
        vm.prank(maker);
        rwaToken.approve(address(rfq), 0);
        vm.expectCall(
            address(quote), abi.encodeWithSignature("transferFrom(address,address,uint256)", alice, maker, 100 ether)
        );
        vm.expectCall(
            address(rwaToken), abi.encodeWithSignature("transferFrom(address,address,uint256)", maker, alice, 100 ether)
        );
        vm.expectRevert(abi.encodeWithSignature("Panic(uint256)", uint256(0x11)));
        _execute(req);
        _rollback();
        vm.prank(maker);
        rwaToken.approve(address(rfq), type(uint256).max);
        _execute(req);
    }

    function test_affiliateEvidenceRefreshRejectsBeforeSettlement() public {
        ExecutionRequest memory req = _request(false, false);
        vm.warp(block.timestamp + 1);
        _claim(maker, Affiliate.AffiliateBasis.NOT_AFFILIATE);
        vm.expectRevert(Errors.RFQQuoteMismatch.selector);
        _execute(req);
        _rollback();
    }
}
