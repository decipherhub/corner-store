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

/// @dev B-02-v1 ERC-3643 (T-REX) native asset attestation (mock, ASSET-side).
///      Internal architecture decision: regulated assets must be ERC-3643
///      (T-REX) native tokens. Production seam: this attestation would be
///      replaced by ERC-165 introspection against the T-REX `IToken`
///      interface ID, or a lookup in an on-chain token registry. An operator
///      attestation stands in here because the vendored T-REX token's
///      ERC-165 support is not guaranteed, and a false negative from a live
///      introspection check would brick settlement for a legitimately
///      ERC-3643-native asset. Fail-closed: an unattested asset fails.
contract Erc3643Native is BaseElement, Governed {
    bytes32 internal constant ELEMENT_ID = "B-02-v1";

    /// @notice asset => attested ERC-3643-native.
    mapping(address => bool) public erc3643Native;

    event Erc3643NativeSet(address indexed asset, bool native_);

    constructor()
        BaseElement(ElementMetadata({
                elementId: ELEMENT_ID,
                category: ElementCategory.ASSET_ATTRIBUTE,
                version: "B-02-v1",
                temporal: TemporalNature.ONE_TIME,
                decidability: Decidability.DETERMINISTIC,
                timing: ObligationTiming.AT_TRADE_GATE,
                statefulness: Statefulness.STATELESS
            }))
    {}

    /// @notice Attest whether `asset` is an ERC-3643-native (T-REX) token.
    /// @dev Production seam: replace with an ERC-165 `supportsInterface`
    ///      check against the T-REX `IToken` interface ID, or a lookup in a
    ///      token/ERC-3643 trusted-token registry.
    function setErc3643Native(address asset, bool native_) external onlyOperator {
        erc3643Native[asset] = native_;
        emit Erc3643NativeSet(asset, native_);
    }

    /// @dev ASSET-side check: ignores `user`/`counterparty`/`amount`/`context`.
    ///      Passes iff `asset` has been attested ERC-3643-native. Unattested
    ///      assets fail closed.
    function check(address, address, address asset, uint256, bytes calldata)
        external
        view
        override
        returns (bool passed, bytes32 reasonCode)
    {
        passed = erc3643Native[asset];
        // recipeId 0 is a placeholder; the engine re-encodes with the real recipeId.
        reasonCode = passed ? bytes32(0) : ReasonCodes.encode(0, ELEMENT_ID, 1);
    }
}
