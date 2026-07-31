// SPDX-License-Identifier: GPL-3.0
pragma solidity 0.8.17;

import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import {SignatureChecker} from "@openzeppelin/contracts/utils/cryptography/SignatureChecker.sol";
import {Governed} from "../auth/Governed.sol";
import {IMakerAuthorizer} from "../interfaces/execution/adapters/IMakerAuthorizer.sol";
import {Errors} from "../libraries/Errors.sol";

/// @notice Versioned quote authority for RFQ settlement accounts.
/// @dev A maker can sign directly as an EOA, validate through ERC-1271, or use
///      an explicitly governed EOA delegate. Delegate additions are delayed;
///      revocation is immediate and therefore invalidates outstanding quotes.
contract MakerAuthorizer is IMakerAuthorizer, Governed {
    uint64 public constant AUTHORIZATION_DELAY = 1 days;

    mapping(address => mapping(address => bool)) public isDelegate;
    mapping(address => mapping(address => uint64)) public pendingDelegateReadyAt;

    event DelegateAuthorizationScheduled(
        address indexed maker, address indexed delegate, uint64 readyAt, bytes32 reasonHash
    );
    event DelegateAuthorizationCancelled(address indexed maker, address indexed delegate);
    event DelegateAuthorized(address indexed maker, address indexed delegate);
    event DelegateRevoked(address indexed maker, address indexed delegate, bytes32 reasonCode);

    function authorizerVersion() external pure returns (uint64) {
        return 1;
    }

    function scheduleDelegate(address maker, address delegate, bytes32 reasonHash) external onlyOwner {
        _requireValidPair(maker, delegate);
        if (isDelegate[maker][delegate]) revert Errors.InvalidAuthorizationState();
        if (pendingDelegateReadyAt[maker][delegate] != 0) revert Errors.PendingActionExists();

        uint64 readyAt = uint64(block.timestamp + AUTHORIZATION_DELAY);
        pendingDelegateReadyAt[maker][delegate] = readyAt;
        emit DelegateAuthorizationScheduled(maker, delegate, readyAt, reasonHash);
    }

    function cancelDelegateAuthorization(address maker, address delegate) external onlyOwner {
        if (pendingDelegateReadyAt[maker][delegate] == 0) revert Errors.PendingActionNotFound();
        delete pendingDelegateReadyAt[maker][delegate];
        emit DelegateAuthorizationCancelled(maker, delegate);
    }

    function executeDelegateAuthorization(address maker, address delegate) external onlyOwner {
        uint64 readyAt = pendingDelegateReadyAt[maker][delegate];
        if (readyAt == 0) revert Errors.PendingActionNotFound();
        if (block.timestamp < readyAt) revert Errors.TimelockNotReady(readyAt);

        delete pendingDelegateReadyAt[maker][delegate];
        isDelegate[maker][delegate] = true;
        emit DelegateAuthorized(maker, delegate);
    }

    function revokeDelegate(address maker, address delegate, bytes32 reasonCode) external onlyOperator {
        _requireValidPair(maker, delegate);
        bool wasAuthorized = isDelegate[maker][delegate];
        bool wasPending = pendingDelegateReadyAt[maker][delegate] != 0;
        if (!wasAuthorized && !wasPending) revert Errors.InvalidAuthorizationState();

        delete isDelegate[maker][delegate];
        delete pendingDelegateReadyAt[maker][delegate];
        emit DelegateRevoked(maker, delegate, reasonCode);
    }

    function isAuthorizedSigner(address maker, bytes32 quoteHash, bytes calldata signature)
        external
        view
        returns (bool)
    {
        if (maker == address(0)) return false;
        if (SignatureChecker.isValidSignatureNow(maker, quoteHash, signature)) return true;

        (address recovered, ECDSA.RecoverError error) = ECDSA.tryRecover(quoteHash, signature);
        return error == ECDSA.RecoverError.NoError && isDelegate[maker][recovered];
    }

    function _requireValidPair(address maker, address delegate) private pure {
        if (maker == address(0) || delegate == address(0)) revert Errors.ZeroAddress();
        if (maker == delegate) revert Errors.InvalidAuthorizationState();
    }
}
