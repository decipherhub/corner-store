# ADR-010 검토 회신 (개발팀)

- **대상:** ADR-010 (Element 파라미터 소유권과 결정 재현성), PR #90, Proposed 2026-08-26
- **작성:** 개발팀
- **작성일:** 2026-09-07
- **확인 범위:** ADR-010 본문 전체, `src/registry/RecipeRegistry.sol`(직접 검토), `src/registry/ElementRegistry.sol`·`src/compliance/ComplianceEngine.sol`(기 검증된 코드 사실 인용)

---

## 요약

- ADR-010의 G-3(“`registerElement`는 조용히 덮어쓸 수 있다”)는 **작성 시점 기준으로는 정확했으나, 그 사이 main에 반영된 다른 변경으로 이미 닫혔다.** 아래 “먼저” 항목에서 타임라인을 설명한다.
- 그 결과 Q6은 사실상 moot가 되었지만, 대신 “교체가 아예 불가능해졌을 때 버그 있는 element를 어떻게 고치는가”라는, ADR이 묻지 않은 새 운영 질문이 생겼다. 이 질문을 저희가 되돌려 드린다.
- D-3(구현 주소 해시)도 같은 이유로 **더 이상 필요하지 않다는 쪽에 무게가 실린다.** 다만 이는 검증이 필요한 추론이지 결론은 아니다.
- D-1의 핵심 주장(파라미터를 `factsPacked`로 옮기면 `policyId`에 자동으로 들어간다)은 코드로 확인했고 **맞다.**
- Q3·Q8(인터페이스 변경 비용)은 숫자로 답할 수 있고, "지금이 가장 싸다"는 리걸 측 판단을 코드가 뒷받침한다.
- Q7(`RecipeRegistry`)은 저희가 직접 확인했다. 주소 덮어쓰기는 이미 막혀 있고, latest 포인터 전환 통제만 남아 있으나 이를 읽는 production 경로가 없어 현재는 잠재 간극이다.
- Q1·Q2(파라미터를 Manifest로 옮길지, 어떤 형태로)는 저희 선에서 단독으로 결정할 근거가 아직 부족해 반문으로 돌려드린다.

---

## 먼저, 상태 변경 안내: G-3 / Q6은 코드가 그 사이 바뀌었다

ADR-010 §3 G-3은 다음 코드를 인용해 `registerElement`가 기존 elementId의 주소를 조용히 덮어쓸 수 있다고 지적했다.

```solidity
function registerElement(bytes32 elementId, address element) external onlyOwner {
    _elements[elementId] = element; emit Events.ElementRegistered(elementId, element);
}
```

**이 지적은 ADR 작성 시점(2026-08-26)에 검토자가 본 main 기준으로 정확했습니다.** 다만 그 사이 다른 변경으로 상황이 바뀌었습니다.

- 커밋 `4d38b28`("Make compliance policy identities immutable and enforcement compiled")은 **2026-08-23에 작성**되었지만, **main에는 PR #89를 통해 2026-09-04에야 병합**되었습니다.
- 즉 이 커밋은 ADR-010이 작성된 시점(8/26)보다 먼저 만들어졌지만, ADR-010이 검토한 main에는 아직 도달하지 않은 상태였습니다.
- **저희는 이것을 검토자의 실수로 보지 않습니다.** 검토자가 실제로 확인한 main 기준으로는 G-3의 서술이 완전히 옳았고, 그 뒤 이벤트(다른 PR의 병합 시점)에 의해 사실관계가 앞질러진 것뿐입니다. "author error"가 아니라 "overtaken by events"로 기록해 주시면 됩니다.

현재 main의 `src/registry/ElementRegistry.sol:29`는 `_elements[elementId] != address(0)`이면 `Errors.ElementAlreadyRegistered(elementId)`로 revert합니다. 같은 호출에서 metadataHash·versionHash·`defaultAction`도 함께 고정됩니다. 등록 함수는 두 개의 오버로드(`:17-23`)로 존재하며, 그중 2-인자 버전은 `EnforcementAction.BLOCK`을 하드코딩합니다.

