import {
  AbiCoder,
  Contract,
  JsonRpcProvider,
  Wallet,
  formatUnits
} from "ethers";

import {
  InMemoryNonceStore,
  InventoryRiskCheck,
  PricingProvider,
  RFQBackendSDK,
  RFQPriceRequest,
  SignedRFQQuote,
  createRFQService
} from "../../rfq/src";
import {TestnetDemoConfig} from "./config";
import {BlockTiming, explainBlockedTrade, reasonName} from "./explain";

export const ROUTER_ABI = [
  "function execute((tuple(address initiator,address buyer,address seller,address tokenIn,address tokenOut,uint256 amountIn,uint256 amountOut,uint8 venueType,address venue,uint8 flowType,bool sellerIsAffiliate) context,uint256 amountOutMin,uint64 deadline,uint256 nonce,bytes venueData) req) returns (tuple(uint256 amountOut,bytes32 executionId))"
];
export const ERC20_ABI = [
  "function name() view returns (string)",
  "function symbol() view returns (string)",
  "function decimals() view returns (uint8)",
  "function balanceOf(address account) view returns (uint256)",
  "function allowance(address owner,address spender) view returns (uint256)",
  "function approve(address spender,uint256 amount) returns (bool)"
];
const ENGINE_ABI = [
  "function evaluate(tuple(address initiator,address buyer,address seller,address tokenIn,address tokenOut,uint256 amountIn,uint256 amountOut,uint8 venueType,address venue,uint8 flowType,bool sellerIsAffiliate) ctx) view returns (tuple(bool allowed,bytes32 policyId,uint64 policyVersion,uint64 validUntil,uint256 maxAmount,address maxAmountToken,uint256 allowedVenueTypes,bytes32 allowedVenuesHash,bytes32 reasonCode,bytes32 reliedClaims,uint256 flagsBitmap,bytes32 decisionHash))",
  "function policyHashesOf(address token) view returns (bytes32 logicalPolicyHash,bytes32 executionBindingHash,bytes32 policyId)"
];
const RFQ_ADAPTER_ABI = [
  "function approvedMaker(address maker) view returns (bool)"
];
const POLICY_ABI = ["function statusOf(address token) view returns (uint8)"];
const QP_ABI = [
  "function check(address user,address counterparty,address asset,uint256 amount,bytes context,bytes parameters) view returns (bool passed,bytes32 reasonCode)",
  "function claimOf(address user) view returns (uint8 basis,bool signatureValid,bool issuerTrusted,uint64 verifiedAt,uint8 ltStatus,bytes32 coveredCompany)",
  "function freshnessCap() view returns (uint64)"
];
const ACQUISITION_SOURCE_ABI = [
  "function acquisitionOf(address holder,address asset) view returns (uint64 clockStart,uint64 observedAt,uint64 expiresAt,bytes32 sourceRef,uint8 status)"
];
const LOCKUP_ABI = ["function lockupSeconds() view returns (uint64)"];
const QUOTE_TUPLE =
  "tuple(address maker,address taker,address tokenIn,address tokenOut,uint256 amountIn,uint256 amountOut,address venue,bytes32 policyId,uint256 nonce,uint64 expiry)";

export type TradeSide = "buy" | "sell";

export interface TokenMetadata {
  address: string;
  name: string;
  symbol: string;
  decimals: number;
}

export class TestnetRfqRuntime {
  readonly provider: JsonRpcProvider;
  readonly maker: Wallet;
  readonly rwa: TokenMetadata;
  readonly quote: TokenMetadata;
  readonly quoteService: RFQBackendSDK;

