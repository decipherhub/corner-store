import {mkdtempSync, writeFileSync} from "fs";
import {request} from "http";
import {tmpdir} from "os";
import {join} from "path";
import {createOperatorApi, EventIndex} from "../src/api";
import {defaultConfig} from "@corner-store/toolkit";

async function main(): Promise<void> {
  const dir = mkdtempSync(join(tmpdir(), "corner-store-operator-"));
  const configPath = join(dir, "config.json");
  writeFileSync(configPath, JSON.stringify(defaultConfig()));
  const index = new EventIndex();
  index.add({blockNumber: 2, transactionHash: "0xabc", name: "ManifestActivated", args: {token: "0x1"}});
  const server = createOperatorApi({configPath, index});
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("operator API did not bind");
  const get = (path: string) => new Promise<{status: number; body: any}>((resolve, reject) => {
    const req = request({host: "127.0.0.1", port: address.port, path, method: "GET"}, (res) => {
      let body = "";
      res.on("data", (chunk) => (body += chunk));
      res.on("end", () => resolve({status: res.statusCode ?? 0, body: JSON.parse(body)}));
    });
    req.on("error", reject);
    req.end();
  });
  const health = await get("/api/v1/health");
  if (health.status !== 200 || !health.body.readOnly) throw new Error("health endpoint regression");
  const events = await get("/api/v1/events");
  if (events.body.events.length !== 1) throw new Error("event index regression");
  server.close();
  console.log("corner-store operator API smoke ok");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
