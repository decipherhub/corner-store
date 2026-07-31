import {execFileSync} from "child_process";
import {createHash} from "crypto";
import {
  copyFileSync,
  existsSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  readlinkSync,
  rmSync,
  writeFileSync
} from "fs";
import {tmpdir} from "os";
import {formatEther, keccak256, NonceManager, parseEther} from "ethers";

import {dirname, relative, resolve} from "path";
import {enabledEngineSpec, loadConfig, simulateConfig, writeDefaultConfig} from "../../toolkit/src/config";
import {preflightConfig} from "../../toolkit/src/preflight";
import {createCheckpoint, writeCheckpoint} from "../../toolkit/src/checkpoint";
import {createGovernanceProposal} from "../../toolkit/src/proposal";
import {createDeploymentPlan} from "../../toolkit/src/deploy";
import {toSafeTransactionDraft} from "../../toolkit/src/multisig";
import {
  ProductionConfig,
  ProductionSigner,
  createProductionDeploymentPlan,
  isProductionAddress,
  loadProductionConfig,
  loadProductionDeploymentEvidence,
  validateProductionConfig
} from "../../toolkit/src/production";
import {scaffoldRFQIntegration} from "../../toolkit/src/scaffold";

import {
  ACQ_SOURCE_ABI,
  ERC20_ABI,
  ELEMENT_ABI,
  ELEMENT_SETTERS_ABI,
  EVENTS_ABI,
  LOCKUP_ABI,
  MAKER_AUTHORIZER_ABI,
  RECIPE_ABI
} from "./abi";
import {
  ALLOWED_JURISDICTION,
  Artifact,
  DEFAULT_RPC,
  GlobalOpts,
  elementRegistry,
  engine,
  erc20,
  factory,
  findRepoRoot,
  loadArtifact,
  makeProvider,
  policyRegistry,
  recipeRegistry,
  resolveArtifactPath,
  resolveSigner,
  rfqAdapter,
  router,
  venueRegistry,
  walletForAccount,
  DEFAULT_CHAIN_ID,
} from "./config";
import {
  AbiCoder,
  Contract,
  Interface,
  TypedDataEncoder,
  decodeBytes32String,
  encodeBytes32String,
  verifyTypedData
} from "ethers";
import {assetProfileBinding, resolveAssetProfileForArtifact} from "./assetProfiles";
import {ELEMENT_IDS, applyAttestation, defaultIdentityId} from "./elements";
import {ELEMENT_LABELS, POLICY_STATUS, RECIPE_LABELS, decodeReason, encodeReason} from "./reason";
import {
  RFQ_QUOTE_TYPES,
  RFQQuoteService,
  SignedRFQQuote,
  WalletTypedDataSigner,
  encodeVenueData,
  readQuoteFile,
  requestBackendQuote,
  rfqDomain,
  writeQuoteFile
} from "./rfq";
import {CliError} from "./util";
import {
  copyDeploymentArtifact,
  doctor,
  prepareDeploymentRuntime,
  readScenario,
  resolveContractSource,
  testModule
} from "./product";

const CTX_TUPLE =
  "tuple(address initiator,address buyer,address seller,address tokenIn,address tokenOut,uint256 amountIn,uint256 amountOut,uint8 venueType,address venue,uint8 flowType,bool sellerIsAffiliate)";

const VENUE_TYPE_NAMES = ["AMM", "ORDER_BOOK", "RFQ"];
const RECIPE_BINDING_MODE_NAMES = ["REQUIRED_BLOCKING", "PATH_OPTION", "FLAG_ONLY"];
const ZERO_ADDR = "0x0000000000000000000000000000000000000000";
const ZERO32 = "0x0000000000000000000000000000000000000000000000000000000000000000";
const SAFE_ABI = [
  "function getOwners() view returns (address[])",
  "function getThreshold() view returns (uint256)",
  "function masterCopy() view returns (address)"
];
const ERC3643_TOKEN_ABI = [
  "function identityRegistry() view returns (address)",
  "function compliance() view returns (address)"
];
const IDENTITY_REGISTRY_ABI = [
  "function topicsRegistry() view returns (address)",
  "function issuersRegistry() view returns (address)",
  "function identityStorage() view returns (address)"
];
const GOVERNED_ABI = ["function owner() view returns (address)"];
const ROUTER_BOUND_ABI = ["function router() view returns (address)"];
const OPERATOR_SURFACE_ABI = ["function isOperator(address) view returns (bool)"];
const ROUTER_CONFIG_ABI = [
  "function engine() view returns (address)",
  "function venueReg() view returns (address)",
  "function selector() view returns (address)",
  "function operatorReg() view returns (address)"
];
const ENGINE_CONFIG_ABI = [
  "function policyReg() view returns (address)",
  "function elementReg() view returns (address)",
  "function recipeReg() view returns (address)"
];

interface ProductionCheck {
  name: string;
  pass: boolean;
  detail: string;
}

interface ProductionPreflightResult {
  ready: boolean;
  checks: ProductionCheck[];
}

function bindingRecipeId(binding: any): number {
  return Number(binding.recipeId ?? binding[0]);
}

function bindingRecipeVersion(binding: any): number {
  return Number(binding.recipeVersion ?? binding[1]);
}

function bindingMode(binding: any): number {
  return Number(binding.mode ?? binding[2]);
}

function bindingPathGroupId(binding: any): number {
  return Number(binding.pathGroupId ?? binding[3]);
}

function bindingPriority(binding: any): number {
  return Number(binding.priority ?? binding[4]);
}

function bindingRecipeIds(bindings: any[]): number[] {
  const ids: number[] = [];
  for (const binding of bindings) {
    const rid = bindingRecipeId(binding);
    if (rid !== 0 && !ids.includes(rid)) ids.push(rid);
  }
  return ids;
}

function bindingSummary(binding: any): string {
  const rid = bindingRecipeId(binding);
  const version = bindingRecipeVersion(binding);
  const mode = bindingMode(binding);
  const group = bindingPathGroupId(binding);
  const priority = bindingPriority(binding);
  return `${rid}v${version} (${RECIPE_LABELS[rid] ?? "?"}) mode=${RECIPE_BINDING_MODE_NAMES[mode] ?? mode} group=${group} priority=${priority}`;
}

function bindingJson(binding: any): Record<string, unknown> {
  const rid = bindingRecipeId(binding);
  const mode = bindingMode(binding);
  return {
    recipeId: rid,
    recipeVersion: bindingRecipeVersion(binding),
    recipeName: RECIPE_LABELS[rid] ?? "?",
    mode,
    modeName: RECIPE_BINDING_MODE_NAMES[mode] ?? "?",
    pathGroupId: bindingPathGroupId(binding),
    priority: bindingPriority(binding)
  };
}

export function cmdToolkitInit(path = "corner-store.config.json"): void {
  const target = resolve(process.cwd(), path);
  try {
    writeDefaultConfig(target);
  } catch (err: any) {
    throw new CliError(`cannot create toolkit config ${target}: ${err.message}`);
  }
  console.log(`created ${target}`);
}

export function cmdToolkitValidate(path = "corner-store.config.json"): void {
  const target = resolve(process.cwd(), path);
  const config = loadConfig(target);
  console.log(`valid toolkit config: ${target} (schema v${config.schemaVersion}, profile=${config.asset.profile})`);
}

export function cmdToolkitSimulate(path = "corner-store.config.json", artifactPath?: string): void {
  const config = loadConfig(resolve(process.cwd(), path));
  let deployedProfile: string | undefined;
  if (artifactPath) {
    const raw = loadArtifact(artifactPath);
    deployedProfile = raw.assetProfile;
  }
  const simulation = simulateConfig(config, deployedProfile);
  console.log(JSON.stringify(simulation, null, 2));
}

export function cmdToolkitPreflight(path = "corner-store.config.json", artifactPath?: string): void {
  if (!artifactPath) throw new CliError("toolkit-preflight requires --artifact <path>");
  const config = loadConfig(resolve(process.cwd(), path));
  const artifact = loadArtifact(artifactPath) as unknown as Record<string, unknown>;
  const result = preflightConfig(config, artifact);
  console.log(JSON.stringify(result, null, 2));
  if (!result.ready) process.exitCode = 1;
}

export async function cmdToolkitOnboard(path = "corner-store.config.json", opts: GlobalOpts): Promise<void> {
  const config = loadConfig(resolve(process.cwd(), path));
  const artifact = loadArtifact(opts.artifact) as unknown as Record<string, unknown>;
  const result = preflightConfig(config, artifact);
  if (!result.ready) {
    throw new CliError(`Toolkit preflight failed: ${result.checks.filter((check) => !check.pass).map((check) => check.name).join(", ")}`);
  }
  await cmdOnboard({...opts, profile: config.asset.profile, engines: enabledEngineSpec(config)});
}

export function cmdToolkitCheckpoint(path = "corner-store.config.json", output = "deployments/checkpoint.json", opts: GlobalOpts & {deploymentId?: string}): void {
  if (!opts.artifact) throw new CliError("toolkit-checkpoint requires --artifact <path>");
  const config = loadConfig(resolve(process.cwd(), path));
  const artifact = loadArtifact(opts.artifact) as unknown as Record<string, unknown>;
  const result = preflightConfig(config, artifact);
  if (!result.ready) throw new CliError(`Toolkit preflight failed: ${result.checks.filter((check) => !check.pass).map((check) => check.name).join(", ")}`);
  const checkpoint = createCheckpoint(config, artifact, opts.deploymentId ?? `${config.deployment.network}-${Date.now()}`);
  try {
    writeCheckpoint(resolve(process.cwd(), output), checkpoint);
  } catch (err: any) {
    throw new CliError(`cannot write immutable checkpoint: ${err.message}`);
  }
  console.log(JSON.stringify(checkpoint, null, 2));
}

export function cmdToolkitProposal(opts: {target: string; calldata: string; reason: string; artifactHash: string; approvals: string; output: string}): void {
  const proposal = createGovernanceProposal({
    target: opts.target,
    value: "0",
    calldata: opts.calldata,
    reason: opts.reason,
    expectedArtifactHash: opts.artifactHash,
    requiredApprovals: Number(opts.approvals)
  });
  try {
    writeFileSync(resolve(process.cwd(), opts.output), `${JSON.stringify(proposal, null, 2)}\n`, {flag: "wx"});
  } catch (err: any) {
    throw new CliError(`cannot write immutable proposal: ${err.message}`);
  }
  console.log(JSON.stringify(proposal, null, 2));
}

export function cmdToolkitSafeProposal(opts: {target: string; calldata: string; reason: string; artifactHash: string; approvals: string; chainId: string; output: string}): void {
  const proposal = createGovernanceProposal({target: opts.target, value: "0", calldata: opts.calldata, reason: opts.reason, expectedArtifactHash: opts.artifactHash, requiredApprovals: Number(opts.approvals)});
  const draft = toSafeTransactionDraft(proposal, Number(opts.chainId));
  try {
    writeFileSync(resolve(process.cwd(), opts.output), `${JSON.stringify(draft, null, 2)}\n`, {flag: "wx"});
  } catch (err: any) {
    throw new CliError(`cannot write immutable Safe proposal: ${err.message}`);
  }
  console.log(JSON.stringify(draft, null, 2));
}

