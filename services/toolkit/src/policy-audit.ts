import {createHash} from "crypto";
import {existsSync, lstatSync, mkdirSync, readFileSync, writeFileSync} from "fs";
import {resolve} from "path";
import {keccak256} from "ethers";

export const POLICY_AUDIT_SCHEMA = "corner-store-policy-audit" as const;
export const POLICY_AUDIT_SCHEMA_VERSION = 1;
export const POLICY_AUDIT_HASH_DOMAIN = "corner-store.policy-audit.v1";

export interface PolicyAuditArtifact {
  schema: typeof POLICY_AUDIT_SCHEMA;
  schemaVersion: typeof POLICY_AUDIT_SCHEMA_VERSION;
  chainId: number;
  token: string;
  intendedPolicyVersion: string;
  lifecycleAction: "REGISTER" | "UPDATE";
  policy: {
    configHash: string;
    legalPackageHash: string;
    compiledPlanHash: string;
    manifest: {
      issuanceRecipeId: number;
      issuanceRecipeVersion: number;
      fundRecipeId: number;
      enabledResalePaths: number;
      supportedEngines: number;
      stateScopeId: number;
      factsPacked: string;
      coverageScope: string;
    };
    recipeBindings: PolicyAuditRecipeBinding[];
    enforcementOverrides: PolicyAuditEnforcementOverride[];
  };
  deployment: {
    complianceEngine: string;
    tokenPolicyRegistry: string;
    elementRegistry: string;
    recipeRegistry: string;
    runtimeCodeHashes: {
      complianceEngine: string;
      tokenPolicyRegistry: string;
      elementRegistry: string;
      recipeRegistry: string;
    };
  };
  elements: PolicyAuditElement[];
  recipes: PolicyAuditRecipe[];
  providerEvidence: PolicyAuditProviderEvidence[];
  evidenceChainHead: string;
  source: {
    toolVersion: string;
    sourceCommit: string;
  };
  previousArtifactHash?: string;
}

export interface PolicyAuditRecipeBinding {
  recipeKey: string;
  recipeId: number;
  recipeVersion: number;
  mode: number;
  pathGroupId: number;
  priority: number;
}

export interface PolicyAuditEnforcementOverride {
  bindingIndex: number;
  elementId: string;
  mode: number;
}

export interface PolicyAuditElement {
  bindingIndex: number;
  elementId: string;
  implementation: string;
  runtimeCodeHash: string;
  versionHash: string;
  metadataHash: string;
  evidenceType: number;
  defaultAction: number;
  parameterSchemaId: string;
  parameterSchemaVersion: number;
  parameters: string;
  parameterHash: string;
}

export interface PolicyAuditRecipe {
  recipeKey: string;
  recipeId: number;
  version: number;
  implementation: string;
  runtimeCodeHash: string;
  requiredElements: string[];
}

export interface PolicyAuditProviderEvidence {
  providerIdHash: string;
  evidenceHash: string;
  signatureRefHash: string;
  validUntil: string;
}

export interface PolicyAuditArtifactFile {
  artifactHash: string;
  onchainArtifactHash: string;
  artifact: PolicyAuditArtifact;
}

export interface PolicyAuditStore {
  put(file: PolicyAuditArtifactFile): string;
  get(artifactHash: string): PolicyAuditArtifactFile;
  exists(artifactHash: string): boolean;
}

export function canonicalPolicyAuditJson(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalPolicyAuditJson).join(",")}]`;
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record).sort().map((key) => `${JSON.stringify(key)}:${canonicalPolicyAuditJson(record[key])}`).join(",")}}`;
}

export function buildPolicyAuditArtifact(value: unknown): PolicyAuditArtifactFile {
  const artifact = validatePolicyAuditArtifact(value);
  const digest = createHash("sha256")
    .update(POLICY_AUDIT_HASH_DOMAIN, "utf8")
    .update(Buffer.from([0]))
    .update(canonicalPolicyAuditJson(artifact), "utf8")
    .digest("hex");
  return {artifactHash: `sha256:${digest}`, onchainArtifactHash: `0x${digest}`, artifact};
}

export function validatePolicyAuditArtifactFile(value: unknown, expectedHash?: string): PolicyAuditArtifactFile {
  assertObject(value, "policy audit file");
  assertKnownKeys(value, ["artifactHash", "onchainArtifactHash", "artifact"], "policy audit file");
  const candidate = value as Partial<PolicyAuditArtifactFile>;
  const built = buildPolicyAuditArtifact(candidate.artifact);
  if (candidate.artifactHash !== built.artifactHash || candidate.onchainArtifactHash !== built.onchainArtifactHash) {
    throw new Error("policy audit artifact hash mismatch");
  }
  if (expectedHash !== undefined && normalizeArtifactHash(expectedHash) !== built.artifactHash) {
    throw new Error(`policy audit artifact does not match expected hash ${expectedHash}`);
  }
  return built;
}

