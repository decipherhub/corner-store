import {setTimeout as sleep} from "timers/promises";
import {assertAddress, assertBytes32, assertTimestamp, canonicalJson, hash} from "./canonical";
import {Address, Hex} from "./types";

export type ProviderAssessmentStatus = "ACTIVE" | "REVOKED" | "INELIGIBLE";
export type PositiveFactStatus = "VERIFIED" | "NOT_VERIFIED";
export type SanctionsFactStatus = "CLEAR" | "HIT";

export interface ProviderNeutralKycFacts {
  kyc: PositiveFactStatus;
  sanctions: SanctionsFactStatus;
  accreditedInvestor?: PositiveFactStatus;
  qualifiedPurchaser?: PositiveFactStatus;
  jurisdiction?: string;
}

export interface ProviderKycRequest {
  subject: Address;
  identity?: Address;
  asset: Address;
  requestRefHash: Hex;
}

export interface ProviderKycAssessment {
  providerId: string;
  providerSchemaVersion: string;
  assessmentRefHash: Hex;
  sourceEvidenceHash: Hex;
  subject: Address;
  identity?: Address;
  asset: Address;
  facts: ProviderNeutralKycFacts;
  observedAt: number;
  validUntil: number;
  status: ProviderAssessmentStatus;
}

export interface ProviderNeutralKycEvidence extends ProviderKycAssessment {
  evidenceHash: Hex;
  materializedAt: number;
  eligible: boolean;
}

export interface ProviderKycAdapterContext {
  signal: AbortSignal;
}

export interface ProviderKycAdapter {
  assess(request: ProviderKycRequest, context?: ProviderKycAdapterContext): Promise<ProviderKycAssessment>;
}

export interface KycEvidenceStore {
  replaceCurrent(snapshot: ProviderNeutralKycEvidence): Promise<{stored: ProviderNeutralKycEvidence; applied: boolean}>;
  current(input: Pick<ProviderNeutralKycEvidence, "providerId" | "subject" | "identity" | "asset">): Promise<ProviderNeutralKycEvidence | undefined>;
}

export type KycRefreshReason =
  | "OK"
  | "PROVIDER_UNAVAILABLE"
  | "MALFORMED_PROVIDER_RESULT"
  | "BINDING_MISMATCH"
  | "STALE_OR_FUTURE_ASSESSMENT"
  | "REVOKED"
  | "INELIGIBLE"
  | "SANCTIONS_HIT"
  | "KYC_NOT_VERIFIED"
  | "STORE_CONFLICT"
  | "AUDIT_UNAVAILABLE";

export interface KycAuditRecord {
  kind: "KYC_REFRESH";
  timestamp: number;
  providerId?: string;
  providerSchemaVersion?: string;
  subject?: Address;
  identity?: Address;
  asset?: Address;
  requestRefHash?: Hex;
  assessmentRefHash?: Hex;
  sourceEvidenceHash?: Hex;
  evidenceHash?: Hex;
  status: "ELIGIBLE" | "FAIL_CLOSED";
  reason: KycRefreshReason;
}

export interface KycIncidentRecord extends Omit<KycAuditRecord, "kind" | "status"> {
  kind: "KYC_INCIDENT";
  status: "FAIL_CLOSED";
}

export interface KycRefreshSuccess {
  eligible: true;
  materialization: ProviderNeutralKycEvidence;
  audit: KycAuditRecord;
}

export interface KycRefreshFailure {
  eligible: false;
  reason: Exclude<KycRefreshReason, "OK">;
  audit: KycAuditRecord;
}

export type KycRefreshResult = KycRefreshSuccess | KycRefreshFailure;

export interface KycEvidenceCoordinatorOptions {
  now?: () => number;
  maxFutureSkewSeconds?: number;
  freshnessSeconds?: number;
  providerTimeoutMs?: number;
  strictAudit?: boolean;
  audit?: (record: KycAuditRecord) => void | Promise<void>;
  incident?: (record: KycIncidentRecord) => void | Promise<void>;
}

