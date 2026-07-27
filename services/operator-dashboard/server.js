const {createServer, request: requestUpstream} = require("http");
const {readFileSync} = require("fs");
const {join} = require("path");

const port = Number(process.env.PORT || 8790);
const operatorApiUrl = new URL(process.env.CORNER_STORE_OPERATOR_API || "http://127.0.0.1:8788");
const rfqBackendUrl = new URL(process.env.CORNER_STORE_RFQ_BACKEND || "http://127.0.0.1:8787");
const operatorApiToken = process.env.CORNER_STORE_API_TOKEN;
const assets = {
  "/": ["index.html", "text/html; charset=utf-8"],
  "/index.html": ["index.html", "text/html; charset=utf-8"],
  "/styles.css": ["styles.css", "text/css; charset=utf-8"],
  "/app.js": ["app.js", "text/javascript; charset=utf-8"]
};

createServer((req, res) => {
  const path = new URL(req.url || "/", "http://127.0.0.1").pathname;
  if (req.method === "GET" && assets[path]) {
    const [file, contentType] = assets[path];
    res.writeHead(200, {"content-type": contentType, "cache-control": "no-store"});
    return res.end(readFileSync(join(__dirname, file)));
  }
  if (req.method === "GET" && path === "/health") {
    res.writeHead(200, {"content-type": "application/json; charset=utf-8"});
    return res.end(`${JSON.stringify({ok: true, service: "corner-store-operator-dashboard", operatorApi: operatorApiUrl.href, rfqBackend: rfqBackendUrl.href})}\n`);
  }
  if (req.method === "GET" && path.startsWith("/api/v1/")) {
    return proxyOperatorApi(req, res);
  }
  if (path.startsWith("/rfq-api/")) {
    return proxyRfqBackend(req, res);
  }
  res.writeHead(404, {"content-type": "application/json; charset=utf-8"});
  res.end('{"error":"not_found"}\n');
}).listen(port, "127.0.0.1", () => console.log(`Corner Store dashboard listening at http://127.0.0.1:${port}`));

function proxyOperatorApi(req, res) {
  const upstream = requestUpstream({
    protocol: operatorApiUrl.protocol,
    hostname: operatorApiUrl.hostname,
    port: operatorApiUrl.port,
    path: `${operatorApiUrl.pathname.replace(/\/$/, "")}${new URL(req.url || "/", "http://127.0.0.1").pathname}`,
    method: "GET",
    headers: operatorApiToken ? {authorization: `Bearer ${operatorApiToken}`} : {}
  }, (response) => {
    res.writeHead(response.statusCode || 502, {
      "content-type": response.headers["content-type"] || "application/json; charset=utf-8",
      "cache-control": "no-store"
    });
    response.pipe(res);
  });
  upstream.setTimeout(5000, () => upstream.destroy(new Error("operator API timeout")));
  upstream.on("error", (error) => {
    if (res.headersSent) return res.destroy(error);
    res.writeHead(502, {"content-type": "application/json; charset=utf-8"});
    res.end(JSON.stringify({error: "operator_api_unavailable", message: error.message}) + "\n");
  });
  upstream.end();
}

function proxyRfqBackend(req, res) {
  const requestPath = new URL(req.url || "/", "http://127.0.0.1").pathname.slice("/rfq-api".length);
  const upstream = requestUpstream({
    protocol: rfqBackendUrl.protocol,
    hostname: rfqBackendUrl.hostname,
    port: rfqBackendUrl.port,
    path: `${rfqBackendUrl.pathname.replace(/\/$/, "")}${requestPath}`,
    method: req.method,
    headers: {
      "content-type": req.headers["content-type"] || "application/json",
      ...(req.headers["content-length"] ? {"content-length": req.headers["content-length"]} : {})
    }
  }, (response) => {
    res.writeHead(response.statusCode || 502, {
      "content-type": response.headers["content-type"] || "application/json; charset=utf-8",
      "cache-control": "no-store"
    });
    response.pipe(res);
  });
  upstream.setTimeout(10000, () => upstream.destroy(new Error("RFQ backend timeout")));
  upstream.on("error", (error) => {
    if (res.headersSent) return res.destroy(error);
    res.writeHead(502, {"content-type": "application/json; charset=utf-8"});
    res.end(JSON.stringify({error: "rfq_backend_unavailable", message: error.message}) + "\n");
  });
  req.pipe(upstream);
}