  private constructor(
    readonly config: TestnetDemoConfig,
    provider: JsonRpcProvider,
    maker: Wallet,
    rwa: TokenMetadata,
    quote: TokenMetadata
  ) {
    this.provider = provider;
    this.maker = maker;
    this.rwa = rwa;
    this.quote = quote;
    const pricing = new ArtifactBoundPricing(config, rwa.decimals, quote.decimals);
    this.quoteService = createRFQService({
      chainId: config.artifact.chainId,
      verifyingContract: config.artifact.rfqAdapter as `0x${string}`,
      maker: config.artifact.maker as `0x${string}`,
      signer: {
        signTypedData: async (typedData) =>
          maker.signTypedData(typedData.domain, typedData.types, typedData.message) as Promise<`0x${string}`>
      },
      pricing,
      riskCheck: new MakerInventoryRisk(config, provider),
      nonceStore: new InMemoryNonceStore(),
      defaultTtlSeconds: config.quoteTtlSeconds,
      now: async () => {
        const block = await provider.getBlock("latest");
        if (!block) throw new Error("latest block is unavailable");
        return block.timestamp;
      }
    });
  }

  static async create(config: TestnetDemoConfig): Promise<TestnetRfqRuntime> {
    const provider = new JsonRpcProvider(config.rpcUrl, config.artifact.chainId);
    const network = await provider.getNetwork();
    if (Number(network.chainId) !== config.artifact.chainId) {
      throw new Error(`RPC chain ${network.chainId} does not match artifact chain ${config.artifact.chainId}`);
    }
    for (const [label, address] of Object.entries({
      router: config.artifact.router,
      engine: config.artifact.engine,
      rfqAdapter: config.artifact.rfqAdapter,
      rwaToken: config.artifact.rwaToken,
      quote: config.artifact.quote
    })) {
      if ((await provider.getCode(address)) === "0x") throw new Error(`${label} has no runtime code`);
    }
    const maker = config.makerWallet.connect(provider);
    const [rwa, quote] = await Promise.all([
      tokenMetadata(provider, config.artifact.rwaToken),
      tokenMetadata(provider, config.artifact.quote)
    ]);
    return new TestnetRfqRuntime(config, provider, maker, rwa, quote);
  }