const DEFAULT_MAX_FUTURE_SKEW_SECONDS = 60;
const DEFAULT_FRESHNESS_SECONDS = 86_400;
const DEFAULT_PROVIDER_TIMEOUT_MS = 2_000;
const SLUG_RE = /^[a-z0-9][a-z0-9._-]{0,63}$/;
const SCHEMA_RE = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,63}$/;
const JURISDICTION_RE = /^[A-Z]{2}(-[A-Z0-9]{1,3})?$/;
const FORBIDDEN_PII_KEYS = new Set([
  "name",
  "email",
  "document",
  "documentId",
  "ssn",
  "providerSubjectId",
  "bearerToken",
  "webhookPayload",
  "rawPayload"
]);
const REQUEST_KEYS = new Set(["subject", "identity", "asset", "requestRefHash"]);
const ASSESSMENT_KEYS = new Set([
  "providerId",
  "providerSchemaVersion",
  "assessmentRefHash",
  "sourceEvidenceHash",
  "subject",
  "identity",
  "asset",
  "facts",
  "observedAt",
  "validUntil",
  "status"
]);
const FACT_KEYS = new Set(["kyc", "sanctions", "accreditedInvestor", "qualifiedPurchaser", "jurisdiction"]);
const EVIDENCE_KEYS = new Set([...ASSESSMENT_KEYS, "evidenceHash", "materializedAt", "eligible"]);

export class KycEvidenceCoordinator {
  private readonly now: () => number;
  private readonly maxFutureSkewSeconds: number;
  private readonly freshnessSeconds: number;
  private readonly providerTimeoutMs: number;
  private readonly strictAudit: boolean;
  private readonly audit?: (record: KycAuditRecord) => void | Promise<void>;
  private readonly incident?: (record: KycIncidentRecord) => void | Promise<void>;

  constructor(
    private readonly provider: ProviderKycAdapter,
    private readonly store: KycEvidenceStore,
    options: KycEvidenceCoordinatorOptions = {}
  ) {
    this.now = options.now ?? (() => Math.floor(Date.now() / 1_000));
    this.maxFutureSkewSeconds = options.maxFutureSkewSeconds ?? DEFAULT_MAX_FUTURE_SKEW_SECONDS;
    this.freshnessSeconds = options.freshnessSeconds ?? DEFAULT_FRESHNESS_SECONDS;
    this.providerTimeoutMs = options.providerTimeoutMs ?? DEFAULT_PROVIDER_TIMEOUT_MS;
    this.strictAudit = options.strictAudit ?? true;
    this.audit = options.audit;
    this.incident = options.incident;
    if (!Number.isSafeInteger(this.maxFutureSkewSeconds) || this.maxFutureSkewSeconds < 0) {
      throw new Error("maxFutureSkewSeconds must be a non-negative safe integer");
    }
    if (!Number.isSafeInteger(this.freshnessSeconds) || this.freshnessSeconds <= 0) {
      throw new Error("freshnessSeconds must be a positive safe integer");
    }
    if (!Number.isSafeInteger(this.providerTimeoutMs) || this.providerTimeoutMs <= 0 || this.providerTimeoutMs > 60_000) {
      throw new Error("providerTimeoutMs must be a positive safe integer no greater than 60000");
    }
  }

