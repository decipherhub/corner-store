// SPDX-License-Identifier: GPL-3.0
pragma solidity 0.8.17;

import {Test} from "forge-std/Test.sol";

import {ComplianceLogger} from "../../../src/logging/ComplianceLogger.sol";
import {ExecutionLogger} from "../../../src/logging/ExecutionLogger.sol";
import {Events} from "../../../src/libraries/Events.sol";

contract LoggingTest is Test {
    ComplianceLogger internal cLogger;
    ExecutionLogger internal eLogger;

    function setUp() public {
        cLogger = new ComplianceLogger();
        eLogger = new ExecutionLogger();
    }

    function test_logEvaluation_emits() public {
        bytes32 decisionHash = keccak256("decision");
        bytes32 reason = keccak256("OK");

        vm.expectEmit(true, false, false, true, address(cLogger));
        emit Events.ComplianceEvaluated(decisionHash, true, reason);
        cLogger.logEvaluation(decisionHash, true, reason);
    }

    function test_logSurveillanceFlag_emits() public {
        bytes32 elementId = keccak256("SANCTIONS");
        address subject = address(0xBEEF);
        bytes32 reason = keccak256("OFAC_HIT");

        vm.expectEmit(true, true, false, true, address(cLogger));
        emit Events.SurveillanceFlag(elementId, subject, reason);
        cLogger.logSurveillanceFlag(elementId, subject, reason);
    }

    function test_logExecution_emits() public {
        bytes32 executionId = keccak256("exec");
        address venue = address(0x4E51E);

        vm.expectEmit(true, true, false, true, address(eLogger));
        emit Events.Executed(executionId, venue, 12345);
        eLogger.logExecution(executionId, venue, 12345);
    }
}
