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
import {Events} from "../../libraries/Events.sol";

/// @dev A-12-v1 Red Flag Knowledge Bar (모름 항변 차단, willful-blindness blocker,
///      mock). Pattern C — a monitoring element that MARKS (표시) and never
///      BLOCKS. It screens a single pre-trade for objective red flags that would
///      defeat a later "we didn't know" defense, and routes any hit to the
///      operator review queue with an on-chain audit-trail event. It does NOT
///      adjudicate legality: whether a marked signal is an actual underwriter
///      conduit / wash sale / structuring is a scienter/intent question left to
///      humans (doc §5.5, §8.2).
///
///      BASE CHOICE (doc §2 meta box: Stateful? == STATELESS). A-12's trade-time
///      judgment reads only per-transaction facts; it does NOT accumulate a
///      cross-trade counter — time-series wash/spoofing accrual is F-02/F-03's
///      job (doc §3.10 note, §5.4, §9.6). So A-12 extends BaseElement (STATELESS,
///      no `onTransfer` write path), NOT BaseStatefulElement. This deliberately
///      DIVERGES from F-02 (SurveillanceFlag), which is STATEFUL/post-trade
///      (EX_POST_TRIGGER) precisely because it accrues; A-12 is pre-trade
///      (AT_TRADE_GATE). Operator/off-chain attestation of the screen result is
///      held in element state (a stateless per-tx read, same shape as A-11
///      ClaimFreshness), gated by Governed's onlyOperator — there is no
///      engine-driven state write, hence no onlyEngine gate.
///
///      BLOCKING SEMANTICS (doc §5.5, §6, meta box "출력: {CLEAR, FLAG, REVIEW} —
///      BLOCK 없음"). `check()` ALWAYS returns (true, bytes32(0)) — A-12 alone
///      never rejects a trade, and never leaks a red-flag detail in the
///      party-facing reason code (message separation, doc §6.4: parties see only
///      a neutral "under further review"). The CLEAR/FLAG/REVIEW disposition and
///      the specific flag mask are surfaced OUT-OF-BAND via `screen()` /
///      `dispositionOf()` / `routesToReview()` and the on-chain SurveillanceFlag
///      events (the internal record + audit trail). Whether a flagged trade
///      proceeds or is suspended is a Recipe/operator decision, not A-12's.
///
///      DISPOSITION VALUES (doc §6.1). CLEAR = no red flag. FLAG = one or more
///      *categorized* red flags → operator queue. REVIEW = present-but-not-
///      cleanly-categorizable (REVIEW_REDFLAG_UNCERTAIN) → operator queue direct.
///      Doc §5.2 pseudocode and the §7 prose use "disposition = REVIEW" loosely
///      to mean "routed to the operator review queue"; both FLAG and REVIEW route
///      there, which `routesToReview()` captures. A false-positive resolution
///      (doc §7.5) normalizes the disposition to CLEAR while RETAINING the raw
///      flag mask for the audit trail (the objective signal was still real).
///
///      MOCK BOUNDARY (doc §4, §8.2, §10, §11). In production the seven-category
///      screen is computed by off-chain surveillance/analytics (cross-referencing
///      A-06 affiliate status, A-03/A-13 claims, A-04 owner clusters, C-08/D-01
///      thresholds, and an NAV oracle — doc §4.2) which drives the flag raise;
///      here an operator attests the screen result via `raiseFlag`. Activation
///      gating — resale-axis flags presuppose R2 + affiliate seller, market-axis
///      flags presuppose R4 (doc §5.2 step 1, §9.3) — is likewise an off-chain
///      screening concern in this mock: A-12 records whatever the attesting
///      surveillance layer deems applicable. A-12 never (re)judges affiliate
///      status, AI/QP eligibility, or cluster membership — those belong to A-06 /
///      A-03·A-13 / A-04 (doc §9.6); it only marks facts that contradict/monitor
///      them.
///
///      Reason code map — `n` in `ReasonCodes.encode(0, ELEMENT_ID, n)` -> doc
///      §6.2 code name, in doc §5.2 evaluation order (bit i == RedFlag(i) ==
///      code i+1). Every code is a MARK, never a block:
///        1 | FLAG_RESALE_INTENT       RESALE          §2(a)(11)·§4(d)(7)·Rule 502(d)(1)
///        2 | FLAG_CONTROL_UNDISCLOSED RESALE          §4(d)(3)(K)·§2(a)(11)
///        3 | FLAG_AI_INCONSISTENT     RESALE          §4(d)(1)·§201(a)·Rule 506(c)
///        4 | FLAG_WASH_CLUSTER        MARKET_CONDUCT  §17(a)(3)·Rule 10b-5(c)·§9(a)
///        5 | FLAG_STRUCTURING         MARKET_CONDUCT  §17(a)(3)·Rule 10b-5(c)
///        6 | FLAG_PRICE_ANOMALY       MARKET_CONDUCT  §17(a)·Rule 10b-5·§9(a)
///        7 | FLAG_SUSPICIOUS_PATTERN  MARKET_CONDUCT  §17(a)(3)·Rule 10b-5(c)
///        8 | REVIEW_REDFLAG_UNCERTAIN common          ambiguous/composite → operator queue
contract RedFlagKnowledgeBar is BaseElement, Governed {
    bytes32 internal constant ELEMENT_ID = "A-12-v1";

    /// @dev Reason code carried when the operator marks the screen ambiguous /
    ///      composite (doc §6.2 REVIEW_REDFLAG_UNCERTAIN). Not a RedFlag bit — it
    ///      is a disposition marker, held in `Assessment.uncertain`.
    uint32 internal constant REVIEW_UNCERTAIN_CODE = 8;

    /// @dev The two legal axes A-12 straddles (doc §1.3, §3.11 "redFlag.axis").
    ///      RESALE = underwriter/conduit safe-harbor axis (R2). MARKET_CONDUCT =
    ///      antifraud/manipulation axis (R4).
    enum Axis {
        RESALE,
        MARKET_CONDUCT
    }

    /// @dev The seven objective red-flag categories (doc §3.10 매트릭스, §6.2), in
    ///      doc §5.2 evaluation order. RedFlag(i) -> reason code (i + 1). Indices
    ///      0..2 are the RESALE axis; 3..6 are the MARKET_CONDUCT axis.
    enum RedFlag {
        RESALE_INTENT, // 0 -> code 1 — conduit / resale-for-others
        CONTROL_UNDISCLOSED, // 1 -> code 2 — (d)(3)(K) cert absent/contradicted
        AI_INCONSISTENT, // 2 -> code 3 — eligibility claim vs trade-time facts
        WASH_CLUSTER, // 3 -> code 4 — both parties in one owner cluster
        STRUCTURING, // 4 -> code 5 — threshold-adjacent order splitting
        PRICE_ANOMALY, // 5 -> code 6 — execution price deviates from NAV
        SUSPICIOUS_PATTERN // 6 -> code 7 — other objective manipulation signal
    }

    /// @dev Operator triage outcome (doc §6.3 step 5). Only CLEARED_FALSE_POSITIVE
    ///      normalizes the disposition back to CLEAR (doc §7.5). RISK_CONFIRMED and
    ///      BOUNDARY_ESCALATED are recorded but do NOT change A-12's output — A-12
    ///      never blocks, so any suspend/SAR is a Recipe/operator action outside
    ///      this element (doc §5.5, §6.1).
    enum Resolution {
        PENDING, // 0 = not yet triaged (default)
        CLEARED_FALSE_POSITIVE, // 해소 → disposition CLEAR (raw mask retained)
        RISK_CONFIRMED, // 위험 확인 → suspend/SAR handled off-element
        BOUNDARY_ESCALATED // 경계 → lawyer escalate; stays under review
    }

    /// @dev The party-facing outcome type (doc §6.1). See the header note on how
    ///      FLAG vs REVIEW both route to the operator queue.
    enum Disposition {
        CLEAR,
        FLAG,
        REVIEW
    }

    /// @dev Per-transaction screen record, keyed [seller][buyer]. The pair is the
    ///      unit A-12 screens (doc §4.2, §5.2): resale flags concern the affiliate
    ///      seller, wash-cluster concerns both sides. `flagMask` is the raw union
    ///      of raised categories and is kept even after a false-positive clear so
    ///      the audit trail shows "we saw it and a human cleared it" (doc §7.5).
    struct Assessment {
        uint8 flagMask; // bit i set == RedFlag(i) raised
        bool uncertain; // REVIEW_REDFLAG_UNCERTAIN marked
        Resolution resolution; // operator triage outcome
    }

    /// @notice seller => buyer => attested red-flag screen result.
    mapping(address => mapping(address => Assessment)) internal _assessment;

    /// @notice Operator resolution of a prior marking (doc §6.3). CLEARED_FALSE_
    ///         POSITIVE also emitted via Disposition normalization in `screen`.
    event ReviewResolved(address indexed seller, address indexed buyer, Resolution resolution);

    constructor()
        BaseElement(ElementMetadata({
                elementId: ELEMENT_ID,
                // Pattern C surveillance (doc §2 검증 패턴 C, §8.1). The doc's "도메인"
                // is A (identity/eligibility), but the on-chain ElementCategory
                // reflects the verification pattern — monitoring, like F-02.
                category: ElementCategory.CONDUCT_MONITORING,
                version: "A-12-v1",
                temporal: TemporalNature.REALTIME, // per-trade, not accrued (doc §5.4)
                decidability: Decidability.MONITORING_BASED, // Pattern C — human judges legality
                timing: ObligationTiming.AT_TRADE_GATE, // pre-trade screen (doc §2 Timing)
                statefulness: Statefulness.STATELESS // doc §2 meta box (accrual is F-02/F-03)
            }))
    {}

    // -----------------------------------------------------------------
    // Operator write path (doc §6.3, §7.5). All onlyOperator. In production
    // these calls are driven by the off-chain surveillance layer, not a human
    // typing them (doc §8.2, §11).
    // -----------------------------------------------------------------

    /// @notice Marks a categorized red flag on the (seller, buyer) trade and
    ///         records it on-chain as the reasonable-inquiry audit trail (doc
    ///         §1.4, §6.2). Idempotent per category (bit OR). A fresh mark
    ///         reopens triage (resolution -> PENDING).
    /// @dev Emits Events.SurveillanceFlag with subject == seller (the resale /
    ///      market-conduct subject; same convention as F-02's `from`). The buyer
    ///      side of the pair lives in the queryable `_assessment` record.
    function raiseFlag(address seller, address buyer, RedFlag flag) external onlyOperator {
        Assessment storage a = _assessment[seller][buyer];
        a.flagMask |= uint8(1) << uint8(flag);
        a.resolution = Resolution.PENDING;
        emit Events.SurveillanceFlag(ELEMENT_ID, seller, _code(uint32(flag) + 1));
    }

    /// @notice Marks the screen ambiguous/composite → REVIEW_REDFLAG_UNCERTAIN
    ///         (doc §6.2, §11.4): route straight to the operator queue without a
    ///         clean category. Reopens triage.
    function markUncertain(address seller, address buyer) external onlyOperator {
        Assessment storage a = _assessment[seller][buyer];
        a.uncertain = true;
        a.resolution = Resolution.PENDING;
        emit Events.SurveillanceFlag(ELEMENT_ID, seller, _code(REVIEW_UNCERTAIN_CODE));
    }

    /// @notice Records the operator's triage outcome for a prior marking (doc
    ///         §6.3 step 5). CLEARED_FALSE_POSITIVE normalizes the disposition to
    ///         CLEAR (doc §7.5) while keeping the raw flag mask for audit; other
    ///         outcomes are recorded without changing A-12's output (A-12 never
    ///         blocks — suspend/SAR is handled elsewhere).
    function resolveReview(address seller, address buyer, Resolution resolution) external onlyOperator {
        _assessment[seller][buyer].resolution = resolution;
        emit ReviewResolved(seller, buyer, resolution);
    }

    // -----------------------------------------------------------------
    // Trade-gate entry (party-facing) — NEVER blocks, NEVER leaks (doc §5.5, §6.4).
    // -----------------------------------------------------------------

    /// @dev A-12 marks, it does not gate: `check` unconditionally passes with a
    ///      neutral reason code. The disposition/flags are read out-of-band via
    ///      `screen`. All params ignored — the party-facing surface carries no
    ///      red-flag detail (message separation, doc §6.4).
    function check(address, address, address, uint256, bytes calldata)
        external
        pure
        override
        returns (bool passed, bytes32 reasonCode)
    {
        return (true, bytes32(0));
    }

    // -----------------------------------------------------------------
    // Screen read-out (internal record / operator + Recipe consumption).
    // -----------------------------------------------------------------

    /// @notice The A-12 disposition and raw flag mask for a (seller, buyer) trade
    ///         (doc §5.2 step 4, §6.1). `flagMask` is always the raw union of
    ///         raised categories, even when the disposition has been normalized to
    ///         CLEAR by a false-positive resolution (doc §7.5 audit retention).
    function screen(address seller, address buyer) public view returns (Disposition disposition, uint8 flagMask) {
        Assessment storage a = _assessment[seller][buyer];
        flagMask = a.flagMask;
        if (a.resolution == Resolution.CLEARED_FALSE_POSITIVE) {
            return (Disposition.CLEAR, flagMask); // operator normalized (doc §7.5)
        }
        if (a.uncertain) {
            return (Disposition.REVIEW, flagMask); // REVIEW_REDFLAG_UNCERTAIN (doc §6.2)
        }
        if (flagMask != 0) {
            return (Disposition.FLAG, flagMask); // categorized → operator queue (doc §6.1)
        }
        return (Disposition.CLEAR, flagMask);
    }

    /// @notice The disposition only.
    function dispositionOf(address seller, address buyer) external view returns (Disposition disposition) {
        (disposition,) = screen(seller, buyer);
    }

    /// @notice True when the trade routes to the operator review queue — i.e. the
    ///         disposition is FLAG or REVIEW (doc §6.3). This is the operational
    ///         sense of doc §5.2/§7's "disposition = REVIEW".
    function routesToReview(address seller, address buyer) external view returns (bool) {
        (Disposition disposition,) = screen(seller, buyer);
        return disposition != Disposition.CLEAR;
    }

    /// @notice Raw stored record (raw mask + uncertain marker + triage outcome),
    ///         independent of disposition normalization — the full internal-audit
    ///         view (doc §6.4).
    function assessmentOf(address seller, address buyer)
        external
        view
        returns (uint8 flagMask, bool uncertain, Resolution resolution)
    {
        Assessment storage a = _assessment[seller][buyer];
        return (a.flagMask, a.uncertain, a.resolution);
    }

    /// @notice The audit reason code for a category (doc §6.2), for off-chain
    ///         (recipeId, elementId, code) recomputation/matching (ReasonCodes note).
    function reasonCodeFor(RedFlag flag) external pure returns (bytes32) {
        return _code(uint32(flag) + 1);
    }

    /// @notice The audit reason code for REVIEW_REDFLAG_UNCERTAIN (doc §6.2).
    function reviewUncertainCode() external pure returns (bytes32) {
        return _code(REVIEW_UNCERTAIN_CODE);
    }

    /// @notice The legal axis of a category (doc §3.11): 0..2 RESALE, 3..6 MARKET.
    function axisOf(RedFlag flag) external pure returns (Axis) {
        return uint8(flag) <= uint8(RedFlag.AI_INCONSISTENT) ? Axis.RESALE : Axis.MARKET_CONDUCT;
    }

    /// @dev recipeId 0 is a placeholder; off-chain audit re-encodes with the real
    ///      contributing recipeId (ReasonCodes M4 propagation note).
    function _code(uint32 n) private pure returns (bytes32) {
        return ReasonCodes.encode(0, ELEMENT_ID, n);
    }
}
