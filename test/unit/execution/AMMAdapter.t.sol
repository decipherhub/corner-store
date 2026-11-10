// SPDX-License-Identifier: GPL-3.0
pragma solidity 0.8.17;

import {Test} from "forge-std/Test.sol";
import {UniswapV3Adapter} from "../../../src/execution/adapters/amm/UniswapV3Adapter.sol";
import {MockERC20} from "../../mocks/MockERC20.sol";
import {MockPool} from "../../mocks/MockPool.sol";
import {ExecutionRequest, ExecutionResult} from "../../../src/types/ExecutionTypes.sol";
import {ComplianceContext, ComplianceDecision, VenueType, FlowType} from "../../../src/types/ComplianceTypes.sol";
import {Errors} from "../../../src/libraries/Errors.sol";
import {VenueRegistry} from "../../../src/execution/VenueRegistry.sol";
import {VenueConfig, CustodyModel} from "../../../src/types/VenueTypes.sol";

contract AMMAdapterTest is Test {
    UniswapV3Adapter internal adapter;
    MockPool internal pool;
    MockERC20 internal token0;
    MockERC20 internal token1;
    VenueRegistry internal venues;
    VenueConfig internal cfg;

    address internal constant BUYER = address(0xB0B);
    address internal constant ROUTER = address(0xA17E);

    function setUp() public {
        token0 = new MockERC20("TokenIn", "TIN");
        token1 = new MockERC20("TokenOut", "TOUT");
        pool = new MockPool(token0, token1);
        adapter = new UniswapV3Adapter();
        adapter.setRouter(ROUTER);
        adapter.setPool(address(pool), true);
        venues = new VenueRegistry();
        cfg = VenueConfig(VenueType.AMM, address(adapter), address(pool), address(0), CustodyModel.POOL, true);
        venues.registerVenue(address(pool), cfg);
        vm.mockCall(ROUTER, abi.encodeWithSignature("venueReg()"), abi.encode(address(venues)));

        // fund the pool with tokenOut so it can pay the recipient
        token1.mint(address(pool), 1_000_000 ether);
        // fund the buyer with tokenIn and approve the adapter
        token0.mint(BUYER, 1_000 ether);
        vm.prank(BUYER);
        token0.approve(address(adapter), type(uint256).max);
    }

    function _req(bytes memory venueData) internal view returns (ExecutionRequest memory) {
        ComplianceContext memory ctx;
        ctx.initiator = BUYER;
        ctx.buyer = BUYER;
        ctx.seller = address(pool);
        ctx.tokenIn = address(token0);
        ctx.tokenOut = address(token1);
        ctx.amountIn = 100 ether;
        ctx.venueType = VenueType.AMM;
        ctx.venue = address(pool);
        ctx.flowType = FlowType.SECONDARY_TRADE;
        return ExecutionRequest({
            context: ctx, amountOutMin: 0, deadline: uint64(block.timestamp + 1 hours), nonce: 1, venueData: venueData
        });
    }

    ComplianceDecision internal _emptyDecision;

    function test_swap_nonCustodial_zeroForOne() public {
        // venueData empty -> default zeroForOne=true (token0 in, token1 out)
        ExecutionRequest memory req = _req("");

        uint256 buyerInBefore = token0.balanceOf(BUYER);

        vm.prank(ROUTER);
        ExecutionResult memory r = adapter.execute(req, _emptyDecision);

        // 1:1 rate
        assertEq(r.amountOut, 100 ether, "amountOut 1:1");
        assertEq(token0.balanceOf(BUYER), buyerInBefore - 100 ether, "buyer paid tokenIn");
        assertEq(token1.balanceOf(BUYER), 100 ether, "buyer received tokenOut");

        // non-custodial invariant: adapter holds nothing
        assertEq(token0.balanceOf(address(adapter)), 0, "adapter holds no tokenIn");
        assertEq(token1.balanceOf(address(adapter)), 0, "adapter holds no tokenOut");
    }

    function test_swap_settableRate() public {
        pool.setRate(2, 1); // 2x out
        ExecutionRequest memory req = _req("");
        vm.prank(ROUTER);
        ExecutionResult memory r = adapter.execute(req, _emptyDecision);
        assertEq(r.amountOut, 200 ether);
        assertEq(token1.balanceOf(BUYER), 200 ether);
        assertEq(token0.balanceOf(address(adapter)), 0);
        assertEq(token1.balanceOf(address(adapter)), 0);
    }

    function test_revert_unregisteredPool() public {
        adapter.setPool(address(pool), false);
        vm.prank(ROUTER);
        vm.expectRevert("pool not registered");
        adapter.execute(_req(""), _emptyDecision);
    }

    function test_revert_execute_onlyRouter() public {
        vm.expectRevert(Errors.NotAuthorized.selector);
        adapter.execute(_req(""), _emptyDecision);
    }

    function test_revert_initiatorBuyerMismatch() public {
        ExecutionRequest memory req = _req("");
        req.context.initiator = address(0xBAD);

        vm.prank(ROUTER);
        vm.expectRevert(Errors.NotAuthorized.selector);
        adapter.execute(req, _emptyDecision);
    }

    function test_revert_spoofedCallback() public {
        // calling the callback from a non-registered address must revert
        bytes memory data = abi.encode(BUYER, address(token0));
        vm.expectRevert("callback: unauthorized");
        adapter.uniswapV3SwapCallback(int256(100 ether), -int256(100 ether), data);
    }

    function test_revert_requestTokensDoNotMatchPoolDirection() public {
        ExecutionRequest memory req = _req("");
        req.context.tokenIn = address(token1);
        req.context.tokenOut = address(token0);

        vm.prank(ROUTER);
        vm.expectRevert(Errors.AMMPoolTokenMismatch.selector);
        adapter.execute(req, _emptyDecision);
    }

    function test_revert_registeredPoolCallbackTokenDoesNotMatchPositiveDelta() public {
        bytes memory data = abi.encode(BUYER, address(token1));

        vm.prank(address(pool));
        vm.expectRevert(Errors.AMMPoolTokenMismatch.selector);
        adapter.uniswapV3SwapCallback(int256(100 ether), -int256(100 ether), data);
    }

    function test_setPool_onlyOwner() public {
        vm.prank(address(0xA11CE));
        vm.expectRevert("Ownable: caller is not the owner");
        adapter.setPool(address(pool), true);
    }

    function test_preflightAuthenticatesBothDirections() public view {
        adapter.validateContext(_req(""), cfg);
        ExecutionRequest memory req = _req(abi.encode(false, uint160(0)));
        req.context.tokenIn = address(token1);
        req.context.tokenOut = address(token0);
        adapter.validateContext(req, cfg);
        assertEq(adapter.adapterVersion(), 2);
        assertEq(adapter.contextVersion(), 1);
    }

    function test_preflightAndSettlementRejectForgedSellerAndFlow() public {
        for (uint256 i; i < 3; i++) {
            ExecutionRequest memory req = _req("");
            if (i == 0) req.context.seller = BUYER;
            if (i == 1) req.context.flowType = FlowType.PRIMARY_DISTRIBUTION;
            if (i == 2) req.context.flowType = FlowType.REDEMPTION;
            vm.expectRevert(Errors.InvalidExecutionContext.selector);
            adapter.validateContext(req, cfg);
            vm.prank(ROUTER);
            vm.expectRevert(Errors.InvalidExecutionContext.selector);
            adapter.execute(req, _emptyDecision);
        }
    }

    function test_preflightRejectsRegistrationMismatch() public {
        for (uint256 i; i < 4; i++) {
            VenueConfig memory bad = cfg;
            if (i == 0) bad.target = BUYER;
            if (i == 1) bad.adapter = BUYER;
            if (i == 2) bad.venueType = VenueType.RFQ;
            if (i == 3) bad.active = false;
            vm.expectRevert(Errors.InvalidExecutionContext.selector);
            adapter.validateContext(_req(""), bad);
        }
    }

    function test_settlementRepeatsTargetBinding() public {
        adapter.validateContext(_req(""), cfg);
        cfg.target = BUYER;
        venues.registerVenue(address(pool), cfg);
        vm.prank(ROUTER);
        vm.expectRevert(Errors.InvalidExecutionContext.selector);
        adapter.execute(_req(""), _emptyDecision);
    }

    function test_configurationCommitsPoolChangesAndRouter() public {
        bytes32 first = adapter.contextConfigHash();
        adapter.setPool(address(pool), false);
        assertNotEq(adapter.contextConfigHash(), first);
        adapter.setPool(address(pool), true);
        bytes32 second = adapter.contextConfigHash();
        assertNotEq(second, first);
        adapter.setRouter(BUYER);
        assertNotEq(adapter.contextConfigHash(), second);
    }

    function test_preflightRejectsDirectionAndDelegation() public {
        ExecutionRequest memory req = _req(abi.encode(false, uint160(0)));
        vm.expectRevert(Errors.AMMPoolTokenMismatch.selector);
        adapter.validateContext(req, cfg);
        req = _req("");
        req.context.initiator = address(0xBAD);
        vm.expectRevert(Errors.NotAuthorized.selector);
        adapter.validateContext(req, cfg);
    }

    function test_identicalPoolTokensReject() public {
        MockPool invalid = new MockPool(token0, token0);
        adapter.setPool(address(invalid), true);
        ExecutionRequest memory req = _req("");
        req.context.venue = address(invalid);
        req.context.seller = address(invalid);
        req.context.tokenOut = address(token0);
        VenueConfig memory bad = cfg;
        bad.target = address(invalid);
        venues.registerVenue(address(invalid), bad);
        vm.expectRevert(Errors.InvalidExecutionContext.selector);
        adapter.validateContext(req, bad);
    }

    function test_signedIntegerOverflowRejectsBeforeSwap() public {
        ExecutionRequest memory req = _req("");
        req.context.amountIn = uint256(type(int256).max) + 1;
        vm.expectRevert(Errors.InvalidExecutionContext.selector);
        adapter.validateContext(req, cfg);
        vm.prank(ROUTER);
        vm.expectRevert(Errors.InvalidExecutionContext.selector);
        adapter.execute(req, _emptyDecision);
    }

    function test_preflightRequiresCurrentPoolMembership() public {
        adapter.setPool(address(pool), false);
        vm.expectRevert("pool not registered");
        adapter.validateContext(_req(""), cfg);
    }
}
