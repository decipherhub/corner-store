import assert from "node:assert/strict";
import {execFileSync} from "node:child_process";
import {createHash} from "node:crypto";
import {readFileSync, readdirSync} from "node:fs";
import {createRequire} from "node:module";
import {dirname, join, resolve} from "node:path";
import {test} from "node:test";
import {fileURLToPath} from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(import.meta.url);
const {loadArtifact, resolveArtifactPath} = require("../services/cli/dist/cli/src/config.js");
const {createOperatorApi} = require("../services/operator-api/dist/src/api.js");
const directory = join(root, "deployments/public");
const files = readdirSync(directory, {recursive: true}).filter((file) => file.endsWith(".json")).sort();
const snapshot = new Map(files.map((file) => [file, readFileSync(join(directory, file))]));
const hash = (bytes) => createHash("sha256").update(bytes).digest("hex");

test("existing public deployment listing preserves the published record identity", () => {
  const tracked = execFileSync("git", ["ls-files", "-z", "deployments/public"], {cwd: root, encoding: "utf8"})
    .split("\0").filter((file) => file.endsWith(".json")).map((file) => file.slice("deployments/public/".length)).sort();
  assert.deepEqual(files, tracked);
  assert.equal(hash(snapshot.get("monad-onchain-finance-rfq-v1-10143.json")),
    "c43cef9e5857a8887d8e8648cbdc7e48e52bd28f4dd685c528a5fa13906e1263");
});

test("CLI and read-only Operator API read every exact public artifact without changing bytes", async () => {
  try {
    for (const [file, bytes] of snapshot) {
      const artifactPath = join(directory, file);
      const expected = JSON.parse(bytes.toString("utf8"));
      assert.equal(resolveArtifactPath(artifactPath), artifactPath);
      assert.deepEqual(loadArtifact(artifactPath), expected);
      const server = createOperatorApi({configPath: join(root, "services/toolkit/examples/corner-store.config.json"), artifactPath});
      try {
        await new Promise((resolve, reject) => { server.once("error", reject); server.listen(0, "127.0.0.1", resolve); });
        const response = await fetch(`http://127.0.0.1:${server.address().port}/api/v1/deployment`);
        assert.equal(response.status, 200);
        assert.deepEqual(await response.json(), expected);
      } finally {
        server.closeAllConnections();
        await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
      }
    }
  } finally {
    assert.deepEqual(readdirSync(directory, {recursive: true}).filter((file) => file.endsWith(".json")).sort(), files);
    for (const [file, bytes] of snapshot) {
      const after = readFileSync(join(directory, file));
      assert.equal(hash(after), hash(bytes), file);
      assert.deepEqual(after, bytes, file);
    }
  }
});
