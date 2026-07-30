import {
  AbiCoder,
  Contract,
  HDNodeWallet,
  JsonRpcProvider,
  MaxUint256,
  ZeroAddress,
  formatEther,
  formatUnits,
  id,
  verifyTypedData
} from "ethers";
import {existsSync, readFileSync, writeFileSync} from "fs";

import {RFQBackendSDK, RFQ_QUOTE_TYPES, SignedRFQQuote} from "../../rfq/src";

import {ANVIL_MNEMONIC, DemoBackendConfig, asAddress} from "./config";
import {
  DemoMarketHistory,
  DemoMarketPriceState,
  DemoMarketPricing,
  DemoSuggestedTradeAmounts
} from "./service";

const ROUTER_ABI = [
  "function execute((tuple(address initiator,address buyer,address seller,address tokenIn,address tokenOut,uint256 amountIn,uint256 amountOut,uint8 venueType,address venue,uint8 flowType,bool sellerIsAffiliate) context,uint256 amountOutMin,uint64 deadline,uint256 nonce,bytes venueData) req) returns (tuple(uint256 amountOut,bytes32 executionId))",
  "error RFQMakerNotApproved()",
  "error ComplianceRejected(bytes32 reasonCode)"
];
const ENGINE_ABI = [
  "function evaluate(tuple(address initiator,address buyer,address seller,address tokenIn,address tokenOut,uint256 amountIn,uint256 amountOut,uint8 venueType,address venue,uint8 flowType,bool sellerIsAffiliate) ctx) view returns (tuple(bool allowed,bytes32 policyId,uint64 policyVersion,uint64 validUntil,uint256 maxAmount,address maxAmountToken,uint256 allowedVenueTypes,bytes32 allowedVenuesHash,bytes32 reasonCode,bytes32 reliedClaims,uint256 flagsBitmap,bytes32 decisionHash))"
];
const ERC20_ABI = [
  "function balanceOf(address account) view returns (uint256)",
  "function allowance(address owner,address spender) view returns (uint256)",
  "function approve(address spender,uint256 amount) returns (bool)"
];
const RFQ_ADAPTER_ABI = [
  "function setMakerApproved(address maker,bool approved)",
  "function approvedMaker(address maker) view returns (bool)",
  "function execute((tuple(address initiator,address buyer,address seller,address tokenIn,address tokenOut,uint256 amountIn,uint256 amountOut,uint8 venueType,address venue,uint8 flowType,bool sellerIsAffiliate) context,uint256 amountOutMin,uint64 deadline,uint256 nonce,bytes venueData) req,(bool allowed,bytes32 policyId,uint64 policyVersion,uint64 validUntil,uint256 maxAmount,address maxAmountToken,uint256 allowedVenueTypes,bytes32 allowedVenuesHash,bytes32 reasonCode,bytes32 reliedClaims,uint256 flagsBitmap,bytes32 decisionHash) decision) returns (tuple(uint256 amountOut,bytes32 executionId))",
  "error NotAuthorized()"
];
const QP_ABI = [
  "function qp(address user) view returns (bool)",
  "function claimOf(address user) view returns (uint8 basis,bool signatureValid,bool issuerTrusted,uint64 verifiedAt,uint8 ltStatus,bytes32 coveredCompany)",
  "function freshnessCap() view returns (uint64)",
  "function check(address user,address counterparty,address asset,uint256 amount,bytes data) view returns (bool passed,bytes32 reasonCode)",
  "function setQp(address user,bool isQp)",
  "function setQpClaim(address user,(uint8 basis,bool signatureValid,bool issuerTrusted,uint64 verifiedAt,uint8 ltStatus,bytes32 coveredCompany) claim)",
  "function setFreshnessCap(uint64 cap)"
];
const POLICY_ABI = ["function statusOf(address token) view returns (uint8)"];
const QUOTE_TUPLE =
  "tuple(address maker,address taker,address tokenIn,address tokenOut,uint256 amountIn,uint256 amountOut,address venue,uint256 nonce,uint64 expiry)";
const RFQ_MAKER_NOT_APPROVED_SELECTOR = id("RFQMakerNotApproved()").slice(0, 10).toLowerCase();
const COMPLIANCE_REJECTED_SELECTOR = id("ComplianceRejected(bytes32)").slice(0, 10).toLowerCase();
const NOT_AUTHORIZED_SELECTOR = id("NotAuthorized()").slice(0, 10).toLowerCase();
const ZERO_BYTES32 = `0x${"0".repeat(64)}`;
const QP_BASIS_NAMES: QpBasis[] = [
  "NONE", "NATURAL", "FAMILY_COMPANY", "TRUST", "INSTITUTIONAL", "QIB", "KNOWLEDGEABLE_EMPLOYEE", "OTHER"
];
const QP_BASIS_VALUES = Object.fromEntries(QP_BASIS_NAMES.map((name, value) => [name, value])) as Record<QpBasis, number>;
const LOOK_THROUGH_NAMES: LookThroughStatus[] = ["NONE", "PENDING", "COMPLETED", "FAILED"];
const LOOK_THROUGH_VALUES = Object.fromEntries(
  LOOK_THROUGH_NAMES.map((name, value) => [name, value])
) as Record<LookThroughStatus, number>;
export type DemoWalletId = string;
export type DemoTradeAction = "settle" | "revoked-maker" | "compliance-proof";
export type DemoTradeSide = "buy" | "sell";
export type QpBasis =
  "NONE" | "NATURAL" | "FAMILY_COMPANY" | "TRUST" | "INSTITUTIONAL" | "QIB" | "KNOWLEDGEABLE_EMPLOYEE" | "OTHER";
export type LookThroughStatus = "NONE" | "PENDING" | "COMPLETED" | "FAILED";

