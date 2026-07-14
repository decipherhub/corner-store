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
/// BuidlLikeFundRecipe, which adds A-13 Qualified Purchaser plus the demo minimum investment gate.
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
            policyReg.manifestOf(address(rwaToken)).fundRecipeId,
            BuidlLikeDemoAsset.FUND_RECIPE_ID,
            "BUIDL-like fund recipe"
        );
        assertEq(
            policyReg.manifestOf(address(rwaToken)).factsPacked & BuidlLikeDemoAsset.FACT_FUND_APPLICABLE,
            BuidlLikeDemoAsset.FACT_FUND_APPLICABLE,
            "fund fact enabled"
        );
        assertEq(
            policyReg.manifestOf(address(rwaToken)).fullManifestHash,
            keccak256(
                abi.encode(
                    BuidlLikeDemoAsset.PROFILE_KEY,
                    BuidlLikeDemoAsset.SECURITIZE_DS_ADAPTER_SEAM,
                    BuidlLikeDemoAsset.CLAIM_TOPIC_ACCREDITED_INVESTOR,
                    BuidlLikeDemoAsset.CLAIM_TOPIC_QUALIFIED_PURCHASER,
                    BuidlLikeDemoAsset.MINIMUM_INVESTMENT_AMOUNT
                )
            ),
            "profile hash anchors demo assumptions"
        );
    }

    function test_buidlLike_qpBuyerCanTradeThroughProtectedRouter() public {
        setupBuyer(alice); // ERC-3643 verified + accredited + non-sanctioned
        qp.setQp(alice, true);
        fundPoolRWA(6_000_000 ether);
        fundBuyerQuote(alice, 6_000_000 ether);

        ExecutionRequest memory req = buildBuyRequest(
            alice, BuidlLikeDemoAsset.MINIMUM_INVESTMENT_AMOUNT, BuidlLikeDemoAsset.MINIMUM_INVESTMENT_AMOUNT
        );
        doBuy(req);

        assertEq(
            rwaToken.balanceOf(alice),
            BuidlLikeDemoAsset.MINIMUM_INVESTMENT_AMOUNT,
            "QP buyer received BUIDL-like asset"
        );
        assertEq(quote.balanceOf(alice), 1_000_000 ether, "buyer paid quote");
    }

    function test_buidlLike_accreditedButNonQpBuyerRejectedBeforeTokenMoves() public {
        setupBuyer(alice); // accredited is not enough for this BUIDL-like fund asset
        fundPoolRWA(6_000_000 ether);
        fundBuyerQuote(alice, 6_000_000 ether);

        uint256 aliceQuoteBefore = quote.balanceOf(alice);
        uint256 poolRwaBefore = rwaToken.balanceOf(address(pool));

        ExecutionRequest memory req = buildBuyRequest(
            alice, BuidlLikeDemoAsset.MINIMUM_INVESTMENT_AMOUNT, BuidlLikeDemoAsset.MINIMUM_INVESTMENT_AMOUNT
        );

        vm.prank(alice);
        vm.expectRevert(); // ComplianceRejected: A-13-v1 from BuidlLikeFundRecipe
        router.execute(req);

        assertEq(rwaToken.balanceOf(alice), 0, "non-QP receives no BUIDL-like asset");
        assertEq(quote.balanceOf(alice), aliceQuoteBefore, "quote not pulled on compliance reject");
        assertEq(rwaToken.balanceOf(address(pool)), poolRwaBefore, "pool RWA unchanged");
    }

    function test_buidlLike_sanctionedQpBuyerRejectedBeforeTokenMoves() public {
        setupBuyer(alice);
        qp.setQp(alice, true);
        sanctions.setBlocked(alice, true);
        fundPoolRWA(6_000_000 ether);
        fundBuyerQuote(alice, 6_000_000 ether);

        uint256 aliceQuoteBefore = quote.balanceOf(alice);
        uint256 poolRwaBefore = rwaToken.balanceOf(address(pool));

        ExecutionRequest memory req = buildBuyRequest(
            alice, BuidlLikeDemoAsset.MINIMUM_INVESTMENT_AMOUNT, BuidlLikeDemoAsset.MINIMUM_INVESTMENT_AMOUNT
        );

        vm.prank(alice);
        vm.expectRevert(); // ComplianceRejected: A-01-v1 from RegD506cRecipe
        router.execute(req);

        assertEq(rwaToken.balanceOf(alice), 0, "sanctioned buyer receives no BUIDL-like asset");
        assertEq(quote.balanceOf(alice), aliceQuoteBefore, "quote not pulled on sanctions reject");
        assertEq(rwaToken.balanceOf(address(pool)), poolRwaBefore, "pool RWA unchanged");
    }

    function test_buidlLike_unverifiedQpRecipientRollsBackSettlement() public {
        // Engine-level AI/QP flags pass, but the real ERC-3643 token still rejects
        // transfer to an unregistered recipient identity at settlement time.
        accredited.setAccredited(alice, true);
        qp.setQp(alice, true);
        fundPoolRWA(6_000_000 ether);
        fundBuyerQuote(alice, 6_000_000 ether);

        uint256 aliceQuoteBefore = quote.balanceOf(alice);
        uint256 poolRwaBefore = rwaToken.balanceOf(address(pool));

        ExecutionRequest memory req = buildBuyRequest(
            alice, BuidlLikeDemoAsset.MINIMUM_INVESTMENT_AMOUNT, BuidlLikeDemoAsset.MINIMUM_INVESTMENT_AMOUNT
        );

        vm.prank(alice);
        vm.expectRevert(); // ERC-3643 transfer-time verification rejects unverified recipient
        router.execute(req);

        assertEq(rwaToken.balanceOf(alice), 0, "unverified recipient receives no BUIDL-like asset");
        assertEq(quote.balanceOf(alice), aliceQuoteBefore, "quote transfer rolled back");
        assertEq(rwaToken.balanceOf(address(pool)), poolRwaBefore, "pool RWA transfer rolled back");
    }

    function test_buidlLike_qpBuyerBelowMinimumRejectedBeforeTokenMoves() public {
        setupBuyer(alice);
        qp.setQp(alice, true);
        fundPoolRWA(6_000_000 ether);
        fundBuyerQuote(alice, 6_000_000 ether);

        uint256 aliceQuoteBefore = quote.balanceOf(alice);
        uint256 poolRwaBefore = rwaToken.balanceOf(address(pool));

        ExecutionRequest memory req = buildBuyRequest(alice, 1_000_000 ether, 1_000_000 ether);

        vm.prank(alice);
        vm.expectRevert(); // ComplianceRejected: BUIDL-MIN-v1 from BuidlLikeFundRecipe
        router.execute(req);

        assertEq(rwaToken.balanceOf(alice), 0, "below-minimum buyer receives no BUIDL-like asset");
        assertEq(quote.balanceOf(alice), aliceQuoteBefore, "quote not pulled on minimum reject");
        assertEq(rwaToken.balanceOf(address(pool)), poolRwaBefore, "pool RWA unchanged");
    }
}
