import {existsSync, mkdtempSync, readFileSync, writeFileSync} from "fs";

import {keccak256} from "ethers";
import {
  createProductionOnboardingPlan,
  deriveRecipeKey,
  ENFORCEMENT_ACTION,
  MAX_ENFORCEMENT_OVERRIDES,
  normalizeRecipeAlias,
  productionOnboardingInterfaces,
  recipeAliasHash,
  validateProductionOnboardingConfig,
  verifyProductionOnboarding
} from "../src/production-onboarding";
import {tmpdir} from "os";
import {join} from "path";
import {defaultConfig, enabledEngineSpec, loadConfig, simulateConfig, validateConfig, writeDefaultConfig} from "../src/config";
import {getTemplate, validateTemplateInputs} from "../src/templates";
import {preflightConfig} from "../src/preflight";
import {createCheckpoint, loadCheckpoint, writeCheckpoint} from "../src/checkpoint";
import {createGovernanceProposal} from "../src/proposal";
import {createDeploymentPlan} from "../src/deploy";
import {
  PRODUCTION_DEPLOY_SCRIPT,
  createProductionDeploymentPlan,
  loadProductionConfig,
  productionConfigHash,
  validateProductionConfig,
  validateProductionDeploymentEvidence
} from "../src/production";
import {toSafeTransactionDraft} from "../src/multisig";
import {defaultIntegrationManifest, validateIntegrationManifest} from "../src/integration";
import {scaffoldRFQIntegration} from "../src/scaffold";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function assertThrows(fn: () => void, message: string): void {
  try {
    fn();
    throw new Error(`${message}: accepted`);
  } catch (err: any) {
    if (String(err.message).includes(": accepted")) throw err;
  }
}

const dir = mkdtempSync(join(tmpdir(), "corner-store-toolkit-"));
const path = join(dir, "corner-store.config.json");
writeDefaultConfig(path);
const config = loadConfig(path);
if (config.asset.profile !== "buidl-like" || !config.venues.rfq) throw new Error("default config regression");
if (JSON.parse(readFileSync(path, "utf8")).schemaVersion !== 1) throw new Error("version missing");
validateConfig({...defaultConfig(), asset: {profile: "reg-d"}});
const simulation = simulateConfig(config, "buidl-like");
if (simulation.profile !== "buidl-like" || simulation.venues.join(",") !== "amm,rfq") throw new Error("simulation regression");
try {
  simulateConfig(config, "reg-d");
  throw new Error("profile mismatch accepted");
} catch (err: any) {
  if (!err.message.includes("conflicts")) throw err;
}
const element = getTemplate("element.attestation");
validateTemplateInputs(element, {claimTopic: 1, trustedIssuer: "issuer", expiryPolicy: "strict"});
try {
  validateTemplateInputs(element, {claimTopic: 1});
  throw new Error("incomplete template accepted");
} catch (err: any) {
  if (!err.message.includes("trustedIssuer")) throw err;
}
const artifact = {
  assetProfile: "buidl-like", rwaToken: "0x1111111111111111111111111111111111111111",
  router: "0x2222222222222222222222222222222222222222",
  ammAdapter: "0x3333333333333333333333333333333333333333", pool: "0x4444444444444444444444444444444444444444",
  rfqAdapter: "0x5555555555555555555555555555555555555555",
  makerAuthorizer: "0x7777777777777777777777777777777777777777",
  rfqVenue: "0x6666666666666666666666666666666666666666"
};
if (!preflightConfig(config, artifact).ready) throw new Error("preflight should be ready");
if (preflightConfig({...config, asset: {profile: "reg-d"}}, artifact).ready) throw new Error("profile mismatch passed preflight");
if (enabledEngineSpec(config) !== "amm,rfq") throw new Error("engine selection regression");
const checkpointPath = join(dir, "deployment.json");
writeCheckpoint(checkpointPath, createCheckpoint(config, artifact, "anvil-demo-1"));
if (loadCheckpoint(checkpointPath).state !== "preflighted") throw new Error("checkpoint regression");
try { writeCheckpoint(checkpointPath, createCheckpoint(config, artifact, "anvil-demo-1")); throw new Error("checkpoint overwritten"); } catch (err: any) {
  if (!String(err.code ?? err.message).includes("EEXIST")) throw err;
}
try {
  validateConfig({...defaultConfig(), venues: {amm: false, rfq: false, orderBook: false}});
  throw new Error("empty venues accepted");
} catch (err: any) {
  if (!err.message.includes("at least one venue")) throw err;
}
try {
  validateConfig({...defaultConfig(), governance: {multisig: "", requiredApprovals: 0}});
  throw new Error("invalid governance policy accepted");
} catch (err: any) {
  if (!err.message.includes("governance")) throw err;
}
const proposal = createGovernanceProposal({target: artifact.router as string, value: "0", calldata: "0x", reason: "operator-approved policy change", expectedArtifactHash: "sha256:test", requiredApprovals: 2});
if (proposal.state !== "draft" || !proposal.proposalId.startsWith("proposal-")) throw new Error("proposal regression");
const dryRun = createDeploymentPlan(config, "http://127.0.0.1:8545");
if (dryRun.broadcast || !dryRun.command.includes("ASSET_PROFILE=buidl-like") || dryRun.command.includes("--broadcast")) throw new Error("deploy dry-run regression");
if (!createDeploymentPlan(config, "http://127.0.0.1:8545", true).command.includes("--broadcast")) throw new Error("deploy broadcast flag regression");
const safeDraft = toSafeTransactionDraft(proposal, 42161);
if (safeDraft.origin !== "corner-store-toolkit" || safeDraft.operation !== 0 || safeDraft.chainId !== 42161) throw new Error("Safe draft regression");

