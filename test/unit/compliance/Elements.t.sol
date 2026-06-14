// SPDX-License-Identifier: GPL-3.0
pragma solidity 0.8.17;

import {Test} from "forge-std/Test.sol";
import {Sanctions} from "../../../src/compliance/elements/Sanctions.sol";
import {AccreditedInvestor} from "../../../src/compliance/elements/AccreditedInvestor.sol";
import {QualifiedPurchaser} from "../../../src/compliance/elements/QualifiedPurchaser.sol";
import {Lockup} from "../../../src/compliance/elements/Lockup.sol";
import {SurveillanceFlag} from "../../../src/compliance/elements/SurveillanceFlag.sol";
import {IAcquisitionSource} from "../../../src/interfaces/compliance/IAcquisitionSource.sol";
import {
    ElementMetadata,
    ElementCategory,
    TemporalNature,
    Decidability,
    ObligationTiming,
    Statefulness
} from "../../../src/types/ComplianceTypes.sol";
import {Events} from "../../../src/libraries/Events.sol";

contract MockAcquisitionSource is IAcquisitionSource {
    mapping(bytes32 => uint64) internal _at;

    function set(address holder, address asset, uint64 ts) external {
        _at[keccak256(abi.encode(holder, asset))] = ts;
    }

    function acquiredAt(address holder, address asset) external view returns (uint64) {
        return _at[keccak256(abi.encode(holder, asset))];
    }
}

contract ElementsTest is Test {
    address internal user = address(0xA11CE);
    address internal asset = address(0xBEEF);

    function test_sanctions_pass_and_fail_and_metadata() public {
        Sanctions s = new Sanctions();
        (bool passed, bytes32 rc) = s.check(user, address(0), asset, 0, "");
        assertTrue(passed);
        assertEq(rc, bytes32(0));

        s.setBlocked(user, true);
        (passed, rc) = s.check(user, address(0), asset, 0, "");
        assertFalse(passed);
        assertTrue(rc != bytes32(0));

        ElementMetadata memory m = s.elementMetadata();
        assertEq(m.elementId, bytes32("A-01-v1"));
        assertEq(uint256(m.category), uint256(ElementCategory.INVESTOR_ATTRIBUTE));
        assertEq(uint256(m.temporal), uint256(TemporalNature.REALTIME));
        assertEq(uint256(m.decidability), uint256(Decidability.DETERMINISTIC));
        assertEq(uint256(m.timing), uint256(ObligationTiming.AT_TRADE_GATE));
        assertEq(uint256(m.statefulness), uint256(Statefulness.STATELESS));
    }

    function test_accredited_pass_fail_metadata() public {
        AccreditedInvestor a = new AccreditedInvestor();
        (bool passed,) = a.check(user, address(0), asset, 0, "");
        assertFalse(passed); // default not accredited

        a.setAccredited(user, true);
        (passed,) = a.check(user, address(0), asset, 0, "");
        assertTrue(passed);

        ElementMetadata memory m = a.elementMetadata();
        assertEq(m.elementId, bytes32("A-03-v1"));
        assertEq(uint256(m.decidability), uint256(Decidability.ATTESTATION_BASED));
        assertEq(uint256(m.timing), uint256(ObligationTiming.EX_ANTE_VERIFY));
        assertEq(uint256(m.temporal), uint256(TemporalNature.ONE_TIME));
    }

    function test_qp_pass_fail_metadata() public {
        QualifiedPurchaser q = new QualifiedPurchaser();
        (bool passed,) = q.check(user, address(0), asset, 0, "");
        assertFalse(passed);

        q.setQp(user, true);
        (passed,) = q.check(user, address(0), asset, 0, "");
        assertTrue(passed);

        ElementMetadata memory m = q.elementMetadata();
        assertEq(m.elementId, bytes32("A-13-v1"));
        assertEq(uint256(m.decidability), uint256(Decidability.ATTESTATION_BASED));
    }

    function test_lockup_blocks_until_elapsed() public {
        MockAcquisitionSource src = new MockAcquisitionSource();
        uint64 lockupSeconds = 100;
        Lockup l = new Lockup(address(src), lockupSeconds);

        // Not acquired → blocked.
        (bool passed,) = l.check(user, address(0), asset, 0, "");
        assertFalse(passed);

        // Acquired now → still within lockup.
        vm.warp(1000);
        src.set(user, asset, 1000);
        (passed,) = l.check(user, address(0), asset, 0, "");
        assertFalse(passed);

        // After lockup elapses → passes.
        vm.warp(1000 + lockupSeconds);
        (passed,) = l.check(user, address(0), asset, 0, "");
        assertTrue(passed);

        ElementMetadata memory m = l.elementMetadata();
        assertEq(m.elementId, bytes32("C-01-v1"));
        assertEq(uint256(m.category), uint256(ElementCategory.RESALE_TRANSACTION));
        assertEq(uint256(m.temporal), uint256(TemporalNature.PERIODIC));
    }

    function test_surveillance_never_blocks_and_flags_over_threshold() public {
        SurveillanceFlag f = new SurveillanceFlag();
        f.setEngine(address(this)); // authorize this test as the onTransfer caller
        (bool passed, bytes32 rc) = f.check(user, address(0), asset, 0, "");
        assertTrue(passed);
        assertEq(rc, bytes32(0));

        // threshold default 0 → first onTransfer (count 1 > 0) emits.
        vm.expectEmit(true, true, false, true);
        emit Events.SurveillanceFlag(
            bytes32("F-02-v1"), user, keccak256(abi.encode(uint16(0), bytes32("F-02-v1"), uint32(1)))
        );
        f.onTransfer(user, address(0xB0B), 1);
        assertEq(f.transferCount(), 1);

        // check still passes after a transfer (flag-not-block).
        (passed,) = f.check(user, address(0), asset, 0, "");
        assertTrue(passed);

        ElementMetadata memory m = f.elementMetadata();
        assertEq(m.elementId, bytes32("F-02-v1"));
        assertEq(uint256(m.category), uint256(ElementCategory.CONDUCT_MONITORING));
        assertEq(uint256(m.decidability), uint256(Decidability.MONITORING_BASED));
        assertEq(uint256(m.timing), uint256(ObligationTiming.EX_POST_TRIGGER));
        assertEq(uint256(m.statefulness), uint256(Statefulness.STATEFUL));
    }

    function test_surveillance_does_not_flag_below_threshold() public {
        SurveillanceFlag f = new SurveillanceFlag();
        f.setEngine(address(this)); // authorize this test as the onTransfer caller
        f.setThreshold(2);
        // count 1 -> not > 2, count 2 -> not > 2. No emit expected (would fail recordLogs check otherwise).
        vm.recordLogs();
        f.onTransfer(user, address(0xB0B), 1);
        f.onTransfer(user, address(0xB0B), 1);
        assertEq(vm.getRecordedLogs().length, 0);
        // Third exceeds threshold.
        vm.expectEmit(true, true, false, true);
        emit Events.SurveillanceFlag(
            bytes32("F-02-v1"), user, keccak256(abi.encode(uint16(0), bytes32("F-02-v1"), uint32(1)))
        );
        f.onTransfer(user, address(0xB0B), 1);
    }
}
