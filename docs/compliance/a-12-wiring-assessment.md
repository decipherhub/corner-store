# A-12 (Red Flag Knowledge Bar) 배선 평가

## 요약

"컨트랙트는 이미 있고 목록에 한 줄만 추가하면 된다"는 정확하지 않다. **전체 스택 재배포가 필요 없다는 점은 PM의 지적이 맞다**: 이 시스템은 레지스트리에 트랜잭션을 쌓는 모델이지, 스택을 통째로 다시 배포하는 모델이 아니다. 하지만 실제로 필요한 작업은 (1) 새 Recipe 컨트랙트 배포 (기존 Recipe는 element 목록을 수정할 수 없음), (2) 되돌릴 수 없는 레지스트리 등록 결정, (3) 자산별로 1일 timelock이 걸리는 Manifest 갱신, (4) 아직 결론나지 않은 법적 쟁점(게이팅 여부)까지 걸려 있다. 특히 기존에 준비된 배포 스크립트를 그대로 실행하면 "A-12-v1" elementId가 잘못된 기본값(BLOCK)으로 영구 고정되는 함정이 있다 (아래 경고 참조). "한 줄 추가 + 재배포"로 요약하면 이 네 가지가 전부 가려진다.

## 현재 상태

- `RedFlagKnowledgeBar.sol`은 구현되어 있다 (`src/compliance/elements/RedFlagKnowledgeBar.sol:82`, `ELEMENT_ID = "A-12-v1"`). 단위 테스트도 20개 함수로 존재한다 (`test/unit/compliance/elements/RedFlagKnowledgeBar.t.sol`).
- `check()`는 `pure` 함수로 파라미터와 무관하게 항상 `(true, bytes32(0))`을 반환한다 (`src/compliance/elements/RedFlagKnowledgeBar.sol:211-218`). 즉 A-12는 **MARK만 하고 GATE(차단)는 하지 않는다.** 붉은 깃발은 `raiseFlag`/`markUncertain` (둘 다 `onlyOperator`, 같은 파일 176-181행·186-191행)으로 out-of-band 기록되고, `screen`/`dispositionOf` (228-241행, 244-246행)로 조회된다.
- `RegD506cRecipe._elements506c()`는 정확히 9개 element를 하드코딩한다: A-01, A-02, A-03, A-04, A-05, B-01, B-02, C-01, E-01 (`src/compliance/recipes/RegD506cRecipe.sol:19-27`). A-12는 이 목록에 없다.
- `docs/compliance/element-data-source-matrix.md`에는 A-12 항목 자체가 없다 (wave-3 element들 이전에 작성된 문서).

## 실제로 필요한 단계

