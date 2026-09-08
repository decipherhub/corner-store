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

## 3. 결정 과정: 누가 어디까지 답했는가

### 3.1 PR #97에서 Heiji가 답한 부분

Heiji의 답변은 최종 정책 승인이 아니라 **코드 사실 확인과 개발팀 의견**이다.

- **Q.3:** `check` ABI 변경 범위를 실제 파일 수로 확인했다. 기술적으로는
  기계적인 변경이며 지금이 나중보다 싸다고 답했다.
- **Q.4:** Manifest parameter가 기존 policy hash에 들어갈 수 있음을 코드로
  확인했다. 구현 주소 hash는 immutable registry 안에서는 불필요해 보인다는
  추론을 제시했지만 최종 결정으로 못박지는 않았다.
- **Q.6:** PR #89 이후 같은 elementId 덮어쓰기가 금지되어 기존 질문은
  사실상 해소됐다고 답했다. 대신 “불변 Element의 버그를 긴급하게 어떻게
  교체할 것인가”를 새 미정 질문으로 돌려줬다.
- **Q.7:** Recipe 주소와 alias는 불변이지만 `latest` 포인터는 즉시 바뀐다는
  점을 확인했다. 현재 production 경로는 exact version을 사용하므로 잠재
  위험이라고 평가했다.
- **Q.8:** ABI 변경은 지금이 가장 싸다는 의견에 동의하고 우선순위를
  제안했다. 무엇을 실제로 채택할지는 결정권자에게 남겼다.

### 3.2 Heiji가 당시 미정·확인 필요로 남긴 부분과 선택지

아래 항목은 #97 시점에는 미정이었다. 선택지를 비교한 뒤 이번 ADR에서
어느 안을 채택했는지도 함께 표시한다.

#### Q.1 — 자산별 값을 어디에 둘 것인가?

Heiji는 Manifest 방향에 기술적 반대 이유는 없지만 gas·storage와 기존 배포
migration을 측정하기 전에는 단독 결정하지 않겠다고 답했다.

1. **모든 값 Manifest 집중:** 정책값·동적 상태·증빙을 한곳에 둔다.
   - 장점: 조회 위치가 단순하다.
   - 단점: Manifest가 외부 증빙과 runtime state까지 책임져 경계가 무너진다.
2. **정책·상태 분리:** 자산별 허용·거부 의미만 Manifest, 증빙과 동적 상태는
   provider/stateful Element에 둔다.
   - 장점: 정책 version/hash와 runtime state의 책임이 명확하다.
   - 단점: 감사 시 Manifest와 상태 provider를 함께 조회해야 한다.
3. **기존 Element 저장 유지:** 자산별 설정도 각 Element에 계속 저장한다.
   - 장점: migration이 가장 작다.
   - 단점: 설정 변경이 Manifest timelock/history/hash와 분리된다.

**현재 채택:** 2번, R-1 정책·상태 분리. gas 상한과 migration 일정만 남았다.

#### Q.2 — parameter를 어떤 형식으로 전달할 것인가?

Heiji는 세 안의 장단점을 제시했지만 공통 술어 정규화 범위를 먼저 볼 필요가
있다며 선택을 남겼다.

1. **`factsPacked` 확장**
   - 장점: compact하고 기존 policy hash 재료를 재사용한다.
   - 단점: 숫자·배열이 늘면 bit layout 충돌과 migration이 복잡해진다.
2. **bounded `bytes` + immutable schema identity**
   - 장점: core ABI를 유지하면서 Element마다 필요한 값을 표현할 수 있다.
   - 단점: Registry·Toolkit에 schema-aware validation이 필요하다.
3. **Element별 Solidity struct**
   - 장점: compile-time 타입 안전성이 가장 높다.
   - 단점: 새 Element마다 core interface와 Toolkit 타입을 바꿔야 한다.

**현재 채택:** 2번, R-2. 고정 bool·enum은 `factsPacked` 사용을 허용한다.

