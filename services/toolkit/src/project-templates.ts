import {RFQIntegrationMode} from "./integration";

export const PROJECT_DESCRIPTOR_SCHEMA_VERSION = 1;

export type ProjectTemplateId = "sandbox" | "dex-integration" | "asset-onboarding" | "rfq-service";

export interface ProjectTemplateDefinition {
  id: ProjectTemplateId;
  mode: RFQIntegrationMode;
  summary: string;
  maturity: "demo" | "integration" | "production-tooling";
  capabilities: string[];
  nextSteps: string[];
  dockerEligible: boolean;
}

export interface ProjectDescriptor {
  schemaVersion: typeof PROJECT_DESCRIPTOR_SCHEMA_VERSION;
  template: ProjectTemplateId;
  compatibilityMode: RFQIntegrationMode;
  maturity: ProjectTemplateDefinition["maturity"];
  config: string;
  deploymentArtifact: string;
  capabilities: string[];
  nextSteps: string[];
  dockerCompose: boolean;
}

export interface ProjectTemplateSelection {
  definition: ProjectTemplateDefinition;
  mode: RFQIntegrationMode;
  source: "template" | "legacy-mode" | "default";
}

const DEFINITIONS: Record<ProjectTemplateId, ProjectTemplateDefinition> = {
  sandbox: {
    id: "sandbox",
    mode: "reference-service",
    summary: "Evaluate the reference policy and RFQ service without claiming production readiness.",
    maturity: "demo",
    capabilities: ["policy-preview", "reference-rfq", "local-deployment"],
    nextSteps: [
      "docker compose up --build -d",
      "visit http://127.0.0.1:8790 after services become healthy",
      "docker compose down --volumes --remove-orphans"
    ],
    dockerEligible: true
  },
  "dex-integration": {
    id: "dex-integration",
    mode: "library-only",
    summary: "Integrate Corner Store policy and RFQ contracts into an existing venue boundary.",
    maturity: "integration",
    capabilities: ["policy-facade", "rfq-library", "deployment-preflight"],
    nextSteps: ["npm test", "npm run policy:explain", "npm run doctor"],
    dockerEligible: false
  },
  "asset-onboarding": {
    id: "asset-onboarding",
    mode: "library-only",
    summary: "Prepare dry-run and unsigned ERC-3643 onboarding inputs from one reviewed config.",
    maturity: "production-tooling",
    capabilities: ["policy-facade", "asset-config", "unsigned-export"],
    nextSteps: ["npm test", "npm run policy:explain", "corner-store production-onboarding-plan --help"],
    dockerEligible: false
  },
  "rfq-service": {
    id: "rfq-service",
    mode: "reference-service",
    summary: "Connect replaceable pricing, risk, signer and nonce modules to the RFQ SDK contract.",
    maturity: "integration",
    capabilities: ["policy-facade", "reference-rfq", "module-conformance"],
    nextSteps: ["npm test", "npm run policy:explain", "npm start"],
    dockerEligible: true
  }
};

const LEGACY_TEMPLATE: Record<RFQIntegrationMode, ProjectTemplateId> = {
  "library-only": "dex-integration",
  "reference-service": "rfq-service",
  "existing-backend": "rfq-service"
};

export function projectTemplate(id: string): ProjectTemplateDefinition {
  if (!hasTemplate(id)) throw new Error(`unknown project template ${id}`);
  const definition = DEFINITIONS[id];
  return {...definition, capabilities: [...definition.capabilities], nextSteps: [...definition.nextSteps]};
}

export function listProjectTemplates(): ProjectTemplateDefinition[] {
  return Object.keys(DEFINITIONS).map((id) => projectTemplate(id as ProjectTemplateId));
}

