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

/// @dev A-03-v1 Accredited Investor (mock), upgraded to the doc §5.2 claim
///      pipeline. Stands in for the Trusted-Issuer-signed `ACCREDITED_INVESTOR`
///      claim (doc §4) that Rule 506(c) issuance and §4(a)(7) resale both
///      require of the buyer: A-03 never re-derives income/net-worth/entity
///      facts on-chain (doc §3.3 "읽는 법"), it only confirms the claim's
///      existence, issuer trust, signature, expiry and verification basis.
///
///      Legacy compatibility (non-negotiable, see wave-2b plan header):
///      `setAccredited(address,bool)` keeps its exact signature and its
///      legacy happy-path effect — `setAccredited(user, true)` alone writes a
///      fully-valid claim (exists, trusted, valid sig, no expiry,
///      verificationBasisAccepted, basis = DIRECT) that PASSes `check` with no
///      further calls; `false` clears it. `accredited(address)` is kept as
///      its OWN storage bool (not derived from the claim at read time) so
///      HolderCount (D-01) and integration helpers keep a truthful coarse
///      view — both `setAccredited` and `setClaim` maintain it in lockstep
///      (`setClaim` sets it to `claim.exists`). New strictness (per-asset
///      `requires506cVerification` / `sec4a7PathOf`) is operator-set and
///      defaults OFF, so no currently-passing flow starts failing.
///
///      Reason code map — `n` in `ReasonCodes.encode(0, ELEMENT_ID, n)` -> doc
///      §6 failure-code name, in `check()` evaluation order:
///        1 | NO_AI_CLAIM                    claim.exists == false (legacy
///                                           "not accredited" fail — same
///                                           meaning, compatible)
///        2 | UNTRUSTED_AI_CLAIM_ISSUER      claim.issuerTrusted == false
///        3 | INVALID_AI_CLAIM_SIGNATURE     claim.signatureValid == false
///        4 | AI_CLAIM_EXPIRED               claim.expiry set and passed
///                                           (STRICT `>` — exactly-at-expiry
///                                           PASSes, doc §5.2/§7 boundary)
///        5 | 506C_VERIFICATION_NOT_ESTABLISHED  asset requires 506(c)
///                                           verification and the claim
///                                           lacks `verificationBasisAccepted`
///        6 | 4A7_PURCHASER_NOT_AI           NARROW, doc-ambiguity resolution
///                                           (see below) — asset is on the
///                                           §4(a)(7) resale path and the
///                                           claim exists+valid but carries
///                                           no AI category (`basis == NONE`)
///        7 | AI_LOOKTHROUGH_PENDING         basis == ALL_EQUITY_OWNERS and
///                                           `ltStatus != COMPLETED` — doc
///                                           ambiguity resolution: the doc's
///                                           table has only
///                                           FAIL_AI_LOOKTHROUGH_PENDING, no
///                                           separate "look-through FAILED"
///                                           code, so NONE/PENDING/FAILED all
///                                           map to code 7 here (comment on
///                                           `AiClaim.ltStatus` below)
///        8 | AI_CATEGORY_UNSUPPORTED        basis == OTHER
///        9 | REVIEW_AI_UNCERTAIN            claim.reviewRequired == true
///
///      Doc-ambiguity resolution for code 6 (§4(a)(7) purchaser-AI): the doc's
///      own §7 test table maps "§4(a)(7) resale에서 buyer AI claim 없음" to
///      FAIL_NO_AI_CLAIM (code 1), not code 6 — because our claims are
///      attest-only, a claim that exists and is otherwise valid already IS an
///      AI determination, so there is no natural "claim says AI but really
///      isn't" state to distinguish with code 6. Rather than leave code 6
///      unreachable, it is scoped narrowly to a claim "shell" that exists and
///      is otherwise valid but was never assigned an AI category
///      (`basis == NONE`) on an asset flagged as a §4(a)(7) resale
///      (`sec4a7PathOf[asset]`); a fully missing claim still fails 1 as the
///      doc table requires.
contract AccreditedInvestor is BaseElement, Governed {
    bytes32 internal constant ELEMENT_ID = "A-03-v1";

    /// @dev Rule 501(a) categories collapsed to the granularity A-03 actually
    ///      branches on (doc §3.13 lists 13 sub-categories under §3.3; all but
    ///      the look-through category (a)(8) resolve identically here, so they
    ///      fold into DIRECT). OTHER is the fail-closed bucket for a category
    ///      this mock does not support (doc §6, AI_CATEGORY_UNSUPPORTED).
    enum AiClaimBasis {
        NONE,
        DIRECT,
        ALL_EQUITY_OWNERS,
        OTHER
    }

    struct AiClaim {
        bool exists;
        bool issuerTrusted;
        bool signatureValid;
        uint64 expiry; // 0 = none
        bool verificationBasisAccepted; // Rule 506(c)(2)(ii) reasonable-steps basis recorded
        AiClaimBasis basis;
        LookThroughStatus ltStatus; // meaningful only when basis == ALL_EQUITY_OWNERS ((a)(8))
        bool reviewRequired; // operator/issuer flags manual review (doc REVIEW_AI_UNCERTAIN)
    }

    /// @notice buyer => attested AI claim.
    mapping(address => AiClaim) public claimOf;

    /// @notice Coarse legacy view of claim existence. NOT derived from `claimOf`
    ///         at read time (that would be circular) — it is its own storage
    ///         bool that `setAccredited` and `setClaim` both keep in sync with
    ///         `claim.exists`. Consumers that only need "has an AI claim been
    ///         recorded at all" (HolderCount / D-01, integration helpers) read
    ///         this; `check` uses the full `claimOf` pipeline instead.
    mapping(address => bool) public accredited;

    /// @notice asset => Rule 506(c) verification-basis enforcement, operator-set,
    ///         default false (opt-in; wave-2b compatibility rule — a legacy
    ///         `setAccredited(user, true)` claim already carries
    ///         `verificationBasisAccepted = true`, so turning this on does not
    ///         break existing flows, it only bites unattested/self-certified claims).
    mapping(address => bool) public requires506cVerification;

    /// @notice asset => this asset's active resale path is Securities Act
    ///         §4(a)(7) (doc §3.11), operator-set, default false. Only used to
    ///         narrow code 6 (see contract-level NatSpec); Rule 144 resale
    ///         (buyer-AI not required, doc §3.11/§3.12) leaves this false and
    ///         A-03 dormant for that leg, same as before this upgrade.
    mapping(address => bool) public sec4a7PathOf;

    event AccreditedInvestorSet(address indexed investor, bool isAccredited);

    event AiClaimSet(
        address indexed investor,
        bool exists,
        bool issuerTrusted,
        bool signatureValid,
        uint64 expiry,
        bool verificationBasisAccepted,
        AiClaimBasis basis,
        LookThroughStatus ltStatus,
        bool reviewRequired
    );

    event Asset506cVerificationRequirementSet(address indexed asset, bool required);
    event AssetSec4a7PathSet(address indexed asset, bool enabled);

    constructor()
        BaseElement(ElementMetadata({
                elementId: ELEMENT_ID,
                category: ElementCategory.INVESTOR_ATTRIBUTE,
                version: "A-03-v1",
                temporal: TemporalNature.ONE_TIME,
                decidability: Decidability.ATTESTATION_BASED,
                timing: ObligationTiming.EX_ANTE_VERIFY,
                statefulness: Statefulness.STATELESS
            }))
    {}

    /// @notice Legacy setter, signature and happy-path effect preserved
    ///         exactly. `true` writes a fully-valid claim (exists, trusted,
    ///         valid sig, no expiry, verification basis accepted, basis
    ///         DIRECT) that alone PASSes `check`; `false` clears the claim
    ///         and the coarse `accredited` view.
    function setAccredited(address user, bool isAccredited) external onlyOperator {
        accredited[user] = isAccredited;
        if (isAccredited) {
            claimOf[user] = AiClaim({
                exists: true,
                issuerTrusted: true,
                signatureValid: true,
                expiry: 0,
                verificationBasisAccepted: true,
                basis: AiClaimBasis.DIRECT,
                ltStatus: LookThroughStatus.NONE,
                reviewRequired: false
            });
        } else {
            delete claimOf[user];
        }
        emit AccreditedInvestorSet(user, isAccredited);
    }

    /// @notice Writes the full operator-attested AI claim for `user`, standing
    ///         in for a Trusted-Issuer-signed claim. Keeps the legacy
    ///         `accredited` view in sync (`accredited[user] = claim.exists`).
    function setClaim(address user, AiClaim calldata claim) external onlyOperator {
        claimOf[user] = claim;
        accredited[user] = claim.exists;
        emit AiClaimSet(
            user,
            claim.exists,
            claim.issuerTrusted,
            claim.signatureValid,
            claim.expiry,
            claim.verificationBasisAccepted,
            claim.basis,
            claim.ltStatus,
            claim.reviewRequired
        );
    }

    /// @notice Operator toggle: require Rule 506(c) verification basis on `asset`.
    ///         Default false (opt-in) per the wave-2b compatibility rule.
    function setRequires506cVerification(address asset, bool required) external onlyOperator {
        requires506cVerification[asset] = required;
        emit Asset506cVerificationRequirementSet(asset, required);
    }

    /// @notice Operator toggle: mark `asset`'s active resale path as §4(a)(7).
    ///         Default false (opt-in). See contract-level NatSpec for how this
    ///         narrowly scopes code 6.
    function setSec4a7Path(address asset, bool enabled) external onlyOperator {
        sec4a7PathOf[asset] = enabled;
        emit AssetSec4a7PathSet(asset, enabled);
    }

    /// @dev doc §5.2 order: exists(1) -> issuer(2) -> signature(3) ->
    ///      expiry(4, STRICT `>`) -> [asset requires 506(c)] verification
    ///      basis(5) -> [asset is §4(a)(7) path] narrow no-category shell(6)
    ///      -> category OTHER(8) -> ALL_EQUITY_OWNERS look-through not
    ///      COMPLETED(7) -> reviewRequired(9) -> PASS.
    function check(address user, address, address asset, uint256, bytes calldata)
        external
        view
        override
        returns (bool passed, bytes32 reasonCode)
    {
        AiClaim memory c = claimOf[user];

        if (!c.exists) {
            return (false, ReasonCodes.encode(0, ELEMENT_ID, 1));
        }
        if (!c.issuerTrusted) {
            return (false, ReasonCodes.encode(0, ELEMENT_ID, 2));
        }
        if (!c.signatureValid) {
            return (false, ReasonCodes.encode(0, ELEMENT_ID, 3));
        }
        if (c.expiry != 0 && block.timestamp > c.expiry) {
            return (false, ReasonCodes.encode(0, ELEMENT_ID, 4));
        }
        if (requires506cVerification[asset] && !c.verificationBasisAccepted) {
            return (false, ReasonCodes.encode(0, ELEMENT_ID, 5));
        }
        if (sec4a7PathOf[asset] && c.basis == AiClaimBasis.NONE) {
            return (false, ReasonCodes.encode(0, ELEMENT_ID, 6));
        }
        if (c.basis == AiClaimBasis.OTHER) {
            return (false, ReasonCodes.encode(0, ELEMENT_ID, 8));
        }
        if (c.basis == AiClaimBasis.ALL_EQUITY_OWNERS && c.ltStatus != LookThroughStatus.COMPLETED) {
            // NONE/PENDING/FAILED all map to code 7 — see contract-level
            // NatSpec doc-ambiguity resolution (the doc has no separate
            // look-through-FAILED code for A-03).
            return (false, ReasonCodes.encode(0, ELEMENT_ID, 7));
        }
        if (c.reviewRequired) {
            return (false, ReasonCodes.encode(0, ELEMENT_ID, 9));
        }

        return (true, bytes32(0));
    }
}
