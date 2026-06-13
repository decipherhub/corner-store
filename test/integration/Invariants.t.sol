// SPDX-License-Identifier: GPL-3.0
pragma solidity 0.8.17;

import {IntegrationBase} from "./IntegrationBase.sol";
import {ExecutionRouter} from "../../src/execution/ExecutionRouter.sol";
import {ExecutionRequest} from "../../src/types/ExecutionTypes.sol";
import {ComplianceDecision, VenueType} from "../../src/types/ComplianceTypes.sol";
import {Errors} from "../../src/libraries/Errors.sol";
import {MockComplianceEngine} from "../mocks/MockComplianceEngine.sol";

/// @notice System invariants asserted as plain unit-style checks (no fuzzing
///         harness needed). These pin the router's safety gates against the
///         fully-wired real stack, plus one router-level maxAmount check using a
///         MockComplianceEngine (see the note on that test for why).
contract InvariantsTest is IntegrationBase {
    function setUp() public {
        deployStack();
        setupBuyer(alice);
        fundPoolRWA(1_000 ether);
        fundBuyerQuote(alice, 1_000 ether);
    }

    // --- unregistered venue → AdapterNotRegistered -----------------------
    // allowedVenuesHash==0 lets the selector pass any venue, so an unknown venue
    // falls through to the adapter-resolution gate.
    function test_unregisteredVenue_adapterNotRegistered() public {
        ExecutionRequest memory req = buildBuyRequest(alice, 50 ether, 50 ether);
        req.context.venue = address(0xDEAD); // not in VenueRegistry

        vm.prank(alice);
        vm.expectRevert(Errors.AdapterNotRegistered.selector);
        router.execute(req);
    }

    // --- venue type not allowed → VenueNotAllowed ------------------------
    // Request an ORDER_BOOK venue type; the decision only permits AMM (bit0).
    function test_venueTypeNotAllowed_venueNotAllowed() public {
        ExecutionRequest memory req = buildBuyRequest(alice, 50 ether, 50 ether);
        req.context.venueType = VenueType.ORDER_BOOK;

        vm.prank(alice);
        vm.expectRevert(Errors.VenueNotAllowed.selector);
        router.execute(req);
    }

    // --- nonce replay → NonceUsed ----------------------------------------
    // The router records usedNonce[msg.sender][nonce]; replaying the SAME request
    // (same caller + nonce) reverts. The engine recomputes per call, so there is
    // no cross-ctx decision reuse — replay protection is purely the nonce gate.
    function test_nonceReplay_nonceUsed() public {
        ExecutionRequest memory req = buildBuyRequest(alice, 50 ether, 50 ether);
        vm.prank(alice);
        router.execute(req);

        // same nonce, same caller → NonceUsed.
        vm.prank(alice);
        vm.expectRevert(Errors.NonceUsed.selector);
        router.execute(req);
    }

    // --- non-custodial invariant after a real swap -----------------------
    // After a successful swap the router AND adapter hold zero of BOTH tokens.
    function test_nonCustodial_zeroBalancesAfterSwap() public {
        ExecutionRequest memory req = buildBuyRequest(alice, 100 ether, 100 ether);
        vm.prank(alice);
        router.execute(req);

        assertEq(rwaToken.balanceOf(address(router)), 0, "router RWA == 0");
        assertEq(quote.balanceOf(address(router)), 0, "router quote == 0");
        assertEq(rwaToken.balanceOf(address(adapter)), 0, "adapter RWA == 0");
        assertEq(quote.balanceOf(address(adapter)), 0, "adapter quote == 0");
    }

    // --- suspended venue blocks (kill-switch invariant) ------------------
    function test_suspendedVenue_blocks() public {
        operatorReg.setVenueSuspended(address(pool), true, bytes32("kill"));
        ExecutionRequest memory req = buildBuyRequest(alice, 50 ether, 50 ether);
        vm.prank(alice);
        vm.expectRevert(Errors.VenueSuspended.selector);
        router.execute(req);
    }

    // --- maxAmount gate (router-enforced) --------------------------------
    // HONEST NOTE: the REAL ComplianceEngine currently returns
    // maxAmount = type(uint256).max (skeleton: no quantitative cap), so the
    // real-engine path can never trip MaxAmountExceeded. The gate itself lives
    // in ExecutionRouter (`amountIn > d.maxAmount → MaxAmountExceeded`). To test
    // it honestly we stand up a router backed by a MockComplianceEngine that
    // returns a constrained maxAmount — exercising the router gate directly
    // rather than faking the engine's behavior in the integration path.
    function test_maxAmount_routerGate_withMockDecision() public {
        MockComplianceEngine mockEngine = new MockComplianceEngine();
        ExecutionRouter mockRouter = new ExecutionRouter(mockEngine, venueReg, selector, operatorReg);

        ComplianceDecision memory d;
        d.allowed = true;
        d.allowedVenueTypes = 1 << uint256(VenueType.AMM);
        d.allowedVenuesHash = bytes32(0);
        d.maxAmount = 10 ether; // constrained cap
        mockEngine.setDecision(d);

        // amountIn (50e18) > maxAmount (10e18) → MaxAmountExceeded before dispatch.
        ExecutionRequest memory req = buildBuyRequest(alice, 50 ether, 50 ether);
        vm.prank(alice);
        vm.expectRevert(Errors.MaxAmountExceeded.selector);
        mockRouter.execute(req);

        // and within the cap it passes the gate (reaches the adapter & settles).
        ExecutionRequest memory ok = buildBuyRequest(alice, 5 ether, 5 ether);
        vm.prank(alice);
        mockRouter.execute(ok);
        assertEq(rwaToken.balanceOf(alice), 5 ether, "swap within maxAmount settled");
    }
}
