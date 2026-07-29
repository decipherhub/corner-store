import {AbiCoder, Contract, HDNodeWallet, JsonRpcProvider, MaxUint256, NonceManager, formatEther, id} from "ethers";
import {existsSync, readFileSync, writeFileSync} from "fs";

import {RFQBackendSDK, SignedRFQQuote} from "../../rfq/src";

import {ANVIL_MNEMONIC, DemoBackendConfig, asAddress} from "./config";

const ROUTER_ABI = [
  "function execute((tuple(address initiator,address buyer,address seller,address tokenIn,address tokenOut,uint256 amountIn,uint256 amountOut,uint8 venueType,address venue,uint8 flowType,bool sellerIsAffiliate) context,uint256 amountOutMin,uint64 deadline,uint256 nonce,bytes venueData) req) returns (tuple(uint256 amountOut,bytes32 executionId))",
  "error RFQMakerNotApproved()"
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
const QUOTE_TUPLE = "tuple(address maker,address taker,address tokenIn,address tokenOut,uint256 amountIn,uint256 amountOut,address venue,uint256 nonce,uint64 expiry)";
const RFQ_MAKER_NOT_APPROVED_SELECTOR = id("RFQMakerNotApproved()").slice(0, 10).toLowerCase();

export type DemoTradeAction = "settle" | "revoked-maker";

export interface DemoTradeResult {
  action: DemoTradeAction;
  quote: SignedRFQQuote;
  trace: Array<{stage: string; detail: string; status: "passed" | "rejected"}>;
  transaction?: {hash: string; blockNumber: number; rwaBefore: string; rwaAfter: string; rwaDelta: string};
  rejection?: string;
}

/** Local-Anvil-only facilitator. Never use this pattern for a hosted service. */
export class DemoSettlementService {
  private readonly provider: JsonRpcProvider;
  private readonly investor: NonceManager;
  private readonly operator: HDNodeWallet;
  private readonly investorAddress: string;
  private nextRouterNonce = BigInt(Date.now());

  constructor(private readonly config: DemoBackendConfig, private readonly quotes: RFQBackendSDK) {
    if (!config.demoSettlement.enabled) throw new Error("demo settlement is disabled");
    if (config.chainId !== 31337) throw new Error("demo settlement is restricted to Anvil chain id 31337");

    const investor = demoWallet(config.demoSettlement.investorAccount);
    const operator = demoWallet(config.demoSettlement.operatorAccount);
    this.investorAddress = investor.address;
    if (investor.address.toLowerCase() !== asAddress(config.artifact.investor, "artifact investor").toLowerCase()) {
      throw new Error("demo settlement requires the canonical Anvil investor account");
    }
    if (operator.address.toLowerCase() !== asAddress(config.artifact.deployer, "artifact deployer").toLowerCase()) {
      throw new Error("demo settlement requires the canonical Anvil operator account");
    }

    this.provider = new JsonRpcProvider(config.rpcUrl, config.chainId);
    this.investor = new NonceManager(investor.connect(this.provider));
    this.operator = operator.connect(this.provider);
  }

  async state(): Promise<{ready: boolean; makerApproved: boolean; chainId: number; maker: string; investor: string}> {
    const adapter = new Contract(this.config.artifact.rfqAdapter, RFQ_ADAPTER_ABI, this.provider);
    const makerApproved = await adapter.approvedMaker(this.config.artifact.maker) as boolean;
    const network = await this.provider.getNetwork();
    return {
      ready: makerApproved && Number(network.chainId) === this.config.chainId,
      makerApproved,
      chainId: Number(network.chainId),
      maker: this.config.artifact.maker,
      investor: this.investorAddress
    };
  }

  async prepare(): Promise<{ready: boolean; makerApproved: boolean; chainId: number; maker: string; investor: string}> {
    const current = await this.state();
    if (!current.makerApproved) await this.setMakerApproval(true);
    return this.state();
  }

  async restoreMaker(): Promise<{ready: boolean; makerApproved: boolean; chainId: number; maker: string; investor: string}> {
    const current = await this.state();
    if (!current.makerApproved) await this.setMakerApproval(true);
    return this.state();
  }

  async trade(amountIn: string, action: DemoTradeAction, provided?: SignedRFQQuote): Promise<DemoTradeResult> {
    const signed = provided ?? await this.quotes.quote({
      taker: asAddress(this.config.artifact.investor, "artifact investor"),
      tokenIn: asAddress(this.config.artifact.quote, "artifact quote"),
      tokenOut: asAddress(this.config.artifact.rwaToken, "artifact rwaToken"),
      amountIn,
      venue: asAddress(this.config.artifact.rfqVenue, "artifact rfqVenue")
    });
    if (BigInt(signed.quote.amountIn) !== BigInt(amountIn)) throw new Error("quote amount does not match trade amount");
    const trace: DemoTradeResult["trace"] = [
      {stage: "Mock TA profile", detail: "canonical demo investor selected", status: "passed"},
      {stage: "RFQ quote", detail: `maker signed nonce ${signed.quote.nonce}`, status: "passed"}
    ];

    if (action === "revoked-maker") {
      await this.setMakerApproval(false);
      trace.push({stage: "Maker policy", detail: "operator revoked maker before fill", status: "rejected"});
    }
    const result = await this.execute(signed, action, trace);
    if (result.transaction) {
      this.appendEvent({
        blockNumber: result.transaction.blockNumber,
        transactionHash: result.transaction.hash,
        name: "RFQSettled",
        args: {maker: signed.quote.maker, taker: signed.quote.taker, amountIn: signed.quote.amountIn, amountOut: signed.quote.amountOut}
      });
    }
    return result;
  }

  private async execute(signed: SignedRFQQuote, action: DemoTradeAction, trace: DemoTradeResult["trace"]): Promise<DemoTradeResult> {
    const q = signed.quote;
    const rwa = new Contract(this.config.artifact.rwaToken, ERC20_ABI, this.provider);
    const quote = new Contract(this.config.artifact.quote, ERC20_ABI, this.investor);
    const router = new Contract(this.config.artifact.router, ROUTER_ABI, this.investor);
    const before = await rwa.balanceOf(this.investorAddress) as bigint;
    const amountIn = BigInt(q.amountIn);
    const allowance = await quote.allowance(this.investorAddress, this.config.artifact.rfqAdapter) as bigint;
    if (allowance < amountIn) {
      const approval = await quote.approve(this.config.artifact.rfqAdapter, MaxUint256);
      await approval.wait();
      trace.push({stage: "Quote allowance", detail: "demo investor approved RFQAdapter", status: "passed"});
    }

    const latest = await this.provider.getBlock("latest");
    if (!latest) throw new Error("cannot read latest block for demo settlement");
    const venueData = AbiCoder.defaultAbiCoder().encode(
      [QUOTE_TUPLE, "bytes"],
      [[q.maker, q.taker, q.tokenIn, q.tokenOut, q.amountIn, q.amountOut, q.venue, q.nonce, q.expiry], signed.signature]
    );
    const context = [this.investorAddress, this.investorAddress, q.maker, q.tokenIn, q.tokenOut, q.amountIn, q.amountOut, 2, q.venue, 0, false];
    const request = [context, q.amountOut, BigInt(latest.timestamp + 3600), this.nextRouterNonce++, venueData];

    try {
      const tx = await router.execute(request);
      const receipt = await tx.wait();
      const after = await rwa.balanceOf(this.investorAddress) as bigint;
      trace.push({stage: "ComplianceEngine", detail: "latest policy accepted at fill time", status: "passed"});
      trace.push({stage: "RFQ settlement", detail: `ERC-3643 balance +${formatEther(after - before)}`, status: "passed"});
      return {
        action,
        quote: signed,
        trace,
        transaction: {hash: tx.hash, blockNumber: receipt?.blockNumber ?? 0, rwaBefore: before.toString(), rwaAfter: after.toString(), rwaDelta: (after - before).toString()}
      };
    } catch (error) {
      const detail = error instanceof Error ? (error as any).shortMessage ?? error.message : String(error);
      trace.push({stage: "RFQ settlement", detail, status: "rejected"});
      if (action !== "revoked-maker") throw error;
      if (!isMakerNotApproved(error)) throw error;
      return {action, quote: signed, trace, rejection: "RFQMakerNotApproved"};
    }
  }

  private async setMakerApproval(approved: boolean): Promise<void> {
    // The operator account also performed deployment/onboarding transactions.
    // Refresh before each explicit policy toggle so repeated dashboard actions
    // cannot reuse a stale cached nonce in the long-lived demo backend.
    // Read the pending nonce for every policy transaction. The dashboard can
    // keep this backend alive across repeated demos, and an in-memory nonce
    // cache becomes stale when Anvil is restarted or another operator action
    // consumes a deployer nonce.
    const adapter = new Contract(this.config.artifact.rfqAdapter, RFQ_ADAPTER_ABI, this.operator);
    for (let attempt = 0; attempt < 2; attempt += 1) {
      const nonceHex = await this.provider.send("eth_getTransactionCount", [this.operator.address, "pending"]);
      const nonce = BigInt(nonceHex);
      try {
        const tx = await adapter.setMakerApproved(this.config.artifact.maker, approved, {nonce});
        const receipt = await tx.wait();
        this.appendEvent({
          blockNumber: receipt?.blockNumber ?? 0,
          transactionHash: tx.hash,
          name: "MakerApprovalSet",
          args: {maker: this.config.artifact.maker, approved: String(approved)}
        });
        return;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        if (attempt === 0 && /nonce too low|already known|replacement transaction underpriced/i.test(message)) {
          continue;
        }
        throw error;
      }
    }
  }

  private appendEvent(event: {blockNumber: number; transactionHash: string; name: string; args: Record<string, string>}): void {
    if (!this.config.eventsPath) return;
    const current = existsSync(this.config.eventsPath)
      ? JSON.parse(readFileSync(this.config.eventsPath, "utf8"))
      : {schemaVersion: 1, lastBlock: 0, events: []};
    const events = Array.isArray(current.events) ? current.events : [];
    events.push(event);
    events.sort((a: {blockNumber: number}, b: {blockNumber: number}) => a.blockNumber - b.blockNumber);
    writeFileSync(this.config.eventsPath, `${JSON.stringify({schemaVersion: 1, lastBlock: events[events.length - 1]?.blockNumber ?? 0, events}, null, 2)}\n`);
  }
}

function isMakerNotApproved(value: unknown, seen = new Set<object>()): boolean {
  if (typeof value === "string") {
    const normalized = value.toLowerCase();
    return normalized.includes("rfqmakernotapproved") || normalized.includes(RFQ_MAKER_NOT_APPROVED_SELECTOR);
  }
  if (!value || typeof value !== "object" || seen.has(value)) return false;
  seen.add(value);
  return Object.values(value).some((nested) => isMakerNotApproved(nested, seen));
}

function demoWallet(account: number): HDNodeWallet {
  return HDNodeWallet.fromPhrase(ANVIL_MNEMONIC, "", `m/44'/60'/0'/0/${account}`);
}
