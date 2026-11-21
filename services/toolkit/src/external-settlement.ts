import {
  Interface,
  decodeBytes32String,
  getAddress,
  keccak256
} from "ethers";

import {
  ComplianceReportContext,
  ComplianceReportReader,
  readComplianceReport
} from "./compliance-reporting";

export type ExternalPrecheckCode =
  | "ALLOWED"
  | "QUALIFICATION_REQUIRED"
  | "HOLDING_PERIOD"
  | "AMOUNT_OUTSIDE_POLICY"
  | "ASSET_UNAVAILABLE"
  | "NOT_AVAILABLE";

export interface ExternalSettlementPrecheckInput {
  reader: ComplianceReportReader;
  reporter: string;
  context: ComplianceReportContext;
  blockTag: number | string;
  authenticatedSubject: string;
}

export interface ExternalSettlementPrecheckResult {
  schemaVersion: 1;
  advisory: true;
  allowed: boolean;
  code: ExternalPrecheckCode;
  message: string;
  nextAction?: string;
  policyId: string;
  decisionHash: string;
  evidence: {
    blockNumber: bigint;
    timestamp: bigint;
  };
}

const EXPLANATIONS: Record<ExternalPrecheckCode, {message: string; nextAction?: string}> = {
  ALLOWED: {
    message: "The order passed this advisory policy check.",
    nextAction: "Submit through the settlement gate for a fresh final decision."
  },
  QUALIFICATION_REQUIRED: {
    message: "The investor qualification evidence is not ready for this order.",
    nextAction: "Complete or refresh the required investor qualification, then check again."
  },
  HOLDING_PERIOD: {
    message: "The asset is still within a required holding period or its acquisition evidence is not ready.",
    nextAction: "Wait until the eligible time or ask the operator to refresh acquisition evidence."
  },
  AMOUNT_OUTSIDE_POLICY: {
    message: "The order amount is outside the configured policy range.",
    nextAction: "Adjust the order amount and check again."
  },
  ASSET_UNAVAILABLE: {
    message: "The asset is not currently available for this settlement path.",
    nextAction: "Check the asset and venue status with the operator."
  },
  NOT_AVAILABLE: {
    message: "This order is not currently available for settlement.",
    nextAction: "Contact the operator or retry after the relevant evidence is updated."
  }
};

/**
 * Read-only OMS diagnostics at one explicit block. This result never authorizes
 * settlement; ExternalSettlementGate always evaluates again immediately before settlement.
 */
export async function precheckExternalSettlement(
  input: ExternalSettlementPrecheckInput
): Promise<ExternalSettlementPrecheckResult> {
  const authenticated = getAddress(input.authenticatedSubject);
  const initiator = getAddress(input.context.initiator);
  const buyer = getAddress(input.context.buyer);
  if (authenticated !== initiator || authenticated !== buyer) {
    throw new Error("External settlement precheck subject does not match the authenticated buyer");
  }

  const report = await readComplianceReport(input.reader, input.reporter, input.context, input.blockTag);
  const decisionBound = !/^0x0{64}$/i.test(report.decision.policyId)
    && !/^0x0{64}$/i.test(report.decision.decisionHash);
  const allowed = report.complete
    && report.status === "PASS"
    && report.engineStatus === "PASS"
    && report.restrictedStatus === "PASS"
    && !report.decisionRedacted
    && report.decision.allowed
    && decisionBound;
  const code = allowed ? "ALLOWED" : safePrecheckCode(report);
  const explanation = EXPLANATIONS[code];
  return {
    schemaVersion: 1,
    advisory: true,
    allowed,
    code,
    message: explanation.message,
    ...(explanation.nextAction ? {nextAction: explanation.nextAction} : {}),
    policyId: report.decision.policyId,
    decisionHash: report.decision.decisionHash,
    evidence: {blockNumber: report.blockNumber, timestamp: report.timestamp}
  };
}

function safePrecheckCode(report: Awaited<ReturnType<typeof readComplianceReport>>): ExternalPrecheckCode {
  if (report.decisionRedacted || report.restrictedStatus !== "PASS") return "NOT_AVAILABLE";
  for (const requirement of report.requirements) {
    if (requirement.status !== "FAIL") continue;
    const elementId = safeElementId(requirement.elementId);
    if (["A-03-v1", "A-04-v1", "A-04-v2", "A-13-v1"].includes(elementId)) {
      return "QUALIFICATION_REQUIRED";
    }
    if (elementId === "C-01-v1" || elementId === "C-01-v2") return "HOLDING_PERIOD";
    if (elementId === "MIN-AMOUNT-v1" || elementId === "BUIDL-MIN-v1") return "AMOUNT_OUTSIDE_POLICY";
    if (elementId === "B-01-v1") return "ASSET_UNAVAILABLE";
  }
  return "NOT_AVAILABLE";
}

