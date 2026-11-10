import {IncomingMessage, Server, ServerResponse, createServer} from "http";

import {
  Address,
  Hex,
  QuoteCoordinatorIntent,
  RFQCoordinatorError,
  RFQModuleFreshnessEvidence,
  RFQQuoteCoordinator, RFQQuoteCoordinatorV3, RFQQuoteIntentV3, SignedRFQQuoteV3, normalizeFlowType,
  SignedRFQQuote,
  hashCanonical,
  normalizeAddress,
  normalizeTtlSeconds,
  toPositiveUintString
} from "@corner-store/rfq-service";

const DEFAULT_MAX_BODY_BYTES = 16 * 1024;
const DEFAULT_FUTURE_SKEW_SECONDS = 5;
const DEFAULT_RATE_LIMIT_WINDOW_MS = 60_000;
const DEFAULT_RATE_LIMIT_MAX = 60;
const DEFAULT_RATE_LIMIT_MAX_BUCKETS = 10_000;
const DEFAULT_READINESS_TIMEOUT_MS = 3_000;
const LOOPBACK_HOSTS = new Set(["127.0.0.1", "::1", "localhost"]);
const READINESS_COMPONENTS = new Set([
  "context",
  "audit",
  "authentication",
  "coordinator",
  "policy",
  "pricing",
  "rate_limit",
  "risk",
  "signer"
]);

type JsonRecord = Record<string, unknown>;
type NormalizedHostQuoteIntent = QuoteCoordinatorIntent & Partial<RFQQuoteIntentV3> & {amountIn: string; ttlSeconds: number};
type NormalizedHostQuoteBody = Omit<NormalizedHostQuoteIntent, "policyId">;

export interface AuthPrincipal {
  principalId: string;
  taker: Address;
  authMethod?: string;
}

export interface RFQAuthenticator {
  authenticate(request: AuthRequest): Promise<AuthPrincipal> | AuthPrincipal;
}

export interface AuthRequest {
  headers: IncomingMessage["headers"];
  method: string;
  url: string;
}

export interface RateLimitRequest {
  principalHash: string;
  route: string;
  nowMs: number;
}

export interface RateLimitDecision {
  allowed: boolean;
  retryAfterSeconds?: number;
  reason?: string;
}

export interface RateLimiter {
  check(request: RateLimitRequest): Promise<RateLimitDecision> | RateLimitDecision;
}

export interface AuditSink {
  record(event: AuditEvent): Promise<void> | void;
}

export interface MetricsSink {
  increment(name: string, labels?: Record<string, string>): void;
  timing(name: string, ms: number, labels?: Record<string, string>): void;
}

export interface IncidentSink {
  notify(incident: IncidentEvent): Promise<void> | void;
}

export type RFQReadinessComponent =
  | "context"
  | "audit"
  | "authentication"
  | "coordinator"
  | "policy"
  | "pricing"
  | "rate_limit"
  | "risk"
  | "signer";

export interface RFQReadinessStatus {
  component: RFQReadinessComponent;
  ready: boolean;
}

export interface RFQReadinessReport {
  ready: boolean;
  components: RFQReadinessStatus[];
}

export interface RFQReadinessProbe {
  check(): Promise<RFQReadinessReport> | RFQReadinessReport;
}

export interface ProductionRFQHostConfig {
  host?: string;
  port?: number;
  coordinator: RFQQuoteCoordinator;
  v3?: {
    coordinator: RFQQuoteCoordinatorV3;
    resolvePolicyId(request: NormalizedHostQuoteBody & {flowType: 0 | 1}): Promise<Hex> | Hex;
  };
  authenticator: RFQAuthenticator;
  resolvePolicyId(request: NormalizedHostQuoteBody): Promise<Hex> | Hex;
  rateLimiter?: RateLimiter;
  audit: AuditSink;
  metrics?: MetricsSink;
  incident?: IncidentSink;
  maxBodyBytes?: number;
  strictAudit?: boolean;
  now?: () => number;
  futureSkewSeconds?: number;
  readiness?: RFQReadinessProbe;
  readinessTimeoutMs?: number;
  requestTimeoutMs?: number;
  headersTimeoutMs?: number;
  publicBindAcknowledged?: boolean;
}

