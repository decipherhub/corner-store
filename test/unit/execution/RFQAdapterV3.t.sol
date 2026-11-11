// SPDX-License-Identifier: GPL-3.0
pragma solidity 0.8.17;

import {Test} from "forge-std/Test.sol";
import {RFQAdapterV3} from "../../../src/execution/adapters/rfq/RFQAdapterV3.sol";
import {RFQQuoteV3} from "../../../src/execution/adapters/rfq/RFQV3Types.sol";
import {RFQAdapter} from "../../../src/execution/adapters/rfq/RFQAdapter.sol";
import {RFQQuote} from "../../../src/execution/adapters/rfq/RFQTypes.sol";
import {ExecutionRouterV2} from "../../../src/execution/ExecutionRouterV2.sol";
import {VenueRegistry} from "../../../src/execution/VenueRegistry.sol";
import {VenueSelector} from "../../../src/execution/VenueSelector.sol";
import {ContextEvidence} from "../../../src/execution/ContextEvidence.sol";
import {ITokenPolicyRegistry} from "../../../src/interfaces/compliance/ITokenPolicyRegistry.sol";
import {MakerAuthorizer} from "../../../src/registry/MakerAuthorizer.sol";
import {OperatorRegistry} from "../../../src/registry/OperatorRegistry.sol";
import {Affiliate} from "../../../src/compliance/elements/Affiliate.sol";
import {MockERC20} from "../../mocks/MockERC20.sol";
import {ContextEngine} from "./RouterV2.t.sol";
import {ContextPolicyRegistry} from "./ContextEvidence.t.sol";
import {ExecutionRequest} from "../../../src/types/ExecutionTypes.sol";
import {
    ComplianceContext,
    ComplianceDecision,
    CompiledElementRule,
    EnforcementAction,
    PolicyStatus,
    VenueType,
    FlowType
} from "../../../src/types/ComplianceTypes.sol";
import {VenueConfig, VenueContextEvidence, CustodyModel} from "../../../src/types/VenueTypes.sol";
import {Errors} from "../../../src/libraries/Errors.sol";

contract V3PolicyRegistry is ContextPolicyRegistry {
    bytes[][] internal _parameters;

    function setDistributors(bytes[] memory values) external {
        delete _parameters;
        for (uint256 i; i < values.length; i++) {
            _parameters.push();
            _parameters[i].push(values[i]);
        }
    }

    function compiledBindingCountOf(address) external view returns (uint256) {
        return _parameters.length;
    }

    function compiledRulesOf(address, uint256) external pure returns (CompiledElementRule[] memory rules) {
        rules = new CompiledElementRule[](1);
        rules[0] = CompiledElementRule("C-01-v2", EnforcementAction.BLOCK);
    }

    function compiledParametersOf(address, uint256 i) external view returns (bytes[] memory) {
        return _parameters[i];
    }
}