export interface QpClaimInput {
  basis: QpBasis;
  signatureValid: boolean;
  issuerTrusted: boolean;
  lookThroughStatus: LookThroughStatus;
  coveredCompanyMatchesFund: boolean;
}

export interface QpClaimState extends QpClaimInput {
  verifiedAt?: number;
}

export interface DemoWalletState {
  id: DemoWalletId;
  label: string;
  address: string;
  qualifiedPurchaser: boolean;
  claimPresent: boolean;
  rwaBalance: string;
  quoteBalance: string;
  eligibilityReason?: string;
  verifiedAt?: number;
  expiresAt?: number;
  qpClaim: QpClaimState;
}

export interface DemoPrecheckResult {
  allowed: boolean;
  wallet: DemoWalletState;
  side: DemoTradeSide;
  amountIn: string;
  amountOut: string;
  checks: Array<{key: "investor" | "maker" | "asset"; label: string; pass: boolean; reason?: string}>;
  verdict: {allowed: boolean; reasonCode: string; reason?: string};
}

export interface DemoTradeResult {
  action: DemoTradeAction;
  side: DemoTradeSide;
  quote: SignedRFQQuote;
  trace: Array<{stage: string; detail: string; status: "passed" | "rejected"}>;
  transaction?: {
    hash: string;
    blockNumber: number;
    rwaBefore: string;
    rwaAfter: string;
    rwaDelta: string;
    quoteBefore: string;
    quoteAfter: string;
    quoteDelta: string;
  };
  attemptedTransaction?: {
    hash: string;
    blockNumber: number;
    status: number;
  };
  balanceEvidence?: {
    rwaBefore: string;
    rwaAfter: string;
    quoteBefore: string;
    quoteAfter: string;
    unchanged: boolean;
  };
  rejection?: string;
  reasonCode?: string;
}

export interface AdapterBoundaryEvidence {
  caseType: "ADAPTER_BOUNDARY";
  outcome: "BLOCKED";
  wallet: {id: string; label: string; address: string};
  control: "RFQAdapter.onlyRouter";
  rejection: "NotAuthorized";
  selector: string;
  attemptedTransaction: {hash: string; blockNumber: number; status: number};
  balanceEvidence: DemoTradeResult["balanceEvidence"];
  trace: DemoTradeResult["trace"];
}

interface WalletEntry {
  id: DemoWalletId;
  label: string;
  signer: HDNodeWallet;
  initialQualifiedPurchaser: boolean;
}

/** Local-Anvil-only facilitator. Never use this pattern for a hosted service. */
export class DemoSettlementService {
  private readonly provider: JsonRpcProvider;
  private readonly operator: HDNodeWallet;
  private readonly wallets: Map<string, WalletEntry>;
  private nextRouterNonce = BigInt(Date.now());
  private actionQueue: Promise<void> = Promise.resolve();

  constructor(
    private readonly config: DemoBackendConfig,
    private readonly quotes: RFQBackendSDK,
    private readonly pricing: DemoMarketPricing
  ) {
    if (!config.demoSettlement.enabled) throw new Error("demo settlement is disabled");
    if (config.chainId !== 31337) throw new Error("demo settlement is restricted to Anvil chain id 31337");

    this.provider = new JsonRpcProvider(config.rpcUrl, config.chainId);
    this.operator = demoWallet(config.demoSettlement.operatorAccount).connect(this.provider);
    this.requireCanonical(this.operator, config.artifact.deployer, "operator");

    this.wallets = new Map(config.scenario.wallets.map((wallet) => {
      const signer = demoWallet(wallet.account).connect(this.provider);
      this.requireCanonical(signer, config.artifact[wallet.artifactKey], wallet.label);
      return [signer.address.toLowerCase(), {
        id: wallet.id,
        label: wallet.label,
        signer,
        initialQualifiedPurchaser: wallet.initialQualifiedPurchaser
      }];
    }));
  }

  async state(): Promise<{
    ready: boolean;
    assetProfile: "buidl-like" | "reg-d";
    requiresQualifiedPurchaser: boolean;
    makerApproved: boolean;
    chainTimestamp: number;
    qualifiedPurchaserFreshnessCap: number;
    chainId: number;
    maker: string;
    makerInventory: {rwaBalance: string; quoteBalance: string};
    investor: string;
    wallets: DemoWalletState[];
    marketPrice: DemoMarketPriceState;
    suggestedTradeAmounts: DemoSuggestedTradeAmounts;
    presentation: DemoBackendConfig["scenario"];
  }> {
    const makerApproved = await this.makerApproved();
    const network = await this.provider.getNetwork();
    const wallets = await Promise.all([...this.wallets.values()].map((entry) => this.walletState(entry)));
    const latest = await this.latestBlock();
    const qp = new Contract(this.requiredArtifact("qualifiedPurchaser"), QP_ABI, this.provider);
    const rwa = new Contract(this.config.artifact.rwaToken, ERC20_ABI, this.provider);
    const quote = new Contract(this.config.artifact.quote, ERC20_ABI, this.provider);
    return {
      ready: makerApproved && Number(network.chainId) === this.config.chainId,
      assetProfile: this.config.artifact.assetProfile,
      requiresQualifiedPurchaser: this.config.artifact.assetProfile === "buidl-like",
      makerApproved,
      chainTimestamp: latest.timestamp,
      qualifiedPurchaserFreshnessCap: Number(await qp.freshnessCap()),
      chainId: Number(network.chainId),
      maker: this.config.artifact.maker,
      makerInventory: {
        rwaBalance: String(await rwa.balanceOf(this.config.artifact.maker)),
        quoteBalance: String(await quote.balanceOf(this.config.artifact.maker))
      },
      investor: asAddress(this.config.artifact.investor, "artifact investor"),
      wallets,
      marketPrice: this.pricing.state(),
      suggestedTradeAmounts: this.pricing.suggestedTradeAmounts(),
      presentation: this.config.scenario
    };
  }