export interface ProductionRFQHost {
  server: Server;
  baseUrl: string;
  close(): Promise<void>;
}

export interface AuditEvent {
  schemaVersion: 1;
  event: "quote.request";
  outcome: "success" | "reject" | "error";
  reason: string;
  module: string;
  principalHash?: string;
  requestHash?: string;
  idempotencyKeyHash?: string;
  taker?: Address;
  tokenIn?: Address;
  tokenOut?: Address;
  venue?: Address;
  amountIn?: string;
  quoteHash?: string;
  nonce?: string;
  pricingSnapshotId?: string;
  pricingVersion?: string;
  riskSnapshotId?: string;
  riskVersion?: string;
  replayed?: boolean;
  createdAt: number;
}

export interface IncidentEvent {
  type:
    | "auth_abuse"
    | "rate_limited"
    | "dependency_unavailable"
    | "dependency_stale"
    | "signer_failure"
    | "audit_failure";
  module: string;
  reason: string;
  principalHash?: string;
  requestHash?: string;
  at: number;
}

export class UnauthorizedError extends Error {
  constructor(message = "unauthorized") {
    super(message);
  }
}

export class ForbiddenError extends Error {
  constructor(message = "forbidden") {
    super(message);
  }
}

export class StaticBearerAuthenticator implements RFQAuthenticator {
  private readonly takerByToken = new Map<string, Address>();

  constructor(entries: Array<{token: string; taker: Address; principalId?: string}>) {
    for (const entry of entries) {
      if (!entry.token) throw new Error("auth token must not be empty");
      this.takerByToken.set(entry.token, normalizeAddress(entry.taker, "auth taker"));
    }
  }

  authenticate(request: AuthRequest): AuthPrincipal {
    const header = request.headers.authorization;
    if (typeof header !== "string" || !header.startsWith("Bearer ")) throw new UnauthorizedError("missing bearer token");
    const token = header.slice("Bearer ".length);
    const taker = this.takerByToken.get(token);
    if (!taker) throw new UnauthorizedError("invalid bearer token");
    return {principalId: `bearer:${hashCanonical({token})}`, taker, authMethod: "bearer"};
  }
}

export class InMemoryRateLimiter implements RateLimiter {
  private readonly buckets = new Map<string, {windowStartMs: number; count: number}>();
  private readonly windowMs: number;
  private readonly maxRequests: number;
  private readonly maxBuckets: number;

  constructor(config?: {windowMs?: number; maxRequests?: number; maxBuckets?: number}) {
    this.windowMs = normalizePositiveInteger(config?.windowMs ?? DEFAULT_RATE_LIMIT_WINDOW_MS, "windowMs");
    this.maxRequests = normalizePositiveInteger(config?.maxRequests ?? DEFAULT_RATE_LIMIT_MAX, "maxRequests");
    this.maxBuckets = normalizePositiveInteger(config?.maxBuckets ?? DEFAULT_RATE_LIMIT_MAX_BUCKETS, "maxBuckets");
  }

  check(request: RateLimitRequest): RateLimitDecision {
    this.sweep(request.nowMs);
    const key = `${request.route}:${request.principalHash}`;
    const current = this.buckets.get(key);
    if (!current) {
      if (this.buckets.size >= this.maxBuckets) {
        return {allowed: false, retryAfterSeconds: Math.max(1, Math.ceil(this.windowMs / 1000)), reason: "rate_limiter_capacity"};
      }
      this.buckets.set(key, {windowStartMs: request.nowMs, count: 1});
      return {allowed: true};
    }
    current.count += 1;
    if (current.count > this.maxRequests) {
      return {
        allowed: false,
        retryAfterSeconds: Math.max(1, Math.ceil((this.windowMs - (request.nowMs - current.windowStartMs)) / 1000)),
        reason: "rate_limit_exceeded"
      };
    }
    return {allowed: true};
  }

