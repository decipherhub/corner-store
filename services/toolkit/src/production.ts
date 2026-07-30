import {createHash} from "crypto";
import {readFileSync} from "fs";
import {isAbsolute, resolve} from "path";

export const PRODUCTION_SCHEMA_VERSION = 1;
export const PRODUCTION_DEPLOY_SCRIPT = "script/DeployProductionCore.s.sol:DeployProductionCore";

export interface ProductionConfig {
  schemaVersion: number;
  network: {name: string; chainId: number; rpcUrl: string; approvedRpcHosts: string[]};
  release: {sourceCommit: string; contractsHash: string};
  deploymentId: string;
  deployer: string;
  operator: string;
  venues: {amm: boolean; rfq: boolean};
  safe: {
    address: string;
    expectedOwners: string[];
    threshold: number;
    expectedSingleton: string;
    proxyCodeHash: string;
  };
  deployment: {artifact: string; evidence: string};
  erc3643?: {token?: string};
}

export interface ProductionDeploymentEvidence {
  schemaVersion: number;
  configHash: string;
  sourceCommit: string;
  contractsHash: string;
  dryRun: {passed: boolean; chainId: number};
  forkSimulation: {passed: boolean; chainId: number; blockNumber: number};
  reviewedAt: string;
}

export interface ProductionDeploymentPlan {
  schema: "corner-store-production";
  script: string;
  rpcUrl: string;
  chainId: number;
  configHash: string;
  evidence: string;
  broadcast: boolean;
  command: string;
  warnings: string[];
}

export type ProductionSigner =
  | {kind: "none"}
  | {kind: "ledger"}
  | {kind: "account"; name: string};

const ADDRESS = /^0x[0-9a-fA-F]{40}$/;
const HASH32 = /^0x[0-9a-fA-F]{64}$/;
const SHA256 = /^sha256:[0-9a-f]{64}$/;
const COMMIT = /^[0-9a-f]{40}$/;
const SECRET_KEY = /(private_?key|mnemonic|seed|secret|signer_?secret|signer_?key|raw_?key)/i;
const SECRET_VALUE = /^0x[0-9a-fA-F]{64}$/;

export function validateProductionConfig(value: unknown): ProductionConfig {
  rejectSignerSecrets(value, "config");
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("production config must be an object");
  const c = value as Partial<ProductionConfig>;
  if (c.schemaVersion !== PRODUCTION_SCHEMA_VERSION) throw new Error(`schemaVersion must be ${PRODUCTION_SCHEMA_VERSION}`);
  if (!c.network || typeof c.network.name !== "string" || c.network.name.length === 0) {
    throw new Error("network.name is required");
  }
  if (!Number.isSafeInteger(c.network.chainId) || c.network.chainId <= 0) throw new Error("network.chainId must be a positive integer");
  if (typeof c.network.rpcUrl !== "string" || !/^https?:\/\//.test(c.network.rpcUrl)) {
    throw new Error("network.rpcUrl must use http(s)");
  }
  if (!Array.isArray(c.network.approvedRpcHosts) || c.network.approvedRpcHosts.length === 0) {
    throw new Error("network.approvedRpcHosts must contain at least one host");
  }
  const rpcHost = new URL(c.network.rpcUrl).hostname.toLowerCase();
  const approvedHosts = c.network.approvedRpcHosts.map((host) => {
    if (typeof host !== "string" || !/^[a-zA-Z0-9.-]+$/.test(host)) {
      throw new Error("network.approvedRpcHosts must contain hostnames only");
    }
    return host.toLowerCase();
  });
  if (new Set(approvedHosts).size !== approvedHosts.length) {
    throw new Error("network.approvedRpcHosts must not contain duplicates");
  }
  if (!approvedHosts.includes(rpcHost)) {
    throw new Error(`network.rpcUrl host ${rpcHost} is not in network.approvedRpcHosts`);
  }
  if (!c.release || typeof c.release.sourceCommit !== "string" || !COMMIT.test(c.release.sourceCommit)) {
    throw new Error("release.sourceCommit must be a lowercase 40-character git commit");
  }
  if (typeof c.release.contractsHash !== "string" || !SHA256.test(c.release.contractsHash)) {
    throw new Error("release.contractsHash must be a sha256 hash");
  }
  if (typeof c.deploymentId !== "string" || !/^[a-zA-Z0-9][a-zA-Z0-9_.-]{0,63}$/.test(c.deploymentId)) {
    throw new Error("deploymentId is required and must be a conservative identifier");
  }
  if (!isAddress(c.deployer)) throw new Error("deployer must be a non-zero address");
  if (!isAddress(c.operator)) throw new Error("operator must be a non-zero address");
  if (!c.venues || typeof c.venues.amm !== "boolean" || typeof c.venues.rfq !== "boolean") {
    throw new Error("venues.amm and venues.rfq must be booleans");
  }
  if (!c.venues.amm && !c.venues.rfq) throw new Error("at least one production venue must be enabled");
  if (!c.safe || !isAddress(c.safe.address)) throw new Error("safe.address must be a non-zero address");
  if (!Array.isArray(c.safe.expectedOwners) || c.safe.expectedOwners.length === 0) {
    throw new Error("safe.expectedOwners must contain at least one owner");
  }
  const ownerSet = new Set<string>();
  for (const owner of c.safe.expectedOwners) {
    if (!isAddress(owner)) throw new Error("safe.expectedOwners must be non-zero addresses");
    const lower = owner.toLowerCase();
    if (ownerSet.has(lower)) throw new Error("safe.expectedOwners must not contain duplicates");
    ownerSet.add(lower);
  }
  if (!Number.isSafeInteger(c.safe.threshold) || c.safe.threshold < 1 || c.safe.threshold > c.safe.expectedOwners.length) {
    throw new Error("safe.threshold must be between 1 and safe.expectedOwners.length");
  }
  if (!isAddress(c.safe.expectedSingleton)) throw new Error("safe.expectedSingleton must be a non-zero address");
  if (typeof c.safe.proxyCodeHash !== "string" || !HASH32.test(c.safe.proxyCodeHash)) {
    throw new Error("safe.proxyCodeHash must be a 32-byte keccak256 hash");
  }
  if (!c.deployment || typeof c.deployment.artifact !== "string" || !isProductionArtifactPath(c.deployment.artifact)) {
    throw new Error("deployment.artifact must be deployments/<filename>.json");
  }
  if (typeof c.deployment.evidence !== "string" || !isProductionArtifactPath(c.deployment.evidence)) {
    throw new Error("deployment.evidence must be deployments/<filename>.json");
  }
  if (c.erc3643?.token !== undefined && !isAddress(c.erc3643.token)) {
    throw new Error("erc3643.token must be a non-zero address when provided");
  }
  return c as ProductionConfig;
}

