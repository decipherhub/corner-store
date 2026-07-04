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

/// @dev A-04-v1 Identity uniqueness (mock). Stands in for a real ONCHAINID-backed
///      BSA identity program: one on-chain identity per holder wallet, one wallet
///      per identity. An operator-settable bidirectional binding stands in for the
///      real claim/registry lookup — no production identity truth is hardcoded here.
///
///      The uniqueness invariant lives in the setter (`bindIdentity`), not in
///      `check`: `check` only asks "is this wallet bound to *some* identity" and
///      fails closed on an unbound wallet. Rebinding the same (wallet, identityId)
///      pair is accepted as a no-op; binding either side to a *different* value on
///      the other side is rejected so the mapping stays 1:1 in both directions.
contract IdentityUniqueness is BaseElement, Governed {
    bytes32 internal constant ELEMENT_ID = "A-04-v1";

    /// @dev wallet => identity id (bytes32(0) = unbound).
    mapping(address => bytes32) public identityOf;
    /// @dev identity id => wallet (address(0) = unbound).
    mapping(bytes32 => address) public walletOf;

    /// @dev No existing Errors.sol member fits this setter-time data-integrity
    ///      guard: `Errors.ComplianceRejected(bytes32)` is reserved for the
    ///      engine/router rejecting a whole trade decision by reasonCode, and
    ///      `Errors.NotAuthorized` is purely an auth error. Declared here per the
    ///      "no Errors.sol edits" constraint; used for all three invariant
    ///      violations below (zero identity, and both directions of rebinding
    ///      onto a different counterpart) since they are one conceptual failure
    ///      mode — a broken 1:1 binding — not three distinct ones.
    error IdentityBindingConflict();

    event IdentityBound(address indexed wallet, bytes32 indexed identityId);
    event IdentityUnbound(address indexed wallet, bytes32 indexed identityId);

    constructor()
        BaseElement(ElementMetadata({
                elementId: ELEMENT_ID,
                category: ElementCategory.INVESTOR_ATTRIBUTE,
                version: "A-04-v1",
                temporal: TemporalNature.ONE_TIME,
                decidability: Decidability.DETERMINISTIC,
                timing: ObligationTiming.EX_ANTE_VERIFY,
                statefulness: Statefulness.STATELESS
            }))
    {}

    /// @notice Bind `wallet` to `identityId`, enforcing the 1:1 invariant.
    /// @dev Idempotent on rebinding the same (wallet, identityId) pair.
    function bindIdentity(address wallet, bytes32 identityId) external onlyOperator {
        if (identityId == bytes32(0)) revert IdentityBindingConflict();

        address existingWallet = walletOf[identityId];
        if (existingWallet != address(0) && existingWallet != wallet) revert IdentityBindingConflict();

        bytes32 existingIdentity = identityOf[wallet];
        if (existingIdentity != bytes32(0) && existingIdentity != identityId) revert IdentityBindingConflict();

        identityOf[wallet] = identityId;
        walletOf[identityId] = wallet;
        emit IdentityBound(wallet, identityId);
    }

    /// @notice Clear both directions of `wallet`'s binding, if any.
    /// @dev Idempotent: unbinding an unbound wallet is a silent no-op so indexers
    ///      never see a spurious `IdentityUnbound(wallet, 0)` event.
    function unbindIdentity(address wallet) external onlyOperator {
        bytes32 identityId = identityOf[wallet];
        if (identityId == bytes32(0)) return;
        delete identityOf[wallet];
        delete walletOf[identityId];
        emit IdentityUnbound(wallet, identityId);
    }

    function check(address user, address, address, uint256, bytes calldata)
        external
        view
        override
        returns (bool passed, bytes32 reasonCode)
    {
        passed = identityOf[user] != bytes32(0);
        reasonCode = passed ? bytes32(0) : ReasonCodes.encode(0, ELEMENT_ID, 1);
    }
}
