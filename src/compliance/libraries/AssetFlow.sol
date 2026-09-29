// SPDX-License-Identifier: GPL-3.0
pragma solidity 0.8.17;

import {ComplianceContext} from "../../types/ComplianceTypes.sol";

/// @dev Resolves the actual regulated-asset transfer direction from the full
///      execution context. `buyer` is the screened investor, not an unconditional
///      token recipient: an RWA buy moves tokenOut seller->buyer, while an RWA
///      sell moves tokenIn buyer->seller.
library AssetFlow {
    error AssetNotInContext(address asset);

    function resolve(address asset, bytes calldata context) internal pure returns (address from, address to) {
        ComplianceContext memory ctx = abi.decode(context, (ComplianceContext));
        if (asset == ctx.tokenOut) return (ctx.seller, ctx.buyer);
        if (asset == ctx.tokenIn) return (ctx.buyer, ctx.seller);
        revert AssetNotInContext(asset);
    }
}
