import assert from "node:assert/strict";
import {test} from "node:test";
import {mkdtempSync, readFileSync} from "node:fs";
import {tmpdir} from "node:os";
import {join} from "node:path";
import {AbiCoder, Interface, encodeBytes32String, keccak256, toUtf8Bytes} from "ethers";
import * as toolkit from "../src";

const id = encodeBytes32String("A-04-v2");
const v1 = encodeBytes32String("A-04-v1");
const schema = keccak256(toUtf8Bytes("corner-store.element.identity-policy.v1"));
const coder = AbiCoder.defaultAbiCoder();
const parameters = (track = 1, topology = 1) => coder.encode(["uint8", "uint8"], [track, topology]);
const hash = (s: string) => keccak256(toUtf8Bytes(s));
function config(): any {
  const c = JSON.parse(readFileSync(join(__dirname, "../../examples/corner-store.production-onboarding-v6.json"), "utf8"));
  c.schemaVersion = 7;
  const oldId = c.elements[0].elementId;
  Object.assign(c.elements[0], {elementId: id, parameterSchemaId: schema, parameterSchemaVersion: 1, maxParameterBytes: 64, parametersRequired: true});
  c.recipes[0].requiredElements = c.recipes[0].requiredElements.map((value: string) => value === oldId ? id : value);
  c.recipes[0].identityPolicy = {track: "RFQ", kycTopology: "DIRECT"};
  c.policyConfig.elementParameters = [{bindingIndex: 0, elementId: id, schemaId: schema, schemaVersion: 1, parameters: parameters()}];
  return c;
}

function evidence(c: any): any {
  const compiled = toolkit.compilePlanCommitment(c);
  const {fullManifestHash, ...manifest} = c.manifest;
  const file = toolkit.buildPolicyAuditArtifact({
    schema: "corner-store-policy-audit", schemaVersion: 1, chainId: c.chainId, token: c.addresses.token,
    intendedPolicyVersion: c.lifecycle.intendedPolicyVersion, lifecycleAction: c.lifecycle.action,
    ...(c.lifecycle.action === "UPDATE" ? {previousArtifactHash: c.lifecycle.previousArtifactHash} : {}),
    source: {toolVersion: "0.1.0", sourceCommit: "a".repeat(40)}, providerEvidence: [], evidenceChainHead: hash("head"),
    deployment: {complianceEngine: c.addresses.complianceEngine, tokenPolicyRegistry: c.addresses.tokenPolicyRegistry, elementRegistry: c.addresses.elementRegistry, recipeRegistry: c.addresses.recipeRegistry, runtimeCodeHashes: Object.fromEntries(["complianceEngine", "tokenPolicyRegistry", "elementRegistry", "recipeRegistry"].map((key) => [key, c.codeHashes[key]]))},
    policy: {configHash: c.configHash, legalPackageHash: c.legalPackageHash, manifest, recipeBindings: c.recipeBindings.map((b: any) => ({...b, mode: {REQUIRED_BLOCKING: 0, PATH_OPTION: 1, FLAG_ONLY: 2}[b.mode as "REQUIRED_BLOCKING"], recipeKey: c.recipes.find((r: any) => r.recipeId === b.recipeId).recipeKey})), enforcementOverrides: c.enforcementOverrides.map((o: any) => ({...o, mode: 2})), compiledPlanHash: compiled.compiledPlanHash},
    elements: compiled.bindings.flatMap((b) => b.rules.map((r) => {
      const e = c.elements.find((e: any) => e.elementId === r.elementId);
      const p = c.policyConfig.elementParameters.find((p: any) => p.bindingIndex === b.bindingIndex && p.elementId === r.elementId)?.parameters ?? "0x";
      return {bindingIndex: b.bindingIndex, elementId: e.elementId, implementation: e.implementation, runtimeCodeHash: hash("element-code"), metadataHash: e.metadataHash ?? hash("metadata"), evidenceType: e.evidenceType === "PROVIDER_ATTESTATION" ? 3 : 2, defaultAction: e.defaultAction === "BLOCK" ? 2 : 0, versionHash: e.versionHash ?? hash("version"), parameterSchemaId: e.parameterSchemaId, parameterSchemaVersion: e.parameterSchemaVersion, parameters: p, parameterHash: keccak256(p)};
    })),
    recipes: c.recipes.map(({identityPolicy, register, ...r}: any) => ({recipeKey: r.recipeKey, recipeId: r.recipeId, version: r.version, implementation: r.implementation, runtimeCodeHash: hash("recipe-code"), requiredElements: r.requiredElements}))
  });
  c.artifactHash = file.artifactHash; c.manifest.fullManifestHash = file.onchainArtifactHash;
  const store = new toolkit.LocalPolicyAuditStore(join(mkdtempSync(join(tmpdir(), "topology-audit-")), "audit")); store.put(file);
  return {file, store};
}

