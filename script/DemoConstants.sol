// SPDX-License-Identifier: GPL-3.0
pragma solidity 0.8.17;

/// @title DemoConstants
/// @notice Shared, deterministic constants for the live-Anvil E2E demo scripts
///         ({DeployStack} and {DemoScenarios}). Centralised so the deploy and the
///         scenario runner never drift on accounts, amounts, or the artifact path.
abstract contract DemoConstants {
    // Anvil's well-known development mnemonic. Accounts:
    //   0 = deployer (owner/operator)   1 = investor (buyer/taker)
    //   2 = RFQ maker (approved dealer)  3 = unapproved maker
    string internal constant MNEMONIC = "test test test test test test test test test test test junk";

    // Deterministic RFQ venue label (non-custodial: target/operator zero).
    address internal constant RFQ_VENUE = 0x000000000000000000000000000000000000F00D;

    // Reg D 506(c) fixture facts.
    bytes32 internal constant ALLOWED_JURISDICTION = bytes32("US");
    bytes32 internal constant REG_D_CLASS = bytes32("REG_D");
    uint64 internal constant LOCKUP_SECONDS = 365 days;

    // supportedEngines / allowedVenueTypes bits (indexed by VenueType value).
    uint8 internal constant ENGINES_AMM = uint8(1 << 0); // VenueType.AMM
    uint8 internal constant ENGINES_RFQ = uint8(1 << 2); // VenueType.RFQ

    // Surveillance-enabled RegD recipe id (deployed by DeployStack, used by
    // scenario 6). Distinct from the base RegD 506(c) recipe (id 1) so the
    // scenario-3 rejection reason code stays ReasonCodes.encode(1, "A-02-v1", 1).
    uint16 internal constant SURVEIL_RECIPE_ID = 7;

    // Demo amounts.
    // The default live profile is BUIDL-like and enforces a 5M-token minimum.
    // Keep enough fixture liquidity for all AMM/RFQ/surveillance scenarios.
    uint256 internal constant INVESTOR_QUOTE = 50_000_000 ether;
    uint256 internal constant MAKER_RWA = 10_000_000 ether;
    uint256 internal constant POOL_RWA = 50_000_000 ether;
    uint256 internal constant AMM_TRADE = 5_000_000 ether; // QUOTE in == RWA out (1:1 pool)
    uint256 internal constant RFQ_QUOTE_IN = 5_000_000 ether;
    uint256 internal constant RFQ_RWA_OUT = 5_000_000 ether;

    // Deployment artifact shared between the two scripts.
    string internal constant ARTIFACT_PATH = "deployments/anvil-e2e.json";
    string internal constant MANIFEST_SNAPSHOT_PATH = "deployments/operator-manifest.json";
}
