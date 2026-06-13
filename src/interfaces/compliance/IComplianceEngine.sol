// SPDX-License-Identifier: GPL-3.0
pragma solidity 0.8.17;

import {ComplianceContext, ComplianceDecision} from "../../types/ComplianceTypes.sol";

interface IComplianceEngine {
    function evaluate(ComplianceContext calldata ctx) external view returns (ComplianceDecision memory);

    function commit(ComplianceContext calldata ctx) external;
}
