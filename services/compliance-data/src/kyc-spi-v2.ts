import {Address, Hex} from "./types";
import {KycProviderMetadata, ProviderKycAdapterContext, ProviderNeutralKycFacts, ProviderAssessmentStatus, validateKycProviderMetadata} from "./kyc-spi";
export type {Address, Hex} from "./types";
export type {KycProviderMetadata, ProviderKycAdapterContext} from "./kyc-spi";

export const KYC_PROVIDER_SPI_VERSION_V2 = "2.0.0";
export type AttestationTypeV2 = "PUBLIC_LOOKUP" | "SOURCE_REATTEST" | "SELECTIVE_DISCLOSURE";

export interface KycProvenanceV2 {
  issuerId: Hex;
  issuedAt: number;
  expiresAt: number;
  trustBasisHash: Hex;
  attestationType: AttestationTypeV2;
}

export interface ProviderKycRequestV2 {
  subject: Address;
  identity: Hex;
  asset: Address;
  requestRefHash: Hex;
}

export interface ProviderKycAssessmentV2 extends Omit<ProviderKycRequestV2, "requestRefHash"> {
  providerId: string;
  providerSchemaVersion: string;
  assessmentRefHash: Hex;
  sourceEvidenceHash: Hex;
  facts: ProviderNeutralKycFacts;
  observedAt: number;
  validUntil: number;
  status: ProviderAssessmentStatus;
  provenance: KycProvenanceV2;
  lei?: string;
}

export interface ProviderKycAdapterV2 {
  readonly metadata: KycProviderMetadata;
  assess(request: ProviderKycRequestV2, context?: ProviderKycAdapterContext): Promise<ProviderKycAssessmentV2>;
}

export function validateKycProviderMetadataV2(value: unknown): KycProviderMetadata {
  try {
    if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error();
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) throw new Error();
    const input = value as KycProviderMetadata;
    if (input.spiVersion !== KYC_PROVIDER_SPI_VERSION_V2) throw new Error();
    const normalized = validateKycProviderMetadata({...input, spiVersion: "1.0.0"});
    return Object.freeze({...normalized, spiVersion: KYC_PROVIDER_SPI_VERSION_V2});
  } catch {
    throw new Error("KYC v2 provider metadata is incompatible");
  }
}
