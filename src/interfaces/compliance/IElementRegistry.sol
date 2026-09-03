// SPDX-License-Identifier: GPL-3.0
pragma solidity 0.8.17;

import {ElementMetadata, EnforcementAction} from "../../types/ComplianceTypes.sol";

interface IElementRegistry {
    function registerElement(bytes32 elementId, address element) external;

    function registerElement(bytes32 elementId, address element, EnforcementAction defaultAction) external;

    function elementOf(bytes32 elementId) external view returns (address);

    function metadataOf(bytes32 elementId) external view returns (ElementMetadata memory);

    function metadataHashOf(bytes32 elementId) external view returns (bytes32);

    function versionHashOf(bytes32 elementId) external view returns (bytes32);

    function defaultActionOf(bytes32 elementId) external view returns (EnforcementAction);
}
