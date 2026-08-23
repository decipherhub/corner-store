import {createHash} from "crypto";
import {readFileSync} from "fs";
import {resolve} from "path";
import {AbiCoder, Interface, keccak256, toUtf8Bytes} from "ethers";

export const PRODUCTION_ONBOARDING_SCHEMA_VERSION = 2;
export const MIN_PRODUCTION_ONBOARDING_SCHEMA_VERSION = 1;
export const POLICY_STATUS = {UNKNOWN: 0, UNREGULATED: 1, ACTIVE: 2, SUSPENDED: 3, PROPOSED: 4, RETIRED: 5} as const;
export const VENUE_TYPE = {AMM: 0, ORDER_BOOK: 1, RFQ: 2} as const;
export const CUSTODY_MODEL = {NONE: 0, POOL: 1, ESCROW: 2, OPERATOR: 3} as const;
export const RECIPE_BINDING_MODE = {REQUIRED_BLOCKING: 0, PATH_OPTION: 1, FLAG_ONLY: 2} as const;
export const ENFORCEMENT_ACTION = {FLAG_ONLY: 0, OPERATOR_REVIEW: 1, BLOCK: 2} as const;
export const ENFORCEMENT_OVERRIDE_MODE = {USE_ELEMENT_DEFAULT: 0, ESCALATE_TO_OPERATOR_REVIEW: 1, ESCALATE_TO_BLOCK: 2, FORCE_FLAG_ONLY: 3} as const;
export const MAX_ENFORCEMENT_OVERRIDES = 256;
export const RECIPE_KEY_DOMAIN = keccak256(toUtf8Bytes("corner-store.recipe-key.v1"));

type GovernanceStage = "governance-owner" | "operator" | "governance-delayed" | "verification";

export interface ProductionOnboardingConfig {
  schemaVersion: number;
  chainId: number;
  configHash: string;
  artifactHash: string;
  legalPackageHash: string;
  governance: {safe: string; requiredApprovals: number; operatorExecutor: string};
  addresses: {
    token: string;
    identityRegistry: string;
    compliance: string;
    topicsRegistry: string;
    issuersRegistry: string;
    identityStorage: string;
    elementRegistry: string;
    recipeRegistry: string;
    tokenPolicyRegistry: string;
    operatorRegistry: string;
    venueRegistry: string;
    rfqAdapter?: string;
    makerAuthorizer?: string;
  };
  codeHashes?: Record<string, string>;
  elements: ElementInput[];
  recipes: RecipeInput[];
  manifest: ManifestInput;
  recipeBindings: RecipeBindingInput[];
  enforcementOverrides?: ElementEnforcementOverrideInput[];
  venues: VenueInput[];
  rfq?: {
    makers?: {maker: string; approved: boolean}[];
    signerDelegates?: {maker: string; delegate: string; reasonHash: string}[];
  };
  inventory: InventoryRequirement[];
}

export interface ElementInput {
  elementId: string;
  implementation: string;
  defaultAction?: keyof typeof ENFORCEMENT_ACTION | number;
  versionHash?: string;
  metadataHash?: string;
}

export interface RecipeInput {
  recipeId: number;
  version: number;
  implementation: string;
  alias?: string;
  normalizedAlias?: string;
  aliasHash?: string;
  recipeKey?: string;
  requiredElements?: string[];
}

export interface ManifestInput {
  issuanceRecipeId: number;
  issuanceRecipeVersion: number;
  fundRecipeId: number;
  enabledResalePaths: number;
  supportedEngines: number;
  stateScopeId: number;
  factsPacked: string;
  coverageScope: string;
  fullManifestHash: string;
}

export interface RecipeBindingInput {
  recipeId: number;
  recipeVersion: number;
  mode: keyof typeof RECIPE_BINDING_MODE | number;
  pathGroupId: number;
  priority: number;
}

export interface ElementEnforcementOverrideInput {
  bindingIndex: number;
  elementId: string;
  mode: keyof typeof ENFORCEMENT_OVERRIDE_MODE | number;
}

export interface VenueInput {
  venue: string;
  venueType: keyof typeof VENUE_TYPE | number;
  adapter: string;
  target: string;
  operator: string;
  custody: keyof typeof CUSTODY_MODEL | number;
  active: boolean;
}

export interface InventoryRequirement {
  token: string;
  holder: string;
  spender?: string;
  minBalance: string;
  minAllowance?: string;
  riskEvidenceHash: string;
}

export interface OnboardingTx {
  id: string;
  stage: GovernanceStage;
  description: string;
  to: string;
  value: "0";
  data: string;
  operation: 0;
  dependsOn: string[];
  earliestExecution?: string;
  authority: "safe-owner" | "operator" | "read-only";
}

export interface ProductionOnboardingPlan {
  schema: "corner-store-production-onboarding";
  schemaVersion: number;
  chainId: number;
  configHash: string;
  artifactHash: string;
  legalPackageHash: string;
  onboardingHash: string;
  generatedAt: string;
  warnings: string[];
  transactions: OnboardingTx[];
  inventoryRequirements: InventoryRequirement[];
  recipeKeyCommitments?: RecipeKeyCommitment[];
  compiledPlan?: CompiledPlanCommitment;
  safeTransactions: SafeOnboardingTransaction[];
  operatorTransactions: OperatorOnboardingTransaction[];
}

export interface RecipeKeyCommitment {
  recipeId: number;
  version: number;
  normalizedAlias: string;
  aliasHash: string;
  recipeKey: string;
}

export interface CompiledPlanCommitment {
  compiledPlanHash: string;
  bindings: {bindingIndex: number; recipeId: number; recipeVersion: number; recipeKey: string; bindingPlanHash: string; rules: {elementId: string; action: string; actionValue: number}[]}[];
}

export interface SafeOnboardingTransaction extends OnboardingTx {
  origin: "corner-store-toolkit";
  chainId: number;
  safe: string;
  requiredApprovals: number;
  proposalId: string;
  expectedArtifactHash: string;
  legalPackageHash: string;
  onboardingHash: string;
  safeTxLabel: string;
}

export interface OperatorOnboardingTransaction extends OnboardingTx {
  origin: "corner-store-toolkit";
  chainId: number;
  executor: string;
  proposalId: string;
  expectedArtifactHash: string;
  legalPackageHash: string;
  onboardingHash: string;
  operatorTxLabel: string;
}

export interface ProductionOnboardingCheck {name: string; pass: boolean; detail: string}
export interface ProductionOnboardingVerification {ready: boolean; checks: ProductionOnboardingCheck[]}

export interface OnboardingReader {
  chainId(): Promise<number>;
  getCode(address: string): Promise<string>;
  call(address: string, abi: string[], functionName: string, args?: unknown[]): Promise<any>;
  balanceOf(token: string, holder: string): Promise<bigint>;
  allowance(token: string, owner: string, spender: string): Promise<bigint>;
}

const ADDRESS = /^0x[0-9a-fA-F]{40}$/;
const HASH32 = /^0x[0-9a-fA-F]{64}$/;
const SHA256 = /^sha256:[0-9a-f]{64}$/;
const SECRET_KEY = /(private_?key|mnemonic|seed|secret|signer_?secret|signer_?key|raw_?key|passport|ssn|dob|birth|email|phone|name|addressLine)/i;
const SECRET_VALUE = /^0x[0-9a-fA-F]{64}$/;
const UINT256_MAX = (1n << 256n) - 1n;
const coder = AbiCoder.defaultAbiCoder();

