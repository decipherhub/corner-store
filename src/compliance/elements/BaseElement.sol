// SPDX-License-Identifier: GPL-3.0
pragma solidity 0.8.17;

import {IComplianceElement} from "../../interfaces/compliance/IComplianceElement.sol";
import {ElementMetadata} from "../../types/ComplianceTypes.sol";
import {ReasonCodes} from "../../libraries/ReasonCodes.sol";

/// @dev Stores immutable-ish ElementMetadata set at construction and enforces
///      the common parameter capability before a concrete legal judgment runs.
abstract contract BaseElement is IComplianceElement {
    ElementMetadata internal _meta;

    constructor(ElementMetadata memory meta) {
        _meta = meta;
    }

    function elementMetadata() external view override returns (ElementMetadata memory) {
        return _meta;
    }

    function check(
        address user,
        address counterparty,
        address asset,
        uint256 amount,
        bytes calldata context,
        bytes calldata parameters
    ) external view override returns (bool passed, bytes32 reasonCode) {
        if (!_parametersValid(parameters)) {
            return (false, ReasonCodes.invalidElementParameters(_meta.elementId));
        }
        return _check(user, counterparty, asset, amount, context, parameters);
    }

    function _parametersValid(bytes calldata parameters) internal view returns (bool) {
        if (_meta.parameterSchemaId == bytes32(0)) return parameters.length == 0;
        if (_meta.parametersRequired && parameters.length == 0) return false;
        return parameters.length <= _meta.maxParameterBytes;
    }

    function _check(
        address user,
        address counterparty,
        address asset,
        uint256 amount,
        bytes calldata context,
        bytes calldata parameters
    ) internal view virtual returns (bool passed, bytes32 reasonCode);
}