function safeElementId(value: string): string {
  try {
    return decodeBytes32String(value);
  } catch {
    return "";
  }
}

export interface ExternalSettlementActivationInput {
  schemaVersion: 1;
  chainId: number;
  addresses: {
    engine: string;
    gate: string;
    venueRegistry: string;
    venueSelector: string;
    operatorRegistry: string;
    policyRegistry: string;
    affiliateSource: string;
    target: string;
    venue: string;
    operator: string;
  };
  venue: {
    venueType: 0 | 1 | 2;
    custody: 0 | 1 | 2 | 3;
  };
  runtimeCodeHashes: {
    gate: string;
    target: string;
    policyRegistry: string;
    affiliateSource: string;
  };
  targetBinding: {
    adapterVersion: 4;
    contextVersion: 1;
    configurationHash: string;
  };
}

export interface ExternalSettlementActivationCall {
  id: string;
  to: string;
  value: "0";
  operation: 0;
  data: string;
  description: string;
  dependsOn: string[];
}

export interface ExternalSettlementActivationPlan {
  schemaVersion: 1;
  chainId: number;
  calls: ExternalSettlementActivationCall[];
}

export interface ExternalSettlementActivationCheck {
  name: string;
  pass: boolean;
  detail: string;
  remediation: string;
}

export interface ExternalSettlementActivationReader {
  getCode(address: string): Promise<string>;
  call(to: string, abi: string[], functionName: string, args: unknown[]): Promise<any>;
}

const VENUE_CONFIG = "tuple(uint8 venueType,address adapter,address target,address operator,uint8 custody,bool active)";
const CONTEXT_EVIDENCE = "tuple(uint16 adapterVersion,uint16 contextVersion,bytes32 adapterCodeHash,address affiliateSource,bytes32 affiliateSourceCodeHash,address policyRegistry,bytes32 policyRegistryCodeHash,bytes32 configurationHash)";
const engineInterface = new Interface(["function setRouter(address)"]);
const registryInterface = new Interface([
  `function registerVenue(address venue,${VENUE_CONFIG} cfg)`,
  "function setContextImplementation(bytes32 runtimeCodeHash,uint16 adapterVersion,uint16 contextVersion,bool approved)",
  `function setVenueContextEvidence(address venue,${CONTEXT_EVIDENCE} evidence)`
]);

export function validateExternalSettlementActivation(input: unknown): ExternalSettlementActivationInput {
  const value = object(input, "activation");
  exactKeys(value, ["schemaVersion", "chainId", "addresses", "venue", "runtimeCodeHashes", "targetBinding"], "activation");
  if (value.schemaVersion !== 1) throw new Error("External settlement activation schemaVersion must be 1");
  if (!Number.isSafeInteger(value.chainId) || Number(value.chainId) <= 0) throw new Error("External settlement chainId is invalid");
  const addresses = object(value.addresses, "activation.addresses");
  exactKeys(addresses, ["engine", "gate", "venueRegistry", "venueSelector", "operatorRegistry", "policyRegistry", "affiliateSource", "target", "venue", "operator"], "activation.addresses");
  const normalizedAddresses = Object.fromEntries(Object.entries(addresses).map(([key, address]) => [key, getAddress(String(address))])) as ExternalSettlementActivationInput["addresses"];
  if (Object.values(normalizedAddresses).some((address) => address === "0x0000000000000000000000000000000000000000")) {
    throw new Error("External settlement activation addresses must be non-zero");
  }
  if (normalizedAddresses.target === normalizedAddresses.gate || normalizedAddresses.venue === normalizedAddresses.target) {
    throw new Error("External settlement gate, target and logical venue must be distinct");
  }
  const uniqueInfrastructure = ["engine", "gate", "venueRegistry", "venueSelector", "operatorRegistry", "policyRegistry", "affiliateSource", "target"]
    .map((key) => normalizedAddresses[key as keyof typeof normalizedAddresses].toLowerCase());
  if (new Set(uniqueInfrastructure).size !== uniqueInfrastructure.length) throw new Error("External settlement infrastructure addresses must be distinct");

  const venue = object(value.venue, "activation.venue");
  exactKeys(venue, ["venueType", "custody"], "activation.venue");
  if (!Number.isSafeInteger(venue.venueType) || ![0, 1, 2].includes(venue.venueType as number)) {
    throw new Error("External settlement venueType is invalid");
  }
  if (!Number.isSafeInteger(venue.custody) || ![0, 1, 2, 3].includes(venue.custody as number)) {
    throw new Error("External settlement custody is invalid");
  }

  const hashes = object(value.runtimeCodeHashes, "activation.runtimeCodeHashes");
  exactKeys(hashes, ["gate", "target", "policyRegistry", "affiliateSource"], "activation.runtimeCodeHashes");
  const normalizedHashes = Object.fromEntries(Object.entries(hashes).map(([key, hash]) => [key, bytes32(hash, `activation.runtimeCodeHashes.${key}`)])) as ExternalSettlementActivationInput["runtimeCodeHashes"];
  const targetBinding = object(value.targetBinding, "activation.targetBinding");
  exactKeys(targetBinding, ["adapterVersion", "contextVersion", "configurationHash"], "activation.targetBinding");
  if (targetBinding.adapterVersion !== 4 || targetBinding.contextVersion !== 1) {
    throw new Error("External settlement target requires adapterVersion 4 and contextVersion 1");
  }
  return {
    schemaVersion: 1,
    chainId: value.chainId as number,
    addresses: normalizedAddresses,
    venue: {venueType: venue.venueType as 0 | 1 | 2, custody: venue.custody as 0 | 1 | 2 | 3},
    runtimeCodeHashes: normalizedHashes,
    targetBinding: {
      adapterVersion: 4,
      contextVersion: 1,
      configurationHash: bytes32(targetBinding.configurationHash, "activation.targetBinding.configurationHash")
    }
  };
}

