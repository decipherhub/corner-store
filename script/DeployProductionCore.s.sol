// SPDX-License-Identifier: GPL-3.0
pragma solidity 0.8.17;

import {Script} from "forge-std/Script.sol";
import {console2} from "forge-std/console2.sol";

import {ElementRegistry} from "../src/registry/ElementRegistry.sol";
import {RecipeRegistry} from "../src/registry/RecipeRegistry.sol";
import {TokenPolicyRegistry} from "../src/registry/TokenPolicyRegistry.sol";
import {OperatorRegistry} from "../src/registry/OperatorRegistry.sol";
import {MakerAuthorizer} from "../src/registry/MakerAuthorizer.sol";
import {ComplianceEngine} from "../src/compliance/ComplianceEngine.sol";
import {ExecutionRouter} from "../src/execution/ExecutionRouter.sol";
import {VenueRegistry} from "../src/execution/VenueRegistry.sol";
import {VenueSelector} from "../src/execution/VenueSelector.sol";
import {UniswapV3Adapter} from "../src/execution/adapters/amm/UniswapV3Adapter.sol";
import {RFQAdapter} from "../src/execution/adapters/rfq/RFQAdapter.sol";

/// @title DeployProductionCore
/// @notice Deploys only the Corner Store enforcement infrastructure.
/// @dev This script intentionally does not deploy a token, mock venue, legal
///      policy, identity fixture, inventory, or test account. Foundry selects
///      the external signer (`--ledger` or `--account`); secrets are never read
///      from Corner Store configuration.
contract DeployProductionCore is Script {
    string internal constant DEFAULT_ARTIFACT_PATH = "deployments/production-core.json";

    error InvalidGovernance();
    error InvalidOperator();
    error NoVenueEnabled();

    struct Deployment {
        address elementReg;
        address recipeReg;
        address policyReg;
        address operatorReg;
        address engine;
        address venueReg;
        address selector;
        address router;
        address ammAdapter;
        address makerAuthorizer;
        address rfqAdapter;
    }

    function run() external returns (Deployment memory deployed) {
        address deployer = vm.envAddress("CORNER_STORE_DEPLOYER");
        address governance = vm.envAddress("CORNER_STORE_GOVERNANCE");
        address operator = vm.envAddress("CORNER_STORE_OPERATOR");
        bool enableAmm = vm.envOr("CORNER_STORE_ENABLE_AMM", false);
        bool enableRfq = vm.envOr("CORNER_STORE_ENABLE_RFQ", true);
        string memory deploymentId = vm.envOr("CORNER_STORE_DEPLOYMENT_ID", string("production-core"));
        string memory sourceCommit = vm.envString("CORNER_STORE_SOURCE_COMMIT");
        string memory contractsHash = vm.envString("CORNER_STORE_CONTRACTS_HASH");
        string memory artifactPath = vm.envOr("CORNER_STORE_ARTIFACT", string(DEFAULT_ARTIFACT_PATH));

        vm.startBroadcast();
        deployed = deployCore(governance, operator, enableAmm, enableRfq);
        vm.stopBroadcast();

        _writeArtifact(
            deployed,
            deployer,
            governance,
            operator,
            enableAmm,
            enableRfq,
            deploymentId,
            sourceCommit,
            contractsHash,
            artifactPath
        );
        _printSummary(deployed, governance, operator, artifactPath);
    }

    /// @notice Public deployment seam used by Foundry tests and external
    ///         orchestration. It performs the same ownership handoff as `run`.
    function deployCore(address governance, address operator, bool enableAmm, bool enableRfq)
        public
        returns (Deployment memory deployed)
    {
        if (governance == address(0)) revert InvalidGovernance();
        if (operator == address(0)) revert InvalidOperator();
        if (!enableAmm && !enableRfq) revert NoVenueEnabled();

        deployed.elementReg = address(new ElementRegistry());
        deployed.recipeReg = address(new RecipeRegistry());
        deployed.policyReg = address(new TokenPolicyRegistry());
        deployed.operatorReg = address(new OperatorRegistry());
        deployed.engine = address(
            new ComplianceEngine(
                TokenPolicyRegistry(deployed.policyReg),
                ElementRegistry(deployed.elementReg),
                RecipeRegistry(deployed.recipeReg)
            )
        );
        deployed.venueReg = address(new VenueRegistry());
        deployed.selector = address(new VenueSelector());

        if (enableAmm) deployed.ammAdapter = address(new UniswapV3Adapter());
        if (enableRfq) {
            deployed.makerAuthorizer = address(new MakerAuthorizer());
            deployed.rfqAdapter = address(new RFQAdapter(MakerAuthorizer(deployed.makerAuthorizer)));
        }

        deployed.router = address(
            new ExecutionRouter(
                ComplianceEngine(deployed.engine),
                VenueRegistry(deployed.venueReg),
                VenueSelector(deployed.selector),
                OperatorRegistry(deployed.operatorReg)
            )
        );
        _wireRouter(deployed, enableAmm, enableRfq);
        _configureOperators(deployed, operator, enableRfq);
        _handoffOwnership(deployed, governance, enableAmm, enableRfq);
    }

    function _configureOperators(Deployment memory deployed, address operator, bool enableRfq) internal {
        // Operators may immediately tighten policy or pause execution. Semantic
        // registration, reopening, and ownership remain with governance.
        TokenPolicyRegistry(deployed.policyReg).setOperator(operator, true);
        OperatorRegistry(deployed.operatorReg).setOperator(operator, true);
        if (enableRfq) {
            MakerAuthorizer(deployed.makerAuthorizer).setOperator(operator, true);
            RFQAdapter(deployed.rfqAdapter).setOperator(operator, true);
        }
    }

    function _wireRouter(Deployment memory deployed, bool enableAmm, bool enableRfq) internal {
        ComplianceEngine(deployed.engine).setRouter(deployed.router);
        if (enableAmm) UniswapV3Adapter(deployed.ammAdapter).setRouter(deployed.router);
        if (enableRfq) RFQAdapter(deployed.rfqAdapter).setRouter(deployed.router);
    }

    function _handoffOwnership(Deployment memory deployed, address governance, bool enableAmm, bool enableRfq)
        internal
    {
        ElementRegistry(deployed.elementReg).transferOwnership(governance);
        RecipeRegistry(deployed.recipeReg).transferOwnership(governance);
        TokenPolicyRegistry(deployed.policyReg).transferOwnership(governance);
        OperatorRegistry(deployed.operatorReg).transferOwnership(governance);
        ComplianceEngine(deployed.engine).transferOwnership(governance);
        VenueRegistry(deployed.venueReg).transferOwnership(governance);
        ExecutionRouter(deployed.router).transferOwnership(governance);
        if (enableAmm) UniswapV3Adapter(deployed.ammAdapter).transferOwnership(governance);
        if (enableRfq) {
            MakerAuthorizer(deployed.makerAuthorizer).transferOwnership(governance);
            RFQAdapter(deployed.rfqAdapter).transferOwnership(governance);
        }
    }

    function _writeArtifact(
        Deployment memory deployed,
        address deployer,
        address governance,
        address operator,
        bool enableAmm,
        bool enableRfq,
        string memory deploymentId,
        string memory sourceCommit,
        string memory contractsHash,
        string memory artifactPath
    ) internal {
        vm.createDir("deployments", true);
        string memory key = "corner-store-production-core";
        vm.serializeUint(key, "schemaVersion", 1);
        vm.serializeString(key, "deploymentId", deploymentId);
        vm.serializeString(key, "sourceCommit", sourceCommit);
        vm.serializeString(key, "contractsHash", contractsHash);
        vm.serializeUint(key, "chainId", block.chainid);
        vm.serializeUint(key, "createdAt", block.timestamp);
        vm.serializeAddress(key, "deployer", deployer);
        vm.serializeAddress(key, "governance", governance);
        vm.serializeAddress(key, "operator", operator);
        vm.serializeBool(key, "ammEnabled", enableAmm);
        vm.serializeBool(key, "rfqEnabled", enableRfq);
        vm.serializeAddress(key, "elementReg", deployed.elementReg);
        vm.serializeAddress(key, "recipeReg", deployed.recipeReg);
        vm.serializeAddress(key, "policyReg", deployed.policyReg);
        vm.serializeAddress(key, "operatorReg", deployed.operatorReg);
        vm.serializeAddress(key, "engine", deployed.engine);
        vm.serializeAddress(key, "venueReg", deployed.venueReg);
        vm.serializeAddress(key, "selector", deployed.selector);
        vm.serializeAddress(key, "router", deployed.router);
        vm.serializeAddress(key, "ammAdapter", deployed.ammAdapter);
        vm.serializeAddress(key, "makerAuthorizer", deployed.makerAuthorizer);
        vm.serializeAddress(key, "rfqAdapter", deployed.rfqAdapter);
        vm.serializeBytes32(key, "elementRegCodeHash", deployed.elementReg.codehash);
        vm.serializeBytes32(key, "recipeRegCodeHash", deployed.recipeReg.codehash);
        vm.serializeBytes32(key, "policyRegCodeHash", deployed.policyReg.codehash);
        vm.serializeBytes32(key, "operatorRegCodeHash", deployed.operatorReg.codehash);
        vm.serializeBytes32(key, "engineCodeHash", deployed.engine.codehash);
        vm.serializeBytes32(key, "venueRegCodeHash", deployed.venueReg.codehash);
        vm.serializeBytes32(key, "selectorCodeHash", deployed.selector.codehash);
        vm.serializeBytes32(key, "routerCodeHash", deployed.router.codehash);
        vm.serializeBytes32(key, "ammAdapterCodeHash", deployed.ammAdapter.codehash);
        vm.serializeBytes32(key, "makerAuthorizerCodeHash", deployed.makerAuthorizer.codehash);
        string memory json = vm.serializeBytes32(key, "rfqAdapterCodeHash", deployed.rfqAdapter.codehash);
        vm.writeJson(json, artifactPath);
    }

    function _printSummary(Deployment memory deployed, address governance, address operator, string memory artifactPath)
        internal
        view
    {
        console2.log("Corner Store production core deployed");
        console2.log("chain id       :", block.chainid);
        console2.log("governance Safe:", governance);
        console2.log("operator       :", operator);
        console2.log("router         :", deployed.router);
        console2.log("artifact       :", artifactPath);
        console2.log("No token, policy, fixture, inventory, or venue was activated.");
    }
}
