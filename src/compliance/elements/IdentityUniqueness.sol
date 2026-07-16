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
///      `check`: rebinding the same (wallet, identityId) pair is accepted as a
///      no-op; binding either side to a *different* value on the other side is
///      rejected so the mapping stays 1:1 in both directions.
///
///      Doc walkthrough (A-04_identity-dedup.md §5.2/§5.3/§6.2/§6.5): per-identity
///      state (KYC claim, identity status, dedup status) is keyed by the bytes32
///      identity id, not the wallet — this mirrors ONCHAINID being the person-level
///      anchor while `identityOf`/`walletOf` stay the wallet<->identity mapping.
///
///      reasonCode table (n -> doc §6.2 name):
///        1 -> IDENTITY_NOT_REGISTERED     (legacy unbound-fail meaning preserved)
///        2 -> KYC_CLAIM_MISSING
///        3 -> KYC_CLAIM_INVALID_SIG
///        4 -> UNTRUSTED_KYC_ISSUER
///        5 -> KYC_CLAIM_EXPIRED
///        6 -> IDENTITY_FROZEN
///        7 -> IDENTITY_REVOKED
///        8 -> DUPLICATE_IDENTITY
///        9 -> REVIEW_IDENTITY_DUPLICATE_SUSPECTED
///      (doc's REVIEW vs FAIL distinction is carried only in the code number —
///      `check`'s boolean `passed` is false for both 8 and 9, since
///      IComplianceElement has no separate REVIEW outcome; see §5.5/§6.3.)
contract IdentityUniqueness is BaseElement, Governed {
    bytes32 internal constant ELEMENT_ID = "A-04-v1";

    /// @dev Identity status per doc §4.2/§6.2 step 4. Default ACTIVE (enum zero).
    enum IdentityStatus {
        ACTIVE,
        FROZEN,
        REVOKED
    }

    /// @dev Dedup status per doc §4.2/§6.2 step 5 (12g5-1(a)(6)/(b)(3)). Default
    ///      UNIQUE (enum zero) so an identity nobody has flagged is unique by default.
    enum DedupStatus {
        UNIQUE,
        SUSPECTED_DUPLICATE,
        CONFIRMED_DUPLICATE
    }

    /// @dev KYC claim per doc §4.2/§5.2 steps 2-3. `maxAge == 0` means no expiry
    ///      (policy per doc §5.2-3: the arithmetic discipline itself — strict `>`
    ///      — is delegated to the A-11 freshness cascade element; A-04 inlines the
    ///      same comparison rather than making an external call).
    struct KycClaim {
        bool exists;
        bool signatureValid;
        bool issuerTrusted;
        uint64 verifiedAt;
        uint64 maxAge;
    }

    /// @dev wallet => identity id (bytes32(0) = unbound).
    mapping(address => bytes32) public identityOf;
    /// @dev identity id => wallet (address(0) = unbound).
    mapping(bytes32 => address) public walletOf;

    /// @dev identity id => KYC claim. Keyed by identity, not wallet, so every
    ///      wallet bound to the same identity shares one claim.
    mapping(bytes32 => KycClaim) public kycClaimOf;
    /// @dev identity id => status (default ACTIVE).
    mapping(bytes32 => IdentityStatus) public identityStatusOf;
    /// @dev identity id => dedup status (default UNIQUE).
    mapping(bytes32 => DedupStatus) public dedupStatusOf;

    /// @dev OPT-IN both-party gate (doc §5.2 `gate(from, to)`), default false.
    ///      Off by default because AMM pool sellers are not element-bound in this
    ///      mock DEX — a counterparty that is a pool address has no ONCHAINID and
    ///      would otherwise always fail code 1. When an operator flips this on
    ///      (e.g. for a bilateral/RFQ venue where the counterparty is a real
    ///      identified party), `check` runs the identical pipeline on `counterparty`.
    bool public enforceCounterparty;

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
    event KycClaimSet(
        bytes32 indexed identityId,
        bool exists,
        bool signatureValid,
        bool issuerTrusted,
        uint64 verifiedAt,
        uint64 maxAge
    );
    event IdentityStatusSet(bytes32 indexed identityId, IdentityStatus status);
    event DedupStatusSet(bytes32 indexed identityId, DedupStatus status);
    event EnforceCounterpartySet(bool enabled);

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
    /// @dev Idempotent on rebinding the same (wallet, identityId) pair. Compat
    ///      seeding: the FIRST time an identity is bound, this also seeds a fully
    ///      valid `KycClaim` (exists/signatureValid/issuerTrusted true, verifiedAt
    ///      = now, maxAge = 0 = no expiry) so a bound wallet still PASSes `check`
    ///      with no further operator calls — the load-bearing legacy happy path.
    ///      Seeding only ensures a claim EXISTS: a later rebind (same pair, or a
    ///      new wallet after `unbindIdentity` — the doc §7.3 multi-wallet story is
    ///      collapsed to 1:1 in this mock) never overwrites a claim an operator
    ///      already customized via `setKycClaim` while `exists` is true.
    function bindIdentity(address wallet, bytes32 identityId) external onlyOperator {
        if (identityId == bytes32(0)) revert IdentityBindingConflict();

        address existingWallet = walletOf[identityId];
        if (existingWallet != address(0) && existingWallet != wallet) revert IdentityBindingConflict();

        bytes32 existingIdentity = identityOf[wallet];
        if (existingIdentity != bytes32(0) && existingIdentity != identityId) revert IdentityBindingConflict();

        identityOf[wallet] = identityId;
        walletOf[identityId] = wallet;
        emit IdentityBound(wallet, identityId);

        if (!kycClaimOf[identityId].exists) {
            kycClaimOf[identityId] = KycClaim({
                exists: true, signatureValid: true, issuerTrusted: true, verifiedAt: uint64(block.timestamp), maxAge: 0
            });
            emit KycClaimSet(identityId, true, true, true, uint64(block.timestamp), 0);
        }
    }

    /// @notice Clear both directions of `wallet`'s binding, if any.
    /// @dev Idempotent: unbinding an unbound wallet is a silent no-op so indexers
    ///      never see a spurious `IdentityUnbound(wallet, 0)` event. Per-identity
    ///      state (claim/status/dedup) is NOT cleared here — it belongs to the
    ///      identity, not the wallet<->identity edge, and survives a later rebind.
    function unbindIdentity(address wallet) external onlyOperator {
        bytes32 identityId = identityOf[wallet];
        if (identityId == bytes32(0)) return;
        delete identityOf[wallet];
        delete walletOf[identityId];
        emit IdentityUnbound(wallet, identityId);
    }

    /// @notice Operator sets the full KYC claim for an identity (doc §4.2/§5.2 steps 2-3).
    function setKycClaim(bytes32 identityId, KycClaim calldata claim) external onlyOperator {
        kycClaimOf[identityId] = claim;
        emit KycClaimSet(
            identityId, claim.exists, claim.signatureValid, claim.issuerTrusted, claim.verifiedAt, claim.maxAge
        );
    }

    /// @notice Operator sets identity status (doc §6.2 FROZEN/REVOKED, §6.3).
    function setIdentityStatus(bytes32 identityId, IdentityStatus status) external onlyOperator {
        identityStatusOf[identityId] = status;
        emit IdentityStatusSet(identityId, status);
    }

    /// @notice Operator sets dedup status (doc §5.5/§6.2/§6.5 — off-chain
    ///         screening/investigation confirms the enum value; the chain only
    ///         reads it deterministically).
    function setDedupStatus(bytes32 identityId, DedupStatus status) external onlyOperator {
        dedupStatusOf[identityId] = status;
        emit DedupStatusSet(identityId, status);
    }

    /// @notice Operator toggles the both-party gate (see `enforceCounterparty` doc above).
    function setEnforceCounterparty(bool enabled) external onlyOperator {
        enforceCounterparty = enabled;
        emit EnforceCounterpartySet(enabled);
    }

    /// @dev doc §5.2 `check_A_04` pipeline, run on `user` always and on
    ///      `counterparty` only when `enforceCounterparty` is on (see field doc).
    function check(address user, address counterparty, address, uint256, bytes calldata)
        external
        view
        override
        returns (bool passed, bytes32 reasonCode)
    {
        (passed, reasonCode) = _checkIdentity(user);
        if (!passed) return (passed, reasonCode);

        if (enforceCounterparty) {
            (passed, reasonCode) = _checkIdentity(counterparty);
        }
    }

    /// @dev doc §5.2 check order: unbound(1) -> claim missing(2) -> sig(3) ->
    ///      issuer(4) -> freshness, strict `>` (5) -> FROZEN(6) -> REVOKED(7) ->
    ///      CONFIRMED_DUPLICATE(8) -> SUSPECTED_DUPLICATE(9) -> PASS.
    function _checkIdentity(address wallet) internal view returns (bool passed, bytes32 reasonCode) {
        bytes32 idty = identityOf[wallet];
        if (idty == bytes32(0)) {
            return (false, ReasonCodes.encode(0, ELEMENT_ID, 1));
        }

        KycClaim memory claim = kycClaimOf[idty];
        if (!claim.exists) {
            return (false, ReasonCodes.encode(0, ELEMENT_ID, 2));
        }
        if (!claim.signatureValid) {
            return (false, ReasonCodes.encode(0, ELEMENT_ID, 3));
        }
        if (!claim.issuerTrusted) {
            return (false, ReasonCodes.encode(0, ELEMENT_ID, 4));
        }
        // Freshness — strict `>`, so exactly-at-maxAge PASSes (A-11 discipline).
        // Age is 0 for a future/equal anchor, avoiding underflow.
        if (
            claim.maxAge != 0 && block.timestamp > claim.verifiedAt
                && block.timestamp - uint256(claim.verifiedAt) > uint256(claim.maxAge)
        ) {
            return (false, ReasonCodes.encode(0, ELEMENT_ID, 5));
        }

        IdentityStatus status = identityStatusOf[idty];
        if (status == IdentityStatus.FROZEN) {
            return (false, ReasonCodes.encode(0, ELEMENT_ID, 6));
        }
        if (status == IdentityStatus.REVOKED) {
            return (false, ReasonCodes.encode(0, ELEMENT_ID, 7));
        }

        DedupStatus dedup = dedupStatusOf[idty];
        if (dedup == DedupStatus.CONFIRMED_DUPLICATE) {
            return (false, ReasonCodes.encode(0, ELEMENT_ID, 8));
        }
        if (dedup == DedupStatus.SUSPECTED_DUPLICATE) {
            return (false, ReasonCodes.encode(0, ELEMENT_ID, 9));
        }

        return (true, bytes32(0));
    }
}