export function buildExternalSettlementActivationPlan(input: unknown): ExternalSettlementActivationPlan {
  const config = validateExternalSettlementActivation(input);
  const a = config.addresses;
  const venueConfig = [config.venue.venueType, a.target, a.target, a.operator, config.venue.custody, true];
  const evidence = [
    4,
    1,
    config.runtimeCodeHashes.target,
    a.affiliateSource,
    config.runtimeCodeHashes.affiliateSource,
    a.policyRegistry,
    config.runtimeCodeHashes.policyRegistry,
    config.targetBinding.configurationHash
  ];
  const calls: ExternalSettlementActivationCall[] = [
    call("external-gate-engine", a.engine, engineInterface.encodeFunctionData("setRouter", [a.gate]), "Bind the Engine commit dispatcher to the external settlement gate.", []),
    call("external-gate-venue", a.venueRegistry, registryInterface.encodeFunctionData("registerVenue", [a.venue, venueConfig]), "Register the logical venue and exact settlement target.", ["external-gate-engine"]),
    call("external-gate-runtime", a.venueRegistry, registryInterface.encodeFunctionData("setContextImplementation", [config.runtimeCodeHashes.target, 4, 1, true]), "Approve the reviewed target runtime and context version.", ["external-gate-venue"]),
    call("external-gate-evidence", a.venueRegistry, registryInterface.encodeFunctionData("setVenueContextEvidence", [a.venue, evidence]), "Install exact target and policy evidence.", ["external-gate-runtime"])
  ];
  return {schemaVersion: 1, chainId: config.chainId, calls};
}

function call(id: string, to: string, data: string, description: string, dependsOn: string[]): ExternalSettlementActivationCall {
  return {id, to, value: "0", operation: 0, data, description, dependsOn};
}

