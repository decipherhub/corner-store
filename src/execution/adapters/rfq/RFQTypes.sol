// SPDX-License-Identifier: GPL-3.0
pragma solidity 0.8.17;

/// @notice Full-fill, exact-taker RFQ quote signed offchain by the maker.
/// @dev tokenIn/tokenOut are from the taker/buyer perspective:
///      taker pays tokenIn to maker and receives tokenOut from maker.
struct RFQQuote {
    address maker;
    address taker;
    address tokenIn;
    address tokenOut;
    uint256 amountIn;
    uint256 amountOut;
    address venue;
    uint256 nonce;
    uint64 expiry;
}
