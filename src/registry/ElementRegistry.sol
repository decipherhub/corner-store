// SPDX-License-Identifier: GPL-3.0
pragma solidity 0.8.17;

import {Governed} from "../auth/Governed.sol";
import {IElementRegistry} from "../interfaces/compliance/IElementRegistry.sol";
import {IComplianceElement} from "../interfaces/compliance/IComplianceElement.sol";
import {ElementMetadata} from "../types/ComplianceTypes.sol";
import {Errors} from "../libraries/Errors.sol";
import {Events} from "../libraries/Events.sol";

contract ElementRegistry is IElementRegistry, Governed {
    mapping(bytes32 => address) internal _elements;

    function registerElement(bytes32 elementId, address element) external onlyOwner {
        _elements[elementId] = element;
        emit Events.ElementRegistered(elementId, element);
    }

    function elementOf(bytes32 elementId) external view returns (address) {
        return _elements[elementId];
    }

    function metadataOf(bytes32 elementId) external view returns (ElementMetadata memory) {
        address element = _elements[elementId];
        if (element == address(0)) revert Errors.ElementNotRegistered(elementId);
        return IComplianceElement(element).elementMetadata();
    }
}
