// SPDX-License-Identifier: GPL-3.0
pragma solidity 0.8.17;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import {TREXSuite} from "../fixtures/TREXSuite.sol";

import {ElementRegistry} from "../../src/registry/ElementRegistry.sol";
import {RecipeRegistry} from "../../src/registry/RecipeRegistry.sol";
import {TokenPolicyRegistry} from "../../src/registry/TokenPolicyRegistry.sol";
import {OperatorRegistry} from "../../src/registry/OperatorRegistry.sol";

import {ComplianceEngine} from "../../src/compliance/ComplianceEngine.sol";
import {Sanctions} from "../../src/compliance/elements/Sanctions.sol";
import {AccreditedInvestor} from "../../src/compliance/elements/AccreditedInvestor.sol";
import {QualifiedPurchaser} from "../../src/compliance/elements/QualifiedPurchaser.sol";
import {SurveillanceFlag} from "../../src/compliance/elements/SurveillanceFlag.sol";
import {RegD506cRecipe} from "../../src/compliance/recipes/RegD506cRecipe.sol";
import {Fund3c7Recipe} from "../../src/compliance/recipes/Fund3c7Recipe.sol";

import {ExecutionRouter} from "../../src/execution/ExecutionRouter.sol";
import {VenueRegistry} from "../../src/execution/VenueRegistry.sol";
import {VenueSelector} from "../../src/execution/VenueSelector.sol";
import {UniswapV3Adapter} from "../../src/execution/adapters/amm/UniswapV3Adapter.sol";

import {MockERC20} from "../mocks/MockERC20.sol";
import {MockPool} from "../mocks/MockPool.sol";

import {ManifestCore, PolicyStatus, VenueType, FlowType} from "../../src/types/ComplianceTypes.sol";
import {ComplianceContext} from "../../src/types/ComplianceTypes.sol";
import {ExecutionRequest} from "../../src/types/ExecutionTypes.sol";
import {VenueConfig, CustodyModel} from "../../src/types/VenueTypes.sol";