function addLegacyBinding(c: any): void {
  c.recipes.push({...c.recipes[0], recipeId: 2, alias: "legacy-policy", normalizedAlias: "legacy-policy", aliasHash: toolkit.recipeAliasHash("legacy-policy"), recipeKey: toolkit.deriveRecipeKey(toolkit.recipeAliasHash("legacy-policy")), requiredElements: [c.elements[1].elementId]});
  delete c.recipes[1].identityPolicy;
  c.recipeBindings.push({...c.recipeBindings[0], recipeId: 2});
}

test("schema 7 accepts explicit RFQ and TSV DIRECT and exports exact codec", () => {
  assert.equal(toolkit.validateProductionOnboardingConfig(config()).schemaVersion, 7);
  const tsv = config(); tsv.recipes[0].identityPolicy.track = "TSV"; tsv.policyConfig.elementParameters[0].parameters = parameters(2);
  assert.equal(toolkit.validateProductionOnboardingConfig(tsv).schemaVersion, 7);
  const api = toolkit as any;
  assert.equal(api.IDENTITY_POLICY_SCHEMA_ID, schema);
  assert.equal(api.IDENTITY_POLICY_ELEMENT_ID, id);
  assert.equal(api.encodeIdentityPolicyParameters({track: "RFQ", kycTopology: "DIRECT"}), parameters());
  assert.deepEqual(api.decodeIdentityPolicyParameters(parameters(2)), {track: "TSV", kycTopology: "DIRECT"});
});

test("schema 7 rejects unset unknown MEMBER and malformed declarations", () => {
  for (const policy of [undefined, {}, {track: "RFQ"}, {track: "RFQ", kycTopology: "MEMBER"}, {track: "TSV", kycTopology: "MEMBER"}, {track: "OTHER", kycTopology: "DIRECT"}, {track: "RFQ", kycTopology: "direct"}, {track: "RFQ", kycTopology: "DIRECT", extra: true}]) {
    const c = config(); c.recipes[0].identityPolicy = policy;
    assert.throws(() => toolkit.validateProductionOnboardingConfig(c), /identityPolicy|kycTopology|track/);
  }
});

test("schema 7 requires exact committed topology and capability on REGISTER and UPDATE", () => {
  for (const action of ["REGISTER", "UPDATE"]) for (const mutate of [
    (c: any) => c.policyConfig.elementParameters = [],
    (c: any) => c.policyConfig.elementParameters[0].parameters = parameters(1, 2),
    (c: any) => c.policyConfig.elementParameters[0].parameters = parameters(1, 0),
    (c: any) => c.policyConfig.elementParameters[0].parameters = parameters(1, 3),
    (c: any) => c.policyConfig.elementParameters[0].parameters = parameters(2),
    (c: any) => c.policyConfig.elementParameters[0].parameters = "0x01",
    (c: any) => c.policyConfig.elementParameters[0].parameters = coder.encode(["uint256", "uint256"], [257, 1]),
    (c: any) => c.policyConfig.elementParameters[0].parameters = parameters() + "00",
    (c: any) => c.elements[0].parametersRequired = false,
    (c: any) => c.elements[0].parameterSchemaId = hash("other"),
    (c: any) => c.elements[0].parameterSchemaVersion = 2,
    (c: any) => c.elements[0].maxParameterBytes = 96
  ]) {
    const c = config(); if (action === "UPDATE") c.lifecycle = {action, intendedPolicyVersion: "2", previousArtifactHash: `sha256:${"ab".repeat(32)}`, reasonCode: hash("update"), expectedPostStatus: "ACTIVE"};
    mutate(c);
    assert.throws(() => toolkit.validateProductionOnboardingConfig(c), /identity|topology|parameters|capability|schema/i);
  }
});

