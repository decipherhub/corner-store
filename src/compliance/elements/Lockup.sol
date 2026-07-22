// SPDX-License-Identifier: GPL-3.0
pragma solidity 0.8.17;

import {BaseElement} from "./BaseElement.sol";
import {IAcquisitionSource} from "../../interfaces/compliance/IAcquisitionSource.sol";
import {
    ElementMetadata,
    ElementCategory,
    TemporalNature,
    Decidability,
    ObligationTiming,
    Statefulness
} from "../../types/ComplianceTypes.sol";
import {ReasonCodes} from "../../libraries/ReasonCodes.sol";

/// @dev C-01-v1 Rule 144 lockup. Reads a conservative, expiring acquisition
///      snapshot from an injected provider-neutral source. Per-lot/PII data stays
///      off-chain and this contract fails closed on missing or broken lineage.
contract Lockup is BaseElement {
    bytes32 internal constant ELEMENT_ID = "C-01-v1";

    IAcquisitionSource public immutable acquisitionSource;
    uint64 public immutable lockupSeconds;

    constructor(address acquisitionSource_, uint64 lockupSeconds_)
        BaseElement(ElementMetadata({
                elementId: ELEMENT_ID,
                category: ElementCategory.RESALE_TRANSACTION,
                version: "C-01-v1",
                temporal: TemporalNature.PERIODIC,
                decidability: Decidability.DETERMINISTIC,
                timing: ObligationTiming.AT_TRADE_GATE,
                statefulness: Statefulness.STATELESS
            }))
    {
        acquisitionSource = IAcquisitionSource(acquisitionSource_);
        lockupSeconds = lockupSeconds_;
    }

    function check(address user, address, address asset, uint256, bytes calldata)
        external
        view
        override
        returns (bool passed, bytes32 reasonCode)
    {
        IAcquisitionSource.AcquisitionSnapshot memory snapshot = acquisitionSource.acquisitionOf(user, asset);
        if (snapshot.status == IAcquisitionSource.AcquisitionStatus.MISSING) {
            return (false, ReasonCodes.encode(0, ELEMENT_ID, 1));
        }
        if (snapshot.status == IAcquisitionSource.AcquisitionStatus.LINEAGE_BROKEN) {
            return (false, ReasonCodes.encode(0, ELEMENT_ID, 2));
        }
        if (snapshot.expiresAt == 0 || block.timestamp > snapshot.expiresAt) {
            return (false, ReasonCodes.encode(0, ELEMENT_ID, 3));
        }
        passed = snapshot.clockStart != 0 && block.timestamp >= uint256(snapshot.clockStart) + lockupSeconds;
        reasonCode = passed ? bytes32(0) : ReasonCodes.encode(0, ELEMENT_ID, 4);
    }
}