  async prepare(): Promise<Awaited<ReturnType<DemoSettlementService["state"]>>> {
    return this.enqueue(async () => {
      if (!await this.makerApproved()) await this.setMakerApproval(true);
      this.pricing.reset((await this.latestBlock()).timestamp);
      await this.setFreshnessCap(this.config.scenario.temporalEligibility.baselineFreshnessSeconds);
      for (const wallet of this.wallets.values()) {
        await this.setWalletEligibility(wallet, wallet.initialQualifiedPurchaser);
      }
      return this.state();
    });
  }

  async marketHistory(): Promise<DemoMarketHistory> {
    return this.pricing.history((await this.latestBlock()).timestamp);
  }

  async restoreMaker(): Promise<Awaited<ReturnType<DemoSettlementService["state"]>>> {
    return this.setMakerApproved(true);
  }

  async precheck(taker: string, amountIn: string, side: DemoTradeSide = "buy"): Promise<DemoPrecheckResult> {
    const entry = this.walletFor(taker);
    const amount = BigInt(amountIn);
    const qp = await this.qpEligibility(entry.signer.address);
    const requiresQp = this.config.artifact.assetProfile === "buidl-like";
    const investorAllowed = !requiresQp || qp.eligible;
    const maker = await this.makerApproved();
    const policy = new Contract(this.requiredArtifact("policyReg"), POLICY_ABI, this.provider);
    const assetActive = Number(await policy.statusOf(this.config.artifact.rwaToken)) === 2;
    const minimum = BigInt(this.config.scenario.asset.minimumAmountBaseUnits);
    const amountOut = this.pricing.amountOut(amount, side);
    const rwaAmount = side === "buy" ? amountOut : amount;
    const amountAllowed = !requiresQp || rwaAmount >= minimum;
    const context = this.context(entry.signer.address, amountIn, amountOut.toString(), side);
    const engine = new Contract(this.requiredArtifact("engine"), ENGINE_ABI, this.provider);
    const decision = await engine.evaluate(context);
    const assetPass = assetActive && amountAllowed;
    const investorReason = qp.reason ?? "Qualified Purchaser claim missing";
    const reason = !investorAllowed
      ? investorReason
      : !maker
        ? "Maker is not approved"
        : !assetActive
          ? "Asset manifest is not active"
          : !amountAllowed
            ? `Minimum investment is ${formatUnits(minimum, this.config.scenario.asset.decimals)}`
            : decision.allowed
              ? undefined
              : "Current ComplianceEngine policy rejected the trade";
    return {
      allowed: Boolean(investorAllowed && maker && assetPass && decision.allowed),
      wallet: await this.walletState(entry),
      side,
      amountIn,
      amountOut: amountOut.toString(),
      checks: [
        {
          key: "investor",
          label: "투자자 적격성",
          pass: investorAllowed,
          ...(!investorAllowed ? {reason: investorReason} : {})
        },
        {key: "maker", label: "Maker 승인", pass: maker, ...(!maker ? {reason: "Maker is not approved"} : {})},
        {
          key: "asset",
          label: "자산 정책",
          pass: assetPass,
          ...(!assetActive
            ? {reason: "Asset manifest is not active"}
            : !amountAllowed
              ? {reason: `Minimum investment is ${formatUnits(minimum, this.config.scenario.asset.decimals)}`}
              : {})
        }
      ],
      verdict: {allowed: Boolean(decision.allowed), reasonCode: String(decision.reasonCode), ...(reason ? {reason} : {})}
    };
  }

  async setUserEligibility(walletId: DemoWalletId, eligible: boolean): Promise<DemoWalletState> {
    return this.enqueue(async () => {
      const entry = this.walletById(walletId);
      await this.setWalletEligibility(entry, eligible);
      return this.walletState(entry);
    });
  }

  async setUserClaim(walletId: DemoWalletId, claim: QpClaimInput): Promise<DemoWalletState> {
    return this.enqueue(async () => {
      const entry = this.walletById(walletId);
      await this.setWalletClaim(entry, claim);
      return this.walletState(entry);
    });
  }

  async prepareTemporalEligibility(walletId?: DemoWalletId): Promise<Awaited<ReturnType<DemoSettlementService["state"]>>> {
    return this.enqueue(async () => {
      const temporal = this.config.scenario.temporalEligibility;
      const entry = this.walletById(walletId ?? temporal.walletId);
      await this.setFreshnessCap(temporal.freshnessSeconds);
      await this.setWalletEligibility(entry, true);
      return this.state();
    });
  }

  async advanceTime(seconds?: number): Promise<Awaited<ReturnType<DemoSettlementService["state"]>>> {
    return this.enqueue(async () => {
      const configured = this.config.scenario.temporalEligibility.advanceSeconds;
      const advance = seconds ?? configured;
      if (advance !== configured) throw new Error(`advance seconds must match the injected scenario value ${configured}`);
      await this.provider.send("evm_increaseTime", [advance]);
      await this.provider.send("evm_mine", []);
      this.appendEvent({
        blockNumber: await this.provider.getBlockNumber(),
        transactionHash: "0x0000000000000000000000000000000000000000000000000000000000000000",
        name: "DemoTimeAdvanced",
        args: {seconds: String(advance)}
      });
      return this.state();
    });
  }

  async setMakerApproved(approved: boolean): Promise<Awaited<ReturnType<DemoSettlementService["state"]>>> {
    return this.enqueue(async () => {
      await this.setMakerApproval(approved);
      return this.state();
    });
  }

