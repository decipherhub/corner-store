// SPDX-License-Identifier: GPL-3.0
pragma solidity 0.8.17;

import {Test} from "forge-std/Test.sol";
import {ExecutionRouter} from "../../../src/execution/ExecutionRouter.sol";
import {VenueRegistry} from "../../../src/execution/VenueRegistry.sol";
import {VenueSelector} from "../../../src/execution/VenueSelector.sol";
import {RFQAdapter} from "../../../src/execution/adapters/rfq/RFQAdapter.sol";
import {OperatorRegistry} from "../../../src/registry/OperatorRegistry.sol";
import {MockComplianceEngine} from "../../mocks/MockComplianceEngine.sol";
import {MockERC20} from "../../mocks/MockERC20.sol";
import {RFQQuote} from "../../../src/execution/adapters/rfq/RFQTypes.sol";
import {VenueConfig, CustodyModel} from "../../../src/types/VenueTypes.sol";
import {ExecutionRequest} from "../../../src/types/ExecutionTypes.sol";
import {ComplianceContext, ComplianceDecision, VenueType, FlowType} from "../../../src/types/ComplianceTypes.sol";
import {Errors} from "../../../src/libraries/Errors.sol";

contract RFQAdapterTest is Test {
    uint256 internal constant MAKER_PK = 0xA11CE;
    uint256 internal constant WRONG_PK = 0xB0B;

    address internal maker;
    address internal taker = address(0xCAFE);
    address internal venue = address(0xF00D);

    MockERC20 internal tokenIn;
    MockERC20 internal tokenOut;
    RFQAdapter internal adapter;
    ExecutionRouter internal router;
    VenueRegistry internal venueReg;
    VenueSelector internal selector;
    OperatorRegistry internal operatorReg;
    MockComplianceEngine internal engine;

    function setUp() public {
        maker = vm.addr(MAKER_PK);

        tokenIn = new MockERC20("TokenIn", "TIN");
        tokenOut = new MockERC20("TokenOut", "TOUT");
        adapter = new RFQAdapter();
        venueReg = new VenueRegistry();
        selector = new VenueSelector();
        operatorReg = new OperatorRegistry();
        engine = new MockComplianceEngine();
        router = new ExecutionRouter(engine, venueReg, selector, operatorReg);

        adapter.setRouter(address(router));
        venueReg.registerVenue(
            venue,
            VenueConfig({
                venueType: VenueType.RFQ,
                adapter: address(adapter),
                target: address(0),
                operator: address(0),
                custody: CustodyModel.NONE,
                active: true
            })
        );

        engine.setDecision(_decision(true, 1 << uint256(VenueType.RFQ), bytes32(0), type(uint256).max, bytes32(0)));

        tokenIn.mint(taker, 1_000 ether);
        tokenOut.mint(maker, 1_000 ether);

        vm.prank(taker);
        tokenIn.approve(address(adapter), type(uint256).max);
        vm.prank(maker);
        tokenOut.approve(address(adapter), type(uint256).max);
    }

    function _decision(bool allowed, uint256 venueTypes, bytes32 venuesHash, uint256 maxAmount, bytes32 reason)
        internal
        pure
        returns (ComplianceDecision memory d)
    {
        d.allowed = allowed;
        d.allowedVenueTypes = venueTypes;
        d.allowedVenuesHash = venuesHash;
        d.maxAmount = maxAmount;
        d.reasonCode = reason;
    }

    function _quote(uint256 nonce, uint64 expiry) internal view returns (RFQQuote memory q) {
        q.maker = maker;
        q.taker = taker;
        q.tokenIn = address(tokenIn);
        q.tokenOut = address(tokenOut);
        q.amountIn = 100 ether;
        q.amountOut = 250 ether;
        q.venue = venue;
        q.nonce = nonce;
        q.expiry = expiry;
    }

    function _request(RFQQuote memory q, bytes memory signature, uint256 routerNonce)
        internal
        view
        returns (ExecutionRequest memory req)
    {
        ComplianceContext memory ctx;
        ctx.initiator = q.taker;
        ctx.buyer = q.taker;
        ctx.seller = q.maker;
        ctx.tokenIn = q.tokenIn;
        ctx.tokenOut = q.tokenOut;
        ctx.amountIn = q.amountIn;
        ctx.amountOut = q.amountOut;
        ctx.venueType = VenueType.RFQ;
        ctx.venue = q.venue;
        ctx.flowType = FlowType.SECONDARY_TRADE;

        req.context = ctx;
        req.amountOutMin = q.amountOut;
        req.deadline = uint64(block.timestamp + 1 hours);
        req.nonce = routerNonce;
        req.venueData = abi.encode(q, signature);
    }

    function _sign(RFQQuote memory q, uint256 privateKey) internal view returns (bytes memory) {
        bytes32 digest = adapter.hashQuote(q);
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(privateKey, digest);
        return abi.encodePacked(r, s, v);
    }

    function _validRequest(uint256 quoteNonce, uint256 routerNonce)
        internal
        view
        returns (RFQQuote memory q, ExecutionRequest memory req)
    {
        q = _quote(quoteNonce, uint64(block.timestamp + 1 hours));
        req = _request(q, _sign(q, MAKER_PK), routerNonce);
    }

    function test_execute_validSignedQuoteThroughRouter() public {
        (, ExecutionRequest memory req) = _validRequest(1, 1);

        vm.prank(taker);
        router.execute(req);

        assertEq(tokenIn.balanceOf(taker), 900 ether, "taker paid tokenIn");
        assertEq(tokenIn.balanceOf(maker), 100 ether, "maker received tokenIn");
        assertEq(tokenOut.balanceOf(taker), 250 ether, "taker received tokenOut");
        assertEq(tokenOut.balanceOf(maker), 750 ether, "maker paid tokenOut");
        assertEq(tokenIn.balanceOf(address(adapter)), 0, "adapter holds no tokenIn");
        assertEq(tokenOut.balanceOf(address(adapter)), 0, "adapter holds no tokenOut");
        assertTrue(engine.committed(), "router committed after RFQ fill");
    }

    function test_revert_directRFQAdapterCallBypass() public {
        (, ExecutionRequest memory req) = _validRequest(1, 1);
        ComplianceDecision memory d;

        vm.expectRevert(Errors.NotAuthorized.selector);
        adapter.execute(req, d);
    }

    function test_revert_invalidSignature() public {
        RFQQuote memory q = _quote(1, uint64(block.timestamp + 1 hours));
        ExecutionRequest memory req = _request(q, _sign(q, WRONG_PK), 1);

        vm.prank(taker);
        vm.expectRevert(Errors.RFQInvalidSignature.selector);
        router.execute(req);
    }

    function test_revert_expiredQuote() public {
        RFQQuote memory q = _quote(1, uint64(block.timestamp));
        ExecutionRequest memory req = _request(q, _sign(q, MAKER_PK), 1);
        vm.warp(block.timestamp + 1);
        req.deadline = uint64(block.timestamp + 1 hours);

        vm.prank(taker);
        vm.expectRevert(Errors.RFQQuoteExpired.selector);
        router.execute(req);
    }

    function test_revert_reusedQuoteNonce() public {
        (, ExecutionRequest memory firstReq) = _validRequest(1, 1);
        vm.prank(taker);
        router.execute(firstReq);

        (, ExecutionRequest memory replayReq) = _validRequest(1, 2);
        vm.prank(taker);
        vm.expectRevert(Errors.RFQQuoteUsed.selector);
        router.execute(replayReq);
    }

    function test_revert_wrongTaker() public {
        RFQQuote memory q = _quote(1, uint64(block.timestamp + 1 hours));
        q.taker = address(0xBAD);
        ExecutionRequest memory req = _request(q, _sign(q, MAKER_PK), 1);
        req.context.initiator = taker;
        req.context.buyer = taker;

        vm.prank(taker);
        vm.expectRevert(Errors.RFQQuoteMismatch.selector);
        router.execute(req);
    }

    function test_revert_tokenAmountOrVenueMismatch() public {
        RFQQuote memory q = _quote(1, uint64(block.timestamp + 1 hours));
        ExecutionRequest memory req = _request(q, _sign(q, MAKER_PK), 1);
        req.context.amountIn = q.amountIn + 1;

        vm.prank(taker);
        vm.expectRevert(Errors.RFQQuoteMismatch.selector);
        router.execute(req);
    }

    function test_revert_complianceRejectedBeforeSettlement() public {
        bytes32 reason = bytes32("R-DENY");
        engine.setDecision(_decision(false, 1 << uint256(VenueType.RFQ), bytes32(0), type(uint256).max, reason));
        (, ExecutionRequest memory req) = _validRequest(1, 1);

        vm.prank(taker);
        vm.expectRevert(abi.encodeWithSelector(Errors.ComplianceRejected.selector, reason));
        router.execute(req);

        assertEq(tokenIn.balanceOf(taker), 1_000 ether, "no settlement on compliance rejection");
        assertEq(tokenOut.balanceOf(maker), 1_000 ether, "maker funds unchanged");
    }
}
