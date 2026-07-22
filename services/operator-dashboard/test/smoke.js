const fs = require("fs");
const path = require("path");

const html = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");
for (const marker of ["/api/v1/config", "/api/v1/events", "No private keys", "multisig"]) {
  if (!html.includes(marker)) throw new Error(`dashboard safety/data marker missing: ${marker}`);
}
console.log("corner-store operator dashboard smoke ok");
