# External Settlement Gate and OMS Precheck

## Status

Implementation contract for issue #169. This path is additive and does not replace
the reference `ExecutionRouter` adapter path.

## Product Boundary

Corner Store provides a compliance settlement gate for an existing ATS or OMS. It
does not provide order matching, custody, broker-dealer operations or venue
operation. A customer settlement contract remains the authoritative source for
the order parties, token legs, venue, flow and exact quantities.

The supported v1 path is:

```text
OMS advisory precheck at explicit block
  -> authenticated final caller
  -> pause and replay gates
  -> venue-authoritative context validation
  -> fresh compliance evaluation
  -> approved target settlement
  -> canonical buyer balance measurement
  -> stateful compliance commit
  -> settlement evidence events
```

Mixin inheritance and a Uniswap v4 hook are intentionally deferred. Supporting
one gate first avoids three subtly different enforcement contracts.

## On-chain Contract

`ExternalSettlementGate` reuses the `ExecutionRouterV2` execution lifecycle. Its
registered compatibility `adapter` and `target` fields must both identify the same
reviewed settlement target. The target implements `IExternalSettlementTarget`, not
`IExecutionAdapter`.

Before evaluation the existing venue evidence path checks exact runtime code,
version, configuration, policy registry and Router/gate binding. The gate then
requires explicit gate enforcement and calls `settle`. Buyer token deltas remain
the accounting source of truth. A mismatch reverts settlement, nonce consumption
and commit atomically.

The reference target stores one-shot, operator-authorized settlement instructions.
It repeats exact context validation during settlement and rejects direct calls.
This reference is evidence of the integration contract, not a production OMS,
matching engine or custody system.

One `ComplianceEngine` has one authorized commit dispatcher. Operators must deploy
or deliberately rebind an engine for the external gate; the Toolkit must never
imply that a reference Router and external gate can both commit through the same
engine simultaneously.

## OMS Precheck

The precheck reads `ComplianceReporter` at an explicit block. It is always marked
`advisory: true` and returns only a stable coarse explanation, `policyId`,
`decisionHash` and evidence block/time. It cannot reserve inventory, consume a
nonce or authorize settlement.

Curable explanations are returned only when the authenticated subject matches the
order initiator and buyer. Restricted, redacted, sanctions, AML, surveillance and
unknown results collapse to a generic unavailable outcome. The final on-chain
gate performs a fresh evaluation regardless of precheck output.

## Activation

Toolkit activation produces deterministic unsigned governance calls for:

1. binding the Engine dispatcher to the gate;
2. registering the target as both compatibility adapter and target;
3. approving the exact target runtime/version;
4. installing exact context evidence.

Verification checks gate/target code, dispatcher binding, `onlyGate` declaration,
target configuration, registry state and evidence commitments. It never signs or
broadcasts transactions.

## Compatibility and Non-goals

- Existing Router/adapters and demo deployment paths are unchanged.
- Exact full-fill, standard non-rebasing ERC-20 assumptions remain.
- Delegated callers, partial fills and multi-dispatcher Engine authorization need
  separately versioned designs.
- Production target review, ATS licensing, custody, legal approval and operational
  monitoring remain operator responsibilities.
