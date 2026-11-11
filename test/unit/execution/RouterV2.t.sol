// SPDX-License-Identifier: GPL-3.0
pragma solidity 0.8.17;

import {Test} from "forge-std/Test.sol";
import {ExecutionRouterV2} from "../../../src/execution/ExecutionRouterV2.sol";
import {VenueRegistry} from "../../../src/execution/VenueRegistry.sol";
import {VenueSelector} from "../../../src/execution/VenueSelector.sol";
import {OperatorRegistry} from "../../../src/registry/OperatorRegistry.sol";
import {Affiliate} from "../../../src/compliance/elements/Affiliate.sol";
import {MockComplianceEngine} from "../../mocks/MockComplianceEngine.sol";
import {MockContextAdapter} from "../../mocks/MockContextAdapter.sol";
import {MockERC20} from "../../mocks/MockERC20.sol";
import {ContextPolicyRegistry} from "./ContextEvidence.t.sol";
import {ContextEvidence} from "../../../src/execution/ContextEvidence.sol";
import {ExecutionRequest, ExecutionResult} from "../../../src/types/ExecutionTypes.sol";
import {VenueConfig, VenueContextEvidence, CustodyModel} from "../../../src/types/VenueTypes.sol";
import {ComplianceContext, ComplianceDecision, PolicyStatus, VenueType} from "../../../src/types/ComplianceTypes.sol";
import {Errors} from "../../../src/libraries/Errors.sol";
import {Events} from "../../../src/libraries/Events.sol";

contract ContextEngine is MockComplianceEngine {
    address public immutable policyReg;

    constructor(address registry) {
        policyReg = registry;
    }
}