export function loadProductionConfig(path: string): ProductionConfig {
  try {
    return validateProductionConfig(JSON.parse(readFileSync(path, "utf8")));
  } catch (err: any) {
    throw new Error(`invalid production config ${resolve(path)}: ${err.message}`);
  }
}

export function productionConfigHash(config: ProductionConfig): string {
  const selected = validateProductionConfig(config);
  const hashInput = {
    ...selected,
    network: {...selected.network, rpcUrl: "<runtime-rpc>"}
  };
  return `sha256:${createHash("sha256").update(canonicalJson(hashInput)).digest("hex")}`;
}

export function validateProductionDeploymentEvidence(
  value: unknown,
  config: ProductionConfig
): ProductionDeploymentEvidence {
  rejectSignerSecrets(value, "evidence");
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("production evidence must be an object");
  }
  const evidence = value as Partial<ProductionDeploymentEvidence>;
  if (evidence.schemaVersion !== 1) throw new Error("production evidence schemaVersion must be 1");
  const expectedHash = productionConfigHash(config);
  if (evidence.configHash !== expectedHash || !SHA256.test(evidence.configHash ?? "")) {
    throw new Error(`production evidence configHash must match ${expectedHash}`);
  }
  if (evidence.sourceCommit !== config.release.sourceCommit) {
    throw new Error("production evidence sourceCommit must match config release.sourceCommit");
  }
  if (evidence.contractsHash !== config.release.contractsHash) {
    throw new Error("production evidence contractsHash must match config release.contractsHash");
  }
  validateEvidenceRun("dryRun", evidence.dryRun, config.network.chainId, false);
  validateEvidenceRun("forkSimulation", evidence.forkSimulation, config.network.chainId, true);
  if (typeof evidence.reviewedAt !== "string" || Number.isNaN(Date.parse(evidence.reviewedAt))) {
    throw new Error("production evidence reviewedAt must be an ISO timestamp");
  }
  return evidence as ProductionDeploymentEvidence;
}

export function loadProductionDeploymentEvidence(
  path: string,
  config: ProductionConfig
): ProductionDeploymentEvidence {
  try {
    return validateProductionDeploymentEvidence(JSON.parse(readFileSync(path, "utf8")), config);
  } catch (err: any) {
    throw new Error(`invalid production evidence ${resolve(path)}: ${err.message}`);
  }
}

