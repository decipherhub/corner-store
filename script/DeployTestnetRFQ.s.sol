// SPDX-License-Identifier: GPL-3.0
pragma solidity 0.8.17;

import {Script} from "forge-std/Script.sol";
import {console2} from "forge-std/console2.sol";

import {TREXCore} from "../test/fixtures/TREXCore.sol";
import {ProductionCoreDeployer} from "./ProductionCoreDeployer.sol";

import {Governed} from "../src/auth/Governed.sol";
import {ElementRegistry} from "../src/registry/ElementRegistry.sol";
import {RecipeRegistry} from "../src/registry/RecipeRegistry.sol";
import {TokenPolicyRegistry} from "../src/registry/TokenPolicyRegistry.sol";
import {OperatorRegistry} from "../src/registry/OperatorRegistry.sol";
import {AttestedAcquisitionSource} from "../src/registry/AttestedAcquisitionSource.sol";
import {MakerAuthorizer} from "../src/registry/MakerAuthorizer.sol";

import {ComplianceEngine} from "../src/compliance/ComplianceEngine.sol";
import {Sanctions} from "../src/compliance/elements/Sanctions.sol";
import {AccreditedInvestor} from "../src/compliance/elements/AccreditedInvestor.sol";
import {QualifiedPurchaser} from "../src/compliance/elements/QualifiedPurchaser.sol";
import {BuidlMinimumInvestment} from "../src/compliance/elements/BuidlMinimumInvestment.sol";
import {Jurisdiction} from "../src/compliance/elements/Jurisdiction.sol";
import {IdentityUniqueness} from "../src/compliance/elements/IdentityUniqueness.sol";
import {UsTaxResident} from "../src/compliance/elements/UsTaxResident.sol";
import {AssetClassification} from "../src/compliance/elements/AssetClassification.sol";
import {Erc3643Native} from "../src/compliance/elements/Erc3643Native.sol";
import {FormDFiling} from "../src/compliance/elements/FormDFiling.sol";
import {Lockup} from "../src/compliance/elements/Lockup.sol";
import {IAcquisitionSource} from "../src/interfaces/compliance/IAcquisitionSource.sol";
import {RegD506cRecipe} from "../src/compliance/recipes/RegD506cRecipe.sol";
import {BuidlLikeFundRecipe} from "../src/compliance/recipes/BuidlLikeFundRecipe.sol";
import {BuidlLikeDemoAsset} from "../src/demo/BuidlLikeDemoAsset.sol";

import {VenueRegistry} from "../src/execution/VenueRegistry.sol";
import {ExecutionRouter} from "../src/execution/ExecutionRouter.sol";
import {RFQAdapter} from "../src/execution/adapters/rfq/RFQAdapter.sol";
import {MockERC20} from "../test/mocks/MockERC20.sol";
import {ManifestCore, PolicyStatus, RecipeBinding, VenueType} from "../src/types/ComplianceTypes.sol";
import {VenueConfig, CustodyModel} from "../src/types/VenueTypes.sol";

