import {
  InventoryRiskCheck,
  NonceStore,
  PricingProvider,
  RFQBackendSDKConfig,
  RFQModule,
  RFQModuleDescriptor,
  RFQModuleKind,
  RFQModuleRuntimeConfig,
  RFQModuleSet,
  RFQ_MODULE_SCHEMA_VERSION,
  TypedDataSigner
} from "./types";
import {RFQBackendSDK, createRFQService} from "./quoteService";

export const RFQ_MODULE_CAPABILITIES: Readonly<Record<RFQModuleKind, readonly string[]>> = {
  pricing: ["rfq.price.v1"],
  risk: ["rfq.risk.pre-sign.v1"],
  signer: ["rfq.sign.eip712.v1"],
  nonce: ["rfq.nonce.maker-scoped.v1"]
};

export function defineRFQModule<T>(
  descriptor: Omit<RFQModuleDescriptor, "schemaVersion">,
  implementation: T
): RFQModule<T> {
  const module = {
    descriptor: {...descriptor, schemaVersion: RFQ_MODULE_SCHEMA_VERSION},
    implementation
  } as RFQModule<T>;
  validateRFQModule(module);
  return module;
}

export function validateRFQModule(module: RFQModule<unknown>, expectedKind?: RFQModuleKind): void {
  const descriptor = module?.descriptor;
  if (!descriptor || descriptor.schemaVersion !== RFQ_MODULE_SCHEMA_VERSION) {
    throw new Error(`RFQ module schemaVersion must be ${RFQ_MODULE_SCHEMA_VERSION}`);
  }
  if (expectedKind && descriptor.kind !== expectedKind) {
    throw new Error(`RFQ module ${descriptor.id} must have kind ${expectedKind}`);
  }
  if (!["pricing", "risk", "signer", "nonce"].includes(descriptor.kind)) {
    throw new Error(`RFQ module ${descriptor.id} kind is invalid`);
  }
  if (!/^[a-z0-9][a-z0-9._-]*$/.test(descriptor.id)) throw new Error("RFQ module id is invalid");
  if (!/^\d+\.\d+\.\d+$/.test(descriptor.version)) throw new Error(`RFQ module ${descriptor.id} version must be semver`);
  if (!["reference", "custom", "production"].includes(descriptor.maturity)) {
    throw new Error(`RFQ module ${descriptor.id} maturity is invalid`);
  }
  if (!Array.isArray(descriptor.capabilities) || !Array.isArray(descriptor.configKeys) || !Array.isArray(descriptor.secretConfigKeys)) {
    throw new Error(`RFQ module ${descriptor.id} descriptor lists are required`);
  }
  const required = RFQ_MODULE_CAPABILITIES[descriptor.kind];
  for (const capability of required) {
    if (!descriptor.capabilities.includes(capability)) {
      throw new Error(`RFQ module ${descriptor.id} missing capability ${capability}`);
    }
  }
  if (!module.implementation) throw new Error(`RFQ module ${descriptor.id} implementation is required`);
  if (new Set(descriptor.capabilities).size !== descriptor.capabilities.length ||
      new Set(descriptor.configKeys).size !== descriptor.configKeys.length ||
      new Set(descriptor.secretConfigKeys).size !== descriptor.secretConfigKeys.length) {
    throw new Error(`RFQ module ${descriptor.id} descriptor lists must not contain duplicates`);
  }
  for (const secretKey of descriptor.secretConfigKeys) {
    if (!descriptor.configKeys.includes(secretKey)) {
      throw new Error(`RFQ module ${descriptor.id} secretConfigKeys must be included in configKeys`);
    }
  }
}

export function validateRFQModuleSet(modules: RFQModuleSet): void {
  validateRFQModule(modules.pricing, "pricing");
  validateRFQModule(modules.risk, "risk");
  validateRFQModule(modules.signer, "signer");
  validateRFQModule(modules.nonce, "nonce");
}

export function createRFQServiceFromModules(config: RFQModuleRuntimeConfig): RFQBackendSDK {
  validateRFQModuleSet(config.modules);
  const sdkConfig: RFQBackendSDKConfig = {
    chainId: config.chainId,
    verifyingContract: config.verifyingContract,
    maker: config.maker,
    pricing: config.modules.pricing.implementation,
    riskCheck: config.modules.risk.implementation,
    signer: config.modules.signer.implementation,
    nonceStore: config.modules.nonce.implementation,
    defaultTtlSeconds: config.defaultTtlSeconds,
    now: config.now
  };
  return createRFQService(sdkConfig);
}

export function pricingModule(
  id: string,
  implementation: PricingProvider,
  options: ModuleOptions = {}
): RFQModule<PricingProvider> {
  return defineRFQModule(descriptor(id, "pricing", options), implementation);
}

export function riskModule(
  id: string,
  implementation: InventoryRiskCheck,
  options: ModuleOptions = {}
): RFQModule<InventoryRiskCheck> {
  return defineRFQModule(descriptor(id, "risk", options), implementation);
}

export function signerModule(
  id: string,
  implementation: TypedDataSigner,
  options: ModuleOptions = {}
): RFQModule<TypedDataSigner> {
  return defineRFQModule(descriptor(id, "signer", options), implementation);
}

export function nonceModule(
  id: string,
  implementation: NonceStore,
  options: ModuleOptions = {}
): RFQModule<NonceStore> {
  return defineRFQModule(descriptor(id, "nonce", options), implementation);
}

export interface ModuleOptions {
  version?: string;
  maturity?: RFQModuleDescriptor["maturity"];
  capabilities?: string[];
  configKeys?: string[];
  secretConfigKeys?: string[];
}

function descriptor(
  id: string,
  kind: RFQModuleKind,
  options: ModuleOptions
): Omit<RFQModuleDescriptor, "schemaVersion"> {
  return {
    id,
    version: options.version ?? "1.0.0",
    kind,
    maturity: options.maturity ?? "custom",
    capabilities: [...RFQ_MODULE_CAPABILITIES[kind], ...(options.capabilities ?? [])],
    configKeys: options.configKeys ?? [],
    secretConfigKeys: options.secretConfigKeys ?? []
  };
}
