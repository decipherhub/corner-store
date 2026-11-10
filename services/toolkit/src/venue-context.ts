import {AbiCoder, Interface, encodeBytes32String, keccak256, toUtf8Bytes} from "ethers";
import type {OnboardingReader, OnboardingTx, ProductionOnboardingCheck, ProductionOnboardingConfig, VenueInput} from "./production-onboarding";

export interface VenueContextInput {
  adapterVersion: 2 | 3;
  contextVersion: 1;
  adapterCodeHash: string;
  affiliateSource: string;
  affiliateSourceCodeHash: string;
  policyRegistry: string;
  policyRegistryCodeHash: string;
  configurationHash: string;
  reviewedImmutable: true;
  affiliateSourceOwner: string;
  token0?: string;
  token1?: string;
}

export const VENUE_CONTEXT_TUPLE = "tuple(uint16 adapterVersion,uint16 contextVersion,bytes32 adapterCodeHash,address affiliateSource,bytes32 affiliateSourceCodeHash,address policyRegistry,bytes32 policyRegistryCodeHash,bytes32 configurationHash)";
export const VENUE_CONFIG_TUPLE = "tuple(uint8 venueType,address adapter,address target,address operator,uint8 custody,bool active)";
export const VENUE_CONTEXT_ABI = [
  `function contextEvidenceOf(address) view returns (${VENUE_CONTEXT_TUPLE})`,
  `function setVenueContextEvidence(address venue,${VENUE_CONTEXT_TUPLE} evidence)`,
  "function setContextImplementation(bytes32 runtimeCodeHash,uint16 adapterVersion,uint16 contextVersion,bool approved)",
  "function isContextImplementationApproved(bytes32,uint16,uint16) view returns (bool)",
  `function registerVenue(address venue,${VENUE_CONFIG_TUPLE} cfg)`
];
const iface = new Interface(VENUE_CONTEXT_ABI);
const adapter = new Interface(["function setRouter(address)", "function setPool(address,bool)"]);
const enumNumber = (v: string | number, values: string[]) => typeof v === "number" ? v : values.indexOf(v);
function tuple(v: VenueInput): unknown[] {return [enumNumber(v.venueType, ["AMM", "ORDER_BOOK", "RFQ"]), v.adapter, v.target, v.operator, enumNumber(v.custody, ["NONE", "POOL", "ESCROW", "OPERATOR"]), v.active];}
function evidenceTuple(c: VenueContextInput): unknown[] {return [c.adapterVersion, c.contextVersion, c.adapterCodeHash, c.affiliateSource, c.affiliateSourceCodeHash, c.policyRegistry, c.policyRegistryCodeHash, c.configurationHash];}

export function venueContextConfigurationHash(venue: VenueInput, adapterConfigHash: string): string {
  return keccak256(AbiCoder.defaultAbiCoder().encode(["bytes32", VENUE_CONFIG_TUPLE, "bytes32"], [keccak256(toUtf8Bytes("corner-store.venue-context-config.v1")), tuple(venue), adapterConfigHash]));
}

export function buildVenueContextTransactions(config: ProductionOnboardingConfig, dependsOn: string[]): OnboardingTx[] {
  const txs: OnboardingTx[] = [];
  function add(id: string, to: string, data: string, dependencies: string[]) {
    txs.push({id, to, data, description: id, stage: "governance-owner", authority: "safe-owner", value: "0", operation: 0, dependsOn: [...dependencies]});
  }
  add("context-engine-wire", config.addresses.complianceEngine!, adapter.encodeFunctionData("setRouter", [config.addresses.executionRouter]), dependsOn);
  const wiring = new Map<string, string>();
  const pools: string[] = [];
  for (const [index, v] of config.venues.entries()) {
    const key = v.adapter.toLowerCase();
    if (!wiring.has(key)) {
      const id = `context-adapter-${index + 1}-wire`;
      add(id, v.adapter, adapter.encodeFunctionData("setRouter", [config.addresses.executionRouter]), ["context-engine-wire"]);
      wiring.set(key, id);
    }
    if (enumNumber(v.venueType, ["AMM", "ORDER_BOOK", "RFQ"]) === 0) {
      const id = `context-venue-${index + 1}-pool`;
      add(id, v.adapter, adapter.encodeFunctionData("setPool", [v.target, true]), [wiring.get(key)!]);
      pools.push(id);
    }
  }
  for (const [index, v] of config.venues.entries()) {
    const id = `context-venue-${index + 1}`;
    const c = v.context!;
    const deps = [...wiring.values(), ...pools];
    add(`${id}-register`, config.addresses.venueRegistry, iface.encodeFunctionData("registerVenue", [v.venue, tuple(v)]), deps);
    add(`${id}-review`, config.addresses.venueRegistry, iface.encodeFunctionData("setContextImplementation", [c.adapterCodeHash, c.adapterVersion, c.contextVersion, true]), [`${id}-register`]);
    add(`${id}-evidence`, config.addresses.venueRegistry, iface.encodeFunctionData("setVenueContextEvidence", [v.venue, evidenceTuple(c)]), [`${id}-register`, `${id}-review`, ...deps]);
  }
  return txs;
}