  async refresh(request: ProviderKycRequest): Promise<KycRefreshResult> {
    const timestamp = this.now();
    let normalizedRequest: ProviderKycRequest;
    try {
      validateRequest(request);
      normalizedRequest = normalizeRequest(request);
    } catch {
      return this.fail(request, timestamp, "MALFORMED_PROVIDER_RESULT");
    }

    let providerResult: ProviderKycAssessment;
    const abort = new AbortController();
    try {
      providerResult = await Promise.race([
        this.provider.assess(normalizedRequest, {signal: abort.signal}),
        sleep(this.providerTimeoutMs, undefined, {signal: abort.signal}).then(() => {
          throw new Error("provider timeout");
        })
      ]);
    } catch {
      return this.fail(normalizedRequest, timestamp, "PROVIDER_UNAVAILABLE");
    } finally {
      abort.abort();
    }

    let assessment: ProviderKycAssessment;
    try {
      assessment = sanitizeAssessment(providerResult);
      validateAssessment(assessment);
    } catch {
      return this.fail(normalizedRequest, timestamp, "MALFORMED_PROVIDER_RESULT");
    }

    if (!matchesRequest(assessment, normalizedRequest)) return this.fail(normalizedRequest, timestamp, "BINDING_MISMATCH", assessment);
    if (!isFresh(assessment, timestamp, this.maxFutureSkewSeconds, this.freshnessSeconds)) {
      return this.fail(normalizedRequest, timestamp, "STALE_OR_FUTURE_ASSESSMENT", assessment);
    }

    const snapshot = makeEvidence(assessment, timestamp);
    const eligibilityReason = failClosedEligibilityReason(snapshot);
    if (eligibilityReason) {
      try {
        const stored = (await this.store.replaceCurrent(snapshot)).stored;
        validateStoredSnapshot(stored, snapshot, normalizedRequest, timestamp, this.maxFutureSkewSeconds, this.freshnessSeconds);
      } catch {
        return this.fail(normalizedRequest, timestamp, "STORE_CONFLICT", assessment, snapshot.evidenceHash);
      }
      return this.fail(normalizedRequest, timestamp, eligibilityReason, assessment, snapshot.evidenceHash);
    }

    const audit = makeAudit(normalizedRequest, timestamp, "ELIGIBLE", "OK", snapshot);
    if (this.strictAudit) {
      if (!this.audit) return this.fail(normalizedRequest, timestamp, "AUDIT_UNAVAILABLE", assessment, snapshot.evidenceHash);
      try {
        await this.audit(audit);
      } catch {
        return this.fail(normalizedRequest, timestamp, "AUDIT_UNAVAILABLE", assessment, snapshot.evidenceHash);
      }
    } else {
      try {
        await this.audit?.(audit);
      } catch {
        // Non-strict success audit is best-effort and still happens before publish.
      }
    }

    let stored: ProviderNeutralKycEvidence;
    try {
      stored = (await this.store.replaceCurrent(snapshot)).stored;
      validateStoredSnapshot(stored, snapshot, normalizedRequest, timestamp, this.maxFutureSkewSeconds, this.freshnessSeconds);
    } catch {
      return this.fail(normalizedRequest, timestamp, "STORE_CONFLICT", assessment, snapshot.evidenceHash);
    }
    return {eligible: true, materialization: cloneEvidence(stored), audit};
  }

  private async fail(
    request: unknown,
    timestamp: number,
    reason: Exclude<KycRefreshReason, "OK">,
    assessment?: ProviderKycAssessment,
    evidenceHash?: Hex
  ): Promise<KycRefreshFailure> {
    const audit = makeAudit(request, timestamp, "FAIL_CLOSED", reason, assessment ? {...assessment, evidenceHash, materializedAt: timestamp, eligible: false} : undefined);
    try {
      await this.audit?.(audit);
    } catch {
      // Failure audit is best-effort. Do not recursively call incident hooks for audit failures.
    }
    try {
      await this.incident?.({...audit, kind: "KYC_INCIDENT", status: "FAIL_CLOSED"});
    } catch {
      // Incident hook failures are bounded and non-recursive.
    }
    return {eligible: false, reason, audit};
  }
}

export class InMemoryKycEvidenceStore implements KycEvidenceStore {
  private readonly currentByKey = new Map<string, ProviderNeutralKycEvidence>();
  private readonly evidenceByAssessment = new Map<string, Hex>();

  async replaceCurrent(snapshot: ProviderNeutralKycEvidence): Promise<{stored: ProviderNeutralKycEvidence; applied: boolean}> {
    validateEvidence(snapshot);
    const key = storeKey(snapshot);
    const assessmentKey = `${snapshot.providerId}:${snapshot.assessmentRefHash}`;
    const previousEvidence = this.evidenceByAssessment.get(assessmentKey);
    if (previousEvidence && previousEvidence !== snapshot.evidenceHash) throw new Error("conflicting assessment evidence");

    const existing = this.currentByKey.get(key);
    if (existing?.evidenceHash === snapshot.evidenceHash) return {stored: cloneEvidence(existing), applied: false};
    if (existing && !canReplace(existing, snapshot)) throw new Error("stale assessment cannot replace current evidence");

    const stored = cloneEvidence(snapshot);
    this.currentByKey.set(key, stored);
    this.evidenceByAssessment.set(assessmentKey, stored.evidenceHash);
    return {stored: cloneEvidence(stored), applied: true};
  }

