---
type: core-handoff
title: 법률-기술 변환표 (Legal-to-Technical Matrix) v1
status: v1 — Element Pool Freeze v1(ADR-004) 기준 · 개발팀 핸드오프
audience: 개발팀(주 독자)·법무팀·외부 consultant
base: 노트 33 §2.5(Element·Recipe Map) · ADR-001~004 · 방법론(법률-코드화 일반원리)
created: 2026-06-17
related-external-sources:
  - "Reg D Rule 501(a)/506(c): https://www.law.cornell.edu/cfr/text/17/230.506"
  - "Rule 144: https://www.law.cornell.edu/cfr/text/17/230.144"
  - "ICA §2(a)(51)/§3(c)(7): https://www.law.cornell.edu/uscode/text/15/80a-3"
  - "Rule 2a51-1 / 3c-5: https://www.law.cornell.edu/cfr/text/17/270.2a51-1"
  - "Reg M (Rule 101-102): https://www.law.cornell.edu/cfr/text/17/part-242"
tags: [core-handoff, legal-to-technical-matrix, element-pool, freeze-v1, dev-handoff]
---

# 법률-기술 변환표 (Legal-to-Technical Matrix) v1

> **이 문서가 뭔가.** 개발팀이 컴플라이언스 엔진(Phase 1)을 구현할 때 보는 *자재 명세서이자 배선도*다. **각 법률요건마다 — 어떤 증거를 입력받아, 어느 부품(Element)이, 어디서(집행 지점) 검사하고, 실패하면 어떤 코드로 어떻게 처리하는지**를 한 표에 잇는다. 이게 연대기 §6이 말한 *"개발팀이 착수 조건으로 기다리는 핵심 미제출 산출물"*이다.
>
> **base**: 부품 목록은 **Element Pool Freeze v1**(ADR-004)으로 동결된 노트 33 §2.5 Map 기준. 행 양식은 노트 12 §III(per-asset 논증서)의 cross-element 버전.
>
> **읽는 법.** 핵심 명제(방법론) 한 줄 — *부품(Element) 1개 = 요건 하나의 포섭, 묶음(Recipe) 1개 = 법률 하나의 소결론, 한 거래 = 걸리는 모든 Recipe의 cumulative AND.* 위반 거래는 *체결되지 않는다*(원칙 G1).

> ⚠️ **완성도 표기.** ✅ = walkthrough/spec 확정 · 🟡 = spec 정밀화 대기(아래 §5). reasonCode 중 🟡 부품의 것은 *잠정*이며, 해당 부품 walkthrough 작성 시 확정한다.

---

## §1. Recipe(묶음) 4종 + 횡단 — 무엇이 어떤 법률효과를 만드나

| Recipe | 법률효과(소결론) | 핵심 부품 | 조건부 부품 |
|---|---|---|---|
| **R1 — Reg D 506(c) Issuance** | "§5 등록 면제 성립"(발행 framework 유지) | A-01·A-02·A-03·A-04·A-11·E-01·E-03·F-04·B-01·B-02·B-03 | A-08·A-09(entity 매수인) |
| **R2 — §4(a)(7)·Rule 144 Resale** | "§2(a)(11) underwriter 비해당 safe harbor"(2차 거래 적법) | A-01·A-02·A-03·A-04·C-00·C-01·B-01·B-02·B-03 | A-06·A-12(affiliate 매도인) |
| **R3 — ICA §3(c)(7) Fund** | "투자회사 등록 의무 면제"(펀드 form 유지) | **A-13(QP)**·D-01(2000 cap)·B-01 | A-08·A-09(entity QP look-through) |
| **R4 — 시장행위 감시** | "anti-fraud·시세조종 위반 부재 추정"(사후) | F-02·F-03·F-01·A-12 | A-06(내부자거래 연계) |
| **R-XJ — Cross-Jurisdictional**(ADR-002) | 제재·관할·Reg M = 증권법과 *독립*·**always-on** | A-01·A-02·F-04 | — (모든 자산·관할 universal binding) |

