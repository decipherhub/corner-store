declare function require(name: string): unknown;

import {isAbsolute} from "path";

import {
  AuditSink,
  IncidentSink,
  MetricsSink,
  ProductionRFQHost,
  RFQAuthenticator,
  RFQReadinessComponent,
  RFQReadinessProbe,
  RFQReadinessReport,
  RateLimiter,
  startProductionRFQHost
} from "./server";
import {Hex, QuoteCoordinatorIntent, RFQQuoteCoordinator} from "@corner-store/rfq-service";

export const PRODUCTION_RFQ_BOOTSTRAP_CONTRACT_VERSION = "1.0.0" as const;
export const PRODUCTION_RFQ_RUNTIME_CONFIG_VERSION = "1" as const;

const RFQ_ENV_PREFIX = "CORNER_STORE_RFQ_";
const ALLOWED_ENV = new Set([
  "CORNER_STORE_RFQ_CONFIG_VERSION",
  "CORNER_STORE_RFQ_BOOTSTRAP_MODULE",
  "CORNER_STORE_RFQ_HOST",
  "CORNER_STORE_RFQ_PORT",
  "CORNER_STORE_RFQ_PUBLIC_BIND_ACKNOWLEDGED",
  "CORNER_STORE_RFQ_MAX_BODY_BYTES",
  "CORNER_STORE_RFQ_FUTURE_SKEW_SECONDS",
  "CORNER_STORE_RFQ_READINESS_TIMEOUT_MS",
  "CORNER_STORE_RFQ_REQUEST_TIMEOUT_MS",
  "CORNER_STORE_RFQ_HEADERS_TIMEOUT_MS",
  "CORNER_STORE_RFQ_SHUTDOWN_TIMEOUT_MS"
]);
const REQUIRED_CAPABILITIES = [
  "durable_coordinator",
  "external_signer",
  "fresh_pricing_risk",
  "incident_monitoring",
  "live_policy_resolver",
  "production_authentication",
  "shared_rate_limit",
  "strict_audit"
] as const;
const REQUIRED_READINESS_COMPONENTS: RFQReadinessComponent[] = [
  "audit",
  "authentication",
  "coordinator",
  "policy",
  "pricing",
  "rate_limit",
  "risk",
  "signer"
];

export type ProductionRFQCapability = typeof REQUIRED_CAPABILITIES[number];

export interface ProductionRFQRuntimeConfig {
  schemaVersion: typeof PRODUCTION_RFQ_RUNTIME_CONFIG_VERSION;
  bootstrapModule: string;
  host: string;
  port: number;
  publicBindAcknowledged: boolean;
  maxBodyBytes: number;
  futureSkewSeconds: number;
  readinessTimeoutMs: number;
  requestTimeoutMs: number;
  headersTimeoutMs: number;
  shutdownTimeoutMs: number;
}

export interface ProductionRFQBootstrapContext {
  contractVersion: typeof PRODUCTION_RFQ_BOOTSTRAP_CONTRACT_VERSION;
  runtime: "production";
}

export interface ProductionRFQDependencies {
  coordinator: RFQQuoteCoordinator;
  authenticator: RFQAuthenticator;
  resolvePolicyId(request: Omit<QuoteCoordinatorIntent, "policyId">): Promise<Hex> | Hex;
  rateLimiter: RateLimiter;
  audit: AuditSink;
  metrics: MetricsSink;
  incident: IncidentSink;
  readiness: RFQReadinessProbe;
  close?(): Promise<void> | void;
}

export interface ProductionRFQBootstrapModule {
  contractVersion: typeof PRODUCTION_RFQ_BOOTSTRAP_CONTRACT_VERSION;
  capabilities: Record<ProductionRFQCapability, true>;
  createProductionRFQDependencies(
    context: ProductionRFQBootstrapContext
  ): Promise<ProductionRFQDependencies> | ProductionRFQDependencies;
}

export interface ProductionRFQRuntimeLogger {
  info(event: Record<string, string | number | boolean>): void;
  error(event: Record<string, string | number | boolean>): void;
}

