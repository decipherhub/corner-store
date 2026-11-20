// SPDX-License-Identifier: GPL-3.0
pragma solidity 0.8.17;

import {Governed} from "../../auth/Governed.sol";
import {
    IAssetEnforcement,
    AssetEnforcementRequest,
    AssetEnforcementResult,
    AssetEnforcementFailure
} from "../../interfaces/asset/IAssetEnforcement.sol";

/// @notice Reference-only non-ERC-3643 adapter proving the provider-neutral
///         boundary. It is not a production issuer or transfer-agent integration.
contract ReferenceAllowlistAssetEnforcement is IAssetEnforcement, Governed {
    uint16 public constant VERSION = 1;
    bytes32 internal constant BINDING_DOMAIN = keccak256("CORNER_STORE_REFERENCE_ALLOWLIST_ENFORCEMENT_V1");

    mapping(address => mapping(address => mapping(address => bool))) public isAllowed;
    mapping(address => bytes32) private _configurationCommitment;
    mapping(address => uint64) public configurationVersion;

    event AllowlistRuleSet(
        address indexed asset, address indexed from, address indexed to, bool allowed, uint64 version
    );

    function enforcementVersion() external pure returns (uint16) {
        return VERSION;
    }

    function setAllowed(address asset, address from, address to, bool allowed) external onlyOperator {
        require(asset != address(0) && from != address(0) && to != address(0), "zero allowlist key");
        isAllowed[asset][from][to] = allowed;
        uint64 version = ++configurationVersion[asset];
        _configurationCommitment[asset] =
            keccak256(abi.encode(_configurationCommitment[asset], asset, from, to, allowed, version));
        emit AllowlistRuleSet(asset, from, to, allowed, version);
    }

    function bindingDigest(address asset) public view returns (bytes32) {
        return
            keccak256(abi.encode(BINDING_DOMAIN, asset, configurationVersion[asset], _configurationCommitment[asset]));
    }

    function willAllow(AssetEnforcementRequest calldata request)
        external
        view
        returns (AssetEnforcementResult memory result)
    {
        bool allowed = isAllowed[request.asset][request.from][request.to];
        return AssetEnforcementResult({
            allowed: allowed,
            failure: allowed ? AssetEnforcementFailure.NONE : AssetEnforcementFailure.TOKEN_REJECTED,
            requestDigest: keccak256(abi.encode(request)),
            bindingDigest: bindingDigest(request.asset)
        });
    }
}