export function readPolicyAuditArtifact(path: string, expectedHash?: string): PolicyAuditArtifactFile {
  try {
    return validatePolicyAuditArtifactFile(JSON.parse(readFileSync(path, "utf8")), expectedHash);
  } catch (err: any) {
    throw new Error(`invalid policy audit artifact ${resolve(path)}: ${err.message}`);
  }
}

export class LocalPolicyAuditStore implements PolicyAuditStore {
  readonly root: string;

  constructor(root: string) {
    if (!root) throw new Error("policy audit store root is required");
    this.root = resolve(root);
  }

  put(file: PolicyAuditArtifactFile): string {
    const selected = validatePolicyAuditArtifactFile(file);
    const path = this.pathOf(selected.artifactHash);
    mkdirSync(resolve(this.root, "sha256"), {recursive: true, mode: 0o700});
    if (existsSync(path)) {
      const existing = this.get(selected.artifactHash);
      if (canonicalPolicyAuditJson(existing) !== canonicalPolicyAuditJson(selected)) {
        throw new Error(`immutable policy audit artifact already exists with different content: ${selected.artifactHash}`);
      }
      return path;
    }
    try {
      writeFileSync(path, `${canonicalPolicyAuditJson(selected)}\n`, {encoding: "utf8", flag: "wx", mode: 0o600});
    } catch (err: any) {
      if (err?.code !== "EEXIST") throw err;
      const existing = this.get(selected.artifactHash);
      if (canonicalPolicyAuditJson(existing) !== canonicalPolicyAuditJson(selected)) {
        throw new Error(`immutable policy audit artifact already exists with different content: ${selected.artifactHash}`);
      }
    }
    return path;
  }

  get(artifactHash: string): PolicyAuditArtifactFile {
    const normalized = normalizeArtifactHash(artifactHash);
    const path = this.pathOf(normalized);
    if (!existsSync(path)) throw new Error(`policy audit artifact not found: ${normalized}`);
    const stat = lstatSync(path);
    if (!stat.isFile() || stat.isSymbolicLink()) throw new Error(`policy audit artifact is not a regular file: ${normalized}`);
    return readPolicyAuditArtifact(path, normalized);
  }

  exists(artifactHash: string): boolean {
    const normalized = normalizeArtifactHash(artifactHash);
    const path = this.pathOf(normalized);
    if (!existsSync(path)) return false;
    this.get(normalized);
    return true;
  }

  private pathOf(artifactHash: string): string {
    const normalized = normalizeArtifactHash(artifactHash);
    return resolve(this.root, "sha256", `${normalized.slice("sha256:".length)}.json`);
  }
}

export function validatePolicyAuditArtifact(value: unknown): PolicyAuditArtifact {
  assertObject(value, "policy audit artifact");
  assertKnownKeys(value, ["schema", "schemaVersion", "chainId", "token", "intendedPolicyVersion", "lifecycleAction", "policy", "deployment", "elements", "recipes", "providerEvidence", "evidenceChainHead", "source", "previousArtifactHash"], "policy audit artifact");
  const a = value as PolicyAuditArtifact;
  if (a.schema !== POLICY_AUDIT_SCHEMA || a.schemaVersion !== POLICY_AUDIT_SCHEMA_VERSION) throw new Error("unsupported policy audit schema");
  assertUint(a.chainId, 256, "chainId", false);
  assertAddress(a.token, "token");
  assertUintString(a.intendedPolicyVersion, 64, "intendedPolicyVersion", false);
  if (a.lifecycleAction !== "REGISTER" && a.lifecycleAction !== "UPDATE") throw new Error("lifecycleAction must be REGISTER or UPDATE");
  validatePolicy(a.policy);
  validateDeployment(a.deployment);
  if (!Array.isArray(a.elements) || a.elements.length === 0 || a.elements.length > 256) throw new Error("elements must contain 1-256 entries");
  a.elements.forEach(validateElement);
  rejectDuplicates(a.elements.map((item) => `${item.bindingIndex}:${item.elementId.toLowerCase()}`), "elements");
  if (!Array.isArray(a.recipes) || a.recipes.length === 0 || a.recipes.length > 8) throw new Error("recipes must contain 1-8 entries");
  a.recipes.forEach(validateRecipe);
  rejectDuplicates(a.recipes.map((item) => `${item.recipeKey.toLowerCase()}:${item.version}`), "recipes");
  if (!Array.isArray(a.providerEvidence) || a.providerEvidence.length > 256) throw new Error("providerEvidence must contain at most 256 entries");
  a.providerEvidence.forEach(validateProviderEvidence);
  validateArtifactRelations(a);
  assertHash32(a.evidenceChainHead, "evidenceChainHead");
  assertObject(a.source, "source");
  assertKnownKeys(a.source, ["toolVersion", "sourceCommit"], "source");
  if (!/^[A-Za-z0-9._+-]{1,64}$/.test(a.source.toolVersion)) throw new Error("source.toolVersion must be a safe identifier");
  if (!/^[0-9a-f]{7,64}$/i.test(a.source.sourceCommit)) throw new Error("source.sourceCommit must be a git commit id");
  if (a.previousArtifactHash !== undefined) normalizeArtifactHash(a.previousArtifactHash);
  return JSON.parse(canonicalPolicyAuditJson(a)) as PolicyAuditArtifact;
}