**단, 이 수정이 PD-6이 요청한 것을 그대로 준 것은 아니라는 점을 짚어야 합니다.** PD-6이 요청한 것은 timelock + append-only 이력(actor/old/new/reason/effectiveTime) + 역할 분리였습니다. 실제로 반영된 것은 **불변화(immutability)**, 즉 같은 elementId 아래에서는 구현체를 아예 교체할 수 없게 만드는 것입니다. 이것은 한 문제를 닫으면서 다른 문제를 엽니다.

- G-3이 지적한 "덮어쓰기를 통한 조용한 완화" 위험은 **실제로 닫혔습니다.**
- 그래서 Q6("`registerElement`에 timelock을 거는 데 반대 사유가 있는가")은 **사실상 moot에 가깝습니다.** timelock이 막으려던 행위 자체가 이제 불가능합니다.
- 대신 ADR이 묻지 않은 질문이 새로 생깁니다: **배포된 element에 버그가 있으면 어떤 절차로 고치는가?** 현재 코드 기준 유일한 경로는: 새 elementId(예: `A-03-v2`)로 등록 → recipe의 필수 element 목록은 `BaseRecipe`의 생성자 데이터로 불변이라 setter가 없으므로 새 recipe 컨트랙트를 배포 → recipe 재등록 → 영향받는 모든 자산에 대해 `scheduleManifestUpdate`/`activateManifestUpdate`를 1일 timelock으로 실행, 입니다. 이는 이제 **일반 교체 절차이자 동시에 긴급 교체 절차**이기도 합니다. 인시던트 상황에서 이 경로가 감당 가능한지는 저희가 아니라 운영·리걸 쪽 판단이 함께 필요한 질문이라 되돌려 드립니다.
- 추가로: 등록이 1회성이고 2-인자 오버로드가 `BLOCK`을 묵시적으로 고정하기 때문에, **최초 등록이 그 element의 기본 enforcement action을 영구히 확정**합니다. `EnforcementOverrideMode.FORCE_FLAG_ONLY`는 이미 `FLAG_ONLY`가 기본인 element에만 유효하므로, 잘못된 기본값을 잡고 등록하면 새 elementId를 태우지 않고는 고칠 수 없습니다. 이 부분도 위 절차 논의에 포함해 주셔야 합니다.

---

## §7 질문별 답변

### 파라미터 소유권

**Q1. 자산별 값을 Manifest 층으로 옮기는 데 구조적 걸림돌이 있는가.**
**[반문] / [확인 필요]**

저희 선에서 "예/아니오"로 단정할 근거가 아직 없습니다. 방향 자체(Manifest 층 소유)에 반대할 기술적 이유는 지금 보이지 않습니다만, 실제로 옮겼을 때의 가스·스토리지 비용은 실측해야 하는 항목입니다. 다음이 확인되어야 합니다.

- `factsPacked` 확장 시 evaluate 경로의 gas 증가분 (element 개수 × 파라미터 크기에 비례할 것으로 예상되나 측정 전)
- 현재 `Jurisdiction.sol` 같은 element별 저장소를 걷어낼 때 기존 배포와의 마이그레이션 범위 (몇 개 자산이 이미 살아있는 element 저장소 값에 의존하는지)

이 두 가지를 먼저 재보고 다시 논의하는 편이 안전합니다.

**Q2. 옮긴다면 형태는 무엇으로 하는가 (`factsPacked` 확장 / 자유 형식 `bytes` / 부품별 struct).**
**[반문] / [확인 필요]**

이것도 Q1의 답이 나온 뒤에야 의미 있게 결정할 수 있는 사안이라 지금 임의로 방향을 정하지 않겠습니다. 세 안의 트레이드오프는 대략 이렇습니다.

