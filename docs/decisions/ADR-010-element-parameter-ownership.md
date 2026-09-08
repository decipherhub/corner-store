# ADR-010 — 자산별 Element parameter 소유권과 안전한 교체 정책

- **상태:** Accepted (2026-09-08)
- **결정자:** 소유자 + 개발팀
- **연계:** ADR-006, ADR-007, PR #90, PR #97, PR #98
- **적용 범위:** Element/Recipe/Manifest, policy commitment, Toolkit/CLI,
  배포 후 감사 및 인시던트 대응

## 1. 이 문서가 답하는 질문

PR #90은 현재 구현과 기존 ADR 사이의 간극을 발견하고 Q.1~Q.8을
질문했다. PR #97은 코드 현황과 변경 비용을 확인했지만 일부 항목은
결정 권한이 없어 답을 보류했다. PR #98은 그중 BUIDL-like 최소금액을
Manifest parameter로 옮기는 구현을 먼저 만들었다.

이 문서는 세 PR의 내용을 단순히 합친 요약문이 아니다. **각 질문에 대한
최종 선택, 선택 이유, 포기한 대안, 감수하는 비용과 #98의 후속 조치**를
확정하는 결정문이다.

## 2. 먼저 알아야 할 세 가지

- **Element:** “제재 대상인가”, “최소금액 이상인가”처럼 규칙 하나를 판정한다.
- **Recipe:** 여러 Element를 하나의 정책 묶음으로 조합한다.
- **Manifest:** 특정 token이 사용할 Recipe와 자산별 설정을 확정한다.

예를 들어 `MIN-TRADE-v1` Element는 “거래량이 기준 이상인가”만 판정한다.
기준이 500만인지 25만인지는 각 token의 Manifest가 정한다.

## 3. 한눈에 보는 최종 결정

| 최종 결정 | 원래 항목 | 선택 | 핵심 trade-off |
| --- | --- | --- | --- |
| R-1 정책값 소유권 | #90 D-1, Q.1 | 자산별 정책 의미만 Manifest로 이동 | 중복 배포 감소 ↔ schema·storage 비용 |
| R-2 parameter 형식 | Q.2 | bounded `bytes` + immutable schema identity | ABI 안정성 ↔ 별도 검증 계층 필요 |
| R-3 Element ABI | #90 D-2, Q.3 | v1 유지, 실제 필요 시 V2 | 현재 변경 회피 ↔ multi-ID 구현은 연기 |
| R-4 policy commitment | #90 D-3, Q.4 | parameter는 policy hash, 코드는 배포 증빙 | runtime gas 절감 ↔ 배포 증빙 함께 보관 |
| R-5 감사 재현 | Q.5 | PII-free snapshot + history chain | 설명 가능성 ↔ indexer·보관 운영 필요 |
| R-6 버그·긴급 교체 | #90 D-4, Q.6, #97 반문 | 즉시 pause 후 새 불변 버전 + Safe/1일 timelock | 백도어 제거 ↔ downtime 감수 |
| R-7 Recipe version | Q.7 | exact version pin, `latest`는 판정에 금지 | 정책 재현성 ↔ 운영자가 버전 명시 |
| R-8 구현 우선순위 | Q.8 | #98 P0는 병합 전, 나머지는 production 전 | 안전한 작은 병합 ↔ 단계적 작업 필요 |
| R-9 술어 정규화 | #90 D-5 | 이번 ADR에서 보류 | 과설계 방지 ↔ 일부 중복 decoder 허용 |
| R-10 BUIDL-like 500만 | #98 리뷰 | 실제 상품정책이 아닌 demo behavior lock | 데모 보존 ↔ 실제 BUIDL로 표현 금지 |

## 4. 질문별 결정 기록

### R-1 — 어떤 값을 Manifest로 올리는가?

**원래 항목:** PR #90 D-1, Q.1

**원래 질문:** Element가 가진 값을 모두 Manifest로 옮기는가? 기술적
걸림돌과 gas·storage 비용은 감수할 만한가?

**최종 선택:** 모두 옮기지 않는다. 다음 질문에 “예”인 값만 Manifest의
compiled plan이 소유한다.

> 이 값이 특정 token의 거래 허용·거부 정책 의미를 바꾸는가?

| 값 | 소유 위치 | 예시 |
| --- | --- | --- |
| token별 정책·상품 조건 | Manifest | 허용 관할, 최소 거래량, 최대 보유자 한도 |
| 개인·기관의 자격 사실 | TA/KYC provider·ONCHAINID | KYC, QP, 제재 상태 |
| 거래에 따라 변하는 상태 | stateful Element | 현재 보유자 수, 누적 거래량 |
| 인시던트 통제 | OperatorRegistry | global/asset/venue pause |
| 자산과 무관한 판정 로직 | immutable Element | 비교 알고리즘, 법정 고정 기준 |

