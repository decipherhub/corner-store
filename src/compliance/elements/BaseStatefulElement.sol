// SPDX-License-Identifier: GPL-3.0
pragma solidity 0.8.17;

import {BaseElement} from "./BaseElement.sol";
import {IStatefulElement} from "../../interfaces/compliance/IComplianceElement.sol";
import {ElementMetadata} from "../../types/ComplianceTypes.sol";
import {Errors} from "../../libraries/Errors.sol";

/// @dev BaseElement + the stateful post-trade hook. Default onTransfer is a no-op;
///      stateful elements override it to update counters / emit monitoring events.
///
///      Write-path auth (spec §6): onTransfer is the only state-mutating entry,
///      so it is gated to the compliance engine. The deployer is recorded as
///      owner at construction and wires the engine once via setEngine; thereafter
///      only the engine may drive onTransfer. This prevents an EOA/operator from
///      forging runtime counters directly on the element.
abstract contract BaseStatefulElement is BaseElement, IStatefulElement {
    address public owner;
    address public engine;

    modifier onlyEngine() {
        if (msg.sender != engine) revert Errors.NotAuthorized();
        _;
    }

    constructor(ElementMetadata memory meta) BaseElement(meta) {
        owner = msg.sender;
    }

    /// @dev One-time/owner-gated engine wiring. The engine drives onTransfer
    ///      from its commit hook, so the element must accept it as caller.
    function setEngine(address engine_) external {
        if (msg.sender != owner) revert Errors.NotAuthorized();
        engine = engine_;
    }

    function onTransfer(address from, address to, uint256 amount) external virtual override onlyEngine {}
}