  size(): number {
    return this.buckets.size;
  }

  private sweep(nowMs: number): void {
    for (const [key, bucket] of this.buckets) {
      if (nowMs - bucket.windowStartMs >= this.windowMs) this.buckets.delete(key);
    }
  }
}

export class MemoryAuditSink implements AuditSink {
  readonly events: AuditEvent[] = [];
  record(event: AuditEvent): void {
    this.events.push(JSON.parse(JSON.stringify(event)) as AuditEvent);
  }
}

export class MemoryMetricsSink implements MetricsSink {
  readonly increments: Array<{name: string; labels: Record<string, string>}> = [];
  readonly timings: Array<{name: string; ms: number; labels: Record<string, string>}> = [];
  increment(name: string, labels?: Record<string, string>): void {
    this.increments.push({name, labels: sanitizeLabels(labels)});
  }
  timing(name: string, ms: number, labels?: Record<string, string>): void {
    this.timings.push({name, ms, labels: sanitizeLabels(labels)});
  }
}

export class MemoryIncidentSink implements IncidentSink {
  readonly incidents: IncidentEvent[] = [];
  notify(incident: IncidentEvent): void {
    this.incidents.push(JSON.parse(JSON.stringify(incident)) as IncidentEvent);
  }
}

export async function startProductionRFQHost(config: ProductionRFQHostConfig): Promise<ProductionRFQHost> {
  const host = config.host ?? "127.0.0.1";
  if (!LOOPBACK_HOSTS.has(host) && config.publicBindAcknowledged !== true) {
    throw new Error("production RFQ host refuses public bind without explicit TLS/trusted-proxy acknowledgement");
  }
  config.coordinator.assertProductionConfiguration();
  config.v3?.coordinator.assertProductionConfiguration();
  const maxBodyBytes = normalizePositiveInteger(config.maxBodyBytes ?? DEFAULT_MAX_BODY_BYTES, "maxBodyBytes");
  const strictAudit = config.strictAudit ?? true;
  const now = config.now ?? (() => Math.floor(Date.now() / 1000));
  const rateLimiter = config.rateLimiter ?? new InMemoryRateLimiter();
  const readinessTimeoutMs = normalizePositiveInteger(config.readinessTimeoutMs ?? DEFAULT_READINESS_TIMEOUT_MS, "readinessTimeoutMs");
  const server = createServer((req, res) => {
    void handleRequest(req, res, {...config, host, maxBodyBytes, strictAudit, now, rateLimiter, readinessTimeoutMs});
  });
  server.requestTimeout = normalizePositiveInteger(config.requestTimeoutMs ?? 30_000, "requestTimeoutMs");
  server.headersTimeout = normalizePositiveInteger(config.headersTimeoutMs ?? 15_000, "headersTimeoutMs");

  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(config.port ?? 0, host, () => {
      server.off("error", reject);
      resolve();
    });
  });
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("RFQ host did not bind a TCP address");
  return {
    server,
    baseUrl: `http://${host === "0.0.0.0" ? "127.0.0.1" : host}:${address.port}`,
    close: () => new Promise<void>((resolve, reject) => server.close((err) => err ? reject(err) : resolve()))
  };
}

