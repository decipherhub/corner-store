// SPDX-License-Identifier: GPL-3.0
pragma solidity 0.8.17;

import {ElementMetadata} from "../../types/ComplianceTypes.sol";

interface IComplianceElement {
    function check(address user, address counterparty, address asset, uint256 amount, bytes calldata context)
        external
        view
        returns (bool passed, bytes32 reasonCode);

    function elementMetadata() external view returns (ElementMetadata memory);
}

interface IStatefulElement is IComplianceElement {
    function onTransfer(address from, address to, uint256 amount) external;
}
