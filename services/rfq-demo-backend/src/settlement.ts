import {AbiCoder, Contract, HDNodeWallet, JsonRpcProvider, MaxUint256, NonceManager, formatEther} from "ethers";

import {RFQBackendSDK, SignedRFQQuote} from "../../rfq/src";

import {ANVIL_MNEMONIC, DemoBackendConfig, asAddress} from "./config";

const ROUTER_ABI = [
  "function execute((tuple(address initiator,address buyer,address seller,address tokenIn,address tokenOut,uint256 amountIn,uint256 amountOut,uint8 venueType,address venue,uint8 flowType,bool sellerIsAffiliate) context,uint256 amountOutMin,uint64 deadline,uint256 nonce,bytes venueData) req) returns (tuple(uint256 amountOut,bytes32 executionId))"
];
const ERC20_ABI = [
  "function balanceOf(address account) view returns (uint256)",
  "function allowance(address owner,address spender) view returns (uint256)",
  "function approve(address spender,uint256 amount) returns (bool)"
];
const RFQ_ADAPTER_ABI = ["function setMakerApproved(address maker,bool approved)"];
const QUOTE_TUPLE = "tuple(address maker,address taker,address tokenIn,address tokenOut,uint256 amountIn,uint256 amountOut,address venue,uint256 nonce,uint64 expiry)";

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
  private readonly operator: NonceManager;
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
    this.operator = new NonceManager(operator.connect(this.provider));
  }

  async trade(amountIn: string, action: DemoTradeAction): Promise<DemoTradeResult> {
    const signed = await this.quotes.quote({
      taker: asAddress(this.config.artifact.investor, "artifact investor"),
      tokenIn: asAddress(this.config.artifact.quote, "artifact quote"),
      tokenOut: asAddress(this.config.artifact.rwaToken, "artifact rwaToken"),
      amountIn,
      venue: asAddress(this.config.artifact.rfqVenue, "artifact rfqVenue")
    });
    const trace: DemoTradeResult["trace"] = [
      {stage: "Mock TA profile", detail: "canonical demo investor selected", status: "passed"},
      {stage: "RFQ quote", detail: `maker signed nonce ${signed.quote.nonce}`, status: "passed"}
    ];

    let makerRevoked = false;
    try {
      if (action === "revoked-maker") {
        await this.setMakerApproval(false);
        makerRevoked = true;
        trace.push({stage: "Maker policy", detail: "operator revoked maker before fill", status: "rejected"});
      }
      return await this.execute(signed, action, trace);
    } finally {
      if (makerRevoked) await this.setMakerApproval(true);
    }
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
      return {action, quote: signed, trace, rejection: detail};
    }
  }

  private async setMakerApproval(approved: boolean): Promise<void> {
    const adapter = new Contract(this.config.artifact.rfqAdapter, RFQ_ADAPTER_ABI, this.operator);
    const tx = await adapter.setMakerApproved(this.config.artifact.maker, approved);
    await tx.wait();
  }
}

function demoWallet(account: number): HDNodeWallet {
  return HDNodeWallet.fromPhrase(ANVIL_MNEMONIC, "", `m/44'/60'/0'/0/${account}`);
}
