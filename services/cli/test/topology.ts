import assert from "node:assert/strict";
import {test} from "node:test";
import {execFileSync, spawnSync} from "node:child_process";
import {mkdtempSync, readFileSync, writeFileSync, existsSync} from "node:fs";
import {tmpdir} from "node:os";
import {join} from "node:path";
import {AbiCoder, encodeBytes32String, keccak256, toUtf8Bytes} from "ethers";

const cli = join(__dirname, "../src/index.js");
function config(): any {
  const c = JSON.parse(readFileSync(join(__dirname, "../../../../toolkit/examples/corner-store.production-onboarding-v6.json"), "utf8"));
  c.schemaVersion = 7;
  const id = encodeBytes32String("A-04-v2");
  const schemaId = keccak256(toUtf8Bytes("corner-store.element.identity-policy.v1"));
  c.recipes[0].requiredElements[0] = id;
  c.recipes[0].identityPolicy = {track: "RFQ", kycTopology: "DIRECT"};
  Object.assign(c.elements[0], {elementId: id, parameterSchemaId: schemaId, parameterSchemaVersion: 1, maxParameterBytes: 64, parametersRequired: true});
  c.policyConfig.elementParameters = [{bindingIndex: 0, elementId: id, schemaId, schemaVersion: 1, parameters: AbiCoder.defaultAbiCoder().encode(["uint8", "uint8"], [1, 1])}];
  return c;
}

function run(c: any) {
  const dir = mkdtempSync(join(tmpdir(), "cli-topology-")); const path = join(dir, "config.json"); const out = join(dir, "plan.json");
  writeFileSync(path, JSON.stringify(c));
  return {out, result: spawnSync(process.execPath, [cli, "production-onboarding-plan", path, "--out", out], {encoding: "utf8"})};
}

test("CLI schema 7 reaches the required audit gate for explicit DIRECT", () => {
  const {out, result} = run(config());
  assert.equal(result.status, 1);
  assert.match(result.stderr, /audit artifact/i);
  assert.equal(existsSync(out), false);
});

test("CLI refuses missing MEMBER and mismatched topology before exporting calldata", () => {
  for (const mutate of [(c: any) => delete c.recipes[0].identityPolicy, (c: any) => c.recipes[0].identityPolicy.kycTopology = "MEMBER", (c: any) => c.policyConfig.elementParameters[0].parameters = AbiCoder.defaultAbiCoder().encode(["uint8", "uint8"], [1, 2])]) {
    const c = config(); mutate(c); const {out, result} = run(c);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /identityPolicy|kycTopology|DIRECT/i);
    assert.equal(existsSync(out), false);
  }
});

test("CLI onboarding help identifies schema 7 identity-policy support", () => {
  assert.match(execFileSync(process.execPath, [cli, "production-onboarding-plan", "--help"], {encoding: "utf8"}), /schema 7|schema v7/i);
});