export async function verifyVenueContext(config: ProductionOnboardingConfig, venue: VenueInput, reader: Pick<OnboardingReader, "getCode" | "call">): Promise<ProductionOnboardingCheck[]> {
  const checks: ProductionOnboardingCheck[] = [];
  const check = (name: string, pass: boolean, detail: string) => checks.push({name, pass, detail, remediation: pass ? "No action required." : "Restore the reviewed immutable deployment, wiring and evidence, then rerun verification."});
  const c = venue.context!;
  async function read(to: string, signature: string, fn: string, args: unknown[], expected: unknown) {
    try {
      const actual = await reader.call(to, [signature], fn, args);
      const equal = typeof expected === "boolean" ? actual === expected : String(actual).toLowerCase() === String(expected).toLowerCase();
      check(`${to}-${fn}`, equal, `expected=${expected}; actual=${actual}`);
    } catch (error: any) {check(`${to}-${fn}`, false, `unavailable: ${error.message}`);}
  }
  for (const [subject, expected] of [[venue.adapter, c.adapterCodeHash], [c.affiliateSource, c.affiliateSourceCodeHash], [c.policyRegistry, c.policyRegistryCodeHash], [config.addresses.executionRouter!, config.codeHashes!.executionRouter]]) {
    try {const code = await reader.getCode(subject); check(`context-code-${subject}`, code !== "0x" && keccak256(code).toLowerCase() === expected.toLowerCase(), "runtime code hash binding");} catch (error: any) {check(`context-code-${subject}`, false, `unavailable: ${error.message}`);}
  }
  await read(venue.adapter, "function owner() view returns (address)", "owner", [], config.governance.safe);
  await read(c.affiliateSource, "function owner() view returns (address)", "owner", [], c.affiliateSourceOwner);
  await read(config.addresses.complianceEngine!, "function router() view returns (address)", "router", [], config.addresses.executionRouter);
  await read(venue.adapter, "function router() view returns (address)", "router", [], config.addresses.executionRouter);
  await read(venue.adapter, "function adapterVersion() view returns (uint16)", "adapterVersion", [], c.adapterVersion);
  await read(venue.adapter, "function contextVersion() view returns (uint16)", "contextVersion", [], c.contextVersion);
  for (const [fn, expected] of [["venueReg", config.addresses.venueRegistry], ["policyReg", config.addresses.tokenPolicyRegistry], ["operatorReg", config.addresses.operatorRegistry], ["engine", config.addresses.complianceEngine]]) await read(config.addresses.executionRouter!, `function ${fn}() view returns (address)`, fn!, [], expected);
  try {
    const count = Number(await reader.call(config.addresses.tokenPolicyRegistry, ["function compiledBindingCountOf(address) view returns (uint256)"], "compiledBindingCountOf", [config.addresses.token]));
    if (!Number.isInteger(count) || count < 1 || count > 8) throw new Error("invalid compiled binding count");
    const legacyId = encodeBytes32String("B-04-v1").toLowerCase();
    let directionAware = true;
    for (let i = 0; i < count; i++) {
      const rules = await reader.call(config.addresses.tokenPolicyRegistry, ["function compiledRulesOf(address,uint256) view returns (tuple(bytes32 elementId,uint8 action)[])"], "compiledRulesOf", [config.addresses.token, i]);
      if (!Array.isArray(rules) || rules.length < 1 || rules.length > 32) throw new Error("invalid compiled rules");
      for (const rule of rules) {
        const id = String(rule.elementId ?? rule[0]);
        if (!/^0x[0-9a-f]{64}$/i.test(id)) throw new Error("invalid compiled element ID");
        if (id.toLowerCase() === legacyId) directionAware = false;
      }
    }
    check("context-policy-direction", directionAware, "active compiled policy must replace B-04-v1 with opt-in B-04-v2 for context-aware venues");
  } catch (error: any) {check("context-policy-direction", false, `unavailable: ${error.message}`);}
  await read(config.addresses.venueRegistry, VENUE_CONTEXT_ABI[3], "isContextImplementationApproved", [c.adapterCodeHash, c.adapterVersion, c.contextVersion], true);
  try {
    const actual = await reader.call(config.addresses.venueRegistry, [VENUE_CONTEXT_ABI[0]], "contextEvidenceOf", [venue.venue]);
    check("context-evidence", evidenceTuple(c).every((v, i) => String(v).toLowerCase() === String(actual[i]).toLowerCase()), "registered evidence matches the activation artifact");
    const adapterHash = await reader.call(venue.adapter, ["function contextConfigHash() view returns (bytes32)"], "contextConfigHash", []);
    check("context-configuration", venueContextConfigurationHash(venue, adapterHash).toLowerCase() === c.configurationHash.toLowerCase(), "current adapter configuration commitment");
  } catch (error: any) {check("context-evidence", false, `unavailable: ${error.message}`);}
  if (enumNumber(venue.venueType, ["AMM", "ORDER_BOOK", "RFQ"]) === 2) {
    for (const [fn, expected] of [["venueReg", config.addresses.venueRegistry], ["policyReg", c.policyRegistry], ["affiliateSource", c.affiliateSource], ["makerAuthorizer", config.addresses.makerAuthorizer]]) await read(venue.adapter, `function ${fn}() view returns (address)`, fn!, [], expected);
  } else {
    await read(venue.adapter, "function registeredPool(address) view returns (bool)", "registeredPool", [venue.target], true);
    await read(venue.target, "function token0() view returns (address)", "token0", [], c.token0);
    await read(venue.target, "function token1() view returns (address)", "token1", [], c.token1);
  }
  return checks;
}