const ELEMENT_REGISTRY = new Interface([
  "function registerElement(bytes32 elementId,address element)",
  "function registerElement(bytes32 elementId,address element,uint8 defaultAction)",
  "function elementOf(bytes32 elementId) view returns (address)",
  "function metadataHashOf(bytes32 elementId) view returns (bytes32)",
  "function versionHashOf(bytes32 elementId) view returns (bytes32)",
  "function defaultActionOf(bytes32 elementId) view returns (uint8)"
]);
const RECIPE_REGISTRY = new Interface([
  "function registerRecipe(uint16 recipeId,uint16 version,address recipe)",
  "function registerRecipe(bytes32 aliasHash,bytes32 recipeKey,uint16 recipeId,uint16 version,address recipe)",
  "function recipeOf(uint16 recipeId) view returns (address)",
  "function recipeOf(uint16 recipeId,uint16 version) view returns (address)",
  "function recipeOf(bytes32 recipeKey,uint16 version) view returns (address)",
  "function recipeKeyOf(uint16 recipeId) view returns (bytes32)",
  "function recipeKeyOfAlias(bytes32 aliasHash) view returns (bytes32)",
  "function aliasHashOf(bytes32 recipeKey) view returns (bytes32)",
  "function deriveRecipeKey(bytes32 aliasHash) pure returns (bytes32)"
]);
const POLICY_REGISTRY = new Interface([
  "function registerManifest(address token,tuple(uint8 status,uint16 issuanceRecipeId,uint16 issuanceRecipeVersion,uint16 fundRecipeId,uint32 enabledResalePaths,uint8 supportedEngines,uint16 stateScopeId,uint256 factsPacked,uint256 coverageScope,bytes32 fullManifestHash,address declaredBy,address approvedBy) m,tuple(uint16 recipeId,uint16 recipeVersion,uint8 mode,uint16 pathGroupId,uint8 priority)[] bindings)",
  "function registerManifest(address token,tuple(uint8 status,uint16 issuanceRecipeId,uint16 issuanceRecipeVersion,uint16 fundRecipeId,uint32 enabledResalePaths,uint8 supportedEngines,uint16 stateScopeId,uint256 factsPacked,uint256 coverageScope,bytes32 fullManifestHash,address declaredBy,address approvedBy) m,tuple(uint16 recipeId,uint16 recipeVersion,uint8 mode,uint16 pathGroupId,uint8 priority)[] bindings,tuple(uint8 bindingIndex,bytes32 elementId,uint8 mode)[] overrides)",
  "function approveManifest(address token)",
  "function manifestOf(address token) view returns (tuple(uint8 status,uint16 issuanceRecipeId,uint16 issuanceRecipeVersion,uint16 fundRecipeId,uint32 enabledResalePaths,uint8 supportedEngines,uint16 stateScopeId,uint256 factsPacked,uint256 coverageScope,bytes32 fullManifestHash,address declaredBy,address approvedBy))",
  "function recipeBindingsOf(address token) view returns (tuple(uint16 recipeId,uint16 recipeVersion,uint8 mode,uint16 pathGroupId,uint8 priority)[])",
  "function statusOf(address token) view returns (uint8)",
  "function compiledPlanHashOf(address token) view returns (bytes32)",
  "function compiledBindingCountOf(address token) view returns (uint256)",
  "function compiledBindingOf(address token,uint256 index) view returns (tuple(uint16 recipeId,uint16 recipeVersion,uint8 mode,uint16 pathGroupId,uint8 priority) binding,bytes32 recipeKey,bytes32 bindingPlanHash)",
  "function compiledRulesOf(address token,uint256 bindingIndex) view returns (tuple(bytes32 elementId,uint8 action)[])"
]);
const VENUE_REGISTRY = new Interface([
  "function registerVenue(address venue,tuple(uint8 venueType,address adapter,address target,address operator,uint8 custody,bool active) cfg)",
  "function venueOf(address venue) view returns (tuple(uint8 venueType,address adapter,address target,address operator,uint8 custody,bool active))"
]);
const RFQ_ADAPTER = new Interface([
  "function setMakerApproved(address maker,bool approved)",
  "function approvedMaker(address maker) view returns (bool)"
]);
const MAKER_AUTHORIZER = new Interface([
  "function scheduleDelegate(address maker,address delegate,bytes32 reasonHash)",
  "function executeDelegateAuthorization(address maker,address delegate)",
  "function isDelegate(address maker,address delegate) view returns (bool)",
  "function pendingDelegateReadyAt(address maker,address delegate) view returns (uint64)"
]);
const ERC3643_TOKEN = ["function identityRegistry() view returns (address)", "function compliance() view returns (address)"];
const IDENTITY_REGISTRY = [
  "function topicsRegistry() view returns (address)",
  "function issuersRegistry() view returns (address)",
  "function identityStorage() view returns (address)"
];
const OPERATOR_REGISTRY = [
  "function isGlobalPaused() view returns (bool)",
  "function isAssetSuspended(address) view returns (bool)",
  "function isVenueSuspended(address) view returns (bool)"
];
const OWNED = ["function owner() view returns (address)"];

export function loadProductionOnboardingConfig(path: string): ProductionOnboardingConfig {
  try {
    return validateProductionOnboardingConfig(JSON.parse(readFileSync(path, "utf8")));
  } catch (err: any) {
    throw new Error(`invalid production onboarding config ${resolve(path)}: ${err.message}`);
  }
}

