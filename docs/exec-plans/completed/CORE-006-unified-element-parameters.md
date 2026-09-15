# CORE-006 — Unified Element Parameter Interface

## Goal

Issue #102를 구현한다. 모든 in-repo Element를 하나의 parameter-capable ABI로
migration하고, parameter schema capability와 크기 상한을 immutable metadata로
고정한다.

## In Scope

1. `IComplianceElement.check(..., context, parameters)` 단일 ABI
2. Element metadata의 schema ID/version/max bytes/required capability
3. parameterless Element의 non-empty parameter fail-closed
4. Element Registry의 schema metadata validation/hash binding
5. Engine, CLI ABI, 모든 Element/mock/test call site migration
6. interface/schema conformance 회귀 테스트와 문서 갱신
7. local `buidl-like`와 `reg-d` Anvil 흐름 유지

## Out of Scope

- Manifest별 parameter 저장과 compiled-rule 전달(#103)
- generic MinimumTradeAmount migration과 predicate library(#110/#109)
- policyId의 address/runtime-code binding(#105)
- Recipe latest API 제거(#104)
- 기존 GIWA 배포 ABI 호환 adapter

## Behavior Lock

- 기존 Element는 empty parameters에서 기존 판정과 reason code를 유지한다.
- 기존 Element는 non-empty parameters를 허용하지 않고 공통 invalid-parameter
  reason으로 fail-closed한다.
- Engine은 #103 전까지 compiled Element에 empty parameters만 전달한다.
- parameter capability가 잘못 선언된 Element는 Registry 등록 단계에서 거절한다.

## Implementation Steps

1. 기존 Registry/Engine/Element targeted tests를 baseline으로 실행한다.
2. metadata와 Registry validation test를 먼저 추가한다.
3. BaseElement에 공통 parameter envelope validation을 추가한다.
4. 모든 Element 구현과 직접 구현 mock을 새 ABI로 migration한다.
5. Engine과 CLI call site를 empty parameter로 정렬한다.
6. targeted tests, full Foundry, Toolkit/CLI, `scripts/check.sh`와 두 Anvil profile을
   순서대로 실행한다.
7. `FEATURES.md`, `PROGRESS.md`와 관련 architecture/security/testing 문서를 갱신한다.

## Result

- 24개 in-repo Element를 `BaseElement`의 공통 parameter envelope로 migration했다.
- Registry가 schema ID/version/required/max bytes 정합성과 4096-byte 전역 상한을
  검증하고 metadata hash에 capability 전체를 포함한다.
- Engine, CLI, local RFQ demo와 public-testnet demo는 #103 전까지 empty parameter를
  전달하며 기존 판정 결과를 유지한다.
- parameter envelope 실패는 recipeId 0, elementId, `uint32.max` 조합의 공통
  reason으로 반환되고 CLI reason table에서 식별된다.
- Manifest별 parameter 저장, canonical parameter hash와 compiled-plan delivery는
  계획대로 #103에 남겼다.

## Verification

- `forge test --offline --match-path test/unit/registry/ElementRegistry.t.sol`
- `forge test --offline --match-path test/unit/compliance/Engine.t.sol`
- `forge test --offline --match-path 'test/unit/compliance/elements/*.t.sol'`
- `forge test --offline`
- `npm test --prefix services/cli`
- `npm test --prefix services/toolkit`
- `scripts/check.sh`
- `scripts/e2e-anvil.sh --profile buidl-like`
- `scripts/e2e-anvil.sh --profile reg-d`
- `git diff --check`

모든 항목 통과. Foundry targeted 결과는 BaseElement 5/5, Registry 9/9, Engine
37/37, all-Element 577/577이며 full suite는 877/877이다. `buidl-like`와 `reg-d`
E2E는 각각 7/7 scenario와 dashboard/CLI/RFQ flow를 통과했다. 로컬 nightly
formatter가 main의 기존 두 script와 다른 형식을 요구하므로 `scripts/check.sh`
실행 중에만 해당 파일을 임시 포맷하고 검증 후 원복했다.
