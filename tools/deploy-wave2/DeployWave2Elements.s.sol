// SPDX-License-Identifier: GPL-3.0
pragma solidity 0.8.17;

import {Script} from "forge-std/Script.sol";
import {ElementRegistry} from "../src/registry/ElementRegistry.sol";
import {ComplianceEngine} from "../src/compliance/ComplianceEngine.sol";
import {EntityEligibility} from "../src/compliance/elements/EntityEligibility.sol";
import {EquityOwnerLookThrough} from "../src/compliance/elements/EquityOwnerLookThrough.sol";
import {ClaimFreshness} from "../src/compliance/elements/ClaimFreshness.sol";
import {TransferRestrictionMetadata} from "../src/compliance/elements/TransferRestrictionMetadata.sol";
import {EngineSelection} from "../src/compliance/elements/EngineSelection.sol";
import {HolderCount, IIdentityView, IAiView} from "../src/compliance/elements/HolderCount.sol";

/// @title DeployWave2Elements
/// @notice Opt-in deployment for the illustrative wave-2 element library.
/// @dev Kept separate from DeployStack so the default BUIDL-like/Reg D demo does
/// not force the larger compliance graph through one compiler invocation. The
/// elements are not added to an active recipe by this script.
contract DeployWave2Elements is Script {
    function run() external {
        address registryAddress = vm.envAddress("ELEMENT_REGISTRY");
        address engineAddress = vm.envAddress("COMPLIANCE_ENGINE");
        address identityAddress = vm.envAddress("IDENTITY_ELEMENT");
        address accreditedAddress = vm.envAddress("ACCREDITED_ELEMENT");
        uint256 deployerPk = vm.envUint("DEPLOYER_PRIVATE_KEY");

        vm.startBroadcast(deployerPk);
        ElementRegistry registry = ElementRegistry(registryAddress);
        EquityOwnerLookThrough lookThrough = new EquityOwnerLookThrough();
        registry.registerElement(bytes32("A-09-v1"), address(lookThrough));
        registry.registerElement(bytes32("A-08-v1"), address(new EntityEligibility(lookThrough)));
        registry.registerElement(bytes32("A-11-v1"), address(new ClaimFreshness()));
        registry.registerElement(bytes32("B-03-v1"), address(new TransferRestrictionMetadata()));
        registry.registerElement(bytes32("B-04-v1"), address(new EngineSelection()));

        HolderCount holderCount =
            new HolderCount(HolderCount.CapMode.TWELVE_G, IIdentityView(identityAddress), IAiView(accreditedAddress));
        holderCount.setEngine(engineAddress);
        registry.registerElement(bytes32("D-01-v1"), address(holderCount));
        vm.stopBroadcast();
    }
}
