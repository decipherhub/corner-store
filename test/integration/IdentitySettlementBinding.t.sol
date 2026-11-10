// SPDX-License-Identifier: GPL-3.0
pragma solidity 0.8.17;

import {IntegrationBase} from "./IntegrationBase.sol";
import {BaseRecipe} from "../../src/compliance/recipes/BaseRecipe.sol";
import {RegD506cRecipeV4} from "../../src/compliance/recipes/RegD506cRecipeV4.sol";
import {RegD506cRecipeV3} from "../../src/compliance/recipes/RegD506cRecipeV3.sol";
import {IdentityUniquenessV2} from "../../src/compliance/elements/IdentityUniquenessV2.sol";
import {IIdentityEvidenceV2} from "../../src/interfaces/compliance/IIdentityEvidenceV2.sol";
import {Affiliate} from "../../src/compliance/elements/Affiliate.sol";
import {ExecutionRouterV2} from "../../src/execution/ExecutionRouterV2.sol";
import {ExecutionRouterBase} from "../../src/execution/ExecutionRouterBase.sol";
import {ContextEvidence} from "../../src/execution/ContextEvidence.sol";
import {RFQAdapter} from "../../src/execution/adapters/rfq/RFQAdapter.sol";
import {RFQAdapterV3} from "../../src/execution/adapters/rfq/RFQAdapterV3.sol";
import {RFQQuote} from "../../src/execution/adapters/rfq/RFQTypes.sol";
import {RFQQuoteV3} from "../../src/execution/adapters/rfq/RFQV3Types.sol";
import {MakerAuthorizer} from "../../src/registry/MakerAuthorizer.sol";
import {ExecutionRequest} from "../../src/types/ExecutionTypes.sol";
import {
    ManifestCore,
    ManifestPolicyConfig,
    ElementPolicyParameter,
    ElementEnforcementOverride,
    RecipeBinding,
    RecipeBindingMode,
    VenueType
} from "../../src/types/ComplianceTypes.sol";
import {VenueConfig, VenueContextEvidence, CustodyModel} from "../../src/types/VenueTypes.sol";
import {Errors} from "../../src/libraries/Errors.sol";
import {ReasonCodes} from "../../src/libraries/ReasonCodes.sol";

contract IdentitySettlementAmmRecipe is BaseRecipe {
    constructor() BaseRecipe(8, 2, _ids()) {}

    function _ids() private pure returns (bytes32[] memory ids) {
        ids = new bytes32[](8);
        ids[0] = "A-01-v1";
        ids[1] = "A-02-v1";
        ids[2] = "A-03-v1";
        ids[3] = "A-04-v2";
        ids[4] = "A-05-v1";
        ids[5] = "B-01-v1";
        ids[6] = "B-02-v2";
        ids[7] = "E-01-v1";
    }
}

contract IdentitySettlementSurveillanceRecipe is BaseRecipe {
    constructor() BaseRecipe(9, 1, _ids()) {}

    function _ids() private pure returns (bytes32[] memory ids) {
        ids = new bytes32[](1);
        ids[0] = "F-02-v2";
    }
}