export function cmdToolkitDeploy(path = "corner-store.config.json", opts: GlobalOpts & {broadcast?: boolean}): void {
  const config = loadConfig(resolve(process.cwd(), path));
  const plan = createDeploymentPlan(config, opts.rpc ?? DEFAULT_RPC, opts.broadcast === true);
  const repoRoot = findRepoRoot(process.cwd());
  const contractSource = resolveContractSource(repoRoot, opts.contracts);
  if (!contractSource) throw new CliError("Corner Store contract bundle not found; reinstall the CLI or set CORNER_STORE_CONTRACTS_ROOT");
  if (!opts.broadcast) {
    console.log(JSON.stringify({...plan, contractSource, dockerRequired: false}, null, 2));
    return;
  }
  const projectRoot = process.cwd();
  const deploymentRoot = repoRoot === projectRoot
    ? repoRoot
    : prepareDeploymentRuntime(projectRoot, contractSource);
  console.log(JSON.stringify({...plan, contractSource, deploymentRoot, dockerRequired: false}, null, 2));
  execFileSync("forge", ["script", "script/DeployStack.s.sol:DeployStack", "--rpc-url", opts.rpc ?? DEFAULT_RPC, "--broadcast", "--offline"], {
    cwd: deploymentRoot,
    env: {...process.env, ASSET_PROFILE: config.asset.profile},
    stdio: "inherit"
  });
  if (deploymentRoot !== projectRoot) {
    const artifact = copyDeploymentArtifact(deploymentRoot, projectRoot, config.deployment.artifact);
    console.log(`deployment artifact copied to ${artifact}`);
  }
}

export function cmdToolkitTest(): void {
  const repoRoot = findRepoRoot(process.cwd());
  if (!repoRoot) throw new CliError("repository root not found; run Toolkit test from the Corner Store repository");
  execFileSync("scripts/check.sh", [], {cwd: repoRoot, stdio: "inherit"});
}

export function cmdProductionPlan(path = "corner-store.production.json", opts: GlobalOpts & {rpcUrl?: string}): void {
  rejectProductionRawKey(opts);
  const config = productionConfigWithRuntimeOverrides(path, opts);
  const plan = createProductionDeploymentPlan(config);
  console.log(JSON.stringify(plan, null, 2));
}

export function cmdProductionSourceHash(opts: GlobalOpts): void {
  const repoRoot = findRepoRoot(process.cwd());
  const contractSource = productionContractSource(repoRoot, opts.contracts);
  if (!contractSource) throw new CliError("Corner Store contract bundle not found; reinstall the CLI or set CORNER_STORE_CONTRACTS_ROOT");
  console.log(JSON.stringify({
    contractsRoot: contractSource,
    sourceCommit: productionSourceCommit(contractSource),
    contractsHash: productionContractsHash(contractSource)
  }, null, 2));
}

export async function cmdProductionPreflight(path = "corner-store.production.json", opts: GlobalOpts & {rpcUrl?: string}): Promise<void> {
  rejectProductionRawKey(opts);
  const result = await productionPreflight(productionConfigWithRuntimeOverrides(path, opts));
  console.log(JSON.stringify(result, null, 2));
  if (!result.ready) process.exitCode = 1;
}

export async function cmdProductionDeploy(
  path = "corner-store.production.json",
  opts: GlobalOpts & {ledger?: boolean; account?: string; confirm?: string; rpcUrl?: string}
): Promise<void> {
  rejectProductionRawKey(opts);
  const config = productionConfigWithRuntimeOverrides(path, opts);
  if (opts.confirm !== "production-deploy") {
    throw new CliError('production-deploy requires --confirm production-deploy');
  }
  const signer = productionSigner(opts);
  if (signer.kind === "none") throw new CliError("production-deploy requires --ledger or --account <foundry-account>");
  const repoRoot = findRepoRoot(process.cwd());
  const contractSource = productionContractSource(repoRoot, opts.contracts);
  if (!contractSource) throw new CliError("Corner Store contract bundle not found; reinstall the CLI or set CORNER_STORE_CONTRACTS_ROOT");
  const contractsHash = productionContractsHash(contractSource);
  if (contractsHash !== config.release.contractsHash) {
    throw new CliError(
      `contract source hash mismatch: config=${config.release.contractsHash}, actual=${contractsHash}; regenerate review evidence`
    );
  }
  const actualSourceCommit = productionSourceCommit(contractSource);
  if (actualSourceCommit && actualSourceCommit !== config.release.sourceCommit) {
    throw new CliError(
      `source commit mismatch: config=${config.release.sourceCommit}, actual=${actualSourceCommit}; review the intended release`
    );
  }
  const evidencePath = resolve(process.cwd(), config.deployment.evidence);
  let deploymentEvidence;
  try {
    deploymentEvidence = loadProductionDeploymentEvidence(evidencePath, config);
  } catch (err: any) {
    throw new CliError(err.message);
  }
  const preflight = await productionPreflight(config);
  if (!preflight.ready) {
    console.log(JSON.stringify(preflight, null, 2));
    throw new CliError(`production preflight failed: ${preflight.checks.filter((check) => !check.pass).map((check) => check.name).join(", ")}`);
  }
  const plan = createProductionDeploymentPlan(config, signer, true);
  console.log(JSON.stringify({...plan, preflight, deploymentEvidence, evidencePath, contractsHash}, null, 2));
  const projectRoot = process.cwd();
  const deploymentRoot = repoRoot === projectRoot
    ? repoRoot
    : prepareDeploymentRuntime(projectRoot, contractSource);
  const args = [
    "script",
    plan.script,
    "--rpc-url",
    config.network.rpcUrl,
    "--chain-id",
    String(config.network.chainId),
    "--sender",
    config.deployer,
    "--broadcast"
  ];
  if (signer.kind === "ledger") args.push("--ledger");
  if (signer.kind === "account") args.push("--account", signer.name);
  execFileSync("forge", args, {
    env: {
      ...process.env,
      CORNER_STORE_DEPLOYER: config.deployer,
      CORNER_STORE_GOVERNANCE: config.safe.address,
      CORNER_STORE_OPERATOR: config.operator,
      CORNER_STORE_ENABLE_AMM: config.venues.amm ? "1" : "0",
      CORNER_STORE_ENABLE_RFQ: config.venues.rfq ? "1" : "0",
      CORNER_STORE_DEPLOYMENT_ID: config.deploymentId,
      CORNER_STORE_SOURCE_COMMIT: config.release.sourceCommit,
      CORNER_STORE_CONTRACTS_HASH: config.release.contractsHash,
      CORNER_STORE_ARTIFACT: config.deployment.artifact
    },
    cwd: deploymentRoot,
    stdio: "inherit"
  });
  if (deploymentRoot !== projectRoot) {
    const source = resolve(deploymentRoot, config.deployment.artifact);
    const output = resolve(projectRoot, config.deployment.artifact);
    mkdirSync(dirname(output), {recursive: true});
    copyFileSync(source, output);
    console.log(`production deployment artifact copied to ${output}`);
  }
}

export async function cmdProductionVerify(path = "corner-store.production.json", opts: GlobalOpts & {rpcUrl?: string}): Promise<void> {
  rejectProductionRawKey(opts);
  const config = productionConfigWithRuntimeOverrides(path, opts);
  const artifactPath = opts.artifact ? resolve(process.cwd(), opts.artifact) : resolve(process.cwd(), config.deployment.artifact);
  let artifact: Record<string, unknown>;
  try {
    artifact = JSON.parse(readFileSync(artifactPath, "utf8")) as Record<string, unknown>;
  } catch (err: any) {
    throw new CliError(`invalid production artifact ${artifactPath}: ${err.message}`);
  }
  const result = await productionVerify(config, artifact);
  console.log(JSON.stringify({...result, artifact: artifactPath}, null, 2));
  if (!result.ready) process.exitCode = 1;
}

function productionConfigWithRuntimeOverrides(path: string, opts: GlobalOpts & {rpcUrl?: string}): ProductionConfig {
  const config = loadProductionConfig(resolve(process.cwd(), path));
  const rpcUrl = opts.rpcUrl ?? explicitlyProvidedGlobalRpc() ?? process.env.CORNER_STORE_RPC_URL;
  return rpcUrl ? {...config, network: {...config.network, rpcUrl}} : config;
}

function explicitlyProvidedGlobalRpc(): string | undefined {
  for (let i = 0; i < process.argv.length; i++) {
    const arg = process.argv[i];
    if (arg === "--rpc") return process.argv[i + 1];
    if (arg.startsWith("--rpc=")) return arg.slice("--rpc=".length);
  }
  return undefined;
}

function rejectProductionRawKey(opts: GlobalOpts): void {
  if (opts.key) throw new CliError("production commands reject --key; use --ledger or Foundry --account for deploy");
}

function productionSigner(opts: {ledger?: boolean; account?: string}): ProductionSigner {
  if (opts.ledger && opts.account) throw new CliError("use only one production signer: --ledger or --account");
  if (opts.ledger) return {kind: "ledger"};
  if (opts.account) {
    if (/^0x[0-9a-fA-F]{64}$/.test(opts.account)) throw new CliError("production --account must be a Foundry account name, not a raw private key");
    return {kind: "account", name: opts.account};
  }
  return {kind: "none"};
}

async function productionPreflight(config: ProductionConfig): Promise<ProductionPreflightResult> {
  const selected = validateProductionConfig(config);
  const provider = makeProvider({rpc: selected.network.rpcUrl});
  const checks: ProductionCheck[] = [];
  const check = (name: string, pass: boolean, detail: string) => checks.push({name, pass, detail});
  try {
    const network = await provider.getNetwork();
    check("chain-id", network.chainId === BigInt(selected.network.chainId), `rpc=${network.chainId.toString()}, config=${selected.network.chainId}`);
  } catch (err: any) {
    check("chain-id", false, `cannot read RPC chainId: ${err.message}`);
  }
  await checkCode(provider, selected.safe.address, "safe-code", check);
  try {
    const safe = new Contract(selected.safe.address, SAFE_ABI, provider);
    const proxyCode = await provider.getCode(selected.safe.address);
    const singleton: string = await safe.masterCopy();
    const owners: string[] = await safe.getOwners();
    const threshold: bigint = await safe.getThreshold();
    check(
      "safe-proxy-code-hash",
      keccak256(proxyCode).toLowerCase() === selected.safe.proxyCodeHash.toLowerCase(),
      `expected=${selected.safe.proxyCodeHash}; actual=${keccak256(proxyCode)}`
    );
    check(
      "safe-singleton",
      sameAddress(singleton, selected.safe.expectedSingleton),
      `expected=${selected.safe.expectedSingleton}; actual=${singleton}`
    );
    await checkCode(provider, selected.safe.expectedSingleton, "safe-singleton-code", check);
    const actual = owners.map((owner) => owner.toLowerCase()).sort();
    const expected = selected.safe.expectedOwners.map((owner) => owner.toLowerCase()).sort();
    check("safe-owners", JSON.stringify(actual) === JSON.stringify(expected), `expected=${expected.join(",")}; actual=${actual.join(",")}`);
    check("safe-threshold", threshold === BigInt(selected.safe.threshold), `expected=${selected.safe.threshold}; actual=${threshold.toString()}`);
  } catch (err: any) {
    check("safe-state", false, `cannot verify Safe proxy/singleton/owners/threshold: ${err.message}`);
  }
  if (selected.erc3643?.token) {
    await preflightErc3643(selected.erc3643.token, provider, check);
  }
  return {ready: checks.every((item) => item.pass), checks};
}

