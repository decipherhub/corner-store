// SPDX-License-Identifier: GPL-3.0
pragma solidity 0.8.17;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {EIP712} from "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import {Governed} from "../../../auth/Governed.sol";
import {IRFQAdapter} from "../../../interfaces/execution/adapters/IRFQAdapter.sol";
import {IMakerAuthorizer} from "../../../interfaces/execution/adapters/IMakerAuthorizer.sol";
import {IExecutionContextVerifier} from "../../../interfaces/execution/IExecutionContextVerifier.sol";
import {IVenueRegistry} from "../../../interfaces/execution/IVenueRegistry.sol";
import {ITokenPolicyRegistry} from "../../../interfaces/compliance/ITokenPolicyRegistry.sol";
import {ContextEvidence} from "../../ContextEvidence.sol";
import {ExecutionRequest, ExecutionResult} from "../../../types/ExecutionTypes.sol";
import {
    ComplianceDecision,
    CompiledElementRule,
    FlowType,
    PolicyStatus,
    VenueType
} from "../../../types/ComplianceTypes.sol";
import {VenueConfig, VenueContextEvidence} from "../../../types/VenueTypes.sol";
import {Errors} from "../../../libraries/Errors.sol";
import {RFQQuoteV3} from "./RFQV3Types.sol";

interface IRFQV3Router {
    function venueReg() external view returns (IVenueRegistry);
    function policyReg() external view returns (ITokenPolicyRegistry);
}