최대 보유자가 100명이라는 **정책값**은 Manifest에 두지만, 현재 보유자가
83명이라는 **운영 상태**는 stateful Element에 둔다.

**선택 이유:** 자산별 설정 변경이 Manifest의 version, timelock, history와
compiled plan hash를 함께 바꾸게 해 정책 변경을 추적할 수 있다. 같은 판정
로직을 자산마다 다시 배포하지 않아도 된다.

**감수하는 비용:** Manifest 저장량과 compile gas가 늘고 기존 Element
저장값을 분류·마이그레이션해야 한다. 그래서 전체 parameter byte와 최대
rule 조합을 GIWA에서 측정하기 전에는 production 상수를 확정하지 않는다.

**#98 및 후속:** #98은 최소 거래량 한 항목만 이 방향으로 구현했다.
`Jurisdiction.allowedJurisdiction` 등 다른 값은 production 전 별도 이관한다.

### R-2 — parameter는 어떤 형식으로 저장하는가?

**원래 항목:** Q.2

**검토한 선택지:** `factsPacked` 확장 / 자유 형식 `bytes` / Element별 struct

**최종 선택:** 숫자·배열·확장 가능한 설정은 **크기가 제한된 `bytes`**로
전달하되, Element가 다음 immutable capability를 선언하게 한다.

- parameter 지원·필수 여부
- `parameterSchemaHash`
- maximum byte length
- 사람이 검토할 schema/version 문서

고정 bool·enum flag는 기존 `factsPacked`를 계속 사용할 수 있다.

**선택 이유:** core ABI를 Element 종류마다 바꾸지 않으면서도 Toolkit이
알려진 schema를 typed input으로 검증할 수 있다.

**감수하는 비용:** `bytes` 자체는 타입 안전하지 않으므로 Registry와
Toolkit에 schema-aware 검증을 추가해야 한다. 모르는 schema, malformed 값,
secret·PII는 production onboarding에서 fail-closed한다.

**#98 및 후속:** #98의 256-byte 제한만으로는 충분하지 않다. 병합 후
production 단계에서 capability metadata와 typed validation을 추가한다.

### R-3 — `check`에 `elementId`를 지금 추가하는가?

**원래 항목:** PR #90 D-2, Q.3

**#97에서 확인한 사실:** 변경 시 interface 1곳, Element signature 약 25개,
Engine 호출부 1곳과 관련 테스트 약 26개가 영향을 받는다. 작업은 기계적이며
지금이 나중보다 싸다.

**최종 선택:** 그래도 v1 `IComplianceElement.check`에는 `elementId`를 추가하지
않는다. 하나의 구현이 여러 ID를 처리해야 한다는 실제 제품 요구가 생기면
`IComplianceElementV2`로 분리한다.

**선택 이유:** “지금 바꾸기 싸다”는 사실만으로 사용 사례가 없는 ABI를
확장하지 않는다. #98처럼 parameter 유무에 따라 versioned context를 전달하면
현재 요구는 충족된다.

**감수하는 비용:** 미래에 multi-ID Element가 실제로 필요해지면 V2 adapter와
migration 비용이 생긴다. 대신 현재 25개 Element와 외부 integrator의 불필요한
동시 변경을 피한다.

### R-4 — policy hash에 무엇을 포함하는가?

**원래 항목:** PR #90 D-3, Q.4

**최종 선택:** 거래 정책을 바꾸는 parameter와 schema identity는 compiled
plan/policy hash에 포함한다. Element 구현 주소와 code hash는 다음 배포 증빙에
고정한다.

- chainId와 Engine/Registry 주소
- Element/Recipe 구현 주소와 code/version hash
- deployment artifact, config, legal package hash

**선택 이유:** 현재 Engine은 Registry 주소를 immutable로 가지고 Element의
같은 ID 재등록도 금지한다. 한 배포 안에서는 elementId가 구현을 고정하므로
매 거래 hash에 주소를 반복해 넣을 필요가 작다.

**감수하는 비용:** 감사 시 policy snapshot만 보면 부족하고 deployment
evidence를 함께 조회해야 한다. 반대로 runtime gas와 hash 중복은 줄어든다.

**#98 및 후속:** #98이 parameter를 binding/compiled plan hash에 넣은 방향은
유지한다. 구현 주소의 runtime 누적은 추가하지 않는다.