export function validateProductionOnboardingConfig(value: unknown): ProductionOnboardingConfig {
  rejectUnsafeEvidence(value, "onboarding");
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("production onboarding config must be an object");
  assertKnownKeys(value, ["schemaVersion", "chainId", "configHash", "artifactHash", "legalPackageHash", "governance", "addresses", "codeHashes", "elements", "recipes", "manifest", "recipeBindings", "enforcementOverrides", "venues", "rfq", "inventory"], "onboarding");
  const c = value as Partial<ProductionOnboardingConfig>;
  if (c.schemaVersion !== MIN_PRODUCTION_ONBOARDING_SCHEMA_VERSION && c.schemaVersion !== PRODUCTION_ONBOARDING_SCHEMA_VERSION) throw new Error(`schemaVersion must be ${MIN_PRODUCTION_ONBOARDING_SCHEMA_VERSION} or ${PRODUCTION_ONBOARDING_SCHEMA_VERSION}`);
  const v2 = isV2Onboarding(c);
  if (!Number.isSafeInteger(c.chainId) || Number(c.chainId) <= 0) throw new Error("chainId must be a positive integer");
  if (!isSha(c.configHash)) throw new Error("configHash must be a sha256 hash");
  if (!isSha(c.artifactHash)) throw new Error("artifactHash must be a sha256 hash");
  if (!isSha(c.legalPackageHash)) throw new Error("legalPackageHash must be a sha256 hash");
  if (!c.governance || typeof c.governance !== "object" || Array.isArray(c.governance)) throw new Error("governance is required");
  assertKnownKeys(c.governance, ["safe", "requiredApprovals", "operatorExecutor"], "governance");
  if (!isAddress(c.governance.safe)) throw new Error("governance.safe must be a non-zero address");
  if (!isAddress(c.governance.operatorExecutor)) throw new Error("governance.operatorExecutor must be a non-zero address");
  if (!Number.isSafeInteger(c.governance.requiredApprovals) || c.governance.requiredApprovals < 1 || c.governance.requiredApprovals > 50) throw new Error("governance.requiredApprovals must be between 1 and 50");
  if (!c.addresses || typeof c.addresses !== "object" || Array.isArray(c.addresses)) throw new Error("addresses are required");
  assertKnownKeys(c.addresses, ["token", "identityRegistry", "compliance", "topicsRegistry", "issuersRegistry", "identityStorage", "elementRegistry", "recipeRegistry", "tokenPolicyRegistry", "operatorRegistry", "venueRegistry", "rfqAdapter", "makerAuthorizer"], "addresses");
  for (const key of ["token", "identityRegistry", "compliance", "topicsRegistry", "issuersRegistry", "identityStorage", "elementRegistry", "recipeRegistry", "tokenPolicyRegistry", "operatorRegistry", "venueRegistry"] as const) {
    if (!isAddress(c.addresses[key])) throw new Error(`addresses.${key} must be a non-zero address`);
  }
  if (c.addresses.rfqAdapter !== undefined && !isAddress(c.addresses.rfqAdapter)) throw new Error("addresses.rfqAdapter must be a non-zero address");
  if (c.addresses.makerAuthorizer !== undefined && !isAddress(c.addresses.makerAuthorizer)) throw new Error("addresses.makerAuthorizer must be a non-zero address");
  validateUniqueAddresses(c.addresses as Record<string, string | undefined>);
  if (c.codeHashes) {
    if (typeof c.codeHashes !== "object" || Array.isArray(c.codeHashes)) throw new Error("codeHashes must be an object");
    const addressKeys = new Set(Object.keys(c.addresses).filter((key) => Boolean((c.addresses as any)[key])));
    for (const [key, value] of Object.entries(c.codeHashes)) {
      if (!addressKeys.has(key)) throw new Error(`codeHashes.${key} must match a configured address key`);
      if (!isHash32(value)) throw new Error(`codeHashes.${key} must be a 32-byte keccak256 hash`);
    }
  }
  if (!Array.isArray(c.elements) || c.elements.length === 0) throw new Error("elements must contain at least one element");
  const elementIds = new Set<string>();
  for (const [index, element] of c.elements.entries()) {
    assertKnownKeys(element, ["elementId", "implementation", "defaultAction", "versionHash", "metadataHash"], `elements[${index}]`);
    if (!isHash32(element?.elementId)) throw new Error(`elements[${index}].elementId must be bytes32`);
    if (!isAddress(element?.implementation)) throw new Error(`elements[${index}].implementation must be a non-zero address`);
    if (element.defaultAction !== undefined) enumValue(element.defaultAction, ENFORCEMENT_ACTION, `elements[${index}].defaultAction`);
    if (v2 && element.defaultAction === undefined) throw new Error(`elements[${index}].defaultAction is required for schemaVersion 2 onboarding`);
    if (!v2 && (element.defaultAction !== undefined || element.versionHash !== undefined || element.metadataHash !== undefined)) throw new Error("schemaVersion 1 elements must not include v2 enforcement/version fields");
    if (element.versionHash !== undefined && !isHash32(element.versionHash)) throw new Error(`elements[${index}].versionHash must be bytes32`);
    if (element.metadataHash !== undefined && !isHash32(element.metadataHash)) throw new Error(`elements[${index}].metadataHash must be bytes32`);
    const key = element.elementId.toLowerCase();
    if (elementIds.has(key)) throw new Error("elements must not contain duplicate elementId values");
    elementIds.add(key);
  }
  if (!Array.isArray(c.recipes) || c.recipes.length === 0) throw new Error("recipes must contain at least one recipe");
  const recipeIds = new Set<number>();
  const aliasHashes = new Set<string>();
  const recipeKeys = new Set<string>();
  for (const [index, recipe] of c.recipes.entries()) {
    assertKnownKeys(recipe, ["recipeId", "version", "implementation", "alias", "normalizedAlias", "aliasHash", "recipeKey", "requiredElements"], `recipes[${index}]`);
    validateUint(recipe?.recipeId, 16, `recipes[${index}].recipeId`);
    validateUint(recipe?.version, 16, `recipes[${index}].version`);
    if (recipe.recipeId === 0 || recipe.version === 0) throw new Error(`recipes[${index}] recipeId/version must be non-zero`);
    if (!isAddress(recipe.implementation)) throw new Error(`recipes[${index}].implementation must be a non-zero address`);
    if (recipeIds.has(recipe.recipeId)) throw new Error("recipes must not contain duplicate recipeId values");
    recipeIds.add(recipe.recipeId);
    if (v2) {
      if (typeof recipe.alias !== "string") throw new Error(`recipes[${index}].alias is required for schemaVersion 2 onboarding`);
      const normalizedAlias = normalizeRecipeAlias(recipe.alias);
      if (recipe.normalizedAlias !== undefined && recipe.normalizedAlias !== normalizedAlias) throw new Error(`recipes[${index}].normalizedAlias must equal canonical normalized alias`);
      const aliasHash = recipeAliasHash(normalizedAlias);
      const recipeKey = deriveRecipeKey(aliasHash);
      if (recipe.aliasHash !== undefined && recipe.aliasHash.toLowerCase() !== aliasHash.toLowerCase()) throw new Error(`recipes[${index}].aliasHash does not match canonical alias`);
      if (recipe.recipeKey !== undefined && recipe.recipeKey.toLowerCase() !== recipeKey.toLowerCase()) throw new Error(`recipes[${index}].recipeKey does not match canonical alias`);
      if (aliasHashes.has(aliasHash.toLowerCase())) throw new Error("recipes must not contain canonical alias collisions");
      if (recipeKeys.has(recipeKey.toLowerCase())) throw new Error("recipes must not contain duplicate recipeKey values");
      aliasHashes.add(aliasHash.toLowerCase());
      recipeKeys.add(recipeKey.toLowerCase());
      if (!Array.isArray(recipe.requiredElements) || recipe.requiredElements.length === 0 || recipe.requiredElements.length > 32) throw new Error(`recipes[${index}].requiredElements must contain 1-32 element ids for schemaVersion 2 onboarding`);
      const requiredSeen = new Set<string>();
      for (const [elementIndex, elementId] of recipe.requiredElements.entries()) {
        if (!isHash32(elementId)) throw new Error(`recipes[${index}].requiredElements[${elementIndex}] must be bytes32`);
        const key = elementId.toLowerCase();
        if (!elementIds.has(key)) throw new Error(`recipes[${index}].requiredElements[${elementIndex}] is not configured in elements`);
        if (requiredSeen.has(key)) throw new Error(`recipes[${index}].requiredElements must not contain duplicates`);
        requiredSeen.add(key);
      }
    } else if (recipe.alias !== undefined || recipe.normalizedAlias !== undefined || recipe.aliasHash !== undefined || recipe.recipeKey !== undefined || recipe.requiredElements !== undefined) throw new Error("schemaVersion 1 recipes must not include v2 canonical recipe fields");
  }
  validateManifest(c.manifest);
  if (!Array.isArray(c.recipeBindings) || c.recipeBindings.length === 0 || c.recipeBindings.length > 8) throw new Error("recipeBindings must contain 1-8 bindings");
  const bindingIds = new Set<number>();
  let hasBlocking = false;
  for (const [index, binding] of c.recipeBindings.entries()) {
    assertKnownKeys(binding, ["recipeId", "recipeVersion", "mode", "pathGroupId", "priority"], `recipeBindings[${index}]`);
    validateUint(binding?.recipeId, 16, `recipeBindings[${index}].recipeId`);
    validateUint(binding?.recipeVersion, 16, `recipeBindings[${index}].recipeVersion`);
    validateUint(binding?.pathGroupId, 16, `recipeBindings[${index}].pathGroupId`);
    validateUint(binding?.priority, 8, `recipeBindings[${index}].priority`);
    const mode = enumValue(binding.mode, RECIPE_BINDING_MODE, `recipeBindings[${index}].mode`);
    if (binding.recipeId === 0 || binding.recipeVersion === 0) throw new Error(`recipeBindings[${index}] recipeId/version must be non-zero`);
    if (!recipeIds.has(binding.recipeId)) throw new Error(`recipeBindings[${index}].recipeId has no registered recipe`);
    if (bindingIds.has(binding.recipeId)) throw new Error("recipeBindings must not contain duplicate recipeId values");
    bindingIds.add(binding.recipeId);
    if (mode === RECIPE_BINDING_MODE.PATH_OPTION) {
      if (binding.pathGroupId === 0) throw new Error("PATH_OPTION recipeBindings require pathGroupId");
      hasBlocking = true;
    } else {
      if (binding.pathGroupId !== 0) throw new Error("non-PATH_OPTION recipeBindings must use pathGroupId 0");
      if (mode === RECIPE_BINDING_MODE.REQUIRED_BLOCKING) hasBlocking = true;
    }
  }
  if (!hasBlocking) throw new Error("recipeBindings must include a blocking REQUIRED_BLOCKING or PATH_OPTION binding");
  validateOverrides(c.enforcementOverrides, c.recipeBindings, c.recipes, c.elements, v2);
  if (!Array.isArray(c.venues) || c.venues.length === 0) throw new Error("venues must contain at least one venue");
  const venueSeen = new Set<string>();
  for (const [index, venue] of c.venues.entries()) validateVenue(venue, index, venueSeen);
  if (!c.venues.some((venue) => venue.active)) throw new Error("venues must contain at least one active venue");
  const activeRfqVenues = c.venues.filter((venue) => enumValue(venue.venueType, VENUE_TYPE, "venueType") === VENUE_TYPE.RFQ && venue.active);
  if (c.rfq && activeRfqVenues.length === 0) throw new Error("rfq config requires an active RFQ venue");
  const approvedMakers = new Set<string>();
  if (c.rfq) {
    assertKnownKeys(c.rfq, ["makers", "signerDelegates"], "rfq");
    const makerSeen = new Set<string>();
    for (const [index, maker] of (c.rfq.makers ?? []).entries()) {
      assertKnownKeys(maker, ["maker", "approved"], `rfq.makers[${index}]`);
      if (!isAddress(maker?.maker)) throw new Error(`rfq.makers[${index}].maker must be a non-zero address`);
      if (typeof maker.approved !== "boolean") throw new Error(`rfq.makers[${index}].approved must be boolean`);
      const key = maker.maker.toLowerCase();
      if (makerSeen.has(key)) throw new Error("rfq.makers must not contain duplicate maker values");
      makerSeen.add(key);
      if (maker.approved) approvedMakers.add(key);
    }
    const delegateSeen = new Set<string>();
    for (const [index, delegate] of (c.rfq.signerDelegates ?? []).entries()) {
      if (!c.addresses.makerAuthorizer) throw new Error("addresses.makerAuthorizer is required when rfq.signerDelegates are configured");
      assertKnownKeys(delegate, ["maker", "delegate", "reasonHash"], `rfq.signerDelegates[${index}]`);
      if (!isAddress(delegate?.maker)) throw new Error(`rfq.signerDelegates[${index}].maker must be a non-zero address`);
      if (!isAddress(delegate?.delegate)) throw new Error(`rfq.signerDelegates[${index}].delegate must be a non-zero address`);
      if (same(delegate.maker, delegate.delegate)) throw new Error("rfq.signerDelegates maker and delegate must differ");
      if (!approvedMakers.has(delegate.maker.toLowerCase())) throw new Error("rfq.signerDelegates maker must have configured approved=true maker activation");
      if (!isHash32(delegate.reasonHash)) throw new Error(`rfq.signerDelegates[${index}].reasonHash must be bytes32`);
      const key = `${delegate.maker.toLowerCase()}:${delegate.delegate.toLowerCase()}`;
      if (delegateSeen.has(key)) throw new Error("rfq.signerDelegates must not contain duplicates");
      delegateSeen.add(key);
    }
    if ((c.rfq.makers?.length ?? 0) > 0 && !c.addresses.rfqAdapter) throw new Error("addresses.rfqAdapter is required when rfq.makers are configured");
  }
  if (activeRfqVenues.length > 0) {
    if (!c.rfq) throw new Error("active RFQ venue requires rfq config");
    if (approvedMakers.size === 0) throw new Error("active RFQ venue requires at least one approved maker");
    if ((c.rfq.signerDelegates ?? []).length === 0) throw new Error("active RFQ venue requires at least one signer delegate");
  }
  if (!Array.isArray(c.inventory) || c.inventory.length === 0) throw new Error("inventory must contain at least one read-only requirement");
  const seen = new Set<string>();
  const inventoryHolders = new Set<string>();
  for (const [index, inv] of c.inventory.entries()) {
    assertKnownKeys(inv, ["token", "holder", "spender", "minBalance", "minAllowance", "riskEvidenceHash"], `inventory[${index}]`);
    if (!isAddress(inv?.token)) throw new Error(`inventory[${index}].token must be a non-zero address`);
    if (!isAddress(inv?.holder)) throw new Error(`inventory[${index}].holder must be a non-zero address`);
    if (inv.spender !== undefined && !isAddress(inv.spender)) throw new Error(`inventory[${index}].spender must be a non-zero address`);
    parseUint(inv.minBalance, `inventory[${index}].minBalance`);
    if (inv.minAllowance !== undefined) parseUint(inv.minAllowance, `inventory[${index}].minAllowance`);
    if (inv.minAllowance !== undefined && !inv.spender) throw new Error(`inventory[${index}].spender is required with minAllowance`);
    if (!isHash32(inv.riskEvidenceHash)) throw new Error(`inventory[${index}].riskEvidenceHash must be bytes32`);
    if ((c.rfq?.makers ?? []).some((maker) => same(maker.maker, inv.holder)) && !(c.rfq?.makers ?? []).some((maker) => same(maker.maker, inv.holder) && maker.approved)) {
      throw new Error(`inventory[${index}].holder RFQ maker must have approved maker config`);
    }
    const key = `${inv.token.toLowerCase()}:${inv.holder.toLowerCase()}:${(inv.spender ?? "").toLowerCase()}`;
    if (seen.has(key)) throw new Error("inventory must not contain duplicate token/holder/spender requirements");
    seen.add(key);
    inventoryHolders.add(inv.holder.toLowerCase());
  }
  if (activeRfqVenues.length > 0 && !Array.from(approvedMakers).some((maker) => inventoryHolders.has(maker))) {
    throw new Error("active RFQ venue requires inventory for an approved maker");
  }
  return c as ProductionOnboardingConfig;
}