export interface ProductionRFQRuntime {
  config: ProductionRFQRuntimeConfig;
  host: ProductionRFQHost;
  shutdown(signal?: string): Promise<void>;
}

export interface StartProductionRFQRuntimeOptions {
  env?: NodeJS.ProcessEnv;
  loadBootstrap?: (path: string) => unknown | Promise<unknown>;
  logger?: ProductionRFQRuntimeLogger;
}

export type ProductionRFQRuntimeErrorCode =
  | "RUNTIME_CONFIG_INVALID"
  | "BOOTSTRAP_LOAD_FAILED"
  | "BOOTSTRAP_CONTRACT_INVALID"
  | "BOOTSTRAP_DEPENDENCIES_INVALID";

export class ProductionRFQRuntimeError extends Error {
  constructor(readonly code: ProductionRFQRuntimeErrorCode) {
    super(code.toLowerCase());
    this.name = "ProductionRFQRuntimeError";
  }
}

export function loadProductionRFQRuntimeConfig(env: NodeJS.ProcessEnv = process.env): ProductionRFQRuntimeConfig {
  for (const key of Object.keys(env)) {
    if (key.startsWith(RFQ_ENV_PREFIX) && !ALLOWED_ENV.has(key)) {
      throw new ProductionRFQRuntimeError("RUNTIME_CONFIG_INVALID");
    }
  }
  if (env.CORNER_STORE_RFQ_CONFIG_VERSION !== PRODUCTION_RFQ_RUNTIME_CONFIG_VERSION) {
    throw new ProductionRFQRuntimeError("RUNTIME_CONFIG_INVALID");
  }
  const bootstrapModule = required(env.CORNER_STORE_RFQ_BOOTSTRAP_MODULE);
  if (!isAbsolute(bootstrapModule)) throw new ProductionRFQRuntimeError("RUNTIME_CONFIG_INVALID");
  const host = env.CORNER_STORE_RFQ_HOST ?? "127.0.0.1";
  const publicBindAcknowledged = env.CORNER_STORE_RFQ_PUBLIC_BIND_ACKNOWLEDGED === "1";
  if (env.CORNER_STORE_RFQ_PUBLIC_BIND_ACKNOWLEDGED !== undefined && !["0", "1"].includes(env.CORNER_STORE_RFQ_PUBLIC_BIND_ACKNOWLEDGED)) {
    throw new ProductionRFQRuntimeError("RUNTIME_CONFIG_INVALID");
  }
  return {
    schemaVersion: PRODUCTION_RFQ_RUNTIME_CONFIG_VERSION,
    bootstrapModule,
    host,
    port: boundedInteger(env.CORNER_STORE_RFQ_PORT, 8787, 65_535),
    publicBindAcknowledged,
    maxBodyBytes: boundedInteger(env.CORNER_STORE_RFQ_MAX_BODY_BYTES, 16 * 1024, 1024 * 1024),
    futureSkewSeconds: boundedNonNegativeInteger(env.CORNER_STORE_RFQ_FUTURE_SKEW_SECONDS, 5, 300),
    readinessTimeoutMs: boundedInteger(env.CORNER_STORE_RFQ_READINESS_TIMEOUT_MS, 3_000, 30_000),
    requestTimeoutMs: boundedInteger(env.CORNER_STORE_RFQ_REQUEST_TIMEOUT_MS, 30_000, 120_000),
    headersTimeoutMs: boundedInteger(env.CORNER_STORE_RFQ_HEADERS_TIMEOUT_MS, 15_000, 60_000),
    shutdownTimeoutMs: boundedInteger(env.CORNER_STORE_RFQ_SHUTDOWN_TIMEOUT_MS, 10_000, 60_000)
  };
}