  async publicState() {
    const artifact = this.config.artifact;
    const adapter = new Contract(artifact.rfqAdapter, RFQ_ADAPTER_ABI, this.provider);
    const policy = new Contract(artifact.policyReg, POLICY_ABI, this.provider);
    const rwa = new Contract(artifact.rwaToken, ERC20_ABI, this.provider);
    const quote = new Contract(artifact.quote, ERC20_ABI, this.provider);
    const [makerApproved, policyStatus, makerRwa, makerQuote, makerRwaAllowance, makerQuoteAllowance, block] =
      await Promise.all([
      adapter.approvedMaker(artifact.maker),
      policy.statusOf(artifact.rwaToken),
      rwa.balanceOf(artifact.maker),
      quote.balanceOf(artifact.maker),
      rwa.allowance(artifact.maker, artifact.rfqAdapter),
      quote.allowance(artifact.maker, artifact.rfqAdapter),
      this.provider.getBlock("latest")
    ]);
    return {
      deployment: {
        deploymentId: artifact.deploymentId,
        sourceCommit: artifact.sourceCommit,
        chainId: artifact.chainId,
        createdAt: artifact.createdAt,
        transactionCount: artifact.transactionCount ?? null,
        explorerUrl: this.config.explorerUrl ?? null
      },
      walletNetwork: artifact.chainId === 10143
        ? {
            name: "Monad Testnet",
            chainId: 10143,
            rpcUrl: "https://testnet-rpc.monad.xyz",
            nativeCurrency: "MON",
            explorerUrl: "https://testnet.monadexplorer.com"
          }
        : null,
      contracts: {
        router: artifact.router,
        engine: artifact.engine,
        rfqAdapter: artifact.rfqAdapter,
        makerAuthorizer: artifact.makerAuthorizer,
        qualifiedPurchaser: artifact.qualifiedPurchaser,
        acquisitionSource: artifact.acquisitionSource,
        lockup: artifact.lockup,
        rwaToken: artifact.rwaToken,
        quoteToken: artifact.quote
      },
      participants: {
        maker: artifact.maker,
        eligibleInvestorA: artifact.investor,
        eligibleInvestorB: artifact.eligibleInvestorB,
        ineligibleInvestor: artifact.ineligibleInvestor,
        ...(artifact.expiredInvestor && artifact.expiredInvestor !== "0x0000000000000000000000000000000000000000"
          ? {expiredInvestor: artifact.expiredInvestor}
          : {})
      },
      scenarios: [
        {
          id: "success",
          title: "Successful restricted-stock trade",
          wallet: artifact.investor,
          instruction: "Connect eligible investor A, choose Buy RWA, enter at least 5,000,000 and complete settlement."
        },
        {
          id: "qualification-required",
          title: "Qualification required",
          wallet: artifact.ineligibleInvestor,
          instruction: "Connect the ineligible investor, choose Buy RWA, enter 5,000,000 and run the pre-check."
        },
        {
          id: "holding-period",
          title: "Holding period not elapsed",
          wallet: artifact.eligibleInvestorB,
          enabled: artifact.eligibleInvestorBScenario === "holding-period-pending",
          instruction: artifact.eligibleInvestorBScenario === "holding-period-pending"
            ? "Connect eligible investor B, choose Sell RWA, enter 5,000,000 and run the pre-check to see the unlock time."
            : "This deployment was not seeded with the optional holding-period scene."
        },
        {
          id: "claim-expiry",
          title: "Qualification evidence expired",
          wallet: artifact.expiredInvestor ?? "0x0000000000000000000000000000000000000000",
          enabled: Boolean(
            artifact.expiredInvestor
              && artifact.expiredInvestor !== "0x0000000000000000000000000000000000000000"
          ),
          instruction: artifact.expiredInvestor
            && artifact.expiredInvestor !== "0x0000000000000000000000000000000000000000"
            ? "Connect the expired-claim investor, choose Buy RWA, enter 5,000,000 and run the pre-check."
            : "This deployment was not seeded with the optional expired-claim wallet."
        }
      ],
      tokens: {rwa: this.rwa, quote: this.quote},
      readiness: {
        makerApproved: Boolean(makerApproved),
        manifestActive: Number(policyStatus) === 2,
        makerRwa: String(makerRwa),
        makerQuote: String(makerQuote),
        makerRwaAllowance: String(makerRwaAllowance),
        makerQuoteAllowance: String(makerQuoteAllowance),
        chainTimestamp: block?.timestamp ?? null
      },
      pricing: {
        kind: "operator-configured-reference-rate",
        numerator: this.config.priceNumerator.toString(),
        denominator: this.config.priceDenominator.toString(),
        display: `${this.config.priceNumerator}/${this.config.priceDenominator} ${this.quote.symbol} per ${this.rwa.symbol}`
      }
    };
  }

  async walletState(taker: string) {
    const a = this.config.artifact;
    const rwa = new Contract(a.rwaToken, ERC20_ABI, this.provider);
    const quote = new Contract(a.quote, ERC20_ABI, this.provider);
    const qp = new Contract(a.qualifiedPurchaser, QP_ABI, this.provider);
    const [rwaBalance, quoteBalance, rwaAllowance, quoteAllowance, qpResult] = await Promise.all([
      rwa.balanceOf(taker),
      quote.balanceOf(taker),
      rwa.allowance(taker, a.rfqAdapter),
      quote.allowance(taker, a.rfqAdapter),
      qp.check(taker, "0x0000000000000000000000000000000000000000", a.rwaToken, 0, "0x", "0x")
    ]);
    return {
      address: taker,
      balances: {
        rwa: String(rwaBalance),
        quote: String(quoteBalance),
        rwaDisplay: formatUnits(rwaBalance, this.rwa.decimals),
        quoteDisplay: formatUnits(quoteBalance, this.quote.decimals)
      },
      allowances: {rwa: String(rwaAllowance), quote: String(quoteAllowance)},
      qualifiedPurchaser: {allowed: Boolean(qpResult[0]), reasonCode: String(qpResult[1])}
    };
  }