> R-XJ는 asset-triggered가 아니라 *항상 켜짐*. A-01·A-02·F-04는 위 R1~R4에도 attached되지만, 거버넌스·재사용은 R-XJ가 관할(ADR-002).

---

## §2. THE MATRIX — 부품별 법률→코드 변환 (23 elements)

> 열: **법조문/요건 · 적용 논리 · 입력(증거) · 패턴 · 집행 지점 · reasonCode(실패) · 실패 동작 · 한계/위임**. 패턴 A=기계 직접판정 / B=증명서 확인 / C=감시(flag).

### A — 신원·자격 (매수인 측)

| 부품 | 법조문/요건 | 입력(증거) | 패턴 | 집행 지점 | reasonCode | 실패 동작 | 한계/위임 |
|---|---|---|---|---|---|---|---|
| **A-01** 제재명단 ✅ | OFAC SDN(31 CFR)·IEEPA — strict liability | buyer/seller addr ↔ SDN list | A | pre-trade gate | `FAIL_SANCTIONED` | reject(영구) | SDN list oracle 신선도 |
| **A-02** 국가제한 ✅ | 관할 제재·Reg S 역외 — 허용 jurisdiction only | buyer jurisdiction(claim) | A | pre-trade | `FAIL_JURISDICTION_BLOCKED` | reject | jurisdiction 판정 source |
| **A-03** 적격투자자 ✅ | Reg D Rule 501(a) + 506(c)(2)(ii)(C) 검증 | Trusted Issuer claim(accredited basis) | B | pre-trade | `FAIL_NOT_ACCREDITED` | reject → KYC redirect | 발급기관 신뢰·reasonable verification(walkthrough A-03) |
| **A-04** 신원중복 ✅ | 실질 1인 판정(506(b) count·제재 회피) | identity dedup(ONCHAINID) | A | pre-trade | `FAIL_DUPLICATE_IDENTITY` | reject | 다지갑 linkage 한계 |
| **A-06** 내부자(affiliate) ✅ | Rule 144(a)(1)·Rule 405 "control" | affiliate claim + red flag | B+C | pre-trade | `FAIL_AFFILIATE_RESTRICTED` 외 | reject/조건부 | 동적·90d decay·issuer 협조(walkthrough A-06·Wolfson cite 확인 대기) |
| **A-08** 법인자격 🟡 | Rule 501(a) entity·§2(a)(51) entity | entity eligibility claim | B | pre-trade | `FAIL_ENTITY_NOT_ELIGIBLE` | reject | entity 구조 판정(R-1 통합) |
| **A-09** look-through 🟡 | Rule 501(a) look-through·Rule 2a51-3(목적형성)·1997 S&C NAL | lookThroughChain[] | B | pre-trade | `FAIL_LOOKTHROUGH_REQUIRED`/`_NOT_COMPLETED` | reject/suspend | 재귀 depth(권고 3·Open Issue)·partial 처리 |
| **A-11** 증명유효기간 ✅ | "at the time of acquisition"(§3(c)(7)A) | claim.verifiedAt vs block.timestamp | A | pre-trade | `FAIL_CLAIM_EXPIRED` | reject → renewal | time-of-acquisition timestamp 기준(Open Issue) |
| **A-12** 모름항변 차단 🟡 | reasonable care·red flag(506(c) verification) | red flag list 적용 | C | pre-trade | `REVIEW_RED_FLAG` | review queue | red flag 정의(R-3 통합) |
| **A-13** ⭐ QP ✅ | ICA §2(a)(51)·§3(c)(7)·Rule 2a51-1(h)·Rule 3c-5(KE) | QP claim(basis enum: 자연인/가족/신탁/기관/KE) | B | pre-trade | `FAIL_NOT_QP` 외 **9 코드** | reject/suspend/review | valuation·look-through·KE·time-of-acq(§12 Open Issues·walkthrough A-13) |

