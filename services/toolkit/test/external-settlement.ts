import assert from "node:assert/strict";
import {ZeroAddress, ZeroHash, encodeBytes32String, keccak256} from "ethers";

import {
  ComplianceReportContext,
  buildExternalSettlementActivationPlan,
  complianceReporterInterface,
  precheckExternalSettlement,
  validateExternalSettlementActivation,
  verifyExternalSettlementActivation
} from "../src";

const addresses = {
  engine: "0x1000000000000000000000000000000000000001",
  gate: "0x1000000000000000000000000000000000000002",
  venueRegistry: "0x1000000000000000000000000000000000000003",
  venueSelector: "0x1000000000000000000000000000000000000004",
  operatorRegistry: "0x1000000000000000000000000000000000000005",
  policyRegistry: "0x1000000000000000000000000000000000000006",
  affiliateSource: "0x1000000000000000000000000000000000000007",
  target: "0x1000000000000000000000000000000000000008",
  venue: "0x1000000000000000000000000000000000000009",
  operator: "0x1000000000000000000000000000000000000010"
};
const runtime = "0x6000";
const runtimeHash = keccak256(runtime);
const configurationHash = `0x${"ab".repeat(32)}`;

const activation = {
  schemaVersion: 1,
  chainId: 1,
  addresses,
  venue: {venueType: 1, custody: 0},
  runtimeCodeHashes: {
    gate: runtimeHash,
    target: runtimeHash,
    policyRegistry: runtimeHash,
    affiliateSource: runtimeHash
  },
  targetBinding: {adapterVersion: 4, contextVersion: 1, configurationHash}
};

export async function runExternalSettlementTests(): Promise<void> {
  await testAdvisoryPrecheck();
  await testActivation();
  console.log("external settlement toolkit tests ok");
}

async function testAdvisoryPrecheck(): Promise<void> {
  const context: ComplianceReportContext = {
    initiator: addresses.operator,
    buyer: addresses.operator,
    seller: addresses.target,
    tokenIn: addresses.engine,
    tokenOut: addresses.policyRegistry,
    amountIn: 100n,
    amountOut: 200n,
    venueType: 1,
    venue: addresses.venue,
    flowType: 0,
    sellerIsAffiliate: false
  };
  const decision = [false, `0x${"11".repeat(32)}`, 2n, 1000n, (1n << 256n) - 1n, addresses.policyRegistry, 2n, ZeroHash, ZeroHash, ZeroHash, 0n, `0x${"22".repeat(32)}`];
  const requirement = [addresses.policyRegistry, 0, 1, 3, 0, 0, encodeBytes32String("A-03-v1"), 2, 1, ZeroHash];
  const report = [1, 42n, 123n, true, 1, 1, decision, false, 0, [requirement]];
  const encoded = complianceReporterInterface.encodeFunctionResult("report", [report]);
  let calls = 0;
  const result = await precheckExternalSettlement({
    reader: {async call() { calls++; return encoded; }},
    reporter: addresses.engine,
    context,
    blockTag: 42,
    authenticatedSubject: addresses.operator
  });
  assert.equal(calls, 1);
  assert.equal(result.schemaVersion, 1);
  assert.equal(result.advisory, true);
  assert.equal(result.allowed, false);
  assert.equal(result.code, "QUALIFICATION_REQUIRED");
  assert.equal(result.policyId, decision[1]);
  assert.equal(result.decisionHash, decision[11]);
  assert.deepEqual(result.evidence, {blockNumber: 42n, timestamp: 123n});

  const allowedDecision = [true, ...decision.slice(1)];
  const allowedReport = [1, 43n, 124n, true, 0, 0, allowedDecision, false, 0, []];
  const allowed = await precheckExternalSettlement({
    reader: {async call() { return complianceReporterInterface.encodeFunctionResult("report", [allowedReport]); }},
    reporter: addresses.engine,
    context,
    blockTag: 43,
    authenticatedSubject: addresses.operator
  });
  assert.equal(allowed.allowed, true);
  assert.equal(allowed.code, "ALLOWED");
  assert.match(allowed.nextAction ?? "", /settlement gate/);

  await assert.rejects(
    precheckExternalSettlement({
      reader: {async call() { throw new Error("must not read"); }},
      reporter: addresses.engine,
      context,
      blockTag: 42,
      authenticatedSubject: addresses.target
    }),
    /authenticated/i
  );

  const restrictedReport = [1, 44n, 125n, false, 1, 1, decision, true, 1, [requirement]];
  const restricted = await precheckExternalSettlement({
    reader: {async call() { return complianceReporterInterface.encodeFunctionResult("report", [restrictedReport]); }},
    reporter: addresses.engine,
    context,
    blockTag: 44,
    authenticatedSubject: addresses.operator
  });
  assert.equal(restricted.code, "NOT_AVAILABLE");
  assert.doesNotMatch(restricted.message, /sanction|aml|surveillance|A-03/i);
}

