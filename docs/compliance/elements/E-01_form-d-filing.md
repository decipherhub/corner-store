---
type: element-walkthrough
element-id: E-01
element-name: Form D Filing Check (Form D 확인)
parent-recipe: R1 (Reg D 506(c) Issuance)
internal-id: ELE.E-01
status: v1.0 — 공유 산출물 form (자체완결·규제맥락 우선·인용 검증 대기)
audience: 개발팀·법무팀·외부 consultant·학회원
related-external-sources:
  - "17 CFR § 230.503 — Form D 제출 의무(최초 매도 후 15일): https://www.ecfr.gov/current/title-17/section-230.503"
  - "17 CFR § 230.507 — Form D 미제출자 disqualification: https://www.ecfr.gov/current/title-17/section-230.507"
  - "SEC EDGAR — Form D 공시 시스템: https://www.sec.gov/cgi-bin/browse-edgar"
created: 2026-06-17
updated: 2026-06-17
tags: [element, E-01, form-d, edgar, walkthrough, spec-sheet, R1, pattern-A, issuer-side]
---

# E-01 Form D Filing Check — 부품 심층 인수인계 문서 (Walkthrough)

> **이 문서는 무엇인가.** Decipher 컴플라이언스 부품 중 **"발행자가 SEC에 Form D를 제출했는지 확인하는 부품"**(내부 식별자 E-01)을 풀어 쓴 문서다. Reg D 사모 면제를 쓰면 발행자는 *Form D*(사모 통지서)를 SEC에 내야 하는데, 본 부품은 그 *발행자 측 의무 이행*을 거래 직전에 확인한다. 매수인 자격(A-03 등)이 아니라 **발행자 측 사실**을 보는 부품이다.
>
> **자체완결 원칙.** 다른 내부 문서를 열지 않아도 단독으로 이해되도록 작성했다. 인용은 외부 공식 자료만 사용한다.

> ✅ **인용 검증 완료** (2026-06-17 eCFR/uscode 일괄 패스·오류 0건, 상세 `_core/인용 검증 리포트`). 작성 시 메모 ↓ — **인용 검증 상태 (v1.0, 2026-06-17 — 검증 대기).** "먼저 작성, 검증 나중" 1차 초안. **미세 locator 주의**: Rule 503의 15일 기한·503의 항번호·507 disqualification 문언은 검증 패스에서 eCFR 원문 1대1로 확정(현재 "확인 요").

---

## §1. 규제 맥락 — 이 부품이 다루는 규제는 어디서 왔는가 (Context First)

> **왜 맥락부터.** Reg D는 *"등록은 면제해주되, 우리(SEC)에게 *알리기는* 하라"*는 구조다. 그 *알림*이 **Form D**(사모 발행 통지서)다. 본 부품은 발행자가 그 통지를 *실제로 냈는지*를 확인한다 — 면제를 *쓴다고* 했으면 *통지 의무*도 지켰는지 보는 것.

### 1.1 핵심 개념 — "면제는 받되, 신고는 하라"

쉽게 말하면, Reg D 506(c)로 등록을 면제받는 대신, 발행자는 **최초 매도 후 일정 기한(통상 15일) 내에 SEC EDGAR에 Form D를 제출**해야 한다. Form D는 *"누가·무슨 면제로·얼마를 사모로 발행했다"*를 SEC에 알리는 간이 통지다.

흥미로운 점: **Form D 미제출 자체가 *자동으로* 면제를 깨뜨리지는 않는다**(판례·SEC 입장). 그러나 ① Rule 507은 *과거 Form D 의무를 어겨 법원 명령을 받은 발행자*의 Reg D 사용을 막고, ② 미제출은 *주(州) 차원·집행상 불이익*과 *발행자의 준법 신뢰도* 문제를 낳는다. 그래서 *"면제를 쓰는 발행이라면 Form D가 제출돼 있어야 정상"*이라는 게 실무 기대다.

본 부품은 그 *발행자 측 사실*(Form D 제출 여부)을 확인해, *Form D도 안 낸 비정상 발행*의 토큰이 우리 DEX에서 유통되지 않게 한다.

### 1.2 어느 법·규칙에서 오나

