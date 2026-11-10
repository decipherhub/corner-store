import assert from "node:assert/strict";
import {spawn} from "node:child_process";
import {readFileSync} from "node:fs";
import {createServer} from "node:net";
import {resolve} from "node:path";
import {setTimeout} from "node:timers/promises";
import {ContractFactory, Interface, JsonRpcProvider, ZeroAddress, encodeBytes32String} from "ethers";
import {ComplianceReportContext, complianceReporterInterface, readComplianceReport} from "../src/index";

async function main(): Promise<void> {
  const server = createServer();
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const port = (server.address() as {port: number}).port;
  await new Promise<void>((resolve) => server.close(() => resolve()));
  const anvil = spawn("anvil", ["--host", "127.0.0.1", "--port", String(port), "--silent"], {stdio: "ignore"});
  let startupError: Error | undefined;
  anvil.on("error", (error) => { startupError = error; });
  const provider = new JsonRpcProvider(`http://127.0.0.1:${port}`, 31337, {staticNetwork: true});
  try {
    let ready = false;
    for (let attempt = 0; attempt < 50; attempt++) {
      if (startupError) throw new Error("Anvil unavailable for reporting runtime test");
      try {
        await provider.send("eth_chainId", []);
        ready = true;
        break;
      } catch {
        await setTimeout(100);
      }
    }
    assert.ok(ready, "Anvil startup timed out");
    const signer = await provider.getSigner(0);
    const artifact = (file: string, symbol: string) => JSON.parse(readFileSync(
      resolve(__dirname, "../../../../out", file, `${symbol}.json`), "utf8"
    ));
    const deploy = async (file: string, symbol: string, args: unknown[] = []) => {
      const compiled = artifact(file, symbol);
      const contract = await new ContractFactory(compiled.abi, compiled.bytecode.object, signer).deploy(...args);
      await contract.waitForDeployment();
      return contract;
    };
    const elementReg = await deploy("ElementRegistry.sol", "ElementRegistry");
    const recipeReg = await deploy("RecipeRegistry.sol", "RecipeRegistry");
    const policyReg = await deploy("TokenPolicyRegistry.sol", "TokenPolicyRegistry", [await recipeReg.getAddress(), await elementReg.getAddress()]);
    const engine = await deploy("ComplianceEngine.sol", "ComplianceEngine", [await policyReg.getAddress(), await elementReg.getAddress(), await recipeReg.getAddress()]);
    const reporter = await deploy("ComplianceReporter.sol", "ComplianceReporter", [await engine.getAddress()]);
    const compiledReport = new Interface(artifact("ComplianceReporter.sol", "ComplianceReporter").abi).getFunction("report")!;
    const sdkReport = complianceReporterInterface.getFunction("report")!;
    assert.equal(compiledReport.format("sighash"), sdkReport.format("sighash"));
    assert.equal(compiledReport.outputs[0].format("sighash"), sdkReport.outputs[0].format("sighash"));
    const tokenIn = "0x0000000000000000000000000000000000001000";
    const tokenOut = "0x0000000000000000000000000000000000002000";
    const ctx: ComplianceReportContext = {
      initiator: ZeroAddress, buyer: ZeroAddress, seller: ZeroAddress, tokenIn, tokenOut,
      amountIn: 1n, amountOut: 20n, venueType: 2, venue: ZeroAddress, flowType: 0, sellerIsAffiliate: false
    };
    const blockNumber = async () => Number(await provider.send("eth_blockNumber", []));
    const denied = await readComplianceReport(provider, await reporter.getAddress(), ctx, await blockNumber());
    assert.equal(denied.engineStatus, "FAIL");
    await (await policyReg.getFunction("setUnregulated")(tokenIn)).wait();
    await (await policyReg.getFunction("setUnregulated")(tokenOut)).wait();
    const allowed = await readComplianceReport(provider, await reporter.getAddress(), ctx, await blockNumber());
    assert.equal(allowed.status, "PASS");
    assert.equal(allowed.complete, true);
    assert.equal(allowed.decision.allowed, true);

    const publicId = encodeBytes32String("A-03-v1");
    const restrictedId = encodeBytes32String("A-01-v1");
    const first = await deploy("Reporter.t.sol", "ReporterElement", [publicId, 2]);
    const restricted = await deploy("Reporter.t.sol", "ReporterElement", [restrictedId, 2]);
    await (await elementReg.getFunction("registerElement(bytes32,address)")(publicId, await first.getAddress())).wait();
    await (await elementReg.getFunction("registerElement(bytes32,address)")(restrictedId, await restricted.getAddress())).wait();
    const recipe = await deploy("Reporter.t.sol", "ReporterRecipe", [1, [publicId, restrictedId]]);
    await (await recipeReg.getFunction("registerRecipe(uint16,uint16,address)")(1, 1, await recipe.getAddress())).wait();
    await (await policyReg.getFunction("clearUnregulated")(tokenOut)).wait();
    const register = policyReg.getFunction("registerManifest(address,(uint8,uint16,uint16,uint16,uint32,uint8,uint16,uint256,uint256,bytes32,address,address),(uint16,uint16,uint8,uint16,uint8)[])");
    await (await register(tokenOut, [2, 0, 0, 0, 0, 4, 0, 0, 0, encodeBytes32String("MANIFEST"), ZeroAddress, ZeroAddress], [[1, 1, 0, 0, 100]])).wait();
    await (await policyReg.getFunction("approveManifest")(tokenOut)).wait();
    await (await first.getFunction("setOutcome")(tokenOut, 1)).wait();
    await (await restricted.getFunction("setOutcome")(tokenOut, 1)).wait();
    const block = await blockNumber();
    const failures = await readComplianceReport(provider, await reporter.getAddress(), ctx, block);
    assert.equal(failures.blockNumber, BigInt(block));
    assert.equal(failures.status, "FAIL");
    assert.equal(failures.complete, true);
    assert.equal(failures.engineStatus, "FAIL");
    assert.equal(failures.requirements.length, 1);
    assert.equal(failures.requirements[0].status, "FAIL");
    assert.equal(failures.restrictedStatus, "FAIL");
    assert.equal(failures.decisionRedacted, true);
    const authoritative = await engine.getFunction("evaluate")(ctx, {blockTag: block});
    assert.equal(failures.decision.allowed, authoritative.allowed);
    assert.equal(failures.decision.policyId, authoritative.policyId);
    const historical = await readComplianceReport(provider, await reporter.getAddress(), ctx, Number(allowed.blockNumber));
    assert.equal(historical.status, "PASS");
    console.log("reporting Anvil runtime ok: unknown, unregulated, public/restricted failures, historical snapshot");
  } finally {
    provider.destroy();
    anvil.kill("SIGTERM");
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
