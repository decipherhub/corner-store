// SPDX-License-Identifier: GPL-3.0
pragma solidity 0.8.17;

import {Test} from "forge-std/Test.sol";
import {OperatorSelfDealing} from "../../../../src/compliance/elements/OperatorSelfDealing.sol";
import {Errors} from "../../../../src/libraries/Errors.sol";
import {
    ElementMetadata,
    ElementCategory,
    TemporalNature,
    Decidability,
    ObligationTiming,
    Statefulness,
    ComplianceContext,
    FlowType,
    VenueType
} from "../../../../src/types/ComplianceTypes.sol";

/// @dev F-01 Operator self-dealing restriction tests. Covers metadata, setter
///      auth + events, the doc §7 test cases 1-5, every failure code (1/2/3), and
///      the fail-closed default (doc §5.5/§8.3). The gate is a symmetric negative
///      screen: a restricted party on either side blocks unless a narrow exception
///      (primary distribution / involuntary transfer) applies.
contract OperatorSelfDealingTest is Test {
    // Re-declared for vm.expectEmit; Solidity 0.8.17 cannot `emit` a non-library
    // contract's event by qualified name. The OperatorRole enum param canonicalizes
    // to uint8 in the event signature.
    event RestrictedPartySet(address indexed account, uint8 role);
    event RegistryAvailabilitySet(bool available);
    event PrimaryDistributorSet(address indexed distributor, bool allowed);
    event InvoluntaryAgentSet(address indexed agent, bool authorized);

    address internal buyer = address(0xB0B); // ctx.buyer  == check `user` (to)
    address internal seller = address(0x5E11E7); // ctx.seller == check `counterparty` (from)
    address internal asset = address(0xA55E7);
    address internal operator = address(0x0733);
    address internal stranger = address(0xBAD);

    address internal operatorEntity = address(0xDEC1); // Decipher legal entity
    address internal affiliateDesk = address(0xDE54); // Rule 405 common-control desk
    address internal employee = address(0xE119); // associated person (§3(a)(18))
    address internal issuer = address(0x1550E1); // primary-distribution source
    address internal recoveryAgent = address(0x5A5E); // forcedTransfer/recovery authority

    OperatorSelfDealing internal f01;

    function setUp() public {
        f01 = new OperatorSelfDealing();
        // Mark the roster loaded; the fail-closed default (registry unavailable) is
        // exercised on a fresh instance in test_failClosed_defaultRegistryUnavailable.
        f01.setRegistryAvailable(true);
    }

    // --- helpers ---------------------------------------------------------

    function _code(uint32 n) internal pure returns (bytes32) {
        return keccak256(abi.encode(uint16(0), bytes32("F-01-v1"), uint32(n)));
    }

    /// @dev abi.encode a well-formed ComplianceContext. `flow`/`initiator` drive the
    ///      exception logic; buyer/seller mirror the check() params.
    function _ctx(FlowType flow, address initiator) internal view returns (bytes memory) {
        ComplianceContext memory c;
        c.initiator = initiator;
        c.buyer = buyer;
        c.seller = seller;
        c.tokenIn = asset;
        c.tokenOut = asset;
        c.venueType = VenueType.RFQ;
        c.venue = address(0xF0E);
        c.flowType = flow;
        return abi.encode(c);
    }

    /// @dev Secondary trade with a no-op initiator — the default trade shape.
    function _secondaryCtx() internal view returns (bytes memory) {
        return _ctx(FlowType.SECONDARY_TRADE, address(0xF0F));
    }

    // --- metadata --------------------------------------------------------

    function test_metadata_fields() public {
        ElementMetadata memory m = f01.elementMetadata();
        assertEq(m.elementId, bytes32("F-01-v1"));
        assertEq(uint256(m.category), uint256(ElementCategory.CONDUCT_MONITORING));
        assertEq(uint256(m.temporal), uint256(TemporalNature.REALTIME));
        assertEq(uint256(m.decidability), uint256(Decidability.DETERMINISTIC));
        assertEq(uint256(m.timing), uint256(ObligationTiming.AT_TRADE_GATE));
        assertEq(uint256(m.statefulness), uint256(Statefulness.STATELESS));
    }

    function test_defaults_onFreshInstance() public {
        OperatorSelfDealing fresh = new OperatorSelfDealing();
        assertFalse(fresh.registryAvailable());
        assertEq(uint256(fresh.roleOf(operatorEntity)), uint256(OperatorSelfDealing.OperatorRole.NONE));
    }

    // --- setter auth -----------------------------------------------------

    function test_setRestrictedParty_revertsForStranger() public {
        vm.prank(stranger);
        vm.expectRevert(Errors.NotAuthorized.selector);
        f01.setRestrictedParty(operatorEntity, OperatorSelfDealing.OperatorRole.OPERATOR_ENTITY);
    }

    function test_setRegistryAvailable_revertsForStranger() public {
        vm.prank(stranger);
        vm.expectRevert(Errors.NotAuthorized.selector);
        f01.setRegistryAvailable(true);
    }

    function test_setPrimaryDistributor_revertsForStranger() public {
        vm.prank(stranger);
        vm.expectRevert(Errors.NotAuthorized.selector);
        f01.setPrimaryDistributor(issuer, true);
    }

    function test_setInvoluntaryAgent_revertsForStranger() public {
        vm.prank(stranger);
        vm.expectRevert(Errors.NotAuthorized.selector);
        f01.setInvoluntaryAgent(recoveryAgent, true);
    }

    function test_ownerCanSetRestrictedParty() public {
        // Deployer is the owner (Ownable) => onlyOperator passes for the owner too.
        f01.setRestrictedParty(operatorEntity, OperatorSelfDealing.OperatorRole.OPERATOR_ENTITY);
        assertEq(uint256(f01.roleOf(operatorEntity)), uint256(OperatorSelfDealing.OperatorRole.OPERATOR_ENTITY));
    }

    function test_operatorCanSetRestrictedParty() public {
        f01.setOperator(operator, true);
        vm.prank(operator);
        f01.setRestrictedParty(affiliateDesk, OperatorSelfDealing.OperatorRole.OPERATOR_AFFILIATE);
        assertEq(uint256(f01.roleOf(affiliateDesk)), uint256(OperatorSelfDealing.OperatorRole.OPERATOR_AFFILIATE));
    }

    // --- setter events ---------------------------------------------------

    function test_setRestrictedParty_emits() public {
        vm.expectEmit(true, false, false, true);
        emit RestrictedPartySet(employee, uint8(OperatorSelfDealing.OperatorRole.OPERATOR_ASSOCIATED_PERSON));
        f01.setRestrictedParty(employee, OperatorSelfDealing.OperatorRole.OPERATOR_ASSOCIATED_PERSON);
    }

    function test_setRegistryAvailable_emits() public {
        vm.expectEmit(false, false, false, true);
        emit RegistryAvailabilitySet(false);
        f01.setRegistryAvailable(false);
        assertFalse(f01.registryAvailable());
    }

    function test_setPrimaryDistributor_emits() public {
        vm.expectEmit(true, false, false, true);
        emit PrimaryDistributorSet(issuer, true);
        f01.setPrimaryDistributor(issuer, true);
        assertTrue(f01.allowsPrimary(issuer));
    }

    function test_setInvoluntaryAgent_emits() public {
        vm.expectEmit(true, false, false, true);
        emit InvoluntaryAgentSet(recoveryAgent, true);
        f01.setInvoluntaryAgent(recoveryAgent, true);
        assertTrue(f01.involuntaryAgent(recoveryAgent));
    }

    // --- doc §7.1 Test 1: normal pass -----------------------------------

    function test_T1_bothClean_pass() public {
        // Whitelist investor A (seller) -> whitelist investor B (buyer). Neither on
        // the roster => OP_CLEAR (step 5).
        (bool passed, bytes32 rc) = f01.check(buyer, seller, asset, 0, _secondaryCtx());
        assertTrue(passed);
        assertEq(rc, bytes32(0));
    }

    // --- doc §7.2 Test 2: operator entity as party => code 3 -------------

    function test_T2_operatorEntityBuyer_fails3() public {
        // Decipher legal entity buys for its own account (secondary) => blocked.
        f01.setRestrictedParty(buyer, OperatorSelfDealing.OperatorRole.OPERATOR_ENTITY);
        (bool passed, bytes32 rc) = f01.check(buyer, seller, asset, 0, _secondaryCtx());
        assertFalse(passed);
        assertEq(rc, _code(3));
    }

    function test_T2_operatorEntitySeller_fails3() public {
        // Same block regardless of which side the operator entity sits on (§5.3).
        f01.setRestrictedParty(seller, OperatorSelfDealing.OperatorRole.OPERATOR_ENTITY);
        (bool passed, bytes32 rc) = f01.check(buyer, seller, asset, 0, _secondaryCtx());
        assertFalse(passed);
        assertEq(rc, _code(3));
    }

    // --- doc §7.3 Test 3: affiliate as counterparty => code 3 ------------

    function test_T3_affiliateCounterparty_fails3() public {
        // Common-control sister desk (Rule 405) sells opposite a subscriber. A-06
        // settled control off-chain and it landed on the roster; on-chain is a
        // pure membership screen. from (seller) restricted => blocked.
        f01.setRestrictedParty(seller, OperatorSelfDealing.OperatorRole.OPERATOR_AFFILIATE);
        (bool passed, bytes32 rc) = f01.check(buyer, seller, asset, 0, _secondaryCtx());
        assertFalse(passed);
        assertEq(rc, _code(3));
    }

    function test_bothSidesRestricted_fails3() public {
        // Operator internal move: both parties restricted, no exception => blocked
        // (doc §3.11 boundary — F-01 does not distinguish one-side vs both-sides).
        f01.setRestrictedParty(buyer, OperatorSelfDealing.OperatorRole.OPERATOR_CONTROLLED_ACCOUNT);
        f01.setRestrictedParty(seller, OperatorSelfDealing.OperatorRole.OPERATOR_ENTITY);
        (bool passed, bytes32 rc) = f01.check(buyer, seller, asset, 0, _secondaryCtx());
        assertFalse(passed);
        assertEq(rc, _code(3));
    }

    // --- doc §7.4 Test 4: primary-distribution exception boundary --------

    function test_T4_primaryDistribution_exempt_pass() public {
        // Issuer (seller/from) distributes to a whitelist investor via the Manifest
        // primary path. Issuer overlaps the operator roster but the primary
        // exception clears it (OP_EXEMPT_PRIMARY).
        f01.setRestrictedParty(seller, OperatorSelfDealing.OperatorRole.OPERATOR_ENTITY);
        f01.setPrimaryDistributor(seller, true);
        (bool passed, bytes32 rc) = f01.check(buyer, seller, asset, 0, _ctx(FlowType.PRIMARY_DISTRIBUTION, address(0)));
        assertTrue(passed);
        assertEq(rc, bytes32(0));
    }

    function test_T4_boundary_sameIssuerInSecondary_fails3() public {
        // Boundary (doc §7.4): the same designated issuer entering a SECONDARY match
        // as a party is NOT the primary path => blocked.
        f01.setRestrictedParty(seller, OperatorSelfDealing.OperatorRole.OPERATOR_ENTITY);
        f01.setPrimaryDistributor(seller, true);
        (bool passed, bytes32 rc) = f01.check(buyer, seller, asset, 0, _secondaryCtx());
        assertFalse(passed);
        assertEq(rc, _code(3));
    }

    function test_primaryFlow_butNotDesignatedDistributor_fails3() public {
        // Narrow exception: PRIMARY_DISTRIBUTION flow alone is not enough — the
        // from/seller must be a Manifest-designated distributor. Not designated =>
        // blocked.
        f01.setRestrictedParty(seller, OperatorSelfDealing.OperatorRole.OPERATOR_ENTITY);
        (bool passed, bytes32 rc) = f01.check(buyer, seller, asset, 0, _ctx(FlowType.PRIMARY_DISTRIBUTION, address(0)));
        assertFalse(passed);
        assertEq(rc, _code(3));
    }

    // --- involuntary (forcedTransfer/recovery) exception -----------------

    function test_involuntaryTransfer_exempt_pass() public {
        // Restricted party is a party, but the transfer is initiated by a registered
        // recovery authority (doc §6.3②) => OP_EXEMPT_INVOLUNTARY.
        f01.setRestrictedParty(buyer, OperatorSelfDealing.OperatorRole.OPERATOR_CONTROLLED_ACCOUNT);
        f01.setInvoluntaryAgent(recoveryAgent, true);
        (bool passed, bytes32 rc) = f01.check(buyer, seller, asset, 0, _ctx(FlowType.SECONDARY_TRADE, recoveryAgent));
        assertTrue(passed);
        assertEq(rc, bytes32(0));
    }

    function test_involuntary_unregisteredInitiator_fails3() public {
        // An unregistered initiator does not earn the involuntary exception.
        f01.setRestrictedParty(buyer, OperatorSelfDealing.OperatorRole.OPERATOR_CONTROLLED_ACCOUNT);
        (bool passed, bytes32 rc) = f01.check(buyer, seller, asset, 0, _ctx(FlowType.SECONDARY_TRADE, recoveryAgent));
        assertFalse(passed);
        assertEq(rc, _code(3));
    }

    // --- doc §7.5 Test 5: fresh-wallet bypass (honest limitation) --------

    function test_T5_freshWallet_unlisted_passes_honestLimitation() public {
        // Doc §7.5: an employee routes through a brand-new wallet that is NOT on the
        // address-keyed roster. On its own the on-chain mock cannot see that the
        // fresh wallet resolves to the employee's ONCHAINID, so it PASSES — the
        // honest limitation. The defeat comes from A-04 resolving wallet->ONCHAINID
        // upstream (doc §7.5, §9.2) and from roster completeness under the §10
        // 3-layer trust model; the on-chain reflection window is the doc §12 P0
        // structural weakness, not something this element closes alone.
        f01.setRestrictedParty(employee, OperatorSelfDealing.OperatorRole.OPERATOR_ASSOCIATED_PERSON);
        address freshWallet = address(0xF9E54);
        (bool passed, bytes32 rc) = f01.check(freshWallet, seller, asset, 0, _secondaryCtx());
        assertTrue(passed);
        assertEq(rc, bytes32(0));
    }

    function test_T5_freshWallet_onceReflectedOnRoster_blocks() public {
        // Mitigation realised: once A-04's wallet->ONCHAINID resolution is reflected
        // onto the roster (the fresh wallet is tagged as the associated person), the
        // same trade is blocked. Shows the mechanism works once the roster is
        // complete (doc §10 Layer 1-2).
        address freshWallet = address(0xF9E54);
        f01.setRestrictedParty(freshWallet, OperatorSelfDealing.OperatorRole.OPERATOR_ASSOCIATED_PERSON);
        (bool passed, bytes32 rc) = f01.check(freshWallet, seller, asset, 0, _secondaryCtx());
        assertFalse(passed);
        assertEq(rc, _code(3));
    }

    // --- code 1: identity unresolved (fail-closed, A-04 upstream seam) ---

    function test_code1_zeroBuyer_fails1() public {
        (bool passed, bytes32 rc) = f01.check(address(0), seller, asset, 0, _secondaryCtx());
        assertFalse(passed);
        assertEq(rc, _code(1));
    }

    function test_code1_zeroSeller_fails1() public {
        (bool passed, bytes32 rc) = f01.check(buyer, address(0), asset, 0, _secondaryCtx());
        assertFalse(passed);
        assertEq(rc, _code(1));
    }

    // --- code 2 / fail-closed default: registry unavailable --------------

    function test_failClosed_defaultRegistryUnavailable() public {
        // Fresh instance: registryAvailable defaults false => every trade fails
        // closed with OP_REGISTRY_UNAVAILABLE even with two clean parties (doc
        // §5.5/§8.3 — uncertainty resolves to a block, never a pass).
        OperatorSelfDealing fresh = new OperatorSelfDealing();
        (bool passed, bytes32 rc) = fresh.check(buyer, seller, asset, 0, _secondaryCtx());
        assertFalse(passed);
        assertEq(rc, _code(2));
    }

    function test_code2_takesPrecedenceOverRosterMatch() public {
        // Registry-unavailable is evaluated before the roster screen: even a listed
        // party returns code 2, not code 3, while the roster is unloaded.
        f01.setRegistryAvailable(false);
        f01.setRestrictedParty(buyer, OperatorSelfDealing.OperatorRole.OPERATOR_ENTITY);
        (bool passed, bytes32 rc) = f01.check(buyer, seller, asset, 0, _secondaryCtx());
        assertFalse(passed);
        assertEq(rc, _code(2));
    }

    // --- context-shape robustness ---------------------------------------

    function test_shortContext_restrictedParty_blocks() public {
        // A short/absent context cannot be decoded => no exception path is available
        // => a restricted party is blocked (fail-closed), never accidentally exempt.
        f01.setRestrictedParty(seller, OperatorSelfDealing.OperatorRole.OPERATOR_AFFILIATE);
        (bool passed, bytes32 rc) = f01.check(buyer, seller, asset, 0, "");
        assertFalse(passed);
        assertEq(rc, _code(3));
    }

    function test_shortContext_cleanParties_pass() public {
        // With no restricted party the context is never decoded and the trade clears.
        (bool passed, bytes32 rc) = f01.check(buyer, seller, asset, 0, "");
        assertTrue(passed);
        assertEq(rc, bytes32(0));
    }

    // --- roster round-trip ----------------------------------------------

    function test_roster_addThenRemove_roundTrip() public {
        f01.setRestrictedParty(seller, OperatorSelfDealing.OperatorRole.OPERATOR_ENTITY);
        (bool blocked,) = f01.check(buyer, seller, asset, 0, _secondaryCtx());
        assertFalse(blocked);

        // Relationship ends: removal takes effect for trades after the change (§5.4).
        f01.setRestrictedParty(seller, OperatorSelfDealing.OperatorRole.NONE);
        (bool passed, bytes32 rc) = f01.check(buyer, seller, asset, 0, _secondaryCtx());
        assertTrue(passed);
        assertEq(rc, bytes32(0));
    }
}
