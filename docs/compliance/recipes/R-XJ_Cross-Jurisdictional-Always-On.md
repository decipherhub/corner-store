---
type: recipe-spec-sheet
recipe-id: R-XJ
recipe-name: Cross-Jurisdictional Always-On (제재·관할·Reg M 횡단 전제)
internal-id: RCP.R-XJ
legal-effect: "거래가 제재(OFAC)·관할(Reg S)·시장행위(Reg M) 횡단 금지에 저촉되지 않음 — 모든 거래의 *진입 전제*(면제 아님)"
status: v1.0 — 조문별 논증 (baseline 전제층·fail-closed·무과실 제재 우선)
audience: 개발팀·법무팀·외부 consultant·학회원
related-external-sources:
  - "50 U.S.C. § 1701 et seq. — IEEPA(제재 권한): https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title50-section1701&num=0&edition=prelim"
  - "31 CFR Chapter V — OFAC 규정(SDN·blocked·50% Rule): https://www.ecfr.gov/current/title-31/subtitle-B/chapter-V"
  - "17 CFR § 230.901–905·902(k) — Regulation S(역외 safe harbor·US person): https://www.ecfr.gov/current/title-17/section-230.901"
  - "Morrison v. National Australia Bank, 561 U.S. 247 (2010) — 역외적용 transactional test: https://supreme.justia.com/cases/federal/us/561/247/"
  - "17 CFR § 242.101·102 — Reg M(판매 중 매수 제한, 분배기간 always-on): https://www.ecfr.gov/current/title-17/section-242.101"
created: 2026-06-17
updated: 2026-06-17
tags: [recipe, R-XJ, cross-jurisdictional, ofac, sanctions, reg-s, jurisdiction, reg-m, always-on, baseline, fail-closed, spec-sheet]
---

# R-XJ — Cross-Jurisdictional Always-On (Recipe 명세 = 모든 거래의 진입 전제층)

> **이 문서는 무엇인가.** Recipe = *하나의 법률효과를 논증.* 그런데 R-XJ는 **면제 recipe가 아니다.** R1~R3은 *"~의 자격으로 면제를 성립"*시키고, R4는 *"행태 금지를 감시"*한다. **R-XJ는 그 *아래에 깔리는 전제층(baseline)* — *어떤 거래든, 어떤 경로든* 가장 먼저 통과해야 하는 *횡단(cross-cutting) 관문*이다.**
> **세 횡단 규범.** ① **제재(OFAC/IEEPA)** — SDN과 거래 절대 금지(*무과실·strict liability*). ② **관할(Reg S·상대국법·포괄제재국)** — 매수인이 *어느 나라 사람*인지로 제한. ③ **Reg M** — *판매(distribution) 중* 발행자측 매수 금지(분배기간 always-on). 이들은 *면제 여부와 무관하게* 모든 거래에 *무조건* 적용된다.
> **왜 "Cross-Jurisdictional".** 제재·관할은 *본질상 다국적(초국경)* 규범 — 한 거래가 *복수 관할*의 법에 동시에 걸린다. R-XJ는 이 *다국적 관할* 차원을 거래 진입 직전에 검문한다.
> **fail-closed 원칙.** R-XJ, 특히 제재(A-01)는 *무과실 책임*이라 — *불확실하면 막는다*(가장 보수적). 면제(R1~R3)가 아무리 충족돼도 R-XJ가 막으면 *거래 불가.*
> **자산 일반성(ADR-006):** 제재(A-01)는 *완전 보편*(자산별 값 0). 관할(A-02)은 `Manifest.allowedJurisdictions`. Reg M(F-04)은 R1 발행상태. → 자산 무관.

---

## §1. 법률효과 + 구조 (전제층)

**효과(소결론): "이 거래는 제재·관할·Reg M 횡단 금지에 저촉되지 않는다 — 따라서 *거래 진입의 전제가 충족*된다."** (면제 *성립*이 아니라 *진입 허용*.)

