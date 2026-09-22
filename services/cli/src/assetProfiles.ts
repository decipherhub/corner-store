import {AbiCoder, keccak256, parseEther, toUtf8Bytes} from "ethers";

import {CliError} from "./util";

export type AssetProfile = "buidl-like" | "reg-d";

export type RecipeBindingTuple = [recipeId: number, recipeVersion: number, mode: number, pathGroupId: number, priority: number];
export type ElementPolicyParameterTuple = [bindingIndex: number, elementId: string, schemaId: string, schemaVersion: number, parameters: string];
export type ManifestPolicyConfigTuple = [schemaVersion: number, elementParameters: ElementPolicyParameterTuple[]];

export interface AssetProfileBinding {
  profile: AssetProfile;
  bindings: RecipeBindingTuple[];
  factsPacked: bigint;
  fullManifestHash: string;
  policyConfig?: ManifestPolicyConfigTuple;
}

const ZERO32 = "0x0000000000000000000000000000000000000000000000000000000000000000";
const PROFILE_KEY = keccak256(toUtf8Bytes("CORNER_STORE.PROFILE.BUIDL_LIKE_DEMO_V2"));
const SECURITIZE_DS_ADAPTER_SEAM = keccak256(toUtf8Bytes("CORNER_STORE.ADAPTER.SECURITIZE_DS_PROTOCOL"));
const MINIMUM_AMOUNT_ELEMENT_ID = "0x4d494e2d414d4f554e542d763100000000000000000000000000000000000000";
const MINIMUM_AMOUNT_SCHEMA_ID = keccak256(toUtf8Bytes("corner-store.element.minimum-trade-amount.v1"));
export const BUIDL_LIKE_DEMO_MINIMUM_TRADE_AMOUNT = parseEther("5000000");

// Must remain byte-for-byte equivalent to BuidlLikeDemoAsset.manifest().
export const BUIDL_LIKE_MANIFEST_HASH = keccak256(
  AbiCoder.defaultAbiCoder().encode(
    ["bytes32", "bytes32", "uint256", "uint256", "uint256"],
    [PROFILE_KEY, SECURITIZE_DS_ADAPTER_SEAM, 1001n, 1002n, BUIDL_LIKE_DEMO_MINIMUM_TRADE_AMOUNT]
  )
);

export function resolveAssetProfile(value?: string): AssetProfile {
  const profile = value ?? "buidl-like";
  if (profile !== "buidl-like" && profile !== "reg-d") {
    throw new CliError(`unknown asset profile "${profile}" (expected buidl-like or reg-d)`);
  }
  return profile;
}

export function resolveAssetProfileForArtifact(requested?: string, artifactProfile?: string): AssetProfile {
  const deployed = artifactProfile === undefined ? undefined : resolveAssetProfile(artifactProfile);
  const selected = requested === undefined ? undefined : resolveAssetProfile(requested);
  if (deployed !== undefined && selected !== undefined && deployed !== selected) {
    throw new CliError(
      `asset profile "${selected}" conflicts with deployment artifact profile "${deployed}"; select the asset at deployment time`
    );
  }
  return deployed ?? selected ?? "buidl-like";
}

export function assetProfileBinding(value?: string): AssetProfileBinding {
  const profile = resolveAssetProfile(value);
  if (profile === "buidl-like") {
    return {
      profile,
      bindings: [
        [1, 2, 0, 0, 100],
        [3, 2, 0, 0, 90]
      ],
      factsPacked: 1n,
      fullManifestHash: BUIDL_LIKE_MANIFEST_HASH,
      policyConfig: [
        1,
        [[1, MINIMUM_AMOUNT_ELEMENT_ID, MINIMUM_AMOUNT_SCHEMA_ID, 1, AbiCoder.defaultAbiCoder().encode(["uint256"], [BUIDL_LIKE_DEMO_MINIMUM_TRADE_AMOUNT])]]
      ]
    };
  }
  return {profile, bindings: [[1, 2, 0, 0, 100]], factsPacked: 0n, fullManifestHash: ZERO32};
}
