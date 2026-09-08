# ADR-010 — Element parameter ownership, policy identity and safe replacement

- **상태:** Accepted (2026-09-08)
- **결정자:** 소유자 + 개발팀
- **유형:** Compliance 설정 소유권·버전·인시던트 거버넌스
- **연계:** ADR-006, ADR-007, D017, PR #90, PR #97, PR #98
- **적용 범위:** Element/Recipe/Manifest, policy commitment, Toolkit/CLI,
  배포 후 감사 및 인시던트 대응

## 1. 먼저 쉽게 설명하면

Corner Store의 compliance policy는 다음 세 층으로 나뉘다.

- **Element:** 제재 대상인지, 최소 거래금액 이상인지 등을 판단하는 한 개의 규칙
- **Recipe:** 여러 Element를 묶은 정책 조합
- **Manifest:** 특정 token이 어떤 Recipe와 자산별 설정값을 쓸지 정하는 정책서

예를 들어 `MIN-TRADE-v1`은 “거래량이 기준 이상인가”만 판단하는
범용 Element다. 그 기준이 500만인지 25만인지는 Element 코드가
아니라 각 token의 Manifest가 정한다.

이 분리를 하지 않으면 자산마다 비슷한 컨트랙트를 다시 배포하게 되고,
설정값이 바뀌어도 거래가 어떤 정책으로 판정됐는지 보여주는 해시가
같은 문제가 생긴다.

## 2. 배경과 이번 결정문의 위치

ADR-006은 이미 “Element/Recipe는 자산과 무관하고, 자산별 사실과 정책값은
Manifest가 소유한다”는 불변식을 확정했다. 그러나 구체적인 parameter
schema와 거버넌스는 열려 있었다.

- PR #90은 Element 저장소의 자산별 값, 불완전한 policy commitment,
  Element 교체 통제를 지적하고 8개 질문을 제시했다.
- PR #97은 코드 현황을 다시 점검했지만 Q1/Q2, 긴급 교체, 감사 절차
  등은 최종 결정하지 않았다.
- PR #98은 BUIDL-like 최소금액을 Manifest parameter로 이관하는 부분
  구현이다. ADR-010 전체를 구현한 PR은 아니며, 현재 코드 리뷰의
  `REQUEST CHANGES`를 반영해야 한다.

이 ADR은 세 자료의 논의를 하나의 선택된 방향으로 통합한다.

## 3. 결정 요약

| 결정축 | 선택 | 핵심 이유 |
| --- | --- | --- |
| 자산별 정책값 | Manifest compiled plan이 소유 | version, timelock, history, hash를 같이 적용 |
| parameter 형식 | bounded `bytes` + immutable schema identity | ABI 안정성과 타입 검증을 절충 |
| Element ABI | v1 유지, 필요 시 별도 v2 | 25개 Element의 즉시 전환 리스크 방지 |
| Recipe 정체성 | 가족별 key/id + exact version pin | 관계없는 정책을 새 version으로 위장하지 않음 |
| policy commitment | parameter는 compiled hash, code는 deployment evidence | 거래 정책과 배포 정체성의 책임 분리 |
| 버그 대응 | 즉시 pause + 새 불변 version + timelock | 즉시 교체 백도어를 만들지 않음 |
| Recipe latest | production 판정에서 사용 금지 | Manifest가 심사한 exact version만 실행 |
| 감사 재현 | policy snapshot + event/history chain | 특정 거래의 판단 근거를 시점별로 복원 |

## 4. 세부 결정

### 4.1 자산별 정책값은 Manifest가 소유한다

Element 저장소에 남아 있는 모든 값을 Manifest로 옮기는 것은 아니다. 값의
성격에 따라 소유자를 구분한다.

**올릴지를 결정하는 기준은 “이 값이 특정 token의 거래 허용·거부 정책
의미를 바꾸는가”이다.** 대답이 예이면 Manifest compiled plan이 소유한다.
대답이 아니오이면 증빙 provider, stateful Element, OperatorRegistry 등 본래 책임
경계에 남긴다. 단순히 저장소에 있다는 이유로 모든 값을 Manifest에
복사하지 않는다.

