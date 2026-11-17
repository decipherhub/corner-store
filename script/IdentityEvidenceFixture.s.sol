// SPDX-License-Identifier: GPL-3.0
pragma solidity 0.8.17;

import {Script} from "forge-std/Script.sol";
import {TREXCore} from "../test/fixtures/TREXCore.sol";
import {MockERC20} from "../test/mocks/MockERC20.sol";
import {ElementRegistry} from "../src/registry/ElementRegistry.sol";
import {RecipeRegistry} from "../src/registry/RecipeRegistry.sol";
import {TokenPolicyRegistry} from "../src/registry/TokenPolicyRegistry.sol";
import {OperatorRegistry} from "../src/registry/OperatorRegistry.sol";
import {MakerAuthorizer} from "../src/registry/MakerAuthorizer.sol";
import {AttestedAcquisitionSource} from "../src/registry/AttestedAcquisitionSource.sol";
import {IAcquisitionSource} from "../src/interfaces/compliance/IAcquisitionSource.sol";
import {ComplianceEngine} from "../src/compliance/ComplianceEngine.sol";
import {Sanctions} from "../src/compliance/elements/Sanctions.sol";
import {Jurisdiction} from "../src/compliance/elements/Jurisdiction.sol";
import {AccreditedInvestor} from "../src/compliance/elements/AccreditedInvestor.sol";
import {IdentityUniquenessV2} from "../src/compliance/elements/IdentityUniquenessV2.sol";
import {UsTaxResident} from "../src/compliance/elements/UsTaxResident.sol";
import {AssetClassification} from "../src/compliance/elements/AssetClassification.sol";
import {Erc3643NativeV2} from "../src/compliance/elements/Erc3643NativeV2.sol";
import {LockupV2} from "../src/compliance/elements/LockupV2.sol";
import {FormDFiling} from "../src/compliance/elements/FormDFiling.sol";
import {SurveillanceFlagV2} from "../src/compliance/elements/SurveillanceFlagV2.sol";
import {Affiliate} from "../src/compliance/elements/Affiliate.sol";
import {BaseRecipe} from "../src/compliance/recipes/BaseRecipe.sol";
import {RegD506cRecipeV4} from "../src/compliance/recipes/RegD506cRecipeV4.sol";
import {ExecutionRouter} from "../src/execution/ExecutionRouter.sol";
import {ExecutionRouterV2} from "../src/execution/ExecutionRouterV2.sol";
import {VenueRegistry} from "../src/execution/VenueRegistry.sol";
import {VenueSelector} from "../src/execution/VenueSelector.sol";
import {ContextEvidence} from "../src/execution/ContextEvidence.sol";
import {RFQAdapter} from "../src/execution/adapters/rfq/RFQAdapter.sol";
import {RFQAdapterV3} from "../src/execution/adapters/rfq/RFQAdapterV3.sol";
import {
    ManifestCore,
    ManifestPolicyConfig,
    ElementPolicyParameter,
    ElementEnforcementOverride,
    RecipeBinding,
    RecipeBindingMode,
    VenueType
} from "../src/types/ComplianceTypes.sol";
import {VenueConfig, VenueContextEvidence, CustodyModel} from "../src/types/VenueTypes.sol";

contract IdentityEvidenceSurveillanceRecipe is BaseRecipe {
    constructor() BaseRecipe(9, 1, _ids()) {}

    function _ids() private pure returns (bytes32[] memory ids) {
        ids = new bytes32[](1);
        ids[0] = "F-02-v2";
    }
}

