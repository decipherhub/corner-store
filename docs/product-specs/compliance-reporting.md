# Complete Compliance Requirement Reporting

## Scope

Issue #132 item 11 adds an opt-in `ComplianceReporter` and a Toolkit reader.
`ComplianceEngine.evaluate()` and the Router settlement path retain their existing
behavior. A report is public diagnostic output for one context at one block.
It never authorizes settlement, transfers tokens, invokes `commit()`, issues a
quote, or promises that a later execution will succeed.

The reporter is constructed with an existing `ComplianceEngine`. Its immutable
Registry references come from that Engine's `policyReg`, `elementReg` and
`recipeReg` getters. Callers cannot substitute a Registry per request. Deployment
and capability selection are explicit; existing deployments and demos do not
start using the reporter automatically.

## View Contract

`IComplianceReporter.report(ComplianceContext)` returns `ComplianceReport` version
1, defined in `src/types/ComplianceReportTypes.sol`:

| Field | Meaning |
| --- | --- |
| `version` | Report ABI/capability version, currently 1 |
| `blockNumber`, `timestamp` | EVM block of the entire evaluation |
| `complete` | Engine returned and every active compiled requirement was checked or determined nonapplicable |
| `status` | Combined diagnostic outcome, including the Engine outcome |
| `engineStatus` | `PASS` if Engine allowed, `FAIL` if Engine denied, `UNDETERMINED` if Engine reverted |
| `decision` | Engine decision, with the disclosure redactions below |
| `decisionRedacted` | Sensitive families were present and decision detail fields were cleared |
| `restrictedStatus` | One aggregated outcome for all sensitive requirements across both legs |
| `requirements` | Public requirement rows in tokenIn/tokenOut, binding, compiled-rule order |

Status values in the Solidity ABI are `PASS=0`, `FAIL=1`, `UNDETERMINED=2` and
`NOT_APPLICABLE=3`. Aggregation precedence is `FAIL`, then `UNDETERMINED`, then
`PASS`, then `NOT_APPLICABLE`. A known failure therefore remains visible even
when another provider is unavailable. `complete` is independent of pass/fail.
An absent restricted family has `restrictedStatus=NOT_APPLICABLE`.

Each public row includes the regulated token, zero-based token-local
`bindingIndex`, exact `recipeId` and `recipeVersion`, binding `mode`, `pathGroupId`,
`elementId`, compiled enforcement `action`, status and reason code. A failed
Element's nonzero reason is retained; a zero reason uses the Engine's
`ReasonCodes.encode(recipeId, elementId, 1)` fallback. Passing, nonapplicable and
undetermined rows have a zero reason. Provider revert data is never returned.

## Evaluation And Completeness

The reporter calls the authoritative Engine once, then reads both legs' active
compiled policies. For every active binding it resolves the exact registered
Recipe version, checks applicability with `abi.encode(manifest.factsPacked, ctx)`,
and reads `compiledRulesOf(token, bindingIndex)` together with the matching
`compiledParametersOf(token, bindingIndex)` array. It never reconstructs rules
from a Recipe's current `requiredElements()` or uses a catalog's latest version.

Applicable rules call the registered Element with the same arguments as Engine:
`ctx.buyer`, `ctx.seller`, regulated token, that leg's RWA amount,
`abi.encode(ctx)` and that rule's compiled parameter bytes. Every rule is visited,
including rules after a failure and all path alternatives and flag-only rules.
Nonapplicable bindings return nonapplicable rows without calling their Elements.

`REQUIRED_BLOCKING`, `PATH_OPTION` and `FLAG_ONLY` retain their Engine meanings.
Rows show individual checks, so a failed alternative or flag-only requirement
can produce `report.status=FAIL` while `engineStatus=PASS`. Consumers must use
`engineStatus` to describe the Engine outcome and the row mode/action to explain
individual observations. They must never interpret diagnostic `FAIL` as a new
settlement restriction.

The Engine outcome also captures gates outside individual checks. In particular,
UNKNOWN/SUSPENDED policy status, a path group with no applicable passing option,
and the Engine's C-01/AMM restriction can deny even when individual public rows
pass or are nonapplicable. The C-01 restriction runs before Recipe applicability
and binding mode in Engine. The reporter continues diagnosing the compiled
requirements and retains the Engine denial separately.

