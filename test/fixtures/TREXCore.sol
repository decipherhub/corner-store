// SPDX-License-Identifier: GPL-3.0
pragma solidity 0.8.17;

import {CommonBase} from "forge-std/Base.sol";

import {Token} from "@erc3643/token/Token.sol";
import {IToken} from "@erc3643/token/IToken.sol";
import {IdentityRegistry} from "@erc3643/registry/implementation/IdentityRegistry.sol";
import {IdentityRegistryStorage} from "@erc3643/registry/implementation/IdentityRegistryStorage.sol";
import {ClaimTopicsRegistry} from "@erc3643/registry/implementation/ClaimTopicsRegistry.sol";
import {TrustedIssuersRegistry} from "@erc3643/registry/implementation/TrustedIssuersRegistry.sol";
import {ModularCompliance} from "@erc3643/compliance/modular/ModularCompliance.sol";

import {Identity} from "@onchain-id/solidity/contracts/Identity.sol";
import {ClaimIssuer} from "@onchain-id/solidity/contracts/ClaimIssuer.sol";
import {IIdentity} from "@onchain-id/solidity/contracts/interface/IIdentity.sol";
import {IClaimIssuer} from "@onchain-id/solidity/contracts/interface/IClaimIssuer.sol";

/// @title TREXCore
/// @notice Deployable, REAL ERC-3643 (T-REX) + OnchainID deployment core, shared
///         by the test fixture ({TREXSuite}) and the live deploy script
///         ({DeployStack}).
///
/// Stands up a fully-wired permissioned-token stack so that
/// `identityRegistry.isVerified(investor)` is genuinely enforced and
/// `token.transfer` honours on-chain compliance — no mocking of the token,
/// registry, or claim-verification path.
///
/// @dev This is `abstract contract is CommonBase` (forge-std), which is the
/// shared ancestor of both `Test` and `Script`, so the SAME deployment logic runs
/// under `forge test` (in-memory EVM) and under `forge script --broadcast`
/// (against a live node) without duplication. Building a valid OnchainID claim
/// requires `vm.sign` (the claim signature is an `eth_sign`-prefixed ECDSA
/// signature by the trusted ClaimIssuer's key), which `CommonBase` exposes.
///
/// ADMIN MODEL (why there is no `vm.prank`): every deployed OnchainID is created
/// with `trexAdmin` as its management key, and the KYC claim is added by
/// `trexAdmin`. In a test `trexAdmin == address(this)` (the fixture is the caller
/// of `addClaim`); in a broadcast script `trexAdmin == the deployer EOA` (the
/// broadcaster is the caller). In BOTH cases `msg.sender == trexAdmin == the
/// identity's management key`, so `addClaim` authorizes with no prank/broadcast
/// juggling. The identity's management key is irrelevant to `isVerified` (which
/// only checks a registered identity carrying a valid trusted-issuer claim), so
/// this does not weaken the real ERC-3643 verification path.
///
/// Verification model (matches T-REX `IdentityRegistry.isVerified` +
/// OnchainID `ClaimIssuer.isClaimValid`):
///   - ONE required claim topic (`CLAIM_TOPIC_KYC`).
///   - ONE trusted ClaimIssuer, whose management key (also a claim/purpose-1
///     key, which `keyHasPurpose` treats as satisfying any purpose) signs the
///     claim.
///   - The claim signature signs:
///       keccak256("\x19Ethereum Signed Message:\n32",
///                 keccak256(abi.encode(investorIdentity, topic, data)))
///     so that `ClaimIssuer.isClaimValid` recovers the issuer key and finds it
///     has purpose 3 (CLAIM) on the issuer identity.
abstract contract TREXCore is CommonBase {
    // --- claim topic & issuer key ----------------------------------------
    uint256 internal constant CLAIM_TOPIC_KYC = uint256(keccak256("CORNER_STORE.KYC"));
    uint256 internal constant CLAIM_SCHEME_ECDSA = 1;
    uint16 internal constant DEFAULT_COUNTRY = 840; // ISO-3166 US

    // deterministic issuer signing key (foundry test key)
    uint256 internal issuerKey = uint256(keccak256("CORNER_STORE.TRUSTED_ISSUER_KEY"));
    address internal issuerAddr;

    // Management key of every deployed OnchainID + agent of the registry/token.
    // Set by {deployTREX}; see ADMIN MODEL above.
    address internal trexAdmin;

    // --- deployed T-REX stack --------------------------------------------
    ClaimTopicsRegistry internal claimTopics;
    TrustedIssuersRegistry internal trustedIssuers;
    IdentityRegistryStorage internal identityStorage;
    IdentityRegistry internal idRegistry;
    ModularCompliance internal compliance;
    Token internal rwaToken;
    ClaimIssuer internal claimIssuer;

    /// @notice Stand up and wire the full ERC-3643 stack with `address(this)` as
    ///         the admin (the in-memory test path). Call from `setUp()`.
    function deployTREX() internal {
        deployTREX(address(this));
    }

    /// @notice Stand up the same stack with scenario-specific token metadata.
    function deployTREX(string memory tokenName, string memory tokenSymbol) internal {
        deployTREX(address(this), tokenName, tokenSymbol);
    }

    /// @notice Stand up and wire the full ERC-3643 stack with an explicit admin.
    ///         Under `forge script --broadcast`, pass the broadcasting deployer so
    ///         the registry/token agents and identity management keys are that EOA.
    function deployTREX(address admin) internal {
        deployTREX(admin, "Corner Store RWA", "csRWA");
    }

    /// @notice Stand up the same stack with an explicit admin and token metadata.
    function deployTREX(address admin, string memory tokenName, string memory tokenSymbol) internal {
        trexAdmin = admin;
        issuerAddr = vm.addr(issuerKey);

        // 1. registries
        claimTopics = new ClaimTopicsRegistry();
        claimTopics.init();
        claimTopics.addClaimTopic(CLAIM_TOPIC_KYC);

        trustedIssuers = new TrustedIssuersRegistry();
        trustedIssuers.init();

        // 2. trusted ClaimIssuer (its management key signs investor claims).
        //    management key (purpose 1) satisfies the purpose-3 (CLAIM) check.
        claimIssuer = new ClaimIssuer(issuerAddr);
        uint256[] memory topics = new uint256[](1);
        topics[0] = CLAIM_TOPIC_KYC;
        trustedIssuers.addTrustedIssuer(IClaimIssuer(address(claimIssuer)), topics);

        // 3. identity storage + registry
        identityStorage = new IdentityRegistryStorage();
        identityStorage.init();

        idRegistry = new IdentityRegistry();
        idRegistry.init(address(trustedIssuers), address(claimTopics), address(identityStorage));
        identityStorage.bindIdentityRegistry(address(idRegistry));
        idRegistry.addAgent(admin); // admin may registerIdentity

        // 4. compliance (no modules => canTransfer always true)
        compliance = new ModularCompliance();
        compliance.init();

        // 5. token
        rwaToken = new Token();
        rwaToken.init(address(idRegistry), address(compliance), tokenName, tokenSymbol, 18, address(0));
        rwaToken.addAgent(admin); // admin may mint
        rwaToken.unpause(); // token deploys paused
    }

    // --- getters ----------------------------------------------------------
    function token() public view returns (IToken) {
        return IToken(address(rwaToken));
    }

    function identityRegistry() public view returns (IdentityRegistry) {
        return idRegistry;
    }

    // --- verification -----------------------------------------------------

    /// @notice Deploy an OnchainID for `investor`, attach a valid KYC claim from
    ///         the trusted issuer, and register it so `isVerified` becomes true.
    function verifyInvestor(address investor) internal returns (Identity identity) {
        identity = _deployIdentityWithKycClaim(investor);
        idRegistry.registerIdentity(investor, IIdentity(address(identity)), DEFAULT_COUNTRY);
    }

    /// @notice Register a venue/custodian (e.g. a pool) as a verified holder so
    ///         the RWA token can move to/from it (spec §8 custody-as-holder).
    function registerVenueIdentity(address venue) internal returns (Identity identity) {
        identity = _deployIdentityWithKycClaim(venue);
        idRegistry.registerIdentity(venue, IIdentity(address(identity)), DEFAULT_COUNTRY);
    }

    /// @notice Mint RWA tokens to a verified holder (admin is token agent).
    function mint(address to, uint256 amount) internal {
        rwaToken.mint(to, amount);
    }

    // --- internals --------------------------------------------------------

    /// @dev Deploys a usable OnchainID (management key = `trexAdmin`) and adds a
    ///      KYC claim signed by the trusted issuer. The claim is added by the
    ///      current caller, which IS `trexAdmin` (the management key) in both the
    ///      test and broadcast-script paths — see ADMIN MODEL on the contract.
    function _deployIdentityWithKycClaim(address subject) private returns (Identity identity) {
        identity = new Identity(trexAdmin, false);

        bytes memory claimData = abi.encodePacked("KYC:", subject);

        // signature payload exactly as ClaimIssuer.isClaimValid reconstructs it
        bytes32 dataHash = keccak256(abi.encode(address(identity), CLAIM_TOPIC_KYC, claimData));
        bytes32 prefixed = keccak256(abi.encodePacked("\x19Ethereum Signed Message:\n32", dataHash));
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(issuerKey, prefixed);
        bytes memory sig = abi.encodePacked(r, s, v);

        identity.addClaim(CLAIM_TOPIC_KYC, CLAIM_SCHEME_ECDSA, address(claimIssuer), sig, claimData, "");
    }
}