async function handleRequest(
  req: IncomingMessage,
  res: ServerResponse,
  config: ProductionRFQHostConfig & {
    maxBodyBytes: number;
    strictAudit: boolean;
    now: () => number;
    rateLimiter: RateLimiter;
    readinessTimeoutMs: number;
  }
): Promise<void> {
  const started = Date.now();
  let principalHash: string | undefined;
  let requestHash: string | undefined;
  let idempotencyKeyHash: string | undefined;
  let normalized: NormalizedHostQuoteIntent | undefined;
  let pricing: RFQModuleFreshnessEvidence | undefined;
  let risk: RFQModuleFreshnessEvidence | undefined;
  let authIncidentSent = false;
  try {
    if (req.method === "GET" && req.url === "/health") {
      sendJson(res, 200, {status: "ok", service: "corner-store-rfq-host"});
      metric(config, "rfq_host_http_requests_total", {route: "health", outcome: "success"});
      return;
    }
    if (req.method === "GET" && req.url === "/ready") {
      const report = config.readiness
        ? await readReadiness(config.readiness, config.readinessTimeoutMs)
        : {ready: false, components: []};
      sendJson(res, report.ready ? 200 : 503, report);
      metric(config, "rfq_host_http_requests_total", {route: "ready", outcome: report.ready ? "success" : "unavailable"});
      return;
    }
    if (req.method !== "POST" || (req.url !== "/rfq/quote" && (req.url !== "/rfq/v3/quote" || !config.v3))) {
      sendJson(res, 404, {error: "not_found"});
      metric(config, "rfq_host_http_requests_total", {route: "unknown", outcome: "reject"});
      return;
    }

    const v3 = req.url === "/rfq/v3/quote";
    const coordinator = v3 ? config.v3!.coordinator : config.coordinator;
    let normalizedBody: NormalizedHostQuoteBody;
    try {
      const body = await readJsonBody(req, config.maxBodyBytes);
      normalizedBody = normalizeQuoteBody(body, v3, coordinator.getQuoteLifetimePolicy());
    } catch (error) {
      if ((error as {statusCode?: number})?.statusCode === 413) throw error;
      throw new RFQCoordinatorError("INVALID_REQUEST", "invalid RFQ request");
    }
    if (v3) config.v3!.coordinator.authorizeProduct(normalizedBody as NormalizedHostQuoteBody & {flowType: 0 | 1});
    else config.coordinator.authorizeProduct(normalizedBody);

    requestHash = hashCanonical({
      taker: normalizedBody.taker,
      tokenIn: normalizedBody.tokenIn,
      tokenOut: normalizedBody.tokenOut,
      amountIn: normalizedBody.amountIn,
      venue: normalizedBody.venue,
      ttlSeconds: normalizedBody.ttlSeconds
    });
    idempotencyKeyHash = hashCanonical({idempotencyKey: normalizedBody.idempotencyKey});

    const principal = await hostDependency("auth", () => config.authenticator.authenticate({headers: req.headers, method: req.method ?? "", url: req.url ?? ""}));
    const principalTaker = normalizeAddress(principal.taker, "authenticated taker");
    const authenticatedPrincipalHash = hashCanonical({principalId: principal.principalId});
    principalHash = authenticatedPrincipalHash;
    if (principalTaker !== normalizedBody.taker) throw new ForbiddenError("authenticated taker does not match request taker");

    const rate = await hostDependency("rate", () => config.rateLimiter.check({
      principalHash: authenticatedPrincipalHash,
      route: req.url!,
      nowMs: Date.now()
    }));
    if (!rate.allowed) {
      await notifyIncident(config, {type: "rate_limited", module: "rate", reason: "rate_limited", principalHash, requestHash, at: config.now()});
      res.setHeader("Retry-After", String(rate.retryAfterSeconds ?? 1));
      await bestEffortAudit(config, auditEvent("reject", "rate_limited", "rate", config.now(), {principalHash, requestHash, idempotencyKeyHash, normalized}));
      sendJson(res, 429, {error: "rate_limited"});
      metric(config, "rfq_host_http_requests_total", {route: "quote", outcome: "rate_limited"});
      return;
    }

    if (config.readiness) {
      const report = await readReadiness(config.readiness, config.readinessTimeoutMs);
      if (!report.ready) {
        throw Object.assign(new Error("required production dependency unavailable"), {
          dependencyModule: "readiness",
          dependencyReason: "unavailable"
        });
      }
    }

    const freshnessPolicy = {now: config.now(), futureSkewSeconds: config.futureSkewSeconds};
    const issued = v3
      ? await config.v3!.coordinator.quoteAuthorizedWithEvidence(normalizedBody as NormalizedHostQuoteBody & {flowType: 0 | 1}, () => config.v3!.resolvePolicyId(normalizedBody as NormalizedHostQuoteBody & {flowType: 0 | 1}), freshnessPolicy)
      : await config.coordinator.quoteAuthorizedWithEvidence(normalizedBody, () => config.resolvePolicyId(normalizedBody), freshnessPolicy);
    normalized = {...normalizedBody, policyId: issued.record.request.policyId};
    requestHash = hashCanonical(issued.record.request);
    const signed = issued.signedQuote;
    if (!issued.evidence) throw new RFQCoordinatorError("STRICT_EVIDENCE_REQUIRED", "strict coordinator did not return production evidence");
    pricing = issued.evidence.pricing;
    risk = issued.evidence.risk;
    const quoteHash = issued.record.quoteHash ?? hashCanonical({quote: signed.quote, domain: signed.typedData.domain});
    const successAudit = auditEvent("success", "quote_issued", "host", config.now(), {
      principalHash,
      requestHash,
      idempotencyKeyHash,
      normalized,
      signed,
      quoteHash,
      pricing,
      risk,
      replayed: issued.replayed
    });
    await strictRecordAudit(config, successAudit);
    sendJson(res, 200, signed);
    metric(config, "rfq_host_http_requests_total", {route: "quote", outcome: "success"});
  } catch (error) {
    const now = config.now();
    const classified = classifyError(error);
    if (classified.incident) {
      await notifyIncident(config, {type: classified.incident, module: classified.module, reason: classified.reason, principalHash, requestHash, at: now});
      authIncidentSent = classified.incident === "auth_abuse";
    }
    if (!authIncidentSent && classified.module === "auth" && (classified.status === 401 || classified.status === 403)) {
      await notifyIncident(config, {type: "auth_abuse", module: "auth", reason: classified.reason, principalHash, requestHash, at: now});
    }
    await bestEffortAudit(config, auditEvent(classified.status >= 500 ? "error" : "reject", classified.reason, classified.module, now, {
      principalHash,
      requestHash,
      idempotencyKeyHash,
      normalized,
      pricing,
      risk
    }));
    if (classified.retryAfterSeconds) res.setHeader("Retry-After", String(classified.retryAfterSeconds));
    sendJson(res, classified.status, {error: classified.publicError});
    metric(config, "rfq_host_http_requests_total", {route: "quote", outcome: classified.publicError});
  } finally {
    timing(config, "rfq_host_quote_duration_ms", Date.now() - started, {route: req.url === "/rfq/quote" ? "quote" : "other"});
  }
}