contract RFQAdapterV3Test is Test {
    uint256 internal constant MAKER_PK = 0xA11CE;
    uint256 internal constant DELEGATE_PK = 0xD311;
    address internal constant TAKER = address(0xCAFE);
    address internal constant VENUE = address(0xF00D);
    address internal constant ISSUER = address(0x155);
    bytes32 internal constant POLICY = keccak256("policy");
    address internal maker;
    RFQAdapterV3 internal adapter;
    RFQAdapter internal legacy;
    MakerAuthorizer internal authorizer;
    V3PolicyRegistry internal policy;
    Affiliate internal affiliate;
    VenueRegistry internal venues;
    ContextEngine internal engine;
    ExecutionRouterV2 internal router;
    MockERC20 internal tokenIn;
    MockERC20 internal tokenOut;
    VenueConfig internal cfg;

    function setUp() public virtual {
        vm.warp(200 days);
        maker = vm.addr(MAKER_PK);
        policy = new V3PolicyRegistry();
        affiliate = new Affiliate();
        affiliate.setTrustedClaimIssuer(ISSUER, true);
        authorizer = new MakerAuthorizer();
        venues = new VenueRegistry();
        engine = new ContextEngine(address(policy));
        router = new ExecutionRouterV2(engine, venues, new VenueSelector(), new OperatorRegistry());
        adapter = new RFQAdapterV3(authorizer, venues, ITokenPolicyRegistry(address(policy)), address(affiliate));
        legacy = new RFQAdapter(authorizer);
        legacy.setRouter(address(router));
        legacy.setMakerApproved(maker, true);
        adapter.setRouter(address(router));
        adapter.setMakerApproved(maker, true);
        tokenIn = new MockERC20("In", "IN");
        tokenOut = new MockERC20("Out", "OUT");
        policy.setStatus(address(tokenIn), PolicyStatus.UNREGULATED);
        policy.setStatus(address(tokenOut), PolicyStatus.ACTIVE);
        _claim(maker, address(tokenOut), Affiliate.AffiliateBasis.NOT_AFFILIATE, 0);
        _claim(TAKER, address(tokenOut), Affiliate.AffiliateBasis.NOT_AFFILIATE, 0);
        cfg = VenueConfig(VenueType.RFQ, address(adapter), address(0), address(0), CustodyModel.NONE, true);
        venues.registerVenue(VENUE, cfg);
        _pin();
        ComplianceDecision memory d;
        d.allowed = true;
        d.policyId = POLICY;
        d.maxAmount = type(uint256).max;
        d.allowedVenueTypes = 1 << uint256(VenueType.RFQ);
        engine.setDecision(d);
        tokenIn.mint(TAKER, 10000);
        tokenOut.mint(maker, 10000);
        tokenOut.mint(TAKER, 10000);
        tokenIn.mint(maker, 10000);
        vm.startPrank(TAKER);
        tokenIn.approve(address(adapter), type(uint256).max);
        tokenOut.approve(address(adapter), type(uint256).max);
        vm.stopPrank();
        vm.startPrank(maker);
        tokenIn.approve(address(adapter), type(uint256).max);
        tokenOut.approve(address(adapter), type(uint256).max);
        vm.stopPrank();
    }

    function _pin() internal {
        venues.setContextImplementation(address(adapter).codehash, 3, 1, true);
        venues.setVenueContextEvidence(
            VENUE,
            VenueContextEvidence(
                3,
                1,
                address(adapter).codehash,
                address(affiliate),
                address(affiliate).codehash,
                address(policy),
                address(policy).codehash,
                ContextEvidence.configurationHash(cfg)
            )
        );
    }

    function _claim(address sender, address asset, Affiliate.AffiliateBasis basis, uint64 decay) internal {
        affiliate.setClaim(
            sender, asset, basis, Affiliate.DeterminationSource.ISSUER_REGISTRY, ISSUER, uint64(block.timestamp), decay
        );
    }

    function _request(bool reverse) internal view returns (ExecutionRequest memory req, RFQQuoteV3 memory q) {
        ComplianceContext memory ctx;
        ctx.initiator = TAKER;
        ctx.buyer = TAKER;
        ctx.seller = maker;
        ctx.tokenIn = reverse ? address(tokenOut) : address(tokenIn);
        ctx.tokenOut = reverse ? address(tokenIn) : address(tokenOut);
        ctx.amountIn = 100;
        ctx.amountOut = 200;
        ctx.venue = VENUE;
        ctx.venueType = VenueType.RFQ;
        q = RFQQuoteV3(
            maker,
            TAKER,
            ctx.tokenIn,
            ctx.tokenOut,
            100,
            200,
            VENUE,
            POLICY,
            0,
            ContextEvidence.affiliateEvidenceHash(ctx, ITokenPolicyRegistry(address(policy)), address(affiliate)),
            7,
            uint64(block.timestamp + 1 hours)
        );
        req.context = ctx;
        req.deadline = q.expiry + 1;
        req.nonce = 1;
        req.amountOutMin = 200;
        req.venueData = abi.encode(q, _sign(q, MAKER_PK));
    }

    function _sign(RFQQuoteV3 memory q, uint256 key) internal view returns (bytes memory) {
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(key, adapter.hashQuote(q));
        return abi.encodePacked(r, s, v);
    }

    function _execute(ExecutionRequest memory req) internal {
        vm.prank(TAKER);
        router.execute(req);
    }

    function _rollback() internal view {
        assertFalse(router.usedNonce(TAKER, 1));
        assertFalse(adapter.usedQuoteNonce(maker, 7));
        assertEq(engine.commitCount(), 0);
        assertEq(tokenIn.balanceOf(TAKER), 10000);
        assertEq(tokenOut.balanceOf(TAKER), 10000);
    }

    function _beforeEvaluation() internal {
        vm.mockCallRevert(address(engine), abi.encodeWithSelector(engine.evaluate.selector), "evaluation reached");
    }

    function test_buy() public {
        (ExecutionRequest memory req,) = _request(false);
        _execute(req);
        assertEq(tokenIn.balanceOf(TAKER), 9900);
        assertEq(tokenOut.balanceOf(TAKER), 10200);
        assertTrue(adapter.usedQuoteNonce(maker, 7));
        assertEq(engine.commitCount(), 1);
        assertEq(tokenOut.balanceOf(address(adapter)), 0);
    }

    function test_sellUsesActualInputSender() public {
        (ExecutionRequest memory req,) = _request(true);
        _execute(req);
        assertEq(tokenOut.balanceOf(TAKER), 9900);
        assertEq(tokenIn.balanceOf(TAKER), 10200);
        assertEq(engine.lastCommit().amountIn, 100);
    }

    function test_everySignedFieldMutationRejectsBeforeEvaluation() public {
        _beforeEvaluation();
        for (uint256 i; i < 12; i++) {
            (ExecutionRequest memory req, RFQQuoteV3 memory q) = _request(false);
            bytes memory sig = _sign(q, MAKER_PK);
            if (i == 0) q.maker = address(0xBAD);
            if (i == 1) q.taker = address(0xBAD);
            if (i == 2) q.tokenIn = address(0xBAD);
            if (i == 3) q.tokenOut = address(0xBAD);
            if (i == 4) q.amountIn++;
            if (i == 5) q.amountOut++;
            if (i == 6) q.venue = address(0xBAD);
            if (i == 7) q.policyId = keccak256("other");
            if (i == 8) q.flowType = 1;
            if (i == 9) q.affiliateEvidenceHash = keccak256("other");
            if (i == 10) q.nonce++;
            if (i == 11) q.expiry++;
            req.venueData = abi.encode(q, sig);
            vm.expectRevert();
            _execute(req);
            _rollback();
        }
    }

    function test_contextMutationsRejectBeforeEvaluation() public {
        _beforeEvaluation();
        for (uint256 i; i < 10; i++) {
            (ExecutionRequest memory req,) = _request(false);
            if (i == 0) req.context.initiator = address(0xBAD);
            if (i == 1) req.context.buyer = address(0xBAD);
            if (i == 2) req.context.seller = address(0xBAD);
            if (i == 3) req.context.tokenIn = address(tokenOut);
            if (i == 4) req.context.tokenOut = address(tokenIn);
            if (i == 5) req.context.amountIn++;
            if (i == 6) req.context.amountOut++;
            if (i == 7) req.context.venueType = VenueType.AMM;
            if (i == 8) req.context.flowType = FlowType.PRIMARY_DISTRIBUTION;
            if (i == 9) req.context.sellerIsAffiliate = true;
            if (i == 8) vm.expectRevert(Errors.RFQQuoteMismatch.selector);
            else vm.expectRevert();
            _execute(req);
            _rollback();
        }
    }

    function test_expiry() public {
        (ExecutionRequest memory req, RFQQuoteV3 memory q) = _request(false);
        vm.warp(q.expiry + 1);
        _beforeEvaluation();
        vm.expectRevert(Errors.RFQQuoteExpired.selector);
        _execute(req);
        _rollback();
    }

    function test_expiryBoundaryInclusive() public {
        (ExecutionRequest memory req, RFQQuoteV3 memory q) = _request(false);
        vm.warp(q.expiry);
        _execute(req);
    }

    function test_makerRevocation() public {
        (ExecutionRequest memory req,) = _request(false);
        adapter.setMakerApproved(maker, false);
        _beforeEvaluation();
        vm.expectRevert(Errors.RFQMakerNotApproved.selector);
        _execute(req);
        _rollback();
    }

    function test_delegateRevocation() public {
        address delegate = vm.addr(DELEGATE_PK);
        authorizer.scheduleDelegate(maker, delegate, bytes32("test"));
        vm.warp(block.timestamp + 1 days);
        authorizer.executeDelegateAuthorization(maker, delegate);
        (ExecutionRequest memory req, RFQQuoteV3 memory q) = _request(false);
        req.venueData = abi.encode(q, _sign(q, DELEGATE_PK));
        adapter.validateContext(req, cfg);
        authorizer.revokeDelegate(maker, delegate, bytes32("test"));
        _beforeEvaluation();
        vm.expectRevert(Errors.RFQInvalidSignature.selector);
        _execute(req);
        _rollback();
    }

    function test_evidenceRefreshImmediatelyInvalidatesQuote() public {
        (ExecutionRequest memory req,) = _request(false);
        vm.warp(block.timestamp + 1);
        _claim(maker, address(tokenOut), Affiliate.AffiliateBasis.NOT_AFFILIATE, 0);
        _beforeEvaluation();
        vm.expectRevert(Errors.RFQQuoteMismatch.selector);
        _execute(req);
        _rollback();
    }

    function test_issuerRevocation() public {
        (ExecutionRequest memory req,) = _request(false);
        affiliate.setTrustedClaimIssuer(ISSUER, false);
        _beforeEvaluation();
        vm.expectRevert(Errors.InvalidAffiliateEvidence.selector);
        _execute(req);
        _rollback();
    }

    function test_evidenceExpiry() public {
        (ExecutionRequest memory req, RFQQuoteV3 memory q) = _request(false);
        q.expiry = uint64(block.timestamp + 100 days);
        req.deadline = q.expiry;
        req.venueData = abi.encode(q, _sign(q, MAKER_PK));
        vm.warp(block.timestamp + 90 days + 1);
        _beforeEvaluation();
        vm.expectRevert(Errors.InvalidAffiliateEvidence.selector);
        _execute(req);
        _rollback();
    }

    function test_decayInvalidatesOldStatusAndCommitment() public {
        (ExecutionRequest memory req, RFQQuoteV3 memory q) = _request(false);
        _claim(
            maker, address(tokenOut), Affiliate.AffiliateBasis.FORMER_AFFILIATE_DECAY, uint64(block.timestamp - 91 days)
        );
        req.context.sellerIsAffiliate = true;
        q.affiliateEvidenceHash = ContextEvidence.affiliateEvidenceHash(
            req.context, ITokenPolicyRegistry(address(policy)), address(affiliate)
        );
        q.expiry = uint64(block.timestamp + 2 days);
        req.deadline = q.expiry;
        req.venueData = abi.encode(q, _sign(q, MAKER_PK));
        vm.warp(block.timestamp + 1 days);
        vm.expectRevert(Errors.InvalidExecutionContext.selector);
        _execute(req);
        req.context.sellerIsAffiliate = false;
        vm.expectRevert(Errors.RFQQuoteMismatch.selector);
        _execute(req);
        _rollback();
    }

    function test_cancellationBatchAndNamespace() public {
        (ExecutionRequest memory req,) = _request(false);
        adapter.cancelQuoteNonce(7);
        adapter.validateContext(req, cfg);
        _cancelMakerBatch();
        _beforeEvaluation();
        vm.expectRevert(Errors.RFQQuoteUsed.selector);
        _execute(req);
        assertTrue(adapter.usedQuoteNonce(maker, 7));
        assertFalse(router.usedNonce(TAKER, 1));
    }

    function _cancelMakerBatch() internal {
        uint256[] memory nonces = new uint256[](2);
        nonces[0] = 7;
        nonces[1] = 8;
        vm.prank(maker);
        adapter.cancelQuoteNonces(nonces);
        vm.prank(maker);
        adapter.cancelQuoteNonce(7);
    }

    function test_quoteReplayWithNewRouterNonce() public {
        (ExecutionRequest memory req,) = _request(false);
        _execute(req);
        req.nonce = 2;
        vm.expectRevert(Errors.RFQQuoteUsed.selector);
        _execute(req);
        assertFalse(router.usedNonce(TAKER, 2));
        assertEq(engine.commitCount(), 1);
    }

    function test_directCallRejected() public {
        (ExecutionRequest memory req,) = _request(false);
        ComplianceDecision memory d;
        vm.expectRevert(Errors.NotAuthorized.selector);
        adapter.execute(req, d);
        _rollback();
    }

    function test_settlementRepeatsValidation() public {
        (ExecutionRequest memory req,) = _request(false);
        adapter.validateContext(req, cfg);
        adapter.setMakerApproved(maker, false);
        ComplianceDecision memory d;
        d.policyId = POLICY;
        vm.prank(address(router));
        vm.expectRevert(Errors.RFQMakerNotApproved.selector);
        adapter.execute(req, d);
        _rollback();
    }

    function test_policyMismatchRollsBack() public {
        (ExecutionRequest memory req, RFQQuoteV3 memory q) = _request(false);
        q.policyId = keccak256("stale");
        req.venueData = abi.encode(q, _sign(q, MAKER_PK));
        vm.expectRevert(Errors.RFQQuoteMismatch.selector);
        _execute(req);
        _rollback();
    }

    function test_commitFailureRollsBackAndRetries() public {
        (ExecutionRequest memory req,) = _request(false);
        vm.mockCallRevert(address(engine), abi.encodeWithSelector(engine.commit.selector), "commit failed");
        vm.expectRevert(bytes("commit failed"));
        _execute(req);
        _rollback();
        vm.clearMockedCalls();
        _execute(req);
    }

    function test_secondTransferFailureRollsBackAndRetries() public {
        (ExecutionRequest memory req,) = _request(false);
        vm.prank(maker);
        tokenOut.approve(address(adapter), 0);
        vm.expectRevert();
        _execute(req);
        _rollback();
        vm.prank(maker);
        tokenOut.approve(address(adapter), type(uint256).max);
        _execute(req);
    }

    function _primary(ExecutionRequest memory req, RFQQuoteV3 memory q)
        internal
        view
        returns (ExecutionRequest memory)
    {
        q.flowType = 1;
        req.context.flowType = FlowType.PRIMARY_DISTRIBUTION;
        req.venueData = abi.encode(q, _sign(q, MAKER_PK));
        return req;
    }

    function _distributors(address a, address b) internal {
        bytes[] memory params = new bytes[](b == address(0) ? 1 : 2);
        params[0] = abi.encode(a);
        if (b != address(0)) params[1] = abi.encode(b);
        policy.setDistributors(params);
    }

    function test_primaryRequiresUniqueMatchingDistributor() public {
        (ExecutionRequest memory req, RFQQuoteV3 memory q) = _request(false);
        req = _primary(req, q);
        _distributors(maker, maker);
        _execute(req);
        assertEq(engine.commitCount(), 1);
    }

    function test_primaryMissingZeroMismatchAndConflictReject() public {
        (ExecutionRequest memory req, RFQQuoteV3 memory q) = _request(false);
        req = _primary(req, q);
        _beforeEvaluation();
        for (uint256 i; i < 4; i++) {
            if (i == 1) _distributors(address(0), address(0));
            if (i == 2) _distributors(address(0xBAD), address(0));
            if (i == 3) _distributors(maker, address(0xBAD));
            vm.expectRevert(Errors.InvalidExecutionContext.selector);
            _execute(req);
            _rollback();
        }
    }

    function test_primaryRejectsInputSecurityAndUnregulatedPair() public {
        (ExecutionRequest memory req, RFQQuoteV3 memory q) = _request(true);
        req = _primary(req, q);
        _distributors(maker, address(0));
        vm.expectRevert(Errors.InvalidExecutionContext.selector);
        _execute(req);
        policy.setStatus(address(tokenOut), PolicyStatus.UNREGULATED);
        (req, q) = _request(false);
        req = _primary(req, q);
        vm.expectRevert(Errors.InvalidExecutionContext.selector);
        _execute(req);
    }

    function test_redemptionAndUnknownFlowReject() public {
        (ExecutionRequest memory req, RFQQuoteV3 memory q) = _request(false);
        _beforeEvaluation();
        for (uint8 i = 2; i < 4; i++) {
            q.flowType = i;
            req.venueData = abi.encode(q, _sign(q, MAKER_PK));
            vm.expectRevert(Errors.InvalidExecutionContext.selector);
            _execute(req);
        }
        q.flowType = 2;
        req.context.flowType = FlowType.REDEMPTION;
        req.venueData = abi.encode(q, _sign(q, MAKER_PK));
        vm.expectRevert(Errors.InvalidExecutionContext.selector);
        _execute(req);
    }

    function test_v2AndV3SignaturesCrossReject() public {
        (ExecutionRequest memory req, RFQQuoteV3 memory q) = _request(false);
        RFQQuote memory old = RFQQuote(
            q.maker, q.taker, q.tokenIn, q.tokenOut, q.amountIn, q.amountOut, q.venue, q.policyId, q.nonce, q.expiry
        );
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(MAKER_PK, legacy.hashQuote(old));
        req.venueData = abi.encode(q, abi.encodePacked(r, s, v));
        vm.expectRevert(Errors.RFQInvalidSignature.selector);
        _execute(req);
        req.venueData = abi.encode(old, _sign(q, MAKER_PK));
        ComplianceDecision memory d;
        d.policyId = POLICY;
        vm.prank(address(router));
        vm.expectRevert(Errors.RFQInvalidSignature.selector);
        legacy.execute(req, d);
        _rollback();
    }

    function test_v3DomainAndTypeExactVector() public view {
        (, RFQQuoteV3 memory q) = _request(false);
        bytes32 domain = keccak256(
            abi.encode(
                keccak256("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"),
                keccak256("CornerStoreRFQ"),
                keccak256("3"),
                block.chainid,
                address(adapter)
            )
        );
        bytes32 typeHash = keccak256(
            "RFQQuoteV3(address maker,address taker,address tokenIn,address tokenOut,uint256 amountIn,uint256 amountOut,address venue,bytes32 policyId,uint8 flowType,bytes32 affiliateEvidenceHash,uint256 nonce,uint64 expiry)"
        );
        bytes memory fields = bytes.concat(
            abi.encode(typeHash, q.maker, q.taker, q.tokenIn, q.tokenOut, q.amountIn, q.amountOut),
            abi.encode(q.venue, q.policyId, q.flowType, q.affiliateEvidenceHash, q.nonce, q.expiry)
        );
        assertEq(adapter.hashQuote(q), keccak256(abi.encodePacked(hex"1901", domain, keccak256(fields))));
    }

    function test_routerRegistryAndPolicyWiringMustMatchAdapter() public {
        (ExecutionRequest memory req,) = _request(false);
        vm.mockCall(address(router), abi.encodeWithSignature("venueReg()"), abi.encode(address(0xBAD)));
        vm.expectRevert(Errors.InvalidContextEvidence.selector);
        adapter.validateContext(req, cfg);
        vm.clearMockedCalls();
        vm.mockCall(address(router), abi.encodeWithSignature("policyReg()"), abi.encode(address(0xBAD)));
        vm.expectRevert(Errors.InvalidContextEvidence.selector);
        adapter.validateContext(req, cfg);
    }

    function test_registrationCannotSubstituteAffiliateSource() public {
        Affiliate other = new Affiliate();
        venues.setVenueContextEvidence(
            VENUE,
            VenueContextEvidence(
                3,
                1,
                address(adapter).codehash,
                address(other),
                address(other).codehash,
                address(policy),
                address(policy).codehash,
                ContextEvidence.configurationHash(cfg)
            )
        );
        (ExecutionRequest memory req,) = _request(false);
        _beforeEvaluation();
        vm.expectRevert(Errors.InvalidContextEvidence.selector);
        adapter.validateContext(req, cfg);
    }

    function test_primaryMalformedAndMissingParameterRejects() public {
        (ExecutionRequest memory req, RFQQuoteV3 memory q) = _request(false);
        req = _primary(req, q);
        _beforeEvaluation();
        bytes[] memory values = new bytes[](1);
        for (uint256 i; i < 3; i++) {
            if (i == 1) values[0] = hex"01";
            if (i == 2) values[0] = abi.encode(type(uint256).max);
            policy.setDistributors(values);
            vm.expectRevert(Errors.InvalidExecutionContext.selector);
            _execute(req);
            _rollback();
        }
    }

    function test_chainAndAdapterDomainReplayRejects() public {
        (ExecutionRequest memory req, RFQQuoteV3 memory q) = _request(false);
        uint256 originalChain = block.chainid;
        vm.chainId(originalChain + 1);
        vm.expectRevert(Errors.RFQInvalidSignature.selector);
        _execute(req);
        vm.chainId(originalChain);
        RFQAdapterV3 other =
            new RFQAdapterV3(authorizer, venues, ITokenPolicyRegistry(address(policy)), address(affiliate));
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(MAKER_PK, other.hashQuote(q));
        req.venueData = abi.encode(q, abi.encodePacked(r, s, v));
        vm.expectRevert(Errors.RFQInvalidSignature.selector);
        _execute(req);
        _rollback();
    }

    function test_accessControlForWiringAndMakerApproval() public {
        vm.startPrank(TAKER);
        vm.expectRevert("Ownable: caller is not the owner");
        adapter.setRouter(TAKER);
        vm.expectRevert(Errors.NotAuthorized.selector);
        adapter.setMakerApproved(TAKER, true);
        vm.stopPrank();
    }

    function test_signedEvidenceCannotBeReplacedWithCurrentClaim() public {
        (ExecutionRequest memory req, RFQQuoteV3 memory q) = _request(false);
        bytes memory oldSignature = _sign(q, MAKER_PK);
        vm.warp(block.timestamp + 1);
        _claim(maker, address(tokenOut), Affiliate.AffiliateBasis.NOT_AFFILIATE, 0);
        q.affiliateEvidenceHash = ContextEvidence.affiliateEvidenceHash(
            req.context, ITokenPolicyRegistry(address(policy)), address(affiliate)
        );
        req.venueData = abi.encode(q, oldSignature);
        _beforeEvaluation();
        vm.expectRevert(Errors.RFQInvalidSignature.selector);
        _execute(req);
        _rollback();
    }

    function test_dualRegulatedRequiresMatchingCurrentStatuses() public {
        policy.setStatus(address(tokenIn), PolicyStatus.ACTIVE);
        _claim(TAKER, address(tokenIn), Affiliate.AffiliateBasis.NOT_AFFILIATE, 0);
        (ExecutionRequest memory req,) = _request(false);
        adapter.validateContext(req, cfg);
        _claim(TAKER, address(tokenIn), Affiliate.AffiliateBasis.OFFICER_DIRECTOR, 0);
        _beforeEvaluation();
        vm.expectRevert(Errors.ConflictingAffiliateStatus.selector);
        _execute(req);
        _rollback();
    }

    function test_dualRegulatedMatchingStatusesSettle() public {
        policy.setStatus(address(tokenIn), PolicyStatus.ACTIVE);
        _claim(TAKER, address(tokenIn), Affiliate.AffiliateBasis.NOT_AFFILIATE, 0);
        (ExecutionRequest memory req,) = _request(false);
        _execute(req);
        assertEq(engine.commitCount(), 1);
    }

    function test_unregulatedPairCommitsZeroLegs() public {
        policy.setStatus(address(tokenOut), PolicyStatus.UNREGULATED);
        (ExecutionRequest memory req, RFQQuoteV3 memory q) = _request(false);
        assertEq(
            q.affiliateEvidenceHash,
            keccak256(abi.encode(keccak256("corner-store.affiliate-evidence.v1"), bytes32(0), bytes32(0)))
        );
        _execute(req);
        assertEq(engine.commitCount(), 1);
    }

    function test_sellDoesNotAcceptMakerClaimForInputSender() public {
        (ExecutionRequest memory req,) = _request(true);
        _claim(TAKER, address(tokenOut), Affiliate.AffiliateBasis.UNSET, 0);
        _beforeEvaluation();
        vm.expectRevert(Errors.InvalidAffiliateEvidence.selector);
        _execute(req);
        _rollback();
    }

    function test_slippageRollsBackBothNoncesAndTransfers() public {
        (ExecutionRequest memory req,) = _request(false);
        req.amountOutMin = 201;
        vm.expectRevert(Errors.SlippageExceeded.selector);
        _execute(req);
        _rollback();
        req.amountOutMin = 200;
        _execute(req);
    }

    function test_settlementRepeatsEvidenceValidation() public {
        (ExecutionRequest memory req,) = _request(false);
        adapter.validateContext(req, cfg);
        vm.warp(block.timestamp + 1);
        _claim(maker, address(tokenOut), Affiliate.AffiliateBasis.NOT_AFFILIATE, 0);
        ComplianceDecision memory d;
        d.policyId = POLICY;
        vm.prank(address(router));
        vm.expectRevert(Errors.RFQQuoteMismatch.selector);
        adapter.execute(req, d);
        _rollback();
    }

    function test_registrationAndAuthorizerCodeDriftRejects() public {
        (ExecutionRequest memory req,) = _request(false);
        vm.etch(address(authorizer), hex"00");
        _beforeEvaluation();
        vm.expectRevert(Errors.InvalidContextEvidence.selector);
        _execute(req);
        _rollback();
    }

    function test_constructorRejectsMissingAffiliateSource() public {
        vm.expectRevert(Errors.ZeroAddress.selector);
        new RFQAdapterV3(authorizer, venues, ITokenPolicyRegistry(address(policy)), address(0));
    }

    function test_primaryRejectsMismatchedRuleAndParameterLengths() public {
        (ExecutionRequest memory req, RFQQuoteV3 memory q) = _request(false);
        req = _primary(req, q);
        _distributors(maker, address(0));
        bytes[] memory missing = new bytes[](0);
        vm.mockCall(
            address(policy),
            abi.encodeWithSelector(policy.compiledParametersOf.selector, address(tokenOut), uint256(0)),
            abi.encode(missing)
        );
        vm.expectRevert(Errors.InvalidExecutionContext.selector);
        _execute(req);
        _rollback();
    }
}
