// SPDX-License-Identifier: GPL-3.0
pragma solidity 0.8.17;

import {IntegrationBase} from "./IntegrationBase.sol";
import {ExecutionRequest} from "../../src/types/ExecutionTypes.sol";
import {Errors} from "../../src/libraries/Errors.sol";

/// @notice Two independent kill switches, exercised through the router:
///   (1) OperatorRegistry.setVenueSuspended → router reverts VenueSuspended.
///   (2) TokenPolicyRegistry.suspendManifest(SUSPENDED) → engine fail-closes →
///       router reverts ComplianceRejected.
contract EmergencyPauseTest is IntegrationBase {
    function setUp() public {
        deployStack();
        setupBuyer(alice);
        fundPoolRWA(1_000 ether);
        fundBuyerQuote(alice, 1_000 ether);
    }

    function test_venueSuspended_blocksSwap() public {
        // sanity: swap works before suspension.
        ExecutionRequest memory ok = buildBuyRequest(alice, 50 ether, 50 ether);
        vm.prank(alice);
        router.execute(ok);
        assertEq(rwaToken.balanceOf(alice), 50 ether, "baseline swap");

        // operator suspends the venue (kill switch).
        operatorReg.setVenueSuspended(address(pool), true, bytes32("EMERGENCY"));

        ExecutionRequest memory req = buildBuyRequest(alice, 50 ether, 50 ether);
        vm.prank(alice);
        vm.expectRevert(Errors.VenueSuspended.selector);
        router.execute(req);

        // nothing further moved.
        assertEq(rwaToken.balanceOf(alice), 50 ether, "no extra RWA while suspended");
    }

    function test_policySuspended_failsClosed() public {
        // suspend the RWA token's policy → engine fail-closes on a SUSPENDED side.
        policyReg.suspendManifest(address(rwaToken), bytes32("EMERGENCY"));

        ExecutionRequest memory req = buildBuyRequest(alice, 50 ether, 50 ether);
        vm.prank(alice);
        vm.expectPartialRevert(Errors.ComplianceRejected.selector); // POLICY/SUSPENDED
        router.execute(req);

        assertEq(rwaToken.balanceOf(alice), 0, "no RWA while policy suspended");
        assertEq(quote.balanceOf(alice), 1_000 ether, "no quote spent");
    }

    // A PROPOSED (registered but not yet operator-approved) manifest must be
    // rejected end-to-end: the engine's default-deny gate fails closed before any
    // recipe runs. Drive rwaToken back to PROPOSED via retire -> register
    // (deployStack left it ACTIVE and re-register over ACTIVE is illegal).
    function test_proposedPolicy_failsClosed() public {
        policyReg.retireManifest(address(rwaToken), bytes32("REISSUE"));
        policyReg.registerManifest(address(rwaToken), _activeManifest(0, 0)); // PROPOSED, not approved

        ExecutionRequest memory req = buildBuyRequest(alice, 50 ether, 50 ether);
        vm.prank(alice);
        vm.expectPartialRevert(Errors.ComplianceRejected.selector); // POLICY/PROPOSED
        router.execute(req);

        assertEq(rwaToken.balanceOf(alice), 0, "no RWA while policy only PROPOSED");
        assertEq(quote.balanceOf(alice), 1_000 ether, "no quote spent");
    }

    // A RETIRED (terminal) manifest must be rejected end-to-end for the same
    // default-deny reason.
    function test_retiredPolicy_failsClosed() public {
        policyReg.retireManifest(address(rwaToken), bytes32("EOL")); // ACTIVE -> RETIRED

        ExecutionRequest memory req = buildBuyRequest(alice, 50 ether, 50 ether);
        vm.prank(alice);
        vm.expectPartialRevert(Errors.ComplianceRejected.selector); // POLICY/RETIRED
        router.execute(req);

        assertEq(rwaToken.balanceOf(alice), 0, "no RWA while policy RETIRED");
        assertEq(quote.balanceOf(alice), 1_000 ether, "no quote spent");
    }

    // A suspension is reversible: after resume the token is ACTIVE again and a
    // trade that was blocked while SUSPENDED settles once more.
    function test_suspendThenResume_tradesAgain() public {
        // suspend → blocked.
        policyReg.suspendManifest(address(rwaToken), bytes32("EMERGENCY"));
        ExecutionRequest memory blocked = buildBuyRequest(alice, 50 ether, 50 ether);
        vm.prank(alice);
        vm.expectPartialRevert(Errors.ComplianceRejected.selector); // POLICY/SUSPENDED
        router.execute(blocked);
        assertEq(rwaToken.balanceOf(alice), 0, "blocked while suspended");

        // resume → ACTIVE again → trade settles.
        policyReg.resumeManifest(address(rwaToken));
        ExecutionRequest memory ok = buildBuyRequest(alice, 50 ether, 50 ether);
        vm.prank(alice);
        router.execute(ok);
        assertEq(rwaToken.balanceOf(alice), 50 ether, "trade settles after resume");
    }
}