contract IdentitySettlementBindingTest is IntegrationBase {
    uint256 internal constant MAKER_PK = 0xD311;
    bytes32 internal constant ISSUER = keccak256("fixture-issuer");
    bytes32 internal constant BASIS = keccak256("fixture-delegation");
    address internal constant VENUE_V2 = address(0xF002);
    address internal constant VENUE_V3 = address(0xF003);
    address internal constant BOB = address(0xB0B);
    uint256 internal constant AMOUNT_IN = 100 ether;
    uint256 internal constant AMOUNT_OUT = 250 ether;

    IdentityUniquenessV2 internal evidence;
    ExecutionRouterV2 internal routerV2;
    RFQAdapter internal rfqV2;
    RFQAdapterV3 internal rfqV3;
    Affiliate internal affiliate;
    address internal maker;

    function setUp() public {
        deployStack();
        evidence = new IdentityUniquenessV2();
        evidence.setTrustedIssuer(ISSUER, BASIS);
        elementReg.registerElement("A-04-v2", address(evidence));
        recipeReg.registerRecipe(1, 4, address(new RegD506cRecipeV4()));
        recipeReg.registerRecipe(8, 2, address(new IdentitySettlementAmmRecipe()));
        recipeReg.registerRecipe(9, 1, address(new IdentitySettlementSurveillanceRecipe()));
        routerV2 = new ExecutionRouterV2(engine, venueReg, selector, operatorReg);
        rfqV2 = new RFQAdapter(new MakerAuthorizer());
        rfqV2.setRouter(address(router));
        maker = vm.addr(MAKER_PK);
        rfqV2.setMakerApproved(maker, true);
        venueReg.registerVenue(
            VENUE_V2, VenueConfig(VenueType.RFQ, address(rfqV2), address(0), address(0), CustodyModel.NONE, true)
        );
        affiliate = new Affiliate();
        affiliate.setTrustedClaimIssuer(address(this), true);
        rfqV3 = new RFQAdapterV3(new MakerAuthorizer(), venueReg, policyReg, address(affiliate));
        rfqV3.setRouter(address(routerV2));
        rfqV3.setMakerApproved(maker, true);
        VenueConfig memory cfg =
            VenueConfig(VenueType.RFQ, address(rfqV3), address(0), address(0), CustodyModel.NONE, true);
        venueReg.registerVenue(VENUE_V3, cfg);
        venueReg.setContextImplementation(address(rfqV3).codehash, 3, 1, true);
        venueReg.setVenueContextEvidence(
            VENUE_V3,
            VenueContextEvidence(
                3,
                1,
                address(rfqV3).codehash,
                address(affiliate),
                address(affiliate).codehash,
                address(policyReg),
                address(policyReg).codehash,
                ContextEvidence.configurationHash(cfg)
            )
        );
        _actor(alice);
        _actor(maker);
        _actor(BOB);
        fundPoolRWA(1000 ether);
        fundPoolQuote(1000 ether);
        pool.setRate(5, 2);
    }

    function _actor(address who) private {
        setupBuyer(who);
        evidence.bindIdentity(who, keccak256(abi.encode("keyed-fixture-identity", who)));
        _accept(who);
        affiliate.setClaim(
            who,
            address(rwaToken),
            Affiliate.AffiliateBasis.NOT_AFFILIATE,
            Affiliate.DeterminationSource.ISSUER_REGISTRY,
            address(this),
            uint64(block.timestamp),
            0
        );
        mint(who, 1000 ether);
        quote.mint(who, 1000 ether);
        vm.startPrank(who);
        quote.approve(address(adapter), type(uint256).max);
        rwaToken.approve(address(adapter), type(uint256).max);
        quote.approve(address(rfqV2), type(uint256).max);
        rwaToken.approve(address(rfqV2), type(uint256).max);
        quote.approve(address(rfqV3), type(uint256).max);
        rwaToken.approve(address(rfqV3), type(uint256).max);
        vm.stopPrank();
    }

    function _accept(address who) private {
        evidence.acceptEvidence(
            who,
            address(rwaToken),
            IIdentityEvidenceV2.Evidence(
                evidence.identityOf(who),
                ISSUER,
                BASIS,
                keccak256(abi.encode("keyed-fixture-evidence", who)),
                uint64(block.timestamp),
                uint64(block.timestamp + 1 days),
                3
            )
        );
    }

    // kind 0: AMM, 2: RFQ v2, 3: RFQ v3.
    function _prepare(uint8 kind, bool sell) private returns (ExecutionRequest memory req) {
        ManifestCore memory m = _activeManifest(0, 0);
        m.supportedEngines = kind == 0 ? ENGINES_AMM : ENGINE_MASK_RFQ;
        RecipeBinding[] memory bindings = new RecipeBinding[](2);
        bindings[0] = kind == 0
            ? RecipeBinding(8, 2, RecipeBindingMode.REQUIRED_BLOCKING, 0, 100)
            : RecipeBinding(1, 4, RecipeBindingMode.REQUIRED_BLOCKING, 0, 100);
        bindings[1] = RecipeBinding(9, 1, RecipeBindingMode.REQUIRED_BLOCKING, 0, 90);
        ManifestPolicyConfig memory config;
        config.schemaVersion = 1;
        config.elementParameters = new ElementPolicyParameter[](1);
        config.elementParameters[0] =
            ElementPolicyParameter(0, "A-04-v2", evidence.PARAMETER_SCHEMA_ID(), 1, abi.encode(uint8(1), uint8(1)));
        policyReg.retireManifest(address(rwaToken), bytes32("identity-v2-opt-in"));
        policyReg.registerManifest(address(rwaToken), m, bindings, new ElementEnforcementOverride[](0), config);
        policyReg.approveManifest(address(rwaToken));
        evidence.setEnforceCounterparty(kind != 0);
        engine.setRouter(address(_router(kind)));
        req.context.initiator = alice;
        req.context.buyer = alice;
        req.context.seller = kind == 0 ? address(pool) : maker;
        req.context.tokenIn = sell ? address(rwaToken) : address(quote);
        req.context.tokenOut = sell ? address(quote) : address(rwaToken);
        req.context.amountIn = AMOUNT_IN;
        req.context.amountOut = AMOUNT_OUT;
        req.context.venue = kind == 0 ? address(pool) : kind == 2 ? VENUE_V2 : VENUE_V3;
        req.context.venueType = kind == 0 ? VenueType.AMM : VenueType.RFQ;
        req.deadline = uint64(block.timestamp + 1 hours);
        req.amountOutMin = AMOUNT_OUT;
        req.nonce = 1;
        bytes32 policyId = engine.evaluate(req.context).policyId;
        if (kind == 0) {
            req.venueData = abi.encode(!sell, uint160(0));
        } else if (kind == 2) {
            RFQQuote memory q = RFQQuote(
                maker,
                alice,
                req.context.tokenIn,
                req.context.tokenOut,
                AMOUNT_IN,
                AMOUNT_OUT,
                VENUE_V2,
                policyId,
                7,
                req.deadline
            );
            (uint8 v, bytes32 r, bytes32 s) = vm.sign(MAKER_PK, rfqV2.hashQuote(q));
            req.venueData = abi.encode(q, abi.encodePacked(r, s, v));
        } else {
            RFQQuoteV3 memory q = RFQQuoteV3(
                maker,
                alice,
                req.context.tokenIn,
                req.context.tokenOut,
                AMOUNT_IN,
                AMOUNT_OUT,
                VENUE_V3,
                policyId,
                0,
                ContextEvidence.affiliateEvidenceHash(req.context, policyReg, address(affiliate)),
                7,
                req.deadline
            );
            (uint8 v, bytes32 r, bytes32 s) = vm.sign(MAKER_PK, rfqV3.hashQuote(q));
            req.venueData = abi.encode(q, abi.encodePacked(r, s, v));
        }
    }

    function _router(uint8 kind) private view returns (ExecutionRouterBase) {
        return kind == 3 ? ExecutionRouterBase(address(routerV2)) : ExecutionRouterBase(address(router));
    }

    function _balances() private view returns (bytes32) {
        address[8] memory actors =
            [alice, maker, BOB, address(pool), address(router), address(routerV2), address(adapter), address(rfqV2)];
        bytes memory values;
        for (uint256 i; i < actors.length; ++i) {
            values = abi.encode(values, quote.balanceOf(actors[i]), rwaToken.balanceOf(actors[i]));
        }
        return keccak256(abi.encode(values, quote.balanceOf(address(rfqV3)), rwaToken.balanceOf(address(rfqV3))));
    }

    function _custody() private view {
        address[5] memory actors =
            [address(router), address(routerV2), address(adapter), address(rfqV2), address(rfqV3)];
        for (uint256 i; i < actors.length; ++i) {
            assertEq(quote.balanceOf(actors[i]), 0, "no cash custody");
            assertEq(rwaToken.balanceOf(actors[i]), 0, "no RWA custody");
        }
    }

    function _success(uint8 kind, bool sell) private {
        ExecutionRequest memory req = _prepare(kind, sell);
        assertTrue(engine.evaluate(req.context).allowed, "screened context permitted");
        assertEq(evidence.walletOf(evidence.identityOf(alice)), req.context.buyer, "screened identity wallet");
        assertEq(evidence.evidenceOf(alice, address(rwaToken)).identityId, evidence.identityOf(alice));
        if (kind != 0) {
            assertEq(evidence.walletOf(evidence.identityOf(maker)), req.context.seller, "screened maker identity");
            assertEq(evidence.evidenceOf(maker, address(rwaToken)).identityId, evidence.identityOf(maker));
        }
        uint256 cashBefore = quote.balanceOf(alice);
        uint256 rwaBefore = rwaToken.balanceOf(alice);
        address counterparty = req.context.seller;
        uint256 cpCashBefore = quote.balanceOf(counterparty);
        uint256 cpRwaBefore = rwaToken.balanceOf(counterparty);
        vm.prank(alice);
        _router(kind).execute(req);
        assertEq(quote.balanceOf(alice), sell ? cashBefore + AMOUNT_OUT : cashBefore - AMOUNT_IN);
        assertEq(rwaToken.balanceOf(alice), sell ? rwaBefore - AMOUNT_IN : rwaBefore + AMOUNT_OUT);
        assertEq(quote.balanceOf(counterparty), sell ? cpCashBefore - AMOUNT_OUT : cpCashBefore + AMOUNT_IN);
        assertEq(rwaToken.balanceOf(counterparty), sell ? cpRwaBefore + AMOUNT_IN : cpRwaBefore - AMOUNT_OUT);
        assertTrue(_router(kind).usedNonce(alice, 1));
        if (kind == 2) assertTrue(rfqV2.usedQuoteNonce(maker, 7));
        if (kind == 3) assertTrue(rfqV3.usedQuoteNonce(maker, 7));
        assertEq(surveillance.transferCount(), 1, "one successful commit");
        _custody();
    }

    function _reject(uint8 kind, ExecutionRequest memory req, address caller, bytes memory reason) private {
        bytes32 beforeBalances = _balances();
        uint256 count = surveillance.transferCount();
        vm.prank(caller);
        vm.expectRevert(reason);
        _router(kind).execute(req);
        assertEq(_balances(), beforeBalances, "all actor and custody balances unchanged");
        assertFalse(_router(kind).usedNonce(caller, req.nonce), "router nonce unchanged");
        assertFalse(rfqV2.usedQuoteNonce(maker, 7), "v2 quote nonce unchanged");
        assertFalse(rfqV3.usedQuoteNonce(maker, 7), "v3 quote nonce unchanged");
        assertEq(surveillance.transferCount(), count, "no surveillance commit");
        _custody();
    }

    function _mismatch(uint8 kind, bool sell, uint8 actor) private {
        ExecutionRequest memory req = _prepare(kind, sell);
        address caller = alice;
        if (actor == 0) req.context.buyer = BOB;
        if (actor == 1) {
            req.context.initiator = BOB;
            caller = BOB;
        }
        if (actor == 2) req.context.seller = BOB;
        _reject(
            kind,
            req,
            caller,
            abi.encodeWithSelector(kind == 0 ? Errors.NotAuthorized.selector : Errors.RFQQuoteMismatch.selector)
        );
    }

    function _revoked(uint8 kind, bool sell, bool counterparty, bool status) private {
        ExecutionRequest memory req = _prepare(kind, sell);
        address who = counterparty ? maker : alice;
        if (status) evidence.setIdentityStatus(evidence.identityOf(who), IdentityUniquenessV2.IdentityStatus.REVOKED);
        else evidence.revokeEvidence(who, address(rwaToken));
        _reject(
            kind,
            req,
            alice,
            abi.encodeWithSelector(Errors.ComplianceRejected.selector, ReasonCodes.encode(0, "A-04-v2", status ? 7 : 2))
        );
        if (status) evidence.setIdentityStatus(evidence.identityOf(who), IdentityUniquenessV2.IdentityStatus.ACTIVE);
        else _accept(who);
        vm.prank(alice);
        _router(kind).execute(req);
        assertEq(surveillance.transferCount(), 1, "same request retries after explicit restoration");
        assertTrue(_router(kind).usedNonce(alice, req.nonce));
        _custody();
    }

    function test_identityPolicyRegistry_fitsEip170() public view {
        assertLe(address(policyReg).code.length, 24576, "registry must deploy under EIP-170");
    }

    function test_regdV4_onlyReplacesIdentityElement_andKeepsV3() public {
        RegD506cRecipeV4 v4 = new RegD506cRecipeV4();
        RegD506cRecipeV3 v3 = new RegD506cRecipeV3();
        assertEq(v4.recipeId(), 1);
        assertEq(v4.version(), 4);
        assertTrue(v4.isApplicable(""));
        bytes32[] memory current = v4.requiredElements();
        bytes32[] memory legacy = v3.requiredElements();
        assertEq(current.length, 9);
        assertEq(legacy[3], bytes32("A-04-v1"));
        for (uint256 i; i < current.length; ++i) {
            assertEq(current[i], i == 3 ? bytes32("A-04-v2") : legacy[i]);
        }
    }

    function test_regdV4_bindingWithoutAcceptedEvidenceFailsClosed() public {
        ExecutionRequest memory req = _prepare(2, false);
        evidence.unbindIdentity(alice);
        evidence.bindIdentity(alice, keccak256("new-keyed-identity"));
        _reject(
            2,
            req,
            alice,
            abi.encodeWithSelector(Errors.ComplianceRejected.selector, ReasonCodes.encode(0, "A-04-v2", 2))
        );
    }

    function test_settlementLegBoundToPermittedIdentity_amm_buy() public {
        _success(0, false);
    }

    function test_settlementLegBoundToPermittedIdentity_amm_buy_mismatchedBuyer() public {
        _mismatch(0, false, 0);
    }

    function test_settlementLegBoundToPermittedIdentity_amm_buy_mismatchedInitiator() public {
        _mismatch(0, false, 1);
    }

    function test_settlementLegBoundToPermittedIdentity_amm_buy_revokedEvidence() public {
        _revoked(0, false, false, false);
    }

    function test_settlementLegBoundToPermittedIdentity_amm_buy_revokedIdentity() public {
        _revoked(0, false, false, true);
    }

    function test_settlementLegBoundToPermittedIdentity_amm_sell() public {
        _success(0, true);
    }

    function test_settlementLegBoundToPermittedIdentity_amm_sell_mismatchedBuyer() public {
        _mismatch(0, true, 0);
    }

    function test_settlementLegBoundToPermittedIdentity_amm_sell_mismatchedInitiator() public {
        _mismatch(0, true, 1);
    }

    function test_settlementLegBoundToPermittedIdentity_amm_sell_revokedEvidence() public {
        _revoked(0, true, false, false);
    }

    function test_settlementLegBoundToPermittedIdentity_amm_sell_revokedIdentity() public {
        _revoked(0, true, false, true);
    }

    function test_settlementLegBoundToPermittedIdentity_rfqV2_buy() public {
        _success(2, false);
    }

    function test_settlementLegBoundToPermittedIdentity_rfqV2_buy_mismatchedBuyer() public {
        _mismatch(2, false, 0);
    }

    function test_settlementLegBoundToPermittedIdentity_rfqV2_buy_mismatchedInitiator() public {
        _mismatch(2, false, 1);
    }

    function test_settlementLegBoundToPermittedIdentity_rfqV2_buy_revokedEvidence() public {
        _revoked(2, false, false, false);
    }

    function test_settlementLegBoundToPermittedIdentity_rfqV2_buy_revokedIdentity() public {
        _revoked(2, false, false, true);
    }

    function test_settlementLegBoundToPermittedIdentity_rfqV2_buy_mismatchedMaker() public {
        _mismatch(2, false, 2);
    }

    function test_settlementLegBoundToPermittedIdentity_rfqV2_buy_revokedMakerEvidence() public {
        _revoked(2, false, true, false);
    }

    function test_settlementLegBoundToPermittedIdentity_rfqV2_buy_revokedMakerIdentity() public {
        _revoked(2, false, true, true);
    }

    function test_settlementLegBoundToPermittedIdentity_rfqV2_sell() public {
        _success(2, true);
    }

    function test_settlementLegBoundToPermittedIdentity_rfqV2_sell_mismatchedBuyer() public {
        _mismatch(2, true, 0);
    }

    function test_settlementLegBoundToPermittedIdentity_rfqV2_sell_mismatchedInitiator() public {
        _mismatch(2, true, 1);
    }

    function test_settlementLegBoundToPermittedIdentity_rfqV2_sell_revokedEvidence() public {
        _revoked(2, true, false, false);
    }

    function test_settlementLegBoundToPermittedIdentity_rfqV2_sell_revokedIdentity() public {
        _revoked(2, true, false, true);
    }

    function test_settlementLegBoundToPermittedIdentity_rfqV2_sell_mismatchedMaker() public {
        _mismatch(2, true, 2);
    }

    function test_settlementLegBoundToPermittedIdentity_rfqV2_sell_revokedMakerEvidence() public {
        _revoked(2, true, true, false);
    }

    function test_settlementLegBoundToPermittedIdentity_rfqV2_sell_revokedMakerIdentity() public {
        _revoked(2, true, true, true);
    }

    function test_settlementLegBoundToPermittedIdentity_rfqV3_buy() public {
        _success(3, false);
    }

    function test_settlementLegBoundToPermittedIdentity_rfqV3_buy_mismatchedBuyer() public {
        _mismatch(3, false, 0);
    }

    function test_settlementLegBoundToPermittedIdentity_rfqV3_buy_mismatchedInitiator() public {
        _mismatch(3, false, 1);
    }

    function test_settlementLegBoundToPermittedIdentity_rfqV3_buy_revokedEvidence() public {
        _revoked(3, false, false, false);
    }

    function test_settlementLegBoundToPermittedIdentity_rfqV3_buy_revokedIdentity() public {
        _revoked(3, false, false, true);
    }

    function test_settlementLegBoundToPermittedIdentity_rfqV3_buy_mismatchedMaker() public {
        _mismatch(3, false, 2);
    }

    function test_settlementLegBoundToPermittedIdentity_rfqV3_buy_revokedMakerEvidence() public {
        _revoked(3, false, true, false);
    }

    function test_settlementLegBoundToPermittedIdentity_rfqV3_buy_revokedMakerIdentity() public {
        _revoked(3, false, true, true);
    }

    function test_settlementLegBoundToPermittedIdentity_rfqV3_sell() public {
        _success(3, true);
    }

    function test_settlementLegBoundToPermittedIdentity_rfqV3_sell_mismatchedBuyer() public {
        _mismatch(3, true, 0);
    }

    function test_settlementLegBoundToPermittedIdentity_rfqV3_sell_mismatchedInitiator() public {
        _mismatch(3, true, 1);
    }

    function test_settlementLegBoundToPermittedIdentity_rfqV3_sell_revokedEvidence() public {
        _revoked(3, true, false, false);
    }

    function test_settlementLegBoundToPermittedIdentity_rfqV3_sell_revokedIdentity() public {
        _revoked(3, true, false, true);
    }

    function test_settlementLegBoundToPermittedIdentity_rfqV3_sell_mismatchedMaker() public {
        _mismatch(3, true, 2);
    }

    function test_settlementLegBoundToPermittedIdentity_rfqV3_sell_revokedMakerEvidence() public {
        _revoked(3, true, true, false);
    }

    function test_settlementLegBoundToPermittedIdentity_rfqV3_sell_revokedMakerIdentity() public {
        _revoked(3, true, true, true);
    }
}

