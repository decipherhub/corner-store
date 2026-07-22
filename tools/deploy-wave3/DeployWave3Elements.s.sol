// SPDX-License-Identifier: GPL-3.0
pragma solidity 0.8.17;

import {Script} from "forge-std/Script.sol";
import {ElementRegistry} from "../../src/registry/ElementRegistry.sol";
import {Affiliate} from "../../src/compliance/elements/Affiliate.sol";
import {RedFlagKnowledgeBar} from "../../src/compliance/elements/RedFlagKnowledgeBar.sol";
import {BadActorDisqualification} from "../../src/compliance/elements/BadActorDisqualification.sol";
import {OperatorSelfDealing} from "../../src/compliance/elements/OperatorSelfDealing.sol";
import {FraudSurveillance} from "../../src/compliance/elements/FraudSurveillance.sol";
import {RegMIssuerBuying} from "../../src/compliance/elements/RegMIssuerBuying.sol";

/// @title DeployWave3Elements
/// @notice Opt-in deployment for the illustrative wave-3 compliance element library.
/// @dev Kept separate from DeployStack (mirrors tools/deploy-wave2) so the default
/// BUIDL-like/Reg D demo does not force the larger compliance graph through one
/// compiler invocation. Like wave-2, this script sits outside default Foundry
/// script discovery and does NOT add the elements to an active recipe, so the
/// default demo's deployment scope and compile graph are unchanged.
///
/// F-03 FraudSurveillance is STATEFUL (BaseStatefulElement): it needs setEngine()
/// wiring after deployment so the ComplianceEngine commit hook can drive its
/// post-trade onTransfer aggregation, exactly like wave-2 D-01 HolderCount.
///
/// F-01 OperatorSelfDealing ships fail-closed: `registryAvailable` defaults to
/// false, so every trade fails closed (code 2) until an operator loads the
/// restricted-party roster and calls setRegistryAvailable(true). This is
/// intentional; the script does NOT auto-enable it. Operator action is required
/// before F-01 passes anything.
contract DeployWave3Elements is Script {
    function run() external {
        address registryAddress = vm.envAddress("ELEMENT_REGISTRY");
        address engineAddress = vm.envAddress("COMPLIANCE_ENGINE");
        uint256 deployerPk = vm.envUint("DEPLOYER_PRIVATE_KEY");

        vm.startBroadcast(deployerPk);
        ElementRegistry registry = ElementRegistry(registryAddress);

        registry.registerElement(bytes32("A-06-v1"), address(new Affiliate()));
        registry.registerElement(bytes32("A-12-v1"), address(new RedFlagKnowledgeBar()));
        registry.registerElement(bytes32("E-03-v1"), address(new BadActorDisqualification()));
        registry.registerElement(bytes32("F-01-v1"), address(new OperatorSelfDealing()));
        registry.registerElement(bytes32("F-04-v1"), address(new RegMIssuerBuying()));

        // F-03 is stateful: wire the engine before registration (HolderCount pattern).
        FraudSurveillance fraudSurveillance = new FraudSurveillance();
        fraudSurveillance.setEngine(engineAddress);
        registry.registerElement(bytes32("F-03-v1"), address(fraudSurveillance));
        vm.stopBroadcast();
    }
}