### B — 자산·기술 메타

| 부품 | 법조문/요건 | 입력(증거) | 패턴 | 집행 지점 | reasonCode | 실패 동작 | 한계/위임 |
|---|---|---|---|---|---|---|---|
| **B-01** 신상카드 정합 ✅ | (documentary integrity — 감사 기반) | Manifest hash·facts consistency | A | **post-trade commit** | `FAIL_MANIFEST_INTEGRITY` | audit alert | Manifest governance |
| **B-02** 토큰표준 ✅ | ERC-3643 compliance(transfer 통제 전제) | token interface check | A | pre-trade | `FAIL_NOT_ERC3643` | reject | — |
| **B-03** 이전제한 메타 ✅ | restricted securities flag(Rule 144) | restrictedFlag·tag | A | pre-trade | `FAIL_TRANSFER_RESTRICTED` | reject | — |
| **B-04** 엔진선택 ✅ | 거래 mechanism 적합(supportedEngines) | supportedEngines bitset | A | pre-trade | `FAIL_ENGINE_UNSUPPORTED` | reject | — |

### C — 거래 경로·시점

| 부품 | 법조문/요건 | 입력(증거) | 패턴 | 집행 지점 | reasonCode | 실패 동작 | 한계/위임 |
|---|---|---|---|---|---|---|---|
| **C-00** 전매경로 선택기 🟡 | §4(a)(1)/(1½)/(7)·Rule 144 분기 | 거래 context | A(분기) | pre-trade | `FAIL_NO_RESALE_PATH` | reject | 경로 판정 위임(R-4·변호사) |
| **C-01** 보유기간 ✅ | Rule 144(d) 6m(reporting)/12m(non) | acquiredAt·isReportingCompany | A | pre-trade | `FAIL_HOLD_PERIOD_NOT_MET` | reject | 취득일 source = acquisition registry |

### D — 집계·누적

