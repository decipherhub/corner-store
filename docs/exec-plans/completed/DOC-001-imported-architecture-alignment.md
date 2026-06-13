# Exec Plan: Imported Architecture Alignment

## Goal

제공된 최신 연구·회의 자료의 제품 방향을 Corner Store 공식 문서에 반영한다.
확정된 제품 정체성과 구조, 개발팀이 수용한 변경, 아직 결정되지 않은 요청을
구분해 다음 구현 feature가 추측 없이 시작할 수 있게 한다.

## Input Classification

### Adopted Product Direction

- 주 제품은 DEX-level compliance 표준과 Solidity SDK다.
- Corner Store는 Giwa 위에서 SDK를 증명하는 reference DEX/execution system이다.
- SDK는 정책 등록을 담당하는 Compliance Core와 venue 등록을 담당하는 Execution
  Integration Kit의 두 확장 축을 제공한다.
- 거래 측 compliance는 Element, Recipe, Manifest, Operator의 이름 기반 4-Layer다.
- Recipe는 법률효과 하나를 표현하며 한 거래에 복수 Recipe가 누적 AND로 적용된다.
- Manifest는 토큰별 Recipe, resale path, engine, version과 발행 측 coverage를
  binding한다.
- 온체인은 결정적 검증·게이팅·집행을 담당하고 무거운 데이터와 재량 판단은
  오프체인에서 처리한다.
- ERC-3643이 이미 검증한 사실은 가능한 한 재사용하되 운영주체의 독립 의무는
  별도로 남는다.

### Adopted Architecture Changes

- 기존 Token Policy/TRM 역할을 `Asset Compliance Manifest` 중심으로 명확히 한다.
- Router 평가를 single Recipe가 아니라 applicable Recipes 식별, Element 합집합,
  cumulative AND로 정의한다.
- 기존 ExecutionRouter, ComplianceEngine, Adapter와 multi-venue 경계는 유지한다.
- pair 거래는 `tokenIn`과 `tokenOut` 양쪽 classification과 regulated Manifest를
  함께 평가한다.

### Open Design Requests

- Rule 144 holding period용 acquisition data source
- stateful Element를 위한 commit hook의 정확한 interface와 호출 시점
- revert된 거래의 reject audit trail 보존 방식
- Manifest 적용 단위와 공개 범위
- AMM, RFQ, Order Book의 초기 우선순위와 실제 법률 허용 범위
- production operator, governance, KYC vendor와 legal approval

## In Scope

- 루트 제품 설명과 아키텍처 라우터
- `docs/MVP-v2-multi-venue.md`
- 책임별 architecture 문서
- `docs/ROADMAP.md`
- 제품 명세 인덱스, decisions, feature/progress/quality 상태
- testing/security 문서의 용어와 완료 기준

## Out of Scope

- Solidity 구현
- 41개 Element의 개별 법률 spec 확정
- 외부 change request의 미결 설계안을 임의로 확정
- production 법률 결론, 운영주체, 라이선스 또는 governance 확정
- `tools/deploy-v3` 변경

## Steps

1. 외부 입력 자료를 확정 방향, 채택 변경, 열린 요청으로 분류한다.
2. 제품 정체성과 4-Layer 모델을 공식 제품 명세에 반영한다.
3. architecture 책임 문서와 roadmap을 새 용어와 구현 순서로 정렬한다.
4. decision, progress, quality와 검증 문서를 동기화한다.
5. 링크, 용어, 상태와 전체 저장소 검증을 수행한다.

## Verification

- `3-Layer`, `TokenPolicyRegistry`, single Recipe와 오래된 fail-closed fast-path 표현
  잔존 여부 검색
- 공식 문서 간 SDK/reference DEX, 4-Layer, multi-Recipe 용어 교차 검토
- 로컬 Markdown 링크 확인
- `scripts/check.sh`
- `git diff --check`

## Completion Criteria

- 공식 제품 문서가 SDK를 주 제품, Corner Store를 reference 구현으로 설명한다.
- 4-Layer 이름과 책임이 모든 current 문서에서 일치한다.
- Manifest와 cumulative multi-Recipe가 실행 흐름과 roadmap에 반영된다.
- 채택하지 않은 change request는 결정된 구현처럼 표현되지 않는다.
- `DOC-001`의 모든 검증이 통과한다.

## Result

- Status: completed
- Completed: 2026-06-09
- Adopted:
  - SDK primary product and Corner Store reference DEX
  - named Element/Recipe/Manifest/Operator layers
  - Asset Compliance Manifest
  - cumulative multi-Recipe evaluation
  - on-chain verification / off-chain judgment boundary
- Left open:
  - acquisition data source
  - stateful Element commit hook
  - reject audit trail
  - Manifest scope/publicity and production legal/operator decisions
- Verification:
  - current-document legacy terminology search
  - local Markdown path check across 29 project files
  - bilateral asset classification and Manifest evaluation review
  - Compliance Core / Execution Integration Kit / reference Adapter boundary review
  - removal of current-document dependency on non-committed input paths
  - `scripts/check.sh`
  - `git diff --check`
