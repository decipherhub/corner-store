// SPDX-License-Identifier: GPL-3.0
pragma solidity 0.8.17;

import {Test} from "forge-std/Test.sol";
import {MakerAuthorizer} from "../../../src/registry/MakerAuthorizer.sol";
import {Errors} from "../../../src/libraries/Errors.sol";
import {MockERC1271Maker} from "../../mocks/MockERC1271Maker.sol";

contract MakerAuthorizerTest is Test {
    uint256 internal constant MAKER_PK = 0xA11CE;
    uint256 internal constant DELEGATE_PK = 0xD311;
    uint256 internal constant WRONG_PK = 0xBAD;

    MakerAuthorizer internal authorizer;
    address internal maker;
    address internal delegate;
    address internal operator = address(0xBEEF);
    bytes32 internal quoteHash = keccak256("quote");

    function setUp() public {
        authorizer = new MakerAuthorizer();
        authorizer.setOperator(operator, true);
        maker = vm.addr(MAKER_PK);
        delegate = vm.addr(DELEGATE_PK);
    }

    function test_authorizerVersion_isOne() public view {
        assertEq(authorizer.authorizerVersion(), 1);
    }

    function test_isAuthorizedSigner_acceptsDirectMakerEcdsa() public view {
        assertTrue(authorizer.isAuthorizedSigner(maker, quoteHash, _sign(MAKER_PK)));
    }

    function test_isAuthorizedSigner_acceptsErc1271Maker() public {
        MockERC1271Maker smartMaker = new MockERC1271Maker(delegate);
        assertTrue(authorizer.isAuthorizedSigner(address(smartMaker), quoteHash, _sign(DELEGATE_PK)));
        assertFalse(authorizer.isAuthorizedSigner(address(smartMaker), quoteHash, _sign(WRONG_PK)));
    }

    function test_delegateAddition_requiresOwnerAndDelay() public {
        vm.prank(operator);
        vm.expectRevert("Ownable: caller is not the owner");
        authorizer.scheduleDelegate(maker, delegate, bytes32("rotation"));

        authorizer.scheduleDelegate(maker, delegate, bytes32("rotation"));
        assertFalse(authorizer.isAuthorizedSigner(maker, quoteHash, _sign(DELEGATE_PK)));

        vm.expectPartialRevert(Errors.TimelockNotReady.selector);
        authorizer.executeDelegateAuthorization(maker, delegate);

        vm.warp(block.timestamp + authorizer.AUTHORIZATION_DELAY());
        authorizer.executeDelegateAuthorization(maker, delegate);
        assertTrue(authorizer.isAuthorizedSigner(maker, quoteHash, _sign(DELEGATE_PK)));
    }

    function test_revokeDelegate_isImmediateAndCancelsOutstandingAuthority() public {
        _authorizeDelegate();
        bytes memory signedBeforeRevoke = _sign(DELEGATE_PK);

        vm.prank(operator);
        authorizer.revokeDelegate(maker, delegate, bytes32("compromised"));

        assertFalse(authorizer.isAuthorizedSigner(maker, quoteHash, signedBeforeRevoke));
    }

    function test_revokeDelegate_canCancelPendingExpansion() public {
        authorizer.scheduleDelegate(maker, delegate, bytes32("rotation"));
        vm.prank(operator);
        authorizer.revokeDelegate(maker, delegate, bytes32("cancel"));

        vm.warp(block.timestamp + authorizer.AUTHORIZATION_DELAY());
        vm.expectRevert(Errors.PendingActionNotFound.selector);
        authorizer.executeDelegateAuthorization(maker, delegate);
    }

    function test_malformedSignature_returnsFalse() public view {
        assertFalse(authorizer.isAuthorizedSigner(maker, quoteHash, hex"1234"));
    }

    function _authorizeDelegate() internal {
        authorizer.scheduleDelegate(maker, delegate, bytes32("rotation"));
        vm.warp(block.timestamp + authorizer.AUTHORIZATION_DELAY());
        authorizer.executeDelegateAuthorization(maker, delegate);
    }

    function _sign(uint256 privateKey) internal view returns (bytes memory) {
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(privateKey, quoteHash);
        return abi.encodePacked(r, s, v);
    }
}
