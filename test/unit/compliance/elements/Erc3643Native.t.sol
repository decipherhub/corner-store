// SPDX-License-Identifier: GPL-3.0
pragma solidity 0.8.17;

import {Test} from "forge-std/Test.sol";
import {Erc3643Native} from "../../../../src/compliance/elements/Erc3643Native.sol";
import {
    ElementMetadata,
    ElementCategory,
    TemporalNature,
    Decidability,
    ObligationTiming,
    Statefulness
} from "../../../../src/types/ComplianceTypes.sol";
import {Errors} from "../../../../src/libraries/Errors.sol";
import {ReasonCodes} from "../../../../src/libraries/ReasonCodes.sol";

/// @dev Minimal mock exposing the six ERC-3643 probe functions B-02 calls, plus a
///      wired IR / MC pair. A hand-rolled mock (not the heavyweight vendored
///      TREXSuite fixture, which test/integration uses) keeps this a true unit
///      file — B-02's gate logic only depends on the return values of the six
///      views, so exercising every code/boundary is cleaner with a controllable
///      mock than with a fully-wired T-REX deployment. (Reported per task note.)
contract MockIdentityRegistry {
    mapping(address => bool) public verified;

    function setVerified(address who, bool v) external {
        verified[who] = v;
    }

    function isVerified(address userAddress) external view returns (bool) {
        return verified[userAddress];
    }
}

contract MockCompliance {
    bool public allow = true;

    function setAllow(bool a) external {
        allow = a;
    }

    function canTransfer(address, address, uint256) external view returns (bool) {
        return allow;
    }
}

contract MockToken {
    address public identityRegistry;
    address public compliance;
    bool public paused;
    mapping(address => bool) public isFrozen;
    mapping(address => uint256) public balanceOf;
    mapping(address => uint256) public getFrozenTokens;

    constructor(address ir, address mc) {
        identityRegistry = ir;
        compliance = mc;
    }

    function setPaused(bool p) external {
        paused = p;
    }

    function setFrozen(address who, bool f) external {
        isFrozen[who] = f;
    }

    function setBalance(address who, uint256 bal) external {
        balanceOf[who] = bal;
    }

    function setFrozenTokens(address who, uint256 amt) external {
        getFrozenTokens[who] = amt;
    }

    function setIdentityRegistry(address ir) external {
        identityRegistry = ir;
    }

    function setCompliance(address mc) external {
        compliance = mc;
    }
}

/// @dev A token-shaped contract whose probes revert — exercises the fail-closed
///      (=> code 1) try/catch path with a deployed (code.length > 0) target.
contract RevertingToken {
    function identityRegistry() external pure returns (address) {
        revert("nope");
    }

    function compliance() external pure returns (address) {
        revert("nope");
    }

    function paused() external pure returns (bool) {
        revert("nope");
    }
}

