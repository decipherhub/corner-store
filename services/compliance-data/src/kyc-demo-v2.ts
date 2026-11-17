import {assertAddress} from "./canonical";
import {KycProviderError, ProviderAssessmentStatus, ProviderKycAdapterContext, ProviderNeutralKycFacts} from "./kyc-spi";
import {KYC_PROVIDER_SPI_VERSION_V2, KycProvenanceV2, ProviderKycAdapterV2, ProviderKycAssessmentV2, ProviderKycRequestV2, validateKycProviderMetadataV2} from "./kyc-spi-v2";
import {KycCommitmentsV2, validateLei} from "./kyc-hmac-v2";
import {Address} from "./types";

export interface DemoKycFixtureV2 {
  subject: Address;
  facts: ProviderNeutralKycFacts;
  status?: ProviderAssessmentStatus;
  lei?: string;
}

export class DemoKycProviderAdapterV2 implements ProviderKycAdapterV2 {
  readonly metadata = validateKycProviderMetadataV2({spiVersion: KYC_PROVIDER_SPI_VERSION_V2, providerId: "corner-store-demo", providerSchemaVersions: ["corner-store-demo.v2"], capabilities: ["kyc", "sanctions", "accreditedInvestor", "qualifiedPurchaser", "jurisdiction"], environment: "demo"});
  private readonly fixtures = new Map<string, DemoKycFixtureV2>();
  private readonly provenance: KycProvenanceV2;
  private readonly validitySeconds: number;

  constructor(private readonly options: {fixtures: DemoKycFixtureV2[]; commitments: KycCommitmentsV2; provenance: KycProvenanceV2; now?: () => number; validitySeconds?: number}) {
    if (!options.commitments || typeof options.commitments.hash !== "function") throw new Error("KYC v2 commitments are required");
    this.provenance = {...options.provenance};
    this.validitySeconds = options.validitySeconds ?? 3600;
    if (!Number.isSafeInteger(this.validitySeconds) || this.validitySeconds <= 0) throw new Error("validitySeconds must be positive");
    for (const fixture of options.fixtures) {
      assertAddress(fixture.subject, "demo subject"); validateLei(fixture.lei);
      const key = fixture.subject.toLowerCase();
      if (this.fixtures.has(key)) throw new Error("duplicate demo subject");
      this.fixtures.set(key, {...fixture, facts: {...fixture.facts}});
    }
  }

  async assess(request: ProviderKycRequestV2, context?: ProviderKycAdapterContext): Promise<ProviderKycAssessmentV2> {
    if (context?.signal.aborted) throw new KycProviderError("UNAVAILABLE");
    const fixture = this.fixtures.get(request.subject.toLowerCase());
    const facts: ProviderNeutralKycFacts = fixture ? {...fixture.facts} : {kyc: "NOT_VERIFIED", sanctions: "CLEAR"};
    const status = fixture?.status ?? "ACTIVE";
    const observedAt = this.options.now?.() ?? Math.floor(Date.now() / 1000);
    const binding = {subject: request.subject.toLowerCase() as Address, identity: request.identity.toLowerCase() as typeof request.identity, asset: request.asset.toLowerCase() as Address};
    const sourceEvidenceHash = this.options.commitments.hash("source", {binding, facts, status, provenance: this.provenance, lei: fixture?.lei});
    return {...binding, providerId: this.metadata.providerId, providerSchemaVersion: this.metadata.providerSchemaVersions[0], sourceEvidenceHash, assessmentRefHash: this.options.commitments.hash("assessment", {binding, sourceEvidenceHash, observedAt}), facts, status, observedAt, validUntil: Math.min(observedAt + this.validitySeconds, this.provenance.expiresAt), provenance: {...this.provenance}, lei: fixture?.lei};
  }
}