  async proveAdapterBoundary(walletId?: DemoWalletId): Promise<AdapterBoundaryEvidence> {
    return this.enqueue(async () => {
      const entry = walletId ? this.walletById(walletId) : this.walletFor(this.config.artifact.investor);
      const address = entry.signer.address;
      const rwa = new Contract(this.config.artifact.rwaToken, ERC20_ABI, this.provider);
      const quote = new Contract(this.config.artifact.quote, ERC20_ABI, this.provider);
      const adapter = new Contract(this.config.artifact.rfqAdapter, RFQ_ADAPTER_ABI, entry.signer);
      const rwaBefore = await rwa.balanceOf(address) as bigint;
      const quoteBefore = await quote.balanceOf(address) as bigint;
      const latest = await this.latestBlock();
      const request = [
        this.context(
          address,
          this.config.scenario.execution.defaultBuyAmountBaseUnits,
          this.pricing.amountOut(
            BigInt(this.config.scenario.execution.defaultBuyAmountBaseUnits),
            "buy"
          ).toString(),
          "buy"
        ),
        0n,
        BigInt(latest.timestamp + 3600),
        this.nextRouterNonce++,
        "0x"
      ];
      const decision = [
        false,
        ZERO_BYTES32,
        0n,
        0n,
        0n,
        ZeroAddress,
        0n,
        ZERO_BYTES32,
        ZERO_BYTES32,
        ZERO_BYTES32,
        0n,
        ZERO_BYTES32
      ];
      try {
        await adapter.execute.staticCall(request, decision);
        throw new Error("direct RFQAdapter call unexpectedly passed its router boundary");
      } catch (error) {
        if (!isError(error, NOT_AUTHORIZED_SELECTOR, "NotAuthorized")) throw error;
      }

      const tx = await adapter.execute(request, decision, {
        gasLimit: 600_000,
        nonce: await this.pendingNonce(address)
      });
      let receipt;
      try {
        receipt = await tx.wait();
      } catch (error) {
        receipt = (error as any)?.receipt;
        if (!receipt) throw error;
      }
      const attemptedTransaction: AdapterBoundaryEvidence["attemptedTransaction"] = {
        hash: tx.hash,
        blockNumber: Number(receipt.blockNumber),
        status: Number(receipt.status)
      };
      if (!attemptedTransaction || attemptedTransaction.status !== 0) {
        throw new Error("direct RFQAdapter rejection did not produce a failed transaction receipt");
      }

      const rwaAfter = await rwa.balanceOf(address) as bigint;
      const quoteAfter = await quote.balanceOf(address) as bigint;
      const balanceEvidence = {
        rwaBefore: rwaBefore.toString(),
        rwaAfter: rwaAfter.toString(),
        quoteBefore: quoteBefore.toString(),
        quoteAfter: quoteAfter.toString(),
        unchanged: rwaBefore === rwaAfter && quoteBefore === quoteAfter
      };
      if (!balanceEvidence.unchanged) throw new Error("adapter boundary rejection changed wallet balances");
      const trace: AdapterBoundaryEvidence["trace"] = [
        {stage: "Caller", detail: `${entry.label} called RFQAdapter.execute directly`, status: "passed"},
        {stage: "Router boundary", detail: "RFQAdapter.onlyRouter rejected the caller", status: "rejected"},
        {stage: "Asset movement", detail: "RWA and quote balances remained unchanged", status: "passed"}
      ];
      this.appendEvent({
        blockNumber: attemptedTransaction.blockNumber,
        transactionHash: attemptedTransaction.hash,
        name: "AdapterBypassRejected",
        args: {caller: address, adapter: this.config.artifact.rfqAdapter, reason: "NotAuthorized"}
      });
      return {
        caseType: "ADAPTER_BOUNDARY",
        outcome: "BLOCKED",
        wallet: {id: entry.id, label: entry.label, address},
        control: "RFQAdapter.onlyRouter",
        rejection: "NotAuthorized",
        selector: NOT_AUTHORIZED_SELECTOR,
        attemptedTransaction,
        balanceEvidence,
        trace
      };
    });
  }

  async restoreEnforcementState(kind: "claim-expiry" | "maker-revocation"): Promise<Awaited<ReturnType<DemoSettlementService["state"]>>> {
    return this.enqueue(async () => {
      if (kind === "maker-revocation") await this.setMakerApproval(true);
      if (kind === "claim-expiry") {
        const temporal = this.config.scenario.temporalEligibility;
        await this.setFreshnessCap(temporal.baselineFreshnessSeconds);
        const entry = this.walletById(temporal.walletId);
        await this.setWalletEligibility(entry, entry.initialQualifiedPurchaser);
      }
      return this.state();
    });
  }

  async trade(amountIn: string, action: DemoTradeAction, provided?: SignedRFQQuote): Promise<DemoTradeResult> {
    return this.enqueue(() => this.tradeUnlocked(amountIn, action, provided));
  }

  assertDemoWallet(address: string): void {
    this.walletFor(address);
  }

