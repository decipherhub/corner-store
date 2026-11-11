import {setTimeout as sleep} from "timers/promises";
import {assertAddress, assertBytes32, assertTimestamp, canonicalJson} from "./canonical";
import {
  isKycProviderError,
  KYC_PROVIDER_ID_RE,
  KYC_PROVIDER_SCHEMA_VERSION_RE,
  KycProviderEnvironment,
  KycProviderMetadata,
  PositiveFactStatus,
  ProviderAssessmentStatus,
  ProviderNeutralKycFacts,
  SanctionsFactStatus,
} from "./kyc-spi";
import {ProviderKycAdapterV2, ProviderKycAssessmentV2, ProviderKycRequestV2, validateKycProviderMetadataV2} from "./kyc-spi-v2";
import {KycCommitmentsV2, validateLei} from "./kyc-hmac-v2";
import {Address, Hex} from "./types";

export interface ProviderNeutralKycEvidenceV2 extends ProviderKycAssessmentV2 {
  schemaVersion: 2;
  operatorAccepted: boolean;
  evidenceHash: Hex;
  materializedAt: number;
  eligible: boolean;
}

export interface KycEvidenceStoreV2 {
  replaceCurrent(snapshot: ProviderNeutralKycEvidenceV2): Promise<{stored: ProviderNeutralKycEvidenceV2; applied: boolean}>;
  current(input: Pick<ProviderNeutralKycEvidenceV2, "providerId" | "subject" | "identity" | "asset">): Promise<ProviderNeutralKycEvidenceV2 | undefined>;
}

export type KycRefreshReasonV2 =
  | "OK"
  | "PROVIDER_UNAVAILABLE"
  | "PROVIDER_TIMEOUT"
  | "PROVIDER_INCOMPATIBLE"
  | "MALFORMED_PROVIDER_RESULT"
  | "BINDING_MISMATCH"
  | "STALE_OR_FUTURE_ASSESSMENT"
  | "REVOKED"
  | "INELIGIBLE"
  | "SANCTIONS_HIT"
  | "KYC_NOT_VERIFIED"
  | "STORE_CONFLICT"
  | "AUDIT_UNAVAILABLE"
  | "OPERATOR_NOT_ACCEPTED";

export interface KycAuditRecordV2 {
  kind: "KYC_REFRESH";
  timestamp: number;
  providerId?: string;
  providerSchemaVersion?: string;
  subject?: Address;
  identity?: Hex;
  asset?: Address;
  requestRefHash?: Hex;
  assessmentRefHash?: Hex;
  sourceEvidenceHash?: Hex;
  evidenceHash?: Hex;
  status: "ELIGIBLE" | "FAIL_CLOSED";
  reason: KycRefreshReasonV2;
}

export interface KycIncidentRecordV2 extends Omit<KycAuditRecordV2, "kind" | "status"> {
  kind: "KYC_INCIDENT";
  status: "FAIL_CLOSED";
}

export interface KycRefreshSuccessV2 {
  eligible: true;
  materialization: ProviderNeutralKycEvidenceV2;
  audit: KycAuditRecordV2;
}

export interface KycRefreshFailureV2 {
  eligible: false;
  reason: Exclude<KycRefreshReasonV2, "OK">;
  audit: KycAuditRecordV2;
}

export type KycRefreshResultV2 = KycRefreshSuccessV2 | KycRefreshFailureV2;

export interface KycEvidenceCoordinatorOptionsV2 {
  mode: KycProviderEnvironment;
  commitments: KycCommitmentsV2;
  accept?: (assessment: ProviderKycAssessmentV2) => boolean | Promise<boolean>;
  now?: () => number;
  maxFutureSkewSeconds?: number;
  freshnessSeconds?: number;
  providerTimeoutMs?: number;
  strictAudit?: boolean;
  audit?: (record: KycAuditRecordV2) => void | Promise<void>;
  incident?: (record: KycIncidentRecordV2) => void | Promise<void>;
}