export function createProductionOnboardingPlan(config: ProductionOnboardingConfig, generatedAt = "1970-01-01T00:00:00.000Z"): ProductionOnboardingPlan {
  const selected = validateProductionOnboardingConfig(config);
  const v2 = isV2Onboarding(selected);
  const recipeKeyCommitments = v2 ? recipeCommitments(selected.recipes) : undefined;
  const compiledPlan = v2 ? compilePlanCommitment(selected) : undefined;
  const txs: OnboardingTx[] = [];
  const ids = {elements: [] as string[], recipes: [] as string[], venues: [] as string[], makers: [] as string[], delegates: [] as string[]};
  for (const [index, element] of selected.elements.entries()) {
    const id = `element-${index + 1}-${digestId(element.elementId)}`;
    ids.elements.push(id);
    const data = v2
      ? ELEMENT_REGISTRY.encodeFunctionData("registerElement(bytes32,address,uint8)", [element.elementId, element.implementation, enumValue(element.defaultAction, ENFORCEMENT_ACTION, "defaultAction")])
      : ELEMENT_REGISTRY.encodeFunctionData("registerElement(bytes32,address)", [element.elementId, element.implementation]);
    txs.push(tx(id, "governance-owner", `Register compliance element ${element.elementId}`, selected.addresses.elementRegistry, data, [], "safe-owner"));
  }
  for (const recipe of selected.recipes) {
    const id = `recipe-${recipe.recipeId}-v${recipe.version}`;
    ids.recipes.push(id);
    const data = v2
      ? RECIPE_REGISTRY.encodeFunctionData("registerRecipe(bytes32,bytes32,uint16,uint16,address)", [recipeAliasHash(normalizeRecipeAlias(recipe.alias!)), deriveRecipeKey(recipeAliasHash(normalizeRecipeAlias(recipe.alias!))), recipe.recipeId, recipe.version, recipe.implementation])
      : RECIPE_REGISTRY.encodeFunctionData("registerRecipe(uint16,uint16,address)", [recipe.recipeId, recipe.version, recipe.implementation]);
    txs.push(tx(id, "governance-owner", `Register recipe ${recipe.recipeId} v${recipe.version}${v2 ? ` alias=${normalizeRecipeAlias(recipe.alias!)}` : ""}`, selected.addresses.recipeRegistry, data, ids.elements, "safe-owner"));
  }
  const manifestId = "manifest-register";
  const manifestData = v2
    ? POLICY_REGISTRY.encodeFunctionData("registerManifest(address,(uint8,uint16,uint16,uint16,uint32,uint8,uint16,uint256,uint256,bytes32,address,address),(uint16,uint16,uint8,uint16,uint8)[],(uint8,bytes32,uint8)[])", [selected.addresses.token, manifestTuple(selected.manifest), bindingTuples(selected.recipeBindings), overrideTuples(selected.enforcementOverrides ?? [])])
    : POLICY_REGISTRY.encodeFunctionData("registerManifest(address,(uint8,uint16,uint16,uint16,uint32,uint8,uint16,uint256,uint256,bytes32,address,address),(uint16,uint16,uint8,uint16,uint8)[])", [selected.addresses.token, manifestTuple(selected.manifest), bindingTuples(selected.recipeBindings)]);
  txs.push(tx(manifestId, "governance-owner", "Register token manifest as PROPOSED", selected.addresses.tokenPolicyRegistry, manifestData, ids.recipes, "safe-owner"));
  const approveManifestId = "manifest-approve";
  txs.push(tx(approveManifestId, "operator", "Approve token manifest as ACTIVE", selected.addresses.tokenPolicyRegistry, POLICY_REGISTRY.encodeFunctionData("approveManifest", [selected.addresses.token]), [manifestId], "operator"));
  for (const [index, venue] of (selected.venues ?? []).entries()) {
    const id = `venue-${index + 1}`;
    ids.venues.push(id);
    txs.push(tx(id, "governance-owner", `Register venue ${venue.venue}`, selected.addresses.venueRegistry, VENUE_REGISTRY.encodeFunctionData("registerVenue", [venue.venue, venueTuple(venue)]), [approveManifestId], "safe-owner"));
  }
  for (const [index, maker] of (selected.rfq?.makers ?? []).entries()) {
    const id = `maker-${index + 1}`;
    ids.makers.push(id);
    const deps = ids.venues.length > 0 ? ids.venues : [approveManifestId];
    txs.push(tx(id, "operator", `Set RFQ maker approval ${maker.maker}=${maker.approved}`, selected.addresses.rfqAdapter!, RFQ_ADAPTER.encodeFunctionData("setMakerApproved", [maker.maker, maker.approved]), deps, "operator"));
  }
  for (const [index, delegate] of (selected.rfq?.signerDelegates ?? []).entries()) {
    const schedule = `signer-${index + 1}-schedule`;
    const execute = `signer-${index + 1}-execute`;
    ids.delegates.push(execute);
    txs.push(tx(schedule, "governance-owner", `Schedule RFQ signer delegate ${delegate.delegate}`, selected.addresses.makerAuthorizer!, MAKER_AUTHORIZER.encodeFunctionData("scheduleDelegate", [delegate.maker, delegate.delegate, delegate.reasonHash]), ids.makers, "safe-owner"));
    txs.push({...tx(execute, "governance-delayed", `Execute delayed RFQ signer delegate ${delegate.delegate}`, selected.addresses.makerAuthorizer!, MAKER_AUTHORIZER.encodeFunctionData("executeDelegateAuthorization", [delegate.maker, delegate.delegate]), [schedule], "safe-owner"), earliestExecution: "+1 day after signer schedule readyAt"});
  }
  for (const [index, inv] of selected.inventory.entries()) {
    txs.push(tx(`inventory-${index + 1}-verify`, "verification", `Verify read-only inventory for ${inv.holder}`, inv.token, "0x", ids.makers.length > 0 ? ids.makers : [approveManifestId], "read-only"));
  }
  const hashInput = {...selected, recipeKeyCommitments, compiledPlan, generatedAt: "<deterministic>"};
  const onboardingHash = `sha256:${createHash("sha256").update(canonicalJson(hashInput)).digest("hex")}`;
  const safeTransactions = txs.filter((entry) => entry.authority === "safe-owner").map((entry, index) => {
    const safeTxLabel = `${String(index + 1).padStart(2, "0")}-${entry.id}`;
    return {
      ...entry,
      origin: "corner-store-toolkit" as const,
      chainId: selected.chainId,
      safe: selected.governance.safe,
      requiredApprovals: selected.governance.requiredApprovals,
      proposalId: deterministicProposalId(selected, entry, index, "safe"),
      expectedArtifactHash: selected.artifactHash,
      legalPackageHash: selected.legalPackageHash,
      onboardingHash,
      safeTxLabel
    };
  });
  const operatorTransactions = txs.filter((entry) => entry.authority === "operator").map((entry, index) => {
    const operatorTxLabel = `${String(index + 1).padStart(2, "0")}-${entry.id}`;
    return {
      ...entry,
      origin: "corner-store-toolkit" as const,
      chainId: selected.chainId,
      executor: selected.governance.operatorExecutor,
      proposalId: deterministicProposalId(selected, entry, index, "operator"),
      expectedArtifactHash: selected.artifactHash,
      legalPackageHash: selected.legalPackageHash,
      onboardingHash,
      operatorTxLabel
    };
  });
  return {
    schema: "corner-store-production-onboarding",
    schemaVersion: selected.schemaVersion,
    chainId: selected.chainId,
    configHash: selected.configHash,
    artifactHash: selected.artifactHash,
    legalPackageHash: selected.legalPackageHash,
    onboardingHash,
    generatedAt,
    warnings: [
      "plan/export only: transactions are unsigned and are never broadcast by this tool",
      "governance-owner and operator steps are separated for Safe/operator review",
      "inventory activation is read-only: no token transfers, approvals, or custody mutations are synthesized",
      "external ERC-3643/ONCHAINID contracts remain an external trust boundary and are verified fail-closed"
    ],
    transactions: txs,
    inventoryRequirements: selected.inventory,
    recipeKeyCommitments,
    compiledPlan,
    safeTransactions,
    operatorTransactions
  };
}

