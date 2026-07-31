# DATA-001 — Compliance Data Layer Foundation

## Goal

ADR-008의 네 seam을 하나의 재사용 가능한 기반으로 연결한다. Transfer Agent lot
입력을 검증·컴파일하고, 온체인 Lockup이 신뢰할 수 있는 snapshot을 fail-closed로
소비하며, 거절·우회·stateful counter를 off-chain에서 감사 가능하게 보존한다.

## In Scope

- provider-neutral TA lot interface와 deterministic lineage/clock resolver
- operator-attested on-chain acquisition snapshot source
- missing, stale, broken-lineage, immature Lockup reason 분리
- hash-chained rejection/surveillance audit trail
- person-group rolling volume와 holder-state idempotency
- package smoke, Foundry unit test, integrated check와 source-of-truth 문서 정렬

## Out of Scope

- undocumented Securitize Connect API 호출 또는 compatibility claim
- production WORM vendor, hosted indexer, SAR filing과 PII 저장
- 법률 미확정 FPI holder threshold와 controlled-venue 선택
- RFQ custody, real Uniswap v3와 Order Book

## Steps

1. Existing `IAcquisitionSource` regression behavior를 테스트로 고정한다.
2. lot resolver와 audit/state SDK를 구현한다.
3. attested snapshot contract와 richer Lockup failure path를 구현한다.
4. demo fixture와 문서를 새 boundary에 맞춘다.
5. targeted test, repository check와 security review를 통과한다.

## Completion Evidence

- valid inherited lot가 lineage clock을 승계한다.
- missing/cyclic lineage와 stale snapshot은 fail-closed한다.
- duplicate execution commit은 no-op이고 conflicting replay는 거부된다.
- audit record 변조가 hash-chain validation에서 탐지된다.
- real provider가 없어도 mock TA 입력으로 end-to-end snapshot/Lockup test가 가능하다.

## Result

- Status: completed
- `scripts/check.sh`: Foundry 618/618, 모든 Node smoke, deploy-v3 10/10 통과
- live E2E: `buidl-like`, `reg-d` 각각 7/7 및 delayed recovery/AMM/RFQ 통과
- independent review의 secondary-lineage lockup bypass와 test-gap 지적을 수정함
- 미검증 범위: 실제 Securitize API, amount-specific lot allocation, production WORM