- `factsPacked` 확장: 이미 해시 재료라 D-1의 이점을 가장 직접적으로 취하지만, 스키마가 커질수록 팩킹/언패킹 복잡도가 오릅니다.
- 자유 형식 `bytes`: 유연하지만 각 element가 자기 디코딩 로직을 가져야 해서 D-5(술어 유형 정규화)와 충돌할 여지가 있습니다.
- 부품별 struct: 타입 안전성은 좋으나 `IComplianceElement` 인터페이스가 element 종류마다 달라지는 문제가 생길 수 있어, D-2("하나의 구현이 여러 elementId를 서빙")의 취지와는 다소 어긋납니다.

저희 의견으로는 **D-5(술어 유형 정규화)를 어느 정도 먼저 그려본 뒤 형태를 정하는 것이 순서상 맞다**고 봅니다만, 이는 제안이지 결론이 아닙니다. 리걸/PM 쪽에서 우선순위상 D-5를 이번 라운드에 넣을지부터 논의가 필요합니다.

**Q3. `check`에 `elementId`를 추가하는 인터페이스 변경의 현재 시점 비용은 어느 정도인가.**
**[답변]**

숫자로 답합니다.

- 인터페이스 선언 변경: 1곳, `src/interfaces/compliance/IComplianceElement.sol:7`
- `src/compliance/elements/` 아래 `.sol` 파일 26개 중 base class 2개(`BaseElement.sol`, `BaseStatefulElement.sol`)를 빼면 **구체 element는 24개**이고, `function check(` 선언은 base class 1개(`BaseElement.sol`)를 포함해 총 25개 파일에서 고쳐야 합니다. (ADR은 "25개 부품"이라 썼는데, 구체 element 수 자체는 24개이고 25는 base class를 포함한 파일 수입니다. 결론에 영향 없는 사소한 차이입니다.)
- 엔진 쪽 호출부는 **정확히 한 곳**, `src/compliance/ComplianceEngine.sol:243`(`_checkElementRule`, `:234-244`) 뿐입니다.
- 테스트는 `test/` 아래 `.check(`을 참조하는 파일이 26개입니다.

엔진 쪽 변경은 한 줄 수준이고, 비용의 대부분은 25개 시그니처 수정 + 26개 테스트 파일 수정입니다. 둘 다 기계적인 작업이라 리스크보다는 작업량 문제에 가깝습니다.

### 결정 재현성

**Q4. `policyId`에 적용 파라미터와 Element 구현 주소 해시를 포함하는 안(D-3 포함)에 대한 판단. 가스 제약이 있다면 commit 경로 한정 계산이 대안이 되는가.**
**[답변]** (두 부분으로 나눠 답합니다)

*파라미터 해시 쪽:* `src/compliance/ComplianceEngine.sol:478-496`의 `_accumulatePolicyId`를 확인했습니다. 현재 해싱 재료는 정확히 `acc`, `token`, `policyReg.compiledPlanHashOf(token)`, `manifest.supportedEngines`, `manifest.factsPacked`, `manifest.coverageScope`, `manifest.fullManifestHash`이며, `bindings` 인자는 선언만 되어 있고 실제로는 미사용입니다(`:484`의 `bindings;` no-op문으로 경고만 없앤 상태이고, binding 세부는 `compiledPlanHashOf`를 통해서만 간접적으로 들어갑니다).

**여기서 D-1의 핵심 주장이 코드로 확인됩니다: `manifest.factsPacked`는 이미 해싱 재료입니다.** 그래서 자산별 파라미터가 `factsPacked`로 들어가면, 별도 작업 없이 `policyId`에 자동으로 포함됩니다. G-2의 절반이 D-1만으로 닫힌다는 ADR §2-bis의 주장은 정확하고, 저희가 코드로 재확인했습니다.

