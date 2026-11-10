import assert from "node:assert/strict";
import {test} from "node:test";
import {readFileSync} from "node:fs";
import {join} from "node:path";
import {AbiCoder, keccak256, toUtf8Bytes} from "ethers";
import {validateProductionOnboardingConfig, parseLegacyProductionOnboardingConfig, buildVenueContextTransactions, verifyVenueContext, venueContextConfigurationHash} from "../src";
const addr = (n: number) => `0x${n.toString(16).padStart(40, "0")}`;
const hash = (s: string) => keccak256(toUtf8Bytes(s));
const code = "0x60016000";
function config(): any {
  const legacy = JSON.parse(readFileSync(join(__dirname, "../../examples/corner-store.production-onboarding.json"), "utf8"));
  return {...legacy, schemaVersion: 6, addresses: {...legacy.addresses, executionRouter: addr(40), complianceEngine: addr(41)}, codeHashes: {...legacy.codeHashes, complianceEngine: hash("engine"), tokenPolicyRegistry: hash("policy"), elementRegistry: hash("element"), recipeRegistry: hash("recipe"), executionRouter: keccak256(code)}, artifactHash: `sha256:${"bb".repeat(32)}`, manifest: {...legacy.manifest, fullManifestHash: `0x${"bb".repeat(32)}`}, lifecycle: {action: "REGISTER", intendedPolicyVersion: "1"}, elements: legacy.elements.map((e: any) => ({...e, parameterSchemaId: `0x${"00".repeat(32)}`, parameterSchemaVersion: 0, maxParameterBytes: 0, parametersRequired: false, register: true})), recipes: legacy.recipes.map((r: any) => ({...r, register: true})), policyConfig: {schemaVersion: 1, elementParameters: []}, venues: [{...legacy.venues[0], adapter: legacy.addresses.rfqAdapter, context: {adapterVersion: 3, contextVersion: 1, adapterCodeHash: keccak256(code), affiliateSource: addr(42), affiliateSourceCodeHash: keccak256(code), policyRegistry: legacy.addresses.tokenPolicyRegistry, policyRegistryCodeHash: hash("policy"), configurationHash: hash("config"), reviewedImmutable: true, affiliateSourceOwner: legacy.governance.safe}}]};
}

test("v6 opt-in validates and explicit legacy parser preserves v1-v5", () => {
  const c = config();
  assert.equal(validateProductionOnboardingConfig(c).schemaVersion, 6);
  const legacy = JSON.parse(readFileSync(join(__dirname, "../../examples/corner-store.production-onboarding.json"), "utf8"));
  assert.deepEqual(parseLegacyProductionOnboardingConfig(legacy), legacy);
  assert.throws(() => parseLegacyProductionOnboardingConfig(c), /legacy/i);
});

test("v6 refuses missing evidence, unsupported versions, proxy review and mismatched registry", () => {
  for (const mutate of [(c: any) => delete c.addresses.executionRouter, (c: any) => delete c.venues[0].context, (c: any) => c.venues[0].context.adapterVersion = 2, (c: any) => c.venues[0].context.reviewedImmutable = false, (c: any) => c.venues[0].context.policyRegistry = addr(99), (c: any) => delete c.venues[0].context.affiliateSourceOwner]) {
    const c = config(); mutate(c); assert.throws(() => validateProductionOnboardingConfig(c));
  }
});

test("legacy schemas reject v6 fields rather than silently migrating", () => {
  const c = config(); c.schemaVersion = 5;
  assert.throws(() => validateProductionOnboardingConfig(c), /schemaVersion 6/);
});

test("unsigned activation transactions order wiring, pools, registration, review and evidence", () => {
  const c = config();
  c.venues.push({...c.venues[0], venue: addr(70), target: addr(70), venueType: "AMM", adapter: addr(71), context: {...c.venues[0].context, adapterVersion: 2, token0: addr(3), token1: addr(4)}});
  const txs = buildVenueContextTransactions(c, ["policy-audit-checkpoint"]);
  const evidence = txs.filter((t: any) => t.id.endsWith("-evidence"));
  assert.equal(evidence.length, 2);
  for (const tx of txs) for (const dep of tx.dependsOn) if (dep !== "policy-audit-checkpoint") assert.ok(txs.findIndex((t: any) => t.id === dep) < txs.indexOf(tx));
  assert.ok(evidence.every((t: any) => t.dependsOn.some((id: string) => id.endsWith("-review")) && t.dependsOn.some((id: string) => id.endsWith("-register"))));
  assert.ok(evidence.every((t: any) => t.operation === 0 && t.value === "0" && t.authority === "safe-owner"));
  const pool = txs.find((t: any) => t.id.includes("pool"))!;
  assert.ok(pool && evidence.every((t: any) => t.dependsOn.includes(pool.id)));
});