const productionConfig = validateProductionConfig({
  schemaVersion: 1,
  network: {name: "mainnet", chainId: 1, rpcUrl: "https://rpc.example", approvedRpcHosts: ["rpc.example"]},
  release: {sourceCommit: "a".repeat(40), contractsHash: `sha256:${"b".repeat(64)}`},
  deploymentId: "mainnet-core-1",
  deployer: "0x4444444444444444444444444444444444444444",
  operator: "0x5555555555555555555555555555555555555555",
  venues: {amm: true, rfq: false},
  safe: {
    address: "0x8888888888888888888888888888888888888888",
    expectedOwners: [
      "0x1111111111111111111111111111111111111111",
      "0x2222222222222222222222222222222222222222",
      "0x3333333333333333333333333333333333333333"
    ],
    threshold: 2,
    expectedSingleton: "0x7777777777777777777777777777777777777777",
    proxyCodeHash: `0x${"aa".repeat(32)}`
  },
  deployment: {
    artifact: "deployments/production-core.json",
    evidence: "deployments/production-evidence.json"
  },
  erc3643: {token: "0x9999999999999999999999999999999999999999"}
});
const productionPlan = createProductionDeploymentPlan(productionConfig);
if (
  productionPlan.script !== PRODUCTION_DEPLOY_SCRIPT ||
  !productionPlan.command.startsWith("CORNER_STORE_DEPLOYER=0x4444444444444444444444444444444444444444") ||
  !productionPlan.command.includes("CORNER_STORE_GOVERNANCE=0x8888888888888888888888888888888888888888") ||
  !productionPlan.command.includes("CORNER_STORE_OPERATOR=0x5555555555555555555555555555555555555555") ||
  !productionPlan.command.includes("CORNER_STORE_ENABLE_AMM=1") ||
  !productionPlan.command.includes("CORNER_STORE_ENABLE_RFQ=0") ||
  !productionPlan.command.includes("CORNER_STORE_DEPLOYMENT_ID=mainnet-core-1") ||
  !productionPlan.command.includes("CORNER_STORE_ARTIFACT=deployments/production-core.json") ||
  !productionPlan.command.includes("script/DeployProductionCore.s.sol:DeployProductionCore") ||
  !productionPlan.command.includes("--sender 0x4444444444444444444444444444444444444444") ||
  productionPlan.command.includes("--ledger") ||
  productionPlan.command.includes("--account")
) {
  throw new Error("production signer-free plan regression");
}
const productionPath = join(dir, "corner-store.production.json");
writeFileSync(productionPath, `${JSON.stringify(productionConfig, null, 2)}\n`);
if (loadProductionConfig(productionPath).deploymentId !== "mainnet-core-1") throw new Error("production config file helper regression");
validateProductionDeploymentEvidence({
  schemaVersion: 1,
  configHash: productionConfigHash(productionConfig),
  sourceCommit: "a".repeat(40),
  contractsHash: `sha256:${"b".repeat(64)}`,
  dryRun: {passed: true, chainId: 1},
  forkSimulation: {passed: true, chainId: 1, blockNumber: 20_000_000},
  reviewedAt: "2026-07-31T00:00:00.000Z"
}, productionConfig);
if (!createProductionDeploymentPlan(productionConfig, {kind: "ledger"}, true).command.includes("--ledger")) {
  throw new Error("production ledger deploy plan regression");
}
if (!createProductionDeploymentPlan(productionConfig, {kind: "account", name: "prod-safe-deployer"}, true).command.includes("--account prod-safe-deployer")) {
  throw new Error("production account deploy plan regression");
}
try {
  validateProductionConfig({...productionConfig, safe: {...productionConfig.safe, threshold: 4}});
  throw new Error("invalid Safe threshold accepted");
} catch (err: any) {
  if (!err.message.includes("safe.threshold")) throw err;
}
try {
  validateProductionConfig({...productionConfig, venues: {amm: false, rfq: false}});
  throw new Error("empty production venues accepted");
} catch (err: any) {
  if (!err.message.includes("at least one production venue")) throw err;
}
try {
  validateProductionConfig({...productionConfig, deploymentId: "bad/id"});
  throw new Error("unsafe production deploymentId accepted");
} catch (err: any) {
  if (!err.message.includes("deploymentId")) throw err;
}
try {
  validateProductionConfig({...productionConfig, deployment: {artifact: "../production-core.json"}});
  throw new Error("unsafe production artifact path accepted");
} catch (err: any) {
  if (!err.message.includes("deployment.artifact")) throw err;
}
try {
  validateProductionConfig({...productionConfig, deployment: {artifact: "deployments/releases/production-core.json"}});
  throw new Error("unsupported nested production artifact path accepted");
} catch (err: any) {
  if (!err.message.includes("deployment.artifact")) throw err;
}
try {
  validateProductionConfig({...productionConfig, signerSecret: "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d"});
  throw new Error("production signer secret accepted");
} catch (err: any) {
  if (!err.message.includes("signer secrets")) throw err;
}