1. **새 Recipe 컨트랙트 배포.** `BaseRecipe`는 `_elements`를 생성자에서만 채우고 setter가 없다 (`src/compliance/recipes/BaseRecipe.sol:11,13,16,28`). 즉 배포된 Recipe의 element 목록은 불변이다. A-12를 추가하려면 `RegD506cRecipe`를 고치는 게 아니라 새 (recipeId, version) 조합으로 새 Recipe 컨트랙트를 배포해야 한다.
2. **ElementRegistry에 A-12 등록 (되돌릴 수 없는 결정).** `registerElement`는 2-오버로드다: 2-인자 버전은 `EnforcementAction.BLOCK`을 하드코딩하고 (`src/registry/ElementRegistry.sol:17-18`), 3-인자 버전은 `defaultAction`을 명시적으로 받는다 (`src/registry/ElementRegistry.sol:21-22`). `_registerElement`는 이미 등록된 elementId면 `Errors.ElementAlreadyRegistered`로 되돌린다 (`src/registry/ElementRegistry.sol:29`). 등록은 elementId당 단 한 번, 되돌릴 수 없다. **어떤 오버로드로, 어떤 defaultAction으로 등록할지가 이 단계의 핵심 결정이다** (아래 경고 참조).
3. **TokenPolicyRegistry로 Manifest 갱신, 자산마다.** 바인딩은 등록/갱신 시점에 `CompiledBindingPlan[]`/`CompiledElementRule[]`로 컴파일되어 저장되고 (`_compileInto`, `src/registry/TokenPolicyRegistry.sol:430`), 거래 시점에 다시 조회하는 구조가 아니다. 자산의 Manifest를 바꾸려면 `scheduleManifestUpdate` (`src/registry/TokenPolicyRegistry.sol:198-220`)를 호출한 뒤 `MIN_MANIFEST_DELAY = 1 days` (`src/registry/TokenPolicyRegistry.sol:28`)가 지나야 `activateManifestUpdate` (`onlyOperator`, `src/registry/TokenPolicyRegistry.sol:262`)로 반영할 수 있다. 이 절차를 **A-12를 붙이려는 자산마다** 반복해야 한다.
4. **"레귤레이션 번들 목록" 파일 갱신.** PM이 말하는 목록은 `services/toolkit/examples/corner-store.production-onboarding.json`이고, `services/toolkit/src/production-onboarding.ts`가 검증한다. 여기 항목은 맨 id 문자열이 아니다: `elements[]`는 `{elementId, implementation(배포 주소), defaultAction, versionHash}` 구조이고 (`services/toolkit/src/production-onboarding.ts:56-59`), `recipes[]`는 `implementation`, `requiredElements[]`, alias/key 필드를 가진다 (`services/toolkit/src/production-onboarding.ts:71`). 검증기는 `recipes[i].requiredElements`가 미리 선언된 `elements[]`와 일치하는지 교차 검증한다 (`services/toolkit/src/production-onboarding.ts:306-316`). 여기에 더해 `manifest.fullManifestHash` (`:83`)와 `recipeBindings[]`도 함께, 일관되게 바뀌어야 한다. "한 줄"이 아니라 여러 필드가 서로 맞물려 바뀌어야 하는 구조다.
5. **오프체인 데이터 공급 계층 설계 (별도 트랙).** `RedFlagKnowledgeBar` natspec은 프로덕션 A-12가 A-06(계열사), A-03/A-13(청구), A-04(소유 클러스터), C-08/D-01(임계값), NAV 오라클을 교차 참조하는 오프체인 서베일런스/분석 레이어를 전제한다고 명시한다 (`src/compliance/elements/RedFlagKnowledgeBar.sol:57-68`). 오늘 시점엔 이 레이어가 전혀 배선되어 있지 않고, 100% 운영자 수기 attestation(`raiseFlag`/`markUncertain` 직접 호출)에 의존한다. 이는 위 1~4번과 별개로 진행되어야 하는 작업이다.

## 경고: BLOCK 기본값 함정

`tools/deploy-wave3/DeployWave3Elements.s.sol:40`은 A-12를 2-인자 오버로드로 등록한다.

```solidity
registry.registerElement(bytes32("A-12-v1"), address(new RedFlagKnowledgeBar()));
```

2-인자 오버로드는 `defaultAction`을 무조건 `EnforcementAction.BLOCK`으로 넣는다 (`src/registry/ElementRegistry.sol:17-18`). 그런데 A-12는 설계상 절대 차단하지 않는 element다 (의도된 기본값은 FLAG_ONLY). 등록이 elementId당 1회·불가역이므로 (`src/registry/ElementRegistry.sol:29`, `ElementAlreadyRegistered`), 이 스크립트를 지금 그대로 실행하면 **"A-12-v1"이 영구적으로 BLOCK 기본값에 묶인다.** 고칠 수 있는 유일한 방법은 "A-12-v2" 같은 새 elementId를 다시 태우는 것뿐이다.

더 나쁜 건, 이 상태를 나중에 오버라이드로도 못 고친다는 점이다. `EnforcementOverrideMode.FORCE_FLAG_ONLY`는 element의 불변 기본값이 **이미 FLAG_ONLY인 경우에만** 허용된다 (`src/types/ComplianceTypes.sol:56-62`). 실제 검사도 그렇게 되어 있다: 기본값이 FLAG_ONLY가 아니면 `LooseningForbidden`으로 되돌린다 (`src/registry/TokenPolicyRegistry.sol:505-507`). 즉 BLOCK으로 잘못 등록해놓고 나중에 FORCE_FLAG_ONLY 오버라이드로 땜질하는 경로 자체가 막혀 있다.