export async function verifyProductionOnboarding(config: ProductionOnboardingConfig, reader: OnboardingReader): Promise<ProductionOnboardingVerification> {
  const selected = validateProductionOnboardingConfig(config);
  const checks: ProductionOnboardingCheck[] = [];
  const check = (name: string, pass: boolean, detail: string) => checks.push({name, pass, detail});
  try {
    const chain = await reader.chainId();
    check("chain-id", chain === selected.chainId, `expected=${selected.chainId}; actual=${chain}`);
  } catch (err: any) { check("chain-id", false, `unavailable: ${err.message}`); }
  for (const [key, address] of Object.entries(selected.addresses)) {
    if (address) await verifyCode(reader, address, `code-${key}`, check, selected.codeHashes?.[key]);
  }
  await verifyCallAddress(reader, selected.addresses.token, ERC3643_TOKEN, "identityRegistry", [], selected.addresses.identityRegistry, "erc3643-identity-registry", check);
  await verifyCallAddress(reader, selected.addresses.token, ERC3643_TOKEN, "compliance", [], selected.addresses.compliance, "erc3643-compliance", check);
  await verifyCallAddress(reader, selected.addresses.identityRegistry, IDENTITY_REGISTRY, "topicsRegistry", [], selected.addresses.topicsRegistry, "identity-topics-registry", check);
  await verifyCallAddress(reader, selected.addresses.identityRegistry, IDENTITY_REGISTRY, "issuersRegistry", [], selected.addresses.issuersRegistry, "identity-issuers-registry", check);
  await verifyCallAddress(reader, selected.addresses.identityRegistry, IDENTITY_REGISTRY, "identityStorage", [], selected.addresses.identityStorage, "identity-storage", check);
  await verifyCallBool(reader, selected.addresses.operatorRegistry, OPERATOR_REGISTRY, "isGlobalPaused", [], false, "global-paused", check);
  await verifyCallBool(reader, selected.addresses.operatorRegistry, OPERATOR_REGISTRY, "isAssetSuspended", [selected.addresses.token], false, "asset-suspended", check);
  await verifyOwner(reader, selected.addresses.elementRegistry, selected.governance.safe, "owner-element-registry", check);
  await verifyOwner(reader, selected.addresses.recipeRegistry, selected.governance.safe, "owner-recipe-registry", check);
  await verifyOwner(reader, selected.addresses.tokenPolicyRegistry, selected.governance.safe, "owner-token-policy-registry", check);
  await verifyOwner(reader, selected.addresses.venueRegistry, selected.governance.safe, "owner-venue-registry", check);
  if ((selected.rfq?.signerDelegates ?? []).length > 0) {
    await verifyOwner(reader, selected.addresses.makerAuthorizer!, selected.governance.safe, "owner-maker-authorizer", check);
  }
  await verifyOperatorRole(reader, selected.addresses.tokenPolicyRegistry, selected.governance.operatorExecutor, "token-policy-operator", check);
  if ((selected.rfq?.makers ?? []).length > 0) {
    await verifyOperatorRole(reader, selected.addresses.rfqAdapter!, selected.governance.operatorExecutor, "rfq-adapter-operator", check);
  }
  for (const [index, element] of selected.elements.entries()) {
    await verifyCallAddress(reader, selected.addresses.elementRegistry, ["function elementOf(bytes32) view returns (address)"], "elementOf", [element.elementId], element.implementation, `element-${index + 1}-${digestId(element.elementId)}`, check);
    if (isV2Onboarding(selected)) {
      await verifyCallUint(reader, selected.addresses.elementRegistry, ["function defaultActionOf(bytes32) view returns (uint8)"], "defaultActionOf", [element.elementId], enumValue(element.defaultAction, ENFORCEMENT_ACTION, "defaultAction"), `element-${index + 1}-default-action`, check);
      if (element.versionHash) await verifyCallHash(reader, selected.addresses.elementRegistry, ["function versionHashOf(bytes32) view returns (bytes32)"], "versionHashOf", [element.elementId], element.versionHash, `element-${index + 1}-version-hash`, check);
      if (element.metadataHash) await verifyCallHash(reader, selected.addresses.elementRegistry, ["function metadataHashOf(bytes32) view returns (bytes32)"], "metadataHashOf", [element.elementId], element.metadataHash, `element-${index + 1}-metadata-hash`, check);
    }
  }
  for (const recipe of selected.recipes) {
    if (isV2Onboarding(selected)) {
      const normalizedAlias = normalizeRecipeAlias(recipe.alias!);
      const aliasHash = recipeAliasHash(normalizedAlias);
      const recipeKey = deriveRecipeKey(aliasHash);
      await verifyCallHash(reader, selected.addresses.recipeRegistry, ["function recipeKeyOfAlias(bytes32) view returns (bytes32)"], "recipeKeyOfAlias", [aliasHash], recipeKey, `recipe-${recipe.recipeId}-alias-key`, check);
      await verifyCallHash(reader, selected.addresses.recipeRegistry, ["function aliasHashOf(bytes32) view returns (bytes32)"], "aliasHashOf", [recipeKey], aliasHash, `recipe-${recipe.recipeId}-key-alias`, check);
      await verifyCallHash(reader, selected.addresses.recipeRegistry, ["function recipeKeyOf(uint16) view returns (bytes32)"], "recipeKeyOf", [recipe.recipeId], recipeKey, `recipe-${recipe.recipeId}-legacy-key`, check);
      await verifyCallAddress(reader, selected.addresses.recipeRegistry, ["function recipeOf(bytes32,uint16) view returns (address)"], "recipeOf", [recipeKey, recipe.version], recipe.implementation, `recipe-${recipe.recipeId}-versioned`, check);
    } else {
      await verifyCallAddress(reader, selected.addresses.recipeRegistry, ["function recipeOf(uint16) view returns (address)"], "recipeOf", [recipe.recipeId], recipe.implementation, `recipe-${recipe.recipeId}`, check);
    }
  }
  try {
    const status = Number(await reader.call(selected.addresses.tokenPolicyRegistry, ["function statusOf(address) view returns (uint8)"], "statusOf", [selected.addresses.token]));
    check("manifest-status", status === POLICY_STATUS.ACTIVE, `expected=ACTIVE(${POLICY_STATUS.ACTIVE}); actual=${status}`);
  } catch (err: any) { check("manifest-status", false, `unavailable: ${err.message}`); }
  try {
    const manifest = await reader.call(selected.addresses.tokenPolicyRegistry, ["function manifestOf(address) view returns (tuple(uint8 status,uint16 issuanceRecipeId,uint16 issuanceRecipeVersion,uint16 fundRecipeId,uint32 enabledResalePaths,uint8 supportedEngines,uint16 stateScopeId,uint256 factsPacked,uint256 coverageScope,bytes32 fullManifestHash,address declaredBy,address approvedBy))"], "manifestOf", [selected.addresses.token]);
    const expected = manifestTuple(selected.manifest);
    check("manifest-hash", String(manifest.fullManifestHash ?? manifest[9]).toLowerCase() === selected.manifest.fullManifestHash.toLowerCase(), `expected=${selected.manifest.fullManifestHash}; actual=${String(manifest.fullManifestHash ?? manifest[9])}`);
    check("manifest-factsPacked", BigInt(manifest.factsPacked ?? manifest[7]) === parseUint(selected.manifest.factsPacked, "manifest.factsPacked"), `expected=${selected.manifest.factsPacked}; actual=${String(manifest.factsPacked ?? manifest[7])}`);
    check("manifest-coverageScope", BigInt(manifest.coverageScope ?? manifest[8]) === parseUint(selected.manifest.coverageScope, "manifest.coverageScope"), `expected=${selected.manifest.coverageScope}; actual=${String(manifest.coverageScope ?? manifest[8])}`);
    check("manifest-declaredBy", isAddress(String(manifest.declaredBy ?? manifest[10])), `declaredBy=${String(manifest.declaredBy ?? manifest[10])}`);
    check("manifest-approvedBy", isAddress(String(manifest.approvedBy ?? manifest[11])), `approvedBy=${String(manifest.approvedBy ?? manifest[11])}`);
    for (const [name, pos] of [["issuanceRecipeId", 1], ["issuanceRecipeVersion", 2], ["fundRecipeId", 3], ["enabledResalePaths", 4], ["supportedEngines", 5], ["stateScopeId", 6]] as const) {
      check(`manifest-${name}`, Number(manifest[name] ?? manifest[pos]) === Number(expected[pos]), `expected=${expected[pos]}; actual=${String(manifest[name] ?? manifest[pos])}`);
    }
  } catch (err: any) { check("manifest-core", false, `unavailable: ${err.message}`); }
  try {
    const bindings = await reader.call(selected.addresses.tokenPolicyRegistry, ["function recipeBindingsOf(address) view returns (tuple(uint16 recipeId,uint16 recipeVersion,uint8 mode,uint16 pathGroupId,uint8 priority)[])"], "recipeBindingsOf", [selected.addresses.token]);
    check("manifest-bindings", JSON.stringify(normalizeBindings(bindings)) === JSON.stringify(bindingTuples(selected.recipeBindings).map((b) => b.map(Number))), `expected=${JSON.stringify(bindingTuples(selected.recipeBindings))}; actual=${JSON.stringify(normalizeBindings(bindings))}`);
  } catch (err: any) { check("manifest-bindings", false, `unavailable: ${err.message}`); }
  if (isV2Onboarding(selected)) await verifyCompiledPlan(selected, reader, check);
  for (const [index, venue] of (selected.venues ?? []).entries()) {
    try {
      const actual = await reader.call(selected.addresses.venueRegistry, ["function venueOf(address) view returns (tuple(uint8 venueType,address adapter,address target,address operator,uint8 custody,bool active))"], "venueOf", [venue.venue]);
      const expected = venueTuple(venue);
      check(`venue-${index + 1}`, venueMatches(actual, expected), `expected=${JSON.stringify(expected)}; actual=${JSON.stringify(tupleToJson(actual))}`);
      await verifyCallBool(reader, selected.addresses.operatorRegistry, OPERATOR_REGISTRY, "isVenueSuspended", [venue.venue], false, `venue-${index + 1}-suspended`, check);
    } catch (err: any) { check(`venue-${index + 1}`, false, `unavailable: ${err.message}`); }
  }
  for (const [index, maker] of (selected.rfq?.makers ?? []).entries()) {
    try {
      const actual = await reader.call(selected.addresses.rfqAdapter!, ["function approvedMaker(address) view returns (bool)"], "approvedMaker", [maker.maker]);
      check(`maker-${index + 1}`, actual === maker.approved, `expected=${maker.approved}; actual=${actual}`);
    } catch (err: any) { check(`maker-${index + 1}`, false, `unavailable: ${err.message}`); }
  }
  for (const [index, delegate] of (selected.rfq?.signerDelegates ?? []).entries()) {
    try {
      const active = await reader.call(selected.addresses.makerAuthorizer!, ["function isDelegate(address,address) view returns (bool)"], "isDelegate", [delegate.maker, delegate.delegate]);
      const pending = await reader.call(selected.addresses.makerAuthorizer!, ["function pendingDelegateReadyAt(address,address) view returns (uint64)"], "pendingDelegateReadyAt", [delegate.maker, delegate.delegate]);
      check(`signer-${index + 1}-active`, active === true, `active=${active}; pendingReadyAt=${pending}`);
      check(`signer-${index + 1}-pending`, BigInt(pending) === 0n, `pendingReadyAt=${pending}`);
    } catch (err: any) { check(`signer-${index + 1}`, false, `unavailable: ${err.message}`); }
  }
  for (const [index, inv] of selected.inventory.entries()) {
    try {
      const balance = await reader.balanceOf(inv.token, inv.holder);
      check(`inventory-${index + 1}-balance`, balance >= parseUint(inv.minBalance, "minBalance"), `min=${inv.minBalance}; actual=${balance.toString()}; riskEvidenceHash=${inv.riskEvidenceHash}`);
      if (inv.spender && inv.minAllowance !== undefined) {
        const allowance = await reader.allowance(inv.token, inv.holder, inv.spender);
        check(`inventory-${index + 1}-allowance`, allowance >= parseUint(inv.minAllowance, "minAllowance"), `min=${inv.minAllowance}; actual=${allowance.toString()}; riskEvidenceHash=${inv.riskEvidenceHash}`);
      }
    } catch (err: any) { check(`inventory-${index + 1}`, false, `unavailable: ${err.message}`); }
  }
  return {ready: checks.every((item) => item.pass), checks};
}

