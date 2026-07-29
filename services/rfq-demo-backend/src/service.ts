import {
  InMemoryNonceStore,
  NoopInventoryRiskCheck,
  PricingProvider,
  RFQBackendSDK,
  RFQPriceRequest,
  createRFQService
} from "../../rfq/src";
import {JsonRpcProvider} from "ethers";

import {DemoBackendConfig, asAddress} from "./config";
import {EthersTypedDataSigner} from "./signer";

export async function createDemoQuoteService(
  config: DemoBackendConfig,
  pricing: DemoMarketPricing = createDemoPricing(config)
): Promise<RFQBackendSDK> {
  const maker = asAddress(await config.makerWallet.getAddress(), "maker wallet");
  const artifactMaker = asAddress(config.artifact.maker, "artifact maker");
  asAddress(config.artifact.quote, "artifact quote");
  asAddress(config.artifact.rwaToken, "artifact rwaToken");
  asAddress(config.artifact.rfqVenue, "artifact rfqVenue");
  if (maker.toLowerCase() !== artifactMaker.toLowerCase()) {
    throw new Error(`maker wallet ${maker} does not match deployment artifact maker ${artifactMaker}`);
  }
  const provider = new JsonRpcProvider(config.rpcUrl, config.chainId);
  const now = config.now ?? (async () => {
    const block = await provider.getBlock("latest");
    if (!block) throw new Error("cannot read latest block timestamp from RFQ chain RPC");
    return block.timestamp;
  });

  return createRFQService({
    chainId: config.chainId,
    verifyingContract: asAddress(config.artifact.rfqAdapter, "artifact rfqAdapter"),
    maker,
    signer: new EthersTypedDataSigner(config.makerWallet),
    pricing,
    nonceStore: new InMemoryNonceStore(),
    riskCheck: new NoopInventoryRiskCheck(),
    defaultTtlSeconds: config.defaultTtlSeconds,
    now
  });
}

export interface DemoMarketPriceState {
  provider: "trade-impact-mock";
  numerator: string;
  denominator: string;
  impactBpsPerFill: number;
  lastMove: "initial" | "buy-up" | "sell-down";
}

export interface DemoSuggestedTradeAmounts {
  buyAmountIn: string;
  sellAmountIn: string;
  bufferBps: number;
}

export interface DemoMarketPoint {
  timestamp: number;
  numerator: string;
  denominator: string;
}

export interface DemoMarketFillPoint extends DemoMarketPoint {
  side: "buy" | "sell";
  amountRwa: string;
  amountQuote: string;
  transactionHash: string;
}

export interface DemoMarketHistory {
  source: "scenario-fixture+router-fills";
  assetSymbol: string;
  quoteSymbol: string;
  spreadBps: number;
  oracle: DemoMarketPoint[];
  indicative: DemoMarketPoint[];
  fills: DemoMarketFillPoint[];
  current: DemoMarketPriceState;
}

export class DemoMarketPricing implements PricingProvider {
  private readonly quote: string;
  private readonly asset: string;
  private readonly quoteScale: bigint;
  private readonly assetScale: bigint;
  private readonly initialNumerator: bigint;
  private readonly initialDenominator: bigint;
  private numerator: bigint;
  private denominator: bigint;
  private lastMove: DemoMarketPriceState["lastMove"] = "initial";
  private oracleHistory: DemoMarketPoint[] = [];
  private indicativeHistory: DemoMarketPoint[] = [];
  private fills: DemoMarketFillPoint[] = [];

  constructor(private readonly config: DemoBackendConfig) {
    this.quote = asAddress(config.artifact.quote, "artifact quote");
    this.asset = asAddress(config.artifact.rwaToken, "artifact rwaToken");
    this.quoteScale = 10n ** BigInt(config.scenario.quoteAsset.decimals);
    this.assetScale = 10n ** BigInt(config.scenario.asset.decimals);
    this.initialNumerator = BigInt(config.priceNumerator);
    this.initialDenominator = BigInt(config.priceDenominator);
    this.numerator = this.initialNumerator;
    this.denominator = this.initialDenominator;
  }

  price(request: RFQPriceRequest): {amountOut: string} {
    const side = request.tokenIn.toLowerCase() === this.quote.toLowerCase() &&
      request.tokenOut.toLowerCase() === this.asset.toLowerCase()
      ? "buy"
      : request.tokenIn.toLowerCase() === this.asset.toLowerCase() &&
          request.tokenOut.toLowerCase() === this.quote.toLowerCase()
        ? "sell"
        : undefined;
    if (!side) throw new Error("demo pricing pair does not match the deployment artifact");
    return {amountOut: this.amountOut(BigInt(request.amountIn), side).toString()};
  }

  amountOut(amountIn: bigint, side: "buy" | "sell"): bigint {
    const amountOut = side === "buy"
      ? amountIn * this.denominator * this.assetScale / (this.numerator * this.quoteScale)
      : amountIn * this.numerator * this.quoteScale / (this.denominator * this.assetScale);
    if (amountOut <= 0n) throw new Error("pricing provider returned zero amountOut");
    return amountOut;
  }

  suggestedTradeAmounts(): DemoSuggestedTradeAmounts {
    const execution = this.config.scenario.execution;
    const minimum = BigInt(this.config.scenario.asset.minimumAmountBaseUnits);
    const bufferBps = BigInt(execution.minimumTradeBufferBps);
    const bufferedMinimum = divideRoundingUp(minimum * (10_000n + bufferBps), 10_000n);
    const requiredBuy = divideRoundingUp(
      bufferedMinimum * this.numerator * this.quoteScale,
      this.denominator * this.assetScale
    );
    return {
      buyAmountIn: maximum(requiredBuy, BigInt(execution.defaultBuyAmountBaseUnits)).toString(),
      sellAmountIn: maximum(bufferedMinimum, BigInt(execution.defaultSellAmountBaseUnits)).toString(),
      bufferBps: execution.minimumTradeBufferBps
    };
  }

