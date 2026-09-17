// SPDX-License-Identifier: GPL-3.0
pragma solidity 0.8.17;

import {Test} from "forge-std/Test.sol";
import {PolicyHashLib} from "../../../src/libraries/PolicyHashLib.sol";

contract PolicyHashLibTest is Test {
    function test_hashes_areDomainSeparated_andDeterministic() public pure {
        bytes32 logical = PolicyHashLib.logicalPolicyHash(address(1), bytes32(uint256(2)), 3, 4, 5, bytes32(uint256(6)));
        bytes32 execution = PolicyHashLib.executionRoot(
            31337,
            address(7),
            bytes32(uint256(8)),
            address(9),
            bytes32(uint256(10)),
            address(11),
            bytes32(uint256(12)),
            address(13),
            bytes32(uint256(14))
        );
        execution = PolicyHashLib.bindRecipe(execution, bytes32(uint256(15)), 16, address(17), bytes32(uint256(18)));
        execution = PolicyHashLib.bindElement(
            execution,
            bytes32(uint256(19)),
            address(20),
            bytes32(uint256(21)),
            bytes32(uint256(22)),
            bytes32(uint256(23)),
            bytes32(uint256(24))
        );
        bytes32 policyId = PolicyHashLib.policyId(logical, execution);
        bytes32 pair = PolicyHashLib.accumulate(bytes32(0), address(1), policyId);

        assertTrue(logical != execution);
        assertTrue(policyId != logical && policyId != execution);
        assertTrue(pair != policyId);
        assertEq(pair, 0xa1fba6114b3ccf8f0dedf70c28cd74a892ac3fb056d32d67e3d82acc8a6c446b);
    }

    function test_executionHash_changesAcrossChainAddressAndRuntimeCode() public pure {
        bytes32 baseline = PolicyHashLib.executionRoot(
            1,
            address(1),
            bytes32(uint256(2)),
            address(3),
            bytes32(uint256(4)),
            address(5),
            bytes32(uint256(6)),
            address(7),
            bytes32(uint256(8))
        );
        bytes32 otherChain = PolicyHashLib.executionRoot(
            2,
            address(1),
            bytes32(uint256(2)),
            address(3),
            bytes32(uint256(4)),
            address(5),
            bytes32(uint256(6)),
            address(7),
            bytes32(uint256(8))
        );
        bytes32 otherAddress = PolicyHashLib.executionRoot(
            1,
            address(9),
            bytes32(uint256(2)),
            address(3),
            bytes32(uint256(4)),
            address(5),
            bytes32(uint256(6)),
            address(7),
            bytes32(uint256(8))
        );
        bytes32 otherCode = PolicyHashLib.executionRoot(
            1,
            address(1),
            bytes32(uint256(99)),
            address(3),
            bytes32(uint256(4)),
            address(5),
            bytes32(uint256(6)),
            address(7),
            bytes32(uint256(8))
        );

        assertTrue(baseline != otherChain);
        assertTrue(baseline != otherAddress);
        assertTrue(baseline != otherCode);
    }
}
