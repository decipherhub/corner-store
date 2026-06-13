// SPDX-License-Identifier: GPL-3.0
pragma solidity 0.8.17;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {Governed} from "../../../auth/Governed.sol";
import {IAMMAdapter} from "../../../interfaces/execution/adapters/IAMMAdapter.sol";
import {IPool} from "../../../interfaces/execution/adapters/IPool.sol";
import {ExecutionRequest, ExecutionResult} from "../../../types/ExecutionTypes.sol";
import {ComplianceDecision} from "../../../types/ComplianceTypes.sol";

/// @title UniswapV3Adapter
/// @notice Non-custodial AMM adapter that routes a swap through a registered Uniswap-v3-style
/// pool. The adapter never holds token balances: the swap callback pulls `tokenIn` directly
/// from the buyer (payer) to the pool, and the pool sends `tokenOut` straight to the recipient.
///
/// Conventions (skeleton):
///   - The router passes `req.context.venue` as the pool address; it MUST be registered here.
///   - `req.venueData`, when non-empty, ABI-encodes `(bool zeroForOne, uint160 sqrtPriceLimitX96)`.
///     When empty it defaults to `(true, 0)`. `amountSpecified` is the exact-input amount
///     `req.context.amountIn` (positive => exact input).
///   - The callback `data` ABI-encodes `(address payer, address tokenIn)` where `payer` is the
///     buyer who has approved this adapter to spend `tokenIn`.
contract UniswapV3Adapter is IAMMAdapter, Governed {
    mapping(address => bool) public registeredPool;

    event PoolSet(address indexed pool, bool registered);

    function setPool(address pool, bool registered) external onlyOwner {
        registeredPool[pool] = registered;
        emit PoolSet(pool, registered);
    }

    function execute(ExecutionRequest calldata req, ComplianceDecision calldata)
        external
        returns (ExecutionResult memory)
    {
        address pool = req.context.venue;
        require(registeredPool[pool], "pool not registered");

        (bool zeroForOne, uint160 sqrtPriceLimitX96) = _decodeVenueData(req.venueData);

        // Encode payer + tokenIn so the callback can pull funds from the buyer.
        bytes memory cb = abi.encode(req.context.buyer, req.context.tokenIn);

        uint256 balBefore = IERC20(req.context.tokenOut).balanceOf(req.context.buyer);

        IPool(pool)
            .swap(
                req.context.buyer, // recipient of tokenOut
                zeroForOne,
                int256(req.context.amountIn), // exact input
                sqrtPriceLimitX96,
                cb
            );

        uint256 amountOut = IERC20(req.context.tokenOut).balanceOf(req.context.buyer) - balBefore;

        return ExecutionResult({amountOut: amountOut, executionId: keccak256(abi.encode(req, block.number))});
    }

    /// @notice Uniswap v3 swap callback. Pulls the owed `tokenIn` from the payer to the pool.
    /// @dev Callback-origin check: only a registered pool may invoke this.
    function uniswapV3SwapCallback(int256 amount0Delta, int256 amount1Delta, bytes calldata data) external {
        require(registeredPool[msg.sender], "callback: unauthorized");

        (address payer, address tokenIn) = abi.decode(data, (address, address));

        // The owed amount is the positive delta (pool is owed tokenIn).
        uint256 amountOwed = amount0Delta > 0 ? uint256(amount0Delta) : uint256(amount1Delta);

        IERC20(tokenIn).transferFrom(payer, msg.sender, amountOwed);
    }

    function _decodeVenueData(bytes calldata venueData)
        internal
        pure
        returns (bool zeroForOne, uint160 sqrtPriceLimitX96)
    {
        if (venueData.length == 0) {
            return (true, 0);
        }
        (zeroForOne, sqrtPriceLimitX96) = abi.decode(venueData, (bool, uint160));
    }
}
