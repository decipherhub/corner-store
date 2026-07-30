import {createRFQServiceFromModules, validateRFQModuleSet} from "./modules";
import {Address, RFQModuleSet, SignedRFQQuote} from "./types";

export interface RFQConformanceFixture {
  chainId: number;
  verifyingContract: Address;
  maker: Address;
  taker: Address;
  otherTaker: Address;
  tokenIn: Address;
  tokenOut: Address;
  venue: Address;
  amountIn: string;
  now: number;
  ttlSeconds: number;
}

export interface RFQConformanceCheck {
  name: string;
  pass: boolean;
  detail: string;
}

export interface RFQConformanceReport {
  schemaVersion: 1;
  passed: boolean;
  checks: RFQConformanceCheck[];
}

export async function runRFQModuleConformance(
  modules: RFQModuleSet,
  fixture: RFQConformanceFixture
): Promise<RFQConformanceReport> {
  const checks: RFQConformanceCheck[] = [];
  try {
    validateRFQModuleSet(modules);
    checks.push(pass("module-contract", "all required v1 capabilities declared"));
  } catch (error: any) {
    checks.push(fail("module-contract", error.message));
    return report(checks);
  }

  try {
    const calls = {pricing: 0, risk: 0, signer: 0, nonce: 0};
    const instrumented: RFQModuleSet = {
      pricing: {
        ...modules.pricing,
        implementation: {
          price: async (request) => {
            calls.pricing += 1;
            return modules.pricing.implementation.price(request);
          }
        }
      },
      risk: {
        ...modules.risk,
        implementation: {
          check: async (request, price) => {
            if (calls.pricing !== calls.risk + 1 || calls.signer !== calls.risk) {
              throw new Error("risk must run after pricing and before signing");
            }
            calls.risk += 1;
            return modules.risk.implementation.check(request, price);
          }
        }
      },
      signer: {
        ...modules.signer,
        implementation: {
          signTypedData: async (typedData) => {
            if (calls.risk !== calls.signer + 1 || calls.nonce !== calls.signer + 1) {
              throw new Error("signing must run after risk and nonce allocation");
            }
            calls.signer += 1;
            return modules.signer.implementation.signTypedData(typedData);
          }
        }
      },
      nonce: {
        ...modules.nonce,
        implementation: {
          nextNonce: async (scope) => {
            calls.nonce += 1;
            return modules.nonce.implementation.nextNonce(scope);
          }
        }
      }
    };
    const service = createRFQServiceFromModules({
      chainId: fixture.chainId,
      verifyingContract: fixture.verifyingContract,
      maker: fixture.maker,
      modules: instrumented,
      defaultTtlSeconds: fixture.ttlSeconds,
      now: () => fixture.now
    });
    const first = await service.quote(intent(fixture, fixture.taker));
    const second = await service.quote(intent(fixture, fixture.otherTaker));

    checks.push(first.quote.maker === fixture.maker.toLowerCase()
      ? pass("maker-binding", "configured maker is bound")
      : fail("maker-binding", "quote maker differs from configured maker"));
    checks.push(first.quote.amountIn === fixture.amountIn && BigInt(first.quote.amountOut) > 0n
      ? pass("pricing", "positive base-unit price returned")
      : fail("pricing", "pricing changed amountIn or returned non-positive amountOut"));
    checks.push(first.quote.expiry === fixture.now + fixture.ttlSeconds
      ? pass("expiry", "clock and TTL are respected")
      : fail("expiry", "unexpected quote expiry"));
    checks.push(isHexSignature(first.signature)
      ? pass("signer", "signer returned a 65-byte hex signature")
      : fail("signer", "signature must be 65-byte hex"));
    checks.push(BigInt(second.quote.nonce) > BigInt(first.quote.nonce)
      ? pass("nonce", "maker nonce increases across takers")
      : fail("nonce", "nonce must be maker-scoped and monotonic"));
    checks.push(calls.pricing === 2 && calls.risk === 2 && calls.nonce === 2 && calls.signer === 2
      ? pass("module-order", "pricing, risk, nonce and signer each ran once per quote")
      : fail("module-order", `unexpected call counts ${JSON.stringify(calls)}`));
    checks.push(typedDataMatchesQuote(first, fixture)
      ? pass("typed-data", "domain and every quote field are bound into the signed payload")
      : fail("typed-data", "signed typed data does not match the returned quote"));
    const rejected = await riskRejectionProbe(modules, fixture);
    checks.push(rejected
      ? pass("risk-fail-closed", "risk rejection occurs before nonce allocation and signing")
      : fail("risk-fail-closed", "risk rejection allocated a nonce or invoked the signer"));
  } catch (error: any) {
    checks.push(fail("quote-flow", error.message));
  }

  return report(checks);
}

async function riskRejectionProbe(modules: RFQModuleSet, fixture: RFQConformanceFixture): Promise<boolean> {
  let nonceCalls = 0;
  let signerCalls = 0;
  const rejecting: RFQModuleSet = {
    pricing: modules.pricing,
    risk: {...modules.risk, implementation: {check: () => { throw new Error("conformance-risk-rejection"); }}},
    nonce: {
      ...modules.nonce,
      implementation: {
        nextNonce: async (scope) => {
          nonceCalls += 1;
          return modules.nonce.implementation.nextNonce(scope);
        }
      }
    },
    signer: {
      ...modules.signer,
      implementation: {
        signTypedData: async (typedData) => {
          signerCalls += 1;
          return modules.signer.implementation.signTypedData(typedData);
        }
      }
    }
  };
  const service = createRFQServiceFromModules({
    chainId: fixture.chainId,
    verifyingContract: fixture.verifyingContract,
    maker: fixture.maker,
    modules: rejecting,
    defaultTtlSeconds: fixture.ttlSeconds,
    now: () => fixture.now
  });
  try {
    await service.quote(intent(fixture, fixture.taker));
    return false;
  } catch (error: any) {
    return error.message === "conformance-risk-rejection" && nonceCalls === 0 && signerCalls === 0;
  }
}

function typedDataMatchesQuote(signed: SignedRFQQuote, fixture: RFQConformanceFixture): boolean {
  return signed.typedData.domain.chainId === fixture.chainId &&
    signed.typedData.domain.verifyingContract === fixture.verifyingContract.toLowerCase() &&
    Object.entries(signed.quote).every(([key, value]) =>
      signed.typedData.message[key as keyof typeof signed.quote] === value
    );
}

export async function assertRFQModuleConformance(
  modules: RFQModuleSet,
  fixture: RFQConformanceFixture
): Promise<RFQConformanceReport> {
  const result = await runRFQModuleConformance(modules, fixture);
  if (!result.passed) {
    throw new Error(`RFQ module conformance failed: ${result.checks.filter((check) => !check.pass).map((check) => `${check.name}: ${check.detail}`).join("; ")}`);
  }
  return result;
}

function intent(fixture: RFQConformanceFixture, taker: Address) {
  return {
    taker,
    tokenIn: fixture.tokenIn,
    tokenOut: fixture.tokenOut,
    amountIn: fixture.amountIn,
    venue: fixture.venue
  };
}

function isHexSignature(value: string): boolean {
  return /^0x[a-fA-F0-9]{130}$/.test(value);
}

function pass(name: string, detail: string): RFQConformanceCheck {
  return {name, pass: true, detail};
}

function fail(name: string, detail: string): RFQConformanceCheck {
  return {name, pass: false, detail};
}

function report(checks: RFQConformanceCheck[]): RFQConformanceReport {
  return {schemaVersion: 1, passed: checks.every((check) => check.pass), checks};
}
