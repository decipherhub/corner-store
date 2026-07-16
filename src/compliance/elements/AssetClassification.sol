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

/// @dev B-01-v1 Manifest Integrity (mock), upgraded to the doc §5.2–§5.4
///      "asset card integrity" spec. B-01 is not a per-requirement gate: it
///      guards the common precondition every other element's decision stands
///      on — that the asset's manifest (신상카드) is present, approved, free of
///      internal contradiction, and fresh (doc §1.2–§1.4). The legacy
///      classification match is preserved here as invariant INV-C
///      (classification must equal `requiredClassification`, doc §3.4/§5.2 ④).
///
///      Legacy compatibility (non-negotiable, see wave-2b plan header):
///      `setClassification(address,bytes32)` keeps its exact signature and its
///      legacy happy-path effect — it alone writes a fully-live card (ACTIVE,
///      version 1 approved as version 1, approvedAt = now with the default
///      zero activation delay, factsAsOf = now, maxFactAge 0 = freshness
///      disabled) that PASSes `check` with no further calls. The
///      `requiredClassification` immutable and its constructor zero-guard are
///      kept as-is, and `classificationOf(address)` is preserved as a view over
///      the card's `classification` field so callers that read the old public
///      mapping getter (integration helpers, CLI) keep compiling. New
///      strictness (suspension, version approval, time-lock, freshness) is
///      operator-set through `setCard`/`setActivationDelay` and defaults to the
///      fully-live/off state, so no currently-passing flow starts failing.
///
///      Mock boundary: production B-01 reads the REAL manifest registry
///      (TokenPolicyRegistry / ManifestCore) plus an off-chain hash-reconciliation
///      watcher (doc §5.1 channel 2, §3.7 17a-4(f) audit-trail). This mock keeps
///      its own per-asset card mirror instead, because the compliance engine
///      already enforces PolicyStatus at the manifest layer; the card here
///      stands in for the on-chain ManifestCore struct the watcher feeds.
///      REVIEW_MANIFEST_DRIFT (doc §6.1) is the watcher's soft-drift channel —
///      an off-chain operations queue, not a per-tx check code — so it is not
///      emitted here. The doc's `emit B01Check` PASS event is likewise
///      impossible from a `view` check and is a documented omission (wave-2
///      precedent).
///
///      Reason code map — `n` in `ReasonCodes.encode(0, ELEMENT_ID, n)` -> doc
///      §6.1 failure-code name, in `check()` evaluation order:
///        1 | MANIFEST_MISSING       card.status == NONE (unattested asset —
///                                    legacy code-1 "missing/unclassified"
///                                    meaning preserved)
///        2 | MANIFEST_SUSPENDED     card.status == SUSPENDED (watcher hash
///                                    mismatch / emergency halt / retire all
///                                    converge on this one gate, doc §5.2 ②)
///        3 | VERSION_UNAPPROVED     coreVersion != approvedVersion (references
///                                    a version outside the approved set — a
///                                    governance-bypass signal, doc §5.2 ③a)
///        4 | VERSION_PENDING        time-lock not elapsed: now < approvedAt +
///                                    activationDelay (INCLUSIVE at the
///                                    boundary — now == approvedAt + delay
///                                    PASSes, doc §5.3)
///        5 | FACTS_INCONSISTENT     INV-C: classification != requiredClassification
///                                    (a previously code-1 "attested wrong
///                                    class" case now surfaces here, doc §5.2 ④)
///        6 | FACT_STALE             freshness: maxFactAge != 0 and
///                                    now - factsAsOf > maxFactAge (STRICT `>`,
///                                    the OPPOSITE direction to the time-lock —
///                                    doc §5.3 pins this asymmetry; maxFactAge
///                                    0 disables the check)
contract AssetClassification is BaseElement, Governed {
    bytes32 internal constant ELEMENT_ID = "B-01-v1";

    /// @dev Thrown when the contract is deployed with a zero required
    ///      classification, which would otherwise make an unclassified asset
    ///      (default bytes32(0)) indistinguishable from a correctly declared one.
    error ZeroRequiredClassification();

    /// @notice Manifest lifecycle state. NONE = no card (missing, code 1);
    ///         SUSPENDED = watcher/emergency halt (code 2). Default is NONE.
    enum CardStatus {
        NONE,
        ACTIVE,
        SUSPENDED
    }

    /// @notice The mock ManifestCore mirror for one asset (doc §4.1). Value
    ///         types only, so the auto-generated `cardOf` getter is usable.
    struct AssetCard {
        CardStatus status;
        bytes32 classification; // legacy field — INV-C: must equal requiredClassification (else code 5)
        uint32 coreVersion; // version the card currently references
        uint32 approvedVersion; // approved-set membership; coreVersion mismatch => code 3
        uint64 approvedAt; // time-lock anchor: effective at approvedAt + activationDelay
        uint64 factsAsOf; // freshness anchor for the expiring facts the card carries
        uint64 maxFactAge; // 0 = freshness disabled; now - factsAsOf > maxFactAge => code 6
    }

    /// @notice The classification tag every asset must carry to pass `check`.
    bytes32 public immutable requiredClassification;

    /// @notice asset => manifest-integrity card (default: status NONE = missing).
    mapping(address => AssetCard) public cardOf;

    /// @notice Governance time-lock delay applied to every card's approvedAt
    ///         (doc §5.2 ③b / §5.3). It lives OUTSIDE the card on purpose —
    ///         self-reference guard (doc §3.20): a card must not set the yardstick
    ///         it is measured against. Operator-set, default 0 (no delay), so a
    ///         legacy `setClassification` card is effective immediately.
    uint64 public activationDelay;

    event ClassificationSet(address indexed asset, bytes32 classification);

    event CardSet(
        address indexed asset,
        CardStatus status,
        bytes32 classification,
        uint32 coreVersion,
        uint32 approvedVersion,
        uint64 approvedAt,
        uint64 factsAsOf,
        uint64 maxFactAge
    );

    event ActivationDelaySet(uint64 delay);

    constructor(bytes32 requiredClassification_)
        BaseElement(ElementMetadata({
                elementId: ELEMENT_ID,
                category: ElementCategory.ASSET_ATTRIBUTE,
                version: "B-01-v1",
                temporal: TemporalNature.ONE_TIME,
                decidability: Decidability.DETERMINISTIC,
                timing: ObligationTiming.AT_TRADE_GATE,
                statefulness: Statefulness.STATELESS
            }))
    {
        if (requiredClassification_ == bytes32(0)) {
            revert ZeroRequiredClassification();
        }
        requiredClassification = requiredClassification_;
    }

    /// @notice Legacy setter, signature and happy-path effect preserved exactly.
    ///         Writes a fully-live card for `asset`: ACTIVE, `classification` as
    ///         given, version 1 approved as version 1, approvedAt = now (so with
    ///         the default zero `activationDelay` it is effective immediately),
    ///         factsAsOf = now, maxFactAge 0 (freshness disabled). A live card
    ///         with the matching classification alone PASSes `check`.
    function setClassification(address asset, bytes32 classification) external onlyOperator {
        cardOf[asset] = AssetCard({
            status: CardStatus.ACTIVE,
            classification: classification,
            coreVersion: 1,
            approvedVersion: 1,
            approvedAt: uint64(block.timestamp),
            factsAsOf: uint64(block.timestamp),
            maxFactAge: 0
        });
        emit ClassificationSet(asset, classification);
    }

    /// @notice Writes the full operator-attested manifest card for `asset`,
    ///         standing in for the on-chain ManifestCore the watcher maintains.
    function setCard(address asset, AssetCard calldata card) external onlyOperator {
        cardOf[asset] = card;
        emit CardSet(
            asset,
            card.status,
            card.classification,
            card.coreVersion,
            card.approvedVersion,
            card.approvedAt,
            card.factsAsOf,
            card.maxFactAge
        );
    }

    /// @notice Sets the governance activation delay (time-lock) applied to all
    ///         cards. Default 0. Kept outside the card per the self-reference
    ///         guard (doc §3.20).
    function setActivationDelay(uint64 delay) external onlyOperator {
        activationDelay = delay;
        emit ActivationDelaySet(delay);
    }

    /// @notice Legacy view: the declared classification tag of `asset`,
    ///         preserved as a view over the card's `classification` field so
    ///         callers of the old public mapping getter keep working.
    function classificationOf(address asset) external view returns (bytes32) {
        return cardOf[asset].classification;
    }

    /// @dev doc §5.4 order (all deterministic, no external calls): status
    ///      NONE(1) -> SUSPENDED(2) -> version mismatch(3) -> time-lock
    ///      pending(4, `now >= approvedAt + delay` PASSes AT the boundary) ->
    ///      INV-C classification mismatch(5) -> freshness(6, STRICT `>`, opposite
    ///      boundary direction to the time-lock). `user`/`counterparty`/`amount`
    ///      are ignored — this is an asset-side, not investor-side, check.
    function check(address, address, address asset, uint256, bytes calldata)
        external
        view
        override
        returns (bool passed, bytes32 reasonCode)
    {
        AssetCard memory card = cardOf[asset];

        if (card.status == CardStatus.NONE) {
            return (false, ReasonCodes.encode(0, ELEMENT_ID, 1));
        }
        if (card.status == CardStatus.SUSPENDED) {
            return (false, ReasonCodes.encode(0, ELEMENT_ID, 2));
        }
        if (card.coreVersion != card.approvedVersion) {
            return (false, ReasonCodes.encode(0, ELEMENT_ID, 3));
        }
        // Time-lock is INCLUSIVE at the boundary: now == approvedAt + delay is
        // effective. `now < ...` is the only pending window (doc §5.3).
        if (block.timestamp < uint256(card.approvedAt) + uint256(activationDelay)) {
            return (false, ReasonCodes.encode(0, ELEMENT_ID, 4));
        }
        // INV-C: the classification the card carries must equal the required tag.
        if (card.classification != requiredClassification) {
            return (false, ReasonCodes.encode(0, ELEMENT_ID, 5));
        }
        // Freshness is STRICT `>`: now - factsAsOf == maxFactAge still PASSes;
        // exceeding it by one second fails. Opposite direction to the time-lock
        // above — doc §5.3 pins the asymmetry. maxFactAge 0 disables the check.
        // Age is 0 for a future/equal anchor, avoiding underflow.
        if (
            card.maxFactAge != 0 && block.timestamp > card.factsAsOf
                && block.timestamp - uint256(card.factsAsOf) > uint256(card.maxFactAge)
        ) {
            return (false, ReasonCodes.encode(0, ELEMENT_ID, 6));
        }

        return (true, bytes32(0));
    }
}
