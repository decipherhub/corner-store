# CORE-012 — Safe Element Emergency Replacement

## Outcome

치명적 Element 결함이 발생해도 기존 binding을 덮어쓰거나 timelock을 우회하지 않고,
영향 범위를 중단한 상태에서 새 immutable Element/Recipe/policy version으로 교체한 뒤
검증된 자산만 재개할 수 있게 한다.

## Behavior Lock

- 같은 Element ID와 `(recipeKey, version)` 재등록은 계속 거부한다.
- 중단은 operator가 즉시 수행할 수 있지만 update schedule과 unpause/resume schedule은
  owner/Safe 권한 및 기존 delay를 유지한다.
- Manifest update activation은 SUSPENDED 상태를 보존한다. 검증 전 자동 재개하지 않는다.
- 다른 자산이 같은 이전 Recipe를 사용해도 명시적으로 update하지 않으면 policy와
  동작이 바뀌지 않는다.
- known RFQ nonce 취소는 maker 권한이며, policy update는 취소하지 못한 기존 quote도
  signed policyId mismatch로 무효화한다.

## In Scope

1. full ManifestPolicyConfig update의 Factory owner forwarding
2. Element/Recipe overwrite와 timelock 우회 회귀
3. 두 자산 중 영향 자산만 새 version으로 전환하는 integration test
4. Manifest replacement 뒤 기존 RFQ quote settlement 거부 회귀
5. pause, artifact/checkpoint, Safe update, 검증과 delayed resume 실행 runbook
6. targeted/full checks와 BUIDL-like/Reg-D local E2E

## Out of Scope

- 즉시 unpause 또는 compliance 완화 break-glass 권한
- hosted incident control plane, Safe service API와 signer custody
- schema v4 update artifact/Safe export 자동화(#108)
- 실제 BUIDL-like 상품 profile 값(#109)

## Steps

1. full config forwarding, scoped replacement와 stale quote 회귀 테스트를 추가한다.
2. Factory가 owner-only full semantic update를 Registry로 정확히 전달하게 한다.
3. executable incident replacement runbook과 audit reconciliation을 문서화한다.
4. targeted/full/E2E 검증 후 feature 상태와 진행 문서를 완료 처리한다.

## Stop Condition

기존 ID 재등록과 early activation/resume가 실패하고, suspended 자산만 새
Element/Recipe/policy version으로 전환되며, 다른 자산과 기존 demo는 불변이고, old
RFQ quote가 settlement에서 거부되며, 운영자가 pause부터 검증·재개까지 실행할 수
있는 절차가 있으면 종료한다.
