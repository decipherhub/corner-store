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
import {LookThroughStatus} from "../../interfaces/compliance/ILookThroughSource.sol";

/// @dev A-01-v1 Sanctions screening (OFAC) — dual-pattern pre-trade gate (mock).
///      A-01 sits on sanctions law (IEEPA 50 U.S.C. §§1701-1705, OFAC 31 C.F.R.
///      Ch. V), NOT securities law, and is a strict-liability gate applied to
///      *both* parties of a trade (doc §1, §3.2 "양 당사자"). It is a hybrid of
///      two verification patterns (doc §8):
///
///        Pattern A — wallet exact-match (deterministic, on-chain). The `blocked`
///        mapping IS the on-chain SDN wallet set (OFAC has listed digital-currency
///        addresses as SDN identifiers since 2018 — doc §3.8). `check` screens the
///        `user` (buyer) AND the `counterparty` (seller) wallet; an unlisted
///        counterparty (e.g. an AMM pool) passes. This leg is ALWAYS on and is the
///        exact legacy behavior.
///
///        Pattern B — sanctions-screening claim (attestation, off-chain fuzzy name
///        match + entity 50%-Rule aggregation, verified on-chain). OPT-IN via
///        `claimRegimeEnabled` (default false => wallet-only, i.e. exactly the
///        legacy behavior). When enabled, the doc §5.2 claim pipeline runs for the
///        `user` always; for the `counterparty` only when `enforceCounterpartyClaim`
///        is also set (mock boundary — venue/pool sellers hold no claims; a real
///        deployment resolves seller identity off-chain first).
///
///      A-09 seam: A-01's 50%-Rule aggregation shares A-09's recursive look-through
///      mechanism (doc §3.7, §9). Because that aggregation is settled wholesale
///      off-chain, we do NOT inject ILookThroughSource here (keeps the constructor
///      zero-arg and every call site unchanged); instead the settled
///      `LookThroughStatus ltStatus` is carried inside the operator-written claim.
///
///      Reason code map — `n` in `ReasonCodes.encode(0, ELEMENT_ID, n)` -> doc §6
///      failure-code name:
///        1  | FAIL_SDN_WALLET_MATCH            (wallet in SDN set — legacy code 1)
///        2  | FAIL_SDN_IDENTITY_MATCH          (name match score >= blockThresholdBps)
///        3  | FAIL_50PCT_RULE                  (aggregate blocked ownership >= 50%)
///        4  | FAIL_NO_SANCTIONS_CLAIM          (no screening claim, regime on)
///        5  | FAIL_UNTRUSTED_SANCTIONS_ISSUER  (claim issuer not trusted)
///        6  | FAIL_INVALID_SANCTIONS_SIGNATURE (claim signature invalid)
///        7  | FAIL_SANCTIONS_CLAIM_EXPIRED     (block.timestamp > expiry, strict >)
///        8  | FAIL_SANCTIONS_CLAIM_STALE_LIST  (screenedListVersion != currentListVersion)
///        9  | FAIL_50PCT_LOOKTHROUGH_PENDING   (entity ltStatus != COMPLETED)
///        10 | REVIEW_SANCTIONS_UNCERTAIN       (name match in [review, block) band)
contract Sanctions is BaseElement, Governed {
    bytes32 internal constant ELEMENT_ID = "A-01-v1";

    /// @dev 50.00% in bps — STATUTORY (OFAC 50% Rule, doc §3.7 "합산·재귀 50% 이상").
    ///      INCLUSIVE `>=`: exactly 5000 bps is blocked.
    uint16 internal constant FIFTY_PCT_BPS = 5000;

    /// @notice Pattern A on-chain SDN wallet set. `setBlocked` writes it (legacy).
    mapping(address => bool) public blocked;

    /// @notice Off-chain sanctions-screening claim per subject (Pattern B). Written
    ///         wholesale by an operator; `check` only verifies it (doc §8).
    struct ScreeningClaim {
        bool exists; // false => code 4 (regime on)
        bool issuerTrusted; // false => 5
        bool signatureValid; // false => 6
        uint64 expiry; // block.timestamp > expiry => 7 (0 = no expiry)
        uint32 screenedListVersion; // != currentListVersion => 8 (list update invalidates)
        uint16 identityMatchBps; // [review, block) => 10 ; >= block => 2 (fuzzy name match)
        bool isEntity; // true => run the 50%-Rule entity leg
        LookThroughStatus ltStatus; // A-09 seam: != COMPLETED => 9 (attested wholesale)
        uint16 blockedOwnershipBps; // aggregate blocked ownership; >= 5000 => 3 (recursive, off-chain)
    }

    /// @notice subject wallet => attested screening claim (Pattern B).
    mapping(address => ScreeningClaim) public claims;

    /// @notice Pattern B master switch. Default false => wallet-only (legacy behavior).
    bool public claimRegimeEnabled;

    /// @notice When true (and regime on), the claim pipeline also runs for the
    ///         counterparty. Default false — mock boundary (pool sellers hold no
    ///         claims); the wallet leg still screens the counterparty regardless.
    bool public enforceCounterpartyClaim;

    /// @notice Current SDN list version. A claim screened against an older version
    ///         is stale (code 8). Default 0 matches a default (version-0) claim.
    uint32 public currentListVersion;

    /// @notice Fuzzy name-match bands — operator-set POLICY values (doc §5, §12 OI-2;
    ///         doc fixes only the 50% ownership threshold). Score in
    ///         [reviewThresholdBps, blockThresholdBps) => manual review (10);
    ///         >= blockThresholdBps => hard block (2). Defaults are illustrative.
    uint16 public reviewThresholdBps = 7500;
    uint16 public blockThresholdBps = 9500;

    event SanctionsBlockedSet(address indexed account, bool blocked);
    event ClaimRegimeSet(bool claimRegimeEnabled, bool enforceCounterpartyClaim);
    event CurrentListVersionSet(uint32 version);
    event ScreeningThresholdsSet(uint16 reviewThresholdBps, uint16 blockThresholdBps);
    // Enum param canonicalizes to uint8 in the signature; tests re-declare ltStatus
    // as uint8 to match (Solidity 0.8.17 cannot `emit` a contract's event by name).
    event ScreeningClaimSet(
        address indexed subject, bool exists, bool isEntity, uint16 identityMatchBps, LookThroughStatus ltStatus
    );

    constructor()
        BaseElement(ElementMetadata({
                elementId: ELEMENT_ID,
                category: ElementCategory.INVESTOR_ATTRIBUTE,
                version: "A-01-v1",
                temporal: TemporalNature.REALTIME,
                decidability: Decidability.DETERMINISTIC,
                timing: ObligationTiming.AT_TRADE_GATE,
                statefulness: Statefulness.STATELESS
            }))
    {}

    /// @notice Adds/removes a wallet from the on-chain SDN set (Pattern A). Legacy
    ///         signature and effect preserved: an unblocked wallet still PASSes.
    function setBlocked(address user, bool isBlocked) external onlyOperator {
        blocked[user] = isBlocked;
        emit SanctionsBlockedSet(user, isBlocked);
    }

    /// @notice Toggles the Pattern B claim regime and counterparty enforcement.
    function setClaimRegime(bool enabled, bool enforceCounterparty) external onlyOperator {
        claimRegimeEnabled = enabled;
        enforceCounterpartyClaim = enforceCounterparty;
        emit ClaimRegimeSet(enabled, enforceCounterparty);
    }

    /// @notice Writes the operator-attested screening claim for `subject`.
    function setClaim(address subject, ScreeningClaim calldata claim) external onlyOperator {
        claims[subject] = claim;
        emit ScreeningClaimSet(subject, claim.exists, claim.isEntity, claim.identityMatchBps, claim.ltStatus);
    }

    /// @notice Bumps the current SDN list version (invalidates stale claims => 8).
    function setCurrentListVersion(uint32 version) external onlyOperator {
        currentListVersion = version;
        emit CurrentListVersionSet(version);
    }

    /// @notice Sets the fuzzy name-match POLICY bands. Requires review <= block.
    function setScreeningThresholds(uint16 reviewBps, uint16 blockBps) external onlyOperator {
        require(reviewBps <= blockBps, "review>block");
        reviewThresholdBps = reviewBps;
        blockThresholdBps = blockBps;
        emit ScreeningThresholdsSet(reviewBps, blockBps);
    }

    /// @dev Screens both parties (doc §5.2). Order: wallet(user) -> wallet(cpty)
    ///      -> [regime] claim pipeline per subject (user always; cpty iff enforced).
    ///      `asset`/`amount`/`context` are unused — sanctions is party-scoped.
    function check(address user, address counterparty, address, uint256, bytes calldata)
        external
        view
        override
        returns (bool passed, bytes32 reasonCode)
    {
        // (1) Pattern A — wallet exact-match, both parties. Unlisted cpty passes.
        if (blocked[user]) return (false, _code(1));
        if (blocked[counterparty]) return (false, _code(1));

        // (2) Pattern B — opt-in claim pipeline.
        if (claimRegimeEnabled) {
            uint32 c = _screenClaim(user);
            if (c != 0) return (false, _code(c));
            if (enforceCounterpartyClaim) {
                c = _screenClaim(counterparty);
                if (c != 0) return (false, _code(c));
            }
        }
        return (true, bytes32(0));
    }

    /// @dev Runs the doc §5.2 claim pipeline for one subject. Returns the first
    ///      failing code, or 0 on pass. Order: exists(4) -> issuer(5) -> sig(6) ->
    ///      expiry(7, strict >) -> list version(8) -> name-match band (review 10 /
    ///      block 2) -> entity leg: ltStatus != COMPLETED(9) -> ownership >= 50%(3).
    function _screenClaim(address subject) internal view returns (uint32) {
        ScreeningClaim memory c = claims[subject];
        if (!c.exists) return 4;
        if (!c.issuerTrusted) return 5;
        if (!c.signatureValid) return 6;
        if (c.expiry != 0 && block.timestamp > c.expiry) return 7; // strict > ; 0 = no expiry
        if (c.screenedListVersion != currentListVersion) return 8;

        // Fuzzy name-match bands (doc §5.2). Review band is [review, block); the
        // block band is >= block. Disjoint, so order among the two is immaterial.
        if (c.identityMatchBps >= reviewThresholdBps && c.identityMatchBps < blockThresholdBps) return 10;
        if (c.identityMatchBps >= blockThresholdBps) return 2;

        // Entity 50%-Rule leg (doc §3.7). Look-through must be COMPLETED first
        // (else pending => 9), then aggregate blocked ownership >= 50% => 3.
        if (c.isEntity) {
            if (c.ltStatus != LookThroughStatus.COMPLETED) return 9;
            if (c.blockedOwnershipBps >= FIFTY_PCT_BPS) return 3;
        }
        return 0;
    }

    /// @dev recipeId 0 is a placeholder; the engine re-encodes with the real recipeId.
    function _code(uint32 n) private pure returns (bytes32) {
        return ReasonCodes.encode(0, ELEMENT_ID, n);
    }
}
