import {accessSync, constants, readFileSync} from "fs";
import {isAbsolute} from "path";
import {createHash} from "crypto";
import {Server} from "http";

import {createOperatorApi} from "./api";

export const PRODUCTION_OPERATOR_RUNTIME_CONFIG_VERSION = "1" as const;

const PREFIX = "CORNER_STORE_OPERATOR_";
const ALLOWED_ENV = new Set([
  "CORNER_STORE_OPERATOR_CONFIG_VERSION",
  "CORNER_STORE_OPERATOR_HOST",
  "CORNER_STORE_OPERATOR_PORT",
  "CORNER_STORE_OPERATOR_PUBLIC_BIND_ACKNOWLEDGED",
  "CORNER_STORE_OPERATOR_CONFIG_FILE",
  "CORNER_STORE_OPERATOR_ARTIFACT_FILE",
  "CORNER_STORE_OPERATOR_MANIFEST_FILE",
  "CORNER_STORE_OPERATOR_EVENTS_FILE",
  "CORNER_STORE_OPERATOR_AUTH_TOKEN_FILE",
  "CORNER_STORE_OPERATOR_REQUEST_TIMEOUT_MS",
  "CORNER_STORE_OPERATOR_HEADERS_TIMEOUT_MS",
  "CORNER_STORE_OPERATOR_SHUTDOWN_TIMEOUT_MS"
]);
const LOOPBACK = new Set(["127.0.0.1", "::1", "localhost"]);

export interface ProductionOperatorRuntimeConfig {
  schemaVersion: typeof PRODUCTION_OPERATOR_RUNTIME_CONFIG_VERSION;
  host: string;
  port: number;
  publicBindAcknowledged: boolean;
  configFile: string;
  artifactFile: string;
  manifestFile?: string;
  eventsFile?: string;
  authTokenFile: string;
  requestTimeoutMs: number;
  headersTimeoutMs: number;
  shutdownTimeoutMs: number;
}

export interface ProductionOperatorLogger {
  info(event: Record<string, string | number | boolean>): void;
  error(event: Record<string, string | number | boolean>): void;
}

export interface ProductionOperatorRuntime {
  config: ProductionOperatorRuntimeConfig;
  server: Server;
  baseUrl: string;
  shutdown(signal?: string): Promise<void>;
}

export class ProductionOperatorRuntimeError extends Error {
  constructor(readonly code: "RUNTIME_CONFIG_INVALID" | "RUNTIME_DEPENDENCY_UNAVAILABLE" | "RUNTIME_START_FAILED") {
    super(code.toLowerCase());
    this.name = "ProductionOperatorRuntimeError";
  }
}

export function loadProductionOperatorRuntimeConfig(env: NodeJS.ProcessEnv = process.env): ProductionOperatorRuntimeConfig {
  for (const key of Object.keys(env)) {
    if (key.startsWith(PREFIX) && !ALLOWED_ENV.has(key)) throw new ProductionOperatorRuntimeError("RUNTIME_CONFIG_INVALID");
  }
  if (env.CORNER_STORE_OPERATOR_CONFIG_VERSION !== PRODUCTION_OPERATOR_RUNTIME_CONFIG_VERSION) {
    throw new ProductionOperatorRuntimeError("RUNTIME_CONFIG_INVALID");
  }
  const host = env.CORNER_STORE_OPERATOR_HOST ?? "127.0.0.1";
  const publicBindAcknowledged = parseAcknowledgement(env.CORNER_STORE_OPERATOR_PUBLIC_BIND_ACKNOWLEDGED);
  if (!LOOPBACK.has(host) && !publicBindAcknowledged) throw new ProductionOperatorRuntimeError("RUNTIME_CONFIG_INVALID");
  return {
    schemaVersion: PRODUCTION_OPERATOR_RUNTIME_CONFIG_VERSION,
    host,
    port: boundedInteger(env.CORNER_STORE_OPERATOR_PORT, 8788, 65_535),
    publicBindAcknowledged,
    configFile: absoluteRequired(env.CORNER_STORE_OPERATOR_CONFIG_FILE),
    artifactFile: absoluteRequired(env.CORNER_STORE_OPERATOR_ARTIFACT_FILE),
    manifestFile: absoluteOptional(env.CORNER_STORE_OPERATOR_MANIFEST_FILE),
    eventsFile: absoluteOptional(env.CORNER_STORE_OPERATOR_EVENTS_FILE),
    authTokenFile: absoluteRequired(env.CORNER_STORE_OPERATOR_AUTH_TOKEN_FILE),
    requestTimeoutMs: boundedInteger(env.CORNER_STORE_OPERATOR_REQUEST_TIMEOUT_MS, 30_000, 120_000),
    headersTimeoutMs: boundedInteger(env.CORNER_STORE_OPERATOR_HEADERS_TIMEOUT_MS, 15_000, 60_000),
    shutdownTimeoutMs: boundedInteger(env.CORNER_STORE_OPERATOR_SHUTDOWN_TIMEOUT_MS, 10_000, 60_000)
  };
}

