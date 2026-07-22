# Asset Compliance Manifest

## Responsibility

Asset Compliance Manifest는 특정 자산에 적용되는 Recipe, resale path, execution
engine, version과 발행 측 compliance coverage를 하나의 검증 가능한 binding으로
관리한다.

핵심 질문:

> 이 자산에는 어떤 규제 효과와 실행 조건이 적용되며, 누가 어떤 범위를 선언하고
> 승인했는가?

## Owned Data

- manifest ID, schema version과 manifest version
- asset 또는 asset×venue scope
- Recipe set/reference
- enabled resale paths
- supported engines/venue types
- Recipe activation facts
- issuer-side compliance coverage
- state와 effective period
- off-chain full manifest hash
- proposer, reviewer/approver와 상태 변경 기록

## Lifecycle

Manifest 최소 상태:

- `PROPOSED`: 검토 전, 실행 불가
- `ACTIVE`: 승인된 version만 실행 가능
- `SUSPENDED`: 신규 실행 거부
- `RETIRED`: 신규 실행 거부, 과거 기록 유지

자산 분류 registry는 `REGULATED`, `UNREGULATED`, `UNKNOWN`을 구분한다.
`UNREGULATED`만 public pass-through를 사용할 수 있고 `UNKNOWN`은 거부한다.
거래 시에는 `tokenIn`과 `tokenOut`을 각각 resolve한다. 양쪽 모두 명시적
`UNREGULATED`일 때만 pass-through하며, 하나 이상의 regulated 자산이 있으면 해당
자산들의 `ACTIVE` Manifest를 모두 evaluation 입력으로 사용한다.

현재 semantic update는 별도 pending 값으로 예약되며 최소 1일 뒤에만 활성화된다.
활성화 시 version이 단조 증가하고 old/new manifest hash와 history hash가 event에
남는다. SUSPENDED 상태에서 update를 활성화해도 상태는 SUSPENDED로 유지된다.

## Recipe Binding Model

Registry는 regulated token마다 최대 8개의 `RecipeBinding`을 저장한다.

```solidity
struct RecipeBinding {
    uint16 recipeId;
    uint16 recipeVersion;
    RecipeBindingMode mode;
    uint16 pathGroupId;
    uint8 priority;
}
```

- `REQUIRED_BLOCKING`: 적용되는 모든 binding이 통과해야 한다.
- `PATH_OPTION`: 같은 `pathGroupId` 안에서는 하나 이상 통과해야 하고, 서로 다른
  group은 모두 통과해야 한다.
- `FLAG_ONLY`: 실패해도 거래를 막지 않고 binding index에 대응하는
  `flagsBitmap` bit와 Router event를 남긴다.

빈 plan, 8개 초과, 중복 recipe, version 0, 잘못된 path group과 blocking gate가
전혀 없는 plan은 등록 시 거부한다. Recipe 주소와 실제 version, Recipe당 최대 32개
Element는 평가 시 다시 fail-closed로 검증한다. binding 변경은 Manifest hash 변경,
timelock, version/history 증가를 거친 뒤에만 활성화된다.

`ManifestCore`의 과거 issuance/fund 필드는 ABI 전환을 위한 deprecated mirror이며
현재 Engine, Factory와 CLI의 source of truth는 registry의 `RecipeBinding[]`다.

## Responsibility Boundary

- 발행자: token facts와 issuer-side coverage를 선언
- DEX/operator: listing 목적에 맞는 Recipe/engine과 증빙을 검토·승인
- SDK: 선언·승인·version과 hash를 검증하고 실행 시 binding

Manifest는 어느 한쪽의 법률 책임을 다른 쪽에 이전하지 않는다.

## On-chain / Off-chain Split

hot path에 필요한 compact core만 온체인에 둔다. 법률 문서, 심사 근거, 민감
정보와 상세 governance configuration은 오프체인에 두고 `fullManifestHash`로
고정한다.

정확한 struct packing과 storage 위치는 gas 측정 후 확정한다.

## Invariants

- `ACTIVE`가 아닌 Manifest는 regulated execution을 허용하지 않는다.
- pair 거래에서 양쪽 자산의 classification과 regulated Manifest를 누락하지 않는다.
- Recipe set, version, engine과 scope가 decision에 바인딩된다.
- full manifest hash가 변경되면 새로운 version 또는 명시적 update가 필요하다.
- ACTIVE/SUSPENDED core fact를 직접 덮어써 timelock을 우회할 수 없다.
- issuer coverage는 검증된 범위보다 넓게 해석하지 않는다.
- 명시적 `UNREGULATED` public path에는 SDK compliance 보장을 표시하지 않는다.
- Manifest와 `UNREGULATED` 분류가 모두 없으면 fail-closed한다.

## Current Decisions

- 기존 `token -> single Recipe` 모델을 Manifest로 확장한다.
- Manifest는 복수 Recipe orchestration의 입력이다.
- full data는 off-chain, compact core와 hash는 on-chain을 기본 방향으로 한다.
- 발행자 선언과 DEX 검토·승인 경계를 기록한다.
- critical lifecycle state는 `TokenPolicyRegistry`에 보존하며 full document는
  `fullManifestHash`로 anchor한다.
- registry ownership이 Factory로 이전된 배포에서는 외부 governance가 Factory의
  forwarding API로 resume/update를 예약하고 operator가 delay 후 실행한다.

## Open Decisions

- token 단위 또는 token×venue 단위 scope
- 공개 필드와 비공개 자료의 경계
- coverage field와 claim lookup 최적화
- token 단위 version 변경이 기존 signed order/quote에 미치는 정책
- canonical `bytes32 recipeKey` alias와 per-element enforcement override compiler