export async function startProductionRFQRuntime(
  options: StartProductionRFQRuntimeOptions = {}
): Promise<ProductionRFQRuntime> {
  const config = loadProductionRFQRuntimeConfig(options.env);
  const logger = options.logger ?? jsonLogger();
  const bootstrap = await loadAndValidateBootstrap(config.bootstrapModule, options.loadBootstrap);
  let dependencies: ProductionRFQDependencies | undefined;
  let host: ProductionRFQHost | undefined;
  try {
    dependencies = validateDependencies(await bootstrap.createProductionRFQDependencies({
      contractVersion: PRODUCTION_RFQ_BOOTSTRAP_CONTRACT_VERSION,
      runtime: "production"
    }));
    host = await startProductionRFQHost({
      host: config.host,
      port: config.port,
      coordinator: dependencies.coordinator,
      authenticator: dependencies.authenticator,
      resolvePolicyId: dependencies.resolvePolicyId,
      rateLimiter: dependencies.rateLimiter,
      audit: dependencies.audit,
      metrics: dependencies.metrics,
      incident: dependencies.incident,
      readiness: productionReadiness(dependencies.readiness),
      maxBodyBytes: config.maxBodyBytes,
      strictAudit: true,
      futureSkewSeconds: config.futureSkewSeconds,
      readinessTimeoutMs: config.readinessTimeoutMs,
      requestTimeoutMs: config.requestTimeoutMs,
      headersTimeoutMs: config.headersTimeoutMs,
      publicBindAcknowledged: config.publicBindAcknowledged
    });
  } catch (error) {
    await safeClose(dependencies?.close);
    if (error instanceof ProductionRFQRuntimeError) throw error;
    throw new ProductionRFQRuntimeError("BOOTSTRAP_DEPENDENCIES_INVALID");
  }

  logger.info({event: "rfq_host_started", host: config.host, port: config.port, contractVersion: PRODUCTION_RFQ_BOOTSTRAP_CONTRACT_VERSION});
  let shutdownPromise: Promise<void> | undefined;
  return {
    config,
    host,
    shutdown(signal = "requested") {
      if (shutdownPromise) return shutdownPromise;
      shutdownPromise = boundedShutdown(host!, dependencies!, config.shutdownTimeoutMs, signal, logger);
      return shutdownPromise;
    }
  };
}

export function runtimeErrorCode(error: unknown): string {
  return error instanceof ProductionRFQRuntimeError ? error.code : "RUNTIME_START_FAILED";
}

async function loadAndValidateBootstrap(
  path: string,
  loader: StartProductionRFQRuntimeOptions["loadBootstrap"]
): Promise<ProductionRFQBootstrapModule> {
  let value: unknown;
  try {
    value = loader ? await loader(path) : require(path);
  } catch {
    throw new ProductionRFQRuntimeError("BOOTSTRAP_LOAD_FAILED");
  }
  const candidate = unwrapDefault(value);
  if (!isRecord(candidate) || candidate.contractVersion !== PRODUCTION_RFQ_BOOTSTRAP_CONTRACT_VERSION) {
    throw new ProductionRFQRuntimeError("BOOTSTRAP_CONTRACT_INVALID");
  }
  if (!isRecord(candidate.capabilities)) {
    throw new ProductionRFQRuntimeError("BOOTSTRAP_CONTRACT_INVALID");
  }
  const capabilityKeys = Object.keys(candidate.capabilities);
  if (
    capabilityKeys.length !== REQUIRED_CAPABILITIES.length ||
    capabilityKeys.some((name) => !(REQUIRED_CAPABILITIES as readonly string[]).includes(name)) ||
    REQUIRED_CAPABILITIES.some((name) => candidate.capabilities[name] !== true)
  ) {
    throw new ProductionRFQRuntimeError("BOOTSTRAP_CONTRACT_INVALID");
  }
  if (typeof candidate.createProductionRFQDependencies !== "function") {
    throw new ProductionRFQRuntimeError("BOOTSTRAP_CONTRACT_INVALID");
  }
  return candidate as unknown as ProductionRFQBootstrapModule;
}

