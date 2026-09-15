# CORE-009 — Bounded Predicate and Element Conformance

## Outcome

Element의 evidence/default enforcement 의미와 parameter decoding을 fail-closed 공통
경계로 고정하고, 자산별 값이 없는 generic predicate Element를 제공한다.

## Behavior Lock

- 기존 24개 Element의 empty-parameter 판정과 reason code는 유지한다.
- 기존 registration의 default enforcement 결과는 유지한다.
- 기존 local BUIDL-like/Reg-D demo와 GIWA testnet build 흐름을 깨뜨리지 않는다.
- 법률 의미가 다른 Element를 하나로 합치지 않는다.

## In Scope

1. `ElementMetadata` evidence type/default enforcement commitment
2. Registry metadata hash와 registration conformance validation
3. exact-length/range bounded predicate decoder library
4. generic parameterized `MinimumTradeAmount` Element
5. primitive, Element, Registry, Engine conformance tests
6. architecture/security/testing/feature/progress 문서
7. full check와 두 local Anvil E2E

## Out of Scope

- 임의 DSL/AST/interpreter와 무제한 boolean composition
- BUIDL-like active profile parameter migration(#109)
- Toolkit Safe/onboarding parameter calldata 완성(#108)
- policy/deployment execution binding(#105)

## Steps

1. metadata/default-action 불일치와 decoder boundary 회귀 테스트를 먼저 작성한다.
2. metadata schema와 Registry hash/validation을 확장한다.
3. production Element와 test mock metadata를 동일 ABI로 migration한다.
4. bounded predicate library와 generic minimum-amount Element를 구현한다.
5. targeted/full/E2E 검증 후 문서와 상태를 완료 처리한다.

## Stop Condition

새 경계의 fail-closed tests, 전체 check와 기존 두 demo E2E가 통과하고 별도 PR이
완료된 경우 종료한다.

## Verification Evidence

- targeted: ElementRegistry 11/11, PredicateValidation 4/4,
  MinimumTradeAmount 2/2, Engine 40/40, existing Element 579/579,
  TokenPolicyRegistry 56/56, Factory 11/11
- full Foundry: 891/891
- `scripts/check.sh`: pass, including service/package smoke, clean SDK consumer and
  deploy-v3 10/10
- BUIDL-like and Reg-D Anvil: each 7/7 plus dashboard/CLI/RFQ flows
- runtime size: TokenPolicyRegistry 24,035 bytes, EIP-170 margin 541 bytes
- `git diff --check`: pass
