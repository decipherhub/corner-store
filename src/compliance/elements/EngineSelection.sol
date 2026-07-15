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
    VenueType
} from "../../types/ComplianceTypes.sol";
import {ReasonCodes} from "../../libraries/ReasonCodes.sol";

/// @dev B-04-v1 Engine selection (mock). Gates whether *this trade* may settle on
///      *this engine* for *this asset* — the "how is it sold" axis of resale
///      compliance (Rule 144(f) manner-of-sale + §4(a)(7) no-general-solicitation).
///      The engine (call path) IS the legal manner of sale (doc §5.4), so the gate
///      is a pure set-membership evaluation over three sealed inputs: the card's
///      declared engine set, the platform governance sets, and the trade context.
///
///      This is the ONE element that decodes `context`: ComplianceEngine passes
///      `abi.encode(ComplianceContext)` as the element context (ComplianceEngine.sol
///      _runChecks). The engine identity is `ctx.venueType`, the affiliate flag is
///      `ctx.sellerIsAffiliate`, and the market-maker-claim subject is `ctx.buyer`.
///
///      Engine bitmask convention MUST match `ManifestCore.supportedEngines`:
///      bit i == VenueType(i), i.e. AMM=bit0(0x01), ORDER_BOOK=bit1(0x02),
///      RFQ=bit2(0x04) (see ComplianceTypes.VenueType). NOTE: this differs from the
///      element walkthrough §3.16 (which sketched bit0=RFQ); the repo-wide manifest
///      convention is authoritative here, and the two RFQ-only governance sets are
///      initialised accordingly (RFQ_BIT).
///
///      EVENT OMISSION: the doc (§5.2, §3.16) specifies a per-check `B04Check`
///      audit event. `check` is `view` (inherited IComplianceElement signature —
///      cannot be widened here), so emitting from it is impossible. The gate's
///      pass/fail semantics are preserved exactly; only the check-time event is
///      dropped. Setter events (governance-plane + card-declaration mutations) are
///      retained — those functions are non-view.
///
///      Reason-code table (n => doc §6.2 failure-code name):
///        1 = FAIL_ENGINE_DECL_MISSING          (V1/G① — supportedEngines empty)
///        2 = FAIL_ENGINE_DECL_INVALID          (V2/G① — bit outside VALID_ENGINES)
///        3 = FAIL_ENGINE_UNKNOWN               (G②   — engine unidentifiable)
///        4 = FAIL_ENGINE_NOT_SUPPORTED         (G③   — engine not in card set)
///        5 = FAIL_ENGINE_PATH_INCOMPATIBLE     (G④   — §4(a)(7) path overlay)
///        6 = FAIL_ENGINE_AFFILIATE_INCOMPATIBLE(G⑤a  — Rule 144(f) engine overlay)
///        7 = FAIL_ENGINE_MM_CLAIM_MISSING      (G⑤b  — RFQ counterparty MM claim)
contract EngineSelection is BaseElement, Governed {
    bytes32 internal constant ELEMENT_ID = "B-04-v1";

    /// @dev All three legal engines: AMM|ORDER_BOOK|RFQ = 0x01|0x02|0x04.
    uint8 internal constant VALID_ENGINES = 0x07;
    /// @dev RFQ = VenueType(2) => bit2. The current AFFILIATE/NO_GS sets are {RFQ}.
    uint8 internal constant RFQ_BIT = uint8(1) << uint8(VenueType.RFQ);

    /// @dev Length of `abi.encode(ComplianceContext)`. ComplianceContext is 11
    ///      statically-sized fields (5 address, 2 uint256, 2 enum, 1 address, 1
    ///      bool) => 11 words => 352 bytes, head-only (no dynamic tail). A context
    ///      shorter than this cannot be decoded, so it is caught before `abi.decode`
    ///      (which would revert) and mapped to the fail-closed code 3.
    uint256 internal constant CTX_ENCODED_LEN = 352;

    /// @notice asset => declared supported-engines bitset (card declaration mock).
    mapping(address => uint8) public supportedEnginesOf;
    /// @notice asset => this trade routes the §4(a)(7) resale path (C-00 mock).
    mapping(address => bool) public sec4a7PathOf;
    /// @notice asset => security is a debt security (Rule 144(f)(3)(ii) carve-out).
    mapping(address => bool) public isDebtSecurityOf;
    /// @notice buyer => holds a MARKET_MAKER_STATUS claim (A-11-scoped mock).
    mapping(address => bool) public mmClaimOf;

    /// @notice Governance constant — §4(a)(7) no-general-solicitation engine set.
    ///         Governance-plane input, not a card fact; widening is a legal
    ///         judgment gated off-chain (doc §11.2). Initialised to {RFQ}.
    uint8 public noGsEngineSet;
    /// @notice Governance constant — Rule 144(f) affiliate manner-of-sale set.
    ///         Initialised to {RFQ}; the (i)/(iii) branches stay closed until a
    ///         registered BD / SRO-reporting path exists (doc §3.4-3.7).
    uint8 public affiliateEngineSet;

    event SupportedEnginesSet(address indexed asset, uint8 engines);
    event Sec4a7PathSet(address indexed asset, bool active);
    event DebtSecuritySet(address indexed asset, bool isDebt);
    event MarketMakerClaimSet(address indexed buyer, bool hasClaim);
    event NoGsEngineSetUpdated(uint8 engineSet);
    event AffiliateEngineSetUpdated(uint8 engineSet);

    constructor()
        BaseElement(ElementMetadata({
                elementId: ELEMENT_ID,
                category: ElementCategory.RESALE_TRANSACTION,
                version: "B-04-v1",
                temporal: TemporalNature.REALTIME,
                decidability: Decidability.DETERMINISTIC,
                timing: ObligationTiming.AT_TRADE_GATE,
                statefulness: Statefulness.STATELESS
            }))
    {
        // Current legally-confirmed sets are both {RFQ} (doc §3.16, §3.4, §3.8).
        noGsEngineSet = RFQ_BIT;
        affiliateEngineSet = RFQ_BIT;
    }

    /// @notice Declare (or clear) the supported-engines bitset for `asset`.
    function setSupportedEngines(address asset, uint8 engines) external onlyOperator {
        supportedEnginesOf[asset] = engines;
        emit SupportedEnginesSet(asset, engines);
    }

    /// @notice Set whether `asset`'s current trade routes the §4(a)(7) resale path.
    function setSec4a7Path(address asset, bool active) external onlyOperator {
        sec4a7PathOf[asset] = active;
        emit Sec4a7PathSet(asset, active);
    }

    /// @notice Set whether `asset` is a debt security (Rule 144(f)(3)(ii) carve-out).
    function setDebtSecurity(address asset, bool isDebt) external onlyOperator {
        isDebtSecurityOf[asset] = isDebt;
        emit DebtSecuritySet(asset, isDebt);
    }

    /// @notice Set whether `buyer` holds a market-maker-status claim.
    function setMarketMakerClaim(address buyer, bool hasClaim) external onlyOperator {
        mmClaimOf[buyer] = hasClaim;
        emit MarketMakerClaimSet(buyer, hasClaim);
    }

    /// @notice Update the §4(a)(7) no-general-solicitation engine set (governance).
    function setNoGsEngineSet(uint8 engineSet) external onlyOperator {
        noGsEngineSet = engineSet;
        emit NoGsEngineSetUpdated(engineSet);
    }

    /// @notice Update the Rule 144(f) affiliate engine set (governance).
    function setAffiliateEngineSet(uint8 engineSet) external onlyOperator {
        affiliateEngineSet = engineSet;
        emit AffiliateEngineSetUpdated(engineSet);
    }

    /// @notice Listing-time declaration check (doc §5.2 V1/V2), same codes 1/2 as
    ///         the runtime G① recheck. V3a (AMM venue-pool registration) and V3b
    ///         (fund + AMM acquirer-identity review) need VenueRegistry/manifest
    ///         access and live with the operator/factory layer — out of scope here.
    function validateEngineDeclaration(address asset) external view returns (bool ok, bytes32 reasonCode) {
        uint8 se = supportedEnginesOf[asset];
        if (se == 0) return (false, _code(1)); // V1 — missing declaration
        if ((se & ~VALID_ENGINES) != 0) return (false, _code(2)); // V2 — unknown bit
        return (true, bytes32(0));
    }

    /// @dev Per-trade gate G①→G⑤ in doc §5.2 order; first failure wins. `user`,
    ///      `counterparty`, `amount` are ignored — the subjects come from the
    ///      decoded ComplianceContext. All overlays only NARROW the declared set
    ///      (never open an undeclared engine), and when both the §4(a)(7) path
    ///      overlay (G④) and the affiliate overlay (G⑤) are active the engine must
    ///      satisfy BOTH — the two sequential fail-fast gates realise an
    ///      INTERSECTION, never a union (doc §5.3 last row).
    function check(address, address, address asset, uint256, bytes calldata context)
        external
        view
        override
        returns (bool passed, bytes32 reasonCode)
    {
        // G① Card recheck — replay listing V1/V2 on the trade-time snapshot to
        //     catch drift between correction versions. SLOAD + bitmask only.
        uint8 se = supportedEnginesOf[asset];
        if (se == 0) return (false, _code(1)); // FAIL_ENGINE_DECL_MISSING
        if ((se & ~VALID_ENGINES) != 0) return (false, _code(2)); // FAIL_ENGINE_DECL_INVALID

        // G② Engine identification. The call path IS the engine (doc §5.4), and the
        //     engine hands it to us as abi.encode(ComplianceContext). A decoded
        //     VenueType enum can never be out of range, so code 3 is unreachable
        //     from a well-formed context. It is kept as a fail-closed safety pin:
        //     an empty / short (undecodable-length) context means the engine could
        //     not be identified — e.g. a deploy-order fault where a new engine ships
        //     before the context wiring — and fail-closed is the only safe direction
        //     (doc §5.2 G② rationale, §3.1 §5 default-is-prohibited).
        if (context.length < CTX_ENCODED_LEN) return (false, _code(3)); // FAIL_ENGINE_UNKNOWN

        ComplianceContext memory ctx = abi.decode(context, (ComplianceContext));
        uint8 engineBit = uint8(1) << uint8(ctx.venueType);

        // G③ Declaration membership — enforce the card's declared engine set.
        if ((engineBit & se) == 0) return (false, _code(4)); // FAIL_ENGINE_NOT_SUPPORTED

        // G④ §4(a)(7) path overlay — that path requires a no-general-solicitation
        //     engine (§77d(d)(2)). Asymmetric implication: only SEC4A7 constrains;
        //     a Rule 144 non-affiliate path has no manner/solicitation axis.
        if (sec4a7PathOf[asset] && (engineBit & noGsEngineSet) == 0) {
            return (false, _code(5)); // FAIL_ENGINE_PATH_INCOMPATIBLE
        }

        // G⑤ Affiliate overlay — Rule 144(b)(2)/(f) manner-of-sale. Rule
        //     144(f)(3)(ii) exempts debt securities entirely; omitting this
        //     `!isDebtSecurityOf` branch would over-block affiliate debt sales.
        if (ctx.sellerIsAffiliate && !isDebtSecurityOf[asset]) {
            // G⑤a engine must be in the affiliate manner-of-sale set.
            if ((engineBit & affiliateEngineSet) == 0) {
                return (false, _code(6)); // FAIL_ENGINE_AFFILIATE_INCOMPATIBLE
            }
            // G⑤b RFQ-to-market-maker requires the counterparty's MM claim
            //     (§3(a)(38); the only off-chain-attested atom in this element).
            if (ctx.venueType == VenueType.RFQ && !mmClaimOf[ctx.buyer]) {
                return (false, _code(7)); // FAIL_ENGINE_MM_CLAIM_MISSING
            }
        }

        return (true, bytes32(0));
    }

    function _code(uint32 n) private pure returns (bytes32) {
        return ReasonCodes.encode(0, ELEMENT_ID, n);
    }
}
