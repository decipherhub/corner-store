// SPDX-License-Identifier: GPL-3.0
pragma solidity 0.8.17;

import {IntegrationBase} from "./IntegrationBase.sol";
import {BuidlLikeDemoAsset} from "../../src/demo/BuidlLikeDemoAsset.sol";
import {ExecutionRequest} from "../../src/types/ExecutionTypes.sol";

/// @notice Local BUIDL-like ERC-3643 demo asset flow.
///
/// This is intentionally NOT real BlackRock BUIDL integration. The test deploys
/// the project ERC-3643/T-REX fixture with BUIDL-like metadata and binds a
/// Manifest that models the minimum current demo fact: Reg D 506(c) issuance +
/// ICA 3(c)(7) fund status. In this skeleton, `factsPacked bit0` activates the
/// Fund3c7Recipe, which adds A-13 Qualified Purchaser to the router gate.
contract BUIDLLikeFlowTest is IntegrationBase {
    function setUp() public {
        deployBuidlLikeStack();
    }

    function test_buidlLikeAssetMetadataAndManifest() public view {
        assertEq(rwaToken.name(), BuidlLikeDemoAsset.TOKEN_NAME, "demo asset name");
        assertEq(rwaToken.symbol(), BuidlLikeDemoAsset.TOKEN_SYMBOL, "demo asset symbol");
        assertEq(uint8(policyReg.statusOf(address(rwaToken))), 2, "manifest active");
        assertEq(
            policyReg.manifestOf(address(rwaToken)).issuanceRecipeId,
            BuidlLikeDemoAsset.ISSUANCE_RECIPE_ID,
            "RegD 506c recipe"
        );
        assertEq(
            policyReg.manifestOf(address(rwaToken)).fundRecipeId, BuidlLikeDemoAsset.FUND_RECIPE_ID, "3c7 fund recipe"
        );
        assertEq(
            policyReg.manifestOf(address(rwaToken)).factsPacked & BuidlLikeDemoAsset.FACT_FUND_APPLICABLE,
            BuidlLikeDemoAsset.FACT_FUND_APPLICABLE,
            "fund fact enabled"
        );
    }

    function test_buidlLike_qpBuyerCanTradeThroughProtectedRouter() public {
        setupBuyer(alice); // ERC-3643 verified + accredited + non-sanctioned
        qp.setQp(alice, true);
        fundPoolRWA(1_000 ether);
        fundBuyerQuote(alice, 1_000 ether);

        ExecutionRequest memory req = buildBuyRequest(alice, 100 ether, 100 ether);
        doBuy(req);

        assertEq(rwaToken.balanceOf(alice), 100 ether, "QP buyer received BUIDL-like asset");
        assertEq(quote.balanceOf(alice), 900 ether, "buyer paid quote");
    }

    function test_buidlLike_accreditedButNonQpBuyerRejectedBeforeTokenMoves() public {
        setupBuyer(alice); // accredited is not enough for this BUIDL-like fund asset
        fundPoolRWA(1_000 ether);
        fundBuyerQuote(alice, 1_000 ether);

        uint256 aliceQuoteBefore = quote.balanceOf(alice);
        uint256 poolRwaBefore = rwaToken.balanceOf(address(pool));

        ExecutionRequest memory req = buildBuyRequest(alice, 100 ether, 100 ether);

        vm.prank(alice);
        vm.expectRevert(); // ComplianceRejected: A-13-v1 from Fund3c7Recipe
        router.execute(req);

        assertEq(rwaToken.balanceOf(alice), 0, "non-QP receives no BUIDL-like asset");
        assertEq(quote.balanceOf(alice), aliceQuoteBefore, "quote not pulled on compliance reject");
        assertEq(rwaToken.balanceOf(address(pool)), poolRwaBefore, "pool RWA unchanged");
    }
}