function normalizeQuoteBody(body: unknown, v3: boolean, lifetime: {defaultTtlSeconds: number; maxTtlSeconds: number}): NormalizedHostQuoteBody {
  if (!isRecord(body)) throw new Error("request body must be a JSON object");
  if (typeof body.idempotencyKey !== "string" || !body.idempotencyKey || body.idempotencyKey.length > 256) {
    throw new Error("idempotencyKey must be a 1-256 character string");
  }
  if (Object.keys(body).some((key) => !["idempotencyKey", "taker", "tokenIn", "tokenOut", "amountIn", "venue", "ttlSeconds", ...(v3 ? ["flowType"] : [])].includes(key))) throw new Error("unsupported request field");
  const flow = v3 ? {flowType: normalizeFlowType(body.flowType)} : {};
  const {taker, tokenIn, tokenOut, amountIn, venue, ttlSeconds} = body;
  if (typeof taker !== "string" || typeof tokenIn !== "string" || typeof tokenOut !== "string" || typeof amountIn !== "string" || typeof venue !== "string") {
    throw new Error("taker, tokenIn, tokenOut, amountIn and venue are required strings");
  }
  return {
    ...flow,
    idempotencyKey: body.idempotencyKey,
    taker: normalizeAddress(taker as Address, "taker"),
    tokenIn: normalizeAddress(tokenIn as Address, "tokenIn"),
    tokenOut: normalizeAddress(tokenOut as Address, "tokenOut"),
    amountIn: toPositiveUintString(amountIn, "amountIn"),
    venue: normalizeAddress(venue as Address, "venue"),
    ttlSeconds: normalizeTtlSeconds(ttlSeconds === undefined ? lifetime.defaultTtlSeconds : ttlSeconds as number, lifetime.maxTtlSeconds)
  };
}

