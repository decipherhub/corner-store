# ADR-010 — 정책 파라미터, 버전, 실행 바인딩과 감사 경계

- **상태:** Accepted
- **결정일:** 2026-09-15
- **적용 범위:** Element, Recipe, Manifest, Compliance Engine, Toolkit/CLI,
  production onboarding과 감사
- **구현 추적:** [#101](https://github.com/decipherhub/corner-store/issues/101)

## 1. 배경

Corner Store의 Element는 여러 자산에서 재사용되어야 한다. 특정 상품의 금액,
허용 관할, 증빙 유효기간 같은 값을 Element 구현에 하드코딩하면 같은 판정 로직을
상품마다 다시 배포하게 되고, Manifest의 승인·버전·감사 이력 밖에서 정책 의미가
달라질 수 있다.

반대로 모든 법률 규칙을 하나의 범용 DSL로 만들면 타입, 실행 한도, 외부 증빙,
reason code와 compiler 일치성을 새로 증명해야 한다. 이 ADR은 재사용 가능한 정책
파라미터를 도입하되, 정책 의미와 실행 인스턴스가 감사 가능하게 고정되는 경계를
확정한다.

## 2. 결정 요약

| 항목 | 결정 |
| --- | --- |
| Q1 | 자산별 정책값은 Manifest가 소유하고 `ManifestPolicyConfig`로 물리적으로 분리한다. |
| Q2 | 공통 경계는 bounded `bytes`와 immutable schema ID/version을 사용한다. |
| Q3 | 모든 in-repo Element를 parameter-capable 단일 `IComplianceElement` ABI로 통일한다. |
| Q4 | 정책 식별자에 배포 주소와 runtime code hash를 함께 바인딩하고 `decisionHash`가 이를 참조한다. |
| Q5 | 정책 이력은 온체인 event, 상세 증빙은 PII-free 불변 감사 아티팩트로 관리한다. |
| Q6 | 긴급 교체는 즉시 pause 후 새 불변 버전과 정상 timelock을 사용한다. |
| Q7 | production은 exact `recipeKey + version`만 사용하고 모호한 latest 주소 조회를 제거한다. |
| Q8 | 전체 범위를 이슈로 먼저 고정하고 의존성 순서로 작은 feature PR을 진행한다. |
| D-5 | 공통 경계와 반복 primitive만 제한적으로 정규화하고 범용 정책 DSL은 만들지 않는다. |

## 3. 결정된 사항

### Q1 — 자산별 정책값의 소유권

최소 거래금액, 자산별 허용 관할, 기간처럼 **동일 Element의 허용·거부 의미를
자산마다 바꾸는 값**은 Manifest의 정책 의미에 속한다. 다만 Manifest core를
무제한으로 확장하지 않고 versioned `ManifestPolicyConfig`로 분리한다.

`ManifestPolicyConfig`는 독립적으로 변경할 수 없다. Manifest proposal, timelock,
activation과 동일한 생명주기로 원자적으로 활성화하며 Manifest history와
`policyId`에 포함한다.

다음은 Manifest로 이동하지 않는다.

- KYC/TA 원본과 동적 provider 상태
- investor별 claim과 취득 lot
- surveillance runtime state
- 이름, 주소, 신분증 등 PII

**포기한 대안:** 모든 값을 Manifest에 집중하면 정책과 runtime evidence의 경계가
무너지고, 기존처럼 Element가 자산별 값을 소유하면 설정 변경이 Manifest
governance와 분리된다.

### Q2 — 파라미터 표현

공통 Element 경계는 길이가 제한된 `bytes parameters`를 받고 Registry/Toolkit은
다음을 activation 전에 검증한다.

- `schemaId`
- `schemaVersion`
- `maxParameterBytes`
- canonical `parameterHash`
- Element가 선언한 schema capability

각 Element 내부에서는 bytes를 전용 typed struct로 decode할 수 있다. 알 수 없는
schema, 과도한 길이, trailing data와 parameter가 없어야 하는 Element의 non-empty
입력은 fail-closed한다.

**포기한 대안:** `factsPacked`만 확장하면 숫자·집합·기간 표현이 경직되고, 공통
경계에 Element별 Solidity struct를 노출하면 새 Element마다 Engine과 Toolkit의
공개 타입을 바꿔야 한다.

### Q3 — 하나의 Element 인터페이스

제품에는 V1/V2 공개 인터페이스나 legacy adapter를 병존시키지 않는다. 모든
in-repo Element, Recipe, mock과 local Anvil 흐름을 다음 하나의 ABI로 migration한다.

```solidity
function check(
    address asset,
    address from,
    address to,
    uint256 amount,
    bytes calldata context,
    bytes calldata parameters
) external view returns (bool allowed, bytes32 reasonCode);
```

`elementId`는 호출 인자로 반복 전달하지 않는다. immutable Element Registry
binding이 identity의 source of truth다. 이미 배포된 GIWA 컨트랙트의 ABI 호환은
이번 migration 요구사항이 아니지만 저장소의 local Anvil demo와 conformance는
유지한다.

### Q4 — 정책과 실행 인스턴스 바인딩

runtime code hash만으로는 같은 코드를 가진 여러 배포 인스턴스의 상태와 권한을
구분할 수 없고, 주소만으로는 실제 코드 동일성을 증명할 수 없다. 따라서 둘을
함께 고정한다.

```text
logicalPolicyHash
  = Manifest/Config + exact Recipe/Element version
  + enforcement + schema/parameter hash

executionBindingHash
  = chainId
  + Engine/Registry/Element address
  + runtime code hash
  + CREATE2 factory/salt scheme where applicable

policyId = hash(logicalPolicyHash, executionBindingHash)
decisionHash = hash(trade, policyId, policyVersion, validUntil, execution constraints)
```

프록시를 허용하는 배포라면 프록시 주소뿐 아니라 당시 구현체 주소와 구현체 code
hash도 고정한다. 기본 경로는 immutable 구현을 우선한다. CREATE2는 예상 주소를
계산하는 수단이며 배포 후 code hash 검증을 대체하지 않는다.

### Q5 — 온체인 이력과 PII-free 감사 자료

두 방식을 역할별로 결합한다.

1. **온체인 event/history:** 정책 등록, 활성화, 중단, 교체, exact version,
   `policyId`, compiled plan과 artifact commitment를 기록한다.
2. **PII-free 감사 아티팩트:** Manifest/Config, Recipe/Element, parameter,
   enforcement, 주소/code hash, schema, source/tool version과 provider evidence
   commitment를 canonical 형식으로 보관한다.
3. **외부 provider:** 이름, 신분증, 주소와 KYC/TA 원본 PII를 보관한다.

Corner Store SDK는 아티팩트 schema, canonical encoder/hash, build/verify/reconstruct
CLI와 저장소 adapter interface를 제공한다. 중앙 hosted 감사 서비스를 제품의
필수 구성요소로 운영하지 않는다.

아티팩트 hash는 정책 활성화 전에 저장·재조회·검증하고 Manifest/Config와
원자적으로 고정한다. 파일 수정은 hash mismatch로 탐지하며 삭제·제출 거부 위험은
발행사 외 독립 보관소 복제와 write-once 운영으로 완화한다. 기존 활성 정책 실행은
감사 저장소 가용성에 의존하지 않지만 새 정책 활성화는 보관 검증 실패 시
fail-closed한다.

### Q6 — Element 긴급 교체

치명적 결함이 발견되면 가용성보다 조용한 compliance 완화 방지를 우선한다.

```text
탐지
  -> 영향 범위 global/asset/venue pause
  -> 미체결 quote 확인·취소
  -> 동일한 공통 ABI의 새 immutable Element version 배포
  -> 새 Recipe version 등록
  -> Manifest/Config update 예약
  -> Safe 승인 + 정상 timelock
  -> 코드·정책·감사 commitment 검증
  -> 거래 재개
```

같은 Element identity의 구현을 덮어쓰지 않고, Safe도 semantic update timelock을
우회하지 못한다. 이 선택은 복구 시간 동안 거래가 중단되는 비용을 감수한다.

### Q7 — Recipe latest 제거

production policy는 exact `(recipeKey, version)`을 사용한다. 모호한
`recipeOf(recipeId)` latest-address 조회는 제거한다. UI나 catalog discovery가
필요하면 `latestRegisteredVersionOf(recipeKey)`처럼 의미가 명확한 metadata만
제공하며 이것을 활성 버전으로 취급하지 않는다.

활성 Recipe의 source of truth는 Manifest다. 새 Recipe 등록만으로 ACTIVE
Manifest, compiled plan이나 `policyId`가 변경되어서는 안 된다.

### Q8 — 이슈 우선, 단계적 구현

한 PR에 ABI, storage, hash, 감사와 상품 migration을 함께 넣지 않는다. 전체 범위를
먼저 [#101](https://github.com/decipherhub/corner-store/issues/101)에 고정하고 아래
순서로 진행한다.

1. [#102](https://github.com/decipherhub/corner-store/issues/102) 통합 Element ABI와 bounded schema
2. [#103](https://github.com/decipherhub/corner-store/issues/103) `ManifestPolicyConfig`
3. [#104](https://github.com/decipherhub/corner-store/issues/104) exact Recipe version
4. [#110](https://github.com/decipherhub/corner-store/issues/110) 제한적 predicate 정규화
5. [#105](https://github.com/decipherhub/corner-store/issues/105) policy/deployment binding
6. [#106](https://github.com/decipherhub/corner-store/issues/106) 감사 아티팩트
7. [#107](https://github.com/decipherhub/corner-store/issues/107) 긴급 교체 runbook
8. [#108](https://github.com/decipherhub/corner-store/issues/108) Toolkit/Safe/gas/E2E
9. [#109](https://github.com/decipherhub/corner-store/issues/109) BUIDL-like 별도 migration

각 이슈는 origin/main 기반 feature branch와 별도 PR로 구현하고, `FEATURES.md`에는
동시에 하나만 active로 둔다.

### D-5 — 제한적 predicate 정규화(B+)

외부 형태와 안전 규칙은 강하게 통일하되 법률 의미까지 하나의 범용 predicate로
합치지 않는다.

통일 대상:

- 공통 `IComplianceElement` ABI
- schema ID/version, parameter envelope와 크기 상한
- metadata와 reason-code namespace
- fail-closed conformance suite
- 반복이 확인된 `BoolClaim`, `BoundedUint`, `TimestampWindow`,
  `SetMembership` 같은 내부 검증 primitive

분리 유지 대상:

- Accredited Investor와 Qualified Purchaser처럼 증빙과 법적 의미가 다른 Element
- provider/stateful 동작과 lifecycle
- 개별 Element의 reason taxonomy

Minimum Trade Amount처럼 자산과 무관한 판정 로직은 generic Element로 만들고
실제 값은 `ManifestPolicyConfig`에서 받는다. 임의 DSL/AST/interpreter와 무제한
AND/OR/NOT 조합은 만들지 않는다. 새로운 공통 primitive는 실제 Element 2개 이상에서
반복이 확인될 때 추가한다.

## 4. 결과와 트레이드오프

- 정책 변경은 명시적 새 version과 Manifest activation을 요구하므로 운영 단계가
  늘지만 자산별 영향 범위와 감사 재현성이 명확해진다.
- 주소와 code hash를 모두 commitment에 포함해 hash 계산과 onboarding 검증량이
  늘지만, 정확한 실행 인스턴스에 quote와 결정을 바인딩한다.
- 감사 아티팩트 보관 책임이 생기지만 원본 PII의 온체인 영구 공개를 피한다.
- 제한적 정규화는 얇은 Element wrapper 중복을 일부 허용하지만, 법률적으로 다른
  규칙을 하나의 범용 interpreter에 섞지 않는다.
- 모호한 latest API와 기존 Element ABI를 제거하므로 breaking migration이지만,
  기존 GIWA 배포 호환을 요구하지 않는 현재 시점에 하나의 제품 모델로 정리한다.

## 5. 별도 승인·외부 입력이 필요한 사항

이 ADR은 다음 값을 임의로 결정하지 않는다.

- 실제 BUIDL 상품의 최소금액·NAV·매수/매도/잔액 의미
- KYC/TA provider와 원본 PII 보관 계약
- 규제상 감사 자료 보관 기간과 독립 보관 운영자
- production Safe signer, threshold, key custody와 RPC/finality 사업자
- 프록시를 실제 production 배포에서 허용할지 여부

이 입력이 없으면 해당 production activation만 fail-closed하고, generic SDK와
reference/demo 구현을 실제 상품 승인으로 표현하지 않는다.

## 6. 검증 요구

각 구현 PR은 targeted test 후 `scripts/check.sh`와 필요한 Anvil E2E를 실행한다.
특히 다음을 회귀 테스트로 고정한다.

- Engine, CLI와 Toolkit의 parameter decode/decision 일치
- unknown/oversize schema fail-closed
- 새 Element/Recipe 등록이 기존 자산 정책을 자동 변경하지 않음
- 주소, chainId 또는 runtime code hash mismatch 거절
- `decisionHash`가 `policyId` 변경에 따라 달라짐
- 감사 아티팩트 변조 탐지와 PII 거절
- pause, 새 불변 version, timelock, 검증 후 resume 흐름
- `buidl-like`와 `reg-d` local Anvil demo 유지

## Related

- [`ADR-006`](./ADR-006-asset-agnostic-component.md)
- [`ADR-007`](./ADR-007-pd-architecture-decisions.md)
- [`ADR-008`](./ADR-008-compliance-seam-decisions.md)
- [`ADR-009`](./ADR-009-production-rfq-policy.md)
- [`../../DECISIONS.md`](../../DECISIONS.md)
- [Implementation epic #101](https://github.com/decipherhub/corner-store/issues/101)
