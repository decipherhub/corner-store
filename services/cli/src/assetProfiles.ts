import {AbiCoder, keccak256, parseEther, toUtf8Bytes} from "ethers";

import {CliError} from "./util";

export type AssetProfile = "buidl-like" | "reg-d";

export interface AssetProfileBinding {
  profile: AssetProfile;
  fundRecipeId: number;
  factsPacked: bigint;
  fullManifestHash: string;
}

const ZERO32 = "0x0000000000000000000000000000000000000000000000000000000000000000";
const PROFILE_KEY = keccak256(toUtf8Bytes("CORNER_STORE.PROFILE.BUIDL_LIKE_DEMO_V1"));
const SECURITIZE_DS_ADAPTER_SEAM = keccak256(toUtf8Bytes("CORNER_STORE.ADAPTER.SECURITIZE_DS_PROTOCOL"));

// Must remain byte-for-byte equivalent to BuidlLikeDemoAsset.manifest().
export const BUIDL_LIKE_MANIFEST_HASH = keccak256(
  AbiCoder.defaultAbiCoder().encode(
    ["bytes32", "bytes32", "uint256", "uint256", "uint256"],
    [PROFILE_KEY, SECURITIZE_DS_ADAPTER_SEAM, 1001n, 1002n, parseEther("5000000")]
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
      fundRecipeId: 3,
      factsPacked: 1n,
      fullManifestHash: BUIDL_LIKE_MANIFEST_HASH
    };
  }
  return {profile, fundRecipeId: 0, factsPacked: 0n, fullManifestHash: ZERO32};
}