function validateArtifactRelations(a: PolicyAuditArtifact): void {
  const recipeByKeyVersion = new Map(a.recipes.map((recipe) => [`${recipe.recipeKey.toLowerCase()}:${recipe.version}`, recipe]));
  for (const [bindingIndex, binding] of a.policy.recipeBindings.entries()) {
    const recipe = recipeByKeyVersion.get(`${binding.recipeKey.toLowerCase()}:${binding.recipeVersion}`);
    if (!recipe || recipe.recipeId !== binding.recipeId) throw new Error(`policy.recipeBindings[${bindingIndex}] does not resolve to an audited recipe`);
    for (const requiredElement of recipe.requiredElements) {
      if (!a.elements.some((element) => element.bindingIndex === bindingIndex && element.elementId.toLowerCase() === requiredElement.toLowerCase())) {
        throw new Error(`policy.recipeBindings[${bindingIndex}] is missing required audited element ${requiredElement}`);
      }
    }
  }
  for (const [index, element] of a.elements.entries()) {
    const binding = a.policy.recipeBindings[element.bindingIndex];
    if (!binding) throw new Error(`elements[${index}].bindingIndex is out of range`);
    const recipe = recipeByKeyVersion.get(`${binding.recipeKey.toLowerCase()}:${binding.recipeVersion}`)!;
    if (!recipe.requiredElements.some((elementId) => elementId.toLowerCase() === element.elementId.toLowerCase())) {
      throw new Error(`elements[${index}] is not required by its audited recipe`);
    }
  }
  for (const [index, override] of a.policy.enforcementOverrides.entries()) {
    if (!a.policy.recipeBindings[override.bindingIndex]) throw new Error(`policy.enforcementOverrides[${index}].bindingIndex is out of range`);
    if (!a.elements.some((element) => element.bindingIndex === override.bindingIndex && element.elementId.toLowerCase() === override.elementId.toLowerCase())) {
      throw new Error(`policy.enforcementOverrides[${index}] does not resolve to an audited element`);
    }
  }
}

export function normalizeArtifactHash(value: string): string {
  if (/^0x[0-9a-f]{64}$/i.test(value)) return `sha256:${value.slice(2).toLowerCase()}`;
  if (/^sha256:[0-9a-f]{64}$/i.test(value)) return value.toLowerCase();
  throw new Error("policy audit artifact hash must be sha256:<64 hex> or bytes32 hex");
}

export function artifactHashBytes32(value: string): string {
  return `0x${normalizeArtifactHash(value).slice("sha256:".length)}`;
}