contract Erc3643NativeTest is Test {
    Erc3643Native internal element;

    address internal owner = address(this);
    address internal operator = address(0xBEEF);
    address internal stranger = address(0xDEAD);
    address internal asset = address(0x7000);
    address internal user = address(0xA11CE); // buyer
    address internal counterparty = address(0xB0B); // seller

    event Erc3643NativeSet(address indexed asset, bool native_);
    event WiringRegistered(address indexed asset, address identityRegistry, address compliance, bytes32 implCodehash);
    event WiringCleared(address indexed asset);

    function setUp() public {
        element = new Erc3643Native();
        element.setOperator(operator, true);
    }

    function _code(uint32 n) internal pure returns (bytes32) {
        return ReasonCodes.encode(0, bytes32("B-02-v1"), n);
    }

    // ------------------------------------------------------------------
    // Legacy / declaration-only regime (existing behavior — must stay green)
    // ------------------------------------------------------------------

    function test_metadata_fields() public {
        ElementMetadata memory m = element.elementMetadata();
        assertEq(m.elementId, bytes32("B-02-v1"));
        assertEq(uint256(m.category), uint256(ElementCategory.ASSET_ATTRIBUTE));
        assertEq(uint256(m.decidability), uint256(Decidability.DETERMINISTIC));
        assertEq(uint256(m.statefulness), uint256(Statefulness.STATELESS));
    }

    function test_setErc3643Native_reverts_for_non_operator() public {
        vm.prank(stranger);
        vm.expectRevert(Errors.NotAuthorized.selector);
        element.setErc3643Native(asset, true);
    }

    function test_setErc3643Native_updates_state_and_emits_event() public {
        vm.expectEmit(true, false, false, true);
        emit Erc3643NativeSet(asset, true);
        vm.prank(operator);
        element.setErc3643Native(asset, true);
        assertTrue(element.erc3643Native(asset));
    }

    function test_owner_may_also_set_via_onlyOperator_gate() public {
        // owner passes the onlyOperator gate even without being added as operator.
        element.setErc3643Native(asset, true);
        assertTrue(element.erc3643Native(asset));
    }

    function test_check_fails_when_unattested_default_state() public {
        (bool passed, bytes32 reasonCode) = element.check(user, counterparty, asset, 100, "");
        assertFalse(passed);
        assertEq(reasonCode, _code(1));
    }

    function test_check_passes_after_attestation() public {
        vm.prank(operator);
        element.setErc3643Native(asset, true);

        (bool passed, bytes32 reasonCode) = element.check(user, counterparty, asset, 100, "");
        assertTrue(passed);
        assertEq(reasonCode, bytes32(0));
    }

    function test_check_fails_after_attestation_revoked() public {
        vm.prank(operator);
        element.setErc3643Native(asset, true);
        (bool passed,) = element.check(user, counterparty, asset, 100, "");
        assertTrue(passed);

        vm.prank(operator);
        element.setErc3643Native(asset, false);
        (bool passedAfterRevoke, bytes32 reasonCode) = element.check(user, counterparty, asset, 100, "");
        assertFalse(passedAfterRevoke);
        assertEq(reasonCode, _code(1));
    }

    function test_check_ignores_user_and_counterparty_declaration_only() public {
        vm.prank(operator);
        element.setErc3643Native(asset, true);

        (bool passedA,) = element.check(user, counterparty, asset, 1, "");
        (bool passedB,) = element.check(address(0x1234), address(0x5678), asset, 999_999, "");
        assertTrue(passedA);
        assertTrue(passedB);

        // A different, unattested asset still fails regardless of user/counterparty.
        address otherAsset = address(0x9999);
        (bool passedC,) = element.check(address(0x1234), address(0x5678), otherAsset, 1, "");
        assertFalse(passedC);
    }

    // ------------------------------------------------------------------
    // Live-wiring regime (gates ②–⑤)
    // ------------------------------------------------------------------

    MockIdentityRegistry internal ir;
    MockCompliance internal mc;
    MockToken internal token;

    /// @dev Attest + register wiring for a fully-live, transfer-ready mock token.
    ///      Seller has 1000 balance, 0 frozen; buyer verified; compliance allows.
    function _standUpLiveToken() internal returns (address tokenAddr) {
        ir = new MockIdentityRegistry();
        mc = new MockCompliance();
        token = new MockToken(address(ir), address(mc));
        tokenAddr = address(token);

        ir.setVerified(user, true); // buyer verified
        token.setBalance(counterparty, 1000); // seller balance

        vm.startPrank(operator);
        element.setErc3643Native(tokenAddr, true);
        element.registerWiring(tokenAddr, address(ir), address(mc), tokenAddr.codehash);
        vm.stopPrank();
    }

    function test_registerWiring_reverts_for_non_operator() public {
        vm.prank(stranger);
        vm.expectRevert(Errors.NotAuthorized.selector);
        element.registerWiring(asset, address(1), address(2), bytes32("x"));
    }

    function test_registerWiring_emits_and_stores() public {
        vm.expectEmit(true, false, false, true);
        emit WiringRegistered(asset, address(1), address(2), bytes32("x"));
        vm.prank(operator);
        element.registerWiring(asset, address(1), address(2), bytes32("x"));

        (bool registered, address regIr, address regMc, bytes32 hash) = element.wiringOf(asset);
        assertTrue(registered);
        assertEq(regIr, address(1));
        assertEq(regMc, address(2));
        assertEq(hash, bytes32("x"));
    }

    function test_live_happy_path_passes() public {
        address tokenAddr = _standUpLiveToken();
        (bool passed, bytes32 reasonCode) = element.check(user, counterparty, tokenAddr, 500, "");
        assertTrue(passed);
        assertEq(reasonCode, bytes32(0));
    }

    function test_live_drift_identityRegistry_code2() public {
        address tokenAddr = _standUpLiveToken();
        token.setIdentityRegistry(address(0xBAD)); // token now reports a different IR
        (bool passed, bytes32 reasonCode) = element.check(user, counterparty, tokenAddr, 500, "");
        assertFalse(passed);
        assertEq(reasonCode, _code(2));
    }

    function test_live_drift_compliance_code2() public {
        address tokenAddr = _standUpLiveToken();
        token.setCompliance(address(0xBAD));
        (bool passed, bytes32 reasonCode) = element.check(user, counterparty, tokenAddr, 500, "");
        assertFalse(passed);
        assertEq(reasonCode, _code(2));
    }

    function test_live_drift_codehash_code2() public {
        address tokenAddr = _standUpLiveToken();
        // Re-register with a wrong expected codehash => implementation drift.
        vm.prank(operator);
        element.registerWiring(tokenAddr, address(ir), address(mc), bytes32("wrong-codehash"));
        (bool passed, bytes32 reasonCode) = element.check(user, counterparty, tokenAddr, 500, "");
        assertFalse(passed);
        assertEq(reasonCode, _code(2));
    }

    function test_live_paused_code3() public {
        address tokenAddr = _standUpLiveToken();
        token.setPaused(true);
        (bool passed, bytes32 reasonCode) = element.check(user, counterparty, tokenAddr, 500, "");
        assertFalse(passed);
        assertEq(reasonCode, _code(3));
    }

    function test_live_frozen_seller_code4() public {
        address tokenAddr = _standUpLiveToken();
        token.setFrozen(counterparty, true);
        (bool passed, bytes32 reasonCode) = element.check(user, counterparty, tokenAddr, 500, "");
        assertFalse(passed);
        assertEq(reasonCode, _code(4));
    }

    function test_live_frozen_buyer_code4() public {
        address tokenAddr = _standUpLiveToken();
        token.setFrozen(user, true);
        (bool passed, bytes32 reasonCode) = element.check(user, counterparty, tokenAddr, 500, "");
        assertFalse(passed);
        assertEq(reasonCode, _code(4));
    }

    function test_live_free_balance_exactly_equal_passes() public {
        address tokenAddr = _standUpLiveToken();
        token.setBalance(counterparty, 1000);
        token.setFrozenTokens(counterparty, 500); // free = 500
        (bool passed, bytes32 reasonCode) = element.check(user, counterparty, tokenAddr, 500, "");
        assertTrue(passed); // INCLUSIVE >= : exactly-equal free balance passes
        assertEq(reasonCode, bytes32(0));
    }

    function test_live_free_balance_one_short_code5() public {
        address tokenAddr = _standUpLiveToken();
        token.setBalance(counterparty, 1000);
        token.setFrozenTokens(counterparty, 501); // free = 499, need 500
        (bool passed, bytes32 reasonCode) = element.check(user, counterparty, tokenAddr, 500, "");
        assertFalse(passed);
        assertEq(reasonCode, _code(5));
    }

    function test_live_amount_zero_skips_balance_leg() public {
        address tokenAddr = _standUpLiveToken();
        // Seller has zero free balance, but amount 0 has nothing to clear => passes.
        token.setBalance(counterparty, 0);
        token.setFrozenTokens(counterparty, 0);
        (bool passed, bytes32 reasonCode) = element.check(user, counterparty, tokenAddr, 0, "");
        assertTrue(passed);
        assertEq(reasonCode, bytes32(0));
    }

    function test_live_unverified_buyer_code6() public {
        address tokenAddr = _standUpLiveToken();
        ir.setVerified(user, false);
        (bool passed, bytes32 reasonCode) = element.check(user, counterparty, tokenAddr, 500, "");
        assertFalse(passed);
        assertEq(reasonCode, _code(6));
    }

    function test_live_canTransfer_false_code6() public {
        address tokenAddr = _standUpLiveToken();
        mc.setAllow(false); // compliance module rejects
        (bool passed, bytes32 reasonCode) = element.check(user, counterparty, tokenAddr, 500, "");
        assertFalse(passed);
        assertEq(reasonCode, _code(6));
    }

    function test_live_eoa_target_code1() public {
        // Attest + register wiring for an EOA (no code) asset => standard mismatch.
        address eoa = address(0xE0A);
        vm.startPrank(operator);
        element.setErc3643Native(eoa, true);
        element.registerWiring(eoa, address(1), address(2), bytes32(0));
        vm.stopPrank();
        (bool passed, bytes32 reasonCode) = element.check(user, counterparty, eoa, 500, "");
        assertFalse(passed);
        assertEq(reasonCode, _code(1));
    }

    function test_live_reverting_target_code1() public {
        RevertingToken rt = new RevertingToken();
        address tokenAddr = address(rt);
        vm.startPrank(operator);
        element.setErc3643Native(tokenAddr, true);
        element.registerWiring(tokenAddr, address(1), address(2), tokenAddr.codehash);
        vm.stopPrank();
        (bool passed, bytes32 reasonCode) = element.check(user, counterparty, tokenAddr, 500, "");
        assertFalse(passed); // first probe (identityRegistry()) reverts => fail-closed
        assertEq(reasonCode, _code(1));
    }

    function test_clearWiring_returns_to_declaration_only() public {
        address tokenAddr = _standUpLiveToken();
        // Break a live gate (pause) so live-regime check would fail with code 3...
        token.setPaused(true);
        (bool pausedFail, bytes32 rc3) = element.check(user, counterparty, tokenAddr, 500, "");
        assertFalse(pausedFail);
        assertEq(rc3, _code(3));

        // ...then clear the wiring: back to declaration-only, attested => PASS.
        vm.expectEmit(true, false, false, false);
        emit WiringCleared(tokenAddr);
        vm.prank(operator);
        element.clearWiring(tokenAddr);

        (bool passed, bytes32 reasonCode) = element.check(user, counterparty, tokenAddr, 500, "");
        assertTrue(passed);
        assertEq(reasonCode, bytes32(0));

        (bool registered,,,) = element.wiringOf(tokenAddr);
        assertFalse(registered);
    }

    function test_clearWiring_reverts_for_non_operator() public {
        vm.prank(stranger);
        vm.expectRevert(Errors.NotAuthorized.selector);
        element.clearWiring(asset);
    }

    function test_live_unattested_still_fails_code1_even_with_wiring() public {
        // Wiring registered but declaration NOT attested => declaration check (①)
        // fires first => code 1.
        address tokenAddr = _standUpLiveToken();
        vm.prank(operator);
        element.setErc3643Native(tokenAddr, false);
        (bool passed, bytes32 reasonCode) = element.check(user, counterparty, tokenAddr, 500, "");
        assertFalse(passed);
        assertEq(reasonCode, _code(1));
    }
}
