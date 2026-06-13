// SPDX-License-Identifier: GPL-3.0
pragma solidity 0.8.17;

import {IntegrationBase} from "./IntegrationBase.sol";
import {ExecutionRequest} from "../../src/types/ExecutionTypes.sol";

/// @notice Proves conditional recipe activation (3(c)(7) fund recipe) through the
///         FULL router path — not just the engine unit. The manifest carries
///         fundRecipeId=2; whether the QualifiedPurchaser element is required is
///         gated end-to-end by factsPacked bit0 via Fund3c7Recipe.isApplicable.
contract MultiRecipeTest is IntegrationBase {
    function _wireBuyer() internal {
        setupBuyer(alice); // verified + accredited (RegD506c satisfied)
        fundPoolRWA(1_000 ether);
        fundBuyerQuote(alice, 1_000 ether);
    }

    // fundRecipeId=2 + bit0 set → QP REQUIRED. Accredited-but-not-qp → reject;
    // then grant qp → success. Conditional activation observed through the router.
    function test_fundApplicable_requiresQp_thenSucceeds() public {
        deployStack(2, 1); // fund recipe + facts bit0 set
        _wireBuyer();

        ExecutionRequest memory req = buildBuyRequest(alice, 100 ether, 100 ether);

        // not QP yet → cumulative AND fails at A-13-v1 → ComplianceRejected.
        vm.prank(alice);
        vm.expectRevert();
        router.execute(req);
        assertEq(rwaToken.balanceOf(alice), 0, "no RWA before QP granted");

        // grant QP → now the union (A-01, A-03, A-13) all pass → swap succeeds.
        qp.setQp(alice, true);
        ExecutionRequest memory req2 = buildBuyRequest(alice, 100 ether, 100 ether);
        vm.prank(alice);
        router.execute(req2);
        assertEq(rwaToken.balanceOf(alice), 100 ether, "RWA delivered once QP granted");
    }

    // fundRecipeId=2 but bit0 CLEAR → Fund3c7.isApplicable == false → QP NOT
    // required. Accredited-only buyer (no QP) succeeds. Proves the isApplicable
    // gate reaches all the way through the router.
    function test_fundInapplicable_qpNotRequired_succeeds() public {
        deployStack(2, 0); // fund recipe present but facts bit0 NOT set
        _wireBuyer();
        // intentionally do NOT set qp(alice).

        ExecutionRequest memory req = buildBuyRequest(alice, 100 ether, 100 ether);
        vm.prank(alice);
        router.execute(req);

        assertEq(rwaToken.balanceOf(alice), 100 ether, "RWA delivered: QP not required");
    }
}