| 값의 종류 | 소유자 | 예시 |
| --- | --- | --- |
| token별 정책·상품 조건 | Manifest | 허용 관할, 최소 거래량, 보유자 한도 |
| 개인·기관의 자격 사실 | TA/KYC provider·ONCHAINID claim | KYC, QP, 제재 상태 |
| 거래가 쌓으며 변하는 상태 | stateful Element | 보유자 수, 누적 한도 |
| 인시던트 통제 | OperatorRegistry | global/asset/venue pause |
| 법령 자체의 고정 기준 | immutable Element version | 자산과 무관한 법정 기준 |

자산별 parameter 변경은 다음을 모두 따라야 한다.

1. Safe/owner가 새 Manifest update를 예약한다.
2. 예정 parameter와 compiled plan hash를 검토한다.
3. timelock 후 operator가 활성화한다.
4. Manifest version과 history hash가 변경된다.

### 4.2 parameter는 bounded bytes를 쓰되 schema를 고정한다

`factsPacked`는 고정된 bool/enum 플래그에 적합하다. 숫자·배열·확장가능한
설정은 bounded `bytes`로 전달한다. 단, 자유 형식 bytes만 허용하면
잘못된 ABI, 의미 없는 parameter, secret/PII의 온체인 노출을 걸러낼 수 없다.

따라서 parameter-aware Element는 불변 metadata로 다음 능력을 선언해야 한다.

- parameter 지원/필수 여부
- `parameterSchemaHash`
- maximum byte length
- human-readable schema/version 문서

예:

```text
elementId           = MIN-TRADE-v1
parameterRequired   = true
parameterSchemaHash = keccak256("uint256 minimumAmount")
maximumBytes        = 32
```

Registry는 능력·크기·필수 여부를 검증하고 Toolkit은 known schema를 타입이
있는 입력으로 인코딩한다. 지원하지 않는 opaque schema는 production onboarding에서
fail-closed한다. parameter는 public on-chain policy input이며 secret·PII를 저장하지 않는다.

### 4.3 기존 Element ABI는 유지한다

현재 제품에서는 하나의 구현이 여러 `elementId`를 동적으로 처리해야 할
필수 요구가 없다. 따라서 v1 `IComplianceElement.check` signature에 `elementId`를
추가하지 않는다.

- parameter가 없는 Element는 기존 context를 그대로 받는다.
- parameter-aware Element는 versioned extended context를 받는다.
- 다중 ID 공유 구현이 실제 요구되면 `IComplianceElementV2`를 별도로 설계한다.

이 선택은 ABI 변경을 영구히 금지하는 것이 아니라, 현재 요구 없는 전면 마이그레이션을
피하는 것이다.

### 4.4 Recipe family와 version은 서로 다른 개념이다

Recipe version은 같은 정책 family의 심사된 후속 버전이다. 의미가 다른 정책을
기존 Recipe의 높은 version으로 등록하지 않는다.

- 관계없는 정책은 새 canonical alias, `recipeKey`, legacy `recipeId`를 받고 version 1로 시작한다.
- Manifest, Engine, CLI, Toolkit은 exact `(recipeKey, version)` 또는 검증된 동등 바인딩을 사용한다.
- `recipeOf(recipeId)` latest 조회는 UI/발견용으로만 남기고 production 판단에서 금지한다.
- 새 version 등록만으로 기존 ACTIVE Manifest가 자동으로 바뀌지 않는다.

PR #98의 `MinimumTradeAmountRecipe` 수정은 이 결정을 따라야 한다. 기존
`BuidlLikeFundRecipe` family의 `recipeId=3`을 재사용하지 않고 새 recipe identity를
할당해야 한다.

### 4.5 policy commitment과 deployment identity를 분리한다

