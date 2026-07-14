// SPDX-License-Identifier: GPL-3.0
pragma solidity 0.8.17;

import {Script} from "forge-std/Script.sol";
import {console2} from "forge-std/console2.sol";

import {IToken} from "@erc3643/token/IToken.sol";
import {IdentityRegistry} from "@erc3643/registry/implementation/IdentityRegistry.sol";
import {ClaimIssuer} from "@onchain-id/solidity/contracts/ClaimIssuer.sol";
import {IClaimIssuer} from "@onchain-id/solidity/contracts/interface/IClaimIssuer.sol";

import {TREXCore} from "../test/fixtures/TREXCore.sol";
import {DemoConstants} from "./DemoConstants.sol";

/// @title KycInvestor
/// @notice Onboards ONE fresh investor (or venue) into the ALREADY-DEPLOYED
///         ERC-3643 (T-REX) stack: deploys an OnchainID for the subject, attaches
///         a KYC claim signed by the deterministic trusted issuer, and registers
///         the identity so `isVerified(subject)` becomes true and the RWA token
///         can move to/from it.
///
/// @dev The CLI (`corner-store kyc <addr>`) shells out to this script. It reuses
///      the shared {TREXCore} helpers rather than redeploying: it re-binds
///      TREXCore's `idRegistry` / `claimIssuer` state to the live deployment
///      discovered from the artifact's `rwaToken` (Token.identityRegistry() ->
///      IdentityRegistry.issuersRegistry() -> getTrustedIssuers()[0]). The trusted
///      issuer signing key is the deterministic constant in TREXCore, so no key
///      material needs to travel through the artifact.
///
///      MUST be run from the repo root (relative artifact path + fs_permissions).
///      Broadcasts as the deployer (Anvil account 0), which is the T-REX admin
///      (registry agent + every OnchainID's management key) — see TREXCore ADMIN
///      MODEL.
///
///      Inputs (env):
///        SUBJECT  = address to KYC (required)
///        ARTIFACT = deployment artifact path (default deployments/anvil-e2e.json)
contract KycInvestor is Script, TREXCore, DemoConstants {
    function run() external {
        uint256 deployerPk = vm.deriveKey(MNEMONIC, 0);
        address deployer = vm.addr(deployerPk);
        address subject = vm.envAddress("SUBJECT");
        string memory artifactPath = vm.envOr("ARTIFACT", string(ARTIFACT_PATH));

        string memory json = vm.readFile(artifactPath);
        address rwa = vm.parseJsonAddress(json, ".rwaToken");

        // Re-bind the shared TREXCore state to the LIVE deployment.
        trexAdmin = deployer;
        issuerAddr = vm.addr(issuerKey);
        idRegistry = IdentityRegistry(address(IToken(rwa).identityRegistry()));
        IClaimIssuer[] memory issuers = idRegistry.issuersRegistry().getTrustedIssuers();
        require(issuers.length > 0, "KycInvestor: no trusted issuer in the live stack");
        claimIssuer = ClaimIssuer(address(issuers[0]));

        require(!idRegistry.contains(subject), "KycInvestor: subject already has a registered identity");

        vm.startBroadcast(deployerPk);
        verifyInvestor(subject);
        vm.stopBroadcast();

        console2.log("KYC registered for subject:", subject);
        console2.log("  isVerified now:", idRegistry.isVerified(subject));
    }
}
