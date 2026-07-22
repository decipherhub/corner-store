# Demo Runbook — Live Anvil E2E

The live-Anvil runner deploys the FULL Corner Store stack to a real node and
drives a 7-scenario suite that doubles as the stakeholder demo. Each scenario
prints a one-line narrative, its observable on-chain evidence, and `PASS`/`FAIL`,
so a non-engineer can watch the 4-layer compliance model (Element / Recipe /
Manifest / Operator) work end-to-end.

This is feature `E2E-001` (see `FEATURES.md`).

## How To Run

```sh
scripts/e2e-anvil.sh            # BUIDL-like default: scenarios + backend/CLI RFQ flow
scripts/e2e-anvil.sh --profile reg-d
scripts/e2e-anvil.sh --mode rfq # concise mock TA → SDK/CLI → backend RFQ walkthrough
scripts/e2e-anvil.sh --port 8600
scripts/e2e-anvil.sh --keep     # leave Anvil running afterwards (attach a UI / continue interactively)
```

- Runs fully offline (`forge script ... --offline` against a local Anvil).
- Exit code is non-zero if any scenario fails (`DemoScenarios` reverts).
- `--keep` prints the Anvil/backend PIDs and leaves both processes up; stop them
  with the printed `kill <pid>` commands.
- With `--keep`, the runner restores the maker after proving the revoked-maker
  rejection, so the next RFQ quote can be settled interactively without reset.
- `--mode rfq` skips the AMM, lifecycle and surveillance walkthrough. It keeps
  the MVP path focused on a mock-TA-seeded investor receiving a backend-signed
  RFQ quote, settling through `ExecutionRouter → RFQAdapter`, and rejecting the
  same flow after the maker is revoked.

Under the hood the runner executes two forge scripts and one backend/CLI stage:

1. `script/DeployStack.s.sol` — deploys registries (Element/Recipe/TokenPolicy/
   Operator), `ComplianceEngine`, `ExecutionRouter` + `VenueRegistry` +
   `VenueSelector`, `CornerStoreFactory`, all 12 elements, Reg D 506(c), generic
   3(c)(7), BUIDL-like QP/minimum and surveillance recipes,
   the AMM `MockPool` venue, the `RFQAdapter` venue, and a REAL ERC-3643 token +
   OnchainID stack (via the shared `test/fixtures/TREXCore.sol`). It prints an
   address summary and writes it to `deployments/anvil-e2e.json` (gitignored).
2. `script/DemoScenarios.s.sol` — reads the selected profile from that artifact
   and runs the suite below.
3. The shell runner selects the matching Toolkit config fixture, runs artifact preflight, writes a temporary immutable
   checkpoint, re-onboards the selected profile through the CLI, starts the
   RFQ demo backend, requests a quote through the CLI, fills it through
   `ExecutionRouter → RFQAdapter`, then proves a revoked maker quote is rejected.

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

- The fast interactive demo intentionally uses the deterministic in-repo
  `MockPool` (1:1 rate). Canonical Uniswap v3 factory/pool behavior is separately
  automated in `test/integration/RealUniswapV3.t.sol`, while the vendored
  `tools/deploy-v3` infrastructure remains isolated. A unified deployment command
  for both stacks is still a follow-up. See `tools/deploy-v3/CORNER_STORE_PROFILE.md`.
- Element data sources (OFAC / ONCHAINID claims / ERC-165 / EDGAR) are
  operator-settable mocks, and the C-01 Rule 144 lockup reads an injected,
  expiring `AttestedAcquisitionSource` snapshot seeded from mock TA data. These
  illustrative wirings and the manifest lifecycle
  design are recorded in `DECISIONS.md` **D008** (9-element recipe, operator-gated
  setters, provider-neutral mock acquisition snapshot) and **D009** (manifest lifecycle state
  machine, engine positive-allowlist default-deny, factory register→approve).
- `QUOTE` is a plain `MockERC20` tagged `UNREGULATED` (out-of-scope cash leg).

## CLI로 직접 해보기

위 7-scenario 스크립트는 자동 실행이지만, 같은 스택을 터미널에서 한 명령씩 직접
구동하고 싶다면 `corner-store` 레퍼런스 CLI를 쓴다. `scripts/e2e-anvil.sh --keep`로
노드를 띄운 뒤(또는 `DeployStack`만 배포한 뒤) `status` → `onboard` →
`investor-setup` → `kyc` → `buy` → 실패 경로(jurisdiction flip / manifest suspend /
maker revoke, 각각 reason-code 디코딩) 순으로 직접 몰아볼 수 있다.

CLI v2(CLI-002)는 preflight·거래·관측 명령을 더한다: 거래 없이 per-element
컴플라이언스를 미리 확인하는 `check <buyer>`(엔진 verdict 포함, 거부 시 exit 1),
AMM 매도 방향 `sell <amountIn>`, 잔고/allowance 표 `balances`, 이벤트 실시간
tail `watch [--from <block>]`(Executed/RFQFilled/Manifest*/SurveillanceFlag 등
reason-code 디코딩), demo용 QUOTE 민팅 `faucet`, anvil `snapshot`/`restore <id>`,
서명 quote를 검증하는 `quote-inspect <file>`(서명자 복구·만료·on-chain nonce/승인
상태, 실패 시 exit 1). 예: `check`로 fresh 계정의 FAIL 원소들을 본 뒤
`investor-setup`+`kyc`로 green을 만들고, `snapshot` → `attest jurisdiction ZZ` →
`check`(정확히 A-02 하나 FAIL) → `restore`로 원복하는 흐름.

설치/실행법과 전체 walkthrough 레시피는 `services/cli/README.md`를 참고한다.

## RFQ demo backend로 quote 받기

`services/rfq-demo-backend`는 위 live Anvil artifact와 `services/rfq` SDK를
재사용하는 local-only HTTP application이다. 별도 배포 경로나 컴플라이언스 판정을
만들지 않는다.

```sh
# terminal 1: live stack + mock maker quote API
scripts/e2e-anvil.sh --profile buidl-like --keep

# terminal 2: user flow
node services/cli/dist/cli/src/index.js rfq-quote \
  --backend http://127.0.0.1:8787 --amount-in 5000000 --out quote.json
node services/cli/dist/cli/src/index.js buy 0 --venue rfq --quote quote.json
```

Backend는 quote를 가격 산정·서명할 뿐이다. maker revoke, Manifest suspend 또는
Element 실패가 있으면 동일한 signed quote라도 Router fill 시점의 최신 compliance로
거부된다. 자세한 API와 production 교체 지점은
`services/rfq-demo-backend/README.md`를 참고한다.

## Related

- Test layers and the automated suite: `docs/testing.md`.
- Architecture and trust boundaries: `ARCHITECTURE.md`, `docs/architecture/`.
- Decisions: `DECISIONS.md` (D008, D009).