| 출처 | 무엇 |
|---|---|
| **Rule 503** | Reg D 발행자의 *Form D 제출 의무*(최초 매도 후 통상 15일 내) |
| **Rule 507** | 과거 Form D 의무 위반(법원 명령)자의 Reg D 사용 *disqualification* |
| **SEC EDGAR** | Form D가 제출·공시되는 시스템(확인 경로) |

### 1.3 왜 이 규제가 존재하는가

SEC는 *등록을 면제*해도 *시장에서 무슨 사모가 일어나는지*는 파악해야 규제·통계·집행이 가능하다. Form D는 그 *최소한의 가시성*을 주는 장치다. *면제는 공시 의무의 완전 면제가 아니라 "간이 통지로 대체"*인 셈이다.

### 1.4 Decipher에서의 위치

본 부품은 R1(Reg D 506(c) Issuance)의 *발행자 측 위생 점검*이다. 매수인 자격 부품들(A-03·A-13)이 *사는 사람*을 본다면, E-01은 *파는(발행한) 쪽이 의무를 지켰는지* 본다. **기술적 난점**: Form D는 *SEC EDGAR(오프체인 외부 시스템)*에 있어, 온체인이 직접 조회할 수 없다 → *오라클/claim*으로 "Form D 제출됨" 사실을 받아 온체인이 확인한다(§2-A 경계).

### 1.5 한국법과의 비교 — 사모 발행 사후 보고

한국 자본시장법도 *증권신고서가 면제되는 사모*라도 일정 경우 *발행 실적 보고·사후 공시*를 요구한다. "등록(신고)은 면제해도 *알리기*는 시킨다"는 발상이 Form D와 같다. 차이는 — 미국은 *EDGAR 전자 제출*이 표준이고, 본 부품은 그 제출 사실을 *오라클로 받아 온체인 확인*한다는 점이다.

---

## §2. 📋 메타 정보 (Internal Identifier Box)

| 항목 | 값 | 한 줄 풀이 |
|---|---|---|
| 부품 이름 | **Form D Filing Check** | 발행자 Form D 제출 확인원 |
| 검사 대상 | 발행자가 이 offering의 *Form D를 SEC에 제출*했는가 | "발행자가 신고는 했나" |
| Internal ID | E-01 (Decipher PM 규약) | 부품 일련번호 |
| 검증 방식 | **기계 판정형(패턴 A)** — 단, EDGAR 조회는 오프체인 오라클/claim | 제출 사실 claim 확인 |
| Timing | **pre-trade** | 거래 직전 |
| Stateful 여부 | **STATELESS** | 제출 사실 1회 확인 |
| 주 활성화 Recipe | **R1**(Reg D 506(c) Issuance) | 발행 framework 위생 |
| 연계 부품 | **B-01**(Manifest 정합)·**E-03**(bad actor) | 발행자 측 사실 묶음 |
| 성숙도 | 🟡 정밀화 — EDGAR 오라클·미제출 처리 정책 | |
| 파일·위치 | E-01_form-d-filing.md · 산출물/elements/ | 산출물 경로 |

---

## §2-A. 📐 결정론 경계 — 온체인이 하는 일 / 오라클·claim에 위임하는 일

> **개발팀 핵심:** 아래 *왼쪽만 구현*. EDGAR 조회·해석은 오프체인 오라클/claim — 온체인은 그 결과만 확인.

| ✅ 온체인이 확인/구현 (결정론) | 🔵 오프체인 오라클/claim이 제공 |
|---|---|
| "Form D 제출됨" claim/오라클 attestation 존재·서명·발급자 확인 | *SEC EDGAR 실제 조회*(제출 여부·번호·일자) |
| 제출 일자가 offering과 정합한지(있으면) | Form D *내용 해석*(면제근거·offering 일치) |
| 발급자가 신뢰 오라클인지 | 미제출의 *법적 의미* 판단(507 등) |

→ 온체인은 *"제출됨"이라는 서명된 사실*만 확인. *EDGAR를 실제로 뒤지고 해석*하는 건 오프체인 오라클/claim.

---

## §3. ① 법적 근거 (Layer 1 → 2 → 3)

### 3.1 Layer 1 — Statutory base (배경)