function reader(c: any, venue: any, patch: Record<string, unknown> = {}): any {
  const context = venue.context;
  const base: Record<string, unknown> = {router: c.addresses.executionRouter, venueReg: c.addresses.venueRegistry, policyReg: c.addresses.tokenPolicyRegistry, operatorReg: c.addresses.operatorRegistry, engine: c.addresses.complianceEngine, adapterVersion: context.adapterVersion, contextVersion: 1, contextConfigHash: hash("adapter-config"), isContextImplementationApproved: true, affiliateSource: context.affiliateSource, owner: context.affiliateSourceOwner, makerAuthorizer: c.addresses.makerAuthorizer, registeredPool: true, token0: context.token0, token1: context.token1};
  return {getCode: async () => code, call: async (_a: string, _abi: string[], fn: string) => {if (fn in patch) {if (patch[fn] instanceof Error) throw patch[fn]; return patch[fn];} if (fn === "contextEvidenceOf") return [context.adapterVersion, 1, context.adapterCodeHash, context.affiliateSource, context.affiliateSourceCodeHash, context.policyRegistry, context.policyRegistryCodeHash, context.configurationHash]; if (fn in base) return base[fn]; throw new Error(`unhandled ${fn}`);}};
}

function verifiedFixture() {
  const c = config(); c.codeHashes.tokenPolicyRegistry = keccak256(code); c.venues[0].context.policyRegistryCodeHash = keccak256(code);
  const v = c.venues[0]; v.context.configurationHash = venueContextConfigurationHash(v, hash("adapter-config"));
  return {c, v};
}

test("activation reads verify every binding and source authority", async () => {
  const {c, v} = verifiedFixture();
  const checks = await verifyVenueContext(c, v, reader(c, v));
  assert.ok(checks.every((x: any) => x.pass), JSON.stringify(checks));
});

test("activation fails closed on mismatched and unavailable reads", async () => {
  for (const patch of [{router: addr(99)}, {affiliateSource: addr(99)}, {makerAuthorizer: addr(99)}, {owner: addr(99)}, {adapterVersion: 2}, {contextConfigHash: hash("drift")}, {isContextImplementationApproved: false}, {contextEvidenceOf: new Error("unavailable")}]) {
    const {c, v} = verifiedFixture();
    const checks = await verifyVenueContext(c, v, reader(c, v, patch));
    assert.ok(checks.some((x: any) => !x.pass), JSON.stringify(patch));
  }
});

test("AMM activation requires registered target and exact canonical pool tokens", async () => {
  const {c, v} = verifiedFixture();
  Object.assign(v, {venueType: "AMM", adapter: addr(71), venue: addr(70), target: addr(70)});
  Object.assign(v.context, {adapterVersion: 2, token0: addr(3), token1: addr(4)});
  v.context.configurationHash = venueContextConfigurationHash(v, hash("adapter-config"));
  assert.ok((await verifyVenueContext(c, v, reader(c, v))).every((x: any) => x.pass));
  for (const patch of [{registeredPool: false}, {token0: addr(4), token1: addr(3)}, {token1: new Error("unavailable")}]) assert.ok((await verifyVenueContext(c, v, reader(c, v, patch))).some((x: any) => !x.pass));
});

test("deployment helper and v6 template require explicit opt-in bindings", async () => {
  const {createContextDeploymentPlan, createContextOnboardingTemplate} = await import("../src");
  const c = config();
  const plan = createContextDeploymentPlan({chainId: c.chainId, engine: c.addresses.complianceEngine, venueRegistry: c.addresses.venueRegistry, selector: addr(81), operatorRegistry: c.addresses.operatorRegistry, policyRegistry: c.addresses.tokenPolicyRegistry, makerAuthorizer: c.addresses.makerAuthorizer, affiliateSource: c.venues[0].context.affiliateSource, amm: true});
  assert.deepEqual(plan.deployments.map((x: any) => x.contract), ["ExecutionRouterV2", "RFQAdapterV3", "UniswapV3Adapter"]);
  assert.equal(plan.broadcast, false);
  assert.equal(plan.deployments[1].constructorArguments.length, 4);
  assert.equal(plan.quoteDomainVersion, "3");
  const v5 = structuredClone(c); v5.schemaVersion = 5; delete v5.addresses.executionRouter; delete v5.codeHashes.executionRouter; v5.venues.forEach((v: any) => delete v.context);
  const result = createContextOnboardingTemplate(v5, {executionRouter: c.addresses.executionRouter, executionRouterCodeHash: c.codeHashes.executionRouter, venues: c.venues});
  assert.equal(result.schemaVersion, 6);
  assert.equal(v5.schemaVersion, 5);
  assert.equal(v5.venues[0].context, undefined);
  assert.throws(() => createContextOnboardingTemplate({...v5, schemaVersion: 3}, {executionRouter: addr(40), executionRouterCodeHash: hash("code"), venues: c.venues}));
});