/// @notice Opt-in RFQ v3 settlement with venue-authoritative preflight.
contract RFQAdapterV3 is IRFQAdapter, IExecutionContextVerifier, Governed, EIP712 {
    using SafeERC20 for IERC20;

    bytes32 public constant RFQ_QUOTE_TYPEHASH = keccak256(
        "RFQQuoteV3(address maker,address taker,address tokenIn,address tokenOut,uint256 amountIn,uint256 amountOut,address venue,bytes32 policyId,uint8 flowType,bytes32 affiliateEvidenceHash,uint256 nonce,uint64 expiry)"
    );
    uint16 public constant adapterVersion = 3;
    uint16 public constant contextVersion = 1;
    address public router;
    IMakerAuthorizer public immutable makerAuthorizer;
    IVenueRegistry public immutable venueReg;
    ITokenPolicyRegistry public immutable policyReg;
    address public immutable affiliateSource;
    mapping(address => mapping(uint256 => bool)) public usedQuoteNonce;
    mapping(address => bool) public approvedMaker;

    event RouterSet(address indexed router);
    event RFQFilled(
        bytes32 indexed quoteHash, address indexed maker, address indexed taker, uint256 amountIn, uint256 amountOut
    );
    event MakerApprovalSet(address indexed maker, bool approved);
    event RFQQuoteCancelled(address indexed maker, uint256 indexed nonce);

    modifier onlyRouter() {
        if (msg.sender != router) revert Errors.NotAuthorized();
        _;
    }

    constructor(IMakerAuthorizer authorizer_, IVenueRegistry venues_, ITokenPolicyRegistry policy_, address affiliate_)
        EIP712("CornerStoreRFQ", "3")
    {
        if (
            address(authorizer_) == address(0) || address(venues_) == address(0) || address(policy_) == address(0)
                || affiliate_ == address(0)
        ) revert Errors.ZeroAddress();
        makerAuthorizer = authorizer_;
        venueReg = venues_;
        policyReg = policy_;
        affiliateSource = affiliate_;
    }

    function setRouter(address value) external onlyOwner {
        router = value;
        emit RouterSet(value);
    }

    function setMakerApproved(address maker, bool approved) external onlyOperator {
        approvedMaker[maker] = approved;
        emit MakerApprovalSet(maker, approved);
    }

    function contextConfigHash() external view returns (bytes32) {
        return keccak256(
            abi.encode(
                router,
                address(makerAuthorizer),
                address(makerAuthorizer).codehash,
                address(venueReg),
                address(venueReg).codehash,
                address(policyReg),
                address(policyReg).codehash,
                affiliateSource,
                affiliateSource.codehash
            )
        );
    }

    function validateContext(ExecutionRequest calldata req, VenueConfig calldata cfg) external view {
        _validateContext(req, cfg);
    }

    function execute(ExecutionRequest calldata req, ComplianceDecision calldata decision)
        external
        onlyRouter
        returns (ExecutionResult memory)
    {
        (RFQQuoteV3 memory quote, bytes32 quoteHash) = _validateContext(req, venueReg.venueOf(req.context.venue));
        if (quote.policyId != decision.policyId) revert Errors.RFQQuoteMismatch();
        usedQuoteNonce[quote.maker][quote.nonce] = true;
        IERC20(quote.tokenIn).safeTransferFrom(quote.taker, quote.maker, quote.amountIn);
        IERC20(quote.tokenOut).safeTransferFrom(quote.maker, quote.taker, quote.amountOut);
        emit RFQFilled(quoteHash, quote.maker, quote.taker, quote.amountIn, quote.amountOut);
        return ExecutionResult(quote.amountOut, keccak256(abi.encode(quoteHash, req.nonce, block.number)));
    }

    function hashQuote(RFQQuoteV3 memory quote) public view returns (bytes32) {
        return _hashTypedDataV4(keccak256(abi.encode(RFQ_QUOTE_TYPEHASH, quote)));
    }

    function cancelQuoteNonce(uint256 nonce) external {
        _cancelQuoteNonce(nonce);
    }

    function cancelQuoteNonces(uint256[] calldata nonces) external {
        for (uint256 i; i < nonces.length; i++) {
            _cancelQuoteNonce(nonces[i]);
        }
    }

    function _cancelQuoteNonce(uint256 nonce) private {
        if (usedQuoteNonce[msg.sender][nonce]) return;
        usedQuoteNonce[msg.sender][nonce] = true;
        emit RFQQuoteCancelled(msg.sender, nonce);
    }

    function _validateContext(ExecutionRequest calldata req, VenueConfig memory cfg)
        private
        view
        returns (RFQQuoteV3 memory quote, bytes32 quoteHash)
    {
        if (
            address(IRFQV3Router(router).venueReg()) != address(venueReg)
                || address(IRFQV3Router(router).policyReg()) != address(policyReg)
        ) revert Errors.InvalidContextEvidence();
        if (
            !cfg.active || cfg.adapter != address(this) || cfg.venueType != VenueType.RFQ
                || req.context.venueType != VenueType.RFQ
                || keccak256(abi.encode(cfg)) != keccak256(abi.encode(venueReg.venueOf(req.context.venue)))
        ) revert Errors.InvalidExecutionContext();
        VenueContextEvidence memory evidence = venueReg.contextEvidenceOf(req.context.venue);
        if (evidence.affiliateSource != affiliateSource || evidence.policyRegistry != address(policyReg)) {
            revert Errors.InvalidContextEvidence();
        }
        ContextEvidence.validateBinding(cfg, evidence);
        bytes memory signature;
        (quote, signature) = abi.decode(req.venueData, (RFQQuoteV3, bytes));
        quoteHash = hashQuote(quote);
        if (block.timestamp > quote.expiry) revert Errors.RFQQuoteExpired();
        if (usedQuoteNonce[quote.maker][quote.nonce]) revert Errors.RFQQuoteUsed();
        if (!approvedMaker[quote.maker]) revert Errors.RFQMakerNotApproved();
        if (!makerAuthorizer.isAuthorizedSigner(quote.maker, quoteHash, signature)) {
            revert Errors.RFQInvalidSignature();
        }
        if (quote.flowType > uint8(FlowType.PRIMARY_DISTRIBUTION)) revert Errors.InvalidExecutionContext();
        if (
            quote.maker == address(0) || quote.taker == address(0) || quote.tokenIn == address(0)
                || quote.tokenOut == address(0) || quote.tokenIn == quote.tokenOut || quote.venue == address(0)
                || quote.amountIn == 0 || quote.amountOut == 0 || quote.policyId == bytes32(0)
                || quote.taker != req.context.initiator || quote.taker != req.context.buyer
                || quote.maker != req.context.seller || quote.tokenIn != req.context.tokenIn
                || quote.tokenOut != req.context.tokenOut || quote.amountIn != req.context.amountIn
                || quote.amountOut != req.context.amountOut || quote.venue != req.context.venue
                || quote.flowType != uint8(req.context.flowType)
                || quote.affiliateEvidenceHash
                    != ContextEvidence.affiliateEvidenceHash(req.context, policyReg, affiliateSource)
        ) revert Errors.RFQQuoteMismatch();
        if (quote.flowType == uint8(FlowType.PRIMARY_DISTRIBUTION)) _validatePrimary(quote);
    }

    function _validatePrimary(RFQQuoteV3 memory quote) private view {
        if (
            policyReg.statusOf(quote.tokenIn) != PolicyStatus.UNREGULATED
                || policyReg.statusOf(quote.tokenOut) != PolicyStatus.ACTIVE
        ) revert Errors.InvalidExecutionContext();
        address distributor;
        uint256 count = policyReg.compiledBindingCountOf(quote.tokenOut);
        for (uint256 i; i < count; i++) {
            CompiledElementRule[] memory rules = policyReg.compiledRulesOf(quote.tokenOut, i);
            bytes[] memory parameters = policyReg.compiledParametersOf(quote.tokenOut, i);
            if (rules.length != parameters.length) revert Errors.InvalidExecutionContext();
            for (uint256 j; j < rules.length; j++) {
                if (rules[j].elementId != bytes32("C-01-v2")) continue;
                if (parameters[j].length != 32) revert Errors.InvalidExecutionContext();
                uint256 word = abi.decode(parameters[j], (uint256));
                if (word == 0 || word > type(uint160).max) revert Errors.InvalidExecutionContext();
                address candidate = address(uint160(word));
                if (distributor != address(0) && candidate != distributor) revert Errors.InvalidExecutionContext();
                distributor = candidate;
            }
        }
        if (distributor == address(0) || distributor != quote.maker) revert Errors.InvalidExecutionContext();
    }
}