async function readJsonBody(req: IncomingMessage, maxBodyBytes: number): Promise<unknown> {
  const contentLength = req.headers["content-length"];
  if (typeof contentLength === "string") {
    const length = Number(contentLength);
    if (!Number.isSafeInteger(length) || length < 0) throw new Error("invalid content-length");
    if (length > maxBodyBytes) {
      req.resume();
      throw Object.assign(new Error("request body too large"), {statusCode: 413});
    }
  }
  return new Promise((resolve, reject) => {
    let total = 0;
    let settled = false;
    const chunks: Buffer[] = [];
    const rejectOnce = (error: Error & {statusCode?: number}) => {
      if (settled) return;
      settled = true;
      req.removeAllListeners("data");
      req.removeAllListeners("end");
      req.removeAllListeners("error");
      req.resume();
      reject(error);
    };
    req.on("data", (chunk) => {
      if (settled) return;
      const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
      total += buffer.length;
      if (total > maxBodyBytes) {
        rejectOnce(Object.assign(new Error("request body too large"), {statusCode: 413}));
        return;
      }
      chunks.push(buffer);
    });
    req.on("end", () => {
      if (settled) return;
      settled = true;
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString("utf8")));
      } catch {
        reject(new Error("malformed JSON request body"));
      }
    });
    req.on("error", (error) => rejectOnce(error));
  });
}

function auditEvent(
  outcome: AuditEvent["outcome"],
  reason: string,
  module: string,
  createdAt: number,
  input: {
    principalHash?: string;
    requestHash?: string;
    idempotencyKeyHash?: string;
    normalized?: NormalizedHostQuoteIntent;
    signed?: SignedRFQQuote | SignedRFQQuoteV3;
    quoteHash?: string;
    pricing?: RFQModuleFreshnessEvidence;
    risk?: RFQModuleFreshnessEvidence;
    replayed?: boolean;
  }
): AuditEvent {
  return {
    schemaVersion: 1,
    event: "quote.request",
    outcome,
    reason,
    module,
    principalHash: input.principalHash,
    requestHash: input.requestHash,
    idempotencyKeyHash: input.idempotencyKeyHash,
    taker: input.normalized?.taker,
    tokenIn: input.normalized?.tokenIn,
    tokenOut: input.normalized?.tokenOut,
    venue: input.normalized?.venue,
    amountIn: input.normalized?.amountIn,
    quoteHash: input.quoteHash,
    nonce: input.signed?.quote.nonce,
    pricingSnapshotId: input.pricing?.snapshotId,
    pricingVersion: input.pricing?.version,
    riskSnapshotId: input.risk?.snapshotId,
    riskVersion: input.risk?.version,
    replayed: input.replayed,
    createdAt
  };
}

async function strictRecordAudit(config: ProductionRFQHostConfig, event: AuditEvent): Promise<void> {
  try {
    await config.audit.record(event);
  } catch {
    await notifyIncident(config, {type: "audit_failure", module: "audit", reason: "audit_sink_failed", principalHash: event.principalHash, requestHash: event.requestHash, at: event.createdAt});
    if (config.strictAudit ?? true) throw Object.assign(new Error("audit persistence failed"), {auditFailure: true});
  }
}

