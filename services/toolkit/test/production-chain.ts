import assert from "node:assert/strict";
import {createHash} from "node:crypto";
import {test} from "node:test";
import {AbiCoder, getCreateAddress, Interface, keccak256} from "ethers";
import {verifyProductionChain} from "../src/production-chain";
import {ProductionRecord} from "../src/production-evidence";
import {ProductionConfig} from "../src/production";

const address = (n: number) => `0x${n.toString(16).padStart(40, "0")}`;
const hash = (n: number) => `0x${n.toString(16).padStart(64, "0")}`;
const bytesHash = (s: string) => `sha256:${createHash("sha256").update(s).digest("hex")}`;
function fixture() {
  const config = {network: {chainId: 31337}, deployer: address(1), operator: address(2), safe: {address: address(3)}, venues: {amm: true, rfq: true}} as ProductionConfig;
  const specs: Array<[string, string, string[]]> = [
    ["elementReg", "src/registry/ElementRegistry.sol:ElementRegistry", []],
    ["recipeReg", "src/registry/RecipeRegistry.sol:RecipeRegistry", []],
    ["policyReg", "src/registry/TokenPolicyRegistry.sol:TokenPolicyRegistry", ["recipeReg", "elementReg"]],
    ["operatorReg", "src/registry/OperatorRegistry.sol:OperatorRegistry", []],
    ["engine", "src/compliance/ComplianceEngine.sol:ComplianceEngine", ["policyReg", "elementReg", "recipeReg"]],
    ["venueReg", "src/execution/VenueRegistry.sol:VenueRegistry", []],
    ["selector", "src/execution/VenueSelector.sol:VenueSelector", []],
    ["ammAdapter", "src/execution/adapters/amm/UniswapV3Adapter.sol:UniswapV3Adapter", []],
    ["makerAuthorizer", "src/registry/MakerAuthorizer.sol:MakerAuthorizer", []],
    ["rfqAdapter", "src/execution/adapters/rfq/RFQAdapter.sol:RFQAdapter", ["makerAuthorizer"]],
    ["router", "src/execution/ExecutionRouter.sol:ExecutionRouter", ["engine", "venueReg", "selector", "operatorReg"]]
  ];
  const artifact: Record<string, any> = {}; const contracts: Record<string, any> = {}; const compiled: any = {contracts: {}, sources: {}};
  const transactions: any[] = []; const receipts: any[] = []; const codes: Record<string, string> = {};
  const iface = new Interface(["function setRouter(address)", "function setOperator(address,bool)", "function transferOwnership(address)"]);
  function tx(to: string | null, input: string, created: string | null) {
    const nonce = transactions.length; const h = hash(nonce + 1);
    transactions.push({hash: h, transactionType: created ? "CREATE" : "CALL", contractAddress: created ?? to,
      transaction: {from: config.deployer, to, input, nonce: `0x${nonce.toString(16)}`, chainId: "0x7a69", value: "0x0", gas: "0x100000"}});
    receipts.push({transactionHash: h, blockHash: hash(100), blockNumber: "0x1", transactionIndex: `0x${nonce.toString(16)}`,
      from: config.deployer, to, contractAddress: created, status: "0x1", effectiveGasPrice: "0x10", gasUsed: "0x100", cumulativeGasUsed: "0x100", logs: [], logsBloom: `0x${"00".repeat(256)}`});
  }
  for (const [slot, key, args] of specs) {
    const a = getCreateAddress({from: config.deployer, nonce: transactions.length}); artifact[slot] = a;
    const creation = "60006000"; const runtime = "60006001";
    const [file, name] = key.split(":");
    compiled.contracts[file] ??= {};
    compiled.contracts[file][name] = {abi: [`constructor(${args.map(() => "address").join(",")})`],
      evm: {bytecode: {object: creation, linkReferences: {}}, deployedBytecode: {object: runtime, linkReferences: {}, immutableReferences: {}}}};
    contracts[key] = {creationHash: bytesHash(creation), runtimeHash: bytesHash(runtime), linkReferences: {}, runtimeLinkReferences: {}, immutableReferences: {}};
    artifact[`${slot}CodeHash`] = keccak256(`0x${runtime}`); codes[a.toLowerCase()] = `0x${runtime}`;
    tx(null, `0x${creation}${AbiCoder.defaultAbiCoder().encode(args.map(() => "address"), args.map((arg) => artifact[arg])).slice(2)}`, a);
  }
  for (const slot of ["engine", "ammAdapter", "rfqAdapter"]) tx(artifact[slot], iface.encodeFunctionData("setRouter", [artifact.router]), null);
  for (const slot of ["policyReg", "operatorReg", "makerAuthorizer", "rfqAdapter"]) tx(artifact[slot], iface.encodeFunctionData("setOperator", [config.operator, true]), null);
  for (const slot of ["elementReg", "recipeReg", "policyReg", "operatorReg", "engine", "venueReg", "router", "ammAdapter", "makerAuthorizer", "rfqAdapter"]) tx(artifact[slot], iface.encodeFunctionData("transferOwnership", [config.safe.address]), null);
  const record = {artifact, transactions, receipts, build: {contracts}} as unknown as ProductionRecord;
  const liveTransactions = structuredClone(transactions); const liveReceipts = structuredClone(receipts);
  const rpc = async (method: string, args: any[]) => {
    if (method === "eth_chainId") return "0x7a69";
    if (method === "eth_getTransactionByHash") {
      const t = liveTransactions.find((t: any) => t.hash === args[0]);
      const r = liveReceipts.find((r: any) => r.transactionHash === args[0]);
      return t ? {...t.transaction, hash: t.hash, blockHash: r.blockHash, blockNumber: r.blockNumber, transactionIndex: r.transactionIndex} : null;
    }
    if (method === "eth_getTransactionReceipt") return liveReceipts.find((r: any) => r.transactionHash === args[0]) ?? null;
    if (method === "eth_getBlockByNumber") return {hash: hash(100), number: "0x1"};
    if (method === "eth_getCode") return codes[args[0].toLowerCase()] ?? "0x";
    throw Error(`unexpected RPC ${method}`);
  };
  return {record, config, compiled, rpc, liveTransactions, liveReceipts, codes};
}

