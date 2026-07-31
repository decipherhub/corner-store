import {IncomingMessage, ServerResponse, createServer} from "http";
import {readFileSync} from "fs";
import {resolve} from "path";
import {getAddress} from "ethers";

import {TestnetRfqRuntime, TradeSide, buildRouterRequest} from "./runtime";

const MAX_BODY = 16 * 1024;

export async function startServer(runtime: TestnetRfqRuntime) {
  const publicDir = resolve(__dirname, "../../../public");
  const ethersBundle = resolve(__dirname, "../../../node_modules/ethers/dist/ethers.umd.min.js");
  const server = createServer((req, res) => void handle(req, res, runtime, publicDir, ethersBundle));
  await new Promise<void>((resolveListen, reject) => {
    server.once("error", reject);
    server.listen(runtime.config.port, runtime.config.host, () => {
      server.off("error", reject);
      resolveListen();
    });
  });
  return server;
}

async function handle(
  req: IncomingMessage,
  res: ServerResponse,
  runtime: TestnetRfqRuntime,
  publicDir: string,
  ethersBundle: string
) {
  try {
    if (req.method === "GET" && req.url === "/") return sendFile(res, resolve(publicDir, "index.html"), "text/html");
    if (req.method === "GET" && req.url === "/app.js") return sendFile(res, resolve(publicDir, "app.js"), "text/javascript");
    if (req.method === "GET" && req.url === "/styles.css") return sendFile(res, resolve(publicDir, "styles.css"), "text/css");
    if (req.method === "GET" && req.url === "/vendor/ethers.js") return sendFile(res, ethersBundle, "text/javascript");
    if (req.method === "GET" && req.url === "/api/state") return json(res, 200, await runtime.publicState());

    if (req.method === "GET" && req.url?.startsWith("/api/wallet/")) {
      return json(res, 200, await runtime.walletState(getAddress(decodeURIComponent(req.url.slice(12)))));
    }

    if (req.method === "POST" && req.url === "/api/precheck") {
      const body = await bodyJson(req);
      return json(res, 200, await runtime.precheck(
        address(body.taker, "taker"),
        uintString(body.amountIn, "amountIn"),
        side(body.side)
      ));
    }

    if (req.method === "POST" && req.url === "/api/quote") {
      const body = await bodyJson(req);
      const signed = await runtime.quoteFor(
        address(body.taker, "taker"),
        uintString(body.amountIn, "amountIn"),
        side(body.side),
        optionalPositiveInteger(body.ttlSeconds, "ttlSeconds")
      );
      const latest = await runtime.provider.getBlock("latest");
      if (!latest) throw new Error("latest block is unavailable");
      const routerNonce = BigInt(`0x${cryptoRandomHex(24)}`);
      const deadline = BigInt(latest.timestamp + 3600);
      return json(res, 200, {
        signed,
        execution: {
          inputToken: signed.quote.tokenIn,
          spender: runtime.config.artifact.rfqAdapter,
          router: runtime.config.artifact.router,
          request: buildRouterRequest(runtime.config, signed, routerNonce, deadline)
        }
      });
    }

    return json(res, 404, {error: "not_found"});
  } catch (error) {
    return json(res, 400, {
      error: "invalid_request",
      message: error instanceof Error ? error.message : "unknown error"
    });
  }
}

function sendFile(res: ServerResponse, path: string, type: string) {
  const content = readFileSync(path);
  res.writeHead(200, {
    "content-type": `${type}; charset=utf-8`,
    "content-length": content.length,
    "cache-control": "no-store"
  });
  res.end(content);
}

function json(res: ServerResponse, status: number, value: unknown) {
  const content = Buffer.from(`${JSON.stringify(value)}\n`);
  res.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "content-length": content.length,
    "cache-control": "no-store"
  });
  res.end(content);
}

async function bodyJson(req: IncomingMessage): Promise<Record<string, unknown>> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of req) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    size += buffer.length;
    if (size > MAX_BODY) throw new Error("request body exceeds 16 KiB");
    chunks.push(buffer);
  }
  const value = JSON.parse(Buffer.concat(chunks).toString("utf8"));
  if (typeof value !== "object" || value === null || Array.isArray(value)) throw new Error("JSON object required");
  return value as Record<string, unknown>;
}

function address(value: unknown, label: string) {
  if (typeof value !== "string") throw new Error(`${label} is required`);
  return getAddress(value);
}

function uintString(value: unknown, label: string) {
  if (typeof value !== "string" || !/^\d+$/.test(value) || BigInt(value) <= 0n) {
    throw new Error(`${label} must be a positive uint string`);
  }
  return value;
}

function side(value: unknown): TradeSide {
  if (value === "buy" || value === "sell") return value;
  throw new Error("side must be buy or sell");
}

function optionalPositiveInteger(value: unknown, label: string): number | undefined {
  if (value === undefined) return undefined;
  if (!Number.isSafeInteger(value) || Number(value) <= 0) throw new Error(`${label} must be a positive integer`);
  return Number(value);
}

function cryptoRandomHex(bytes: number): string {
  return require("crypto").randomBytes(bytes).toString("hex");
}
