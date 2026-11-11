import {KycCommitmentsV2, validateLei} from "../src/kyc-hmac-v2";
import {KYC_PROVIDER_SPI_VERSION_V2, KycProvenanceV2, ProviderKycAdapterV2, ProviderKycAssessmentV2, ProviderKycRequestV2, validateKycProviderMetadataV2} from "../src/kyc-spi-v2";
// A real vendor adapter package imports these from "@corner-store/compliance-data/spi".
import {
  Address,
  Hex,
  KycProviderError,
  KycProviderMetadata,
  PositiveFactStatus,
  ProviderAssessmentStatus,
  ProviderKycAdapterContext,
  SanctionsFactStatus,
} from "../src/kyc-spi";

export interface HttpKycProviderConfigV2 {
  providerId: string;
  providerSchemaVersion: string;
  endpoint: string;
  provenance: KycProvenanceV2;
}

export type HttpKycTransport = (
  url: string,
  init: {method: "POST"; headers: Record<string, string>; body: string; signal?: AbortSignal}
) => Promise<{status: number; json(): Promise<unknown>}>;

export interface HttpKycProviderDepsV2 {
  commitments: KycCommitmentsV2;
  transport: HttpKycTransport;
  credential: () => Promise<string>;
}

export interface ExampleVendorKycResponseV2 {
  caseId: string;
  reviewedAt: number;
  expiresAt: number;
  decision: "approved" | "rejected" | "revoked";
  checks: {identity: "pass" | "fail"; sanctions: "clear" | "match"; accredited?: "pass" | "fail"};
  wallet: string;
  identityId: Hex;
  lei?: string;
  asset: string;
  fullName?: string;
}

const STATUS = new Map<unknown, ProviderAssessmentStatus>([["approved", "ACTIVE"], ["rejected", "INELIGIBLE"], ["revoked", "REVOKED"]]);
const CHECK = new Map<unknown, PositiveFactStatus>([["pass", "VERIFIED"], ["fail", "NOT_VERIFIED"]]);
const SANCTIONS = new Map<unknown, SanctionsFactStatus>([["clear", "CLEAR"], ["match", "HIT"]]);
const ADDRESS_RE = /^0x[0-9a-fA-F]{40}$/;
const CASE_ID_RE = /^[\x21-\x7e]{1,128}$/;

export class HttpKycProviderAdapterV2 implements ProviderKycAdapterV2 {
  readonly metadata: KycProviderMetadata;
  private readonly endpoint: string;
  private readonly provenance: KycProvenanceV2;

  constructor(config: HttpKycProviderConfigV2, private readonly deps: HttpKycProviderDepsV2) {
    if (!deps.commitments || typeof deps.commitments.hash !== "function") throw new Error("KYC v2 commitments are required");
    this.provenance = {...config.provenance};
    let url: URL | undefined;
    try {
      url = new URL(config.endpoint);
    } catch {
      url = undefined;
    }
    if (url?.protocol !== "https:") throw new Error("endpoint must be an https URL");
    this.endpoint = url.href;
    this.metadata = validateKycProviderMetadataV2({
      spiVersion: KYC_PROVIDER_SPI_VERSION_V2,
      providerId: config.providerId,
      providerSchemaVersions: [config.providerSchemaVersion],
      capabilities: ["kyc", "sanctions", "accreditedInvestor"],
      environment: "production"
    });
  }

