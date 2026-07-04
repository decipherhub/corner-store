// SPDX-License-Identifier: GPL-3.0
pragma solidity 0.8.17;

import {BaseElement} from "./BaseElement.sol";
import {Governed} from "../../auth/Governed.sol";
import {
    ElementMetadata,
    ElementCategory,
    TemporalNature,
    Decidability,
    ObligationTiming,
    Statefulness
} from "../../types/ComplianceTypes.sol";
import {ReasonCodes} from "../../libraries/ReasonCodes.sol";

/// @dev B-01-v1 Asset classification declaration (mock). Stands in for an
///      issuer/operator declaration that an asset is offered under a given
///      regulation path (e.g. Reg D) — a settable per-asset tag stands in for
///      a real EDGAR/offering-document lookup. ASSET-side check: it inspects
///      `asset`, not `user` (contrast with the investor-attribute elements).
contract AssetClassification is BaseElement, Governed {
    bytes32 internal constant ELEMENT_ID = "B-01-v1";

    /// @dev Thrown when the contract is deployed with a zero required
    ///      classification, which would otherwise make an unclassified asset
    ///      (default bytes32(0)) indistinguishable from a correctly declared one.
    error ZeroRequiredClassification();

    /// @notice The classification tag every asset must carry to pass `check`.
    bytes32 public immutable requiredClassification;

    /// @notice asset => declared classification tag (bytes32(0) = unclassified).
    mapping(address => bytes32) public classificationOf;

    event ClassificationSet(address indexed asset, bytes32 classification);

    constructor(bytes32 requiredClassification_)
        BaseElement(ElementMetadata({
                elementId: ELEMENT_ID,
                category: ElementCategory.ASSET_ATTRIBUTE,
                version: "B-01-v1",
                temporal: TemporalNature.ONE_TIME,
                decidability: Decidability.DETERMINISTIC,
                timing: ObligationTiming.AT_TRADE_GATE,
                statefulness: Statefulness.STATELESS
            }))
    {
        if (requiredClassification_ == bytes32(0)) {
            revert ZeroRequiredClassification();
        }
        requiredClassification = requiredClassification_;
    }

    /// @notice Declares (or clears) the classification tag for `asset`.
    function setClassification(address asset, bytes32 classification) external onlyOperator {
        classificationOf[asset] = classification;
        emit ClassificationSet(asset, classification);
    }

    /// @dev Passes iff `asset`'s declared classification matches
    ///      `requiredClassification`. `user` is ignored — this is an
    ///      asset-side, not investor-side, check.
    function check(address, address, address asset, uint256, bytes calldata)
        external
        view
        override
        returns (bool passed, bytes32 reasonCode)
    {
        passed = classificationOf[asset] == requiredClassification;
        reasonCode = passed ? bytes32(0) : ReasonCodes.encode(0, ELEMENT_ID, 1);
    }
}
