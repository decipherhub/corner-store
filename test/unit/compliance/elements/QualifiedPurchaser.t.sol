// SPDX-License-Identifier: GPL-3.0
pragma solidity 0.8.17;

import {Test} from "forge-std/Test.sol";
import {QualifiedPurchaser} from "../../../../src/compliance/elements/QualifiedPurchaser.sol";
import {Errors} from "../../../../src/libraries/Errors.sol";
import {LookThroughStatus} from "../../../../src/interfaces/compliance/ILookThroughSource.sol";
import {
    ElementMetadata,
    ElementCategory,
    TemporalNature,
    Decidability,
    ObligationTiming,
    Statefulness
} from "../../../../src/types/ComplianceTypes.sol";

contract QualifiedPurchaserTest is Test {
    // Re-declared for vm.expectEmit; enum params canonicalize to uint8 in the
    // event signature (Solidity 0.8.17 cannot `emit` a contract's event by
    // qualified name).
    event QualifiedPurchaserSet(address indexed investor, bool isQp);
    event QpClaimSet(
        address indexed investor,
        uint8 basis,
        bool signatureValid,
        bool issuerTrusted,
        uint64 verifiedAt,
        uint8 ltStatus,
        bytes32 coveredCompany
    );
    event FreshnessCapSet(uint64 cap);

    address internal user = address(0xB0B);
    address internal asset = address(0xA55E7);
    address internal operator = address(0x0733);
    address internal stranger = address(0xBAD);

    QualifiedPurchaser internal qpElement;

    function setUp() public {
        // Warp well past the freshness cap so freshness math is exercised for
        // real (default foundry timestamp of 1 would mask underflow guards).
        vm.warp(1_000 days);
        qpElement = new QualifiedPurchaser();
    }

    // --- helpers ---------------------------------------------------------

    function _code(uint32 n) internal pure returns (bytes32) {
        return keccak256(abi.encode(uint16(0), bytes32("A-13-v1"), uint32(n)));
    }

    function _claim(QualifiedPurchaser.QpBasis basis, LookThroughStatus lt, bytes32 covered)
        internal
        view
        returns (QualifiedPurchaser.QpClaim memory)
    {
        return QualifiedPurchaser.QpClaim({
            basis: basis,
            signatureValid: true,
            issuerTrusted: true,
            verifiedAt: uint64(block.timestamp),
            ltStatus: lt,
            coveredCompany: covered
        });
    }

    function _set(QualifiedPurchaser.QpClaim memory c) internal {
        qpElement.setQpClaim(user, c);
    }

    function _check() internal view returns (bool passed, bytes32 reasonCode) {
        return qpElement.check(user, address(0), asset, 0, "");
    }

    function _assertFail(uint32 n) internal {
        (bool passed, bytes32 reasonCode) = _check();
        assertFalse(passed);
        assertEq(reasonCode, _code(n));
    }

    function _assertPass() internal {
        (bool passed, bytes32 reasonCode) = _check();
        assertTrue(passed);
        assertEq(reasonCode, bytes32(0));
    }

    function _fundKey(address a) internal pure returns (bytes32) {
        return bytes32(uint256(uint160(a)));
    }

    // --- metadata --------------------------------------------------------

    function test_metadata() public {
        ElementMetadata memory m = qpElement.elementMetadata();
        assertEq(m.elementId, bytes32("A-13-v1"));
        assertEq(uint256(m.decidability), uint256(Decidability.ATTESTATION_BASED));
        assertEq(uint256(m.category), uint256(ElementCategory.INVESTOR_ATTRIBUTE));
        assertEq(uint256(m.statefulness), uint256(Statefulness.STATELESS));
    }

    function test_default_freshness_cap_is_one_year() public {
        assertEq(qpElement.freshnessCap(), 365 days);
    }

    // --- legacy setQp compatibility --------------------------------------

    function test_legacy_setQp_true_passes_and_qp_view_true() public {
        (bool passed,) = _check();
        assertFalse(passed); // no claim yet
        assertFalse(qpElement.qp(user));

        qpElement.setQp(user, true);
        _assertPass();
        assertTrue(qpElement.qp(user));
    }

    function test_legacy_setQp_false_clears() public {
        qpElement.setQp(user, true);
        assertTrue(qpElement.qp(user));

        qpElement.setQp(user, false);
        assertFalse(qpElement.qp(user));
        _assertFail(1);
    }

    function test_legacy_setQp_emits() public {
        vm.expectEmit(true, false, false, true);
        emit QualifiedPurchaserSet(user, true);
        qpElement.setQp(user, true);
    }

    function test_setQp_reverts_for_non_operator() public {
        vm.prank(stranger);
        vm.expectRevert(Errors.NotAuthorized.selector);
        qpElement.setQp(user, true);
    }

    function test_operator_can_set() public {
        qpElement.setOperator(operator, true);
        vm.prank(operator);
        qpElement.setQp(user, true);
        assertTrue(qpElement.qp(user));
    }

    // --- setQpClaim access + event ---------------------------------------

    function test_setQpClaim_reverts_for_non_operator() public {
        vm.prank(stranger);
        vm.expectRevert(Errors.NotAuthorized.selector);
        _set(_claim(QualifiedPurchaser.QpBasis.NATURAL, LookThroughStatus.NONE, bytes32(0)));
    }

    function test_setQpClaim_emits() public {
        uint64 ts = uint64(block.timestamp);
        vm.expectEmit(true, false, false, true);
        emit QpClaimSet(
            user, uint8(QualifiedPurchaser.QpBasis.QIB), true, true, ts, uint8(LookThroughStatus.NONE), bytes32(0)
        );
        _set(_claim(QualifiedPurchaser.QpBasis.QIB, LookThroughStatus.NONE, bytes32(0)));
    }

    function test_setFreshnessCap_reverts_for_non_operator() public {
        vm.prank(stranger);
        vm.expectRevert(Errors.NotAuthorized.selector);
        qpElement.setFreshnessCap(5 * 365 days);
    }

    function test_setFreshnessCap_emits_and_updates() public {
        vm.expectEmit(false, false, false, true);
        emit FreshnessCapSet(5 * 365 days);
        qpElement.setFreshnessCap(5 * 365 days);
        assertEq(qpElement.freshnessCap(), 5 * 365 days);
    }

    // --- code 1: NOT_QP (existence / forgery) ----------------------------

    function test_code1_no_claim() public {
        _assertFail(1);
    }

    function test_code1_basis_none_even_if_other_fields_set() public {
        _set(_claim(QualifiedPurchaser.QpBasis.NONE, LookThroughStatus.COMPLETED, bytes32(0)));
        _assertFail(1);
    }

    function test_code1_forged_signature() public {
        QualifiedPurchaser.QpClaim memory c =
            _claim(QualifiedPurchaser.QpBasis.NATURAL, LookThroughStatus.NONE, bytes32(0));
        c.signatureValid = false;
        _set(c);
        _assertFail(1);
    }

    // --- code 3: UNTRUSTED_QP_CLAIM_ISSUER --------------------------------

    function test_code3_untrusted_issuer() public {
        QualifiedPurchaser.QpClaim memory c =
            _claim(QualifiedPurchaser.QpBasis.NATURAL, LookThroughStatus.NONE, bytes32(0));
        c.issuerTrusted = false;
        _set(c);
        _assertFail(3);
    }

    function test_forgery_precedes_untrusted_issuer() public {
        // Both invalid: signature check (code 1) runs before issuer (code 3).
        QualifiedPurchaser.QpClaim memory c =
            _claim(QualifiedPurchaser.QpBasis.NATURAL, LookThroughStatus.NONE, bytes32(0));
        c.signatureValid = false;
        c.issuerTrusted = false;
        _set(c);
        _assertFail(1);
    }

    // --- code 2: QP_CLAIM_EXPIRED (freshness, strict >) ------------------

    function test_code2_expired_beyond_cap() public {
        QualifiedPurchaser.QpClaim memory c =
            _claim(QualifiedPurchaser.QpBasis.NATURAL, LookThroughStatus.NONE, bytes32(0));
        c.verifiedAt = uint64(block.timestamp - 365 days - 1); // 1s past cap
        _set(c);
        _assertFail(2);
    }

    function test_freshness_exactly_at_cap_passes() public {
        QualifiedPurchaser.QpClaim memory c =
            _claim(QualifiedPurchaser.QpBasis.NATURAL, LookThroughStatus.NONE, bytes32(0));
        c.verifiedAt = uint64(block.timestamp - 365 days); // exactly at cap => strict > false
        _set(c);
        _assertPass();
    }

    function test_freshness_one_second_within_cap_passes() public {
        QualifiedPurchaser.QpClaim memory c =
            _claim(QualifiedPurchaser.QpBasis.NATURAL, LookThroughStatus.NONE, bytes32(0));
        c.verifiedAt = uint64(block.timestamp - 365 days + 1);
        _set(c);
        _assertPass();
    }

    function test_issuer_check_precedes_freshness() public {
        // Untrusted AND stale: issuer (3) runs before freshness (2).
        QualifiedPurchaser.QpClaim memory c =
            _claim(QualifiedPurchaser.QpBasis.NATURAL, LookThroughStatus.NONE, bytes32(0));
        c.issuerTrusted = false;
        c.verifiedAt = uint64(block.timestamp - 365 days - 100);
        _set(c);
        _assertFail(3);
    }

    function test_operator_settable_cap_extends_validity() public {
        QualifiedPurchaser.QpClaim memory c =
            _claim(QualifiedPurchaser.QpBasis.NATURAL, LookThroughStatus.NONE, bytes32(0));
        c.verifiedAt = uint64(block.timestamp - 2 * 365 days); // stale under 1y
        _set(c);
        _assertFail(2);

        qpElement.setFreshnessCap(5 * 365 days); // conservative 5y option
        _assertPass();
    }

    // --- direct-pass branches: NATURAL / INSTITUTIONAL / QIB -------------

    function test_natural_passes() public {
        _set(_claim(QualifiedPurchaser.QpBasis.NATURAL, LookThroughStatus.NONE, bytes32(0)));
        _assertPass();
    }

    function test_institutional_passes() public {
        _set(_claim(QualifiedPurchaser.QpBasis.INSTITUTIONAL, LookThroughStatus.NONE, bytes32(0)));
        _assertPass();
    }

    function test_qib_passes() public {
        _set(_claim(QualifiedPurchaser.QpBasis.QIB, LookThroughStatus.NONE, bytes32(0)));
        _assertPass();
    }

    // --- FAMILY_COMPANY look-through branch (codes 4,5,7 + pass) ---------

    function test_family_lookthrough_none_code4() public {
        _set(_claim(QualifiedPurchaser.QpBasis.FAMILY_COMPANY, LookThroughStatus.NONE, bytes32(0)));
        _assertFail(4);
    }

    function test_family_lookthrough_pending_code5() public {
        _set(_claim(QualifiedPurchaser.QpBasis.FAMILY_COMPANY, LookThroughStatus.PENDING, bytes32(0)));
        _assertFail(5);
    }

    function test_family_lookthrough_failed_code7() public {
        _set(_claim(QualifiedPurchaser.QpBasis.FAMILY_COMPANY, LookThroughStatus.FAILED, bytes32(0)));
        _assertFail(7);
    }

    function test_family_lookthrough_completed_passes() public {
        _set(_claim(QualifiedPurchaser.QpBasis.FAMILY_COMPANY, LookThroughStatus.COMPLETED, bytes32(0)));
        _assertPass();
    }

    // --- TRUST look-through branch (codes 4,5,6 + pass) ------------------

    function test_trust_lookthrough_none_code4() public {
        _set(_claim(QualifiedPurchaser.QpBasis.TRUST, LookThroughStatus.NONE, bytes32(0)));
        _assertFail(4);
    }

    function test_trust_lookthrough_pending_code5() public {
        _set(_claim(QualifiedPurchaser.QpBasis.TRUST, LookThroughStatus.PENDING, bytes32(0)));
        _assertFail(5);
    }

    function test_trust_lookthrough_failed_code6() public {
        _set(_claim(QualifiedPurchaser.QpBasis.TRUST, LookThroughStatus.FAILED, bytes32(0)));
        _assertFail(6);
    }

    function test_trust_lookthrough_completed_passes() public {
        _set(_claim(QualifiedPurchaser.QpBasis.TRUST, LookThroughStatus.COMPLETED, bytes32(0)));
        _assertPass();
    }

    function test_trust_vs_family_failed_distinction() public {
        // Same FAILED look-through, different codes by basis: trust 6, family 7.
        _set(_claim(QualifiedPurchaser.QpBasis.TRUST, LookThroughStatus.FAILED, bytes32(0)));
        (, bytes32 trustCode) = _check();

        _set(_claim(QualifiedPurchaser.QpBasis.FAMILY_COMPANY, LookThroughStatus.FAILED, bytes32(0)));
        (, bytes32 familyCode) = _check();

        assertEq(trustCode, _code(6));
        assertEq(familyCode, _code(7));
        assertTrue(trustCode != familyCode);
    }

    // --- KNOWLEDGEABLE_EMPLOYEE branch (code 8 + pass) -------------------

    function test_ke_matching_fund_passes() public {
        _set(_claim(QualifiedPurchaser.QpBasis.KNOWLEDGEABLE_EMPLOYEE, LookThroughStatus.NONE, _fundKey(asset)));
        _assertPass();
    }

    function test_ke_mismatched_fund_code8() public {
        _set(
            _claim(QualifiedPurchaser.QpBasis.KNOWLEDGEABLE_EMPLOYEE, LookThroughStatus.NONE, _fundKey(address(0xDEAD)))
        );
        _assertFail(8);
    }

    function test_ke_zero_covered_company_code8() public {
        _set(_claim(QualifiedPurchaser.QpBasis.KNOWLEDGEABLE_EMPLOYEE, LookThroughStatus.NONE, bytes32(0)));
        _assertFail(8);
    }

    // --- OTHER branch (code 9) -------------------------------------------

    function test_other_basis_review_code9() public {
        _set(_claim(QualifiedPurchaser.QpBasis.OTHER, LookThroughStatus.NONE, bytes32(0)));
        _assertFail(9);
    }

    // --- check order: existence dominates everything ---------------------

    function test_expiry_not_reached_when_basis_none() public {
        // basis NONE with a stale timestamp still returns code 1 (step 1 first).
        QualifiedPurchaser.QpClaim memory c =
            _claim(QualifiedPurchaser.QpBasis.NONE, LookThroughStatus.NONE, bytes32(0));
        c.verifiedAt = uint64(block.timestamp - 2 * 365 days);
        _set(c);
        _assertFail(1);
    }
}
