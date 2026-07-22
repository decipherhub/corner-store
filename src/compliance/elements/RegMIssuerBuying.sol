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
    Statefulness,
    ComplianceContext,
    FlowType
} from "../../types/ComplianceTypes.sol";
import {ReasonCodes} from "../../libraries/ReasonCodes.sol";

/// @dev F-04-v1 Reg M "no-purchase-during-distribution" gate (mock).
///
///      Legal anchor: Securities Exchange Act §9(a)·§10(b) + Regulation M
///      (17 C.F.R. §242.100-.102·.104). During a distribution's restricted
///      period, §242.102(a) makes it UNLAWFUL for the issuer / selling security
///      holder / their affiliated purchaser, and §242.101(a) for a distribution
///      participant / their affiliated purchaser, to "bid for, purchase, or
///      attempt to induce any person to bid for or purchase" a covered security.
///      Reg M strips the §9(a)(2) *purpose/intent* element (doc §1.1, §3.0.1), so
///      the prohibition is a bright line decidable from three OBJECTIVE
///      coordinates — time (restricted period) × direction (BUY of the covered
///      security) × person (restricted-set membership). That is why F-04 is a
///      strict-liability GATE (Pattern A), the closest structural relative of
///      A-01 Sanctions (doc §8.2): a roster gate, not a signed-claim element.
///
///      F-04 is NOT an anti-fraud safe harbor: a PASS here only means "not caught
///      by the Reg M bright line". §9/§10(b)/§17(a) liability and post-trade
///      surveillance (F-02) run in parallel (doc §3.1, §9.1).
///
///      ── Two statutory branches (doc §1.2, §3.8-3.9, §5.2 G⑥) ──────────────
///      The buyer's roster role routes the block to a distinct statute + code:
///        ISSUER / SELLING_SECURITY_HOLDER / AFFILIATED_PURCHASER -> §242.102(a)
///          -> code 4 RESTRICTED_PERIOD_PURCHASE_BLOCKED_ISSUER
///        DISTRIBUTION_PARTICIPANT                                 -> §242.101(a)
///          -> code 5 RESTRICTED_PERIOD_PURCHASE_BLOCKED_PARTICIPANT
///      Same outcome (revert), distinct basis recorded (doc §3.9, §6.1).
///
///      ── Direction rule (doc §5.3, §242.102(b)(5)) ───────────────────────────
///      Only the BUY side is gated. The engine hands us `user = ctx.buyer`
///      (ComplianceEngine._runChecks passes abi.encode(ComplianceContext) and
///      ctx.buyer as `user`), so this element screens the BUYER only. A roster
///      member who is SELLING is the counterparty, never `user`, and therefore
///      PASSes here (§242.102(b)(5) expressly excepts offers to sell). Selling
///      is Reg M-irrelevant because it does not prop up the price.
///
///      ── Continuous offering (doc §1.3, §3.4) ────────────────────────────────
///      BUIDL is a continuous offering: the restricted period never closes, so
///      the gate stays on for the asset's whole life. offeringStatus == COMPLETED
///      is the only off switch, and continuous assets never reach it.
///
///      ── Redemption separation (doc §1.4, §3.10, §5.4, §6.3) ─────────────────
///      §242.102(b)(2)(ii)/(3) except NAV redemptions by closed-end funds / LPs
///      PROVIDED the security is not traded on an exchange / IDQS / ECN. BUIDL
///      routes USD/USDC redemptions through a separate operator-controlled,
///      off-venue channel — not the DEX buy path — so F-04 structurally does not
///      participate. If a FlowType.REDEMPTION context nonetheless reaches this
///      gate, it is PASSed explicitly (F-04 does not gate redemptions).
///
///      ── No reverse relaxation / fail-closed (doc §5.5) ──────────────────────
///      A covered asset with no offeringStatus declared HALTS (code 2), never
///      "presumed not in distribution". A declared excepted-security profile does
///      NOT silently switch the gate off (BUIDL-like §3(c)(7) private funds
///      qualify for none of §242.102(d)/§242.101(c); doc §3.11-3.12): it is
///      surfaced for review (code 1). Exceptions only ever NARROW.
///
///      ── A-06 boundary (doc §9.1 ★) ──────────────────────────────────────────
///      Reg M "affiliated purchaser" (acquisition in concert / purchase control /
///      discretionary trading) is NOT Rule 144 "affiliate" (issuer control). This
///      element does NOT consult A-06; the restricted-person roster is its own
///      operator-attested list.
///
///      STATELESS (doc §8.4): the roster and card facts change only through
///      out-of-band operator/governance writes; the per-trade gate only reads.
///
///      Reason-code map — `n` in `ReasonCodes.encode(0, ELEMENT_ID, n)` -> doc
///      §2.3/§6.1 code name, in `check` evaluation order:
///        1 | REVIEW_REGM_EXCEPTION_CONFLICT              (REVIEW  — V2, §3.11-3.12/§6.1)
///        2 | REG_M_OFFERING_STATUS_MISSING               (FAIL    — fail-closed, §4.2/§5.5)
///        3 | REG_M_RESTRICTED_SET_UNVERIFIED             (REVIEW  — roster red flag, §5.5)
///        4 | RESTRICTED_PERIOD_PURCHASE_BLOCKED_ISSUER   (FAIL    — §242.102(a), issuer branch)
///        5 | RESTRICTED_PERIOD_PURCHASE_BLOCKED_PARTICIPANT (FAIL — §242.101(a), participant branch)
///      PASS paths carry no code (bytes32(0), doc §6.2): NOT_APPLICABLE,
///      NOT_IN_DISTRIBUTION, REDEMPTION_OUT_OF_GATE, NON_RESTRICTED_BUYER,
///      EXCEPTION_APPLIED.
contract RegMIssuerBuying is BaseElement, Governed {
    bytes32 internal constant ELEMENT_ID = "F-04-v1";

    /// @dev Per-asset offering lifecycle (doc §3.4, table B). UNSET = 0 is the
    ///      fail-closed default for a covered asset (no declaration => code 2).
    ///      Continuous offerings (BUIDL) are sealed ONGOING_CONTINUOUS and never
    ///      reach COMPLETED (doc §1.3, §11.2).
    enum OfferingStatus {
        UNSET,
        ONGOING_CONTINUOUS,
        ONGOING_TRANCHE,
        COMPLETED
    }

    /// @dev Excepted-security declaration (doc §3.11-3.12, table B). Only NONE is
    ///      coherent for a BUIDL-like §3(c)(7) private fund; any non-NONE value is
    ///      a mis-declaration surfaced for review (code 1), NEVER an auto off-switch.
    enum ExceptionProfile {
        NONE,
        ACTIVELY_TRADED,
        OPEN_END_UIT,
        EXEMPTED_3A12,
        NONCONV_ABS
    }

    /// @dev Restricted-person role (doc §3.5-3.7, §4.3). NONE = 0 = not on roster.
    ///      The role selects the statutory branch in `check` (doc §5.2 G⑥).
    enum RestrictedRole {
        NONE,
        ISSUER,
        SELLING_SECURITY_HOLDER,
        AFFILIATED_PURCHASER,
        DISTRIBUTION_PARTICIPANT
    }

    /// @dev §242.101(b)(7) de minimis threshold — STATUTORY 2% of ADTV, in bps.
    ///      Participant branch ONLY; the issuer branch (§242.102) has no de minimis
    ///      (doc §3.12 asymmetry, T9). STRICT `<` ("total less than 2%").
    uint16 internal constant DE_MINIMIS_BPS = 200;
    uint256 internal constant BPS_DENOMINATOR = 10_000;

    /// @dev Length of abi.encode(ComplianceContext): 11 static words => 352 bytes
    ///      (doc reference: ComplianceEngine._runChecks, EngineSelection). A shorter
    ///      context cannot be decoded, so the redemption relaxation is skipped
    ///      (fail-closed direction — never grant a PASS we cannot verify).
    uint256 internal constant CTX_ENCODED_LEN = 352;

    /// @notice asset => is this token a covered security under F-04 (doc §3.3 G③)?
    ///         false (default) => F-04 not applicable => PASS. Also short-circuits
    ///         unconfigured assets so code 2 only fires for assets an operator has
    ///         affirmatively placed under F-04.
    mapping(address => bool) public coveredSecurityOf;

    /// @notice asset => restricted-period lifecycle declaration (doc §3.4 G①).
    mapping(address => OfferingStatus) public offeringStatusOf;

    /// @notice asset => excepted-security declaration (doc §3.11-3.12 V2).
    mapping(address => ExceptionProfile) public exceptionProfileOf;

    /// @notice asset => unresolved roster red flag (doc §5.5 F04-V3) => REVIEW.
    mapping(address => bool) public registryUnverifiedOf;

    /// @notice asset => ADTV governance constant, de minimis 2% denominator
    ///         (doc §3.12, table B). 0 => de minimis undefined => no exception.
    mapping(address => uint256) public adtvOf;

    /// @notice asset => account => DIRECT restricted-person roster role (doc §4.3).
    mapping(address => mapping(address => RestrictedRole)) public restrictedRoleOf;

    /// @notice asset => account => INDIRECT role via control cluster ("directly or
    ///         indirectly", §242.102(a); doc §3.8, §5.4). Catches third-party-wallet
    ///         circumvention when the direct roster role is NONE.
    mapping(address => mapping(address => RestrictedRole)) public clusterRoleOf;

    /// @notice asset => account => §242.102/§242.100(b) affiliated-purchaser (3)
    ///         safe harbor satisfied (information barrier + annual independent
    ///         assessment; doc §3.7). A certified affiliate is NOT an affiliated
    ///         purchaser — it is dropped from restricted status at check time.
    mapping(address => mapping(address => bool)) public infoBarrierCertifiedOf;

    /// @notice asset => account => written §242.101 policies/procedures maintained,
    ///         a precondition of the participant de minimis exception (doc §3.12).
    mapping(address => mapping(address => bool)) public policiesCertifiedOf;

    event CoveredSecuritySet(address indexed asset, bool covered);
    event OfferingStatusSet(address indexed asset, OfferingStatus status);
    event ExceptionProfileSet(address indexed asset, ExceptionProfile profile);
    event RegistryUnverifiedSet(address indexed asset, bool unverified);
    event AdtvSet(address indexed asset, uint256 adtv);
    event RestrictedRoleSet(address indexed asset, address indexed account, RestrictedRole role);
    event ClusterRoleSet(address indexed asset, address indexed account, RestrictedRole role);
    event InfoBarrierCertifiedSet(address indexed asset, address indexed account, bool certified);
    event PoliciesCertifiedSet(address indexed asset, address indexed account, bool certified);

    constructor()
        BaseElement(ElementMetadata({
                elementId: ELEMENT_ID,
                category: ElementCategory.CONDUCT_MONITORING,
                version: "F-04-v1",
                temporal: TemporalNature.REALTIME,
                decidability: Decidability.DETERMINISTIC,
                timing: ObligationTiming.AT_TRADE_GATE,
                statefulness: Statefulness.STATELESS
            }))
    {}

    /// @notice Place / remove `asset` under F-04 as a covered security (doc §3.3).
    function setCoveredSecurity(address asset, bool covered) external onlyOperator {
        coveredSecurityOf[asset] = covered;
        emit CoveredSecuritySet(asset, covered);
    }

    /// @notice Declare `asset`'s restricted-period lifecycle status (doc §3.4).
    function setOfferingStatus(address asset, OfferingStatus status) external onlyOperator {
        offeringStatusOf[asset] = status;
        emit OfferingStatusSet(asset, status);
    }

    /// @notice Declare `asset`'s excepted-security profile (doc §3.11-3.12).
    function setExceptionProfile(address asset, ExceptionProfile profile) external onlyOperator {
        exceptionProfileOf[asset] = profile;
        emit ExceptionProfileSet(asset, profile);
    }

    /// @notice Flag / clear an unresolved roster red flag for `asset` (doc §5.5).
    function setRegistryUnverified(address asset, bool unverified) external onlyOperator {
        registryUnverifiedOf[asset] = unverified;
        emit RegistryUnverifiedSet(asset, unverified);
    }

    /// @notice Set `asset`'s ADTV governance constant (de minimis denominator).
    function setAdtv(address asset, uint256 adtv) external onlyOperator {
        adtvOf[asset] = adtv;
        emit AdtvSet(asset, adtv);
    }

    /// @notice Register / clear a DIRECT restricted-person role (doc §4.3, §11.1).
    ///         The Reg M affiliated-purchaser judgment is the operator's own — it
    ///         must NOT be copied from A-06's Rule 144 affiliate output (doc §9.1).
    function setRestrictedRole(address asset, address account, RestrictedRole role) external onlyOperator {
        restrictedRoleOf[asset][account] = role;
        emit RestrictedRoleSet(asset, account, role);
    }

    /// @notice Register / clear an INDIRECT (control-cluster) role for `account`,
    ///         capturing "directly or indirectly" circumvention (doc §3.8, §5.4).
    function setClusterRole(address asset, address account, RestrictedRole role) external onlyOperator {
        clusterRoleOf[asset][account] = role;
        emit ClusterRoleSet(asset, account, role);
    }

    /// @notice Record the affiliated-purchaser (3) safe-harbor certification for
    ///         `account` (doc §3.7). When set, an affiliated-purchaser role is
    ///         dropped from restricted status (annual freshness is an operator
    ///         concern, doc §4.5/§11.4).
    function setInfoBarrierCertified(address asset, address account, bool certified) external onlyOperator {
        infoBarrierCertifiedOf[asset][account] = certified;
        emit InfoBarrierCertifiedSet(asset, account, certified);
    }

    /// @notice Record §242.101 written-policies certification for `account`, a
    ///         precondition of the participant de minimis exception (doc §3.12).
    function setPoliciesCertified(address asset, address account, bool certified) external onlyOperator {
        policiesCertifiedOf[asset][account] = certified;
        emit PoliciesCertifiedSet(asset, account, certified);
    }

    /// @dev Per-trade gate in doc §5.2 order; first hit wins. `user` IS the buyer
    ///      (engine passes ctx.buyer); `counterparty` (the seller) is deliberately
    ///      NOT screened (direction rule, §5.3). `context` is decoded only to read
    ///      FlowType for the redemption relaxation.
    function check(address user, address, address asset, uint256 amount, bytes calldata context)
        external
        view
        override
        returns (bool passed, bytes32 reasonCode)
    {
        // G③ applicability (§3.3). A token that is not the covered security is out
        //     of F-04's scope: PASS (NOT_APPLICABLE). Every unconfigured asset
        //     short-circuits here, so code 2 below only fires for a covered asset.
        if (!coveredSecurityOf[asset]) return (true, bytes32(0));

        // V2 excepted-security integrity (§3.11-3.12, §5.5). A non-NONE profile on
        //     a BUIDL-like asset is a mis-declaration; it is NEVER honored as an
        //     auto off-switch (reverse relaxation is forbidden) — surface for review.
        if (exceptionProfileOf[asset] != ExceptionProfile.NONE) return (false, _code(1));

        // Fail-closed (§4.2, §5.5): a covered asset with no offeringStatus is
        //     un-adjudicable. HALT — do not optimistically assume "not distributing".
        OfferingStatus st = offeringStatusOf[asset];
        if (st == OfferingStatus.UNSET) return (false, _code(2));

        // G① restricted period active? (§3.4). COMPLETED closes the window: PASS
        //     (NOT_IN_DISTRIBUTION). Continuous offerings never reach COMPLETED.
        if (st == OfferingStatus.COMPLETED) return (true, bytes32(0));

        // Redemption is structurally outside this gate (§3.10, §5.4, §6.3). If a
        //     REDEMPTION flow reaches F-04, PASS it explicitly. Decoded only for
        //     FlowType; a short/undecodable context skips the relaxation.
        if (context.length >= CTX_ENCODED_LEN) {
            ComplianceContext memory ctx = abi.decode(context, (ComplianceContext));
            if (ctx.flowType == FlowType.REDEMPTION) return (true, bytes32(0));
        }

        // Roster red flag (§5.5, F04-V3): cannot trust a "not restricted" verdict
        //     over an unresolved set. REVIEW rather than PASS.
        if (registryUnverifiedOf[asset]) return (false, _code(3));

        // G④ subject — screen the BUYER (§5.3). Direct roster OR indirect control
        //     cluster ("directly or indirectly", §3.8). Not restricted => PASS.
        RestrictedRole role = _restrictedRole(asset, user);
        if (role == RestrictedRole.NONE) return (true, bytes32(0));

        // G⑤ exception — participant-branch de minimis ONLY (§242.101(b)(7), §3.12).
        //     Issuer branch has none, so an issuer/SSH/affiliated buy is blocked no
        //     matter how small (asymmetry, T9).
        if (role == RestrictedRole.DISTRIBUTION_PARTICIPANT && _deMinimisException(asset, user, amount)) {
            return (true, bytes32(0));
        }

        // G⑥ routing + terminal block (§3.8-3.9). Distinct statute, distinct code.
        if (role == RestrictedRole.DISTRIBUTION_PARTICIPANT) return (false, _code(5)); // §242.101(a)
        return (false, _code(4)); // §242.102(a): ISSUER / SELLING_SECURITY_HOLDER / AFFILIATED_PURCHASER
    }

    /// @dev Resolve the restricted role of `account`: direct roster first, then
    ///      control-cluster (indirect). §242.100(b)(3) safe harbor: a certified
    ///      information-barrier affiliate is NOT an affiliated purchaser (doc §3.7).
    ///      Certification removes ONLY affiliated-purchaser status — an issuer /
    ///      SSH / participant cannot buy out of the gate via an info barrier.
    function _restrictedRole(address asset, address account) private view returns (RestrictedRole) {
        RestrictedRole direct = restrictedRoleOf[asset][account];
        RestrictedRole role = direct != RestrictedRole.NONE ? direct : clusterRoleOf[asset][account];
        if (role == RestrictedRole.AFFILIATED_PURCHASER && infoBarrierCertifiedOf[asset][account]) {
            return RestrictedRole.NONE;
        }
        return role;
    }

    /// @dev §242.101(b)(7) de minimis: purchase totaling < 2% of ADTV, by a person
    ///      maintaining written policies. STATELESS (§8.4): the doc's cumulative
    ///      counter is an off-chain exception-path aid; a view gate cannot
    ///      accumulate, so THIS trade's `amount` is the deterministic on-chain proxy
    ///      against the 2% threshold. Undefined ADTV or missing policies => no
    ///      exception. STRICT `<` — exactly 2% is not de minimis.
    function _deMinimisException(address asset, address account, uint256 amount) private view returns (bool) {
        uint256 adtv = adtvOf[asset];
        if (adtv == 0) return false;
        if (!policiesCertifiedOf[asset][account]) return false;
        return amount * BPS_DENOMINATOR < adtv * DE_MINIMIS_BPS;
    }

    /// @dev recipeId 0 is a placeholder; the engine re-encodes with the real recipeId.
    function _code(uint32 n) private pure returns (bytes32) {
        return ReasonCodes.encode(0, ELEMENT_ID, n);
    }
}
