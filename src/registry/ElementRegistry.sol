// SPDX-License-Identifier: GPL-3.0
pragma solidity 0.8.17;

import {Governed} from "../auth/Governed.sol";
import {IElementRegistry} from "../interfaces/compliance/IElementRegistry.sol";
import {IComplianceElement} from "../interfaces/compliance/IComplianceElement.sol";
import {ElementMetadata, EnforcementAction} from "../types/ComplianceTypes.sol";
import {Errors} from "../libraries/Errors.sol";
import {Events} from "../libraries/Events.sol";

contract ElementRegistry is IElementRegistry, Governed {
    mapping(bytes32 => address) internal _elements;
    mapping(bytes32 => bytes32) internal _metadataHashes;
    mapping(bytes32 => bytes32) internal _versionHashes;
    mapping(bytes32 => EnforcementAction) internal _defaultActions;

    function registerElement(bytes32 elementId, address element) external onlyOwner {
        _registerElement(elementId, element, EnforcementAction.BLOCK);
    }

    function registerElement(bytes32 elementId, address element, EnforcementAction defaultAction) external onlyOwner {
        _registerElement(elementId, element, defaultAction);
    }

    function _registerElement(bytes32 elementId, address element, EnforcementAction defaultAction) internal {
        if (elementId == bytes32(0) || element == address(0) || element.code.length == 0) {
            revert Errors.InvalidElementMetadata(elementId);
        }
        if (_elements[elementId] != address(0)) revert Errors.ElementAlreadyRegistered(elementId);

        ElementMetadata memory metadata = IComplianceElement(element).elementMetadata();
        if (metadata.elementId != elementId || bytes(metadata.version).length == 0) {
            revert Errors.InvalidElementMetadata(elementId);
        }

        bytes32 versionHash = keccak256(bytes(metadata.version));
        bytes32 metadataHash = keccak256(
            abi.encode(
                metadata.elementId,
                metadata.category,
                versionHash,
                metadata.temporal,
                metadata.decidability,
                metadata.timing,
                metadata.statefulness
            )
        );
        _elements[elementId] = element;
        _metadataHashes[elementId] = metadataHash;
        _versionHashes[elementId] = versionHash;
        _defaultActions[elementId] = defaultAction;

        emit Events.ElementRegistered(elementId, element);
        emit Events.ElementRegisteredV2(elementId, element, metadataHash, versionHash, defaultAction);
    }

    function elementOf(bytes32 elementId) external view returns (address) {
        return _elements[elementId];
    }

    function metadataOf(bytes32 elementId) external view returns (ElementMetadata memory) {
        address element = _elements[elementId];
        if (element == address(0)) revert Errors.ElementNotRegistered(elementId);
        return IComplianceElement(element).elementMetadata();
    }

    function metadataHashOf(bytes32 elementId) external view returns (bytes32) {
        if (_elements[elementId] == address(0)) revert Errors.ElementNotRegistered(elementId);
        return _metadataHashes[elementId];
    }

    function versionHashOf(bytes32 elementId) external view returns (bytes32) {
        if (_elements[elementId] == address(0)) revert Errors.ElementNotRegistered(elementId);
        return _versionHashes[elementId];
    }

    function defaultActionOf(bytes32 elementId) external view returns (EnforcementAction) {
        if (_elements[elementId] == address(0)) revert Errors.ElementNotRegistered(elementId);
        return _defaultActions[elementId];
    }
}