  private async tradeUnlocked(amountIn: string, action: DemoTradeAction, provided?: SignedRFQQuote): Promise<DemoTradeResult> {
    const signed = provided ?? await this.quotes.quote({
      taker: asAddress(this.config.artifact.investor, "artifact investor"),
      tokenIn: asAddress(this.config.artifact.quote, "artifact quote"),
      tokenOut: asAddress(this.config.artifact.rwaToken, "artifact rwaToken"),
      amountIn,
      venue: asAddress(this.config.artifact.rfqVenue, "artifact rfqVenue")
    });
    const wallet = this.validateQuote(signed);
    const side = this.sideOf(signed.quote);
    if (BigInt(signed.quote.amountIn) !== BigInt(amountIn)) throw new Error("quote amount does not match trade amount");
    const trace: DemoTradeResult["trace"] = [
      {stage: "Selected wallet", detail: `${wallet.label} · ${wallet.signer.address}`, status: "passed"},
      {stage: "RFQ quote", detail: `maker signed nonce ${signed.quote.nonce}`, status: "passed"}
    ];

    if (action === "revoked-maker") {
      if (await this.makerApproved()) await this.setMakerApproval(false);
      trace.push({stage: "Maker policy", detail: "operator revoked maker after quote signing", status: "rejected"});
    }
    const result = await this.execute(wallet, signed, action, trace);
    if (result.transaction) {
      this.appendEvent({
        blockNumber: result.transaction.blockNumber,
        transactionHash: result.transaction.hash,
        name: "RFQSettled",
        args: {
          maker: signed.quote.maker,
          taker: signed.quote.taker,
          amountIn: signed.quote.amountIn,
          amountOut: signed.quote.amountOut,
          side
        }
      });
    } else if (result.rejection) {
      this.appendEvent({
        blockNumber: result.attemptedTransaction?.blockNumber ?? await this.provider.getBlockNumber(),
        transactionHash: result.attemptedTransaction?.hash ??
          "0x0000000000000000000000000000000000000000000000000000000000000000",
        name: "RFQRejected",
        args: {maker: signed.quote.maker, taker: signed.quote.taker, reason: result.rejection}
      });
    }
    return result;
  }

  private async execute(
    wallet: WalletEntry,
    signed: SignedRFQQuote,
    action: DemoTradeAction,
    trace: DemoTradeResult["trace"]
  ): Promise<DemoTradeResult> {
    const q = signed.quote;
    const investorAddress = wallet.signer.address;
    const side = this.sideOf(q);
    const rwa = new Contract(this.config.artifact.rwaToken, ERC20_ABI, this.provider);
    const quote = new Contract(this.config.artifact.quote, ERC20_ABI, this.provider);
    const inputToken = new Contract(q.tokenIn, ERC20_ABI, wallet.signer);
    const router = new Contract(this.config.artifact.router, ROUTER_ABI, wallet.signer);
    const rwaBefore = await rwa.balanceOf(investorAddress) as bigint;
    const quoteBefore = await quote.balanceOf(investorAddress) as bigint;
    const amountIn = BigInt(q.amountIn);
    const allowance = await inputToken.allowance(investorAddress, this.config.artifact.rfqAdapter) as bigint;
    if (allowance < amountIn) {
      const approval = await inputToken.approve(this.config.artifact.rfqAdapter, MaxUint256, {
        nonce: await this.pendingNonce(investorAddress)
      });
      await approval.wait();
      trace.push({stage: "Input allowance", detail: `${wallet.label} approved RFQAdapter`, status: "passed"});
    }

    const latest = await this.provider.getBlock("latest");
    if (!latest) throw new Error("cannot read latest block for demo settlement");
    const venueData = AbiCoder.defaultAbiCoder().encode(
      [QUOTE_TUPLE, "bytes"],
      [[q.maker, q.taker, q.tokenIn, q.tokenOut, q.amountIn, q.amountOut, q.venue, q.nonce, q.expiry], signed.signature]
    );
    const request = [
      this.context(investorAddress, q.amountIn, q.amountOut, side),
      q.amountOut,
      BigInt(latest.timestamp + 3600),
      this.nextRouterNonce++,
      venueData
    ];

    let verifiedRejection: "RFQMakerNotApproved" | "ComplianceRejected" | undefined;
    if (action !== "settle") {
      try {
        await router.execute.staticCall(request);
        throw new Error(`${action} request unexpectedly passed the final Router simulation`);
      } catch (error) {
        if (action === "revoked-maker" && isError(error, RFQ_MAKER_NOT_APPROVED_SELECTOR, "RFQMakerNotApproved")) {
          verifiedRejection = "RFQMakerNotApproved";
        } else if (action === "compliance-proof" && isError(error, COMPLIANCE_REJECTED_SELECTOR, "ComplianceRejected")) {
          verifiedRejection = "ComplianceRejected";
        } else {
          throw error;
        }
      }
      trace.push({
        stage: "Revert simulation",
        detail: `${verifiedRejection} selector verified for the exact Router request`,
        status: "rejected"
      });
    }

    let attemptedHash: string | undefined;
    try {
      const tx = await router.execute(request, {
        gasLimit: 1_500_000,
        nonce: await this.pendingNonce(investorAddress)
      });
      attemptedHash = tx.hash;
      const receipt = await tx.wait();
      const rwaAfter = await rwa.balanceOf(investorAddress) as bigint;
      const quoteAfter = await quote.balanceOf(investorAddress) as bigint;
      const rwaDelta = rwaAfter - rwaBefore;
      const quoteDelta = quoteAfter - quoteBefore;
      trace.push({stage: "ComplianceEngine", detail: "latest policy accepted at fill time", status: "passed"});
      trace.push({
        stage: "RFQ settlement",
        detail: `${side.toUpperCase()} · RWA ${formatSigned(rwaDelta)} · qUSD ${formatSigned(quoteDelta)}`,
        status: "passed"
      });
      const fillBlock = await this.provider.getBlock(receipt?.blockNumber ?? "latest");
      this.pricing.recordFill(side, {
        timestamp: fillBlock?.timestamp ?? latest.timestamp,
        amountRwa: (side === "buy" ? BigInt(q.amountOut) : BigInt(q.amountIn)).toString(),
        amountQuote: (side === "buy" ? BigInt(q.amountIn) : BigInt(q.amountOut)).toString(),
        transactionHash: tx.hash
      });
      return {
        action,
        side,
        quote: signed,
        trace,
        transaction: {
          hash: tx.hash,
          blockNumber: receipt?.blockNumber ?? 0,
          rwaBefore: rwaBefore.toString(),
          rwaAfter: rwaAfter.toString(),
          rwaDelta: rwaDelta.toString(),
          quoteBefore: quoteBefore.toString(),
          quoteAfter: quoteAfter.toString(),
          quoteDelta: quoteDelta.toString()
        }
      };
    } catch (error) {
      const detail = error instanceof Error ? (error as any).shortMessage ?? error.message : String(error);
      trace.push({stage: "Final Router check", detail, status: "rejected"});
      const receipt = (error as any)?.receipt;
      if (attemptedHash && !receipt) throw error;
      const attemptedTransaction = attemptedHash && receipt
        ? {
            hash: attemptedHash,
            blockNumber: Number(receipt.blockNumber),
            status: Number(receipt.status)
          }
        : undefined;
      const rwaAfter = await rwa.balanceOf(investorAddress) as bigint;
      const quoteAfter = await quote.balanceOf(investorAddress) as bigint;
      const balanceEvidence = {
        rwaBefore: rwaBefore.toString(),
        rwaAfter: rwaAfter.toString(),
        quoteBefore: quoteBefore.toString(),
        quoteAfter: quoteAfter.toString(),
        unchanged: rwaBefore === rwaAfter && quoteBefore === quoteAfter
      };
      if (
        action === "revoked-maker" &&
        attemptedTransaction?.status === 0 &&
        verifiedRejection === "RFQMakerNotApproved"
      ) {
        return {
          action,
          side,
          quote: signed,
          trace,
          ...(attemptedTransaction ? {attemptedTransaction} : {}),
          balanceEvidence,
          rejection: "RFQMakerNotApproved"
        };
      }
      const precheck = action === "compliance-proof"
        ? await this.precheck(investorAddress, q.amountIn, side)
        : undefined;
      if (
        action === "compliance-proof" &&
        precheck &&
        attemptedTransaction?.status === 0 &&
        verifiedRejection === "ComplianceRejected" &&
        !precheck.allowed
      ) {
        return {
          action,
          side,
          quote: signed,
          trace,
          ...(attemptedTransaction ? {attemptedTransaction} : {}),
          balanceEvidence,
          rejection: precheck.verdict.reason ?? "ComplianceRejected",
          reasonCode: precheck.verdict.reasonCode
        };
      }
      throw error;
    }
  }

