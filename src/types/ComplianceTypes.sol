// SPDX-License-Identifier: GPL-3.0
pragma solidity 0.8.17;

enum PolicyStatus {
    UNKNOWN,
    UNREGULATED,
    ACTIVE,
    SUSPENDED
} // 0 = UNKNOWN, fail-closed

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
    uint256 allowedVenueTypes;
    bytes32 allowedVenuesHash;
    bytes32 reasonCode;
    bytes32 reliedClaims;
    bytes32 decisionHash;
}
