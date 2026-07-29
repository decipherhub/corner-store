const {createServer, request: requestUpstream} = require("http");
const {readFileSync} = require("fs");
const {join} = require("path");

const port = Number(process.env.PORT || 8790);
const operatorApiUrl = new URL(process.env.CORNER_STORE_OPERATOR_API || "http://127.0.0.1:8788");
const operatorApiToken = process.env.CORNER_STORE_API_TOKEN;
const page = readFileSync(join(__dirname, "index.html"));

createServer((req, res) => {
  const path = new URL(req.url || "/", "http://127.0.0.1").pathname;
  if (req.method === "GET" && (path === "/" || path === "/index.html")) {
    res.writeHead(200, {"content-type": "text/html; charset=utf-8", "cache-control": "no-store"});
    return res.end(page);
  }
  if (req.method === "GET" && path === "/health") {
    res.writeHead(200, {"content-type": "application/json; charset=utf-8"});
    return res.end(`${JSON.stringify({ok: true, service: "corner-store-operator-dashboard", operatorApi: operatorApiUrl.href})}\n`);
  }
  if (req.method === "GET" && path.startsWith("/api/v1/")) {
    return proxyOperatorApi(req, res);
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