### R-5 — 감독기관 질의에 어떻게 판정을 재현하는가?

**원래 항목:** Q.5

**최종 선택:** raw event를 사람이 직접 조립하는 절차만 전제하지 않는다.
다음 항목을 하나의 PII-free policy snapshot으로 export한다.

1. chainId, transaction/quote reference, block/finality
2. Manifest version/hash와 compiled plan hash
3. exact Recipe key/version/binding
4. Element ID, action, parameter/schema hash와 reasonCode
5. relied claim/evidence hash
6. Engine/Registry/deployment artifact identity
7. Manifest·pause·operator 변경 history chain

성명, email, 주소, KYC 원문, signer secret은 포함하지 않는다.

**선택 이유:** “왜 이 거래가 허용·거절됐는가”를 정책과 배포 상태까지 연결해
재현하면서 PII 노출을 피한다.

**감수하는 비용:** 온체인 이벤트만으로 끝나지 않고 PII-free indexer와
snapshot 보관·검증 운영이 필요하다.

### R-6 — 배포된 Element에 버그가 있으면 어떻게 교체하는가?

**원래 항목:** PR #90 D-4, Q.6과 PR #97이 되돌려준 긴급 교체 질문

**상태 변화:** #90 작성 당시에는 같은 elementId의 구현을 덮어쓸 수 있었지만,
PR #89가 main에 병합되며 Element identity가 불변이 되었다. 따라서 “기존 ID에
timelock 교체를 추가할까”가 아니라 “불변 객체의 버그를 어떻게 처리할까”가
실제 질문이다.

**최종 선택:** 소유자가 선택한 안 A를 적용한다.

```text
탐지
  → 즉시 global/asset/venue pause
  → 영향과 미체결 quote 확인
  → 새 elementId로 수정 구현 배포
  → 새 Recipe version 또는 새 family 등록
  → 영향받는 Manifest update 예약
  → Safe 승인 + 1일 timelock
  → 배포 후 검증
  → 거래 재개
```

- 기존 elementId를 덮어쓰지 않는다.
- Safe도 parameter/Recipe/Manifest timelock을 우회할 수 없다.
- pause는 즉시 가능하지만 resume는 기존 delayed control을 따른다.

**선택 이유:** Safe 탈취나 운영자 오판이 즉시 compliance 완화로 연결되는
break-glass 백도어를 만들지 않는다. 긴급 상황에서는 빠른 정책 변경이 아니라
빠른 정지로 피해를 제한한다.

**감수하는 비용:** 수정 배포와 1일 timelock 동안 거래 중단이 발생한다.
이 결정은 가용성보다 조용한 규제 완화 방지를 우선한다.

### R-7 — Recipe의 `latest`와 version을 어떻게 다루는가?

**원래 항목:** Q.7

**#97에서 확인한 사실:** 같은 `(recipeKey, version)`의 주소 덮어쓰기와 alias
하이재킹은 이미 막혀 있다. 하지만 높은 version 등록 시 `latest` 포인터는
즉시 바뀐다. 현재 production 판정 경로는 이미 exact version overload를 쓴다.

**최종 선택:** production 판정은 exact `(recipeKey, version)` 또는 검증된
동등 바인딩만 사용한다. `latest`는 UI·발견 용도에만 허용한다.

- 같은 의미의 심사된 후속 정책만 기존 family의 version을 올린다.
- 의미가 다른 정책은 새 canonical alias, recipeKey/id와 version 1을 받는다.
- 새 version 등록만으로 ACTIVE Manifest가 자동 변경되지 않는다.

**선택 이유:** 새 Recipe 등록이 이미 심사된 자산의 정책을 몰래 바꾸지 못하게
하고 특정 시점의 판정을 재현한다.

**감수하는 비용:** CLI와 operator가 exact version을 명시해야 하며 자동 최신화
편의를 포기한다.

**#98 및 후속:** `MinimumTradeAmountRecipe`가 기존 `BuidlLikeFundRecipe`의
`recipeId=3`을 재사용하면 안 된다. 새 family identity와 version 1을 부여한다.

### R-8 — 무엇을 언제 구현하는가?

**원래 항목:** Q.8

**최종 선택:** PR #98의 안전한 병합에 필요한 항목과 production 완성 항목을
분리한다.

**P0 — PR #98 병합 전**

1. `MinimumTradeAmountRecipe`의 새 family identity/version 1
2. 기존 Manifest retire 전 Factory/Recipe/Element capability preflight
3. parameter 없는 profile의 legacy Factory 경로 유지
4. CLI status/check를 latest 재해석이 아닌 exact compiled rule/parameter에 정렬
5. Engine·CLI·Toolkit 판정 일치 회귀 테스트