```
[모든 거래]
   │
   ▼  ┌──────────────────────────────────────────────┐
      │  R-XJ (전제층 — 가장 먼저, fail-closed)        │
      │   ① A-01 제재(OFAC)   — 무과실, SDN 절대 차단   │
      │   ② A-02 관할(Reg S)  — 허용 관할만             │
      │   ③ F-04 Reg M        — 분배기간 발행자 매수 차단│
      └──────────────────────────────────────────────┘
   │  (R-XJ PASS여야 아래로)
   ▼
   ├─ 발행? → R1 (×R3 if 펀드)
   ├─ 전매? → R2 (×R3 if 펀드)
   └─ 모든 거래 → R4 (행태 감시)
```
→ R-XJ 과제: **세 횡단 금지에 *미저촉*임을 보이면 → 진입 전제 충족.** *그 위에* 면제(R1~R3)·행태(R4)가 얹힌다.

---

## §2. 📋 메타 + 요약

| 항목 | 값 |
|---|---|
| Recipe / ID | Cross-Jurisdictional Always-On / **R-XJ** |
| ① 법률효과 | **제재·관할·Reg M 미저촉 → 거래 진입 전제 충족** (면제 아님) |
| ② 논증 | 횡단 금지 조문별(IEEPA/OFAC · Reg S §902(k)·Morrison · Reg M 101/102) |
| ③ Activation | **모든 거래·항상**(baseline, 가장 먼저 평가) |
| ④ Composition | A-01 ∧ A-02 ∧ (분배기간 → F-04) — **fail-closed** |
| ⑤ 거절 | `R-XJ_BLOCK_SANCTION`(무과실·최우선)·`_JURISDICTION`·`_REGM` |
| ⑥ Conflict | **R1·R2·R3·R4 *전부에 곱해지는* 보편 prefactor** |

---

## §3. ① 법률효과 — "면제"가 아니라 "전제"

- R1~R3: *"이 자격이면 등록 면제"* (효과 = 면제 성립).
- R4: *"이 행태는 금지 감시"* (효과 = 차단·표시).
- **R-XJ: *"이 거래는 횡단 금지에 안 걸린다"* (효과 = *진입 허용의 전제*).** 면제를 *주는* 게 아니라, *모든 면제·거래의 *발 밑*에 깔린 통과 조건*.

> 비유: R1~R3가 *비자(자격)*, R4가 *기내 행동수칙*이면, **R-XJ는 *입국심사(여권·제재명단·금수국)* — 비자가 있어도 입국심사를 못 넘으면 못 들어간다.**

---

## §4. ② 법률 논증 — 횡단 금지규범 조문별

> **읽는 법.** §4.1(제재)·§4.2(관할)·§4.3(Reg M) 각 횡단 금지를 조문 삼단논법으로. *방향은 R4처럼 역(금지 저촉→차단)*이되, R-XJ는 *진입 전제*라 *가장 먼저·fail-closed.*

### §4.1 제재 — IEEPA/OFAC (무과실, 최우선) → **A-01**

> **50 U.S.C. §1701 et seq.(IEEPA)** + **31 CFR Chapter V(OFAC)**(요지): *SDN·blocked person*과의 거래, 그리고 SDN이 *50% 이상 소유*한 자(**50% Rule**)와의 거래를 *금지.* **위반은 무과실(strict liability)** — 몰랐어도 책임.

- **대전제:** *제재 대상(SDN·blocked·50% 피소유)*과는 *절대* 거래 불가. (예외·de minimis 없음.)
- **소전제(부품):** **A-01** — 당사자를 *SDN/제재 명단과 대조*(결정론 매칭) → 일치·의심 시 *차단.* *무과실*이라 *불확실하면 막음*(fail-closed).
- **소결론:** ∴ A-01 미일치 ⟹ 제재 미저촉. *명단 대조는 결정 가능 → 패턴 A.* (단 신원 claim 정확성은 off-chain — §9.)

> **최우선·예외 없음:** 면제(R1~R3)가 충족돼도 A-01 차단이면 *거래 불가.* 시스템에서 *가장 보수적* 부품.

### §4.2 관할 — Reg S·역외적용·포괄제재국 → **A-02**

> **17 CFR §230.901–905(Reg S)** + **§902(k)(U.S. person 정의)** + **Morrison v. NAB(2010)**(요지): 미국 증권법은 *US person 대상 거래*엔 등록을 요구(Reg S는 *역외 거래 safe harbor*). 또 *포괄제재국(embargoed)* 거주자와는 거래 금지(OFAC 국가 제재).

