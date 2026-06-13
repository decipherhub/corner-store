// SPDX-License-Identifier: GPL-3.0
pragma solidity 0.8.17;

import {IntegrationBase} from "./IntegrationBase.sol";
import {ExecutionRequest} from "../../src/types/ExecutionTypes.sol";

/// @notice End-to-end swap flows through the REAL router + REAL ERC-3643 token.
///
/// Every BUY pushes a genuine T-REX transfer (pool → buyer) with full
/// isVerified + canTransfer enforcement (gas in the millions). See the
/// direction note in {IntegrationBase}: the engine is NOT direction-aware, so
/// "sell-shaped" is represented by tokenIn/tokenOut + which verified address
/// holds RWA, NOT by any engine-side direction gating.
contract SwapFlowTest is IntegrationBase {
    address internal bob = address(0xB0B);

    function setUp() public {
        deployStack(); // RegD506c, no fund recipe
    }

    // --- BUY success: real RWA transfer, balances move -------------------

    function test_buy_success_realRwaTransfer() public {
        setupBuyer(alice);
        fundPoolRWA(1_000 ether);
        fundBuyerQuote(alice, 1_000 ether);

        uint256 amount = 100 ether; // 1:1 rate
        ExecutionRequest memory req = buildBuyRequest(alice, amount, amount);

        uint256 aliceQuoteBefore = quote.balanceOf(alice);
        uint256 aliceRwaBefore = rwaToken.balanceOf(alice);
        uint256 poolRwaBefore = rwaToken.balanceOf(address(pool));
        uint256 poolQuoteBefore = quote.balanceOf(address(pool));

        doBuy(req);

        // balances actually moved
        assertEq(quote.balanceOf(alice), aliceQuoteBefore - amount, "alice paid quote");
        assertEq(rwaToken.balanceOf(alice), aliceRwaBefore + amount, "alice received RWA");
        assertEq(rwaToken.balanceOf(address(pool)), poolRwaBefore - amount, "pool sent RWA");
        assertEq(quote.balanceOf(address(pool)), poolQuoteBefore + amount, "pool received quote");

        // non-custodial: router & adapter hold nothing afterwards
        assertEq(rwaToken.balanceOf(address(router)), 0, "router holds no RWA");
        assertEq(quote.balanceOf(address(router)), 0, "router holds no quote");
        assertEq(rwaToken.balanceOf(address(adapter)), 0, "adapter holds no RWA");
        assertEq(quote.balanceOf(address(adapter)), 0, "adapter holds no quote");
    }

    // --- SELL-shaped success ---------------------------------------------
    // Seller (ctx.buyer for engine purposes) sends RWA in, receives quote out.
    // tokenIn=RWA (ACTIVE regulated side), tokenOut=quote. The RWA transfer leg
    // pulls RWA from a VERIFIED holder → the VERIFIED pool; both legs are real.
    function test_sell_shaped_success() public {
        // alice is the verified, accredited party the engine validates.
        setupBuyer(alice);
        // give alice RWA to sell, and approve the adapter to pull it.
        mint(alice, 500 ether);
        vm.prank(alice);
        rwaToken.approve(address(adapter), type(uint256).max);
        // pool must hold quote to pay out.
        fundPoolQuote(1_000 ether);

        uint256 amount = 100 ether;
        ExecutionRequest memory req = buildBuyRequest(alice, amount, amount);
        // flip the legs to a sell: RWA in, quote out.
        req.context.tokenIn = address(rwaToken);
        req.context.tokenOut = address(quote);
        // zeroForOne=false → token1(RWA) in, token0(quote) out.
        req.venueData = abi.encode(false, uint160(0));

        uint256 aliceRwaBefore = rwaToken.balanceOf(alice);
        uint256 aliceQuoteBefore = quote.balanceOf(alice);

        doBuy(req);

        assertEq(rwaToken.balanceOf(alice), aliceRwaBefore - amount, "alice sent RWA");
        assertEq(quote.balanceOf(alice), aliceQuoteBefore + amount, "alice received quote");
        assertEq(rwaToken.balanceOf(address(adapter)), 0, "adapter holds no RWA");
        assertEq(quote.balanceOf(address(adapter)), 0, "adapter holds no quote");
    }

    // --- rejection: buyer not accredited (real engine element) -----------

    function test_reject_buyerNotAccredited() public {
        verifyInvestor(alice); // verified but NOT accredited
        fundPoolRWA(1_000 ether);
        fundBuyerQuote(alice, 1_000 ether);

        ExecutionRequest memory req = buildBuyRequest(alice, 100 ether, 100 ether);

        vm.prank(alice);
        vm.expectRevert(); // ComplianceRejected(reasonCode) — reason carries A-03-v1
        router.execute(req);

        // no tokens moved
        assertEq(rwaToken.balanceOf(alice), 0, "no RWA delivered");
        assertEq(quote.balanceOf(alice), 1_000 ether, "no quote spent");
    }

    // --- rejection: buyer sanctioned -------------------------------------

    function test_reject_buyerSanctioned() public {
        setupBuyer(alice);
        sanctions.setBlocked(alice, true);
        fundPoolRWA(1_000 ether);
        fundBuyerQuote(alice, 1_000 ether);

        ExecutionRequest memory req = buildBuyRequest(alice, 100 ether, 100 ether);

        vm.prank(alice);
        vm.expectRevert(); // ComplianceRejected — A-01-v1 sanctions
        router.execute(req);

        assertEq(rwaToken.balanceOf(alice), 0, "no RWA delivered to sanctioned buyer");
    }

    // --- rejection: unverified RWA recipient → ERC-3643 rollback ---------
    // Compliance PASSES (the engine is not ERC-3643 aware) but the RWA transfer
    // leg reverts inside canTransfer; the whole swap reverts and balances are
    // unchanged. This proves the real token enforcement and atomic rollback.
    function test_reject_unverifiedRecipient_erc3643Rollback() public {
        // bob is accredited & not sanctioned in the engine, but NOT a verified
        // ERC-3643 holder — so the RWA transfer to bob must revert.
        accredited.setAccredited(bob, true);
        fundPoolRWA(1_000 ether);
        fundBuyerQuote(bob, 1_000 ether);

        ExecutionRequest memory req = buildBuyRequest(bob, 100 ether, 100 ether);

        uint256 bobQuoteBefore = quote.balanceOf(bob);
        uint256 poolRwaBefore = rwaToken.balanceOf(address(pool));

        vm.prank(bob);
        vm.expectRevert(bytes("Transfer not possible")); // real T-REX rejection
        router.execute(req);

        // atomic rollback: nothing moved on either leg
        assertEq(quote.balanceOf(bob), bobQuoteBefore, "quote unchanged after rollback");
        assertEq(rwaToken.balanceOf(bob), 0, "no RWA to unverified bob");
        assertEq(rwaToken.balanceOf(address(pool)), poolRwaBefore, "pool RWA unchanged");
        assertEq(quote.balanceOf(address(pool)), 0, "pool received no quote");
    }

    // --- Layer-2 (compliance) reject happens BEFORE any token moves ------

    function test_complianceReject_beforeAnyTokenMoves() public {
        verifyInvestor(alice); // verified but not accredited → compliance gate fails
        fundPoolRWA(1_000 ether);
        fundBuyerQuote(alice, 1_000 ether);

        uint256 aliceQuoteBefore = quote.balanceOf(alice);
        uint256 poolRwaBefore = rwaToken.balanceOf(address(pool));

        ExecutionRequest memory req = buildBuyRequest(alice, 100 ether, 100 ether);
        vm.prank(alice);
        vm.expectRevert();
        router.execute(req);

        // The compliance gate (step 3) precedes adapter dispatch (step 8):
        // not a single wei moved.
        assertEq(quote.balanceOf(alice), aliceQuoteBefore, "no quote pulled");
        assertEq(quote.balanceOf(address(pool)), 0, "pool got no quote");
        assertEq(rwaToken.balanceOf(address(pool)), poolRwaBefore, "pool RWA untouched");
        assertEq(rwaToken.balanceOf(alice), 0, "no RWA delivered");
    }
}
