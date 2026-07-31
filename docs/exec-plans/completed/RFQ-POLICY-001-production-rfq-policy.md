# RFQ-POLICY-001 — Production RFQ Policy

## Goal

reference RFQ를 production으로 확장하기 전에 custody, fill, signer, nonce,
pricing/risk와 운영 책임을 하나의 구현 기준으로 고정한다.

## In Scope

1. non-custodial settlement와 외부 custody 경계
2. exact full-fill v1과 partial-fill migration boundary
3. maker settlement account와 quote signer 분리
4. durable maker-scoped nonce와 idempotency
5. production pricing/inventory-risk fail-closed 계약
6. authentication, audit, monitoring과 incident responsibility
7. Router fill-time compliance와 amount-cap axis

## Out of Scope

- 특정 custodian, dealer, KMS/HSM 또는 database vendor 선정
- hosted production RFQ service 운영
- partial-fill adapter 구현
- 실제 pricing strategy 또는 inventory model 구현
- 법률·라이선스 적합성 확정

## Execution

1. 현재 RFQ Adapter, Router, SDK와 threat model의 보장/잔여 위험을 정리한다.
2. accepted ADR에 production v1의 불변식과 migration boundary를 기록한다.
3. component-level interface, call timing, failure와 audit contract를 명세한다.
4. security, roadmap, feature와 progress source of truth를 정렬한다.
5. 후속 구현을 독립 이슈로 분리한다.

## Completion Evidence

- ADR과 product spec 간 결정 불일치 없음
- 현재 contract/SDK field와 변경 필요 지점 명시
- concurrency, inventory reservation, signer rotation, reorg와 fill-time policy
  failure test matrix 포함
- 후속 구현 이슈 #65, #66, #67 생성
- changed-document local link check 통과
- independent architecture review와 adversarial critic 재검토 승인
- `git diff --check` 통과
