// SPDX-License-Identifier: GPL-3.0
pragma solidity 0.8.17;

import {BaseElement} from "./BaseElement.sol";
import {IStatefulElement} from "../../interfaces/compliance/IComplianceElement.sol";
import {ElementMetadata} from "../../types/ComplianceTypes.sol";

/// @dev BaseElement + the stateful post-trade hook. Default onTransfer is a no-op;
///      stateful elements override it to update counters / emit monitoring events.
abstract contract BaseStatefulElement is BaseElement, IStatefulElement {
    constructor(ElementMetadata memory meta) BaseElement(meta) {}

    function onTransfer(address from, address to, uint256 amount) external virtual override {}
}