async function bestEffortAudit(config: ProductionRFQHostConfig, event: AuditEvent): Promise<void> {
  try {
    await config.audit.record(event);
  } catch {
    await notifyIncident(config, {type: "audit_failure", module: "audit", reason: "audit_sink_failed", principalHash: event.principalHash, requestHash: event.requestHash, at: event.createdAt});
  }
}

async function notifyIncident(config: ProductionRFQHostConfig, incident: IncidentEvent): Promise<void> {
  try {
    await config.incident?.notify(incident);
    metric(config, "rfq_host_incidents_total", {type: incident.type, module: incident.module});
  } catch {
    metric(config, "rfq_host_incident_hook_failures_total", {module: "incident"});
  }
}

function classifyError(error: unknown): {status: number; publicError: string; reason: string; module: string; incident?: IncidentEvent["type"]; retryAfterSeconds?: number} {
  if (error instanceof UnauthorizedError) return {status: 401, publicError: "unauthorized", reason: "unauthorized", module: "auth", incident: "auth_abuse"};
  if (error instanceof ForbiddenError) return {status: 403, publicError: "forbidden", reason: "taker_binding_mismatch", module: "auth", incident: "auth_abuse"};
  const tagged = error as {statusCode?: number; dependencyReason?: string; dependencyModule?: string; auditFailure?: boolean; message?: string};
  if (tagged.statusCode === 413) return {status: 413, publicError: "request_too_large", reason: "request_too_large", module: "validation"};
  if (tagged.dependencyModule && tagged.dependencyReason) {
    const reason = tagged.dependencyReason === "stale" ? "stale" : "unavailable";
    return {
      status: 503,
      publicError: "dependency_unavailable",
      reason,
      module: boundedDependencyModule(tagged.dependencyModule),
      incident: reason === "stale" ? "dependency_stale" : "dependency_unavailable"
    };
  }
  if (error instanceof RFQCoordinatorError) {
    if (error.code === "INVALID_REQUEST") return {status: 400, publicError: "invalid_request", reason: "invalid_request", module: "validation"};
    if (error.code === "PRODUCT_UNAUTHORIZED") return {status: 403, publicError: "product_unauthorized", reason: "product_unauthorized", module: "product"};
    if (error.code === "CONFIGURATION_INVALID") return {status: 500, publicError: "configuration_invalid", reason: "configuration_invalid", module: "product"};
    if (error.code === "DEPENDENCY_UNAVAILABLE") return {status: 503, publicError: "dependency_unavailable", reason: "unavailable", module: boundedDependencyModule(tagged.dependencyModule), incident: "dependency_unavailable"};
    if (error.code === "CONTEXT_EVIDENCE_INVALID") return {status: 503, publicError: "dependency_unavailable", reason: "context_unavailable", module: "context", incident: "dependency_unavailable"};
    if (error.code === "RISK_REJECTED") {
      return {status: 422, publicError: "risk_rejected", reason: "risk_rejected", module: "risk"};
    }
    if (error.code === "PRICING_FRESHNESS_INVALID" || error.code === "RISK_FRESHNESS_INVALID" || error.code === "STRICT_EVIDENCE_REQUIRED") {
      const reason = error.message.includes("stale") || error.message.includes("future") ? "stale" : "unavailable";
      return {status: 503, publicError: "dependency_unavailable", reason, module: error.code.startsWith("PRICING") ? "pricing" : "risk", incident: reason === "stale" ? "dependency_stale" : "dependency_unavailable"};
    }
    if (error.code === "SIGNER_CALL_FAILED" || error.code === "SIGNER_SIGNATURE_INVALID") {
      return {status: 503, publicError: "signer_unavailable", reason: error.code.toLowerCase(), module: "signer", incident: "signer_failure"};
    }
    if (error.code === "IDEMPOTENCY_CONFLICT") return {status: 409, publicError: "idempotency_conflict", reason: "idempotency_conflict", module: "coordinator"};
  }
  if (tagged.auditFailure) return {status: 503, publicError: "audit_unavailable", reason: "audit_sink_failed", module: "audit", incident: "audit_failure"};
  const message = tagged.message ?? "unknown";
  if (message.includes("idempotency key conflict")) return {status: 409, publicError: "idempotency_conflict", reason: "idempotency_conflict", module: "coordinator"};
  if (message.includes("insufficient unreserved inventory")) return {status: 409, publicError: "inventory_unavailable", reason: "inventory_unavailable", module: "coordinator"};
  return {status: 500, publicError: "internal_error", reason: "internal_error", module: "host"};
}

