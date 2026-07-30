// SPDX-License-Identifier: GPL-3.0
pragma solidity 0.8.17;

import {Test} from "forge-std/Test.sol";
import {DeployProductionCore} from "../../../script/DeployProductionCore.s.sol";
import {Governed} from "../../../src/auth/Governed.sol";
import {ComplianceEngine} from "../../../src/compliance/ComplianceEngine.sol";
import {ExecutionRouter} from "../../../src/execution/ExecutionRouter.sol";
import {UniswapV3Adapter} from "../../../src/execution/adapters/amm/UniswapV3Adapter.sol";
import {RFQAdapter} from "../../../src/execution/adapters/rfq/RFQAdapter.sol";
import {TokenPolicyRegistry} from "../../../src/registry/TokenPolicyRegistry.sol";
import {OperatorRegistry} from "../../../src/registry/OperatorRegistry.sol";
import {MakerAuthorizer} from "../../../src/registry/MakerAuthorizer.sol";
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
        vm.expectRevert(DeployProductionCore.InvalidGovernance.selector);
        script.deployCore(address(0), operator, false, true);

        vm.expectRevert(DeployProductionCore.InvalidOperator.selector);
        script.deployCore(governance, address(0), false, true);

        vm.expectRevert(DeployProductionCore.NoVenueEnabled.selector);
        script.deployCore(governance, operator, false, false);
    }

    function _assertOwner(address governed) internal view {
        assertEq(Governed(governed).owner(), governance);
    }
}
