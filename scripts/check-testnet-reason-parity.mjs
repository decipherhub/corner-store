#!/usr/bin/env node

import {createRequire} from "node:module";

const require = createRequire(import.meta.url);
const cli = require("../services/cli/dist/cli/src/reason.js");
const demo = require("../services/testnet-rfq-demo/dist/testnet-rfq-demo/src/explain.js");

const catalog = [
  ["A-13-v1", 9],
  ["C-01-v2", 4],
  ["MIN-AMOUNT-v1", 1],
  ["B-02-v2", 6],
  ["A-04-v1", 9]
];

for (const [elementId, maximumCode] of catalog) {
  for (let codeNumber = 1; codeNumber <= maximumCode; codeNumber += 1) {
    const reasonCode = cli.encodeReason(0, elementId, codeNumber);
    const demoName = demo.reasonName(reasonCode);
    const cliLabel = cli.decodeReason(reasonCode).label;
    if (!demoName || !cliLabel.includes(demoName)) {
      throw new Error(
        `reason catalog mismatch for ${elementId}/${codeNumber}: demo=${demoName ?? "missing"}, cli=${cliLabel}`
      );
    }
  }
}

const suspendedCode = cli.encodeReason(0, "POLICY", 3);
if (demo.reasonName(suspendedCode) !== "MANIFEST_SUSPENDED") {
  throw new Error("testnet demo is missing the POLICY/SUSPENDED reason mapping");
}
if (!cli.decodeReason(suspendedCode).label.includes("SUSPENDED")) {
  throw new Error("CLI is missing the POLICY/SUSPENDED reason mapping");
}

console.log("testnet/CLI reason catalog parity ok");
