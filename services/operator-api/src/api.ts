import {createServer, IncomingMessage, Server, ServerResponse} from "http";
import {readFileSync, writeFileSync, existsSync} from "fs";
import {timingSafeEqual} from "crypto";
import {loadConfig, ToolkitConfig} from "@corner-store/toolkit";

export interface IndexedEvent {
  blockNumber: number;
  transactionHash: string;
  name: string;
  args: Record<string, string>;
}

export interface EventStore {
  add(event: IndexedEvent): void;
  list(): IndexedEvent[];
}

export class EventIndex implements EventStore {
  private readonly events: IndexedEvent[] = [];

  add(event: IndexedEvent): void {
    if (!Number.isSafeInteger(event.blockNumber) || event.blockNumber < 0) throw new Error("invalid event blockNumber");
    if (!event.transactionHash || !event.name) throw new Error("event transactionHash and name are required");
    this.events.push(event);
    this.events.sort((a, b) => a.blockNumber - b.blockNumber);
  }

  list(): IndexedEvent[] {
    return [...this.events];
  }
}

export class FileEventIndex implements EventStore {
  private events: IndexedEvent[];

  constructor(private readonly path: string) {
    this.events = existsSync(path) ? JSON.parse(readFileSync(path, "utf8")).events ?? [] : [];
  }

  add(event: IndexedEvent): void {
    if (!Number.isSafeInteger(event.blockNumber) || event.blockNumber < 0) throw new Error("invalid event blockNumber");
    if (!event.transactionHash || !event.name) throw new Error("event transactionHash and name are required");
    this.events.push(event);
    this.events.sort((a, b) => a.blockNumber - b.blockNumber);
    writeFileSync(this.path, `${JSON.stringify({schemaVersion: 1, lastBlock: this.events[this.events.length - 1]?.blockNumber ?? 0, events: this.events}, null, 2)}\n`);
  }

  list(): IndexedEvent[] {
    if (existsSync(this.path)) this.events = JSON.parse(readFileSync(this.path, "utf8")).events ?? [];
    return [...this.events];
  }
}

export interface OperatorApiOptions {
  configPath: string;
  artifactPath?: string;
  manifestPath?: string;
  eventsPath?: string;
  index?: EventStore;
  authToken?: string;
}

export function createOperatorApi(options: OperatorApiOptions): Server {
  const config = loadConfig(options.configPath);
  const artifact = options.artifactPath ? JSON.parse(readFileSync(options.artifactPath, "utf8")) : undefined;
  const manifest = options.manifestPath && existsSync(options.manifestPath)
    ? JSON.parse(readFileSync(options.manifestPath, "utf8"))
    : undefined;
  const index = options.index ?? (options.eventsPath ? new FileEventIndex(options.eventsPath) : new EventIndex());
  const metrics = {requests: 0, unauthorized: 0};

  return createServer((req, res) => {
    metrics.requests += 1;
    res.setHeader("content-type", "application/json");
    if (req.method !== "GET") return send(res, 405, {error: "read-only operator API"});
    const path = new URL(req.url ?? "/", "http://127.0.0.1").pathname;
    if (path === "/api/v1/health") return send(res, 200, {ok: true, readOnly: true});
    if (options.authToken && !authorized(req, options.authToken)) {
      metrics.unauthorized += 1;
      return send(res, 401, {error: "unauthorized"});
    }
    if (path === "/metrics") return sendMetrics(res, metrics.requests, metrics.unauthorized, index.list().length);
    if (path === "/api/v1/config") return send(res, 200, sanitizeConfig(config));
    if (path === "/api/v1/deployment") return send(res, 200, artifact ?? {configured: false});
    if (path === "/api/v1/manifest") return send(res, 200, manifest ?? {configured: false});
    if (path === "/api/v1/events") return send(res, 200, {events: index.list(), source: options.eventsPath ? "file-index" : "in-memory-index"});
    return send(res, 404, {error: "not found"});
  });
}

function authorized(req: IncomingMessage, expected: string): boolean {
  const supplied = req.headers.authorization;
  if (!supplied?.startsWith("Bearer ")) return false;
  const actual = Buffer.from(supplied.slice("Bearer ".length));
  const target = Buffer.from(expected);
  return actual.length === target.length && timingSafeEqual(actual, target);
}

function sanitizeConfig(config: ToolkitConfig): ToolkitConfig {
  return JSON.parse(JSON.stringify(config)) as ToolkitConfig;
}

function send(res: ServerResponse, status: number, body: unknown): void {
  res.statusCode = status;
  res.end(JSON.stringify(body));
}

function sendMetrics(res: ServerResponse, requests: number, unauthorized: number, events: number): void {
  res.setHeader("content-type", "text/plain; version=0.0.4");
  res.statusCode = 200;
  res.end([
    "# HELP corner_store_operator_requests_total HTTP requests received",
    "# TYPE corner_store_operator_requests_total counter",
    `corner_store_operator_requests_total ${requests}`,
    "# HELP corner_store_operator_unauthorized_total Unauthorized requests",
    "# TYPE corner_store_operator_unauthorized_total counter",
    `corner_store_operator_unauthorized_total ${unauthorized}`,
    "# HELP corner_store_operator_indexed_events Current indexed event count",
    "# TYPE corner_store_operator_indexed_events gauge",
    `corner_store_operator_indexed_events ${events}`,
    ""
  ].join("\n"));
}
