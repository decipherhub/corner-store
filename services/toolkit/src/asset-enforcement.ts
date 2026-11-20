import {AbiCoder, encodeBytes32String, keccak256, toUtf8Bytes} from "ethers";

export const ASSET_ENFORCEMENT_ELEMENT_ID = encodeBytes32String("B-02-v3");
export const ASSET_ENFORCEMENT_SCHEMA_ID = keccak256(toUtf8Bytes("corner-store.element.asset-enforcement.v1"));
export const ASSET_ENFORCEMENT_SCHEMA_VERSION = 1;
export const ASSET_ENFORCEMENT_PARAMETER_BYTES = 128;

export interface AssetEnforcementBindingInput {
  bindingIndex: number;
  elementId: string;
  adapter: string;
  interfaceVersion: number;
  runtimeCodeHash: string;
  bindingDigest: string;
  referenceOnly: boolean;
}

const coder = AbiCoder.defaultAbiCoder();

export function encodeAssetEnforcementParameters(input: Pick<AssetEnforcementBindingInput, "adapter" | "interfaceVersion" | "runtimeCodeHash" | "bindingDigest">): string {
  return coder.encode(
    ["address", "uint16", "bytes32", "bytes32"],
    [input.adapter, input.interfaceVersion, input.runtimeCodeHash, input.bindingDigest]
  );
}

export function decodeAssetEnforcementParameters(parameters: string): Omit<AssetEnforcementBindingInput, "bindingIndex" | "elementId" | "referenceOnly"> {
  if (!/^0x[0-9a-fA-F]{256}$/.test(parameters)) throw new Error("asset enforcement parameters must be canonical 128-byte ABI data");
  const decoded = coder.decode(["address", "uint16", "bytes32", "bytes32"], parameters);
  const canonical = coder.encode(["address", "uint16", "bytes32", "bytes32"], decoded);
  if (canonical.toLowerCase() !== parameters.toLowerCase()) throw new Error("asset enforcement parameters must use canonical ABI encoding");
  return {
    adapter: String(decoded[0]),
    interfaceVersion: Number(decoded[1]),
    runtimeCodeHash: String(decoded[2]),
    bindingDigest: String(decoded[3])
  };
}

