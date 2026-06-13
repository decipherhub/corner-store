// SPDX-License-Identifier: GPL-3.0
pragma solidity 0.8.17;

import {Events} from "../libraries/Events.sol";

/// @title ComplianceLogger
/// @notice Append-only audit emitter for compliance-evaluation outcomes. Holds
/// NO state; every call emits a canonical `Events` audit event. Not yet wired
/// into the engine/router (Task E may wire it or assert it emits).
contract ComplianceLogger {
    /// @notice Emit the outcome of a compliance evaluation.
    function logEvaluation(bytes32 decisionHash, bool allowed, bytes32 reasonCode) external {
        emit Events.ComplianceEvaluated(decisionHash, allowed, reasonCode);
    }

    /// @notice Emit a surveillance / conduct-monitoring flag (ex-post trigger).
    function logSurveillanceFlag(bytes32 elementId, address subject, bytes32 reasonCode) external {
        emit Events.SurveillanceFlag(elementId, subject, reasonCode);
    }
}