**P1 — production onboarding 전**

1. parameter schema/capability metadata와 Toolkit typed validation
2. activation 전 pending compiled plan 조회·검증
3. total parameter byte bound와 GIWA worst-case gas test
4. 자산별 정책값만 단계적으로 Manifest 이관
5. PII-free snapshot export와 immutable-version incident runbook

**선택 이유:** #98의 실제 안전성·호환성 결함은 병합 전에 막되, schema 체계와
전체 마이그레이션을 한 PR에 넣어 검토 범위를 폭발시키지 않는다.

**감수하는 비용:** P0가 끝나도 ADR 전체가 production-ready인 것은 아니다.
P1 완료 전에는 parameter onboarding을 production 완성으로 표시하지 않는다.

### R-9 — Element를 공통 술어 유형으로 정규화하는가?

**원래 항목:** PR #90 D-5(선택 사항)

**최종 선택:** 이번 ADR에서는 보류한다. 신규 Element의 schema가 실제로
반복되는지 관찰한 뒤 별도 ADR로 판단한다.

**선택 이유:** 집합 포함·임계 비교 같은 추상화는 중복을 줄일 수 있지만,
현재 요구 없이 먼저 만들면 법률 의미가 다른 규칙을 하나의 범용 decoder에
억지로 맞출 위험이 있다.

**감수하는 비용:** 당분간 Element별 decoding 코드가 일부 중복될 수 있다.

### R-10 — BUIDL-like 500만 기준은 실제 상품정책인가?

**원래 항목:** PR #98 구현과 리뷰에서 확인된 제품 경계

**최종 선택:** 아니다. 현재 저장소에는 해당 수치가 실제 BUIDL의 최초 청약,
매수, 매도 또는 거래 후 잔액 중 무엇인지 확정할 승인 자료가 없다.

- 실제 BUIDL 정책이라고 표현하지 않는다.
- BUIDL-like reference demo의 양방향 최소 거래량 behavior lock으로만 사용한다.
- 공식 상품·법무 근거가 들어오면 새 Element/version으로 심사한다.
- fiat/NAV 기준이라면 oracle freshness, decimals, rounding을 별도 설계한다.

**감수하는 비용:** 데모는 유지할 수 있지만 실제 상품 연동 완료라고 주장할
수 없다.

## 5. PR별 역할과 중복 여부

| PR | 역할 | 코드 구현 |
| --- | --- | --- |
| #90 | 간극 발견과 D-1~D-5 제안, Q.1~Q.8 질문 | 없음 |
| #97 | main 코드 현황·변경 비용 확인, 미결정 질문 반환 | 없음 |
| #98 | BUIDL-like 최소금액을 Manifest parameter로 옮긴 부분 구현 | 있음 |
| #99 | 이 ADR과 decision register를 확정하는 문서 PR | 없음 |

PR #98은 이전 작업을 그대로 다시 커밋한 것이 아니다. PR #89가 만든 immutable
Element/Recipe와 Manifest lifecycle 기반 위에 parameter 저장·hash·Engine 전달,
범용 최소 거래금액 Element, Factory/CLI/Toolkit 배선을 새로 추가했다. 다만
R-8의 P0 문제가 남아 있으므로 현재 상태로는 병합하지 않는다.

## 6. 이 ADR이 확정하지 않은 것

- 실제 BUIDL 상품 조건
- gas 측정 전 GIWA parameter 상수
- 특정 KYC/TA, Safe, indexer 또는 storage vendor
- 공통 술어 정규화 설계

## 7. 결과와 대체 관계

- PR #90의 Proposed ADR과 PR #97의 review reply를 이 최종 결정으로 통합한다.
- 두 문서는 당시 코드와 논의를 보여주는 결정 이력으로 보존한다.
- #90의 Element overwrite 지적은 작성 당시 main 기준으로 정확했으며, 이후
  #89 병합으로 사실관계가 바뀐 것이므로 작성 오류로 취급하지 않는다.
- #98은 이 ADR의 일부 구현이며 P0 수정과 재검토 후에만 병합할 수 있다.

## Related

- [`ADR-006-asset-agnostic-component.md`](./ADR-006-asset-agnostic-component.md)
- [`ADR-007-pd-architecture-decisions.md`](./ADR-007-pd-architecture-decisions.md)
- [`decision-register.md`](./decision-register.md)
- [`../../DECISIONS.md`](../../DECISIONS.md)
- PR #90, PR #97, PR #98