const DEFAULT_MAX_FUTURE_SKEW_SECONDS = 60;
const DEFAULT_FRESHNESS_SECONDS = 86_400;
const DEFAULT_PROVIDER_TIMEOUT_MS = 2_000;
const PROVIDER_TIMEOUT = Symbol("kyc provider timeout");
const PROVIDER_FAILURE_REASONS = new Map<unknown, Exclude<KycRefreshReasonV2, "OK">>([
  ["UNAVAILABLE", "PROVIDER_UNAVAILABLE"],
  ["TIMEOUT", "PROVIDER_TIMEOUT"],
  ["STALE", "STALE_OR_FUTURE_ASSESSMENT"],
  ["INCOMPATIBLE", "PROVIDER_INCOMPATIBLE"]
]);
const OPTIONAL_FACT_CAPABILITIES = ["accreditedInvestor", "qualifiedPurchaser", "jurisdiction"] as const;
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
  "status",
  "provenance",
  "lei"
]);
const FACT_KEYS = new Set(["kyc", "sanctions", "accreditedInvestor", "qualifiedPurchaser", "jurisdiction"]);
const EVIDENCE_KEYS = new Set([...ASSESSMENT_KEYS, "evidenceHash", "materializedAt", "eligible", "schemaVersion", "operatorAccepted"]);

export class KycEvidenceCoordinatorV2 {
  private readonly now: () => number;
  private readonly maxFutureSkewSeconds: number;
  private readonly freshnessSeconds: number;
  private readonly providerTimeoutMs: number;
  private readonly audit?: (record: KycAuditRecordV2) => void | Promise<void>;
  private readonly incident?: (record: KycIncidentRecordV2) => void | Promise<void>;
  private readonly metadata: KycProviderMetadata;
  private readonly commitments: KycCommitmentsV2;
  private readonly accept?: KycEvidenceCoordinatorOptionsV2["accept"];

  constructor(
    private readonly provider: ProviderKycAdapterV2,
    private readonly store: KycEvidenceStoreV2,
    options: KycEvidenceCoordinatorOptionsV2
  ) {
    if (!options?.commitments || typeof options.commitments.hash !== "function") throw new Error("KYC v2 commitments are required");
    this.commitments = options.commitments;
    this.accept = options.accept;
    const mode = options?.mode;
    if (mode !== "demo" && mode !== "production") throw new Error("mode must be demo or production");
    this.now = options.now ?? (() => Math.floor(Date.now() / 1_000));
    this.maxFutureSkewSeconds = options.maxFutureSkewSeconds ?? DEFAULT_MAX_FUTURE_SKEW_SECONDS;
    this.freshnessSeconds = options.freshnessSeconds ?? DEFAULT_FRESHNESS_SECONDS;
    this.providerTimeoutMs = options.providerTimeoutMs ?? DEFAULT_PROVIDER_TIMEOUT_MS;
    if (options.strictAudit === false) throw new Error("KYC v2 requires strict audit");
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
    let declared: unknown;
    try {
      declared = provider.metadata;
    } catch {
      throw new Error("KYC provider metadata is unreadable");
    }
    this.metadata = validateKycProviderMetadataV2(declared);
    if (mode === "production" && this.metadata.environment !== "production") throw new Error("production mode refuses a non-production KYC provider adapter");
  }