오늘 이 함정이 아무 사고도 안 내는 이유는 단 하나, `check()`가 무조건 `true`를 반환해서 BLOCK 기본값이 실제로 트리거될 일이 없기 때문이다 (`src/compliance/elements/RedFlagKnowledgeBar.sol:211-218`). 이 스크립트는 기본 Foundry 스크립트 탐색 범위 밖에 있는 opt-in 스크립트이고, 실행해도 어떤 Recipe에도 element를 추가하지 않는다 (`tools/deploy-wave3/DeployWave3Elements.s.sol:17-19`). 그래서 A-12는 오늘 시점 어떤 기본 데모/테스트넷 환경에도 배포·등록되어 있지 않다. 하지만 "일단 한번 실행해보자"는 시도 자체가 위 함정을 되돌릴 수 없이 발동시킨다는 점은 그대로다.

## 차단 요인

### 엔지니어링 차단 요인

- Recipe 불변성: `BaseRecipe`에 element 목록 setter가 없어 새 컨트랙트 배포가 강제된다 (`src/compliance/recipes/BaseRecipe.sol:11,13,16,28`).
- 레지스트리 등록의 불가역성과 오버로드 선택: 잘못된 오버로드/기본값 선택이 영구적이다 (`src/registry/ElementRegistry.sol:17-29`).
- Manifest 컴파일 모델과 타임락: 자산마다 `scheduleManifestUpdate` → 1일 대기 → `activateManifestUpdate`를 반복해야 한다 (`src/registry/TokenPolicyRegistry.sol:28,198-220,262,430`).
- 온보딩 번들 스키마의 다중 필드 일관성: element/recipe/manifest/recipeBindings가 함께 갱신되고 교차 검증된다 (`services/toolkit/src/production-onboarding.ts:56-59,71,83,306-316`).
- 오프체인 서베일런스 데이터 공급 레이어 부재: 오늘은 운영자 수기 attestation뿐이다 (`src/compliance/elements/RedFlagKnowledgeBar.sol:57-68`).

### 법적/설계 차단 요인

- ADR-010 §10은 "A-12 미배선"을 본 ADR 범위 밖 항목으로 명시하고, 리걸 사유로 별도 제기 예정이라고 적어놓았다 (branch `origin/docs/adr-010-element-parameter-ownership`, PR #90, `docs/decisions/ADR-010-element-parameter-ownership.md:289`). 이어지는 문장은 이유를 밝힌다: 신뢰 발급자(trusted issuer) 증명을 판정 입력으로 소비하려면 게이팅형 위험신호 감시가 함께 있어야 방어가 성립한다는 검토 결과가 있다 (`docs/decisions/ADR-010-element-parameter-ownership.md:291`).
- **여기서 정의 자체가 아직 안 맞는다.** 지금 구현된 A-12는 mark-only (비-게이팅)이다 (`src/compliance/elements/RedFlagKnowledgeBar.sol:211-218`). 반면 ADR-010 §10의 법적 논거는 게이팅 메커니즘을 요구한다. `docs/compliance/spec-sheets/A-12_willful-blindness.spec.md:6,15`도 여전히 A-12를 "컨트랙트 미구현, target 명세"로 기술한다. 즉 A-12가 최종적으로 mark 전용이어야 하는지, 아니면 게이팅 element여야 하는지 자체가 아직 결론나지 않았다. 이 질문이 안 풀린 채로 배선을 진행하면, 배선 자체를 다시 바꿔야 할 수 있다.

## 권고

- 이번 데모를 위해 A-12를 배선하지 않는다.
- ADR-010 §10의 게이팅 여부 질문을 먼저 정리한다. mark-only로 남길지 게이팅으로 갈지에 따라 1~4단계의 구체적 구현(특히 defaultAction 선택과 Recipe 설계)이 달라진다.
- 법적 결론이 나기 전에는 `tools/deploy-wave3/DeployWave3Elements.s.sol`을 그대로 실행하지 않는다. 지금 실행하면 "A-12-v1" elementId가 잘못된 BLOCK 기본값으로 영구 소모된다. 실행이 필요해지면 그 전에 2-인자 오버로드를 3-인자 오버로드(`defaultAction: FLAG_ONLY`)로 바꿔야 한다.