  async current(input: Pick<ProviderNeutralKycEvidence, "providerId" | "subject" | "identity" | "asset">): Promise<ProviderNeutralKycEvidence | undefined> {
    const snapshot = this.currentByKey.get(storeKey(input));
    return snapshot ? cloneEvidence(snapshot) : undefined;
  }
}

export function kycEvidenceHash(assessment: ProviderKycAssessment): Hex {
  const normalized = sanitizeAssessment(assessment);
  validateAssessment(normalized);
  return hash({domain: "corner-store/provider-neutral-kyc-evidence/v1", assessment: normalized});
}

function makeEvidence(assessment: ProviderKycAssessment, materializedAt: number): ProviderNeutralKycEvidence {
  validateAssessment(assessment);
  assertTimestamp(materializedAt, "materializedAt");
  const normalized = sanitizeAssessment(assessment);
  const evidenceHash = kycEvidenceHash(normalized);
  const eligible = failClosedEligibilityReason(normalized) === undefined;
  return {...normalized, evidenceHash, materializedAt, eligible};
}

function validateRequest(request: ProviderKycRequest): void {
  assertPlainObjectWithExactKeys(request, REQUEST_KEYS, "request");
  rejectForbiddenKeysDeep(request);
  assertAddress(request.subject, "subject");
  if (request.identity !== undefined) assertAddress(request.identity, "identity");
  assertAddress(request.asset, "asset");
  assertBytes32(request.requestRefHash, "requestRefHash");
}

function validateAssessment(assessment: ProviderKycAssessment): void {
  assertPlainObjectWithExactKeys(assessment, ASSESSMENT_KEYS, "assessment");
  rejectForbiddenKeysDeep(assessment);
  if (!SLUG_RE.test(assessment.providerId)) throw new Error("providerId must be a bounded slug");
  if (!SCHEMA_RE.test(assessment.providerSchemaVersion)) throw new Error("providerSchemaVersion must be bounded");
  assertBytes32(assessment.assessmentRefHash, "assessmentRefHash");
  assertBytes32(assessment.sourceEvidenceHash, "sourceEvidenceHash");
  assertAddress(assessment.subject, "assessment subject");
  if (assessment.identity !== undefined) assertAddress(assessment.identity, "assessment identity");
  assertAddress(assessment.asset, "assessment asset");
  assertTimestamp(assessment.observedAt, "assessment observedAt");
  assertTimestamp(assessment.validUntil, "assessment validUntil");
  if (assessment.validUntil <= assessment.observedAt) throw new Error("assessment validity window is empty");
  if (!new Set<ProviderAssessmentStatus>(["ACTIVE", "REVOKED", "INELIGIBLE"]).has(assessment.status)) throw new Error("unsupported assessment status");
  validateFacts(assessment.facts);
}

function validateEvidence(snapshot: ProviderNeutralKycEvidence): void {
  assertPlainObjectWithExactKeys(snapshot, EVIDENCE_KEYS, "evidence");
  rejectForbiddenKeysDeep(snapshot);
  const assessment = assessmentSubset(snapshot);
  assertBytes32(snapshot.evidenceHash, "evidenceHash");
  assertTimestamp(snapshot.materializedAt, "materializedAt");
  if (snapshot.eligible !== (failClosedEligibilityReason(assessment) === undefined)) throw new Error("snapshot eligible flag mismatch");
  const expected = kycEvidenceHash(assessment);
  if (snapshot.evidenceHash !== expected) throw new Error("evidenceHash mismatch");
}

function validateStoredSnapshot(
  stored: ProviderNeutralKycEvidence,
  expected: ProviderNeutralKycEvidence,
  request: ProviderKycRequest,
  now: number,
  maxFutureSkew: number,
  freshness: number
): void {
  validateEvidence(stored);
  if (!matchesRequest(stored, request)) throw new Error("stored evidence binding mismatch");
  if (stored.providerId !== expected.providerId || stored.providerSchemaVersion !== expected.providerSchemaVersion) throw new Error("stored provider mismatch");
  if (stored.assessmentRefHash !== expected.assessmentRefHash || stored.sourceEvidenceHash !== expected.sourceEvidenceHash) throw new Error("stored lineage mismatch");
  if (stored.evidenceHash !== expected.evidenceHash) throw new Error("stored evidence hash mismatch");
  if (stored.eligible !== expected.eligible) throw new Error("stored eligibility mismatch");
  if (!isFresh(stored, now, maxFutureSkew, freshness)) throw new Error("stored evidence is stale");
}

