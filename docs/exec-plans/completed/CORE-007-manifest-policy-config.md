# CORE-007 — Versioned Manifest Policy Config

## Outcome

자산별 정책값을 재사용 가능한 Element 구현에서 분리하고, Manifest governance와
동일한 lifecycle·version·hash로 원자적으로 활성화한다.

## In Scope

- versioned `ManifestPolicyConfig`와 Element parameter entry 타입
- bounded entry/byte/schema/membership 검증
- active config hash, pending compiled plan hash와 active compiled parameter 조회
- config를 포함한 deterministic compiled plan/history/policy binding
- Engine의 compiled parameter 전달
- parameterless local demo 호환
- unit/full/E2E 회귀와 제품 문서

## Out of Scope

- 실제 BUIDL 상품값 확정과 기존 illustrative Element migration (#109)
- Toolkit/Safe config calldata와 gas report (#108)
- 범용 policy DSL 또는 새 predicate primitive (#110)
- KYC/TA PII나 동적 provider state 저장

## Steps

1. 타입과 Registry active/pending storage/getter를 추가한다.
2. schema envelope와 Recipe membership을 bounded compile 단계에서 검증한다.
3. config/parameter를 compiled plan hash와 aligned rules에 포함한다.
4. Engine이 aligned compiled bytes를 Element에 전달한다.
5. registration, invalid config, pending atomic activation과 Engine delivery를 테스트한다.
6. architecture/security/testing/feature/progress 문서를 정렬한다.
7. targeted test, full check와 두 local Anvil E2E를 실행한다.

## Stop Condition

모든 검증이 통과하고 feature가 `passing`으로 전환되며 별도 PR이 생성된 경우 완료한다.

## Result

- Registry targeted 56/56, Engine targeted 38/38, full Foundry 881/881
- full `scripts/check.sh`와 deploy-v3 10/10
- BUIDL-like/Reg-D Anvil E2E 각각 7/7 + dashboard/CLI/RFQ
- TokenPolicyRegistry runtime 23,980 bytes(EIP-170 margin 596 bytes)
- `git diff --check`