  recordFill(
    side: "buy" | "sell",
    details?: {timestamp: number; amountRwa: string; amountQuote: string; transactionHash: string}
  ): void {
    if (details) {
      const amountRwa = BigInt(details.amountRwa);
      const amountQuote = BigInt(details.amountQuote);
      const [fillNumerator, fillDenominator] = normalizeRatio(
        amountQuote * this.assetScale,
        amountRwa * this.quoteScale
      );
      this.fills.push({
        timestamp: details.timestamp,
        numerator: fillNumerator.toString(),
        denominator: fillDenominator.toString(),
        side,
        amountRwa: details.amountRwa,
        amountQuote: details.amountQuote,
        transactionHash: details.transactionHash
      });
    }
    const bps = BigInt(this.config.scenario.execution.pricing.impactBpsPerFill);
    this.numerator *= side === "buy" ? 10_000n + bps : 10_000n - bps;
    this.denominator *= 10_000n;
    [this.numerator, this.denominator] = normalizeRatio(this.numerator, this.denominator);
    this.lastMove = side === "buy" ? "buy-up" : "sell-down";
    if (details) {
      this.indicativeHistory.push({
        timestamp: details.timestamp,
        numerator: this.numerator.toString(),
        denominator: this.denominator.toString()
      });
    }
  }

  reset(timestamp = 0): void {
    this.numerator = this.initialNumerator;
    this.denominator = this.initialDenominator;
    this.lastMove = "initial";
    this.fills = [];
    const history = this.config.scenario.marketHistory;
    const start = timestamp - (history.oraclePrices.length - 1) * history.intervalSeconds;
    this.oracleHistory = interpolatePriceSeries(
      history.oraclePrices,
      start,
      history.intervalSeconds,
      history.sampleIntervalSeconds
    );
    this.indicativeHistory = interpolatePriceSeries(
      history.indicativeMidPrices,
      start,
      history.intervalSeconds,
      history.sampleIntervalSeconds
    );
  }

  state(): DemoMarketPriceState {
    return {
      provider: "trade-impact-mock",
      numerator: this.numerator.toString(),
      denominator: this.denominator.toString(),
      impactBpsPerFill: this.config.scenario.execution.pricing.impactBpsPerFill,
      lastMove: this.lastMove
    };
  }

  history(timestamp: number): DemoMarketHistory {
    if (this.oracleHistory.length === 0) this.reset(timestamp);
    return {
      source: "scenario-fixture+router-fills",
      assetSymbol: this.config.scenario.asset.symbol,
      quoteSymbol: this.config.scenario.quoteAsset.symbol,
      spreadBps: this.config.scenario.marketHistory.indicativeSpreadBps,
      oracle: [...this.oracleHistory],
      indicative: [...this.indicativeHistory],
      fills: [...this.fills],
      current: this.state()
    };
  }
}

export function createDemoPricing(config: DemoBackendConfig): DemoMarketPricing {
  return new DemoMarketPricing(config);
}

function greatestCommonDivisor(left: bigint, right: bigint): bigint {
  let a = left;
  let b = right;
  while (b !== 0n) [a, b] = [b, a % b];
  return a;
}

function divideRoundingUp(numerator: bigint, denominator: bigint): bigint {
  return (numerator + denominator - 1n) / denominator;
}

function maximum(left: bigint, right: bigint): bigint {
  return left > right ? left : right;
}

function normalizeRatio(numerator: bigint, denominator: bigint): [bigint, bigint] {
  const divisor = greatestCommonDivisor(numerator, denominator);
  return [numerator / divisor, denominator / divisor];
}

function pointFromDecimal(timestamp: number, value: string): DemoMarketPoint {
  const [whole, fraction = ""] = value.split(".");
  const denominator = 10n ** BigInt(fraction.length);
  const numerator = BigInt(whole) * denominator + BigInt(fraction || "0");
  const [normalizedNumerator, normalizedDenominator] = normalizeRatio(numerator, denominator);
  return {
    timestamp,
    numerator: normalizedNumerator.toString(),
    denominator: normalizedDenominator.toString()
  };
}

function interpolatePriceSeries(
  anchors: string[],
  startTimestamp: number,
  anchorIntervalSeconds: number,
  sampleIntervalSeconds: number
): DemoMarketPoint[] {
  const samplesPerAnchor = anchorIntervalSeconds / sampleIntervalSeconds;
  const points: DemoMarketPoint[] = [];
  for (let anchorIndex = 0; anchorIndex < anchors.length - 1; anchorIndex++) {
    const from = Number(anchors[anchorIndex]);
    const to = Number(anchors[anchorIndex + 1]);
    for (let sample = 0; sample < samplesPerAnchor; sample++) {
      const progress = sample / samplesPerAnchor;
      const value = (from + (to - from) * progress).toFixed(8);
      points.push(pointFromDecimal(
        startTimestamp + (anchorIndex * samplesPerAnchor + sample) * sampleIntervalSeconds,
        value
      ));
    }
  }
  points.push(pointFromDecimal(
    startTimestamp + (anchors.length - 1) * anchorIntervalSeconds,
    anchors.at(-1) as string
  ));
  return points;
}
