// SPDX-License-Identifier: GPL-3.0
pragma solidity 0.8.17;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Governed} from "../../../auth/Governed.sol";
import {IAMMAdapter} from "../../../interfaces/execution/adapters/IAMMAdapter.sol";
import {IPool} from "../../../interfaces/execution/adapters/IPool.sol";
import {IExecutionContextVerifier} from "../../../interfaces/execution/IExecutionContextVerifier.sol";
import {IVenueRegistry} from "../../../interfaces/execution/IVenueRegistry.sol";
import {ExecutionRequest, ExecutionResult} from "../../../types/ExecutionTypes.sol";
import {ComplianceDecision, FlowType, VenueType} from "../../../types/ComplianceTypes.sol";
import {VenueConfig} from "../../../types/VenueTypes.sol";
import {Errors} from "../../../libraries/Errors.sol";

interface IAMMRouterRegistry {
    function venueReg() external view returns (IVenueRegistry);
}

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
contract UniswapV3Adapter is IAMMAdapter, IExecutionContextVerifier, Governed {
    using SafeERC20 for IERC20;

    mapping(address => bool) public registeredPool;
    address public router;
    uint16 public constant adapterVersion = 2;
    uint16 public constant contextVersion = 1;
    uint256 public poolConfigurationNonce;

    event PoolSet(address indexed pool, bool registered);
    event RouterSet(address indexed router);

    modifier onlyRouter() {
        if (msg.sender != router) revert Errors.NotAuthorized();
        _;
    }

    function setRouter(address router_) external onlyOwner {
        router = router_;
        emit RouterSet(router_);
    }

    function setPool(address pool, bool registered) external onlyOwner {
        registeredPool[pool] = registered;
        poolConfigurationNonce++;
        emit PoolSet(pool, registered);
    }

    function contextConfigHash() external view returns (bytes32) {
        return keccak256(abi.encode(router, poolConfigurationNonce));
    }

    function validateContext(ExecutionRequest calldata req, VenueConfig calldata cfg) external view {
        _validateContext(req, cfg);
    }

    function _validateContext(ExecutionRequest calldata req, VenueConfig memory cfg)
        internal
        view
        returns (bool zeroForOne, uint160 sqrtPriceLimitX96)
    {
        if (req.context.buyer == address(0) || req.context.initiator != req.context.buyer) {
            revert Errors.NotAuthorized();
        }
        if (
            !cfg.active || cfg.adapter != address(this) || cfg.venueType != VenueType.AMM
                || req.context.venueType != VenueType.AMM || cfg.target != req.context.venue
                || req.context.seller != cfg.target || req.context.flowType != FlowType.SECONDARY_TRADE
                || req.context.tokenIn == req.context.tokenOut || req.context.amountIn > uint256(type(int256).max)
        ) revert Errors.InvalidExecutionContext();
        require(registeredPool[cfg.target], "pool not registered");
        IVenueRegistry venues = IAMMRouterRegistry(router).venueReg();
        if (keccak256(abi.encode(cfg)) != keccak256(abi.encode(venues.venueOf(req.context.venue)))) {
            revert Errors.InvalidExecutionContext();
        }
        (zeroForOne, sqrtPriceLimitX96) = _decodeVenueData(req.venueData);
        IPool pool = IPool(cfg.target);
        address expectedTokenIn = address(zeroForOne ? pool.token0() : pool.token1());
        address expectedTokenOut = address(zeroForOne ? pool.token1() : pool.token0());
        if (req.context.tokenIn != expectedTokenIn || req.context.tokenOut != expectedTokenOut) {
            revert Errors.AMMPoolTokenMismatch();
        }
    }

    /// @notice Executes the swap for a single request.
    /// @dev SECURITY: only the wired {ExecutionRouter} may call this function.
    /// The router runs the compliance/selector gates and binds the caller to the
    /// request initiator before adapter dispatch.
    function execute(ExecutionRequest calldata req, ComplianceDecision calldata)
        external
        onlyRouter
        returns (ExecutionResult memory)
    {
        VenueConfig memory cfg = IAMMRouterRegistry(router).venueReg().venueOf(req.context.venue);
        (bool zeroForOne, uint160 sqrtPriceLimitX96) = _validateContext(req, cfg);
        IPool targetPool = IPool(cfg.target);

        // Encode payer + tokenIn so the callback can pull funds from the buyer.
        bytes memory cb = abi.encode(req.context.buyer, req.context.tokenIn);

        uint256 balBefore = IERC20(req.context.tokenOut).balanceOf(req.context.buyer);

        targetPool.swap(
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

        // Exactly one positive delta identifies the token owed to the pool.
        // Bind that delta to the registered pool's canonical token ordering so
        // malformed callback data cannot redirect transferFrom to another asset.
        uint256 amountOwed;
        IPool pool = IPool(msg.sender);
        if (amount0Delta > 0 && amount1Delta <= 0 && tokenIn == address(pool.token0())) {
            amountOwed = uint256(amount0Delta);
        } else if (amount1Delta > 0 && amount0Delta <= 0 && tokenIn == address(pool.token1())) {
            amountOwed = uint256(amount1Delta);
        } else {
            revert Errors.AMMPoolTokenMismatch();
        }

        IERC20(tokenIn).safeTransferFrom(payer, msg.sender, amountOwed);
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