export async function startProductionOperatorRuntime(options: {
  env?: NodeJS.ProcessEnv;
  logger?: ProductionOperatorLogger;
} = {}): Promise<ProductionOperatorRuntime> {
  const config = loadProductionOperatorRuntimeConfig(options.env);
  const logger = options.logger ?? jsonLogger();
  const authToken = readToken(config.authTokenFile);
  const dependencySnapshot = captureDependencySnapshot(config);
  if (!dependenciesReady(config, dependencySnapshot)) throw new ProductionOperatorRuntimeError("RUNTIME_DEPENDENCY_UNAVAILABLE");
  let server: Server;
  try {
    server = createOperatorApi({
      configPath: config.configFile,
      artifactPath: config.artifactFile,
      manifestPath: config.manifestFile,
      eventsPath: config.eventsFile,
      authToken,
      readiness: () => dependenciesReady(config, dependencySnapshot)
    });
  } catch {
    throw new ProductionOperatorRuntimeError("RUNTIME_DEPENDENCY_UNAVAILABLE");
  }
  server.requestTimeout = config.requestTimeoutMs;
  server.headersTimeout = config.headersTimeoutMs;
  try {
    await new Promise<void>((resolve, reject) => {
      server.once("error", reject);
      server.listen(config.port, config.host, () => {
        server.off("error", reject);
        resolve();
      });
    });
  } catch {
    throw new ProductionOperatorRuntimeError("RUNTIME_START_FAILED");
  }
  logger.info({event: "operator_api_started", host: config.host, port: config.port});
  let shutdownPromise: Promise<void> | undefined;
  return {
    config,
    server,
    baseUrl: `http://${config.host === "0.0.0.0" ? "127.0.0.1" : config.host}:${config.port}`,
    shutdown(signal = "requested") {
      if (shutdownPromise) return shutdownPromise;
      shutdownPromise = boundedShutdown(server, config.shutdownTimeoutMs, signal, logger);
      return shutdownPromise;
    }
  };
}

export function productionOperatorErrorCode(error: unknown): string {
  return error instanceof ProductionOperatorRuntimeError ? error.code : "RUNTIME_START_FAILED";
}

function dependencyPaths(config: ProductionOperatorRuntimeConfig): string[] {
  return [config.configFile, config.artifactFile, config.authTokenFile, config.manifestFile, config.eventsFile]
    .filter((path): path is string => !!path);
}

function captureDependencySnapshot(config: ProductionOperatorRuntimeConfig): Map<string, string> {
  try {
    return new Map(dependencyPaths(config).map((path) => [path, fileHash(path)]));
  } catch {
    throw new ProductionOperatorRuntimeError("RUNTIME_DEPENDENCY_UNAVAILABLE");
  }
}

function dependenciesReady(config: ProductionOperatorRuntimeConfig, expected: Map<string, string>): boolean {
  try {
    for (const path of dependencyPaths(config)) {
      accessSync(path, constants.R_OK);
      if (fileHash(path) !== expected.get(path)) return false;
    }
    JSON.parse(readFileSync(config.configFile, "utf8"));
    JSON.parse(readFileSync(config.artifactFile, "utf8"));
    if (config.manifestFile) JSON.parse(readFileSync(config.manifestFile, "utf8"));
    if (config.eventsFile) JSON.parse(readFileSync(config.eventsFile, "utf8"));
    return readToken(config.authTokenFile).length > 0;
  } catch {
    return false;
  }
}

function fileHash(path: string): string {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

function readToken(path: string): string {
  try {
    const token = readFileSync(path, "utf8").trim();
    if (token.length < 32 || token.length > 512 || /[\r\n]/.test(token)) {
      throw new Error("invalid token");
    }
    return token;
  } catch {
    throw new ProductionOperatorRuntimeError("RUNTIME_DEPENDENCY_UNAVAILABLE");
  }
}

async function boundedShutdown(server: Server, timeoutMs: number, signal: string, logger: ProductionOperatorLogger): Promise<void> {
  logger.info({event: "operator_api_stopping", signal});
  const close = new Promise<void>((resolve) => server.close(() => resolve()));
  const completed = await settleWithin(close, timeoutMs);
  if (!completed) {
    server.closeAllConnections?.();
    logger.error({event: "operator_api_shutdown_timeout"});
    return;
  }
  logger.info({event: "operator_api_stopped"});
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

function absoluteRequired(value: string | undefined): string {
  if (!value || !isAbsolute(value)) throw new ProductionOperatorRuntimeError("RUNTIME_CONFIG_INVALID");
  return value;
}

function absoluteOptional(value: string | undefined): string | undefined {
  if (value === undefined) return undefined;
  return absoluteRequired(value);
}

function parseAcknowledgement(value: string | undefined): boolean {
  if (value === undefined || value === "0") return false;
  if (value === "1") return true;
  throw new ProductionOperatorRuntimeError("RUNTIME_CONFIG_INVALID");
}

function boundedInteger(value: string | undefined, fallback: number, maximum: number): number {
  const parsed = value === undefined ? fallback : Number(value);
  if (!Number.isSafeInteger(parsed) || parsed <= 0 || parsed > maximum) {
    throw new ProductionOperatorRuntimeError("RUNTIME_CONFIG_INVALID");
  }
  return parsed;
}

function jsonLogger(): ProductionOperatorLogger {
  return {
    info: (event) => console.log(JSON.stringify(event)),
    error: (event) => console.error(JSON.stringify(event))
  };
}
