// SPDX-License-Identifier: GPL-3.0
pragma solidity 0.8.17;

import {IntegrationBase} from "../../integration/IntegrationBase.sol";
import {IdentityUniquenessV2} from "../../../src/compliance/elements/IdentityUniquenessV2.sol";
import {IIdentityEvidenceV2} from "../../../src/interfaces/compliance/IIdentityEvidenceV2.sol";
import {Affiliate} from "../../../src/compliance/elements/Affiliate.sol";
import {ExecutionRouterBase} from "../../../src/execution/ExecutionRouterBase.sol";
import {ExecutionRouterV2} from "../../../src/execution/ExecutionRouterV2.sol";
import {RFQAdapter} from "../../../src/execution/adapters/rfq/RFQAdapter.sol";
import {RFQAdapterV3} from "../../../src/execution/adapters/rfq/RFQAdapterV3.sol";
import {RFQQuote} from "../../../src/execution/adapters/rfq/RFQTypes.sol";
import {RFQQuoteV3} from "../../../src/execution/adapters/rfq/RFQV3Types.sol";
import {MakerAuthorizer} from "../../../src/registry/MakerAuthorizer.sol";
import {ContextEvidence} from "../../../src/execution/ContextEvidence.sol";
import {VenueConfig, VenueContextEvidence, CustodyModel} from "../../../src/types/VenueTypes.sol";
import {
    ManifestCore,
    ManifestPolicyConfig,
    ElementPolicyParameter,
    ElementEnforcementOverride,
    RecipeBinding,
    RecipeBindingMode,
    VenueType
} from "../../../src/types/ComplianceTypes.sol";
import {ExecutionRequest} from "../../../src/types/ExecutionTypes.sol";

contract AssuranceRecipe {
    uint16 public immutable version;

    constructor(uint16 version_) {
        version = version_;
    }

    function recipeId() external pure returns (uint16) {
        return 8;
    }

    function isApplicable(bytes calldata) external pure returns (bool) {
        return true;
    }

    function requiredElements() external pure returns (bytes32[] memory ids) {
        ids = new bytes32[](9);
        ids[0] = "A-01-v1";
        ids[1] = "A-02-v1";
        ids[2] = "A-03-v1";
        ids[3] = "A-04-v2";
        ids[4] = "A-05-v1";
        ids[5] = "B-01-v1";
        ids[6] = "B-02-v2";
        ids[7] = "E-01-v1";
        ids[8] = "F-02-v2";
    }
}