function validatePolicy(value: PolicyAuditArtifact["policy"]): void {
  assertObject(value, "policy");
  assertKnownKeys(value, ["configHash", "legalPackageHash", "compiledPlanHash", "manifest", "recipeBindings", "enforcementOverrides"], "policy");
  assertSha256(value.configHash, "policy.configHash");
  assertSha256(value.legalPackageHash, "policy.legalPackageHash");
  assertHash32(value.compiledPlanHash, "policy.compiledPlanHash");
  assertObject(value.manifest, "policy.manifest");
  assertKnownKeys(value.manifest, ["issuanceRecipeId", "issuanceRecipeVersion", "fundRecipeId", "enabledResalePaths", "supportedEngines", "stateScopeId", "factsPacked", "coverageScope"], "policy.manifest");
  assertUint(value.manifest.issuanceRecipeId, 16, "policy.manifest.issuanceRecipeId", true);
  assertUint(value.manifest.issuanceRecipeVersion, 16, "policy.manifest.issuanceRecipeVersion", true);
  assertUint(value.manifest.fundRecipeId, 16, "policy.manifest.fundRecipeId", true);
  assertUint(value.manifest.enabledResalePaths, 32, "policy.manifest.enabledResalePaths", true);
  assertUint(value.manifest.supportedEngines, 8, "policy.manifest.supportedEngines", false);
  assertUint(value.manifest.stateScopeId, 16, "policy.manifest.stateScopeId", true);
  assertUintString(value.manifest.factsPacked, 256, "policy.manifest.factsPacked", true);
  assertUintString(value.manifest.coverageScope, 256, "policy.manifest.coverageScope", true);
  if (!Array.isArray(value.recipeBindings) || value.recipeBindings.length === 0 || value.recipeBindings.length > 8) throw new Error("policy.recipeBindings must contain 1-8 entries");
  value.recipeBindings.forEach(validateBinding);
  if (!Array.isArray(value.enforcementOverrides) || value.enforcementOverrides.length > 256) throw new Error("policy.enforcementOverrides must contain at most 256 entries");
  value.enforcementOverrides.forEach(validateOverride);
}

function validateDeployment(value: PolicyAuditArtifact["deployment"]): void {
  assertObject(value, "deployment");
  assertKnownKeys(value, ["complianceEngine", "tokenPolicyRegistry", "elementRegistry", "recipeRegistry", "runtimeCodeHashes"], "deployment");
  for (const key of ["complianceEngine", "tokenPolicyRegistry", "elementRegistry", "recipeRegistry"] as const) assertAddress(value[key], `deployment.${key}`);
  rejectDuplicates([value.complianceEngine, value.tokenPolicyRegistry, value.elementRegistry, value.recipeRegistry].map((item) => item.toLowerCase()), "deployment addresses");
  assertObject(value.runtimeCodeHashes, "deployment.runtimeCodeHashes");
  assertKnownKeys(value.runtimeCodeHashes, ["complianceEngine", "tokenPolicyRegistry", "elementRegistry", "recipeRegistry"], "deployment.runtimeCodeHashes");
  for (const key of ["complianceEngine", "tokenPolicyRegistry", "elementRegistry", "recipeRegistry"] as const) assertHash32(value.runtimeCodeHashes[key], `deployment.runtimeCodeHashes.${key}`);
}

function validateElement(value: PolicyAuditElement, index: number): void {
  const name = `elements[${index}]`;
  assertObject(value, name);
  assertKnownKeys(value, ["bindingIndex", "elementId", "implementation", "runtimeCodeHash", "versionHash", "metadataHash", "evidenceType", "defaultAction", "parameterSchemaId", "parameterSchemaVersion", "parameters", "parameterHash"], name);
  assertUint(value.bindingIndex, 8, `${name}.bindingIndex`, true);
  assertHash32(value.elementId, `${name}.elementId`);
  assertAddress(value.implementation, `${name}.implementation`);
  assertHash32(value.runtimeCodeHash, `${name}.runtimeCodeHash`);
  assertHash32(value.versionHash, `${name}.versionHash`);
  assertHash32(value.metadataHash, `${name}.metadataHash`);
  assertUint(value.evidenceType, 8, `${name}.evidenceType`, false);
  if (value.evidenceType > 4) throw new Error(`${name}.evidenceType is unsupported`);
  assertUint(value.defaultAction, 8, `${name}.defaultAction`, true);
  if (value.defaultAction > 2) throw new Error(`${name}.defaultAction is unsupported`);
  assertHash32(value.parameterSchemaId, `${name}.parameterSchemaId`);
  assertUint(value.parameterSchemaVersion, 16, `${name}.parameterSchemaVersion`, true);
  if (!/^0x(?:[0-9a-f]{2})*$/i.test(value.parameters) || (value.parameters.length - 2) / 2 > 4096) throw new Error(`${name}.parameters must be at most 4096 bytes of hex`);
  assertHash32(value.parameterHash, `${name}.parameterHash`);
  if (keccak256(value.parameters).toLowerCase() !== value.parameterHash.toLowerCase()) throw new Error(`${name}.parameterHash does not match parameters`);
}