export function productionOnboardingInterfaces() {
  return {ELEMENT_REGISTRY, RECIPE_REGISTRY, POLICY_REGISTRY, VENUE_REGISTRY, RFQ_ADAPTER, MAKER_AUTHORIZER};
}

function tx(id: string, stage: GovernanceStage, description: string, to: string, data: string, dependsOn: string[], authority: OnboardingTx["authority"]): OnboardingTx {
  return {id, stage, description, to, value: "0", data, operation: 0, dependsOn, authority};
}

function manifestTuple(m: ManifestInput): any[] {
  return [POLICY_STATUS.PROPOSED, m.issuanceRecipeId, m.issuanceRecipeVersion, m.fundRecipeId, m.enabledResalePaths, m.supportedEngines, m.stateScopeId, m.factsPacked, m.coverageScope, m.fullManifestHash, "0x0000000000000000000000000000000000000000", "0x0000000000000000000000000000000000000000"];
}

function bindingTuples(bindings: RecipeBindingInput[]): any[][] {
  return bindings.map((b) => [b.recipeId, b.recipeVersion, enumValue(b.mode, RECIPE_BINDING_MODE, "mode"), b.pathGroupId, b.priority]);
}

function overrideTuples(overrides: ElementEnforcementOverrideInput[]): any[][] {
  return overrides.map((o) => [o.bindingIndex, o.elementId, enumValue(o.mode, ENFORCEMENT_OVERRIDE_MODE, "override.mode")]);
}

function venueTuple(v: VenueInput): any[] {
  return [enumValue(v.venueType, VENUE_TYPE, "venueType"), v.adapter, v.target, v.operator, enumValue(v.custody, CUSTODY_MODEL, "custody"), v.active];
}