거래에 적용된 policy commitment에는 다음이 들어간다.

- token과 Manifest version/hash
- exact Recipe key/version/binding mode
- Element ID와 enforcement action
- Element parameter 또는 그 hash
- parameter schema identity

구현 주소는 실행 중 매번 누적하기보다 배포 증빙에 고정한다.

- chainId
- Engine/Registry 주소
- Element/Recipe 구현 주소와 code hash/version hash
- deployment artifact/config/legal package hash

ElementRegistry와 Engine 참조가 immutable인 한 배포 내에서는 `elementId`가 구현을 고정한다.
다른 배포를 비교할 때는 deployment evidence를 함께 비교한다.

### 4.6 긴급 교체 백도어를 두지 않는다

배포된 Element에 치명적인 버그가 발견되면 다음 순서를 따른다.

```text
탐지
  → 즉시 global/asset/venue pause
  → 영향·이력·잔여 quote 확인
  → 새 elementId로 수정 구현 배포
  → 새 Recipe version 또는 family 등록
  → 영향받는 Manifest update 예약
  → Safe 승인 + timelock
  → 배포 후 검증
  → 거래 재개
```

- 같은 `elementId`의 구현을 덮어쓰지 않는다.
- Safe에게 parameter/Recipe/Manifest timelock 우회 권한을 주지 않는다.
- 가용성보다 조용한 compliance 완화를 막는 것을 우선한다.
- pause는 즉시 가능하고 resume는 기존 delayed control을 따른다.

즉시 교체가 필요할 만큼 중대한 인시던트에서도 “빠른 정책 변경” 대신
“빠른 정지”를 안전 장치로 사용한다.

### 4.7 감사는 단일 hash가 아니라 snapshot과 history로 재현한다

특정 거래가 왜 통과 또는 거절됐는지 답하려면 다음 자료를 하나의 PII-free
policy snapshot으로 export할 수 있어야 한다.

1. chainId, transaction/quote reference, block/finality
2. Manifest version/hash와 compiled plan hash
3. Recipe key/version/binding
4. Element ID, enforcement action, parameter/schema hash
5. reasonCode와 relied claim/evidence hash
6. Engine/Registry/deployment artifact identity
7. Manifest·pause·operator 변경 history chain

email, 성명, 주소, KYC 원문, signer secret은 snapshot에 넣지 않는다.

### 4.8 한도는 임의로 크게 정하지 않고 target chain에서 측정한다

entry 수와 각 bytes 길이를 각각 제한해도 전체 storage write가 block gas limit을
넘을 수 있다. production 상수는 다음 검증 후 확정한다.

- `MAX_TOTAL_PARAMETER_BYTES`
- 최대 binding/rule/parameter 조합 gas test
- GIWA target block gas 여유분
- registration과 delayed update 둘 다의 worst-case 검증

## 5. 선택하지 않은 대안과 trade-off

| 대안 | 장점 | 선택하지 않은 이유 |
| --- | --- | --- |
| Element가 `asset`별 정책값 저장 | ERC-3643 module과 유사, 구현 단순 | 값 변경이 Manifest history/hash와 분리됨 |
| 설정마다 Element 재배포 | 구현이 가장 단순 | 자산별 bytecode, 중복 심사·배포 증가 |
| 모든 값을 `factsPacked`에 저장 | 저렴한 gas | schema가 커질수록 bit 충돌·migration 복잡 |
| 자유형 `bytes`만 사용 | 최대 유연성 | malformed/inert/secret parameter를 onboarding에서 차단 불가 |
| Element별 Solidity struct | 강한 타입 안전성 | 신규 Element마다 core ABI·Toolkit 변경 |
| 모든 `check`에 지금 `elementId` 추가 | multi-ID 구현 준비 | 현재 필수 요구 없이 전체 ABI를 변경 |
| Safe break-glass 즉시 교체 | downtime 최소화 | Safe 탈취·오판이 즉시 compliance 완화로 연결 |
| Recipe latest 자동 적용 | integrator가 version 관리 불필요 | Manifest 심사 없이 실행 정책이 변경 |
| policy hash에 모든 code address 반복 포함 | 단일 hash만으로 자급 | runtime gas 증가, immutable deployment evidence와 중복 |

