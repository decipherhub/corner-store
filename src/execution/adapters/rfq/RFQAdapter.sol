// SPDX-License-Identifier: GPL-3.0
pragma solidity 0.8.17;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import {EIP712} from "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import {Governed} from "../../../auth/Governed.sol";
import {IRFQAdapter} from "../../../interfaces/execution/adapters/IRFQAdapter.sol";
import {ExecutionRequest, ExecutionResult} from "../../../types/ExecutionTypes.sol";
import {ComplianceDecision} from "../../../types/ComplianceTypes.sol";
import {Errors} from "../../../libraries/Errors.sol";
import {RFQQuote} from "./RFQTypes.sol";

/// @title RFQAdapter
/// @notice Full-fill, exact-taker RFQ settlement adapter.
/// @dev The router owns compliance evaluation and post-trade commit. This adapter only verifies
///      the maker's EIP-712 quote and performs non-custodial settlement.
contract RFQAdapter is IRFQAdapter, Governed, EIP712 {
    using SafeERC20 for IERC20;

    bytes32 public constant RFQ_QUOTE_TYPEHASH = keccak256(
        "RFQQuote(address maker,address taker,address tokenIn,address tokenOut,uint256 amountIn,uint256 amountOut,address venue,uint256 nonce,uint64 expiry)"
    );

    address public router;

    mapping(address => mapping(uint256 => bool)) public usedQuoteNonce;

    event RouterSet(address indexed router);
    event RFQFilled(
        bytes32 indexed quoteHash, address indexed maker, address indexed taker, uint256 amountIn, uint256 amountOut
    );

    modifier onlyRouter() {
        if (msg.sender != router) revert Errors.NotAuthorized();
        _;
    }

    constructor() EIP712("CornerStoreRFQ", "1") {}

    function setRouter(address router_) external onlyOwner {
        router = router_;
        emit RouterSet(router_);
    }

    /// @notice Executes a full-fill RFQ quote for a single router request.
    /// @dev `req.venueData` ABI-encodes `(RFQQuote quote, bytes signature)`.
    function execute(ExecutionRequest calldata req, ComplianceDecision calldata)
        external
        onlyRouter
        returns (ExecutionResult memory)
    {
        (RFQQuote memory quote, bytes memory signature) = abi.decode(req.venueData, (RFQQuote, bytes));

        bytes32 quoteHash = hashQuote(quote);
        _validateQuote(req, quote, quoteHash, signature);

        usedQuoteNonce[quote.maker][quote.nonce] = true;

        IERC20(quote.tokenIn).safeTransferFrom(quote.taker, quote.maker, quote.amountIn);
        IERC20(quote.tokenOut).safeTransferFrom(quote.maker, quote.taker, quote.amountOut);

        emit RFQFilled(quoteHash, quote.maker, quote.taker, quote.amountIn, quote.amountOut);

        return ExecutionResult({
            amountOut: quote.amountOut, executionId: keccak256(abi.encode(quoteHash, req.nonce, block.number))
        });
    }

    function hashQuote(RFQQuote memory quote) public view returns (bytes32) {
        return _hashTypedDataV4(
            keccak256(
                abi.encode(
                    RFQ_QUOTE_TYPEHASH,
                    quote.maker,
                    quote.taker,
                    quote.tokenIn,
                    quote.tokenOut,
                    quote.amountIn,
                    quote.amountOut,
                    quote.venue,
                    quote.nonce,
                    quote.expiry
                )
            )
        );
    }

    function _validateQuote(
        ExecutionRequest calldata req,
        RFQQuote memory quote,
        bytes32 quoteHash,
        bytes memory signature
    ) internal view {
        if (block.timestamp > quote.expiry) revert Errors.RFQQuoteExpired();
        if (usedQuoteNonce[quote.maker][quote.nonce]) revert Errors.RFQQuoteUsed();

        if (ECDSA.recover(quoteHash, signature) != quote.maker) revert Errors.RFQInvalidSignature();

        if (
            quote.maker == address(0) || quote.taker == address(0) || quote.tokenIn == address(0)
                || quote.tokenOut == address(0) || quote.venue == address(0) || quote.amountIn == 0
                || quote.amountOut == 0 || quote.taker != req.context.initiator || quote.taker != req.context.buyer
                || quote.maker != req.context.seller || quote.tokenIn != req.context.tokenIn
                || quote.tokenOut != req.context.tokenOut || quote.amountIn != req.context.amountIn
                || quote.amountOut != req.context.amountOut || quote.venue != req.context.venue
        ) {
            revert Errors.RFQQuoteMismatch();
        }
    }
}