async function productionVerify(config: ProductionConfig, artifact: Record<string, unknown>): Promise<ProductionPreflightResult> {
  const selected = validateProductionConfig(config);
  const provider = makeProvider({rpc: selected.network.rpcUrl});
  const checks: ProductionCheck[] = [];
  const check = (name: string, pass: boolean, detail: string) => checks.push({name, pass, detail});
  const routerAddress = artifactAddress(artifact, ["router", "executionRouter"]);
  const engineAddress = artifactAddress(artifact, ["engine", "complianceEngine"]);
  const policyAddress = artifactAddress(artifact, ["policyReg", "policyRegistry", "tokenPolicyRegistry"]);
  const operatorAddress = artifactAddress(artifact, ["operatorReg", "operatorRegistry"]);
  const rfqAdapterAddress = artifactAddress(artifact, ["rfqAdapter"]);
  const ammAdapterAddress = artifactAddress(artifact, ["ammAdapter"]);
  const makerAuthorizerAddress = artifactAddress(artifact, ["makerAuthorizer"]);
  const venueRegAddress = artifactAddress(artifact, ["venueReg", "venueRegistry"]);
  const selectorAddress = artifactAddress(artifact, ["selector", "venueSelector"]);
  const elementRegAddress = artifactAddress(artifact, ["elementReg", "elementRegistry"]);
  const recipeRegAddress = artifactAddress(artifact, ["recipeReg", "recipeRegistry"]);
  const governed = [
    ["element-registry", elementRegAddress],
    ["recipe-registry", recipeRegAddress],
    ["policy", policyAddress],
    ["operator-registry", operatorAddress],
    ["engine", engineAddress],
    ["venue-registry", venueRegAddress],
    ["router", routerAddress],
    ["amm-adapter", selected.venues.amm ? ammAdapterAddress : undefined],
    ["rfq-adapter", selected.venues.rfq ? rfqAdapterAddress : undefined],
    ["maker-authorizer", selected.venues.rfq ? makerAuthorizerAddress : undefined]
  ] as const;

  check("artifact-schema-version", artifactNumber(artifact, ["schemaVersion"]) === 1, `expected=1, artifact=${String(artifactValue(artifact, ["schemaVersion"]))}`);
  check("artifact-deployment-id", artifactValue(artifact, ["deploymentId"]) === selected.deploymentId, `config=${selected.deploymentId}, artifact=${String(artifactValue(artifact, ["deploymentId"]))}`);
  check("artifact-source-commit", artifactValue(artifact, ["sourceCommit"]) === selected.release.sourceCommit, `config=${selected.release.sourceCommit}, artifact=${String(artifactValue(artifact, ["sourceCommit"]))}`);
  check("artifact-contracts-hash", artifactValue(artifact, ["contractsHash"]) === selected.release.contractsHash, `config=${selected.release.contractsHash}, artifact=${String(artifactValue(artifact, ["contractsHash"]))}`);
  check("artifact-chain-id", artifactNumber(artifact, ["chainId", "network.chainId"]) === selected.network.chainId, `config=${selected.network.chainId}, artifact=${String(artifactValue(artifact, ["chainId", "network.chainId"]))}`);
  check("artifact-deployer", sameAddress(artifactAddress(artifact, ["deployer"]), selected.deployer), `config=${selected.deployer}, artifact=${String(artifactAddress(artifact, ["deployer"]))}`);
  check("artifact-governance", sameAddress(artifactAddress(artifact, ["governance", "safe", "governanceSafe"]), selected.safe.address), `config=${selected.safe.address}, artifact=${String(artifactAddress(artifact, ["governance", "safe", "governanceSafe"]))}`);
  check("artifact-operator", sameAddress(artifactAddress(artifact, ["operator"]), selected.operator), `config=${selected.operator}, artifact=${String(artifactAddress(artifact, ["operator"]))}`);
  check("artifact-amm-enabled", artifactBoolean(artifact, ["venues.amm", "enabledVenues.amm", "ammEnabled"]) === selected.venues.amm, `config=${selected.venues.amm}`);
  check("artifact-rfq-enabled", artifactBoolean(artifact, ["venues.rfq", "enabledVenues.rfq", "rfqEnabled"]) === selected.venues.rfq, `config=${selected.venues.rfq}`);

  for (const [name, address, hashField] of [
    ["router", routerAddress, "routerCodeHash"],
    ["engine", engineAddress, "engineCodeHash"],
    ["policy", policyAddress, "policyRegCodeHash"],
    ["operator-registry", operatorAddress, "operatorRegCodeHash"],
    ["element-registry", elementRegAddress, "elementRegCodeHash"],
    ["recipe-registry", recipeRegAddress, "recipeRegCodeHash"],
    ["venue-registry", venueRegAddress, "venueRegCodeHash"],
    ["venue-selector", selectorAddress, "selectorCodeHash"]
  ] as const) {
    if (address) await checkRuntimeCodeHash(provider, address, artifactHash32(artifact, [hashField]), `${name}-code-hash`, check);
    else check(`${name}-address`, false, `${name} missing from artifact`);
  }
  if (selected.venues.amm) {
    if (ammAdapterAddress) await checkRuntimeCodeHash(provider, ammAdapterAddress, artifactHash32(artifact, ["ammAdapterCodeHash"]), "amm-adapter-code-hash", check);
    else check("amm-adapter-address", false, "amm adapter missing from artifact");
  }
  if (selected.venues.rfq) {
    if (rfqAdapterAddress) await checkRuntimeCodeHash(provider, rfqAdapterAddress, artifactHash32(artifact, ["rfqAdapterCodeHash"]), "rfq-adapter-code-hash", check);
    else check("rfq-adapter-address", false, "rfq adapter missing from artifact");
    if (makerAuthorizerAddress) await checkRuntimeCodeHash(provider, makerAuthorizerAddress, artifactHash32(artifact, ["makerAuthorizerCodeHash"]), "maker-authorizer-code-hash", check);
    else check("maker-authorizer-address", false, "makerAuthorizer missing from artifact");
  }

  for (const [name, address] of governed) {
    if (address) await checkOwner(provider, address, selected.safe.address, `${name}-owner`, check);
  }
  if (engineAddress && routerAddress) await checkRouterBinding(provider, engineAddress, routerAddress, "engine-router", check);
  if (selected.venues.amm && ammAdapterAddress && routerAddress) await checkRouterBinding(provider, ammAdapterAddress, routerAddress, "amm-adapter-router", check);
  if (selected.venues.rfq && rfqAdapterAddress && routerAddress) await checkRouterBinding(provider, rfqAdapterAddress, routerAddress, "rfq-adapter-router", check);
  if (policyAddress) await checkOperatorSurface(provider, policyAddress, selected.operator, "policy-operator", check);
  if (operatorAddress) await checkOperatorSurface(provider, operatorAddress, selected.operator, "operator-registry-operator", check);
  if (selected.venues.rfq && rfqAdapterAddress) await checkOperatorSurface(provider, rfqAdapterAddress, selected.operator, "rfq-operator", check);
  if (selected.venues.rfq && makerAuthorizerAddress) await checkOperatorSurface(provider, makerAuthorizerAddress, selected.operator, "maker-authorizer-operator", check);
  if (routerAddress) {
    await checkAddressBindings(
      provider,
      routerAddress,
      ROUTER_CONFIG_ABI,
      {
        engine: engineAddress,
        venueReg: venueRegAddress,
        selector: selectorAddress,
        operatorReg: operatorAddress
      },
      "router",
      check
    );
  }
  if (engineAddress) {
    await checkAddressBindings(
      provider,
      engineAddress,
      ENGINE_CONFIG_ABI,
      {
        policyReg: policyAddress,
        elementReg: elementRegAddress,
        recipeReg: recipeRegAddress
      },
      "engine",
      check
    );
  }

  return {ready: checks.every((item) => item.pass), checks};
}

async function preflightErc3643(token: string, provider: any, check: (name: string, pass: boolean, detail: string) => void): Promise<void> {
  await checkCode(provider, token, "erc3643-token-code", check);
  try {
    const contract = new Contract(token, ERC3643_TOKEN_ABI, provider);
    const identityRegistry = await contract.identityRegistry();
    const compliance = await contract.compliance();
    check("erc3643-identity-registry", isProductionAddress(identityRegistry), `identityRegistry=${identityRegistry}`);
    check("erc3643-compliance", isProductionAddress(compliance), `compliance=${compliance}`);
    if (isProductionAddress(identityRegistry)) {
      await checkCode(provider, identityRegistry, "identity-registry-code", check);
      await preflightIdentityRegistry(identityRegistry, provider, check);
    }
    if (isProductionAddress(compliance)) await checkCode(provider, compliance, "compliance-code", check);
  } catch (err: any) {
    check("erc3643-state", false, `cannot read token identityRegistry/compliance: ${err.message}`);
  }
}

async function preflightIdentityRegistry(address: string, provider: any, check: (name: string, pass: boolean, detail: string) => void): Promise<void> {
  try {
    const registry = new Contract(address, IDENTITY_REGISTRY_ABI, provider);
    const topicsRegistry = await registry.topicsRegistry();
    const issuersRegistry = await registry.issuersRegistry();
    const identityStorage = await registry.identityStorage();
    for (const [name, value] of [
      ["topics-registry", topicsRegistry],
      ["issuers-registry", issuersRegistry],
      ["identity-storage", identityStorage]
    ] as const) {
      check(name, isProductionAddress(value), `${name}=${value}`);
      if (isProductionAddress(value)) await checkCode(provider, value, `${name}-code`, check);
    }
  } catch (err: any) {
    check("identity-registry-state", false, `cannot read identity registry dependencies: ${err.message}`);
  }
}

async function checkCode(provider: any, address: string, name: string, check: (name: string, pass: boolean, detail: string) => void): Promise<void> {
  if (!isProductionAddress(address)) {
    check(name, false, `${address} is not a non-zero address`);
    return;
  }
  try {
    const code = await provider.getCode(address);
    check(name, code !== "0x", code === "0x" ? `${address} has no code` : `${address} code present`);
  } catch (err: any) {
    check(name, false, `cannot read code at ${address}: ${err.message}`);
  }
}

async function checkRuntimeCodeHash(
  provider: any,
  address: string,
  expectedHash: string | undefined,
  name: string,
  check: (name: string, pass: boolean, detail: string) => void
): Promise<void> {
  if (!expectedHash) {
    check(name, false, "expected runtime code hash missing from artifact");
    return;
  }
  try {
    const code = await provider.getCode(address);
    const actual = code === "0x" ? undefined : keccak256(code);
    check(
      name,
      actual?.toLowerCase() === expectedHash.toLowerCase(),
      `expected=${expectedHash}; actual=${actual ?? "no code"}`
    );
  } catch (err: any) {
    check(name, false, `cannot read runtime code at ${address}: ${err.message}`);
  }
}

async function checkOwner(provider: any, address: string, expectedOwner: string, name: string, check: (name: string, pass: boolean, detail: string) => void): Promise<void> {
  try {
    const owner = await new Contract(address, GOVERNED_ABI, provider).owner();
    check(name, sameAddress(owner, expectedOwner), `expected=${expectedOwner}; actual=${owner}`);
  } catch (err: any) {
    check(name, false, `cannot read owner() at ${address}: ${err.message}`);
  }
}

async function checkRouterBinding(provider: any, address: string, expectedRouter: string, name: string, check: (name: string, pass: boolean, detail: string) => void): Promise<void> {
  try {
    const actual = await new Contract(address, ROUTER_BOUND_ABI, provider).router();
    check(name, sameAddress(actual, expectedRouter), `expected=${expectedRouter}; actual=${actual}`);
  } catch (err: any) {
    check(name, false, `cannot read router() at ${address}: ${err.message}`);
  }
}