#### Q.5 — 감독기관 질의에 무엇을 제출할 것인가?

Heiji는 기존 architecture에 절차가 있는지 확인하지 못해 `[확인 필요]`로
남겼고, event 재구성을 전제로 한다면 문서화해야 한다고 답했다.

1. **raw event만 보관:** 질의 때마다 event를 다시 조립한다.
   - 장점: 별도 snapshot 저장소가 필요 없다.
   - 단점: 재구성 로직과 배포 증빙이 빠지면 같은 결론을 재현하기 어렵다.
2. **PII-free policy snapshot + history export**
   - 장점: 거래별 판정 근거를 표준 형식으로 바로 제출·검증할 수 있다.
   - 단점: indexer, 보관, 접근 통제 운영이 추가된다.
3. **외부 provider 기록만 사용:** TA/KYC 사업자의 보고서를 근거로 삼는다.
   - 장점: 내부 데이터 운영이 줄어든다.
   - 단점: 온체인 policy version과 실제 Engine 판정을 독립적으로 증명하지 못한다.

**현재 채택:** 2번, R-5. 보관 기간과 운영 주체는 리걸·운영 협의가 남았다.

#### Q.6 파생 질문 — 긴급 교체에 timelock을 유지할 것인가?

Heiji는 기존 ID 덮어쓰기가 #89로 막힌 사실을 확인한 뒤, 새 버전을 배포하는
동안 1일 timelock을 그대로 지킬지 운영·리걸 결정으로 돌려줬다.

1. **즉시 pause + 새 불변 버전 + 정상 timelock**
   - 장점: 긴급 상황에도 조용한 compliance 완화 경로가 생기지 않는다.
   - 단점: 수정·timelock 동안 거래가 중단된다.
2. **Safe break-glass 즉시 활성화**
   - 장점: 거래 중단 시간을 줄인다.
   - 단점: Safe 탈취·오판이 즉시 정책 완화로 이어진다.
3. **같은 elementId의 구현을 제자리 교체**
   - 장점: 새 Recipe·Manifest 연결 작업이 작다.
   - 단점: 동일 ID의 과거·현재 판정 코드가 달라져 감사 재현성이 깨진다.

**현재 채택:** 1번, R-6 안전우선 긴급 교체 정책. 소유자 승인 완료.

### 3.3 이번 ADR이 채택하는 긴급 교체 정책

`A안`이라는 이름은 PR #90이나 #97에 있던 용어가 아니다. #99 결정 과정에서
아래 대안 중 첫 번째 경로를 승인할 때 사용한 임시 선택지 이름이었다. 문서만
읽어도 뜻을 알 수 있도록 최종 명칭은 **안전우선 긴급 교체 정책**으로 한다.

이 결정은 PR #90의 D-4/Q.6에서 시작됐지만, PR #89의 불변화 이후에는
PR #97이 새로 돌려준 다음 질문에 대한 답으로 바뀌었다.

> 같은 elementId를 덮어쓸 수 없는 상태에서 치명적 버그가 발견되면,
> 거래 중단을 감수하고 정상 timelock을 지킬 것인가, 아니면 긴급 우회
> 교체 권한을 둘 것인가?

§3.2의 세 선택지 중 **1번 안전우선 긴급 교체 정책**을 채택한다.

- 즉시 global/asset/venue pause
- 새 immutable Element/Recipe/Manifest 배포
- Safe 승인과 1일 timelock 후 활성화
- 검증 후 거래 재개
- break-glass 즉시 교체 권한은 두지 않음

거래 중단은 감수하지만 Safe 탈취·오판이 timelock 없이 규제 정책을 완화하는
경로와 동일 ID의 판정 코드가 바뀌는 감사 문제를 만들지 않는다.

**결정 상태:** 소유자 승인 완료. 이 명시적 승인은 R-6에 한정된다. 나머지
기술 항목은 아래와 같이 ADR의 통합 기술 결정 또는 향후 협의 사항으로 구분한다.

