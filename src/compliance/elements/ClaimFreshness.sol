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

/// @dev A-11-v1 Claim freshness (mock). Stands in for the on-chain freshness
///      gate on an already-issued AI/QP claim: A-03/A-13 judge claim
///      *substance* (is this person actually AI/QP); A-11 only judges whether
///      the claim's `verifiedAt` timestamp is still within its reuse window at
///      trade time. Pure deterministic timestamp arithmetic — no look-through,
///      no manual review path (doc §5.5, §6.3): the only cure for any failure
///      here is re-verification producing a fresh `verifiedAt`.
///
///      Reason code numbers (element-doc §6.2 names), in `check()` evaluation
///      order:
///        1 = FAIL_NO_VERIFIED_AT      claim.verifiedAt unset
///        2 = FAIL_CLAIM_STALE_AI      AI claim older than CAP_AI (5y, statutory)
///        3 = FAIL_CLAIM_STALE_QP      QP claim older than CAP_QP (1y, POLICY)
///        4 = FAIL_CLAIM_EXPIRED       issuer-set expiry (shorter than the cap) passed
///        5 = FAIL_UNKNOWN_CLAIM_TYPE  claimType not AI/QP — fail-closed, never
///                                     defaults to the laxer AI cap
contract ClaimFreshness is BaseElement, Governed {
    bytes32 internal constant ELEMENT_ID = "A-11-v1";

    enum FreshClaimType {
        UNKNOWN,
        AI,
        QP
    }

    struct FreshnessClaim {
        FreshClaimType claimType;
        uint64 verifiedAt; // 0 = unset (no freshness anchor to compute from)
        uint64 issuerExpiry; // 0 = none; if set and shorter than the regulatory/
        // policy cap, the issuer-set expiry wins (tighter always dominates)
    }

    /// @dev Rule 506(c)(2)(ii)(E): a prior AI verification may be reused "for a
    ///      period of five years from the date the person was previously
    ///      verified" — this cap is STATUTORY, not a Decipher choice.
    uint64 public constant CAP_AI = 5 * 365 days;

    /// @dev Decipher POLICY value — NOT statute. ICA §3(c)(7) requires QP
    ///      status only "at the time of acquisition" and contains no
    ///      re-verification or expiry provision at all; this 1-year window is
    ///      a conservative Decipher risk buffer, deliberately narrower than
    ///      the statutory 5-year AI window, because a single non-qualifying
    ///      holder collapses the entire fund's §3(c)(7) exemption. This value
    ///      must never be represented as a legal requirement in comments,
    ///      docs, or user-facing messages — it is a risk-management choice.
    uint64 public constant CAP_QP = 365 days;

    /// @notice user => attested freshness claim.
    mapping(address => FreshnessClaim) public claimOf;

    event ClaimSet(address indexed user, FreshClaimType claimType, uint64 verifiedAt, uint64 issuerExpiry);

    constructor()
        BaseElement(ElementMetadata({
                elementId: ELEMENT_ID,
                category: ElementCategory.INVESTOR_ATTRIBUTE,
                version: "A-11-v1",
                temporal: TemporalNature.PERIODIC,
                decidability: Decidability.DETERMINISTIC,
                timing: ObligationTiming.AT_TRADE_GATE,
                statefulness: Statefulness.STATELESS
            }))
    {}

    /// @notice Records (or overwrites) the attested freshness anchor for `user`.
    /// @dev `verifiedAt`/`issuerExpiry` are attested off-chain by the Trusted
    ///      Issuer that signed the underlying AI/QP claim; A-11 trusts them at
    ///      face value and performs only deterministic timestamp arithmetic on
    ///      top of that trust (doc §5.5, §8.3, §10.4 — liability for a wrong
    ///      `verifiedAt` sits with the issuer/attester, not with this element).
    function setClaim(address user, FreshClaimType claimType, uint64 verifiedAt, uint64 issuerExpiry)
        external
        onlyOperator
    {
        claimOf[user] = FreshnessClaim({claimType: claimType, verifiedAt: verifiedAt, issuerExpiry: issuerExpiry});
        emit ClaimSet(user, claimType, verifiedAt, issuerExpiry);
    }

    /// @dev doc §5.2 order, T_tx = block.timestamp (the settlement block, per
    ///      §5.4's recommendation):
    ///        1. `verifiedAt == 0` -> FAIL_NO_VERIFIED_AT (no arithmetic anchor).
    ///        2. `claimType == UNKNOWN` -> FAIL_UNKNOWN_CLAIM_TYPE, fail-closed
    ///           (never silently treated as the laxer AI cap).
    ///        3. Pick the cap by type, then take the earlier of the
    ///           regulatory/policy expiry and any issuer-set expiry.
    ///        4. Strict `>` against T_tx: exactly-at-cap PASSes (doc §5.3 —
    ///           the cap is an inclusive window, only exceeding it fails).
    function check(address user, address, address, uint256, bytes calldata)
        external
        view
        override
        returns (bool passed, bytes32 reasonCode)
    {
        FreshnessClaim memory c = claimOf[user];

        if (c.verifiedAt == 0) {
            return (false, ReasonCodes.encode(0, ELEMENT_ID, 1));
        }

        if (c.claimType == FreshClaimType.UNKNOWN) {
            return (false, ReasonCodes.encode(0, ELEMENT_ID, 5));
        }

        uint64 cap = c.claimType == FreshClaimType.QP ? CAP_QP : CAP_AI;
        uint64 regulatoryExpiry = c.verifiedAt + cap;
        bool issuerBinds = c.issuerExpiry != 0 && c.issuerExpiry < regulatoryExpiry;
        uint64 effectiveExpiry = issuerBinds ? c.issuerExpiry : regulatoryExpiry;

        if (block.timestamp > effectiveExpiry) {
            if (issuerBinds) {
                return (false, ReasonCodes.encode(0, ELEMENT_ID, 4));
            }
            uint32 staleCode = c.claimType == FreshClaimType.QP ? 3 : 2;
            return (false, ReasonCodes.encode(0, ELEMENT_ID, staleCode));
        }

        return (true, bytes32(0));
    }
}