async function checkOperatorSurface(provider: any, address: string, operator: string, name: string, check: (name: string, pass: boolean, detail: string) => void): Promise<void> {
  try {
    const enabled = await new Contract(address, OPERATOR_SURFACE_ABI, provider).isOperator(operator);
    check(name, enabled === true, `operator=${operator}; isOperator=${enabled}`);
  } catch (err: any) {
    check(name, false, `cannot read isOperator(address) at ${address}: ${err.message}`);
  }
}

async function checkAddressBindings(
  provider: any,
  address: string,
  abi: string[],
  expected: Record<string, string | undefined>,
  prefix: string,
  check: (name: string, pass: boolean, detail: string) => void
): Promise<void> {
  const contract = new Contract(address, abi, provider);
  for (const [getter, expectedAddress] of Object.entries(expected)) {
    if (!expectedAddress) {
      check(`${prefix}-${getter}`, false, `${getter} address missing from artifact`);
      continue;
    }
    try {
      const actual = await contract[getter]();
      check(
        `${prefix}-${getter}`,
        sameAddress(actual, expectedAddress),
        `expected=${expectedAddress}; actual=${actual}`
      );
    } catch (err: any) {
      check(`${prefix}-${getter}`, false, `cannot read ${getter}() at ${address}: ${err.message}`);
    }
  }
}

function sameAddress(a: unknown, b: unknown): boolean {
  return typeof a === "string" && typeof b === "string" && a.toLowerCase() === b.toLowerCase();
}

function artifactAddress(artifact: Record<string, unknown>, paths: string[]): string | undefined {
  const value = artifactValue(artifact, paths);
  return isProductionAddress(value) ? value : undefined;
}

function artifactNumber(artifact: Record<string, unknown>, paths: string[]): number | undefined {
  const value = artifactValue(artifact, paths);
  if (typeof value === "number" && Number.isSafeInteger(value)) return value;
  if (typeof value === "string" && /^[0-9]+$/.test(value)) return Number(value);
  return undefined;
}

function artifactBoolean(artifact: Record<string, unknown>, paths: string[]): boolean | undefined {
  const value = artifactValue(artifact, paths);
  return typeof value === "boolean" ? value : undefined;
}

function artifactHash32(artifact: Record<string, unknown>, paths: string[]): string | undefined {
  const value = artifactValue(artifact, paths);
  return typeof value === "string" && /^0x[0-9a-fA-F]{64}$/.test(value) ? value : undefined;
}

function artifactValue(artifact: Record<string, unknown>, paths: string[]): unknown {
  for (const path of paths) {
    const parts = path.split(".");
    let current: unknown = artifact;
    for (const part of parts) {
      if (!current || typeof current !== "object" || Array.isArray(current)) {
        current = undefined;
        break;
      }
      current = (current as Record<string, unknown>)[part];
    }
    if (current !== undefined) return current;
  }
  return undefined;
}

function productionContractsHash(root: string): string {
  const hasher = createHash("sha256");
  const inputs = ["foundry.toml", "remappings.txt", "src", "lib", "script/DeployProductionCore.s.sol"];
  const ignored = new Set([".git", "node_modules", "out", "cache", "broadcast", "deployments"]);
  const visit = (absolutePath: string, relativePath: string): void => {
    const stat = lstatSync(absolutePath);
    if (stat.isSymbolicLink()) {
      hasher.update(`L\0${relativePath}\0${readlinkSync(absolutePath)}\0`);
      return;
    }
    if (stat.isDirectory()) {
      const entries = readdirSync(absolutePath).filter((name) => !ignored.has(name)).sort();
      for (const entry of entries) visit(resolve(absolutePath, entry), `${relativePath}/${entry}`);
      return;
    }
    if (stat.isFile()) {
      hasher.update(`F\0${relativePath}\0`);
      hasher.update(readFileSync(absolutePath));
      hasher.update("\0");
    }
  };
  for (const input of inputs) {
    const absolutePath = resolve(root, input);
    try {
      visit(absolutePath, input);
    } catch (err: any) {
      if (err?.code !== "ENOENT") throw err;
    }
  }
  return `sha256:${hasher.digest("hex")}`;
}

function productionContractSource(repoRoot?: string, explicit?: string): string | undefined {
  if (explicit) return resolveContractSource(repoRoot, explicit);
  if (repoRoot && resolve(repoRoot) === resolve(process.cwd())) return repoRoot;
  return resolveContractSource(repoRoot);
}

function productionSourceCommit(root: string): string | undefined {
  if (!existsSync(resolve(root, ".git"))) return undefined;
  try {
    return String(execFileSync("git", ["-C", root, "rev-parse", "HEAD"], {encoding: "utf8"})).trim().toLowerCase();
  } catch {
    return undefined;
  }
}

export function cmdToolkitScaffoldRFQ(
  target: string,
  opts: {mode: string; docker?: boolean; sdk?: string; cli?: string}
): void {
  if (opts.mode !== "reference-service" && opts.mode !== "existing-backend") {
    throw new CliError('--mode must be "reference-service" or "existing-backend"');
  }
  try {
    const repoRoot = findRepoRoot(process.cwd()) ?? findRepoRoot(__dirname);
    const result = scaffoldRFQIntegration(target, {
      mode: opts.mode,
      dockerCompose: opts.docker === true,
      sdkDependency: opts.sdk,
      cliDependency: opts.cli,
      sdkSourceRoot: opts.sdk ? undefined : repoRoot ? resolve(repoRoot, "services/rfq") : undefined
    });
    console.log(JSON.stringify(result, null, 2));
  } catch (err: any) {
    throw new CliError(`cannot scaffold RFQ integration: ${err.message}`);
  }
}

export function cmdCreate(
  target: string,
  opts: {mode: string; docker?: boolean; sdk?: string; cli?: string}
): void {
  if (opts.mode !== "library-only" && opts.mode !== "reference-service" && opts.mode !== "existing-backend") {
    throw new CliError('--mode must be "library-only", "reference-service", or "existing-backend"');
  }
  const repoRoot = findRepoRoot(process.cwd()) ?? findRepoRoot(__dirname);
  const localCliPackage = !opts.cli && repoRoot ? packLocalCli(repoRoot) : undefined;
  try {
    const contractSource = resolveContractSource(repoRoot);
    if (!contractSource) throw new Error("contract bundle not found");
    const scenarioPath = repoRoot
      ? resolve(repoRoot, "services/rfq-demo-backend/config/demo-scenario.json")
      : resolve(contractSource, "deployments/anvil-e2e-scenario.json");
    const result = scaffoldRFQIntegration(target, {
      mode: opts.mode,
      dockerCompose: opts.docker === true,
      sdkDependency: opts.sdk,
      cliDependency: opts.cli ?? localCliPackage?.dependency,
      sdkSourceRoot: opts.sdk ? undefined : repoRoot ? resolve(repoRoot, "services/rfq") : undefined,
      standalone: true,
      scenario: readScenario(scenarioPath)
    });
    if (localCliPackage) {
      const vendorDirectory = resolve(result.root, "vendor");
      mkdirSync(vendorDirectory, {recursive: true});
      copyFileSync(localCliPackage.tarball, resolve(vendorDirectory, "corner-store-cli.tgz"));
      result.files.push("vendor/corner-store-cli.tgz");
      result.files.sort();
    }
    console.log(JSON.stringify({...result, dockerRequired: false}, null, 2));
  } catch (err: any) {
    throw new CliError(`cannot create Corner Store project: ${err.message}`);
  } finally {
    if (localCliPackage) rmSync(localCliPackage.directory, {recursive: true, force: true});
  }
}

function packLocalCli(repoRoot: string): {directory: string; tarball: string; dependency: string} {
  const directory = mkdtempSync(resolve(tmpdir(), "corner-store-cli-package-"));
  try {
    execFileSync(
      "npm",
      ["pack", resolve(repoRoot, "services/cli"), "--pack-destination", directory, "--silent"],
      {
        env: {
          ...process.env,
          npm_config_cache: process.env.npm_config_cache ?? resolve(tmpdir(), "corner-store-npm-cache")
        },
        stdio: "pipe"
      }
    );
    const name = readdirSync(directory).find((entry) => entry.endsWith(".tgz"));
    if (!name) throw new Error("npm pack did not produce a CLI tarball");
    return {
      directory,
      tarball: resolve(directory, name),
      dependency: "file:vendor/corner-store-cli.tgz"
    };
  } catch (error) {
    rmSync(directory, {recursive: true, force: true});
    throw error;
  }
}

export function cmdDoctor(path = "corner-store.config.json", opts: GlobalOpts): void {
  const result = doctor(path, opts.artifact, findRepoRoot(process.cwd()), opts.contracts);
  console.log(JSON.stringify(result, null, 2));
  if (!result.ready) process.exitCode = 1;
}

export function cmdVerify(path = "corner-store.config.json", opts: GlobalOpts): void {
  const config = loadConfig(resolve(process.cwd(), path));
  cmdToolkitPreflight(path, opts.artifact ?? config.deployment.artifact);
}

export async function cmdTestModule(path: string): Promise<void> {
  try {
    console.log(JSON.stringify(await testModule(path), null, 2));
  } catch (err: any) {
    throw new CliError(`RFQ module conformance failed: ${err.message}`);
  }
}

function subjectAddress(opts: GlobalOpts, positional: string | undefined, fallbackAccount: number): string {
  if (positional) return positional;
  if (opts.key) return new (require("ethers").Wallet)(opts.key.startsWith("0x") ? opts.key : `0x${opts.key}`).address;
  const idx = opts.account !== undefined ? Number(opts.account) : fallbackAccount;
  return walletForAccount(idx).address;
}

async function logTx(tx: any, label: string): Promise<void> {
  const receipt = await tx.wait();
  console.log(`  ${label}: ${tx.hash} (block ${receipt.blockNumber}, status ${receipt.status})`);
}

