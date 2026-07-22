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

/// @dev E-03-v1 Bad Actor Disqualification (mock). ISSUER/ASSET-side gate for
///      Rule 506(d) (17 C.F.R. §230.506(d)) — the offering-time judgment of
///      whether the offering's *covered-person set* (issuer, directors,
///      executive/participating officers, 20%-or-more voting owners, promoters,
///      pooled-fund investment managers, paid solicitors — NOT the buyer) is
///      free of a disqualifying event. Keyed by ASSET because the disqualifier
///      attaches to the OFFERING, not to any individual investor (contrast the
///      A-series buyer-eligibility gates). Statutory root: Securities Act §5
///      registration default (15 U.S.C. §77e) → §4(a)(2) private-offering
///      exemption (§77d(a)(2)) → Rule 506 safe harbor → Dodd-Frank §926 mandate
///      → Rule 506(d)(1) covered-person × event, Rule 506(d)(2)/(3) exceptions,
///      Rule 506(e) pre-2013 written-disclosure duty.
///
///      ARCHITECTURE (doc §5.5, §8.1, App. C). The substantive judgments — which
///      covered person hit which of the eight (i)~(viii) events, look-back /
///      in-effect windows, the 20%-or-more voting-power line, waivers, the
///      affiliated-issuer timing exception ((d)(3)) — are ALL non-deterministic
///      and are pushed off-chain to an authorized L2 verifier's factual inquiry
///      (Rule 506(d)(2)(iv)), sealed into a signed clearance attestation. This
///      gate reads only the attestation's VALIDITY layer (existence, authorized
///      issuer, offering scope, freshness, non-revocation, 506(e) disclosure).
///      It NEVER re-adjudicates an event: a valid, fresh, non-revoked clearance
///      from a trusted issuer IS the cleanliness signal, and an issuer that later
///      discovers an event REVOKES (G5) rather than the gate recomputing it.
///
///      MOCK BOUNDARY. Production replaces the operator setters with: (a) issuer
///      D&O questionnaires + background checks + FINRA BrokerCheck / SEC action
///      & litigation releases / state securities·banking·insurance regulator
///      databases feeding the L2 counsel/transfer-agent factual-inquiry pipeline
///      that signs the clearance (doc §4.3, §11.3); (b) a multisig + time-locked
///      governance change for the trusted-issuer set (doc §11.2). The
///      operator-gated setters here ARE the "authorized channel": a self-claimed
///      clearance cannot enter except through the operator, and even an
///      operator-recorded clearance must name an attestingIssuer that is in the
///      trusted set (G2) — this is the seam the doc's "자칭 clearance 미인가
///      발급자" case (Test 3) exercises.
///
///      REVIEW-AT-GATE. The doc splits a listing channel (V1~V4) from a per-mint
///      gate (G1~G6). Production activates an offering only after the V-channel
///      clears, so a mint never reaches an offering with an open REVIEW; this
///      mock has no separate listing lifecycle, so check() enforces the listing
///      invariants inline and a REVIEW is a fail-closed HOLD (blocks the mint,
///      not a pass) — doc §6.1/§6.3: the per-mint gate has no discretionary pass.
///
///      Reason code numbers (doc §6.2 code-name map), in check() evaluation order
///      (ReasonCodes.encode(0, ELEMENT_ID, n)):
///        1 = FAIL_BADACTOR_ROSTER_MISSING       V1  covered-person roster undeclared
///        2 = REVIEW_BADACTOR_ROSTER_INCOMPLETE  V2  (d)(1) category not all identified (HOLD)
///        3 = FAIL_BADACTOR_CLEARANCE_MISSING     V3/G1 no clearance attestation (fail-closed)
///        4 = REVIEW_BADACTOR_506E_PENDING       V4  pre-2013 event but disclosure doc unprepared (HOLD)
///        5 = FAIL_BADACTOR_ISSUER_UNTRUSTED     G2  attesting issuer outside trusted set
///        6 = FAIL_BADACTOR_SCOPE_MISMATCH       G3  clearance scoped to a different offering
///        7 = FAIL_BADACTOR_CLEARANCE_STALE      G4  past re-inquiry window (A-11 freshness)
///        8 = FAIL_BADACTOR_REVOKED              G5  mid-offering revocation (§3.14)
///        9 = FAIL_BADACTOR_506E_DISCLOSURE_MISSING G6 pre-2013 event but §506(e) disclosure not furnished
contract BadActorDisqualification is BaseElement, Governed {
    bytes32 internal constant ELEMENT_ID = "E-03-v1";

    /// @dev Offering "card" declaration (issuer-declared, sealed at listing per
    ///      B-01). offeringId is the G3 scope anchor; coveredPersonRosterHash is
    ///      the on-chain seal of the off-chain roster (V1); rosterComplete is the
    ///      V2 listing determination that every Rule 506(d)(1) covered-person
    ///      category was identified (roster substance stays off-chain — privacy
    ///      minimization, doc §5.4).
    struct Offering {
        bytes32 offeringId;
        bytes32 coveredPersonRosterHash;
        bool rosterComplete;
    }

    /// @dev L2 clearance attestation (offering-level claim, doc §3.16). exists is
    ///      the presence flag (G1); attestingIssuer is the L2 that performed the
    ///      factual inquiry and must be in the trusted set (G2); offeringScope
    ///      binds it to one offering (G3); expiry is the freshness bound (G4,
    ///      A-11); revoked absorbs mid-offering events (G5); the disclosure506e*
    ///      fields drive the Rule 506(e) branch (V4/G6). noDisqualifyingEvent is
    ///      the L2-sealed SUBSTANTIVE conclusion and is deliberately NOT gated
    ///      (see check()).
    struct Clearance {
        bool exists;
        address attestingIssuer;
        bytes32 offeringScope;
        uint64 expiry;
        bool revoked;
        bool disclosure506eRequired;
        bytes32 disclosedMattersHash;
        bool disclosureFurnished;
        bool noDisqualifyingEvent;
    }

    /// @dev asset => offering card declaration.
    mapping(address => Offering) public offeringOf;
    /// @dev asset => bad-actor clearance attestation for that asset's offering.
    mapping(address => Clearance) public clearanceOf;
    /// @dev TRUSTED_BADACTOR_ISSUERS: L2 verifiers authorized to sign a clearance
    ///      (Rule 506(d)(2)(iv) — the subject that may be trusted to have done the
    ///      factual inquiry). Governance constant, not a per-asset fact.
    mapping(address => bool) public isTrustedBadActorIssuer;

    event OfferingDeclared(
        address indexed asset, bytes32 offeringId, bytes32 coveredPersonRosterHash, bool rosterComplete
    );
    event ClearanceSet(
        address indexed asset,
        address indexed attestingIssuer,
        bytes32 offeringScope,
        uint64 expiry,
        bool disclosure506eRequired,
        bytes32 disclosedMattersHash,
        bool disclosureFurnished,
        bool noDisqualifyingEvent
    );
    event ClearanceRevocationSet(address indexed asset, bool revoked);
    event TrustedBadActorIssuerSet(address indexed issuer, bool trusted);

    constructor()
        BaseElement(ElementMetadata({
                elementId: ELEMENT_ID,
                category: ElementCategory.ISSUER_STATUS,
                version: "E-03-v1",
                // PERIODIC, not ONE_TIME: unlike E-01's one-time Form D filing, a
                // bad-actor event can arise mid-offering (doc §3.14), so the
                // clearance is re-verified on an A-11 cycle and is revocable —
                // the gate's freshness (G4) and revocation (G5) axes encode this.
                temporal: TemporalNature.PERIODIC,
                // ATTESTATION_BASED: the gate consumes an L2-signed clearance
                // whose substance is sealed off-chain (Pattern A gate with a local
                // Pattern B borrow, doc §8.1), like the E-01 issuer-side sibling.
                decidability: Decidability.ATTESTATION_BASED,
                timing: ObligationTiming.EX_ANTE_VERIFY,
                statefulness: Statefulness.STATELESS
            }))
    {}

    /// @dev Declares (or overwrites) the offering card for `asset`. In production
    ///      this is the issuer declaration sealed at listing under B-01;
    ///      coveredPersonRosterHash == 0 means no roster is declared (V1 fails).
    function setOffering(address asset, bytes32 offeringId, bytes32 coveredPersonRosterHash, bool rosterComplete)
        external
        onlyOperator
    {
        offeringOf[asset] = Offering({
            offeringId: offeringId, coveredPersonRosterHash: coveredPersonRosterHash, rosterComplete: rosterComplete
        });
        emit OfferingDeclared(asset, offeringId, coveredPersonRosterHash, rosterComplete);
    }

    /// @dev Records (or overwrites) the bad-actor clearance for `asset`. This is
    ///      the sole authorized ingestion channel (mock stand-in for the L2
    ///      counsel/transfer-agent attestation pipeline of doc §4.3/§11.3): a
    ///      self-claimed clearance cannot enter except through this operator
    ///      gate, and G2 still requires `attestingIssuer` to be in the trusted
    ///      set. Sets exists=true and revoked=false; revocation is expressed via
    ///      setClearanceRevoked (the mid-offering seam, doc §3.14/§11.6).
    function setClearance(
        address asset,
        address attestingIssuer,
        bytes32 offeringScope,
        uint64 expiry,
        bool disclosure506eRequired,
        bytes32 disclosedMattersHash,
        bool disclosureFurnished,
        bool noDisqualifyingEvent
    ) external onlyOperator {
        clearanceOf[asset] = Clearance({
            exists: true,
            attestingIssuer: attestingIssuer,
            offeringScope: offeringScope,
            expiry: expiry,
            revoked: false,
            disclosure506eRequired: disclosure506eRequired,
            disclosedMattersHash: disclosedMattersHash,
            disclosureFurnished: disclosureFurnished,
            noDisqualifyingEvent: noDisqualifyingEvent
        });
        emit ClearanceSet(
            asset,
            attestingIssuer,
            offeringScope,
            expiry,
            disclosure506eRequired,
            disclosedMattersHash,
            disclosureFurnished,
            noDisqualifyingEvent
        );
    }

    /// @dev Toggles the mid-offering revocation flag (doc §3.14: (d)(1) attaches
    ///      to "such sale", so a sale after a covered person is sanctioned is
    ///      disqualified even if the offering opened clear). Production driver is
    ///      the issuing L2 / operator on discovery of a new event.
    function setClearanceRevoked(address asset, bool revoked) external onlyOperator {
        clearanceOf[asset].revoked = revoked;
        emit ClearanceRevocationSet(asset, revoked);
    }

    /// @dev Manages the TRUSTED_BADACTOR_ISSUERS set. Mock stand-in for the
    ///      multisig + time-lock governance change of doc §11.2.
    function setTrustedBadActorIssuer(address issuer, bool trusted) external onlyOperator {
        isTrustedBadActorIssuer[issuer] = trusted;
        emit TrustedBadActorIssuerSet(issuer, trusted);
    }

    /// @dev Issuer-side gate evaluated per asset (doc §5.2, listing V-checks folded
    ///      ahead of the per-mint G-checks; first failure stops). Every branch is
    ///      existence / set-membership / scope / timestamp / boolean — no
    ///      discretion, no event re-adjudication. Unattested/unset fails closed.
    function check(address, address, address asset, uint256, bytes calldata)
        external
        view
        override
        returns (bool passed, bytes32 reasonCode)
    {
        Offering memory o = offeringOf[asset];
        Clearance memory c = clearanceOf[asset];

        // V1 — covered-person roster declared (Rule 506(d)(1) covered-person set;
        //      fail-closed default per §5 registration baseline, doc §3.1/§3.6).
        if (o.coveredPersonRosterHash == bytes32(0)) {
            return (false, _code(1));
        }

        // V2 — roster completeness: every (d)(1) category identified. A listing
        //      HOLD (promoter / 20%-voting-owner omissions are common), so
        //      fail-closed until the roster is supplemented (doc §6.2, §11.1).
        if (!o.rosterComplete) {
            return (false, _code(2));
        }

        // V3 / G1 — a clearance attestation is on file. Absent clearance for a
        //      regulated offering fails closed (doc Test 2): "no certificate" is
        //      never read as "no inquiry needed".
        if (!c.exists) {
            return (false, _code(3));
        }

        // V4 — Rule 506(e) branch, prerequisite: if a pre-2013 disqualifying
        //      matter exists, the written-disclosure document must at least be
        //      prepared (hash sealed). Unprepared => HOLD (checked before G6 so a
        //      not-yet-prepared disclosure surfaces as PENDING, not as G6).
        if (c.disclosure506eRequired && c.disclosedMattersHash == bytes32(0)) {
            return (false, _code(4));
        }

        // G2 — issuer authorization: only an L2 in TRUSTED_BADACTOR_ISSUERS may
        //      sign (Rule 506(d)(2)(iv) — the trusted factual-inquiry subject).
        //      Rejects a self-claimed clearance whose issuer is not authorized.
        if (!isTrustedBadActorIssuer[c.attestingIssuer]) {
            return (false, _code(5));
        }

        // G3 — offering scope: the clearance must be bound to THIS offering, so a
        //      certificate issued for another offering cannot be reused.
        if (c.offeringScope != o.offeringId) {
            return (false, _code(6));
        }

        // G4 — freshness (A-11 re-inquiry window; E-03 owns no expiry logic of its
        //      own, doc §9.1 — the comparison is inline here only to model the time
        //      axis). Inclusive window: only now strictly past expiry is STALE.
        if (block.timestamp > c.expiry) {
            return (false, _code(7));
        }

        // G5 — not revoked: a mid-offering event is absorbed by revocation, not by
        //      the gate recomputing the event (doc §3.14 transition rule).
        if (c.revoked) {
            return (false, _code(8));
        }

        // G6 — Rule 506(e) written disclosure furnished. (e) has NO waiver (unlike
        //      the (d) good-cause / regulator-advice exits), so this is an
        //      unconditional gate whenever a pre-2013 matter is present.
        if (c.disclosure506eRequired && !c.disclosureFurnished) {
            return (false, _code(9));
        }

        // NOTE — clearance.noDisqualifyingEvent is the L2-SEALED substantive
        // conclusion (post-2013 event absence, waivers ((d)(2)(ii)/(iii)) and the
        // affiliated-issuer timing exception ((d)(3)) already reflected). The gate
        // MUST NOT branch on it (doc §5.2/§5.5, App. C): a valid, fresh,
        // non-revoked clearance from a trusted issuer is itself the pass signal.
        // Carried for audit reconstruction only. Likewise the 20%-or-more voting
        // line (inclusive ≥, doc §3.6/§5.3) and the A-08/A-09 entity look-through
        // are L2 determinations sealed into coveredPersonRosterHash — the gate
        // consumes the seal, it does not recompute voting power.
        return (true, bytes32(0));
    }

    function _code(uint32 n) private pure returns (bytes32) {
        return ReasonCodes.encode(0, ELEMENT_ID, n);
    }
}
