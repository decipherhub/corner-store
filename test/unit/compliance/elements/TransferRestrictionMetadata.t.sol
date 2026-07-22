// SPDX-License-Identifier: GPL-3.0
pragma solidity 0.8.17;

import {Test} from "forge-std/Test.sol";
import {TransferRestrictionMetadata} from "../../../../src/compliance/elements/TransferRestrictionMetadata.sol";
import {Errors} from "../../../../src/libraries/Errors.sol";
import {ElementMetadata, ElementCategory, Decidability, Statefulness} from "../../../../src/types/ComplianceTypes.sol";

contract TransferRestrictionMetadataTest is Test {
    // Re-declared to match the contract's events for vm.expectEmit (Solidity
    // 0.8.17 cannot reference a non-library contract's event by qualified name
    // in an `emit` statement; that requires >=0.8.22).
    event DeclarationSet(address indexed asset, bytes32 declarationHash);
    event RequiresRestrictedSet(bytes32 indexed issuanceFramework, bool required);
    event ValidPathsMaskSet(uint32 mask);
    event ApprovedUnrestrictBasisSet(bytes32 indexed basisRef, bool approved);

    bytes32 internal constant ELEMENT_ID = "B-03-v1";

    bytes32 internal constant REG_D = bytes32("REG_D"); // requiresRestricted = true
    bytes32 internal constant REG_A = bytes32("REG_A"); // never set => requiresRestricted = false (lax)

    uint32 internal constant PATH_RULE144 = 1; // bit0
    uint32 internal constant PATH_4A7 = 2; // bit1
    uint32 internal constant PATH_144A = 4; // bit2
    uint32 internal constant PATH_UNKNOWN = 8; // bit3 — never in validPathsMask
    uint32 internal constant VALID_PATHS_MASK = PATH_RULE144 | PATH_4A7 | PATH_144A; // 0x07

    bytes32 internal constant CLASS_ID = bytes32("CLASS-1");
    bytes32 internal constant LEGEND_REF = bytes32("legend-hash");
    bytes32 internal constant BASIS_REF = bytes32("opinion+ta-hash");

    address internal asset = address(0xBEEF);
    address internal undeclaredAsset = address(0xCAFE);
    address internal operator = address(0x0733);
    address internal stranger = address(0xBAD);

    TransferRestrictionMetadata internal element;

    function setUp() public {
        element = new TransferRestrictionMetadata();
        element.setRequiresRestricted(REG_D, true);
        element.setValidPathsMask(VALID_PATHS_MASK);
    }

    function _reasonCode(uint32 n) internal pure returns (bytes32) {
        return keccak256(abi.encode(uint16(0), ELEMENT_ID, n));
    }

    /// @dev A fully-compliant restricted declaration: REG_D framework, valid
    ///     paths, 12-month (non-reporting) holding period, complete tags, no
    ///     internal conflicts. Each test starts from this and mutates one axis.
    function _validRestrictedDecl() internal pure returns (TransferRestrictionMetadata.RestrictionDecl memory) {
        return TransferRestrictionMetadata.RestrictionDecl({
            declared: true,
            restrictedFlag: true,
            issuanceFramework: REG_D,
            enabledResalePaths: PATH_RULE144 | PATH_4A7,
            holdingPeriodMonths: 12,
            reportingStatus: TransferRestrictionMetadata.ReportingStatus.NON_REPORTING,
            currentInfoRequired: false,
            legendRef: LEGEND_REF,
            classRef: CLASS_ID,
            legalClassId: CLASS_ID,
            unrestrictBasisRef: bytes32(0)
        });
    }

    // ---------------------------------------------------------------------
    // Metadata
    // ---------------------------------------------------------------------

    function test_metadata_fields() public {
        ElementMetadata memory m = element.elementMetadata();
        assertEq(m.elementId, ELEMENT_ID);
        assertEq(uint256(m.category), uint256(ElementCategory.ASSET_ATTRIBUTE));
        assertEq(uint256(m.decidability), uint256(Decidability.DETERMINISTIC));
        assertEq(uint256(m.statefulness), uint256(Statefulness.STATELESS));
    }

    // ---------------------------------------------------------------------
    // Auth gating — every setter reverts for non-operator, succeeds + emits
    // for owner/operator.
    // ---------------------------------------------------------------------

    function test_setDeclaration_revertsForNonOperator() public {
        vm.prank(stranger);
        vm.expectRevert(Errors.NotAuthorized.selector);
        element.setDeclaration(asset, _validRestrictedDecl());
    }

    function test_setDeclaration_ownerCanSet_andEmitsEvent() public {
        TransferRestrictionMetadata.RestrictionDecl memory decl = _validRestrictedDecl();
        vm.expectEmit(true, false, false, true);
        emit DeclarationSet(asset, keccak256(abi.encode(decl)));
        element.setDeclaration(asset, decl);

        (bool declared, bool restrictedFlag,,,,,,,,,) = element.declarationOf(asset);
        assertTrue(declared);
        assertTrue(restrictedFlag);
    }

    function test_setDeclaration_operatorCanSet() public {
        element.setOperator(operator, true);
        vm.prank(operator);
        element.setDeclaration(asset, _validRestrictedDecl());

        (bool declared,,,,,,,,,,) = element.declarationOf(asset);
        assertTrue(declared);
    }

    function test_setRequiresRestricted_revertsForNonOperator() public {
        vm.prank(stranger);
        vm.expectRevert(Errors.NotAuthorized.selector);
        element.setRequiresRestricted(REG_D, true);
    }

    function test_setRequiresRestricted_emitsEvent_andUpdatesStorage() public {
        vm.expectEmit(true, false, false, true);
        emit RequiresRestrictedSet(REG_A, true);
        element.setRequiresRestricted(REG_A, true);
        assertTrue(element.requiresRestricted(REG_A));
    }

    function test_setValidPathsMask_revertsForNonOperator() public {
        vm.prank(stranger);
        vm.expectRevert(Errors.NotAuthorized.selector);
        element.setValidPathsMask(PATH_RULE144);
    }

    function test_setValidPathsMask_emitsEvent_andUpdatesStorage() public {
        vm.expectEmit(false, false, false, true);
        emit ValidPathsMaskSet(PATH_RULE144);
        element.setValidPathsMask(PATH_RULE144);
        assertEq(element.validPathsMask(), PATH_RULE144);
    }

    function test_setApprovedUnrestrictBasis_revertsForNonOperator() public {
        vm.prank(stranger);
        vm.expectRevert(Errors.NotAuthorized.selector);
        element.setApprovedUnrestrictBasis(BASIS_REF, true);
    }

    function test_setApprovedUnrestrictBasis_emitsEvent_andUpdatesStorage() public {
        vm.expectEmit(true, false, false, true);
        emit ApprovedUnrestrictBasisSet(BASIS_REF, true);
        element.setApprovedUnrestrictBasis(BASIS_REF, true);
        assertTrue(element.approvedUnrestrictBasis(BASIS_REF));
    }

    // ---------------------------------------------------------------------
    // Test 1 (doc §7.1) — clean pass
    // ---------------------------------------------------------------------

    function test_check_passes_onFullyCompliantDeclaration() public {
        element.setDeclaration(asset, _validRestrictedDecl());

        (bool passed, bytes32 reasonCode) = element.check(address(0xA11CE), address(0), asset, 0, "");
        assertTrue(passed);
        assertEq(reasonCode, bytes32(0));
    }

    function test_check_ignoresNonAssetParameters() public {
        element.setDeclaration(asset, _validRestrictedDecl());

        (bool passed1,) = element.check(address(0x1), address(0), asset, 0, "");
        (bool passed2,) = element.check(address(0x2), address(0x3), asset, 999, hex"1234");
        assertTrue(passed1);
        assertTrue(passed2);
    }

    // ---------------------------------------------------------------------
    // Test 8 (doc §7.8) / gate ① — missing-vs-false distinction
    // ---------------------------------------------------------------------

    function test_check_fails_declMissing_whenUndeclared() public {
        (bool passed, bytes32 reasonCode) = element.check(address(0), address(0), undeclaredAsset, 0, "");
        assertFalse(passed);
        assertEq(reasonCode, _reasonCode(1));
    }

    // ---------------------------------------------------------------------
    // Test 2 (doc §7.2) / gate ② — false-relaxation fail, and the
    // missing-vs-false pairing (declared + false + required => code 2, not 1)
    // ---------------------------------------------------------------------

    function test_check_fails_statusConflict_whenRequiredButFlagFalse() public {
        TransferRestrictionMetadata.RestrictionDecl memory decl = _validRestrictedDecl();
        decl.restrictedFlag = false;
        decl.unrestrictBasisRef = bytes32(0); // even absent, ② fires first
        element.setDeclaration(asset, decl);

        (bool passed, bytes32 reasonCode) = element.check(address(0), address(0), asset, 0, "");
        assertFalse(passed);
        assertEq(reasonCode, _reasonCode(2));
    }

    function test_check_statusConflict_takesPrecedenceOver_unrestrictBasisMissing() public {
        // Even with an approved basis ref registered, ② (declared as false
        // relaxation against a required-restricted framework) must fire
        // before ⑤ is ever reached.
        element.setApprovedUnrestrictBasis(BASIS_REF, true);
        TransferRestrictionMetadata.RestrictionDecl memory decl = _validRestrictedDecl();
        decl.restrictedFlag = false;
        decl.unrestrictBasisRef = BASIS_REF;
        element.setDeclaration(asset, decl);

        (bool passed, bytes32 reasonCode) = element.check(address(0), address(0), asset, 0, "");
        assertFalse(passed);
        assertEq(reasonCode, _reasonCode(2));
    }

    // ---------------------------------------------------------------------
    // Direction matrix / gate ② — hardening (required lax + flag true) passes
    // ---------------------------------------------------------------------

    function test_check_passes_onHardeningDirection_requiredLaxButFlagTrue() public {
        // REG_A was never registered in requiresRestricted => lax (false).
        // Declaring restrictedFlag = true anyway is conservative overclaim,
        // not a conflict, and must pass (no symmetric check in this direction).
        TransferRestrictionMetadata.RestrictionDecl memory decl = _validRestrictedDecl();
        decl.issuanceFramework = REG_A;
        element.setDeclaration(asset, decl);

        (bool passed, bytes32 reasonCode) = element.check(address(0), address(0), asset, 0, "");
        assertTrue(passed);
        assertEq(reasonCode, bytes32(0));
    }

    // ---------------------------------------------------------------------
    // Test 3 (doc §7.3) / gate ③a — empty path set fails even though the
    // empty set is vacuously a subset of validPathsMask (regression pin).
    // ---------------------------------------------------------------------

    function test_check_fails_tagsIncomplete_onEmptyResalePaths() public {
        TransferRestrictionMetadata.RestrictionDecl memory decl = _validRestrictedDecl();
        decl.enabledResalePaths = 0;
        element.setDeclaration(asset, decl);

        (bool passed, bytes32 reasonCode) = element.check(address(0), address(0), asset, 0, "");
        assertFalse(passed);
        assertEq(reasonCode, _reasonCode(3));
    }

    // ---------------------------------------------------------------------
    // Test 6 (doc §7.6) / gate ③a — unknown path bit fails, not partial-match
    // ---------------------------------------------------------------------

    function test_check_fails_tagInvalid_onUnknownPathBit() public {
        TransferRestrictionMetadata.RestrictionDecl memory decl = _validRestrictedDecl();
        decl.enabledResalePaths = PATH_RULE144 | PATH_UNKNOWN;
        element.setDeclaration(asset, decl);

        (bool passed, bytes32 reasonCode) = element.check(address(0), address(0), asset, 0, "");
        assertFalse(passed);
        assertEq(reasonCode, _reasonCode(4));
    }

    // ---------------------------------------------------------------------
    // Test 6 (doc §7.6) / gate ③b — holding period is SET MEMBERSHIP in
    // {6, 12}, not a magnitude comparison (9 is not "close enough")
    // ---------------------------------------------------------------------

    function test_check_fails_tagInvalid_onHoldingPeriodOutsideLegalSet() public {
        TransferRestrictionMetadata.RestrictionDecl memory decl = _validRestrictedDecl();
        decl.holdingPeriodMonths = 9;
        element.setDeclaration(asset, decl);

        (bool passed, bytes32 reasonCode) = element.check(address(0), address(0), asset, 0, "");
        assertFalse(passed);
        assertEq(reasonCode, _reasonCode(4));
    }

    // ---------------------------------------------------------------------
    // Gate ③ remaining completeness checks (reportingStatus / classRef / legendRef)
    // ---------------------------------------------------------------------

    function test_check_fails_tagsIncomplete_onUnsetReportingStatus() public {
        TransferRestrictionMetadata.RestrictionDecl memory decl = _validRestrictedDecl();
        decl.reportingStatus = TransferRestrictionMetadata.ReportingStatus.UNSET;
        element.setDeclaration(asset, decl);

        (bool passed, bytes32 reasonCode) = element.check(address(0), address(0), asset, 0, "");
        assertFalse(passed);
        assertEq(reasonCode, _reasonCode(3));
    }

    function test_check_fails_tagsIncomplete_onClassRefMismatch() public {
        TransferRestrictionMetadata.RestrictionDecl memory decl = _validRestrictedDecl();
        decl.classRef = bytes32("WRONG-CLASS");
        element.setDeclaration(asset, decl);

        (bool passed, bytes32 reasonCode) = element.check(address(0), address(0), asset, 0, "");
        assertFalse(passed);
        assertEq(reasonCode, _reasonCode(3));
    }

    function test_check_fails_tagsIncomplete_onMissingLegendRef() public {
        TransferRestrictionMetadata.RestrictionDecl memory decl = _validRestrictedDecl();
        decl.legendRef = bytes32(0);
        element.setDeclaration(asset, decl);

        (bool passed, bytes32 reasonCode) = element.check(address(0), address(0), asset, 0, "");
        assertFalse(passed);
        assertEq(reasonCode, _reasonCode(3));
    }

    // ---------------------------------------------------------------------
    // Test 4 (doc §7.4) / gate ④a — relaxing conflict fails, hardening passes
    // ---------------------------------------------------------------------

    function test_check_fails_tagConflict_onNonReportingWithSixMonths() public {
        TransferRestrictionMetadata.RestrictionDecl memory decl = _validRestrictedDecl();
        decl.reportingStatus = TransferRestrictionMetadata.ReportingStatus.NON_REPORTING;
        decl.holdingPeriodMonths = 6;
        element.setDeclaration(asset, decl);

        (bool passed, bytes32 reasonCode) = element.check(address(0), address(0), asset, 0, "");
        assertFalse(passed);
        assertEq(reasonCode, _reasonCode(5));
    }

    function test_check_passes_onReportingWithTwelveMonths_conservativeExcess() public {
        // Reporting issuer's statutory floor is 6 months; declaring 12 is a
        // stricter (conservative, contractual lock-up) setting and must pass.
        // Paired regression with the case above (doc §7.4) — a common
        // over-implementation symmetrically forces "reporting => 6" as well,
        // which this test guards against.
        TransferRestrictionMetadata.RestrictionDecl memory decl = _validRestrictedDecl();
        decl.reportingStatus = TransferRestrictionMetadata.ReportingStatus.REPORTING_90D;
        decl.holdingPeriodMonths = 12;
        decl.currentInfoRequired = true;
        element.setDeclaration(asset, decl);

        (bool passed, bytes32 reasonCode) = element.check(address(0), address(0), asset, 0, "");
        assertTrue(passed);
        assertEq(reasonCode, bytes32(0));
    }

    function test_check_passes_onReportingWithSixMonths_naturalMatch() public {
        TransferRestrictionMetadata.RestrictionDecl memory decl = _validRestrictedDecl();
        decl.reportingStatus = TransferRestrictionMetadata.ReportingStatus.REPORTING_90D;
        decl.holdingPeriodMonths = 6;
        decl.currentInfoRequired = true;
        element.setDeclaration(asset, decl);

        (bool passed, bytes32 reasonCode) = element.check(address(0), address(0), asset, 0, "");
        assertTrue(passed);
        assertEq(reasonCode, bytes32(0));
    }

    // ---------------------------------------------------------------------
    // Test 4 continuation / gate ④b — REPORTING_90D + !currentInfoRequired fails
    // ---------------------------------------------------------------------

    function test_check_fails_tagConflict_onReportingWithoutCurrentInfo() public {
        TransferRestrictionMetadata.RestrictionDecl memory decl = _validRestrictedDecl();
        decl.reportingStatus = TransferRestrictionMetadata.ReportingStatus.REPORTING_90D;
        decl.holdingPeriodMonths = 6;
        decl.currentInfoRequired = false;
        element.setDeclaration(asset, decl);

        (bool passed, bytes32 reasonCode) = element.check(address(0), address(0), asset, 0, "");
        assertFalse(passed);
        assertEq(reasonCode, _reasonCode(5));
    }

    // ---------------------------------------------------------------------
    // gate ④b — NON_REPORTING + currentInfoRequired overclaim: hardening,
    // must still PASS (doc: routed to a non-blocking REVIEW queue; see the
    // contract-level @dev comment on why the ReviewQueued event itself cannot
    // be emitted from this `view` check).
    // ---------------------------------------------------------------------

    function test_check_passes_onNonReportingWithCurrentInfoOverclaim() public {
        TransferRestrictionMetadata.RestrictionDecl memory decl = _validRestrictedDecl();
        decl.reportingStatus = TransferRestrictionMetadata.ReportingStatus.NON_REPORTING;
        decl.holdingPeriodMonths = 12;
        decl.currentInfoRequired = true;
        element.setDeclaration(asset, decl);

        (bool passed, bytes32 reasonCode) = element.check(address(0), address(0), asset, 0, "");
        assertTrue(passed);
        assertEq(reasonCode, bytes32(0));
    }

    // ---------------------------------------------------------------------
    // Test 5 (doc §7.5) / gate ⑤ — unrestrict exit basis: presence AND
    // approved-chain membership both required.
    // ---------------------------------------------------------------------

    function test_check_fails_unrestrictBasisMissing_whenNoRefAndFrameworkAllowsIt() public {
        TransferRestrictionMetadata.RestrictionDecl memory decl = _validRestrictedDecl();
        decl.issuanceFramework = REG_A; // requiresRestricted[REG_A] == false, so ② allows flag=false through
        decl.restrictedFlag = false;
        decl.unrestrictBasisRef = bytes32(0);
        element.setDeclaration(asset, decl);

        (bool passed, bytes32 reasonCode) = element.check(address(0), address(0), asset, 0, "");
        assertFalse(passed);
        assertEq(reasonCode, _reasonCode(6));
    }

    function test_check_fails_unrestrictBasisMissing_whenRefPresentButNotApproved() public {
        // Presence-only check would wrongly pass this — the ref must also be
        // in the approved chain (doc §5.3 row ⑤ regression).
        TransferRestrictionMetadata.RestrictionDecl memory decl = _validRestrictedDecl();
        decl.issuanceFramework = REG_A;
        decl.restrictedFlag = false;
        decl.unrestrictBasisRef = BASIS_REF; // never approved
        element.setDeclaration(asset, decl);

        (bool passed, bytes32 reasonCode) = element.check(address(0), address(0), asset, 0, "");
        assertFalse(passed);
        assertEq(reasonCode, _reasonCode(6));
    }

    function test_check_passes_onUnrestrict_withApprovedBasis() public {
        element.setApprovedUnrestrictBasis(BASIS_REF, true);

        TransferRestrictionMetadata.RestrictionDecl memory decl = _validRestrictedDecl();
        decl.issuanceFramework = REG_A;
        decl.restrictedFlag = false;
        decl.unrestrictBasisRef = BASIS_REF;
        element.setDeclaration(asset, decl);

        (bool passed, bytes32 reasonCode) = element.check(address(0), address(0), asset, 0, "");
        assertTrue(passed);
        assertEq(reasonCode, bytes32(0));
    }
}
