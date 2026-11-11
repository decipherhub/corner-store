// SPDX-License-Identifier: GPL-3.0
pragma solidity 0.8.17;

import {Governed} from "../../auth/Governed.sol";
import {IIdentityEvidenceV2} from "../../interfaces/compliance/IIdentityEvidenceV2.sol";
import {BaseElement} from "./BaseElement.sol";
import {IdentityPolicy} from "../libraries/IdentityPolicy.sol";
import {
    ElementMetadata,
    ElementCategory,
    TemporalNature,
    Decidability,
    ObligationTiming,
    Statefulness,
    EvidenceType,
    EnforcementAction
} from "../../types/ComplianceTypes.sol";
import {ReasonCodes} from "../../libraries/ReasonCodes.sol";

/// @dev Opt-in operator-accepted evidence. Keyed commitments are computed off-chain.
contract IdentityUniquenessV2 is BaseElement, Governed, IIdentityEvidenceV2 {
    bytes32 internal constant ELEMENT_ID = "A-04-v2";
    bytes32 public constant PARAMETER_SCHEMA_ID = IdentityPolicy.SCHEMA_ID;

    constructor()
        BaseElement(ElementMetadata({
                elementId: ELEMENT_ID,
                category: ElementCategory.INVESTOR_ATTRIBUTE,
                version: "A-04-v2",
                temporal: TemporalNature.PERIODIC,
                decidability: Decidability.DETERMINISTIC,
                timing: ObligationTiming.AT_TRADE_GATE,
                statefulness: Statefulness.STATELESS,
                evidenceType: EvidenceType.PROVIDER_ATTESTATION,
                defaultEnforcement: EnforcementAction.BLOCK,
                parameterSchemaId: PARAMETER_SCHEMA_ID,
                parameterSchemaVersion: 1,
                maxParameterBytes: 64,
                parametersRequired: true
            }))
    {}

    enum IdentityStatus {
        ACTIVE,
        FROZEN,
        REVOKED
    }
    enum DedupStatus {
        UNIQUE,
        SUSPECTED_DUPLICATE,
        CONFIRMED_DUPLICATE
    }

    mapping(address => bytes32) public identityOf;
    mapping(bytes32 => address) public walletOf;
    mapping(bytes32 => bytes32) public trustedIssuerBasis;
    mapping(bytes32 => IdentityStatus) public identityStatusOf;
    mapping(bytes32 => DedupStatus) public dedupStatusOf;
    mapping(address => uint256) private bindingGeneration;
    mapping(bytes32 => Evidence) private evidenceByBinding;
    bool public enforceCounterparty;

    error IdentityBindingConflict();
    error InvalidEvidence();

    event IdentityBound(address indexed wallet, bytes32 indexed identityId);
    event IdentityUnbound(address indexed wallet, bytes32 indexed identityId);
    event IdentityStatusSet(bytes32 indexed identityId, IdentityStatus status);
    event DedupStatusSet(bytes32 indexed identityId, DedupStatus status);
    event EnforceCounterpartySet(bool enabled);

    function bindIdentity(address wallet, bytes32 identityId) external onlyOperator {
        if (wallet == address(0) || identityId == bytes32(0)) revert IdentityBindingConflict();
        if (walletOf[identityId] != address(0) && walletOf[identityId] != wallet) revert IdentityBindingConflict();
        if (identityOf[wallet] != bytes32(0) && identityOf[wallet] != identityId) revert IdentityBindingConflict();
        if (identityOf[wallet] == identityId) return;
        identityOf[wallet] = identityId;
        walletOf[identityId] = wallet;
        emit IdentityBound(wallet, identityId);
    }

    function unbindIdentity(address wallet) external onlyOperator {
        bytes32 identityId = identityOf[wallet];
        if (identityId == bytes32(0)) return;
        delete identityOf[wallet];
        delete walletOf[identityId];
        ++bindingGeneration[wallet];
        emit IdentityUnbound(wallet, identityId);
    }

    function setTrustedIssuer(bytes32 issuerId, bytes32 trustBasisHash) external onlyOperator {
        if (issuerId == bytes32(0)) revert InvalidEvidence();
        trustedIssuerBasis[issuerId] = trustBasisHash;
        emit TrustedIssuerSet(issuerId, trustBasisHash);
    }

    function acceptEvidence(address wallet, address asset, Evidence calldata evidence) external override onlyOperator {
        if (
            asset == address(0) || identityOf[wallet] == bytes32(0) || evidence.identityId != identityOf[wallet]
                || evidence.evidenceHash == bytes32(0) || evidence.issuerId == bytes32(0)
                || evidence.trustBasisHash == bytes32(0)
                || trustedIssuerBasis[evidence.issuerId] != evidence.trustBasisHash || evidence.issuedAt == 0
                || evidence.issuedAt > block.timestamp || evidence.expiresAt <= block.timestamp
                || evidence.expiresAt <= evidence.issuedAt || evidence.attestationType < 1
                || evidence.attestationType > 3
        ) revert InvalidEvidence();
        evidenceByBinding[_bindingKey(wallet, asset)] = evidence;
        emit EvidenceAccepted(wallet, asset, evidence.identityId, evidence.evidenceHash);
    }

    function revokeEvidence(address wallet, address asset) external override onlyOperator {
        delete evidenceByBinding[_bindingKey(wallet, asset)];
        emit EvidenceRevoked(wallet, asset);
    }

    function evidenceOf(address wallet, address asset) external view override returns (Evidence memory) {
        return evidenceByBinding[_bindingKey(wallet, asset)];
    }

    function setIdentityStatus(bytes32 identityId, IdentityStatus status) external onlyOperator {
        identityStatusOf[identityId] = status;
        emit IdentityStatusSet(identityId, status);
    }

    function setDedupStatus(bytes32 identityId, DedupStatus status) external onlyOperator {
        dedupStatusOf[identityId] = status;
        emit DedupStatusSet(identityId, status);
    }

    function setEnforceCounterparty(bool enabled) external onlyOperator {
        enforceCounterparty = enabled;
        emit EnforceCounterpartySet(enabled);
    }

    function _bindingKey(address wallet, address asset) internal view returns (bytes32) {
        return keccak256(abi.encode(wallet, identityOf[wallet], asset, bindingGeneration[wallet]));
    }

    function _check(
        address user,
        address counterparty,
        address asset,
        uint256,
        bytes calldata,
        bytes calldata parameters
    ) internal view override returns (bool passed, bytes32 reasonCode) {
        if (!IdentityPolicy.valid(parameters)) {
            return (false, ReasonCodes.invalidElementParameters(ELEMENT_ID));
        }
        (passed, reasonCode) = _checkIdentity(user, asset);
        if (passed && enforceCounterparty) return _checkIdentity(counterparty, asset);
    }

    function _checkIdentity(address wallet, address asset) internal view returns (bool, bytes32) {
        bytes32 identityId = identityOf[wallet];
        Evidence storage evidence = evidenceByBinding[_bindingKey(wallet, asset)];
        uint8 failure;
        if (identityId == bytes32(0) || evidence.evidenceHash == bytes32(0) || evidence.identityId != identityId) {
            failure = 2;
        } else if (trustedIssuerBasis[evidence.issuerId] == bytes32(0)) {
            failure = 4;
        } else if (trustedIssuerBasis[evidence.issuerId] != evidence.trustBasisHash) {
            failure = 11;
        } else if (block.timestamp < evidence.issuedAt || block.timestamp >= evidence.expiresAt) {
            failure = 5;
        } else if (evidence.attestationType < 1 || evidence.attestationType > 3) {
            failure = 10;
        } else if (identityStatusOf[identityId] == IdentityStatus.FROZEN) {
            failure = 6;
        } else if (identityStatusOf[identityId] == IdentityStatus.REVOKED) {
            failure = 7;
        } else if (dedupStatusOf[identityId] == DedupStatus.CONFIRMED_DUPLICATE) {
            failure = 8;
        } else if (dedupStatusOf[identityId] == DedupStatus.SUSPECTED_DUPLICATE) {
            failure = 9;
        }
        if (failure != 0) return (false, ReasonCodes.encode(0, ELEMENT_ID, failure));
        return (true, bytes32(0));
    }
}
