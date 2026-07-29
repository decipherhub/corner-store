const fs = require("fs");
const path = require("path");

const html = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");
for (const marker of ["/api/v1/config", "/api/v1/events", "No private keys", "multisig", "RFQ demo", "Run compliant RFQ trade", "Revoke maker &amp; retry", "/demo/trade", "Router → RFQAdapter"]) {
  if (!html.includes(marker)) throw new Error(`dashboard safety/data marker missing: ${marker}`);
}
const server = fs.readFileSync(path.join(__dirname, "..", "server.js"), "utf8");
for (const marker of ["CORNER_STORE_OPERATOR_API", "CORNER_STORE_API_TOKEN", "proxyOperatorApi", "operator_api_unavailable"]) {
  if (!server.includes(marker)) throw new Error(`dashboard proxy marker missing: ${marker}`);
}
console.log("corner-store operator dashboard smoke ok");