export function normalizeRecipeAlias(value: string): string {
  if (typeof value !== "string") throw new Error("recipe alias must be a string");
  if (!/^[\x00-\x7f]*$/.test(value)) throw new Error("recipe alias must be ASCII only");
  const normalized = value.trim().toLowerCase().replace(/[ _.]+/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");
  if (normalized.length === 0) throw new Error("recipe alias must not normalize to empty");
  if (normalized.length > 64) throw new Error("recipe alias must be at most 64 characters after normalization");
  if (!/^[a-z0-9-]+$/.test(normalized)) throw new Error("recipe alias must normalize to [a-z0-9-]");
  return normalized;
}

export function recipeAliasHash(aliasOrNormalized: string): string {
  return keccak256(toUtf8Bytes(normalizeRecipeAlias(aliasOrNormalized)));
}

export function deriveRecipeKey(aliasHash: string): string {
  if (!isHash32(aliasHash)) throw new Error("aliasHash must be bytes32");
  return keccak256(coder.encode(["bytes32", "bytes32"], [RECIPE_KEY_DOMAIN, aliasHash]));
}

function isV2Onboarding(config: Partial<ProductionOnboardingConfig>): boolean {
  return config.schemaVersion === PRODUCTION_ONBOARDING_SCHEMA_VERSION;
}

function recipeCommitments(recipes: RecipeInput[]): RecipeKeyCommitment[] {
  return recipes.map((recipe) => {
    const normalizedAlias = normalizeRecipeAlias(recipe.alias!);
    const aliasHash = recipeAliasHash(normalizedAlias);
    return {recipeId: recipe.recipeId, version: recipe.version, normalizedAlias, aliasHash, recipeKey: deriveRecipeKey(aliasHash)};
  });
}

function validateOverrides(overrides: ElementEnforcementOverrideInput[] | undefined, bindings: RecipeBindingInput[] | undefined, recipes: RecipeInput[] | undefined, elements: ElementInput[] | undefined, v2: boolean): void {
  if (!overrides) {
    if (v2) return;
    return;
  }
  if (!v2) throw new Error("schemaVersion 1 must not include enforcementOverrides");
  if (!Array.isArray(overrides) || overrides.length > MAX_ENFORCEMENT_OVERRIDES) throw new Error(`enforcementOverrides must contain at most ${MAX_ENFORCEMENT_OVERRIDES} entries`);
  const byRecipe = new Map<number, RecipeInput>();
  for (const recipe of recipes ?? []) byRecipe.set(recipe.recipeId, recipe);
  const byElement = new Map((elements ?? []).map((element) => [element.elementId.toLowerCase(), element]));
  const seen = new Set<string>();
  for (const [index, override] of overrides.entries()) {
    assertKnownKeys(override, ["bindingIndex", "elementId", "mode"], `enforcementOverrides[${index}]`);
    validateUint(override.bindingIndex, 8, `enforcementOverrides[${index}].bindingIndex`);
    if (!bindings || override.bindingIndex >= bindings.length) throw new Error(`enforcementOverrides[${index}].bindingIndex is out of range`);
    if (!isHash32(override.elementId)) throw new Error(`enforcementOverrides[${index}].elementId must be bytes32`);
    const mode = enumValue(override.mode, ENFORCEMENT_OVERRIDE_MODE, `enforcementOverrides[${index}].mode`);
    const key = `${override.bindingIndex}:${override.elementId.toLowerCase()}`;
    if (seen.has(key)) throw new Error("enforcementOverrides must not contain duplicate bindingIndex/elementId entries");
    seen.add(key);
    const binding = bindings[override.bindingIndex];
    const recipe = byRecipe.get(binding.recipeId);
    if (!recipe?.requiredElements?.some((elementId) => elementId.toLowerCase() === override.elementId.toLowerCase())) throw new Error(`enforcementOverrides[${index}].elementId is not required by the bound recipe`);
    const element = byElement.get(override.elementId.toLowerCase());
    if (!element) throw new Error(`enforcementOverrides[${index}].elementId is not configured in elements`);
    compileAction(enumValue(element.defaultAction, ENFORCEMENT_ACTION, "defaultAction"), mode);
  }
}

function compilePlanCommitment(config: ProductionOnboardingConfig): CompiledPlanCommitment {
  const recipeById = new Map(config.recipes.map((recipe) => [recipe.recipeId, recipe]));
  const elementById = new Map(config.elements.map((element) => [element.elementId.toLowerCase(), element]));
  const overrideByBindingElement = new Map((config.enforcementOverrides ?? []).map((override) => [`${override.bindingIndex}:${override.elementId.toLowerCase()}`, override]));
  let acc = "0x" + "00".repeat(32);
  const bindings = config.recipeBindings.map((binding, bindingIndex) => {
    const recipe = recipeById.get(binding.recipeId);
    if (!recipe) throw new Error(`recipeBindings[${bindingIndex}].recipeId has no registered recipe`);
    const aliasHash = recipeAliasHash(normalizeRecipeAlias(recipe.alias!));
    const recipeKey = deriveRecipeKey(aliasHash);
    const rules = recipe.requiredElements!.map((elementId) => {
      const element = elementById.get(elementId.toLowerCase());
      if (!element) throw new Error(`recipe ${recipe.recipeId} required element is missing from elements`);
      const override = overrideByBindingElement.get(`${bindingIndex}:${elementId.toLowerCase()}`);
      const actionValue = compileAction(enumValue(element.defaultAction, ENFORCEMENT_ACTION, "defaultAction"), override?.mode);
      return {elementId, action: actionName(actionValue), actionValue};
    });
    const bindingTuple = bindingTuples([binding])[0];
    const bindingPlanHash = keccak256(coder.encode(
      ["tuple(uint16 recipeId,uint16 recipeVersion,uint8 mode,uint16 pathGroupId,uint8 priority)", "bytes32", "tuple(bytes32 elementId,uint8 action)[]"],
      [bindingTuple, recipeKey, rules.map((rule) => [rule.elementId, rule.actionValue])]
    ));
    acc = keccak256(coder.encode(["bytes32", "bytes32"], [acc, bindingPlanHash]));
    return {bindingIndex, recipeId: binding.recipeId, recipeVersion: binding.recipeVersion, recipeKey, bindingPlanHash, rules};
  });
  return {compiledPlanHash: acc, bindings};
}

function compileAction(defaultAction: number, modeValue: unknown): number {
  if (modeValue === undefined) return defaultAction;
  const mode = enumValue(modeValue, ENFORCEMENT_OVERRIDE_MODE, "override.mode");
  if (mode === ENFORCEMENT_OVERRIDE_MODE.USE_ELEMENT_DEFAULT) return defaultAction;
  if (mode === ENFORCEMENT_OVERRIDE_MODE.ESCALATE_TO_BLOCK) return ENFORCEMENT_ACTION.BLOCK;
  if (mode === ENFORCEMENT_OVERRIDE_MODE.ESCALATE_TO_OPERATOR_REVIEW) {
    if (defaultAction === ENFORCEMENT_ACTION.BLOCK) throw new Error("enforcementOverrides cannot loosen BLOCK to OPERATOR_REVIEW");
    return ENFORCEMENT_ACTION.OPERATOR_REVIEW;
  }
  if (mode === ENFORCEMENT_OVERRIDE_MODE.FORCE_FLAG_ONLY) {
    if (defaultAction !== ENFORCEMENT_ACTION.FLAG_ONLY) throw new Error("FORCE_FLAG_ONLY is allowed only for FLAG_ONLY default elements");
    return ENFORCEMENT_ACTION.FLAG_ONLY;
  }
  throw new Error("unsupported enforcement override mode");
}

function actionName(value: number): string {
  return Object.entries(ENFORCEMENT_ACTION).find(([, n]) => n === value)?.[0] ?? `UNKNOWN_${value}`;
}

function validateManifest(m: any): void {
  if (!m || typeof m !== "object" || Array.isArray(m)) throw new Error("manifest is required");
  assertKnownKeys(m, ["issuanceRecipeId", "issuanceRecipeVersion", "fundRecipeId", "enabledResalePaths", "supportedEngines", "stateScopeId", "factsPacked", "coverageScope", "fullManifestHash"], "manifest");
  validateUint(m.issuanceRecipeId, 16, "manifest.issuanceRecipeId");
  validateUint(m.issuanceRecipeVersion, 16, "manifest.issuanceRecipeVersion");
  validateUint(m.fundRecipeId, 16, "manifest.fundRecipeId");
  validateUint(m.enabledResalePaths, 32, "manifest.enabledResalePaths");
  validateUint(m.supportedEngines, 8, "manifest.supportedEngines");
  validateUint(m.stateScopeId, 16, "manifest.stateScopeId");
  parseUint(m.factsPacked, "manifest.factsPacked");
  parseUint(m.coverageScope, "manifest.coverageScope");
  if (!isHash32(m.fullManifestHash) || /^0x0{64}$/i.test(m.fullManifestHash)) throw new Error("manifest.fullManifestHash must be a non-zero bytes32");
}

function validateVenue(venue: VenueInput, index: number, seen: Set<string>): void {
  assertKnownKeys(venue, ["venue", "venueType", "adapter", "target", "operator", "custody", "active"], `venues[${index}]`);
  if (!isAddress(venue?.venue)) throw new Error(`venues[${index}].venue must be a non-zero address`);
  enumValue(venue.venueType, VENUE_TYPE, `venues[${index}].venueType`);
  if (!isAddress(venue.adapter)) throw new Error(`venues[${index}].adapter must be a non-zero address`);
  if (!isAddress(venue.target)) throw new Error(`venues[${index}].target must be a non-zero address`);
  if (!isAddress(venue.operator)) throw new Error(`venues[${index}].operator must be a non-zero address`);
  enumValue(venue.custody, CUSTODY_MODEL, `venues[${index}].custody`);
  if (typeof venue.active !== "boolean") throw new Error(`venues[${index}].active must be boolean`);
  const key = venue.venue.toLowerCase();
  if (seen.has(key)) throw new Error("venues must not contain duplicates");
  seen.add(key);
}

function validateUniqueAddresses(addresses: Record<string, string | undefined>): void {
  const seen = new Map<string, string>();
  for (const [key, value] of Object.entries(addresses)) {
    if (!value) continue;
    const lower = value.toLowerCase();
    if (seen.has(lower)) throw new Error(`addresses.${key} duplicates addresses.${seen.get(lower)}`);
    seen.set(lower, key);
  }
}

function assertKnownKeys(value: unknown, allowed: string[], path: string): void {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(`${path} must be an object`);
  const allowedSet = new Set(allowed);
  for (const key of Object.keys(value as Record<string, unknown>)) {
    if (!allowedSet.has(key)) throw new Error(`${path}.${key} is not supported`);
  }
}

function digestId(value: string): string {
  return createHash("sha256").update(value.toLowerCase()).digest("hex").slice(0, 12);
}

function deterministicProposalId(config: ProductionOnboardingConfig, entry: OnboardingTx, index: number, lane: "safe" | "operator"): string {
  const input = {
    chainId: config.chainId,
    lane,
    safe: config.governance.safe.toLowerCase(),
    operatorExecutor: config.governance.operatorExecutor.toLowerCase(),
    requiredApprovals: config.governance.requiredApprovals,
    configHash: config.configHash,
    artifactHash: config.artifactHash,
    legalPackageHash: config.legalPackageHash,
    index,
    id: entry.id,
    stage: entry.stage,
    to: entry.to.toLowerCase(),
    value: entry.value,
    data: entry.data.toLowerCase(),
    dependsOn: entry.dependsOn
  };
  return `onboarding-${createHash("sha256").update(canonicalJson(input)).digest("hex")}`;
}

function enumValue(value: unknown, values: Record<string, number>, name: string): number {
  if (typeof value === "string") {
    if (!(value in values)) throw new Error(`${name} is not supported`);
    return values[value];
  }
  if (!Number.isSafeInteger(value) || Number(value) < 0 || !Object.values(values).includes(Number(value))) throw new Error(`${name} is not supported`);
  return Number(value);
}

function validateUint(value: unknown, bits: number, name: string): void {
  if (!Number.isSafeInteger(value) || Number(value) < 0 || BigInt(Number(value)) > ((1n << BigInt(bits)) - 1n)) throw new Error(`${name} must fit uint${bits}`);
}

function parseUint(value: unknown, name: string): bigint {
  if (typeof value !== "string" || !/^(0|[1-9][0-9]*)$/.test(value)) throw new Error(`${name} must be a decimal string`);
  const n = BigInt(value);
  if (n > UINT256_MAX) throw new Error(`${name} must fit uint256`);
  return n;
}

function isAddress(value: unknown): value is string { return typeof value === "string" && ADDRESS.test(value) && !/^0x0{40}$/i.test(value); }
function isHash32(value: unknown): value is string { return typeof value === "string" && HASH32.test(value); }
function isSha(value: unknown): value is string { return typeof value === "string" && SHA256.test(value); }
function same(a: string, b: string): boolean { return a.toLowerCase() === b.toLowerCase(); }

function rejectUnsafeEvidence(value: unknown, path: string): void {
  if (typeof value === "string") {
    const hashLike = /(Hash|hash|elementId|reasonHash|fullManifestHash|recipeKey)$/.test(path) || path.includes(".codeHashes.") || path.includes(".requiredElements[");
    const addressLike = ADDRESS.test(value);
    const decimalAmountLike = /\.(minBalance|minAllowance|factsPacked|coverageScope)$/.test(path);
    if (SECRET_VALUE.test(value) && !hashLike) throw new Error(`${path} must not contain signer secrets or raw private keys`);
    if (!addressLike && !hashLike && !decimalAmountLike && (/@/.test(value) || /\+?[0-9][0-9 .()\-]{7,}/.test(value))) throw new Error(`${path} must be PII-free evidence, not raw contact/person data`);
    return;
  }
  if (!value || typeof value !== "object") return;
  if (Array.isArray(value)) return value.forEach((entry, i) => rejectUnsafeEvidence(entry, `${path}[${i}]`));
  for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
    if (SECRET_KEY.test(key)) throw new Error(`${path}.${key} must not contain signer secrets, raw PII, or private keys`);
    rejectUnsafeEvidence(entry, `${path}.${key}`);
  }
}