| 부품 | 법조문/요건 | 입력(증거) | 패턴 | 집행 지점 | reasonCode | 실패 동작 | 한계/위임 |
|---|---|---|---|---|---|---|---|
| **D-01** 보유자수 카운터 🟡 | 506(b) 35·§3(c)(1) 100·**§3(c)(7) ~2000**('34 §12(g)) | holder count(**STATEFUL**) | A | **post-trade commit** | `FAIL_HOLDER_CAP_EXCEEDED` | reject/suspend | STATEFUL counter·집계 단위(OD-1) |

### E — 발행자 측

| 부품 | 법조문/요건 | 입력(증거) | 패턴 | 집행 지점 | reasonCode | 실패 동작 | 한계/위임 |
|---|---|---|---|---|---|---|---|
| **E-01** Form D 확인 🟡 | Reg D Rule 503 Form D filing | SEC EDGAR Form D | A | pre-trade | `FAIL_NO_FORM_D` | reject | EDGAR oracle |
| **E-03** bad actor ✅ | Rule 506(d) bad actor disqualification | bad actor list | A | pre-trade | `FAIL_BAD_ACTOR` | reject | bad actor 판정 source |

### F — 행위·운영

| 부품 | 법조문/요건 | 입력(증거) | 패턴 | 집행 지점 | reasonCode | 실패 동작 | 한계/위임 |
|---|---|---|---|---|---|---|---|
| **F-01** 자기거래 제한 🟡 | 운영자 self-dealing·이해상충 | operator·임직원·계열 list | A | pre-trade | `FAIL_SELF_DEALING` | reject | 계열 명단 governance(R-3) |
| **F-02** 시장감시 🟡 | §9·Rule 10b-5·Reg M(wash·spoofing) | 거래 패턴(**STATEFUL**) | C | **post-trade flag** | `FLAG_MARKET_ABUSE` | flag + Operator 판단 | 통계 기반·*차단기 아님*(SLA OD-OP-3) |
| **F-03** 사기감시 🟡 | §17·10b-5·SAR(의심거래 보고) | 의심거래 패턴 | C | **post-trade flag** | `FLAG_SUSPICIOUS` | flag + Operator + 보고 | 위임 못 하는 의무(SAR) |
| **F-04** 판매중 매수금지 ✅ | Reg M Rule 101/102(ADR-001) | distributionStatus·restrictedParties | A | pre-trade | `REGM_RESTRICTED` | reject | distribution 판정 facts(Q-T2·always-on) |

---

## §3. BUIDL 1거래의 cumulative trace (concrete) — 개발팀 통합 그림

> BUIDL $100K 매도(김 부장 BlackRock affiliate → Acme Capital entity). 걸리는 Recipe 전부 *cumulative AND*.

```
[BUIDL $100K 매도] → ACM[BUIDL] manifest 조회
  ├─ R1 (Reg D 506(c)):  A-01·A-02·A-03·A-04·A-11·E-01·E-03·F-04·B-01·B-02·B-03  (AND)
  ├─ R2 (§4(a)(7) Resale): A-01·A-02·A-03·A-04·C-00·C-01·B-01·B-02·B-03  (AND)
  │     + 매도인=affiliate → A-06·A-12 cumulative activate
  ├─ R3 (ICA §3(c)(7)):  A-13(QP) + D-01(2000 cap) + B-01  (AND)
  │     + 매수인=entity → A-08·A-09 look-through cumulative activate
  ├─ R4 (시장감시):       F-02·F-03·F-01·A-12  (post-trade flag)
  └─ R-XJ (always-on):    A-01·A-02·F-04  (universal)

⇨ 4(+1) Recipe × ~18 unique Element = cumulative AND 전부 통과해야 swap 체결
```

해설: A-01·A-02·B-01은 *모든 Recipe에 공유*(high re-use). A-13은 R3 전용. 한 거래에서 *어느 하나라도 FAIL이면 거래 불성립*(strict, 원칙 G1·G9).

---

## §4. Element × Recipe 부착 매트릭스 (●필수 ○조건부 —무관)

| Element \ Recipe | R1 발행 | R2 전매 | R3 펀드 | R4 감시 | R-XJ |
|---|---|---|---|---|---|
| A-01 OFAC | ● | ● | ● | ○ | ● |
| A-02 국가 | ● | ● | ● | — | ● |
| A-03 적격투자자 | ● | ● | — | — | — |
| A-04 신원중복 | ● | ● | — | — | — |
| A-06 affiliate | — | ○ | — | ○ | — |
| A-08 법인자격 | ○ | — | ○ | — | — |
| A-09 look-through | ○ | — | ○ | — | — |
| A-11 증명만료 | ● | ● | — | — | — |
| A-12 모름항변 | — | ○ | — | ● | — |
| **A-13 QP** | — | — | ● | — | — |
| B-01 manifest | ● | ● | ● | — | — |
| B-02 토큰표준 | ● | ● | — | — | — |
| B-03 restricted | ● | ● | — | — | — |
| B-04 엔진 | ● | ● | — | — | — |
| C-00 전매경로 | — | ● | — | — | — |
| C-01 보유기간 | — | ● | — | — | — |
| D-01 보유자수 | — | — | ● | — | — |
| E-01 Form D | ● | — | — | — | — |
| E-03 bad actor | ● | — | — | — | — |
| F-01 자기거래 | — | — | — | ● | — |
| F-02 시장감시 | — | — | — | ● | — |
| F-03 사기감시 | — | — | — | ● | — |
| F-04 판매중매수금지 | ● | — | — | — | ● |

**re-use 요약**: A-01·A-02·B-01(모든 Recipe) · A-03·A-04·A-11·B-02·B-03(R1·R2) · A-13(R3 전용) · 조건부 A-06·A-08·A-09·A-12(사실관계 따라 activate). → Element는 *공유 라이브러리*, update governance는 Element 단위(2-of-3 multisig·24h timelock, 노트 06 Patch A).

---

## §5. 완성도 — 어디까지 spec-ready인가 (개발팀 신뢰도)

| 상태 | 부품 | 의미 |
|---|---|---|
| ✅ **spec 확정** | A-13·A-03·A-06(walkthrough 3종) + A-01·A-02·A-04·A-11·B-01~04·C-01·E-03·F-04 | 바로 구현 가능 |
| 🟡 **정밀화 대기** | A-08·A-09·A-12·C-00·D-01·E-01·F-01·F-02·F-03 | reasonCode·경계는 잠정 — walkthrough/spec 작성 시 확정 |

→ **BUIDL 데모 경로(R1+R2+R3+R-XJ)의 핵심 부품은 대부분 ✅.** 🟡는 주로 R4 감시·집계(D-01)·entity look-through(A-08/09)로, 데모 핵심 흐름엔 조건부. **다음 walkthrough 우선순위: A-09(look-through, A-13 cascade 직결) → D-01(STATEFUL 카운터) → C-00(전매경로).**

---

## §6. 횡단 불변식 (전 부품 적용 — 구현 시 강제)

- **ADR-002 (Cross-Jurisdictional Recipe)**: A-01·A-02·F-04는 R-XJ로 always-on binding. Router는 "Recipe 조합" 단일 메커니즘.
- **ADR-003 (Privacy/ZK-readiness)**: ① 부품은 credential을 `verify(증명)→결과`로 검증(평문 enum 직접 의존 금지 → claim↔ZK proof swap 가능) ② 개인·신용정보 on-chain 평문 금지(hash/proof만) ③ 거래그래프·호가 경로 confidential/shielded-ready.
- **검증 패턴(방법론)**: B(증명서) 부품은 Trusted Issuer의 reasonable belief(Rule 2a51-1(h) 등) 위에 섬 — 온체인은 결정론적 확인만.
- **timing 구분**: 대부분 pre-trade gate. **post-trade commit**(B-01·D-01) / **post-trade flag**(F-02·F-03)는 별도 경로(B-01 정합검사·Operator).
- **STATEFUL**: D-01·F-02·F-03만 상태 보유(counter·패턴). 나머지는 STATELESS(스냅샷).

---

## §7. 한계 + 다음

- 🟡 부품 9종의 reasonCode·경계는 *잠정* — 해당 walkthrough에서 확정(특히 A-09·D-01).
- pre-trade Open Issues: time-of-acquisition timestamp(A-11·A-13), look-through depth(A-09·A-13) — 변호사 트랙·ADR 대기.
- 이 변환표 = 노트 12 dossier(per-asset)의 *cross-element 집약본*. 자산별 인스턴스(BUIDL dossier)는 이 표에서 BUIDL 적용 Recipe만 추려 생성.
- **개발팀 핸드오프 준비 완료** — 본 표 + walkthrough 3종(A-13·A-03·A-06) + 방법론으로 Phase 1 착수 가능. (= 연대기 §6 "핵심 미제출 산출물" 해소.)

---

## 변경 로그
- **[2026-06-17] v1 신설.** Element Pool Freeze v1(ADR-004) 기준 Legal-to-Technical Matrix — 연대기 §6의 "개발팀 대기 핵심 미제출 산출물" 해소. 23 부품 × 법조문→입력→패턴→집행지점→reasonCode→실패동작→한계 변환표 + Recipe(R1~R4+R-XJ) buildlist + BUIDL cumulative trace + 부착 매트릭스 + 완성도(✅14/🟡9) + 횡단 불변식(ADR-002/003). base=노트 33 §2.5. 검증 citation 반영(Rule 2a51-1(h)·3c-5·506(c)(2)(ii)(C)·Reg M ADR-001). 다음 walkthrough 우선순위: A-09→D-01→C-00.
