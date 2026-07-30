export const INTEGRATION_SCHEMA_VERSION = 1;
export type RFQIntegrationMode = "library-only" | "reference-service" | "existing-backend";
export type RFQIntegrationModuleKind = "pricing" | "risk" | "signer" | "nonce";

export interface IntegrationModuleBinding {
  moduleId: string;
  moduleVersion: string;
  capabilities: string[];
  env: string[];
}

export interface RFQIntegrationManifest {
  schemaVersion: typeof INTEGRATION_SCHEMA_VERSION;
  mode: RFQIntegrationMode;
  sdk: {package: "@corner-store/rfq-service"; version: string};
  modules: Record<RFQIntegrationModuleKind, IntegrationModuleBinding>;
  deployment: {dockerCompose: boolean};
}

const MODULE_KINDS: RFQIntegrationModuleKind[] = ["pricing", "risk", "signer", "nonce"];
const REQUIRED_CAPABILITY: Record<RFQIntegrationModuleKind, string> = {
  pricing: "rfq.price.v1",
  risk: "rfq.risk.pre-sign.v1",
  signer: "rfq.sign.eip712.v1",
  nonce: "rfq.nonce.maker-scoped.v1"
};
const ENV_NAME = /^[A-Z][A-Z0-9_]*$/;

export function defaultIntegrationManifest(
  mode: RFQIntegrationMode,
  dockerCompose = false
): RFQIntegrationManifest {
  return {
    schemaVersion: INTEGRATION_SCHEMA_VERSION,
    mode,
    sdk: {package: "@corner-store/rfq-service", version: "0.1.0"},
    modules: {
      pricing: binding(mode === "reference-service" ? "corner-store.fixed-rate" : "integrator.pricing", "pricing", ["RFQ_PRICE_NUMERATOR", "RFQ_PRICE_DENOMINATOR"]),
      risk: binding(mode === "reference-service" ? "corner-store.noop-risk" : "integrator.risk", "risk", []),
      signer: binding("integrator.signer", "signer", ["RFQ_SIGNER_PRIVATE_KEY"]),
      nonce: binding(mode === "reference-service" ? "corner-store.in-memory-nonce" : "integrator.nonce", "nonce", [])
    },
    deployment: {dockerCompose}
  };
}

export function validateIntegrationManifest(value: unknown): RFQIntegrationManifest {
  if (!value || typeof value !== "object") throw new Error("integration manifest must be an object");
  const manifest = value as Partial<RFQIntegrationManifest>;
  if (manifest.schemaVersion !== INTEGRATION_SCHEMA_VERSION) {
    throw new Error(`integration schemaVersion must be ${INTEGRATION_SCHEMA_VERSION}`);
  }
  if (
    manifest.mode !== "library-only" &&
    manifest.mode !== "reference-service" &&
    manifest.mode !== "existing-backend"
  ) {
    throw new Error('integration mode must be "library-only", "reference-service", or "existing-backend"');
  }
  if (manifest.sdk?.package !== "@corner-store/rfq-service" || !/^\d+\.\d+\.\d+$/.test(manifest.sdk.version ?? "")) {
    throw new Error("integration sdk package/version is invalid");
  }
  if (!manifest.modules || typeof manifest.modules !== "object") throw new Error("integration modules are required");
  for (const kind of MODULE_KINDS) validateBinding(kind, manifest.modules[kind]);
  if (!manifest.deployment || typeof manifest.deployment.dockerCompose !== "boolean") {
    throw new Error("integration deployment.dockerCompose must be boolean");
  }
  return manifest as RFQIntegrationManifest;
}

function validateBinding(kind: RFQIntegrationModuleKind, binding: IntegrationModuleBinding | undefined): void {
  if (!binding || !/^[a-z0-9][a-z0-9._-]*$/.test(binding.moduleId)) {
    throw new Error(`integration ${kind}.moduleId is invalid`);
  }
  if (!/^\d+\.\d+\.\d+$/.test(binding.moduleVersion)) {
    throw new Error(`integration ${kind}.moduleVersion must be semver`);
  }
  if (!Array.isArray(binding.capabilities) || !binding.capabilities.includes(REQUIRED_CAPABILITY[kind])) {
    throw new Error(`integration ${kind} missing capability ${REQUIRED_CAPABILITY[kind]}`);
  }
  if (!Array.isArray(binding.env) || binding.env.some((name) => !ENV_NAME.test(name))) {
    throw new Error(`integration ${kind}.env must contain environment variable names only`);
  }
  if (new Set(binding.env).size !== binding.env.length) {
    throw new Error(`integration ${kind}.env contains duplicates`);
  }
}

function binding(moduleId: string, kind: RFQIntegrationModuleKind, env: string[]): IntegrationModuleBinding {
  return {
    moduleId,
    moduleVersion: "1.0.0",
    capabilities: [REQUIRED_CAPABILITY[kind]],
    env
  };
}
