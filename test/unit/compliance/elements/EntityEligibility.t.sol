// SPDX-License-Identifier: GPL-3.0
pragma solidity 0.8.17;

import {Test} from "forge-std/Test.sol";
import {EntityEligibility} from "../../../../src/compliance/elements/EntityEligibility.sol";
import {Errors} from "../../../../src/libraries/Errors.sol";
import {ILookThroughSource, LookThroughStatus} from "../../../../src/interfaces/compliance/ILookThroughSource.sol";
import {
    ElementMetadata,
    ElementCategory,
    TemporalNature,
    Decidability,
    ObligationTiming,
    Statefulness
} from "../../../../src/types/ComplianceTypes.sol";

/// @dev Minimal in-test ILookThroughSource (A-09 not yet in this worktree).
contract MockLookThroughSource is ILookThroughSource {
    mapping(address => LookThroughStatus) internal _status;

    function setStatus(address subject, LookThroughStatus status) external {
        _status[subject] = status;
    }

    function statusOf(address subject) external view override returns (LookThroughStatus) {
        return _status[subject];
    }
}

contract EntityEligibilityTest is Test {
    // Re-declared for vm.expectEmit; enum params canonicalize to uint8 in the
    // event signature so uint8 here matches the contract's enum-typed params
    // (Solidity 0.8.17 cannot `emit` a contract's event by qualified name).
    event EntityClaimSet(
        address indexed user,
        bool isEntity,
        uint8 aiBasis,
        uint8 qpBasis,
        uint256 investmentsUsd,
        bool formedForPurpose,
        bool qibConfirmed,
        bool directReqsMet
    );
    event RequiredTracksSet(address indexed asset, uint8 tracks);
    event EntityAndGateDiagnostic(address indexed user, address indexed asset, uint32 aiCode, uint32 qpCode);

    uint8 internal constant TRACK_AI = 1;
    uint8 internal constant TRACK_QP = 2;
    uint8 internal constant TRACK_BOTH = 3;

    address internal buyer = address(0xB0B);
    address internal asset = address(0xA55E7);
    address internal operator = address(0x0733);
    address internal stranger = address(0xBAD);

    MockLookThroughSource internal look;
    EntityEligibility internal element;

    function setUp() public {
        look = new MockLookThroughSource();
        element = new EntityEligibility(look);
    }

    // --- helpers ---------------------------------------------------------

    function _code(uint32 n) internal pure returns (bytes32) {
        return keccak256(abi.encode(uint16(0), bytes32("A-08-v1"), uint32(n)));
    }

    function _claim(
        EntityEligibility.AiBasis ai,
        EntityEligibility.QpBasis qp,
        uint256 inv,
        bool ffp,
        bool qib,
        bool direct
    ) internal pure returns (EntityEligibility.EntityClaim memory) {
        return EntityEligibility.EntityClaim({
            isEntity: true,
            aiBasis: ai,
            qpBasis: qp,
            investmentsUsd: inv,
            formedForPurpose: ffp,
            qibConfirmed: qib,
            directReqsMet: direct
        });
    }

    function _set(uint8 tracks, EntityEligibility.EntityClaim memory c) internal {
        element.setRequiredTracks(asset, tracks);
        element.setEntityClaim(buyer, c);
    }

    function _check() internal view returns (bool passed, bytes32 reasonCode) {
        return element.check(buyer, address(0), asset, 0, "");
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

    // --- metadata / construction ----------------------------------------

    function test_metadata_fields() public {
        ElementMetadata memory m = element.elementMetadata();
        assertEq(m.elementId, bytes32("A-08-v1"));
        assertEq(uint256(m.category), uint256(ElementCategory.INVESTOR_ATTRIBUTE));
        assertEq(uint256(m.temporal), uint256(TemporalNature.ONE_TIME));
        assertEq(uint256(m.decidability), uint256(Decidability.ATTESTATION_BASED));
        assertEq(uint256(m.timing), uint256(ObligationTiming.EX_ANTE_VERIFY));
        assertEq(uint256(m.statefulness), uint256(Statefulness.STATELESS));
    }

    function test_constructor_revertsOnZeroLookThroughSource() public {
        vm.expectRevert(EntityEligibility.ZeroLookThroughSource.selector);
        new EntityEligibility(ILookThroughSource(address(0)));
    }

    function test_constructor_storesLookThroughSource() public {
        assertEq(address(element.lookThroughSource()), address(look));
    }

    // --- auth / events ---------------------------------------------------

    function test_setEntityClaim_revertsForNonOperator() public {
        EntityEligibility.EntityClaim memory c =
            _claim(EntityEligibility.AiBasis.NONE, EntityEligibility.QpBasis.QIB, 0, false, true, true);
        vm.prank(stranger);
        vm.expectRevert(Errors.NotAuthorized.selector);
        element.setEntityClaim(buyer, c);
    }

    function test_setRequiredTracks_revertsForNonOperator() public {
        vm.prank(stranger);
        vm.expectRevert(Errors.NotAuthorized.selector);
        element.setRequiredTracks(asset, TRACK_QP);
    }

    function test_setEntityClaim_emitsEvent() public {
        EntityEligibility.EntityClaim memory c = _claim(
            EntityEligibility.AiBasis.DIRECT_ASSETS,
            EntityEligibility.QpBasis.FAMILY_COMPANY,
            10_000_000,
            false,
            false,
            true
        );
        vm.expectEmit(true, false, false, true);
        emit EntityClaimSet(
            buyer,
            true,
            uint8(EntityEligibility.AiBasis.DIRECT_ASSETS),
            uint8(EntityEligibility.QpBasis.FAMILY_COMPANY),
            10_000_000,
            false,
            false,
            true
        );
        element.setEntityClaim(buyer, c);
    }

    function test_setRequiredTracks_emitsEvent_andOperatorCanSet() public {
        element.setOperator(operator, true);
        vm.expectEmit(true, false, false, true);
        emit RequiredTracksSet(asset, TRACK_BOTH);
        vm.prank(operator);
        element.setRequiredTracks(asset, TRACK_BOTH);
        assertEq(element.requiredTracksOf(asset), TRACK_BOTH);
    }

    // --- dormancy --------------------------------------------------------

    function test_dormant_noTracks() public {
        // Claim present, but no track armed for the asset => PASS.
        element.setEntityClaim(
            buyer, _claim(EntityEligibility.AiBasis.NONE, EntityEligibility.QpBasis.NONE, 0, false, false, false)
        );
        _assertPass();
    }

    function test_dormant_naturalPerson() public {
        // Tracks armed, but buyer is not an entity => PASS (A-03/A-13 decide).
        element.setRequiredTracks(asset, TRACK_BOTH);
        EntityEligibility.EntityClaim memory c =
            _claim(EntityEligibility.AiBasis.NONE, EntityEligibility.QpBasis.NONE, 0, false, false, false);
        c.isEntity = false;
        element.setEntityClaim(buyer, c);
        _assertPass();
    }

    // --- code 1: CATEGORY_MISMATCH --------------------------------------

    function test_code1_aiBasisNone() public {
        _set(TRACK_AI, _claim(EntityEligibility.AiBasis.NONE, EntityEligibility.QpBasis.NONE, 0, false, false, true));
        _assertFail(1);
    }

    function test_code1_qpBasisNone() public {
        _set(TRACK_QP, _claim(EntityEligibility.AiBasis.NONE, EntityEligibility.QpBasis.NONE, 0, false, false, true));
        _assertFail(1);
    }

    // --- code 2: THRESHOLD_NOT_MET --------------------------------------

    function test_code2_aiDirectBelow() public {
        _set(
            TRACK_AI,
            _claim(
                EntityEligibility.AiBasis.DIRECT_ASSETS, EntityEligibility.QpBasis.NONE, 4_900_000, false, false, true
            )
        );
        _assertFail(2);
    }

    function test_code2_qpFamilyBelow() public {
        _set(
            TRACK_QP,
            _claim(
                EntityEligibility.AiBasis.NONE, EntityEligibility.QpBasis.FAMILY_COMPANY, 4_999_999, false, false, true
            )
        );
        _assertFail(2);
    }

    function test_code2_qpInstitutionalBelow() public {
        _set(
            TRACK_QP,
            _claim(
                EntityEligibility.AiBasis.NONE, EntityEligibility.QpBasis.INSTITUTIONAL, 24_999_999, false, false, true
            )
        );
        _assertFail(2);
    }

    // --- code 3: QIB_UNCONFIRMED ----------------------------------------

    function test_code3_qibUnconfirmed() public {
        _set(TRACK_QP, _claim(EntityEligibility.AiBasis.NONE, EntityEligibility.QpBasis.QIB, 0, false, false, true));
        _assertFail(3);
    }

    // --- code 4: FORMED_FOR_PURPOSE -------------------------------------

    function test_code4_aiDirectFormedForPurpose_barredEvenWithAmple() public {
        // T10: assets ample ($8M) but formed-for-purpose LLC via direct path.
        _set(
            TRACK_AI,
            _claim(
                EntityEligibility.AiBasis.DIRECT_ASSETS, EntityEligibility.QpBasis.NONE, 8_000_000, true, false, true
            )
        );
        _assertFail(4);
    }

    function test_code4_qpTrustFormedForPurpose_noCure() public {
        // Trust FFP: no look-through cure even if A-09 is COMPLETED.
        look.setStatus(buyer, LookThroughStatus.COMPLETED);
        _set(TRACK_QP, _claim(EntityEligibility.AiBasis.NONE, EntityEligibility.QpBasis.TRUST, 0, true, false, true));
        _assertFail(4);
    }

    // --- code 5 / 6: LOOKTHROUGH_REQUIRED vs FAILED ---------------------

    function test_code5_aiAllOwnersNoneStatus() public {
        _set(
            TRACK_AI,
            _claim(EntityEligibility.AiBasis.ALL_OWNERS_AI, EntityEligibility.QpBasis.NONE, 0, false, false, true)
        );
        // default status NONE
        _assertFail(5);
    }

    function test_code5_aiAllOwnersPending() public {
        look.setStatus(buyer, LookThroughStatus.PENDING);
        _set(
            TRACK_AI,
            _claim(EntityEligibility.AiBasis.ALL_OWNERS_AI, EntityEligibility.QpBasis.NONE, 0, false, false, true)
        );
        _assertFail(5);
    }

    function test_code6_aiAllOwnersFailed() public {
        look.setStatus(buyer, LookThroughStatus.FAILED);
        _set(
            TRACK_AI,
            _claim(EntityEligibility.AiBasis.ALL_OWNERS_AI, EntityEligibility.QpBasis.NONE, 0, false, false, true)
        );
        _assertFail(6);
    }

    function test_code5_qpTrustPending() public {
        look.setStatus(buyer, LookThroughStatus.PENDING);
        _set(TRACK_QP, _claim(EntityEligibility.AiBasis.NONE, EntityEligibility.QpBasis.TRUST, 0, false, false, true));
        _assertFail(5);
    }

    function test_code6_qpTrustFailed() public {
        look.setStatus(buyer, LookThroughStatus.FAILED);
        _set(TRACK_QP, _claim(EntityEligibility.AiBasis.NONE, EntityEligibility.QpBasis.TRUST, 0, false, false, true));
        _assertFail(6);
    }

    function test_qpTrustCompleted_passes() public {
        look.setStatus(buyer, LookThroughStatus.COMPLETED);
        _set(TRACK_QP, _claim(EntityEligibility.AiBasis.NONE, EntityEligibility.QpBasis.TRUST, 0, false, false, true));
        _assertPass();
    }

    // company FFP IS cured by look-through COMPLETED (asymmetry vs trust)
    function test_qpFamilyFormedForPurpose_curedByLookThrough() public {
        look.setStatus(buyer, LookThroughStatus.COMPLETED);
        _set(
            TRACK_QP,
            _claim(
                EntityEligibility.AiBasis.NONE, EntityEligibility.QpBasis.FAMILY_COMPANY, 10_000_000, true, false, true
            )
        );
        _assertPass();
    }

    function test_qpFamilyFormedForPurpose_pendingRequiresLookThrough() public {
        look.setStatus(buyer, LookThroughStatus.PENDING);
        _set(
            TRACK_QP,
            _claim(
                EntityEligibility.AiBasis.NONE, EntityEligibility.QpBasis.FAMILY_COMPANY, 10_000_000, true, false, true
            )
        );
        _assertFail(5);
    }

    // --- code 7: DIRECT_REQ_MISSING -------------------------------------

    function test_code7_qpFamilyDirectReqMissing() public {
        _set(
            TRACK_QP,
            _claim(
                EntityEligibility.AiBasis.NONE,
                EntityEligibility.QpBasis.FAMILY_COMPANY,
                10_000_000,
                false,
                false,
                false
            )
        );
        _assertFail(7);
    }

    function test_code7_aiAllOwnersDirectReqMissing() public {
        look.setStatus(buyer, LookThroughStatus.COMPLETED);
        _set(
            TRACK_AI,
            _claim(EntityEligibility.AiBasis.ALL_OWNERS_AI, EntityEligibility.QpBasis.NONE, 0, false, false, false)
        );
        _assertFail(7);
    }

    // --- boundaries (doc §5.3) ------------------------------------------

    function test_boundary_aiDirectExactly5M_fails() public {
        // STRICT `>`: exactly $5,000,000 FAILs (code 2).
        _set(
            TRACK_AI,
            _claim(
                EntityEligibility.AiBasis.DIRECT_ASSETS, EntityEligibility.QpBasis.NONE, 5_000_000, false, false, true
            )
        );
        _assertFail(2);
    }

    function test_boundary_qpFamilyExactly5M_passes() public {
        // INCLUSIVE `>=`: exactly $5,000,000 PASSes.
        _set(
            TRACK_QP,
            _claim(
                EntityEligibility.AiBasis.NONE, EntityEligibility.QpBasis.FAMILY_COMPANY, 5_000_000, false, false, true
            )
        );
        _assertPass();
    }

    function test_boundary_qpInstitutionalExactly25M_passes() public {
        _set(
            TRACK_QP,
            _claim(
                EntityEligibility.AiBasis.NONE, EntityEligibility.QpBasis.INSTITUTIONAL, 25_000_000, false, true, true
            )
        );
        _assertPass();
    }

    // --- happy paths -----------------------------------------------------

    function test_pass_qpFamily() public {
        _set(
            TRACK_QP,
            _claim(
                EntityEligibility.AiBasis.NONE, EntityEligibility.QpBasis.FAMILY_COMPANY, 10_000_000, false, false, true
            )
        );
        _assertPass();
    }

    function test_pass_qpQib_skipsAmount() public {
        _set(TRACK_QP, _claim(EntityEligibility.AiBasis.NONE, EntityEligibility.QpBasis.QIB, 0, false, true, true));
        _assertPass();
    }

    function test_pass_aiAllOwnersCompleted() public {
        look.setStatus(buyer, LookThroughStatus.COMPLETED);
        _set(
            TRACK_AI,
            _claim(EntityEligibility.AiBasis.ALL_OWNERS_AI, EntityEligibility.QpBasis.NONE, 0, false, false, true)
        );
        _assertPass();
    }

    // T11: formed-for-purpose LLC re-submitted as (a)(8), all owners AI => PASS.
    function test_pass_aiFormedForPurpose_curedByAllOwners() public {
        look.setStatus(buyer, LookThroughStatus.COMPLETED);
        _set(
            TRACK_AI,
            _claim(EntityEligibility.AiBasis.ALL_OWNERS_AI, EntityEligibility.QpBasis.NONE, 0, true, false, true)
        );
        _assertPass();
    }

    // --- T4 signature case & AND gate (code 8) --------------------------

    // Exactly $5M family company: R3-only PASSes; R1+R3 fails AI(strict) => 8.
    function test_t4_qpFamilyExactly5M_r3Only_passes() public {
        _set(
            TRACK_QP,
            _claim(
                EntityEligibility.AiBasis.DIRECT_ASSETS,
                EntityEligibility.QpBasis.FAMILY_COMPANY,
                5_000_000,
                false,
                false,
                true
            )
        );
        _assertPass();
    }

    function test_t4_qpFamilyExactly5M_bothTracks_andGateFails() public {
        _set(
            TRACK_BOTH,
            _claim(
                EntityEligibility.AiBasis.DIRECT_ASSETS,
                EntityEligibility.QpBasis.FAMILY_COMPANY,
                5_000_000,
                false,
                false,
                true
            )
        );
        // QP family >= 5M passes, AI direct <= 5M fails (strict) => AND gate code 8.
        _assertFail(8);
    }

    function test_andGate_bothPass() public {
        // AI direct $6M (> 5M) and QP family $6M (>= 5M) both pass => PASS.
        _set(
            TRACK_BOTH,
            _claim(
                EntityEligibility.AiBasis.DIRECT_ASSETS,
                EntityEligibility.QpBasis.FAMILY_COMPANY,
                6_000_000,
                false,
                false,
                true
            )
        );
        _assertPass();
    }

    // --- diagnose companion ---------------------------------------------

    function test_diagnose_emitsPerTrackCodes_onAndGateFail() public {
        _set(
            TRACK_BOTH,
            _claim(
                EntityEligibility.AiBasis.DIRECT_ASSETS,
                EntityEligibility.QpBasis.FAMILY_COMPANY,
                5_000_000,
                false,
                false,
                true
            )
        );
        vm.expectEmit(true, true, false, true);
        emit EntityAndGateDiagnostic(buyer, asset, 2, 0); // AI fails threshold (2), QP ok (0)
        (bool passed, bytes32 reasonCode) = element.diagnose(buyer, asset);
        assertFalse(passed);
        assertEq(reasonCode, _code(8));
    }

    function test_diagnose_matchesCheck_onPass() public {
        _set(TRACK_QP, _claim(EntityEligibility.AiBasis.NONE, EntityEligibility.QpBasis.QIB, 0, false, true, true));
        (bool passed, bytes32 reasonCode) = element.diagnose(buyer, asset);
        assertTrue(passed);
        assertEq(reasonCode, bytes32(0));
    }
}
