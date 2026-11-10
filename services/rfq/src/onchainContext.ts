import {AbiCoder, Contract, Provider, keccak256, toUtf8Bytes} from "ethers";
import {Address, Hex, RFQContextEvidence, RFQContextResolver, RFQQuoteRequest} from "./types";
import {affiliateEvidenceCommitment, AffiliateLegEvidence} from "./contextEvidence";
import {normalizeAddress, normalizeChainId} from "./validation";
import {normalizeFlowType} from "./quoteService";

const coder = AbiCoder.defaultAbiCoder();
const VENUE_TUPLE = "tuple(uint8 venueType,address adapter,address target,address operator,uint8 custody,bool active)";
const EVIDENCE_TUPLE = "tuple(uint16 adapterVersion,uint16 contextVersion,bytes32 adapterCodeHash,address affiliateSource,bytes32 affiliateSourceCodeHash,address policyRegistry,bytes32 policyRegistryCodeHash,bytes32 configurationHash)";
export interface RFQContextChainReader {
  snapshot(): Promise<{chainId: number; blockNumber: number; timestamp: number}>;
  getCode(address: string, blockNumber: number): Promise<string>;
  call(address: string, abi: string[], fn: string, args: unknown[], blockNumber: number): Promise<any>;
}
export function ethersContextReader(provider: Provider): RFQContextChainReader {
  return {
    async snapshot() {
      const [network, block] = await Promise.all([provider.getNetwork(), provider.getBlock("latest")]);
      if (!block) throw new Error("context block unavailable");
      return {chainId: Number(network.chainId), blockNumber: block.number, timestamp: block.timestamp};
    },
    getCode: (address, blockNumber) => provider.getCode(address, blockNumber),
    call: (address, abi, fn, args, blockNumber) => new Contract(address, abi, provider)[fn].staticCall(...args, {blockTag: blockNumber})
  };
}
export function venueConfigurationHash(cfg: unknown[], adapterConfigHash: string): Hex {
  return keccak256(coder.encode(["bytes32", VENUE_TUPLE, "bytes32"], [keccak256(toUtf8Bytes("corner-store.venue-context-config.v1")), cfg, adapterConfigHash])) as Hex;
}
export interface OnchainRFQContextConfig {
  chainId: number;
  verifyingContract: Address;
  router: Address;
  venueRegistry: Address;
  policyRegistry: Address;
  affiliateSource: Address;
  reader: RFQContextChainReader;
}
export class OnchainRFQContextResolver implements RFQContextResolver {
  constructor(private readonly config: OnchainRFQContextConfig) {
    normalizeChainId(config.chainId);
    for (const key of ["verifyingContract", "router", "venueRegistry", "policyRegistry", "affiliateSource"] as const) normalizeAddress(config[key], key);
  }
  async resolve(request: RFQQuoteRequest & {flowType: 0 | 1}): Promise<RFQContextEvidence> {
    const c = this.config;
    const block = await c.reader.snapshot();
    if (block.chainId !== c.chainId) throw new Error("context chain mismatch");
    const flow = normalizeFlowType(request.flowType);
    const tokenIn = normalizeAddress(request.tokenIn, "tokenIn");
    const tokenOut = normalizeAddress(request.tokenOut, "tokenOut");
    if (tokenIn === tokenOut) throw new Error("identical token pair");
    const call = (to: string, signature: string, fn: string, args: unknown[] = []) => c.reader.call(to, [signature], fn, args, block.blockNumber);
    const readAddress = async (to: string, fn: string, expected: string) => {
      const value = await call(to, `function ${fn}() view returns (address)`, fn);
      if (String(value).toLowerCase() !== expected.toLowerCase()) throw new Error(`context ${fn} mismatch`);
    };
    const cfg = Array.from(await call(c.venueRegistry, `function venueOf(address) view returns (${VENUE_TUPLE})`, "venueOf", [request.venue])) as any[];
    if (Number(cfg[0]) !== 2 || String(cfg[1]).toLowerCase() !== c.verifyingContract.toLowerCase() || cfg[5] !== true) throw new Error("context venue mismatch");
    const evidence = await call(c.venueRegistry, `function contextEvidenceOf(address) view returns (${EVIDENCE_TUPLE})`, "contextEvidenceOf", [request.venue]);
    if (Number(evidence[0]) !== 3 || Number(evidence[1]) !== 1 || String(evidence[3]).toLowerCase() !== c.affiliateSource.toLowerCase() || String(evidence[5]).toLowerCase() !== c.policyRegistry.toLowerCase()) throw new Error("context activation evidence mismatch");
    for (const [address, expected] of [[c.verifyingContract, evidence[2]], [c.affiliateSource, evidence[4]], [c.policyRegistry, evidence[6]]]) {
      const code = await c.reader.getCode(address, block.blockNumber);
      if (code === "0x" || keccak256(code).toLowerCase() !== String(expected).toLowerCase()) throw new Error("context code drift");
    }
    if (await call(c.venueRegistry, "function isContextImplementationApproved(bytes32,uint16,uint16) view returns (bool)", "isContextImplementationApproved", [evidence[2], 3, 1]) !== true) throw new Error("context implementation not approved");
    for (const [subject, fn, expected] of [[c.verifyingContract, "router", c.router], [c.verifyingContract, "venueReg", c.venueRegistry], [c.verifyingContract, "policyReg", c.policyRegistry], [c.verifyingContract, "affiliateSource", c.affiliateSource], [c.router, "venueReg", c.venueRegistry], [c.router, "policyReg", c.policyRegistry]]) await readAddress(subject, fn, expected);
    if (Number(await call(c.verifyingContract, "function adapterVersion() view returns (uint16)", "adapterVersion")) !== 3 || Number(await call(c.verifyingContract, "function contextVersion() view returns (uint16)", "contextVersion")) !== 1) throw new Error("context adapter version mismatch");
    const configurationHash = venueConfigurationHash(cfg, await call(c.verifyingContract, "function contextConfigHash() view returns (bytes32)", "contextConfigHash"));
    if (configurationHash.toLowerCase() !== String(evidence[7]).toLowerCase()) throw new Error("context configuration drift");
    if (await call(c.verifyingContract, "function approvedMaker(address) view returns (bool)", "approvedMaker", [request.maker]) !== true) throw new Error("context maker not approved");
    if (request.nonce !== undefined && await call(c.verifyingContract, "function usedQuoteNonce(address,uint256) view returns (bool)", "usedQuoteNonce", [request.maker, request.nonce]) !== false) throw new Error("context quote nonce used or cancelled");
    const statuses: number[] = [];
    async function leg(asset: Address, sender: Address): Promise<AffiliateLegEvidence | undefined> {
      const status = Number(await call(c.policyRegistry, "function statusOf(address) view returns (uint8)", "statusOf", [asset]));
      statuses.push(status);
      if (status === 1) return undefined;
      if (status !== 2) throw new Error("context policy not active");
      const effectiveStatus = Number(await call(c.affiliateSource, "function effectiveStatus(address,address) view returns (uint8)", "effectiveStatus", [sender, asset]));
      const claim = await call(c.affiliateSource, "function claimOf(address,address) view returns (uint8 basis,uint8 source,address claimIssuer,uint64 verifiedAt,uint64 decayStartedAt)", "claimOf", [sender, asset]);
      return {asset, sender, affiliateSource: c.affiliateSource, basis: Number(claim[0]), source: Number(claim[1]), claimIssuer: claim[2], verifiedAt: Number(claim[3]), decayStartedAt: Number(claim[4]), effectiveStatus};
    }
    const input = await leg(tokenIn, normalizeAddress(request.taker, "taker"));
    const output = await leg(tokenOut, normalizeAddress(request.maker, "maker"));
    const commitment = affiliateEvidenceCommitment(input, output, block.timestamp);
    if (flow === 1) {
      if (statuses[0] !== 1 || statuses[1] !== 2) throw new Error("primary flow requires output security only");
      const count = Number(await call(c.policyRegistry, "function compiledBindingCountOf(address) view returns (uint256)", "compiledBindingCountOf", [tokenOut]));
      let distributor: string | undefined;
      for (let i = 0; i < count; i++) {
        const rules = await call(c.policyRegistry, "function compiledRulesOf(address,uint256) view returns (tuple(bytes32 elementId,uint8 action)[])", "compiledRulesOf", [tokenOut, i]);
        const parameters = await call(c.policyRegistry, "function compiledParametersOf(address,uint256) view returns (bytes[])", "compiledParametersOf", [tokenOut, i]);
        if (rules.length !== parameters.length) throw new Error("primary authority parameters mismatch");
        for (let j = 0; j < rules.length; j++) if (String(rules[j][0]).toLowerCase() === `0x${Buffer.from("C-01-v2").toString("hex").padEnd(64, "0")}`) {
          const bytes = String(parameters[j]);
          if (!/^0x0{24}[0-9a-fA-F]{40}$/.test(bytes) || BigInt(bytes) === 0n) throw new Error("primary authority malformed");
          const candidate = `0x${bytes.slice(-40)}`.toLowerCase();
          if (distributor && distributor !== candidate) throw new Error("primary authority conflict");
          distributor = candidate;
        }
      }
      if (distributor !== request.maker.toLowerCase()) throw new Error("primary authority mismatch");
    }
    return {contextVersion: 1, configurationHash, ...commitment};
  }
}
