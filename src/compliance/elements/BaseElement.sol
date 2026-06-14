// SPDX-License-Identifier: GPL-3.0
pragma solidity 0.8.17;

import {IComplianceElement} from "../../interfaces/compliance/IComplianceElement.sol";
import {ElementMetadata} from "../../types/ComplianceTypes.sol";

/// @dev Stores immutable-ish ElementMetadata set at construction and exposes it.
///      Concrete elements implement the mock `check` legal judgment.
abstract contract BaseElement is IComplianceElement {
    ElementMetadata internal _meta;

    constructor(ElementMetadata memory meta) {
        _meta = meta;
    }

    function elementMetadata() external view override returns (ElementMetadata memory) {
        return _meta;
    }

    function check(address user, address counterparty, address asset, uint256 amount, bytes calldata context)
        external
        view
        virtual
        override
        returns (bool passed, bytes32 reasonCode);
}
