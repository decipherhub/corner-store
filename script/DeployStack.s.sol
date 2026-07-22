// SPDX-License-Identifier: GPL-3.0
pragma solidity 0.8.17;

import {Script} from "forge-std/Script.sol";
import {console2} from "forge-std/console2.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import {TREXCore} from "../test/fixtures/TREXCore.sol";

import {ElementRegistry} from "../src/registry/ElementRegistry.sol";
import {RecipeRegistry} from "../src/registry/RecipeRegistry.sol";
import {TokenPolicyRegistry} from "../src/registry/TokenPolicyRegistry.sol";
import {OperatorRegistry} from "../src/registry/OperatorRegistry.sol";
import {AttestedAcquisitionSource} from "../src/registry/AttestedAcquisitionSource.sol";

import {ComplianceEngine} from "../src/compliance/ComplianceEngine.sol";
import {Sanctions} from "../src/compliance/elements/Sanctions.sol";
import {AccreditedInvestor} from "../src/compliance/elements/AccreditedInvestor.sol";
import {QualifiedPurchaser} from "../src/compliance/elements/QualifiedPurchaser.sol";
import {BuidlMinimumInvestment} from "../src/compliance/elements/BuidlMinimumInvestment.sol";
import {SurveillanceFlag} from "../src/compliance/elements/SurveillanceFlag.sol";
import {Jurisdiction} from "../src/compliance/elements/Jurisdiction.sol";
import {IdentityUniqueness} from "../src/compliance/elements/IdentityUniqueness.sol";
import {UsTaxResident} from "../src/compliance/elements/UsTaxResident.sol";
import {AssetClassification} from "../src/compliance/elements/AssetClassification.sol";
import {Erc3643Native} from "../src/compliance/elements/Erc3643Native.sol";
import {FormDFiling} from "../src/compliance/elements/FormDFiling.sol";
import {Lockup} from "../src/compliance/elements/Lockup.sol";
import {IAcquisitionSource} from "../src/interfaces/compliance/IAcquisitionSource.sol";
import {RegD506cRecipe} from "../src/compliance/recipes/RegD506cRecipe.sol";
import {Fund3c7Recipe} from "../src/compliance/recipes/Fund3c7Recipe.sol";
import {BuidlLikeFundRecipe} from "../src/compliance/recipes/BuidlLikeFundRecipe.sol";
import {BuidlLikeDemoAsset} from "../src/demo/BuidlLikeDemoAsset.sol";

import {ExecutionRouter} from "../src/execution/ExecutionRouter.sol";
import {VenueRegistry} from "../src/execution/VenueRegistry.sol";
import {VenueSelector} from "../src/execution/VenueSelector.sol";
import {UniswapV3Adapter} from "../src/execution/adapters/amm/UniswapV3Adapter.sol";
import {RFQAdapter} from "../src/execution/adapters/rfq/RFQAdapter.sol";

import {CornerStoreFactory} from "../src/factory/CornerStoreFactory.sol";
import {ITokenPolicyRegistry} from "../src/interfaces/compliance/ITokenPolicyRegistry.sol";
import {IVenueRegistry} from "../src/interfaces/execution/IVenueRegistry.sol";

import {MockERC20} from "../test/mocks/MockERC20.sol";
import {MockPool} from "../test/mocks/MockPool.sol";

import {VenueType} from "../src/types/ComplianceTypes.sol";
import {VenueConfig, CustodyModel} from "../src/types/VenueTypes.sol";
import {DemoConstants} from "./DemoConstants.sol";

