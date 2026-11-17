import assert from "node:assert/strict";
import {ZeroAddress, ZeroHash, encodeBytes32String} from "ethers";
import {complianceReporterInterface, readComplianceReport, ComplianceReportContext} from "../src/index";

export async function runComplianceReportingTests(): Promise<void> {
  const reporter = "0x0000000000000000000000000000000000000001";
  const context: ComplianceReportContext = {
    initiator: reporter, buyer: reporter, seller: ZeroAddress, tokenIn: ZeroAddress,
    tokenOut: reporter, amountIn: 1n << 100n, amountOut: 50n, venueType: 2,
    venue: ZeroAddress, flowType: 0, sellerIsAffiliate: false
  };
  const decision = [false, ZeroHash, 2n, 1000n, (1n << 256n) - 1n, reporter, 4n, ZeroHash, ZeroHash, ZeroHash, 0n, ZeroHash];
  const requirements = [
    [reporter, 0, 1, 3, 0, 0, encodeBytes32String("A-03-v1"), 2, 1, ZeroHash],
    [reporter, 1, 2, 1, 1, 9, encodeBytes32String("A-13-v1"), 1, 2, ZeroHash],
    [reporter, 2, 3, 1, 2, 0, encodeBytes32String("E-01-v1"), 0, 3, ZeroHash],
    [reporter, 3, 4, 1, 0, 0, encodeBytes32String("B-01-v1"), 2, 0, ZeroHash]
  ];
  const report = [1, 42n, 123n, false, 1, 1, decision, true, 1, requirements];
  const encoded = complianceReporterInterface.encodeFunctionResult("report", [report]);
  let calls = 0;
  const reader = {
    async call(tx: {to: string; data: string; blockTag: string | number}): Promise<string> {
      calls++;
      assert.equal(tx.to, reporter);
      assert.equal(tx.blockTag, 42);
      const decoded = complianceReporterInterface.decodeFunctionData("report", tx.data)[0];
      assert.equal(decoded.amountIn, context.amountIn);
      assert.equal(decoded.amountOut, context.amountOut);
      assert.equal(decoded.tokenOut, reporter);
      return encoded;
    }
  };
  const result = await readComplianceReport(reader, reporter, context, 42);
  assert.equal(calls, 1);
  assert.equal(result.version, 1);
  assert.equal(result.blockNumber, 42n);
  assert.equal(result.timestamp, 123n);
  assert.equal(result.complete, false);
  assert.equal(result.status, "FAIL");
  assert.equal(result.engineStatus, "FAIL");
  assert.equal(result.decision.allowed, false);
  assert.equal(result.decision.maxAmount, (1n << 256n) - 1n);
  assert.equal(result.decision.policyVersion, 2n);
  assert.equal(result.decisionRedacted, true);
  assert.equal(result.restrictedStatus, "FAIL");
  assert.deepEqual(result.requirements.map((row) => row.status), ["FAIL", "UNDETERMINED", "NOT_APPLICABLE", "PASS"]);
  assert.equal(result.requirements[1].mode, "PATH_OPTION");
  assert.equal(result.requirements[1].pathGroupId, 9);
  assert.equal(result.requirements[1].action, "OPERATOR_REVIEW");
  assert.equal(result.requirements[2].mode, "FLAG_ONLY");
  assert.equal(result.requirements[2].bindingIndex, 2);

  const hash = `0x${"ab".repeat(32)}`;
  await readComplianceReport({async call(tx) {
    assert.equal(tx.blockTag, hash);
    return encoded;
  }}, reporter, context, hash);
  for (const blockTag of ["latest", "pending", -1, Number.MAX_SAFE_INTEGER + 1]) {
    await assert.rejects(readComplianceReport(reader, reporter, context, blockTag), /explicit block/);
  }
  assert.equal(calls, 1);
  await assert.rejects(readComplianceReport(reader, "invalid", context, 42));
  await assert.rejects(readComplianceReport({async call() { throw new Error("private provider error"); }}, reporter, context, 42),
    {message: "Compliance reporter read failed"});
  await assert.rejects(readComplianceReport({async call() { return "0xdeadbeef"; }}, reporter, context, 42),
    {message: "Invalid compliance report response"});
  await assert.rejects(readComplianceReport({async call() {
    return complianceReporterInterface.encodeFunctionResult("report", [[2, ...report.slice(1)]]);
  }}, reporter, context, 42), /Unsupported compliance report version/);
  await assert.rejects(readComplianceReport({async call() {
    return complianceReporterInterface.encodeFunctionResult("report", [[...report.slice(0, 4), 4, ...report.slice(5)]]);
  }}, reporter, context, 42), /Invalid compliance report enum/);
  console.log("compliance reporting reader tests ok");
}
