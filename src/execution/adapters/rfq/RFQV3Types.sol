// SPDX-License-Identifier: GPL-3.0
pragma solidity 0.8.17;

/// @notice Exact-taker quote with authenticated flow and current A-06 evidence.
struct RFQQuoteV3 {
    address maker;
    address taker;
    address tokenIn;
    address tokenOut;
    uint256 amountIn;
    uint256 amountOut;
    address venue;
    bytes32 policyId;
    uint8 flowType;
    bytes32 affiliateEvidenceHash;
    uint256 nonce;
    uint64 expiry;
}
