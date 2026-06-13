// SPDX-License-Identifier: GPL-3.0
pragma solidity 0.8.17;

import {Test} from "forge-std/Test.sol";

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

/// @title TREXSuite
/// @notice Deployable, REAL ERC-3643 (T-REX) + OnchainID test harness.
///
/// Stands up a fully-wired permissioned-token stack so that
/// `identityRegistry.isVerified(investor)` is genuinely enforced and
/// `token.transfer` honours on-chain compliance — no mocking of the token,
/// registry, or claim-verification path.
///
/// Design: this is an `abstract contract is Test`. A test contract inherits it
/// (`contract Foo is TREXSuite`) and calls `deployTREX()` from `setUp()`. We
/// inherit forge-std `Test` because forging a valid OnchainID claim requires
/// `vm.sign` (the claim signature is an `eth_sign`-prefixed ECDSA signature by
/// the trusted ClaimIssuer's key) and `vm.prank` (claims are added by the
/// investor's own management key).
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
abstract contract TREXSuite is Test {
    // --- claim topic & issuer key ----------------------------------------
    uint256 internal constant CLAIM_TOPIC_KYC = uint256(keccak256("CORNER_STORE.KYC"));
    uint256 internal constant CLAIM_SCHEME_ECDSA = 1;
    uint16 internal constant DEFAULT_COUNTRY = 840; // ISO-3166 US

    // deterministic issuer signing key (foundry test key)
    uint256 internal issuerKey = uint256(keccak256("CORNER_STORE.TRUSTED_ISSUER_KEY"));
    address internal issuerAddr;

    // --- deployed T-REX stack --------------------------------------------
    ClaimTopicsRegistry internal claimTopics;
    TrustedIssuersRegistry internal trustedIssuers;
    IdentityRegistryStorage internal identityStorage;
    IdentityRegistry internal idRegistry;
    ModularCompliance internal compliance;
    Token internal rwaToken;
    ClaimIssuer internal claimIssuer;

    /// @notice Stand up and wire the full ERC-3643 stack. Call from `setUp()`.
    function deployTREX() internal {
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
        idRegistry.addAgent(address(this)); // fixture may registerIdentity

        // 4. compliance (no modules => canTransfer always true)
        compliance = new ModularCompliance();
        compliance.init();

        // 5. token
        rwaToken = new Token();
        rwaToken.init(address(idRegistry), address(compliance), "Corner Store RWA", "csRWA", 18, address(0));
        rwaToken.addAgent(address(this)); // fixture may mint
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

    /// @notice Mint RWA tokens to a verified holder (fixture is token agent).
    function mint(address to, uint256 amount) internal {
        rwaToken.mint(to, amount);
    }

    // --- internals --------------------------------------------------------

    /// @dev Deploys a usable OnchainID (management key = `subject`) and adds a
    ///      KYC claim signed by the trusted issuer. The claim is added by the
    ///      subject's own management key (via prank) to satisfy `onlyClaimKey`.
    function _deployIdentityWithKycClaim(address subject) private returns (Identity identity) {
        identity = new Identity(subject, false);

        bytes memory claimData = abi.encodePacked("KYC:", subject);

        // signature payload exactly as ClaimIssuer.isClaimValid reconstructs it
        bytes32 dataHash = keccak256(abi.encode(address(identity), CLAIM_TOPIC_KYC, claimData));
        bytes32 prefixed = keccak256(abi.encodePacked("\x19Ethereum Signed Message:\n32", dataHash));
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(issuerKey, prefixed);
        bytes memory sig = abi.encodePacked(r, s, v);

        vm.prank(subject); // subject is the management key on its own identity
        identity.addClaim(CLAIM_TOPIC_KYC, CLAIM_SCHEME_ECDSA, address(claimIssuer), sig, claimData, "");
    }
}