- **대전제:** 매수인의 *관할(거주·국적)*에 따라 — US person이면 미국법 full 적용, 허용 관할 외/금수국이면 *제한·금지.*
- **소전제(부품):** **A-02** — 매수인 관할을 `Manifest.allowedJurisdictions`·금수국 목록과 *대조*(결정론) → 비허용·금수국 *차단.* (US person 판정 = §902(k) 기준.)
- **소결론:** ∴ A-02 허용 관할 ⟹ 관할 미저촉. *관할 코드 대조 = 결정 → 패턴 A* (거주지 claim은 off-chain).

### §4.3 Reg M — 분배기간 발행자측 매수 금지 (always-on during distribution) → **F-04**

> **17 CFR §242.101·102**(요지): *distribution 제한기간 중* 발행자·관여자·affiliated purchaser의 대상증권 *매수 금지*(가격 조작 방지).

- **대전제:** *판매 진행 중*엔 발행자측이 그 증권을 *사면 안 된다.*
- **소전제(부품):** **F-04**(R4와 공유) — *제한기간(R1 발행상태) ∧ 매수자 신원*으로 결정론 차단.
- **소결론:** ∴ 분배기간 ∧ 관여자 매수면 BLOCK ⟹ Reg M 미저촉. *날짜·신원 = 결정 → 패턴 A.*

> **F-04 이중 소속:** Reg M은 *시장행위*(R4)이자 *분배기간 always-on 횡단*(R-XJ). frontmatter에 R-XJ·R1·R4 연동 표기. *분배기간에만* 활성이라 R-XJ 중 유일한 *시간조건부* 항목.

### §4.4 경계 분석 (결정성·claim)

| 이슈 | 분류 | 처리 |
|---|---|---|
| SDN 명단 대조 | **(a→결정)** | 명단 매칭은 결정론 — 단 *명단 최신성*은 시스템 피드(오프체인 갱신) |
| 당사자 *신원* 정확성 | **(b)** | 거래자가 진짜 누구인지 = *KYC claim*(off-chain). A-01/A-02는 *claim된 신원*으로 판정 |
| 거주지/US person 판정 | **(b)** | 거주·국적 = claim. §902(k) 적용은 결정, *사실 입력*은 claim |
| 50% Rule 간접소유 | **(b)** | 소유구조 추적 = off-chain 조사 → claim/attestation |

→ **결론: R-XJ 본체는 *결정론 대조(A-01·A-02·F-04, 패턴 A)*.** 단 *입력(신원·거주·소유구조)은 KYC claim*에 의존 — 코드는 *claim 위에서 결정론 판정*, claim 진위는 off-chain. 신규 부품 불요.

---

## §5. ③ Activation Logic

- **모든 거래·항상**, 그리고 *가장 먼저* 평가(전제층). A-01·A-02는 *무조건*, F-04는 *R1 분배기간*에만.
- R-XJ FAIL이면 *이후 recipe(R1~R4) 평가 불요* — 진입 자체 차단(short-circuit).

---

## §6. ④ Composition — fail-closed 전제 AND

```
R-XJ_PASS(tx) ⟺  A-01.notSanctioned          # 무과실, 최우선, 불확실시 차단
              ∧  A-02.allowedJurisdiction     # 허용 관할·비금수국
              ∧  (R1.distributionWindow → F-04.ok)   # 분배기간만

전체 거래 적법 ⟺  R-XJ_PASS  ∧  (해당 면제: R1 | R2)  ∧  (펀드면 R3)  ∧  R4
              └── 전제층 ──┘   └────── 자격층 ──────┘  └─ 누적 ─┘   └행태┘
```
- **R-XJ는 *곱셈의 맨 앞 인수*.** 어떤 거래든 `R-XJ ∧ (…)` 형태 — R-XJ=0이면 전체=0.
- **fail-closed:** A-01은 *불확실(의심 매칭)도 차단* 쪽으로. 다른 부품이 "애매하면 통과"여도 A-01은 "애매하면 차단"(무과실 책임 때문).

---

## §7. ⑤ 거절·예외 처리

- `R-XJ_BLOCK_SANCTION`(A-01) — **최우선·예외 없음.** SDN/50% 의심 → 즉시 차단, *면제 불문.*
- `R-XJ_BLOCK_JURISDICTION`(A-02) — 비허용 관할·금수국 → 차단.
- `R-XJ_BLOCK_REGM`(F-04) — 분배기간 발행자측 매수 → 차단.
- *예외 메커니즘 최소화* — 특히 제재는 *예외·재량 없음*(OFAC 라이선스는 별도 법무 영역, 코드 자동화 대상 아님).