export function createProductionDeploymentPlan(
  config: ProductionConfig,
  signer: ProductionSigner = {kind: "none"},
  broadcast = false
): ProductionDeploymentPlan {
  const selected = validateProductionConfig(config);
  const env = [
    ["CORNER_STORE_DEPLOYER", selected.deployer],
    ["CORNER_STORE_GOVERNANCE", selected.safe.address],
    ["CORNER_STORE_OPERATOR", selected.operator],
    ["CORNER_STORE_ENABLE_AMM", selected.venues.amm ? "1" : "0"],
    ["CORNER_STORE_ENABLE_RFQ", selected.venues.rfq ? "1" : "0"],
    ["CORNER_STORE_DEPLOYMENT_ID", selected.deploymentId],
    ["CORNER_STORE_SOURCE_COMMIT", selected.release.sourceCommit],
    ["CORNER_STORE_CONTRACTS_HASH", selected.release.contractsHash],
    ["CORNER_STORE_ARTIFACT", selected.deployment.artifact]
  ];
  const args = [
    "forge",
    "script",
    PRODUCTION_DEPLOY_SCRIPT,
    "--rpc-url",
    selected.network.rpcUrl,
    "--chain-id",
    String(selected.network.chainId),
    "--sender",
    selected.deployer
  ];
  if (broadcast) args.push("--broadcast");
  if (signer.kind === "ledger") args.push("--ledger");
  if (signer.kind === "account") args.push("--account", signer.name);
  return {
    schema: "corner-store-production",
    script: PRODUCTION_DEPLOY_SCRIPT,
    rpcUrl: selected.network.rpcUrl,
    chainId: selected.network.chainId,
    configHash: productionConfigHash(selected),
    evidence: selected.deployment.evidence,
    broadcast,
    command: `${env.map(([key, value]) => `${key}=${shellQuote(value)}`).join(" ")} ${args.map(shellQuote).join(" ")}`,
    warnings: [
      "production plan does not include or accept signer secrets",
      broadcast
        ? "broadcast enabled: explicit confirmation and external Foundry signer are required"
        : "plan only: no transaction will be submitted"
    ]
  };
}

export function isProductionAddress(value: unknown): value is string {
  return isAddress(value);
}

function isAddress(value: unknown): value is string {
  return typeof value === "string" && ADDRESS.test(value) && !/^0x0{40}$/i.test(value);
}

function isProductionArtifactPath(value: string): boolean {
  if (value.length === 0 || value.includes("\0") || value.includes("\\") || isAbsolute(value)) return false;
  const parts = value.split("/");
  return parts.length === 2 &&
    parts[0] === "deployments" &&
    /^[a-zA-Z0-9][a-zA-Z0-9_.-]*\.json$/.test(parts[1]);
}

function validateEvidenceRun(
  name: string,
  value: unknown,
  expectedChainId: number,
  requireBlock: boolean
): void {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`production evidence ${name} is required`);
  }
  const run = value as {passed?: unknown; chainId?: unknown; blockNumber?: unknown};
  if (run.passed !== true) throw new Error(`production evidence ${name}.passed must be true`);
  if (run.chainId !== expectedChainId) {
    throw new Error(`production evidence ${name}.chainId must match config network.chainId`);
  }
  if (requireBlock && (!Number.isSafeInteger(run.blockNumber) || Number(run.blockNumber) <= 0)) {
    throw new Error(`production evidence ${name}.blockNumber must be a positive integer`);
  }
}

function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, entry]) => `${JSON.stringify(key)}:${canonicalJson(entry)}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

function rejectSignerSecrets(value: unknown, path: string): void {
  if (typeof value === "string") {
    const hashField = path.endsWith(".proxyCodeHash") || path.endsWith(".configHash");
    if (SECRET_VALUE.test(value) && !hashField) {
      throw new Error(`${path} must not contain signer secrets or raw private keys`);
    }
    return;
  }
  if (!value || typeof value !== "object") return;
  if (Array.isArray(value)) {
    value.forEach((entry, index) => rejectSignerSecrets(entry, `${path}[${index}]`));
    return;
  }
  for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
    const nextPath = `${path}.${key}`;
    if (SECRET_KEY.test(key)) throw new Error(`${nextPath} must not contain signer secrets or raw private keys`);
    rejectSignerSecrets(entry, nextPath);
  }
}

function shellQuote(value: string): string {
  return /^[a-zA-Z0-9_./:-]+$/.test(value) ? value : `'${value.replace(/'/g, "'\\''")}'`;
}