abstract contract AssuranceFixture is IntegrationBase {
    bytes32 internal constant ISSUER = keccak256("assurance-issuer");
    bytes32 internal constant BASIS = keccak256("assurance-trust-basis");
    address internal constant VENUE_V2 = address(0xF002);
    address internal constant VENUE_V3 = address(0xF003);
    uint256 internal constant ENDOWMENT = 1e30;
    uint256 internal constant MAKER_KEY = 0xD311;
    uint256 internal constant OTHER_MAKER_KEY = 0xD312;

    IdentityUniquenessV2 internal evidence;
    Affiliate internal affiliate;
    ExecutionRouterV2 internal routerV2;
    RFQAdapter internal rfqV2;
    RFQAdapterV3 internal rfqV3;
    address[4] internal actors;
    address[10] internal holders;
    mapping(address => uint256) internal cashModel;
    mapping(address => uint256) internal rwaModel;
    mapping(address => uint256) internal donations;
    uint256 internal minted;
    uint256 internal burned;
    uint256 public successes;
    uint256 public rejections;
    uint256[3] public fills;
    uint256 internal serial = 100;

    struct NonceSlot {
        uint8 kind;
        address actor;
        uint256 nonce;
        bool consumed;
    }
    NonceSlot[] internal routerSlots;
    NonceSlot[] internal quoteSlots;

    function _deployAssurance() internal {
        deployStack();
        evidence = new IdentityUniquenessV2();
        evidence.setTrustedIssuer(ISSUER, BASIS);
        evidence.setEnforceCounterparty(true);
        elementReg.registerElement("A-04-v2", address(evidence));
        recipeReg.registerRecipe(8, 2, address(new AssuranceRecipe(2)));
        policyReg.retireManifest(address(rwaToken), "assurance-fixture");
        ManifestCore memory m = _activeManifest(0, 0);
        m.supportedEngines = 5;
        m.fullManifestHash = keccak256("assurance-policy-v1");
        policyReg.registerManifest(
            address(rwaToken), m, _assuranceBindings(2), new ElementEnforcementOverride[](0), _config(1)
        );
        policyReg.approveManifest(address(rwaToken));
        routerV2 = new ExecutionRouterV2(engine, venueReg, selector, operatorReg);
        rfqV2 = new RFQAdapter(new MakerAuthorizer());
        rfqV2.setRouter(address(router));
        affiliate = new Affiliate();
        affiliate.setTrustedClaimIssuer(address(this), true);
        rfqV3 = new RFQAdapterV3(new MakerAuthorizer(), venueReg, policyReg, address(affiliate));
        rfqV3.setRouter(address(routerV2));
        venueReg.registerVenue(
            VENUE_V2, VenueConfig(VenueType.RFQ, address(rfqV2), address(0), address(0), CustodyModel.NONE, true)
        );
        _pinV3();
        actors = [alice, address(0xB0B), vm.addr(MAKER_KEY), vm.addr(OTHER_MAKER_KEY)];
        holders = [
            actors[0],
            actors[1],
            actors[2],
            actors[3],
            address(pool),
            address(router),
            address(routerV2),
            address(adapter),
            address(rfqV2),
            address(rfqV3)
        ];
        for (uint256 i; i < 5; ++i) {
            address who = holders[i];
            if (i < 4) setupBuyer(who);
            else attestInvestor(who);
            evidence.bindIdentity(who, keccak256(abi.encode("assurance-identity", who)));
            _accept(who, address(rwaToken), 1e12);
            _claim(who);
            mint(who, ENDOWMENT);
            quote.mint(who, ENDOWMENT);
            cashModel[who] = ENDOWMENT;
            rwaModel[who] = ENDOWMENT;
            vm.startPrank(who);
            quote.approve(address(adapter), type(uint256).max);
            rwaToken.approve(address(adapter), type(uint256).max);
            quote.approve(address(rfqV2), type(uint256).max);
            rwaToken.approve(address(rfqV2), type(uint256).max);
            quote.approve(address(rfqV3), type(uint256).max);
            rwaToken.approve(address(rfqV3), type(uint256).max);
            vm.stopPrank();
        }
        for (uint256 i = 2; i < 4; ++i) {
            rfqV2.setMakerApproved(actors[i], true);
            rfqV3.setMakerApproved(actors[i], true);
        }
    }

    function _assuranceBindings(uint16 version_) internal pure returns (RecipeBinding[] memory b) {
        b = new RecipeBinding[](1);
        b[0] = RecipeBinding(8, version_, RecipeBindingMode.REQUIRED_BLOCKING, 0, 100);
    }

    function _config(uint8 track) internal view returns (ManifestPolicyConfig memory c) {
        c.schemaVersion = 1;
        c.elementParameters = new ElementPolicyParameter[](1);
        c.elementParameters[0] =
            ElementPolicyParameter(0, "A-04-v2", evidence.PARAMETER_SCHEMA_ID(), 1, abi.encode(track, uint8(1)));
    }

    function _accept(address who, address asset, uint64 expiry) internal {
        evidence.acceptEvidence(
            who,
            asset,
            IIdentityEvidenceV2.Evidence(
                evidence.identityOf(who),
                ISSUER,
                BASIS,
                keccak256(abi.encode("accepted", who, asset, block.timestamp)),
                uint64(block.timestamp),
                expiry,
                3
            )
        );
    }

    function _claim(address who) internal {
        affiliate.setClaim(
            who,
            address(rwaToken),
            Affiliate.AffiliateBasis.NOT_AFFILIATE,
            Affiliate.DeterminationSource.ISSUER_REGISTRY,
            address(this),
            uint64(block.timestamp),
            0
        );
    }

    function _refreshAffiliateFixture() internal {
        for (uint256 i; i < 5; ++i) {
            _claim(holders[i]);
        }
    }

    function _pinV3() internal {
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
    }

    function _router(uint8 kind) internal view returns (ExecutionRouterBase) {
        return kind == 2 ? ExecutionRouterBase(address(routerV2)) : ExecutionRouterBase(address(router));
    }

    function _request(
        uint8 kind,
        uint8 actor,
        uint8 makerIndex,
        bool sell,
        uint256 amount,
        uint256 nonce,
        uint256 qnonce
    ) internal view returns (ExecutionRequest memory req) {
        req.context.initiator = actors[actor];
        req.context.buyer = actors[actor];
        req.context.seller = kind == 0 ? address(pool) : actors[2 + makerIndex];
        req.context.tokenIn = sell ? address(rwaToken) : address(quote);
        req.context.tokenOut = sell ? address(quote) : address(rwaToken);
        req.context.amountIn = amount;
        req.context.amountOut = amount;
        req.context.venue = kind == 0 ? address(pool) : kind == 1 ? VENUE_V2 : VENUE_V3;
        req.context.venueType = kind == 0 ? VenueType.AMM : VenueType.RFQ;
        req.deadline = uint64(block.timestamp + 1 days);
        req.amountOutMin = amount;
        req.nonce = nonce;
        bytes32 policyId = engine.evaluate(req.context).policyId;
        if (kind == 0) {
            req.venueData = abi.encode(!sell, uint160(0));
        } else if (kind == 1) {
            RFQQuote memory q = RFQQuote(
                actors[2 + makerIndex],
                actors[actor],
                req.context.tokenIn,
                req.context.tokenOut,
                amount,
                amount,
                VENUE_V2,
                policyId,
                qnonce,
                req.deadline
            );
            (uint8 v, bytes32 r, bytes32 s) = vm.sign(makerIndex == 0 ? MAKER_KEY : OTHER_MAKER_KEY, rfqV2.hashQuote(q));
            req.venueData = abi.encode(q, abi.encodePacked(r, s, v));
        } else {
            RFQQuoteV3 memory q = RFQQuoteV3(
                actors[2 + makerIndex],
                actors[actor],
                req.context.tokenIn,
                req.context.tokenOut,
                amount,
                amount,
                VENUE_V3,
                policyId,
                0,
                ContextEvidence.affiliateEvidenceHash(req.context, policyReg, address(affiliate)),
                qnonce,
                req.deadline
            );
            (uint8 v, bytes32 r, bytes32 s) = vm.sign(makerIndex == 0 ? MAKER_KEY : OTHER_MAKER_KEY, rfqV3.hashQuote(q));
            req.venueData = abi.encode(q, abi.encodePacked(r, s, v));
        }
    }

    function _fill(uint8 kind, ExecutionRequest memory req, uint256 qnonce) internal {
        engine.setRouter(address(_router(kind)));
        vm.prank(req.context.initiator);
        _router(kind).execute(req);
        address buyer = req.context.buyer;
        address seller = req.context.seller;
        uint256 amount = req.context.amountIn;
        bool sell = req.context.tokenIn == address(rwaToken);
        cashModel[buyer] = sell ? cashModel[buyer] + amount : cashModel[buyer] - amount;
        cashModel[seller] = sell ? cashModel[seller] - amount : cashModel[seller] + amount;
        rwaModel[buyer] = sell ? rwaModel[buyer] - amount : rwaModel[buyer] + amount;
        rwaModel[seller] = sell ? rwaModel[seller] + amount : rwaModel[seller] - amount;
        routerSlots.push(NonceSlot(kind, buyer, req.nonce, true));
        if (kind != 0) quoteSlots.push(NonceSlot(kind, seller, qnonce, true));
        ++successes;
        ++fills[kind];
        assertState();
    }

    function _reject(uint8 kind, ExecutionRequest memory req, bytes4 expected) internal {
        engine.setRouter(address(_router(kind)));
        bytes32 beforeState = _stateDigest();
        bool nonceBefore = _router(kind).usedNonce(req.context.initiator, req.nonce);
        bytes32 quoteBefore = _quoteState(kind, req.venueData);
        vm.prank(req.context.initiator);
        (bool ok, bytes memory reason) = address(_router(kind)).call(abi.encodeCall(ExecutionRouterBase.execute, (req)));
        assertFalse(ok, "expected rejection");
        assertGe(reason.length, 4, "unexpected empty revert");
        assertEq(bytes4(reason), expected, "unexpected rejection");
        assertEq(_stateDigest(), beforeState, "rejected settlement changed state");
        assertEq(_router(kind).usedNonce(req.context.initiator, req.nonce), nonceBefore, "rejected router nonce");
        assertEq(_quoteState(kind, req.venueData), quoteBefore, "rejected quote nonce");
        ++rejections;
        assertState();
    }

    function _quoteState(uint8 kind, bytes memory data) internal view returns (bytes32) {
        if (kind == 0) return bytes32(0);
        if (kind == 1) {
            (RFQQuote memory q,) = abi.decode(data, (RFQQuote, bytes));
            return keccak256(abi.encode(rfqV2.usedQuoteNonce(q.maker, q.nonce)));
        }
        (RFQQuoteV3 memory q3,) = abi.decode(data, (RFQQuoteV3, bytes));
        return keccak256(abi.encode(rfqV3.usedQuoteNonce(q3.maker, q3.nonce)));
    }

    function _stateDigest() internal view returns (bytes32) {
        bytes memory values;
        for (uint256 i; i < holders.length; ++i) {
            values = abi.encode(values, quote.balanceOf(holders[i]), rwaToken.balanceOf(holders[i]));
        }
        return keccak256(abi.encode(values, surveillance.transferCount()));
    }

    function assertState() public view {
        uint256 cashSum;
        uint256 rwaSum;
        for (uint256 i; i < holders.length; ++i) {
            address who = holders[i];
            uint256 cash = quote.balanceOf(who);
            uint256 rwa = rwaToken.balanceOf(who);
            assertEq(cash, cashModel[who], "exact cash model");
            assertEq(rwa, rwaModel[who], "exact RWA model");
            if (i >= 5) {
                assertEq(cash, donations[who], "settlement-created cash custody");
                assertEq(rwa, 0, "settlement-created RWA custody");
            }
            cashSum += cash;
            rwaSum += rwa;
        }
        assertEq(cashSum, 5 * ENDOWMENT, "cash conservation");
        assertEq(rwaSum, 5 * ENDOWMENT + minted - burned, "RWA conservation");
        assertEq(quote.totalSupply(), cashSum);
        assertEq(rwaToken.totalSupply(), rwaSum);
        assertEq(surveillance.transferCount(), successes, "exactly one commit per fill");
        for (uint256 i; i < routerSlots.length; ++i) {
            NonceSlot memory slot = routerSlots[i];
            assertEq(_router(slot.kind).usedNonce(slot.actor, slot.nonce), slot.consumed, "router nonce model");
        }
        for (uint256 i; i < quoteSlots.length; ++i) {
            NonceSlot memory slot = quoteSlots[i];
            assertEq(
                slot.kind == 1
                    ? rfqV2.usedQuoteNonce(slot.actor, slot.nonce)
                    : rfqV3.usedQuoteNonce(slot.actor, slot.nonce),
                slot.consumed,
                "quote nonce model"
            );
        }
    }
}