A Recipe applicability error, missing implementation, runtime code mismatch, or
Element/provider revert produces `UNDETERMINED` and `complete=false`. Engine
reverts also set `engineStatus=UNDETERMINED`, leave `decision` at its zero value,
and make the report incomplete. A zero decision is never an Engine denial or a
usable decision. Invalid Registry reads or RPC/execution resource exhaustion can
still fail the entire view; callers must treat a failed read as unavailable.
The view supports the Engine's current bounds of eight bindings per token and
32 rules per binding.

A complete `status=PASS` report implies the Engine permitted the same context in
that call. Every returned Engine denial makes `engineStatus` and `status` fail,
even when the blocking requirement is restricted. This implication concerns the
Engine evaluation only: Router pause/venue authorization, quote validity, token
transfer enforcement and later state changes remain separate gates.

## Public Disclosure Boundary

This is a conservative product default pending counsel approval of public fields.
The taxonomy in `docs/compliance` identifies A-01 as sanctions, A-12 as Red Flag
Knowledge Bar, and F-* as conduct, surveillance and fraud-related checks.
All versions matching `A-01-*`, `A-12-*` and `F-*` are restricted. These checks
produce only one `restrictedStatus`, aggregated across both tokens and every
binding. No sensitive row, element identifier, reason, binding/path identifier,
count, or provider text is returned for them. Other families may be itemized.

Whenever a restricted family is present, even if nonapplicable, the returned
Engine decision clears `reasonCode`, `flagsBitmap` and `reliedClaims` and sets
`decisionRedacted=true`. This prevents the Engine's first failure reason or
binding bit position from bypassing the report's row suppression. The Engine's
allowed verdict, policy identity, constraints and decision hash are preserved.
Consumers needing confidential enrichment must use a separately controlled
off-chain system. A downstream authenticated disclosure service may suppress
additional public details according to its own versioned policy.

The view does not establish confidentiality of existing public storage,
calldata, events, registries or direct Engine/Element calls. It introduces no
SAR data, investigation details or raw evidence fields. Counsel must approve
which fields and audiences are appropriate before production adoption; this
specification makes no legal determination.

## Toolkit Reader

`readComplianceReport(reader, reporterAddress, context, blockTag)` is an additive
Toolkit export. `reader.call({to, data, blockTag})` can be supplied by an ethers v6
Provider. `blockTag` must be an explicit nonnegative safe block number or hex
block reference; dynamic `latest` and `pending` tags are rejected. Use the same
block reference for any independent parity read. A pinned block hash is preferable
when comparing across a possible reorganization.

The reader encodes the reporter ABI and returns a plain typed
`ComplianceRequirementReport`. Amounts, timestamps, block numbers and decision
integers remain `bigint`; statuses, binding modes and actions become named string
unions. Unknown report versions/enums and malformed responses are rejected.
Transport and malformed ABI errors use generic messages without provider text or
response bytes. There is
no cached-success fallback or settlement method.

This is an additive minor SDK capability under `docs/sdk-versioning.md`. Consumers
must explicitly configure a reporter with version-1 support and retain their
existing settlement integrations. No existing SDK response shape changes.

## Verification

`test/unit/compliance/Reporter.t.sol` exercises simultaneous failures, both
regulated legs and amounts, required/path/flag composition, nonapplicability,
provider and Recipe reverts, unsupported AMM, policy status gates, code drift,
reason fallback, restricted aggregation/redaction, and active parameter changes
across delayed snapshots. Parity checks compare the actual Engine verdict,
policy identity and decision hash at the same snapshot; a fuzz test checks the
complete-all-pass implication and denial reflection.

Toolkit reader tests cover ABI encoding, integer precision, all status variants,
binding/path/action decoding, explicit block forwarding, unsupported versions,
invalid enum/malformed responses and generic transport failure. Run the isolated
runtime check after `forge build`:

```sh
npm run test:reporter-runtime --prefix services/toolkit
```

It starts an ephemeral loopback Anvil, deploys compiled Engine/Registry/Reporter
contracts and test Elements/Recipe, and uses the actual Toolkit reader to compare
unknown-policy denial, unregulated permission, simultaneous public/restricted
failures and a historical snapshot. It also compares the SDK and compiled
reporter ABI tuple types. It requires Anvil and Foundry artifacts but no deployed
stack or signing secrets. No production deployment or live public-demo change
is part of this capability.
