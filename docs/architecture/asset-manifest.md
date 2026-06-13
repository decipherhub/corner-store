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

version 변경 시 기존 order/quote의 처리와 grandfather 정책을 명시해야 한다.

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
- issuer coverage는 검증된 범위보다 넓게 해석하지 않는다.
- 명시적 `UNREGULATED` public path에는 SDK compliance 보장을 표시하지 않는다.
- Manifest와 `UNREGULATED` 분류가 모두 없으면 fail-closed한다.

## Current Decisions

- 기존 `token -> single Recipe` 모델을 Manifest로 확장한다.
- Manifest는 복수 Recipe orchestration의 입력이다.
- full data는 off-chain, compact core와 hash는 on-chain을 기본 방향으로 한다.
- 발행자 선언과 DEX 검토·승인 경계를 기록한다.

## Open Decisions

- token 단위 또는 token×venue 단위 scope
- 공개 필드와 비공개 자료의 경계
- Recipe set encoding과 version migration
- coverage field와 claim lookup 최적화
- Manifest proposal/approval role 구성
