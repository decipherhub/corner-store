// SPDX-License-Identifier: GPL-3.0
pragma solidity 0.8.17;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import {IntegrationBase} from "./IntegrationBase.sol";
import {ExecutionRequest} from "../../src/types/ExecutionTypes.sol";
import {VenueType} from "../../src/types/ComplianceTypes.sol";
import {VenueConfig, CustodyModel} from "../../src/types/VenueTypes.sol";
import {Errors} from "../../src/libraries/Errors.sol";
import {ReasonCodes} from "../../src/libraries/ReasonCodes.sol";

interface ICanonicalUniswapV3Factory {
    function createPool(address tokenA, address tokenB, uint24 fee) external returns (address pool);
}

interface ICanonicalUniswapV3Pool {
    function initialize(uint160 sqrtPriceX96) external;

    function mint(address recipient, int24 tickLower, int24 tickUpper, uint128 amount, bytes calldata data)
        external
        returns (uint256 amount0, uint256 amount1);

    function token0() external view returns (address);

    function token1() external view returns (address);
}

/// @notice Canonical Uniswap v3 core integration without copying vendored source
/// into the product tree. The factory/pool creation code is loaded from the
/// pinned Uniswap v3 core package artifact under tools/deploy-v3.
contract RealUniswapV3Test is IntegrationBase {
    string internal constant FACTORY_ARTIFACT =
        "tools/deploy-v3/node_modules/@uniswap/v3-core/artifacts/contracts/UniswapV3Factory.sol/UniswapV3Factory.json";
    string internal constant POOL_ARTIFACT =
        "tools/deploy-v3/node_modules/@uniswap/v3-core/artifacts/contracts/UniswapV3Pool.sol/UniswapV3Pool.json";

    uint24 internal constant FEE = 3000;
    uint160 internal constant SQRT_PRICE_1_TO_1 = 1 << 96;
    uint160 internal constant MIN_SQRT_RATIO_PLUS_ONE = 4_295_128_740;
    uint160 internal constant MAX_SQRT_RATIO_MINUS_ONE =
        1_461_446_703_485_210_103_287_273_052_203_988_822_378_723_970_341;

    address internal realFactory;
    address internal realPool;
    bytes32 internal poolInitCodeHash;
    bool internal quoteIsToken0;
    address internal mintCallbackPool;

    function setUp() public {
        deployStack();
        _deployAndSeedCanonicalPool();
    }

    function test_factoryCreate2AddressMatchesCanonicalPreflight() public view {
        assertEq(realPool, _computePoolAddress(realFactory, address(quote), address(rwaToken), FEE));
        assertEq(ICanonicalUniswapV3Pool(realPool).token0(), quoteIsToken0 ? address(quote) : address(rwaToken));
        assertEq(ICanonicalUniswapV3Pool(realPool).token1(), quoteIsToken0 ? address(rwaToken) : address(quote));
    }

    function test_protectedBuy_usesCanonicalPoolAndLeavesAdapterNonCustodial() public {
        setupBuyer(alice);
        fundBuyerQuote(alice, 1_000 ether);

        uint256 amountIn = 100 ether;
        uint256 quoteBefore = quote.balanceOf(alice);
        uint256 rwaBefore = rwaToken.balanceOf(alice);
        ExecutionRequest memory req = _realPoolBuyRequest(alice, amountIn);

        doBuy(req);

        assertEq(quote.balanceOf(alice), quoteBefore - amountIn, "buyer paid exact quote input");
        assertGt(rwaToken.balanceOf(alice), rwaBefore, "canonical pool delivered ERC-3643 RWA");
        assertEq(quote.balanceOf(address(router)), 0, "router keeps no quote custody");
        assertEq(rwaToken.balanceOf(address(router)), 0, "router keeps no RWA custody");
        assertEq(quote.balanceOf(address(adapter)), 0, "adapter keeps no quote custody");
        assertEq(rwaToken.balanceOf(address(adapter)), 0, "adapter keeps no RWA custody");
    }

    function test_protectedSell_usesCanonicalPoolInReverseDirection() public {
        setupBuyer(alice);
        mint(alice, 500 ether);
        vm.prank(alice);
        rwaToken.approve(address(adapter), type(uint256).max);

        uint256 amountIn = 100 ether;
        uint256 rwaBefore = rwaToken.balanceOf(alice);
        uint256 quoteBefore = quote.balanceOf(alice);
        ExecutionRequest memory req = buildBuyRequest(alice, amountIn, 0);
        req.context.seller = realPool;
        req.context.tokenIn = address(rwaToken);
        req.context.tokenOut = address(quote);
        req.context.venue = realPool;
        bool rwaIsToken0 = !quoteIsToken0;
        req.venueData = abi.encode(rwaIsToken0, _priceLimit(rwaIsToken0));

        doBuy(req);

        assertEq(rwaToken.balanceOf(alice), rwaBefore - amountIn, "seller paid exact RWA input");
        assertGt(quote.balanceOf(alice), quoteBefore, "canonical pool delivered quote");
    }

    function test_complianceRejectionOccursBeforeCanonicalPoolBalancesMove() public {
        verifyInvestor(alice);
        attestInvestorExceptAccredited(alice);
        fundBuyerQuote(alice, 1_000 ether);

        uint256 poolQuoteBefore = quote.balanceOf(realPool);
        uint256 poolRwaBefore = rwaToken.balanceOf(realPool);
        ExecutionRequest memory req = _realPoolBuyRequest(alice, 100 ether);

        vm.prank(alice);
        vm.expectRevert(
            abi.encodeWithSelector(
                Errors.ComplianceRejected.selector, ReasonCodes.encode(1, bytes32("A-03-v1"), uint32(1))
            )
        );
        router.execute(req);

        assertEq(quote.balanceOf(realPool), poolQuoteBefore, "rejected trade cannot pay pool");
        assertEq(rwaToken.balanceOf(realPool), poolRwaBefore, "rejected trade cannot receive RWA");
    }

    function test_unregisteredCallbackCannotPullBuyerFunds() public {
        vm.expectRevert(bytes("callback: unauthorized"));
        adapter.uniswapV3SwapCallback(int256(1 ether), 0, abi.encode(alice, address(quote)));
    }

    function uniswapV3MintCallback(uint256 amount0Owed, uint256 amount1Owed, bytes calldata) external {
        require(msg.sender == mintCallbackPool, "mint callback: unauthorized");
        ICanonicalUniswapV3Pool pool_ = ICanonicalUniswapV3Pool(msg.sender);
        if (amount0Owed != 0) IERC20(pool_.token0()).transfer(msg.sender, amount0Owed);
        if (amount1Owed != 0) IERC20(pool_.token1()).transfer(msg.sender, amount1Owed);
    }

    function _deployAndSeedCanonicalPool() private {
        bytes memory factoryCode = _artifactBytecode(FACTORY_ARTIFACT);
        bytes memory poolCode = _artifactBytecode(POOL_ARTIFACT);
        poolInitCodeHash = keccak256(poolCode);
        realFactory = _deploy(factoryCode);

        address expected = _computePoolAddress(realFactory, address(quote), address(rwaToken), FEE);
        realPool = ICanonicalUniswapV3Factory(realFactory).createPool(address(quote), address(rwaToken), FEE);
        assertEq(realPool, expected, "factory must use canonical CREATE2 pool address");

        quoteIsToken0 = address(quote) < address(rwaToken);
        registerVenueIdentity(realPool);
        venueReg.registerVenue(
            realPool,
            VenueConfig({
                venueType: VenueType.AMM,
                adapter: address(adapter),
                target: realPool,
                operator: address(0),
                custody: CustodyModel.POOL,
                active: true
            })
        );
        adapter.setPool(realPool, true);

        ICanonicalUniswapV3Pool(realPool).initialize(SQRT_PRICE_1_TO_1);
        registerVenueIdentity(address(this));
        quote.mint(address(this), 10_000 ether);
        mint(address(this), 10_000 ether);
        mintCallbackPool = realPool;
        ICanonicalUniswapV3Pool(realPool).mint(address(this), -120, 120, 1_000_000 ether, "");
        mintCallbackPool = address(0);
    }

    function _realPoolBuyRequest(address buyer, uint256 amountIn) private returns (ExecutionRequest memory req) {
        req = buildBuyRequest(buyer, amountIn, 0);
        req.context.seller = realPool;
        req.context.venue = realPool;
        req.venueData = abi.encode(quoteIsToken0, _priceLimit(quoteIsToken0));
    }

    function _priceLimit(bool zeroForOne) private pure returns (uint160) {
        return zeroForOne ? MIN_SQRT_RATIO_PLUS_ONE : MAX_SQRT_RATIO_MINUS_ONE;
    }

    function _computePoolAddress(address factory_, address tokenA, address tokenB, uint24 fee)
        private
        view
        returns (address)
    {
        (address token0, address token1) = tokenA < tokenB ? (tokenA, tokenB) : (tokenB, tokenA);
        bytes32 salt = keccak256(abi.encode(token0, token1, fee));
        return address(uint160(uint256(keccak256(abi.encodePacked(hex"ff", factory_, salt, poolInitCodeHash)))));
    }

    function _artifactBytecode(string memory path) private view returns (bytes memory) {
        return vm.parseJsonBytes(vm.readFile(path), ".bytecode");
    }

    function _deploy(bytes memory creationCode) private returns (address deployed) {
        assembly {
            deployed := create(0, add(creationCode, 0x20), mload(creationCode))
        }
        require(deployed != address(0), "artifact deployment failed");
    }
}