async function testActivation(): Promise<void> {
  const validated = validateExternalSettlementActivation(activation);
  assert.equal(validated.addresses.target, addresses.target);
  const plan = buildExternalSettlementActivationPlan(activation);
  assert.deepEqual(plan.calls.map((call) => call.id), [
    "external-gate-engine",
    "external-gate-venue",
    "external-gate-runtime",
    "external-gate-evidence"
  ]);
  assert(plan.calls.every((call) => call.value === "0" && call.operation === 0));
  assert.equal(plan.calls[1].dependsOn[0], "external-gate-engine");
  assert.throws(() => validateExternalSettlementActivation({...activation, extra: true}), /fields are invalid/);
  assert.throws(() => validateExternalSettlementActivation({...activation, addresses: {...addresses, target: addresses.gate}}), /distinct/);
  assert.throws(() => validateExternalSettlementActivation({...activation, venue: {venueType: "1", custody: 0}}), /venueType/);
  assert.throws(() => validateExternalSettlementActivation({...activation, targetBinding: {...activation.targetBinding, adapterVersion: 3}}), /adapterVersion 4/);

  const expectedVenue = [1, addresses.target, addresses.target, addresses.operator, 0, true];
  const expectedEvidence = [4, 1, runtimeHash, addresses.affiliateSource, runtimeHash, addresses.policyRegistry, runtimeHash, configurationHash];
  const reader = {
    async getCode(): Promise<string> { return runtime; },
    async call(to: string, _abi: string[], functionName: string, _args: unknown[]): Promise<unknown> {
      const values: Record<string, unknown> = {
        router: addresses.gate,
        engine: addresses.engine,
        venueReg: addresses.venueRegistry,
        selector: addresses.venueSelector,
        operatorReg: addresses.operatorRegistry,
        policyReg: addresses.policyRegistry,
        gateEnforced: true,
        adapterVersion: 4,
        contextVersion: 1,
        contextConfigHash: configurationHash,
        venueOf: expectedVenue,
        isContextImplementationApproved: true,
        contextEvidenceOf: expectedEvidence
      };
      if (functionName === "router" && to === addresses.target) return addresses.gate;
      if (!(functionName in values)) throw new Error(`unexpected read ${functionName}`);
      return values[functionName];
    }
  };
  const checks = await verifyExternalSettlementActivation(activation, reader);
  assert(checks.length >= 17);
  assert(checks.every((check) => check.pass), checks.filter((check) => !check.pass).map((check) => `${check.name}: ${check.detail}`).join("\n"));

  const failed = await verifyExternalSettlementActivation(activation, {
    ...reader,
    async call(to, abi, functionName, args) {
      if (functionName === "gateEnforced") return false;
      return reader.call(to, abi, functionName, args);
    }
  });
  assert.equal(failed.find((check) => check.name === "target-gate-enforced")?.pass, false);
}
