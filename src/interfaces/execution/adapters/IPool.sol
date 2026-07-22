// SPDX-License-Identifier: GPL-3.0
pragma solidity 0.8.17;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

// IPool — minimal mock-pool callback surface (uniswap v3 콜백 모방)
interface IPool {
    function token0() external view returns (IERC20);

    function token1() external view returns (IERC20);

    function swap(
        address recipient,
        bool zeroForOne,
        int256 amountSpecified,
        uint160 sqrtPriceLimitX96,
        bytes calldata data
    ) external returns (int256 amount0, int256 amount1);
}