function validateDependencies(value: unknown): ProductionRFQDependencies {
  if (!isRecord(value)) throw new ProductionRFQRuntimeError("BOOTSTRAP_DEPENDENCIES_INVALID");
  const checks = [
    [value.coordinator, "quoteWithEvidence"],
    [value.authenticator, "authenticate"],
    [value.rateLimiter, "check"],
    [value.audit, "record"],
    [value.metrics, "increment"],
    [value.metrics, "timing"],
    [value.incident, "notify"],
    [value.readiness, "check"]
  ] as const;
  if (typeof value.resolvePolicyId !== "function" || checks.some(([target, method]) => !isRecord(target) || typeof target[method] !== "function")) {
    throw new ProductionRFQRuntimeError("BOOTSTRAP_DEPENDENCIES_INVALID");
  }
  if (value.close !== undefined && typeof value.close !== "function") {
    throw new ProductionRFQRuntimeError("BOOTSTRAP_DEPENDENCIES_INVALID");
  }
  return value as unknown as ProductionRFQDependencies;
}

function productionReadiness(probe: RFQReadinessProbe): RFQReadinessProbe {
  return {
    async check(): Promise<RFQReadinessReport> {
      let report: RFQReadinessReport;
      try {
        report = await probe.check();
      } catch {
        return {ready: false, components: []};
      }
      if (!report || typeof report !== "object" || !Array.isArray(report.components)) {
        return {ready: false, components: []};
      }
      const seen = new Set<string>();
      for (const status of report.components) {
        if (
          !status ||
          typeof status !== "object" ||
          typeof status.component !== "string" ||
          !REQUIRED_READINESS_COMPONENTS.includes(status.component as RFQReadinessComponent) ||
          typeof status.ready !== "boolean" ||
          seen.has(status.component)
        ) {
          return {ready: false, components: []};
        }
        seen.add(status.component);
      }
      const byComponent = new Map(report.components.map((status) => [status.component, status.ready]));
      const components = REQUIRED_READINESS_COMPONENTS.map((component) => ({
        component,
        ready: byComponent.get(component) === true
      }));
      return {ready: report.ready === true && components.every((status) => status.ready), components};
    }
  };
}

async function boundedShutdown(
  host: ProductionRFQHost,
  dependencies: ProductionRFQDependencies,
  timeoutMs: number,
  signal: string,
  logger: ProductionRFQRuntimeLogger
): Promise<void> {
  logger.info({event: "rfq_host_stopping", signal});
  const close = Promise.allSettled([host.close(), safeClose(dependencies.close)]).then(() => undefined);
  const completed = await settleWithin(close, timeoutMs);
  if (!completed) {
    host.server.closeAllConnections?.();
    logger.error({event: "rfq_host_shutdown_timeout"});
    return;
  }
  logger.info({event: "rfq_host_stopped"});
}

async function settleWithin(operation: Promise<void>, timeoutMs: number): Promise<boolean> {
  let timer: NodeJS.Timeout | undefined;
  try {
    return await Promise.race([
      operation.then(() => true),
      new Promise<boolean>((resolve) => {
        timer = setTimeout(() => resolve(false), timeoutMs);
      })
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

async function safeClose(close: ProductionRFQDependencies["close"]): Promise<void> {
  try {
    await close?.();
  } catch {
    // Shutdown must stay bounded and must never print adapter-owned exception text.
  }
}

function unwrapDefault(value: unknown): unknown {
  if (isRecord(value) && value.default !== undefined) return value.default;
  return value;
}

function required(value: string | undefined): string {
  if (!value) throw new ProductionRFQRuntimeError("RUNTIME_CONFIG_INVALID");
  return value;
}

function boundedInteger(value: string | undefined, fallback: number, maximum: number): number {
  const parsed = value === undefined ? fallback : Number(value);
  if (!Number.isSafeInteger(parsed) || parsed <= 0 || parsed > maximum) {
    throw new ProductionRFQRuntimeError("RUNTIME_CONFIG_INVALID");
  }
  return parsed;
}

function boundedNonNegativeInteger(value: string | undefined, fallback: number, maximum: number): number {
  const parsed = value === undefined ? fallback : Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 0 || parsed > maximum) {
    throw new ProductionRFQRuntimeError("RUNTIME_CONFIG_INVALID");
  }
  return parsed;
}

function jsonLogger(): ProductionRFQRuntimeLogger {
  return {
    info: (event) => console.log(JSON.stringify(event)),
    error: (event) => console.error(JSON.stringify(event))
  };
}

function isRecord(value: unknown): value is Record<string, any> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}