  async refresh(request: ProviderKycRequestV2): Promise<KycRefreshResultV2> {
    const timestamp = this.now();
    let normalizedRequest: ProviderKycRequestV2;
    try {
      validateRequest(request);
      normalizedRequest = normalizeRequest(request);
    } catch {
      return this.fail(request, timestamp, "MALFORMED_PROVIDER_RESULT");
    }

    let providerResult: ProviderKycAssessmentV2;
    const abort = new AbortController();
    try {
      providerResult = await Promise.race([
        this.provider.assess({...normalizedRequest}, {signal: abort.signal}),
        sleep(this.providerTimeoutMs, undefined, {signal: abort.signal}).then(() => {
          throw PROVIDER_TIMEOUT;
        })
      ]);
    } catch (error) {
      return this.fail(normalizedRequest, timestamp, providerFailureReason(error));
    } finally {
      abort.abort();
    }

    let assessment: ProviderKycAssessmentV2;
    try {
      assessment = sanitizeAssessment(providerResult);
      validateAssessment(assessment);
    } catch {
      return this.fail(normalizedRequest, timestamp, "MALFORMED_PROVIDER_RESULT");
    }

    if (!matchesMetadata(assessment, this.metadata)) return this.fail(normalizedRequest, timestamp, "PROVIDER_INCOMPATIBLE", assessment);
    if (!matchesRequest(assessment, normalizedRequest)) return this.fail(normalizedRequest, timestamp, "BINDING_MISMATCH", assessment);
    if (!isFresh(assessment, timestamp, this.maxFutureSkewSeconds, this.freshnessSeconds)) {
      return this.fail(normalizedRequest, timestamp, "STALE_OR_FUTURE_ASSESSMENT", assessment);
    }

    let operatorAccepted = false;
    const negative = failClosedEligibilityReason(assessment);
    if (!negative) {
      try { operatorAccepted = await this.accept?.(JSON.parse(JSON.stringify(assessment))) === true; } catch { /* Fail closed. */ }
      if (!operatorAccepted) return this.fail(normalizedRequest, timestamp, "OPERATOR_NOT_ACCEPTED");
    }
    if (!isFresh(assessment, this.now(), this.maxFutureSkewSeconds, this.freshnessSeconds)) return this.fail(normalizedRequest, this.now(), "STALE_OR_FUTURE_ASSESSMENT");
    const snapshot = makeEvidence(assessment, this.now(), operatorAccepted, this.commitments);
    const eligibilityReason = failClosedEligibilityReason(snapshot);
    if (eligibilityReason) {
      try {
        const storedRaw = (await this.store.replaceCurrent(cloneEvidence(snapshot))).stored;
        const stored = cloneEvidence(storedRaw);
        validateStoredSnapshot(stored, snapshot, normalizedRequest, this.now(), this.maxFutureSkewSeconds, this.freshnessSeconds, this.commitments);
      } catch {
        return this.fail(normalizedRequest, timestamp, "STORE_CONFLICT", assessment, snapshot.evidenceHash);
      }
      return this.fail(normalizedRequest, timestamp, eligibilityReason, assessment, snapshot.evidenceHash);
    }

    const audit = makeAudit(normalizedRequest, timestamp, "ELIGIBLE", "OK", snapshot);
    if (!this.audit) return this.fail(normalizedRequest, timestamp, "AUDIT_UNAVAILABLE", assessment, snapshot.evidenceHash);
    try {
      await this.audit(audit);
    } catch {
      return this.fail(normalizedRequest, timestamp, "AUDIT_UNAVAILABLE", assessment, snapshot.evidenceHash);
    }

    if (!isFresh(assessment, this.now(), this.maxFutureSkewSeconds, this.freshnessSeconds)) return this.fail(normalizedRequest, this.now(), "STALE_OR_FUTURE_ASSESSMENT");
    let stored: ProviderNeutralKycEvidenceV2;
    try {
      const storedRaw = (await this.store.replaceCurrent(cloneEvidence(snapshot))).stored;
      stored = cloneEvidence(storedRaw);
      validateStoredSnapshot(stored, snapshot, normalizedRequest, this.now(), this.maxFutureSkewSeconds, this.freshnessSeconds, this.commitments);
    } catch {
      return this.fail(normalizedRequest, timestamp, "STORE_CONFLICT", assessment, snapshot.evidenceHash);
    }
    return {eligible: true, materialization: stored, audit};
  }

