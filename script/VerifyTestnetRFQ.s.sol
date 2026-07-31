// SPDX-License-Identifier: GPL-3.0
pragma solidity 0.8.17;

import {Script} from "forge-std/Script.sol";
import {console2} from "forge-std/console2.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import {Governed} from "../src/auth/Governed.sol";
import {TokenPolicyRegistry} from "../src/registry/TokenPolicyRegistry.sol";
import {OperatorRegistry} from "../src/registry/OperatorRegistry.sol";
import {MakerAuthorizer} from "../src/registry/MakerAuthorizer.sol";
import {VenueRegistry} from "../src/execution/VenueRegistry.sol";
import {RFQAdapter} from "../src/execution/adapters/rfq/RFQAdapter.sol";
import {PolicyStatus} from "../src/types/ComplianceTypes.sol";

/// @title VerifyTestnetRFQ
/// @notice Read-only validation for a deployed public-testnet RFQ fixture.
contract VerifyTestnetRFQ is Script {
    string internal constant DEFAULT_ARTIFACT = "deployments/public/testnet-rfq.json";

    struct Addresses {
        address rwaToken;
        address quoteToken;
        address governance;
        address operator;
        address elementRegistry;
        address recipeRegistry;
        address policyRegistry;
        address operatorRegistry;
        address engine;
        address venueRegistry;
        address router;
        address makerAuthorizer;
        address rfqAdapter;
        address rfqVenue;
        address maker;
        address investor;
        address eligibleInvestorB;
        address ineligibleInvestor;
        address identityRegistry;
        address identityRegistryStorage;
        address trustedIssuersRegistry;
        address claimTopicsRegistry;
        address claimIssuer;
        address makerIdentity;
        address investorIdentity;
        address eligibleInvestorBIdentity;
        address ineligibleInvestorIdentity;
    }

    function run() external view {
        string memory artifactPath = vm.envOr("CORNER_STORE_ARTIFACT", string(DEFAULT_ARTIFACT));
        string memory json = vm.readFile(artifactPath);
        uint256 expectedChainId = vm.parseJsonUint(json, ".chainId");
        Addresses memory a = _loadAddresses(json);
        bool requireApprovals = vm.envOr("CORNER_STORE_REQUIRE_APPROVALS", false);

        require(block.chainid == expectedChainId, "artifact chain id mismatch");
        _verifyContractsAndRoles(a);
        _verifyActivationAndInventory(a);

        if (requireApprovals) {
            require(IERC20(a.rwaToken).allowance(a.maker, a.rfqAdapter) > 0, "maker RWA allowance missing");
            require(IERC20(a.quoteToken).allowance(a.maker, a.rfqAdapter) > 0, "maker quote allowance missing");
            require(IERC20(a.rwaToken).allowance(a.investor, a.rfqAdapter) > 0, "investor RWA allowance missing");
            require(IERC20(a.quoteToken).allowance(a.investor, a.rfqAdapter) > 0, "investor quote allowance missing");
            require(
                IERC20(a.rwaToken).allowance(a.eligibleInvestorB, a.rfqAdapter) > 0, "investor B RWA allowance missing"
            );
            require(
                IERC20(a.quoteToken).allowance(a.eligibleInvestorB, a.rfqAdapter) > 0,
                "investor B quote allowance missing"
            );
            require(
                IERC20(a.rwaToken).allowance(a.ineligibleInvestor, a.rfqAdapter) > 0,
                "ineligible investor RWA allowance missing"
            );
            require(
                IERC20(a.quoteToken).allowance(a.ineligibleInvestor, a.rfqAdapter) > 0,
                "ineligible investor quote allowance missing"
            );
        }

        console2.log("Corner Store testnet RFQ deployment verified");
        console2.log("chain id    :", block.chainid);
        console2.log("RWA token   :", a.rwaToken);
        console2.log("quote token :", a.quoteToken);
        console2.log("router      :", a.router);
        console2.log("RFQ adapter :", a.rfqAdapter);
        console2.log("approvals   :", requireApprovals ? "required and present" : "not required by this check");
    }

    function _loadAddresses(string memory json) private view returns (Addresses memory a) {
        a.rwaToken = vm.parseJsonAddress(json, ".rwaToken");
        a.quoteToken = vm.parseJsonAddress(json, ".quote");
        a.governance = vm.parseJsonAddress(json, ".governance");
        a.operator = vm.parseJsonAddress(json, ".operator");
        a.elementRegistry = vm.parseJsonAddress(json, ".elementReg");
        a.recipeRegistry = vm.parseJsonAddress(json, ".recipeReg");
        a.policyRegistry = vm.parseJsonAddress(json, ".policyReg");
        a.operatorRegistry = vm.parseJsonAddress(json, ".operatorReg");
        a.engine = vm.parseJsonAddress(json, ".engine");
        a.venueRegistry = vm.parseJsonAddress(json, ".venueReg");
        a.router = vm.parseJsonAddress(json, ".router");
        a.makerAuthorizer = vm.parseJsonAddress(json, ".makerAuthorizer");
        a.rfqAdapter = vm.parseJsonAddress(json, ".rfqAdapter");
        a.rfqVenue = vm.parseJsonAddress(json, ".rfqVenue");
        a.maker = vm.parseJsonAddress(json, ".maker");
        a.investor = vm.parseJsonAddress(json, ".investor");
        a.eligibleInvestorB = vm.parseJsonAddress(json, ".eligibleInvestorB");
        a.ineligibleInvestor = vm.parseJsonAddress(json, ".ineligibleInvestor");
        a.identityRegistry = vm.parseJsonAddress(json, ".identityRegistry");
        a.identityRegistryStorage = vm.parseJsonAddress(json, ".identityRegistryStorage");
        a.trustedIssuersRegistry = vm.parseJsonAddress(json, ".trustedIssuersRegistry");
        a.claimTopicsRegistry = vm.parseJsonAddress(json, ".claimTopicsRegistry");
        a.claimIssuer = vm.parseJsonAddress(json, ".claimIssuer");
        a.makerIdentity = vm.parseJsonAddress(json, ".makerIdentity");
        a.investorIdentity = vm.parseJsonAddress(json, ".investorIdentity");
        a.eligibleInvestorBIdentity = vm.parseJsonAddress(json, ".eligibleInvestorBIdentity");
        a.ineligibleInvestorIdentity = vm.parseJsonAddress(json, ".ineligibleInvestorIdentity");
    }

    function _verifyContractsAndRoles(Addresses memory a) private view {
        _requireCode(a.rwaToken, "RWA token");
        _requireCode(a.quoteToken, "quote token");
        _requireCode(a.elementRegistry, "element registry");
        _requireCode(a.recipeRegistry, "recipe registry");
        _requireCode(a.policyRegistry, "policy registry");
        _requireCode(a.operatorRegistry, "operator registry");
        _requireCode(a.engine, "compliance engine");
        _requireCode(a.venueRegistry, "venue registry");
        _requireCode(a.router, "router");
        _requireCode(a.makerAuthorizer, "maker authorizer");
        _requireCode(a.rfqAdapter, "RFQ adapter");
        _requireCode(a.identityRegistry, "identity registry");
        _requireCode(a.identityRegistryStorage, "identity registry storage");
        _requireCode(a.trustedIssuersRegistry, "trusted issuers registry");
        _requireCode(a.claimTopicsRegistry, "claim topics registry");
        _requireCode(a.claimIssuer, "claim issuer");
        _requireCode(a.makerIdentity, "maker identity");
        _requireCode(a.investorIdentity, "investor identity");
        _requireCode(a.eligibleInvestorBIdentity, "investor B identity");
        _requireCode(a.ineligibleInvestorIdentity, "ineligible investor identity");

        _requireOwner(a.elementRegistry, a.governance, "element registry");
        _requireOwner(a.recipeRegistry, a.governance, "recipe registry");
        _requireOwner(a.policyRegistry, a.governance, "policy registry");
        _requireOwner(a.operatorRegistry, a.governance, "operator registry");
        _requireOwner(a.engine, a.governance, "compliance engine");
        _requireOwner(a.venueRegistry, a.governance, "venue registry");
        _requireOwner(a.router, a.governance, "router");
        _requireOwner(a.makerAuthorizer, a.governance, "maker authorizer");
        _requireOwner(a.rfqAdapter, a.governance, "RFQ adapter");
        require(TokenPolicyRegistry(a.policyRegistry).isOperator(a.operator), "policy operator is not authorized");
        require(OperatorRegistry(a.operatorRegistry).isOperator(a.operator), "execution operator is not authorized");
        require(MakerAuthorizer(a.makerAuthorizer).isOperator(a.operator), "maker operator is not authorized");
        require(RFQAdapter(a.rfqAdapter).isOperator(a.operator), "RFQ operator is not authorized");
    }

    function _verifyActivationAndInventory(Addresses memory a) private view {
        require(
            TokenPolicyRegistry(a.policyRegistry).statusOf(a.rwaToken) == PolicyStatus.ACTIVE,
            "RWA manifest is not active"
        );
        require(VenueRegistry(a.venueRegistry).venueOf(a.rfqVenue).active, "RFQ venue is not active");
        require(RFQAdapter(a.rfqAdapter).approvedMaker(a.maker), "maker is not approved");
        require(IERC20(a.rwaToken).balanceOf(a.maker) > 0, "maker has no RWA inventory");
        require(IERC20(a.quoteToken).balanceOf(a.maker) > 0, "maker has no quote inventory");
        require(IERC20(a.rwaToken).balanceOf(a.investor) > 0, "investor has no RWA inventory");
        require(IERC20(a.quoteToken).balanceOf(a.investor) > 0, "investor has no quote inventory");
        require(IERC20(a.rwaToken).balanceOf(a.eligibleInvestorB) > 0, "investor B has no RWA inventory");
        require(IERC20(a.quoteToken).balanceOf(a.eligibleInvestorB) > 0, "investor B has no quote inventory");
        require(IERC20(a.rwaToken).balanceOf(a.ineligibleInvestor) > 0, "ineligible investor has no RWA inventory");
        require(IERC20(a.quoteToken).balanceOf(a.ineligibleInvestor) > 0, "ineligible investor has no quote inventory");
    }

    function _requireCode(address target, string memory label) private view {
        require(target != address(0) && target.code.length > 0, string.concat(label, " has no code"));
    }

    function _requireOwner(address target, address expected, string memory label) private view {
        require(Governed(target).owner() == expected, string.concat(label, " owner mismatch"));
    }
}