test("schema 7 prevents legacy identity substitution and declarations on non-identity recipes", () => {
  const c = config(); c.elements[0].elementId = v1; c.recipes[0].requiredElements[0] = v1; c.policyConfig.elementParameters[0].elementId = v1;
  assert.throws(() => toolkit.validateProductionOnboardingConfig(c), /A-04-v2|identityPolicy/);
  const other = config(); other.recipes[0].requiredElements = [other.elements[1].elementId]; other.policyConfig.elementParameters = [];
  assert.throws(() => toolkit.validateProductionOnboardingConfig(other), /A-04-v2|identityPolicy/);
});

test("schema 7 rejects mixed binding bypasses and enforcement downgrades", () => {
  for (const mutate of [
    (c: any) => c.recipeBindings[0].mode = "FLAG_ONLY",
    (c: any) => Object.assign(c.recipeBindings[0], {mode: "PATH_OPTION", pathGroupId: 1}),
    (c: any) => c.elements[0].defaultAction = "FLAG_ONLY",
    (c: any) => c.enforcementOverrides.push({bindingIndex: 0, elementId: id, mode: "FORCE_FLAG_ONLY"}),
    (c: any) => c.enforcementOverrides.push({bindingIndex: 0, elementId: id, mode: "ESCALATE_TO_OPERATOR_REVIEW"})
  ]) {
    const c = config(); addLegacyBinding(c); mutate(c);
    assert.throws(() => toolkit.validateProductionOnboardingConfig(c), /identity|blocking|loosen|FLAG_ONLY|BLOCK/i);
  }
  const c = config(); addLegacyBinding(c);
  assert.equal(toolkit.validateProductionOnboardingConfig(c).recipeBindings.length, 2);
});

test("schema 7 checks every identity binding rather than only the first", () => {
  const c = config(); addLegacyBinding(c);
  c.recipes[1].requiredElements = [id]; c.recipes[1].identityPolicy = {track: "RFQ", kycTopology: "DIRECT"};
  c.policyConfig.elementParameters.push({...c.policyConfig.elementParameters[0], bindingIndex: 1, parameters: parameters(1, 2)});
  assert.throws(() => toolkit.validateProductionOnboardingConfig(c), /identity|topology|DIRECT/i);
});

test("schema 7 retains schema 6 context validation and legacy fixtures retain their meaning", () => {
  for (const mutate of [(c: any) => delete c.addresses.executionRouter, (c: any) => delete c.codeHashes.executionRouter, (c: any) => delete c.venues[0].context, (c: any) => c.venues[0].context.reviewedImmutable = false, (c: any) => c.venues[0].context.policyRegistry = c.addresses.token]) {
    const c = config(); mutate(c); assert.throws(() => toolkit.validateProductionOnboardingConfig(c), /context|executionRouter|immutable|registry/);
  }
  for (const fixture of ["corner-store.production-onboarding.json", "corner-store.production-onboarding-v6.json"]) {
    const c = JSON.parse(readFileSync(join(__dirname, "../../examples", fixture), "utf8"));
    assert.deepEqual(toolkit.validateProductionOnboardingConfig(c), c);
  }
  const c = config(); c.schemaVersion = 6;
  assert.throws(() => toolkit.validateProductionOnboardingConfig(c), /schemaVersion 7|identityPolicy/);
});

test("codec fails closed for missing unknown MEMBER and noncanonical words", () => {
  const api = toolkit as any;
  for (const p of ["0x", "0x01", parameters(1, 2), parameters(0), coder.encode(["uint256", "uint256"], [257, 1]), parameters() + "00"]) assert.throws(() => api.decodeIdentityPolicyParameters(p), /identity|topology|DIRECT|parameters/i);
  for (const p of [{track: "RFQ"}, {track: "RFQ", kycTopology: "MEMBER"}, {track: "TSV", kycTopology: "MEMBER"}]) assert.throws(() => api.encodeIdentityPolicyParameters(p), /identity|topology|DIRECT/i);
});

