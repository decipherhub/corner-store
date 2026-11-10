// SPDX-License-Identifier: GPL-3.0
pragma solidity 0.8.17;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import {IntegrationBase} from "./IntegrationBase.sol";
import {ExecutionRequest} from "../../src/types/ExecutionTypes.sol";
import {VenueType} from "../../src/types/ComplianceTypes.sol";
import {VenueConfig, CustodyModel} from "../../src/types/VenueTypes.sol";
import {Errors} from "../../src/libraries/Errors.sol";
import {ExecutionRouterV2} from "../../src/execution/ExecutionRouterV2.sol";
import {ContextEvidence} from "../../src/execution/ContextEvidence.sol";
import {Affiliate} from "../../src/compliance/elements/Affiliate.sol";
import {VenueContextEvidence} from "../../src/types/VenueTypes.sol";
import {FlowType} from "../../src/types/ComplianceTypes.sol";

interface ICanonicalUniswapV3Factory {
    function createPool(address tokenA, address tokenB, uint24 fee) external returns (address pool);
}

interface ICanonicalUniswapV3Pool {
    function initialize(uint160 sqrtPriceX96) external;

    function mint(address recipient, int24 tickLower, int24 tickUpper, uint128 amount, bytes calldata data)
        external
        returns (uint256 amount0, uint256 amount1);

    function swap(
        address recipient,
        bool zeroForOne,
        int256 amountSpecified,
        uint160 sqrtPriceLimitX96,
        bytes calldata data
    ) external returns (int256 amount0, int256 amount1);

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
    address internal swapCallbackPool;

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
        req.context.amountOut = _quoteExactInput(address(rwaToken), address(quote), rwaIsToken0, amountIn);

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

