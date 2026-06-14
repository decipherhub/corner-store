// SPDX-License-Identifier: GPL-3.0
pragma solidity 0.8.17;

import {IComplianceEngine} from "../../src/interfaces/compliance/IComplianceEngine.sol";
import {ComplianceContext, ComplianceDecision} from "../../src/types/ComplianceTypes.sol";

/// @notice Test double. `evaluate` returns a settable decision; `commit` records the call.
contract MockComplianceEngine is IComplianceEngine {
    ComplianceDecision internal _decision;
    bool public committed;
    uint256 public commitCount;
    ComplianceContext internal _lastCommit;

    function setDecision(ComplianceDecision calldata d) external {
        _decision = d;
    }

    function evaluate(ComplianceContext calldata) external view returns (ComplianceDecision memory) {
        return _decision;
    }

    function commit(ComplianceContext calldata ctx) external {
        committed = true;
        commitCount++;
        _lastCommit = ctx;
    }

    function lastCommit() external view returns (ComplianceContext memory) {
        return _lastCommit;
    }
}
