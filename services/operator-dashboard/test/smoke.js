const fs = require("fs");
const path = require("path");

const html = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");
for (const marker of ["/api/v1/config", "/api/v1/deployment", "/api/v1/manifest", "/api/v1/events", "Active deployment", "Compliance control plane", "Manifest status", "Manifest version", "Recipe bindings", "no private keys", "Demo setup", "setupDemo", "Security demo", "securityAmount", "securityPrepare", "Create test quote", "Session trade history", "Compliance status", "Recent settlement activity", "eventSummary", "Indexed event log", "Request firm quote", "Revoke maker &amp; execute", "/demo/quote", "/demo/trade", "Router → RFQAdapter", "Preview only", "live.signature.slice", "securityQuote.signature.slice", "quote:live", "quote:securityQuote"]) {
  if (!html.includes(marker)) throw new Error(`dashboard safety/data marker missing: ${marker}`);
}
const server = fs.readFileSync(path.join(__dirname, "..", "server.js"), "utf8");
for (const marker of ["CORNER_STORE_OPERATOR_API", "CORNER_STORE_API_TOKEN", "proxyOperatorApi", "operator_api_unavailable"]) {
  if (!server.includes(marker)) throw new Error(`dashboard proxy marker missing: ${marker}`);
}
const launcher = fs.readFileSync(path.join(__dirname, "..", "..", "..", "scripts", "demo.sh"), "utf8");
for (const marker of ["scripts/e2e-anvil.sh", "CORNER_STORE_ARTIFACT", "Press Ctrl-C to stop all demo services"]) {
  if (!launcher.includes(marker)) throw new Error(`demo launcher marker missing: ${marker}`);
}
console.log("corner-store operator dashboard smoke ok");