test("full v6 onboarding plan embeds activation dependencies in the unsigned Safe lane", async () => {
  const {createProductionOnboardingPlan, buildPolicyAuditArtifact, LocalPolicyAuditStore, compilePlanCommitment} = await import("../src");
  const {mkdtempSync} = await import("node:fs");
  const {tmpdir} = await import("node:os");
  const c = config();
  c.enforcementOverrides = [];
  const compiled = compilePlanCommitment(c);
  const {fullManifestHash, ...manifest} = c.manifest;
  const artifact: any = {
    schema: "corner-store-policy-audit", schemaVersion: 1, chainId: c.chainId, token: c.addresses.token,
    intendedPolicyVersion: "1", lifecycleAction: "REGISTER",
    source: {toolVersion: "0.1.0", sourceCommit: "a".repeat(40)}, providerEvidence: [], evidenceChainHead: hash("head"),
    deployment: {complianceEngine: c.addresses.complianceEngine, tokenPolicyRegistry: c.addresses.tokenPolicyRegistry, elementRegistry: c.addresses.elementRegistry, recipeRegistry: c.addresses.recipeRegistry, runtimeCodeHashes: Object.fromEntries(["complianceEngine", "tokenPolicyRegistry", "elementRegistry", "recipeRegistry"].map((key) => [key, c.codeHashes[key]]))},
    policy: {configHash: c.configHash, legalPackageHash: c.legalPackageHash, manifest, recipeBindings: c.recipeBindings.map((b: any) => ({...b, mode: typeof b.mode === "number" ? b.mode : {REQUIRED_BLOCKING: 0, PATH_OPTION: 1, FLAG_ONLY: 2}[b.mode as "REQUIRED_BLOCKING"], recipeKey: c.recipes.find((r: any) => r.recipeId === b.recipeId).recipeKey})), enforcementOverrides: [], compiledPlanHash: compiled.compiledPlanHash},
    elements: compiled.bindings.flatMap((b) => b.rules.map((r) => {const e = c.elements.find((e: any) => e.elementId.toLowerCase() === r.elementId.toLowerCase()); return {bindingIndex: b.bindingIndex, elementId: e.elementId, implementation: e.implementation, runtimeCodeHash: hash("element-code"), metadataHash: e.metadataHash ?? hash("metadata"), evidenceType: typeof e.evidenceType === "number" ? e.evidenceType : {PROVIDER_ATTESTATION: 3, ONCHAIN_STATE: 2}[e.evidenceType as "ONCHAIN_STATE"], defaultAction: e.defaultAction === "BLOCK" ? 2 : 0, versionHash: e.versionHash ?? hash("version"), parameterSchemaId: e.parameterSchemaId, parameterSchemaVersion: e.parameterSchemaVersion, parameters: "0x", parameterHash: keccak256("0x")};})),
    recipes: c.recipes.map((r: any) => ({recipeKey: r.recipeKey, recipeId: r.recipeId, version: r.version, implementation: r.implementation, runtimeCodeHash: hash("recipe-code"), requiredElements: r.requiredElements}))
  };
  const file = buildPolicyAuditArtifact(artifact);
  c.artifactHash = file.artifactHash; c.manifest.fullManifestHash = file.onchainArtifactHash;
  const store = new LocalPolicyAuditStore(join(mkdtempSync(join(tmpdir(), "onboarding-v6-")), "audit")); store.put(file);
  const plan = createProductionOnboardingPlan(c, "2026-11-11T00:00:00.000Z", {file, store});
  assert.ok(plan.safeTransactions.some((t) => t.id === "context-venue-1-evidence"));
  assert.ok(plan.operatorTransactions.find((t) => t.id === "maker-1")!.dependsOn.includes("context-venue-1-evidence"));
});
