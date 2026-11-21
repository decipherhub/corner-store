// SPDX-License-Identifier: GPL-3.0
pragma solidity 0.8.17;

import {Test} from "forge-std/Test.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {ExternalSettlementGate} from "../../../src/execution/ExternalSettlementGate.sol";
import {ReferenceExternalSettlementTarget} from "../../../src/execution/targets/ReferenceExternalSettlementTarget.sol";
import {VenueRegistry} from "../../../src/execution/VenueRegistry.sol";
import {VenueSelector} from "../../../src/execution/VenueSelector.sol";
import {OperatorRegistry} from "../../../src/registry/OperatorRegistry.sol";
import {Affiliate} from "../../../src/compliance/elements/Affiliate.sol";
import {IComplianceEngine} from "../../../src/interfaces/compliance/IComplianceEngine.sol";
import {ContextEvidence} from "../../../src/execution/ContextEvidence.sol";
import {ContextPolicyRegistry} from "./ContextEvidence.t.sol";
import {MockERC20} from "../../mocks/MockERC20.sol";
import {ExecutionRequest, ExecutionResult} from "../../../src/types/ExecutionTypes.sol";
import {
    ComplianceContext,
    ComplianceDecision,
    FlowType,
    PolicyStatus,
    VenueType
} from "../../../src/types/ComplianceTypes.sol";
import {VenueConfig, VenueContextEvidence, CustodyModel} from "../../../src/types/VenueTypes.sol";
import {Errors} from "../../../src/libraries/Errors.sol";

contract ExternalGateEngine is IComplianceEngine {
    address public immutable policyReg;
    address public router;
    uint256 public holderCap = type(uint256).max;
    uint256 public decisionMaxAmount = type(uint256).max;
    uint256 public committedAmount;
    uint256 public commitCount;

    constructor(address registry) {
        policyReg = registry;
    }

    function setRouter(address value) external {
        if (router != address(0)) revert Errors.NotAuthorized();
        router = value;
    }

    function setHolderCap(uint256 value) external {
        holderCap = value;
    }

    function setDecisionMaxAmount(uint256 value) external {
        decisionMaxAmount = value;
    }

    function evaluate(ComplianceContext calldata ctx) external view returns (ComplianceDecision memory decision) {
        decision.allowed = committedAmount + ctx.amountOut <= holderCap;
        decision.policyId = keccak256("external-gate-policy");
        decision.policyVersion = 1;
        decision.maxAmount = decisionMaxAmount;
        decision.maxAmountToken = ctx.tokenOut;
        decision.allowedVenueTypes = uint256(1) << uint256(VenueType.ORDER_BOOK);
        decision.reasonCode = decision.allowed ? bytes32(0) : bytes32("HOLDER_CAP");
        decision.decisionHash = keccak256(abi.encode(ctx, committedAmount));
    }

    function policyHashesOf(address)
        external
        pure
        returns (bytes32 logicalPolicyHash, bytes32 executionBindingHash, bytes32 policyId)
    {
        return (bytes32(0), bytes32(0), keccak256("external-gate-policy"));
    }

    function recordPolicyAuditCheckpoint(address) external pure returns (bytes32 checkpointHash) {
        return keccak256("external-gate-policy");
    }

    function commit(ComplianceContext calldata ctx) external {
        if (msg.sender != router) revert Errors.NotAuthorized();
        committedAmount += ctx.amountOut;
        commitCount++;
    }
}

contract FeeOnTransferToken is ERC20 {
    constructor() ERC20("Fee Output", "FOUT") {}

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }

    function _transfer(address from, address to, uint256 amount) internal override {
        uint256 fee = amount / 100;
        super._transfer(from, to, amount - fee);
        super._transfer(from, address(0xDEAD), fee);
    }
}

