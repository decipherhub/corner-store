// SPDX-License-Identifier: GPL-3.0
pragma solidity 0.8.17;

import {ComplianceContext, ComplianceDecision} from "../../types/ComplianceTypes.sol";

interface IComplianceEngine {
    function evaluate(ComplianceContext calldata ctx) external view returns (ComplianceDecision memory);

    function policyHashesOf(address token)
        external
        view
        returns (bytes32 logicalPolicyHash, bytes32 executionBindingHash, bytes32 policyId);

    function commit(ComplianceContext calldata ctx) external;
}