function validateRecipe(value: PolicyAuditRecipe, index: number): void {
  const name = `recipes[${index}]`;
  assertObject(value, name);
  assertKnownKeys(value, ["recipeKey", "recipeId", "version", "implementation", "runtimeCodeHash", "requiredElements"], name);
  assertHash32(value.recipeKey, `${name}.recipeKey`);
  assertUint(value.recipeId, 16, `${name}.recipeId`, false);
  assertUint(value.version, 16, `${name}.version`, false);
  assertAddress(value.implementation, `${name}.implementation`);
  assertHash32(value.runtimeCodeHash, `${name}.runtimeCodeHash`);
  if (!Array.isArray(value.requiredElements) || value.requiredElements.length === 0 || value.requiredElements.length > 32) throw new Error(`${name}.requiredElements must contain 1-32 element ids`);
  value.requiredElements.forEach((item, itemIndex) => assertHash32(item, `${name}.requiredElements[${itemIndex}]`));
  rejectDuplicates(value.requiredElements.map((item) => item.toLowerCase()), `${name}.requiredElements`);
}

function validateBinding(value: PolicyAuditRecipeBinding, index: number): void {
  const name = `policy.recipeBindings[${index}]`;
  assertObject(value, name);
  assertKnownKeys(value, ["recipeKey", "recipeId", "recipeVersion", "mode", "pathGroupId", "priority"], name);
  assertHash32(value.recipeKey, `${name}.recipeKey`);
  assertUint(value.recipeId, 16, `${name}.recipeId`, false);
  assertUint(value.recipeVersion, 16, `${name}.recipeVersion`, false);
  assertUint(value.mode, 8, `${name}.mode`, true);
  if (value.mode > 2) throw new Error(`${name}.mode is unsupported`);
  assertUint(value.pathGroupId, 16, `${name}.pathGroupId`, true);
  assertUint(value.priority, 8, `${name}.priority`, true);
}

function validateOverride(value: PolicyAuditEnforcementOverride, index: number): void {
  const name = `policy.enforcementOverrides[${index}]`;
  assertObject(value, name);
  assertKnownKeys(value, ["bindingIndex", "elementId", "mode"], name);
  assertUint(value.bindingIndex, 8, `${name}.bindingIndex`, true);
  assertHash32(value.elementId, `${name}.elementId`);
  assertUint(value.mode, 8, `${name}.mode`, true);
  if (value.mode > 3) throw new Error(`${name}.mode is unsupported`);
}

function validateProviderEvidence(value: PolicyAuditProviderEvidence, index: number): void {
  const name = `providerEvidence[${index}]`;
  assertObject(value, name);
  assertKnownKeys(value, ["providerIdHash", "evidenceHash", "signatureRefHash", "validUntil"], name);
  assertHash32(value.providerIdHash, `${name}.providerIdHash`);
  assertHash32(value.evidenceHash, `${name}.evidenceHash`);
  assertHash32(value.signatureRefHash, `${name}.signatureRefHash`);
  assertUintString(value.validUntil, 64, `${name}.validUntil`, false);
}

function assertObject(value: unknown, name: string): asserts value is Record<string, any> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(`${name} must be an object`);
}

function assertKnownKeys(value: object, allowed: string[], name: string): void {
  for (const key of Object.keys(value)) if (!allowed.includes(key)) throw new Error(`${name}.${key} is not allowed`);
}

function assertAddress(value: unknown, name: string): void {
  if (typeof value !== "string" || !/^0x[0-9a-f]{40}$/i.test(value) || /^0x0{40}$/i.test(value)) throw new Error(`${name} must be a non-zero address`);
}

function assertHash32(value: unknown, name: string): void {
  if (typeof value !== "string" || !/^0x[0-9a-f]{64}$/i.test(value)) throw new Error(`${name} must be bytes32`);
}

function assertSha256(value: unknown, name: string): void {
  if (typeof value !== "string" || !/^sha256:[0-9a-f]{64}$/i.test(value)) throw new Error(`${name} must be a sha256 hash`);
}

function assertUint(value: unknown, bits: number, name: string, allowZero: boolean): void {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < (allowZero ? 0 : 1) || BigInt(value) >= (1n << BigInt(bits))) throw new Error(`${name} must be a uint${bits}`);
}

function assertUintString(value: unknown, bits: number, name: string, allowZero: boolean): void {
  if (typeof value !== "string" || !/^(0|[1-9][0-9]*)$/.test(value)) throw new Error(`${name} must be a canonical uint${bits} string`);
  const parsed = BigInt(value);
  if ((!allowZero && parsed === 0n) || parsed >= (1n << BigInt(bits))) throw new Error(`${name} must be a uint${bits}`);
}

function rejectDuplicates(values: string[], name: string): void {
  if (new Set(values).size !== values.length) throw new Error(`${name} must not contain duplicates`);
}
