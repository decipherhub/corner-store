// SPDX-License-Identifier: GPL-3.0
pragma solidity 0.8.17;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import {TREXSuite} from "../fixtures/TREXSuite.sol";
import {MockSecuritizeTA} from "../fixtures/MockSecuritizeTA.sol";

import {ElementRegistry} from "../../src/registry/ElementRegistry.sol";
import {RecipeRegistry} from "../../src/registry/RecipeRegistry.sol";
import {TokenPolicyRegistry} from "../../src/registry/TokenPolicyRegistry.sol";
import {OperatorRegistry} from "../../src/registry/OperatorRegistry.sol";

import {ComplianceEngine} from "../../src/compliance/ComplianceEngine.sol";
import {Sanctions} from "../../src/compliance/elements/Sanctions.sol";
import {AccreditedInvestor} from "../../src/compliance/elements/AccreditedInvestor.sol";
import {QualifiedPurchaser} from "../../src/compliance/elements/QualifiedPurchaser.sol";
import {BuidlMinimumInvestment} from "../../src/compliance/elements/BuidlMinimumInvestment.sol";
import {SurveillanceFlag} from "../../src/compliance/elements/SurveillanceFlag.sol";
import {Jurisdiction} from "../../src/compliance/elements/Jurisdiction.sol";
import {IdentityUniqueness} from "../../src/compliance/elements/IdentityUniqueness.sol";
import {UsTaxResident} from "../../src/compliance/elements/UsTaxResident.sol";
import {AssetClassification} from "../../src/compliance/elements/AssetClassification.sol";
import {Erc3643Native} from "../../src/compliance/elements/Erc3643Native.sol";
import {FormDFiling} from "../../src/compliance/elements/FormDFiling.sol";
import {Lockup} from "../../src/compliance/elements/Lockup.sol";
import {IAcquisitionSource} from "../../src/interfaces/compliance/IAcquisitionSource.sol";
import {RegD506cRecipe} from "../../src/compliance/recipes/RegD506cRecipe.sol";
import {Fund3c7Recipe} from "../../src/compliance/recipes/Fund3c7Recipe.sol";
import {BuidlLikeFundRecipe} from "../../src/compliance/recipes/BuidlLikeFundRecipe.sol";

import {ExecutionRouter} from "../../src/execution/ExecutionRouter.sol";
import {VenueRegistry} from "../../src/execution/VenueRegistry.sol";
import {VenueSelector} from "../../src/execution/VenueSelector.sol";
import {UniswapV3Adapter} from "../../src/execution/adapters/amm/UniswapV3Adapter.sol";

import {MockERC20} from "../mocks/MockERC20.sol";
import {MockPool} from "../mocks/MockPool.sol";

