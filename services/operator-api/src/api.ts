import {createServer, IncomingMessage, Server, ServerResponse} from "http";
import {readFileSync} from "fs";
import {loadConfig, ToolkitConfig} from "@corner-store/toolkit";

export interface IndexedEvent {
  blockNumber: number;
  transactionHash: string;
  name: string;
  args: Record<string, string>;
}

export class EventIndex {
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

export interface OperatorApiOptions {
  configPath: string;
  artifactPath?: string;
  index?: EventIndex;
}

export function createOperatorApi(options: OperatorApiOptions): Server {
  const config = loadConfig(options.configPath);
  const artifact = options.artifactPath ? JSON.parse(readFileSync(options.artifactPath, "utf8")) : undefined;
  const index = options.index ?? new EventIndex();

  return createServer((req, res) => {
    res.setHeader("content-type", "application/json");
    if (req.method !== "GET") return send(res, 405, {error: "read-only operator API"});
    const path = new URL(req.url ?? "/", "http://127.0.0.1").pathname;
    if (path === "/api/v1/health") return send(res, 200, {ok: true, readOnly: true});
    if (path === "/api/v1/config") return send(res, 200, sanitizeConfig(config));
    if (path === "/api/v1/deployment") return send(res, 200, artifact ?? {configured: false});
    if (path === "/api/v1/events") return send(res, 200, {events: index.list(), source: "in-memory-index"});
    return send(res, 404, {error: "not found"});
  });
}

function sanitizeConfig(config: ToolkitConfig): ToolkitConfig {
  return JSON.parse(JSON.stringify(config)) as ToolkitConfig;
}

function send(res: ServerResponse, status: number, body: unknown): void {
  res.statusCode = status;
  res.end(JSON.stringify(body));
}
