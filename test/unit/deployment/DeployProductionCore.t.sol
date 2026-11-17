// SPDX-License-Identifier: GPL-3.0
pragma solidity 0.8.17;

import {Test} from "forge-std/Test.sol";
import {DeployProductionCore} from "../../../script/DeployProductionCore.s.sol";
import {ProductionCoreDeployer} from "../../../script/ProductionCoreDeployer.sol";
import {DeployStack} from "../../../script/DeployStack.s.sol";
import {Governed} from "../../../src/auth/Governed.sol";
import {ComplianceEngine} from "../../../src/compliance/ComplianceEngine.sol";
import {ExecutionRouter} from "../../../src/execution/ExecutionRouter.sol";
import {UniswapV3Adapter} from "../../../src/execution/adapters/amm/UniswapV3Adapter.sol";
import {RFQAdapter} from "../../../src/execution/adapters/rfq/RFQAdapter.sol";
import {TokenPolicyRegistry} from "../../../src/registry/TokenPolicyRegistry.sol";
import {OperatorRegistry} from "../../../src/registry/OperatorRegistry.sol";
import {MakerAuthorizer} from "../../../src/registry/MakerAuthorizer.sol";
import {ElementRegistry} from "../../../src/registry/ElementRegistry.sol";
import {RedFlagKnowledgeBarV2} from "../../../src/compliance/elements/RedFlagKnowledgeBarV2.sol";
import {MinimumTradeAmount} from "../../../src/compliance/elements/MinimumTradeAmount.sol";
import {EnforcementAction} from "../../../src/types/ComplianceTypes.sol";
import {PolicyStatus} from "../../../src/types/ComplianceTypes.sol";

