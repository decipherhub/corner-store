import {mkdtempSync, readFileSync} from "fs";
import {tmpdir} from "os";
import {join} from "path";
import {defaultConfig, loadConfig, simulateConfig, validateConfig, writeDefaultConfig} from "../src/config";
import {getTemplate, validateTemplateInputs} from "../src/templates";

const dir = mkdtempSync(join(tmpdir(), "corner-store-toolkit-"));
const path = join(dir, "corner-store.config.json");
writeDefaultConfig(path);
const config = loadConfig(path);
if (config.asset.profile !== "buidl-like" || !config.venues.rfq) throw new Error("default config regression");
if (JSON.parse(readFileSync(path, "utf8")).schemaVersion !== 1) throw new Error("version missing");
validateConfig({...defaultConfig(), asset: {profile: "reg-d"}});
const simulation = simulateConfig(config, "buidl-like");
if (simulation.profile !== "buidl-like" || simulation.venues.join(",") !== "amm,rfq") throw new Error("simulation regression");
try {
  simulateConfig(config, "reg-d");
  throw new Error("profile mismatch accepted");
} catch (err: any) {
  if (!err.message.includes("conflicts")) throw err;
}
const element = getTemplate("element.attestation");
validateTemplateInputs(element, {claimTopic: 1, trustedIssuer: "issuer", expiryPolicy: "strict"});
try {
  validateTemplateInputs(element, {claimTopic: 1});
  throw new Error("incomplete template accepted");
} catch (err: any) {
  if (!err.message.includes("trustedIssuer")) throw err;
}
try {
  validateConfig({...defaultConfig(), venues: {amm: false, rfq: false, orderBook: false}});
  throw new Error("empty venues accepted");
} catch (err: any) {
  if (!err.message.includes("at least one venue")) throw err;
}
console.log("corner-store toolkit smoke ok");
