import {IncomingMessage, Server, ServerResponse, createServer} from "http";

import {RFQBackendSDK, SignedRFQQuote} from "../../rfq/src";

import {DemoBackendConfig, asAddress} from "./config";
import {createDemoQuoteService} from "./service";
import {DemoSettlementService, DemoTradeAction} from "./settlement";

const MAX_BODY_BYTES = 16 * 1024;

export interface QuoteRequestBody {
  taker: string;
  amountIn: string;
  ttlSeconds?: number;
}

export interface DemoServer {
  server: Server;
  baseUrl: string;
  close(): Promise<void>;
}

export async function startDemoServer(config: DemoBackendConfig): Promise<DemoServer> {
  const quoteService = await createDemoQuoteService(config);
  const settlement = config.demoSettlement.enabled ? new DemoSettlementService(config, quoteService) : undefined;
  const server = createServer((req, res) => {
    void handleRequest(req, res, config, quoteService, settlement);
  });

  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(config.port, config.host, () => {
      server.off("error", reject);
      resolve();
    });
  });

  const address = server.address();
  if (!address || typeof address === "string") throw new Error("demo backend did not bind a TCP address");
  const visibleHost = config.host === "0.0.0.0" ? "127.0.0.1" : config.host;
  const baseUrl = `http://${visibleHost}:${address.port}`;

  return {
    server,
    baseUrl,
    close: () => new Promise<void>((resolve, reject) => server.close((err) => (err ? reject(err) : resolve())))
  };
}

async function handleRequest(
  req: IncomingMessage,
  res: ServerResponse,
  config: DemoBackendConfig,
  quoteService: RFQBackendSDK,
  settlement?: DemoSettlementService
): Promise<void> {
  try {
    setDemoCors(req, res);
    if (req.method === "OPTIONS") {
      res.writeHead(204);
      res.end();
      return;
    }
    if (req.method === "GET" && req.url === "/health") {
      sendJson(res, 200, {
        status: "ok",
        service: "corner-store-rfq-demo-backend",
        chainId: config.chainId,
        maker: await config.makerWallet.getAddress(),
        verifyingContract: config.artifact.rfqAdapter,
        venue: config.artifact.rfqVenue,
        tokenIn: config.artifact.quote,
        tokenOut: config.artifact.rwaToken,
        taker: config.artifact.investor,
        demoSettlementEnabled: Boolean(settlement)
      });
      return;
    }

    if (req.method === "GET" && req.url === "/demo/state") {
      if (!settlement) {
        sendJson(res, 403, {error: "demo_settlement_disabled", message: "demo state is available only from the local e2e runner"});
        return;
      }
      sendJson(res, 200, await settlement.state());
      return;
    }

    if (req.method === "POST" && req.url === "/demo/setup") {
      if (!settlement) {
        sendJson(res, 403, {error: "demo_settlement_disabled", message: "demo setup is available only from the local e2e runner"});
        return;
      }
      await readJsonBody(req);
      sendJson(res, 200, await settlement.prepare());
      return;
    }

    if (req.method === "POST" && req.url === "/demo/restore") {
      if (!settlement) {
        sendJson(res, 403, {error: "demo_settlement_disabled", message: "demo restore is available only from the local e2e runner"});
        return;
      }
      await readJsonBody(req);
      sendJson(res, 200, await settlement.restoreMaker());
      return;
    }

    if (req.method === "POST" && (req.url === "/rfq/quote" || req.url === "/quote")) {
      const body = await readJsonBody(req);
      const signed = await createQuote(body, config, quoteService);
      sendJson(res, 200, signed);
      return;
    }

    if (req.method === "POST" && req.url === "/demo/quote") {
      const body = await readJsonBody(req);
      const signed = await createQuote({
        ...(isRecord(body) ? body : {}),
        taker: isRecord(body) && typeof body.taker === "string" ? body.taker : config.artifact.investor
      }, config, quoteService);
      sendJson(res, 200, signed);
      return;
    }

    if (req.method === "POST" && req.url === "/demo/trade") {
      if (!settlement) {
        sendJson(res, 403, {error: "demo_settlement_disabled", message: "demo settlement is available only from the local e2e runner"});
        return;
      }
      const body = await readJsonBody(req);
      const {amountIn, action} = parseDemoTrade(body);
      const signedQuote = isRecord(body) && isRecord(body.quote) ? body.quote as unknown as SignedRFQQuote : undefined;
      sendJson(res, 200, await settlement.trade(amountIn, action, signedQuote));
      return;
    }

    sendJson(res, 404, {error: "not_found"});
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown error";
    sendJson(res, 400, {error: "invalid_request", message});
  }
}