/// @title IntegrationBase
/// @notice Deploys & wires the FULL Corner Store stack on top of a REAL ERC-3643
///         token (via {TREXSuite}) so each scenario file is short.
///
/// Topology of a BUY:
///   - RWA  = the real T-REX `token()` (manifest ACTIVE → RegD506c).
///   - QUOTE = a plain {MockERC20} (manifest UNREGULATED).
///   - {MockPool} is constructed token0=QUOTE, token1=RWA. With the adapter's
///     default `zeroForOne=true`, tokenIn=token0=QUOTE and tokenOut=token1=RWA.
///   - The buyer approves the ADAPTER to spend QUOTE; the adapter callback pulls
///     QUOTE buyer→pool; the pool then does the REAL ERC-3643 RWA transfer
///     pool→buyer (genuine isVerified + canTransfer, gas in the millions).
///
/// NOTE on direction (skeleton honesty): the engine is NOT direction-aware — it
/// always checks `ctx.buyer` for investor elements (accredited / sanctioned / qp).
/// We represent BUY vs SELL via tokenIn/tokenOut and which real address holds /
/// receives RWA, but we do NOT pretend the engine gates by direction. Rejection
/// scenarios therefore use mechanisms the skeleton actually has (non-accredited
/// buyer, sanctioned buyer, unverified RWA recipient → ERC-3643 rollback,
/// SUSPENDED policy, suspended venue, maxAmount, nonce reuse). Direction-specific
/// element application is a documented future concern.
abstract contract IntegrationBase is TREXSuite {
    // --- registries / engine ---------------------------------------------
    ElementRegistry internal elementReg;
    RecipeRegistry internal recipeReg;
    TokenPolicyRegistry internal policyReg;
    OperatorRegistry internal operatorReg;
    ComplianceEngine internal engine;

    // --- elements ---------------------------------------------------------
    Sanctions internal sanctions;
    AccreditedInvestor internal accredited;
    QualifiedPurchaser internal qp;
    SurveillanceFlag internal surveillance;

    // --- execution --------------------------------------------------------
    ExecutionRouter internal router;
    VenueRegistry internal venueReg;
    VenueSelector internal selector;
    UniswapV3Adapter internal adapter;

    // --- tokens / venue ---------------------------------------------------
    MockERC20 internal quote; // UNREGULATED cash leg
    MockPool internal pool; // token0=QUOTE, token1=RWA

    // shared actors
    address internal alice = address(0xA11CE);

    // RWA-side bit in supportedEngines / allowedVenueTypes (AMM = bit 0).
    uint8 internal constant ENGINES_AMM = 0x01;

    uint256 internal nextNonce = 1;

    /// @notice Stand up T-REX + the full Corner Store stack. Call from `setUp()`.
    /// @param fundRecipeId 0 (no fund recipe) or 2 (3(c)(7)).
    /// @param factsPacked  manifest facts (bit0 = fund applicable).
    function deployStack(uint16 fundRecipeId, uint256 factsPacked) internal {
        deployTREX(); // real ERC-3643 token() + identity registry

        // 1. compliance registries
        elementReg = new ElementRegistry();
        recipeReg = new RecipeRegistry();
        policyReg = new TokenPolicyRegistry();
        operatorReg = new OperatorRegistry();

        // 2. elements + register
        sanctions = new Sanctions();
        accredited = new AccreditedInvestor();
        qp = new QualifiedPurchaser();
        surveillance = new SurveillanceFlag();
        elementReg.registerElement(bytes32("A-01-v1"), address(sanctions));
        elementReg.registerElement(bytes32("A-03-v1"), address(accredited));
        elementReg.registerElement(bytes32("A-13-v1"), address(qp));
        elementReg.registerElement(bytes32("F-02-v1"), address(surveillance));

        // 3. recipes + register
        recipeReg.registerRecipe(1, 1, address(new RegD506cRecipe()));
        recipeReg.registerRecipe(2, 1, address(new Fund3c7Recipe()));

        // 4. engine
        engine = new ComplianceEngine(policyReg, elementReg, recipeReg);

        // 5. execution stack
        venueReg = new VenueRegistry();
        selector = new VenueSelector();
        adapter = new UniswapV3Adapter();
        router = new ExecutionRouter(engine, venueReg, selector, operatorReg);

        // 6. quote token (UNREGULATED manifest) + pool (token0=QUOTE, token1=RWA)
        quote = new MockERC20("Quote USD", "qUSD");
        pool = new MockPool(IERC20(address(quote)), IERC20(address(rwaToken)));

        // 7. manifests
        policyReg.registerManifest(address(rwaToken), _activeManifest(fundRecipeId, factsPacked));
        ManifestCore memory unreg;
        unreg.status = PolicyStatus.UNREGULATED;
        policyReg.registerManifest(address(quote), unreg);

        // 8. register the pool as a verified RWA holder + as an AMM venue + adapter pool
        registerVenueIdentity(address(pool));
        venueReg.registerVenue(
            address(pool),
            VenueConfig({
                venueType: VenueType.AMM,
                adapter: address(adapter),
                target: address(pool),
                operator: address(0),
                custody: CustodyModel.POOL,
                active: true
            })
        );
        adapter.setPool(address(pool), true);
    }

    /// @dev Convenience overload: plain RegD506c, no fund recipe.
    function deployStack() internal {
        deployStack(0, 0);
    }

    // --- manifest helper --------------------------------------------------

    function _activeManifest(uint16 fundRecipeId, uint256 factsPacked) internal pure returns (ManifestCore memory m) {
        m.status = PolicyStatus.ACTIVE;
        m.issuanceRecipeId = 1;
        m.issuanceRecipeVersion = 1;
        m.fundRecipeId = fundRecipeId;
        m.supportedEngines = ENGINES_AMM; // AMM bit → selector.validate passes for AMM
        m.factsPacked = factsPacked;
    }

    // --- actor setup ------------------------------------------------------

    /// @notice Make `who` a verified, accredited, non-sanctioned investor.
    function setupBuyer(address who) internal {
        verifyInvestor(who); // real OnchainID + KYC claim
        accredited.setAccredited(who, true);
        // sanctions default = not blocked
    }

    /// @notice Seed the pool with RWA liquidity (so a BUY can deliver RWA out).
    function fundPoolRWA(uint256 amount) internal {
        mint(address(pool), amount); // pool is a verified holder
    }

    /// @notice Seed the pool with QUOTE liquidity (so a SELL-shaped trade can pay out).
    function fundPoolQuote(uint256 amount) internal {
        quote.mint(address(pool), amount);
    }

    /// @notice Give the buyer QUOTE and approve the adapter to pull it.
    function fundBuyerQuote(address who, uint256 amount) internal {
        quote.mint(who, amount);
        vm.prank(who);
        quote.approve(address(adapter), type(uint256).max);
    }

    // --- request builders -------------------------------------------------

    /// @notice Build a BUY request: buyer pays QUOTE in, receives RWA out.
    ///         tokenIn=QUOTE, tokenOut=RWA, regulated side = tokenOut (ACTIVE).
    function buildBuyRequest(address buyer, uint256 amountIn, uint256 amountOut)
        internal
        returns (ExecutionRequest memory)
    {
        ComplianceContext memory ctx;
        ctx.initiator = buyer;
        ctx.buyer = buyer;
        ctx.seller = address(pool);
        ctx.tokenIn = address(quote);
        ctx.tokenOut = address(rwaToken);
        ctx.amountIn = amountIn;
        ctx.amountOut = amountOut;
        ctx.venueType = VenueType.AMM;
        ctx.venue = address(pool);
        ctx.flowType = FlowType.SECONDARY_TRADE;
        return ExecutionRequest({
            context: ctx,
            amountOutMin: 0,
            deadline: uint64(block.timestamp + 1 hours),
            nonce: nextNonce++,
            venueData: "" // default zeroForOne=true: token0(QUOTE) in, token1(RWA) out
        });
    }

    /// @notice Execute a BUY as `buyer` (msg.sender = buyer for nonce scoping &
    ///         the adapter's transferFrom approval).
    function doBuy(ExecutionRequest memory req) internal {
        vm.prank(req.context.buyer);
        router.execute(req);
    }
}