function validateFacts(facts: ProviderNeutralKycFacts): void {
  assertPlainObjectWithExactKeys(facts, FACT_KEYS, "facts");
  rejectForbiddenKeysDeep(facts);
  if (!new Set<PositiveFactStatus>(["VERIFIED", "NOT_VERIFIED"]).has(facts.kyc)) throw new Error("unsupported kyc fact");
  if (!new Set<SanctionsFactStatus>(["CLEAR", "HIT"]).has(facts.sanctions)) throw new Error("unsupported sanctions fact");
  for (const field of ["accreditedInvestor", "qualifiedPurchaser"] as const) {
    const value = facts[field];
    if (value !== undefined && !new Set<PositiveFactStatus>(["VERIFIED", "NOT_VERIFIED"]).has(value)) throw new Error(`unsupported ${field} fact`);
  }
  if (facts.jurisdiction !== undefined && !JURISDICTION_RE.test(facts.jurisdiction)) throw new Error("unsupported jurisdiction code");
}

function normalizeRequest(request: ProviderKycRequest): ProviderKycRequest {
  return {
    subject: normalizeAddress(request.subject),
    identity: request.identity ? normalizeAddress(request.identity) : undefined,
    asset: normalizeAddress(request.asset),
    requestRefHash: normalizeHex(request.requestRefHash)
  };
}

function sanitizeAssessment(input: ProviderKycAssessment): ProviderKycAssessment {
  validateAssessment(input);
  return {
    providerId: input.providerId,
    providerSchemaVersion: input.providerSchemaVersion,
    assessmentRefHash: normalizeHex(input.assessmentRefHash),
    sourceEvidenceHash: normalizeHex(input.sourceEvidenceHash),
    subject: normalizeAddress(input.subject),
    identity: input.identity ? normalizeAddress(input.identity) : undefined,
    asset: normalizeAddress(input.asset),
    facts: {
      kyc: input.facts.kyc,
      sanctions: input.facts.sanctions,
      accreditedInvestor: input.facts.accreditedInvestor,
      qualifiedPurchaser: input.facts.qualifiedPurchaser,
      jurisdiction: input.facts.jurisdiction
    },
    observedAt: input.observedAt,
    validUntil: input.validUntil,
    status: input.status
  };
}

function matchesRequest(assessment: Pick<ProviderKycAssessment, "subject" | "identity" | "asset">, request: ProviderKycRequest): boolean {
  const normalized = normalizeRequest(request);
  return assessment.subject === normalized.subject &&
    (assessment.identity ?? "") === (normalized.identity ?? "") &&
    assessment.asset === normalized.asset;
}

function isFresh(assessment: Pick<ProviderKycAssessment, "observedAt" | "validUntil">, now: number, maxFutureSkew: number, freshness: number): boolean {
  return assessment.observedAt <= now + maxFutureSkew &&
    now - assessment.observedAt <= freshness &&
    assessment.validUntil > now;
}

function failClosedEligibilityReason(snapshot: Pick<ProviderNeutralKycEvidence, "status" | "facts">): Exclude<KycRefreshReason, "OK"> | undefined {
  if (snapshot.status === "REVOKED") return "REVOKED";
  if (snapshot.status === "INELIGIBLE") return "INELIGIBLE";
  if (snapshot.facts.sanctions !== "CLEAR") return "SANCTIONS_HIT";
  if (snapshot.facts.kyc !== "VERIFIED") return "KYC_NOT_VERIFIED";
  if (snapshot.facts.accreditedInvestor === "NOT_VERIFIED" || snapshot.facts.qualifiedPurchaser === "NOT_VERIFIED") return "INELIGIBLE";
  return undefined;
}

function canReplace(previous: ProviderNeutralKycEvidence, next: ProviderNeutralKycEvidence): boolean {
  if (next.observedAt > previous.observedAt) return true;
  if (next.observedAt < previous.observedAt) return false;
  return statusRank(next.status) > statusRank(previous.status);
}