        (, bytes32 reason) = accredited.check(
            req.context.buyer,
            req.context.seller,
            req.context.tokenOut,
            req.context.amountOut,
            abi.encode(req.context),
            ""
        );
        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(Errors.ComplianceRejected.selector, reason));
        router.execute(req);

        assertEq(quote.balanceOf(realPool), poolQuoteBefore, "rejected trade cannot pay pool");
        assertEq(rwaToken.balanceOf(realPool), poolRwaBefore, "rejected trade cannot receive RWA");
    }

    function test_unregisteredCallbackCannotPullBuyerFunds() public {
        vm.expectRevert(bytes("callback: unauthorized"));
        adapter.uniswapV3SwapCallback(int256(1 ether), 0, abi.encode(alice, address(quote)));
    }

    function _enableRouterV2() private returns (ExecutionRouterV2 v2) {
        v2 = new ExecutionRouterV2(engine, venueReg, selector, operatorReg);
        engine.setRouter(address(v2));
        adapter.setRouter(address(v2));
        Affiliate affiliate = new Affiliate();
        affiliate.setTrustedClaimIssuer(address(this), true);
        affiliate.setClaim(
            realPool,
            address(rwaToken),
            Affiliate.AffiliateBasis.NOT_AFFILIATE,
            Affiliate.DeterminationSource.ISSUER_REGISTRY,
            address(this),
            uint64(block.timestamp),
            0
        );
        affiliate.setClaim(
            alice,
            address(rwaToken),
            Affiliate.AffiliateBasis.NOT_AFFILIATE,
            Affiliate.DeterminationSource.ISSUER_REGISTRY,
            address(this),
            uint64(block.timestamp),
            0
        );
        VenueConfig memory cfg = venueReg.venueOf(realPool);
        venueReg.setContextImplementation(address(adapter).codehash, 2, 1, true);
        venueReg.setVenueContextEvidence(
            realPool,
            VenueContextEvidence(
                2,
                1,
                address(adapter).codehash,
                address(affiliate),
                address(affiliate).codehash,
                address(policyReg),
                address(policyReg).codehash,
                ContextEvidence.configurationHash(cfg)
            )
        );
    }

    function test_routerV2CanonicalBuy() public {
        setupBuyer(alice);
        fundBuyerQuote(alice, 1000 ether);
        ExecutionRequest memory req = _realPoolBuyRequest(alice, 100 ether);
        ExecutionRouterV2 v2 = _enableRouterV2();
        vm.prank(alice);
        v2.execute(req);
        assertEq(quote.balanceOf(alice), 900 ether);
        assertEq(rwaToken.balanceOf(alice), req.context.amountOut);
        assertEq(rwaToken.balanceOf(address(adapter)), 0);
    }

    function test_routerV2CanonicalSell() public {
        setupBuyer(alice);
        mint(alice, 500 ether);
        vm.prank(alice);
        rwaToken.approve(address(adapter), type(uint256).max);
        ExecutionRequest memory req = buildBuyRequest(alice, 100 ether, 0);
        req.context.seller = realPool;
        req.context.venue = realPool;
        req.context.tokenIn = address(rwaToken);
        req.context.tokenOut = address(quote);
        req.context.amountOut = _quoteExactInput(address(rwaToken), address(quote), !quoteIsToken0, 100 ether);
        req.venueData = abi.encode(!quoteIsToken0, _priceLimit(!quoteIsToken0));
        ExecutionRouterV2 v2 = _enableRouterV2();
        vm.prank(alice);
        v2.execute(req);
        assertEq(rwaToken.balanceOf(alice), 400 ether);
        assertEq(quote.balanceOf(alice), req.context.amountOut);
    }

    function test_routerV2CanonicalContextMismatchBeforeEvaluation() public {
        setupBuyer(alice);
        fundBuyerQuote(alice, 1000 ether);
        ExecutionRequest memory original = _realPoolBuyRequest(alice, 100 ether);
        ExecutionRouterV2 v2 = _enableRouterV2();
        vm.mockCallRevert(address(engine), abi.encodeWithSelector(engine.evaluate.selector), "evaluation reached");
        uint256 poolQuote = quote.balanceOf(realPool);
        uint256 poolRwa = rwaToken.balanceOf(realPool);
        for (uint256 i; i < 3; i++) {
            ExecutionRequest memory req = abi.decode(abi.encode(original), (ExecutionRequest));
            if (i == 0) req.context.seller = alice;
            if (i == 1) req.context.flowType = FlowType.PRIMARY_DISTRIBUTION;
            if (i == 2) req.venueData = abi.encode(!quoteIsToken0, _priceLimit(!quoteIsToken0));
            vm.prank(alice);
            vm.expectRevert(i == 2 ? Errors.AMMPoolTokenMismatch.selector : Errors.InvalidExecutionContext.selector);
            v2.execute(req);
            assertFalse(v2.usedNonce(alice, req.nonce));
            assertEq(quote.balanceOf(realPool), poolQuote);
            assertEq(rwaToken.balanceOf(realPool), poolRwa);
        }
    }

    function test_routerV2CanonicalPoolConfigurationDrift() public {
        setupBuyer(alice);
        fundBuyerQuote(alice, 1000 ether);
        ExecutionRequest memory req = _realPoolBuyRequest(alice, 100 ether);
        ExecutionRouterV2 v2 = _enableRouterV2();
        adapter.setPool(realPool, false);
        vm.prank(alice);
        vm.expectRevert(Errors.InvalidContextEvidence.selector);
        v2.execute(req);
        assertFalse(v2.usedNonce(alice, req.nonce));
    }

    function uniswapV3MintCallback(uint256 amount0Owed, uint256 amount1Owed, bytes calldata) external {
        require(msg.sender == mintCallbackPool, "mint callback: unauthorized");
        ICanonicalUniswapV3Pool pool_ = ICanonicalUniswapV3Pool(msg.sender);
        if (amount0Owed != 0) IERC20(pool_.token0()).transfer(msg.sender, amount0Owed);
        if (amount1Owed != 0) IERC20(pool_.token1()).transfer(msg.sender, amount1Owed);
    }

    function uniswapV3SwapCallback(int256 amount0Delta, int256 amount1Delta, bytes calldata data) external {
        require(msg.sender == swapCallbackPool, "swap callback: unauthorized");
        address tokenIn = abi.decode(data, (address));
        uint256 amountOwed = amount0Delta > 0 ? uint256(amount0Delta) : uint256(amount1Delta);
        IERC20(tokenIn).transfer(msg.sender, amountOwed);
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
        acqSource.setAcquiredAt(realPool, address(rwaToken), uint64(1));
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
        uint256 amountOut = _quoteExactInput(address(quote), address(rwaToken), quoteIsToken0, amountIn);
        req = buildBuyRequest(buyer, amountIn, amountOut);
        req.context.seller = realPool;
        req.context.venue = realPool;
        req.venueData = abi.encode(quoteIsToken0, _priceLimit(quoteIsToken0));
    }

    function _quoteExactInput(address tokenIn, address tokenOut, bool zeroForOne, uint256 amountIn)
        private
        returns (uint256 amountOut)
    {
        uint256 snapshotId = vm.snapshotState();
        uint256 balanceBefore = IERC20(tokenOut).balanceOf(address(this));
        swapCallbackPool = realPool;
        ICanonicalUniswapV3Pool(realPool)
            .swap(address(this), zeroForOne, int256(amountIn), _priceLimit(zeroForOne), abi.encode(tokenIn));
        amountOut = IERC20(tokenOut).balanceOf(address(this)) - balanceBefore;
        assertTrue(vm.revertToState(snapshotId), "quote simulation must restore pool state");
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