/// @notice Local-only fixture. Identity binding, trust and evidence acceptance happen in the runtime test.
contract IdentityEvidenceFixture is Script, TREXCore {
    string internal constant MNEMONIC = "test test test test test test test test test test test junk";

    MockERC20 internal cash;
    ElementRegistry internal elements;
    RecipeRegistry internal recipes;
    TokenPolicyRegistry internal policies;
    IdentityUniquenessV2 internal evidence;
    SurveillanceFlagV2 internal surveillance;
    ComplianceEngine internal engine;
    VenueRegistry internal venues;
    ExecutionRouter internal router;
    ExecutionRouterV2 internal routerV2;
    Affiliate internal affiliate;
    RFQAdapter internal rfqV2;
    RFQAdapterV3 internal rfqV3;

    function run() external {
        require(block.chainid == 31337, "local Anvil only");
        require(block.timestamp > 365 days, "fixture needs elapsed holding period");
        address admin = vm.addr(vm.deriveKey(MNEMONIC, 0));
        address taker = vm.addr(vm.deriveKey(MNEMONIC, 1));
        address maker = vm.addr(vm.deriveKey(MNEMONIC, 2));
        vm.startBroadcast(vm.deriveKey(MNEMONIC, 0));
        deployTREX(admin, "Identity Evidence Fixture", "idRWA");
        verifyInvestor(taker);
        verifyInvestor(maker);
        mint(taker, 1000 ether);
        mint(maker, 1000 ether);
        cash = new MockERC20("Identity Cash", "idUSD");
        cash.mint(taker, 1000 ether);
        cash.mint(maker, 1000 ether);
        elements = new ElementRegistry();
        recipes = new RecipeRegistry();
        policies = new TokenPolicyRegistry(recipes, elements);
        _elements(taker, maker);
        recipes.registerRecipe(1, 4, address(new RegD506cRecipeV4()));
        recipes.registerRecipe(9, 1, address(new IdentityEvidenceSurveillanceRecipe()));
        _manifest();
        engine = new ComplianceEngine(policies, elements, recipes);
        venues = new VenueRegistry();
        VenueSelector selector = new VenueSelector();
        OperatorRegistry operators = new OperatorRegistry();
        router = new ExecutionRouter(engine, venues, selector, operators);
        routerV2 = new ExecutionRouterV2(engine, venues, selector, operators);
        engine.setRouter(address(router));
        surveillance.setEngine(address(engine));
        affiliate = new Affiliate();
        affiliate.setTrustedClaimIssuer(admin, true);
        _claim(admin, taker);
        _claim(admin, maker);
        _venues(maker);
        vm.stopBroadcast();
        string memory key = "identity-evidence";
        vm.serializeAddress(key, "router", address(router));
        vm.serializeAddress(key, "routerV2", address(routerV2));
        vm.serializeAddress(key, "rfqV2", address(rfqV2));
        vm.serializeAddress(key, "rfqV3", address(rfqV3));
        vm.serializeAddress(key, "affiliateSource", address(affiliate));
        vm.serializeAddress(key, "venueReg", address(venues));
        vm.serializeAddress(key, "policyReg", address(policies));
        vm.serializeAddress(key, "engine", address(engine));
        vm.serializeAddress(key, "identityEvidenceV2", address(evidence));
        vm.serializeAddress(key, "surveillance", address(surveillance));
        vm.serializeAddress(key, "rwa", address(rwaToken));
        string memory json = vm.serializeAddress(key, "cash", address(cash));
        vm.writeJson(json, vm.envString("IDENTITY_EVIDENCE_ARTIFACT"));
    }

    function _elements(address taker, address maker) private {
        elements.registerElement("A-01-v1", address(new Sanctions()));
        Jurisdiction jurisdiction = new Jurisdiction();
        jurisdiction.setJurisdictionAllowed("US", true);
        jurisdiction.setJurisdiction(taker, "US");
        jurisdiction.setJurisdiction(maker, "US");
        elements.registerElement("A-02-v1", address(jurisdiction));
        AccreditedInvestor accredited = new AccreditedInvestor();
        accredited.setAccredited(taker, true);
        accredited.setAccredited(maker, true);
        elements.registerElement("A-03-v1", address(accredited));
        evidence = new IdentityUniquenessV2();
        evidence.setEnforceCounterparty(true);
        elements.registerElement("A-04-v2", address(evidence));
        elements.registerElement("A-05-v1", address(new UsTaxResident()));
        AssetClassification classification = new AssetClassification("REG_D");
        classification.setClassification(address(rwaToken), "REG_D");
        elements.registerElement("B-01-v1", address(classification));
        Erc3643NativeV2 nativeToken = new Erc3643NativeV2();
        nativeToken.setErc3643Native(address(rwaToken), true);
        nativeToken.registerWiring(
            address(rwaToken), address(idRegistry), address(compliance), address(rwaToken).codehash
        );
        elements.registerElement("B-02-v2", address(nativeToken));
        AttestedAcquisitionSource acquisition = new AttestedAcquisitionSource();
        acquisition.setSnapshot(
            taker,
            address(rwaToken),
            1,
            type(uint64).max,
            keccak256("local-taker-acquisition"),
            IAcquisitionSource.AcquisitionStatus.VALID
        );
        acquisition.setSnapshot(
            maker,
            address(rwaToken),
            1,
            type(uint64).max,
            keccak256("local-maker-acquisition"),
            IAcquisitionSource.AcquisitionStatus.VALID
        );
        elements.registerElement("C-01-v2", address(new LockupV2(address(acquisition), 365 days)));
        FormDFiling filing = new FormDFiling();
        filing.setFormDFiled(address(rwaToken), true, keccak256("local-filing"));
        elements.registerElement("E-01-v1", address(filing));
        surveillance = new SurveillanceFlagV2();
        elements.registerElement("F-02-v2", address(surveillance));
    }

    function _manifest() private {
        ManifestCore memory manifest;
        manifest.supportedEngines = uint8(1 << uint256(VenueType.RFQ));
        manifest.fullManifestHash = keccak256("local-identity-evidence-fixture");
        RecipeBinding[] memory bindings = new RecipeBinding[](2);
        bindings[0] = RecipeBinding(1, 4, RecipeBindingMode.REQUIRED_BLOCKING, 0, 100);
        bindings[1] = RecipeBinding(9, 1, RecipeBindingMode.REQUIRED_BLOCKING, 0, 90);
        ManifestPolicyConfig memory config;
        config.schemaVersion = 1;
        config.elementParameters = new ElementPolicyParameter[](1);
        config.elementParameters[0] =
            ElementPolicyParameter(0, "A-04-v2", evidence.PARAMETER_SCHEMA_ID(), 1, abi.encode(uint8(1), uint8(1)));
        policies.registerManifest(address(rwaToken), manifest, bindings, new ElementEnforcementOverride[](0), config);
        policies.approveManifest(address(rwaToken));
        policies.setUnregulated(address(cash));
    }

    function _venues(address maker) private {
        rfqV2 = new RFQAdapter(new MakerAuthorizer());
        rfqV2.setRouter(address(router));
        rfqV2.setMakerApproved(maker, true);
        venues.registerVenue(
            address(rfqV2), VenueConfig(VenueType.RFQ, address(rfqV2), address(0), address(0), CustodyModel.NONE, true)
        );
        rfqV3 = new RFQAdapterV3(new MakerAuthorizer(), venues, policies, address(affiliate));
        rfqV3.setRouter(address(routerV2));
        rfqV3.setMakerApproved(maker, true);
        VenueConfig memory cfg =
            VenueConfig(VenueType.RFQ, address(rfqV3), address(0), address(0), CustodyModel.NONE, true);
        venues.registerVenue(address(rfqV3), cfg);
        venues.setContextImplementation(address(rfqV3).codehash, 3, 1, true);
        venues.setVenueContextEvidence(
            address(rfqV3),
            VenueContextEvidence(
                3,
                1,
                address(rfqV3).codehash,
                address(affiliate),
                address(affiliate).codehash,
                address(policies),
                address(policies).codehash,
                ContextEvidence.configurationHash(cfg)
            )
        );
    }

    function _claim(address issuer, address subject) private {
        affiliate.setClaim(
            subject,
            address(rwaToken),
            Affiliate.AffiliateBasis.NOT_AFFILIATE,
            Affiliate.DeterminationSource.ISSUER_REGISTRY,
            issuer,
            uint64(block.timestamp),
            0
        );
    }
}
