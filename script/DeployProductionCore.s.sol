// SPDX-License-Identifier: GPL-3.0
pragma solidity 0.8.17;

import {Script} from "forge-std/Script.sol";
import {console2} from "forge-std/console2.sol";

import {ProductionCoreDeployer} from "./ProductionCoreDeployer.sol";

/// @title DeployProductionCore
/// @notice Deploys only the Corner Store enforcement infrastructure.
/// @dev This script intentionally does not deploy a token, mock venue, legal
///      policy, identity fixture, inventory, or test account. Foundry selects
///      the external signer (`--ledger` or `--account`); secrets are never read
///      from Corner Store configuration.
contract DeployProductionCore is Script, ProductionCoreDeployer {
    string internal constant DEFAULT_ARTIFACT_PATH = "deployments/production-core.json";

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
