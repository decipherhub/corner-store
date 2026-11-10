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
import {ComplianceEngine} from "../src/compliance/ComplianceEngine.sol";
import {BaseRecipe} from "../src/compliance/recipes/BaseRecipe.sol";
import {Erc3643NativeV2} from "../src/compliance/elements/Erc3643NativeV2.sol";
import {EngineSelectionV2} from "../src/compliance/elements/EngineSelectionV2.sol";
import {Affiliate} from "../src/compliance/elements/Affiliate.sol";
import {ExecutionRouterV2} from "../src/execution/ExecutionRouterV2.sol";
import {VenueRegistry} from "../src/execution/VenueRegistry.sol";
import {VenueSelector} from "../src/execution/VenueSelector.sol";
import {ContextEvidence} from "../src/execution/ContextEvidence.sol";
import {RFQAdapterV3} from "../src/execution/adapters/rfq/RFQAdapterV3.sol";
import {ManifestCore, RecipeBinding, RecipeBindingMode, VenueType} from "../src/types/ComplianceTypes.sol";
import {VenueConfig, VenueContextEvidence, CustodyModel} from "../src/types/VenueTypes.sol";

contract ContextProvenanceRecipe is BaseRecipe {
    constructor() BaseRecipe(1, 1, _ids()) {}

    function _ids() private pure returns (bytes32[] memory ids) {
        ids = new bytes32[](2);
        ids[0] = "B-02-v2";
        ids[1] = "B-04-v2";
    }
}

/// @notice Isolated local-only v3 fixture with real ERC-3643/ONCHAINID and token-wiring/direction-aware engine gates.
contract ContextProvenanceFixture is Script, TREXCore {
    string internal constant MNEMONIC = "test test test test test test test test test test test junk";

    MockERC20 internal cash;
    ElementRegistry internal elements;
    RecipeRegistry internal recipes;
    TokenPolicyRegistry internal policies;
    ComplianceEngine internal engine;
    VenueRegistry internal venues;
    ExecutionRouterV2 internal router;
    Affiliate internal affiliate;
    EngineSelectionV2 internal engineSelection;
    RFQAdapterV3 internal adapter;

    function run() external {
        require(block.chainid == 31337, "local Anvil only");
        address admin = vm.addr(vm.deriveKey(MNEMONIC, 0));
        address taker = vm.addr(vm.deriveKey(MNEMONIC, 1));
        address maker = vm.addr(vm.deriveKey(MNEMONIC, 2));
        vm.startBroadcast(vm.deriveKey(MNEMONIC, 0));
        deployTREX(admin, "Context Provenance Fixture", "ctxRWA");
        verifyInvestor(taker);
        verifyInvestor(maker);
        mint(taker, 1000 ether);
        mint(maker, 1000 ether);
        cash = new MockERC20("Context Cash", "ctxUSD");
        cash.mint(taker, 1000 ether);
        cash.mint(maker, 1000 ether);
        elements = new ElementRegistry();
        recipes = new RecipeRegistry();
        policies = new TokenPolicyRegistry(recipes, elements);
        Erc3643NativeV2 nativeToken = new Erc3643NativeV2();
        nativeToken.setErc3643Native(address(rwaToken), true);
        nativeToken.registerWiring(
            address(rwaToken), address(idRegistry), address(compliance), address(rwaToken).codehash
        );
        elements.registerElement("B-02-v2", address(nativeToken));
        engineSelection = new EngineSelectionV2();
        engineSelection.setSupportedEngines(address(rwaToken), 4);
        elements.registerElement("B-04-v2", address(engineSelection));
        recipes.registerRecipe(1, 1, address(new ContextProvenanceRecipe()));
        ManifestCore memory manifest;
        manifest.supportedEngines = uint8(1 << uint256(VenueType.RFQ));
        manifest.fullManifestHash = keccak256("local-context-provenance-fixture");
        RecipeBinding[] memory bindings = new RecipeBinding[](1);
        bindings[0] = RecipeBinding(1, 1, RecipeBindingMode.REQUIRED_BLOCKING, 0, 100);
        policies.registerManifest(address(rwaToken), manifest, bindings);
        policies.approveManifest(address(rwaToken));
        policies.setUnregulated(address(cash));
        engine = new ComplianceEngine(policies, elements, recipes);
        venues = new VenueRegistry();
        router = new ExecutionRouterV2(engine, venues, new VenueSelector(), new OperatorRegistry());
        engine.setRouter(address(router));
        affiliate = new Affiliate();
        affiliate.setTrustedClaimIssuer(admin, true);
        _claim(affiliate, admin, maker);
        _claim(affiliate, admin, taker);
        adapter = new RFQAdapterV3(new MakerAuthorizer(), venues, policies, address(affiliate));
        adapter.setRouter(address(router));
        adapter.setMakerApproved(maker, true);
        VenueConfig memory cfg =
            VenueConfig(VenueType.RFQ, address(adapter), address(0), address(0), CustodyModel.NONE, true);
        venues.registerVenue(address(adapter), cfg);
        venues.setContextImplementation(address(adapter).codehash, 3, 1, true);
        venues.setVenueContextEvidence(
            address(adapter),
            VenueContextEvidence(
                3,
                1,
                address(adapter).codehash,
                address(affiliate),
                address(affiliate).codehash,
                address(policies),
                address(policies).codehash,
                ContextEvidence.configurationHash(cfg)
            )
        );
        vm.stopBroadcast();
        string memory key = "context-provenance";
        vm.serializeAddress(key, "routerV2", address(router));
        vm.serializeAddress(key, "rfqV3Adapter", address(adapter));
        vm.serializeAddress(key, "rfqV3Venue", address(adapter));
        vm.serializeAddress(key, "affiliateSource", address(affiliate));
        vm.serializeAddress(key, "venueReg", address(venues));
        vm.serializeAddress(key, "policyReg", address(policies));
        vm.serializeAddress(key, "engine", address(engine));
        vm.serializeAddress(key, "engineSelectionV2", address(engineSelection));
        vm.serializeAddress(key, "rwa", address(rwaToken));
        string memory json = vm.serializeAddress(key, "cash", address(cash));
        vm.writeJson(json, vm.envString("CONTEXT_PROVENANCE_ARTIFACT"));
    }

    function _claim(Affiliate affiliate, address issuer, address subject) private {
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
