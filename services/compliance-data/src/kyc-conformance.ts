import {InMemoryKycEvidenceStore, KycEvidenceCoordinator, KycRefreshReason, KycRefreshResult} from "./kyc";
import {KycProviderEnvironment, KycProviderMetadata, ProviderKycAdapter, ProviderKycRequest, validateKycProviderMetadata} from "./kyc-spi";

export interface KycProviderConformanceFixture {
  eligibleRequest: ProviderKycRequest;
  ineligibleRequest: ProviderKycRequest;
  now?: () => number;
  freshnessSeconds?: number;
  providerTimeoutMs?: number;
}

export interface KycProviderConformanceCheck {
  name: string;
  pass: boolean;
  detail: string;
}

export interface KycProviderConformanceReport {
  schemaVersion: 1;
  passed: boolean;
  checks: KycProviderConformanceCheck[];
}

const NEGATIVE_DECISIONS = new Set<KycRefreshReason>(["KYC_NOT_VERIFIED", "SANCTIONS_HIT", "INELIGIBLE", "REVOKED"]);
const DEFAULT_ABORT_CHECK_TIMEOUT_MS = 2_000;

export async function runKycProviderConformance(
  adapter: ProviderKycAdapter,
  fixture: KycProviderConformanceFixture
): Promise<KycProviderConformanceReport> {
  const checks: KycProviderConformanceCheck[] = [];
  let metadata: KycProviderMetadata;
  try {
    metadata = validateKycProviderMetadata(readMetadata(adapter));
    checks.push(pass("metadata-contract", "metadata satisfies the KYC provider SPI"));
  } catch (error) {
    checks.push(fail("metadata-contract", error instanceof Error ? error.message : "KYC provider metadata is invalid"));
    return report(checks);
  }

  const ownEnvironment = builds(adapter, metadata.environment);
  const productionAccepted = builds(adapter, "production");
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

function readMetadata(adapter: ProviderKycAdapter): unknown {
  try {
    return adapter.metadata;
  } catch {
    throw new Error("KYC provider metadata is unreadable");
  }
}

function builds(adapter: ProviderKycAdapter, mode: KycProviderEnvironment): boolean {
  try {
    new KycEvidenceCoordinator(adapter, new InMemoryKycEvidenceStore(), {mode});
    return true;
  } catch {
    return false;
  }
}

async function refresh(
  adapter: ProviderKycAdapter,
  mode: KycProviderEnvironment,
  fixture: KycProviderConformanceFixture,
  request: ProviderKycRequest
): Promise<KycRefreshResult | undefined> {
  try {
    const coordinator = new KycEvidenceCoordinator(adapter, new InMemoryKycEvidenceStore(), {
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

async function checkAbortSignal(adapter: ProviderKycAdapter, fixture: KycProviderConformanceFixture): Promise<KycProviderConformanceCheck> {
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

function pass(name: string, detail: string): KycProviderConformanceCheck {
  return {name, pass: true, detail};
}

function fail(name: string, detail: string): KycProviderConformanceCheck {
  return {name, pass: false, detail};
}

function report(checks: KycProviderConformanceCheck[]): KycProviderConformanceReport {
  return {schemaVersion: 1, passed: checks.every((check) => check.pass), checks};
}