---

## §8. ⑥ Conflict·Interaction — 보편 prefactor

| 상대 | 패턴 | 설명 |
|---|---|---|
| **R1·R2·R3·R4 전부** | **Cumulative(곱·always-on)** | R-XJ는 *모든 recipe의 앞에 곱해지는 전제.* 어느 것도 R-XJ 없이 성립 못 함 |
| 면제 recipe 일반 | **상위 전제(우선)** | R-XJ FAIL이면 면제 충족 여부 *무의미*(short-circuit) |
| R4(행태) | **층 구분** | R-XJ=진입 전제(제재·관할), R4=거래 행태(조작·사기). F-04(Reg M)만 양쪽 공유 |

> **핵심:** 다른 모든 recipe의 §8이 *"R-XJ cumulative always-on"*이라 적은 게 *여기서 정의*된다. R-XJ는 *시스템의 토대* — 자격(R1~R3)·행태(R4) *모두의 발 밑*.

---

## §9. 📐 결정론 경계

| ✅ 온체인(결정론) | 🔵 off-chain(claim) |
|---|---|
| SDN/제재명단 대조·관할코드 대조·금수국 목록·Reg M 기간×신원·fail-closed 차단·short-circuit | 당사자 *실신원*(KYC claim)·거주/국적·50% 간접소유 추적·OFAC 라이선스(법무 재량)·명단 최신성 피드 |

> **R-XJ의 경계:** *대조·판정은 결정론*(명단·코드 매칭), *그 입력(누구·어디·소유구조)은 claim.* 코드는 *claim 위에서* 결정론으로 막되, *claim 진위*는 KYC·off-chain. 제재는 *claim이 의심스러우면 fail-closed.*

---

## §10. 자산 적용 (BUIDL = 예시)

- BUIDL 포함 *모든 자산* 거래에 R-XJ 항상 선평가. 제재(A-01)는 *자산 무관 완전 보편.*
- BUIDL `allowedJurisdictions`(Manifest)로 A-02 분기 — 값은 자산별, *코드는 동일.*
- BUIDL 발행 분배기간엔 F-04(Reg M)로 발행자측 매수 차단.
- *다른 자산*도 R-XJ 코드 동일 — 제재·관할은 보편, 관할 목록만 Manifest(ADR-006).

---

## §11. Open Issues

1. **명단 최신성 피드** 🔵 — OFAC SDN·제재 목록의 *실시간 갱신* 오라클/피드 신뢰성(오프체인). 갱신 지연 = 위험.
2. **KYC claim ↔ 결정론 판정 인터페이스** 🟡 — A-01/A-02가 받는 신원·거주 claim 스키마와 attestation 신뢰사슬(Trusted Issuer).
3. **50% Rule 간접소유** 🔴 — SDN 50% 피소유 자동 탐지는 *오프체인 조사* 영역 — 코드는 *조사 결과 claim* 수용. 한계 명시 필요.
4. **OFAC 라이선스 예외** 🟢(정리됨) — 라이선스(특별허가)는 *법무 재량* — 코드 자동화 대상 아님. 예외는 수동·오프체인.
5. **F-04 분배기간 산정** 🟡 — R1 발행상태에서 Reg M 제한기간 윈도우 도출 규칙(분배 시작·종료 정의).

---

## §12. 변경 로그

- [2026-06-17] v1.0 작성(태스크 R-XJ). **R-XJ = 면제가 아니라 *전제층(baseline)*** 으로 R1~R4와 정체성 구분("입국심사" 비유). 세 횡단 금지 조문별 삼단논법 — ① 제재 IEEPA/OFAC(무과실·50% Rule)→A-01(fail-closed·최우선) / ② 관할 Reg S §902(k)·Morrison→A-02 / ③ Reg M 101/102 분배기간→F-04(R4 공유, 유일 시간조건부). **fail-closed 원칙 명시**(제재는 불확실시 차단). **보편 prefactor** — 다른 모든 recipe §8의 "R-XJ cumulative always-on"이 여기서 정의(§8). 경계: 대조·판정은 결정론, 입력(신원·거주·소유)은 KYC claim(§9). *가장 자산 무관*(제재 완전 보편, 관할만 Manifest). uscode/eCFR/판례 인용.