export async function verifyExternalSettlementActivation(
  input: unknown,
  reader: ExternalSettlementActivationReader
): Promise<ExternalSettlementActivationCheck[]> {
  const config = validateExternalSettlementActivation(input);
  const a = config.addresses;
  const checks: ExternalSettlementActivationCheck[] = [];
  const check = (name: string, pass: boolean, detail: string) => checks.push({
    name,
    pass,
    detail,
    remediation: pass ? "No action required." : "Restore the reviewed gate, target, dispatcher and venue evidence, then verify again."
  });
  for (const [name, address, expected] of [
    ["gate", a.gate, config.runtimeCodeHashes.gate],
    ["target", a.target, config.runtimeCodeHashes.target],
    ["policy-registry", a.policyRegistry, config.runtimeCodeHashes.policyRegistry],
    ["affiliate-source", a.affiliateSource, config.runtimeCodeHashes.affiliateSource]
  ] as const) {
    try {
      const code = await reader.getCode(address);
      check(`external-${name}-code`, code !== "0x" && keccak256(code).toLowerCase() === expected.toLowerCase(), "runtime code hash binding");
    } catch (error: any) {
      check(`external-${name}-code`, false, `unavailable: ${String(error?.message ?? error)}`);
    }
  }
  await readCheck(reader, checks, "engine-router", a.engine, ["function router() view returns (address)"], "router", [], a.gate);
  await readCheck(reader, checks, "gate-engine", a.gate, ["function engine() view returns (address)"], "engine", [], a.engine);
  await readCheck(reader, checks, "gate-venue-registry", a.gate, ["function venueReg() view returns (address)"], "venueReg", [], a.venueRegistry);
  await readCheck(reader, checks, "gate-selector", a.gate, ["function selector() view returns (address)"], "selector", [], a.venueSelector);
  await readCheck(reader, checks, "gate-operator-registry", a.gate, ["function operatorReg() view returns (address)"], "operatorReg", [], a.operatorRegistry);
  await readCheck(reader, checks, "gate-policy-registry", a.gate, ["function policyReg() view returns (address)"], "policyReg", [], a.policyRegistry);
  await readCheck(reader, checks, "target-gate", a.target, ["function router() view returns (address)"], "router", [], a.gate);
  await readCheck(reader, checks, "target-venue-registry", a.target, ["function venueReg() view returns (address)"], "venueReg", [], a.venueRegistry);
  await readCheck(reader, checks, "target-gate-enforced", a.target, ["function gateEnforced() view returns (bool)"], "gateEnforced", [], true);
  await readCheck(reader, checks, "target-adapter-version", a.target, ["function adapterVersion() view returns (uint16)"], "adapterVersion", [], 4);
  await readCheck(reader, checks, "target-context-version", a.target, ["function contextVersion() view returns (uint16)"], "contextVersion", [], 1);
  await readCheck(reader, checks, "target-configuration", a.target, ["function contextConfigHash() view returns (bytes32)"], "contextConfigHash", [], config.targetBinding.configurationHash);
  const expectedVenue = [config.venue.venueType, a.target, a.target, a.operator, config.venue.custody, true];
  await readCheck(reader, checks, "registered-venue", a.venueRegistry, [`function venueOf(address) view returns (${VENUE_CONFIG})`], "venueOf", [a.venue], expectedVenue);
  await readCheck(reader, checks, "approved-target-runtime", a.venueRegistry, ["function isContextImplementationApproved(bytes32,uint16,uint16) view returns (bool)"], "isContextImplementationApproved", [config.runtimeCodeHashes.target, 4, 1], true);
  const expectedEvidence = [4, 1, config.runtimeCodeHashes.target, a.affiliateSource, config.runtimeCodeHashes.affiliateSource, a.policyRegistry, config.runtimeCodeHashes.policyRegistry, config.targetBinding.configurationHash];
  await readCheck(reader, checks, "registered-context-evidence", a.venueRegistry, [`function contextEvidenceOf(address) view returns (${CONTEXT_EVIDENCE})`], "contextEvidenceOf", [a.venue], expectedEvidence);
  return checks;
}

async function readCheck(
  reader: ExternalSettlementActivationReader,
  checks: ExternalSettlementActivationCheck[],
  name: string,
  to: string,
  abi: string[],
  functionName: string,
  args: unknown[],
  expected: unknown
): Promise<void> {
  try {
    const actual = await reader.call(to, abi, functionName, args);
    const pass = equivalent(actual, expected);
    checks.push({
      name,
      pass,
      detail: `expected=${display(expected)}; actual=${display(actual)}`,
      remediation: pass ? "No action required." : "Restore the reviewed gate, target, dispatcher and venue evidence, then verify again."
    });
  } catch (error: any) {
    checks.push({
      name,
      pass: false,
      detail: `unavailable: ${String(error?.message ?? error)}`,
      remediation: "Restore the reviewed gate, target, dispatcher and venue evidence, then verify again."
    });
  }
}

function equivalent(actual: unknown, expected: unknown): boolean {
  if (Array.isArray(expected)) {
    if (!Array.isArray(actual) && !(actual && typeof actual === "object" && "length" in actual)) return false;
    const values = Array.from(actual as ArrayLike<unknown>);
    return values.length >= expected.length && expected.every((value, index) => equivalent(values[index], value));
  }
  if (typeof expected === "boolean") return actual === expected;
  if (typeof expected === "number") return Number(actual) === expected;
  return String(actual).toLowerCase() === String(expected).toLowerCase();
}

function display(value: unknown): string {
  if (typeof value === "bigint") return value.toString();
  if (Array.isArray(value)) return `[${value.map(display).join(",")}]`;
  return String(value);
}

function object(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(`${label} must be an object`);
  return value as Record<string, unknown>;
}

function exactKeys(value: Record<string, unknown>, keys: string[], label: string): void {
  const expected = [...keys].sort().join(",");
  const actual = Object.keys(value).sort().join(",");
  if (actual !== expected) throw new Error(`${label} fields are invalid`);
}

function bytes32(value: unknown, label: string): string {
  const result = String(value);
  if (!/^0x[0-9a-fA-F]{64}$/.test(result)) throw new Error(`${label} must be bytes32`);
  if (/^0x0{64}$/i.test(result)) throw new Error(`${label} must be non-zero`);
  return result.toLowerCase();
}
