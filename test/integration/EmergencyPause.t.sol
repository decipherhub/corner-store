// SPDX-License-Identifier: GPL-3.0
pragma solidity 0.8.17;

import {IntegrationBase} from "./IntegrationBase.sol";
import {ExecutionRequest} from "../../src/types/ExecutionTypes.sol";
import {PolicyStatus} from "../../src/types/ComplianceTypes.sol";
import {Errors} from "../../src/libraries/Errors.sol";

/// @notice Two independent kill switches, exercised through the router:
///   (1) OperatorRegistry.setVenueSuspended → router reverts VenueSuspended.
///   (2) TokenPolicyRegistry.setStatus(SUSPENDED) → engine fail-closes →
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
        policyReg.setStatus(address(rwaToken), PolicyStatus.SUSPENDED, bytes32("EMERGENCY"));

        ExecutionRequest memory req = buildBuyRequest(alice, 50 ether, 50 ether);
        vm.prank(alice);
        vm.expectRevert(); // ComplianceRejected(reasonCode) — POLICY/SUSPENDED
        router.execute(req);

        assertEq(rwaToken.balanceOf(alice), 0, "no RWA while policy suspended");
        assertEq(quote.balanceOf(alice), 1_000 ether, "no quote spent");
    }
}