contract DeployProductionCoreTest is Test {
    DeployProductionCore internal script;
    address internal governance = makeAddr("governance-safe");
    address internal operator = makeAddr("operator");

    function setUp() external {
        script = new DeployProductionCore();
    }

    function testDeploysCoreWithSafeOwnershipAndOperatorGates() external {
        DeployProductionCore.Deployment memory d = script.deployCore(governance, operator, true, true);

        _assertOwner(d.elementReg);
        _assertOwner(d.recipeReg);
        _assertOwner(d.policyReg);
        _assertOwner(d.operatorReg);
        _assertOwner(d.engine);
        _assertOwner(d.venueReg);
        _assertOwner(d.router);
        _assertOwner(d.ammAdapter);
        _assertOwner(d.makerAuthorizer);
        _assertOwner(d.rfqAdapter);

        assertTrue(TokenPolicyRegistry(d.policyReg).isOperator(operator));
        assertTrue(OperatorRegistry(d.operatorReg).isOperator(operator));
        assertTrue(MakerAuthorizer(d.makerAuthorizer).isOperator(operator));
        assertTrue(RFQAdapter(d.rfqAdapter).isOperator(operator));
        assertEq(ComplianceEngine(d.engine).router(), d.router);
        assertEq(UniswapV3Adapter(d.ammAdapter).router(), d.router);
        assertEq(RFQAdapter(d.rfqAdapter).router(), d.router);

        // Production core deployment must not silently onboard or classify an
        // arbitrary external token.
        assertEq(
            uint8(TokenPolicyRegistry(d.policyReg).statusOf(makeAddr("external-token"))), uint8(PolicyStatus.UNKNOWN)
        );
    }

    function testCanDeployRfqOnlyWithoutDemoAmm() external {
        DeployProductionCore.Deployment memory d = script.deployCore(governance, operator, false, true);
        assertEq(d.ammAdapter, address(0));
        assertTrue(d.rfqAdapter != address(0));
        assertTrue(d.makerAuthorizer != address(0));
        assertEq(RFQAdapter(d.rfqAdapter).router(), d.router);
    }

    function testCanDeployAmmOnlyWithoutRfqSignerSurface() external {
        DeployProductionCore.Deployment memory d = script.deployCore(governance, operator, true, false);
        assertTrue(d.ammAdapter != address(0));
        assertEq(d.rfqAdapter, address(0));
        assertEq(d.makerAuthorizer, address(0));
    }

    function testRejectsUnsafeDeploymentInputs() external {
        vm.expectRevert(ProductionCoreDeployer.InvalidGovernance.selector);
        script.deployCore(address(0), operator, false, true);

        vm.expectRevert(ProductionCoreDeployer.InvalidOperator.selector);
        script.deployCore(governance, address(0), false, true);

        vm.expectRevert(ProductionCoreDeployer.NoVenueEnabled.selector);
        script.deployCore(governance, operator, false, false);
    }

    function testRunSerializesCoreArtifactWithoutChangingExistingCandidate() external {
        string memory path = "deployments/production-core.candidate.json";
        bool existed = vm.exists(path);
        bytes memory previous = existed ? vm.readFileBinary(path) : bytes("");
        vm.setEnv("CORNER_STORE_DEPLOYER", vm.toString(address(this)));
        vm.setEnv("CORNER_STORE_GOVERNANCE", vm.toString(governance));
        vm.setEnv("CORNER_STORE_OPERATOR", vm.toString(operator));
        vm.setEnv("CORNER_STORE_ENABLE_AMM", "true");
        vm.setEnv("CORNER_STORE_ENABLE_RFQ", "true");
        vm.setEnv("CORNER_STORE_DEPLOYMENT_ID", "assurance-fixture");
        vm.setEnv("CORNER_STORE_SOURCE_COMMIT", "assurance-source");
        vm.setEnv("CORNER_STORE_CONTRACTS_HASH", "assurance-contracts");
        DeployProductionCore.Deployment memory deployed;
        try script.run() returns (DeployProductionCore.Deployment memory result) {
            deployed = result;
        } catch (bytes memory reason) {
            _restoreCandidate(path, existed, previous);
            assembly {
                revert(add(reason, 32), mload(reason))
            }
        }
        string memory json = vm.readFile(path);
        _restoreCandidate(path, existed, previous);
        assertEq(vm.parseJsonUint(json, ".schemaVersion"), 1);
        assertEq(vm.parseJsonUint(json, ".chainId"), block.chainid);
        assertEq(vm.parseJsonString(json, ".deploymentId"), "assurance-fixture");
        assertEq(vm.parseJsonString(json, ".sourceCommit"), "assurance-source");
        assertEq(vm.parseJsonString(json, ".contractsHash"), "assurance-contracts");
        assertEq(vm.parseJsonAddress(json, ".governance"), governance);
        assertEq(vm.parseJsonAddress(json, ".operator"), operator);
        assertEq(vm.parseJsonAddress(json, ".router"), deployed.router);
        assertEq(vm.parseJsonBytes32(json, ".engineCodeHash"), deployed.engine.codehash);
        assertEq(vm.parseJsonBytes32(json, ".rfqAdapterCodeHash"), deployed.rfqAdapter.codehash);
        _assertOwner(deployed.router);
        assertEq(ComplianceEngine(deployed.engine).router(), deployed.router);
    }

    function _restoreCandidate(string memory path, bool existed, bytes memory previous) internal {
        if (existed) vm.writeFileBinary(path, previous);
        else if (vm.exists(path)) vm.removeFile(path);
    }

    function testProductionRegistryRejectsReferenceOnlyRedFlagBothOverloads() external {
        DeployProductionCore.Deployment memory d = script.deployCore(governance, operator, false, true);
        RedFlagKnowledgeBarV2 element = new RedFlagKnowledgeBarV2();
        bytes memory rejection = abi.encodeWithSignature("ReferenceOnlyElement(bytes32)", bytes32("A-12-v2"));

        vm.startPrank(governance);
        vm.expectRevert(rejection);
        ElementRegistry(d.elementReg).registerElement("A-12-v2", address(element));
        vm.expectRevert(rejection);
        ElementRegistry(d.elementReg).registerElement("A-12-v2", address(element), EnforcementAction.FLAG_ONLY);
        vm.stopPrank();
        assertEq(ElementRegistry(d.elementReg).elementOf("A-12-v2"), address(0));
    }

    function testProductionRegistryStillAcceptsOtherElements() external {
        DeployProductionCore.Deployment memory d = script.deployCore(governance, operator, false, true);
        MinimumTradeAmount element = new MinimumTradeAmount();
        vm.prank(governance);
        ElementRegistry(d.elementReg).registerElement("MIN-AMOUNT-v1", address(element));
        assertEq(ElementRegistry(d.elementReg).elementOf("MIN-AMOUNT-v1"), address(element));
    }

    function testLocalReferenceDeployerStillAllowsRedFlag() external {
        DeployStack referenceScript = new DeployStack();
        ProductionCoreDeployer.Deployment memory d = referenceScript.deployCore(governance, operator, false, true);
        RedFlagKnowledgeBarV2 element = new RedFlagKnowledgeBarV2();
        vm.prank(governance);
        ElementRegistry(d.elementReg).registerElement("A-12-v2", address(element), EnforcementAction.FLAG_ONLY);
        assertEq(ElementRegistry(d.elementReg).elementOf("A-12-v2"), address(element));
    }

    function _assertOwner(address governed) internal view {
        assertEq(Governed(governed).owner(), governance);
    }
}