import {BuidlLikeDemoAsset} from "../../src/demo/BuidlLikeDemoAsset.sol";
import {
    ManifestCore,
    PolicyStatus,
    RecipeBinding,
    RecipeBindingMode,
    VenueType,
    FlowType
} from "../../src/types/ComplianceTypes.sol";
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
    MockSecuritizeTA internal mockTA;

    // --- elements ---------------------------------------------------------
    Sanctions internal sanctions;
    AccreditedInvestor internal accredited;
    QualifiedPurchaser internal qp;
    BuidlMinimumInvestment internal buidlMinimum;
    SurveillanceFlag internal surveillance;
    // 9-element Reg D 506(c) reference set (A-01/A-03 above + these):
    Jurisdiction internal jurisdiction; // A-02-v1
    IdentityUniqueness internal identity; // A-04-v1
    UsTaxResident internal usTax; // A-05-v1
    AssetClassification internal assetClass; // B-01-v1
    Erc3643Native internal erc3643; // B-02-v1
    Lockup internal lockup; // C-01-v1
    FormDFiling internal formD; // E-01-v1
    MockAcquisitionSource internal acqSource; // Lockup CR-3 seam

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

    // 9-element Reg D 506(c) fixture constants.
    bytes32 internal constant ALLOWED_JURISDICTION = bytes32("US");
    bytes32 internal constant REG_D_CLASS = bytes32("REG_D");
    uint64 internal constant LOCKUP_SECONDS = 365 days;

    uint256 internal nextNonce = 1;

    /// @notice Stand up T-REX + the full Corner Store stack. Call from `setUp()`.
    /// @param fundRecipeId 0 (no fund recipe) or 2 (3(c)(7)).
    /// @param factsPacked  manifest facts (bit0 = fund applicable).
    function deployStack(uint16 fundRecipeId, uint256 factsPacked) internal {
        deployStackWithAsset("Corner Store RWA", "csRWA", fundRecipeId, factsPacked);
    }

    /// @notice Stand up the same stack with scenario-specific ERC-3643 asset metadata.
    function deployStackWithAsset(
        string memory tokenName,
        string memory tokenSymbol,
        uint16 fundRecipeId,
        uint256 factsPacked
    ) internal {
        deployStackWithManifest(
            tokenName, tokenSymbol, _activeManifest(fundRecipeId, factsPacked), _bindings(fundRecipeId)
        );
    }

    /// @notice Stand up the same stack with an explicit asset Manifest/profile.
    function deployStackWithManifest(
        string memory tokenName,
        string memory tokenSymbol,
        ManifestCore memory manifest,
        RecipeBinding[] memory bindings
    ) internal {
        deployTREX(tokenName, tokenSymbol); // real ERC-3643 token() + identity registry

        // 1. compliance registries
        elementReg = new ElementRegistry();
        recipeReg = new RecipeRegistry();
        policyReg = new TokenPolicyRegistry(recipeReg, elementReg);
        operatorReg = new OperatorRegistry();
        mockTA = new MockSecuritizeTA();

        // 2. elements + register
        sanctions = new Sanctions();
        accredited = new AccreditedInvestor();
        qp = new QualifiedPurchaser();
        buidlMinimum = new BuidlMinimumInvestment();
        surveillance = new SurveillanceFlag();
        elementReg.registerElement(bytes32("A-01-v1"), address(sanctions));
        elementReg.registerElement(bytes32("A-03-v1"), address(accredited));
        elementReg.registerElement(bytes32("A-13-v1"), address(qp));
        elementReg.registerElement(bytes32("BUIDL-MIN-v1"), address(buidlMinimum));
        elementReg.registerElement(bytes32("F-02-v1"), address(surveillance));

        // 2b. remaining 9-element Reg D 506(c) reference set. AssetClassification
        //     requires REG_D; Lockup reads acquisition time via an injected mock.
        jurisdiction = new Jurisdiction();
        identity = new IdentityUniqueness();
        usTax = new UsTaxResident();
        assetClass = new AssetClassification(REG_D_CLASS);
        erc3643 = new Erc3643Native();
        formD = new FormDFiling();
        acqSource = new MockAcquisitionSource();
        lockup = new Lockup(address(acqSource), LOCKUP_SECONDS);
        elementReg.registerElement(bytes32("A-02-v1"), address(jurisdiction));
        elementReg.registerElement(bytes32("A-04-v1"), address(identity));
        elementReg.registerElement(bytes32("A-05-v1"), address(usTax));
        elementReg.registerElement(bytes32("B-01-v1"), address(assetClass));
        elementReg.registerElement(bytes32("B-02-v1"), address(erc3643));
        elementReg.registerElement(bytes32("C-01-v1"), address(lockup));
        elementReg.registerElement(bytes32("E-01-v1"), address(formD));

        // 3. recipes + register
        recipeReg.registerRecipe(1, 2, address(new RegD506cRecipe()));
        recipeReg.registerRecipe(2, 1, address(new Fund3c7Recipe()));
        recipeReg.registerRecipe(3, 1, address(new BuidlLikeFundRecipe()));

        // 4. engine
        engine = new ComplianceEngine(policyReg, elementReg, recipeReg);

        // 5. execution stack
        venueReg = new VenueRegistry();
        selector = new VenueSelector();
        adapter = new UniswapV3Adapter();
        router = new ExecutionRouter(engine, venueReg, selector, operatorReg);

        // Authenticate the post-trade write path (spec §6): only the router may
        // drive engine.commit/adapter.execute, and only the engine may drive
        // element.onTransfer.
        engine.setRouter(address(router));
        adapter.setRouter(address(router));
        surveillance.setEngine(address(engine));

        // 6. quote token (UNREGULATED manifest) + pool (token0=QUOTE, token1=RWA)
        quote = new MockERC20("Quote USD", "qUSD");
        pool = new MockPool(IERC20(address(quote)), IERC20(address(rwaToken)));

        // 7. manifests: onboarding goes through the lifecycle (propose -> approve).
        //    Keep the caller-provided manifest so BUIDL-like profiles can bind
        //    their own fund recipe/facts while still using the current lifecycle.
        policyReg.registerManifest(address(rwaToken), manifest, bindings);
        policyReg.approveManifest(address(rwaToken));
        // Quote/cash is out-of-scope: tag UNREGULATED directly from UNKNOWN.
        policyReg.setUnregulated(address(quote));

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

        // 9. Asset-side attestations for the 9-element Reg D 506(c) recipe: the RWA
        //    is classified REG_D, attested ERC-3643-native, and has Form D on file.
        //    Allow the ALLOWED_JURISDICTION code for the investor-side screen.
        assetClass.setClassification(address(rwaToken), REG_D_CLASS);
        erc3643.setErc3643Native(address(rwaToken), true);
        formD.setFormDFiled(address(rwaToken), true, bytes32("EDGAR-ACCESSION"));
        jurisdiction.setJurisdictionAllowed(ALLOWED_JURISDICTION, true);

        // Warp past the lockup window so a genuine (non-zero) Rule 144 holding
        // period can elapse for buyers whose acquisition time is seeded at genesis
        // (t=1) by attestInvestor. Deadlines are built relative to block.timestamp,
        // so this is transparent to the other scenarios.
        if (block.timestamp <= uint256(LOCKUP_SECONDS)) {
            vm.warp(uint256(LOCKUP_SECONDS) + 1);
        }
    }

    /// @dev Convenience overload: plain RegD506c, no fund recipe.
    function deployStack() internal {
        deployStack(0, 0);
    }

    /// @dev BUIDL-like demo fixture: Reg D 506(c) + ICA 3(c)(7) fund fact.
    ///      This is a local demo asset, not integration with real BlackRock BUIDL.
    function deployBuidlLikeStack() internal {
        deployStackWithManifest(
            BuidlLikeDemoAsset.TOKEN_NAME,
            BuidlLikeDemoAsset.TOKEN_SYMBOL,
            BuidlLikeDemoAsset.manifest(ENGINES_AMM),
            BuidlLikeDemoAsset.recipeBindings()
        );
    }

    // --- manifest helper --------------------------------------------------

    function _activeManifest(uint16 fundRecipeId, uint256 factsPacked) internal pure returns (ManifestCore memory m) {
        m.status = PolicyStatus.ACTIVE;
        m.supportedEngines = ENGINES_AMM; // AMM bit → selector.validate passes for AMM
        m.factsPacked = factsPacked;
    }

    function _bindings(uint16 fundRecipeId) internal pure returns (RecipeBinding[] memory bindings) {
        bindings = new RecipeBinding[](fundRecipeId == 0 ? 1 : 2);
        bindings[0] = RecipeBinding(1, 2, RecipeBindingMode.REQUIRED_BLOCKING, 0, 100);
        if (fundRecipeId != 0) {
            bindings[1] = RecipeBinding(fundRecipeId, 1, RecipeBindingMode.REQUIRED_BLOCKING, 0, 90);
        }
    }

    // --- actor setup ------------------------------------------------------

    /// @notice Make `who` a fully-compliant investor for the 9-element Reg D
    ///         506(c) recipe: real T-REX verification PLUS every investor-side
    ///         engine attestation.
    function setupBuyer(address who) internal {
        verifyInvestor(who); // real OnchainID + KYC claim (T-REX verified holder)
        attestInvestor(who);
    }

    /// @notice Engine-side investor attestations only (NOT T-REX verification):
    ///         accredited + all other pass-conditions for the investor-side
    ///         elements. Separated from {setupBuyer} so a scenario can drive an
    ///         engine-compliant-but-not-T-REX-verified buyer (ERC-3643 rollback).
    function attestInvestor(address who) internal {
        attestInvestorExceptAccredited(who);
        accredited.setAccredited(who, true); // A-03
    }

    /// @notice All investor-side pass-conditions EXCEPT accreditation, so a
    ///         scenario can isolate an A-03 (accredited) rejection. Covers
    ///         jurisdiction (A-02), identity (A-04), and the Rule 144 lockup
    ///         acquisition seed (C-01). Sanctions (A-01) and US-tax (A-05) pass
    ///         by default (not blocked / not flagged).
    function attestInvestorExceptAccredited(address who) internal {
        jurisdiction.setJurisdiction(who, ALLOWED_JURISDICTION); // A-02
        identity.bindIdentity(who, keccak256(abi.encode("ID", who))); // A-04
        // C-01 lockup: seed acquisition time at genesis; deployStack warped past it.
        acqSource.setAcquiredAt(who, address(rwaToken), uint64(1));
    }

    /// @notice Record a TA-style profile and sync it into the local test stack.
    /// @dev `registerIdentity=false` models a TA/claim sync bug where engine
    ///      flags are present but ERC-3643 registry verification is missing.
    function setupTaInvestor(
        address who,
        bool kycVerified,
        bool isAccredited,
        bool isQp,
        bool isSanctioned,
        bool registerIdentity
    ) internal {
        mockTA.setInvestorProfile(
            who,
            MockSecuritizeTA.InvestorProfile({
                kycVerified: kycVerified,
                accreditedInvestor: isAccredited,
                qualifiedPurchaser: isQp,
                sanctioned: isSanctioned,
                country: DEFAULT_COUNTRY,
                expiresAt: uint64(block.timestamp + 365 days),
                sourceRef: keccak256(abi.encode("MOCK_SECURITIZE_TA", who, block.chainid))
            })
        );

        syncTaInvestor(who, registerIdentity);
    }

    /// @notice Record an expired TA-style profile. Syncing leaves eligibility
    ///      flags unset so the protected Router path fails closed.
    function setupExpiredTaInvestor(address who, bool isAccredited, bool isQp) internal {
        mockTA.setInvestorProfile(
            who,
            MockSecuritizeTA.InvestorProfile({
                kycVerified: true,
                accreditedInvestor: isAccredited,
                qualifiedPurchaser: isQp,
                sanctioned: false,
                country: DEFAULT_COUNTRY,
                expiresAt: uint64(block.timestamp + 1),
                sourceRef: keccak256(abi.encode("MOCK_SECURITIZE_TA_EXPIRED", who, block.chainid))
            })
        );

        vm.warp(block.timestamp + 2);
        syncTaInvestor(who, true);
    }

    function syncTaInvestor(address who, bool registerIdentity) internal {
        (
            bool kycVerified,
            bool isAccredited,
            bool isQp,
            bool isSanctioned,
            uint16 country,
            uint64 expiresAt,
            bytes32 sourceRef
        ) = mockTA.profileOf(who);
        country;
        sourceRef;

        bool current = expiresAt == 0 || expiresAt >= block.timestamp;
        if (!current) {
            accredited.setAccredited(who, false);
            qp.setQp(who, false);
            sanctions.setBlocked(who, false);
            return;
        }

        if (kycVerified && registerIdentity) {
            verifyInvestor(who); // real OnchainID + KYC claim
        }
        jurisdiction.setJurisdiction(who, ALLOWED_JURISDICTION);
        identity.bindIdentity(who, keccak256(abi.encode("TA_ID", who, sourceRef)));
        // C-01 lockup: seed acquisition time at genesis; deployStack warped past it.
        acqSource.setAcquiredAt(who, address(rwaToken), uint64(1));
        accredited.setAccredited(who, isAccredited);
        qp.setQp(who, isQp);
        sanctions.setBlocked(who, isSanctioned);
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

/// @dev Test-only settable acquisition-time source for the Lockup (C-01-v1)
///      element's injected CR-3 seam. Mirrors the unit-test helper.
contract MockAcquisitionSource is IAcquisitionSource {
    mapping(bytes32 => AcquisitionSnapshot) internal _snapshots;

    function setAcquiredAt(address holder, address asset, uint64 ts) external {
        _snapshots[keccak256(abi.encode(holder, asset))] = AcquisitionSnapshot({
            clockStart: ts,
            observedAt: uint64(block.timestamp),
            expiresAt: type(uint64).max,
            sourceRef: keccak256("integration-fixture"),
            status: AcquisitionStatus.VALID
        });
    }

    function acquisitionOf(address holder, address asset) external view override returns (AcquisitionSnapshot memory) {
        return _snapshots[keccak256(abi.encode(holder, asset))];
    }
}
