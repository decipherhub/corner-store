// SPDX-License-Identifier: GPL-3.0
pragma solidity 0.8.17;

import {IntegrationBase} from "./IntegrationBase.sol";

import {RFQAdapter} from "../../src/execution/adapters/rfq/RFQAdapter.sol";
import {RFQQuote} from "../../src/execution/adapters/rfq/RFQTypes.sol";

import {ExecutionRequest} from "../../src/types/ExecutionTypes.sol";
import {
    ComplianceContext,
    ComplianceDecision,
    ManifestCore,
    VenueType,
    FlowType
} from "../../src/types/ComplianceTypes.sol";
import {VenueConfig, CustodyModel} from "../../src/types/VenueTypes.sol";
import {Errors} from "../../src/libraries/Errors.sol";

/// @title RFQFlow (integration)
/// @notice Drives the RFQ venue end-to-end through the PROTECTED router path
///         (`ExecutionRouter -> ComplianceEngine -> RFQAdapter`) against the real
///         ERC-3643 stack. The RFQ venue is fully unit-covered
///         (`test/unit/execution/RFQAdapter.t.sol`) but only ever against a
///         `MockComplianceEngine`; this file is the deferred RFQ-002 follow-up
///         that exercises the venue with the live engine + T-REX token.
///
/// Topology of an RFQ fill (maker SELLS the RWA):
///   - taker  = alice: pays QUOTE (UNREGULATED) in, receives RWA out.
///   - maker  = a dealer holding real T-REX RWA, KYC-verified, EIP-712 signer.
///   - tokenIn = QUOTE, tokenOut = RWA(ACTIVE). The regulated side is tokenOut,
///     so the decision's `allowedVenueTypes` mask == the RWA manifest's
///     `supportedEngines`. The RFQ bit (1 << VenueType.RFQ) must be set there for
///     `VenueSelector.validate` to admit the venue — see {_admitRFQVenueType}.
///   - settlement is non-custodial + maker<->taker direct: QUOTE taker->maker and
///     the REAL ERC-3643 RWA transfer maker->taker (genuine isVerified/canTransfer).
contract RFQFlowTest is IntegrationBase {
    // Mirror of RFQAdapter.RFQFilled for expectEmit.
    event RFQFilled(
        bytes32 indexed quoteHash, address indexed maker, address indexed taker, uint256 amountIn, uint256 amountOut
    );

    // Engine bit for the RFQ venue type (bit 2). Sibling of {ENGINES_AMM}; kept
    // local because only the RFQ path advertises it.
    uint8 internal constant ENGINES_RFQ = uint8(1 << uint256(VenueType.RFQ));

    // Deterministic maker signing key (distinct from alice = 0xA11CE).
    uint256 internal constant MAKER_PK = uint256(keccak256("CORNER_STORE.RFQ_MAKER"));

    // RFQ venue is a pure label (non-custodial): target/operator zero, custody NONE.
    address internal constant RFQ_VENUE = address(0xF00D);

    // QUOTE in (cash) / RWA out (regulated) for a single fill.
    uint256 internal constant QUOTE_IN = 100 ether;
    uint256 internal constant RWA_OUT = 250 ether;

    address internal maker;
    RFQAdapter internal rfqAdapter;

    function setUp() public {
        deployStack(); // full stack; RWA manifest lands AMM-only.
        _admitRFQVenueType(); // re-declare the RWA manifest so the mask admits RFQ.

        maker = vm.addr(MAKER_PK);

        // RFQ adapter shares the router; authenticate it and approve the maker.
        rfqAdapter = new RFQAdapter();
        rfqAdapter.setRouter(address(router));
        rfqAdapter.setMakerApproved(maker, true);

        venueReg.registerVenue(
            RFQ_VENUE,
            VenueConfig({
                venueType: VenueType.RFQ,
                adapter: address(rfqAdapter),
                target: address(0),
                operator: address(0),
                custody: CustodyModel.NONE,
                active: true
            })
        );

        // taker (alice): fully-compliant investor + QUOTE funding, approves the adapter.
        setupBuyer(alice);
        quote.mint(alice, 1_000 ether);
        vm.prank(alice);
        quote.approve(address(rfqAdapter), type(uint256).max);

        // maker: KYC-verified real T-REX holder of RWA, approves the adapter to
        // deliver RWA out. NOT engine-attested: the engine screens ctx.buyer only.
        verifyInvestor(maker);
        mint(maker, 1_000 ether);
        vm.prank(maker);
        rwaToken.approve(address(rfqAdapter), type(uint256).max);
    }

    /// @dev Re-declare the RWA manifest so its `supportedEngines` advertises RFQ
    ///      (in addition to AMM). Uses only existing product surfaces: the
    ///      TokenPolicyRegistry lifecycle (retire -> re-register -> approve) and
    ///      the manifest `supportedEngines` bitfield. The engine maps that field
    ///      1:1 into `ComplianceDecision.allowedVenueTypes`, which is what
    ///      `VenueSelector.validate` checks against `VenueType.RFQ`.
    function _admitRFQVenueType() internal {
        ManifestCore memory m = _activeManifest(0, 0);
        m.supportedEngines = ENGINES_AMM | ENGINES_RFQ;
        policyReg.retireManifest(address(rwaToken), bytes32("re-engine-rfq"));
        policyReg.registerManifest(address(rwaToken), m, _bindings(0));
        policyReg.approveManifest(address(rwaToken));
    }

    // --- helpers ----------------------------------------------------------

    function _quote(uint256 nonce, uint64 expiry) internal view returns (RFQQuote memory q) {
        q.maker = maker;
        q.taker = alice;
        q.tokenIn = address(quote);
        q.tokenOut = address(rwaToken);
        q.amountIn = QUOTE_IN;
        q.amountOut = RWA_OUT;
        q.venue = RFQ_VENUE;
        q.nonce = nonce;
        q.expiry = expiry;
    }

    function _sign(RFQQuote memory q) internal view returns (bytes memory) {
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(MAKER_PK, rfqAdapter.hashQuote(q));
        return abi.encodePacked(r, s, v);
    }

    /// @dev Build a router request whose context mirrors the signed quote exactly
    ///      (the adapter's `_validateQuote` rejects any field mismatch).
    function _buildRfqRequest(RFQQuote memory q) internal returns (ExecutionRequest memory req) {
        ComplianceContext memory ctx;
        ctx.initiator = alice;
        ctx.buyer = alice;
        ctx.seller = maker;
        ctx.tokenIn = address(quote);
        ctx.tokenOut = address(rwaToken);
        ctx.amountIn = q.amountIn;
        ctx.amountOut = q.amountOut;
        ctx.venueType = VenueType.RFQ;
        ctx.venue = RFQ_VENUE;
        ctx.flowType = FlowType.SECONDARY_TRADE;

        req.context = ctx;
        req.amountOutMin = q.amountOut;
        req.deadline = uint64(block.timestamp + 1 hours);
        req.nonce = nextNonce++;
        req.venueData = abi.encode(q, _sign(q));
    }

    function _validRequest(uint256 quoteNonce) internal returns (RFQQuote memory q, ExecutionRequest memory req) {
        q = _quote(quoteNonce, uint64(block.timestamp + 1 hours));
        req = _buildRfqRequest(q);
    }

    // --- scenarios --------------------------------------------------------

    /// @notice Full protected-path fill: both settlement legs move and the
    ///         adapter emits RFQFilled.
    function test_rfqFill_succeedsForApprovedMaker() public {
        (RFQQuote memory q, ExecutionRequest memory req) = _validRequest(1);

        vm.expectEmit(true, true, true, true, address(rfqAdapter));
        emit RFQFilled(rfqAdapter.hashQuote(q), maker, alice, QUOTE_IN, RWA_OUT);

        vm.prank(alice);
        router.execute(req);

        // QUOTE leg: taker -> maker.
        assertEq(quote.balanceOf(alice), 1_000 ether - QUOTE_IN, "taker paid QUOTE");
        assertEq(quote.balanceOf(maker), QUOTE_IN, "maker received QUOTE");
        // RWA leg (real ERC-3643): maker -> taker.
        assertEq(rwaToken.balanceOf(maker), 1_000 ether - RWA_OUT, "maker delivered RWA");
        assertEq(rwaToken.balanceOf(alice), RWA_OUT, "taker received RWA");
        // Non-custodial: the adapter retains nothing.
        assertEq(quote.balanceOf(address(rfqAdapter)), 0, "adapter holds no QUOTE");
        assertEq(rwaToken.balanceOf(address(rfqAdapter)), 0, "adapter holds no RWA");
    }

    /// @notice Reverse RFQ direction: the taker delivers regulated inventory
    ///         and receives the quote asset from the approved maker.
    function test_rfqSell_succeedsForApprovedMaker() public {
        mint(alice, RWA_OUT);
        quote.mint(maker, 1_000 ether);
        vm.prank(alice);
        rwaToken.approve(address(rfqAdapter), type(uint256).max);
        vm.prank(maker);
        quote.approve(address(rfqAdapter), type(uint256).max);

        RFQQuote memory q = _quote(2, uint64(block.timestamp + 1 hours));
        q.tokenIn = address(rwaToken);
        q.tokenOut = address(quote);
        q.amountIn = RWA_OUT;
        q.amountOut = QUOTE_IN;

        ExecutionRequest memory req = _buildRfqRequest(q);
        req.context.tokenIn = q.tokenIn;
        req.context.tokenOut = q.tokenOut;
        req.context.amountIn = q.amountIn;
        req.context.amountOut = q.amountOut;

        uint256 aliceRwaBefore = rwaToken.balanceOf(alice);
        uint256 aliceQuoteBefore = quote.balanceOf(alice);
        uint256 makerRwaBefore = rwaToken.balanceOf(maker);
        uint256 makerQuoteBefore = quote.balanceOf(maker);

        vm.prank(alice);
        router.execute(req);

        assertEq(rwaToken.balanceOf(alice), aliceRwaBefore - RWA_OUT, "taker sold RWA");
        assertEq(quote.balanceOf(alice), aliceQuoteBefore + QUOTE_IN, "taker received QUOTE");
        assertEq(rwaToken.balanceOf(maker), makerRwaBefore + RWA_OUT, "maker received RWA");
        assertEq(quote.balanceOf(maker), makerQuoteBefore - QUOTE_IN, "maker paid QUOTE");
    }

    /// @notice An unapproved maker is rejected at settlement even with a valid
    ///         signature and a compliant taker.
    function test_rfqFill_revertsWhenMakerUnapproved() public {
        rfqAdapter.setMakerApproved(maker, false);
        (, ExecutionRequest memory req) = _validRequest(1);

        vm.prank(alice);
        vm.expectRevert(Errors.RFQMakerNotApproved.selector);
        router.execute(req);
    }

    /// @notice A maker-cancelled quote nonce can no longer be filled.
    function test_rfqFill_revertsAfterMakerCancels() public {
        (, ExecutionRequest memory req) = _validRequest(1);

        vm.prank(maker);
        rfqAdapter.cancelQuoteNonce(1);

        vm.prank(alice);
        vm.expectRevert(Errors.RFQQuoteUsed.selector);
        router.execute(req);
    }

    /// @notice Flipping ONE investor attestation (jurisdiction) makes the live
    ///         engine reject before any settlement. `ComplianceRejected(bytes32)`
    ///         is parameterized, so the selector is matched partially.
    function test_rfqFill_revertsWhenBuyerNotCompliant() public {
        // alice remains a verified holder and otherwise-compliant investor; only
        // her jurisdiction is moved to a disallowed code.
        jurisdiction.setJurisdiction(alice, bytes32("ZZ"));
        (, ExecutionRequest memory req) = _validRequest(1);

        vm.prank(alice);
        vm.expectPartialRevert(Errors.ComplianceRejected.selector);
        router.execute(req);

        assertEq(rwaToken.balanceOf(alice), 0, "no RWA delivered on compliance rejection");
        assertEq(quote.balanceOf(maker), 0, "no QUOTE moved on compliance rejection");
    }

    /// @notice Calling the adapter directly (bypassing the router) reverts: only
    ///         the wired router may drive settlement.
    function test_rfqAdapter_directCallReverts() public {
        (, ExecutionRequest memory req) = _validRequest(1);
        ComplianceDecision memory d;

        vm.expectRevert(Errors.NotAuthorized.selector);
        rfqAdapter.execute(req, d);
    }
}