## 6. BUIDL-like 500만 기준의 지위

현재 저장소에는 해당 수치가 실제 BlackRock/Securitize BUIDL의 최초 청약,
매수, 매도 또는 거래 후 보유잔액 조건 중 무엇인지 확정할 승인된 자료가 없다.

따라서 공식 상품·법무 근거가 입력되기 전까지 다음으로 제한한다.

- 실제 BUIDL 정책이라고 표현하지 않는다.
- BUIDL-like reference demo의 양방향 최소 거래수량 behavior lock으로만 사용한다.
- 실제 의미가 확정되면 새 Element/version으로 심사한다.
- fiat/NAV 기준이면 oracle freshness, decimals, rounding을 별도로 설계한다.

## 7. 이 ADR이 바로 필요로 하는 후속 작업

### P0 — PR #98 병합 전

1. `MinimumTradeAmountRecipe`에 새 recipe family identity와 version 1을 부여한다.
2. CLI가 기존 Manifest를 retire하기 전 Factory/Recipe/Element capability를 preflight한다.
3. parameter가 없는 profile은 legacy Factory 경로를 사용한다.
4. CLI status/check는 Recipe latest가 아니라 exact compiled rule/parameter를 사용한다.
5. Engine·CLI·Toolkit 판정 일치 회귀 테스트를 추가한다.

### P1 — production onboarding 전

1. Element parameter schema/capability metadata와 Toolkit typed validation을 추가한다.
2. pending compiled plan hash/rule/parameter를 activation 전에 조회·검증할 수 있게 한다.
3. total parameter byte bound와 GIWA worst-case gas test를 추가한다.
4. Element 저장소의 값을 분류해 자산별 정책값만 단계적으로 Manifest로 이관한다.
5. PII-free policy snapshot export와 immutable-version incident runbook을 추가한다.

## 8. 현재 구현 상태와 확정하지 않은 것

- PR #98은 Manifest parameter 저장·해시·지연 변경과 BUIDL-like 분리를 구현했지만,
  이 ADR의 schema capability·감사 snapshot·전체 마이그레이션은 구현하지 않았다.
- 실제 BUIDL 상품 조건은 확정하지 않았다.
- GIWA parameter 상수는 gas 측정 전에 확정하지 않았다.
- 특정 KYC/TA, Safe, indexer, storage vendor를 선택하지 않는다.

## 9. 결과

- 신규 자산은 전용 compliance bytecode 대신 검토 가능한 Manifest로 정책값을 선언한다.
- 상품 조건 변경은 Manifest version/timelock/history/compiled hash를 바꾼다.
- Element와 Recipe의 정체성을 버그 수정이나 새 정책으로 재사용하지 않는다.
- incident 대응은 “즉시 정책 교체”가 아니라 “즉시 정지 + 심사된 새 버전”이다.
- 특정 거래의 정책 판정은 PII-free snapshot과 history chain으로 재현한다.

## 10. 원천과 대체 관계

- PR #90의 Proposed ADR-010과 PR #97의 review reply를 통합·대체한다.
- PR #90의 지적은 당시 main 기준으로 타당했으며 이후 PR #89의 immutable
  policy object 변경을 반영해 최종 처방을 조정했다.
- #90·#97을 내용 오류로 평가하지 않고 결정 이력으로 보존한다.

## Related

- [`ADR-006-asset-agnostic-component.md`](./ADR-006-asset-agnostic-component.md)
- [`ADR-007-pd-architecture-decisions.md`](./ADR-007-pd-architecture-decisions.md)
- [`decision-register.md`](./decision-register.md)
- [`../../DECISIONS.md`](../../DECISIONS.md)
- PR #90, PR #97, PR #98
