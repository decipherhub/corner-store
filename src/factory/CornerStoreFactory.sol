// SPDX-License-Identifier: GPL-3.0
pragma solidity 0.8.17;

import {Governed} from "../auth/Governed.sol";
import {ITokenPolicyRegistry} from "../interfaces/compliance/ITokenPolicyRegistry.sol";
import {IVenueRegistry} from "../interfaces/execution/IVenueRegistry.sol";
import {ManifestCore} from "../types/ComplianceTypes.sol";
import {VenueConfig} from "../types/VenueTypes.sol";

/// @title CornerStoreFactory
/// @notice Skeleton orchestration entry point for onboarding an RWA token:
/// declares its compliance manifest in the TokenPolicyRegistry and registers
/// its execution venue in the VenueRegistry in one governed call.
///
/// @dev The two registries are injected at construction. For `registerRWAToken`
/// to succeed this factory must be the `owner()` of BOTH registries (their
/// `registerManifest` / `registerVenue` are `onlyOwner`). Governance wires this
/// by transferring registry ownership to the factory during deployment.
contract CornerStoreFactory is Governed {
    ITokenPolicyRegistry public immutable tokenPolicyRegistry;
    IVenueRegistry public immutable venueRegistry;

    event RWATokenRegistered(address indexed token, address indexed venue);

    constructor(ITokenPolicyRegistry _tokenPolicyRegistry, IVenueRegistry _venueRegistry) {
        tokenPolicyRegistry = _tokenPolicyRegistry;
        venueRegistry = _venueRegistry;
    }

    /// @notice Register an RWA token's compliance manifest and execution venue in
    ///         one governed onboarding call. The manifest ends ACTIVE.
    /// @dev Governed: only owner/operator may onboard tokens.
    ///
    ///      Onboarding deliberately runs the manifest lifecycle's propose→approve
    ///      steps back-to-back: `registerManifest` lands the manifest in PROPOSED,
    ///      then `approveManifest` moves it to ACTIVE. The factory is BOTH the
    ///      owner (register is `onlyOwner`) and the approving operator (approve is
    ///      `onlyOperator`) of the registry in this flow — governance transfers
    ///      registry ownership to the factory during deployment (see contract
    ///      natspec). Collapsing propose+approve into a single trusted call is the
    ///      intended onboarding shape; the two-step lifecycle exists to gate
    ///      externally-declared manifests, not this atomic governed path.
    ///
    ///      CONSEQUENCE of `msg.sender` semantics: because `registerManifest`
    ///      records `declaredBy = msg.sender`, the manifest's `declaredBy` is this
    ///      factory's address (not the EOA/governance account that called the
    ///      factory), and `approvedBy` is likewise the factory. Attribution stops
    ///      at the factory boundary for tokens onboarded this way.
    function registerRWAToken(
        address token,
        ManifestCore calldata manifest,
        address venue,
        VenueConfig calldata venueCfg
    ) external onlyOperator {
        tokenPolicyRegistry.registerManifest(token, manifest);
        tokenPolicyRegistry.approveManifest(token);
        venueRegistry.registerVenue(venue, venueCfg);
        emit RWATokenRegistered(token, venue);
    }

    /// @notice Deterministic pool-address derivation STUB.
    /// @dev This is NOT the real Uniswap V3 pool address: it does not use the
    /// canonical factory init-code-hash or the v3 pool salt layout. It is a
    /// placeholder CREATE2-style derivation (keccak over sorted tokens + fee)
    /// so callers/tests have a stable, deterministic address. Replace with the
    /// real `PoolAddress.computeAddress` derivation when the venue factory is
    /// wired to a live Uniswap deployment.
    function computePoolAddress(address tokenA, address tokenB, uint24 fee) external pure returns (address) {
        (address token0, address token1) = tokenA < tokenB ? (tokenA, tokenB) : (tokenB, tokenA);
        bytes32 salt = keccak256(abi.encodePacked(token0, token1, fee));
        return address(uint160(uint256(keccak256(abi.encodePacked(bytes1(0xff), salt)))));
    }
}
