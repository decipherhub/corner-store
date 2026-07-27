import {
  AbiCoder,
  Contract,
  HDNodeWallet,
  JsonRpcProvider,
  MaxUint256,
  formatEther,
  id,
  verifyTypedData
} from "ethers";
import {existsSync, readFileSync, writeFileSync} from "fs";

import {RFQBackendSDK, RFQ_QUOTE_TYPES, SignedRFQQuote} from "../../rfq/src";

import {ANVIL_MNEMONIC, DemoBackendConfig, asAddress} from "./config";

const ROUTER_ABI = [
  "function execute((tuple(address initiator,address buyer,address seller,address tokenIn,address tokenOut,uint256 amountIn,uint256 amountOut,uint8 venueType,address venue,uint8 flowType,bool sellerIsAffiliate) context,uint256 amountOutMin,uint64 deadline,uint256 nonce,bytes venueData) req) returns (tuple(uint256 amountOut,bytes32 executionId))",
  "error RFQMakerNotApproved()",
  "error ComplianceRejected(bytes32 reasonCode)"
];
const ENGINE_ABI = [
  "function evaluate(tuple(address initiator,address buyer,address seller,address tokenIn,address tokenOut,uint256 amountIn,uint256 amountOut,uint8 venueType,address venue,uint8 flowType,bool sellerIsAffiliate) ctx) view returns (tuple(bool allowed,bytes32 policyId,uint64 policyVersion,uint64 validUntil,uint256 maxAmount,uint256 allowedVenueTypes,bytes32 allowedVenuesHash,bytes32 reasonCode,bytes32 reliedClaims,uint256 flagsBitmap,bytes32 decisionHash))"
];
const ERC20_ABI = [
  "function balanceOf(address account) view returns (uint256)",
  "function allowance(address owner,address spender) view returns (uint256)",
  "function approve(address spender,uint256 amount) returns (bool)"
];
const RFQ_ADAPTER_ABI = [
  "function setMakerApproved(address maker,bool approved)",
  "function approvedMaker(address maker) view returns (bool)"
];
const QP_ABI = [
  "function qp(address user) view returns (bool)",
  "function setQp(address user,bool isQp)"
];
const POLICY_ABI = ["function statusOf(address token) view returns (uint8)"];
const QUOTE_TUPLE =
  "tuple(address maker,address taker,address tokenIn,address tokenOut,uint256 amountIn,uint256 amountOut,address venue,uint256 nonce,uint64 expiry)";
const RFQ_MAKER_NOT_APPROVED_SELECTOR = id("RFQMakerNotApproved()").slice(0, 10).toLowerCase();
const COMPLIANCE_REJECTED_SELECTOR = id("ComplianceRejected(bytes32)").slice(0, 10).toLowerCase();
const BUIDL_MINIMUM = 5_000_000n * 10n ** 18n;

export type DemoWalletId = "eligible-a" | "eligible-b" | "ineligible";
export type DemoTradeAction = "settle" | "revoked-maker" | "compliance-proof";

export interface DemoWalletState {
  id: DemoWalletId;
  label: string;
  address: string;
  qualifiedPurchaser: boolean;
}

export interface DemoPrecheckResult {
  allowed: boolean;
  wallet: DemoWalletState;
  amountIn: string;
  checks: Array<{key: "investor" | "maker" | "asset"; label: string; pass: boolean; reason?: string}>;
  verdict: {allowed: boolean; reasonCode: string; reason?: string};
}

export interface DemoTradeResult {
  action: DemoTradeAction;
  quote: SignedRFQQuote;
  trace: Array<{stage: string; detail: string; status: "passed" | "rejected"}>;
  transaction?: {hash: string; blockNumber: number; rwaBefore: string; rwaAfter: string; rwaDelta: string};
  rejection?: string;
  reasonCode?: string;
}

interface WalletEntry {
  id: DemoWalletId;
  label: string;
  signer: HDNodeWallet;
}

