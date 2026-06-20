// SPDX-License-Identifier: GPL-3.0
pragma solidity 0.8.17;

import {Governed} from "../auth/Governed.sol";

/// @title UniswapV3VenueFactory
/// @notice Thin SKELETON for creating and registering a Uniswap V3 pool as an
/// execution venue. The actual pool deployment (calling the live Uniswap V3
/// factory) is OUT OF SCOPE for this task and intentionally not implemented.
///
/// @dev `createAndRegisterPool` is a documented stub that reverts. It exists to
/// freeze the orchestration surface; Task E (or a later venue-integration task)
/// will wire it to a real Uniswap V3 factory + `CornerStoreFactory`.
contract UniswapV3VenueFactory is Governed {
    /// @dev Stub. Reverts until the real Uniswap V3 pool deployment is wired.
    function createAndRegisterPool(
        address,
        /* rwaToken */
        address,
        /* quoteToken */
        uint24 /* fee */
    )
        external
        view
        onlyOperator
        returns (address)
    {
        revert("UniswapV3VenueFactory: not implemented (stub)");
    }
}