> **Securities Act §4(a)(2) / Reg D 체계** — Form D는 §4(a)(2)·Reg D 면제의 *통지 요건*으로, statute가 아니라 SEC 규칙(Rule 503)이 부과한다. statute 차원에선 "면제하되 SEC가 시장을 파악할 수단을 둔다"는 취지.

### 3.2 Layer 2 — Regulatory specification

> **17 CFR § 230.503 — Form D 제출 의무** [🔗 [eCFR](https://www.ecfr.gov/current/title-17/section-230.503)]
>
> **요지**(기한·항번호 확인 요): Reg D(504·506)로 증권을 매도하는 발행자는 **최초 매도일로부터 통상 15일 내에 Form D를 SEC에 전자 제출**해야 한다(이후 정정·연례 갱신 규정 포함). → 본 부품이 *제출 여부*를 확인하는 근거.

> **17 CFR § 230.507 — Disqualification** [🔗 [eCFR](https://www.ecfr.gov/current/title-17/section-230.507)]
>
> **요지**(확인 요): *과거 Form D 제출 의무 위반으로 법원 명령(injunction)을 받은* 발행자는 Reg D를 쓸 수 없다. → "Form D 위반 이력"이 발행 자체를 막을 수 있음(E-03 bad actor와 인접).

해설: **미제출이 *자동* 면제 상실은 아니다.** 그러나 본 부품은 *보수적으로* "Form D 제출 확인"을 발행 framework 위생 조건으로 둔다(미제출 시 차단이 아니라 경고/검토가 기본 — §6).

### 3.3 Layer 3 — Interpretive guidance

> **SEC — Form D 제출 실무·EDGAR** [🔗 [SEC EDGAR](https://www.sec.gov/cgi-bin/browse-edgar)]
>
> **요지**: Form D는 EDGAR에 전자 제출되어 *공개 조회 가능*하다. 본 부품의 오라클은 EDGAR에서 *해당 발행자·offering의 Form D 존재*를 확인한다.

### 3.4 Sub-요건 분해

| 요소 | 충족 조건 | 근거 |
|---|---|---|
| Form D 존재 | 이 발행자·offering의 Form D가 EDGAR에 제출됨 | Rule 503 |
| 정합성 | Form D의 면제근거·일자가 Manifest와 일치 | (정합) |
| 위반 이력 부재 | Rule 507 disqualification 없음 | Rule 507(E-03 연계) |

---

## §4. ② 입력 사실 — 판정에 필요한 데이터

| 필드 | 유형 | 출처 | 무엇 |
|---|---|---|---|
| `formDClaim.filed` | bool | 오라클/Trusted Issuer | Form D 제출됨 |
| `formDClaim.accessionNo` | string | 오라클 | EDGAR accession 번호(추적) |
| `formDClaim.filedAt` | date | 오라클 | 제출 일자 |
| `formDClaim.issuer/signature` | address/bytes | 오라클 | 발급 오라클·서명 |
| `manifest.issuanceFramework` | enum | Manifest | RegD506c (이 부품 활성 조건) |

---

## §5. ③ 판정 로직

### 5.1 Pseudocode + 해설

```
function check_E_01(asset):
    if asset.manifest.issuanceFramework != RegD506c:
        return PASS                              # Reg D 발행 아니면 비활성

    claim = asset.formDClaim
    if claim == null or not verified(claim) or not trusted_oracle(claim.issuer):
        return REVIEW_FORM_D_UNVERIFIED          # 제출 사실 미확인 → 검토
    if not claim.filed:
        return FAIL_FORM_D_NOT_FILED             # 미제출(보수: 차단 또는 검토)
    return PASS
```

- **해설**: 온체인은 *"제출됨"이라는 서명된 오라클 사실*을 확인할 뿐, EDGAR를 직접 뒤지지 않는다(§2-A). 오라클 미검증이면 검토, 미제출이면 차단/검토(정책 — §6).

### 5.2 미제출의 보수적 처리

§3.2처럼 *미제출이 자동 면제 상실은 아니므로*, 본 부품 기본값은 **즉시 영구 차단보다 "검토·경고 후 보수적 차단"**이다. 발행자가 곧 제출 예정(최초 매도 후 15일 내)일 수 있어서다. 정책은 운영 결정(§12).

---

## §6. ④ 거절·예외 처리

| Code | 언제 | 처리 |
|---|---|---|
| `FAIL_FORM_D_NOT_FILED` | 제출 안 됨(확인됨) | 보수적 차단 또는 검토(정책) + 발행자 통지 |
| `REVIEW_FORM_D_UNVERIFIED` | 오라클 미검증·정보 부족 | manual review(오라클 보강) |
| `PASS` | 제출 확인 또는 Reg D 아님 | 통과 |

---

## §7. ⑤ 테스트 케이스

| # | 시나리오 | 기대 |
|---|---|---|
| T1 | Reg D 발행, Form D 제출 확인 | **PASS** |
| T2 | Reg D 발행, Form D 미제출(확인) | **FAIL_FORM_D_NOT_FILED** |
| T3 | 오라클 attestation 없음 | **REVIEW_FORM_D_UNVERIFIED** |
| T4 | Reg D 아닌 발행(예: 등록 증권) | **PASS**(비활성) |
| T5 | Form D 제출됐으나 면제근거 불일치 | **REVIEW**(정합성) |

---

## §8. (α) 코드 변환 패턴 선택 — 기계 판정형(A) + 오라클 입력

본 부품은 **패턴 A**(제출됨/안됨 이분)이되, *입력(EDGAR 조회)은 오프체인 오라클*이라 *증명서형(B)·외부 oracle(C) 요소*가 섞인다. 온체인은 *서명된 사실*을 확인만 한다. EDGAR를 온체인이 직접 못 읽으므로 오라클이 불가피하다.

---

## §9. (β) Cross-Element·Cross-Recipe Coordination

- **B-01(Manifest 정합)**: Form D의 면제근거가 Manifest `issuanceFramework`와 일치하는지 — 정합성 연계.
- **E-03(bad actor)**: Rule 507(Form D 위반 이력 disqualification)은 bad actor(E-03)와 인접 — 둘 다 발행자 측 결격.
- **Recipe**: R1(Reg D 506(c)) 발행 framework 위생. 발행 framework가 Reg D가 아니면 비활성.

---

## §10. (γ) 3-Layer Solution

| Layer | 누가 | 무엇 | 한계 |
|---|---|---|---|
| 1. 자기신고 | 발행자 | Form D 제출 주장 | 오라클이 검증 |
| 2. 오라클/Trusted Issuer | 신뢰 오라클 | EDGAR 실조회·서명 attestation | 오라클 신뢰성 |
| 3. 운영 검토 | Decipher | 미제출·불일치 처리 정책 | |

---

## §11. (δ) Frontend·Off-chain Operator Layer

| 단계 | 위치 | 무엇 |
|---|---|---|
| EDGAR 조회 | Off-chain(오라클) | 발행자·offering의 Form D 존재·번호·일자 |
| 미제출 안내 | Frontend | "발행자 Form D 미확인 — 거래 보류/검토" |
| 오라클 갱신 | Off-chain | 주기적 EDGAR 동기화 |

---

## §12. Open Issues

1. **EDGAR 오라클 설계** 🟡 — 누가·어떻게 EDGAR를 조회해 서명 attestation을 발급하나(신뢰 오라클 후보·갱신 주기).
2. **미제출 처리 정책** 🟡 — 자동 차단 vs 검토 vs 15일 유예. (미제출이 자동 면제상실 아님을 반영.)
3. **정합성 범위** 🟢 — Form D의 어느 필드(면제근거·금액·일자)를 Manifest와 대조하나.
4. **Rule 507 이력** 🟡 — 과거 Form D 위반 disqualification을 E-03과 어디서 검사하나.

---

## §13. 파일명 규칙 (Naming Convention)

```
본 부품: E-01_form-d-filing.md · 산출물/elements/
```

## §14. 변경 로그

- [2026-06-17] v1.0 작성. *발행자 Form D 제출 확인* walkthrough 신설. 규제 맥락("면제는 받되 신고는 하라"·Rule 503 15일·507 disqualification·EDGAR·한국 사후보고 anchor), §2-A 경계(제출 사실 claim은 온체인·EDGAR 조회는 오라클), 입력(formDClaim), 로직(제출 확인 pseudocode·미제출 보수 처리), 테스트 5종, 패턴 A+오라클, B-01·E-03 coordination, Open Issues 4종(EDGAR 오라클·미제출 정책·정합성·507 이력). **인용 검증 대기.**