// ---------------------------------------------------------------------------
// status
// ---------------------------------------------------------------------------
export async function cmdStatus(positional: string | undefined, opts: GlobalOpts & {json?: boolean}): Promise<void> {
  const a = loadArtifact(opts.artifact);
  const provider = makeProvider(opts);
  const subject = subjectAddress(opts, positional, 1);

  const policy = policyRegistry(a, provider);
  const manifest = await policy.manifestOf(a.rwaToken);
  const bindings: any[] = await policy.recipeBindingsOf(a.rwaToken);
  const status = Number(manifest.status);
  const supportedEngines = Number(manifest.supportedEngines);

  const venues: Array<{label: string; address: string; type: string; active: boolean}> = [];
  for (const [label, address] of [
    ["AMM pool", a.pool],
    ["RFQ venue", a.rfqVenue]
  ] as const) {
    const cfg = await venueRegistry(a, provider).venueOf(address);
    venues.push({label, address, type: VENUE_TYPE_NAMES[Number(cfg.venueType)] ?? String(cfg.venueType), active: cfg.active});
  }

  // Per-element attestation state for the subject: replay each element's check.
  const reg = elementRegistry(a, provider);
  const ctx = [subject, subject, a.pool, a.quote, a.rwaToken, parseEther("1"), parseEther("1"), 0, a.pool, 0, false];
  const coder = require("ethers").AbiCoder.defaultAbiCoder();
  const elementContext = coder.encode([CTX_TUPLE], [ctx]);
  const recipeContext = coder.encode(["uint256", CTX_TUPLE], [manifest.factsPacked, ctx]);
  const recipeIds = bindingRecipeIds(bindings);
  const recipeReg = recipeRegistry(a, provider);
  const activeElementIds: string[] = [];
  for (const rid of recipeIds) {
    const recipeAddr = await recipeReg.recipeOf(rid);
    if (recipeAddr === ZERO_ADDR) continue;
    const recipe = new Contract(recipeAddr, RECIPE_ABI, provider);
    if (!(await recipe.isApplicable(recipeContext))) continue;
    const requiredIds: string[] = await recipe.requiredElements();
    for (const raw of requiredIds) {
      const id = decodeBytes32String(raw);
      if (!activeElementIds.includes(id)) activeElementIds.push(id);
    }
  }

  const elements: Array<{id: string; label: string; passed: boolean}> = [];
  for (const id of activeElementIds) {
    const label = ELEMENT_LABELS[id] ?? "?";
    const elAddr = await reg.elementOf(encodeBytes32String(id));
    if (elAddr === "0x0000000000000000000000000000000000000000") {
      elements.push({id, label, passed: false});
      continue;
    }
    const el = new Contract(elAddr, ELEMENT_ABI, provider);
    try {
      const [passed] = await el.check(subject, a.pool, a.rwaToken, parseEther("1"), elementContext);
      elements.push({id, label, passed});
    } catch {
      elements.push({id, label, passed: false});
    }
  }

  if (opts.json) {
    console.log(
      JSON.stringify(
        {
          rpc: opts.rpc ?? DEFAULT_RPC,
          artifact: resolveArtifactPath(opts.artifact),
          subject,
          addresses: a,
          manifest: {
            status,
            statusName: POLICY_STATUS[status] ?? "?",
            bindings: bindings.map(bindingJson),
            supportedEngines,
            declaredBy: manifest.declaredBy,
            approvedBy: manifest.approvedBy
          },
          venues,
          elements
        },
        null,
        2
      )
    );
    return;
  }

  console.log("Corner Store — deployment status");
  console.log("  rpc      :", opts.rpc ?? DEFAULT_RPC);
  console.log("  artifact :", resolveArtifactPath(opts.artifact));
  console.log("");
  console.log("Addresses:");
  for (const [k, v] of Object.entries(a)) console.log(`  ${k.padEnd(16)} ${v}`);
  console.log("");
  console.log("RWA manifest:");
  console.log(`  status           ${status} (${POLICY_STATUS[status] ?? "?"})`);
  console.log("  recipeBindings");
  for (const binding of bindings) console.log(`    - ${bindingSummary(binding)}`);
  console.log(`  supportedEngines 0b${supportedEngines.toString(2).padStart(3, "0")} (AMM=${!!(supportedEngines & 1)}, RFQ=${!!(supportedEngines & 4)})`);
  console.log(`  declaredBy       ${manifest.declaredBy}`);
  console.log(`  approvedBy       ${manifest.approvedBy}`);
  console.log("");
  console.log("Venues:");
  for (const v of venues) console.log(`  ${v.label.padEnd(10)} ${v.address}  type=${v.type} active=${v.active}`);
  console.log("");
  console.log(`Attestation state for ${subject}:`);
  for (const e of elements) console.log(`  [${e.passed ? "PASS" : "FAIL"}] ${e.id.padEnd(8)} ${e.label}`);
}

// ---------------------------------------------------------------------------
// onboard
// ---------------------------------------------------------------------------
function enginesMask(spec: string | undefined): number {
  if (!spec) return 1 | 4; // amm | rfq (default)
  let mask = 0;
  for (const part of spec.split(",").map((s) => s.trim().toLowerCase()).filter(Boolean)) {
    if (part === "amm") mask |= 1;
    else if (part === "order_book" || part === "orderbook") mask |= 2;
    else if (part === "rfq") mask |= 4;
    else throw new CliError(`unknown engine "${part}" (amm|order_book|rfq)`);
  }
  return mask;
}

export async function cmdOnboard(opts: GlobalOpts & {engines?: string; profile?: string}): Promise<void> {
  const a = loadArtifact(opts.artifact);
  const provider = makeProvider(opts);
  const signer = resolveSigner(opts, provider, 0); // operator
  const mask = enginesMask(opts.engines);
  // Validate the requested profile before any lifecycle transaction. The
  // deployment artifact is authoritative for this token instance.
  const binding = assetProfileBinding(resolveAssetProfileForArtifact(opts.profile, a.assetProfile));

  const policy = policyRegistry(a, signer);
  const current = Number(await policy.statusOf(a.rwaToken));
  console.log(`RWA manifest current status: ${current} (${POLICY_STATUS[current] ?? "?"})`);
  // registerManifest only accepts UNKNOWN(0) or RETIRED(5). Retire an in-flight
  // ACTIVE(2)/SUSPENDED(3) manifest first (RFQFlow.t.sol precedent).
  if (current === 2 || current === 3) {
    console.log("  manifest in-flight — retiring before re-onboarding");
    await logTx(await policy.retireManifest(a.rwaToken, encodeBytes32String("CLI-REONBOARD")), "retire");
    // A separate forge broadcast may have advanced the account nonce while
    // this process was starting. Refresh before the follow-up factory call.
    (signer as NonceManager).reset();
  } else if (current === 4) {
    throw new CliError("manifest is PROPOSED; approve or wait — cannot re-onboard from PROPOSED");
  }

  const m = [
    2,
    0,
    0,
    0,
    0,
    mask,
    0,
    binding.factsPacked,
    0,
    binding.fullManifestHash,
    ZERO_ADDR,
    ZERO_ADDR
  ];
  const venueCfg = [0, a.ammAdapter, a.pool, ZERO_ADDR, 1, true]; // AMM, custody POOL
  const nextNonce = await provider.getTransactionCount(await signer.getAddress(), "latest");
  await logTx(
    await factory(a, walletForAccount(0).connect(provider)).registerRWAToken(a.rwaToken, m, binding.bindings, a.pool, venueCfg, {nonce: nextNonce}),
    "registerRWAToken"
  );
  console.log(`Onboarded ${binding.profile} RWA ${a.rwaToken} with supportedEngines 0b${mask.toString(2).padStart(3, "0")} + AMM venue ${a.pool}`);
}

// ---------------------------------------------------------------------------
// manifest <status|suspend|resume|retire>
// ---------------------------------------------------------------------------
export async function cmdManifest(action: string, opts: GlobalOpts & {reason?: string}): Promise<void> {
  const a = loadArtifact(opts.artifact);
  const provider = makeProvider(opts);
  const reason = encodeBytes32String((opts.reason ?? "CLI-ACTION").slice(0, 31));

  if (action === "status") {
    const cur = Number(await policyRegistry(a, provider).statusOf(a.rwaToken));
    console.log(`RWA manifest status: ${cur} (${POLICY_STATUS[cur] ?? "?"})`);
    return;
  }

  const signer = resolveSigner(opts, provider, 0); // operator
  const policy = policyRegistry(a, signer);
  switch (action) {
    case "suspend":
      await logTx(await policy.suspendManifest(a.rwaToken, reason), "suspendManifest");
      break;
    case "resume":
      {
        const pending = await policy.pendingManifestResumeOf(a.rwaToken);
        const effectiveTime = Number(pending.effectiveTime);
        if (effectiveTime === 0) {
          await logTx(await factory(a, signer).scheduleManifestResume(a.rwaToken, reason), "scheduleManifestResume");
          const delay = Number(await policy.MIN_MANIFEST_DELAY());
          console.log(`  resume scheduled; run the same command again after ${delay}s timelock`);
          return;
        }
        const latest = await provider.getBlock("latest");
        if (!latest || latest.timestamp < effectiveTime) {
          throw new CliError(`manifest resume timelock not ready; effective at unix ${effectiveTime}`);
        }
        await logTx(await policy.resumeManifest(a.rwaToken), "resumeManifest");
      }
      break;
    case "retire":
      await logTx(await policy.retireManifest(a.rwaToken, reason), "retireManifest");
      break;
    default:
      throw new CliError(`unknown manifest action "${action}" (status|suspend|resume|retire)`);
  }
  const cur = Number(await policyRegistry(a, provider).statusOf(a.rwaToken));
  console.log(`  new status: ${cur} (${POLICY_STATUS[cur] ?? "?"})`);
}

// ---------------------------------------------------------------------------
// attest <element> <subject> [value...]
// ---------------------------------------------------------------------------
function elementContract(a: Artifact, id: string, signer: any, regRunner: any): Promise<Contract> {
  return elementRegistry(a, regRunner)
    .elementOf(encodeBytes32String(id))
    .then((addr: string) => {
      if (addr === ZERO_ADDR) throw new CliError(`element ${id} not registered in ElementRegistry`);
      return new Contract(addr, ELEMENT_SETTERS_ABI, signer);
    });
}

export async function cmdAttest(element: string, subject: string, values: string[], opts: GlobalOpts): Promise<void> {
  const a = loadArtifact(opts.artifact);
  const provider = makeProvider(opts);
  const signer = resolveSigner(opts, provider, 0); // operator
  const id = ELEMENT_IDS[element];
  if (!id) throw new CliError(`unknown element "${element}". Known: ${Object.keys(ELEMENT_IDS).join(", ")}`);
  const contract = await elementContract(a, id, signer, provider);
  const {tx, description} = await applyAttestation(element, contract, subject, values);
  await logTx(tx, description);
}

// ---------------------------------------------------------------------------
// investor-setup <addr>
// ---------------------------------------------------------------------------
export async function cmdInvestorSetup(subject: string, opts: GlobalOpts & {fund?: string; profile?: string}): Promise<void> {
  const a = loadArtifact(opts.artifact);
  const provider = makeProvider(opts);
  const signer = resolveSigner(opts, provider, 0); // operator
  const reg = provider;

  const profile = resolveAssetProfileForArtifact(opts.profile, a.assetProfile);
  console.log(`Investor-side ${profile} happy-path setup for ${subject}`);
  // jurisdiction: US + allow US
  const jur = await elementContract(a, "A-02-v1", signer, reg);
  await logTx(await jur.setJurisdictionAllowed(encodeBytes32String(ALLOWED_JURISDICTION), true), `jurisdiction.setJurisdictionAllowed("${ALLOWED_JURISDICTION}", true)`);
  await logTx(await jur.setJurisdiction(subject, encodeBytes32String(ALLOWED_JURISDICTION)), `jurisdiction.setJurisdiction(${subject}, "${ALLOWED_JURISDICTION}")`);
  // identity bind (matches deploy-time id derivation)
  const ident = await elementContract(a, "A-04-v1", signer, reg);
  await logTx(await ident.bindIdentity(subject, defaultIdentityId(subject)), `identity.bindIdentity(${subject})`);
  // accredited
  const acc = await elementContract(a, "A-03-v1", signer, reg);
  await logTx(await acc.setAccredited(subject, true), `accredited.setAccredited(${subject}, true)`);
  if (profile === "buidl-like") {
    const qp = await elementContract(a, "A-13-v1", signer, reg);
    await logTx(await qp.setQp(subject, true), `qp.setQp(${subject}, true)`);
  }
  // sanctions clear
  const san = await elementContract(a, "A-01-v1", signer, reg);
  await logTx(await san.setBlocked(subject, false), `sanctions.setBlocked(${subject}, false)`);

  // C-01 Rule 144 lockup: seed a PII-free, expiring mock TA snapshot at t=1 so
  // the elapsed demo lockup passes. Production uses a verified provider adapter.
  const lockupAddr = await elementRegistry(a, reg).elementOf(encodeBytes32String("C-01-v1"));
  const acqAddr = await new Contract(lockupAddr, LOCKUP_ABI, reg).acquisitionSource();
  const acq = new Contract(acqAddr, ACQ_SOURCE_ABI, signer);
  const latest = await provider.getBlock("latest");
  if (!latest) throw new CliError("cannot read latest block for acquisition snapshot expiry");
  await logTx(
    await acq.setSnapshot(subject, a.rwaToken, 1, latest.timestamp + 30 * 24 * 60 * 60, encodeBytes32String("CLI-DEMO-TA"), 1),
    `lockup.acquisitionSource.setSnapshot(${subject}, rwa)`
  );

  // fund the buyer with QUOTE so it can trade (MockERC20.mint is permissionless).
  const fund = parseEther(opts.fund ?? (profile === "buidl-like" ? "20000000" : "5000"));
  await logTx(await erc20(a.quote, signer).mint(subject, fund), `quote.mint(${subject}, ${formatEther(fund)})`);
  console.log("Investor attestations applied. Run `corner-store kyc <addr>` to add the ERC-3643 identity/claim.");
}