  private async makerApproved(): Promise<boolean> {
    const adapter = new Contract(this.config.artifact.rfqAdapter, RFQ_ADAPTER_ABI, this.provider);
    return adapter.approvedMaker(this.config.artifact.maker) as Promise<boolean>;
  }

  private async qpEligibility(address: string): Promise<{
    present: boolean;
    eligible: boolean;
    reason?: string;
    verifiedAt?: number;
    expiresAt?: number;
    claim: QpClaimState;
  }> {
    const qp = new Contract(this.requiredArtifact("qualifiedPurchaser"), QP_ABI, this.provider);
    const claim = await qp.claimOf(address);
    const cap = Number(await qp.freshnessCap());
    const [eligible] = await qp.check(address, "0x0000000000000000000000000000000000000000", this.config.artifact.rwaToken, 0, "0x");
    const present = Number(claim.basis) !== 0;
    const verifiedAt = present ? Number(claim.verifiedAt) : undefined;
    const latest = await this.latestBlock();
    const expired = present && verifiedAt !== undefined && latest.timestamp > verifiedAt + cap;
    const reason = this.qpFailureReason({
      basis: Number(claim.basis),
      signatureValid: Boolean(claim.signatureValid),
      issuerTrusted: Boolean(claim.issuerTrusted),
      verifiedAt,
      expired,
      lookThroughStatus: Number(claim.ltStatus),
      coveredCompany: String(claim.coveredCompany)
    });
    return {
      present,
      eligible: Boolean(eligible),
      ...(!eligible ? {reason} : {}),
      ...(verifiedAt !== undefined ? {verifiedAt, expiresAt: verifiedAt + cap} : {}),
      claim: {
        basis: QP_BASIS_NAMES[Number(claim.basis)] ?? "OTHER",
        signatureValid: Boolean(claim.signatureValid),
        issuerTrusted: Boolean(claim.issuerTrusted),
        lookThroughStatus: LOOK_THROUGH_NAMES[Number(claim.ltStatus)] ?? "NONE",
        coveredCompanyMatchesFund:
          String(claim.coveredCompany).toLowerCase() === this.fundKey().toLowerCase(),
        ...(verifiedAt !== undefined ? {verifiedAt} : {})
      }
    };
  }

  private async walletState(entry: WalletEntry): Promise<DemoWalletState> {
    const qp = await this.qpEligibility(entry.signer.address);
    const rwa = new Contract(this.config.artifact.rwaToken, ERC20_ABI, this.provider);
    const quote = new Contract(this.config.artifact.quote, ERC20_ABI, this.provider);
    return {
      id: entry.id,
      label: entry.label,
      address: entry.signer.address,
      qualifiedPurchaser: qp.eligible,
      claimPresent: qp.present,
      rwaBalance: String(await rwa.balanceOf(entry.signer.address)),
      quoteBalance: String(await quote.balanceOf(entry.signer.address)),
      ...(qp.reason ? {eligibilityReason: qp.reason} : {}),
      ...(qp.verifiedAt !== undefined ? {verifiedAt: qp.verifiedAt, expiresAt: qp.expiresAt} : {}),
      qpClaim: qp.claim
    };
  }

