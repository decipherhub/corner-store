import {mkdtempSync, readFileSync} from "fs";
import {tmpdir} from "os";
import {join} from "path";
import {defaultConfig, enabledEngineSpec, loadConfig, simulateConfig, validateConfig, writeDefaultConfig} from "../src/config";
import {getTemplate, validateTemplateInputs} from "../src/templates";
import {preflightConfig} from "../src/preflight";
import {createCheckpoint, loadCheckpoint, writeCheckpoint} from "../src/checkpoint";
import {createGovernanceProposal} from "../src/proposal";
import {createDeploymentPlan} from "../src/deploy";
import {toSafeTransactionDraft} from "../src/multisig";

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
  rfqAdapter: "0x5555555555555555555555555555555555555555", rfqVenue: "0x6666666666666666666666666666666666666666"
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
console.log("corner-store toolkit smoke ok");
