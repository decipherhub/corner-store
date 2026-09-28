import {createHash} from "crypto";
// A real vendor adapter package imports these from "@corner-store/compliance-data/spi".
import {
  Address,
  Hex,
  KYC_PROVIDER_SPI_VERSION,
  KycProviderError,
  KycProviderMetadata,
  PositiveFactStatus,
  ProviderAssessmentStatus,
  ProviderKycAdapter,
  ProviderKycAdapterContext,
  ProviderKycAssessment,
  ProviderKycRequest,
  SanctionsFactStatus,
  validateKycProviderMetadata
} from "../src/kyc-spi";

export interface HttpKycProviderConfig {
  providerId: string;
  providerSchemaVersion: string;
  endpoint: string;
}

export type HttpKycTransport = (
  url: string,
  init: {method: "POST"; headers: Record<string, string>; body: string; signal?: AbortSignal}
) => Promise<{status: number; json(): Promise<unknown>}>;

export interface HttpKycProviderDeps {
  transport: HttpKycTransport;
  credential: () => Promise<string>;
}

export interface ExampleVendorKycResponse {
  caseId: string;
  reviewedAt: number;
  expiresAt: number;
  decision: "approved" | "rejected" | "revoked";
  checks: {identity: "pass" | "fail"; sanctions: "clear" | "match"; accredited?: "pass" | "fail"};
  wallet: string;
  onchainId?: string;
  asset: string;
  fullName?: string;
}

const STATUS = new Map<unknown, ProviderAssessmentStatus>([["approved", "ACTIVE"], ["rejected", "INELIGIBLE"], ["revoked", "REVOKED"]]);
const CHECK = new Map<unknown, PositiveFactStatus>([["pass", "VERIFIED"], ["fail", "NOT_VERIFIED"]]);
const SANCTIONS = new Map<unknown, SanctionsFactStatus>([["clear", "CLEAR"], ["match", "HIT"]]);
const ADDRESS_RE = /^0x[0-9a-fA-F]{40}$/;
const CASE_ID_RE = /^[\x21-\x7e]{1,128}$/;

export class HttpKycProviderAdapter implements ProviderKycAdapter {
  readonly metadata: KycProviderMetadata;
  private readonly endpoint: string;

  constructor(config: HttpKycProviderConfig, private readonly deps: HttpKycProviderDeps) {
    let url: URL | undefined;
    try {
      url = new URL(config.endpoint);
    } catch {
      url = undefined;
    }
    if (url?.protocol !== "https:") throw new Error("endpoint must be an https URL");
    this.endpoint = url.href;
    this.metadata = validateKycProviderMetadata({
      spiVersion: KYC_PROVIDER_SPI_VERSION,
      providerId: config.providerId,
      providerSchemaVersions: [config.providerSchemaVersion],
      capabilities: ["kyc", "sanctions", "accreditedInvestor"],
      environment: "production"
    });
  }

  async assess(request: ProviderKycRequest, context?: ProviderKycAdapterContext): Promise<ProviderKycAssessment> {
    if (context?.signal?.aborted) throw new KycProviderError("UNAVAILABLE");
    let response: Awaited<ReturnType<HttpKycTransport>>;
    try {
      response = await this.deps.transport(this.endpoint, {
        method: "POST",
        headers: {"content-type": "application/json", authorization: `Bearer ${await this.deps.credential()}`},
        body: JSON.stringify({wallet: request.subject, onchainId: request.identity, asset: request.asset, reference: request.requestRefHash}),
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

  private toAssessment(vendor: ExampleVendorKycResponse): ProviderKycAssessment {
    const {providerId, providerSchemaVersions: [providerSchemaVersion]} = this.metadata;
    const subject = vendor.wallet.toLowerCase() as Address;
    const identity = vendor.onchainId?.toLowerCase() as Address | undefined;
    const asset = vendor.asset.toLowerCase() as Address;
    const facts = {
      kyc: CHECK.get(vendor.checks.identity)!,
      sanctions: SANCTIONS.get(vendor.checks.sanctions)!,
      accreditedInvestor: vendor.checks.accredited === undefined ? undefined : CHECK.get(vendor.checks.accredited)
    };
    const status = STATUS.get(vendor.decision)!;
    return {
      providerId,
      providerSchemaVersion,
      assessmentRefHash: sha256(["corner-store/example-http-kyc-assessment/v1", providerId, vendor.caseId, vendor.reviewedAt]),
      sourceEvidenceHash: sha256(["corner-store/example-http-kyc-source/v1", providerId, vendor.caseId, vendor.reviewedAt, vendor.expiresAt, status, facts.kyc, facts.sanctions, facts.accreditedInvestor ?? null, subject, identity ?? null, asset]),
      subject,
      identity,
      asset,
      facts,
      observedAt: vendor.reviewedAt,
      validUntil: vendor.expiresAt,
      status
    };
  }
}

function parseVendorResponse(body: unknown): ExampleVendorKycResponse | undefined {
  if (!body || typeof body !== "object" || Array.isArray(body)) return undefined;
  const value = body as Record<string, unknown>;
  const checks = value.checks;
  if (!checks || typeof checks !== "object" || Array.isArray(checks)) return undefined;
  const {identity, sanctions, accredited} = checks as Record<string, unknown>;
  if (typeof value.caseId !== "string" || !CASE_ID_RE.test(value.caseId)) return undefined;
  if (!Number.isSafeInteger(value.reviewedAt) || !Number.isSafeInteger(value.expiresAt)) return undefined;
  if (!STATUS.has(value.decision) || !CHECK.has(identity) || !SANCTIONS.has(sanctions) || (accredited !== undefined && !CHECK.has(accredited))) return undefined;
  if (!isAddress(value.wallet) || !isAddress(value.asset) || (value.onchainId !== undefined && !isAddress(value.onchainId))) return undefined;
  return {
    caseId: value.caseId,
    reviewedAt: value.reviewedAt as number,
    expiresAt: value.expiresAt as number,
    decision: value.decision as ExampleVendorKycResponse["decision"],
    checks: {identity, sanctions, accredited} as ExampleVendorKycResponse["checks"],
    wallet: value.wallet,
    onchainId: value.onchainId as string | undefined,
    asset: value.asset
  };
}

function isAddress(value: unknown): value is string {
  return typeof value === "string" && ADDRESS_RE.test(value);
}

function sha256(parts: unknown[]): Hex {
  return `0x${createHash("sha256").update(JSON.stringify(parts)).digest("hex")}`;
}
