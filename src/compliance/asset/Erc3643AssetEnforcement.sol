// SPDX-License-Identifier: GPL-3.0
pragma solidity 0.8.17;

import {IComplianceElement} from "../../interfaces/compliance/IComplianceElement.sol";
import {
    IAssetEnforcement,
    AssetEnforcementRequest,
    AssetEnforcementResult,
    AssetEnforcementFailure
} from "../../interfaces/asset/IAssetEnforcement.sol";
import {ComplianceContext, VenueType, FlowType} from "../../types/ComplianceTypes.sol";

interface IErc3643ElementBindingView {
    function erc3643Native(address asset) external view returns (bool);

    function wiringOf(address asset)
        external
        view
        returns (bool registered, address identityRegistry, address compliance, bytes32 implCodehash);
}

/// @notice Provider-neutral wrapper over the existing B-02-v2 ERC-3643 check.
/// @dev The wrapper deliberately preserves B-02-v2 as the issuer-machine trust
///      boundary instead of reimplementing ERC-3643 logic in the v3 element.
contract Erc3643AssetEnforcement is IAssetEnforcement {
    uint16 public constant VERSION = 1;
    bytes32 internal constant BINDING_DOMAIN = keccak256("CORNER_STORE_ERC3643_ASSET_ENFORCEMENT_V1");

    IComplianceElement public immutable legacyElement;

    constructor(address legacyElement_) {
        require(legacyElement_.code.length != 0, "legacy element missing");
        legacyElement = IComplianceElement(legacyElement_);
    }

    function enforcementVersion() external pure returns (uint16) {
        return VERSION;
    }

    function bindingDigest(address asset) public view returns (bytes32) {
        IErc3643ElementBindingView source = IErc3643ElementBindingView(address(legacyElement));
        bool native_ = source.erc3643Native(asset);
        (bool registered, address identityRegistry, address compliance, bytes32 implCodehash) = source.wiringOf(asset);
        return keccak256(
            abi.encode(
                BINDING_DOMAIN,
                address(legacyElement),
                address(legacyElement).codehash,
                asset,
                native_,
                registered,
                identityRegistry,
                compliance,
                implCodehash
            )
        );
    }

    function willAllow(AssetEnforcementRequest calldata request)
        external
        view
        returns (AssetEnforcementResult memory result)
    {
        bytes32 requestDigest = keccak256(abi.encode(request));
        bytes32 currentBinding;
        try this.bindingDigest(request.asset) returns (bytes32 digest) {
            currentBinding = digest;
        } catch {
            return AssetEnforcementResult(false, AssetEnforcementFailure.UNAVAILABLE, requestDigest, bytes32(0));
        }

        ComplianceContext memory ctx = ComplianceContext({
            initiator: request.from,
            buyer: request.to,
            seller: request.from,
            tokenIn: address(0),
            tokenOut: request.asset,
            amountIn: 0,
            amountOut: request.amount,
            venueType: VenueType.RFQ,
            venue: address(this),
            flowType: FlowType.SECONDARY_TRADE,
            sellerIsAffiliate: false
        });
        try legacyElement.check(
            request.to, request.from, request.asset, request.amount, abi.encode(ctx), bytes("")
        ) returns (
            bool allowed, bytes32
        ) {
            return AssetEnforcementResult(
                allowed,
                allowed ? AssetEnforcementFailure.NONE : AssetEnforcementFailure.TOKEN_REJECTED,
                requestDigest,
                currentBinding
            );
        } catch {
            return AssetEnforcementResult(false, AssetEnforcementFailure.UNAVAILABLE, requestDigest, currentBinding);
        }
    }
}

