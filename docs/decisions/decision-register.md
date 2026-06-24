# 결정 등록부 (Decision Register) — 팀 전체 마스터 인덱스

> **이 문서가 뭔가.** 프로젝트의 *모든 결정*을 한 장에서 본다 — 무엇이 **확정**됐고, 무엇이 **제안(개발팀 합의 대기)**이며, 무엇이 **법률 대기**인지. 각 결정의 *상세*는 출처(ADR/제안문서/의뢰서)에 있고, 여기는 *목록·상태·담당·링크*만(DRY 인덱스).
> **갱신:** 새 결정·상태 변화 시 이 표에 행 추가/상태 갱신. ADR이 확정되면 상태를 ✅로.
> **개발팀 `DECISIONS.md`와의 관계:** 개발팀 자체 로그(D001~D005, 제품·아키텍처)와 *상보*. 본 등록부 = 컴플라이언스·구조 결정의 *인덱스*, 상세 법률결정은 `ADR-*`.

**상태 범례:** ✅ 확정(ADR/비준) · 🟢 제안·방향비준(개발팀 구현 합의 대기) · 🟠 제안·미비준 · ⚖️ 법률 대기(변호사) · 🍃 deferred

---

## 1. ✅ 확정 — Accepted ADR

| ID | 결정 | 담당 | 비고 |
|---|---|---|---|
| **ADR-001** | F-04 Reg M(유통 중 시세지지 금지) 부품 추가 | 리걸 | |
| **ADR-002** | R-XJ(제재·관할·Reg M) = 모든 Recipe 앞 always-on prefactor, fail-closed | 리걸 | |
| **ADR-003** | Privacy posture + ZK-readiness 불변식 3종(평문 PII 금지 등) | 리걸 | |
| **ADR-004** | Element Pool Freeze v1 (frozen pool 무단 추가 금지) | 팀 | |
| **ADR-005** | **§4(a)(7) = 주 재판매경로**(A-03 active), Rule 144 보조 | 리걸 | ⚖️ general solicitation 충족 판정만 잔여(07 ③) |
| **ADR-006** | 부품 asset-agnostic(자산 사실이 일반 부품에 하드코딩 ❌) | 리걸 | |

## 2. ✅ 확정 — 사용자(리걸/PM) 비준 [스코프·정책]

| ID | 결정 | 비고 |
|---|---|---|
| **Q1** | Phase 1 = US persons만, Reg S(역외) seam만 보존(머신 미구축) | 기획 OD 7-2 종결 |
| **Q2** | 발행사 attestation = 상장 precondition(self-cert 경로 미구축) | ⚖️ 적법성 07 ⑥ |
| **Q3** | 취득기록을 매수 시점 commit hook에서 write | 구현=개발팀 |
| **Q4** | 다관할 = jurisdiction-swap(부품 관할-무관 + swap recipe) 표준 | ADR 후보 |
| **Q5** | Rule 144 fallback = 비-affiliate 한정(affiliate는 §4(a)(7)) | volume tracker 불요의 전제 |
| **Q6** | 관할 입력 = country + US state | |
| **Q7** | freeze 게이트 = N≥2 증권유형 *사고실험* 검증 | 회사채·Reg A+ 수행 완료 |

## 3. 🟢 제안 — 구조 토대 (사용자 방향비준 ✅, 개발팀 *구현* 합의 대기)

> 상세: [`docs/architecture/phase1-structural-decisions-proposed.md`](../architecture/phase1-structural-decisions-proposed.md) (PD-1~7). 합의 시 ADR-007~013.

