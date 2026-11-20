// SPDX-License-Identifier: GPL-3.0
pragma solidity 0.8.17;

/// @notice Provider-neutral request built from venue-authoritative settlement facts.
struct AssetEnforcementRequest {
    address asset;
    address from;
    address to;
    uint256 amount;
    bytes32 contextHash;
}

/// @notice Coarse failure classes safe to expose through the public policy result.
enum AssetEnforcementFailure {
    NONE,
    UNSUPPORTED,
    UNAVAILABLE,
    MALFORMED,
    CONFIGURATION_DRIFT,
    TOKEN_REJECTED
}

struct AssetEnforcementResult {
    bool allowed;
    AssetEnforcementFailure failure;
    bytes32 requestDigest;
    bytes32 bindingDigest;
}

/// @notice Asset-owned transfer restriction boundary consumed by Corner Store.
/// @dev Implementations report an answer; they do not define legal policy. Any
///      unavailable or malformed source must return or revert to a fail-closed result.
interface IAssetEnforcement {
    function enforcementVersion() external view returns (uint16);

    function bindingDigest(address asset) external view returns (bytes32);

    function willAllow(AssetEnforcementRequest calldata request)
        external
        view
        returns (AssetEnforcementResult memory result);
}