function boundedDependencyModule(module?: string): string {
  return module && ["auth", "rate", "readiness", "policy", "pricing", "risk", "store", "context"].includes(module) ? module : "host";
}

async function hostDependency<T>(module: "auth" | "rate", operation: () => T | Promise<T>): Promise<T> {
  try {return await operation();}
  catch (error) {
    if (error instanceof UnauthorizedError || error instanceof ForbiddenError || error instanceof RFQCoordinatorError) throw error;
    throw Object.assign(new RFQCoordinatorError("DEPENDENCY_UNAVAILABLE", "RFQ dependency unavailable"), {dependencyModule: module});
  }
}

function sendJson(res: ServerResponse, status: number, body: unknown): void {
  const encoded = JSON.stringify(body);
  res.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
    "content-length": Buffer.byteLength(encoded)
  });
  res.end(encoded);
}

function metric(config: ProductionRFQHostConfig, name: string, labels?: Record<string, string>): void {
  config.metrics?.increment(name, sanitizeLabels(labels));
}

function timing(config: ProductionRFQHostConfig, name: string, ms: number, labels?: Record<string, string>): void {
  config.metrics?.timing(name, ms, sanitizeLabels(labels));
}

function sanitizeLabels(labels?: Record<string, string>): Record<string, string> {
  const result: Record<string, string> = {};
  for (const [key, value] of Object.entries(labels ?? {})) {
    if (!/^[a-z_]{1,32}$/.test(key)) continue;
    if (!/^[a-z0-9_:-]{1,64}$/i.test(value)) continue;
    result[key] = value;
  }
  return result;
}

function isRecord(value: unknown): value is JsonRecord {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function normalizePositiveInteger(value: number, field: string): number {
  if (!Number.isSafeInteger(value) || value <= 0) throw new Error(`${field} must be a positive safe integer`);
  return value;
}

async function readReadiness(probe: RFQReadinessProbe, timeoutMs: number): Promise<RFQReadinessReport> {
  try {
    const report = await withTimeout(Promise.resolve(probe.check()), timeoutMs);
    if (!report || typeof report !== "object" || typeof report.ready !== "boolean" || !Array.isArray(report.components)) {
      return {ready: false, components: []};
    }
    const components: RFQReadinessStatus[] = [];
    const seen = new Set<string>();
    for (const status of report.components) {
      if (
        !status ||
        typeof status !== "object" ||
        typeof status.component !== "string" ||
        !READINESS_COMPONENTS.has(status.component) ||
        typeof status.ready !== "boolean" ||
        seen.has(status.component)
      ) {
        return {ready: false, components: []};
      }
      seen.add(status.component);
      components.push({component: status.component as RFQReadinessComponent, ready: status.ready});
    }
    const allReady = components.length > 0 && components.every((status) => status.ready);
    return {ready: report.ready && allReady, components};
  } catch {
    return {ready: false, components: []};
  }
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_resolve, reject) => {
        timer = setTimeout(() => reject(new Error("operation timed out")), timeoutMs);
      })
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}