  async assess(request: ProviderKycRequestV2, context?: ProviderKycAdapterContext): Promise<ProviderKycAssessmentV2> {
    if (context?.signal?.aborted) throw new KycProviderError("UNAVAILABLE");
    let response: Awaited<ReturnType<HttpKycTransport>>;
    try {
      response = await this.deps.transport(this.endpoint, {
        method: "POST",
        headers: {"content-type": "application/json", authorization: `Bearer ${await this.deps.credential()}`},
        body: JSON.stringify({wallet: request.subject, identityId: request.identity, asset: request.asset, reference: request.requestRefHash}),
        signal: context?.signal
      });
    } catch {
      throw new KycProviderError("UNAVAILABLE");
    }
    if (response.status === 408 || response.status === 504) throw new KycProviderError("TIMEOUT");
    if (response.status === 409 || response.status === 422) throw new KycProviderError("INCOMPATIBLE");
    if (!Number.isInteger(response.status) || response.status < 200 || response.status > 299) throw new KycProviderError("UNAVAILABLE");
    let body: unknown;
    try {
      body = await response.json();
    } catch {
      throw new KycProviderError("INCOMPATIBLE");
    }
    const vendor = parseVendorResponse(body);
    if (!vendor) throw new KycProviderError("INCOMPATIBLE");
    return this.toAssessment(vendor);
  }

  private toAssessment(vendor: ExampleVendorKycResponseV2): ProviderKycAssessmentV2 {
    const {providerId, providerSchemaVersions: [providerSchemaVersion]} = this.metadata;
    const subject = vendor.wallet.toLowerCase() as Address;
    const identity = vendor.identityId.toLowerCase() as Hex;
    const asset = vendor.asset.toLowerCase() as Address;
    const facts = {
      kyc: CHECK.get(vendor.checks.identity)!,
      sanctions: SANCTIONS.get(vendor.checks.sanctions)!,
      accreditedInvestor: vendor.checks.accredited === undefined ? undefined : CHECK.get(vendor.checks.accredited)
    };
    const status = STATUS.get(vendor.decision)!;
    const sourceEvidenceHash = this.deps.commitments.hash("source", ["example-http.v2", providerId, vendor.caseId, vendor.reviewedAt, vendor.expiresAt, status, facts.kyc, facts.sanctions, facts.accreditedInvestor ?? null, subject, identity, asset, this.provenance, vendor.lei ?? null]);
    return {
      providerId,
      providerSchemaVersion,
      assessmentRefHash: this.deps.commitments.hash("assessment", ["example-http.v2", providerId, sourceEvidenceHash]),
      sourceEvidenceHash,
      subject,
      identity,
      asset,
      facts,
      observedAt: vendor.reviewedAt,
      validUntil: vendor.expiresAt,
      status,
      provenance: {...this.provenance},
      lei: vendor.lei
    };
  }
}

function parseVendorResponse(body: unknown): ExampleVendorKycResponseV2 | undefined {
  if (!body || typeof body !== "object" || Array.isArray(body)) return undefined;
  const value = body as Record<string, unknown>;
  const checks = value.checks;
  if (!checks || typeof checks !== "object" || Array.isArray(checks)) return undefined;
  const {identity, sanctions, accredited} = checks as Record<string, unknown>;
  if (typeof value.caseId !== "string" || !CASE_ID_RE.test(value.caseId)) return undefined;
  if (!Number.isSafeInteger(value.reviewedAt) || !Number.isSafeInteger(value.expiresAt)) return undefined;
  if (!STATUS.has(value.decision) || !CHECK.has(identity) || !SANCTIONS.has(sanctions) || (accredited !== undefined && !CHECK.has(accredited))) return undefined;
  if (!isAddress(value.wallet) || !isAddress(value.asset) || typeof value.identityId !== "string" || !/^0x[0-9a-fA-F]{64}$/.test(value.identityId)) return undefined;
  try { validateLei(value.lei); } catch { return undefined; }
  return {
    caseId: value.caseId,
    reviewedAt: value.reviewedAt as number,
    expiresAt: value.expiresAt as number,
    decision: value.decision as ExampleVendorKycResponseV2["decision"],
    checks: {identity, sanctions, accredited} as ExampleVendorKycResponseV2["checks"],
    wallet: value.wallet,
    identityId: value.identityId as Hex,
    lei: value.lei as string | undefined,
    asset: value.asset
  };
}

function isAddress(value: unknown): value is string {
  return typeof value === "string" && ADDRESS_RE.test(value);
}