/** Local-Anvil-only facilitator. Never use this pattern for a hosted service. */
export class DemoSettlementService {
  private readonly provider: JsonRpcProvider;
  private readonly operator: HDNodeWallet;
  private readonly wallets: Map<string, WalletEntry>;
  private nextRouterNonce = BigInt(Date.now());
  private actionQueue: Promise<void> = Promise.resolve();

  constructor(private readonly config: DemoBackendConfig, private readonly quotes: RFQBackendSDK) {
    if (!config.demoSettlement.enabled) throw new Error("demo settlement is disabled");
    if (config.chainId !== 31337) throw new Error("demo settlement is restricted to Anvil chain id 31337");

    this.provider = new JsonRpcProvider(config.rpcUrl, config.chainId);
    this.operator = demoWallet(config.demoSettlement.operatorAccount).connect(this.provider);
    this.requireCanonical(this.operator, config.artifact.deployer, "operator");

    const entries: Array<[DemoWalletId, string, number, string | undefined]> = [
      ["eligible-a", "적격투자자 A", config.demoSettlement.investorAccount, config.artifact.investor],
      ["eligible-b", "적격투자자 B", config.demoSettlement.eligibleInvestorBAccount, config.artifact.eligibleInvestorB],
      ["ineligible", "비적격투자자", config.demoSettlement.ineligibleInvestorAccount, config.artifact.ineligibleInvestor]
    ];
    this.wallets = new Map(entries.map(([idValue, label, account, artifactAddress]) => {
      const signer = demoWallet(account).connect(this.provider);
      this.requireCanonical(signer, artifactAddress, label);
      return [signer.address.toLowerCase(), {id: idValue, label, signer}];
    }));
  }

  async state(): Promise<{
    ready: boolean;
    assetProfile: "buidl-like" | "reg-d";
    requiresQualifiedPurchaser: boolean;
    makerApproved: boolean;
    chainId: number;
    maker: string;
    investor: string;
    wallets: DemoWalletState[];
  }> {
    const makerApproved = await this.makerApproved();
    const network = await this.provider.getNetwork();
    const wallets = await Promise.all([...this.wallets.values()].map((entry) => this.walletState(entry)));
    return {
      ready: makerApproved && Number(network.chainId) === this.config.chainId,
      assetProfile: this.config.artifact.assetProfile,
      requiresQualifiedPurchaser: this.config.artifact.assetProfile === "buidl-like",
      makerApproved,
      chainId: Number(network.chainId),
      maker: this.config.artifact.maker,
      investor: asAddress(this.config.artifact.investor, "artifact investor"),
      wallets
    };
  }

  async prepare(): Promise<Awaited<ReturnType<DemoSettlementService["state"]>>> {
    return this.enqueue(async () => {
      if (!await this.makerApproved()) await this.setMakerApproval(true);
      return this.state();
    });
  }

  async restoreMaker(): Promise<Awaited<ReturnType<DemoSettlementService["state"]>>> {
    return this.setMakerApproved(true);
  }

  async precheck(taker: string, amountIn: string): Promise<DemoPrecheckResult> {
    const entry = this.walletFor(taker);
    const amount = BigInt(amountIn);
    const qp = await this.qualifiedPurchaser(entry.signer.address);
    const requiresQp = this.config.artifact.assetProfile === "buidl-like";
    const investorAllowed = !requiresQp || qp;
    const maker = await this.makerApproved();
    const policy = new Contract(this.requiredArtifact("policyReg"), POLICY_ABI, this.provider);
    const assetActive = Number(await policy.statusOf(this.config.artifact.rwaToken)) === 2;
    const amountAllowed = !requiresQp || amount >= BUIDL_MINIMUM;
    const amountOut = this.price(amount);
    const context = this.context(entry.signer.address, amountIn, amountOut.toString());
    const engine = new Contract(this.requiredArtifact("engine"), ENGINE_ABI, this.provider);
    const decision = await engine.evaluate(context);
    const assetPass = assetActive && amountAllowed;
    const reason = !investorAllowed
      ? "Qualified Purchaser claim missing"
      : !maker
        ? "Maker is not approved"
        : !assetActive
          ? "Asset manifest is not active"
          : !amountAllowed
            ? "BUIDL-like minimum investment is 5,000,000"
            : decision.allowed
              ? undefined
              : "Current ComplianceEngine policy rejected the trade";
    return {
      allowed: Boolean(investorAllowed && maker && assetPass && decision.allowed),
      wallet: await this.walletState(entry),
      amountIn,
      checks: [
        {
          key: "investor",
          label: "투자자 적격성",
          pass: investorAllowed,
          ...(!investorAllowed ? {reason: "Qualified Purchaser claim missing"} : {})
        },
        {key: "maker", label: "Maker 승인", pass: maker, ...(!maker ? {reason: "Maker is not approved"} : {})},
        {
          key: "asset",
          label: "자산 정책",
          pass: assetPass,
          ...(!assetActive
            ? {reason: "Asset manifest is not active"}
            : !amountAllowed
              ? {reason: "BUIDL-like minimum investment is 5,000,000"}
              : {})
        }
      ],
      verdict: {allowed: Boolean(decision.allowed), reasonCode: String(decision.reasonCode), ...(reason ? {reason} : {})}
    };
  }