test("chain verification binds every creation, constructor argument, wiring call and successful receipt", async () => {
  const f = fixture(); await verifyProductionChain(f.record, f.config, f.compiled, f.rpc);
  assert.equal(f.record.transactions.length, 28);
});

test("receipt status, chain, transaction data, sender, nonce, address, block and code tampering fail closed", async () => {
  for (const mutate of [
    (f: ReturnType<typeof fixture>) => { f.liveReceipts[0].status = "0x0"; },
    (f: ReturnType<typeof fixture>) => { f.liveTransactions[0].transaction.chainId = "0x1"; },
    (f: ReturnType<typeof fixture>) => { f.liveTransactions[0].transaction.input = "0x1234"; },
    (f: ReturnType<typeof fixture>) => { f.liveTransactions[0].transaction.from = address(10); },
    (f: ReturnType<typeof fixture>) => { f.liveTransactions[1].transaction.nonce = "0x0"; },
    (f: ReturnType<typeof fixture>) => { f.record.artifact.router = address(20); },
    (f: ReturnType<typeof fixture>) => { f.liveReceipts[0].blockHash = hash(101); },
    (f: ReturnType<typeof fixture>) => { f.codes[String(f.record.artifact.router).toLowerCase()] = "0x60006002"; },
    (f: ReturnType<typeof fixture>) => { (f.record.receipts[0] as any).effectiveGasPrice = "0x11"; },
    (f: ReturnType<typeof fixture>) => { (f.record.transactions[0] as any).transaction.gas = "0x1"; },
    (f: ReturnType<typeof fixture>) => { const txs = f.record.transactions as any[]; [txs[0].hash, txs[11].hash] = [txs[11].hash, txs[0].hash]; },
    (f: ReturnType<typeof fixture>) => { f.record.receipts.pop(); },
    (f: ReturnType<typeof fixture>) => { f.record.transactions.push(f.record.transactions[0]); },
    (f: ReturnType<typeof fixture>) => { (f.record.transactions[11] as any).transaction.input = "0x"; },
    (f: ReturnType<typeof fixture>) => { f.record.build.contracts[Object.keys(f.record.build.contracts)[0]].creationHash = "sha256:bad"; }
  ]) {
    const f = fixture(); mutate(f);
    await assert.rejects(verifyProductionChain(f.record, f.config, f.compiled, f.rpc));
  }
});

test("unavailable receipts, RPC failures and incorrect RPC chain never verify", async () => {
  for (const method of ["eth_getTransactionReceipt", "eth_getTransactionByHash", "eth_getBlockByNumber", "eth_getCode", "eth_chainId"]) {
    const f = fixture();
    await assert.rejects(verifyProductionChain(f.record, f.config, f.compiled, async (m, args) => m === method ? null : f.rpc(m, args)));
    await assert.rejects(verifyProductionChain(f.record, f.config, f.compiled, async () => { throw Error("RPC unavailable"); }));
  }
  const f = fixture();
  await assert.rejects(verifyProductionChain(f.record, f.config, f.compiled, async (m, args) => m === "eth_chainId" ? "0x1" : f.rpc(m, args)));
});

test("immutable values are reconstructed from compiler references and trusted wiring", async () => {
  const f = fixture();
  const key = "src/registry/TokenPolicyRegistry.sol:TokenPolicyRegistry";
  const c = f.compiled.contracts[key.split(":")[0]].TokenPolicyRegistry;
  c.evm.deployedBytecode.object = `6000${"00".repeat(32)}6001`;
  c.evm.deployedBytecode.immutableReferences = {"77": [{start: 2, length: 32}]};
  f.compiled.sources["test"] = {ast: {nodes: [{nodeType: "VariableDeclaration", id: 77, mutability: "immutable", name: "recipeReg"}]}};
  f.record.build.contracts[key].runtimeHash = bytesHash(c.evm.deployedBytecode.object);
  f.record.build.contracts[key].immutableReferences = c.evm.deployedBytecode.immutableReferences;
  const runtime = `0x6000${String(f.record.artifact.recipeReg).slice(2).toLowerCase().padStart(64, "0")}6001`;
  f.codes[String(f.record.artifact.policyReg).toLowerCase()] = runtime;
  f.record.artifact.policyRegCodeHash = keccak256(runtime);
  await verifyProductionChain(f.record, f.config, f.compiled, f.rpc);
  f.codes[String(f.record.artifact.policyReg).toLowerCase()] = `0x6000${"11".repeat(32)}6001`;
  f.record.artifact.policyRegCodeHash = keccak256(f.codes[String(f.record.artifact.policyReg).toLowerCase()]);
  await assert.rejects(verifyProductionChain(f.record, f.config, f.compiled, f.rpc), /bytecode|runtime/);
});
