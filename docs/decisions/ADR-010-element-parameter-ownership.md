# ADR-010 — Element 파라미터 소유권과 결정 재현성 (ADR-006 불변식의 구현 정합)

- **상태:** Proposed (2026-08-26) — 개발팀 검토 요청
- **제안자:** 승준(리걸/PM)
- **유형:** 구현 정합 + 거버넌스 일관성 (새 설계 제안 아님)
- **연계:** ADR-006(자산 일반성 불변식) · ADR-007 PD-1·PD-3·PD-5·PD-6 · ADR-008
- **적용 범위:** `src/compliance/elements/`, `src/compliance/ComplianceEngine.sol`, `src/registry/ElementRegistry.sol`
- **비적용 범위:** RFQ/execution 경로, pricing·risk, 개별 부품의 법률 요건 그 자체

---

## 1. 배경 — 이 문서가 새 제안이 아닌 이유

ADR-006(Accepted, 2026-06-17)이 이미 다음을 불변식으로 못 박았다.

> **불변식 1.** 자산별 값은 Manifest 입력으로만. 면제 framework·**허용 관할**·보유자 한도·전매 경로·보고 여부·허용 엔진·restricted 여부 등은 모두 `Manifest.*`에서 읽는다. **element/recipe 코드에 상수로 하드코딩 금지.**
>
> **불변식 2.** Element·Recipe 로직은 자산 무관. 자산 분기는 *Manifest 값에 의한 분기*이지 *자산 ID 분기*가 아니다.
>
> **§4.** 개발팀: element/recipe 컨트랙트는 *Manifest를 인자로 받는 순수 함수*로 구현.

그리고 ADR-006 §5는 열린 질문 하나를 남겨두었다.

> **Manifest 스키마 확정**: 위 자산별 값들을 담는 Manifest 필드 정의(B-01과 연계).

**이 열린 질문이 미결인 채로 구현이 진행되면서, 자산별 값이 갈 곳을 못 찾고 부품 저장소에 자리 잡았다.** 본 ADR은 새 방향을 제안하는 것이 아니라, ADR-006 §5를 닫고 불변식 1·2를 구현에 반영하는 방법을 논의하기 위한 것이다.

같은 검토 과정에서 ADR-007 PD-6(거버넌스·timelock)과 `ElementRegistry` 사이의 간극도 하나 발견해 함께 올린다.

**확인 범위.** 2026-08-26 기준 `main`. `src/compliance`(engine·elements·recipes), `src/registry`, `src/auth/Governed.sol`, `src/types/ComplianceTypes.sol`. 테스트는 보지 않았다.

---

## 2. 기준점 — `TokenPolicyRegistry`는 이미 옳게 되어 있다

본 문서의 논지는 "통제를 새로 만들자"가 아니다. Manifest 층에는 PD-6·PD-7이 요구한 것이 이미 구현되어 있다.

| PD-6·PD-7 요구 | `TokenPolicyRegistry` 구현 |
|---|---|
| 완화·재개는 timelock | `MIN_MANIFEST_DELAY = 1 days`, `_requireReady` |
| append-only 이력 + actor + reason + effective time | `_recordHistory`가 직전 `historyHash`를 물고 가는 해시 사슬 |
| 역할 분리 | `declaredBy`(onlyOwner) / `approvedBy`(onlyOperator) |
| 조임은 즉시, 완화는 제한 | `setFact`의 `LooseningForbidden`, `PROPOSED`에서만 |
| 조용한 재분류 차단 | `setUnregulated`는 `UNKNOWN`에서만 |

**아래 세 관찰은 전부 "이 통제를 우회하는 경로"에 관한 것이다.**

---

## 2-bis. 관찰 셋의 관계 — 먼저 읽을 것

아래 세 관찰은 평행한 결함 목록이 아니다. **뿌리가 하나이고 증상이 둘이며, 그중 하나는 결함이라기보다 방향 선택의 근거다.**

```
G-1 (자산별 설정값이 부품 저장소에 있음) ─┐
                                          ├─→ G-2 (판정 재현 불가)
G-3 (Element 교체에 통제 없음)            ─┘
```

- **G-1과 G-3이 원인**이고, **G-2는 그 둘이 만드는 증상**이다.
- G-2는 독립된 결함이 아니라 **G-1을 어느 방향으로 고칠지를 가르는 근거**다. §5에서 D-1(Manifest 이관)을 택한 이유가 여기 있다.

### 왜 G-2가 「근거」인가