  async setUserEligibility(walletId: DemoWalletId, eligible: boolean): Promise<DemoWalletState> {
    return this.enqueue(async () => {
      const entry = [...this.wallets.values()].find((candidate) => candidate.id === walletId);
      if (!entry) throw new Error("unknown demo wallet");
      const qp = new Contract(this.requiredArtifact("qualifiedPurchaser"), QP_ABI, this.operator);
      const tx = await this.sendOperatorTransaction((nonce) => qp.setQp(entry.signer.address, eligible, {nonce}));
      this.appendEvent({
        blockNumber: tx.blockNumber,
        transactionHash: tx.hash,
        name: "QualifiedPurchaserSet",
        args: {investor: entry.signer.address, eligible: String(eligible)}
      });
      return this.walletState(entry);
    });
  }

  async setMakerApproved(approved: boolean): Promise<Awaited<ReturnType<DemoSettlementService["state"]>>> {
    return this.enqueue(async () => {
      await this.setMakerApproval(approved);
      return this.state();
    });
  }

  async trade(amountIn: string, action: DemoTradeAction, provided?: SignedRFQQuote): Promise<DemoTradeResult> {
    return this.enqueue(() => this.tradeUnlocked(amountIn, action, provided));
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
    if (BigInt(signed.quote.amountIn) !== BigInt(amountIn)) throw new Error("quote amount does not match trade amount");
    const trace: DemoTradeResult["trace"] = [
      {stage: "Selected wallet", detail: `${wallet.label} · ${wallet.signer.address}`, status: "passed"},
      {stage: "RFQ quote", detail: `maker signed nonce ${signed.quote.nonce}`, status: "passed"}
    ];

    if (action === "revoked-maker") {
      await this.setMakerApproval(false);
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
          amountOut: signed.quote.amountOut
        }
      });
    } else if (result.rejection) {
      this.appendEvent({
        blockNumber: await this.provider.getBlockNumber(),
        transactionHash: "0x0000000000000000000000000000000000000000000000000000000000000000",
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
    const rwa = new Contract(this.config.artifact.rwaToken, ERC20_ABI, this.provider);
    const quote = new Contract(this.config.artifact.quote, ERC20_ABI, wallet.signer);
    const router = new Contract(this.config.artifact.router, ROUTER_ABI, wallet.signer);
    const before = await rwa.balanceOf(investorAddress) as bigint;
    const amountIn = BigInt(q.amountIn);
    const allowance = await quote.allowance(investorAddress, this.config.artifact.rfqAdapter) as bigint;
    if (allowance < amountIn) {
      const approval = await quote.approve(this.config.artifact.rfqAdapter, MaxUint256, {
        nonce: await this.pendingNonce(investorAddress)
      });
      await approval.wait();
      trace.push({stage: "Quote allowance", detail: `${wallet.label} approved RFQAdapter`, status: "passed"});
    }

    const latest = await this.provider.getBlock("latest");
    if (!latest) throw new Error("cannot read latest block for demo settlement");
    const venueData = AbiCoder.defaultAbiCoder().encode(
      [QUOTE_TUPLE, "bytes"],
      [[q.maker, q.taker, q.tokenIn, q.tokenOut, q.amountIn, q.amountOut, q.venue, q.nonce, q.expiry], signed.signature]
    );
    const request = [
      this.context(investorAddress, q.amountIn, q.amountOut),
      q.amountOut,
      BigInt(latest.timestamp + 3600),
      this.nextRouterNonce++,
      venueData
    ];

    try {
      const tx = await router.execute(request, {nonce: await this.pendingNonce(investorAddress)});
      const receipt = await tx.wait();
      const after = await rwa.balanceOf(investorAddress) as bigint;
      trace.push({stage: "ComplianceEngine", detail: "latest policy accepted at fill time", status: "passed"});
      trace.push({stage: "RFQ settlement", detail: `ERC-3643 balance +${formatEther(after - before)}`, status: "passed"});
      return {
        action,
        quote: signed,
        trace,
        transaction: {
          hash: tx.hash,
          blockNumber: receipt?.blockNumber ?? 0,
          rwaBefore: before.toString(),
          rwaAfter: after.toString(),
          rwaDelta: (after - before).toString()
        }
      };
    } catch (error) {
      const detail = error instanceof Error ? (error as any).shortMessage ?? error.message : String(error);
      trace.push({stage: "Final Router check", detail, status: "rejected"});
      if (action === "revoked-maker" && isError(error, RFQ_MAKER_NOT_APPROVED_SELECTOR, "RFQMakerNotApproved")) {
        return {action, quote: signed, trace, rejection: "RFQMakerNotApproved"};
      }
      if (action === "compliance-proof" && isError(error, COMPLIANCE_REJECTED_SELECTOR, "ComplianceRejected")) {
        const precheck = await this.precheck(investorAddress, q.amountIn);
        return {
          action,
          quote: signed,
          trace,
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

  private price(amountIn: bigint): bigint {
    const amountOut = (amountIn * BigInt(this.config.priceNumerator)) / BigInt(this.config.priceDenominator);
    if (amountOut <= 0n) throw new Error("pricing provider returned zero amountOut");
    return amountOut;
  }

  private async qualifiedPurchaser(address: string): Promise<boolean> {
    const qp = new Contract(this.requiredArtifact("qualifiedPurchaser"), QP_ABI, this.provider);
    return qp.qp(address) as Promise<boolean>;
  }

  private async walletState(entry: WalletEntry): Promise<DemoWalletState> {
    return {
      id: entry.id,
      label: entry.label,
      address: entry.signer.address,
      qualifiedPurchaser: await this.qualifiedPurchaser(entry.signer.address)
    };
  }

  private walletFor(address: string): WalletEntry {
    const normalized = asAddress(address, "taker").toLowerCase();
    const entry = this.wallets.get(normalized);
    if (!entry) throw new Error("taker must be one of the configured demo wallets");
    return entry;
  }

  private context(taker: string, amountIn: string, amountOut: string): unknown[] {
    return [
      taker,
      taker,
      this.config.artifact.maker,
      this.config.artifact.quote,
      this.config.artifact.rwaToken,
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
      tokenIn: asAddress(this.config.artifact.quote, "artifact quote"),
      tokenOut: asAddress(this.config.artifact.rwaToken, "artifact rwaToken"),
      venue: asAddress(this.config.artifact.rfqVenue, "artifact rfqVenue"),
      verifyingContract: asAddress(this.config.artifact.rfqAdapter, "artifact rfqAdapter")
    };
    for (const key of ["maker", "tokenIn", "tokenOut", "venue"] as const) {
      if (asAddress(q[key], `quote ${key}`).toLowerCase() !== expected[key].toLowerCase()) {
        throw new Error(`quote ${key} does not match the deployment artifact`);
      }
    }
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

function demoWallet(account: number): HDNodeWallet {
  return HDNodeWallet.fromPhrase(ANVIL_MNEMONIC, "", `m/44'/60'/0'/0/${account}`);
}