// ---------------------------------------------------------------------------
// kyc <addr> — shells out to the forge script (ERC-3643 identity + claim)
// ---------------------------------------------------------------------------
export async function cmdKyc(subject: string, opts: GlobalOpts): Promise<void> {
  const artifactPath = resolveArtifactPath(opts.artifact);
  const rpc = opts.rpc ?? DEFAULT_RPC;
  // Run forge from the repo root so relative fs_permissions + the source path
  // resolve; pass the artifact as a root-relative path.
  const repoRoot = findRepoRoot(process.cwd()) ?? findRepoRoot(__dirname);
  if (!repoRoot) throw new CliError("could not locate the repo root (foundry.toml) to run the forge KYC script");
  const relArtifact = relative(repoRoot, artifactPath);
  console.log(`Deploying ERC-3643 identity + KYC claim for ${subject} via forge script (cwd=${repoRoot})`);
  const env = {...process.env, SUBJECT: subject, ARTIFACT: relArtifact};
  try {
    const out = execFileSync(
      "forge",
      ["script", "script/KycInvestor.s.sol:KycInvestor", "--rpc-url", rpc, "--broadcast", "--offline"],
      {env, encoding: "utf8", cwd: repoRoot}
    );
    console.log(out.trim());
  } catch (e: any) {
    throw new CliError(`forge KycInvestor script failed:\n${e.stdout ?? ""}${e.stderr ?? e.message}`);
  }
  console.log(`KYC complete for ${subject}`);
}

// ---------------------------------------------------------------------------
// buy <amountIn> [--venue amm|rfq] [--min <amountOut>] [--quote <file>]
// ---------------------------------------------------------------------------
export async function cmdBuy(
  amountInArg: string,
  opts: GlobalOpts & {venue?: string; min?: string; quote?: string}
): Promise<void> {
  const a = loadArtifact(opts.artifact);
  const provider = makeProvider(opts);
  const signer = resolveSigner(opts, provider, 1); // buyer/taker
  const buyer = await signer.getAddress();
  const venue = (opts.venue ?? "amm").toLowerCase();
  const nonce = BigInt(Date.now());
  const rwaBefore = await erc20(a.rwaToken, provider).balanceOf(buyer);

  let ctx: any[];
  let venueData: string;
  let amountOutMin: bigint;
  let adapterForApproval: string;
  let amountIn: bigint;

  if (venue === "rfq") {
    if (!opts.quote) throw new CliError("--quote <file> is required for --venue rfq");
    const qf = readQuoteFile(opts.quote);
    const q = qf.quote;
    amountIn = BigInt(q.amountIn);
    const amountOut = BigInt(q.amountOut);
    if (q.taker.toLowerCase() !== buyer.toLowerCase()) {
      throw new CliError(`quote taker ${q.taker} != signer ${buyer}; run buy as the quote's taker (--account/--key)`);
    }
    amountOutMin = opts.min ? parseEther(opts.min) : amountOut;
    ctx = [buyer, buyer, q.maker, q.tokenIn, q.tokenOut, amountIn, amountOut, 2, q.venue, 0, false];
    venueData = encodeVenueData(q, qf.signature);
    adapterForApproval = a.rfqAdapter;
  } else if (venue === "amm") {
    amountIn = parseEther(amountInArg);
    const amountOut = amountIn; // 1:1 MockPool
    amountOutMin = opts.min ? parseEther(opts.min) : 0n;
    ctx = [buyer, buyer, a.pool, a.quote, a.rwaToken, amountIn, amountOut, 0, a.pool, 0, false];
    venueData = "0x";
    adapterForApproval = a.ammAdapter;
  } else {
    throw new CliError(`unknown venue "${venue}" (amm|rfq)`);
  }

  // ensure the buyer has approved the adapter to pull QUOTE (tokenIn).
  const quoteToken = erc20(a.quote, signer);
  const allowance: bigint = await quoteToken.allowance(buyer, adapterForApproval);
  if (allowance < amountIn) {
    console.log(`  approving ${adapterForApproval} to spend QUOTE`);
    await logTx(await quoteToken.approve(adapterForApproval, (1n << 256n) - 1n), "approve");
  }

  const latest = await provider.getBlock("latest");
  if (!latest) throw new CliError("cannot read latest block for execution deadline");
  const req = [ctx, amountOutMin, BigInt(latest.timestamp + 3600), nonce, venueData];
  console.log(`Executing ${venue.toUpperCase()} buy: amountIn=${formatEther(amountIn)} as ${buyer}`);
  await logTx(await router(a, signer).execute(req), "execute");

  const rwaAfter = await erc20(a.rwaToken, provider).balanceOf(buyer);
  console.log(`  RWA balance delta: +${formatEther(rwaAfter - rwaBefore)}`);
}

// ---------------------------------------------------------------------------
// rfq-quote --maker-account N --amount-in X --amount-out Y [--expiry sec] [--out file]
// ---------------------------------------------------------------------------
export async function cmdRfqQuote(opts: GlobalOpts & {
  backend?: string;
  makerAccount?: string;
  amountIn?: string;
  amountOut?: string;
  expiry?: string;
  taker?: string;
  out?: string;
}): Promise<void> {
  const a = loadArtifact(opts.artifact);
  if (!opts.amountIn) throw new CliError("--amount-in is required");
  const taker = opts.taker ?? a.investor;
  const ttl = opts.expiry ? Number(opts.expiry) : 3600;
  if (!Number.isSafeInteger(ttl) || ttl <= 0) throw new CliError("--expiry must be a positive integer");
  const amountIn = parseEther(opts.amountIn).toString();

  let signed: SignedRFQQuote;
  if (opts.backend) {
    if (opts.makerAccount !== undefined || opts.amountOut !== undefined) {
      throw new CliError("--backend cannot be combined with --maker-account or --amount-out");
    }
    signed = await requestBackendQuote(opts.backend, {taker, amountIn, ttlSeconds: ttl});
    validateBackendQuote(signed, a, taker, amountIn);
  } else {
    const provider = makeProvider(opts);
    if (opts.makerAccount === undefined) throw new CliError("--maker-account is required without --backend");
    if (!opts.amountOut) throw new CliError("--amount-out is required without --backend");
    const maker = walletForAccount(Number(opts.makerAccount)).connect(provider);

    const service = new RFQQuoteService(
      {
        chainId: DEFAULT_CHAIN_ID,
        verifyingContract: a.rfqAdapter as `0x${string}`,
        defaultTtlSeconds: ttl,
        now: async () => {
          const latest = await provider.getBlock("latest");
          if (!latest) throw new CliError("cannot read latest block for RFQ expiry");
          return latest.timestamp;
        }
      },
      new WalletTypedDataSigner(maker)
    );
    signed = await service.createSignedQuote({
      maker: (await maker.getAddress()) as `0x${string}`,
      taker: taker as `0x${string}`,
      tokenIn: a.quote as `0x${string}`,
      tokenOut: a.rwaToken as `0x${string}`,
      amountIn,
      amountOut: parseEther(opts.amountOut).toString(),
      venue: a.rfqVenue as `0x${string}`,
      ttlSeconds: ttl
    });
  }

  const out = opts.out ?? "quote.json";
  writeQuoteFile(out, signed);
  console.log(`Signed RFQ quote written to ${out}`);
  console.log(`  maker=${signed.quote.maker} taker=${signed.quote.taker}`);
  console.log(`  amountIn=${formatEther(signed.quote.amountIn)} amountOut=${formatEther(signed.quote.amountOut)} nonce=${signed.quote.nonce} expiry=${signed.quote.expiry}`);
}

function validateBackendQuote(signed: SignedRFQQuote, a: Artifact, taker: string, amountIn: string): void {
  const q = signed.quote;
  const expected = [
    [q.taker, taker, "taker"],
    [q.tokenIn, a.quote, "tokenIn"],
    [q.tokenOut, a.rwaToken, "tokenOut"],
    [q.venue, a.rfqVenue, "venue"]
  ] as const;
  for (const [actual, wanted, field] of expected) {
    if (typeof actual !== "string" || actual.toLowerCase() !== wanted.toLowerCase()) {
      throw new CliError(
        `backend quote ${field} does not match the deployment artifact ` +
          `(received ${String(actual)}, expected ${wanted})`
      );
    }
  }
  if (q.amountIn !== amountIn) throw new CliError("backend quote amountIn does not match the request");
  if (signed.typedData?.domain?.chainId !== DEFAULT_CHAIN_ID) throw new CliError("backend quote chainId is not 31337");
  if (signed.typedData?.domain?.verifyingContract?.toLowerCase() !== a.rfqAdapter.toLowerCase()) {
    throw new CliError("backend quote verifyingContract does not match RFQAdapter");
  }
  const recovered = verifyTypedData(signed.typedData.domain, RFQ_QUOTE_TYPES, q, signed.signature);
  if (recovered.toLowerCase() !== q.maker.toLowerCase()) throw new CliError("backend quote signature does not match maker");
}

// ---------------------------------------------------------------------------
// rfq-cancel <nonce> --maker-account N
// ---------------------------------------------------------------------------
export async function cmdRfqCancel(nonce: string, opts: GlobalOpts & {makerAccount?: string}): Promise<void> {
  const a = loadArtifact(opts.artifact);
  const provider = makeProvider(opts);
  if (opts.makerAccount === undefined) throw new CliError("--maker-account <0-9> is required");
  const maker = walletForAccount(Number(opts.makerAccount)).connect(provider);
  await logTx(await rfqAdapter(a, maker).cancelQuoteNonce(BigInt(nonce)), `cancelQuoteNonce(${nonce})`);
  console.log(`Cancelled RFQ nonce ${nonce} for maker ${await maker.getAddress()}`);
}

// ---------------------------------------------------------------------------
// maker <approve|revoke> <addr>
// ---------------------------------------------------------------------------
export async function cmdMaker(action: string, addr: string, opts: GlobalOpts): Promise<void> {
  const a = loadArtifact(opts.artifact);
  const provider = makeProvider(opts);
  const signer = resolveSigner(opts, provider, 0); // operator
  let approved: boolean;
  if (action === "approve") approved = true;
  else if (action === "revoke") approved = false;
  else throw new CliError(`unknown maker action "${action}" (approve|revoke)`);
  await logTx(await rfqAdapter(a, signer).setMakerApproved(addr, approved), `setMakerApproved(${addr}, ${approved})`);
}

