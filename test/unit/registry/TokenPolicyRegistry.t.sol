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

    /// @dev A well-formed manifest whose caller-supplied status is deliberately
    ///      ACTIVE, to prove registerManifest ignores it and lands in PROPOSED.
    function _manifest() internal view returns (ManifestCore memory m) {
        m.status = PolicyStatus.ACTIVE;
        m.issuanceRecipeId = 7;
        m.issuanceRecipeVersion = 1;
        m.declaredBy = owner;
    }

    /// @dev Drive a token to ACTIVE the legal way (register -> approve).
    function _activate(address t) internal {
        reg.registerManifest(t, _manifest());
        vm.prank(operator);
        reg.approveManifest(t);
    }

    // --- baseline reads ---------------------------------------------------

    function test_unregistered_is_UNKNOWN() public {
        assertEq(uint256(reg.statusOf(token)), uint256(PolicyStatus.UNKNOWN));
    }

    // --- register ---------------------------------------------------------

    function test_register_lands_PROPOSED_ignoring_caller_status() public {
        ManifestCore memory m = _manifest(); // m.status == ACTIVE on purpose
        vm.expectEmit(true, false, false, true);
        emit Events.ManifestRegistered(token, m.issuanceRecipeId, owner);
        reg.registerManifest(token, m);

        ManifestCore memory got = reg.manifestOf(token);
        assertEq(uint256(got.status), uint256(PolicyStatus.PROPOSED), "always PROPOSED");
        assertEq(got.issuanceRecipeId, 7);
        assertEq(got.issuanceRecipeVersion, 1);
        assertEq(got.declaredBy, owner, "declaredBy = register caller");
        assertEq(got.approvedBy, address(0), "not yet approved");
        assertEq(uint256(reg.statusOf(token)), uint256(PolicyStatus.PROPOSED));
    }

    function test_register_records_caller_as_declaredBy() public {
        ManifestCore memory m = _manifest();
        m.declaredBy = stranger; // caller-supplied value must be overwritten
        reg.registerManifest(token, m);
        assertEq(reg.manifestOf(token).declaredBy, owner);
    }

    function test_registerManifest_reverts_for_non_owner() public {
        vm.prank(stranger);
        vm.expectRevert(); // Ownable: caller is not the owner
        reg.registerManifest(token, _manifest());
    }

    // --- approve ----------------------------------------------------------

    function test_approve_PROPOSED_to_ACTIVE_records_approver() public {
        reg.registerManifest(token, _manifest());
        vm.expectEmit(true, false, false, true);
        emit Events.ManifestStatusChanged(token, PolicyStatus.ACTIVE, bytes32(0));
        vm.prank(operator);
        reg.approveManifest(token);

        assertEq(uint256(reg.statusOf(token)), uint256(PolicyStatus.ACTIVE));
        assertEq(reg.manifestOf(token).approvedBy, operator, "approvedBy = approve caller");
    }

    function test_approve_reverts_when_recipe_set_empty() public {
        ManifestCore memory m = _manifest();
        m.issuanceRecipeId = 0; // empty recipe set -> not approvable
        reg.registerManifest(token, m);
        vm.prank(operator);
        vm.expectRevert(abi.encodeWithSelector(Errors.RecipeNotRegistered.selector, uint16(0)));
        reg.approveManifest(token);
    }

    function test_approve_reverts_for_non_operator() public {
        reg.registerManifest(token, _manifest());
        vm.prank(stranger);
        vm.expectRevert(Errors.NotAuthorized.selector);
        reg.approveManifest(token);
    }

    // --- suspend / resume -------------------------------------------------

    function test_suspend_ACTIVE_to_SUSPENDED() public {
        _activate(token);
        bytes32 reason = bytes32("HALT");
        vm.expectEmit(true, false, false, true);
        emit Events.ManifestStatusChanged(token, PolicyStatus.SUSPENDED, reason);
        vm.prank(operator);
        reg.suspendManifest(token, reason);
        assertEq(uint256(reg.statusOf(token)), uint256(PolicyStatus.SUSPENDED));
    }

    function test_resume_SUSPENDED_to_ACTIVE() public {
        _activate(token);
        vm.startPrank(operator);
        reg.suspendManifest(token, bytes32("HALT"));
        vm.expectEmit(true, false, false, true);
        emit Events.ManifestStatusChanged(token, PolicyStatus.ACTIVE, bytes32(0));
        reg.resumeManifest(token);
        vm.stopPrank();
        assertEq(uint256(reg.statusOf(token)), uint256(PolicyStatus.ACTIVE));
    }

    function test_suspend_reverts_for_non_operator() public {
        _activate(token);
        vm.prank(stranger);
        vm.expectRevert(Errors.NotAuthorized.selector);
        reg.suspendManifest(token, bytes32("HALT"));
    }

    function test_resume_reverts_for_non_operator() public {
        _activate(token);
        vm.prank(operator);
        reg.suspendManifest(token, bytes32("HALT"));
        vm.prank(stranger);
        vm.expectRevert(Errors.NotAuthorized.selector);
        reg.resumeManifest(token);
    }

    // --- retire -----------------------------------------------------------

    function test_retire_from_ACTIVE() public {
        _activate(token);
        bytes32 reason = bytes32("EOL");
        vm.expectEmit(true, false, false, true);
        emit Events.ManifestStatusChanged(token, PolicyStatus.RETIRED, reason);
        vm.prank(operator);
        reg.retireManifest(token, reason);
        assertEq(uint256(reg.statusOf(token)), uint256(PolicyStatus.RETIRED));
    }

    function test_retire_from_SUSPENDED() public {
        _activate(token);
        vm.startPrank(operator);
        reg.suspendManifest(token, bytes32("HALT"));
        reg.retireManifest(token, bytes32("EOL"));
        vm.stopPrank();
        assertEq(uint256(reg.statusOf(token)), uint256(PolicyStatus.RETIRED));
    }

    function test_retire_reverts_for_non_operator() public {
        _activate(token);
        vm.prank(stranger);
        vm.expectRevert(Errors.NotAuthorized.selector);
        reg.retireManifest(token, bytes32("EOL"));
    }

    // --- re-registration --------------------------------------------------

    function test_reregister_from_RETIRED_ok() public {
        _activate(token);
        vm.prank(operator);
        reg.retireManifest(token, bytes32("EOL"));
        // Re-issue: allowed from RETIRED, lands PROPOSED again with a fresh slate.
        reg.registerManifest(token, _manifest());
        assertEq(uint256(reg.statusOf(token)), uint256(PolicyStatus.PROPOSED));
        assertEq(reg.manifestOf(token).approvedBy, address(0), "approver cleared on re-register");
    }

    function test_reregister_from_PROPOSED_reverts() public {
        reg.registerManifest(token, _manifest());
        vm.expectRevert(Errors.InvalidManifestTransition.selector);
        reg.registerManifest(token, _manifest());
    }

    function test_reregister_from_ACTIVE_reverts() public {
        _activate(token);
        vm.expectRevert(Errors.InvalidManifestTransition.selector);
        reg.registerManifest(token, _manifest());
    }

    function test_reregister_over_UNREGULATED_reverts() public {
        reg.setUnregulated(token);
        vm.expectRevert(Errors.InvalidManifestTransition.selector);
        reg.registerManifest(token, _manifest());
    }

    // --- setUnregulated ---------------------------------------------------

    function test_setUnregulated_from_UNKNOWN() public {
        vm.expectEmit(true, false, false, true);
        emit Events.ManifestStatusChanged(token, PolicyStatus.UNREGULATED, bytes32(0));
        reg.setUnregulated(token);
        assertEq(uint256(reg.statusOf(token)), uint256(PolicyStatus.UNREGULATED));
    }

    function test_setUnregulated_reverts_when_not_UNKNOWN() public {
        reg.registerManifest(token, _manifest()); // now PROPOSED
        vm.expectRevert(Errors.InvalidManifestTransition.selector);
        reg.setUnregulated(token);
    }

    function test_setUnregulated_reverts_for_non_owner() public {
        vm.prank(stranger);
        vm.expectRevert(); // Ownable: caller is not the owner
        reg.setUnregulated(token);
    }

    /// @dev setUnregulated is onlyOwner, NOT onlyOperator: a mere operator (not
    ///      the owner) must be rejected, proving the classification/lifecycle
    ///      gate distinction.
    function test_setUnregulated_reverts_for_operator() public {
        vm.prank(operator);
        vm.expectRevert(); // Ownable: operator is not the owner
        reg.setUnregulated(token);
    }

    // --- clearUnregulated -------------------------------------------------

    function test_clearUnregulated_from_UNREGULATED() public {
        reg.setUnregulated(token); // UNKNOWN -> UNREGULATED
        vm.expectEmit(true, false, false, true);
        emit Events.ManifestStatusChanged(token, PolicyStatus.UNKNOWN, bytes32(0));
        reg.clearUnregulated(token);
        assertEq(uint256(reg.statusOf(token)), uint256(PolicyStatus.UNKNOWN));
    }

    /// @dev After clearing, the token is a clean slate again and can be declared
    ///      as a regulated manifest (lands PROPOSED).
    function test_clearUnregulated_then_register_ok() public {
        reg.setUnregulated(token);
        reg.clearUnregulated(token);
        reg.registerManifest(token, _manifest());
        assertEq(uint256(reg.statusOf(token)), uint256(PolicyStatus.PROPOSED));
    }

    function test_clearUnregulated_reverts_when_UNKNOWN() public {
        // never tagged → still UNKNOWN → illegal.
        vm.expectRevert(Errors.InvalidManifestTransition.selector);
        reg.clearUnregulated(token);
    }

    function test_clearUnregulated_reverts_when_PROPOSED() public {
        reg.registerManifest(token, _manifest()); // PROPOSED
        vm.expectRevert(Errors.InvalidManifestTransition.selector);
        reg.clearUnregulated(token);
    }

    function test_clearUnregulated_reverts_when_ACTIVE() public {
        _activate(token);
        vm.expectRevert(Errors.InvalidManifestTransition.selector);
        reg.clearUnregulated(token);
    }

    function test_clearUnregulated_reverts_for_non_owner() public {
        reg.setUnregulated(token);
        vm.prank(stranger);
        vm.expectRevert(); // Ownable: caller is not the owner
        reg.clearUnregulated(token);
    }

    /// @dev clearUnregulated is onlyOwner, NOT onlyOperator: an operator (not the
    ///      owner) must be rejected, symmetric with setUnregulated.
    function test_clearUnregulated_reverts_for_operator() public {
        reg.setUnregulated(token);
        vm.prank(operator);
        vm.expectRevert(); // Ownable: operator is not the owner
        reg.clearUnregulated(token);
    }

    // --- illegal-transition table -----------------------------------------

    /// @dev Move `token` into `from`, then assert the named mutator reverts
    ///      InvalidManifestTransition. Encodes every illegal (state, action)
    ///      pair for approve/suspend/resume/retire across all six states.
    function _seed(PolicyStatus from) internal {
        if (from == PolicyStatus.UNKNOWN) {
            return;
        } else if (from == PolicyStatus.UNREGULATED) {
            reg.setUnregulated(token);
        } else if (from == PolicyStatus.PROPOSED) {
            reg.registerManifest(token, _manifest());
        } else if (from == PolicyStatus.ACTIVE) {
            _activate(token);
        } else if (from == PolicyStatus.SUSPENDED) {
            _activate(token);
            vm.prank(operator);
            reg.suspendManifest(token, bytes32("HALT"));
        } else if (from == PolicyStatus.RETIRED) {
            _activate(token);
            vm.prank(operator);
            reg.retireManifest(token, bytes32("EOL"));
        }
    }

    function test_illegalTransitions_allRevert() public {
        // approve is legal ONLY from PROPOSED.
        PolicyStatus[5] memory approveFrom = [
            PolicyStatus.UNKNOWN,
            PolicyStatus.UNREGULATED,
            PolicyStatus.ACTIVE,
            PolicyStatus.SUSPENDED,
            PolicyStatus.RETIRED
        ];
        for (uint256 i = 0; i < approveFrom.length; i++) {
            _seed(approveFrom[i]);
            vm.prank(operator);
            vm.expectRevert(Errors.InvalidManifestTransition.selector);
            reg.approveManifest(token);
            _reset();
        }

        // suspend is legal ONLY from ACTIVE.
        PolicyStatus[5] memory suspendFrom = [
            PolicyStatus.UNKNOWN,
            PolicyStatus.UNREGULATED,
            PolicyStatus.PROPOSED,
            PolicyStatus.SUSPENDED,
            PolicyStatus.RETIRED
        ];
        for (uint256 i = 0; i < suspendFrom.length; i++) {
            _seed(suspendFrom[i]);
            vm.prank(operator);
            vm.expectRevert(Errors.InvalidManifestTransition.selector);
            reg.suspendManifest(token, bytes32("HALT"));
            _reset();
        }

        // resume is legal ONLY from SUSPENDED.
        PolicyStatus[5] memory resumeFrom = [
            PolicyStatus.UNKNOWN,
            PolicyStatus.UNREGULATED,
            PolicyStatus.PROPOSED,
            PolicyStatus.ACTIVE,
            PolicyStatus.RETIRED
        ];
        for (uint256 i = 0; i < resumeFrom.length; i++) {
            _seed(resumeFrom[i]);
            vm.prank(operator);
            vm.expectRevert(Errors.InvalidManifestTransition.selector);
            reg.resumeManifest(token);
            _reset();
        }

        // retire is legal ONLY from ACTIVE or SUSPENDED.
        PolicyStatus[4] memory retireFrom =
            [PolicyStatus.UNKNOWN, PolicyStatus.UNREGULATED, PolicyStatus.PROPOSED, PolicyStatus.RETIRED];
        for (uint256 i = 0; i < retireFrom.length; i++) {
            _seed(retireFrom[i]);
            vm.prank(operator);
            vm.expectRevert(Errors.InvalidManifestTransition.selector);
            reg.retireManifest(token, bytes32("EOL"));
            _reset();
        }
    }

    /// @dev Fresh registry between table iterations so `token` is UNKNOWN again.
    function _reset() internal {
        reg = new TokenPolicyRegistry();
        reg.setOperator(operator, true);
    }

    // --- setFact (unchanged strengthen-only behavior) ---------------------

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