*구현 주소 해시(D-3) 쪽:* 이 부분은 사정이 다릅니다. `src/compliance/ComplianceEngine.sol:62-64`에서 `policyReg`, `elementReg`, `recipeReg`가 전부 `public immutable`이고, `:72-75`의 생성자에서 한 번만 설정됩니다. "먼저" 항목에서 설명한 element 등록의 1회성 불변화와 이 사실을 합치면, **하나의 배포된 엔진 기준으로 `elementId → 구현 주소` 매핑이 영구히 고정됩니다.** 즉 elementId를 해싱하는 것(`compiledPlanHashOf`가 이미 하고 있는 일)이 구현 주소를 해싱하는 것과 **그 엔진 배포 안에서는 증명 가능하게 동치**입니다.

그래서 D-3이 막으려던 간극("등록부 덮어쓰기로 판정 코드가 바뀌는데 policyId는 그대로")은 element 불변화라는 다른 경로로 이미 닫혔다고 봅니다. 남는 경우는 **엔진 자체를 통째로 새로 배포하는 것**뿐인데, 이는 새 배포라는 훨씬 눈에 띄는 사건이고, PD-6이 이미 "router/engine 교체"에 요구하는 거버넌스(multisig + timelock)로 커버되는 영역입니다. 그래서 저희 결론은 "예, D-3을 추가합시다"가 아니라 **"D-3이 원래 노리던 이유로는 더 이상 필요 없어 보인다"**입니다. 다만 이것은 저희가 지금 편 추론이라, 검토 부탁드리는 것이지 결론으로 못박는 것은 아닙니다. (가스 절약 관점에서도 D-3을 넣지 않는 편이 유리합니다.)

**Q5. 현재 구조에서 감독기관 질의 대응 절차를 이미 상정하고 있는가.**
**[확인 필요]**

`docs/architecture/` 아래에 이런 절차가 문서화되어 있는지 이번 검토에서 확인하지 못했습니다. ADR이 제안한 대로, event log 재구성을 전제로 한다면 그 전제 자체를 명문화해 두는 편이 맞다고 봅니다만, 현재 있는지 없는지부터 확인이 필요한 항목이라 단정하지 않겠습니다.

### 교체 권한

**Q6. `registerElement`에 timelock과 확장 event를 거는 데 반대 사유가 있는가. 운영 중 긴급 교체 시나리오를 상정하고 있는지.**
**[답변]**

"먼저" 항목에서 설명한 대로, 이 질문은 사실상 moot에 가깝습니다. `registerElement`는 이제 같은 elementId에 대해 재등록 자체가 불가능하므로(`ElementRegistry.sol:29`), timelock을 걸어서 막을 "완화 경로"가 더 이상 존재하지 않습니다. 반대할 이유가 없다기보다, **막을 대상이 이미 없어졌습니다.**

다만 그 대가로 새로운 질문이 생겼다는 점을 다시 강조합니다: 긴급 교체 시나리오를 상정하고 있는지 물으셨는데, 현재 코드가 상정하는 유일한 경로는 "먼저" 항목에 적은 새 elementId 발급 + 새 recipe 배포 + 전체 자산 manifest 갱신(1일 timelock)입니다. 이것이 인시던트 대응 시간 안에 실행 가능한 절차인지는 저희만의 판단이 아니라 운영 쪽과 함께 정해야 할 사안입니다.

**Q7. `RecipeRegistry`도 같은 상태인지(본 검토에서 미확인). 같다면 함께 처리하는 것이 맞는가.**
**[답변]** (저희가 직접 확인)

`src/registry/RecipeRegistry.sol`을 읽었습니다. 결론부터: **G-3과 완전히 같지는 않지만, 같은 계열의 간극이 일부 남아 있습니다.**

