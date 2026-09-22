# CORE-011 — Policy Audit Artifact

## Outcome

정책 활성화 전에 PII-free canonical 감사 아티팩트가 불변 저장소에 보관됐음을
검증하고, 기존 Manifest commitment와 실행 배포의 `policyId`를 재현 가능한
checkpoint로 연결한다.

## Behavior Lock

- `ManifestCore.fullManifestHash`는 schema v4 onboarding에서 canonical audit
  artifact의 SHA-256 bytes32 commitment로 사용한다. 별도 mutable commitment
  registry를 추가하지 않는다.
- 기존 onboarding schema v1~v3와 local BUIDL-like/Reg-D demo 동작을 재해석하지
  않는다.
- 투자자 PII, provider 원문 payload, signer secret은 artifact schema에 들어갈 수
  없다.
- 중앙 hosted audit service와 특정 WORM vendor를 제품 필수 의존성으로 만들지 않는다.

## In Scope

1. domain-separated canonical `PolicyAuditArtifact` schema와 deterministic hash
2. provider evidence hash/signature reference와 compliance-data audit chain head 연결
3. `put/get/exists` 저장소 port와 immutable local reference adapter
4. build/store/verify/reconstruct CLI
5. onboarding schema v4의 artifact hash ↔ `fullManifestHash` 일치와 저장·재검증 gate
6. Engine의 permissionless policy/version/artifact/history checkpoint event
7. tamper, PII, missing store, stale commitment와 reconstruction regression tests
8. targeted/full checks와 필요한 local Anvil E2E

## Out of Scope

- production WORM vendor, retention 기간과 접근통제 운영
- 원본 KYC/TA/신분증 자료 저장
- Element incident replacement workflow(#107)
- 전체 production onboarding/gas/Safe 실행 완성(#108)
- 실제 BUIDL-like 상품 profile 승인(#109)

## Steps

1. canonical artifact·store의 tamper/PII/missing-store 회귀 테스트를 추가한다.
2. Toolkit artifact schema, hash, verify와 local immutable store를 구현한다.
3. Engine checkpoint event와 Foundry 회귀 테스트를 구현한다.
4. onboarding schema v4와 CLI를 artifact readiness gate에 연결한다.
5. 문서·FEATURES·PROGRESS를 갱신하고 targeted/full/E2E를 검증한다.

## Stop Condition

변조되거나 저장되지 않은 artifact로는 v4 onboarding plan을 만들 수 없고, 저장된
artifact를 hash로 복원할 수 있으며, 온체인 checkpoint가 token, policyId, version,
artifactHash와 historyHash를 함께 기록하고 기존 schema/demo가 모두 통과하면 종료한다.

## Result

- canonical artifact/store/CLI와 onboarding v4 readiness gate 구현
- Manifest digest commitment와 Engine policy checkpoint 구현
- Toolkit/CLI smoke, Engine 44/44, full Foundry 899/899, `scripts/check.sh`,
  BUIDL-like/Reg-D E2E 각각 7/7 통과
- production WORM vendor/retention, 긴급 교체(#107), 실제 onboarding 실행 완성(#108),
  BUIDL profile 승인(#109)은 계획대로 후속 범위 유지
