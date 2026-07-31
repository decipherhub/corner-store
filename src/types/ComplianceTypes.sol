// SPDX-License-Identifier: GPL-3.0
pragma solidity 0.8.17;

// Manifest lifecycle: UNKNOWN --register--> PROPOSED --approve--> ACTIVE,
// ACTIVE <--resume--/--suspend--> SUSPENDED, and {ACTIVE, SUSPENDED} --retire-->
// RETIRED (terminal, re-register only). UNKNOWN --setUnregulated--> UNREGULATED.
//
// STORAGE ORDER != SEMANTIC ORDER. PROPOSED and RETIRED are APPENDED at indices
// 4 and 5 so the pre-existing numeric values stay load-bearing: UNKNOWN=0 (the
// fail-closed default for an absent manifest), UNREGULATED=1, ACTIVE=2,
// SUSPENDED=3 are relied on by storage layout and by enum<->uint casts across
// src/ and test/. The lifecycle graph above therefore does NOT follow the
// enum's numeric order. Never reorder these members; only ever append.
enum PolicyStatus {
    UNKNOWN, // 0 = fail-closed default
    UNREGULATED, // 1
    ACTIVE, // 2
    SUSPENDED, // 3
    PROPOSED, // 4 (appended)
    RETIRED // 5 (appended)
}

// LOAD-BEARING ORDER: ManifestCore.supportedEngines is a bitmask indexed by
// VenueType value (bit i == VenueType(i): AMM=0, ORDER_BOOK=1, RFQ=2).
// ComplianceEngine._buildDecision maps supportedEngines 1:1 into
// allowedVenueTypes, and VenueSelector reads those bits against ctx.venueType.
// Reordering this enum silently changes manifest semantics — the order is a
// convention shared across the engine, the manifest, and the selector.
enum VenueType {
    AMM,
    ORDER_BOOK,
    RFQ
}

enum FlowType {
    SECONDARY_TRADE,
    PRIMARY_DISTRIBUTION,
    REDEMPTION
}

enum RecipeBindingMode {
    REQUIRED_BLOCKING,
    PATH_OPTION,
    FLAG_ONLY
}

struct RecipeBinding {
    uint16 recipeId;
    uint16 recipeVersion;
    RecipeBindingMode mode;
    uint16 pathGroupId;
    uint8 priority;
}

// 04-element-interface.md §2-3 (stable, verbatim)
enum ElementCategory {
    INVESTOR_ATTRIBUTE,
    ASSET_ATTRIBUTE,
    RESALE_TRANSACTION,
    SYSTEM_STATE,
    ISSUER_STATUS,
    CONDUCT_MONITORING,
    PROCEDURAL
}

enum Decidability {
    DETERMINISTIC,
    ATTESTATION_BASED,
    MONITORING_BASED
}

enum ObligationTiming {
    EX_ANTE_VERIFY,
    AT_TRADE_GATE,
    EX_POST_TRIGGER
}

enum Statefulness {
    STATELESS,
    STATEFUL
}

enum TemporalNature {
    ONE_TIME,
    PERIODIC,
    REALTIME,
    CUMULATIVE
}

struct ElementMetadata {
    bytes32 elementId;
    ElementCategory category;
    string version;
    TemporalNature temporal;
    Decidability decidability;
    ObligationTiming timing;
    Statefulness statefulness;
}

struct ManifestCore {
    PolicyStatus status;
    // Deprecated compatibility mirrors. Runtime evaluation uses the registry's
    // RecipeBinding[] exclusively; remove these fields at the next major ABI.
    uint16 issuanceRecipeId;
    uint16 issuanceRecipeVersion;
    uint16 fundRecipeId;
    uint32 enabledResalePaths;
    uint8 supportedEngines;
    uint16 stateScopeId;
    uint256 factsPacked;
    uint256 coverageScope;
    bytes32 fullManifestHash;
    address declaredBy;
    address approvedBy;
}

struct ComplianceContext {
    address initiator;
    address buyer;
    address seller;
    address tokenIn;
    address tokenOut;
    uint256 amountIn;
    uint256 amountOut;
    VenueType venueType;
    address venue;
    FlowType flowType;
    bool sellerIsAffiliate;
}

struct ComplianceDecision {
    bool allowed;
    bytes32 policyId;
    uint64 policyVersion;
    uint64 validUntil;
    uint256 maxAmount;
    address maxAmountToken;
    uint256 allowedVenueTypes;
    bytes32 allowedVenuesHash;
    bytes32 reasonCode;
    bytes32 reliedClaims;
    uint256 flagsBitmap;
    bytes32 decisionHash;
}