function parseDemoTrade(body: unknown): {amountIn: string; action: DemoTradeAction} {
  if (!isRecord(body)) throw new Error("request body must be a JSON object");
  if (typeof body.amountIn !== "string" || !/^\d+$/.test(body.amountIn) || BigInt(body.amountIn) <= 0n) {
    throw new Error("amountIn must be a positive base-unit uint string");
  }
  const action = body.action ?? "settle";
  if (action !== "settle" && action !== "revoked-maker") throw new Error("action must be settle or revoked-maker");
  return {amountIn: body.amountIn, action};
}

function setDemoCors(req: IncomingMessage, res: ServerResponse): void {
  // This service is intentionally local-only. Permit only the shipped local
  // dashboard origin rather than letting arbitrary web pages query a signer.
  const origin = req.headers.origin;
  if (origin === "http://127.0.0.1:8790" || origin === "http://localhost:8790") {
    res.setHeader("access-control-allow-origin", origin);
    res.setHeader("vary", "origin");
  }
  res.setHeader("access-control-allow-methods", "GET, POST, OPTIONS");
  res.setHeader("access-control-allow-headers", "content-type");
}

async function createQuote(
  body: unknown,
  config: DemoBackendConfig,
  quoteService: RFQBackendSDK
): Promise<SignedRFQQuote> {
  if (!isRecord(body)) throw new Error("request body must be a JSON object");
  const taker = typeof body.taker === "string" ? asAddress(body.taker, "taker") : undefined;
  if (!taker) throw new Error("taker is required");
  if (typeof body.amountIn !== "string" || !/^\d+$/.test(body.amountIn) || BigInt(body.amountIn) <= 0n) {
    throw new Error("amountIn must be a positive base-unit uint string");
  }
  if (body.ttlSeconds !== undefined && (!Number.isSafeInteger(body.ttlSeconds) || Number(body.ttlSeconds) <= 0)) {
    throw new Error("ttlSeconds must be a positive integer");
  }

  return quoteService.quote({
    taker,
    tokenIn: asAddress(config.artifact.quote, "artifact quote"),
    tokenOut: asAddress(config.artifact.rwaToken, "artifact rwaToken"),
    amountIn: body.amountIn,
    venue: asAddress(config.artifact.rfqVenue, "artifact rfqVenue"),
    ttlSeconds: body.ttlSeconds as number | undefined
  });
}

async function readJsonBody(req: IncomingMessage): Promise<unknown> {
  const contentType = req.headers["content-type"] ?? "";
  if (!contentType.toLowerCase().includes("application/json")) {
    throw new Error("content-type must be application/json");
  }

  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of req) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    size += buffer.length;
    if (size > MAX_BODY_BYTES) throw new Error("request body exceeds 16 KiB");
    chunks.push(buffer);
  }

  if (chunks.length === 0) throw new Error("request body is required");
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    throw new Error("request body must contain valid JSON");
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function sendJson(res: ServerResponse, status: number, value: unknown): void {
  const body = `${JSON.stringify(value)}\n`;
  res.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "content-length": Buffer.byteLength(body),
    "cache-control": "no-store"
  });
  res.end(body);
}
