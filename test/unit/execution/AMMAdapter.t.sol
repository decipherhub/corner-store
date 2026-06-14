// SPDX-License-Identifier: GPL-3.0
pragma solidity 0.8.17;

import {Test} from "forge-std/Test.sol";
import {UniswapV3Adapter} from "../../../src/execution/adapters/amm/UniswapV3Adapter.sol";
import {MockERC20} from "../../mocks/MockERC20.sol";
import {MockPool} from "../../mocks/MockPool.sol";
import {ExecutionRequest, ExecutionResult} from "../../../src/types/ExecutionTypes.sol";
import {ComplianceContext, ComplianceDecision, VenueType, FlowType} from "../../../src/types/ComplianceTypes.sol";

contract AMMAdapterTest is Test {
    UniswapV3Adapter internal adapter;
    MockPool internal pool;
    MockERC20 internal token0;
    MockERC20 internal token1;

    address internal constant BUYER = address(0xB0B);

    function setUp() public {
        token0 = new MockERC20("TokenIn", "TIN");
        token1 = new MockERC20("TokenOut", "TOUT");
        pool = new MockPool(token0, token1);
        adapter = new UniswapV3Adapter();
        adapter.setPool(address(pool), true);

        // fund the pool with tokenOut so it can pay the recipient
        token1.mint(address(pool), 1_000_000 ether);
        // fund the buyer with tokenIn and approve the adapter
        token0.mint(BUYER, 1_000 ether);
        vm.prank(BUYER);
        token0.approve(address(adapter), type(uint256).max);
    }

    function _req(bytes memory venueData) internal view returns (ExecutionRequest memory) {
        ComplianceContext memory ctx;
        ctx.buyer = BUYER;
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
        ExecutionResult memory r = adapter.execute(req, _emptyDecision);
        assertEq(r.amountOut, 200 ether);
        assertEq(token1.balanceOf(BUYER), 200 ether);
        assertEq(token0.balanceOf(address(adapter)), 0);
        assertEq(token1.balanceOf(address(adapter)), 0);
    }

    function test_revert_unregisteredPool() public {
        adapter.setPool(address(pool), false);
        vm.expectRevert("pool not registered");
        adapter.execute(_req(""), _emptyDecision);
    }

    function test_revert_spoofedCallback() public {
        // calling the callback from a non-registered address must revert
        bytes memory data = abi.encode(BUYER, address(token0));
        vm.expectRevert("callback: unauthorized");
        adapter.uniswapV3SwapCallback(int256(100 ether), -int256(100 ether), data);
    }

    function test_setPool_onlyOwner() public {
        vm.prank(address(0xA11CE));
        vm.expectRevert("Ownable: caller is not the owner");
        adapter.setPool(address(pool), true);
    }
}
