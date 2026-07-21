// SPDX-License-Identifier: GPL-3.0
pragma solidity 0.8.17;

import {Test} from "forge-std/Test.sol";
import {AssetClassification} from "../../../../src/compliance/elements/AssetClassification.sol";
import {Errors} from "../../../../src/libraries/Errors.sol";
import {ElementMetadata, ElementCategory, Decidability, Statefulness} from "../../../../src/types/ComplianceTypes.sol";

contract AssetClassificationTest is Test {
    // Re-declared to match AssetClassification.ClassificationSet for vm.expectEmit
    // (Solidity 0.8.17 cannot reference a non-library contract's event by
    // qualified name in an `emit` statement; that requires >=0.8.22).
    event ClassificationSet(address indexed asset, bytes32 classification);

    event CardSet(
        address indexed asset,
        AssetClassification.CardStatus status,
        bytes32 classification,
        uint32 coreVersion,
        uint32 approvedVersion,
        uint64 approvedAt,
        uint64 factsAsOf,
        uint64 maxFactAge
    );

    event ActivationDelaySet(uint64 delay);

    bytes32 internal constant REG_D = bytes32("REG_D");
    bytes32 internal constant REG_A = bytes32("REG_A");

    address internal asset = address(0xBEEF);
    address internal otherAsset = address(0xCAFE);
    address internal operator = address(0x0733);
    address internal stranger = address(0xBAD);

    AssetClassification internal element;

    function setUp() public {
        element = new AssetClassification(REG_D);
    }

    function test_constructor_setsRequiredClassification() public {
        assertEq(element.requiredClassification(), REG_D);
    }

    function test_constructor_revertsOnZeroRequiredClassification() public {
        vm.expectRevert(AssetClassification.ZeroRequiredClassification.selector);
        new AssetClassification(bytes32(0));
    }

    function test_metadata_fields() public {
        ElementMetadata memory m = element.elementMetadata();
        assertEq(m.elementId, bytes32("B-01-v1"));
        assertEq(uint256(m.category), uint256(ElementCategory.ASSET_ATTRIBUTE));
        assertEq(uint256(m.decidability), uint256(Decidability.DETERMINISTIC));
        assertEq(uint256(m.statefulness), uint256(Statefulness.STATELESS));
    }

    function test_setClassification_revertsForNonOperator() public {
        vm.prank(stranger);
        vm.expectRevert(Errors.NotAuthorized.selector);
        element.setClassification(asset, REG_D);
    }

    function test_setClassification_ownerCanSet_andEmitsEvent_andUpdatesStorage() public {
        vm.expectEmit(true, false, false, true);
        emit ClassificationSet(asset, REG_D);
        element.setClassification(asset, REG_D);

        assertEq(element.classificationOf(asset), REG_D);
    }

    function test_setClassification_operatorCanSet() public {
        element.setOperator(operator, true);

        vm.prank(operator);
        element.setClassification(asset, REG_D);

        assertEq(element.classificationOf(asset), REG_D);
    }

    function test_check_passesWhenAssetHasRequiredClassification() public {
        element.setClassification(asset, REG_D);

        (bool passed, bytes32 reasonCode) = element.check(address(0xA11CE), address(0), asset, 0, "");
        assertTrue(passed);
        assertEq(reasonCode, bytes32(0));
    }

    function test_check_failsWhenAssetUnclassified() public {
        // Default classification for any never-set asset is bytes32(0), which
        // must fail because requiredClassification (REG_D) is non-zero.
        (bool passed, bytes32 reasonCode) = element.check(address(0xA11CE), address(0), otherAsset, 0, "");
        assertFalse(passed);
        assertTrue(reasonCode != bytes32(0));
    }

    function test_check_failsWhenAssetHasWrongClassification() public {
        element.setClassification(asset, REG_A);

        (bool passed, bytes32 reasonCode) = element.check(address(0xA11CE), address(0), asset, 0, "");
        assertFalse(passed);
        assertTrue(reasonCode != bytes32(0));
    }

    function test_check_ignoresUserParameter() public {
        element.setClassification(asset, REG_D);

        (bool passed1,) = element.check(address(0xA11CE), address(0), asset, 0, "");
        (bool passed2,) = element.check(address(0xB0B), address(0xDEAD), asset, 12345, "");
        assertTrue(passed1);
        assertTrue(passed2);
        assertEq(passed1, passed2);

        // Same holds on the fail path (unclassified asset), regardless of user.
        (bool failed1,) = element.check(address(0x1111), address(0), otherAsset, 0, "");
        (bool failed2,) = element.check(address(0x2222), address(0x3333), otherAsset, 999, "");
        assertFalse(failed1);
        assertFalse(failed2);
        assertEq(failed1, failed2);
    }

    // --- manifest-integrity card upgrade (doc §5.2–§5.4, §6.1) --------------

    // Mirror of ReasonCodes.encode(0, "B-01-v1", n) for pinning exact codes.
    function _code(uint32 n) internal pure returns (bytes32) {
        return keccak256(abi.encode(uint16(0), bytes32("B-01-v1"), n));
    }

    // A fully-live card with the given classification (the shape setClassification writes).
    function _liveCard(bytes32 cls) internal view returns (AssetClassification.AssetCard memory) {
        return AssetClassification.AssetCard({
            status: AssetClassification.CardStatus.ACTIVE,
            classification: cls,
            coreVersion: 1,
            approvedVersion: 1,
            approvedAt: uint64(block.timestamp),
            factsAsOf: uint64(block.timestamp),
            maxFactAge: 0
        });
    }

    function test_setClassification_writesFullyLiveCard() public {
        element.setClassification(asset, REG_D);

        (
            AssetClassification.CardStatus status,
            bytes32 cls,
            uint32 coreVersion,
            uint32 approvedVersion,
            uint64 approvedAt,
            uint64 factsAsOf,
            uint64 maxFactAge
        ) = element.cardOf(asset);
        assertEq(uint256(status), uint256(AssetClassification.CardStatus.ACTIVE));
        assertEq(cls, REG_D);
        assertEq(coreVersion, 1);
        assertEq(approvedVersion, 1);
        assertEq(approvedAt, uint64(block.timestamp));
        assertEq(factsAsOf, uint64(block.timestamp));
        assertEq(maxFactAge, 0);

        // classificationOf view still reflects the card's classification field.
        assertEq(element.classificationOf(asset), REG_D);

        (bool passed, bytes32 reasonCode) = element.check(address(0xA11CE), address(0), asset, 0, "");
        assertTrue(passed);
        assertEq(reasonCode, bytes32(0));
    }

    // Code 1 — unattested asset (status NONE). Legacy "missing/unclassified"
    // meaning preserved.
    function test_check_missingCard_returnsCode1() public {
        (bool passed, bytes32 reasonCode) = element.check(address(0xA11CE), address(0), otherAsset, 0, "");
        assertFalse(passed);
        assertEq(reasonCode, _code(1));
    }

    // Code 2 — SUSPENDED (watcher hash mismatch / emergency halt converge here).
    function test_check_suspended_returnsCode2() public {
        AssetClassification.AssetCard memory card = _liveCard(REG_D);
        card.status = AssetClassification.CardStatus.SUSPENDED;
        element.setCard(asset, card);

        (bool passed, bytes32 reasonCode) = element.check(address(0xA11CE), address(0), asset, 0, "");
        assertFalse(passed);
        assertEq(reasonCode, _code(2));
    }

    // Code 3 — coreVersion outside the approved set (governance-bypass signal).
    function test_check_versionUnapproved_returnsCode3() public {
        AssetClassification.AssetCard memory card = _liveCard(REG_D);
        card.coreVersion = 4; // references v4 while only v1 is approved
        element.setCard(asset, card);

        (bool passed, bytes32 reasonCode) = element.check(address(0xA11CE), address(0), asset, 0, "");
        assertFalse(passed);
        assertEq(reasonCode, _code(3));
    }

    // Code 5 — INV-C: attested but classification != requiredClassification.
    // This is the previously-code-1 "attested wrong class" case (doc §5.2 ④).
    function test_check_wrongClassification_returnsCode5() public {
        element.setClassification(asset, REG_A);

        (bool passed, bytes32 reasonCode) = element.check(address(0xA11CE), address(0), asset, 0, "");
        assertFalse(passed);
        assertEq(reasonCode, _code(5));
    }

    // Code 4 — time-lock pending. Boundary is INCLUSIVE: exactly at
    // approvedAt + delay PASSes; one second before fails.
    function test_check_timeLock_boundaryIsInclusive() public {
        uint64 delay = 1000;
        element.setActivationDelay(delay);

        AssetClassification.AssetCard memory card = _liveCard(REG_D);
        // Anchor approvedAt at a known timestamp.
        vm.warp(10_000);
        card.approvedAt = uint64(block.timestamp);
        card.factsAsOf = uint64(block.timestamp);
        element.setCard(asset, card);

        // One second before the boundary => FAIL_VERSION_PENDING (code 4).
        vm.warp(uint256(card.approvedAt) + delay - 1);
        (bool passedBefore, bytes32 codeBefore) = element.check(address(0xA11CE), address(0), asset, 0, "");
        assertFalse(passedBefore);
        assertEq(codeBefore, _code(4));

        // Exactly AT the boundary => effective (PASS). now >= approvedAt + delay.
        vm.warp(uint256(card.approvedAt) + delay);
        (bool passedAt, bytes32 codeAt) = element.check(address(0xA11CE), address(0), asset, 0, "");
        assertTrue(passedAt);
        assertEq(codeAt, bytes32(0));
    }

    // Code 6 — freshness. Boundary is STRICT `>`: exactly at maxFactAge PASSes;
    // one second past fails. Opposite direction to the time-lock (doc §5.3).
    function test_check_freshness_boundaryIsStrict() public {
        uint64 maxAge = 500;

        AssetClassification.AssetCard memory card = _liveCard(REG_D);
        vm.warp(10_000);
        card.approvedAt = uint64(block.timestamp);
        card.factsAsOf = uint64(block.timestamp);
        card.maxFactAge = maxAge;
        element.setCard(asset, card);

        // now - factsAsOf == maxAge exactly => still fresh (PASS).
        vm.warp(uint256(card.factsAsOf) + maxAge);
        (bool passedAt, bytes32 codeAt) = element.check(address(0xA11CE), address(0), asset, 0, "");
        assertTrue(passedAt);
        assertEq(codeAt, bytes32(0));

        // now - factsAsOf == maxAge + 1 => stale (code 6).
        vm.warp(uint256(card.factsAsOf) + maxAge + 1);
        (bool passedPast, bytes32 codePast) = element.check(address(0xA11CE), address(0), asset, 0, "");
        assertFalse(passedPast);
        assertEq(codePast, _code(6));
    }

    // maxFactAge 0 disables the freshness check entirely (legacy default).
    function test_check_freshnessDisabledWhenMaxFactAgeZero() public {
        element.setClassification(asset, REG_D); // maxFactAge 0
        vm.warp(block.timestamp + 3650 days);

        (bool passed, bytes32 reasonCode) = element.check(address(0xA11CE), address(0), asset, 0, "");
        assertTrue(passed);
        assertEq(reasonCode, bytes32(0));
    }

    // A future factsAsOf anchor must not underflow the age subtraction and
    // panic — age is treated as 0 (fresh), so `check` PASSes even with a
    // nonzero maxFactAge (mirrors QualifiedPurchaser's freshness guard).
    function test_check_futureFactsAsOf_passesWithoutRevert() public {
        vm.warp(10_000);
        AssetClassification.AssetCard memory card = _liveCard(REG_D);
        card.factsAsOf = uint64(block.timestamp + 4000); // anchor in the future
        card.maxFactAge = 500;
        element.setCard(asset, card);

        (bool passed, bytes32 reasonCode) = element.check(address(0xA11CE), address(0), asset, 0, "");
        assertTrue(passed);
        assertEq(reasonCode, bytes32(0));
    }

    // Evaluation order: SUSPENDED (2) is reported before a version mismatch (3)
    // when both are wrong — confirms status precedes version in the pipeline.
    function test_check_evaluationOrder_statusBeforeVersion() public {
        AssetClassification.AssetCard memory card = _liveCard(REG_D);
        card.status = AssetClassification.CardStatus.SUSPENDED;
        card.coreVersion = 9; // also version-mismatched
        element.setCard(asset, card);

        (, bytes32 reasonCode) = element.check(address(0xA11CE), address(0), asset, 0, "");
        assertEq(reasonCode, _code(2));
    }

    function test_setCard_revertsForNonOperator() public {
        vm.prank(stranger);
        vm.expectRevert(Errors.NotAuthorized.selector);
        element.setCard(asset, _liveCard(REG_D));
    }

    function test_setCard_emitsEvent_andStores() public {
        AssetClassification.AssetCard memory card = _liveCard(REG_D);
        card.coreVersion = 2;
        card.approvedVersion = 2;
        card.maxFactAge = 7;

        vm.expectEmit(true, false, false, true);
        emit CardSet(
            asset,
            AssetClassification.CardStatus.ACTIVE,
            REG_D,
            card.coreVersion,
            card.approvedVersion,
            card.approvedAt,
            card.factsAsOf,
            card.maxFactAge
        );
        element.setCard(asset, card);

        (,, uint32 coreVersion, uint32 approvedVersion,,, uint64 maxFactAge) = element.cardOf(asset);
        assertEq(coreVersion, 2);
        assertEq(approvedVersion, 2);
        assertEq(maxFactAge, 7);
    }

    function test_setActivationDelay_revertsForNonOperator() public {
        vm.prank(stranger);
        vm.expectRevert(Errors.NotAuthorized.selector);
        element.setActivationDelay(1000);
    }

    function test_setActivationDelay_emitsEvent_andStores() public {
        vm.expectEmit(false, false, false, true);
        emit ActivationDelaySet(1234);
        element.setActivationDelay(1234);
        assertEq(element.activationDelay(), 1234);
    }

    function test_activationDelay_defaultsToZero() public {
        assertEq(element.activationDelay(), 0);
    }
}