// ---------------------------------------------------------------------------
// reason <bytes32>
// ---------------------------------------------------------------------------
export function cmdReason(code: string, opts: {json?: boolean}): void {
  const decoded = decodeReason(code);
  if (opts.json) {
    console.log(JSON.stringify(decoded, null, 2));
    if (decoded.label === "unknown code") process.exitCode = 1;
    return;
  }
  console.log(`${decoded.code}`);
  console.log(`  -> ${decoded.label}`);
  if (decoded.label === "unknown code") process.exitCode = 1;
}

// ---------------------------------------------------------------------------
// check <buyer> [--venue amm|rfq] [--amount <n>] [--json]
// ---------------------------------------------------------------------------
// Elements whose check() ignores its `user` argument and gates purely on the
// asset (see src/compliance/elements/{AssetClassification,Erc3643Native,
// FormDFiling}.sol). Labelled asset-side so a per-buyer FAIL isn't misread.
const ASSET_SIDE_ELEMENTS = new Set(["B-01-v1", "B-02-v1", "E-01-v1"]);

export async function cmdCheck(
  buyer: string,
  opts: GlobalOpts & {venue?: string; amount?: string; json?: boolean}
): Promise<void> {
  const a = loadArtifact(opts.artifact);
  const provider = makeProvider(opts);
  const venue = (opts.venue ?? "amm").toLowerCase();
  if (venue !== "amm" && venue !== "rfq") throw new CliError(`unknown venue "${venue}" (amm|rfq)`);
  const amount = parseEther(opts.amount ?? "1");
  const seller = a.pool; // buy direction: the RWA counterparty is the AMM pool
  const venueType = venue === "rfq" ? 2 : 0;
  const venueAddr = venue === "rfq" ? a.rfqVenue : a.pool;

  // Buy-direction context: tokenIn=QUOTE, tokenOut=RWA. The engine screens
  // ctx.buyer for investor elements (documented non-direction-aware limitation).
  const ctx = [buyer, buyer, seller, a.quote, a.rwaToken, amount, amount, venueType, venueAddr, 0, false];

  // Active manifest's recipe ids -> requiredElements -> element addresses.
  const policy = policyRegistry(a, provider);
  const manifest = await policy.manifestOf(a.rwaToken);
  const bindings: any[] = await policy.recipeBindingsOf(a.rwaToken);
  const status = Number(manifest.status);
  const recipeIds: number[] = [];
  const coder = require("ethers").AbiCoder.defaultAbiCoder();
  const elementContext = coder.encode([CTX_TUPLE], [ctx]);
  const recipeContext = coder.encode(["uint256", CTX_TUPLE], [manifest.factsPacked, ctx]);

  const reg = elementRegistry(a, provider);
  const recipeReg = recipeRegistry(a, provider);
  const seen = new Set<string>();
  const rows: Array<{
    id: string;
    label: string;
    assetSide: boolean;
    recipeId: number;
    passed: boolean;
    reason?: string;
  }> = [];
  for (const binding of bindings) {
    const rid = bindingRecipeId(binding);
    const recipeAddr = await recipeReg.recipeOf(rid);
    if (recipeAddr === ZERO_ADDR) throw new CliError(`recipe ${rid} not registered in RecipeRegistry`);
    const recipe = new Contract(recipeAddr, RECIPE_ABI, provider);
    const actualVersion = Number(await recipe.version());
    if (actualVersion !== bindingRecipeVersion(binding)) {
      throw new CliError(`recipe ${rid} version mismatch: binding=${bindingRecipeVersion(binding)}, registry=${actualVersion}`);
    }
    if (!(await recipe.isApplicable(recipeContext))) continue;
    recipeIds.push(rid);
    const requiredIds: string[] = await recipe.requiredElements();
    for (const raw of requiredIds) {
      const idStr = decodeBytes32String(raw);
      if (seen.has(idStr)) continue;
      seen.add(idStr);
      const label = ELEMENT_LABELS[idStr] ?? "?";
      const assetSide = ASSET_SIDE_ELEMENTS.has(idStr);
      const elAddr = await reg.elementOf(raw);
      if (elAddr === ZERO_ADDR) {
        rows.push({id: idStr, label, assetSide, recipeId: rid, passed: false, reason: "element not registered"});
        continue;
      }
      try {
        const [passed] = await new Contract(elAddr, ELEMENT_ABI, provider).check(
          buyer,
          seller,
          a.rwaToken,
          amount,
          elementContext
        );
        // The recipe-aware reason the engine would report for THIS element.
        const reason = passed ? undefined : decodeReason(encodeReason(rid, idStr, 1)).label;
        rows.push({id: idStr, label, assetSide, recipeId: rid, passed, reason});
      } catch (e: any) {
        rows.push({
          id: idStr,
          label,
          assetSide,
          recipeId: rid,
          passed: false,
          reason: `check reverted: ${e?.shortMessage ?? e?.message ?? e}`
        });
      }
    }
  }

  // Overall verdict from the engine's view evaluate over the full context.
  const decision = await engine(a, provider).evaluate(ctx);
  const allowed: boolean = decision.allowed;
  const verdictReason = allowed ? undefined : decodeReason(String(decision.reasonCode)).label;

  if (opts.json) {
    console.log(
      JSON.stringify(
        {
          buyer,
          venue,
          amount: formatEther(amount),
          seller,
          manifest: {status, statusName: POLICY_STATUS[status] ?? "?"},
          bindings: bindings.map(bindingJson),
          recipes: recipeIds.map((r) => ({id: r, name: RECIPE_LABELS[r] ?? "?"})),
          elements: rows,
          verdict: {
            allowed,
            reasonCode: String(decision.reasonCode),
            reason: verdictReason,
            flagsBitmap: decision.flagsBitmap.toString()
          }
        },
        null,
        2
      )
    );
    if (!allowed) process.exitCode = 1;
    return;
  }

  console.log(`Preflight for ${buyer}`);
  console.log(`  venue=${venue}  amount=${formatEther(amount)}  seller/counterparty=${seller}`);
  console.log(
    `  manifest status ${status} (${POLICY_STATUS[status] ?? "?"}); bindings: ${
      bindings.map(bindingSummary).join(", ") || "none"
    }`
  );
  console.log("");
  console.log("Per-element checks (asset-side rows gate on the asset, not the subject — a FAIL there is asset state):");
  for (const r of rows) {
    const tag = r.assetSide ? "  [asset-side]" : "";
    const reason = r.passed ? "" : `  -> ${r.reason}`;
    console.log(`  [${r.passed ? "PASS" : "FAIL"}] ${r.id.padEnd(8)} ${r.label.padEnd(22)}${tag}${reason}`);
  }
  console.log("");
  if (allowed) {
    console.log(`Engine verdict: ALLOWED  flagsBitmap=${decision.flagsBitmap.toString()}`);
  } else {
    console.log(`Engine verdict: REJECTED  ${String(decision.reasonCode)}  -> ${verdictReason}  flagsBitmap=${decision.flagsBitmap.toString()}`);
    process.exitCode = 1;
  }
}

// ---------------------------------------------------------------------------
// sell <amountIn> [--min <amountOut>]
// ---------------------------------------------------------------------------
export async function cmdSell(amountInArg: string, opts: GlobalOpts & {min?: string}): Promise<void> {
  const a = loadArtifact(opts.artifact);
  const provider = makeProvider(opts);
  const signer = resolveSigner(opts, provider, 1); // seller defaults to the investor
  const seller = await signer.getAddress();
  const nonce = BigInt(Date.now());

  const amountIn = parseEther(amountInArg);
  const amountOut = amountIn; // 1:1 MockPool
  const amountOutMin = opts.min ? parseEther(opts.min) : 0n;

  // SELL direction — mirror of `buy` with the token sides swapped, following
  // test/integration/SwapFlow.t.sol::test_sell_shaped_success: tokenIn=RWA,
  // tokenOut=QUOTE; ctx.buyer is the SELLER (the engine screens ctx.buyer, not a
  // direction); venueData encodes zeroForOne=false so the pool pays token0(QUOTE).
  const ctx = [seller, seller, a.pool, a.rwaToken, a.quote, amountIn, amountOut, 0, a.pool, 0, false];
  const venueData = AbiCoder.defaultAbiCoder().encode(["bool", "uint160"], [false, 0]);

  // The seller must approve the adapter to pull RWA (tokenIn).
  const rwa = erc20(a.rwaToken, signer);
  const allowance: bigint = await rwa.allowance(seller, a.ammAdapter);
  if (allowance < amountIn) {
    console.log(`  approving ${a.ammAdapter} to spend RWA`);
    await logTx(await rwa.approve(a.ammAdapter, (1n << 256n) - 1n), "approve");
  }

  const rwaBefore = await erc20(a.rwaToken, provider).balanceOf(seller);
  const quoteBefore = await erc20(a.quote, provider).balanceOf(seller);
  const latest = await provider.getBlock("latest");
  if (!latest) throw new CliError("cannot read latest block for execution deadline");
  const req = [ctx, amountOutMin, BigInt(latest.timestamp + 3600), nonce, venueData];
  console.log(`Executing AMM sell: amountIn=${formatEther(amountIn)} RWA as ${seller}`);
  await logTx(await router(a, signer).execute(req), "execute");

  const rwaAfter = await erc20(a.rwaToken, provider).balanceOf(seller);
  const quoteAfter = await erc20(a.quote, provider).balanceOf(seller);
  console.log(`  RWA balance delta:   ${formatEther(rwaAfter - rwaBefore)}`);
  console.log(`  QUOTE balance delta: +${formatEther(quoteAfter - quoteBefore)}`);
}

// ---------------------------------------------------------------------------
// balances [addr...]
// ---------------------------------------------------------------------------
const ROLE_LABELS = ["deployer/operator", "investor", "maker", "unapproved-maker", "free"];

export async function cmdBalances(addrs: string[], opts: GlobalOpts & {json?: boolean}): Promise<void> {
  const a = loadArtifact(opts.artifact);
  const provider = makeProvider(opts);
  const targets: Array<{label: string; address: string}> =
    addrs.length > 0
      ? addrs.map((x) => ({label: "-", address: x}))
      : ROLE_LABELS.map((label, i) => ({label, address: walletForAccount(i).address}));

  const rwa = erc20(a.rwaToken, provider);
  const quote = erc20(a.quote, provider);
  const rows: Array<{
    label: string;
    address: string;
    rwa: bigint;
    quote: bigint;
    rwaAmm: bigint;
    quoteAmm: bigint;
    rwaRfq: bigint;
    quoteRfq: bigint;
  }> = [];
  for (const t of targets) {
    const [rwaBal, quoteBal, rwaAmm, quoteAmm, rwaRfq, quoteRfq] = await Promise.all([
      rwa.balanceOf(t.address),
      quote.balanceOf(t.address),
      rwa.allowance(t.address, a.ammAdapter),
      quote.allowance(t.address, a.ammAdapter),
      rwa.allowance(t.address, a.rfqAdapter),
      quote.allowance(t.address, a.rfqAdapter)
    ]);
    rows.push({...t, rwa: rwaBal, quote: quoteBal, rwaAmm, quoteAmm, rwaRfq, quoteRfq});
  }

  if (opts.json) {
    console.log(
      JSON.stringify(
        rows.map((r) => ({
          label: r.label,
          address: r.address,
          rwa: formatEther(r.rwa),
          quote: formatEther(r.quote),
          allowances: {
            ammAdapter: {rwa: formatEther(r.rwaAmm), quote: formatEther(r.quoteAmm)},
            rfqAdapter: {rwa: formatEther(r.rwaRfq), quote: formatEther(r.quoteRfq)}
          }
        })),
        null,
        2
      )
    );
    return;
  }

  const fmtAllow = (v: bigint) => (v >= 1n << 255n ? "MAX" : formatEther(v));
  console.log("Balances (RWA / QUOTE) and adapter allowances — ether units, MAX = unlimited:");
  console.log(
    `  ${"account".padEnd(18)} ${"address".padEnd(42)} ${"RWA".padStart(12)} ${"QUOTE".padStart(12)}  amm(rwa/quote)  rfq(rwa/quote)`
  );
  for (const r of rows) {
    console.log(
      `  ${r.label.padEnd(18)} ${r.address} ${formatEther(r.rwa).padStart(12)} ${formatEther(r.quote).padStart(12)}  ` +
        `${fmtAllow(r.rwaAmm)}/${fmtAllow(r.quoteAmm)}  ${fmtAllow(r.rwaRfq)}/${fmtAllow(r.quoteRfq)}`
    );
  }
}

