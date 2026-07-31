// SPDX-License-Identifier: GPL-3.0
pragma solidity 0.8.17;

import {BaseStatefulElement} from "./BaseStatefulElement.sol";
import {BaseElement} from "./BaseElement.sol";
import {IComplianceElement} from "../../interfaces/compliance/IComplianceElement.sol";
import {
    ElementMetadata,
    ElementCategory,
    TemporalNature,
    Decidability,
    ObligationTiming,
    Statefulness
} from "../../types/ComplianceTypes.sol";
import {ReasonCodes} from "../../libraries/ReasonCodes.sol";
import {Errors} from "../../libraries/Errors.sol";

/// @dev F-03-v1 Suspicious Activity Monitoring / Fraud Surveillance (mock,
///      STATEFUL, Pattern C — monitoring, NOT a gate). F-03 does not judge a
///      trade PASS/FAIL; it observes already-settled transfers post-trade,
///      flags the suspicious ones, and hands them to a human (Operator) who
///      decides whether to file a SAR (doc §1.3, §5.1, §8). There are no reject
///      codes — only flag STATE transitions.
///
///      TWO LEGAL LINEAGES CONVERGE HERE (doc §1.1): the securities-fraud axis
///      (Securities Act §17(a) [15 U.S.C. §77q(a)], Exchange Act §10(b)
///      [15 U.S.C. §78j(b)] + Rule 10b-5 [17 CFR §240.10b-5]) defines *what*
///      fraud is, and the BSA SAR axis (§5318(g) [31 U.S.C. §5318(g)] +
///      31 CFR §1023.320) defines *how* a suspicious transaction is reported.
///      F-03 is the detection/flag layer feeding the human SAR judgment.
///
///      ─────────────────────────────────────────────────────────────────────
///      THE §6.4 KEY VULNERABILITY — NO TIPPING-OFF (doc §3.8(e), §6.4, §3.13):
///      31 CFR §1023.320(e) / 31 U.S.C. §5318(g)(2)(A)(i) forbid disclosing a
///      SAR "or any information that would reveal the existence of a SAR" to a
///      party to the transaction. On a *public ledger* this is the architecture
///      pressure point: a public per-wallet flag event is itself a violation.
///      This mock honours that at two levels:
///        (1) PARTY-FACING SURFACE = `check()`. It is `pure` and returns
///            (true, 0) unconditionally — it is *structurally* (compiler-
///            enforced) incapable of reading flag state, so it can never leak
///            one. This is the on-chain-testable core of doc §7 Test 5.
///        (2) `onTransfer` opens auto-detected flags SILENTLY — it emits NO
///            event, because an event in the settlement transaction would
///            itself correlate a flag to that transaction's parties (the exact
///            tipping-off vector). This deliberately diverges from F-02
///            (SurveillanceFlag), which emits a public per-subject event: F-02
///            (market manipulation) carries no §1023.320(e) confidentiality
///            duty; F-03 (fraud/SAR) does.
///      Flag records live in operator-gated storage and are readable ONLY via
///      onlyOperator views. Operator-driven lifecycle transitions (separate
///      transactions, uncorrelated to any trade) emit SUBJECT-OPAQUE events
///      (flagId only, never the subject) for the §5318(h) audit trail — this is
///      the internal sharing that §1023.320(e)(1)(ii) permits.
///
///      ─────────────────────────────────────────────────────────────────────
///      ON-CHAIN vs OPERATOR-ATTESTED DETECTION SPLIT (doc §5.2, §5.5, §4.4):
///        • ON-CHAIN AUTO (`onTransfer`): the one §1023.320(a)(2) category that
///          is computable without off-chain signals — STRUCTURING_EVASION
///          (a)(2)(ii): several sub-$5,000 transfers from one identity that
///          AGGREGATE to >= $5,000 within a rolling window (doc §7.1 Test 1).
///        • OPERATOR-ATTESTED (`attestSuspicion`, onlyOperator): the categories
///          that require off-chain analytics joined from A-01/A-04/A-06/A-12
///          (illicit-funds, no-lawful-purpose, crime-facilitation) and the
///          "attempted"/unsettled transactions that never reach `onTransfer`.
///          This is the documented seam between the on-chain-computable slice
///          and the doc's off-chain surveillance engine (doc §4.3, §11.2).
///      Cross-wallet structuring uses `identityGroupOf` (the A-04 dedup output,
///      operator-attested) so disguised multi-wallets aggregate as one unit
///      (doc §4.2, §9.2). Amount is treated as USD-denominated notional; a
///      production system converts token units -> USD off-chain first.
///
///      ─────────────────────────────────────────────────────────────────────
///      REASON CODES — ReasonCodes.encode(0, ELEMENT_ID, n). n numbers the
///      31 CFR §1023.320(a)(2) suspicion category that OPENED the flag (the
///      "why"); F-03 output is a flag STATE (doc §6.2), not a reject code:
///        1 = ILLICIT_FUNDS        (a)(2)(i)   illegal-source / concealment
///        2 = STRUCTURING_EVASION  (a)(2)(ii)  splitting to evade reporting
///        3 = NO_LAWFUL_PURPOSE    (a)(2)(iii) no business/apparent lawful purpose
///        4 = CRIME_FACILITATION   (a)(2)(iv)  venue used to facilitate crime
///      Flag STATE enum (doc §6.2): NO_FLAG · DETECTED · UNDER_REVIEW ·
///      SAR_FILED · CLEARED · NO_ACTION.
contract FraudSurveillance is BaseStatefulElement {
    bytes32 internal constant ELEMENT_ID = "F-03-v1";

    /// @dev 31 CFR §1023.320(a)(2) suspicion categories. Enum value doubles as
    ///      the reason-code `n` (NONE=0 sentinel; 1..4 == (a)(2)(i)..(iv)).
    enum SuspicionCategory {
        NONE,
        ILLICIT_FUNDS,
        STRUCTURING_EVASION,
        NO_LAWFUL_PURPOSE,
        CRIME_FACILITATION
    }

    /// @dev Flag lifecycle states (doc §6.2). NOT reject codes — F-03 is a
    ///      monitoring element and never blocks a trade.
    enum FlagState {
        NO_FLAG,
        DETECTED,
        UNDER_REVIEW,
        SAR_FILED,
        CLEARED,
        NO_ACTION
    }

    /// @dev Operator/audit-facing flag record. Confidential (doc §6.4): readable
    ///      only through onlyOperator views, never through `check()`.
    struct Flag {
        address subject; // the party under surveillance (the transfers' `from`)
        SuspicionCategory category;
        FlagState state;
        uint64 detectedAt; // "initial detection" clock start (doc §5.4)
        uint64 deadline; // detectedAt + FILE_DEADLINE, extendable to +MAX_DEADLINE
        uint64 filedAt; // 0 until SAR_FILED
        bool suspectIdentified; // false => +30d extension eligible (doc §5.3)
        bool attempted; // (a)(2) "conducted or attempted" — off-chain attested
    }

    /// @dev Per-identity rolling aggregation for the structuring pattern
    ///      (doc §3.7 "pattern of transactions", §5.2 aggregateRecent).
    struct Window {
        uint64 windowStart;
        uint256 total;
        uint256 count;
    }

    /// @dev STATUTORY — 31 CFR §1023.320(a)(2): a transaction is reportable if it
    ///      "involves or aggregates funds or other assets of at least $5,000".
    ///      "at least" is INCLUSIVE (>=): exactly $5,000 crosses the threshold
    ///      (doc §5.3, §7.3). This is not a Decipher policy value.
    uint256 public constant SAR_THRESHOLD = 5000;

    /// @dev STATUTORY — 31 CFR §1023.320(b)(3): a SAR "shall be filed no later
    ///      than 30 calendar days after the date of the initial detection".
    ///      "no later than" is INCLUSIVE (<=): filing on day 30 is timely
    ///      (doc §5.3, §7.3).
    uint64 public constant FILE_DEADLINE = 30 days;

    /// @dev STATUTORY — 31 CFR §1023.320(b)(3): "in no case shall reporting be
    ///      delayed more than 60 calendar days after the date of such initial
    ///      detection." Absolute cap; the +30d suspect-identification extension
    ///      may never push past this (doc §5.3).
    uint64 public constant MAX_DEADLINE = 60 days;

    /// @dev POLICY (detection sensitivity, doc §3.12) — NOT statutory. The
    ///      rolling window over which sub-threshold transfers are aggregated for
    ///      the structuring pattern. Operator-tunable, but the legal 30/60d
    ///      filing clock is unaffected by it.
    uint64 public structuringWindow = 1 days;

    /// @notice Local operator registry (write-gate). `owner` (the deployer,
    ///         inherited from BaseStatefulElement) is governance and always
    ///         counts as an operator. Governed/Ownable is deliberately NOT
    ///         inherited: its `owner()` collides with BaseStatefulElement's
    ///         public `owner` state variable, so the same access model is
    ///         reproduced locally.
    mapping(address => bool) public isOperator;

    /// @dev A-04 (identity dedup) output, operator-attested: maps a wallet to
    ///      the real-world identity group it belongs to, so structuring across
    ///      disguised multi-wallets aggregates as one unit (doc §4.2, §9.2).
    ///      bytes32(0) => ungrouped (aggregate by the wallet address itself).
    mapping(address => bytes32) public identityGroupOf;

    uint256 internal _flagSeq; // monotonic flag id source (0 = "no flag")
    mapping(uint256 => Flag) internal _flags; // CONFIDENTIAL — onlyOperator views
    mapping(bytes32 => Window) internal _window; // per-identity aggregation

    event OperatorSet(address indexed operator, bool enabled);
    event IdentityGroupSet(address indexed wallet, bytes32 indexed group);
    event StructuringWindowSet(uint64 window);

    /// @dev SUBJECT-OPAQUE by design (doc §6.4): carries the flagId and the
    ///      lifecycle state but NEVER the subject address. Emitted only from
    ///      operator transactions (never from `onTransfer`).
    event FlagLifecycle(uint256 indexed flagId, FlagState state, bytes32 reasonCode);
    event DeadlineExtended(uint256 indexed flagId, uint64 newDeadline);

    modifier onlyOwner() {
        if (msg.sender != owner) revert Errors.NotAuthorized();
        _;
    }

    modifier onlyOperator() {
        if (msg.sender != owner && !isOperator[msg.sender]) revert Errors.NotAuthorized();
        _;
    }

    constructor()
        BaseStatefulElement(ElementMetadata({
                elementId: ELEMENT_ID,
                category: ElementCategory.CONDUCT_MONITORING,
                version: "F-03-v1",
                temporal: TemporalNature.CUMULATIVE,
                decidability: Decidability.MONITORING_BASED,
                timing: ObligationTiming.EX_POST_TRIGGER,
                statefulness: Statefulness.STATEFUL
            }))
    {}

    // -----------------------------------------------------------------
    // Governance / operator plane (write-gate, doc §5318(h) program)
    // -----------------------------------------------------------------

    function setOperator(address op, bool enabled) external onlyOwner {
        isOperator[op] = enabled;
        emit OperatorSet(op, enabled);
    }

    /// @notice Records the A-04 identity grouping used to aggregate disguised
    ///         multi-wallets for structuring detection (doc §4.2, §9.2).
    function setIdentityGroup(address wallet, bytes32 group) external onlyOperator {
        identityGroupOf[wallet] = group;
        emit IdentityGroupSet(wallet, group);
    }

    function setStructuringWindow(uint64 window) external onlyOperator {
        structuringWindow = window;
        emit StructuringWindowSet(window);
    }

    // -----------------------------------------------------------------
    // Party-facing surface — NEVER blocks, NEVER leaks (doc §1.3, §6.4)
    // -----------------------------------------------------------------

    /// @notice F-03 is not a gate: `check()` always passes. It is `pure` so it
    ///         is compiler-guaranteed unable to read flag state — the §6.4
    ///         no-tipping-off guarantee on the party-facing surface (doc §7.5).
    function check(address, address, address, uint256, bytes calldata)
        external
        pure
        override(BaseElement, IComplianceElement)
        returns (bool passed, bytes32 reasonCode)
    {
        return (true, bytes32(0));
    }

    // -----------------------------------------------------------------
    // Post-trade detection pipeline (doc §5.2) — on-chain-computable slice
    // -----------------------------------------------------------------

    /// @dev Engine commit hook (post-trade). `from` = seller (doc: engine
    ///      passes ctx.seller). Implements the amount threshold + rolling
    ///      structuring aggregation of the doc §5.2 pseudocode. Opens
    ///      auto-detected structuring flags SILENTLY (no event — §6.4). Never
    ///      reverts, never blocks: monitoring only.
    function onTransfer(address from, address, uint256 amount) external override onlyEngine {
        bytes32 key = _groupKey(from);
        Window memory w = _window[key];

        // Roll the window forward if the prior one has aged out (doc §5.4).
        if (w.windowStart == 0 || block.timestamp - w.windowStart > structuringWindow) {
            w.windowStart = uint64(block.timestamp);
            w.total = 0;
            w.count = 0;
        }
        w.total += amount;
        w.count += 1;

        // [1] Amount alone is NOT suspicious (doc §7.2 Test 2: a large but
        //     ordinary trade is NO_FLAG). The only category computable purely
        //     on-chain is STRUCTURING_EVASION (a)(2)(ii): >= 2 sub-threshold
        //     pieces that AGGREGATE to >= $5,000 (>=, inclusive) within the
        //     window. A single >= $5,000 transfer is not structuring.
        if (amount < SAR_THRESHOLD && w.count >= 2 && w.total >= SAR_THRESHOLD) {
            _openFlag(from, SuspicionCategory.STRUCTURING_EVASION, false);
            delete _window[key]; // reset so we do not re-flag every later transfer
            return;
        }

        _window[key] = w;
    }

    // -----------------------------------------------------------------
    // Operator-attested detection (off-chain analytics seam, doc §5.5, §4.4)
    // -----------------------------------------------------------------

    /// @notice Opens a flag for an off-chain-detected suspicion (illicit-funds,
    ///         no-lawful-purpose, crime-facilitation, or an attempted/unsettled
    ///         transaction). This is the seam to the doc's off-chain engine
    ///         (doc §4.3, §5.5, §11.2): the machine surfaces the signal, the
    ///         Operator attests it here.
    /// @param  amount        involved/aggregated USD notional (doc §7.3 boundary
    ///                        is enforced: >= $5,000 opens; below returns 0).
    /// @param  suspectKnown  whether a suspect is identified at initial
    ///                        detection; if false the +30d extension is
    ///                        available (doc §5.3, §1023.320(b)(3)).
    /// @return flagId        the opened flag id, or 0 if below the threshold.
    function attestSuspicion(
        address subject,
        SuspicionCategory category,
        uint256 amount,
        bool attempted,
        bool suspectKnown
    ) external onlyOperator returns (uint256 flagId) {
        if (category == SuspicionCategory.NONE) revert Errors.NotAuthorized();

        // 31 CFR §1023.320(a)(2) "at least $5,000" — inclusive (doc §5.3, §7.3).
        if (amount < SAR_THRESHOLD) return 0;

        flagId = _openFlag(subject, category, attempted);
        Flag storage f = _flags[flagId];
        f.suspectIdentified = suspectKnown;

        // Operator transaction (uncorrelated to any trade) — safe to emit a
        // subject-opaque lifecycle event (doc §6.4, §1023.320(e)(1)(ii)).
        emit FlagLifecycle(flagId, FlagState.DETECTED, _reasonCode(category));
    }

    // -----------------------------------------------------------------
    // Flag lifecycle / escalation (doc §6.2, §6.3) — all operator-gated
    // -----------------------------------------------------------------

    /// @notice DETECTED -> UNDER_REVIEW (doc §6.2: enters the Operator queue).
    function openReview(uint256 flagId) external onlyOperator {
        Flag storage f = _flags[flagId];
        if (f.state != FlagState.DETECTED) revert Errors.NotAuthorized();
        f.state = FlagState.UNDER_REVIEW;
        emit FlagLifecycle(flagId, FlagState.UNDER_REVIEW, _reasonCode(f.category));
    }

    /// @notice Extend to the +30d (max 60d) window when no suspect was
    ///         identified at initial detection (31 CFR §1023.320(b)(3), doc
    ///         §5.3). Callable once; may never exceed MAX_DEADLINE.
    function extendDeadline(uint256 flagId) external onlyOperator {
        Flag storage f = _flags[flagId];
        if (f.state != FlagState.DETECTED && f.state != FlagState.UNDER_REVIEW) revert Errors.NotAuthorized();
        if (f.suspectIdentified) revert Errors.NotAuthorized(); // extension only if suspect unknown
        if (f.deadline != f.detectedAt + FILE_DEADLINE) revert Errors.NotAuthorized(); // already extended
        f.deadline = f.detectedAt + MAX_DEADLINE;
        emit DeadlineExtended(flagId, f.deadline);
    }

    /// @notice Marks the suspect identified (closes the +30d extension path).
    function identifySuspect(uint256 flagId) external onlyOperator {
        _flags[flagId].suspectIdentified = true;
    }

    /// @notice Human decision: suspicion confirmed -> SAR filed with FinCEN
    ///         (31 CFR §1023.320(a)(1), safe harbor §5318(g)(3)). Records the
    ///         filing time so timeliness against the deadline is auditable.
    function fileSar(uint256 flagId) external onlyOperator {
        Flag storage f = _flags[flagId];
        if (f.state != FlagState.DETECTED && f.state != FlagState.UNDER_REVIEW) revert Errors.NotAuthorized();
        f.state = FlagState.SAR_FILED;
        f.filedAt = uint64(block.timestamp);
        emit FlagLifecycle(flagId, FlagState.SAR_FILED, _reasonCode(f.category));
    }

    /// @notice Human decision: reasonable explanation found -> closed cleared
    ///         (§5318(g)(1); doc §6.2).
    function clearFlag(uint256 flagId) external onlyOperator {
        Flag storage f = _flags[flagId];
        if (f.state != FlagState.DETECTED && f.state != FlagState.UNDER_REVIEW) revert Errors.NotAuthorized();
        f.state = FlagState.CLEARED;
        emit FlagLifecycle(flagId, FlagState.CLEARED, _reasonCode(f.category));
    }

    /// @notice Reportable but closed with no SAR under a §1023.320(c) exception
    ///         (e.g. robbery/theft already reported through another channel);
    ///         the basis must be recorded/retained off-chain (doc §6.2).
    function closeNoAction(uint256 flagId) external onlyOperator {
        Flag storage f = _flags[flagId];
        if (f.state != FlagState.DETECTED && f.state != FlagState.UNDER_REVIEW) revert Errors.NotAuthorized();
        f.state = FlagState.NO_ACTION;
        emit FlagLifecycle(flagId, FlagState.NO_ACTION, _reasonCode(f.category));
    }

    // -----------------------------------------------------------------
    // CONFIDENTIAL views (doc §6.4) — onlyOperator; never party-facing
    // -----------------------------------------------------------------

    function flagCount() external view onlyOperator returns (uint256) {
        return _flagSeq;
    }

    /// @dev Full flag record incl. the subject — the tipping-off-sensitive data.
    ///      Gated so a trade party cannot read it (doc §6.4, §7.5).
    function flagOf(uint256 flagId) external view onlyOperator returns (Flag memory) {
        return _flags[flagId];
    }

    function reasonCodeOf(uint256 flagId) external view onlyOperator returns (bytes32) {
        return _reasonCode(_flags[flagId].category);
    }

    /// @dev True once SAR filed AND filed within the 30/60d window (<=, doc
    ///      §5.3). day-30 filing => timely; day-31 => late (BSA violation).
    function filedOnTime(uint256 flagId) external view onlyOperator returns (bool) {
        Flag memory f = _flags[flagId];
        return f.filedAt != 0 && f.filedAt <= f.deadline;
    }

    /// @dev Escalation view (doc §6.3): an open flag past its deadline. Feeds
    ///      the internal Operator dashboard, never a party-facing surface.
    function isOverdue(uint256 flagId) external view onlyOperator returns (bool) {
        Flag memory f = _flags[flagId];
        bool open = f.state == FlagState.DETECTED || f.state == FlagState.UNDER_REVIEW;
        return open && block.timestamp > f.deadline;
    }

    // -----------------------------------------------------------------
    // internals
    // -----------------------------------------------------------------

    function _openFlag(address subject, SuspicionCategory category, bool attempted) internal returns (uint256 flagId) {
        flagId = ++_flagSeq;
        uint64 nowTs = uint64(block.timestamp);
        _flags[flagId] = Flag({
            subject: subject,
            category: category,
            state: FlagState.DETECTED,
            detectedAt: nowTs, // initial-detection clock starts now (doc §5.4)
            deadline: nowTs + FILE_DEADLINE, // 30 calendar days (doc §5.3)
            filedAt: 0,
            suspectIdentified: true, // default; attestSuspicion may override
            attempted: attempted
        });
    }

    function _groupKey(address wallet) internal view returns (bytes32) {
        bytes32 g = identityGroupOf[wallet];
        return g != bytes32(0) ? g : bytes32(uint256(uint160(wallet)));
    }

    function _reasonCode(SuspicionCategory category) internal pure returns (bytes32) {
        return ReasonCodes.encode(0, ELEMENT_ID, uint32(category));
    }
}
