// SPDX-License-Identifier: GPL-3.0
pragma solidity 0.8.17;

import {Test} from "forge-std/Test.sol";
import {ExecutionRouter} from "../../../src/execution/ExecutionRouter.sol";
import {VenueRegistry} from "../../../src/execution/VenueRegistry.sol";
import {VenueSelector} from "../../../src/execution/VenueSelector.sol";
import {OperatorRegistry} from "../../../src/registry/OperatorRegistry.sol";
import {MockComplianceEngine} from "../../mocks/MockComplianceEngine.sol";
import {MockAdapter} from "../../mocks/MockAdapter.sol";
import {ReentrantAdapter} from "../../mocks/ReentrantAdapter.sol";
import {MockERC20} from "../../mocks/MockERC20.sol";
import {VenueConfig, CustodyModel} from "../../../src/types/VenueTypes.sol";
import {ExecutionRequest, ExecutionResult} from "../../../src/types/ExecutionTypes.sol";
import {ComplianceContext, ComplianceDecision, VenueType, FlowType} from "../../../src/types/ComplianceTypes.sol";
import {Errors} from "../../../src/libraries/Errors.sol";
import {Events} from "../../../src/libraries/Events.sol";

contract RouterTest is Test {
    ExecutionRouter internal router;
    VenueRegistry internal venueReg;
    VenueSelector internal selector;
    OperatorRegistry internal operatorReg;
    MockComplianceEngine internal engine;
    MockAdapter internal adapter;

    address internal constant VENUE = address(0xCAFE);
    address internal constant BUYER = address(0xB0B);
    address internal TOKEN_IN;
    address internal TOKEN_OUT;

    bytes32 internal constant REASON_OK = bytes32(0);
    bytes32 internal constant REASON_BAD = bytes32("R-DENY");

    function setUp() public {
        venueReg = new VenueRegistry();
        selector = new VenueSelector();
        operatorReg = new OperatorRegistry();
        engine = new MockComplianceEngine();
        adapter = new MockAdapter();
        MockERC20 tokenIn = new MockERC20("Token In", "TIN");
        MockERC20 tokenOut = new MockERC20("Token Out", "TOUT");
        TOKEN_IN = address(tokenIn);
        TOKEN_OUT = address(tokenOut);

        tokenIn.mint(BUYER, 1_000_000 ether);
        tokenOut.mint(address(adapter), 1_000_000 ether);
        vm.prank(BUYER);
        tokenIn.approve(address(adapter), type(uint256).max);

        router = new ExecutionRouter(engine, venueReg, selector, operatorReg);

        venueReg.registerVenue(
            VENUE,
            VenueConfig({
                venueType: VenueType.AMM,
                adapter: address(adapter),
                target: address(0xBEEF),
                operator: address(0),
                custody: CustodyModel.POOL,
                active: true
            })
        );

        // default: allowed, AMM type permitted, any venue, generous maxAmount
        engine.setDecision(_decision(true, 1 << uint256(VenueType.AMM), bytes32(0), type(uint256).max, REASON_OK));
    }

    // ---- helpers ----

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

    function _req(uint256 nonce, uint256 amountIn, uint64 deadline) internal view returns (ExecutionRequest memory) {
        ComplianceContext memory ctx;
        ctx.initiator = BUYER;
        ctx.buyer = BUYER;
        ctx.tokenIn = TOKEN_IN;
        ctx.tokenOut = TOKEN_OUT;
        ctx.amountIn = amountIn;
        ctx.amountOut = 1000;
        ctx.venueType = VenueType.AMM;
        ctx.venue = VENUE;
        ctx.flowType = FlowType.SECONDARY_TRADE;
        return ExecutionRequest({context: ctx, amountOutMin: 0, deadline: deadline, nonce: nonce, venueData: ""});
    }

    function _defaultReq() internal view returns (ExecutionRequest memory) {
        return _req(1, 100, uint64(block.timestamp + 1 hours));
    }

    // ---- happy path ----

    function test_execute_happyPath() public {
        ExecutionRequest memory req = _defaultReq();
        req.context.amountOut = 777;
        adapter.setAmountOut(777);

        vm.recordLogs();
        vm.prank(BUYER);
        ExecutionResult memory r = router.execute(req);

        assertEq(r.amountOut, 777, "amountOut forwarded");
        assertTrue(adapter.called(), "adapter called");
        assertEq(adapter.callCount(), 1);
        assertTrue(engine.committed(), "engine.commit called");
        assertEq(engine.commitCount(), 1);
        assertEq(engine.lastCommit().amountOut, 777, "commit must use realized output");
    }

    function test_execute_emitsExecuted() public {
        ExecutionRequest memory req = _defaultReq();
        req.context.amountOut = 777;
        adapter.setAmountOut(777);
        bytes32 expectedId = keccak256(abi.encode(req, block.number));

        vm.expectEmit(true, true, false, true);
        emit Events.Executed(expectedId, VENUE, 777);
        vm.prank(BUYER);
        router.execute(req);
    }

    function test_execute_emitsNonBlockingComplianceFlags() public {
        ComplianceDecision memory decision =
            _decision(true, 1 << uint256(VenueType.AMM), bytes32(0), type(uint256).max, REASON_OK);
        decision.decisionHash = keccak256("flagged-decision");
        decision.flagsBitmap = 5;
        engine.setDecision(decision);

        vm.expectEmit(true, false, false, true);
        emit Events.ComplianceFlags(decision.decisionHash, decision.flagsBitmap);
        vm.prank(BUYER);
        router.execute(_defaultReq());
    }

    // ---- gate reverts ----

    function test_revert_complianceRejected() public {
        engine.setDecision(_decision(false, 1, bytes32(0), type(uint256).max, REASON_BAD));
        vm.prank(BUYER);
        vm.expectRevert(abi.encodeWithSelector(Errors.ComplianceRejected.selector, REASON_BAD));
        router.execute(_defaultReq());
    }

    function test_revert_deadlineExpired() public {
        ExecutionRequest memory req = _req(1, 100, uint64(block.timestamp));
        vm.warp(block.timestamp + 1);
        vm.prank(BUYER);
        vm.expectRevert(Errors.DeadlineExpired.selector);
        router.execute(req);
    }

    function test_revert_nonceUsed() public {
        ExecutionRequest memory req = _defaultReq();
        vm.prank(BUYER);
        router.execute(req);
        // reuse same nonce from same caller
        vm.prank(BUYER);
        vm.expectRevert(Errors.NonceUsed.selector);
        router.execute(req);
    }

    function test_revert_callerMustMatchInitiator() public {
        ExecutionRequest memory req = _defaultReq();
        vm.prank(BUYER);
        router.execute(req);

        // A different caller cannot reuse the same request body even though the
        // nonce mapping is scoped by msg.sender.
        vm.prank(address(0xDEAD));
        vm.expectRevert(Errors.NotAuthorized.selector);
        router.execute(req);
        assertEq(adapter.callCount(), 1);
    }

    function test_revert_zeroInitiator() public {
        ExecutionRequest memory req = _defaultReq();
        req.context.initiator = address(0);

        vm.prank(BUYER);
        vm.expectRevert(Errors.NotAuthorized.selector);
        router.execute(req);
    }

    function test_revert_maxAmountExceeded() public {
        ComplianceDecision memory decision = _decision(true, 1 << uint256(VenueType.AMM), bytes32(0), 99, REASON_OK);
        decision.maxAmountToken = TOKEN_IN;
        engine.setDecision(decision);
        ExecutionRequest memory req = _req(1, 100, uint64(block.timestamp + 1 hours));
        vm.prank(BUYER);
        vm.expectRevert(Errors.MaxAmountExceeded.selector);
        router.execute(req);
    }

    function test_execute_buyUsesRegulatedTokenOutForFiniteCap() public {
        ComplianceDecision memory decision = _decision(true, 1 << uint256(VenueType.AMM), bytes32(0), 200, REASON_OK);
        decision.maxAmountToken = TOKEN_OUT;
        engine.setDecision(decision);

        ExecutionRequest memory req = _req(1, 500, uint64(block.timestamp + 1 hours));
        req.context.amountOut = 150;
        vm.prank(BUYER);
        router.execute(req);

        assertTrue(adapter.called(), "quote notional must not be compared to an RWA output cap");
    }

    function test_revert_whenRealizedTokenOutExceedsApprovedAmount() public {
        ExecutionRequest memory req = _req(1, 500, uint64(block.timestamp + 1 hours));
        req.context.amountOut = 150;
        adapter.setAmountOut(250);
        uint256 tokenInBefore = MockERC20(TOKEN_IN).balanceOf(BUYER);
        uint256 tokenOutBefore = MockERC20(TOKEN_OUT).balanceOf(BUYER);

        vm.prank(BUYER);
        vm.expectRevert(Errors.SettlementAmountMismatch.selector);
        router.execute(req);

        assertFalse(router.usedNonce(BUYER, req.nonce), "failed final authorization must roll back nonce");
        assertFalse(adapter.called(), "failed final authorization must roll back adapter state");
        assertFalse(engine.committed(), "failed final authorization must not commit");
        assertEq(MockERC20(TOKEN_IN).balanceOf(BUYER), tokenInBefore, "input balance must roll back");
        assertEq(MockERC20(TOKEN_OUT).balanceOf(BUYER), tokenOutBefore, "output balance must roll back");
    }

    function test_revert_whenRealizedTokenOutFallsBelowApprovedAmount() public {
        ExecutionRequest memory req = _defaultReq();
        req.context.amountOut = 250;
        adapter.setAmountOut(150);
        uint256 tokenInBefore = MockERC20(TOKEN_IN).balanceOf(BUYER);
        uint256 tokenOutBefore = MockERC20(TOKEN_OUT).balanceOf(BUYER);

        vm.prank(BUYER);
        vm.expectRevert(Errors.SettlementAmountMismatch.selector);
        router.execute(req);

        assertFalse(router.usedNonce(BUYER, req.nonce), "settlement mismatch must roll back nonce");
        assertFalse(adapter.called(), "settlement mismatch must roll back adapter state");
        assertFalse(engine.committed(), "settlement mismatch must not commit");
        assertEq(MockERC20(TOKEN_IN).balanceOf(BUYER), tokenInBefore, "input balance must roll back");
        assertEq(MockERC20(TOKEN_OUT).balanceOf(BUYER), tokenOutBefore, "output balance must roll back");
    }

    function test_revert_whenRealizedTokenInDiffersFromApprovedAmount() public {
        ExecutionRequest memory req = _defaultReq();
        adapter.setAmountIn(req.context.amountIn - 1);
        uint256 tokenInBefore = MockERC20(TOKEN_IN).balanceOf(BUYER);
        uint256 tokenOutBefore = MockERC20(TOKEN_OUT).balanceOf(BUYER);

        vm.prank(BUYER);
        vm.expectRevert(Errors.SettlementAmountMismatch.selector);
        router.execute(req);

        assertFalse(router.usedNonce(BUYER, req.nonce), "settlement mismatch must roll back nonce");
        assertFalse(adapter.called(), "settlement mismatch must roll back adapter state");
        assertFalse(engine.committed(), "settlement mismatch must not commit");
        assertEq(MockERC20(TOKEN_IN).balanceOf(BUYER), tokenInBefore, "input balance must roll back");
        assertEq(MockERC20(TOKEN_OUT).balanceOf(BUYER), tokenOutBefore, "output balance must roll back");
    }

    function test_revert_whenAdapterReportsDifferentAmountOut() public {
        ExecutionRequest memory req = _defaultReq();
        adapter.setReportedAmountOut(req.context.amountOut + 1);
        uint256 tokenInBefore = MockERC20(TOKEN_IN).balanceOf(BUYER);
        uint256 tokenOutBefore = MockERC20(TOKEN_OUT).balanceOf(BUYER);

        vm.prank(BUYER);
        vm.expectRevert(Errors.SettlementAmountMismatch.selector);
        router.execute(req);

        assertFalse(router.usedNonce(BUYER, req.nonce), "adapter report mismatch must roll back nonce");
        assertFalse(adapter.called(), "adapter report mismatch must roll back adapter state");
        assertFalse(engine.committed(), "adapter report mismatch must not commit");
        assertEq(MockERC20(TOKEN_IN).balanceOf(BUYER), tokenInBefore, "input balance must roll back");
        assertEq(MockERC20(TOKEN_OUT).balanceOf(BUYER), tokenOutBefore, "output balance must roll back");
    }

    function test_revert_buyWhenRegulatedTokenOutExceedsFiniteCap() public {
        ComplianceDecision memory decision = _decision(true, 1 << uint256(VenueType.AMM), bytes32(0), 200, REASON_OK);
        decision.maxAmountToken = TOKEN_OUT;
        engine.setDecision(decision);

        ExecutionRequest memory req = _req(1, 100, uint64(block.timestamp + 1 hours));
        req.context.amountOut = 250;
        vm.prank(BUYER);
        vm.expectRevert(Errors.MaxAmountExceeded.selector);
        router.execute(req);
    }

    function test_revert_finiteCapWithoutPairTokenBinding() public {
        ComplianceDecision memory decision = _decision(true, 1 << uint256(VenueType.AMM), bytes32(0), 200, REASON_OK);
        decision.maxAmountToken = address(0xBAD);
        engine.setDecision(decision);

        vm.prank(BUYER);
        vm.expectRevert(Errors.InvalidAmountCapToken.selector);
        router.execute(_defaultReq());
    }

    function test_execute_sellUsesRegulatedTokenInForFiniteCap() public {
        ComplianceDecision memory decision = _decision(true, 1 << uint256(VenueType.AMM), bytes32(0), 150, REASON_OK);
        decision.maxAmountToken = TOKEN_IN;
        engine.setDecision(decision);

        ExecutionRequest memory req = _req(1, 100, uint64(block.timestamp + 1 hours));
        req.context.amountOut = 500;
        vm.prank(BUYER);
        router.execute(req);

        assertTrue(adapter.called(), "quote output must not be compared to an RWA input cap");
    }

    function test_revert_sellWhenRegulatedTokenInExceedsFiniteCap() public {
        ComplianceDecision memory decision = _decision(true, 1 << uint256(VenueType.AMM), bytes32(0), 99, REASON_OK);
        decision.maxAmountToken = TOKEN_IN;
        engine.setDecision(decision);

        ExecutionRequest memory req = _req(1, 100, uint64(block.timestamp + 1 hours));
        req.context.amountOut = 50;
        vm.prank(BUYER);
        vm.expectRevert(Errors.MaxAmountExceeded.selector);
        router.execute(req);
    }

    function test_revert_venueSuspended() public {
        operatorReg.setVenueSuspended(VENUE, true, bytes32("kill"));
        vm.prank(BUYER);
        vm.expectRevert(Errors.VenueSuspended.selector);
        router.execute(_defaultReq());
        assertFalse(router.usedNonce(BUYER, 1));
    }

    function test_revert_globalPaused_withoutConsumingNonce() public {
        operatorReg.setGlobalPaused(true, bytes32("kill"));
        vm.prank(BUYER);
        vm.expectRevert(Errors.GlobalPaused.selector);
        router.execute(_defaultReq());
        assertFalse(router.usedNonce(BUYER, 1));
    }

    function test_revert_tokenInPaused() public {
        operatorReg.setAssetSuspended(TOKEN_IN, true, bytes32("kill"));
        vm.prank(BUYER);
        vm.expectRevert(Errors.TokenInPaused.selector);
        router.execute(_defaultReq());
        assertFalse(router.usedNonce(BUYER, 1));
    }

    function test_revert_tokenOutPaused() public {
        operatorReg.setAssetSuspended(TOKEN_OUT, true, bytes32("kill"));
        vm.prank(BUYER);
        vm.expectRevert(Errors.TokenOutPaused.selector);
        router.execute(_defaultReq());
        assertFalse(router.usedNonce(BUYER, 1));
    }

    function test_revert_venueNotAllowed_typeMaskMiss() public {
        // permit only RFQ; request is AMM -> selector returns false
        engine.setDecision(_decision(true, 1 << uint256(VenueType.RFQ), bytes32(0), type(uint256).max, REASON_OK));
        vm.prank(BUYER);
        vm.expectRevert(Errors.VenueNotAllowed.selector);
        router.execute(_defaultReq());
    }

    function test_revert_adapterNotRegistered_inactive() public {
        // re-register VENUE as inactive
        venueReg.registerVenue(
            VENUE,
            VenueConfig({
                venueType: VenueType.AMM,
                adapter: address(adapter),
                target: address(0xBEEF),
                operator: address(0),
                custody: CustodyModel.POOL,
                active: false
            })
        );
        vm.prank(BUYER);
        vm.expectRevert(Errors.AdapterNotRegistered.selector);
        router.execute(_defaultReq());
    }

    function test_execute_revertsWhenVenueTypeMismatchesRegistry() public {
        // registry has VENUE registered as VenueType.AMM (see setUp)
        ExecutionRequest memory req = _defaultReq();
        req.context.venueType = VenueType.RFQ;
        // let step-6 selector pass by allowing RFQ in the decision's type mask
        engine.setDecision(_decision(true, 1 << uint256(VenueType.RFQ), bytes32(0), type(uint256).max, REASON_OK));

        vm.prank(BUYER);
        vm.expectRevert(Errors.VenueTypeMismatch.selector);
        router.execute(req);
    }

    function test_revert_adapterNotRegistered_unknownVenue() public {
        ExecutionRequest memory req = _defaultReq();
        req.context.venue = address(0xABCD); // not registered, but allowedVenuesHash==0 passes selector
        vm.prank(BUYER);
        vm.expectRevert(Errors.AdapterNotRegistered.selector);
        router.execute(req);
    }

    // ---- reentrancy ----

    function test_revert_reentrancy() public {
        ReentrantAdapter evil = new ReentrantAdapter(router);
        address evilVenue = address(0xE711);
        venueReg.registerVenue(
            evilVenue,
            VenueConfig({
                venueType: VenueType.AMM,
                adapter: address(evil),
                target: address(0),
                operator: address(0),
                custody: CustodyModel.POOL,
                active: true
            })
        );
        ExecutionRequest memory req = _defaultReq();
        req.context.venue = evilVenue;

        vm.prank(BUYER);
        // Pin the guard's exact revert string (OZ v4.8) so this cannot pass via NonceUsed.
        vm.expectRevert("ReentrancyGuard: reentrant call");
        router.execute(req);
    }

    function test_revert_reentrancy_distinctNonce() public {
        ReentrantAdapter evil = new ReentrantAdapter(router);
        // Re-enter with a DIFFERENT nonce so NonceUsed cannot be the cause; only the guard remains.
        evil.setReentrantNonce(999);
        address evilVenue = address(0xE712);
        venueReg.registerVenue(
            evilVenue,
            VenueConfig({
                venueType: VenueType.AMM,
                adapter: address(evil),
                target: address(0),
                operator: address(0),
                custody: CustodyModel.POOL,
                active: true
            })
        );
        ExecutionRequest memory req = _defaultReq();
        req.context.venue = evilVenue;

        vm.prank(BUYER);
        vm.expectRevert("ReentrancyGuard: reentrant call");
        router.execute(req);
    }

    // ---- slippage ----

    function test_revert_slippage() public {
        ExecutionRequest memory req = _defaultReq();
        req.context.amountOut = 777;
        req.amountOutMin = 778; // require more than the adapter will return
        adapter.setAmountOut(777);

        vm.prank(BUYER);
        vm.expectRevert(Errors.SlippageExceeded.selector);
        router.execute(req);
    }

    function test_execute_slippage_boundMet() public {
        ExecutionRequest memory req = _defaultReq();
        req.context.amountOut = 777;
        req.amountOutMin = 777; // exactly meets the returned amount
        adapter.setAmountOut(777);

        vm.prank(BUYER);
        ExecutionResult memory r = router.execute(req);
        assertEq(r.amountOut, 777, "amountOut forwarded when bound met");
    }
}
