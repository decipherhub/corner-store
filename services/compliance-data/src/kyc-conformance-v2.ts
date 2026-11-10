import {InMemoryKycEvidenceStoreV2, KycEvidenceCoordinatorV2, KycRefreshReasonV2, KycRefreshResultV2} from "./kyc-v2";
import {KycProviderEnvironment, KycProviderMetadata} from "./kyc-spi";
import {ProviderKycAdapterV2, ProviderKycRequestV2, validateKycProviderMetadataV2} from "./kyc-spi-v2";
import {KycCommitmentsV2} from "./kyc-hmac-v2";

export interface KycProviderConformanceFixtureV2 {
  commitments: KycCommitmentsV2;
  eligibleRequest: ProviderKycRequestV2;
  ineligibleRequest: ProviderKycRequestV2;
  now?: () => number;
  freshnessSeconds?: number;
  providerTimeoutMs?: number;
}

export interface KycProviderConformanceCheckV2 {
  name: string;
  pass: boolean;
  detail: string;
}

export interface KycProviderConformanceReportV2 {
  schemaVersion: 2;
  passed: boolean;
  checks: KycProviderConformanceCheckV2[];
}

const NEGATIVE_DECISIONS = new Set<KycRefreshReasonV2>(["KYC_NOT_VERIFIED", "SANCTIONS_HIT", "INELIGIBLE", "REVOKED"]);
const DEFAULT_ABORT_CHECK_TIMEOUT_MS = 2_000;

export async function runKycProviderConformanceV2(
  adapter: ProviderKycAdapterV2,
  fixture: KycProviderConformanceFixtureV2
): Promise<KycProviderConformanceReportV2> {
  const checks: KycProviderConformanceCheckV2[] = [];
  let metadata: KycProviderMetadata;
  try {
    metadata = validateKycProviderMetadataV2(readMetadata(adapter));
    checks.push(pass("metadata-contract", "metadata satisfies the KYC provider SPI"));
  } catch (error) {
    checks.push(fail("metadata-contract", error instanceof Error ? error.message : "KYC provider metadata is invalid"));
    return report(checks);
  }

  const ownEnvironment = builds(adapter, metadata.environment, fixture.commitments);
  const productionAccepted = builds(adapter, "production", fixture.commitments);
  checks.push(ownEnvironment && productionAccepted === (metadata.environment === "production")
    ? pass("environment-guard", metadata.environment === "production" ? "production adapter is accepted in production mode" : "demo adapter is refused in production mode")
    : fail("environment-guard", ownEnvironment ? "production mode did not enforce the declared environment" : "coordinator refused the adapter in its declared environment"));

  const eligible = await refresh(adapter, metadata.environment, fixture, fixture.eligibleRequest);
  if (!eligible) {
    checks.push(fail("eligible-evidence", "coordinator could not run the eligible refresh"));
  } else if (!eligible.eligible) {
    checks.push(fail("eligible-evidence", `eligible request failed closed with ${eligible.reason}`));
  } else {
    checks.push(eligible.materialization.providerId === metadata.providerId && metadata.providerSchemaVersions.includes(eligible.materialization.providerSchemaVersion)
      ? pass("eligible-evidence", "eligible request produced evidence under the declared provider and schema")
      : fail("eligible-evidence", "eligible evidence does not match the declared provider or schema"));
  }

  const ineligible = await refresh(adapter, metadata.environment, fixture, fixture.ineligibleRequest);
  if (!ineligible) {
    checks.push(fail("fail-closed-evidence", "coordinator could not run the ineligible refresh"));
  } else if (ineligible.eligible) {
    checks.push(fail("fail-closed-evidence", "ineligible request was reported eligible"));
  } else {
    checks.push(NEGATIVE_DECISIONS.has(ineligible.reason)
      ? pass("fail-closed-evidence", `ineligible request produced a well-formed ${ineligible.reason} decision`)
      : fail("fail-closed-evidence", `ineligible request failed with ${ineligible.reason} instead of a provider decision`));
  }

  checks.push(await checkAbortSignal(adapter, fixture));

  return report(checks);
}

function readMetadata(adapter: ProviderKycAdapterV2): unknown {
  try {
    return adapter.metadata;
  } catch {
    throw new Error("KYC provider metadata is unreadable");
  }
}

function builds(adapter: ProviderKycAdapterV2, mode: KycProviderEnvironment, commitments: KycCommitmentsV2): boolean {
  try {
    new KycEvidenceCoordinatorV2(adapter, new InMemoryKycEvidenceStoreV2(commitments), {mode, commitments});
    return true;
  } catch {
    return false;
  }
}

async function refresh(
  adapter: ProviderKycAdapterV2,
  mode: KycProviderEnvironment,
  fixture: KycProviderConformanceFixtureV2,
  request: ProviderKycRequestV2
): Promise<KycRefreshResultV2 | undefined> {
  try {
    const coordinator = new KycEvidenceCoordinatorV2(adapter, new InMemoryKycEvidenceStoreV2(fixture.commitments), {
      commitments: fixture.commitments,
      accept: async () => true,
      mode,
      now: fixture.now,
      freshnessSeconds: fixture.freshnessSeconds,
      providerTimeoutMs: fixture.providerTimeoutMs,
      strictAudit: true,
      audit: () => undefined
    });
    return await coordinator.refresh(request);
  } catch {
    return undefined;
  }
}

async function checkAbortSignal(adapter: ProviderKycAdapterV2, fixture: KycProviderConformanceFixtureV2): Promise<KycProviderConformanceCheckV2> {
  const controller = new AbortController();
  controller.abort();
  const timeoutMs = fixture.providerTimeoutMs ?? DEFAULT_ABORT_CHECK_TIMEOUT_MS;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const settled = new Promise<"resolved" | "rejected">((resolve) => {
    try {
      Promise.resolve(adapter.assess(fixture.eligibleRequest, {signal: controller.signal})).then(() => resolve("resolved"), () => resolve("rejected"));
    } catch {
      resolve("rejected");
    }
  });
  const timedOut = new Promise<"timed-out">((resolve) => {
    timer = setTimeout(() => resolve("timed-out"), timeoutMs);
  });
  try {
    const outcome = await Promise.race([settled, timedOut]);
    if (outcome === "rejected") return pass("abort-signal", "adapter rejected an already-aborted assess call");
    return fail("abort-signal", outcome === "resolved" ? "adapter resolved an already-aborted assess call" : "adapter did not reject an already-aborted assess call in time");
  } finally {
    if (timer !== undefined) clearTimeout(timer);
  }
}

function pass(name: string, detail: string): KycProviderConformanceCheckV2 {
  return {name, pass: true, detail};
}

function fail(name: string, detail: string): KycProviderConformanceCheckV2 {
  return {name, pass: false, detail};
}

function report(checks: KycProviderConformanceCheckV2[]): KycProviderConformanceReportV2 {
  return {schemaVersion: 2, passed: checks.every((check) => check.pass), checks};
}
