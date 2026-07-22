// SPDX-License-Identifier: GPL-3.0
pragma solidity 0.8.17;

import {Test} from "forge-std/Test.sol";
import {AccreditedInvestor} from "../../../../src/compliance/elements/AccreditedInvestor.sol";
import {LookThroughStatus} from "../../../../src/interfaces/compliance/ILookThroughSource.sol";
import {Errors} from "../../../../src/libraries/Errors.sol";
import {
    ElementMetadata,
    ElementCategory,
    Decidability,
    ObligationTiming,
    Statefulness,
    TemporalNature
} from "../../../../src/types/ComplianceTypes.sol";

contract AccreditedInvestorTest is Test {
    // Re-declared to match AccreditedInvestor's events for vm.expectEmit
    // (Solidity 0.8.17 cannot reference a non-library contract's event by
    // qualified name in an `emit` statement; that requires >=0.8.22).
    event AccreditedInvestorSet(address indexed investor, bool isAccredited);
    event AiClaimSet(
        address indexed investor,
        bool exists,
        bool issuerTrusted,
        bool signatureValid,
        uint64 expiry,
        bool verificationBasisAccepted,
        AccreditedInvestor.AiClaimBasis basis,
        LookThroughStatus ltStatus,
        bool reviewRequired
    );
    event Asset506cVerificationRequirementSet(address indexed asset, bool required);
    event AssetSec4a7PathSet(address indexed asset, bool enabled);

    bytes32 internal constant ELEMENT_ID = "A-03-v1";

    address internal user = address(0xA11CE);
    address internal asset = address(0xBEEF);
    address internal stranger = address(0xBAD);

    // Arbitrary fixed epoch anchor so every test's timeline is deterministic
    // regardless of the harness's default block.timestamp.
    uint64 internal constant START = 1_700_000_000;

    AccreditedInvestor internal element;

    function setUp() public {
        element = new AccreditedInvestor();
        vm.warp(START);
    }

    function _code(uint32 n) internal pure returns (bytes32) {
        return keccak256(abi.encode(uint16(0), ELEMENT_ID, n));
    }

    /// @dev Fully-valid DIRECT claim — same shape `setAccredited(user, true)` writes.
    function _validClaim() internal pure returns (AccreditedInvestor.AiClaim memory) {
        return AccreditedInvestor.AiClaim({
            exists: true,
            issuerTrusted: true,
            signatureValid: true,
            expiry: 0,
            verificationBasisAccepted: true,
            basis: AccreditedInvestor.AiClaimBasis.DIRECT,
            ltStatus: LookThroughStatus.NONE,
            reviewRequired: false
        });
    }

    function _check() internal view returns (bool passed, bytes32 rc) {
        return element.check(user, address(0), asset, 0, "");
    }

    // ---------------------------------------------------------------
    // Metadata + auth
    // ---------------------------------------------------------------

    function test_metadata_fields() public {
        ElementMetadata memory m = element.elementMetadata();
        assertEq(m.elementId, ELEMENT_ID);
        assertEq(uint256(m.category), uint256(ElementCategory.INVESTOR_ATTRIBUTE));
        assertEq(uint256(m.decidability), uint256(Decidability.ATTESTATION_BASED));
        assertEq(uint256(m.timing), uint256(ObligationTiming.EX_ANTE_VERIFY));
        assertEq(uint256(m.statefulness), uint256(Statefulness.STATELESS));
        assertEq(uint256(m.temporal), uint256(TemporalNature.ONE_TIME));
    }

    function test_setAccredited_revertsForNonOperator() public {
        vm.prank(stranger);
        vm.expectRevert(Errors.NotAuthorized.selector);
        element.setAccredited(user, true);
    }

    function test_setClaim_revertsForNonOperator() public {
        vm.prank(stranger);
        vm.expectRevert(Errors.NotAuthorized.selector);
        element.setClaim(user, _validClaim());
    }

    function test_setRequires506cVerification_revertsForNonOperator() public {
        vm.prank(stranger);
        vm.expectRevert(Errors.NotAuthorized.selector);
        element.setRequires506cVerification(asset, true);
    }

    function test_setSec4a7Path_revertsForNonOperator() public {
        vm.prank(stranger);
        vm.expectRevert(Errors.NotAuthorized.selector);
        element.setSec4a7Path(asset, true);
    }

    // ---------------------------------------------------------------
    // Legacy compatibility — setAccredited + accredited view
    // ---------------------------------------------------------------

    function test_legacy_default_fails_code1() public {
        (bool passed, bytes32 rc) = _check();
        assertFalse(passed);
        assertEq(rc, _code(1)); // NO_AI_CLAIM — legacy "not accredited" meaning preserved
    }

    function test_legacy_setAccredited_true_alone_passes() public {
        element.setAccredited(user, true);
        (bool passed, bytes32 rc) = _check();
        assertTrue(passed);
        assertEq(rc, bytes32(0));
        assertTrue(element.accredited(user));
    }

    function test_legacy_setAccredited_true_writes_fully_valid_claim() public {
        element.setAccredited(user, true);
        (
            bool exists,
            bool issuerTrusted,
            bool signatureValid,
            uint64 expiry,
            bool verificationBasisAccepted,
            AccreditedInvestor.AiClaimBasis basis,
            LookThroughStatus ltStatus,
            bool reviewRequired
        ) = element.claimOf(user);
        assertTrue(exists);
        assertTrue(issuerTrusted);
        assertTrue(signatureValid);
        assertEq(expiry, 0);
        assertTrue(verificationBasisAccepted);
        assertEq(uint256(basis), uint256(AccreditedInvestor.AiClaimBasis.DIRECT));
        assertEq(uint256(ltStatus), uint256(LookThroughStatus.NONE));
        assertFalse(reviewRequired);
    }

    function test_legacy_setAccredited_false_clears_claim_and_view() public {
        element.setAccredited(user, true);
        element.setAccredited(user, false);
        assertFalse(element.accredited(user));
        (bool exists,,,,,,,) = element.claimOf(user);
        assertFalse(exists);
        (bool passed, bytes32 rc) = _check();
        assertFalse(passed);
        assertEq(rc, _code(1));
    }

    function test_legacy_setAccredited_emits() public {
        vm.expectEmit(true, false, false, true);
        emit AccreditedInvestorSet(user, true);
        element.setAccredited(user, true);
    }

    // Legacy claim stays green even under the new opt-in strictness flags:
    // it carries verificationBasisAccepted=true and basis=DIRECT.
    function test_legacy_claim_passes_with_506c_and_4a7_flags_on() public {
        element.setAccredited(user, true);
        element.setRequires506cVerification(asset, true);
        element.setSec4a7Path(asset, true);
        (bool passed,) = _check();
        assertTrue(passed);
    }

    // ---------------------------------------------------------------
    // setClaim <-> accredited view consistency
    // ---------------------------------------------------------------

    function test_setClaim_syncs_accredited_view_to_exists() public {
        AccreditedInvestor.AiClaim memory c = _validClaim();
        element.setClaim(user, c);
        assertTrue(element.accredited(user));

        // Coarse view tracks existence only — even a claim that would FAIL
        // the pipeline (untrusted issuer) keeps accredited == exists.
        c.issuerTrusted = false;
        element.setClaim(user, c);
        assertTrue(element.accredited(user));

        c.exists = false;
        element.setClaim(user, c);
        assertFalse(element.accredited(user));
    }

    function test_setClaim_emits() public {
        AccreditedInvestor.AiClaim memory c = _validClaim();
        vm.expectEmit(true, false, false, true);
        emit AiClaimSet(
            user, true, true, true, 0, true, AccreditedInvestor.AiClaimBasis.DIRECT, LookThroughStatus.NONE, false
        );
        element.setClaim(user, c);
    }

    function test_asset_flag_setters_emit() public {
        vm.expectEmit(true, false, false, true);
        emit Asset506cVerificationRequirementSet(asset, true);
        element.setRequires506cVerification(asset, true);

        vm.expectEmit(true, false, false, true);
        emit AssetSec4a7PathSet(asset, true);
        element.setSec4a7Path(asset, true);
    }

    // ---------------------------------------------------------------
    // Pipeline codes, in check order
    // ---------------------------------------------------------------

    function test_code1_no_claim() public {
        AccreditedInvestor.AiClaim memory c = _validClaim();
        c.exists = false;
        element.setClaim(user, c);
        (bool passed, bytes32 rc) = _check();
        assertFalse(passed);
        assertEq(rc, _code(1));
    }

    function test_code2_untrusted_issuer() public {
        AccreditedInvestor.AiClaim memory c = _validClaim();
        c.issuerTrusted = false;
        element.setClaim(user, c);
        (bool passed, bytes32 rc) = _check();
        assertFalse(passed);
        assertEq(rc, _code(2));
    }

    function test_code3_invalid_signature() public {
        AccreditedInvestor.AiClaim memory c = _validClaim();
        c.signatureValid = false;
        element.setClaim(user, c);
        (bool passed, bytes32 rc) = _check();
        assertFalse(passed);
        assertEq(rc, _code(3));
    }

    function test_code4_expired_strict_boundary() public {
        AccreditedInvestor.AiClaim memory c = _validClaim();
        c.expiry = START + 100;
        element.setClaim(user, c);

        // Exactly at expiry PASSes (strict `>`).
        vm.warp(START + 100);
        (bool passed, bytes32 rc) = _check();
        assertTrue(passed);
        assertEq(rc, bytes32(0));

        // One second past expiry FAILs.
        vm.warp(START + 101);
        (passed, rc) = _check();
        assertFalse(passed);
        assertEq(rc, _code(4));
    }

    function test_expiry_zero_means_no_expiry() public {
        element.setClaim(user, _validClaim()); // expiry = 0
        vm.warp(START + 3650 days);
        (bool passed,) = _check();
        assertTrue(passed);
    }

    function test_code5_506c_verification_not_established() public {
        AccreditedInvestor.AiClaim memory c = _validClaim();
        c.verificationBasisAccepted = false;
        element.setClaim(user, c);

        // Flag off (default): verification basis not enforced -> PASS.
        (bool passed, bytes32 rc) = _check();
        assertTrue(passed);

        // Flag on for this asset -> code 5.
        element.setRequires506cVerification(asset, true);
        (passed, rc) = _check();
        assertFalse(passed);
        assertEq(rc, _code(5));

        // Other assets unaffected (per-asset activation).
        (passed,) = element.check(user, address(0), address(0xCAFE), 0, "");
        assertTrue(passed);
    }

    function test_code6_4a7_claim_shell_without_category() public {
        // Doc-ambiguity resolution (see contract NatSpec): code 6 is scoped to a
        // claim that exists and is otherwise valid but carries no AI category
        // (basis == NONE) on a §4(a)(7)-path asset.
        AccreditedInvestor.AiClaim memory c = _validClaim();
        c.basis = AccreditedInvestor.AiClaimBasis.NONE;
        element.setClaim(user, c);

        // Flag off (default, e.g. Rule 144 resale — buyer AI not required):
        // a basis-NONE shell is not rejected by the 4(a)(7) leg.
        (bool passed, bytes32 rc) = _check();
        assertTrue(passed);

        element.setSec4a7Path(asset, true);
        (passed, rc) = _check();
        assertFalse(passed);
        assertEq(rc, _code(6));
    }

    function test_4a7_missing_claim_still_fails_code1_not_6() public {
        // Doc §7: "§4(a)(7) resale에서 buyer AI claim 없음 -> FAIL_NO_AI_CLAIM".
        element.setSec4a7Path(asset, true);
        (bool passed, bytes32 rc) = _check();
        assertFalse(passed);
        assertEq(rc, _code(1));
    }

    function test_code7_lookthrough_not_completed() public {
        AccreditedInvestor.AiClaim memory c = _validClaim();
        c.basis = AccreditedInvestor.AiClaimBasis.ALL_EQUITY_OWNERS;

        // NONE, PENDING and FAILED all map to code 7 (doc has no separate
        // look-through-FAILED code for A-03 — documented resolution).
        LookThroughStatus[3] memory notCompleted =
            [LookThroughStatus.NONE, LookThroughStatus.PENDING, LookThroughStatus.FAILED];
        for (uint256 i = 0; i < notCompleted.length; i++) {
            c.ltStatus = notCompleted[i];
            element.setClaim(user, c);
            (bool passed, bytes32 rc) = _check();
            assertFalse(passed);
            assertEq(rc, _code(7));
        }

        // COMPLETED passes.
        c.ltStatus = LookThroughStatus.COMPLETED;
        element.setClaim(user, c);
        (bool ok, bytes32 rc2) = _check();
        assertTrue(ok);
        assertEq(rc2, bytes32(0));
    }

    function test_code8_category_unsupported() public {
        AccreditedInvestor.AiClaim memory c = _validClaim();
        c.basis = AccreditedInvestor.AiClaimBasis.OTHER;
        element.setClaim(user, c);
        (bool passed, bytes32 rc) = _check();
        assertFalse(passed);
        assertEq(rc, _code(8));
    }

    function test_code9_review_required() public {
        AccreditedInvestor.AiClaim memory c = _validClaim();
        c.reviewRequired = true;
        element.setClaim(user, c);
        (bool passed, bytes32 rc) = _check();
        assertFalse(passed);
        assertEq(rc, _code(9));
    }

    // ---------------------------------------------------------------
    // Ordering
    // ---------------------------------------------------------------

    function test_order_issuer_before_signature() public {
        AccreditedInvestor.AiClaim memory c = _validClaim();
        c.issuerTrusted = false;
        c.signatureValid = false;
        element.setClaim(user, c);
        (, bytes32 rc) = _check();
        assertEq(rc, _code(2));
    }

    function test_order_expiry_before_506c() public {
        AccreditedInvestor.AiClaim memory c = _validClaim();
        c.expiry = START - 1;
        c.verificationBasisAccepted = false;
        element.setClaim(user, c);
        element.setRequires506cVerification(asset, true);
        (, bytes32 rc) = _check();
        assertEq(rc, _code(4));
    }

    function test_order_506c_before_4a7_shell() public {
        AccreditedInvestor.AiClaim memory c = _validClaim();
        c.verificationBasisAccepted = false;
        c.basis = AccreditedInvestor.AiClaimBasis.NONE;
        element.setClaim(user, c);
        element.setRequires506cVerification(asset, true);
        element.setSec4a7Path(asset, true);
        (, bytes32 rc) = _check();
        assertEq(rc, _code(5));
    }

    function test_order_4a7_shell_before_lookthrough_and_review() public {
        AccreditedInvestor.AiClaim memory c = _validClaim();
        c.basis = AccreditedInvestor.AiClaimBasis.NONE;
        c.reviewRequired = true;
        element.setClaim(user, c);
        element.setSec4a7Path(asset, true);
        (, bytes32 rc) = _check();
        assertEq(rc, _code(6));
    }

    function test_order_category_before_review() public {
        AccreditedInvestor.AiClaim memory c = _validClaim();
        c.basis = AccreditedInvestor.AiClaimBasis.OTHER;
        c.reviewRequired = true;
        element.setClaim(user, c);
        (, bytes32 rc) = _check();
        assertEq(rc, _code(8));
    }

    function test_order_lookthrough_before_review() public {
        AccreditedInvestor.AiClaim memory c = _validClaim();
        c.basis = AccreditedInvestor.AiClaimBasis.ALL_EQUITY_OWNERS;
        c.ltStatus = LookThroughStatus.PENDING;
        c.reviewRequired = true;
        element.setClaim(user, c);
        (, bytes32 rc) = _check();
        assertEq(rc, _code(7));
    }
}
