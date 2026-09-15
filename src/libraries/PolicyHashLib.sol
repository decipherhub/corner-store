// SPDX-License-Identifier: GPL-3.0
pragma solidity 0.8.17;

/// @notice Domain-separated commitments for logical policy and deployed execution identity.
library PolicyHashLib {
    bytes32 internal constant LOGICAL_POLICY_DOMAIN = keccak256("CORNER_STORE_LOGICAL_POLICY_V1");
    bytes32 internal constant EXECUTION_BINDING_DOMAIN = keccak256("CORNER_STORE_EXECUTION_BINDING_V1");
    bytes32 internal constant RECIPE_BINDING_DOMAIN = keccak256("CORNER_STORE_RECIPE_EXECUTION_V1");
    bytes32 internal constant ELEMENT_BINDING_DOMAIN = keccak256("CORNER_STORE_ELEMENT_EXECUTION_V1");
    bytes32 internal constant POLICY_ID_DOMAIN = keccak256("CORNER_STORE_POLICY_ID_V1");
    bytes32 internal constant POLICY_PAIR_DOMAIN = keccak256("CORNER_STORE_POLICY_PAIR_V1");

    function logicalPolicyHash(
        address token,
        bytes32 compiledPlanHash,
        uint8 supportedEngines,
        uint256 factsPacked,
        uint256 coverageScope,
        bytes32 fullManifestHash
    ) internal pure returns (bytes32) {
        return keccak256(
            abi.encode(
                LOGICAL_POLICY_DOMAIN,
                token,
                compiledPlanHash,
                supportedEngines,
                factsPacked,
                coverageScope,
                fullManifestHash
            )
        );
    }

    function executionRoot(
        uint256 chainId,
        address engine,
        bytes32 engineCodeHash,
        address policyRegistry,
        bytes32 policyRegistryCodeHash,
        address elementRegistry,
        bytes32 elementRegistryCodeHash,
        address recipeRegistry,
        bytes32 recipeRegistryCodeHash
    ) internal pure returns (bytes32) {
        return keccak256(
            abi.encode(
                EXECUTION_BINDING_DOMAIN,
                chainId,
                engine,
                engineCodeHash,
                policyRegistry,
                policyRegistryCodeHash,
                elementRegistry,
                elementRegistryCodeHash,
                recipeRegistry,
                recipeRegistryCodeHash
            )
        );
    }

    function bindRecipe(bytes32 acc, bytes32 recipeKey, uint16 version, address implementation, bytes32 codeHash)
        internal
        pure
        returns (bytes32)
    {
        return keccak256(abi.encode(RECIPE_BINDING_DOMAIN, acc, recipeKey, version, implementation, codeHash));
    }

    function bindElement(
        bytes32 acc,
        bytes32 elementId,
        address implementation,
        bytes32 codeHash,
        bytes32 versionHash,
        bytes32 metadataHash,
        bytes32 parameterHash
    ) internal pure returns (bytes32) {
        return keccak256(
            abi.encode(
                ELEMENT_BINDING_DOMAIN,
                acc,
                elementId,
                implementation,
                codeHash,
                versionHash,
                metadataHash,
                parameterHash
            )
        );
    }

    function policyId(bytes32 logicalPolicyHash_, bytes32 executionBindingHash) internal pure returns (bytes32) {
        return keccak256(abi.encode(POLICY_ID_DOMAIN, logicalPolicyHash_, executionBindingHash));
    }

    function accumulate(bytes32 acc, address token, bytes32 tokenPolicyId) internal pure returns (bytes32) {
        return keccak256(abi.encode(POLICY_PAIR_DOMAIN, acc, token, tokenPolicyId));
    }
}