const ZERO_ADDR = "0x0000000000000000000000000000000000000000";

const onboardingConfig = validateProductionOnboardingConfig({
  schemaVersion: 1,
  chainId: 1,
  configHash: productionConfigHash(productionConfig),
  artifactHash: `sha256:${"c".repeat(64)}`,
  legalPackageHash: `sha256:${"d".repeat(64)}`,
  governance: {safe: "0x8888888888888888888888888888888888888888", requiredApprovals: 2, operatorExecutor: "0x5555555555555555555555555555555555555555"},
  addresses: {
    token: "0x1000000000000000000000000000000000000001",
    identityRegistry: "0x1000000000000000000000000000000000000002",
    compliance: "0x1000000000000000000000000000000000000003",
    topicsRegistry: "0x1000000000000000000000000000000000000004",
    issuersRegistry: "0x1000000000000000000000000000000000000005",
    identityStorage: "0x1000000000000000000000000000000000000006",
    elementRegistry: "0x1000000000000000000000000000000000000007",
    recipeRegistry: "0x1000000000000000000000000000000000000008",
    tokenPolicyRegistry: "0x1000000000000000000000000000000000000009",
    operatorRegistry: "0x1000000000000000000000000000000000000013",
    venueRegistry: "0x1000000000000000000000000000000000000010",
    rfqAdapter: "0x1000000000000000000000000000000000000011",
    makerAuthorizer: "0x1000000000000000000000000000000000000012"
  },
  codeHashes: {token: keccak256("0x6000")},
  elements: [{elementId: `0x${"01".repeat(32)}`, implementation: "0x2000000000000000000000000000000000000001"}],
  recipes: [{recipeId: 1, version: 2, implementation: "0x2000000000000000000000000000000000000002"}],
  manifest: {
    issuanceRecipeId: 1,
    issuanceRecipeVersion: 2,
    fundRecipeId: 0,
    enabledResalePaths: 1,
    supportedEngines: 5,
    stateScopeId: 7,
    factsPacked: "1",
    coverageScope: "3",
    fullManifestHash: `0x${"02".repeat(32)}`
  },
  recipeBindings: [{recipeId: 1, recipeVersion: 2, mode: "REQUIRED_BLOCKING", pathGroupId: 0, priority: 100}],
  venues: [{
    venue: "0x3000000000000000000000000000000000000001",
    venueType: "RFQ",
    adapter: "0x1000000000000000000000000000000000000011",
    target: "0x3000000000000000000000000000000000000002",
    operator: "0x5555555555555555555555555555555555555555",
    custody: "NONE",
    active: true
  }],
  rfq: {
    makers: [{maker: "0x4000000000000000000000000000000000000001", approved: true}],
    signerDelegates: [{maker: "0x4000000000000000000000000000000000000001", delegate: "0x4000000000000000000000000000000000000002", reasonHash: `0x${"03".repeat(32)}`}]
  },
  inventory: [{
    token: "0x1000000000000000000000000000000000000001",
    holder: "0x4000000000000000000000000000000000000001",
    spender: "0x1000000000000000000000000000000000000011",
    minBalance: "100",
    minAllowance: "50",
    riskEvidenceHash: `0x${"04".repeat(32)}`
  }]
});
const onboardingPlan = createProductionOnboardingPlan(onboardingConfig, "2026-08-23T00:00:00.000Z");
const onboardingPlanRepeat = createProductionOnboardingPlan(onboardingConfig, "2026-08-24T00:00:00.000Z");
assert(onboardingPlan.onboardingHash === onboardingPlanRepeat.onboardingHash, "onboarding hash is deterministic across render time");
assert(onboardingPlan.transactions.map((t) => t.id).join(",") === "element-1-359577154d98,recipe-1-v2,manifest-register,manifest-approve,venue-1,maker-1,signer-1-schedule,signer-1-execute,inventory-1-verify", "onboarding stage order is deterministic");
assert(onboardingPlan.safeTransactions.every((tx) => tx.authority === "safe-owner" && tx.origin === "corner-store-toolkit" && tx.operation === 0 && tx.value === "0"), "Safe onboarding drafts are safe-owner unsigned calls");
assert(onboardingPlan.operatorTransactions.every((tx) => tx.authority === "operator" && tx.origin === "corner-store-toolkit" && tx.executor === onboardingConfig.governance.operatorExecutor && tx.operation === 0 && tx.value === "0"), "operator onboarding drafts are explicit-executor unsigned calls");
assert(!onboardingPlan.safeTransactions.some((tx) => tx.id === "manifest-approve" || tx.id.startsWith("maker-")), "operator authority steps are excluded from Safe drafts");
assert(onboardingPlan.operatorTransactions.map((tx) => tx.id).join(",") === "manifest-approve,maker-1", "operator transactions exclude owner-only delayed signer execution");
assert(onboardingPlan.safeTransactions.every((tx) => tx.chainId === 1 && tx.safe === onboardingConfig.governance.safe && tx.requiredApprovals === 2 && tx.proposalId.startsWith("onboarding-") && tx.proposalId.length === 75 && tx.expectedArtifactHash === onboardingConfig.artifactHash && tx.legalPackageHash === onboardingConfig.legalPackageHash && tx.onboardingHash === onboardingPlan.onboardingHash), "Safe onboarding drafts carry governance and identity metadata");
assert(new Set(onboardingPlan.safeTransactions.map((tx) => tx.proposalId)).size === onboardingPlan.safeTransactions.length, "Safe proposal IDs are collision-safe per transaction");
assert(new Set(onboardingPlan.operatorTransactions.map((tx) => tx.proposalId)).size === onboardingPlan.operatorTransactions.length, "operator proposal IDs are collision-safe per transaction");
assert(onboardingPlan.safeTransactions[0].proposalId === onboardingPlanRepeat.safeTransactions[0].proposalId, "Safe proposal IDs are independent of generatedAt");
assert(onboardingPlan.operatorTransactions[0].proposalId === onboardingPlanRepeat.operatorTransactions[0].proposalId, "operator proposal IDs are independent of generatedAt");
assert(onboardingPlan.transactions.some((tx) => tx.id === "signer-1-execute" && tx.dependsOn.includes("signer-1-schedule") && tx.earliestExecution), "signer owner execution is delay-gated");
assert(onboardingPlan.inventoryRequirements.length === 1 && !onboardingPlan.transactions.some((tx) => /approve\(|transfer/i.test(tx.description + tx.data)), "inventory activation is read-only");
const ifaces = productionOnboardingInterfaces();
const decodedElement = ifaces.ELEMENT_REGISTRY.decodeFunctionData("registerElement(bytes32,address)", onboardingPlan.transactions[0].data);
assert(decodedElement[0] === onboardingConfig.elements[0].elementId && decodedElement[1] === onboardingConfig.elements[0].implementation, "element calldata decodes");
const decodedRecipe = ifaces.RECIPE_REGISTRY.decodeFunctionData("registerRecipe(uint16,uint16,address)", onboardingPlan.transactions[1].data);
assert(Number(decodedRecipe[0]) === 1 && Number(decodedRecipe[1]) === 2, "recipe calldata decodes");
const decodedManifest = ifaces.POLICY_REGISTRY.decodeFunctionData("registerManifest(address,(uint8,uint16,uint16,uint16,uint32,uint8,uint16,uint256,uint256,bytes32,address,address),(uint16,uint16,uint8,uint16,uint8)[])", onboardingPlan.transactions[2].data);
assert(decodedManifest[0] === onboardingConfig.addresses.token && decodedManifest[2].length === 1, "manifest calldata decodes with binding");
const decodedVenue = ifaces.VENUE_REGISTRY.decodeFunctionData("registerVenue", onboardingPlan.transactions[4].data);
assert(decodedVenue[0] === onboardingConfig.venues![0].venue && Number(decodedVenue[1][0]) === 2, "venue calldata decodes");
assertThrows(() => validateProductionOnboardingConfig({...onboardingConfig, elements: [...onboardingConfig.elements, onboardingConfig.elements[0]]}), "duplicate element rejected");
assertThrows(() => validateProductionOnboardingConfig({...onboardingConfig, legalPackageHash: "mailto:alice@example.com"}), "PII/invalid legal evidence rejected");
assertThrows(() => validateProductionOnboardingConfig({...onboardingConfig, rfq: {...onboardingConfig.rfq, signerPrivateKey: "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d"}}), "secret fields rejected");
assertThrows(() => validateProductionOnboardingConfig({...onboardingConfig, addresses: {...onboardingConfig.addresses, compliance: onboardingConfig.addresses.identityRegistry}}), "duplicate addresses rejected");

assertThrows(() => validateProductionOnboardingConfig({...onboardingConfig, venues: undefined as any}), "venues are required");
assertThrows(() => validateProductionOnboardingConfig({...onboardingConfig, venues: []}), "empty venues rejected");
assertThrows(() => validateProductionOnboardingConfig({...onboardingConfig, venues: onboardingConfig.venues.map((venue) => ({...venue, active: false}))}), "at least one active venue required");
assertThrows(() => validateProductionOnboardingConfig({...onboardingConfig, inventory: undefined as any}), "inventory is required");
assertThrows(() => validateProductionOnboardingConfig({...onboardingConfig, inventory: []}), "empty inventory rejected");
assertThrows(() => validateProductionOnboardingConfig({...onboardingConfig, rfq: undefined as any}), "active RFQ requires rfq config");
assertThrows(() => validateProductionOnboardingConfig({...onboardingConfig, rfq: {...onboardingConfig.rfq, makers: [{maker: "0x4000000000000000000000000000000000000001", approved: false}]}}), "active RFQ requires approved maker");
assertThrows(() => validateProductionOnboardingConfig({...onboardingConfig, rfq: {...onboardingConfig.rfq, signerDelegates: []}}), "active RFQ requires signer delegate");
assertThrows(() => validateProductionOnboardingConfig({...onboardingConfig, rfq: {...onboardingConfig.rfq, signerDelegates: [{maker: "0x4000000000000000000000000000000000000003", delegate: "0x4000000000000000000000000000000000000004", reasonHash: `0x${"05".repeat(32)}`}]}}), "signer delegate maker must be approved");
assertThrows(() => validateProductionOnboardingConfig({...onboardingConfig, inventory: [{...onboardingConfig.inventory[0], holder: "0x4000000000000000000000000000000000000003"}]}), "active RFQ requires inventory for approved maker");
assertThrows(() => validateProductionOnboardingConfig({...onboardingConfig, venues: onboardingConfig.venues.map((venue) => ({...venue, venueType: "AMM"})), rfq: onboardingConfig.rfq}), "rfq config rejected without RFQ venue");
assertThrows(() => validateProductionOnboardingConfig({...onboardingConfig, governance: {...onboardingConfig.governance, requiredApprovals: 0}}), "invalid governance requiredApprovals rejected");
assertThrows(() => validateProductionOnboardingConfig({...onboardingConfig, governance: {...onboardingConfig.governance, operatorExecutor: "0x0000000000000000000000000000000000000000"}}), "invalid governance operatorExecutor rejected");
assertThrows(() => validateProductionOnboardingConfig({...onboardingConfig, governance: {...onboardingConfig.governance, extra: true} as any}), "unknown governance field rejected");
assertThrows(() => validateProductionOnboardingConfig({...onboardingConfig, codeHashes: {...onboardingConfig.codeHashes, unknownAddress: `0x${"06".repeat(32)}`}}), "unsupported codeHashes key rejected");

// --- production onboarding v2: canonical recipe key + compiled enforcement ---
const normalizedAlias = normalizeRecipeAlias(" Reg_D.506c Issuance ");
assert(normalizedAlias === "reg-d-506c-issuance", "recipe alias normalization");
const aliasHash = recipeAliasHash(normalizedAlias);
const recipeKey = deriveRecipeKey(aliasHash);
assert(recipeKey === deriveRecipeKey(aliasHash), "recipe key derivation is deterministic");
assertThrows(() => normalizeRecipeAlias("규제"), "non-ASCII alias rejected");
assertThrows(() => normalizeRecipeAlias(".".repeat(80)), "empty/too-long alias rejected");
const onboardingConfigV2 = validateProductionOnboardingConfig({
  ...onboardingConfig,
  schemaVersion: 2,
  elements: [
    {...onboardingConfig.elements[0], defaultAction: "BLOCK", versionHash: `0x${"05".repeat(32)}`},
    {elementId: `0x${"06".repeat(32)}`, implementation: "0x2000000000000000000000000000000000000003", defaultAction: "FLAG_ONLY"}
  ],
  recipes: [{
    ...onboardingConfig.recipes[0],
    alias: " Reg_D.506c Issuance ",
    normalizedAlias,
    aliasHash,
    recipeKey,
    requiredElements: [onboardingConfig.elements[0].elementId, `0x${"06".repeat(32)}`]
  }],
  enforcementOverrides: [{bindingIndex: 0, elementId: `0x${"06".repeat(32)}`, mode: "ESCALATE_TO_BLOCK"}]
});
const onboardingPlanV2 = createProductionOnboardingPlan(onboardingConfigV2, "2026-08-23T00:00:00.000Z");
assert(onboardingPlanV2.schemaVersion === 2, "v2 onboarding plan carries schemaVersion");
assert(onboardingPlanV2.recipeKeyCommitments?.[0].normalizedAlias === normalizedAlias && onboardingPlanV2.recipeKeyCommitments[0].recipeKey === recipeKey, "v2 plan records canonical recipe key commitment");
assert(onboardingPlanV2.compiledPlan?.bindings[0].rules.map((rule) => rule.action).join(",") === "BLOCK,BLOCK", "v2 plan records compiled strengthened rules");
assert(!JSON.stringify(onboardingPlanV2).includes("Reg_D.506c Issuance"), "v2 immutable plan stores normalized alias only");
const decodedElementV2 = ifaces.ELEMENT_REGISTRY.decodeFunctionData("registerElement(bytes32,address,uint8)", onboardingPlanV2.transactions[0].data);
assert(Number(decodedElementV2[2]) === ENFORCEMENT_ACTION.BLOCK, "v2 element calldata includes default action");
const decodedRecipeV2 = ifaces.RECIPE_REGISTRY.decodeFunctionData("registerRecipe(bytes32,bytes32,uint16,uint16,address)", onboardingPlanV2.transactions[2].data);
assert(decodedRecipeV2[0] === aliasHash && decodedRecipeV2[1] === recipeKey, "v2 recipe calldata includes canonical alias/key");
const decodedManifestV2 = ifaces.POLICY_REGISTRY.decodeFunctionData("registerManifest(address,(uint8,uint16,uint16,uint16,uint32,uint8,uint16,uint256,uint256,bytes32,address,address),(uint16,uint16,uint8,uint16,uint8)[],(uint8,bytes32,uint8)[])", onboardingPlanV2.transactions[3].data);
assert(decodedManifestV2[3].length === 1 && Number(decodedManifestV2[3][0][2]) === 2, "v2 manifest calldata includes bounded override");
assert(createProductionOnboardingPlan(onboardingConfig).schemaVersion === 1, "legacy plan version matches legacy calldata mode");
assertThrows(() => validateProductionOnboardingConfig({...onboardingConfig, elements: [{...onboardingConfig.elements[0], defaultAction: "BLOCK"}]} as any), "schemaVersion 1 rejects v2 element fields");
assertThrows(() => validateProductionOnboardingConfig({...onboardingConfig, recipes: [{...onboardingConfig.recipes[0], alias: "reg-d-506c-issuance"}]} as any), "schemaVersion 1 rejects v2 recipe fields");
assertThrows(() => validateProductionOnboardingConfig({...onboardingConfig, enforcementOverrides: []} as any), "schemaVersion 1 rejects v2 overrides");
assertThrows(() => validateProductionOnboardingConfig({...onboardingConfigV2, recipes: [{...onboardingConfigV2.recipes[0], alias: "reg_d 506c.issuance"}, {...onboardingConfigV2.recipes[0], recipeId: 2, implementation: "0x2000000000000000000000000000000000000004", alias: "REG-D-506C-ISSUANCE"}]}), "canonical alias collision rejected");
assertThrows(() => validateProductionOnboardingConfig({...onboardingConfigV2, recipes: [{...onboardingConfigV2.recipes[0], aliasHash: `0x${"09".repeat(32)}`}] as any}), "aliasHash mismatch rejected");
assertThrows(() => validateProductionOnboardingConfig({...onboardingConfigV2, enforcementOverrides: [{bindingIndex: 0, elementId: onboardingConfig.elements[0].elementId, mode: "FORCE_FLAG_ONLY"}]}), "loosening BLOCK override rejected locally");
assertThrows(() => validateProductionOnboardingConfig({...onboardingConfigV2, enforcementOverrides: [{bindingIndex: 8, elementId: onboardingConfig.elements[0].elementId, mode: "ESCALATE_TO_BLOCK"}]}), "out-of-range override rejected locally");
assertThrows(() => validateProductionOnboardingConfig({...onboardingConfigV2, enforcementOverrides: Array.from({length: MAX_ENFORCEMENT_OVERRIDES + 1}, () => ({bindingIndex: 0, elementId: onboardingConfigV2.elements[1].elementId, mode: "ESCALATE_TO_BLOCK"}))}), "257 overrides rejected locally");

const ammOnlyConfig = validateProductionOnboardingConfig({
  ...onboardingConfig,
  venues: [{...onboardingConfig.venues[0], venueType: "AMM", adapter: "0x5000000000000000000000000000000000000001"}],
  rfq: undefined,
  inventory: [{...onboardingConfig.inventory[0], holder: "0x5000000000000000000000000000000000000002", spender: "0x5000000000000000000000000000000000000001"}],
  addresses: {...onboardingConfig.addresses, rfqAdapter: undefined, makerAuthorizer: undefined}
});
assert(createProductionOnboardingPlan(ammOnlyConfig).transactions.some((tx) => tx.id === "inventory-1-verify"), "AMM-only coherent mode still requires read-only inventory verification");
const calls: string[] = [];
const okReader = {
  async chainId() { return 1; },
  async getCode(address: string) { return address === onboardingConfig.addresses.token ? "0x6000" : "0x6001"; },
  async call(_address: string, _abi: string[], fn: string, args: unknown[] = []) {
    calls.push(fn);
    if (fn === "identityRegistry") return onboardingConfig.addresses.identityRegistry;
    if (fn === "compliance") return onboardingConfig.addresses.compliance;
    if (fn === "topicsRegistry") return onboardingConfig.addresses.topicsRegistry;
    if (fn === "issuersRegistry") return onboardingConfig.addresses.issuersRegistry;
    if (fn === "identityStorage") return onboardingConfig.addresses.identityStorage;
    if (fn === "isGlobalPaused") return false;
    if (fn === "isAssetSuspended") return false;
    if (fn === "isVenueSuspended") return false;
    if (fn === "owner") return onboardingConfig.governance.safe;
    if (fn === "isOperator") return true;
    if (fn === "elementOf") return onboardingConfig.elements[0].implementation;
    if (fn === "recipeOf") return onboardingConfig.recipes[0].implementation;
    if (fn === "statusOf") return 2;
    if (fn === "manifestOf") return [2, 1, 2, 0, 1, 5, 7, 1n, 3n, onboardingConfig.manifest.fullManifestHash, "0x8888888888888888888888888888888888888888", "0x5555555555555555555555555555555555555555"];
    if (fn === "recipeBindingsOf") return [[1, 2, 0, 0, 100]];
    if (fn === "venueOf") return [2, onboardingConfig.venues![0].adapter, onboardingConfig.venues![0].target, onboardingConfig.venues![0].operator, 0, true];
    if (fn === "approvedMaker") return true;
    if (fn === "isDelegate") return true;
    if (fn === "pendingDelegateReadyAt") return 0n;
    throw new Error(`unexpected call ${fn}`);
  },
  async balanceOf() { calls.push("balanceOf"); return 100n; },
  async allowance() { calls.push("allowance"); return 50n; }
};
const onboardingVerificationPromise = verifyProductionOnboarding(onboardingConfig, okReader).then((onboardingVerify) => {
  assert(onboardingVerify.ready, `onboarding verifier should pass: ${JSON.stringify(onboardingVerify.checks)}`);
  assert(calls.includes("balanceOf") && calls.includes("allowance") && !calls.some((name) => name === "approve" || name === "transfer"), "inventory verifier only reads balance/allowance");
  const ownerMismatchReader = {...okReader, async call(address: string, abi: string[], fn: string, args: unknown[] = []) { if (fn === "owner" && address === onboardingConfig.addresses.venueRegistry) return "0x9999999999999999999999999999999999999999"; return okReader.call(address, abi, fn, args); }};
  return verifyProductionOnboarding(onboardingConfig, ownerMismatchReader);
}).then((ownerMismatchVerify) => {
  assert(!ownerMismatchVerify.ready && ownerMismatchVerify.checks.some((check) => check.name === "owner-venue-registry" && !check.pass), "safe-owner target owner mismatch fails closed");
  const ownerUnavailableReader = {...okReader, async call(address: string, abi: string[], fn: string, args: unknown[] = []) { if (fn === "owner" && address === onboardingConfig.addresses.makerAuthorizer) throw new Error("owner unavailable"); return okReader.call(address, abi, fn, args); }};
  return verifyProductionOnboarding(onboardingConfig, ownerUnavailableReader);
}).then((ownerUnavailableVerify) => {
  assert(!ownerUnavailableVerify.ready && ownerUnavailableVerify.checks.some((check) => check.name === "owner-maker-authorizer" && !check.pass), "safe-owner target owner unavailable fails closed");
  const operatorMismatchReader = {...okReader, async call(address: string, abi: string[], fn: string, args: unknown[] = []) { if (fn === "isOperator" && address === onboardingConfig.addresses.rfqAdapter) return false; return okReader.call(address, abi, fn, args); }};
  return verifyProductionOnboarding(onboardingConfig, operatorMismatchReader);
}).then((operatorMismatchVerify) => {
  assert(!operatorMismatchVerify.ready && operatorMismatchVerify.checks.some((check) => check.name === "rfq-adapter-operator" && !check.pass), "RFQ operator role mismatch fails closed");
  const operatorUnavailableReader = {...okReader, async call(address: string, abi: string[], fn: string, args: unknown[] = []) { if (fn === "isOperator" && address === onboardingConfig.addresses.tokenPolicyRegistry) throw new Error("operator role unavailable"); return okReader.call(address, abi, fn, args); }};
  return verifyProductionOnboarding(onboardingConfig, operatorUnavailableReader);
}).then((operatorUnavailableVerify) => {
  assert(!operatorUnavailableVerify.ready && operatorUnavailableVerify.checks.some((check) => check.name === "token-policy-operator" && !check.pass), "token policy operator role unavailable fails closed");
  const expectedCompiled = onboardingPlanV2.compiledPlan!;
  const okReaderV2 = {
    ...okReader,
    async call(address: string, abi: string[], fn: string, args: unknown[] = []) {
      if (fn === "elementOf") {
        const id = String(args[0]).toLowerCase();
        const element = onboardingConfigV2.elements.find((entry) => entry.elementId.toLowerCase() === id);
        return element?.implementation ?? ZERO_ADDR;
      }
      if (fn === "defaultActionOf") {
        const id = String(args[0]).toLowerCase();
        const element = onboardingConfigV2.elements.find((entry) => entry.elementId.toLowerCase() === id);
        return element ? ENFORCEMENT_ACTION[element.defaultAction as keyof typeof ENFORCEMENT_ACTION] : 0;
      }
      if (fn === "versionHashOf") return onboardingConfigV2.elements[0].versionHash;
      if (fn === "recipeOf" && args.length === 2 && String(args[0]).startsWith("0x")) return onboardingConfigV2.recipes[0].implementation;
      if (fn === "recipeOf") return "0x20000000000000000000000000000000000000ff";
      if (fn === "recipeKeyOfAlias") return recipeKey;
      if (fn === "aliasHashOf") return aliasHash;
      if (fn === "recipeKeyOf") return recipeKey;
      if (fn === "recipeBindingsOf") return [[1, 2, 0, 0, 100]];
      if (fn === "compiledPlanHashOf") return expectedCompiled.compiledPlanHash;
      if (fn === "compiledBindingCountOf") return BigInt(expectedCompiled.bindings.length);
      if (fn === "compiledBindingOf") {
        const b = expectedCompiled.bindings[Number(args[1])];
        return [[b.recipeId, b.recipeVersion, 0, 0, 100], b.recipeKey, b.bindingPlanHash];
      }
      if (fn === "compiledRulesOf") {
        return expectedCompiled.bindings[Number(args[1])].rules.map((rule) => [rule.elementId, rule.actionValue]);
      }
      return okReader.call(address, abi, fn, args);
    }
  };
  return verifyProductionOnboarding(onboardingConfigV2, okReaderV2);
}).then((v2Verify) => {
  assert(v2Verify.ready, `v2 onboarding verifier should pass: ${JSON.stringify(v2Verify.checks)}`);
  const mismatchReader = {...okReader, async call(address: string, abi: string[], fn: string, args: unknown[] = []) { if (fn === "compiledPlanHashOf") return `0x${"ff".repeat(32)}`; return (okReader as any).call(address, abi, fn, args); }};
  return verifyProductionOnboarding(onboardingConfigV2, mismatchReader);
}).then((v2MismatchVerify) => {
  assert(!v2MismatchVerify.ready && v2MismatchVerify.checks.some((check) => check.name === "compiled-plan-hash" && !check.pass), "v2 compiled plan mismatch fails closed");
  const pendingReader = {...okReader, async call(address: string, abi: string[], fn: string, args: unknown[] = []) { if (fn === "isDelegate") return false; if (fn === "pendingDelegateReadyAt") return 123n; return okReader.call(address, abi, fn, args); }};
  return verifyProductionOnboarding(onboardingConfig, pendingReader);
}).then((pendingVerify) => {
  assert(!pendingVerify.ready && pendingVerify.checks.some((check) => check.name === "signer-1-active" && !check.pass) && pendingVerify.checks.some((check) => check.name === "signer-1-pending" && !check.pass), "pending signer is reported but not ready");
  const badReader = {...okReader, async call(address: string, abi: string[], fn: string, args: unknown[] = []) { if (fn === "identityRegistry") throw new Error("rpc unavailable"); return okReader.call(address, abi, fn, args); }};
  return verifyProductionOnboarding(onboardingConfig, badReader);
}).then((badVerify) => {
  assert(!badVerify.ready && badVerify.checks.some((check) => check.name === "erc3643-identity-registry" && !check.pass), "onboarding verifier fails closed on unavailable reads");
});


const referenceTarget = join(dir, "reference-rfq");
const reference = scaffoldRFQIntegration(referenceTarget, {
  mode: "reference-service",
  dockerCompose: true,
  sdkSourceRoot: join(process.cwd(), "../rfq")
});
if (!reference.files.includes("compose.yaml") ||
    !reference.files.includes("vendor/rfq-service/src/index.ts") ||
    !existsSync(join(referenceTarget, "src/index.ts"))) {
  throw new Error("reference RFQ scaffold regression");
}
if (JSON.parse(readFileSync(join(referenceTarget, "package.json"), "utf8")).dependencies["@corner-store/rfq-service"] !== "file:vendor/rfq-service") {
  throw new Error("reference RFQ scaffold is not self-contained");
}
const referenceEnv = readFileSync(join(referenceTarget, ".env.example"), "utf8");
if (
  !referenceEnv.includes("RFQ_SIGNER_PRIVATE_KEY=") ||
  /RFQ_SIGNER_PRIVATE_KEY=0x[0-9a-f]+/i.test(referenceEnv) ||
  /RFQ_(ADAPTER|MAKER)_ADDRESS=0x/i.test(referenceEnv)
) {
  throw new Error("scaffold embedded a signer secret");
}
validateIntegrationManifest(JSON.parse(readFileSync(join(referenceTarget, "corner-store.integration.json"), "utf8")));

const libraryTarget = join(dir, "library-only");
const library = scaffoldRFQIntegration(libraryTarget, {
  mode: "library-only",
  standalone: true,
  sdkDependency: "file:../corner-store-rfq-service.tgz",
  cliDependency: "file:../corner-store-cli.tgz",
  scenario: `${JSON.stringify({schemaVersion: 2, deployment: {accounts: {}}}, null, 2)}\n`
});
if (
  library.files.includes("compose.yaml") ||
  !library.files.includes("corner-store.config.json") ||
  !library.files.includes("corner-store.scenario.json") ||
  !readFileSync(join(libraryTarget, "src/index.ts"), "utf8").includes('export * from "@corner-store/rfq-service"')
) {
  throw new Error("standalone library-only scaffold regression");
}
const libraryPackage = JSON.parse(readFileSync(join(libraryTarget, "package.json"), "utf8"));
if (!libraryPackage.scripts.doctor || libraryPackage.scripts.start || !libraryPackage.scripts["test:module"]) {
  throw new Error("standalone package scripts regression");
}
validateIntegrationManifest(JSON.parse(readFileSync(join(libraryTarget, "corner-store.integration.json"), "utf8")));

const existingTarget = join(dir, "existing-backend");
const existing = scaffoldRFQIntegration(existingTarget, {mode: "existing-backend"});
if (existing.files.includes("compose.yaml") || !readFileSync(join(existingTarget, "src/index.ts"), "utf8").includes("createCornerStoreRFQ")) {
  throw new Error("existing-backend scaffold regression");
}
if (!JSON.parse(readFileSync(join(existingTarget, "package.json"), "utf8")).dependencies.ethers) {
  throw new Error("existing-backend scaffold is missing conformance signer support");
}
try {
  scaffoldRFQIntegration(existingTarget, {mode: "existing-backend"});
  throw new Error("scaffold overwrite accepted");
} catch (err: any) {
  if (!err.message.includes("already exists")) throw err;
}
try {
  scaffoldRFQIntegration(join(dir, "invalid-docker"), {mode: "library-only", dockerCompose: true});
  throw new Error("Docker accepted for library-only mode");
} catch (err: any) {
  if (!err.message.includes("reference-service")) throw err;
}
try {
  validateIntegrationManifest({
    ...defaultIntegrationManifest("existing-backend"),
    modules: {
      ...defaultIntegrationManifest("existing-backend").modules,
      signer: {
        ...defaultIntegrationManifest("existing-backend").modules.signer,
        env: ["not-a-valid-env"]
      }
    }
  });
  throw new Error("invalid integration env accepted");
} catch (err: any) {
  if (!err.message.includes("environment variable")) throw err;
}
onboardingVerificationPromise.then(() => {
  console.log("corner-store toolkit smoke ok");
}).catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