/// @title DeployStack
/// @notice Deploys the FULL Corner Store stack onto a live node (Anvil) from a
///         single forge script, then persists all addresses to a JSON artifact
///         that {DemoScenarios} reads. This is deliverable (1) of the live-Anvil
///         E2E / demo runner.
///
/// @dev Reuses {TREXCore} (shared with the test fixture) for the REAL ERC-3643 +
/// OnchainID deployment. Everything is broadcast by the deployer (Anvil account
/// 0) except the two per-account token approvals, which must originate from the
/// investor and the RFQ maker (Anvil accounts 1 and 2).
///
/// ONBOARDING IS INTENTIONALLY LEFT TO {DemoScenarios}: this script does NOT
/// register the RWA manifest or its AMM venue — scenario 1 demonstrates that
/// one-call factory onboarding live. To make that possible while the demo also
/// drives the manifest lifecycle directly (suspend/resume/retire), we:
///   - set the deployer as an explicit OPERATOR on the TokenPolicyRegistry, then
///   - transfer TokenPolicyRegistry + VenueRegistry OWNERSHIP to the factory.
/// The factory (owner) can therefore register/approve manifests and venues, while
/// the deployer (operator) retains suspend/resume/retire/approve rights. The RFQ
/// venue and the surveillance-enabled recipe (id 7, for scenario 6) are set up
/// here, before ownership moves.
contract DeployStack is Script, TREXCore, DemoConstants {
    // --- Corner Store stack ----------------------------------------------
    ElementRegistry internal elementReg;
    RecipeRegistry internal recipeReg;
    TokenPolicyRegistry internal policyReg;
    OperatorRegistry internal operatorReg;
    ComplianceEngine internal engine;

    Jurisdiction internal jurisdiction;
    SurveillanceFlag internal surveillance;
    AssetClassification internal assetClass;
    Erc3643Native internal erc3643;
    FormDFiling internal formD;
    Lockup internal lockup;
    AttestedAcquisitionSource internal acqSource;
    QualifiedPurchaser internal qualifiedPurchaser;

    ExecutionRouter internal router;
    VenueRegistry internal venueReg;
    VenueSelector internal selector;
    UniswapV3Adapter internal ammAdapter;
    RFQAdapter internal rfqAdapter;
    CornerStoreFactory internal factory;

    MockERC20 internal quote;
    MockPool internal pool;
    string internal assetProfile;
    bool internal useBuidlLikeProfile;

    function run() external {
        uint256 deployerPk = vm.deriveKey(MNEMONIC, 0);
        uint256 investorPk = vm.deriveKey(MNEMONIC, 1);
        uint256 makerPk = vm.deriveKey(MNEMONIC, 2);
        address deployer = vm.addr(deployerPk);
        address investor = vm.addr(investorPk);
        address maker = vm.addr(makerPk);
        address unapprovedMaker = vm.addr(vm.deriveKey(MNEMONIC, 3));

        assetProfile = vm.envOr("ASSET_PROFILE", string("buidl-like"));
        bytes32 profileHash = keccak256(bytes(assetProfile));
        useBuidlLikeProfile = profileHash == keccak256("buidl-like");
        require(useBuidlLikeProfile || profileHash == keccak256("reg-d"), "ASSET_PROFILE must be buidl-like or reg-d");

        vm.startBroadcast(deployerPk);

        // 1. REAL ERC-3643 (T-REX) + OnchainID, admin = deployer.
        if (useBuidlLikeProfile) {
            deployTREX(deployer, BuidlLikeDemoAsset.TOKEN_NAME, BuidlLikeDemoAsset.TOKEN_SYMBOL);
        } else {
            deployTREX(deployer);
        }

        // 2. compliance registries + engine.
        elementReg = new ElementRegistry();
        recipeReg = new RecipeRegistry();
        policyReg = new TokenPolicyRegistry();
        operatorReg = new OperatorRegistry();

        // 3. the full 9-element Reg D 506(c) reference set + surveillance.
        _deployAndRegisterElements();

        // 4. recipes: RegD 506(c) (id 1) + generic 3(c)(7) fund (id 2) +
        //    BUIDL-like QP/minimum profile (id 3) + a surveillance-enabled RegD
        //    variant (id 7) used by scenario 6.
        recipeReg.registerRecipe(1, 2, address(new RegD506cRecipe()));
        recipeReg.registerRecipe(2, 1, address(new Fund3c7Recipe()));
        recipeReg.registerRecipe(3, 1, address(new BuidlLikeFundRecipe()));
        recipeReg.registerRecipe(SURVEIL_RECIPE_ID, 1, address(new DemoSurveillanceRecipe()));

        engine = new ComplianceEngine(policyReg, elementReg, recipeReg);

        // 5. execution stack + factory.
        venueReg = new VenueRegistry();
        selector = new VenueSelector();
        ammAdapter = new UniswapV3Adapter();
        rfqAdapter = new RFQAdapter();
        router = new ExecutionRouter(engine, venueReg, selector, operatorReg);
        factory = new CornerStoreFactory(ITokenPolicyRegistry(address(policyReg)), IVenueRegistry(address(venueReg)));

        // authenticate the post-trade write path (spec §6).
        engine.setRouter(address(router));
        ammAdapter.setRouter(address(router));
        rfqAdapter.setRouter(address(router));
        surveillance.setEngine(address(engine));

        // 6. tokens + AMM pool (token0=QUOTE, token1=RWA).
        quote = new MockERC20("Quote USD", "qUSD");
        pool = new MockPool(IERC20(address(quote)), IERC20(address(rwaToken)));

        // 7. asset-side attestations (RWA is REG_D, ERC-3643-native, Form D filed)
        //    and the allowed investor jurisdiction.
        assetClass.setClassification(address(rwaToken), REG_D_CLASS);
        erc3643.setErc3643Native(address(rwaToken), true);
        formD.setFormDFiled(address(rwaToken), true, bytes32("EDGAR-ACCESSION"));
        jurisdiction.setJurisdictionAllowed(ALLOWED_JURISDICTION, true);

        // 8. classify QUOTE as out-of-scope (owner-gated; before ownership moves).
        policyReg.setUnregulated(address(quote));

        // 9. verified holders + liquidity: investor (buyer/taker), maker (dealer),
        //    pool (custody-as-holder). Investor gets full engine attestations.
        verifyInvestor(investor);
        _attestInvestor(investor);
        verifyInvestor(maker);
        registerVenueIdentity(address(pool));

        quote.mint(investor, INVESTOR_QUOTE);
        mint(maker, MAKER_RWA);
        mint(address(pool), POOL_RWA);

        ammAdapter.setPool(address(pool), true);
        rfqAdapter.setMakerApproved(maker, true);

        // 10. register the RFQ venue now (owner-gated; before ownership moves).
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

        // 11. hand the registries to the factory for one-call onboarding, but keep
        //     the deployer as an operator so it can still drive the lifecycle.
        policyReg.setOperator(deployer, true);
        policyReg.transferOwnership(address(factory));
        venueReg.transferOwnership(address(factory));

        vm.stopBroadcast();

        // 12. per-account token approvals (must originate from their owners).
        vm.startBroadcast(investorPk);
        quote.approve(address(ammAdapter), type(uint256).max);
        quote.approve(address(rfqAdapter), type(uint256).max);
        vm.stopBroadcast();

        vm.startBroadcast(makerPk);
        rwaToken.approve(address(rfqAdapter), type(uint256).max);
        vm.stopBroadcast();

        _writeArtifact(deployer, investor, maker, unapprovedMaker);
        _printSummary(deployer, investor, maker);
    }

    function _deployAndRegisterElements() internal {
        elementReg.registerElement(bytes32("A-01-v1"), address(new Sanctions()));
        jurisdiction = new Jurisdiction();
        elementReg.registerElement(bytes32("A-02-v1"), address(jurisdiction));
        elementReg.registerElement(bytes32("A-03-v1"), address(new AccreditedInvestor()));
        elementReg.registerElement(bytes32("A-04-v1"), address(new IdentityUniqueness()));
        elementReg.registerElement(bytes32("A-05-v1"), address(new UsTaxResident()));
        assetClass = new AssetClassification(REG_D_CLASS);
        elementReg.registerElement(bytes32("B-01-v1"), address(assetClass));
        erc3643 = new Erc3643Native();
        elementReg.registerElement(bytes32("B-02-v1"), address(erc3643));
        acqSource = new AttestedAcquisitionSource();
        lockup = new Lockup(address(acqSource), LOCKUP_SECONDS);
        elementReg.registerElement(bytes32("C-01-v1"), address(lockup));
        formD = new FormDFiling();
        elementReg.registerElement(bytes32("E-01-v1"), address(formD));
        surveillance = new SurveillanceFlag();
        qualifiedPurchaser = new QualifiedPurchaser();
        elementReg.registerElement(bytes32("A-13-v1"), address(qualifiedPurchaser));
        elementReg.registerElement(bytes32("BUIDL-MIN-v1"), address(new BuidlMinimumInvestment()));
        elementReg.registerElement(bytes32("F-02-v1"), address(surveillance));
    }

    /// @dev Full investor-side engine attestations for the 9-element recipe.
    ///      Sanctions (A-01) and US-tax (A-05) pass by default (not blocked /
    ///      not flagged). Anvil's genesis timestamp is real wall-clock time, far
    ///      past the Rule 144 lockup window seeded at t=1, so C-01 passes on-chain.
    function _attestInvestor(address who) internal {
        jurisdiction.setJurisdiction(who, ALLOWED_JURISDICTION); // A-02
        IdentityUniqueness(elementReg.elementOf(bytes32("A-04-v1"))).bindIdentity(who, keccak256(abi.encode("ID", who))); // A-04
        AccreditedInvestor(elementReg.elementOf(bytes32("A-03-v1"))).setAccredited(who, true); // A-03
        if (useBuidlLikeProfile) qualifiedPurchaser.setQp(who, true); // A-13
        acqSource.setSnapshot(
            who,
            address(rwaToken),
            uint64(1),
            uint64(block.timestamp + 30 days),
            keccak256("demo-ta-fixture"),
            IAcquisitionSource.AcquisitionStatus.VALID
        ); // C-01 seed
    }

    function _writeArtifact(address deployer, address investor, address maker, address unapprovedMaker) internal {
        vm.createDir("deployments", true); // idempotent (recursive)
        string memory k = "corner-store-e2e";
        vm.serializeAddress(k, "deployer", deployer);
        vm.serializeAddress(k, "investor", investor);
        vm.serializeAddress(k, "maker", maker);
        vm.serializeAddress(k, "unapprovedMaker", unapprovedMaker);
        vm.serializeString(k, "assetProfile", assetProfile);
        vm.serializeAddress(k, "rwaToken", address(rwaToken));
        vm.serializeAddress(k, "quote", address(quote));
        vm.serializeAddress(k, "pool", address(pool));
        vm.serializeAddress(k, "rfqVenue", RFQ_VENUE);
        vm.serializeAddress(k, "elementReg", address(elementReg));
        vm.serializeAddress(k, "recipeReg", address(recipeReg));
        vm.serializeAddress(k, "policyReg", address(policyReg));
        vm.serializeAddress(k, "operatorReg", address(operatorReg));
        vm.serializeAddress(k, "engine", address(engine));
        vm.serializeAddress(k, "venueReg", address(venueReg));
        vm.serializeAddress(k, "selector", address(selector));
        vm.serializeAddress(k, "ammAdapter", address(ammAdapter));
        vm.serializeAddress(k, "rfqAdapter", address(rfqAdapter));
        vm.serializeAddress(k, "router", address(router));
        vm.serializeAddress(k, "factory", address(factory));
        vm.serializeAddress(k, "jurisdiction", address(jurisdiction));
        string memory json = vm.serializeAddress(k, "surveillance", address(surveillance));
        vm.writeJson(json, ARTIFACT_PATH);
    }

    function _printSummary(address deployer, address investor, address maker) internal view {
        console2.log("=====================================================");
        console2.log("  Corner Store  -  live stack deployed");
        console2.log("=====================================================");
        console2.log("deployer (owner/operator) :", deployer);
        console2.log("investor (buyer/taker)    :", investor);
        console2.log("rfq maker (dealer)        :", maker);
        console2.log("-----------------------------------------------------");
        console2.log("RWA token (ERC-3643)      :", address(rwaToken));
        console2.log("QUOTE (unregulated cash)  :", address(quote));
        console2.log("AMM pool (MockPool)       :", address(pool));
        console2.log("ComplianceEngine          :", address(engine));
        console2.log("ExecutionRouter           :", address(router));
        console2.log("CornerStoreFactory        :", address(factory));
        console2.log("-----------------------------------------------------");
        console2.log("artifact written to       :", ARTIFACT_PATH);
        console2.log("=====================================================");
    }
}

/// @dev Always-applicable recipe requiring the full Reg D 506(c) 9-element set
///      PLUS conduct surveillance (F-02, STATEFUL). Registered as recipe id 7 and
///      used by scenario 6 to drive the post-trade `onTransfer` surveillance flag
///      without changing the compliance posture of the base policy.
contract DemoSurveillanceRecipe {
    function recipeId() external pure returns (uint16) {
        return 7;
    }

    function version() external pure returns (uint16) {
        return 1;
    }

    function isApplicable(bytes calldata) external pure returns (bool) {
        return true;
    }

    function requiredElements() external pure returns (bytes32[] memory e) {
        e = new bytes32[](10);
        e[0] = "A-01-v1";
        e[1] = "A-02-v1";
        e[2] = "A-03-v1";
        e[3] = "A-04-v1";
        e[4] = "A-05-v1";
        e[5] = "B-01-v1";
        e[6] = "B-02-v1";
        e[7] = "C-01-v1";
        e[8] = "E-01-v1";
        e[9] = "F-02-v1";
    }
}
