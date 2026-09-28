import {Address, Hex} from "./types";
export type {Address, Hex} from "./types";

export const KYC_PROVIDER_SPI_VERSION = "1.0.0";
export const KYC_PROVIDER_ID_RE = Object.freeze(/^[a-z0-9][a-z0-9._-]{0,63}$/);
export const KYC_PROVIDER_SCHEMA_VERSION_RE = Object.freeze(/^[A-Za-z0-9][A-Za-z0-9._:-]{0,63}$/);

export type ProviderAssessmentStatus = "ACTIVE" | "REVOKED" | "INELIGIBLE";
export type PositiveFactStatus = "VERIFIED" | "NOT_VERIFIED";
export type SanctionsFactStatus = "CLEAR" | "HIT";

export interface ProviderNeutralKycFacts {
  kyc: PositiveFactStatus;
  sanctions: SanctionsFactStatus;
  accreditedInvestor?: PositiveFactStatus;
  qualifiedPurchaser?: PositiveFactStatus;
  jurisdiction?: string;
}

export interface ProviderKycRequest {
  subject: Address;
  identity?: Address;
  asset: Address;
  requestRefHash: Hex;
}

export interface ProviderKycAssessment {
  providerId: string;
  providerSchemaVersion: string;
  assessmentRefHash: Hex;
  sourceEvidenceHash: Hex;
  subject: Address;
  identity?: Address;
  asset: Address;
  facts: ProviderNeutralKycFacts;
  observedAt: number;
  validUntil: number;
  status: ProviderAssessmentStatus;
}

export interface ProviderKycAdapterContext {
  signal: AbortSignal;
}

export type KycProviderEnvironment = "demo" | "production";
export type KycFactCapability = "kyc" | "sanctions" | "accreditedInvestor" | "qualifiedPurchaser" | "jurisdiction";

export interface KycProviderMetadata {
  spiVersion: string;
  providerId: string;
  providerSchemaVersions: readonly string[];
  capabilities: readonly KycFactCapability[];
  environment: KycProviderEnvironment;
}

export interface ProviderKycAdapter {
  readonly metadata: KycProviderMetadata;
  assess(request: ProviderKycRequest, context?: ProviderKycAdapterContext): Promise<ProviderKycAssessment>;
}

export type KycProviderFailureCode = "UNAVAILABLE" | "TIMEOUT" | "STALE" | "INCOMPATIBLE";

const FAILURE_CODES = new Set<unknown>(["UNAVAILABLE", "TIMEOUT", "STALE", "INCOMPATIBLE"]);
const METADATA_KEYS = new Set(["spiVersion", "providerId", "providerSchemaVersions", "capabilities", "environment"]);
const CAPABILITIES = new Set<unknown>(["kyc", "sanctions", "accreditedInvestor", "qualifiedPurchaser", "jurisdiction"]);
const ENVIRONMENTS = new Set<unknown>(["demo", "production"]);
const SEMVER_RE = /^(0|[1-9][0-9]{0,8})\.(0|[1-9][0-9]{0,8})\.(0|[1-9][0-9]{0,8})$/;
const MAX_SCHEMA_VERSIONS = 16;
const [CORE_MAJOR, CORE_MINOR] = KYC_PROVIDER_SPI_VERSION.split(".").map(Number);

export class KycProviderError extends Error {
  override readonly name = "KycProviderError";
  readonly code: KycProviderFailureCode;

  constructor(code: KycProviderFailureCode) {
    if (!FAILURE_CODES.has(code)) throw new Error("unsupported KYC provider failure code");
    super(code);
    this.code = code;
  }
}

export function isKycProviderError(value: unknown): value is KycProviderError {
  try {
    return !!value && typeof value === "object" && (value as {name?: unknown}).name === "KycProviderError" && FAILURE_CODES.has((value as {code?: unknown}).code);
  } catch {
    return false;
  }
}

export function validateKycProviderMetadata(metadata: unknown): KycProviderMetadata {
  let input: MetadataSnapshot | undefined;
  try {
    input = snapshotMetadata(metadata);
  } catch {
    throw new Error("KYC provider metadata is unreadable");
  }
  if (!input) throw new Error("KYC provider metadata must be a plain object");
  if (input.keys.length !== METADATA_KEYS.size || !input.keys.every((key) => METADATA_KEYS.has(key))) throw new Error("KYC provider metadata must have exactly the SPI fields");
  if (!isCompatibleSpiVersion(input.spiVersion)) throw new Error("KYC provider spiVersion is not compatible with this SPI");
  if (typeof input.providerId !== "string" || !KYC_PROVIDER_ID_RE.test(input.providerId)) throw new Error("KYC provider providerId must be a bounded slug");
  const schemaVersions = input.providerSchemaVersions;
  if (!schemaVersions || schemaVersions.length === 0) throw new Error(`KYC provider providerSchemaVersions must list 1 to ${MAX_SCHEMA_VERSIONS} versions`);
  if (!schemaVersions.every((version) => typeof version === "string" && KYC_PROVIDER_SCHEMA_VERSION_RE.test(version))) throw new Error("KYC provider schema versions must be bounded");
  if (new Set(schemaVersions).size !== schemaVersions.length) throw new Error("KYC provider schema versions must be unique");
  const capabilities = input.capabilities;
  if (!capabilities || !capabilities.every((capability) => CAPABILITIES.has(capability))) throw new Error("KYC provider capabilities must be known fact capabilities");
  if (new Set(capabilities).size !== capabilities.length) throw new Error("KYC provider capabilities must be unique");
  if (!capabilities.includes("kyc") || !capabilities.includes("sanctions")) throw new Error("KYC provider capabilities must include kyc and sanctions");
  if (!ENVIRONMENTS.has(input.environment)) throw new Error("KYC provider environment must be demo or production");
  return Object.freeze({
    spiVersion: input.spiVersion as string,
    providerId: input.providerId,
    providerSchemaVersions: Object.freeze([...schemaVersions] as string[]),
    capabilities: Object.freeze([...capabilities] as KycFactCapability[]),
    environment: input.environment as KycProviderEnvironment
  });
}

interface MetadataSnapshot {
  keys: string[];
  spiVersion: unknown;
  providerId: unknown;
  providerSchemaVersions: unknown[] | undefined;
  capabilities: unknown[] | undefined;
  environment: unknown;
}

function snapshotMetadata(metadata: unknown): MetadataSnapshot | undefined {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) return undefined;
  const prototype = Object.getPrototypeOf(metadata);
  if (prototype !== Object.prototype && prototype !== null) return undefined;
  const record = metadata as Record<string, unknown>;
  return {
    keys: Object.keys(record),
    spiVersion: record.spiVersion,
    providerId: record.providerId,
    providerSchemaVersions: copyBoundedArray(record.providerSchemaVersions),
    capabilities: copyBoundedArray(record.capabilities),
    environment: record.environment
  };
}

function copyBoundedArray(value: unknown): unknown[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const length = value.length;
  if (length > MAX_SCHEMA_VERSIONS) return undefined;
  const copy: unknown[] = [];
  for (let index = 0; index < length; index++) copy.push(value[index]);
  return copy;
}

function isCompatibleSpiVersion(value: unknown): boolean {
  const match = typeof value === "string" ? SEMVER_RE.exec(value) : null;
  return !!match && Number(match[1]) === CORE_MAJOR && Number(match[2]) <= CORE_MINOR;
}
