// SPDX-License-Identifier: GPL-3.0
pragma solidity 0.8.17;

import {IntegrationBase} from "./IntegrationBase.sol";
import {ExecutionRequest} from "../../src/types/ExecutionTypes.sol";
import {ManifestCore, PolicyStatus} from "../../src/types/ComplianceTypes.sol";
import {Events} from "../../src/libraries/Events.sol";
import {ReasonCodes} from "../../src/libraries/ReasonCodes.sol";

/// @notice Surveillance (F-02-v1) is flag-not-block: `check` always passes, so
///         the swap SUCCEEDS, and the router's post-trade `engine.commit` drives
///         the stateful `onTransfer`, emitting Events.SurveillanceFlag once the
///         transfer count exceeds the threshold. We prove the flag fires through
///         the FULL router path (not the engine unit).
contract SurveillanceTest is IntegrationBase {
    function setUp() public {
        deployStack(); // base wiring; we override the issuance recipe below

        // Build a recipe that requires accredited (A-03-v1) + surveillance
        // (F-02-v1, STATEFUL). Register it as recipe id 7 and re-point the RWA
        // manifest's issuance recipe at it so commit runs onTransfer.
        bytes32[] memory els = new bytes32[](2);
        els[0] = bytes32("A-03-v1");
        els[1] = bytes32("F-02-v1");
        SurveilRecipe r = new SurveilRecipe(els);
        recipeReg.registerRecipe(7, 1, address(r));

        ManifestCore memory m = _activeManifest(0, 0);
        m.issuanceRecipeId = 7;
        policyReg.registerManifest(address(rwaToken), m);
    }

    function test_swapSucceeds_andEmitsSurveillanceFlag() public {
        setupBuyer(alice);
        fundPoolRWA(1_000 ether);
        fundBuyerQuote(alice, 1_000 ether);

        surveillance.setThreshold(0); // first onTransfer (count 1 > 0) fires the flag

        ExecutionRequest memory req = buildBuyRequest(alice, 100 ether, 100 ether);

        // commit runs onTransfer(seller=pool, buyer=alice, rwaAmount). The flag's
        // `from` is the seller (the pool). reasonCode encodes (recipe 0, F-02-v1, 1).
        vm.expectEmit(true, true, false, true);
        emit Events.SurveillanceFlag(
            bytes32("F-02-v1"), address(pool), ReasonCodes.encode(0, bytes32("F-02-v1"), uint32(1))
        );

        vm.prank(alice);
        router.execute(req);

        // swap actually settled (flag never blocks) and the counter advanced.
        assertEq(rwaToken.balanceOf(alice), 100 ether, "swap settled despite flag");
        assertEq(surveillance.transferCount(), 1, "onTransfer ran via router commit");
    }
}

/// @dev Test-only always-applicable recipe with a configurable required-element
///      list (mirrors the engine unit-test helper). Lets us route the manifest
///      through a recipe that includes the stateful surveillance element.
contract SurveilRecipe {
    bytes32[] internal _elements;

    constructor(bytes32[] memory elements) {
        _elements = elements;
    }

    function recipeId() external pure returns (uint16) {
        return 7;
    }

    function version() external pure returns (uint16) {
        return 1;
    }

    function isApplicable(bytes calldata) external pure returns (bool) {
        return true;
    }

    function requiredElements() external view returns (bytes32[] memory) {
        return _elements;
    }
}
