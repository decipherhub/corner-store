# CORE-008 — Exact Recipe Key and Version Resolution

## Outcome

production 실행과 검증에서 Recipe implementation을 canonical `recipeKey + version`으로만
해석하고, 새 version 등록이 기존 ACTIVE 정책 의미를 바꾸지 못하게 한다.

## In Scope

- latest-address 및 numeric exact-address Recipe API 제거
- canonical key+version 조회와 latest-version metadata 분리
- TokenPolicyRegistry/Engine exact lookup 전환
- CLI/Toolkit ABI, inspection/preflight와 migration 문서 갱신
- active version과 catalog latest version 분리 회귀
- full check와 두 local Anvil E2E

## Out of Scope

- `RecipeBinding`의 numeric alias 자체 제거
- 실제 BUIDL 정책값 migration (#109)
- Toolkit의 ManifestPolicyConfig calldata (#108)
- 범용 predicate DSL (#110)

## Steps

1. Registry storage/API에서 latest implementation과 numeric address lookup을 제거한다.
2. 명시적인 `latestRegisteredVersionOf(recipeKey)` metadata getter를 추가한다.
3. Core call site를 `recipeKeyOf(recipeId)` 후 `recipeOf(key, version)`으로 전환한다.
4. CLI/Toolkit 조회와 검증을 exact key+version으로 바꾼다.
5. 새 version 등록이 active compiled plan/policy ID를 바꾸지 않는 회귀를 추가한다.
6. migration/architecture/feature/progress 문서를 정렬한다.
7. targeted, full check와 BUIDL-like/Reg-D E2E를 실행한다.

## Stop Condition

production path에 latest-address 조회가 없고 전체 검증과 별도 PR이 완료된 경우 종료한다.