contract RouterV2Test is Test {
    ExecutionRouterV2 internal router;
    VenueRegistry internal venues;
    VenueSelector internal selector;
    OperatorRegistry internal operators;
    ContextEngine internal engine;
    ContextPolicyRegistry internal policy;
    Affiliate internal affiliate;
    MockContextAdapter internal adapter;
    MockERC20 internal tokenIn;
    MockERC20 internal tokenOut;
    VenueConfig internal cfg;
    VenueContextEvidence internal evidence;
    address internal constant BUYER = address(0xB0B);
    address internal constant VENUE = address(0xCAFE);
    address internal constant ISSUER = address(0x155);

    function setUp() public {
        vm.warp(200 days);
        venues = new VenueRegistry();
        selector = new VenueSelector();
        operators = new OperatorRegistry();
        policy = new ContextPolicyRegistry();
        engine = new ContextEngine(address(policy));
        affiliate = new Affiliate();
        adapter = new MockContextAdapter();
        router = new ExecutionRouterV2(engine, venues, selector, operators);
        adapter.setRouter(address(router));
        tokenIn = new MockERC20("In", "IN");
        tokenOut = new MockERC20("Out", "OUT");
        tokenIn.mint(BUYER, 10000);
        tokenOut.mint(address(adapter), 10000);
        vm.prank(BUYER);
        tokenIn.approve(address(adapter), type(uint256).max);
        policy.setStatus(address(tokenIn), PolicyStatus.UNREGULATED);
        policy.setStatus(address(tokenOut), PolicyStatus.ACTIVE);
        affiliate.setTrustedClaimIssuer(ISSUER, true);
        affiliate.setClaim(
            address(adapter),
            address(tokenOut),
            Affiliate.AffiliateBasis.NOT_AFFILIATE,
            Affiliate.DeterminationSource.ISSUER_REGISTRY,
            ISSUER,
            uint64(block.timestamp),
            0
        );
        cfg = VenueConfig(VenueType.RFQ, address(adapter), VENUE, address(0), CustodyModel.NONE, true);
        venues.registerVenue(VENUE, cfg);
        venues.setContextImplementation(address(adapter).codehash, 3, 1, true);
        evidence = VenueContextEvidence({
            adapterVersion: 3,
            contextVersion: 1,
            adapterCodeHash: address(adapter).codehash,
            affiliateSource: address(affiliate),
            affiliateSourceCodeHash: address(affiliate).codehash,
            policyRegistry: address(policy),
            policyRegistryCodeHash: address(policy).codehash,
            configurationHash: ContextEvidence.configurationHash(cfg)
        });
        venues.setVenueContextEvidence(VENUE, evidence);
        ComplianceDecision memory d;
        d.allowed = true;
        d.allowedVenueTypes = 1 << uint256(VenueType.RFQ);
        d.maxAmount = type(uint256).max;
        engine.setDecision(d);
    }

    function _req() internal view returns (ExecutionRequest memory req) {
        req.context.initiator = BUYER;
        req.context.buyer = BUYER;
        req.context.seller = address(adapter);
        req.context.tokenIn = address(tokenIn);
        req.context.tokenOut = address(tokenOut);
        req.context.amountIn = 100;
        req.context.amountOut = 200;
        req.context.venue = VENUE;
        req.context.venueType = VenueType.RFQ;
        req.deadline = uint64(block.timestamp + 1 hours);
        req.nonce = 1;
    }

    function _execute() internal returns (ExecutionResult memory) {
        vm.prank(BUYER);
        return router.execute(_req());
    }

    function _assertRollback() internal view {
        assertFalse(router.usedNonce(BUYER, 1));
        assertEq(adapter.callCount(), 0);
        assertEq(engine.commitCount(), 0);
        assertEq(tokenIn.balanceOf(BUYER), 10000);
        assertEq(tokenOut.balanceOf(BUYER), 0);
    }

    function _rejectEvaluation() internal {
        vm.mockCallRevert(address(engine), abi.encodeWithSelector(engine.evaluate.selector), "evaluation reached");
    }

    function test_verifiedExecutionMeasuresCommitsAndEmits() public {
        ExecutionRequest memory req = _req();
        bytes32 executionId = keccak256(abi.encode(req, block.number));
        vm.expectEmit(true, true, false, true);
        emit Events.Executed(executionId, VENUE, 200);
        ExecutionResult memory result = _execute();
        assertEq(result.amountOut, 200);
        assertTrue(router.usedNonce(BUYER, 1));
        assertEq(engine.commitCount(), 1);
        assertEq(engine.lastCommit().amountIn, 100);
        assertEq(engine.lastCommit().amountOut, 200);
        assertEq(tokenIn.balanceOf(BUYER), 9900);
        assertEq(tokenOut.balanceOf(BUYER), 200);
    }

    function test_missingEvidenceRejectsBeforeEvaluation() public {
        venues.registerVenue(VENUE, cfg);
        _rejectEvaluation();
        vm.expectRevert(Errors.InvalidContextEvidence.selector);
        _execute();
        _assertRollback();
    }

    function test_configurationDriftRejectsBeforeEvaluation() public {
        adapter.setConfiguration(bytes32("drift"));
        _rejectEvaluation();
        vm.expectRevert(Errors.InvalidContextEvidence.selector);
        _execute();
        _assertRollback();
    }

    function test_adapterRuntimeDriftRejectsBeforeEvaluation() public {
        vm.etch(address(adapter), hex"00");
        _rejectEvaluation();
        vm.expectRevert(Errors.InvalidContextEvidence.selector);
        _execute();
        assertFalse(router.usedNonce(BUYER, 1));
        assertEq(engine.commitCount(), 0);
    }

    function test_sourceRuntimeDriftRejectsBeforeEvaluation() public {
        vm.etch(address(affiliate), hex"00");
        _rejectEvaluation();
        vm.expectRevert(Errors.InvalidContextEvidence.selector);
        _execute();
        _assertRollback();
    }

    function test_policyRuntimeDriftRejectsBeforeEvaluation() public {
        vm.etch(address(policy), hex"00");
        _rejectEvaluation();
        vm.expectRevert(Errors.InvalidContextEvidence.selector);
        _execute();
        _assertRollback();
    }

    function test_revokedImplementationRejectsBeforeEvaluation() public {
        venues.setContextImplementation(address(adapter).codehash, 3, 1, false);
        _rejectEvaluation();
        vm.expectRevert(Errors.ContextImplementationNotApproved.selector);
        _execute();
        _assertRollback();
    }

    function test_adapterPreflightRejectsBeforeEvaluation() public {
        adapter.setRejectContext(true);
        _rejectEvaluation();
        vm.expectRevert(Errors.InvalidExecutionContext.selector);
        _execute();
        _assertRollback();
    }

    function test_conflictingStatusesCannotBeBypassedByNoOpVerifier() public {
        policy.setStatus(address(tokenIn), PolicyStatus.ACTIVE);
        affiliate.setClaim(
            BUYER,
            address(tokenIn),
            Affiliate.AffiliateBasis.OFFICER_DIRECTOR,
            Affiliate.DeterminationSource.ISSUER_REGISTRY,
            ISSUER,
            uint64(block.timestamp),
            0
        );
        _rejectEvaluation();
        vm.expectRevert(Errors.ConflictingAffiliateStatus.selector);
        _execute();
        _assertRollback();
    }

    function test_booleanCannotBeForgedWithApprovedNoOpVerifier() public {
        ExecutionRequest memory req = _req();
        req.context.sellerIsAffiliate = true;
        _rejectEvaluation();
        vm.prank(BUYER);
        vm.expectRevert(Errors.InvalidExecutionContext.selector);
        router.execute(req);
        _assertRollback();
    }

    function test_wrongPolicyRegistryCannotClassifyAssetsUnregulated() public {
        ContextPolicyRegistry fake = new ContextPolicyRegistry();
        fake.setStatus(address(tokenIn), PolicyStatus.UNREGULATED);
        fake.setStatus(address(tokenOut), PolicyStatus.UNREGULATED);
        evidence.policyRegistry = address(fake);
        evidence.policyRegistryCodeHash = address(fake).codehash;
        venues.setVenueContextEvidence(VENUE, evidence);
        _rejectEvaluation();
        vm.expectRevert(Errors.InvalidContextEvidence.selector);
        _execute();
        _assertRollback();
    }

    function test_wrongRouterBindingRejectsEvenWithRefreshedEvidence() public {
        adapter.setRouter(address(0xBAD));
        evidence.configurationHash = ContextEvidence.configurationHash(cfg);
        venues.setVenueContextEvidence(VENUE, evidence);
        _rejectEvaluation();
        vm.expectRevert(Errors.InvalidContextEvidence.selector);
        _execute();
        _assertRollback();
    }

    function test_venueTypeMismatchBeforeEvaluation() public {
        ExecutionRequest memory req = _req();
        req.context.venueType = VenueType.AMM;
        _rejectEvaluation();
        vm.prank(BUYER);
        vm.expectRevert(Errors.VenueTypeMismatch.selector);
        router.execute(req);
        _assertRollback();
    }

    function test_unregisteredVenueBeforeEvaluation() public {
        cfg.active = false;
        venues.registerVenue(VENUE, cfg);
        _rejectEvaluation();
        vm.expectRevert(Errors.AdapterNotRegistered.selector);
        _execute();
        _assertRollback();
    }

    function test_callerBindingBeforePreflight() public {
        adapter.setRejectContext(true);
        vm.expectRevert(Errors.NotAuthorized.selector);
        router.execute(_req());
        _assertRollback();
    }

    function test_pauseBeforePreflight() public {
        operators.setGlobalPaused(true, bytes32("incident"));
        adapter.setRejectContext(true);
        vm.expectRevert(Errors.GlobalPaused.selector);
        _execute();
        _assertRollback();
    }

    function test_nonceReplayRejects() public {
        _execute();
        vm.expectRevert(Errors.NonceUsed.selector);
        _execute();
        assertEq(engine.commitCount(), 1);
    }

    function test_measurementFailureRollsBackAndSameNonceCanRetry() public {
        adapter.setAmountOut(201);
        vm.expectRevert(Errors.SettlementAmountMismatch.selector);
        _execute();
        _assertRollback();
        adapter.setAmountOut(200);
        _execute();
        assertEq(engine.commitCount(), 1);
    }

    function test_commitFailureRollsBackAndSameNonceCanRetry() public {
        vm.mockCallRevert(address(engine), abi.encodeWithSelector(engine.commit.selector), "commit failed");
        vm.expectRevert(bytes("commit failed"));
        _execute();
        _assertRollback();
        vm.clearMockedCalls();
        _execute();
        assertEq(engine.commitCount(), 1);
    }

    function test_constructorRejectsMissingPolicyRegistryCode() public {
        ContextEngine missing = new ContextEngine(address(0));
        vm.expectRevert(Errors.InvalidContextEvidence.selector);
        new ExecutionRouterV2(missing, venues, selector, operators);
    }
}
