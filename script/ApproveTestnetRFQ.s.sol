// SPDX-License-Identifier: GPL-3.0
pragma solidity 0.8.17;

import {Script} from "forge-std/Script.sol";
import {console2} from "forge-std/console2.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/// @title ApproveTestnetRFQ
/// @notice Grants the deployed RFQ adapter allowance from the externally
///         selected participant signer. Run once as each investor and maker.
contract ApproveTestnetRFQ is Script {
    string internal constant DEFAULT_ARTIFACT = "deployments/public/testnet-rfq.json";

    function run() external {
        string memory artifactPath = vm.envOr("CORNER_STORE_ARTIFACT", string(DEFAULT_ARTIFACT));
        string memory json = vm.readFile(artifactPath);
        address rwaToken = vm.parseJsonAddress(json, ".rwaToken");
        address quoteToken = vm.parseJsonAddress(json, ".quote");
        address rfqAdapter = vm.parseJsonAddress(json, ".rfqAdapter");

        require(rwaToken != address(0) && quoteToken != address(0) && rfqAdapter != address(0), "artifact invalid");

        vm.startBroadcast();
        IERC20(rwaToken).approve(rfqAdapter, type(uint256).max);
        IERC20(quoteToken).approve(rfqAdapter, type(uint256).max);
        vm.stopBroadcast();

        console2.log("RFQ allowances approved");
        console2.log("RWA token   :", rwaToken);
        console2.log("quote token :", quoteToken);
        console2.log("RFQ adapter :", rfqAdapter);
    }
}