  private walletFor(address: string): WalletEntry {
    const normalized = asAddress(address, "taker").toLowerCase();
    const entry = this.wallets.get(normalized);
    if (!entry) throw new Error("taker must be one of the configured demo wallets");
    return entry;
  }

  private walletById(walletId: string): WalletEntry {
    const entry = [...this.wallets.values()].find((candidate) => candidate.id === walletId);
    if (!entry) throw new Error("unknown demo wallet");
    return entry;
  }

  private context(taker: string, amountIn: string, amountOut: string, side: DemoTradeSide): unknown[] {
    return [
      taker,
      taker,
      this.config.artifact.maker,
      side === "buy" ? this.config.artifact.quote : this.config.artifact.rwaToken,
      side === "buy" ? this.config.artifact.rwaToken : this.config.artifact.quote,
      amountIn,
      amountOut,
      2,
      this.config.artifact.rfqVenue,
      0,
      false
    ];
  }

  private async setMakerApproval(approved: boolean): Promise<void> {
    const adapter = new Contract(this.config.artifact.rfqAdapter, RFQ_ADAPTER_ABI, this.operator);
    const tx = await this.sendOperatorTransaction((nonce) =>
      adapter.setMakerApproved(this.config.artifact.maker, approved, {nonce})
    );
    this.appendEvent({
      blockNumber: tx.blockNumber,
      transactionHash: tx.hash,
      name: "MakerApprovalSet",
      args: {maker: this.config.artifact.maker, approved: String(approved)}
    });
  }

  private async setWalletEligibility(entry: WalletEntry, eligible: boolean): Promise<void> {
    const qp = new Contract(this.requiredArtifact("qualifiedPurchaser"), QP_ABI, this.operator);
    const tx = await this.sendOperatorTransaction((nonce) => qp.setQp(entry.signer.address, eligible, {nonce}));
    this.appendEvent({
      blockNumber: tx.blockNumber,
      transactionHash: tx.hash,
      name: "QualifiedPurchaserSet",
      args: {investor: entry.signer.address, eligible: String(eligible)}
    });
  }

  private async setWalletClaim(entry: WalletEntry, claim: QpClaimInput): Promise<void> {
    const qp = new Contract(this.requiredArtifact("qualifiedPurchaser"), QP_ABI, this.operator);
    const latest = await this.latestBlock();
    const encoded = [
      QP_BASIS_VALUES[claim.basis],
      claim.signatureValid,
      claim.issuerTrusted,
      claim.basis === "NONE" ? 0 : latest.timestamp,
      LOOK_THROUGH_VALUES[claim.lookThroughStatus],
      claim.coveredCompanyMatchesFund ? this.fundKey() : ZERO_BYTES32
    ];
    const tx = await this.sendOperatorTransaction((nonce) =>
      qp.setQpClaim(entry.signer.address, encoded, {nonce})
    );
    this.appendEvent({
      blockNumber: tx.blockNumber,
      transactionHash: tx.hash,
      name: "QpClaimSet",
      args: {
        investor: entry.signer.address,
        basis: claim.basis,
        signatureValid: String(claim.signatureValid),
        issuerTrusted: String(claim.issuerTrusted),
        lookThroughStatus: claim.lookThroughStatus,
        coveredCompanyMatchesFund: String(claim.coveredCompanyMatchesFund)
      }
    });
  }

  private fundKey(): string {
    return `0x${BigInt(this.config.artifact.rwaToken).toString(16).padStart(64, "0")}`;
  }

  private qpFailureReason(claim: {
    basis: number;
    signatureValid: boolean;
    issuerTrusted: boolean;
    verifiedAt?: number;
    expired: boolean;
    lookThroughStatus: number;
    coveredCompany: string;
  }): string {
    if (claim.basis === 0) return "Qualified Purchaser claim missing";
    if (!claim.signatureValid) return "Qualified Purchaser claim signature is invalid";
    if (!claim.issuerTrusted) return "Qualified Purchaser claim issuer is not trusted";
    if (claim.expired) return "Qualified Purchaser claim expired";
    if ((claim.basis === 2 || claim.basis === 3) && claim.lookThroughStatus === 0) {
      return "Beneficial-owner look-through is required";
    }
    if ((claim.basis === 2 || claim.basis === 3) && claim.lookThroughStatus === 1) {
      return "Beneficial-owner look-through is pending";
    }
    if (claim.basis === 2 && claim.lookThroughStatus === 3) return "Family-company look-through failed";
    if (claim.basis === 3 && claim.lookThroughStatus === 3) return "Trust look-through failed";
    if (claim.basis === 6 && claim.coveredCompany.toLowerCase() !== this.fundKey().toLowerCase()) {
      return "Knowledgeable Employee claim does not cover this fund";
    }
    if (claim.basis === 7) return "Qualified Purchaser basis requires operator review";
    return "Qualified Purchaser claim does not satisfy the active policy";
  }

  private async setFreshnessCap(seconds: number): Promise<void> {
    const qp = new Contract(this.requiredArtifact("qualifiedPurchaser"), QP_ABI, this.operator);
    const tx = await this.sendOperatorTransaction((nonce) => qp.setFreshnessCap(seconds, {nonce}));
    this.appendEvent({
      blockNumber: tx.blockNumber,
      transactionHash: tx.hash,
      name: "FreshnessCapSet",
      args: {seconds: String(seconds)}
    });
  }

  private async latestBlock(): Promise<{timestamp: number}> {
    const latest = await this.provider.getBlock("latest");
    if (!latest) throw new Error("cannot read latest block");
    return latest;
  }

