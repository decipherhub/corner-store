# CORE-010 — Policy Execution Binding

## Outcome

정책 의미가 같아도 chain, Engine/Registry, Recipe/Element 구현이 다른 배포에서는
동일 decision 또는 RFQ quote를 재사용할 수 없도록 한다.

## Behavior Lock

- Router는 settlement마다 fresh compliance evaluation을 유지한다.
- 기존 local BUIDL-like/Reg-D demo의 기능과 nonce/idempotency 경계는 유지한다.
- exact Recipe version과 ManifestPolicyConfig parameter commitment를 재해석하지 않는다.
- 기본 production 경로는 immutable implementation이며 proxy implementation slot
  introspection은 지원 대상으로 선언하지 않는다.

## In Scope

1. domain-separated logical policy, execution binding and final policy hashes
2. chain ID, Engine/Registry/Recipe/Element address + runtime code hash commitments
3. exact Element version/metadata/schema/parameter commitments
4. final `policyId` inside `decisionHash`
5. RFQ EIP-712 quote-time `policyId` and fresh-settlement equality check
6. deterministic vectors, drift/replay tests, SDK/type/ABI/documentation migration
7. full check, runtime size and both local Anvil E2E profiles

## Out of Scope

- upgradeable proxy implementation-slot adapters; production activation remains immutable-only
- audit artifact persistence and lifecycle events(#106)
- emergency Element replacement workflow(#107)
- full production onboarding/Safe execution workflow(#108)
- BUIDL-like product profile migration(#109)

## Steps

1. decision/RFQ hash and chain/address/code-drift regression tests를 먼저 추가한다.
2. bounded pure hash library와 Engine execution-binding derivation을 구현한다.
3. RFQ Solidity/TypeScript EIP-712 schema와 settlement equality check를 migration한다.
4. Toolkit/CLI/demo callers와 문서를 새 binding에 맞춘다.
5. targeted/full/E2E/size 검증 후 상태를 완료 처리하고 별도 PR로 전달한다.

## Stop Condition

다른 chain/address/runtime code에서 hash가 달라지고 stale RFQ policy가 settlement 전에
거절되며, 전체 check와 기존 두 demo E2E가 통과한 경우 종료한다.
