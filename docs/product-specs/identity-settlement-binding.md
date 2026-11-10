# Opt-in identity evidence settlement verification

DATA-004 step 3, issue #159 decision 27, intended D034. This verifies the
existing Router settlement binding implemented by AMM-002 (#143). Settlement
contracts, quote schemas, existing recipes and public deployments are unchanged.

`RegD506cRecipeV4` is recipe family 1, version 4. It replaces only A-04-v1
with A-04-v2 in the nine-element v3 reference recipe. B-02-v2 live token wiring,
C-01-v2 actual-sender holding-period checks and the other six elements retain
their existing meaning. The recipe is illustrative reference wiring; operator
policy approval remains separate.

Opt-in requires registering the new recipe and A-04-v2 implementation, selecting
exact version 4 in a REQUIRED_BLOCKING Manifest binding, and supplying the
required DIRECT parameters from
[identity-policy-topology.md](./identity-policy-topology.md). Registering a newer
recipe alone does not change an active Manifest. Binding an identity alone does
not accept evidence. The operator must configure issuer trust and submit
acceptance calldata from
[identity-evidence-v2.md](./identity-evidence-v2.md). Bilateral screening requires
the explicit A-04-v2 `setEnforceCounterparty(true)` setting; both RFQ fixtures
enable it. The recipe does not change that operator-controlled setting.

## Named settlement invariant

`test_settlementLegBoundToPermittedIdentity_*` in
`test/integration/IdentitySettlementBinding.t.sol` covers RFQ v2, RFQ v3 and AMM
in both directions:

- The screened buyer wallet resolves to its accepted identity. RFQ additionally
  screens the maker with accepted evidence for the same asset.
- A buy debits settlement tokens and credits security tokens to that same
  screened wallet. A sell debits security tokens and credits settlement tokens
  to that same wallet. Counterparty balances move by exactly the opposite amounts.
- RFQ binds the signed taker to initiator and buyer, and the signed maker to
  seller. AMM binds the callback payer and output recipient to the buyer and
  requires initiator equal to buyer.
- Mismatched buyers/initiators, mismatched RFQ makers, revoked evidence and
  revoked identity status revert. Every actor and custody balance, Router nonce,
  RFQ quote nonce and surveillance counter stays unchanged.
- Explicit evidence/status restoration permits the same failed request to
  retry. Successful execution consumes nonces and commits surveillance once.
- Router and adapters retain zero token custody.

The AMM fixture uses the real adapter and ERC-3643/ONCHAINID token with a
callback-capable fixed-rate mock pool. Its separate test-only recipe selects
A-04-v2 and excludes C-01. It is not a Reg D recipe. Reg D v4 retains C-01 and
remains incompatible with AMM. Existing canonical Uniswap v3 integration tests
remain part of the focused execution gate.

## Isolated live gate

```sh
npx --yes -p node@20 -p yarn@1.22.22 -c 'scripts/e2e-identity-evidence.sh'
# Optional loopback Anvil port, default 8548:
npx --yes -p node@20 -p yarn@1.22.22 -c 'scripts/e2e-identity-evidence.sh --port 18548'
```

The runner builds compliance-data, Toolkit and RFQ packages, starts its own
chain 31337 under normal contract-size limits, and deploys
`script/IdentityEvidenceFixture.s.sol`. This fixture uses real
ERC-3643/ONCHAINID, the complete Reg D v4 recipe, provider-attested acquisition
snapshots, an additional surveillance binding and mock settlement cash.

The runtime loads an ephemeral local HMAC key through the compliance-data
env-key loader. It materializes demo-provider v2 evidence with explicit operator
acceptance and strict audit, including one optional-LEI case and one omission.
It cross-checks unsigned acceptance calldata with the Toolkit codec, submits
it locally and verifies the accepted commitment on-chain. The HMAC key and
full evidence never enter the deployment artifact.

Both RFQ quote versions settle buys and sells through their corresponding
Router. Each scenario checks eight mined rejections: bound-but-unaccepted
wallet, missing maker evidence, three actor mismatches, two evidence
revocations after signing and current issuer removal. Static calls also verify
the exact failure selector and identity reason where applicable. Every rejected
transaction has status 0, no logs, unchanged balances/nonces and no surveillance
commit. Restoration allows the same signed quote to settle with exact bilateral
token deltas, nonce consumption, one commit and zero custody. Public calldata,
events, artifact and audits are checked for private evidence leakage.

The runner exits nonzero on failure and removes its temporary deployment
artifact, logs and Anvil process on exit. It does not use the legacy Anvil
artifact or modify the public Monad paths. RFQ host HTTP behavior is outside
this gate; the separate context-provenance gate covers that integration.

## Deployment size regression

The first live attempt found TokenPolicyRegistry's step-1 runtime above EIP-170.
The topology guard now runs inside element compilation, with the same validation
order and errors, and its full-word DIRECT decoder uses compact range checks.
The new `test_identityPolicyRegistry_fitsEip170` checks the actual deployed
runtime against 24,576 bytes. Foundry 1.7.1 with the repository's pinned
Solidity 0.8.17 optimizer settings measures 24,536 bytes, leaving 40 bytes.
Further registry changes must preserve this gate or address code size separately.

This proof covers self-directed Router-mediated execution. Delegation, transfers
outside the Router, settlement-asset cards, issuer/AML-owner labels and freeze
scope are outside step 3. P2 scheduling and release gates remain step 4 work.