contract ExternalSettlementGateTest is Test {
    VenueRegistry internal venues;
    VenueSelector internal selector;
    OperatorRegistry internal operators;
    ContextPolicyRegistry internal policy;
    Affiliate internal affiliate;
    ExternalGateEngine internal engine;
    ExternalSettlementGate internal gate;
    ReferenceExternalSettlementTarget internal target;
    MockERC20 internal tokenIn;
    MockERC20 internal tokenOut;

    address internal constant BUYER = address(0xB0B);
    address internal constant SELLER = address(0x515E);
    address internal constant VENUE = address(0xA75);
    bytes32 internal constant INSTRUCTION_1 = keccak256("instruction-1");

    function setUp() public {
        vm.warp(200 days);
        venues = new VenueRegistry();
        selector = new VenueSelector();
        operators = new OperatorRegistry();
        policy = new ContextPolicyRegistry();
        affiliate = new Affiliate();
        policy.setAffiliateSource(address(affiliate));
        engine = new ExternalGateEngine(address(policy));
        gate = new ExternalSettlementGate(engine, venues, selector, operators);
        engine.setRouter(address(gate));
        target = new ReferenceExternalSettlementTarget(address(gate), venues);
        tokenIn = new MockERC20("Input", "IN");
        tokenOut = new MockERC20("Output", "OUT");
        tokenIn.mint(BUYER, 10_000);
        tokenOut.mint(SELLER, 10_000);
        vm.prank(BUYER);
        tokenIn.approve(address(target), type(uint256).max);
        vm.prank(SELLER);
        tokenOut.approve(address(target), type(uint256).max);
        policy.setStatus(address(tokenIn), PolicyStatus.UNREGULATED);
        policy.setStatus(address(tokenOut), PolicyStatus.UNREGULATED);
        _registerVenue();
        _registerInstruction(INSTRUCTION_1, address(tokenOut), 100, 200);
    }

    function _registerVenue() internal {
        VenueConfig memory cfg =
            VenueConfig(VenueType.ORDER_BOOK, address(target), address(target), address(this), CustodyModel.NONE, true);
        venues.registerVenue(VENUE, cfg);
        venues.setContextImplementation(
            address(target).codehash, target.adapterVersion(), target.contextVersion(), true
        );
        venues.setVenueContextEvidence(
            VENUE,
            VenueContextEvidence({
                adapterVersion: target.adapterVersion(),
                contextVersion: target.contextVersion(),
                adapterCodeHash: address(target).codehash,
                affiliateSource: address(affiliate),
                affiliateSourceCodeHash: address(affiliate).codehash,
                policyRegistry: address(policy),
                policyRegistryCodeHash: address(policy).codehash,
                configurationHash: ContextEvidence.configurationHash(cfg)
            })
        );
    }

    function _registerInstruction(bytes32 id, address output, uint256 amountIn, uint256 amountOut) internal {
        target.registerInstruction(
            id,
            ReferenceExternalSettlementTarget.SettlementInstruction({
                buyer: BUYER,
                seller: SELLER,
                tokenIn: address(tokenIn),
                tokenOut: output,
                amountIn: amountIn,
                amountOut: amountOut,
                venue: VENUE,
                venueType: VenueType.ORDER_BOOK,
                flowType: FlowType.SECONDARY_TRADE,
                sellerIsAffiliate: false,
                validUntil: uint64(block.timestamp + 30 days)
            })
        );
    }

    function _request(bytes32 id, address output, uint256 amountIn, uint256 amountOut, uint256 nonce)
        internal
        view
        returns (ExecutionRequest memory req)
    {
        req.context = ComplianceContext({
            initiator: BUYER,
            buyer: BUYER,
            seller: SELLER,
            tokenIn: address(tokenIn),
            tokenOut: output,
            amountIn: amountIn,
            amountOut: amountOut,
            venueType: VenueType.ORDER_BOOK,
            venue: VENUE,
            flowType: FlowType.SECONDARY_TRADE,
            sellerIsAffiliate: false
        });
        req.amountOutMin = amountOut;
        req.deadline = uint64(block.timestamp + 1 hours);
        req.nonce = nonce;
        req.venueData = abi.encode(id);
    }

    function _execute(ExecutionRequest memory req) internal returns (ExecutionResult memory) {
        vm.prank(BUYER);
        return gate.execute(req);
    }

    function test_externalTargetSettlesWithoutExecutionAdapterAndCommitsMeasuredAmounts() public {
        ExecutionResult memory result = _execute(_request(INSTRUCTION_1, address(tokenOut), 100, 200, 1));
        assertEq(result.amountOut, 200);
        assertTrue(target.instructionSettled(INSTRUCTION_1));
        assertTrue(gate.usedNonce(BUYER, 1));
        assertEq(engine.committedAmount(), 200);
        assertEq(engine.commitCount(), 1);
        assertEq(tokenIn.balanceOf(BUYER), 9_900);
        assertEq(tokenIn.balanceOf(SELLER), 100);
        assertEq(tokenOut.balanceOf(BUYER), 200);
        assertEq(tokenOut.balanceOf(SELLER), 9_800);
    }

    function test_directTargetBypassIsRejected() public {
        vm.prank(BUYER);
        vm.expectRevert(Errors.NotAuthorized.selector);
        target.settle(_request(INSTRUCTION_1, address(tokenOut), 100, 200, 1));
        assertFalse(target.instructionSettled(INSTRUCTION_1));
    }

    function test_authoritativeInstructionMismatchRejectsBeforeEvaluation() public {
        ExecutionRequest memory req = _request(INSTRUCTION_1, address(tokenOut), 100, 201, 1);
        vm.mockCallRevert(address(engine), abi.encodeWithSelector(engine.evaluate.selector), "evaluation reached");
        vm.expectRevert(Errors.InvalidExecutionContext.selector);
        _execute(req);
        assertFalse(gate.usedNonce(BUYER, 1));
        assertFalse(target.instructionSettled(INSTRUCTION_1));
    }

    function test_contextEvidenceDriftRejectsBeforeEvaluation() public {
        VenueConfig memory cfg = venues.venueOf(VENUE);
        cfg.operator = address(0xBAD);
        venues.registerVenue(VENUE, cfg);
        vm.mockCallRevert(address(engine), abi.encodeWithSelector(engine.evaluate.selector), "evaluation reached");
        vm.expectRevert(Errors.InvalidContextEvidence.selector);
        _execute(_request(INSTRUCTION_1, address(tokenOut), 100, 200, 1));
        assertFalse(gate.usedNonce(BUYER, 1));
    }

    function test_targetBindingMismatchRejectsBeforeEvaluationEvenWithRefreshedEvidence() public {
        VenueConfig memory cfg = venues.venueOf(VENUE);
        cfg.target = address(0xBAD);
        venues.registerVenue(VENUE, cfg);
        venues.setVenueContextEvidence(
            VENUE,
            VenueContextEvidence({
                adapterVersion: target.adapterVersion(),
                contextVersion: target.contextVersion(),
                adapterCodeHash: address(target).codehash,
                affiliateSource: address(affiliate),
                affiliateSourceCodeHash: address(affiliate).codehash,
                policyRegistry: address(policy),
                policyRegistryCodeHash: address(policy).codehash,
                configurationHash: ContextEvidence.configurationHash(cfg)
            })
        );
        vm.mockCallRevert(address(engine), abi.encodeWithSelector(engine.evaluate.selector), "evaluation reached");
        vm.expectRevert(Errors.InvalidContextEvidence.selector);
        _execute(_request(INSTRUCTION_1, address(tokenOut), 100, 200, 1));
        assertFalse(gate.usedNonce(BUYER, 1));
    }

    function test_targetWithoutGateEnforcementRejectsBeforeEvaluation() public {
        vm.mockCall(address(target), abi.encodeWithSelector(target.gateEnforced.selector), abi.encode(false));
        vm.mockCallRevert(address(engine), abi.encodeWithSelector(engine.evaluate.selector), "evaluation reached");
        vm.expectRevert(Errors.InvalidContextEvidence.selector);
        _execute(_request(INSTRUCTION_1, address(tokenOut), 100, 200, 1));
        assertFalse(gate.usedNonce(BUYER, 1));
    }

    function test_pauseAndReplayRemainGateInvariants() public {
        operators.setVenueSuspended(VENUE, true, keccak256("incident"));
        vm.expectRevert(Errors.VenueSuspended.selector);
        _execute(_request(INSTRUCTION_1, address(tokenOut), 100, 200, 1));
        assertFalse(gate.usedNonce(BUYER, 1));

        vm.warp(block.timestamp + operators.MIN_UNPAUSE_DELAY());
        operators.scheduleVenueUnpause(VENUE, keccak256("recover"));
        vm.warp(block.timestamp + operators.MIN_UNPAUSE_DELAY());
        operators.executeVenueUnpause(VENUE);
        _execute(_request(INSTRUCTION_1, address(tokenOut), 100, 200, 1));
        vm.expectRevert(Errors.NonceUsed.selector);
        _execute(_request(INSTRUCTION_1, address(tokenOut), 100, 200, 1));
    }

    function test_finiteDecisionAmountRejectsBeforeSettlementAndRollsBackNonce() public {
        engine.setDecisionMaxAmount(199);
        vm.expectRevert(Errors.MaxAmountExceeded.selector);
        _execute(_request(INSTRUCTION_1, address(tokenOut), 100, 200, 1));
        assertFalse(gate.usedNonce(BUYER, 1));
        assertFalse(target.instructionSettled(INSTRUCTION_1));
    }

    function test_measuredAmountMismatchRollsBackSettlementAndInstructionState() public {
        FeeOnTransferToken feeToken = new FeeOnTransferToken();
        feeToken.mint(SELLER, 1_000);
        vm.prank(SELLER);
        feeToken.approve(address(target), type(uint256).max);
        policy.setStatus(address(feeToken), PolicyStatus.UNREGULATED);
        bytes32 id = keccak256("fee-instruction");
        _registerInstruction(id, address(feeToken), 100, 200);
        vm.expectRevert(Errors.SettlementAmountMismatch.selector);
        _execute(_request(id, address(feeToken), 100, 200, 2));
        assertFalse(gate.usedNonce(BUYER, 2));
        assertFalse(target.instructionSettled(id));
        assertEq(tokenIn.balanceOf(BUYER), 10_000);
        assertEq(feeToken.balanceOf(BUYER), 0);
        assertEq(feeToken.balanceOf(SELLER), 1_000);
    }

    function test_twoAdvisoryEvaluationsMayPassButOnlyFreshValidFinalSettlementCommits() public {
        bytes32 secondId = keccak256("instruction-2");
        _registerInstruction(secondId, address(tokenOut), 100, 200);
        ExecutionRequest memory first = _request(INSTRUCTION_1, address(tokenOut), 100, 200, 1);
        ExecutionRequest memory second = _request(secondId, address(tokenOut), 100, 200, 2);
        engine.setHolderCap(300);

        assertTrue(engine.evaluate(first.context).allowed);
        assertTrue(engine.evaluate(second.context).allowed);
        _execute(first);
        vm.expectRevert(abi.encodeWithSelector(Errors.ComplianceRejected.selector, bytes32("HOLDER_CAP")));
        _execute(second);

        assertEq(engine.commitCount(), 1);
        assertEq(engine.committedAmount(), 200);
        assertFalse(gate.usedNonce(BUYER, 2));
        assertFalse(target.instructionSettled(secondId));
    }
}
