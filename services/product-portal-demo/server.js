const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");

const root = __dirname;
const port = Number(process.env.PORT || 4180);
const host = process.env.HOST || "127.0.0.1";
const files = new Map([
  ["/", ["index.html", "text/html; charset=utf-8"]],
  ["/index.html", ["index.html", "text/html; charset=utf-8"]],
  ["/styles.css", ["styles.css", "text/css; charset=utf-8"]],
  ["/model.js", ["model.js", "text/javascript; charset=utf-8"]],
  ["/app.js", ["app.js", "text/javascript; charset=utf-8"]],
  ["/assets/robin-avatar.svg", ["assets/robin-avatar.svg", "image/svg+xml"]],
  ["/assets/order-handle.svg", ["assets/order-handle.svg", "image/svg+xml"]]
]);

const server = http.createServer((request, response) => {
  const pathname = new URL(request.url, `http://${request.headers.host || host}`).pathname;
  if (pathname === "/health") {
    response.writeHead(200, { "content-type": "application/json; charset=utf-8" });
    response.end(JSON.stringify({ status: "ok", service: "product-portal-demo" }));
    return;
  }

  const entry = files.get(pathname);
  if (!entry) {
    response.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
    response.end("Not found");
    return;
  }

  fs.readFile(path.join(root, entry[0]), (error, body) => {
    if (error) {
      response.writeHead(500, { "content-type": "text/plain; charset=utf-8" });
      response.end("Unable to load demo asset");
      return;
    }
    response.writeHead(200, {
      "content-type": entry[1],
      "cache-control": "no-store",
      "x-content-type-options": "nosniff",
      "content-security-policy": "default-src 'self'; img-src 'self'; style-src 'self'; script-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'"
    });
    response.end(body);
  });
});

if (require.main === module) {
  server.listen(port, host, () => {
    console.log(`Corner Store product portal demo: http://${host}:${port}`);
  });
}

module.exports = { server };
