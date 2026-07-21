export type TemplateKind = "element" | "recipe" | "adapter" | "provider";

export interface ToolkitTemplate {
  id: string;
  version: number;
  kind: TemplateKind;
  label: string;
  requiredInputs: string[];
  trustBoundary: "onchain" | "offchain" | "external";
  notes: string;
}

export const BUILT_IN_TEMPLATES: readonly ToolkitTemplate[] = [
  {
    id: "element.attestation",
    version: 1,
    kind: "element",
    label: "Attestation-backed Element",
    requiredInputs: ["claimTopic", "trustedIssuer", "expiryPolicy"],
    trustBoundary: "external",
    notes: "Reads an issuer/ONCHAINID-backed fact; it does not mint or infer a claim."
  },
  {
    id: "recipe.cumulative",
    version: 1,
    kind: "recipe",
    label: "Cumulative Recipe",
    requiredInputs: ["elementIds", "applicabilityFacts", "recipeKey"],
    trustBoundary: "onchain",
    notes: "Combines registered Elements; legal meaning remains an operator-approved input."
  },
  {
    id: "adapter.router",
    version: 1,
    kind: "adapter",
    label: "Router-mediated Venue Adapter",
    requiredInputs: ["venueType", "venueAddress", "assetPair"],
    trustBoundary: "onchain",
    notes: "Must be called by ExecutionRouter; direct settlement bypass is not supported."
  },
  {
    id: "provider.issuer",
    version: 1,
    kind: "provider",
    label: "Issuer/TA Claim Provider",
    requiredInputs: ["issuer", "claimTopics", "refreshPolicy"],
    trustBoundary: "external",
    notes: "Provider output is treated as untrusted input until verified by the configured boundary."
  }
];

export function getTemplate(id: string): ToolkitTemplate {
  const template = BUILT_IN_TEMPLATES.find((candidate) => candidate.id === id);
  if (!template) throw new Error(`unknown Toolkit template ${id}`);
  return template;
}

export function validateTemplateInputs(template: ToolkitTemplate, inputs: Record<string, unknown>): void {
  const missing = template.requiredInputs.filter((key) => inputs[key] === undefined || inputs[key] === "");
  if (missing.length > 0) throw new Error(`${template.id} missing required inputs: ${missing.join(", ")}`);
}