// ---------------------------------------------------------------------------
// faucet <addr> <amount> — mint QUOTE (MockERC20.mint is permissionless).
// ---------------------------------------------------------------------------
export async function cmdFaucet(addr: string, amount: string, opts: GlobalOpts): Promise<void> {
  const a = loadArtifact(opts.artifact);
  const provider = makeProvider(opts);
  const signer = resolveSigner(opts, provider, 0);
  const amt = parseEther(amount);
  await logTx(await erc20(a.quote, signer).mint(addr, amt), `quote.mint(${addr}, ${formatEther(amt)})`);
  const bal = await erc20(a.quote, provider).balanceOf(addr);
  console.log(`  ${addr} QUOTE balance: ${formatEther(bal)}`);
}

// ---------------------------------------------------------------------------
// watch [--from <block>] — live event tail.
// ---------------------------------------------------------------------------
const WATCH_EVENTS = [
  "Executed",
  "RFQFilled",
  "RFQQuoteCancelled",
  "MakerApprovalSet",
  "ManifestRegistered",
  "ManifestStatusChanged",
  "ComplianceFlags",
  "SurveillanceFlag"
];

// A reasonCode field can be a recipe-scoped ComplianceRejected code (reason
// table), a recipe-0 monitoring-flag code (e.g. SurveillanceFlag emits
// ReasonCodes.encode(0, elementId, 1)), or a short bytes32 label string (e.g. a
// manifest action reason). Try each in turn, else "unknown code".
function describeReasonCode(code: string): string {
  if (code === ZERO32) return "none";
  const lc = code.toLowerCase();
  const decoded = decodeReason(lc);
  if (decoded.label !== "unknown code") return decoded.label;
  for (const [elId, elLabel] of Object.entries(ELEMENT_LABELS)) {
    if (lc === encodeReason(0, elId, 1).toLowerCase()) return `monitoring flag / ${elId} -> ${elLabel}`;
  }
  try {
    const s = decodeBytes32String(code);
    if (s && /^[\x20-\x7e]+$/.test(s)) return `"${s}" (label)`;
  } catch {
    /* not a bytes32 string */
  }
  return "unknown code";
}

// Best-effort bytes32 -> short-string element id (e.g. "F-02-v1"); falls back to
// the raw hex if the value is not a clean printable string.
function bytes32Label(raw: string): string {
  try {
    const s = decodeBytes32String(raw);
    if (s && /^[\x20-\x7e]+$/.test(s)) return s;
  } catch {
    /* not a bytes32 string */
  }
  return raw;
}

function formatEvent(parsed: {name: string; args: any}): string {
  const {name, args} = parsed;
  switch (name) {
    case "Executed":
      return `Executed          venue=${args.venue} amountOut=${formatEther(args.amountOut)} executionId=${args.executionId}`;
    case "RFQFilled":
      return `RFQFilled         maker=${args.maker} taker=${args.taker} amountIn=${formatEther(args.amountIn)} amountOut=${formatEther(args.amountOut)}`;
    case "RFQQuoteCancelled":
      return `RFQQuoteCancelled maker=${args.maker} nonce=${args.nonce}`;
    case "MakerApprovalSet":
      return `MakerApprovalSet  maker=${args.maker} approved=${args.approved}`;
    case "ManifestRegistered":
      return `ManifestRegistered token=${args.token} bindingsHash=${args.bindingsHash} declaredBy=${args.declaredBy}`;
    case "ManifestStatusChanged": {
      const s = Number(args.status);
      return `ManifestStatusChanged token=${args.token} status=${s} (${POLICY_STATUS[s] ?? "?"}) reason=${describeReasonCode(String(args.reasonCode))}`;
    }
    case "ComplianceFlags":
      return `ComplianceFlags    decisionHash=${args.decisionHash} flagsBitmap=${args.flagsBitmap}`;
    case "SurveillanceFlag": {
      const el = bytes32Label(String(args.elementId));
      const elLabel = ELEMENT_LABELS[el] ? ` (${ELEMENT_LABELS[el]})` : "";
      return `SurveillanceFlag  element=${el}${elLabel} subject=${args.subject} reason=${describeReasonCode(String(args.reasonCode))}`;
    }
    default:
      return name;
  }
}

export async function cmdWatch(opts: GlobalOpts & {from?: string}): Promise<void> {
  const a = loadArtifact(opts.artifact);
  const provider = makeProvider(opts);
  const iface = new Interface(EVENTS_ABI);
  const topic0 = WATCH_EVENTS.map((n) => iface.getEvent(n)!.topicHash);
  const addresses = [a.router, a.rfqAdapter, a.policyReg, a.factory, a.surveillance];

  const latest = await provider.getBlockNumber();
  let from = opts.from !== undefined ? Number(opts.from) : latest + 1;

  const poll = async () => {
    const tip = await provider.getBlockNumber();
    if (tip < from) return;
    const logs = await provider.getLogs({fromBlock: from, toBlock: tip, address: addresses, topics: [topic0]});
    logs.sort((x, y) => x.blockNumber - y.blockNumber || x.index - y.index);
    for (const log of logs) {
      let parsed;
      try {
        parsed = iface.parseLog({topics: [...log.topics], data: log.data});
      } catch {
        continue;
      }
      if (parsed) console.log(`[block ${log.blockNumber}] ${formatEvent(parsed)}`);
    }
    from = tip + 1;
  };

  console.log(`Watching events from block ${from} (Ctrl-C to stop)`);
  await poll();
  // eslint-disable-next-line no-constant-condition
  while (true) {
    await new Promise((r) => setTimeout(r, 2000));
    try {
      await poll();
    } catch (e: any) {
      console.error(`  poll error: ${e?.shortMessage ?? e?.message ?? e}`);
    }
  }
}

// ---------------------------------------------------------------------------
// snapshot / restore <id> — anvil evm_snapshot / evm_revert.
// ---------------------------------------------------------------------------
export async function cmdSnapshot(opts: GlobalOpts): Promise<void> {
  const provider = makeProvider(opts);
  let id: string;
  try {
    id = await provider.send("evm_snapshot", []);
  } catch (e: any) {
    throw new CliError(`evm_snapshot RPC unavailable (anvil/hardhat only): ${e?.shortMessage ?? e?.message ?? e}`);
  }
  console.log(`snapshot id: ${id}`);
  console.log(`  restore with: corner-store restore ${id}`);
  console.log("  note: a restore invalidates this and any LATER snapshot ids.");
}

export async function cmdRestore(id: string, opts: GlobalOpts): Promise<void> {
  const provider = makeProvider(opts);
  let ok: boolean;
  try {
    ok = await provider.send("evm_revert", [id]);
  } catch (e: any) {
    throw new CliError(`evm_revert RPC unavailable (anvil/hardhat only): ${e?.shortMessage ?? e?.message ?? e}`);
  }
  if (!ok) throw new CliError(`restore failed: snapshot ${id} not found (already reverted, or never taken?)`);
  console.log(`restored to snapshot ${id}`);
}

// ---------------------------------------------------------------------------
// quote-inspect <file>
// ---------------------------------------------------------------------------
export async function cmdQuoteInspect(file: string, opts: GlobalOpts & {json?: boolean}): Promise<void> {
  const a = loadArtifact(opts.artifact);
  const provider = makeProvider(opts);
  const qf = readQuoteFile(file);
  const q = qf.quote;

  // EOA recovery is diagnostic only. The Adapter's immutable authorizer is the
  // source of truth for direct maker, delegated and ERC-1271 signatures.
  const dom = rfqDomain(DEFAULT_CHAIN_ID, a.rfqAdapter as `0x${string}`);
  let recovered = "";
  try {
    recovered = verifyTypedData(dom, RFQ_QUOTE_TYPES, q, qf.signature);
  } catch (e: any) {
    recovered = `<recovery failed: ${e?.shortMessage ?? e?.message ?? e}>`;
  }

  const latest = await provider.getBlock("latest");
  if (!latest) throw new CliError("cannot read latest block for quote expiry");
  const now = latest.timestamp;
  const secsLeft = Number(q.expiry) - now;
  const expired = secsLeft <= 0;

  const rfq = rfqAdapter(a, provider);
  const [nonceUsed, makerApproved, authorizerAddress]: [boolean, boolean, string] = await Promise.all([
    rfq.usedQuoteNonce(q.maker, BigInt(q.nonce)),
    rfq.approvedMaker(q.maker),
    rfq.makerAuthorizer()
  ]);
  const authorizer = new Contract(authorizerAddress, MAKER_AUTHORIZER_ABI, provider);
  const quoteHash = TypedDataEncoder.hash(dom, RFQ_QUOTE_TYPES, q);
  const [sigOk, authorizerVersion]: [boolean, bigint] = await Promise.all([
    authorizer.isAuthorizedSigner(q.maker, quoteHash, qf.signature),
    authorizer.authorizerVersion()
  ]);

  const checks = [
    {
      name: "signature",
      pass: sigOk,
      detail: sigOk
        ? `authorizer v${authorizerVersion} accepts current signer (${recovered})`
        : `authorizer v${authorizerVersion} rejects current signer (${recovered})`
    },
    {name: "not-expired", pass: !expired, detail: expired ? `expired ${-secsLeft}s ago` : `${secsLeft}s remaining`},
    {
      name: "nonce-unused",
      pass: !nonceUsed,
      detail: nonceUsed ? "nonce already used/cancelled on-chain" : "nonce fresh on-chain"
    },
    {
      name: "maker-approved",
      pass: makerApproved,
      detail: makerApproved ? "maker on RFQ allowlist" : "maker NOT on RFQ allowlist"
    }
  ];
  const allPass = checks.every((c) => c.pass);

  if (opts.json) {
    console.log(
      JSON.stringify({file, quote: q, verifyingContract: a.rfqAdapter, recovered, checks, allPass}, null, 2)
    );
    if (!allPass) process.exitCode = 1;
    return;
  }

  console.log(`Quote ${file}  (verifyingContract=${a.rfqAdapter}, chainId=${DEFAULT_CHAIN_ID})`);
  for (const [k, v] of Object.entries(q)) console.log(`  ${k.padEnd(10)} ${v}`);
  console.log(`  signature  ${qf.signature}`);
  console.log("");
  console.log("Checks:");
  for (const c of checks) console.log(`  [${c.pass ? "PASS" : "FAIL"}] ${c.name.padEnd(15)} ${c.detail}`);
  if (!allPass) process.exitCode = 1;
}