- **주소 덮어쓰기 자체는 막혀 있습니다.** `_registerRecipe`의 `:70`에서 `_recipes[recipeKey][version] != address(0)`이면 `Errors.RecipeAlreadyRegistered`로 revert합니다. 즉 특정 `(recipeKey, version)` 조합에 바인딩된 주소는 한 번 정해지면 덮어쓸 수 없습니다. 이 점에서는 (수정 이후의) `ElementRegistry`와 같은 원칙, 즉 "동일 식별자 재등록 불가"가 이미 적용돼 있습니다.
- **alias/key 하이재킹도 막혀 있습니다.** `:54-69`에서 `aliasHash↔recipeKey`, `recipeKey↔legacyKey`, `recipeKey↔recipeId`의 상호 일관성을 각각 검사해, 기존 alias나 key를 다른 정체성으로 재바인딩하려 하면 `RecipeAliasCollision`/`RecipeKeyIdCollision`으로 revert합니다.
- **그러나 "무엇이 최신(latest)인가"는 즉시, timelock 없이 바뀔 수 있습니다.** `:77-80`에서 새로 등록하는 `version`이 기존 `_latestVersions[recipeId]`보다 크면 `_latestRecipes[recipeId]`가 그 자리에서 새 주소로 갱신됩니다. `recipeOf(recipeId)`(버전 없이 조회하는 오버로드, `:86-88`)를 호출하는 쪽은 그 즉시 새 구현으로 갈아탑니다. 기존 버전의 매핑 자체는 그대로 남지만(불변), 운영에서 실제로 참조하는 "현재 recipe"는 owner 한 명의 트랜잭션 한 번으로 즉시 바뀝니다. `TokenPolicyRegistry`의 `MIN_MANIFEST_DELAY = 1 days` 같은 timelock이 `RecipeRegistry`에는 없습니다. 다만 범위를 정확히 적어둡니다: 현재 코드에서 이 1-인자 오버로드를 호출하는 production 경로는 없습니다. `recipeOf`를 호출하는 곳은 `src/compliance/ComplianceEngine.sol:198`, 같은 파일 `:411`, `src/registry/TokenPolicyRegistry.sol:443` 세 곳뿐이고 모두 `(binding.recipeId, binding.recipeVersion)`을 명시하는 2-인자 오버로드를 씁니다. 즉 latest 포인터 전환은 오늘의 컴플라이언스 판정이나 Manifest 컴파일 결과를 바꾸지 않습니다.
- **이벤트도 actor/old value/reason/effectiveTime을 담지 않습니다.** `:82-83`에서 emit되는 두 이벤트, `RecipeRegistered(recipeId, version, recipe)`와 `RecipeRegisteredV2(recipeKey, aliasHash, recipeId, version, recipe)`는 새 값만 담을 뿐, 이전 값이 무엇이었는지, 왜 바꿨는지, 언제부터 유효한지는 이벤트 자체에서 알 수 없습니다.

정리하면: **주소 재사용(같은 identifier에 다른 주소를 덮어쓰는 것)은 이미 막혀 있어 G-3이 지적한 원래 형태의 문제는 없습니다.** 하지만 **버전 번호를 올려 "최신"을 즉시 재지정할 수 있는 경로는 열려 있고, 여기에는 timelock도 없고 PD-6이 요구하는 actor/old/reason/effectiveTime 이력도 없습니다.** 다만 위에 적은 대로 이 포인터를 읽는 production 경로가 현재 없으므로, 이 간극은 **잠재적이며 오늘의 판정 경로에는 도달하지 않습니다.** 지금 당장의 결함이라기보다, 외부 integrator나 향후 코드가 1-인자 오버로드를 쓰기 시작하는 순간 실재하게 되는 종류의 위험입니다. **따라서 함께 처리하는 것이 맞다고 보되, 우선순위는 D-4(ElementRegistry 쪽)보다 낮게 두는 것을 제안합니다.** 다만 처방은 element와 살짝 달라야 할 수 있습니다. element처럼 완전히 불변화하면 recipe의 정상적인 버전 업(예: 부품 목록 변경 없는 버그 픽스)까지 막혀 새 recipeId를 계속 발급해야 하므로, "버전 상승 자체는 허용하되 latest 포인터 전환에만 timelock + 확장 이벤트를 건다"는 절충이 더 맞을 수 있습니다. 이 설계는 저희 쪽에서 별도로 짧은 안을 만들어 공유하겠습니다.