function statusRank(status: ProviderAssessmentStatus): number {
  if (status === "ACTIVE") return 1;
  if (status === "INELIGIBLE") return 2;
  return 3;
}

function makeAudit(
  request: unknown,
  timestamp: number,
  status: KycAuditRecord["status"],
  reason: KycRefreshReason,
  snapshot?: Partial<ProviderNeutralKycEvidence>
): KycAuditRecord {
  const safe = safeRequestRefs(request);
  return {
    kind: "KYC_REFRESH",
    timestamp,
    providerId: snapshot?.providerId,
    providerSchemaVersion: snapshot?.providerSchemaVersion,
    subject: safe.subject,
    identity: safe.identity,
    asset: safe.asset,
    requestRefHash: safe.requestRefHash,
    assessmentRefHash: snapshot?.assessmentRefHash,
    sourceEvidenceHash: snapshot?.sourceEvidenceHash,
    evidenceHash: snapshot?.evidenceHash,
    status,
    reason
  };
}

function safeRequestRefs(request: unknown): Partial<Pick<KycAuditRecord, "subject" | "identity" | "asset" | "requestRefHash">> {
  if (!request || typeof request !== "object" || Array.isArray(request)) return {};
  const object = request as Record<string, unknown>;
  const safe: Partial<Pick<KycAuditRecord, "subject" | "identity" | "asset" | "requestRefHash">> = {};
  if (typeof object.subject === "string" && /^0x[0-9a-fA-F]{40}$/.test(object.subject)) safe.subject = object.subject.toLowerCase() as Address;
  if (typeof object.identity === "string" && /^0x[0-9a-fA-F]{40}$/.test(object.identity)) safe.identity = object.identity.toLowerCase() as Address;
  if (typeof object.asset === "string" && /^0x[0-9a-fA-F]{40}$/.test(object.asset)) safe.asset = object.asset.toLowerCase() as Address;
  if (typeof object.requestRefHash === "string" && /^0x[0-9a-fA-F]{64}$/.test(object.requestRefHash)) safe.requestRefHash = object.requestRefHash.toLowerCase() as Hex;
  return safe;
}

function assertPlainObjectWithExactKeys(value: unknown, allowed: Set<string>, name: string): void {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(`${name} must be an object`);
  for (const key of Object.keys(value as Record<string, unknown>)) {
    if (!allowed.has(key)) throw new Error(`${name} has unsupported field`);
  }
}

function rejectForbiddenKeysDeep(value: unknown): void {
  if (!value || typeof value !== "object") return;
  if (Array.isArray(value)) throw new Error("arrays are not accepted in KYC evidence payloads");
  for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
    if (FORBIDDEN_PII_KEYS.has(key)) throw new Error("PII-bearing field is not accepted");
    if (nested && typeof nested === "object") rejectForbiddenKeysDeep(nested);
  }
}

function assessmentSubset(input: ProviderKycAssessment): ProviderKycAssessment {
  return {
    providerId: input.providerId,
    providerSchemaVersion: input.providerSchemaVersion,
    assessmentRefHash: input.assessmentRefHash,
    sourceEvidenceHash: input.sourceEvidenceHash,
    subject: input.subject,
    identity: input.identity,
    asset: input.asset,
    facts: input.facts,
    observedAt: input.observedAt,
    validUntil: input.validUntil,
    status: input.status
  };
}

function storeKey(input: Pick<ProviderNeutralKycEvidence, "providerId" | "subject" | "identity" | "asset">): string {
  return canonicalJson({
    providerId: input.providerId,
    subject: normalizeAddress(input.subject),
    identity: input.identity ? normalizeAddress(input.identity) : undefined,
    asset: normalizeAddress(input.asset)
  });
}

function normalizeAddress(value: Address): Address {
  assertAddress(value, "address");
  return value.toLowerCase() as Address;
}

function normalizeHex(value: Hex): Hex {
  assertBytes32(value, "hex");
  return value.toLowerCase() as Hex;
}

function cloneEvidence(snapshot: ProviderNeutralKycEvidence): ProviderNeutralKycEvidence {
  return JSON.parse(JSON.stringify(snapshot)) as ProviderNeutralKycEvidence;
}
