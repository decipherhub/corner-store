# Demo Runbook — Live Anvil E2E

The live-Anvil runner deploys the FULL Corner Store stack to a real node and
drives a 7-scenario suite that doubles as the stakeholder demo. Each scenario
prints a one-line narrative, its observable on-chain evidence, and `PASS`/`FAIL`,
so a non-engineer can watch the 4-layer compliance model (Element / Recipe /
Manifest / Operator) work end-to-end.

This is feature `E2E-001` (see `FEATURES.md`).

## How To Run

```sh
scripts/e2e-anvil.sh            # start Anvil, deploy, run scenarios, tear down
scripts/e2e-anvil.sh --port 8600
scripts/e2e-anvil.sh --keep     # leave Anvil running afterwards (attach a UI / continue interactively)
```

- Runs fully offline (`forge script ... --offline` against a local Anvil).
- Exit code is non-zero if any scenario fails (`DemoScenarios` reverts).
- `--keep` prints the Anvil PID and RPC URL and leaves the node up; stop it with
  `kill <pid>`.

Under the hood the runner executes two forge scripts:

1. `script/DeployStack.s.sol` — deploys registries (Element/Recipe/TokenPolicy/
   Operator), `ComplianceEngine`, `ExecutionRouter` + `VenueRegistry` +
   `VenueSelector`, `CornerStoreFactory`, all 11 elements, both recipes (Reg D
   506(c) id 1, 3(c)(7) id 2) plus a surveillance-enabled RegD variant (id 7),
   the AMM `MockPool` venue, the `RFQAdapter` venue, and a REAL ERC-3643 token +
   OnchainID stack (via the shared `test/fixtures/TREXCore.sol`). It prints an
   address summary and writes it to `deployments/anvil-e2e.json` (gitignored).
2. `script/DemoScenarios.s.sol` — reads that artifact and runs the suite below.

Accounts are Anvil's well-known mnemonic (`test test ... junk`):
account 0 = deployer/owner/operator, 1 = investor (buyer/taker),
2 = RFQ maker (approved dealer), 3 = unapproved maker.

## Scenario Narrative (in order)

1. **Onboarding** — `CornerStoreFactory.registerRWAToken` onboards the RWA token
   in one governed call: the manifest runs `propose -> approve` and the AMM venue
   is registered. Evidence: `ManifestRegistered` / `ManifestStatusChanged` events,
   manifest status `ACTIVE`, `declaredBy == approvedBy == factory`.
2. **Compliant trade succeeds** — the fully-attested investor buys RWA through the
   router → AMM path. Evidence: `Executed` event + investor RWA balance delta.
3. **Element rejection, live** — the operator flips ONE attestation (investor
   jurisdiction A-02 → a disallowed code). The same trade now reverts
   `ComplianceRejected`. The runner recomputes the expected reason code
   off-chain and asserts equality, then narrates "rejected by A-02 Jurisdiction".
   The attestation is restored afterward.
4. **Lifecycle** — `suspendManifest` blocks the trade (`ComplianceRejected`,
   policy not `ACTIVE`); `resumeManifest` lets it settle again.
5. **RFQ venue** — the maker signs an EIP-712 quote off-chain (in-script signing
   with a known key); the taker settles it through the router (`RFQFilled`, real
   ERC-3643 delivery leg). Then an UNAPPROVED maker's quote is rejected
   (`RFQMakerNotApproved`).
6. **Surveillance (stateful layer)** — the operator re-onboards the RWA under a
   surveillance-enabled recipe (id 7 = RegD 9-element set + F-02), then repeated
   trades push the transfer counter past the threshold, emitting a
   `SurveillanceFlag` event. Surveillance is flag-not-block: the trades still
   settle.
7. **Bypass attempt** — a direct `adapter.execute` call (going around the router)
   reverts `NotAuthorized`: compliance cannot be skipped by bypassing the router.

## Reading Reason Codes

`ComplianceRejected(bytes32 reasonCode)` carries a `keccak256` digest, not a
human-readable code — element ids are full `bytes32`, so they cannot be
bit-packed into one word and the digest is not on-chain-decodable (see
`src/libraries/ReasonCodes.sol`). Off-chain audit (17a-3/4) recomputes the known
`(recipeId, elementId, code)` combination and matches it:

```solidity
ReasonCodes.encode(recipeId, elementId, code) == keccak256(abi.encode(recipeId, elementId, code))
```

Scenario 3 does exactly this: it recomputes `ReasonCodes.encode(1, "A-02-v1", 1)`
(Reg D recipe id 1, jurisdiction element, generic fail code 1) and asserts it
equals the `reasonCode` decoded from the caught revert. The engine re-encodes
each element's placeholder code with the real contributing `recipeId`, so the
digest is stable and reproducible.

A policy-level rejection (scenario 4, suspended manifest) uses
`ReasonCodes.encode(0, "POLICY", uint32(status))` where `status` is the offending
`PolicyStatus` (SUSPENDED = 3).

## Mock vs Real

REAL, genuinely enforced on-chain:

- The RWA token is a real **ERC-3643 (T-REX)** token with a real **OnchainID**
  identity registry, trusted claim issuer, and KYC claims. `isVerified` and
  `canTransfer` are honoured on every RWA leg (verified-holder transfers, minting
  to verified holders only, real rollback on unverified recipients).
- The full compliance engine, recipes, elements, router, venue selector,
  manifest lifecycle, RFQ EIP-712 verification, and per-caller nonce replay guard
  are the production skeleton contracts, unmodified.

MOCK / illustrative (documented seams):

- The AMM venue is the in-repo `MockPool` (1:1 rate), **not** a real Uniswap v3
  pool. A real Uniswap v3 pool deployment is a separate follow-up: the vendored
  `tools/deploy-v3` infrastructure is kept isolated (vendor-isolation rule) and
  the demo does not depend on it. See `tools/deploy-v3/CORNER_STORE_PROFILE.md`.
- Element data sources (OFAC / ONCHAINID claims / ERC-165 / EDGAR) are
  operator-settable mocks, and the C-01 Rule 144 lockup reads an injected
  acquisition-time source. These illustrative wirings and the manifest lifecycle
  design are recorded in `DECISIONS.md` **D008** (9-element recipe, operator-gated
  setters, fixture acquisition source) and **D009** (manifest lifecycle state
  machine, engine positive-allowlist default-deny, factory register→approve).
- `QUOTE` is a plain `MockERC20` tagged `UNREGULATED` (out-of-scope cash leg).

## Related

- Test layers and the automated suite: `docs/testing.md`.
- Architecture and trust boundaries: `ARCHITECTURE.md`, `docs/architecture/`.
- Decisions: `DECISIONS.md` (D008, D009).
