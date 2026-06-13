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
    address internal constant TOKEN_IN = address(0x111);
    address internal constant TOKEN_OUT = address(0x222);

    bytes32 internal constant REASON_OK = bytes32(0);
    bytes32 internal constant REASON_BAD = bytes32("R-DENY");

    function setUp() public {
        venueReg = new VenueRegistry();
        selector = new VenueSelector();
        operatorReg = new OperatorRegistry();
        engine = new MockComplianceEngine();
        adapter = new MockAdapter();

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

    function _req(uint256 nonce, uint256 amountIn, uint64 deadline) internal pure returns (ExecutionRequest memory) {
        ComplianceContext memory ctx;
        ctx.buyer = BUYER;
        ctx.tokenIn = TOKEN_IN;
        ctx.tokenOut = TOKEN_OUT;
        ctx.amountIn = amountIn;
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
        adapter.setAmountOut(777);

        vm.recordLogs();
        vm.prank(BUYER);
        ExecutionResult memory r = router.execute(req);

        assertEq(r.amountOut, 777, "amountOut forwarded");
        assertTrue(adapter.called(), "adapter called");
        assertEq(adapter.callCount(), 1);
        assertTrue(engine.committed(), "engine.commit called");
        assertEq(engine.commitCount(), 1);
    }

    function test_execute_emitsExecuted() public {
        ExecutionRequest memory req = _defaultReq();
        adapter.setAmountOut(777);
        bytes32 expectedId = keccak256(abi.encode(req, block.number));

        vm.expectEmit(true, true, false, true);
        emit Events.Executed(expectedId, VENUE, 777);
        vm.prank(BUYER);
        router.execute(req);
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

    function test_nonce_scopedPerCaller() public {
        ExecutionRequest memory req = _defaultReq();
        vm.prank(BUYER);
        router.execute(req);
        // different caller, same nonce -> ok
        vm.prank(address(0xDEAD));
        router.execute(req);
        assertEq(adapter.callCount(), 2);
    }

    function test_revert_maxAmountExceeded() public {
        // decision.maxAmount below amountIn
        engine.setDecision(_decision(true, 1 << uint256(VenueType.AMM), bytes32(0), 99, REASON_OK));
        ExecutionRequest memory req = _req(1, 100, uint64(block.timestamp + 1 hours));
        vm.prank(BUYER);
        vm.expectRevert(Errors.MaxAmountExceeded.selector);
        router.execute(req);
    }

    function test_revert_venueSuspended() public {
        operatorReg.setVenueSuspended(VENUE, true, bytes32("kill"));
        vm.prank(BUYER);
        vm.expectRevert(Errors.VenueSuspended.selector);
        router.execute(_defaultReq());
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
        vm.expectRevert(); // ReentrancyGuard: reentrant call (string revert bubbles up)
        router.execute(req);
    }
}
