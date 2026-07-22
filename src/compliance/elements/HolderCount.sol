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

/// @dev Element-local minimal views over A-04 (identity dedup) and A-03 (AI). Repo
///      precedent (IdentityUniqueness) prefers element-local interface declarations
///      to new interface files.
interface IIdentityView {
    function identityOf(address wallet) external view returns (bytes32);
}

interface IAiView {
    function accredited(address user) external view returns (bool);
}

/// @dev D-01-v1 Holder count (mock, STATEFUL). Counts held-of-record *persons*
///      (ONCHAINID, not wallets) of one equity-security class and gates trades that
///      would push the resulting count past an active exemption threshold.
///
///      Legal frame: the numeric caps are NOT a §3(c)(7) headcount limit (§3(c)(7)
///      has none). TWELVE_G stands in for the Exchange Act §12(g)/Rule 12g-1 public-
///      company registration trigger (held of record < 2,000 and non-AI < 500),
///      THREE_C_1 for ICA §3(c)(1)'s <= 100 beneficial owners, FIVE_06_B for Rule
///      506(b)(2)(i)'s <= 35 purchasers. Only TWELVE_G is live for the BUIDL-like
///      demo class; the other two are library completeness.
///
///      법문 트리거 vs 운영 게이트: the §12(g) registration duty is NOT real-time —
///      it attaches as of the last day of the first fiscal year in which the
///      asset+holder conditions are met (§12(g)(1); Rule 12g-1 reads "most recent
///      fiscal year"). This element's per-trade pre-trade gate is therefore a
///      conservative OPERATIONAL guard against fiscal-year-end registration risk,
///      not an implementation of "the 2,000th holder triggers registration on the
///      spot". Reaching a cap here means "operationally blocked", not "instantly
///      unlawful".
///
///      Deployment scope: IStatefulElement.onTransfer(from,to,amount) carries no
///      asset param, so ONE instance tracks ONE share class — deploy one per asset.
///      This element counts and gates only; qualification (QP/AI) is A-13/A-03,
///      person<->wallet mapping is A-04. It never re-adjudicates those.
///
///      reasonCode table (n -> doc §6.1 failure-code name):
///        1  HOLDER_CAP_12G_TOTAL   resulting held-of-record >= 2000
///        2  HOLDER_CAP_12G_NONAI   resulting non-AI holders  >= 500
///        3  HOLDER_CAP_3C1_100     resulting beneficial owners > 100
///        4  HOLDER_CAP_506B_35     resulting purchasers        > 35
///
///      Auth: extends BaseStatefulElement only (as SurveillanceFlag does), NOT
///      Governed. BaseStatefulElement already declares `address public owner`,
///      whose auto-getter collides with Ownable.owner() and makes co-inheriting
///      Governed uncompilable without editing a base (forbidden). The onlyOperator
///      gate is therefore replicated locally against BaseStatefulElement.owner,
///      giving the same owner+operator write-gate Governed would.
contract HolderCount is BaseStatefulElement {
    bytes32 internal constant ELEMENT_ID = "D-01-v1";

    // Local operator gate (see Auth note): mirrors Governed's semantics but keys
    // off BaseStatefulElement.owner instead of Ownable, avoiding the owner()/owner
    // clash. owner (deployer) or any enabled operator may write state inputs.
    mapping(address => bool) public isOperator;

    modifier onlyOperator() {
        if (!isOperator[msg.sender] && msg.sender != owner) revert Errors.NotAuthorized();
        _;
    }

    /// @dev Active cap regime for this class (§5.3 inequality discipline lives in
    ///      _capBreachCode). NONE => element dormant (always PASS).
    enum CapMode {
        NONE,
        TWELVE_G,
        THREE_C_1,
        FIVE_06_B
    }

    // Statutory thresholds (doc §5.3). The comparison operator is part of each
    // constant's meaning: §12(g)/12g-1 keep the count strictly BELOW (">=" fails),
    // §3(c)(1)/506(b) allow reaching the cap (">" fails).
    uint256 internal constant CAP_12G_TOTAL = 2000; // >= 2000 fails (< 2000 safe)
    uint256 internal constant CAP_12G_NONAI = 500; // >= 500 fails  (< 500 safe)
    uint256 internal constant CAP_3C1 = 100; // > 100 fails (<= 100 safe)
    uint256 internal constant CAP_506B = 35; // > 35 fails  (<= 35 safe)

    IIdentityView public immutable identity; // A-04 dedup source
    IAiView public immutable ai; // A-03 accreditation source

    CapMode public capMode;
    /// @dev §12(g) $10M total-assets gate, attested off-chain (B-01/manifest). Only
    ///      consulted in TWELVE_G mode: if false, Rule 12g-1(a) exemption => PASS.
    bool public assetGateMet;

    // --- accumulated state (§5.3) ---
    uint256 public holderCount; // held-of-record persons
    uint256 public nonAiCount; // non-accredited holders (12g-1(b)(1))
    /// @dev per-person summed balance; a person is a holder iff this is > 0.
    mapping(bytes32 => uint256) public balanceOfIdentity;
    /// @dev AI-ness SNAPSHOTTED at entry. Invariant: the exit decrement of
    ///      nonAiCount uses THIS snapshot, never a live A-03 read, so a later
    ///      AccreditedInvestor flip cannot desync the counter.
    mapping(bytes32 => bool) public countedNonAi;

    error ZeroDependency();

    event OperatorSet(address indexed operator, bool enabled);
    event CapModeSet(CapMode capMode);
    event AssetGateSet(bool met);
    /// @dev Emitted by onTransfer on each holder entry (+1) / exit (-1).
    event HolderCountChanged(
        bytes32 indexed identityId, address indexed wallet, bool entered, uint256 holderCount, uint256 nonAiCount
    );

    constructor(CapMode capMode_, IIdentityView identity_, IAiView ai_)
        BaseStatefulElement(ElementMetadata({
                elementId: ELEMENT_ID,
                category: ElementCategory.SYSTEM_STATE,
                version: "D-01-v1",
                temporal: TemporalNature.CUMULATIVE,
                decidability: Decidability.DETERMINISTIC,
                timing: ObligationTiming.AT_TRADE_GATE,
                statefulness: Statefulness.STATEFUL
            }))
    {
        if (address(identity_) == address(0) || address(ai_) == address(0)) revert ZeroDependency();
        identity = identity_;
        ai = ai_;
        capMode = capMode_;
    }

    /// @dev owner-gated (matches BaseStatefulElement.setEngine's owner gate).
    function setOperator(address op, bool enabled) external {
        if (msg.sender != owner) revert Errors.NotAuthorized();
        isOperator[op] = enabled;
        emit OperatorSet(op, enabled);
    }

    function setCapMode(CapMode capMode_) external onlyOperator {
        capMode = capMode_;
        emit CapModeSet(capMode_);
    }

    function setAssetGateMet(bool met) external onlyOperator {
        assetGateMet = met;
        emit AssetGateSet(met);
    }

    /// @dev Resolve a wallet to its counting unit. Unbound (identityOf == 0) => the
    ///      wallet is its own identity (Rule 12g5-1(a): a record holder counts as 1).
    function _identity(address wallet) internal view returns (bytes32) {
        bytes32 id = identity.identityOf(wallet);
        return id == bytes32(0) ? bytes32(uint256(uint160(wallet))) : id;
    }

    /// @dev Prospective-entrant boundary test (doc §5.3). Returns the failing code
    ///      (0 = PASS) for adding `buyer` as a NEW holder given current counters.
    ///      Cheapest-first: NONE, then the TWELVE_G asset-gate bypass, then compare.
    function _capBreachCode(address buyer) internal view returns (uint32) {
        CapMode mode = capMode;
        if (mode == CapMode.NONE) return 0;

        if (mode == CapMode.TWELVE_G) {
            if (!assetGateMet) return 0; // Rule 12g-1(a) exemption
            if (holderCount + 1 >= CAP_12G_TOTAL) return 1;
            // Non-AI budget is only consumed by non-accredited entrants.
            if (!ai.accredited(buyer) && nonAiCount + 1 >= CAP_12G_NONAI) return 2;
            return 0;
        }
        if (mode == CapMode.THREE_C_1) {
            return holderCount + 1 > CAP_3C1 ? 3 : 0;
        }
        // FIVE_06_B
        return holderCount + 1 > CAP_506B ? 4 : 0;
    }

    /// @dev Pre-trade gate. `user` is the buyer. view: no events here (§ check is
    ///      view); state-change events live in onTransfer.
    function check(address user, address, address, uint256 amount, bytes calldata)
        external
        view
        override(BaseElement, IComplianceElement)
        returns (bool passed, bytes32 reasonCode)
    {
        if (amount == 0) return (true, bytes32(0)); // no count effect
        if (balanceOfIdentity[_identity(user)] > 0) return (true, bytes32(0)); // P1: already a holder
        uint32 code = _capBreachCode(user);
        if (code == 0) return (true, bytes32(0));
        return (false, ReasonCodes.encode(0, ELEMENT_ID, code));
    }

    /// @dev Post-trade commit (onlyEngine via BaseStatefulElement). Entry +1 / exit
    ///      -1 with per-identity balance bookkeeping. from == 0 is mint (no exit
    ///      side), to == 0 is burn (no entry side). Re-validates the cap at commit
    ///      time (gate-to-commit race defense, doc §8.3) and reverts on breach.
    function onTransfer(address from, address to, uint256 amount) external override onlyEngine {
        if (amount == 0) return;

        // Snapshot pre-mutation facts (entry detection + exit-transition guard).
        bytes32 idTo;
        bool newHolder;
        if (to != address(0)) {
            idTo = _identity(to);
            newHolder = balanceOfIdentity[idTo] == 0;
        }
        bytes32 idFrom;
        uint256 fromBalBefore;
        if (from != address(0)) {
            idFrom = _identity(from);
            fromBalBefore = balanceOfIdentity[idFrom];
        }

        // Entry: re-validate the cap, then +1 and snapshot AI-ness.
        if (to != address(0) && newHolder) {
            uint32 code = _capBreachCode(to);
            if (code != 0) revert Errors.ComplianceRejected(ReasonCodes.encode(0, ELEMENT_ID, code));
            holderCount += 1;
            bool nonAi = !ai.accredited(to);
            countedNonAi[idTo] = nonAi;
            if (nonAi) nonAiCount += 1;
            emit HolderCountChanged(idTo, to, true, holderCount, nonAiCount);
        }

        // Balance bookkeeping: mirror the amount the engine reports, floor the
        // debit at the holder's balance so a stale/over-reported amount can never
        // underflow. from and to may share an identity (net-zero) — handled by
        // reading fromBalBefore before the credit.
        if (from != address(0)) {
            uint256 dec = amount > fromBalBefore ? fromBalBefore : amount;
            balanceOfIdentity[idFrom] = fromBalBefore - dec;
        }
        if (to != address(0)) {
            balanceOfIdentity[idTo] += amount;
        }

        // Exit: from's identity balance transitioned to 0. Decrement nonAiCount by
        // the ENTRY snapshot, not a live read, then clear it.
        if (from != address(0) && fromBalBefore > 0 && balanceOfIdentity[idFrom] == 0) {
            holderCount -= 1;
            if (countedNonAi[idFrom]) nonAiCount -= 1;
            delete countedNonAi[idFrom];
            emit HolderCountChanged(idFrom, from, false, holderCount, nonAiCount);
        }
    }
}