export function resolveProjectTemplate(input: {
  template?: string;
  mode?: string;
  dockerCompose?: boolean;
}): ProjectTemplateSelection {
  if (input.template && input.mode) {
    throw new Error("choose --template or legacy --mode, not both");
  }
  if (input.template) {
    if (!hasTemplate(input.template)) {
      throw new Error(`unknown project template ${input.template}; expected ${Object.keys(DEFINITIONS).join(", ")}`);
    }
    const definition = DEFINITIONS[input.template as ProjectTemplateId];
    assertDockerChoice(definition, input.dockerCompose === true);
    return {definition, mode: definition.mode, source: "template"};
  }
  if (input.mode) {
    if (input.mode !== "library-only" && input.mode !== "reference-service" && input.mode !== "existing-backend") {
      throw new Error('legacy mode must be "library-only", "reference-service", or "existing-backend"');
    }
    const definition = DEFINITIONS[LEGACY_TEMPLATE[input.mode]];
    if (input.dockerCompose && input.mode !== "reference-service") {
      throw new Error("Docker export is available only for reference-service mode");
    }
    return {definition, mode: input.mode, source: "legacy-mode"};
  }
  const definition = DEFINITIONS["dex-integration"];
  assertDockerChoice(definition, input.dockerCompose === true);
  return {definition, mode: definition.mode, source: "default"};
}

export function createProjectDescriptor(
  selection: ProjectTemplateSelection,
  dockerCompose: boolean
): ProjectDescriptor {
  return {
    schemaVersion: PROJECT_DESCRIPTOR_SCHEMA_VERSION,
    template: selection.definition.id,
    compatibilityMode: selection.mode,
    maturity: selection.definition.maturity,
    config: "corner-store.config.json",
    deploymentArtifact: "deployments/anvil-e2e.json",
    capabilities: [...selection.definition.capabilities],
    nextSteps: [...selection.definition.nextSteps],
    dockerCompose
  };
}

export function validateProjectDescriptor(value: unknown): ProjectDescriptor {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("project descriptor must be an object");
  }
  const descriptor = value as Partial<ProjectDescriptor>;
  if (descriptor.schemaVersion !== PROJECT_DESCRIPTOR_SCHEMA_VERSION) {
    throw new Error(`project descriptor schemaVersion must be ${PROJECT_DESCRIPTOR_SCHEMA_VERSION}`);
  }
  if (!descriptor.template || !hasTemplate(descriptor.template)) {
    throw new Error("project descriptor template is invalid");
  }
  const definition = DEFINITIONS[descriptor.template];
  if (
    descriptor.compatibilityMode !== "library-only" &&
    descriptor.compatibilityMode !== "reference-service" &&
    descriptor.compatibilityMode !== "existing-backend"
  ) {
    throw new Error("project descriptor compatibilityMode is invalid");
  }
  if (descriptor.maturity !== definition.maturity) {
    throw new Error(`project descriptor maturity must be ${definition.maturity}`);
  }
  if (descriptor.config !== "corner-store.config.json" || descriptor.deploymentArtifact !== "deployments/anvil-e2e.json") {
    throw new Error("project descriptor config/artifact paths are invalid");
  }
  if (!Array.isArray(descriptor.capabilities) || !Array.isArray(descriptor.nextSteps)) {
    throw new Error("project descriptor capabilities and nextSteps are required");
  }
  if (
    JSON.stringify(descriptor.capabilities) !== JSON.stringify(definition.capabilities) ||
    JSON.stringify(descriptor.nextSteps) !== JSON.stringify(definition.nextSteps)
  ) {
    throw new Error("project descriptor capabilities or nextSteps do not match the selected template");
  }
  if (typeof descriptor.dockerCompose !== "boolean") {
    throw new Error("project descriptor dockerCompose must be boolean");
  }
  assertDockerChoice(definition, descriptor.dockerCompose);
  return descriptor as ProjectDescriptor;
}

function assertDockerChoice(definition: ProjectTemplateDefinition, dockerCompose: boolean): void {
  if (dockerCompose && !definition.dockerEligible) {
    throw new Error(`Docker export is not available for ${definition.id}; choose sandbox or rfq-service`);
  }
}

function hasTemplate(value: string): value is ProjectTemplateId {
  return Object.prototype.hasOwnProperty.call(DEFINITIONS, value);
}
