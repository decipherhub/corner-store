import {existsSync, mkdtempSync, readFileSync, writeFileSync} from "fs";
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
console.log("corner-store toolkit smoke ok");
