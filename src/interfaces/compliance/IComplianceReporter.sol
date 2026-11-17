// SPDX-License-Identifier: GPL-3.0
pragma solidity 0.8.17;

import {ComplianceContext} from "../../types/ComplianceTypes.sol";
import {ComplianceReport} from "../../types/ComplianceReportTypes.sol";

interface IComplianceReporter {
    /// @notice Public diagnostics only. Settlement must evaluate the Engine afresh.
    function report(ComplianceContext calldata ctx) external view returns (ComplianceReport memory);
}
