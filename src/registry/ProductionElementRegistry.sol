// SPDX-License-Identifier: GPL-3.0
pragma solidity 0.8.17;

import {ElementRegistry} from "./ElementRegistry.sol";
import {EnforcementAction} from "../types/ComplianceTypes.sol";

/// @notice Production registry excludes reference-only public surveillance records.
contract ProductionElementRegistry is ElementRegistry {
    error ReferenceOnlyElement(bytes32 elementId);

    function _registerElement(
        bytes32 elementId,
        address element,
        EnforcementAction requestedDefaultAction,
        bool callerSpecifiedDefault
    ) internal override {
        if (elementId == bytes32("A-12-v2")) {
            revert ReferenceOnlyElement(elementId);
        }
        super._registerElement(elementId, element, requestedDefaultAction, callerSpecifiedDefault);
    }
}
