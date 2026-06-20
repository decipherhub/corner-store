// SPDX-License-Identifier: GPL-3.0
pragma solidity 0.8.17;

import {Test} from "forge-std/Test.sol";
import {TokenPolicyRegistry} from "../../../src/registry/TokenPolicyRegistry.sol";
import {ManifestCore, PolicyStatus} from "../../../src/types/ComplianceTypes.sol";
import {Errors} from "../../../src/libraries/Errors.sol";
import {Events} from "../../../src/libraries/Events.sol";

contract TokenPolicyRegistryTest is Test {
    TokenPolicyRegistry internal reg;

    address internal owner = address(this);
    address internal operator = address(0xBEEF);
    address internal stranger = address(0xDEAD);
    address internal token = address(0x7000);

    function setUp() public {
        reg = new TokenPolicyRegistry();
        reg.setOperator(operator, true);
    }

    function _manifest() internal view returns (ManifestCore memory m) {
        m.status = PolicyStatus.ACTIVE;
        m.issuanceRecipeId = 7;
        m.issuanceRecipeVersion = 1;
        m.declaredBy = owner;
    }

    function test_unregistered_is_UNKNOWN() public {
        assertEq(uint256(reg.statusOf(token)), uint256(PolicyStatus.UNKNOWN));
    }

    function test_register_and_read() public {
        ManifestCore memory m = _manifest();
        vm.expectEmit(true, false, false, true);
        emit Events.ManifestRegistered(token, m.issuanceRecipeId, m.declaredBy);
        reg.registerManifest(token, m);

        ManifestCore memory got = reg.manifestOf(token);
        assertEq(got.issuanceRecipeId, 7);
        assertEq(got.issuanceRecipeVersion, 1);
        assertEq(uint256(got.status), uint256(PolicyStatus.ACTIVE));
        assertEq(reg.manifestOf(token).declaredBy, owner);
        assertEq(uint256(reg.statusOf(token)), uint256(PolicyStatus.ACTIVE));
    }

    function test_registerManifest_reverts_for_non_owner() public {
        ManifestCore memory m = _manifest();
        vm.prank(stranger);
        vm.expectRevert();
        reg.registerManifest(token, m);
    }

    function test_setStatus_suspend_gated() public {
        reg.registerManifest(token, _manifest());
        bytes32 reason = bytes32("HALT");
        vm.expectEmit(true, false, false, true);
        emit Events.ManifestStatusChanged(token, PolicyStatus.SUSPENDED, reason);
        vm.prank(operator);
        reg.setStatus(token, PolicyStatus.SUSPENDED, reason);
        assertEq(uint256(reg.statusOf(token)), uint256(PolicyStatus.SUSPENDED));
    }

    function test_setStatus_reverts_for_non_operator() public {
        reg.registerManifest(token, _manifest());
        vm.prank(stranger);
        vm.expectRevert(Errors.NotAuthorized.selector);
        reg.setStatus(token, PolicyStatus.SUSPENDED, bytes32("HALT"));
    }

    function test_setFact_strengthen_ok() public {
        reg.registerManifest(token, _manifest());
        vm.startPrank(operator);
        reg.setFact(token, 0x0F); // 0000_1111
        reg.setFact(token, 0x1F); // superset: 0001_1111
        vm.stopPrank();
        assertEq(reg.manifestOf(token).factsPacked, 0x1F);
    }

    function test_setFact_loosen_reverts() public {
        reg.registerManifest(token, _manifest());
        vm.startPrank(operator);
        reg.setFact(token, 0x0F);
        vm.expectRevert(Errors.LooseningForbidden.selector);
        reg.setFact(token, 0x07); // drops a bit -> not a superset
        vm.stopPrank();
    }

    function test_setFact_reverts_for_non_operator() public {
        reg.registerManifest(token, _manifest());
        vm.prank(stranger);
        vm.expectRevert(Errors.NotAuthorized.selector);
        reg.setFact(token, 0x0F);
    }
}
