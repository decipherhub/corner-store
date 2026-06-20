// SPDX-License-Identifier: GPL-3.0
pragma solidity 0.8.17;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IPool} from "../../src/interfaces/execution/adapters/IPool.sol";

/// @notice Uniswap-v3-style mock pool. On `swap` it:
///   1. computes amountOut from amountSpecified (exact input) at a fixed rate (1:1 default),
///   2. calls back `uniswapV3SwapCallback` on the caller (the adapter) to pull tokenIn,
///   3. transfers tokenOut to the recipient.
/// This exercises the adapter callback wiring + the non-custodial invariant.
interface IUniswapV3SwapCallback {
    function uniswapV3SwapCallback(int256 amount0Delta, int256 amount1Delta, bytes calldata data) external;
}

contract MockPool is IPool {
    IERC20 public immutable token0;
    IERC20 public immutable token1;
    uint256 public rateNum = 1; // amountOut = amountIn * rateNum / rateDen
    uint256 public rateDen = 1;

    constructor(IERC20 _token0, IERC20 _token1) {
        token0 = _token0;
        token1 = _token1;
    }

    function setRate(uint256 num, uint256 den) external {
        rateNum = num;
        rateDen = den;
    }

    function swap(address recipient, bool zeroForOne, int256 amountSpecified, uint160, bytes calldata data)
        external
        returns (int256 amount0, int256 amount1)
    {
        require(amountSpecified > 0, "exact-input only");
        uint256 amountIn = uint256(amountSpecified);
        uint256 amountOut = (amountIn * rateNum) / rateDen;

        (IERC20 tokenIn, IERC20 tokenOut) = zeroForOne ? (token0, token1) : (token1, token0);

        // The pool is owed `amountIn` of tokenIn — encode as the positive delta.
        if (zeroForOne) {
            amount0 = int256(amountIn);
            amount1 = -int256(amountOut);
        } else {
            amount1 = int256(amountIn);
            amount0 = -int256(amountOut);
        }

        uint256 balInBefore = tokenIn.balanceOf(address(this));

        // Pull tokenIn from the payer via the adapter callback.
        IUniswapV3SwapCallback(msg.sender).uniswapV3SwapCallback(amount0, amount1, data);

        require(tokenIn.balanceOf(address(this)) - balInBefore == amountIn, "callback underpaid");

        // Send tokenOut to the recipient.
        tokenOut.transfer(recipient, amountOut);
    }
}
