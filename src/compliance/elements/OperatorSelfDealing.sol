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

/// @dev F-01-v1 Operator self-dealing restriction (mock). STATELESS pre-trade
///      negative-screen gate: it blocks any trade in which the operator side
///      (Decipher legal entity, its Rule 405 affiliates, its associated persons,
///      or accounts they control) is a party. Same family as A-01 (Sanctions) —
///      an operator-maintained restricted roster compared with a strict block,
///      NOT an attestation/claim (doc §2 meta, §3.12, §8.2).
///
///      Legal anchor (doc §3). F-01 is not a transcription of any one statute;
///      it is a prophylactic gate that removes the *factual predicate* of an
///      antifraud violation before trade. Unconditional roots: Exchange Act
///      §10(b) / Rule 10b-5(a),(c) and Securities Act §17(a) (antifraud, "any
///      person" — applies whether or not the operator is a registered
///      broker/ATS, doc §1.3, §3.1-§3.3). Conditional reinforcement once venue
///      status is fixed: Reg ATS Rule 301(b)(10)(i)(B) — "controlling employees
///      trading for their own accounts" — of which this on-chain full block is
///      the strongest possible implementation (doc §3.5), plus §15(c)(1) /
///      Rule 10b-3 if broker (doc §3.6). Restricted-set scope comes from Rule
///      405 affiliate/control (doc §3.7). NOTE (doc §3.9, statutory anchor
///      exclusion): F-01 does NOT derive from ICA §17 — BUIDL-like interests are
///      excluded from the investment-company definition by §3(c)(7) and the
///      venue operator is not a §2(a)(3) affiliated person; never re-tag F-01
///      as ICA_17.
///
///      Roster model (doc §3.7, §3.12, §4.2). The roster is keyed by identity
///      and each entry carries a Rule-405 category tag. On-chain the doc's
///      judgment unit is the ONCHAINID (doc §3.12 "지갑이 아니라 사람"); this mock
///      keys the roster by wallet address as the on-chain proxy, because the
///      wallet->ONCHAINID resolution that defeats fresh-wallet evasion is A-04's
///      job upstream (doc §4.3, §7.5, §9.2). Roster completeness — the only
///      structural weakness (doc §5.4, §12 P0 reflection-window) — is the
///      operator/3-layer trust problem (doc §10), not something this element can
///      close by itself.
///
///      Screening is symmetric: a restricted party on EITHER side (buyer/to or
///      seller/from) blocks the trade (doc §5.3 matrix, §3.2). The engine passes
///      `user == ctx.buyer` (to) and `counterparty == ctx.seller` (from), so the
///      roster screen runs on the two check() address params directly (as in
///      A-01); the decoded ComplianceContext is used ONLY for the exception
///      logic (flowType + initiator), never for party identity.
///
///      Exceptions (doc §5.2 step 6, §6.3), evaluated only once a restricted
///      party is present, narrowly and explicitly (whitelist; ambiguity blocks):
///        (1) issuer primary distribution — flowType == PRIMARY_DISTRIBUTION AND
///            the from/seller is a Manifest-designated primary distributor
///            (`allowsPrimary`), modeling Manifest.allowsPrimary(idFrom, idTo);
///            a designated issuer that appears as a party in a SECONDARY trade is
///            NOT exempt and is blocked (doc §7.4 boundary note).
///        (2) involuntary transfer — forcedTransfer/recovery (lost-wallet, estate,
///            regulatory order). FlowType has no INVOLUNTARY member, so this maps
///            to `ctx.initiator` being a registered involuntary agent (the
///            multisig/time-lock recovery authority of doc §6.3② / §11.2), the
///            narrowest on-chain proxy for the "separate authority" path.
///      A restricted party in a plain secondary trade with no exception blocks.
///
///      Fail-closed (doc §5.5, §8.3, §5.2 step 2). Uncertainty resolves to a
///      block, never a pass: an unresolvable (zero-address) party fails closed
///      (code 1, A-04 upstream seam), and until the operator marks the roster
///      loaded (`registryAvailable`, default false) every trade fails closed
///      (code 2). PASS returns bytes32(0) per the element convention; the doc's
///      OP_CLEAR / OP_EXEMPT_* distinction is which PASS branch was taken, and is
///      an internal-audit fact, not a surfaced reason code (doc §6.1, §6.4).
///
///      Reason code map — `n` in `ReasonCodes.encode(0, ELEMENT_ID, n)` -> doc
///      §6.2 code name, in check() evaluation order:
///        1 | IDENTITY_UNRESOLVED     (from/to unresolvable — fail-closed; A-04 upstream)
///        2 | OP_REGISTRY_UNAVAILABLE (roster not loaded — fail-safe; doc §5.5/§8.3)
///        3 | OP_SELF_DEALING_BLOCKED (restricted party on either side, no exception)
///      PASS branches (reasonCode 0, doc §6.2 names, audit-only):
///        - OP_CLEAR             neither party restricted (step 5)
///        - OP_EXEMPT_PRIMARY    issuer primary distribution (step 6 ①)
///        - OP_EXEMPT_INVOLUNTARY forcedTransfer/recovery (step 6 ②)
contract OperatorSelfDealing is BaseElement, Governed {
    bytes32 internal constant ELEMENT_ID = "F-01-v1";

    /// @dev Restricted-roster category tags — Rule 405 affiliate/control scope and
    ///      §3(a)(18) associated persons (doc §3.7, §3.12). NONE (0) = not on the
    ///      roster. The block outcome is identical for every non-NONE tag; the tag
    ///      is carried for the internal audit record only (doc §6.4), never to vary
    ///      the pass/fail result.
    enum OperatorRole {
        NONE, // 0 = not a restricted party
        OPERATOR_ENTITY, // Decipher legal entity itself
        OPERATOR_AFFILIATE, // Rule 405 control affiliate (common control)
        OPERATOR_ASSOCIATED_PERSON, // officer/director/employee (§3(a)(18))
        OPERATOR_CONTROLLED_ACCOUNT // account controlled by any of the above
    }

    /// @dev abi.encode(ComplianceContext) length: 11 static head-only fields
    ///      (5 address, 2 uint256, 2 enum, 1 address, 1 bool) => 11 words => 352
    ///      bytes, no dynamic tail. A context shorter than this cannot be decoded,
    ///      so it is caught before abi.decode (which would revert) and treated as a
    ///      plain secondary trade with no exception available — fail-closed.
    uint256 internal constant CTX_ENCODED_LEN = 352;

    /// @notice ONCHAINID-proxy (wallet) => restricted-roster tag. `setRestrictedParty`
    ///         writes it; control judgment itself is settled off-chain by A-06 and
    ///         only its result lands here (doc §3.7, §5.5).
    mapping(address => OperatorRole) public roleOf;

    /// @notice Fail-safe roster load switch. Default false => the roster is treated
    ///         as UNAVAILABLE and every trade fails closed (code 2) until the
    ///         operator confirms the on-chain roster is loaded (doc §5.2 step 2).
    bool public registryAvailable;

    /// @notice Manifest-designated primary-distribution source (from/issuer). Gates
    ///         exception ① together with flowType == PRIMARY_DISTRIBUTION.
    mapping(address => bool) public allowsPrimary;

    /// @notice Registered forcedTransfer/recovery authority (multisig/time-lock).
    ///         A trade whose `ctx.initiator` is such an agent is exception ②.
    mapping(address => bool) public involuntaryAgent;

    event RestrictedPartySet(address indexed account, OperatorRole role);
    event RegistryAvailabilitySet(bool available);
    event PrimaryDistributorSet(address indexed distributor, bool allowed);
    event InvoluntaryAgentSet(address indexed agent, bool authorized);

    constructor()
        BaseElement(ElementMetadata({
                elementId: ELEMENT_ID,
                // Organizationally R4 market-conduct monitoring (doc §2); functionally
                // a global pre-trade gate like A-01 (doc §9.3).
                category: ElementCategory.CONDUCT_MONITORING,
                version: "F-01-v1",
                temporal: TemporalNature.REALTIME,
                decidability: Decidability.DETERMINISTIC,
                timing: ObligationTiming.AT_TRADE_GATE,
                statefulness: Statefulness.STATELESS
            }))
    {}

    /// @notice Adds/updates/removes a restricted-roster entry (set NONE to remove).
    /// @dev Operational transaction, not a trade — the roster is read-only during
    ///      check() (doc §5.4 STATELESS basis). Controlled off-chain by governance
    ///      multisig/time-lock in production (doc §11.2).
    function setRestrictedParty(address account, OperatorRole role) external onlyOperator {
        roleOf[account] = role;
        emit RestrictedPartySet(account, role);
    }

    /// @notice Marks the on-chain roster loaded/unloaded (fail-safe switch).
    function setRegistryAvailable(bool available) external onlyOperator {
        registryAvailable = available;
        emit RegistryAvailabilitySet(available);
    }

    /// @notice Designates (or clears) a Manifest primary-distribution source.
    function setPrimaryDistributor(address distributor, bool allowed) external onlyOperator {
        allowsPrimary[distributor] = allowed;
        emit PrimaryDistributorSet(distributor, allowed);
    }

    /// @notice Registers (or clears) a forcedTransfer/recovery authority.
    function setInvoluntaryAgent(address agent, bool authorized) external onlyOperator {
        involuntaryAgent[agent] = authorized;
        emit InvoluntaryAgentSet(agent, authorized);
    }

    /// @dev doc §5.2 order. `asset`/`amount` are unused — F-01 is party-scoped and
    ///      never looks at eligibility or amount. `user` == ctx.buyer (to),
    ///      `counterparty` == ctx.seller (from).
    function check(address user, address counterparty, address, uint256, bytes calldata context)
        external
        view
        override
        returns (bool passed, bytes32 reasonCode)
    {
        // step 1 — identity resolution. In production A-04 resolves wallet->ONCHAINID
        //          and rejects unlinked wallets upstream (doc §4.3, §7.5); the mock's
        //          only observable proxy for an unresolvable party is the zero
        //          address, screened fail-closed here.
        if (user == address(0) || counterparty == address(0)) {
            return (false, _code(1)); // IDENTITY_UNRESOLVED
        }

        // step 2 — roster load (fail-safe; doc §5.5, §8.3).
        if (!registryAvailable) {
            return (false, _code(2)); // OP_REGISTRY_UNAVAILABLE
        }

        // step 3~5 — symmetric roster screen (both sides; doc §5.3 matrix).
        bool fromRestricted = roleOf[counterparty] != OperatorRole.NONE; // seller / from
        bool toRestricted = roleOf[user] != OperatorRole.NONE; // buyer / to
        if (!fromRestricted && !toRestricted) {
            return (true, bytes32(0)); // OP_CLEAR
        }

        // step 6 — exception evaluation (a restricted party is present). Decode the
        //          context only now; a short/absent context => no exception, block.
        FlowType flow = FlowType.SECONDARY_TRADE;
        address initiator = address(0);
        if (context.length >= CTX_ENCODED_LEN) {
            ComplianceContext memory ctx = abi.decode(context, (ComplianceContext));
            flow = ctx.flowType;
            initiator = ctx.initiator;
        }

        // ① issuer primary distribution — narrow: from/issuer must be a designated
        //    primary distributor AND the flow must be PRIMARY_DISTRIBUTION.
        if (flow == FlowType.PRIMARY_DISTRIBUTION && allowsPrimary[counterparty]) {
            return (true, bytes32(0)); // OP_EXEMPT_PRIMARY
        }

        // ② involuntary — forcedTransfer/recovery initiated by a registered agent.
        if (involuntaryAgent[initiator]) {
            return (true, bytes32(0)); // OP_EXEMPT_INVOLUNTARY
        }

        // no exception => block (doc §5.3).
        return (false, _code(3)); // OP_SELF_DEALING_BLOCKED
    }

    /// @dev recipeId 0 is a placeholder; the engine re-encodes with the real recipeId.
    function _code(uint32 n) private pure returns (bytes32) {
        return ReasonCodes.encode(0, ELEMENT_ID, n);
    }
}