G-1만 놓고 보면 **(a) `asset`을 키로 부품 내부에 자산별 설정을 두는 방법**으로 충분히 해결된다. ERC-3643이 실제로 그렇게 한다 — 모듈이 `msg.sender`(per-token ModularCompliance)를 테넌트 키로 써서 `_maxBalance[msg.sender]`·`_allowedCountries[msg.sender][country]` 형태로 나눠 저장한다. 그 결과 배포 수가 규칙 수에 묶이고 재사용성 문제가 사라진다.

그러나 (a)로 가면 **설정값이 여전히 부품 저장소에 남아 `policyId` 재료 밖이다. G-1은 풀리고 G-2는 남는다.** 반면 Manifest로 옮기면 그 값이 이미 해시 재료이므로 G-2가 함께 닫힌다.

> ⭐ **정리하면 「Manifest로 옮기자」의 근거는 배포 수가 아니라 판정 재현성이다.** 배포 수만 놓고 보면 업계 표준인 (a)로도 충분하다. 본문 §2-2의 배포 수 논거는 그래서 부차적이다.

### G-2의 잔여분은 G-1이 아니라 G-3 소관이다

설정값을 전부 Manifest로 옮겨도, `ElementRegistry`에서 `A-03-v1`이 가리키는 **주소**가 바뀌면 판정 코드가 통째로 달라지는데 `policyId`는 그대로다. 이 잔여분은 파라미터 위치와 무관하며 D-3(구현 주소 해시 포함)이 별도로 처리한다.

### 그래서 실제 조치는 둘 + 하나다

| 조치 | 무엇을 닫나 |
|---|---|
| **D-1** 설정값 Manifest 이관 | G-1 전부 + G-2의 절반 |
| **D-4** 등록부 timelock·이력 | G-3 |
| **D-3** 결정 해시에 구현 주소 지문 | G-2의 나머지 절반 |

---

## 3. 관찰 (G-1·G-3 = 원인 / G-2 = 증상이자 방향 선택의 근거)

### G-1. 자산별 정책값이 공용 Element 저장소에 있다 (ADR-006 불변식 1·2)

`Jurisdiction.sol`(A-02-v1, `RegD506cRecipe` 필수 목록에 포함)이 허용 관할을 자체 저장소에 자산 차원 없이 들고 있다.

```solidity
mapping(bytes32 => bool) public allowedJurisdiction;   // 자산 키 없음

function setJurisdictionAllowed(bytes32 code, bool allowed) external onlyOperator { ... }
```

ADR-006 §3 감사표는 "허용 관할 → A-02 → `Manifest.allowedJurisdictions` → 하드코딩 ✗"으로 기록되어 있다. 그 감사는 *설계* 기준이었고, 구현은 그 자리에 도달하지 않았다.

구조적 결과는 두 가지다.

1. **허용 관할이 다른 자산 둘을 동시에 다룰 수 없다.** 매핑이 전역이라 한쪽 값을 쓰면 다른 쪽 판정이 함께 바뀐다.
2. 회피하려면 같은 로직을 설정마다 배포하게 된다. 배포 수가 `규칙 수 × 자산 프로파일 수`로 증가한다. ADR-006 §4가 기대한 "새 자산 온보딩 = Manifest 한 장"이 성립하지 않는다.

**근본 원인은 엔진에 있다.** 자산별 사실이 Recipe까지만 전달되고 Element 직전에 버려진다.

```solidity
bytes memory recipeContext  = abi.encode(manifest.factsPacked, ctx);   // Recipe는 받는다
...
bytes memory elementContext = abi.encode(ctx);                          // Element는 못 받는다
element.check(ctx.buyer, ctx.seller, token, rwaAmount, elementContext);
```

`check`가 `asset`을 받으므로 Element가 자산별로 갈라볼 여지는 있으나, 그 경우 부품마다 자산별 상태와 운영자 쓰기 경로를 갖게 되어 감사·권한 표면이 부품 수만큼 늘어난다.

**참고 (판단 요청).** `BuidlMinimumInvestment.sol`은 `MINIMUM_AMOUNT`를 컴파일 상수로 갖는다.

```solidity
uint256 public constant MINIMUM_AMOUNT = 5_000_000 ether;
```

ADR-006 불변식 1은 *법령 상수*(예: QP $5M, ICA §2(a)(51))를 예외로 허용한다. 그러나 BUIDL의 최소투자금액은 법령이 아니라 **해당 펀드의 청약 조건**이므로 자산별 값에 해당한다. 이 부품이 데모 전용으로만 등록되고 일반 Recipe에 유입되지 않는다면 실무상 문제는 없다. 다만 **같은 규칙(최소투자금액)이 다른 자산에 필요해지는 순간 재배포가 되는 패턴**이라 G-1과 같은 뿌리를 갖는다.

