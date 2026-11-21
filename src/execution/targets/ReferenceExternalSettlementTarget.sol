// SPDX-License-Identifier: GPL-3.0
pragma solidity 0.8.17;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Governed} from "../../auth/Governed.sol";
import {IExternalSettlementTarget} from "../../interfaces/execution/IExternalSettlementTarget.sol";
import {IVenueRegistry} from "../../interfaces/execution/IVenueRegistry.sol";
import {ExecutionRequest, ExecutionResult} from "../../types/ExecutionTypes.sol";
import {ComplianceContext, FlowType, VenueType} from "../../types/ComplianceTypes.sol";
import {VenueConfig} from "../../types/VenueTypes.sol";
import {Errors} from "../../libraries/Errors.sol";

/// @notice Reference-only one-shot settlement target for ATS/OMS integration tests.
/// @dev Production venues should implement the same boundary against their own
/// authoritative order store. This contract is not a matching or custody system.
contract ReferenceExternalSettlementTarget is IExternalSettlementTarget, Governed {
    using SafeERC20 for IERC20;

    uint16 public constant adapterVersion = 4;
    uint16 public constant contextVersion = 1;
    bytes32 internal constant CONFIG_DOMAIN = keccak256("corner-store.external-settlement-target.v1");

    struct SettlementInstruction {
        address buyer;
        address seller;
        address tokenIn;
        address tokenOut;
        uint256 amountIn;
        uint256 amountOut;
        address venue;
        VenueType venueType;
        FlowType flowType;
        bool sellerIsAffiliate;
        uint64 validUntil;
    }

    address public immutable router;
    IVenueRegistry public immutable venueReg;
    mapping(bytes32 => SettlementInstruction) private _instructions;
    mapping(bytes32 => bool) public instructionSettled;
    mapping(bytes32 => bool) public instructionCancelled;

    event InstructionRegistered(bytes32 indexed instructionId, bytes32 indexed instructionHash, uint64 validUntil);
    event InstructionCancelled(bytes32 indexed instructionId);
    event InstructionSettled(bytes32 indexed instructionId, bytes32 indexed executionId);

    modifier onlyGate() {
        if (msg.sender != router) revert Errors.NotAuthorized();
        _;
    }

    constructor(address gate_, IVenueRegistry venueRegistry_) {
        if (gate_ == address(0) || address(venueRegistry_) == address(0)) revert Errors.ZeroAddress();
        router = gate_;
        venueReg = venueRegistry_;
    }

    function gateEnforced() external pure returns (bool) {
        return true;
    }

    function contextConfigHash() external view returns (bytes32) {
        return keccak256(
            abi.encode(
                CONFIG_DOMAIN, router, address(venueReg), address(venueReg).codehash, adapterVersion, contextVersion
            )
        );
    }

    function registerInstruction(bytes32 instructionId, SettlementInstruction calldata instruction)
        external
        onlyOperator
    {
        if (
            instructionId == bytes32(0) || instruction.buyer == address(0) || instruction.seller == address(0)
                || instruction.tokenIn == address(0) || instruction.tokenOut == address(0)
                || instruction.tokenIn == instruction.tokenOut || instruction.amountIn == 0
                || instruction.amountOut == 0 || instruction.venue == address(0)
                || instruction.validUntil <= block.timestamp || _instructions[instructionId].buyer != address(0)
        ) revert Errors.InvalidExecutionContext();
        _instructions[instructionId] = instruction;
        emit InstructionRegistered(instructionId, keccak256(abi.encode(instruction)), instruction.validUntil);
    }

    function cancelInstruction(bytes32 instructionId) external onlyOperator {
        if (_instructions[instructionId].buyer == address(0) || instructionSettled[instructionId]) {
            revert Errors.InvalidExecutionContext();
        }
        instructionCancelled[instructionId] = true;
        emit InstructionCancelled(instructionId);
    }

    function instructionOf(bytes32 instructionId) external view returns (SettlementInstruction memory) {
        return _instructions[instructionId];
    }

    function validateContext(ExecutionRequest calldata req, VenueConfig calldata cfg) external view {
        _validate(req, cfg);
    }

    function settle(ExecutionRequest calldata req) external onlyGate returns (ExecutionResult memory result) {
        bytes32 instructionId = _validate(req, venueReg.venueOf(req.context.venue));
        instructionSettled[instructionId] = true;
        IERC20(req.context.tokenIn).safeTransferFrom(req.context.buyer, req.context.seller, req.context.amountIn);
        IERC20(req.context.tokenOut).safeTransferFrom(req.context.seller, req.context.buyer, req.context.amountOut);
        bytes32 executionId = keccak256(abi.encode(address(this), instructionId, req.nonce, block.number));
        emit InstructionSettled(instructionId, executionId);
        return ExecutionResult(req.context.amountOut, executionId);
    }

    function _validate(ExecutionRequest calldata req, VenueConfig memory cfg)
        private
        view
        returns (bytes32 instructionId)
    {
        if (req.venueData.length != 32) revert Errors.InvalidExecutionContext();
        instructionId = abi.decode(req.venueData, (bytes32));
        SettlementInstruction memory instruction = _instructions[instructionId];
        if (
            instruction.buyer == address(0) || instructionCancelled[instructionId] || instructionSettled[instructionId]
                || block.timestamp > instruction.validUntil || !cfg.active || cfg.adapter != address(this)
                || cfg.target != address(this) || cfg.venueType != instruction.venueType
        ) revert Errors.InvalidExecutionContext();
        ComplianceContext calldata ctx = req.context;
        if (
            ctx.initiator != instruction.buyer || ctx.buyer != instruction.buyer || ctx.seller != instruction.seller
                || ctx.tokenIn != instruction.tokenIn || ctx.tokenOut != instruction.tokenOut
                || ctx.amountIn != instruction.amountIn || ctx.amountOut != instruction.amountOut
                || ctx.venue != instruction.venue || ctx.venueType != instruction.venueType
                || ctx.flowType != instruction.flowType || ctx.sellerIsAffiliate != instruction.sellerIsAffiliate
        ) revert Errors.InvalidExecutionContext();
    }
}