### 3.4 이 ADR에서 통합 판단한 부분

R-1~R-5와 R-7~R-10은 #90의 제안, #97의 코드 근거, ADR-006/007,
#98 구현·리뷰 결과를 합쳐 이번 ADR에서 확정하거나 보류한 결론이다.

- **확정:** 자산별 정책 의미만 Manifest로 이동, bounded `bytes` + schema,
  v1 ABI 유지, parameter hash와 배포 증빙 분리, PII-free 감사 snapshot,
  exact Recipe version, 단계별 구현 우선순위
- **보류:** 공통 술어 정규화와 실제 BUIDL 상품 조건

따라서 아래 각 R 항목은 Heiji 답변을 그대로 옮긴 것이 아니라, 답변된 코드
사실과 남은 미정을 구분한 뒤 최종 결론을 기록한다.

## 4. 현재 선택된 것과 앞으로 남은 것

### 4.1 이번 ADR에서 선택된 정책·설계

- **R-1:** 모든 Element 값을 옮기지 않고 자산별 허용·거부 의미를 바꾸는
  정책값만 Manifest compiled plan에 둔다.
- **R-2:** parameter는 bounded `bytes`를 사용하되 immutable schema identity와
  typed validation을 요구한다.
- **R-3:** 현재 v1 `check` ABI를 유지하고 multi-ID 요구가 생기면 V2를 만든다.
- **R-4:** parameter/schema는 policy hash, 구현 주소/code hash는 배포 증빙에 둔다.
- **R-5:** 감독기관 질의는 PII-free policy snapshot과 history로 재현한다.
- **R-6:** 즉시 pause 후 새 불변 버전을 Safe/1일 timelock으로 활성화한다.
- **R-7:** production은 exact Recipe version만 사용하고 `latest` 판정을 금지한다.
- **R-8:** #98의 안전성·호환성 P0를 병합 전에 처리한다.
- **R-9:** 공통 술어 정규화는 이번 ADR에서 보류한다.
- **R-10:** 500만 기준은 실제 BUIDL 정책이 아니라 demo behavior lock으로 둔다.

### 4.2 추가 선택 없이 구현하면 되는 작업

- #98의 recipe identity 충돌 수정
- Manifest retire 전 Factory/Recipe/Element preflight
- parameter 없는 profile의 legacy Factory 경로 유지
- CLI status/check와 Engine compiled rule/parameter 정렬
- Engine·CLI·Toolkit 판정 일치 회귀 테스트
- pending compiled plan 조회, PII-free snapshot export와 incident runbook 구현

이 항목들은 이미 방향이 정해졌으므로 구현 과정에서 새로운 제품 경계가
발견되지 않는 한 추가 정책 선택을 요구하지 않는다.

### 4.3 앞으로 선택·상의가 필요한 사항

#### 개발

- Element별 parameter ABI, 단위, 범위, maximum byte length 초안 작성
- GIWA worst-case gas 측정과 전체 parameter byte/rule 수 상한 제안
- 기존 Element 저장값 inventory와 단계별 migration 기술안 작성
- 동일 schema가 반복되는지 측정하고 공통 술어 정규화 ADR 필요 여부 제안
- 각 선택안에 대한 contract/CLI/Toolkit 호환성과 migration 비용 제시

개발은 법률 의미나 vendor를 단독 선택하지 않고, 측정 결과와 안전한 기술
선택지를 결정권자에게 제공한다.

#### 리걸

- 어떤 값이 자산별 거래 허용·거부의 법적 의미를 갖는지 승인
- Element별 parameter의 법적 단위·경계값·적용 방향을 확인
- policy snapshot 필수 필드, 보관 기간, 접근 권한과 규제기관 제출 형식 확정
- issuer가 승인한 자료를 기준으로 실제 BUIDL 최소금액의 의미, 통화/NAV,
  매수·매도·잔액 적용 범위와 oracle 필요성을 확정