function canonicalJson(value: unknown): string {
  if (typeof value === "bigint") return JSON.stringify(value.toString());
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.entries(value as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => `${JSON.stringify(k)}:${canonicalJson(v)}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

async function verifyCode(reader: OnboardingReader, address: string, name: string, check: (name: string, pass: boolean, detail: string) => void, expected?: string): Promise<void> {
  try {
    const code = await reader.getCode(address);
    const present = code !== "0x";
    if (!present) return check(name, false, `${address} has no code`);
    if (expected) {
      const actual = keccak256(code);
      return check(name, actual.toLowerCase() === expected.toLowerCase(), `expected=${expected}; actual=${actual}`);
    }
    check(name, true, `${address} code present`);
  } catch (err: any) { check(name, false, `unavailable: ${err.message}`); }
}

async function verifyCallAddress(reader: OnboardingReader, to: string, abi: string[], fn: string, args: unknown[], expected: string, name: string, check: (name: string, pass: boolean, detail: string) => void): Promise<void> {
  try {
    const actual = await reader.call(to, abi, fn, args);
    check(name, String(actual).toLowerCase() === expected.toLowerCase(), `expected=${expected}; actual=${String(actual)}`);
  } catch (err: any) { check(name, false, `unavailable: ${err.message}`); }
}

async function verifyCallHash(reader: OnboardingReader, to: string, abi: string[], fn: string, args: unknown[], expected: string, name: string, check: (name: string, pass: boolean, detail: string) => void): Promise<void> {
  try {
    const actual = await reader.call(to, abi, fn, args);
    check(name, String(actual).toLowerCase() === expected.toLowerCase(), `expected=${expected}; actual=${String(actual)}`);
  } catch (err: any) { check(name, false, `unavailable: ${err.message}`); }
}

async function verifyCallUint(reader: OnboardingReader, to: string, abi: string[], fn: string, args: unknown[], expected: number, name: string, check: (name: string, pass: boolean, detail: string) => void): Promise<void> {
  try {
    const actual = await reader.call(to, abi, fn, args);
    check(name, Number(actual) === expected, `expected=${expected}; actual=${String(actual)}`);
  } catch (err: any) { check(name, false, `unavailable: ${err.message}`); }
}

async function verifyOwner(reader: OnboardingReader, to: string, expectedOwner: string, name: string, check: (name: string, pass: boolean, detail: string) => void): Promise<void> {
  try {
    const actual = await reader.call(to, OWNED, "owner", []);
    check(name, String(actual).toLowerCase() === expectedOwner.toLowerCase(), `expected=${expectedOwner}; actual=${String(actual)}`);
  } catch (err: any) { check(name, false, `unavailable: ${err.message}`); }
}

async function verifyOperatorRole(reader: OnboardingReader, to: string, operator: string, name: string, check: (name: string, pass: boolean, detail: string) => void): Promise<void> {
  try {
    const actual = await reader.call(to, ["function isOperator(address) view returns (bool)"], "isOperator", [operator]);
    check(name, actual === true, `operator=${operator}; isOperator=${actual}`);
  } catch (err: any) { check(name, false, `unavailable: ${err.message}`); }
}

async function verifyCallBool(reader: OnboardingReader, to: string, abi: string[], fn: string, args: unknown[], expected: boolean, name: string, check: (name: string, pass: boolean, detail: string) => void): Promise<void> {
  try {
    const actual = await reader.call(to, abi, fn, args);
    check(name, Boolean(actual) === expected, `expected=${expected}; actual=${Boolean(actual)}`);
  } catch (err: any) { check(name, false, `unavailable: ${err.message}`); }
}

async function verifyCompiledPlan(selected: ProductionOnboardingConfig, reader: OnboardingReader, check: (name: string, pass: boolean, detail: string) => void): Promise<void> {
  const expected = compilePlanCommitment(selected);
  try {
    const actual = await reader.call(selected.addresses.tokenPolicyRegistry, ["function compiledPlanHashOf(address) view returns (bytes32)"], "compiledPlanHashOf", [selected.addresses.token]);
    check("compiled-plan-hash", String(actual).toLowerCase() === expected.compiledPlanHash.toLowerCase(), `expected=${expected.compiledPlanHash}; actual=${String(actual)}`);
  } catch (err: any) { check("compiled-plan-hash", false, `unavailable: ${err.message}`); }
  try {
    const count = await reader.call(selected.addresses.tokenPolicyRegistry, ["function compiledBindingCountOf(address) view returns (uint256)"], "compiledBindingCountOf", [selected.addresses.token]);
    check("compiled-binding-count", BigInt(count) === BigInt(expected.bindings.length), `expected=${expected.bindings.length}; actual=${String(count)}`);
  } catch (err: any) { check("compiled-binding-count", false, `unavailable: ${err.message}`); }
  for (const expectedBinding of expected.bindings) {
    try {
      const actual = await reader.call(selected.addresses.tokenPolicyRegistry, ["function compiledBindingOf(address,uint256) view returns (tuple(uint16 recipeId,uint16 recipeVersion,uint8 mode,uint16 pathGroupId,uint8 priority) binding,bytes32 recipeKey,bytes32 bindingPlanHash)"], "compiledBindingOf", [selected.addresses.token, expectedBinding.bindingIndex]);
      const binding = actual.binding ?? actual[0];
      const recipeKey = String(actual.recipeKey ?? actual[1]);
      const bindingPlanHash = String(actual.bindingPlanHash ?? actual[2]);
      const expectedTuple = bindingTuples([selected.recipeBindings[expectedBinding.bindingIndex]])[0].map(Number);
      const actualTuple = [Number(binding.recipeId ?? binding[0]), Number(binding.recipeVersion ?? binding[1]), Number(binding.mode ?? binding[2]), Number(binding.pathGroupId ?? binding[3]), Number(binding.priority ?? binding[4])];
      check(`compiled-binding-${expectedBinding.bindingIndex}`, JSON.stringify(actualTuple) === JSON.stringify(expectedTuple) && recipeKey.toLowerCase() === expectedBinding.recipeKey.toLowerCase() && bindingPlanHash.toLowerCase() === expectedBinding.bindingPlanHash.toLowerCase(), `expected=${JSON.stringify({binding: expectedTuple, recipeKey: expectedBinding.recipeKey, bindingPlanHash: expectedBinding.bindingPlanHash})}; actual=${JSON.stringify({binding: actualTuple, recipeKey, bindingPlanHash})}`);
    } catch (err: any) { check(`compiled-binding-${expectedBinding.bindingIndex}`, false, `unavailable: ${err.message}`); }
    try {
      const actualRules = await reader.call(selected.addresses.tokenPolicyRegistry, ["function compiledRulesOf(address,uint256) view returns (tuple(bytes32 elementId,uint8 action)[])"], "compiledRulesOf", [selected.addresses.token, expectedBinding.bindingIndex]);
      const normalized = Array.from(actualRules ?? []).map((rule: any) => ({elementId: String(rule.elementId ?? rule[0]).toLowerCase(), actionValue: Number(rule.action ?? rule[1])}));
      const expectedRules = expectedBinding.rules.map((rule) => ({elementId: rule.elementId.toLowerCase(), actionValue: rule.actionValue}));
      check(`compiled-rules-${expectedBinding.bindingIndex}`, JSON.stringify(normalized) === JSON.stringify(expectedRules), `expected=${JSON.stringify(expectedRules)}; actual=${JSON.stringify(normalized)}`);
    } catch (err: any) { check(`compiled-rules-${expectedBinding.bindingIndex}`, false, `unavailable: ${err.message}`); }
  }
}

function normalizeBindings(bindings: any): number[][] {
  return Array.from(bindings ?? []).map((b: any) => [Number(b.recipeId ?? b[0]), Number(b.recipeVersion ?? b[1]), Number(b.mode ?? b[2]), Number(b.pathGroupId ?? b[3]), Number(b.priority ?? b[4])]);
}

function venueMatches(actual: any, expected: any[]): boolean {
  return Number(actual.venueType ?? actual[0]) === expected[0] &&
    String(actual.adapter ?? actual[1]).toLowerCase() === String(expected[1]).toLowerCase() &&
    String(actual.target ?? actual[2]).toLowerCase() === String(expected[2]).toLowerCase() &&
    String(actual.operator ?? actual[3]).toLowerCase() === String(expected[3]).toLowerCase() &&
    Number(actual.custody ?? actual[4]) === expected[4] &&
    Boolean(actual.active ?? actual[5]) === expected[5];
}

function tupleToJson(tuple: any): any {
  return Array.isArray(tuple) ? tuple.map((v) => typeof v === "bigint" ? v.toString() : v) : tuple;
}