---

### G-2. 결정 해시가 판정 입력을 전부 담지 않는다

`ComplianceEngine._accumulatePolicyId`는 Manifest 재료를 해싱한다.

```solidity
policyId = keccak256(abi.encode(
    acc, token, keccak256(abi.encode(bindings)),
    manifest.supportedEngines, manifest.factsPacked,
    manifest.coverageScope, manifest.fullManifestHash
));
```

여기 **Element 저장소의 값**과 **실제 호출된 Element 구현 주소**가 없다. 따라서 아래 세 시점의 `policyId`·`policyVersion`이 동일하다.

```
T1  거래 통과
T2  운영자가 setJurisdictionAllowed("XX", false)
T3  같은 조건 거래 차단
```

판정이 뒤집혔는데 정책 지문이 같다. 원인 특정에 event log의 시간순 재구성이 필요하다.

PD-3은 reliance log를 "event-first recording with minimal on-chain commitment hashes"로 정의하고, PD-5는 `EvaluationResult.evaluationHash`를 둔다. commitment가 판정 입력의 일부만 담으면 그 취지가 절반만 성립한다. ADR-008이 세운 거절 로깅·감시 seam도 같은 전제 위에 있다.

**G-2는 G-1을 고치면 대부분 자동으로 닫힌다.** 설정값이 Manifest 안에 있으면 이미 `policyId` 재료다. 잔여분은 Element 구현 주소 해시 하나다.

---

### G-3. Element 교체 권한이 PD-6 요건과 어긋난다

```solidity
function registerElement(bytes32 elementId, address element) external onlyOwner {
    _elements[elementId] = element;
    emit Events.ElementRegistered(elementId, element);
}
```

기존 식별자의 주소를 덮어쓸 수 있다. Recipe는 식별자만 들고 있으므로(`e[2] = "A-03-v1"`), **Manifest도 Recipe도 그대로인 채 판정 코드만 통째로 바뀐다.** G-2에 따라 결정 해시에도 잡히지 않는다.

PD-6 대비 간극은 두 가지다.

| PD-6 요구 | 현재 |
|---|---|
| "router / engine / **registry replacement**"는 multisig + timelock | timelock 없음 |
| 모든 governance action은 **actor, old value, new value, reason code, effective time**을 담은 append-only event | `ElementRegistered(elementId, element)`에 actor·old value·reason·effective time 없음 |
| "Relaxing compliance ... must require timelock" | 더 느슨한 구현으로의 교체가 즉시 가능 |

`Governed.onlyOwner`는 `Ownable`의 단일 주소다. PD-6이 정한 대로 배포 시 Safe를 owner로 앉히면 multisig 요건은 충족되나, timelock과 event 스키마는 코드 층 사안으로 남는다.

**비대칭 요약.**

| 바꾸려는 것 | timelock | 이력 사슬 | 역할 분리 |
|---|---|---|---|
| Manifest 의미 변경 | 1일 | 있음 | 있음 |
| Manifest 재개 | 1일 | 있음 | 있음 |
| Element 저장소 설정값 | 없음 | event만 | 없음 |
| **Element 구현 전체 교체** | **없음** | **없음** | **없음** |

우리는 발행인이 자산 측 배선을 조용히 바꾸는 것을 배선 지문으로 잡는 설계를 채택했다(B-02 conformance probe). 같은 기준을 자기 자신에게 적용하면 위 표의 아래 두 줄이 설명되지 않는다.

---

## 4. 데모·목업 표기에 대하여

지적이 헛돌지 않도록 적어둔다. 아래 주석을 읽었고 의도적 임시 구현임을 이해한다.

- `Jurisdiction.sol`: *"(mock). Production data source is an ONCHAINID claim; operator-settable mappings stand in for it here."*
- `BuidlMinimumInvestment.sol`: *"BUIDL-like demo minimum investment threshold... not a claim that the live token can be integrated."*
- `RegD506cRecipe.sol`: *"illustrative reference wiring, NOT approved production policy."*

**G-1이 목업 범위 밖인 이유.** `Jurisdiction.sol`의 주석은 `jurisdictionOf[investor]`(투자자 속성)가 ONCHAINID claim으로 대체된다고 한다. 타당하다. 그러나 `allowedJurisdiction`(이 자산에 어느 관할을 허용할지)은 투자자 속성이 아니라 **자산별 정책**이고, claim 파이프라인으로 바꿔도 그대로 남는다. PD-4가 claim으로 옮기는 것은 전자이지 후자가 아니다.

**G-2·G-3은 목업 경로가 아니다.** 둘 다 production 평가·거버넌스 경로에 있다.