- KYC/TA evidence의 필수성, 만료와 provider 장애 시 fail-closed 기준 승인

리걸 입력이 없으면 BUIDL-like 값은 demo-only이고 production policy로 승격하지
않는다.

#### 그 외

제품·운영·보안·조달/파트너·issuer/asset manager의 책임을 이 범주로 묶는다.

- 어떤 자산과 Element부터 migration할지, downtime과 출시 우선순위 결정
- indexer 운영 주체, incident 담당, pause·resume runbook과 SLA 결정
- Safe signer 구성·threshold, key custody, snapshot 접근 통제 검토
- KYC/TA provider와 indexer/storage vendor 후보·계약 조건 제시
- 실제 상품 조건과 변경 승인 자료 제공

세 책임 영역은 다음 순서로 남은 결정을 닫는다.

1. 개발의 측정 결과와 리걸의 정책 경계를 받아 GIWA hard cap을 정한다.
2. 개발 migration 안과 리걸 분류를 받아 그 외 영역이 rollout 순서를 정한다.
3. 리걸 보관 요건과 개발 export 형식을 받아 그 외 영역이 운영 주체·비용을 정한다.
4. 개발 통합 조건과 리걸 fail-closed 요건을 받아 그 외 영역이 Safe/provider를 정한다.
5. issuer 승인 자료와 리걸 해석을 받아 개발이 실제 BUIDL profile을 구현한다.

이 목록은 “현재 구현 결함”과 “아직 정책 선택이 필요한 문제”를 혼동하지
않기 위한 것이다. R-8의 P0는 바로 구현할 일이고, 위 항목은 측정 결과나
외부 승인 없이 임의로 확정하지 않는다.

## 5. 질문별 결정 기록

### R-1 — 어떤 값을 Manifest로 올리는가?

**원래 항목:** PR #90 D-1, Q.1

**원래 질문:** Element가 가진 값을 모두 Manifest로 옮기는가? 기술적
걸림돌과 gas·storage 비용은 감수할 만한가?

**#97 Heiji 답변:** `[반문] / [확인 필요]`. 방향상 기술적 반대 이유는
보이지 않지만 gas·storage와 기존 배포 migration을 실측하기 전에는 개발팀이
단독으로 결정하지 않겠다고 답했다.

**결정 상태:** ADR 통합 기술 결정. ADR-006의 자산 독립성 원칙과 #98 구현
결과를 근거로 이 ADR에서 이동 범위를 제한해 확정했다.

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

**#97 Heiji 답변:** `[반문] / [확인 필요]`. 세 선택지의 장단점만 정리하고
공통 술어 정규화 범위를 먼저 볼 필요가 있다며 선택을 남겼다.

**결정 상태:** ADR 통합 기술 결정. #98의 bounded `bytes` 구현은 유지하되
자유형 bytes의 위험을 schema identity로 보완하는 안을 확정했다.

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

**#97 Heiji 답변:** `[답변]`. 위 변경 범위와 비용을 확인했고 지금이 가장
싸다는 개발 관점에 동의했다. 다만 제품 요구 여부까지 결정한 답변은 아니다.

**결정 상태:** ADR 통합 기술 결정. 실제 multi-ID 요구가 없는 상태에서 변경
비용만을 이유로 ABI를 넓히지 않기로 판단했다.

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

**#97 Heiji 답변:** `[답변]`. parameter가 policy hash에 들어가는 경로는
코드로 확인했다. 구현 주소 hash는 immutable Engine/Registry 배포 안에서는
불필요해 보인다고 했지만 “검토가 필요한 추론”으로 명시했다.

**결정 상태:** ADR 통합 기술 결정. Heiji의 코드 근거를 받아 parameter
commitment와 deployment identity를 분리하는 안으로 확정했다.

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