| ID | 결정 | 합의 주체 |
|---|---|---|
| **PD-1 / Q8** | Manifest = open-enum **레지스트리** 스키마(닫힌 boolean ❌) | 👥 개발팀 |
| **PD-2 / Q9** | 다중-Recipe 라우터 + **열린 Recipe 레지스트리** + no-R2 수용 | 👥 개발팀 |
| **PD-3 / Q10·Q10-a** | 두 경로 상태모델(체결 전 관문 + 체결 후 commit) + cross-venue 진리원천=TA anchor | 👥 개발팀 |
| **PD-4 / Q11** | TA attested-claim **단일 파이프라인**(매도측 + cross-venue) | 👥 개발팀 + 발행사 |
| **PD-5 / Q12** | 자동/인간 **경계 분류**(차단/깃발/Operator 행위) — *L3 스펙 직결* | 👥 개발팀 + 🏛️ 팀 |
| **PD-6 / Q13** | Operator 거버넌스 = multisig + timelock | 🏛️ 팀·ADR |
| **PD-7 / Q14** | 생애주기 구조 훅 4종(version·append-only 연혁·halt/freeze·record 보존) | 👥 개발팀 |

## 4. Recipe 결정 (DR) — 구조 분석 산출

> 상세: 내부 `02b_Recipe 구조 분석` · `02c_DR-6`.

| ID | 결정 | 상태 |
|---|---|---|
| **DR-1** | 다중-Recipe cumulative 조율 | ✅ (이미 Recipe v4) |
| **DR-2** | 라우터가 5종 결합논리(AND·경로OR·상시누적·역방향flag·fail-closed) 일반 처리 | 🟢 (=PD-2) |
| **DR-3** | Manifest가 Recipe 활성화 필드 선언 | 🟢 (=PD-1) |
| **DR-4** | R3(펀드) = 모든 거래에 상시 누적 | 🟢 |
| **DR-5** | R-XJ = fail-closed prefactor | ✅ (=ADR-002) |
| **DR-6** | Recipe 양립불가 = *구성시점* 분리(B-01)·ZK (런타임 resolver ❌) | ✅ 리서치·검증 완료 |
| **DR-7** | Recipe는 제한 *추가만*(monotonic) — strict 임계치 규칙은 redundant 폐기 | ✅ 재정의 |
| **DR-8** | Recipe = 열린 모듈 레지스트리(SDK Layer 라이브러리) | 🟢 (=PD-2) |

## 5. ⚖️ 법률 대기 — 변호사 의뢰 (07)

> 상세: 내부 `07 법률 검토 의뢰서`(풀어쓴 버전). 결정이 아니라 *확인 대기* 항목.

| 묶음 | 항목 | 우선 |
|---|---|---|
| 매도측·reliance | Q-S2(reliance 충분성)·Q-R5(audit trail)·Q-S1(indemnification)·Q-S3(opinion)·Q-S4(precondition 적법)·Q-R4(Manifest 권한) | 🟠 R5·S2 |
| A-03 적격투자자 | Q-A03-1~5(strict>·release번호·freshness·**general solicitation**·고액최소투자) | 🟠 GS |
| 운영·생애주기 | Q-OP(SAR·WSP)·Q-TA(TA협약·cross-chain)·Q-LC(상장폐지·claim소급) | 🟡 |
| deferred | Q-S5(Reg S) | 🍃 |

## 6. 다음 게이트

- **구조 FREEZE** = §3 PD-1·2·3·5·7 개발팀 합의 + §5 중 구조-걸린 법률 회신.
- **L3 컴포넌트 스펙** = freeze 후, 부품별 §5 leaf 회신 받아 A-03부터 순차.
- 상세 의존사슬·게이트: 내부 `_구조 확정 게이트 — 논의 준비`.

---

## 변경 로그
- [2026-06-24] (canton-rwa) v1.0 신설. 흩어진 결정(ADR-001~006·사용자 비준 Q1~7·proposed PD-1~7·Recipe DR-1~8·법률대기 07)을 *팀 전체 마스터 인덱스* 한 장으로 통합. 상태 범례(✅확정/🟢제안·방향비준/🟠미비준/⚖️법률대기/🍃deferred) + 담당 + 출처 링크. 개발팀 DECISIONS.md와 상보(컴플라이언스·구조 인덱스). DRY — 상세는 각 ADR/제안문서/의뢰서.
