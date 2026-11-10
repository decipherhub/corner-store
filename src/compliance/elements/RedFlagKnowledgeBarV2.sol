// SPDX-License-Identifier: GPL-3.0
pragma solidity 0.8.17;

import {BaseElement} from "./BaseElement.sol";
import {Governed} from "../../auth/Governed.sol";
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
import {ReasonCodes} from "../../libraries/ReasonCodes.sol";
import {Events} from "../../libraries/Events.sol";

/// @dev Opt-in, nonblocking A-12 reference element. Operator assessments are read separately.
contract RedFlagKnowledgeBarV2 is BaseElement, Governed {
    bytes32 internal constant ELEMENT_ID = "A-12-v2";

    uint32 internal constant REVIEW_UNCERTAIN_CODE = 8;

    enum Axis {
        RESALE,
        MARKET_CONDUCT
    }

    enum RedFlag {
        RESALE_INTENT,
        CONTROL_UNDISCLOSED,
        AI_INCONSISTENT,
        WASH_CLUSTER,
        STRUCTURING,
        PRICE_ANOMALY,
        SUSPICIOUS_PATTERN
    }

    enum Resolution {
        PENDING,
        CLEARED_FALSE_POSITIVE,
        RISK_CONFIRMED,
        BOUNDARY_ESCALATED
    }

    enum Disposition {
        CLEAR,
        FLAG,
        REVIEW
    }

    struct Assessment {
        uint8 flagMask;
        bool uncertain;
        Resolution resolution;
    }

    mapping(address => mapping(address => Assessment)) internal _assessment;

    event ReviewResolved(address indexed seller, address indexed buyer, Resolution resolution);

    constructor()
        BaseElement(ElementMetadata({
                elementId: ELEMENT_ID,
                category: ElementCategory.CONDUCT_MONITORING,
                version: "A-12-v2",
                temporal: TemporalNature.REALTIME,
                decidability: Decidability.MONITORING_BASED,
                timing: ObligationTiming.AT_TRADE_GATE,
                statefulness: Statefulness.STATELESS,
                evidenceType: EvidenceType.ONCHAIN_STATE,
                defaultEnforcement: EnforcementAction.FLAG_ONLY,
                parameterSchemaId: bytes32(0),
                parameterSchemaVersion: 0,
                maxParameterBytes: 0,
                parametersRequired: false
            }))
    {}

    function raiseFlag(address seller, address buyer, RedFlag flag) external onlyOperator {
        Assessment storage a = _assessment[seller][buyer];
        a.flagMask |= uint8(1) << uint8(flag);
        a.resolution = Resolution.PENDING;
        emit Events.SurveillanceFlag(ELEMENT_ID, seller, _code(uint32(flag) + 1));
    }

    function markUncertain(address seller, address buyer) external onlyOperator {
        Assessment storage a = _assessment[seller][buyer];
        a.uncertain = true;
        a.resolution = Resolution.PENDING;
        emit Events.SurveillanceFlag(ELEMENT_ID, seller, _code(REVIEW_UNCERTAIN_CODE));
    }

    function resolveReview(address seller, address buyer, Resolution resolution) external onlyOperator {
        _assessment[seller][buyer].resolution = resolution;
        emit ReviewResolved(seller, buyer, resolution);
    }

    function _check(address, address, address, uint256, bytes calldata, bytes calldata)
        internal
        pure
        override
        returns (bool passed, bytes32 reasonCode)
    {
        return (true, bytes32(0));
    }

    function screen(address seller, address buyer) public view returns (Disposition disposition, uint8 flagMask) {
        Assessment storage a = _assessment[seller][buyer];
        flagMask = a.flagMask;
        if (a.resolution == Resolution.CLEARED_FALSE_POSITIVE) {
            return (Disposition.CLEAR, flagMask);
        }
        if (a.uncertain) {
            return (Disposition.REVIEW, flagMask);
        }
        if (flagMask != 0) {
            return (Disposition.FLAG, flagMask);
        }
        return (Disposition.CLEAR, flagMask);
    }

    function dispositionOf(address seller, address buyer) external view returns (Disposition disposition) {
        (disposition,) = screen(seller, buyer);
    }

    function routesToReview(address seller, address buyer) external view returns (bool) {
        (Disposition disposition,) = screen(seller, buyer);
        return disposition != Disposition.CLEAR;
    }

    function assessmentOf(address seller, address buyer)
        external
        view
        returns (uint8 flagMask, bool uncertain, Resolution resolution)
    {
        Assessment storage a = _assessment[seller][buyer];
        return (a.flagMask, a.uncertain, a.resolution);
    }

    function reasonCodeFor(RedFlag flag) external pure returns (bytes32) {
        return _code(uint32(flag) + 1);
    }

    function reviewUncertainCode() external pure returns (bytes32) {
        return _code(REVIEW_UNCERTAIN_CODE);
    }

    function axisOf(RedFlag flag) external pure returns (Axis) {
        return uint8(flag) <= uint8(RedFlag.AI_INCONSISTENT) ? Axis.RESALE : Axis.MARKET_CONDUCT;
    }

    function _code(uint32 n) private pure returns (bytes32) {
        return ReasonCodes.encode(0, ELEMENT_ID, n);
    }
}
