// SPDX-License-Identifier: GPL-3.0
pragma solidity 0.8.17;

import {Test} from "forge-std/Test.sol";

import {TREXCore} from "./TREXCore.sol";

/// @title TREXSuite
/// @notice Test-fixture facade over the shared {TREXCore} ERC-3643 (T-REX) +
///         OnchainID deployment core.
///
/// @dev The deployment logic now lives in {TREXCore} (an
/// `abstract is CommonBase`) so it can be reused verbatim by the live deploy
/// script ({DeployStack}). This facade only re-adds `forge-std/Test` (assertions,
/// `expectEmit`, `prank`, …) for the test suite; a test contract inherits it
/// (`contract Foo is TREXSuite`) and calls `deployTREX()` from `setUp()`, exactly
/// as before. `Test` and `TREXCore` share the `CommonBase` ancestor (single `vm`),
/// so the diamond resolves cleanly.
abstract contract TREXSuite is Test, TREXCore {}