### 우선순위

**Q8. 위 항목을 데모 전 / 데모 후 / production 전 중 어디에 배치하는가.**
**[답변]**

리걸 측 판단("1·3이 지금 가장 싸다")에 코드 근거로 동의합니다. Q3에서 확인한 대로 `check`에 `elementId`를 추가하는 변경은 엔진 쪽 호출부가 단 한 곳(`ComplianceEngine.sol:243`)이고, 나머지는 25개 파일의 시그니처 수정 + 26개 테스트 파일 수정이라는, 리스크가 낮고 범위가 명확한 기계적 작업입니다. element/recipe 개수가 지금보다 늘어날수록 이 작업의 비용은 선형으로 커지므로, **지금이 가장 쌀 때라는 판단에 저희도 동의**합니다.

배치 제안:

- **데모 전:** Q3/D-2 (인터페이스에 `elementId` 추가). 지금이 제일 싸고, 이후 결정(D-1 형태, D-5 정규화)의 전제가 되는 변경이라 먼저 넣는 편이 낫습니다.
- **데모 후, production 전:** D-1(Manifest 이관, Q1/Q2 결론이 선행), Q7에서 제기한 RecipeRegistry 처리.
- **production 전:** Q4/D-3은 위 논의대로 "필요 없음" 쪽에 무게가 있어 굳이 넣지 않아도 될 가능성이 높습니다. 다만 D-1 형태가 확정된 뒤 다시 판단하는 편이 안전합니다.

---

## 외부 자문 의견에 대하여

"정책 설정을 온체인 컨트랙트로 정의하는 것이 옳은 접근"이라는 외부 자문 의견은 감사히 받았습니다. 다만 이 의견이 ADR-010이 열어둔 질문에 직접 답하지는 않는다는 점을 말씀드리고 싶습니다. 지금 논의 중인 두 대안, 즉 `TokenPolicyRegistry`(Manifest)에 저장하는 안과 element 컨트랙트 저장소에 두는 안은 **둘 다 이미 완전히 온체인**입니다. 실제 질문은 "온체인이냐 아니냐"가 아니라, **온체인 시스템 안에서 그 값이 어디에 있고, 그 위치가 `policyId`에 들어가는지**입니다. 즉 이 자문 의견은 저희가 이미 택한 아키텍처 방향(온체인 컨트랙트 기반 정책)을 지지하는 유용한 입력이지만, Q1-Q8이 다루는 축과는 다른 축의 질문에 대한 답이라, 이걸로 Q1-Q8이 해소된 것으로 기록하지는 않으셨으면 합니다.

---

## 다음 단계 제안

1. Q1/Q2: `factsPacked` 확장 시 gas 실측, 기존 element 저장소 값의 마이그레이션 범위 조사를 저희 쪽에서 진행하고, 결과를 갖고 형태(Q2)를 다시 논의합니다.
2. Q3/D-2: 데모 전 착수 가능한 낮은 리스크 작업이므로, 일정에 넣어도 좋습니다.
3. Q4: D-3(구현 주소 해시)은 "이제 불필요하다"는 저희 추론을 리걸/거버넌스 관점에서 한 번 더 검증해 주시면, 확정 여부를 정하겠습니다.
4. Q5: `docs/architecture/`에 감독기관 질의 대응 절차가 있는지 저희가 확인하고 회신하겠습니다.
5. Q6/Q7: element 교체가 불가능해진 지금, "배포 후 버그 발견 시 대응 절차"와 "RecipeRegistry의 latest 포인터 전환 통제"를 묶어서 짧은 설계안으로 정리해 다음 라운드에 올리겠습니다.
6. 본 회신 내용을 반영해 `decision-register.md`의 ADR-010 행을 업데이트하는 것은 위 항목들의 결론이 난 뒤에 진행하는 것이 맞다고 봅니다.