  async precheck(taker: string, amountIn: string, side: TradeSide) {
    const amountOut = this.amountOut(amountIn, side);
    const context = executionContext(this.config, taker, amountIn, amountOut, side);
    const engine = new Contract(this.config.artifact.engine, ENGINE_ABI, this.provider);
    const adapter = new Contract(this.config.artifact.rfqAdapter, RFQ_ADAPTER_ABI, this.provider);
    const outputToken = new Contract(
      side === "buy" ? this.config.artifact.rwaToken : this.config.artifact.quote,
      ERC20_ABI,
      this.provider
    );
    const [decision, makerApproved, makerBalance, makerAllowance] = await Promise.all([
      engine.evaluate(context),
      adapter.approvedMaker(this.config.artifact.maker),
      outputToken.balanceOf(this.config.artifact.maker),
      outputToken.allowance(this.config.artifact.maker, this.config.artifact.rfqAdapter)
    ]);
    const checks = [
      {name: "latest compliance policy", pass: Boolean(decision.allowed), reasonCode: String(decision.reasonCode)},
      {name: "maker approval", pass: Boolean(makerApproved)},
      {name: "maker inventory", pass: BigInt(makerBalance) >= BigInt(amountOut)},
      {name: "maker allowance", pass: BigInt(makerAllowance) >= BigInt(amountOut)}
    ];
    const allowed = checks.every((check) => check.pass);
    const reasonCode = String(decision.reasonCode);
    return {
      allowed,
      reasonCode,
      policyValidUntil: Number(decision.validUntil),
      explanation: allowed
        ? null
        : explainBlockedTrade(
          reasonCode,
          checks,
          await this.timingEvidence(reasonName(reasonCode), taker, side)
        ),
      checks,
      amountIn,
      amountOut,
      side,
      context
    };
  }

  private async timingEvidence(
    name: string | undefined,
    taker: string,
    side: TradeSide
  ): Promise<Partial<BlockTiming> | undefined> {
    try {
      if (name === "HOLDING_PERIOD_NOT_ELAPSED") {
        const holder = side === "buy" ? this.config.artifact.maker : taker;
        const source = new Contract(this.config.artifact.acquisitionSource, ACQUISITION_SOURCE_ABI, this.provider);
        const lockup = new Contract(this.config.artifact.lockup, LOCKUP_ABI, this.provider);
        const [snapshot, lockupSeconds] = await Promise.all([
          source.acquisitionOf(holder, this.config.artifact.rwaToken),
          lockup.lockupSeconds()
        ]);
        const clockStart = Number(snapshot.clockStart);
        if (clockStart > 0) {
          return {
            kind: "automatic",
            availableAt: clockStart + Number(lockupSeconds),
            note: "This holding-period block clears automatically at the displayed chain time."
          };
        }
      }

      if (name === "FAIL_QP_CLAIM_EXPIRED") {
        const qp = new Contract(this.config.artifact.qualifiedPurchaser, QP_ABI, this.provider);
        const [claim, freshnessCap] = await Promise.all([qp.claimOf(taker), qp.freshnessCap()]);
        const verifiedAt = Number(claim.verifiedAt);
        if (verifiedAt > 0) {
          return {
            kind: "operator-action",
            evidenceExpiredAt: verifiedAt + Number(freshnessCap),
            note: "The displayed claim expiry is historical; a new operator attestation is required."
          };
        }
      }
    } catch {
      // Explanation reads are optional observability. They never replace or
      // weaken the Engine's authoritative allow/reject result.
    }
    return undefined;
  }

  async quoteFor(taker: string, amountIn: string, side: TradeSide, ttlSeconds?: number): Promise<SignedRFQQuote> {
    const engine = new Contract(this.config.artifact.engine, ENGINE_ABI, this.provider);
    const hashes = await engine.policyHashesOf(this.config.artifact.rwaToken);
    return this.quoteService.quote({
      taker: taker as `0x${string}`,
      tokenIn: (side === "buy" ? this.quote.address : this.rwa.address) as `0x${string}`,
      tokenOut: (side === "buy" ? this.rwa.address : this.quote.address) as `0x${string}`,
      amountIn,
      venue: this.config.artifact.rfqVenue as `0x${string}`,
      policyId: String(hashes.policyId ?? hashes[2]) as `0x${string}`,
      ttlSeconds
    });
  }