  private async fail(
    request: unknown,
    timestamp: number,
    reason: Exclude<KycRefreshReasonV2, "OK">,
    assessment?: ProviderKycAssessmentV2,
    evidenceHash?: Hex
  ): Promise<KycRefreshFailureV2> {
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

export class InMemoryKycEvidenceStoreV2 implements KycEvidenceStoreV2 {
  private readonly currentByKey = new Map<string, ProviderNeutralKycEvidenceV2>();
  private readonly evidenceByAssessment = new Map<string, Hex>();

  constructor(private readonly commitments: KycCommitmentsV2) {
    if (!commitments || typeof commitments.hash !== "function") throw new Error("KYC v2 commitments are required");
  }

  async replaceCurrent(snapshot: ProviderNeutralKycEvidenceV2): Promise<{stored: ProviderNeutralKycEvidenceV2; applied: boolean}> {
    validateKycEvidenceV2(snapshot, this.commitments);
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

  async current(input: Pick<ProviderNeutralKycEvidenceV2, "providerId" | "subject" | "identity" | "asset">): Promise<ProviderNeutralKycEvidenceV2 | undefined> {
    const snapshot = this.currentByKey.get(storeKey(input));
    return snapshot ? cloneEvidence(snapshot) : undefined;
  }
}

export function kycEvidenceHashV2(assessment: ProviderKycAssessmentV2 & {operatorAccepted?: boolean}, commitments: KycCommitmentsV2): Hex {
  const normalized = sanitizeAssessment(assessmentSubset(assessment));
  validateAssessment(normalized);
  return commitments.hash("evidence", {schemaVersion: 2, assessment: normalized, operatorAccepted: assessment.operatorAccepted === true});
}

function makeEvidence(assessment: ProviderKycAssessmentV2, materializedAt: number, operatorAccepted: boolean, commitments: KycCommitmentsV2): ProviderNeutralKycEvidenceV2 {
  validateAssessment(assessment);
  assertTimestamp(materializedAt, "materializedAt");
  const normalized = sanitizeAssessment(assessment);
  const evidenceHash = kycEvidenceHashV2({...normalized, operatorAccepted}, commitments);
  const eligible = operatorAccepted && failClosedEligibilityReason(normalized) === undefined;
  return {...normalized, schemaVersion: 2, operatorAccepted, evidenceHash, materializedAt, eligible};
}

function validateRequest(request: ProviderKycRequestV2): void {
  assertPlainObjectWithExactKeys(request, REQUEST_KEYS, "request");
  rejectForbiddenKeysDeep(request);
  assertAddress(request.subject, "subject");
  assertNonzeroBytes32(request.identity, "identity");
  assertAddress(request.asset, "asset");
  assertBytes32(request.requestRefHash, "requestRefHash");
}

function validateAssessment(assessment: ProviderKycAssessmentV2): void {
  assertPlainObjectWithExactKeys(assessment, ASSESSMENT_KEYS, "assessment");
  rejectForbiddenKeysDeep(assessment);
  if (!KYC_PROVIDER_ID_RE.test(assessment.providerId)) throw new Error("providerId must be a bounded slug");
  if (!KYC_PROVIDER_SCHEMA_VERSION_RE.test(assessment.providerSchemaVersion)) throw new Error("providerSchemaVersion must be bounded");
  assertBytes32(assessment.assessmentRefHash, "assessmentRefHash");
  assertBytes32(assessment.sourceEvidenceHash, "sourceEvidenceHash");
  assertAddress(assessment.subject, "assessment subject");
  assertNonzeroBytes32(assessment.identity, "assessment identity");
  validateProvenance(assessment);
  validateLei(assessment.lei);
  assertAddress(assessment.asset, "assessment asset");
  assertTimestamp(assessment.observedAt, "assessment observedAt");
  assertTimestamp(assessment.validUntil, "assessment validUntil");
  if (assessment.validUntil <= assessment.observedAt) throw new Error("assessment validity window is empty");
  if (!new Set<ProviderAssessmentStatus>(["ACTIVE", "REVOKED", "INELIGIBLE"]).has(assessment.status)) throw new Error("unsupported assessment status");
  validateFacts(assessment.facts);
}

export function validateKycEvidenceV2(snapshot: ProviderNeutralKycEvidenceV2, commitments: KycCommitmentsV2): void {
  assertPlainObjectWithExactKeys(snapshot, EVIDENCE_KEYS, "evidence");
  rejectForbiddenKeysDeep(snapshot);
  const assessment = assessmentSubset(snapshot);
  assertBytes32(snapshot.evidenceHash, "evidenceHash");
  assertTimestamp(snapshot.materializedAt, "materializedAt");
  if (snapshot.schemaVersion !== 2 || typeof snapshot.operatorAccepted !== "boolean") throw new Error("unsupported KYC v2 evidence");
  if (snapshot.eligible !== (snapshot.operatorAccepted && failClosedEligibilityReason(assessment) === undefined)) throw new Error("snapshot eligible flag mismatch");
  const expected = kycEvidenceHashV2({...assessment, operatorAccepted: snapshot.operatorAccepted}, commitments);
  if (snapshot.evidenceHash !== expected) throw new Error("evidenceHash mismatch");
}

function validateStoredSnapshot(
  stored: ProviderNeutralKycEvidenceV2,
  expected: ProviderNeutralKycEvidenceV2,
  request: ProviderKycRequestV2,
  now: number,
  maxFutureSkew: number,
  freshness: number,
  commitments: KycCommitmentsV2
): void {
  validateKycEvidenceV2(stored, commitments);
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

function normalizeRequest(request: ProviderKycRequestV2): ProviderKycRequestV2 {
  return {
    subject: normalizeAddress(request.subject),
    identity: normalizeHex(request.identity),
    asset: normalizeAddress(request.asset),
    requestRefHash: normalizeHex(request.requestRefHash)
  };
}

function sanitizeAssessment(input: ProviderKycAssessmentV2): ProviderKycAssessmentV2 {
  validateAssessment(input);
  return {
    providerId: input.providerId,
    providerSchemaVersion: input.providerSchemaVersion,
    assessmentRefHash: normalizeHex(input.assessmentRefHash),
    sourceEvidenceHash: normalizeHex(input.sourceEvidenceHash),
    subject: normalizeAddress(input.subject),
    identity: normalizeHex(input.identity),
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
    status: input.status,
    provenance: {...input.provenance, issuerId: normalizeHex(input.provenance.issuerId), trustBasisHash: normalizeHex(input.provenance.trustBasisHash)},
    lei: input.lei
  };
}

function providerFailureReason(error: unknown): Exclude<KycRefreshReasonV2, "OK"> {
  if (error === PROVIDER_TIMEOUT) return "PROVIDER_TIMEOUT";
  try {
    return isKycProviderError(error) ? PROVIDER_FAILURE_REASONS.get(error.code) ?? "PROVIDER_UNAVAILABLE" : "PROVIDER_UNAVAILABLE";
  } catch {
    return "PROVIDER_UNAVAILABLE";
  }
}

function matchesMetadata(assessment: ProviderKycAssessmentV2, metadata: KycProviderMetadata): boolean {
  return assessment.providerId === metadata.providerId &&
    metadata.providerSchemaVersions.includes(assessment.providerSchemaVersion) &&
    OPTIONAL_FACT_CAPABILITIES.every((capability) => assessment.facts[capability] === undefined || metadata.capabilities.includes(capability));
}

function matchesRequest(assessment: Pick<ProviderKycAssessmentV2, "subject" | "identity" | "asset">, request: ProviderKycRequestV2): boolean {
  const normalized = normalizeRequest(request);
  return assessment.subject === normalized.subject &&
    (assessment.identity ?? "") === (normalized.identity ?? "") &&
    assessment.asset === normalized.asset;
}

function isFresh(assessment: Pick<ProviderKycAssessmentV2, "observedAt" | "validUntil" | "provenance">, now: number, maxFutureSkew: number, freshness: number): boolean {
  return assessment.provenance.issuedAt <= now && assessment.observedAt <= now + maxFutureSkew &&
    now - assessment.observedAt <= freshness &&
    assessment.validUntil > now;
}

function failClosedEligibilityReason(snapshot: Pick<ProviderNeutralKycEvidenceV2, "status" | "facts">): Exclude<KycRefreshReasonV2, "OK"> | undefined {
  if (snapshot.status === "REVOKED") return "REVOKED";
  if (snapshot.status === "INELIGIBLE") return "INELIGIBLE";
  if (snapshot.facts.sanctions !== "CLEAR") return "SANCTIONS_HIT";
  if (snapshot.facts.kyc !== "VERIFIED") return "KYC_NOT_VERIFIED";
  if (snapshot.facts.accreditedInvestor === "NOT_VERIFIED" || snapshot.facts.qualifiedPurchaser === "NOT_VERIFIED") return "INELIGIBLE";
  return undefined;
}

function canReplace(previous: ProviderNeutralKycEvidenceV2, next: ProviderNeutralKycEvidenceV2): boolean {
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
  status: KycAuditRecordV2["status"],
  reason: KycRefreshReasonV2,
  snapshot?: Partial<ProviderNeutralKycEvidenceV2>
): KycAuditRecordV2 {
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

function safeRequestRefs(request: unknown): Partial<Pick<KycAuditRecordV2, "subject" | "identity" | "asset" | "requestRefHash">> {
  try {
    if (!request || typeof request !== "object" || Array.isArray(request)) return {};
    const object = request as Record<string, unknown>;
    const subject = object.subject;
    const identity = object.identity;
    const asset = object.asset;
    const requestRefHash = object.requestRefHash;
    const safe: Partial<Pick<KycAuditRecordV2, "subject" | "identity" | "asset" | "requestRefHash">> = {};
    if (typeof subject === "string" && /^0x[0-9a-fA-F]{40}$/.test(subject)) safe.subject = subject.toLowerCase() as Address;
    if (typeof identity === "string" && /^0x[0-9a-fA-F]{64}$/.test(identity)) safe.identity = identity.toLowerCase() as Hex;
    if (typeof asset === "string" && /^0x[0-9a-fA-F]{40}$/.test(asset)) safe.asset = asset.toLowerCase() as Address;
    if (typeof requestRefHash === "string" && /^0x[0-9a-fA-F]{64}$/.test(requestRefHash)) safe.requestRefHash = requestRefHash.toLowerCase() as Hex;
    return safe;
  } catch {
    return {};
  }
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

function assessmentSubset(input: ProviderKycAssessmentV2): ProviderKycAssessmentV2 {
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
    status: input.status,
    provenance: input.provenance,
    lei: input.lei
  };
}

function storeKey(input: Pick<ProviderNeutralKycEvidenceV2, "providerId" | "subject" | "identity" | "asset">): string {
  return canonicalJson({
    providerId: input.providerId,
    subject: normalizeAddress(input.subject),
    identity: normalizeHex(input.identity),
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

function cloneEvidence(snapshot: ProviderNeutralKycEvidenceV2): ProviderNeutralKycEvidenceV2 {
  return JSON.parse(JSON.stringify(snapshot)) as ProviderNeutralKycEvidenceV2;
}

function assertNonzeroBytes32(value: string, name: string): void {
  assertBytes32(value, name);
  if (/^0x0{64}$/i.test(value)) throw new Error(`${name} must not be zero`);
}

function validateProvenance(assessment: ProviderKycAssessmentV2): void {
  const provenance = assessment.provenance;
  assertPlainObjectWithExactKeys(provenance, new Set(["issuerId", "issuedAt", "expiresAt", "trustBasisHash", "attestationType"]), "provenance");
  assertNonzeroBytes32(provenance.issuerId, "issuerId");
  assertNonzeroBytes32(provenance.trustBasisHash, "trustBasisHash");
  assertTimestamp(provenance.issuedAt, "issuedAt");
  assertTimestamp(provenance.expiresAt, "expiresAt");
  if (provenance.issuedAt > assessment.observedAt || provenance.expiresAt < assessment.validUntil || provenance.expiresAt <= provenance.issuedAt) throw new Error("invalid provenance window");
  if (!["PUBLIC_LOOKUP", "SOURCE_REATTEST", "SELECTIVE_DISCLOSURE"].includes(provenance.attestationType)) throw new Error("unknown attestation type");
}