test("schema 7 planner binds parameters and preserves context activation transactions", () => {
  const c = config(); const audit = evidence(c);
  const plan = toolkit.createProductionOnboardingPlan(c, "2026-11-11T00:00:00.000Z", audit);
  assert.ok(plan.safeTransactions.some((t) => t.id === "context-venue-1-evidence"));
  const manifestTx = plan.transactions.find((t) => t.id === "manifest-register")!;
  assert.ok(manifestTx, plan.transactions.map((t) => t.id).join(","));
  const iface = new Interface(["function registerManifest(address,tuple(uint8,uint16,uint16,uint16,uint32,uint8,uint16,uint256,uint256,bytes32,address,address),tuple(uint16,uint16,uint8,uint16,uint8)[],tuple(uint8,bytes32,uint8)[],tuple(uint16,tuple(uint8,bytes32,bytes32,uint16,bytes)[]))"]);
  assert.equal(iface.decodeFunctionData("registerManifest", manifestTx.data)[4][1][0][4], parameters());
  assert.equal(plan.parameterMetrics!.totalParameterBytes, 64);
});

test("schema 7 artifact verification rejects detached track commitments", () => {
  const c = config(); const audit = evidence(c);
  c.recipes[0].identityPolicy.track = "TSV"; c.policyConfig.elementParameters[0].parameters = parameters(2);
  assert.throws(() => toolkit.createProductionOnboardingPlan(c, "2026-11-11T00:00:00.000Z", audit), /compiled plan mismatch/);
});

test("schema 7 verifier reads context and exact compiled parameters and fails closed on drift", async () => {
  for (const drift of [false, true]) {
    const c = config();
    const seen: string[] = [];
    const reader: any = {chainId: async () => c.chainId, getCode: async () => "0x6000", call: async (_a: string, _abi: string[], fn: string) => {
      seen.push(fn);
      if (fn === "compiledParametersOf") return [drift ? parameters(1, 2) : parameters(), "0x"];
      throw new Error("unavailable fixture read");
    }};
    const result = await toolkit.verifyProductionOnboarding(c, reader);
    assert.ok(seen.includes("contextEvidenceOf"));
    assert.equal(result.checks.find((x) => x.name === "compiled-parameters-0")?.pass, !drift);
    assert.equal(result.ready, false);
  }
});


test("schema 7 UPDATE export commits topology through the existing delayed config tuple", () => {
  const c = config();
  c.lifecycle = {action: "UPDATE", intendedPolicyVersion: "2", previousArtifactHash: `sha256:${"ab".repeat(32)}`, reasonCode: hash("update"), expectedPostStatus: "ACTIVE"};
  c.elements.forEach((e: any) => e.register = false); c.recipes.forEach((r: any) => r.register = false);
  c.recipes[0].identityPolicy.track = "TSV"; c.policyConfig.elementParameters[0].parameters = parameters(2);
  const audit = evidence(c);
  const plan = toolkit.createProductionOnboardingPlan(c, "2026-11-11T00:00:00.000Z", audit);
  assert.equal(plan.lifecycleAction, "UPDATE");
  const tx = plan.transactions.find((t) => t.id === "manifest-update-schedule")!;
  assert.ok(tx, plan.transactions.map((t) => t.id).join(","));
  const iface = new Interface(["function scheduleManifestUpdate(address,tuple(uint8,uint16,uint16,uint16,uint32,uint8,uint16,uint256,uint256,bytes32,address,address),tuple(uint16,uint16,uint8,uint16,uint8)[],tuple(uint8,bytes32,uint8)[],tuple(uint16,tuple(uint8,bytes32,bytes32,uint16,bytes)[]),bytes32)"]);
  assert.equal(iface.decodeFunctionData("scheduleManifestUpdate", tx.data)[4][1][0][4], parameters(2));
  assert.ok(plan.transactions.some((t) => t.id === "manifest-update-activate" && t.earliestExecution));
  assert.ok(!plan.transactions.some((t) => t.id.startsWith("context-")));
});