  private async sendOperatorTransaction(send: (nonce: bigint) => Promise<any>): Promise<{hash: string; blockNumber: number}> {
    for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
        const tx = await send(await this.pendingNonce(this.operator.address));
        const receipt = await tx.wait();
        return {hash: tx.hash, blockNumber: receipt?.blockNumber ?? 0};
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        if (attempt === 0 && /nonce too low|already known|replacement transaction underpriced/i.test(message)) continue;
        throw error;
      }
    }
    throw new Error("operator transaction failed");
  }

  private async pendingNonce(address: string): Promise<bigint> {
    const nonceHex = await this.provider.send("eth_getTransactionCount", [address, "pending"]);
    return BigInt(nonceHex);
  }

  private validateQuote(signed: SignedRFQQuote): WalletEntry {
    if (!signed || typeof signed !== "object" || !signed.quote || typeof signed.signature !== "string") {
      throw new Error("signed quote is malformed");
    }
    const q = signed.quote;
    const wallet = this.walletFor(q.taker);
    const expected = {
      maker: asAddress(this.config.artifact.maker, "artifact maker"),
      venue: asAddress(this.config.artifact.rfqVenue, "artifact rfqVenue"),
      verifyingContract: asAddress(this.config.artifact.rfqAdapter, "artifact rfqAdapter")
    };
    for (const key of ["maker", "venue"] as const) {
      if (asAddress(q[key], `quote ${key}`).toLowerCase() !== expected[key].toLowerCase()) {
        throw new Error(`quote ${key} does not match the deployment artifact`);
      }
    }
    this.sideOf(q);
    const domain = signed.typedData?.domain;
    if (
      !domain
      || domain.name !== "CornerStoreRFQ"
      || domain.version !== "1"
      || Number(domain.chainId) !== this.config.chainId
      || asAddress(domain.verifyingContract, "quote verifyingContract").toLowerCase() !== expected.verifyingContract.toLowerCase()
    ) throw new Error("quote domain does not match the deployment artifact");
    if (signed.typedData.primaryType !== "RFQQuote" || !signed.typedData.message) {
      throw new Error("quote typed data is malformed");
    }
    for (const key of ["maker", "taker", "tokenIn", "tokenOut", "venue", "amountIn", "amountOut", "nonce", "expiry"] as const) {
      if (String(signed.typedData.message[key]).toLowerCase() !== String(q[key]).toLowerCase()) {
        throw new Error(`quote typed data ${key} does not match the signed quote`);
      }
    }
    const recovered = verifyTypedData(
      {name: "CornerStoreRFQ", version: "1", chainId: this.config.chainId, verifyingContract: expected.verifyingContract},
      RFQ_QUOTE_TYPES,
      q,
      signed.signature
    );
    if (recovered.toLowerCase() !== expected.maker.toLowerCase()) {
      throw new Error("quote signature does not recover the approved maker");
    }
    return wallet;
  }

  private sideOf(quote: SignedRFQQuote["quote"]): DemoTradeSide {
    const tokenIn = asAddress(quote.tokenIn, "quote tokenIn").toLowerCase();
    const tokenOut = asAddress(quote.tokenOut, "quote tokenOut").toLowerCase();
    const cash = asAddress(this.config.artifact.quote, "artifact quote").toLowerCase();
    const rwa = asAddress(this.config.artifact.rwaToken, "artifact rwaToken").toLowerCase();
    if (tokenIn === cash && tokenOut === rwa) return "buy";
    if (tokenIn === rwa && tokenOut === cash) return "sell";
    throw new Error("quote token pair does not match the deployment artifact");
  }

  private requireCanonical(wallet: HDNodeWallet, artifactAddress: string | undefined, label: string): void {
    if (wallet.address.toLowerCase() !== asAddress(artifactAddress ?? "", `artifact ${label}`).toLowerCase()) {
      throw new Error(`demo settlement requires the canonical Anvil ${label} account`);
    }
  }

  private requiredArtifact(key: "engine" | "policyReg" | "qualifiedPurchaser"): string {
    return asAddress(this.config.artifact[key] ?? "", `artifact ${key}`);
  }

  private enqueue<T>(action: () => Promise<T>): Promise<T> {
    const pending = this.actionQueue.then(action, action);
    this.actionQueue = pending.then(() => undefined, () => undefined);
    return pending;
  }

  private appendEvent(event: {blockNumber: number; transactionHash: string; name: string; args: Record<string, string>}): void {
    if (!this.config.eventsPath) return;
    const current = existsSync(this.config.eventsPath)
      ? JSON.parse(readFileSync(this.config.eventsPath, "utf8"))
      : {schemaVersion: 1, lastBlock: 0, events: []};
    const events = Array.isArray(current.events) ? current.events : [];
    events.push(event);
    events.sort((a: {blockNumber: number}, b: {blockNumber: number}) => a.blockNumber - b.blockNumber);
    writeFileSync(
      this.config.eventsPath,
      `${JSON.stringify({schemaVersion: 1, lastBlock: events[events.length - 1]?.blockNumber ?? 0, events}, null, 2)}\n`
    );
  }
}

function isError(value: unknown, selector: string, name: string, seen = new Set<object>()): boolean {
  if (typeof value === "string") {
    const normalized = value.toLowerCase();
    return normalized.includes(name.toLowerCase()) || normalized.includes(selector);
  }
  if (!value || typeof value !== "object" || seen.has(value)) return false;
  seen.add(value);
  return Object.values(value).some((nested) => isError(nested, selector, name, seen));
}

function formatSigned(value: bigint): string {
  return `${value >= 0n ? "+" : ""}${formatEther(value)}`;
}

function demoWallet(account: number): HDNodeWallet {
  return HDNodeWallet.fromPhrase(ANVIL_MNEMONIC, "", `m/44'/60'/0'/0/${account}`);
}
