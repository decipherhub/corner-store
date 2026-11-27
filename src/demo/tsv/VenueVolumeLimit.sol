// SPDX-License-Identifier: GPL-3.0
pragma solidity 0.8.17;

import {BaseStatefulElement} from "../../compliance/elements/BaseStatefulElement.sol";
import {
    ElementMetadata,
    ElementCategory,
    TemporalNature,
    Decidability,
    ObligationTiming,
    Statefulness,
    EvidenceType,
    EnforcementAction
} from "../../types/ComplianceTypes.sol";
import {PredicateValidation} from "../../libraries/PredicateValidation.sol";
import {ReasonCodes} from "../../libraries/ReasonCodes.sol";

/// @title VenueVolumeLimit (TSV-VOL-v1, demo)
/// @notice Illustrative per-stock volume gate for the TSV-style reference rule
///         set. Trades accumulate per period; a trade that would take the
///         period total past the Manifest-owned limit is blocked.
/// @dev Demo/illustrative only, and a deliberate simplification:
///        - the limit is one number of shares per fixed 1-day period, supplied
///          as a Manifest parameter by the venue operator. How that number is
///          derived from the underlying stock's reported volume, which tier the
///          stock is in, how affiliated venues aggregate, and where a trading
///          day begins are operator inputs that this element does not compute;
///        - consequences of exceeding a limit (warning, suspension of the
///          stock) and the stock-count limit are not modelled.
///      IStatefulElement.onTransfer carries no asset, so ONE instance tracks ONE
///      stock (same deployment scope as HolderCount). Only the engine can write
///      the counter (BaseStatefulElement.onlyEngine).
///
///      reasonCode table (n in ReasonCodes.encode(0, ELEMENT_ID, n)):
///        1  VOLUME_LIMIT_REACHED   period volume + this trade > limit
contract VenueVolumeLimit is BaseStatefulElement {
    bytes32 public constant ELEMENT_ID = "TSV-VOL-v1";
    bytes32 public constant PARAMETER_SCHEMA_ID = keccak256("corner-store.demo.tsv-style.volume-limit.v1");
    uint256 public constant PERIOD_SECONDS = 1 days;

    /// @notice period index (block.timestamp / PERIOD_SECONDS) => shares traded.
    mapping(uint256 => uint256) public volumeOfPeriod;

    event VolumeRecorded(uint256 indexed period, uint256 amount, uint256 periodVolume);

    constructor()
        BaseStatefulElement(ElementMetadata({
                elementId: ELEMENT_ID,
                category: ElementCategory.SYSTEM_STATE,
                version: "TSV-VOL-v1",
                temporal: TemporalNature.CUMULATIVE,
                decidability: Decidability.DETERMINISTIC,
                timing: ObligationTiming.AT_TRADE_GATE,
                statefulness: Statefulness.STATEFUL,
                evidenceType: EvidenceType.ONCHAIN_STATE,
                defaultEnforcement: EnforcementAction.BLOCK,
                parameterSchemaId: PARAMETER_SCHEMA_ID,
                parameterSchemaVersion: 1,
                maxParameterBytes: 32,
                parametersRequired: true
            }))
    {}

    function currentPeriod() public view returns (uint256) {
        return block.timestamp / PERIOD_SECONDS;
    }

    function currentPeriodVolume() external view returns (uint256) {
        return volumeOfPeriod[currentPeriod()];
    }

    function _check(address, address, address, uint256 amount, bytes calldata, bytes calldata parameters)
        internal
        view
        override
        returns (bool passed, bytes32 reasonCode)
    {
        (bool valid, uint256 limit) = PredicateValidation.boundedUint(parameters, 1, type(uint256).max);
        if (!valid) return (false, ReasonCodes.invalidElementParameters(ELEMENT_ID));
        uint256 used = volumeOfPeriod[currentPeriod()];
        // Overflow-safe form of `used + amount <= limit`.
        passed = used <= limit && amount <= limit - used;
        reasonCode = passed ? bytes32(0) : ReasonCodes.encode(0, ELEMENT_ID, 1);
    }

    function onTransfer(address, address, uint256 amount) external override onlyEngine {
        uint256 period = currentPeriod();
        uint256 total = volumeOfPeriod[period] + amount;
        volumeOfPeriod[period] = total;
        emit VolumeRecorded(period, amount, total);
    }
}
