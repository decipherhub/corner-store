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
    Statefulness,
    EvidenceType,
    EnforcementAction,
    ComplianceContext,
    FlowType
} from "../../types/ComplianceTypes.sol";
import {ReasonCodes} from "../../libraries/ReasonCodes.sol";
import {AssetFlow} from "../libraries/AssetFlow.sol";

/// @dev C-01-v2 Rule 144 lockup. Reads a conservative, expiring acquisition
///      snapshot from an injected provider-neutral source. Per-lot/PII data stays
///      off-chain and this contract fails closed on missing or broken lineage.
///      Unlike v1, the evidence subject is the actual RWA transfer source rather
///      than the screened investor unconditionally. A primary distribution may
///      bypass the resale holding period only when its actual RWA sender matches
///      the optional Manifest-owned primary distributor parameter; an untrusted
///      `flowType` marker alone never creates an exemption.
contract LockupV2 is BaseElement {
    bytes32 internal constant ELEMENT_ID = "C-01-v2";
    bytes32 public constant PARAMETER_SCHEMA_ID = keccak256("corner-store.element.lockup.primary-distributor.v1");

    IAcquisitionSource public immutable acquisitionSource;
    uint64 public immutable lockupSeconds;

    constructor(address acquisitionSource_, uint64 lockupSeconds_)
        BaseElement(ElementMetadata({
                elementId: ELEMENT_ID,
                category: ElementCategory.RESALE_TRANSACTION,
                version: "C-01-v2",
                temporal: TemporalNature.PERIODIC,
                decidability: Decidability.DETERMINISTIC,
                timing: ObligationTiming.AT_TRADE_GATE,
                statefulness: Statefulness.STATELESS,
                evidenceType: EvidenceType.PROVIDER_ATTESTATION,
                defaultEnforcement: EnforcementAction.BLOCK,
                parameterSchemaId: PARAMETER_SCHEMA_ID,
                parameterSchemaVersion: 1,
                maxParameterBytes: 32,
                parametersRequired: false
            }))
    {
        acquisitionSource = IAcquisitionSource(acquisitionSource_);
        lockupSeconds = lockupSeconds_;
    }

    function _check(address, address, address asset, uint256, bytes calldata context, bytes calldata parameters)
        internal
        view
        override
        returns (bool passed, bytes32 reasonCode)
    {
        (bool validParameters, address primaryDistributor) = _primaryDistributor(parameters);
        if (!validParameters) return (false, ReasonCodes.invalidElementParameters(ELEMENT_ID));

        ComplianceContext memory ctx = abi.decode(context, (ComplianceContext));
        (address from,) = AssetFlow.resolve(asset, context);
        if (
            ctx.flowType == FlowType.PRIMARY_DISTRIBUTION && asset == ctx.tokenOut && primaryDistributor != address(0)
                && from == primaryDistributor
        ) return (true, bytes32(0));

        IAcquisitionSource.AcquisitionSnapshot memory snapshot = acquisitionSource.acquisitionOf(from, asset);
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

    function _primaryDistributor(bytes calldata parameters) private pure returns (bool valid, address distributor) {
        if (parameters.length == 0) return (true, address(0));
        if (parameters.length != 32) return (false, address(0));

        uint256 word;
        assembly {
            word := calldataload(parameters.offset)
        }
        if (word == 0 || word > type(uint160).max) return (false, address(0));
        return (true, address(uint160(word)));
    }
}
