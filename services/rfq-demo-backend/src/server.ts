import {IncomingMessage, Server, ServerResponse, createServer} from "http";

import {RFQBackendSDK, SignedRFQQuote} from "../../rfq/src";

import {DemoBackendConfig, asAddress} from "./config";
import {createDemoPricing, createDemoQuoteService} from "./service";
import {
  DemoSettlementService,
  DemoTradeAction,
  LookThroughStatus,
  QpBasis,
  QpClaimInput
} from "./settlement";

const MAX_BODY_BYTES = 16 * 1024;

export interface QuoteRequestBody {
  taker: string;
  amountIn: string;
  side?: "buy" | "sell";
  ttlSeconds?: number;
}

export interface DemoServer {
  server: Server;
  baseUrl: string;
  close(): Promise<void>;
}

export async function startDemoServer(config: DemoBackendConfig): Promise<DemoServer> {
  const pricing = createDemoPricing(config);
  const quoteService = await createDemoQuoteService(config, pricing);
  const settlement = config.demoSettlement.enabled ? new DemoSettlementService(config, quoteService, pricing) : undefined;
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

    if (req.method === "GET" && req.url === "/demo/market-history") {
      if (!settlement) {
        sendJson(res, 403, {error: "demo_settlement_disabled", message: "market history is available only from the local e2e runner"});
        return;
      }
      sendJson(res, 200, await settlement.marketHistory());
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

    if (req.method === "POST" && req.url === "/demo/precheck") {
      requireSettlement(settlement);
      const body = await readJsonBody(req);
      if (!isRecord(body) || typeof body.taker !== "string") throw new Error("taker is required");
      const amountIn = parseAmount(body.amountIn);
      sendJson(res, 200, await settlement.precheck(
        asAddress(body.taker, "taker"),
        amountIn,
        parseSide(body.side)
      ));
      return;
    }

    if (req.method === "GET" && req.url === "/demo/admin/state") {
      requireSettlement(settlement);
      sendJson(res, 200, await settlement.state());
      return;
    }

    if (req.method === "POST" && req.url === "/demo/admin/claim") {
      requireSettlement(settlement);
      const body = await readJsonBody(req);
      if (!isRecord(body) || typeof body.walletId !== "string") throw new Error("walletId is required");
      sendJson(res, 200, await settlement.setUserClaim(body.walletId, parseQpClaim(body.claim)));
      return;
    }

    if (req.method === "POST" && req.url === "/demo/admin/temporal/prepare") {
      requireSettlement(settlement);
      const body = await readJsonBody(req);
      if (!isRecord(body) || (body.walletId !== undefined && typeof body.walletId !== "string")) {
        throw new Error("walletId must be a string");
      }
      sendJson(res, 200, await settlement.prepareTemporalEligibility(body.walletId as string | undefined));
      return;
    }

    if (req.method === "POST" && req.url === "/demo/admin/temporal/advance") {
      requireSettlement(settlement);
      const body = await readJsonBody(req);
      if (!isRecord(body) || (body.seconds !== undefined && !Number.isSafeInteger(body.seconds))) {
        throw new Error("seconds must be an integer");
      }
      sendJson(res, 200, await settlement.advanceTime(body.seconds as number | undefined));
      return;
    }

    if (req.method === "POST" && req.url === "/demo/admin/maker") {
      requireSettlement(settlement);
      const body = await readJsonBody(req);
      if (!isRecord(body) || typeof body.approved !== "boolean") throw new Error("approved is required");
      sendJson(res, 200, await settlement.setMakerApproved(body.approved));
      return;
    }

    if (req.method === "POST" && req.url === "/demo/enforcement/adapter-boundary") {
      if (!settlement) {
        sendJson(res, 403, {error: "demo_settlement_disabled", message: "enforcement evidence is available only from the local e2e runner"});
        return;
      }
      const body = await readJsonBody(req);
      if (!isRecord(body) || (body.walletId !== undefined && typeof body.walletId !== "string")) {
        throw new Error("walletId must be a string");
      }
      sendJson(res, 200, await settlement.proveAdapterBoundary(body.walletId as string | undefined));
      return;
    }

    if (req.method === "POST" && req.url === "/demo/enforcement/restore") {
      if (!settlement) {
        sendJson(res, 403, {error: "demo_settlement_disabled", message: "enforcement restore is available only from the local e2e runner"});
        return;
      }
      const body = await readJsonBody(req);
      if (
        !isRecord(body) ||
        (body.kind !== "claim-expiry" && body.kind !== "maker-revocation")
      ) {
        throw new Error("kind must be claim-expiry or maker-revocation");
      }
      sendJson(res, 200, await settlement.restoreEnforcementState(body.kind));
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
      const request = {
        ...(isRecord(body) ? body : {}),
        taker: isRecord(body) && typeof body.taker === "string" ? body.taker : config.artifact.investor
      };
      if (settlement) settlement.assertDemoWallet(asAddress(request.taker, "taker"));
      const signed = await createQuote(request, config, quoteService);
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

function parseQpClaim(value: unknown): QpClaimInput {
  if (!isRecord(value)) throw new Error("claim is required");
  const basis = value.basis;
  const lookThroughStatus = value.lookThroughStatus;
  if (!isQpBasis(basis)) throw new Error("claim basis is invalid");
  if (!isLookThroughStatus(lookThroughStatus)) throw new Error("lookThroughStatus is invalid");
  if (
    typeof value.signatureValid !== "boolean" ||
    typeof value.issuerTrusted !== "boolean" ||
    typeof value.coveredCompanyMatchesFund !== "boolean"
  ) {
    throw new Error("claim signature, issuer trust and covered-company facts are required");
  }
  return {
    basis,
    signatureValid: value.signatureValid,
    issuerTrusted: value.issuerTrusted,
    lookThroughStatus,
    coveredCompanyMatchesFund: value.coveredCompanyMatchesFund
  };
}

function isQpBasis(value: unknown): value is QpBasis {
  return [
    "NONE", "NATURAL", "FAMILY_COMPANY", "TRUST",
    "INSTITUTIONAL", "QIB", "KNOWLEDGEABLE_EMPLOYEE", "OTHER"
  ].includes(String(value));
}

function isLookThroughStatus(value: unknown): value is LookThroughStatus {
  return ["NONE", "PENDING", "COMPLETED", "FAILED"].includes(String(value));
}

function parseDemoTrade(body: unknown): {amountIn: string; action: DemoTradeAction} {
  if (!isRecord(body)) throw new Error("request body must be a JSON object");
  const amountIn = parseAmount(body.amountIn);
  const action = body.action ?? "settle";
  if (action !== "settle" && action !== "revoked-maker" && action !== "compliance-proof") {
    throw new Error("action must be settle, revoked-maker or compliance-proof");
  }
  return {amountIn, action};
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
  const side = parseSide(body.side);

  return quoteService.quote({
    taker,
    tokenIn: asAddress(side === "buy" ? config.artifact.quote : config.artifact.rwaToken, "artifact tokenIn"),
    tokenOut: asAddress(side === "buy" ? config.artifact.rwaToken : config.artifact.quote, "artifact tokenOut"),
    amountIn: body.amountIn,
    venue: asAddress(config.artifact.rfqVenue, "artifact rfqVenue"),
    ttlSeconds: body.ttlSeconds as number | undefined
  });
}

function parseSide(value: unknown): "buy" | "sell" {
  if (value === undefined || value === "buy") return "buy";
  if (value === "sell") return "sell";
  throw new Error("side must be buy or sell");
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

function parseAmount(value: unknown): string {
  if (typeof value !== "string" || !/^\d+$/.test(value) || BigInt(value) <= 0n) {
    throw new Error("amountIn must be a positive base-unit uint string");
  }
  return value;
}

function requireSettlement(
  settlement: DemoSettlementService | undefined
): asserts settlement is DemoSettlementService {
  if (!settlement) throw new Error("demo settlement is available only from the local e2e runner");
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
