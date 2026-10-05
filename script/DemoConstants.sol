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

    // C-01-free AMM reference recipe used only by integration coverage.
    uint16 internal constant AMM_REFERENCE_RECIPE_ID = 8;
    uint16 internal constant AMM_REFERENCE_RECIPE_VERSION = 1;
    // Full selected profile plus F-02 surveillance, exercised through RFQ.
    uint16 internal constant SURVEIL_RECIPE_ID = 7;
    uint16 internal constant SURVEIL_RECIPE_VERSION = 3;

    // Deployment artifact shared between the two scripts.
    string internal constant ARTIFACT_PATH = "deployments/anvil-e2e.json";
    string internal constant MANIFEST_SNAPSHOT_PATH = "deployments/operator-manifest.json";
    // The launcher copies the selected, validated fixture here. Solidity scripts
    // read this runtime copy so custom scenarios affect real mint/transfer data,
    // not only presentation labels in the dashboard.
    string internal constant SCENARIO_RUNTIME_PATH = "deployments/anvil-e2e-scenario.json";
}
