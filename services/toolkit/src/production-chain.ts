import {createHash} from "crypto";
import {AbiCoder, getCreateAddress, Interface, keccak256, toUtf8Bytes, TypedDataEncoder, zeroPadValue, toBeHex} from "ethers";
import {canonicalProductionJson, ProductionRecord} from "./production-evidence";
import {ProductionConfig} from "./production";

type ObjectValue = Record<string, any>;
export type ProductionRpc = (method: string, params: any[]) => Promise<any>;
const bytesHash = (s: string) => `sha256:${createHash("sha256").update(s).digest("hex")}`;
const equal = (a: unknown, b: unknown) => typeof a === "string" && typeof b === "string" && a.toLowerCase() === b.toLowerCase();
function requireValue(pass: boolean, detail: string): asserts pass { if (!pass) throw new Error(`production chain verification: ${detail}`); }
function quantity(value: unknown): bigint {
  requireValue(typeof value === "string" && /^(0x[0-9a-fA-F]+|[0-9]+)$/.test(value), "missing or invalid RPC quantity");
  return BigInt(value);
}

export async function verifyProductionChain(record: ProductionRecord, config: ProductionConfig, compiled: ObjectValue, rpc: ProductionRpc): Promise<void> {
  requireValue(quantity(await rpc("eth_chainId", [])) === BigInt(config.network.chainId), "RPC chain mismatch");
  const a = record.artifact as ObjectValue;
  const specs: Array<[string, string, string[]]> = [
    ["elementReg", "src/registry/ElementRegistry.sol:ElementRegistry", []],
    ["recipeReg", "src/registry/RecipeRegistry.sol:RecipeRegistry", []],
    ["policyReg", "src/registry/TokenPolicyRegistry.sol:TokenPolicyRegistry", ["recipeReg", "elementReg"]],
    ["operatorReg", "src/registry/OperatorRegistry.sol:OperatorRegistry", []],
    ["engine", "src/compliance/ComplianceEngine.sol:ComplianceEngine", ["policyReg", "elementReg", "recipeReg"]],
    ["venueReg", "src/execution/VenueRegistry.sol:VenueRegistry", []],
    ["selector", "src/execution/VenueSelector.sol:VenueSelector", []]
  ];
  if (config.venues.amm) specs.push(["ammAdapter", "src/execution/adapters/amm/UniswapV3Adapter.sol:UniswapV3Adapter", []]);
  if (config.venues.rfq) specs.push(["makerAuthorizer", "src/registry/MakerAuthorizer.sol:MakerAuthorizer", []],
    ["rfqAdapter", "src/execution/adapters/rfq/RFQAdapter.sol:RFQAdapter", ["makerAuthorizer"]]);
  specs.push(["router", "src/execution/ExecutionRouter.sol:ExecutionRouter", ["engine", "venueReg", "selector", "operatorReg"]]);
  for (const slot of ["ammAdapter", "makerAuthorizer", "rfqAdapter"]) {
    if (!specs.some(([name]) => name === slot)) requireValue(equal(a[slot], "0x0000000000000000000000000000000000000000"), `disabled ${slot} address mismatch`);
  }
  const immutableNames: Record<string, string> = {};
  function walk(value: any): void {
    if (!value || typeof value !== "object") return;
    if (value.nodeType === "VariableDeclaration" && value.mutability === "immutable") immutableNames[String(value.id)] = value.name;
    for (const child of Object.values(value)) if (Array.isArray(child)) child.forEach(walk); else if (child && typeof child === "object") walk(child);
  }
  for (const source of Object.values(compiled.sources ?? {})) walk((source as ObjectValue).ast);
  const codeHashes: Record<string, string> = {};
  const expected: Array<{to: string | null; input: string; slot?: string}> = [];
  for (const [slot, key, args] of specs) {
    const [file, name] = key.split(":");
    const contract = compiled.contracts?.[file]?.[name];
    const pinned = record.build.contracts[key];
    requireValue(Boolean(contract?.evm && pinned), `missing compiled contract ${key}`);
    const creation = contract.evm.bytecode;
    const runtime = contract.evm.deployedBytecode;
    requireValue(pinned.creationHash === bytesHash(creation.object) && pinned.runtimeHash === bytesHash(runtime.object) &&
      canonicalProductionJson(pinned.linkReferences) === canonicalProductionJson(creation.linkReferences ?? {}) &&
      canonicalProductionJson(pinned.runtimeLinkReferences) === canonicalProductionJson(runtime.linkReferences ?? {}) &&
      canonicalProductionJson(pinned.immutableReferences) === canonicalProductionJson(runtime.immutableReferences ?? {}), `compiled bytecode commitment mismatch: ${key}`);
    requireValue(Object.keys(creation.linkReferences ?? {}).length === 0 && Object.keys(runtime.linkReferences ?? {}).length === 0,
      "external linked libraries require a separate verifier");
    requireValue(/^[0-9a-fA-F]+$/.test(creation.object) && /^[0-9a-fA-F]+$/.test(runtime.object), `invalid compiled bytecode: ${key}`);
    const input = `0x${creation.object}${new Interface(contract.abi).encodeDeploy(args.map((arg) => a[arg])).slice(2)}`;
    expected.push({to: null, input, slot});
    let code: string = runtime.object.toLowerCase();
    const values: Record<string, string> = {
      ...Object.fromEntries(["policyReg", "elementReg", "recipeReg", "engine", "venueReg", "selector", "operatorReg", "makerAuthorizer"].filter((key) => typeof a[key] === "string").map((key) => [key, zeroPadValue(a[key], 32)])),
      policyRegistryCodeHash: codeHashes.policyReg,
      elementRegistryCodeHash: codeHashes.elementReg,
      recipeRegistryCodeHash: codeHashes.recipeReg,
      _CACHED_THIS: zeroPadValue(a[slot], 32),
      _CACHED_CHAIN_ID: zeroPadValue(toBeHex(config.network.chainId), 32),
      _HASHED_NAME: keccak256(toUtf8Bytes("CornerStoreRFQ")),
      _HASHED_VERSION: keccak256(toUtf8Bytes("2")),
      _TYPE_HASH: keccak256(toUtf8Bytes("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)")),
      _CACHED_DOMAIN_SEPARATOR: TypedDataEncoder.hashDomain({name: "CornerStoreRFQ", version: "2", chainId: config.network.chainId, verifyingContract: a[slot]})
    };
    for (const [id, references] of Object.entries(runtime.immutableReferences ?? {})) {
      const value = values[immutableNames[id]];
      requireValue(typeof value === "string" && /^0x[0-9a-fA-F]{64}$/.test(value), `unsupported immutable ${id}:${immutableNames[id]}`);
      for (const ref of references as Array<{start: number; length: number}>) {
        requireValue(ref.length === 32 && Number.isSafeInteger(ref.start) && ref.start >= 0 && (ref.start + ref.length) * 2 <= code.length, "invalid immutable reference");
        code = `${code.slice(0, ref.start * 2)}${value.slice(2).toLowerCase()}${code.slice((ref.start + ref.length) * 2)}`;
      }
    }
    codeHashes[slot] = keccak256(`0x${code}`);
    const liveCode = await rpc("eth_getCode", [a[slot], "latest"]);
    requireValue(equal(liveCode, `0x${code}`) && equal(a[`${slot}CodeHash`], codeHashes[slot]), `deployed runtime bytecode mismatch: ${slot}`);
  }
  const iface = new Interface(["function setRouter(address)", "function setOperator(address,bool)", "function transferOwnership(address)"]);
  for (const slot of ["engine", ...(config.venues.amm ? ["ammAdapter"] : []), ...(config.venues.rfq ? ["rfqAdapter"] : [])]) {
    expected.push({to: a[slot], input: iface.encodeFunctionData("setRouter", [a.router])});
  }
  for (const slot of ["policyReg", "operatorReg", ...(config.venues.rfq ? ["makerAuthorizer", "rfqAdapter"] : [])]) {
    expected.push({to: a[slot], input: iface.encodeFunctionData("setOperator", [config.operator, true])});
  }
  for (const slot of ["elementReg", "recipeReg", "policyReg", "operatorReg", "engine", "venueReg", "router", ...(config.venues.amm ? ["ammAdapter"] : []), ...(config.venues.rfq ? ["makerAuthorizer", "rfqAdapter"] : [])]) {
    expected.push({to: a[slot], input: iface.encodeFunctionData("transferOwnership", [config.safe.address])});
  }
  requireValue(Array.isArray(record.transactions) && record.transactions.length === expected.length && Array.isArray(record.receipts) && record.receipts.length === expected.length,
    "transaction/receipt count mismatch");
  const hashes = new Set<string>(); let previousNonce: bigint | undefined;
  for (let index = 0; index < expected.length; index++) {
    const t = record.transactions[index] as ObjectValue; const e = expected[index];
    requireValue(typeof t.hash === "string" && /^0x[0-9a-fA-F]{64}$/.test(t.hash) && !hashes.has(t.hash.toLowerCase()), "missing or duplicate transaction hash");
    hashes.add(t.hash.toLowerCase());
    const receipt = (record.receipts as ObjectValue[]).find((r) => equal(r.transactionHash, t.hash));
    const live = await rpc("eth_getTransactionByHash", [t.hash]);
    const liveReceipt = await rpc("eth_getTransactionReceipt", [t.hash]);
    requireValue(Boolean(receipt && live && liveReceipt), "transaction or receipt unavailable");
    requireValue(quantity(receipt!.status) === 1n && quantity(liveReceipt.status) === 1n, "transaction receipt failed");
    for (const field of ["transactionHash", "blockHash", "from", "to", "contractAddress", "logsBloom"]) {
      requireValue(receipt![field] === null ? liveReceipt[field] === null : equal(receipt![field], liveReceipt[field]), `receipt ${field} mismatch`);
    }
    for (const field of ["blockNumber", "transactionIndex", "gasUsed", "cumulativeGasUsed"]) requireValue(quantity(receipt![field]) === quantity(liveReceipt[field]), `receipt ${field} mismatch`);
    requireValue(canonicalProductionJson(receipt!.logs) === canonicalProductionJson(liveReceipt.logs), "receipt logs mismatch");
    for (const field of Object.keys(receipt!)) {
      if (["status", "blockNumber", "transactionIndex", "gasUsed", "cumulativeGasUsed", "effectiveGasPrice", "type", "blobGasPrice", "blobGasUsed"].includes(field)) {
        requireValue(quantity(receipt![field]) === quantity(liveReceipt[field]), `receipt ${field} mismatch`);
      } else requireValue(canonicalProductionJson(receipt![field]) === canonicalProductionJson(liveReceipt[field]), `receipt ${field} mismatch`);
    }
    const block = await rpc("eth_getBlockByNumber", [liveReceipt.blockNumber, false]);
    requireValue(Boolean(block) && equal(block.hash, liveReceipt.blockHash) && quantity(block.number) === quantity(liveReceipt.blockNumber) &&
      equal(live.hash, t.hash) && equal(live.blockHash, liveReceipt.blockHash) && quantity(live.blockNumber) === quantity(liveReceipt.blockNumber) && quantity(live.transactionIndex) === quantity(liveReceipt.transactionIndex), "noncanonical receipt block");
    const tx = t.transaction;
    requireValue(Boolean(tx) && equal(tx.from, config.deployer) && equal(live.from, config.deployer) && equal(receipt!.from, config.deployer), "transaction sender mismatch");
    requireValue((e.to === null ? tx.to == null && live.to === null && receipt!.to === null : equal(tx.to, e.to) && equal(live.to, e.to) && equal(receipt!.to, e.to)), "transaction destination mismatch");
    requireValue(equal(tx.input ?? tx.data, e.input) && equal(live.input, e.input), `transaction ${index} ${e.slot ?? "wiring"} input mismatch (recorded=${equal(tx.input ?? tx.data, e.input)}, rpc=${equal(live.input, e.input)})`);
    requireValue(quantity(tx.chainId) === BigInt(config.network.chainId) && quantity(live.chainId) === BigInt(config.network.chainId), "transaction chain mismatch");
    requireValue(quantity(tx.value) === 0n && quantity(live.value) === 0n, "unexpected transaction value");
    for (const field of Object.keys(tx)) {
      if (["from", "to", "input", "data"].includes(field)) continue;
      if (["chainId", "nonce", "value", "gas", "gasPrice", "type", "maxFeePerGas", "maxPriorityFeePerGas", "maxFeePerBlobGas"].includes(field)) {
        requireValue(quantity(tx[field]) === quantity(live[field]), `transaction ${field} mismatch`);
      } else {
        requireValue(["accessList", "blobVersionedHashes", "authorizationList"].includes(field) && canonicalProductionJson(tx[field]) === canonicalProductionJson(live[field]), `unsupported or mismatched transaction ${field}`);
      }
    }
    const nonce = quantity(live.nonce);
    requireValue(quantity(tx.nonce) === nonce && (previousNonce === undefined || nonce === previousNonce + 1n), "transaction nonce mismatch");
    previousNonce = nonce;
    if (e.slot) {
      const created = getCreateAddress({from: config.deployer, nonce});
      requireValue(t.transactionType === "CREATE" && equal(t.contractAddress, created) && equal(a[e.slot], created) && equal(receipt!.contractAddress, created), `receipt-derived address mismatch: ${e.slot}`);
    } else requireValue(t.transactionType === "CALL" && receipt!.contractAddress === null, "unexpected contract creation");
  }
}