  amountOut(amountIn: string, side: TradeSide): string {
    return new ArtifactBoundPricing(
      this.config,
      this.rwa.decimals,
      this.quote.decimals
    ).calculate(BigInt(amountIn), side).toString();
  }
}

export function buildRouterRequest(
  config: TestnetDemoConfig,
  signed: SignedRFQQuote,
  routerNonce: bigint,
  deadline: bigint
) {
  const q = signed.quote;
  const side: TradeSide = q.tokenIn.toLowerCase() === config.artifact.quote.toLowerCase() ? "buy" : "sell";
  const venueData = AbiCoder.defaultAbiCoder().encode(
    [QUOTE_TUPLE, "bytes"],
    [[q.maker, q.taker, q.tokenIn, q.tokenOut, q.amountIn, q.amountOut, q.venue, q.policyId, q.nonce, q.expiry], signed.signature]
  );
  return [
    executionContext(config, q.taker, q.amountIn, q.amountOut, side),
    q.amountOut,
    deadline.toString(),
    routerNonce.toString(),
    venueData
  ];
}

function executionContext(
  config: TestnetDemoConfig,
  taker: string,
  amountIn: string,
  amountOut: string,
  side: TradeSide
) {
  return [
    taker,
    taker,
    config.artifact.maker,
    side === "buy" ? config.artifact.quote : config.artifact.rwaToken,
    side === "buy" ? config.artifact.rwaToken : config.artifact.quote,
    amountIn,
    amountOut,
    2,
    config.artifact.rfqVenue,
    0,
    false
  ];
}

class ArtifactBoundPricing implements PricingProvider {
  constructor(
    private readonly config: TestnetDemoConfig,
    private readonly rwaDecimals: number,
    private readonly quoteDecimals: number
  ) {}

  price(request: RFQPriceRequest) {
    const side = request.tokenIn.toLowerCase() === this.config.artifact.quote.toLowerCase() ? "buy" : "sell";
    return {amountOut: this.calculate(BigInt(request.amountIn), side).toString()};
  }

  calculate(amountIn: bigint, side: TradeSide): bigint {
    const rwaScale = 10n ** BigInt(this.rwaDecimals);
    const quoteScale = 10n ** BigInt(this.quoteDecimals);
    const out = side === "buy"
      ? amountIn * this.config.priceDenominator * rwaScale /
        (this.config.priceNumerator * quoteScale)
      : amountIn * this.config.priceNumerator * quoteScale /
        (this.config.priceDenominator * rwaScale);
    if (out <= 0n) throw new Error("configured reference rate returns zero output");
    return out;
  }
}

class MakerInventoryRisk implements InventoryRiskCheck {
  constructor(private readonly config: TestnetDemoConfig, private readonly provider: JsonRpcProvider) {}

  async check(request: RFQPriceRequest, price: {amountOut: string}) {
    const token = new Contract(request.tokenOut, ERC20_ABI, this.provider);
    const [balance, allowance] = await Promise.all([
      token.balanceOf(this.config.artifact.maker),
      token.allowance(this.config.artifact.maker, this.config.artifact.rfqAdapter)
    ]);
    if (BigInt(balance) < BigInt(price.amountOut)) throw new Error("maker inventory is insufficient");
    if (BigInt(allowance) < BigInt(price.amountOut)) throw new Error("maker allowance is insufficient");
  }
}

async function tokenMetadata(provider: JsonRpcProvider, address: string): Promise<TokenMetadata> {
  const token = new Contract(address, ERC20_ABI, provider);
  const [name, symbol, decimals] = await Promise.all([token.name(), token.symbol(), token.decimals()]);
  return {address, name: String(name), symbol: String(symbol), decimals: Number(decimals)};
}