/// @title DeployTestnetRFQ
/// @notice Deploys a public-testnet, RFQ-only Corner Store reference stack.
/// @dev This is a hackathon/reference fixture, not a production issuer
///      onboarding flow. Unlike DeployStack it never derives Anvil accounts and
///      never broadcasts participant approvals. All actors are injected through
///      environment variables and Foundry supplies the external deployer signer.
contract DeployTestnetRFQ is Script, TREXCore, ProductionCoreDeployer {
    address internal constant RFQ_VENUE = 0x000000000000000000000000000000000000F00D;
    bytes32 internal constant ALLOWED_JURISDICTION = bytes32("US");
    bytes32 internal constant REG_D_CLASS = bytes32("REG_D");
    uint64 internal constant LOCKUP_SECONDS = 365 days;
    uint8 internal constant ENGINES_RFQ = uint8(1 << uint8(VenueType.RFQ));
    string internal constant DEFAULT_ARTIFACT = "deployments/.testnet-rfq-plan.json";

    struct Actors {
        address deployer;
        address governance;
        address operator;
        address maker;
        address investor;
        address eligibleInvestorB;
        address ineligibleInvestor;
    }

    struct Balances {
        uint256 investorQuote;
        uint256 investorRwa;
        uint256 makerQuote;
        uint256 makerRwa;
    }

    ElementRegistry internal elementReg;
    RecipeRegistry internal recipeReg;
    TokenPolicyRegistry internal policyReg;
    OperatorRegistry internal operatorReg;
    ComplianceEngine internal engine;
    VenueRegistry internal venueReg;
    RFQAdapter internal rfqAdapter;
    MakerAuthorizer internal makerAuthorizer;

    Jurisdiction internal jurisdiction;
    Sanctions internal sanctions;
    AccreditedInvestor internal accreditedInvestor;
    IdentityUniqueness internal identityUniqueness;
    AssetClassification internal assetClassification;
    Erc3643Native internal erc3643Native;
    FormDFiling internal formD;
    UsTaxResident internal usTaxResident;
    AttestedAcquisitionSource internal acquisitionSource;
    QualifiedPurchaser internal qualifiedPurchaser;
    Lockup internal lockup;
    BuidlMinimumInvestment internal minimumInvestment;
    RegD506cRecipe internal issuanceRecipe;
    BuidlLikeFundRecipe internal fundRecipe;
    MockERC20 internal quoteToken;
    address internal makerIdentity;
    address internal investorIdentity;
    address internal eligibleInvestorBIdentity;
    address internal ineligibleInvestorIdentity;

    function run() external returns (Deployment memory core) {
        Actors memory actors = _loadActors();
        Balances memory balances = _loadBalances();
        issuerKey = vm.envUint("CORNER_STORE_TESTNET_ISSUER_KEY");
        require(issuerKey != 0, "issuer key is required");

        string memory artifactPath = vm.envOr("CORNER_STORE_ARTIFACT", string(DEFAULT_ARTIFACT));
        string memory deploymentId = vm.envOr("CORNER_STORE_DEPLOYMENT_ID", string("hackathon-testnet-rfq"));
        string memory sourceCommit = vm.envOr("CORNER_STORE_SOURCE_COMMIT", string("unknown"));

        vm.startBroadcast();

        deployTREX(actors.deployer, BuidlLikeDemoAsset.TOKEN_NAME, BuidlLikeDemoAsset.TOKEN_SYMBOL);
        core = deployCore(actors.deployer, actors.deployer, false, true);
        _bindCore(core);

        _deployPolicy();
        _configureAssetAndActors(actors, balances);
        _activateRfqPolicy(actors.maker);
        _handoffCornerStore(actors);

        vm.stopBroadcast();

        _writeArtifact(actors, core, artifactPath, deploymentId, sourceCommit);
        _printSummary(actors, core, artifactPath);
    }

    function _loadActors() internal view returns (Actors memory actors) {
        actors.deployer = vm.envAddress("CORNER_STORE_TESTNET_DEPLOYER");
        actors.governance = vm.envOr("CORNER_STORE_GOVERNANCE", actors.deployer);
        actors.operator = vm.envOr("CORNER_STORE_OPERATOR", actors.deployer);
        actors.maker = vm.envAddress("CORNER_STORE_TESTNET_MAKER");
        actors.investor = vm.envAddress("CORNER_STORE_TESTNET_INVESTOR");
        actors.eligibleInvestorB = vm.envAddress("CORNER_STORE_TESTNET_INVESTOR_B");
        actors.ineligibleInvestor = vm.envAddress("CORNER_STORE_TESTNET_INELIGIBLE_INVESTOR");

        require(actors.deployer != address(0), "deployer is required");
        require(actors.governance != address(0), "governance is required");
        require(actors.operator != address(0), "operator is required");
        require(actors.maker != address(0), "maker is required");
        require(actors.investor != address(0), "investor is required");
        require(actors.eligibleInvestorB != address(0), "investor B is required");
        require(actors.ineligibleInvestor != address(0), "ineligible investor is required");
        require(
            actors.maker != actors.investor && actors.maker != actors.eligibleInvestorB
                && actors.maker != actors.ineligibleInvestor && actors.investor != actors.eligibleInvestorB
                && actors.investor != actors.ineligibleInvestor
                && actors.eligibleInvestorB != actors.ineligibleInvestor,
            "participant addresses must be unique"
        );
        require(
            actors.deployer != actors.maker && actors.deployer != actors.investor
                && actors.deployer != actors.eligibleInvestorB && actors.deployer != actors.ineligibleInvestor
                && actors.governance != actors.maker && actors.governance != actors.investor
                && actors.governance != actors.eligibleInvestorB && actors.governance != actors.ineligibleInvestor
                && actors.operator != actors.maker && actors.operator != actors.investor
                && actors.operator != actors.eligibleInvestorB && actors.operator != actors.ineligibleInvestor,
            "control-plane and participant addresses must be separate"
        );
    }

    function _loadBalances() internal view returns (Balances memory balances) {
        balances.investorQuote = vm.envOr("CORNER_STORE_TESTNET_INVESTOR_QUOTE", uint256(25_000_000 ether));
        balances.investorRwa = vm.envOr("CORNER_STORE_TESTNET_INVESTOR_RWA", uint256(25_000_000 ether));
        balances.makerQuote = vm.envOr("CORNER_STORE_TESTNET_MAKER_QUOTE", uint256(100_000_000 ether));
        balances.makerRwa = vm.envOr("CORNER_STORE_TESTNET_MAKER_RWA", uint256(100_000_000 ether));
        require(
            balances.investorQuote > 0 && balances.investorRwa > 0 && balances.makerQuote > 0 && balances.makerRwa > 0,
            "initial balances must be positive"
        );
    }

    function _bindCore(Deployment memory core) internal {
        elementReg = ElementRegistry(core.elementReg);
        recipeReg = RecipeRegistry(core.recipeReg);
        policyReg = TokenPolicyRegistry(core.policyReg);
        operatorReg = OperatorRegistry(core.operatorReg);
        engine = ComplianceEngine(core.engine);
        venueReg = VenueRegistry(core.venueReg);
        rfqAdapter = RFQAdapter(core.rfqAdapter);
        makerAuthorizer = MakerAuthorizer(core.makerAuthorizer);
    }

    function _deployPolicy() internal {
        sanctions = new Sanctions();
        elementReg.registerElement(bytes32("A-01-v1"), address(sanctions));

        jurisdiction = new Jurisdiction();
        elementReg.registerElement(bytes32("A-02-v1"), address(jurisdiction));

        accreditedInvestor = new AccreditedInvestor();
        elementReg.registerElement(bytes32("A-03-v1"), address(accreditedInvestor));

        identityUniqueness = new IdentityUniqueness();
        elementReg.registerElement(bytes32("A-04-v1"), address(identityUniqueness));

        usTaxResident = new UsTaxResident();
        elementReg.registerElement(bytes32("A-05-v1"), address(usTaxResident));

        assetClassification = new AssetClassification(REG_D_CLASS);
        elementReg.registerElement(bytes32("B-01-v1"), address(assetClassification));

        erc3643Native = new Erc3643Native();
        elementReg.registerElement(bytes32("B-02-v1"), address(erc3643Native));

        acquisitionSource = new AttestedAcquisitionSource();
        lockup = new Lockup(address(acquisitionSource), LOCKUP_SECONDS);
        elementReg.registerElement(bytes32("C-01-v1"), address(lockup));

        formD = new FormDFiling();
        elementReg.registerElement(bytes32("E-01-v1"), address(formD));

        qualifiedPurchaser = new QualifiedPurchaser();
        elementReg.registerElement(bytes32("A-13-v1"), address(qualifiedPurchaser));
        minimumInvestment = new BuidlMinimumInvestment();
        elementReg.registerElement(bytes32("BUIDL-MIN-v1"), address(minimumInvestment));

        issuanceRecipe = new RegD506cRecipe();
        fundRecipe = new BuidlLikeFundRecipe();
        recipeReg.registerRecipe(1, 2, address(issuanceRecipe));
        recipeReg.registerRecipe(3, 1, address(fundRecipe));
    }

    function _configureAssetAndActors(Actors memory actors, Balances memory balances) internal {
        quoteToken = new MockERC20("Testnet Quote USD", "tqUSD");

        assetClassification.setClassification(address(rwaToken), REG_D_CLASS);
        erc3643Native.setErc3643Native(address(rwaToken), true);
        formD.setFormDFiled(address(rwaToken), true, keccak256("HACKATHON.TESTNET.FORM_D_FIXTURE"));
        jurisdiction.setJurisdictionAllowed(ALLOWED_JURISDICTION, true);
        policyReg.setUnregulated(address(quoteToken));

        investorIdentity = _verifyAndAttest(actors.investor, true);
        eligibleInvestorBIdentity = _verifyAndAttest(actors.eligibleInvestorB, true);
        ineligibleInvestorIdentity = _verifyAndAttest(actors.ineligibleInvestor, false);
        makerIdentity = address(verifyInvestor(actors.maker));

        quoteToken.mint(actors.investor, balances.investorQuote);
        quoteToken.mint(actors.eligibleInvestorB, balances.investorQuote);
        quoteToken.mint(actors.ineligibleInvestor, balances.investorQuote);
        quoteToken.mint(actors.maker, balances.makerQuote);

        mint(actors.investor, balances.investorRwa);
        mint(actors.eligibleInvestorB, balances.investorRwa);
        mint(actors.ineligibleInvestor, balances.investorRwa);
        mint(actors.maker, balances.makerRwa);
    }

    function _verifyAndAttest(address investor, bool isQp) internal returns (address identity) {
        identity = address(verifyInvestor(investor));
        jurisdiction.setJurisdiction(investor, ALLOWED_JURISDICTION);
        identityUniqueness.bindIdentity(investor, keccak256(abi.encode("TESTNET_IDENTITY", investor)));
        accreditedInvestor.setAccredited(investor, true);
        qualifiedPurchaser.setQp(investor, isQp);
        acquisitionSource.setSnapshot(
            investor,
            address(rwaToken),
            uint64(1),
            uint64(block.timestamp + 30 days),
            keccak256(abi.encode("HACKATHON_TESTNET_TA_FIXTURE", investor)),
            IAcquisitionSource.AcquisitionStatus.VALID
        );
    }

    function _activateRfqPolicy(address maker) internal {
        ManifestCore memory manifest = BuidlLikeDemoAsset.manifest(ENGINES_RFQ);
        RecipeBinding[] memory bindings = BuidlLikeDemoAsset.recipeBindings();
        policyReg.registerManifest(address(rwaToken), manifest, bindings);
        policyReg.approveManifest(address(rwaToken));

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
        rfqAdapter.setMakerApproved(maker, true);
    }

    function _handoffCornerStore(Actors memory actors) internal {
        _handoffGoverned(address(sanctions), actors.deployer, actors.operator, actors.governance);
        _handoffGoverned(address(jurisdiction), actors.deployer, actors.operator, actors.governance);
        _handoffGoverned(address(accreditedInvestor), actors.deployer, actors.operator, actors.governance);
        _handoffGoverned(address(identityUniqueness), actors.deployer, actors.operator, actors.governance);
        _handoffGoverned(address(usTaxResident), actors.deployer, actors.operator, actors.governance);
        _handoffGoverned(address(assetClassification), actors.deployer, actors.operator, actors.governance);
        _handoffGoverned(address(erc3643Native), actors.deployer, actors.operator, actors.governance);
        _handoffGoverned(address(formD), actors.deployer, actors.operator, actors.governance);
        _handoffGoverned(address(acquisitionSource), actors.deployer, actors.operator, actors.governance);
        _handoffGoverned(address(qualifiedPurchaser), actors.deployer, actors.operator, actors.governance);

        if (actors.operator != actors.deployer) {
            policyReg.setOperator(actors.operator, true);
            operatorReg.setOperator(actors.operator, true);
            makerAuthorizer.setOperator(actors.operator, true);
            rfqAdapter.setOperator(actors.operator, true);
        }

        if (actors.governance != actors.deployer) {
            elementReg.transferOwnership(actors.governance);
            recipeReg.transferOwnership(actors.governance);
            policyReg.transferOwnership(actors.governance);
            operatorReg.transferOwnership(actors.governance);
            engine.transferOwnership(actors.governance);
            venueReg.transferOwnership(actors.governance);
            ExecutionRouter(coreRouter()).transferOwnership(actors.governance);
            rfqAdapter.transferOwnership(actors.governance);
            makerAuthorizer.transferOwnership(actors.governance);
        }
    }

    function _handoffGoverned(address target, address deployer, address operator, address governance) internal {
        Governed governed = Governed(target);
        if (operator != deployer) governed.setOperator(operator, true);
        if (governance != deployer) governed.transferOwnership(governance);
    }

    function coreRouter() internal view returns (address) {
        return address(engine.router());
    }

    function _writeArtifact(
        Actors memory actors,
        Deployment memory core,
        string memory artifactPath,
        string memory deploymentId,
        string memory sourceCommit
    ) internal {
        vm.createDir("deployments", true);
        string memory key = "corner-store-testnet-rfq";
        vm.serializeUint(key, "schemaVersion", 1);
        vm.serializeString(key, "deploymentId", deploymentId);
        vm.serializeString(key, "sourceCommit", sourceCommit);
        vm.serializeUint(key, "chainId", block.chainid);
        vm.serializeUint(key, "createdAt", block.timestamp);
        vm.serializeString(key, "assetProfile", "buidl-like");
        vm.serializeString(key, "activationMode", "public-testnet-reference-fixture");
        vm.serializeBool(key, "productionDeployment", false);
        vm.serializeBool(key, "participantApprovalsRequired", true);
        vm.serializeAddress(key, "deployer", actors.deployer);
        vm.serializeAddress(key, "governance", actors.governance);
        vm.serializeAddress(key, "operator", actors.operator);
        vm.serializeAddress(key, "maker", actors.maker);
        vm.serializeAddress(key, "investor", actors.investor);
        vm.serializeAddress(key, "eligibleInvestorB", actors.eligibleInvestorB);
        vm.serializeAddress(key, "ineligibleInvestor", actors.ineligibleInvestor);
        vm.serializeAddress(key, "rwaToken", address(rwaToken));
        vm.serializeAddress(key, "quote", address(quoteToken));
        vm.serializeAddress(key, "rfqVenue", RFQ_VENUE);
        vm.serializeAddress(key, "elementReg", core.elementReg);
        vm.serializeAddress(key, "recipeReg", core.recipeReg);
        vm.serializeAddress(key, "policyReg", core.policyReg);
        vm.serializeAddress(key, "operatorReg", core.operatorReg);
        vm.serializeAddress(key, "engine", core.engine);
        vm.serializeAddress(key, "venueReg", core.venueReg);
        vm.serializeAddress(key, "selector", core.selector);
        vm.serializeAddress(key, "router", core.router);
        vm.serializeAddress(key, "makerAuthorizer", core.makerAuthorizer);
        vm.serializeAddress(key, "rfqAdapter", core.rfqAdapter);
        vm.serializeAddress(key, "jurisdiction", address(jurisdiction));
        vm.serializeAddress(key, "sanctions", address(sanctions));
        vm.serializeAddress(key, "accreditedInvestor", address(accreditedInvestor));
        vm.serializeAddress(key, "identityUniqueness", address(identityUniqueness));
        vm.serializeAddress(key, "usTaxResident", address(usTaxResident));
        vm.serializeAddress(key, "assetClassification", address(assetClassification));
        vm.serializeAddress(key, "erc3643Native", address(erc3643Native));
        vm.serializeAddress(key, "formD", address(formD));
        vm.serializeAddress(key, "acquisitionSource", address(acquisitionSource));
        vm.serializeAddress(key, "qualifiedPurchaser", address(qualifiedPurchaser));
        vm.serializeAddress(key, "lockup", address(lockup));
        vm.serializeAddress(key, "minimumInvestment", address(minimumInvestment));
        vm.serializeAddress(key, "issuanceRecipe", address(issuanceRecipe));
        vm.serializeAddress(key, "fundRecipe", address(fundRecipe));
        vm.serializeAddress(key, "identityRegistry", address(idRegistry));
        vm.serializeAddress(key, "identityRegistryStorage", address(identityStorage));
        vm.serializeAddress(key, "modularCompliance", address(compliance));
        vm.serializeAddress(key, "trustedIssuersRegistry", address(trustedIssuers));
        vm.serializeAddress(key, "claimIssuer", address(claimIssuer));
        vm.serializeAddress(key, "makerIdentity", makerIdentity);
        vm.serializeAddress(key, "investorIdentity", investorIdentity);
        vm.serializeAddress(key, "eligibleInvestorBIdentity", eligibleInvestorBIdentity);
        vm.serializeAddress(key, "ineligibleInvestorIdentity", ineligibleInvestorIdentity);
        string memory json = vm.serializeAddress(key, "claimTopicsRegistry", address(claimTopics));
        vm.writeJson(json, artifactPath);
    }

    function _printSummary(Actors memory actors, Deployment memory core, string memory artifactPath) internal view {
        console2.log("Corner Store public-testnet RFQ reference stack deployed");
        console2.log("chain id    :", block.chainid);
        console2.log("deployer    :", actors.deployer);
        console2.log("governance  :", actors.governance);
        console2.log("operator    :", actors.operator);
        console2.log("RWA token   :", address(rwaToken));
        console2.log("quote token :", address(quoteToken));
        console2.log("router      :", core.router);
        console2.log("RFQ adapter :", core.rfqAdapter);
        console2.log("artifact    :", artifactPath);
        console2.log("Participant token approvals are still required.");
    }
}