---

## 5. 제안 방향

ADR-006 §4·§5가 이미 지시한 것을 구현으로 옮기는 안이다. 결정은 개발팀 몫이며, 더 나은 형태가 있으면 그쪽이 맞을 수 있다.

**D-1. 자산별 값을 Manifest 층으로 옮기고 Element에 주입한다.** `TokenPolicyRegistry`에 `(token, elementId) → bytes` 파라미터 매핑을 두고 엔진이 `check` 호출 시 함께 넘긴다. 최소 형태는 `elementContext`에 `manifest.factsPacked`를 포함시키는 한 줄이다.

이 방향의 핵심 이점은 §2와 이어진다. **파라미터 변경이 Manifest 변경이 되므로 timelock·이력 사슬·역할 분리·완화 금지를 그대로 상속받는다.** 새 거버넌스를 만들 필요가 없고, G-2가 자동으로 닫힌다.

**D-2. `check`에 `bytes32 elementId`를 넘긴다.** 하나의 구현이 여러 elementId를 서빙할 수 있게 된다. `ElementRegistry`가 이미 id → address 매핑이므로 여러 id가 같은 주소를 가리켜도 무방하다. 부품 문서와 법률논증은 elementId에 붙어 있어 산출물은 그대로 유지된다.

**D-3. `policyId`에 Element 구현 주소들의 해시를 포함한다.** G-3의 registry 덮어쓰기가 결정 해시에 드러난다. 가스가 문제라면 evaluate 경로 대신 commit 경로에서만 계산하는 선택지가 있다.

**D-4. `registerElement`에 Manifest 층과 동일한 통제를 건다.** timelock + `oldElement`·actor·reasonCode·effectiveTime을 담은 append-only event. PD-6 요구 그대로다.

**D-5(선택). 술어 유형으로 정규화한다.** 25개 부품의 판정 형태가 집합 포함·임계 비교·경과 시간·누적 상한·표식 확인·외부 조회로 수렴한다. D-1·D-2를 하면 자연히 열리는 경로이며, 새로 만드는 부품부터 적용하고 기존 것은 손댈 일이 생길 때 옮기면 된다. 본 ADR의 필수 항목은 아니다.

---

## 6. Trade-off Summary

| 결정축 | 선택 | 얻는 것 | 비용/잔여 위험 | 재검토 조건 |
| --- | --- | --- | --- | --- |
| 자산별 값의 소유권 | Manifest | ADR-006 불변식 충족, 배포 수 `규칙 수`로 고정, 거버넌스 상속 | Manifest 저장·읽기 비용, 파라미터 스키마 정의 필요 | 가스 한계에 걸리면 packed layout 재설계 |
| Element 파라미터 형태 | (미정 — Q2) | — | — | — |
| Element 정체성과 구현 | 분리(D-2) | 배포 수 감소, 법률 산출물 보존 | 인터페이스 변경, 단일 구현의 버그 반경 확대 | 정규화를 하지 않기로 하면 이득 축소 |
| 결정 해시 범위 | 파라미터 + 구현 주소 포함 | 판정 재현성 완성 | 해시 재료 증가에 따른 가스 | evaluate 경로 가스가 한계면 commit 전용 |
| Element 교체 권한 | timelock + 이력 | PD-6 정합, 우리 쪽 배선 지문 성립 | 긴급 교체 지연 | 즉시 교체가 필요한 incident 시나리오가 실재하면 |
| upgradeable proxy | 채택하지 않음 | 조용한 변경 통로 억제 | 로직 버그 수정이 재배포 | D-1 이후에도 로직을 자주 바꿔야 하면 |

---

## 7. 개발팀에 요청하는 결정

**파라미터 소유권**

1. 자산별 값을 Manifest 층으로 옮기는 데 구조적 걸림돌이 있는가. 가스·저장 비용, 또는 제안자가 보지 못한 이유가 있는지.
2. 옮긴다면 형태는 무엇으로 하는가. `factsPacked` 확장 / 자유 형식 `bytes` / 부품별 struct 중.
3. `check`에 `elementId`를 추가하는 인터페이스 변경의 현재 시점 비용은 어느 정도인가.

**결정 재현성**

4. `policyId`에 적용 파라미터와 Element 구현 주소 해시를 포함하는 안에 대한 판단. 가스 제약이 있다면 commit 경로 한정 계산이 대안이 되는가.
5. 현재 구조에서 감독기관 질의 대응 절차를 이미 상정하고 있는가. event log 재구성을 전제한다면 그 전제를 `docs/architecture/`에 명시해 두는 편이 좋다.

**교체 권한**