**#97 Heiji 답변:** `[확인 필요]`. 기존 architecture 문서에 감독기관 질의
대응 절차가 있는지 확인하지 못했고, event 재구성을 전제로 한다면 명문화해야
한다는 의견만 남겼다.

**결정 상태:** ADR 통합 기술 결정. raw event만으로 부족한 운영 공백을
PII-free snapshot export 요구로 닫았다.

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

**#97 Heiji 답변:** `[답변] + [반문]`. 기존 덮어쓰기 문제는 해소됐음을
확인했지만, 새 ID·Recipe·Manifest와 1일 timelock이 긴급 대응으로 충분한지는
운영·리걸 결정이 필요하다며 답을 돌려줬다.

**결정 상태:** 소유자 승인 완료. §3.3에서 비교한 대안 중 안전우선 긴급
교체 정책을 채택한다.

**최종 선택:** 안전우선 긴급 교체 정책을 적용한다.

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

**#97 Heiji 답변:** `[답변]`. 위 코드 사실을 확인하고 `latest`는 현재
production 경로에 도달하지 않는 잠재 위험이라고 평가했다. latest 전환 통제를
함께 다루되 Element 교체보다 낮은 우선순위를 제안했다.

**결정 상태:** ADR 통합 기술 결정. 현재 production의 exact version 방식을
규범으로 고정하고 latest는 발견 용도로만 남기는 안을 확정했다.

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

**#97 Heiji 답변:** `[답변]`. Q.3 ABI 변경은 지금이 가장 싸다는 데 동의하고
데모 전 처리를 제안했다. 나머지 항목의 최종 일정은 결정권자에게 남겼다.

**결정 상태:** ADR 통합 기술 결정. R-3에서 ABI를 유지하기로 했으므로 Q.3
제안은 채택하지 않고, #98 리뷰의 실제 결함을 P0로 올리는 순서를 확정했다.

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

**#97 Heiji 답변:** Q.2의 형식을 고르기 전에 공통 술어 유형을 어느 정도
그려보자는 개발팀 제안을 했지만, 채택 결론은 내리지 않았다.

**결정 상태:** ADR 보류 결정. 이번 parameter 문제를 해결하는 데 필수는
아니므로 별도 ADR에서 재검토한다.

**최종 선택:** 이번 ADR에서는 보류한다. 신규 Element의 schema가 실제로
반복되는지 관찰한 뒤 별도 ADR로 판단한다.

**선택 이유:** 집합 포함·임계 비교 같은 추상화는 중복을 줄일 수 있지만,
현재 요구 없이 먼저 만들면 법률 의미가 다른 규칙을 하나의 범용 decoder에
억지로 맞출 위험이 있다.

**감수하는 비용:** 당분간 Element별 decoding 코드가 일부 중복될 수 있다.

### R-10 — BUIDL-like 500만 기준은 실제 상품정책인가?

**원래 항목:** PR #98 구현과 리뷰에서 확인된 제품 경계

**#97 Heiji 답변:** #97의 Q.1~Q.8 답변 범위에는 실제 BUIDL 수치의 법적 의미를
확정하는 내용이 없다.

**결정 상태:** 외부 승인 대기. issuer/legal이 승인한 근거가 없으므로
demo-only 경계를 유지한다.

**최종 선택:** 아니다. 현재 저장소에는 해당 수치가 실제 BUIDL의 최초 청약,
매수, 매도 또는 거래 후 잔액 중 무엇인지 확정할 승인 자료가 없다.

- 실제 BUIDL 정책이라고 표현하지 않는다.
- BUIDL-like reference demo의 양방향 최소 거래량 behavior lock으로만 사용한다.
- 공식 상품·법무 근거가 들어오면 새 Element/version으로 심사한다.
- fiat/NAV 기준이라면 oracle freshness, decimals, rounding을 별도 설계한다.

**감수하는 비용:** 데모는 유지할 수 있지만 실제 상품 연동 완료라고 주장할
수 없다.

## 6. PR별 역할과 중복 여부

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
