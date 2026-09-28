import {assertAddress, hash} from "./canonical";
import {
  KYC_PROVIDER_SPI_VERSION,
  KycProviderError,
  KycProviderMetadata,
  ProviderAssessmentStatus,
  ProviderKycAdapter,
  ProviderKycAdapterContext,
  ProviderKycAssessment,
  ProviderKycRequest,
  ProviderNeutralKycFacts
} from "./kyc-spi";
import {Address} from "./types";

export const DEMO_KYC_PROVIDER_ID = "corner-store-demo";
export const DEMO_KYC_PROVIDER_SCHEMA_VERSION = "corner-store-demo.v1";

export interface DemoKycFixture {
  subject: Address;
  facts: ProviderNeutralKycFacts;
  status?: ProviderAssessmentStatus;
}

export interface DemoKycProviderAdapterOptions {
  fixtures: DemoKycFixture[];
  now?: () => number;
  validitySeconds?: number;
}

const DEFAULT_DEMO_VALIDITY_SECONDS = 3_600;
const DEMO_METADATA: KycProviderMetadata = Object.freeze({
  spiVersion: KYC_PROVIDER_SPI_VERSION,
  providerId: DEMO_KYC_PROVIDER_ID,
  providerSchemaVersions: Object.freeze([DEMO_KYC_PROVIDER_SCHEMA_VERSION]),
  capabilities: Object.freeze(["kyc", "sanctions", "accreditedInvestor", "qualifiedPurchaser", "jurisdiction"] as const),
  environment: "demo"
});

/**
 * Deterministic fixture-backed adapter for local development, demos and tests only.
 * It declares the `demo` environment, so production-mode coordinators refuse it, and its
 * assessments are never production KYC evidence.
 */
export class DemoKycProviderAdapter implements ProviderKycAdapter {
  readonly metadata = DEMO_METADATA;
  private readonly fixtures = new Map<string, {facts: ProviderNeutralKycFacts; status: ProviderAssessmentStatus}>();
  private readonly now: () => number;
  private readonly validitySeconds: number;

  constructor(options: DemoKycProviderAdapterOptions) {
    this.now = options.now ?? (() => Math.floor(Date.now() / 1_000));
    this.validitySeconds = options.validitySeconds ?? DEFAULT_DEMO_VALIDITY_SECONDS;
    if (!Number.isSafeInteger(this.validitySeconds) || this.validitySeconds <= 0) throw new Error("validitySeconds must be a positive safe integer");
    for (const fixture of options.fixtures) {
      assertAddress(fixture.subject, "demo fixture subject");
      const key = fixture.subject.toLowerCase();
      if (this.fixtures.has(key)) throw new Error("duplicate demo KYC fixture subject");
      this.fixtures.set(key, {facts: {...fixture.facts}, status: fixture.status ?? "ACTIVE"});
    }
  }

  async assess(request: ProviderKycRequest, context?: ProviderKycAdapterContext): Promise<ProviderKycAssessment> {
    if (context?.signal?.aborted) throw new KycProviderError("UNAVAILABLE");
    const subject = request.subject.toLowerCase() as Address;
    const fixture = this.fixtures.get(subject);
    const facts: ProviderNeutralKycFacts = fixture ? {...fixture.facts} : {kyc: "NOT_VERIFIED", sanctions: "CLEAR"};
    const status = fixture?.status ?? "ACTIVE";
    const observedAt = this.now();
    const sourceEvidenceHash = hash({domain: "corner-store/demo-kyc-source/v1", subject, facts, status});
    const binding = {subject: request.subject, identity: request.identity, asset: request.asset, requestRefHash: request.requestRefHash};
    return {
      providerId: DEMO_KYC_PROVIDER_ID,
      providerSchemaVersion: DEMO_KYC_PROVIDER_SCHEMA_VERSION,
      assessmentRefHash: hash({domain: "corner-store/demo-kyc-assessment/v1", request: binding, sourceEvidenceHash, observedAt}),
      sourceEvidenceHash,
      subject: request.subject,
      identity: request.identity,
      asset: request.asset,
      facts,
      observedAt,
      validUntil: observedAt + this.validitySeconds,
      status
    };
  }
}
