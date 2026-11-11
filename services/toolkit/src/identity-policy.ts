import {AbiCoder, encodeBytes32String, keccak256, toUtf8Bytes} from "ethers";
import type {ProductionOnboardingConfig, RecipeInput} from "./production-onboarding";

export const IDENTITY_POLICY_ELEMENT_ID = encodeBytes32String("A-04-v2");
export const IDENTITY_POLICY_SCHEMA_ID = keccak256(toUtf8Bytes("corner-store.element.identity-policy.v1"));
export const IDENTITY_POLICY_TRACK = {RFQ: 1, TSV: 2} as const;
export const KYC_TOPOLOGY = {DIRECT: 1, MEMBER: 2} as const;

export interface IdentityPolicyInput {
  track: keyof typeof IDENTITY_POLICY_TRACK;
  kycTopology: keyof typeof KYC_TOPOLOGY;
}

export function encodeIdentityPolicyParameters(policy: IdentityPolicyInput): string {
  if (!policy || typeof policy !== "object" || Array.isArray(policy) || Object.keys(policy).some((key) => key !== "track" && key !== "kycTopology")) throw new Error("identityPolicy requires only track and kycTopology");
  if (policy.track !== "RFQ" && policy.track !== "TSV") throw new Error("identityPolicy.track must be RFQ or TSV");
  if (policy.kycTopology !== "DIRECT") throw new Error("identityPolicy.kycTopology must explicitly select DIRECT; MEMBER is deferred");
  return AbiCoder.defaultAbiCoder().encode(["uint8", "uint8"], [IDENTITY_POLICY_TRACK[policy.track], KYC_TOPOLOGY.DIRECT]);
}

export function decodeIdentityPolicyParameters(parameters: string): IdentityPolicyInput {
  if (typeof parameters !== "string" || !/^0x[0-9a-fA-F]{128}$/.test(parameters)) throw new Error("identity policy parameters must be exactly 64 bytes");
  const track = BigInt(`0x${parameters.slice(2, 66)}`);
  const topology = BigInt(`0x${parameters.slice(66)}`);
  if ((track !== 1n && track !== 2n) || topology !== 1n) throw new Error("identity policy parameters require RFQ or TSV and DIRECT topology");
  return {track: track === 1n ? "RFQ" : "TSV", kycTopology: "DIRECT"};
}

export function validateIdentityPolicies(config: ProductionOnboardingConfig): void {
  const identityId = IDENTITY_POLICY_ELEMENT_ID.toLowerCase();
  const legacyId = encodeBytes32String("A-04-v1").toLowerCase();
  const hasIdentity = (recipe: RecipeInput, id: string) => recipe.requiredElements?.some((elementId) => elementId.toLowerCase() === id);
  if (config.schemaVersion < 7) {
    if (config.recipes.some((recipe) => recipe.identityPolicy !== undefined || hasIdentity(recipe, identityId))) throw new Error("identityPolicy and A-04-v2 require schemaVersion 7");
    return;
  }
  for (const recipe of config.recipes) {
    if (hasIdentity(recipe, legacyId)) throw new Error("schemaVersion 7 identity policies require A-04-v2");
    if (!hasIdentity(recipe, identityId)) {
      if (recipe.identityPolicy !== undefined) throw new Error("identityPolicy requires A-04-v2 in requiredElements");
      continue;
    }
    const expected = encodeIdentityPolicyParameters(recipe.identityPolicy!);
    const element = config.elements.find((element) => element.elementId.toLowerCase() === identityId)!;
    if (!element || element.parameterSchemaId?.toLowerCase() !== IDENTITY_POLICY_SCHEMA_ID.toLowerCase() || element.parameterSchemaVersion !== 1 || element.maxParameterBytes !== 64 || element.parametersRequired !== true) throw new Error("A-04-v2 identity policy capability must require schema v1 and 64 parameter bytes");
    if (element.defaultAction !== "BLOCK" && element.defaultAction !== 2) throw new Error("A-04-v2 identity policy default must be BLOCK");
    for (const [bindingIndex, binding] of config.recipeBindings.entries()) {
      if (binding.recipeId !== recipe.recipeId) continue;
      if (binding.mode !== "REQUIRED_BLOCKING" && binding.mode !== 0) throw new Error("A-04-v2 identity policy must use a REQUIRED_BLOCKING binding");
      const entry = config.policyConfig?.elementParameters.find((entry) => entry.bindingIndex === bindingIndex && entry.elementId.toLowerCase() === identityId);
      if (!entry || entry.parameters.toLowerCase() !== expected.toLowerCase()) throw new Error(`A-04-v2 identity policy parameters must commit the declared DIRECT topology and track at binding ${bindingIndex}`);
    }
  }
}