6. `registerElement`에 timelock과 확장 event를 거는 데 반대 사유가 있는가. 운영 중 긴급 교체 시나리오를 상정하고 있는지.
7. `RecipeRegistry`도 같은 상태인지(본 검토에서 미확인). 같다면 함께 처리하는 것이 맞는가.

**우선순위**

8. 위 항목을 데모 전 / 데모 후 / production 전 중 어디에 배치하는가. 리걸 측 판단으로는 **1·3(인터페이스 변경)이 부품 25개인 지금 가장 싸고**, 4·6은 production 전이면 충분해 보인다.

---

## 8. Rejected Alternatives

| 대안 | 기각 이유 |
| --- | --- |
| Element가 `asset`으로 자기 저장소를 분기 | 부품마다 자산별 상태와 운영자 쓰기 경로가 생겨 감사·권한 표면이 부품 수만큼 증가. ADR-006 §4의 "Manifest를 인자로 받는 순수 함수"에서 멀어짐 |
| 설정마다 Element를 별도 배포 | 배포 수가 `규칙 수 × 프로파일 수`. ADR-006 §4의 "Manifest 한 장으로 온보딩" 무효화 |
| upgradeable proxy 전면 도입 | 자주 바뀌는 것은 로직이 아니라 파라미터. D-1 이후 필요가 거의 사라지며, 도입 시 PD-6이 막으려는 조용한 완화 통로를 신설 |
| 결정 해시는 그대로 두고 event log 재구성으로 대응 | 가능하나 절차가 문서화되어 있지 않고, PD-3·PD-5의 commitment hash 취지와 어긋남 |
| `registerElement` 통제를 배포 시 Safe owner로만 해결 | multisig 요건은 충족하나 timelock과 event 스키마는 코드 층에 남음 |

---

## 9. Consequences

- 채택 시 ADR-006 §5의 열린 질문("Manifest 스키마 확정")이 닫힌다.
- D-1·D-2는 `IComplianceElement` 인터페이스 변경을 수반하므로 전 부품과 엔진 호출부, 테스트가 영향을 받는다.
- D-1 이후 새 자산 온보딩이 Manifest 작성으로 끝나며, 이는 SDK 제품 주장(`docs/sdk-integration.md`)의 전제다.
- `decision-register.md`에 🟠 제안 행을 추가하고, 채택 시 ✅로 갱신한다.
- 본 ADR은 개별 부품의 법률 요건을 바꾸지 않는다.

---

## 10. 부수 관찰 (본 ADR 범위 밖)

이미 인지하고 있을 수 있다. 별건으로 남긴다.

| 항목 | 관찰 | 위치 |
|---|---|---|
| O(n²) 중복 제거 | `_seen`이 선형 탐색, 누산기 용량 512 | `ComplianceEngine._appendRecipeElements` |
| commit 재평가 | PATH_OPTION 묶음을 evaluate와 commit에서 두 번 검사 | `_collectCommitElements` |
| 부품 조회 오버헤드 | 부품마다 registry 조회 1회 + check 1회 | `_checkRequiredElements` |
| 주석과 코드 불일치 | 주석은 one-time wiring이라 하나 owner가 반복 호출 가능 | `BaseStatefulElement.setEngine` |
| 미사용 필드 | 호환용 필드 4개 잔존 | `ManifestCore` |
| A-12 미배선 | `RedFlagKnowledgeBar.sol`은 존재하나 `RegD506cRecipe` 9개 목록에 없음 | 리걸 사유가 있어 별도 제기 예정 |

마지막 항목만 리걸 사유가 있다. 신뢰 발급자 증명을 판정 입력으로 소비하려면 게이팅형 위험신호 감시가 함께 있어야 방어가 성립한다는 검토 결과가 있어, 배선 여부를 별도로 논의 요청할 예정이다.

---

## Related

- [`./ADR-006-asset-agnostic-component.md`](./ADR-006-asset-agnostic-component.md)
- [`./ADR-007-pd-architecture-decisions.md`](./ADR-007-pd-architecture-decisions.md)
- [`./ADR-008-compliance-seam-decisions.md`](./ADR-008-compliance-seam-decisions.md)
- [`./decision-register.md`](./decision-register.md)
- [`../../src/compliance/ComplianceEngine.sol`](../../src/compliance/ComplianceEngine.sol)
- [`../../src/registry/ElementRegistry.sol`](../../src/registry/ElementRegistry.sol)
- [`../../src/registry/TokenPolicyRegistry.sol`](../../src/registry/TokenPolicyRegistry.sol)
- [`../../src/compliance/elements/Jurisdiction.sol`](../../src/compliance/elements/Jurisdiction.sol)
