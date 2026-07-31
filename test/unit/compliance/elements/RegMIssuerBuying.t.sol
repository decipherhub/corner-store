// SPDX-License-Identifier: GPL-3.0
pragma solidity 0.8.17;

import {Test} from "forge-std/Test.sol";
import {RegMIssuerBuying} from "../../../../src/compliance/elements/RegMIssuerBuying.sol";
import {Errors} from "../../../../src/libraries/Errors.sol";
import {
    ElementMetadata,
    ElementCategory,
    TemporalNature,
    Decidability,
    ObligationTiming,
    Statefulness,
    ComplianceContext,
    FlowType
} from "../../../../src/types/ComplianceTypes.sol";

/// @dev F-04 Reg M no-purchase-during-distribution gate tests. Covers metadata,
///      setter auth/events, the doc §7 cases T1-T14, the §5.3 direction rule
///      (roster member as buyer fails / as seller passes), both statutory branches
///      (§242.102 issuer code 4 / §242.101 participant code 5), the §6.3 redemption
///      exception, the §5.5 fail-closed default, and every failure code (1-5).
contract RegMIssuerBuyingTest is Test {
    // Re-declared for vm.expectEmit; enum params canonicalize to uint8 in the
    // signature (Solidity 0.8.17 cannot `emit` a contract's event by name).
    event CoveredSecuritySet(address indexed asset, bool covered);
    event OfferingStatusSet(address indexed asset, uint8 status);
    event ExceptionProfileSet(address indexed asset, uint8 profile);
    event RegistryUnverifiedSet(address indexed asset, bool unverified);
    event AdtvSet(address indexed asset, uint256 adtv);
    event RestrictedRoleSet(address indexed asset, address indexed account, uint8 role);
    event ClusterRoleSet(address indexed asset, address indexed account, uint8 role);
    event InfoBarrierCertifiedSet(address indexed asset, address indexed account, bool certified);
    event PoliciesCertifiedSet(address indexed asset, address indexed account, bool certified);

    address internal asset = address(0xA55E7);
    address internal issuer = address(0x1550E7);
    address internal buyer = address(0xB0B);
    address internal seller = address(0x5E11E7);
    address internal operator = address(0x0733);
    address internal stranger = address(0xBAD);

    RegMIssuerBuying internal e;

    function setUp() public {
        e = new RegMIssuerBuying();
    }

    // --- helpers ---------------------------------------------------------

    function _code(uint32 n) internal pure returns (bytes32) {
        return keccak256(abi.encode(uint16(0), bytes32("F-04-v1"), uint32(n)));
    }

    /// @dev abi.encode(ComplianceContext) — the exact element context the engine
    ///      passes (ComplianceEngine._runChecks). buyer/seller/flow are the only
    ///      fields F-04 can observe (flow) or the engine binds to `user` (buyer).
    function _ctx(address buyer_, address seller_, FlowType flow) internal pure returns (bytes memory) {
        ComplianceContext memory c;
        c.buyer = buyer_;
        c.seller = seller_;
        c.flowType = flow;
        return abi.encode(c);
    }

    /// @dev The engine passes ctx.buyer as `user`; mirror that here.
    function _check(address buyer_, address seller_, uint256 amount, FlowType flow)
        internal
        view
        returns (bool passed, bytes32 rc)
    {
        return e.check(buyer_, seller_, asset, amount, _ctx(buyer_, seller_, flow));
    }

    /// @dev A covered asset in an active continuous offering, profile NONE.
    function _activeCoveredAsset() internal {
        e.setCoveredSecurity(asset, true);
        e.setOfferingStatus(asset, RegMIssuerBuying.OfferingStatus.ONGOING_CONTINUOUS);
    }

    // --- metadata --------------------------------------------------------

    function test_metadata() public {
        ElementMetadata memory m = e.elementMetadata();
        assertEq(m.elementId, bytes32("F-04-v1"));
        assertEq(m.version, "F-04-v1");
        assertEq(uint256(m.category), uint256(ElementCategory.CONDUCT_MONITORING));
        assertEq(uint256(m.temporal), uint256(TemporalNature.REALTIME));
        assertEq(uint256(m.decidability), uint256(Decidability.DETERMINISTIC));
        assertEq(uint256(m.timing), uint256(ObligationTiming.AT_TRADE_GATE));
        assertEq(uint256(m.statefulness), uint256(Statefulness.STATELESS));
    }

    function test_defaults() public {
        assertFalse(e.coveredSecurityOf(asset));
        assertEq(uint256(e.offeringStatusOf(asset)), uint256(RegMIssuerBuying.OfferingStatus.UNSET));
        assertEq(uint256(e.exceptionProfileOf(asset)), uint256(RegMIssuerBuying.ExceptionProfile.NONE));
        assertFalse(e.registryUnverifiedOf(asset));
        assertEq(e.adtvOf(asset), 0);
        assertEq(uint256(e.restrictedRoleOf(asset, buyer)), uint256(RegMIssuerBuying.RestrictedRole.NONE));
    }

    // --- setter auth: stranger reverts ----------------------------------

    function test_setCoveredSecurity_revertsForNonOperator() public {
        vm.prank(stranger);
        vm.expectRevert(Errors.NotAuthorized.selector);
        e.setCoveredSecurity(asset, true);
    }

    function test_setOfferingStatus_revertsForNonOperator() public {
        vm.prank(stranger);
        vm.expectRevert(Errors.NotAuthorized.selector);
        e.setOfferingStatus(asset, RegMIssuerBuying.OfferingStatus.ONGOING_CONTINUOUS);
    }

    function test_setExceptionProfile_revertsForNonOperator() public {
        vm.prank(stranger);
        vm.expectRevert(Errors.NotAuthorized.selector);
        e.setExceptionProfile(asset, RegMIssuerBuying.ExceptionProfile.OPEN_END_UIT);
    }

    function test_setRegistryUnverified_revertsForNonOperator() public {
        vm.prank(stranger);
        vm.expectRevert(Errors.NotAuthorized.selector);
        e.setRegistryUnverified(asset, true);
    }

    function test_setAdtv_revertsForNonOperator() public {
        vm.prank(stranger);
        vm.expectRevert(Errors.NotAuthorized.selector);
        e.setAdtv(asset, 1_000_000);
    }

    function test_setRestrictedRole_revertsForNonOperator() public {
        vm.prank(stranger);
        vm.expectRevert(Errors.NotAuthorized.selector);
        e.setRestrictedRole(asset, buyer, RegMIssuerBuying.RestrictedRole.ISSUER);
    }

    function test_setClusterRole_revertsForNonOperator() public {
        vm.prank(stranger);
        vm.expectRevert(Errors.NotAuthorized.selector);
        e.setClusterRole(asset, buyer, RegMIssuerBuying.RestrictedRole.ISSUER);
    }

    function test_setInfoBarrierCertified_revertsForNonOperator() public {
        vm.prank(stranger);
        vm.expectRevert(Errors.NotAuthorized.selector);
        e.setInfoBarrierCertified(asset, buyer, true);
    }

    function test_setPoliciesCertified_revertsForNonOperator() public {
        vm.prank(stranger);
        vm.expectRevert(Errors.NotAuthorized.selector);
        e.setPoliciesCertified(asset, buyer, true);
    }

    // --- setter auth: owner + operator succeed --------------------------

    function test_ownerCanSet() public {
        // The deployer (this contract) is the owner via Governed/Ownable.
        e.setCoveredSecurity(asset, true);
        assertTrue(e.coveredSecurityOf(asset));
    }

    function test_operatorCanSet() public {
        e.setOperator(operator, true);
        vm.prank(operator);
        e.setRestrictedRole(asset, buyer, RegMIssuerBuying.RestrictedRole.DISTRIBUTION_PARTICIPANT);
        assertEq(
            uint256(e.restrictedRoleOf(asset, buyer)), uint256(RegMIssuerBuying.RestrictedRole.DISTRIBUTION_PARTICIPANT)
        );
    }

    // --- setter events ---------------------------------------------------

    function test_setCoveredSecurity_emits() public {
        vm.expectEmit(true, false, false, true);
        emit CoveredSecuritySet(asset, true);
        e.setCoveredSecurity(asset, true);
    }

    function test_setOfferingStatus_emits() public {
        vm.expectEmit(true, false, false, true);
        emit OfferingStatusSet(asset, uint8(RegMIssuerBuying.OfferingStatus.COMPLETED));
        e.setOfferingStatus(asset, RegMIssuerBuying.OfferingStatus.COMPLETED);
    }

    function test_setExceptionProfile_emits() public {
        vm.expectEmit(true, false, false, true);
        emit ExceptionProfileSet(asset, uint8(RegMIssuerBuying.ExceptionProfile.OPEN_END_UIT));
        e.setExceptionProfile(asset, RegMIssuerBuying.ExceptionProfile.OPEN_END_UIT);
    }

    function test_setRegistryUnverified_emits() public {
        vm.expectEmit(true, false, false, true);
        emit RegistryUnverifiedSet(asset, true);
        e.setRegistryUnverified(asset, true);
    }

    function test_setAdtv_emits() public {
        vm.expectEmit(true, false, false, true);
        emit AdtvSet(asset, 5_000_000);
        e.setAdtv(asset, 5_000_000);
    }

    function test_setRestrictedRole_emits() public {
        vm.expectEmit(true, true, false, true);
        emit RestrictedRoleSet(asset, issuer, uint8(RegMIssuerBuying.RestrictedRole.ISSUER));
        e.setRestrictedRole(asset, issuer, RegMIssuerBuying.RestrictedRole.ISSUER);
    }

    function test_setClusterRole_emits() public {
        vm.expectEmit(true, true, false, true);
        emit ClusterRoleSet(asset, buyer, uint8(RegMIssuerBuying.RestrictedRole.ISSUER));
        e.setClusterRole(asset, buyer, RegMIssuerBuying.RestrictedRole.ISSUER);
    }

    function test_setInfoBarrierCertified_emits() public {
        vm.expectEmit(true, true, false, true);
        emit InfoBarrierCertifiedSet(asset, buyer, true);
        e.setInfoBarrierCertified(asset, buyer, true);
    }

    function test_setPoliciesCertified_emits() public {
        vm.expectEmit(true, true, false, true);
        emit PoliciesCertifiedSet(asset, buyer, true);
        e.setPoliciesCertified(asset, buyer, true);
    }

    // --- doc §7 test cases ----------------------------------------------

    /// T1 — issuer on-DEX buy during distribution => FAIL §242.102 (issuer branch).
    function test_T1_issuerBuy_blocked_issuerBranch() public {
        _activeCoveredAsset();
        e.setRestrictedRole(asset, issuer, RegMIssuerBuying.RestrictedRole.ISSUER);
        (bool passed, bytes32 rc) = _check(issuer, seller, 1, FlowType.SECONDARY_TRADE);
        assertFalse(passed);
        assertEq(rc, _code(4));
    }

    /// T2 — affiliated purchaser buy (safe harbor not met) => FAIL (issuer branch).
    function test_T2_affiliatedPurchaserBuy_blocked() public {
        _activeCoveredAsset();
        e.setRestrictedRole(asset, buyer, RegMIssuerBuying.RestrictedRole.AFFILIATED_PURCHASER);
        (bool passed, bytes32 rc) = _check(buyer, seller, 1, FlowType.SECONDARY_TRADE);
        assertFalse(passed);
        assertEq(rc, _code(4));
    }

    /// T3 — ordinary qualified buyer, not on roster, cluster unrelated => PASS.
    function test_T3_generalBuyer_passes() public {
        _activeCoveredAsset();
        (bool passed, bytes32 rc) = _check(buyer, seller, 1, FlowType.SECONDARY_TRADE);
        assertTrue(passed);
        assertEq(rc, bytes32(0));
    }

    /// T4 ★ — restricted person SELLING => PASS (direction asymmetry, §5.3). The
    ///        issuer is the counterparty (seller), never `user`, so is not screened.
    function test_T4_restrictedPersonSelling_passes() public {
        _activeCoveredAsset();
        e.setRestrictedRole(asset, issuer, RegMIssuerBuying.RestrictedRole.ISSUER);
        // buyer is a clean buyer; issuer is the seller/counterparty.
        (bool passed, bytes32 rc) = _check(buyer, issuer, 1, FlowType.SECONDARY_TRADE);
        assertTrue(passed);
        assertEq(rc, bytes32(0));
    }

    /// T5 ★ — offering COMPLETED, issuer buys => PASS (window closed, §3.4).
    function test_T5_completedOffering_issuerBuy_passes() public {
        e.setCoveredSecurity(asset, true);
        e.setOfferingStatus(asset, RegMIssuerBuying.OfferingStatus.COMPLETED);
        e.setRestrictedRole(asset, issuer, RegMIssuerBuying.RestrictedRole.ISSUER);
        (bool passed, bytes32 rc) = _check(issuer, seller, 1, FlowType.SECONDARY_TRADE);
        assertTrue(passed);
        assertEq(rc, bytes32(0));
    }

    /// T6 ★ — redemption flow => PASS (structurally outside the gate, §6.3), even
    ///        when the buyer is the issuer.
    function test_T6_redemptionFlow_passes() public {
        _activeCoveredAsset();
        e.setRestrictedRole(asset, issuer, RegMIssuerBuying.RestrictedRole.ISSUER);
        (bool passed, bytes32 rc) = _check(issuer, seller, 1, FlowType.REDEMPTION);
        assertTrue(passed);
        assertEq(rc, bytes32(0));
    }

    /// T7 ★ — issuer's indirect buy via a third-party wallet => FAIL (indirectly
    ///        caught via control cluster, §3.8).
    function test_T7_indirectBuy_viaCluster_blocked() public {
        _activeCoveredAsset();
        // buyer is NOT directly on the roster, but is in the issuer's control cluster.
        e.setClusterRole(asset, buyer, RegMIssuerBuying.RestrictedRole.ISSUER);
        (bool passed, bytes32 rc) = _check(buyer, seller, 1, FlowType.SECONDARY_TRADE);
        assertFalse(passed);
        assertEq(rc, _code(4));
    }

    /// T8 ★ — participant de minimis buy (< 2% ADTV + policies) => PASS (exception).
    function test_T8_participantDeMinimis_passes() public {
        _activeCoveredAsset();
        e.setRestrictedRole(asset, buyer, RegMIssuerBuying.RestrictedRole.DISTRIBUTION_PARTICIPANT);
        e.setAdtv(asset, 1_000_000);
        e.setPoliciesCertified(asset, buyer, true);
        // 19_999 / 1_000_000 = 1.9999% < 2% => de minimis.
        (bool passed, bytes32 rc) = _check(buyer, seller, 19_999, FlowType.SECONDARY_TRADE);
        assertTrue(passed);
        assertEq(rc, bytes32(0));
    }

    /// T9 ★ — issuer small buy (de minimis attempt) => FAIL. Issuer branch has NO
    ///        de minimis (§3.12 asymmetry).
    function test_T9_issuerDeMinimis_stillBlocked() public {
        _activeCoveredAsset();
        e.setRestrictedRole(asset, issuer, RegMIssuerBuying.RestrictedRole.ISSUER);
        e.setAdtv(asset, 1_000_000);
        e.setPoliciesCertified(asset, issuer, true);
        (bool passed, bytes32 rc) = _check(issuer, seller, 1, FlowType.SECONDARY_TRADE);
        assertFalse(passed);
        assertEq(rc, _code(4));
    }

    /// T10 — covered asset with no offeringStatus => FAIL (fail-closed, §5.5).
    function test_T10_offeringStatusMissing_failClosed() public {
        e.setCoveredSecurity(asset, true); // covered, but offeringStatus left UNSET
        e.setRestrictedRole(asset, issuer, RegMIssuerBuying.RestrictedRole.ISSUER);
        (bool passed, bytes32 rc) = _check(issuer, seller, 1, FlowType.SECONDARY_TRADE);
        assertFalse(passed);
        assertEq(rc, _code(2));
    }

    /// T11 ★ — excepted-security mis-declaration (private fund declared OPEN_END_UIT)
    ///         => REVIEW conflict (§3.11, no reverse relaxation).
    function test_T11_exceptionProfileConflict_review() public {
        e.setCoveredSecurity(asset, true);
        e.setOfferingStatus(asset, RegMIssuerBuying.OfferingStatus.ONGOING_CONTINUOUS);
        e.setExceptionProfile(asset, RegMIssuerBuying.ExceptionProfile.OPEN_END_UIT);
        (bool passed, bytes32 rc) = _check(buyer, seller, 1, FlowType.SECONDARY_TRADE);
        assertFalse(passed);
        assertEq(rc, _code(1));
    }

    /// T12 ★ — affiliate satisfying the (3) safe harbor => PASS (dropped from
    ///         restricted status, §3.7). Registered AFFILIATED_PURCHASER but certified.
    function test_T12_safeHarborAffiliate_passes() public {
        _activeCoveredAsset();
        e.setRestrictedRole(asset, buyer, RegMIssuerBuying.RestrictedRole.AFFILIATED_PURCHASER);
        e.setInfoBarrierCertified(asset, buyer, true);
        (bool passed, bytes32 rc) = _check(buyer, seller, 1, FlowType.SECONDARY_TRADE);
        assertTrue(passed);
        assertEq(rc, bytes32(0));
    }

    /// T13 — unresolved roster red flag => REVIEW (§5.5).
    function test_T13_registryUnverified_review() public {
        _activeCoveredAsset();
        e.setRegistryUnverified(asset, true);
        e.setRestrictedRole(asset, issuer, RegMIssuerBuying.RestrictedRole.ISSUER);
        (bool passed, bytes32 rc) = _check(issuer, seller, 1, FlowType.SECONDARY_TRADE);
        assertFalse(passed);
        assertEq(rc, _code(3));
    }

    /// T14 ★ — a token that is not the covered security => PASS (not applicable),
    ///         even when the buyer would be the issuer.
    function test_T14_notCoveredSecurity_notApplicable() public {
        // asset never marked covered (default). Even an ISSUER role is irrelevant.
        e.setRestrictedRole(asset, issuer, RegMIssuerBuying.RestrictedRole.ISSUER);
        (bool passed, bytes32 rc) = _check(issuer, seller, 1, FlowType.SECONDARY_TRADE);
        assertTrue(passed);
        assertEq(rc, bytes32(0));
    }

    // --- direction rule (explicit) --------------------------------------

    function test_direction_rosterMemberAsBuyer_fails() public {
        _activeCoveredAsset();
        e.setRestrictedRole(asset, buyer, RegMIssuerBuying.RestrictedRole.ISSUER);
        (bool passed,) = _check(buyer, seller, 1, FlowType.SECONDARY_TRADE);
        assertFalse(passed);
    }

    function test_direction_rosterMemberAsSeller_passes() public {
        _activeCoveredAsset();
        // Same roster member, now on the SELL side (counterparty). Buyer is clean.
        e.setRestrictedRole(asset, seller, RegMIssuerBuying.RestrictedRole.ISSUER);
        (bool passed, bytes32 rc) = _check(buyer, seller, 1, FlowType.SECONDARY_TRADE);
        assertTrue(passed);
        assertEq(rc, bytes32(0));
    }

    // --- both branches: distinct codes ----------------------------------

    function test_participantBuy_blocked_participantBranch() public {
        _activeCoveredAsset();
        e.setRestrictedRole(asset, buyer, RegMIssuerBuying.RestrictedRole.DISTRIBUTION_PARTICIPANT);
        (bool passed, bytes32 rc) = _check(buyer, seller, 1, FlowType.SECONDARY_TRADE);
        assertFalse(passed);
        assertEq(rc, _code(5)); // §242.101(a)
    }

    function test_sellingSecurityHolderBuy_blocked_issuerBranch() public {
        _activeCoveredAsset();
        e.setRestrictedRole(asset, buyer, RegMIssuerBuying.RestrictedRole.SELLING_SECURITY_HOLDER);
        (bool passed, bytes32 rc) = _check(buyer, seller, 1, FlowType.SECONDARY_TRADE);
        assertFalse(passed);
        assertEq(rc, _code(4)); // §242.102(a)
    }

    // --- primary distribution flow is also gated ------------------------

    function test_primaryDistributionFlow_issuerBuy_blocked() public {
        _activeCoveredAsset();
        e.setRestrictedRole(asset, issuer, RegMIssuerBuying.RestrictedRole.ISSUER);
        (bool passed, bytes32 rc) = _check(issuer, seller, 1, FlowType.PRIMARY_DISTRIBUTION);
        assertFalse(passed);
        assertEq(rc, _code(4));
    }

    // --- de minimis boundaries + preconditions --------------------------

    function test_deMinimis_exactly2pct_blocked() public {
        _activeCoveredAsset();
        e.setRestrictedRole(asset, buyer, RegMIssuerBuying.RestrictedRole.DISTRIBUTION_PARTICIPANT);
        e.setAdtv(asset, 1_000_000);
        e.setPoliciesCertified(asset, buyer, true);
        // 20_000 / 1_000_000 = exactly 2% => strict < fails => blocked (participant).
        (bool passed, bytes32 rc) = _check(buyer, seller, 20_000, FlowType.SECONDARY_TRADE);
        assertFalse(passed);
        assertEq(rc, _code(5));
    }

    function test_deMinimis_withoutPolicies_blocked() public {
        _activeCoveredAsset();
        e.setRestrictedRole(asset, buyer, RegMIssuerBuying.RestrictedRole.DISTRIBUTION_PARTICIPANT);
        e.setAdtv(asset, 1_000_000);
        // policiesCertified defaults false => no exception even though amount tiny.
        (bool passed, bytes32 rc) = _check(buyer, seller, 1, FlowType.SECONDARY_TRADE);
        assertFalse(passed);
        assertEq(rc, _code(5));
    }

    function test_deMinimis_withoutAdtv_blocked() public {
        _activeCoveredAsset();
        e.setRestrictedRole(asset, buyer, RegMIssuerBuying.RestrictedRole.DISTRIBUTION_PARTICIPANT);
        e.setPoliciesCertified(asset, buyer, true);
        // adtv defaults 0 => threshold undefined => no exception.
        (bool passed, bytes32 rc) = _check(buyer, seller, 1, FlowType.SECONDARY_TRADE);
        assertFalse(passed);
        assertEq(rc, _code(5));
    }

    // --- fail-closed: short context skips redemption relaxation ---------

    function test_shortContext_skipsRedemptionRelaxation_stillBlocks() public {
        _activeCoveredAsset();
        e.setRestrictedRole(asset, issuer, RegMIssuerBuying.RestrictedRole.ISSUER);
        // An empty context cannot be decoded for FlowType; the relaxation is skipped
        // and the issuer buy is blocked (fail-closed direction).
        (bool passed, bytes32 rc) = e.check(issuer, seller, asset, 1, "");
        assertFalse(passed);
        assertEq(rc, _code(4));
    }
}
