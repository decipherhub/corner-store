# 리걸 파트 실행 플랜 — 검사 부품·법률 묶음의 리서치와 코드화 (v1)

> **이 문서가 답하는 질문**: 데모(BUIDL 거래 시연)에 쓰이는 검사 부품 27개와 법률 묶음 4개를 실제로 완성하려면, **리걸 파트가 무엇을 더 리서치하고, 그것을 어떤 양식으로 정리해서, 어떻게 코드 논리로 넘기는가.** 개발 일정이 아니라 *법률 쪽이 책임지는 준비물*의 계획입니다. (괄호 속 코드는 추적용 — 무시해도 됩니다.)

## 1. 이 작업의 본질 — "법률검토보고서를 코드로 옮기는 일"

변호사의 법률검토보고서는 ① 사실관계를 확정하고 ② 각 법률에 사실을 포섭하고 ③ 법률마다 소결론을 내고 ④ 전부 적법일 때 "거래 가능"이라 결론짓습니다. 우리 시스템은 그 보고서를 거래마다 실시간으로 다시 쓰는 기계입니다 — **부품(Element) 하나 = 요건 하나의 포섭, 묶음(Recipe) 하나 = 법률 하나의 소결론.**

따라서 리걸 파트의 일은 명확합니다: **부품 하나하나에 대해 "어느 조문의 어느 요건을, 어떤 입력 사실로, 어떤 기준으로 판정하는가"를 확정해서 개발팀이 그대로 구현할 수 있는 한 장짜리 명세(Spec Sheet)로 넘기는 것.** 리서치가 안 끝난 부품은 코드로 만들 수 없고, 잘못 리서치된 부품은 잘못된 차단(정당한 거래를 막음) 또는 잘못된 통과(위법 거래를 허용)가 됩니다.

## 2. 작업 단위 — 부품 1개의 "완성" 체크리스트 (Definition of Done)

부품 하나가 완성됐다는 것은 아래 5칸이 다 채워졌다는 뜻입니다. 이 5칸 양식이 곧 **Element Spec Sheet** (리걸 → 개발 인수인계 문서, 부품당 1장):

| 칸 | 내용 | 예시 (보유기간 검사 부품) |
|----|------|------------------------|
| ① 법적 근거 | 조문·규칙 인용 + 요건을 문장으로 분해 | "Rule 144(d): 제한증권은 취득일로부터 6개월(보고회사) 또는 1년(비보고회사) 보유 후 전매 가능" |
| ② 입력 사실 | 판정에 필요한 데이터와 그 출처 | 취득 시점(온체인 기록), 발행사의 보고회사 여부(신상카드) |
| ③ 판정 로직 | 기준값·계산식·예외 — 의사코드 수준 | `현재시각 - 취득시각 ≥ (신상카드.보고회사 ? 6개월 : 12개월) → 통과` |
| ④ 거절·예외 처리 | 거절 사유 코드 + 예외가 있다면 누가 어떻게 푸는가 | 거절 코드 `HOLDING_PERIOD`, 예외 없음 (기간은 기계적) |
| ⑤ 테스트 케이스 | 최소 3개 — 통과 1·거절 1·경계 1 | 7개월 보유(통과) / 3개월(거절) / 정확히 6개월(경계 — 포함 여부 명시) |

**①~②가 리걸 리서치의 본체**이고, ③~⑤는 리서치 결과를 코드 언어로 번역하는 작업입니다. ⑤의 경계 케이스가 특히 중요합니다 — 법률가가 "6개월 이상인가 초과인가"를 안 정해주면 개발자가 임의로 정하게 됩니다.

## 2.5. Element·Recipe 전체 Map — 한눈에 보기

> **이 절의 역할**: 27개 부품과 4개 묶음의 전체 그림을 한 페이지에 모은 reference map. §3 이후의 현황 진단·리서치 큐가 *이 map의 어디를 가리키는지* 추적할 수 있도록 *navigation index 역할*.

### 2.5.1 부품(Element) 전체 매트릭스 — 27개 한 표

부품은 **도메인별 6 카테고리 (A·B·C·D·E·F)**로 정리되며, 각 부품은 *3 axes (성숙도·검증 방식·timing)*로 분류됩니다.

| 도메인 | 부품 ID | 부품 이름 | 검사 대상 | 성숙도 | 검증 방식 | Timing | Stateful? |
|------|------|--------|--------|-------|---------|------|------|
| **A — 신원·자격** (매수인 측) | A-01 | 제재 명단 | OFAC SDN list match | 🟢 완료 | 기계 판정 (A) | pre-trade | STATELESS |
| | A-02 | 국가 제한 | 허용 jurisdiction | 🟢 완료 | 기계 판정 (A) | pre-trade | STATELESS |
| | A-03 | 적격투자자 검증 | Reg D 501(a) accredited | 🟢 완료 | 증명서형 (B) | pre-trade | STATELESS |
| | A-04 | 신원 중복 | 단일인 다지갑 위장 | 🟢 완료 | 기계 판정 (A) | pre-trade | STATELESS |
| | A-06 | 내부자 판정 | affiliate (Rule 144·405 control) | 🟡 R-3 필요 | 증명서형 + 운영 (B+C) | pre-trade | STATELESS |
| | A-08 | 법인 자격 산정 (발행 측) | Entity-level eligibility | 🟡 R-1에 통합 | 증명서형 (B) | pre-trade | STATELESS |
| | A-09 | 법인 look-through | Entity 구성원 자격 (depth 3) | 🟡 R-1에 통합 | 증명서형 (B) | pre-trade | STATELESS |
| | A-11 | 증명 유효기간 | 5-year cap·만료 체크 | 🟢 완료 | 기계 판정 (A) | pre-trade | STATELESS |
| | A-12 | 모름 항변 차단 | red flag list 적용 | 🟡 R-3에 통합 | 감시형 (C) | pre-trade | STATELESS |
| | **A-13** ⭐ | **기관전용 자격 (QP)** | qualified purchaser ICA §2(a)(51) | 🟡 **R-1 (🔴 데모 핵심)** | 증명서형 (B) | pre-trade | STATELESS |
| **B — 자산·기술 메타** | B-01 | 신상카드 정합 | Manifest hash·facts consistency | 🟢 완료 (재정의 done) | 기계 판정 (A) | pre-trade | STATELESS |
| | B-02 | 토큰 표준 | ERC-3643 compliance | 🟢 완료 | 기계 판정 (A) | pre-trade | STATELESS |
| | B-03 | 이전제한 메타데이터 | restrictedFlag·tag check | 🟢 완료 | 기계 판정 (A) | pre-trade | STATELESS |
| | B-04 | 엔진 선택 | supportedEngines bitset | 🟢 확인만 | 기계 판정 (A) | pre-trade | STATELESS |
| **C — 거래 경로·시점** | C-00 | 전매 경로 선택기 | §4(a)(1·1½·7)·Rule 144 분기 | 🟡 R-4 + 위임 | 기계 판정 (A) | pre-trade | STATELESS |
| | C-01 | 보유기간 | Rule 144(d) 6m/12m | 🟢 완료 | 기계 판정 (A) | pre-trade | STATELESS |
| **D — 집계·누적** | D-01 | 보유자 수 카운터 | Rule 506(b) 35-purchaser cap·ICA §3(c)(1) 100·§3(c)(7) 2000 | 🟡 R-5에 통합 | 기계 판정 (A) | post-trade commit | **STATEFUL** |
| **E — 발행자 측** | E-01 | Form D 확인 | SEC EDGAR Form D filing | 🟡 R-5 | 기계 판정 (A) | pre-trade | STATELESS |
| | E-03 | 전과자 차단 | Rule 506(d) bad actor | 🟢 완료 | 기계 판정 (A) | pre-trade | STATELESS |
| **F — 행위·운영** | F-01 | 운영자 자기거래 제한 | Decipher entity·임직원·계열 | 🟡 R-3에 통합 | 기계 판정 (A) | pre-trade | STATELESS |
| | F-02 | 시장행위 감시 | wash trade·spoofing·layering | 🟡 R-6 | 감시형 (C) | post-trade flag | **STATEFUL** |
| | F-03 | 사기 감시 | 의심거래 보고 | 🟡 R-6에 통합 | 감시형 (C) | post-trade flag | **STATEFUL** |
| | F-04 | 판매 중 발행자 매수 금지 | 발행 중 issuer-side buying | 🟢 완료 (이번 주) | 기계 판정 (A) | pre-trade | STATELESS |

> ⚠️ **27개 ≠ 41개 전체 pool**. 위 표는 *BUIDL 데모에 쓰이는 27개*. *전체 Element pool은 41개* (Required 19 + Conditional 1 + Optional 18 + 타규제 확장용 3 — 13 자료 참조). *나머지 14개는 *타 자산군·확장 시점에 *activate*.

### 2.5.2 묶음(Recipe) 4종 + Element 부착 매트릭스

데모에 쓰이는 *4 묶음*은 각각 *1 법률효과 (08 §II "1 법률효과 = 1 Recipe" 원칙)*를 *발생시키는 요건 집합*. 각 Recipe가 *어느 부품을 *어떤 식으로 attach*하는지:

| Recipe (묶음) | 법률효과 | 핵심 attached Elements | Conditional Elements |
|------|-------|---------|------|
| **Recipe-R1 Reg D 506(c) Issuance** | "§5 등록 면제 성립" | A-01·A-02·A-03·A-04·A-11·E-01·E-03·F-04·B-01·B-02·B-03 | A-08·A-09 (entity 매수인 시) |
| **Recipe-R2 §4(a)(7)·Rule 144 Resale** | "§2(a)(11) underwriter 비해당 safe harbor" | A-01·A-02·A-03·A-04·C-00·C-01·B-01·B-02·B-03 | A-06·A-12 (affiliate seller 시) |
| **Recipe-R3 ICA §3(c)(7) Fund** | "투자회사 등록 의무 면제" | **A-13** (QP)·D-01 (2000 cap)·B-01 | A-08·A-09 (entity QP look-through) |
| **Recipe-R4 시장행위 감시 (Layer 7)** | "anti-fraud + market manipulation 위반 부재 추정" | F-02·F-03·F-01·A-12 | A-06 (insider trading link 시) |

### 2.5.3 BUIDL 1 transaction의 *cumulative Recipe attachment*

***BUIDL 매도 시나리오 1건에 *cumulative trigger되는 Recipes***:

```
[BUIDL $100K 매도 (김 부장 → Acme Capital)]
   │
   ▼
ACM[BUIDL] manifest 조회
   │
   ├──▶ Recipe-R1 (Reg D 506(c) Issuance) — *발행 framework 유지 확인*
   │         └──▶ A-01·A-02·A-03·A-04·A-11·E-01·E-03·F-04·B-01·B-02·B-03 cumulative AND
   │
   ├──▶ Recipe-R2 (§4(a)(7) Resale) — *2차 거래 safe harbor*
   │         └──▶ A-01·A-02·A-03·A-04·C-00·C-01·B-01·B-02·B-03 cumulative AND
   │              + (김 부장 = BlackRock affiliate) → **A-06·A-12 cumulative activate**
   │
   ├──▶ Recipe-R3 (ICA §3(c)(7)) — *BUIDL fund-form 확인*
   │         └──▶ **A-13 QP** ⭐ + D-01 (2000 cap) + B-01
   │              + (Acme = entity 매수인) → **A-08·A-09 cumulative activate**
   │
   └──▶ Recipe-R4 (시장행위 감시) — *post-trade flag*
            └──▶ F-02·F-03·F-01·A-12 (post-trade commit)

⇨ 4 Recipes × 약 18 unique Elements (중복 포함 총 30+ check) = *cumulative AND 전부 통과해야 swap*
```

→ ***한 거래에 *4 Recipes가 *cumulative AND로 작동***. *Element는 *Recipe 간 *공유 (예: A-01·A-02·B-01은 *모든 Recipe에 attached)*. *cross-Recipe overlap이 *Element pool의 *re-use 정도 결정*.

### 2.5.4 Element 부착 매트릭스 — 한눈에

***행 = Element, 열 = Recipe. ●=필수 attached, ○=conditional, —=무관***:

| Element \ Recipe | R1 Issuance | R2 Resale | R3 Fund | R4 행위감시 |
|-----|----|----|----|----|
| A-01 OFAC | ● | ● | ● | ○ |
| A-02 국가 | ● | ● | ● | — |
| A-03 적격투자자 | ● | ● | — | — |
| A-04 신원중복 | ● | ● | — | — |
| A-06 affiliate | — | ○ | — | ○ |
| A-08 법인 자격 | ○ | — | ○ | — |
| A-09 look-through | ○ | — | ○ | — |
| A-11 증명 만료 | ● | ● | — | — |
| A-12 모름항변 | — | ○ | — | ● |
| **A-13 QP** ⭐ | — | — | ● | — |
| B-01 manifest 정합 | ● | ● | ● | — |
| B-02 토큰 표준 | ● | ● | — | — |
| B-03 restricted flag | ● | ● | — | — |
| B-04 엔진 선택 | ● | ● | — | — |
| C-00 전매 경로 | — | ● | — | — |
| C-01 보유기간 | — | ● | — | — |
| D-01 보유자수 카운터 | — | — | ● | — |
| E-01 Form D | ● | — | — | — |
| E-03 bad actor | ● | — | — | — |
| F-01 자기거래 | — | — | — | ● |
| F-02 시장감시 | — | — | — | ● |
| F-03 사기감시 | — | — | — | ● |
| F-04 판매중 매수금지 | ● | — | — | — |

**Coverage 분석**:
- ***Cross-Recipe shared Elements (high re-use)***: A-01·A-02·B-01 (모든 Recipe), A-03·A-04·A-11·B-02·B-03 (R1·R2 양쪽)
- ***Recipe-exclusive Elements***: A-13 (R3만), C-00·C-01 (R2만), E-01·E-03·F-04 (R1만), D-01 (R3만), F-01·F-02·F-03 (R4만)
- ***Conditional Elements***: A-06·A-08·A-09·A-12 — *사실관계 (affiliate·entity·red flag)에 따라 *cumulative activate*

→ *Element pool은 *Recipe 간 *공유 라이브러리*. *한 Element 신설·업데이트가 *여러 Recipe에 *cumulative 영향*. *그래서 *Element 단위 update governance가 *Recipe 단위보다 *less burden (2-of-3 multi-sig·24h time-lock)이 *합리적* (06 자료 Patch A).

### 2.5.5 성숙도·patterns의 *전체 분포*

#### *성숙도 분포 (27개)*
```
🟢 완료 (Spec Sheet만 남음):  11개  (A-01·A-02·A-03·A-04·A-11·B-01·B-02·B-03·B-04·C-01·E-03·F-04)
🟡 정밀화 필요 (R-1~R-6):    10개  (A-06·A-08·A-09·A-12·A-13·C-00·D-01·E-01·F-01·F-02·F-03)
🟢 확인만 필요:                  소수 (B-04 등 기존 정리 적용)
```

#### *코드 변환 패턴 분포*
```
패턴 A 기계 판정형 (결정론):     19개  대부분 — 기간·명단·계산
패턴 B 증명서형 (off-chain 판단):  6개  A-03·A-06·A-08·A-09·A-13 등 자격 판정
패턴 C 감시형 (flag + 운영):     3-4개  F-02·F-03·A-12 등 고의·red flag 요소
```

#### *Timing·Statefulness 분포*
```
Pre-trade STATELESS:    24개  대부분 — 1회 check, gate
Post-trade STATEFUL:     3개  D-01·F-02·F-03 — Router commit으로 counter·flag 갱신
```

→ *상세 분류 (3-axis: Decidability·ObligationTiming·Statefulness)는 *08 자료 §III의 *meta-structure*에 직접 매핑*. *각 Element가 *3 좌표로 *결정론적 배치*.

### 2.5.6 *전체 Map의 *navigation 활용*

이 §2.5의 매트릭스를 *§3 이후 작업에 *어떻게 활용*:

- ***§3 현황 진단 3그룹*** = 위 *2.5.5 성숙도 분포 3 색상에 *direct mapping*
- ***§4 리서치 큐 R-1~R-6*** = 위 *2.5.1 매트릭스의 *🟡 부품들의 *cluster*
- ***§5 코드 패턴 A·B·C*** = 위 *2.5.5 패턴 분포에 *direct mapping*
- ***§6 스프린트 타임플랜*** = *2.5.1 Spec Sheet 27장 작성의 *order*

→ ***이 §2.5는 *navigation index*. *§3 이후 모든 진단·작업이 *위 매트릭스 어디를 *가리키는지* 추적 가능*.

---

## 2.6. 묶음(Recipe) 1개의 완성 체크리스트 — Recipe Spec Sheet 양식

> **§2 Element Spec Sheet 5칸 양식과 *parallel하게 *Recipe Spec Sheet 양식 정의*. *Recipe 1개당 1장*. *§2 (Element)·§2.6 (Recipe) 양 양식이 *리걸 → 개발 인수인계의 *완전한 set*.

부품이 *"어느 조문의 어느 요건을 *어떻게 판정"*이면, *묶음은 *"어느 법률의 어느 효과를 *어느 부품 조합으로 *증명"*. **Recipe Spec Sheet 6칸 양식** (Element 5칸 + Recipe-specific Conflict·Interaction 1칸 추가):

| 칸 | 내용 | 예시 (Reg D 506(c) Issuance Recipe) |
|----|------|----|
| ① 법률효과 | "이 묶음이 충족됐을 때 *발생하는 법률효과 *1개*" (08 §II "1 법률효과 = 1 Recipe" 원칙) | "1933 Act §5 등록 면제 성립" |
| ② 부품 subset | "효과 발생을 위해 *cumulative 충족 필요한 *부품 list (필수·조건부 분리)" | 필수: A-01·A-02·A-03·A-04·A-11·E-01·E-03·F-04·B-01·B-02·B-03 / 조건부: A-08·A-09 (entity buyer 시) |
| ③ Activation logic | "어떤 *transaction context에서 *이 묶음이 *activate되는가*" | "asset = Reg D 506(c) 발행 자산 (Manifest facts.issuanceFramework=RegD506c) + 모든 transaction에 base activate" |
| ④ Composition rule | "부품 subset 사이의 *AND/OR/conditional 결합 규칙*" | "필수 부품 모두 cumulative AND. 조건부 부품 (A-08·A-09)은 *entity buyer 시 *cumulative activate. *한 부품이라도 fail → Recipe 전체 fail" |
| ⑤ 거절·예외 처리 | "Recipe 전체 fail 시 *거절 사유 코드 + 예외 처리* (어느 부품 fail인지 *propagate)" | 거절 코드: `RECIPE_R1_REGD_ISSUANCE_FAIL` + 원인 부품 ID propagate (예: `A-03 NOT_ACCREDITED` 등). 예외 없음 (Issuance framework는 *strict). |
| ⑥ Conflict·Interaction | "**다른 Recipe와의 *관계** (Compose·Intersect·Conditional·Cumulative·Conflict 5 패턴 — 05 §III)" | • *R3 ICA §3(c)(7) Fund와 *Cumulative* (BUIDL = fund-form 시 동시 적용) / • *R5 Reg A와 *Conflict* (issuance framework는 단일, 양립 불가) / • *R2 Resale은 *primary issuance 아닌 *secondary transaction의 *별도 Recipe (orthogonal) |

**①~②가 리걸 리서치의 본체**이고, ③~⑥은 *Element와의 *coordination 명시*. **⑥ Conflict·Interaction이 *Element Spec Sheet에는 없는 *Recipe-specific 항목*** — *Recipe 간 *cumulative·conflict 패턴*이 *Manifest Integrity Check (B-01)*의 *base*.

**4 Recipe Spec Sheet의 *합산 = §7 산출물 *Recipe coverage 표 4장의 *완전한 form***. *coverage 표 (법률별 ↔ 부품 대조표)는 *Recipe Spec Sheet ②의 *부품 subset에 *direct mapping*.

---

## 2.7. 1 부품·1 묶음 = 1 문서 원칙

> **사용자 요구 명시 (2026-06-12)**: *"각 element와 recipe 1마다 *하나의 문서가 *나오는게 *원칙"*. *§2 (Element 5칸) + §2.6 (Recipe 6칸) 양식이 *그 원칙의 *spec*. *§2.7은 *그 원칙의 *meta-articulation + physical file 구조 명시*.

### 2.7.1 원칙 4 줄

1. ***1 Element = 1 file*** (Element Spec Sheet, §2 5칸 양식)
2. ***1 Recipe = 1 file*** (Recipe Spec Sheet, §2.6 6칸 양식)
3. ***Cross-reference link로 *통합 (wiki link)*. *physical 파일은 *원자 단위*
4. ***Element 27장 + Recipe 4장 = 총 31 file*** (BUIDL 데모 scope 기준)

### 2.7.2 *왜 *1 file = 1 entity 원칙인가 — *5 reasons*

| Reason | 내용 |
|------|------|
| **(1) Isolated read·review·update** | *각 entity의 *spec을 *독립적으로 *읽고·검토·업데이트 가능. *변경 영향이 *file 단위 contained* |
| **(2) Parallel 작업** | *복수 변호사·리걸 인력이 *각 file에 *parallel work 가능. *Sprint 2~3에서 *동시 진행 효율 |
| **(3) 변호사 위임 단위** | *변호사 위임 시 *file 단위 delegation 명확*. *"A-13 Spec Sheet 검토 부탁"·"R3 Recipe Spec Sheet의 ⑥ Conflict 정밀화" 등 *direct task 명세 |
| **(4) Git history clarity** | *file 단위 change track. *어느 Element·Recipe가 *언제 *어떻게 update됐는지 *audit trail 명확* |
| **(5) Cross-reference 명확** | *file 단위 wiki link로 *통합 view. *변호사 위임·논증서·BUIDL 자산 dossier가 *각 file을 *direct reference* |

### 2.7.3 *Physical 폴더 구조 권고*

산출물 폴더 구조 (Phase 1·2 시점에 정착):

```
01_DEX-Compliance-Research-2026-05/
└── spec-sheets/  ⭐ 신규
    ├── elements/
    │   ├── A-01_제재명단.md           (5칸 Element Spec Sheet)
    │   ├── A-02_국가제한.md
    │   ├── A-03_적격투자자.md         (이미 14 자료에 *deep dive 존재 — *Spec Sheet form으로 압축 변환)
    │   ├── A-04_신원중복.md
    │   ├── A-06_내부자판정.md         (🟡 R-3 응답 후 작성)
    │   ├── A-08_법인자격산정.md       (🟡 R-1에 통합)
    │   ├── A-09_법인look-through.md   (🟡 R-1에 통합)
    │   ├── A-11_증명유효기간.md
    │   ├── A-12_모름항변차단.md       (🟡 R-3에 통합)
    │   ├── A-13_기관전용자격QP.md    (⭐ R-1 응답 후 작성 — 데모 핵심)
    │   ├── B-01_신상카드정합.md
    │   ├── B-02_토큰표준.md
    │   ├── B-03_이전제한메타.md
    │   ├── B-04_엔진선택.md
    │   ├── C-00_전매경로선택기.md     (🟡 R-4 + 위임)
    │   ├── C-01_보유기간.md
    │   ├── D-01_보유자수카운터.md     (🟡 R-5에 통합 — STATEFUL)
    │   ├── E-01_FormD확인.md          (🟡 R-5)
    │   ├── E-03_전과자차단.md
    │   ├── F-01_운영자자기거래.md     (🟡 R-3에 통합)
    │   ├── F-02_시장행위감시.md       (🟡 R-6 — STATEFUL flag)
    │   ├── F-03_사기감시.md           (🟡 R-6에 통합 — STATEFUL flag)
    │   └── F-04_판매중매수금지.md
    │
    └── recipes/
        ├── R1_RegD-506c-Issuance.md   (6칸 Recipe Spec Sheet)
        ├── R2_§4a7-Rule144-Resale.md
        ├── R3_ICA-§3c7-Fund.md
        └── R4_시장행위감시.md
```

→ *27 Element files + 4 Recipe files = *31 file*. *각 file 약 1-2 페이지 (Spec Sheet 양식 따라)*. *총 약 30~60 페이지의 *machine-actionable spec set*.

### 2.7.4 *Naming convention*

| Type | Format | 예시 |
|------|------|------|
| Element file | `{ID}_{한국어이름}.md` | `A-13_기관전용자격QP.md` |
| Recipe file | `R{번호}_{영어이름}.md` | `R3_ICA-§3c7-Fund.md` |
| Recipe coverage 표 (선택적 별도) | `R{번호}_coverage-법률별-부품매핑.md` | `R1_coverage-Reg-D-506c-Issuance.md` |

**Element 한국어 이름·Recipe 영어 이름** 사용 이유:
- *Element는 *법률가 reference 중심 (한국어 친화)*
- *Recipe는 *개발팀·국제 communication 중심 (영어 친화)*
- *둘 다 *frontmatter `english-name`·`korean-name` field로 *양쪽 표기 보유 가능*

### 2.7.5 *Spec Sheet file의 *frontmatter 표준*

```yaml
---
type: element-spec-sheet OR recipe-spec-sheet
id: A-13 OR R3
name-ko: 기관전용자격QP
name-en: Qualified Purchaser Verification
domain: A  # A·B·C·D·E·F (Element only)
recipe-layer: 3  # 1·2·3·4·5 (Recipe only)
maturity: 🟢완료 OR 🟡정밀화필요
verification-pattern: A·B·C  # 기계판정·증명서·감시 (Element only)
timing: pre-trade OR post-trade
stateful: false OR true
research-source: R-1·R-2 등 (🟡 부품의 경우)
related-recipes: [R1, R3]  # Element의 attached Recipes
related-elements: [A-13, D-01]  # Recipe의 attached Elements (subset)
status: draft OR review OR complete
updated: YYYY-MM-DD
---
```

### 2.7.6 *기존 자료와의 *관계 — *Spec Sheet은 *압축본*

| 기존 자료 | Spec Sheet 관계 |
|--------|------|
| 14 자료 *A-03 walkthrough deep dive (~700 lines)* | Spec Sheet `A-03_적격투자자.md` (~1-2 페이지) = *14 자료의 *5칸 압축 form*. *deep dive는 *원본 reference로 유지* |
| 05 자료 *Recipe v4 Multi-Recipe model* | Spec Sheet `R1~R4 4 files` = *05 자료의 *각 Recipe Layer의 *operational form* |
| 06 자료 *Element·Recipe update process* | Spec Sheet 양식의 *update governance가 *§3.5 Field 5에 *implicit reference* |
| 07 자료 *ACM L3* | Spec Sheet의 *attached Recipes·overrides가 *ACM Field 1·2에 *encode되는 *content* |

→ ***Spec Sheet = *기존 deep dive 자료의 *operational compression form*. *deep dive (reasoning·legal analysis)는 *유지하되, *implementation-ready operational form은 *Spec Sheet에 *압축*. *두 form이 *complementary*.

### 2.7.7 *Timing — *Spec Sheet 작성의 *Sprint별 위치*

§6 Sprint 타임플랜에 *direct mapping*:

| Sprint | Spec Sheet 작성 진행 |
|------|---------|
| Sprint 1 | Element 7장 (A-01·A-02·A-03·C-01·F-04·B-01·E-03) + Recipe 0장 |
| Sprint 2 | Element 누적 16장 (R-1·R-3 응답분 추가) + Recipe 2장 (R1·R3 우선) |
| Sprint 3 | Element 누적 24장 + Recipe 누적 3장 (R2 추가) |
| Sprint 4 | Element 27장 *완성* + Recipe 4장 *완성* (R4 시장행위감시) + 통합 검증 |

→ ***Sprint 4 종료 = 31 file 완성 = BUIDL 데모 + 논증서 base + 변호사 위임 자료 *all-in-one*.

---

## 3. 현황 진단 — 27개 부품, 어디까지 와 있나

데모에 쓰이는 부품 27개를 리서치 성숙도로 3그룹으로 나누면:

### 그룹 1 — 리서치 완료, Spec Sheet 작성만 남음 (11개)

이미 deep dive 문서가 있어서 ①~②가 사실상 끝난 부품들. **양식에 옮겨 담는 작업**(부품당 반나절)만 남았습니다.

| 부품 | 무엇을 검사 | 리서치 출처 |
|------|------------|------------|
| 제재 명단 (A-01) | 매수·매도인이 제재 대상인가 | 기존 정리 + 보강 리서치 R-2 (아래) |
| 국가 제한 (A-02) | 허용 관할의 투자자인가 | 기존 + 역외적용 정리 완료 |
| 적격투자자 검증 (A-03) | 매수인이 적격투자자인가 | **구현 시연 문서까지 존재** — 가장 성숙 |
| 신원 중복 (A-04) | 한 사람이 여러 지갑으로 위장하지 않는가 | 기존 |
| 증명 유효기간 (A-11) | 자격 증명이 만료되지 않았는가 (5년 상한) | 기존 |
| 전과자 차단 (E-03) | 발행 관계자가 bad actor(전력자)인가 | Rule 506(d) 검토 완료 |
| 보유기간 (C-01) | 매도인이 충분히 보유했는가 | Rule 144 정리 완료 |
| 토큰 표준·이전제한 메타데이터 (B-02·B-03) | 기술 전제 확인 | 기존 |
| 신상카드 정합 (B-01) | 신상카드와 실제 설정이 일치하는가 | 재정의 완료 |
| **판매 중 발행자 매수 금지 (F-04)** | 파는 쪽 사람의 매수 차단 | **이번 주 완료** — 시세 관여 금지 deep dive |

### 그룹 2 — 판정 기준 정밀화 리서치 필요 (10개) ← **리걸 파트의 주전장**

개념은 잡혀 있으나 *판정 기준의 세부*가 미확정 — §4의 리서치 큐가 여기에 대응합니다.

| 부품 | 미확정 지점 (= 리서치 질문) | 대응 리서치 |
|------|---------------------------|------------|
| **기관전용 자격 검증 (A-13)** ⭐ | "qualified purchaser"(적격 매수자)의 정확한 정의 — 개인/법인별 기준액, 가족회사 처리, 펀드의 펀드 | **R-1** |
| 내부자 판정 (A-06) | 누가 affiliate(지배관계인)인가 — 지분율만으로 안 되고 "지배" 판단이 필요한 회색지대의 처리 기준 | **R-3** |
| 법인 자격 산정 (A-08·A-09) | 법인 매수인의 자격을 따질 때 어디까지 뚫고 들어가나(look-through 깊이) | R-1에 통합 |
| 전매 경로 선택기 (C-00) | 자격자 간 2차 거래의 면제 근거 조항 확정 — 변호사 질의 발송됨, 회신 전 보수 기본값 | **R-4** + 위임 |
| 모름 항변 차단 (A-12) | "몰랐다"가 통하지 않는 적신호(red flag)의 목록화 | R-3에 통합 |
| Form D 확인 (E-01) | 발행사의 사모 신고 이행을 *어떤 데이터로* 확인하나 (SEC EDGAR 조회 방법) | **R-5** |
| 보유자 수 카운터 (D-01) | 임계값의 정확한 산정 단위 — "record holder" 계산 방식 | R-5에 통합 |
| 발행 면제 검증 (A-08 외 발행 측) | 발행사 제출 사실의 검증 깊이 | 검증 깊이 차등 원칙 적용 — 추가 리서치 불요 확인만 |
| 엔진 선택 (B-04) | 자산별 허용 체결 방식 — 기존 정리 적용 | 확인만 |
| 운영자 자기거래 제한 (F-01) | 금지 범위(본인·임직원·계열)의 인적 경계 | R-3에 통합 |

### 그룹 3 — 감시형: 운영 기준 리서치 필요 (3개 + 신상카드 사실 4종)

차단이 아니라 "표시(flag) 후 사람 판단" 방식이라, 리서치 대상은 판정식이 아니라 **탐지 기준과 처리 절차**입니다.

| 부품 | 리서치 질문 | 대응 |
|------|------------|------|
| 시장행위 감시 (F-02) | 자전거래·허수주문의 *객관적 탐지 패턴* — 미국 집행 사례에서 기준 추출 | **R-6** |
| 사기 감시 (F-03) | 의심거래 보고의 판단 기준 + 처리 기록 양식 | R-6에 통합 |
| (운영) flag 처리 시한 | 며칠 안에 판단해야 "작동하는 감시"인가 — 업계 관행 | R-6에 통합 |

## 4. 리서치 큐 — 구체적으로 무엇을 조사하나 (우선순위순)

| # | 리서치 | 핵심 질문 | 산출물 | 예상 | 막는 것 |
|---|--------|----------|--------|------|--------|
| **R-1** 🔴 | **"기관전용 자격"의 정의** (미국 투자회사법 §2(a)(51) qualified purchaser + 법인 look-through) | 개인 $5M·기관 $25M 기준의 정확한 산정(무엇이 "투자자산"인가), 가족회사·신탁 처리, 펀드가 매수인일 때 구성원까지 보는 조건 | A-13·A-08·A-09 Spec Sheet | 1일 | **BUIDL 데모의 핵심 부품** — 장면 2(자격 미달 거절)가 이것 |
| **R-2** 🔴 | **제재 검사의 실무 기준** (OFAC SDN 명단 + 50% 지분 규칙) | 명단 직접 등재자 외에 "제재 대상이 50% 이상 보유한 법인"도 자동 차단 — 그 지분 합산 규칙과 데이터 소스, 이름 유사 매칭의 처리(오탐 시 해제 절차) | A-01 Spec Sheet v2 | 1일 | 장면 5(명단 갱신 무중단 반영)의 정확성 |
| **R-3** 🟡 | **내부자(affiliate) 판단 기준** (Rule 144·Rule 405의 "control" 개념) | 지분율 몇 %부터? 임원은 자동인가? 회색지대는 누가 판정하고 어떻게 기록하나 (증명서형 + 운영자 판단의 결합 설계) | A-06·F-01·A-12 Spec Sheet | 1.5일 | 장면 1의 매도인 측 검사 |
| **R-4** 🟡 | **자격자 간 2차 거래의 면제 경로** (§4(a)(7) 요건 체크리스트 — 기존 정리 보강) | 정보 제공 요건·매도인 제한·공모 금지 요건을 부품 입력으로 분해. 변호사 회신(어느 경로가 안전한가) 도착 시 합류 | C-00 Spec Sheet (BUIDL 분기) | 1일 + 위임 회신 | 장면 1의 적법 근거 — 회신 전엔 보수 기본값으로 진행 가능 |
| **R-5** 🟢 | **공적 데이터 확인 방법** (SEC EDGAR의 Form D 조회 + record holder 산정) | 발행사 신고를 기계가 확인할 수 있는 데이터 경로, 보유자 수의 법적 계산 단위 | E-01·D-01 Spec Sheet | 0.5일 | 신상카드 사실 검증 |
| **R-6** 🟢 | **시장감시 탐지 기준** (자전거래·허수주문의 미국 집행 사례 분석) | "같은 실소유자의 지갑 클러스터 간 거래"를 어떤 객관 기준으로 표시하나, 처리 시한의 업계 관행 | F-02·F-03 운영 기준서 | 1.5일 | 장면 6 — 단 데모는 단순 기준으로 가능, 정밀화는 후순위 |

**합계: riserca 순수 작업량 약 6.5일** (위임 회신 대기는 병렬 — 일정을 막지 않음). R-1·R-2가 데모 직결이라 최우선.

## 5. 코드 논리로 어떻게 넘기나 — 변환 패턴 3종

리서치 결과는 부품의 성격에 따라 세 가지 표준 패턴 중 하나로 코드화됩니다. **리걸 파트는 "어느 패턴인지"까지 지정해서 넘깁니다**:

### 패턴 A — 기계 판정형 (결정론): 조문 → 조건문

기간·금액·명단처럼 계산 가능한 요건. Spec Sheet ③의 의사코드가 거의 그대로 코드가 됩니다.
```
# 예: 보유기간 (C-01)
if (now - 취득시각) < 신상카드.요구보유기간 → 거절(HOLDING_PERIOD)
```

### 패턴 B — 증명서형: 판단은 밖에서, 코드는 증명서만 확인

자격(적격투자자·기관전용 기준)처럼 *판단 자체는 검증기관이 오프체인에서* 하고, 코드는 **서명된 증명서의 존재·발급자·유효기간만** 확인합니다.
```
# 예: 기관전용 자격 (A-13)
증명서 = 신원지갑.조회(주제="QP", 발급자 ∈ 공인검증기관명단)
if 증명서 없음 or 만료 → 거절(NOT_QP)
```
→ 리걸 리서치의 역할: *검증기관이 무엇을 확인하고 서명해야 하는지*(R-1의 산정 기준)를 증명서 발급 기준서로 정의.

### 패턴 C — 감시형: 차단하지 않고 표시한다

고의·목적이 요건인 영역(시세조종·사기)은 사전 판정이 불가능 — 객관 패턴만 자동 표시하고 판단은 운영자가.
```
# 예: 자전거래 (F-02)
if 매수인.실소유클러스터 == 매도인.실소유클러스터 → 체결은 진행 + flag 기록 + 운영 큐 적재
```
→ 리걸 리서치의 역할: *무엇을 표시할지의 객관 기준*(R-6)과 *표시 후 처리 절차·시한*.

**왜 패턴 지정이 리걸의 일인가**: 패턴을 잘못 고르면 법적으로 틀립니다 — 감시형을 차단형으로 만들면 정당한 거래를 막아 별도 책임이 생기고, 증명서형을 기계 판정형으로 만들면 코드가 할 수 없는 판단을 하는 척하게 됩니다.

## 6. 타임플랜 — 31번 플랜의 스프린트에 정렬

| 스프린트 | 리걸 파트 작업 | 산출물 |
|---------|---------------|--------|
| **1 (지금)** | R-1 + R-2 (데모 직결 2건) + 그룹 1의 Spec Sheet 5장 (A-01·A-02·A-03·C-01·F-04 — 데모 장면에 직접 등장하는 것부터) | Spec Sheet 7장 |
| **2** | R-3 + R-4 + 그룹 1 잔여 Spec Sheet 6장 + 그룹 2 중 R-1·R-3 의존분 (A-13·A-06·A-08/09) | Spec Sheet 누적 16장 + 검증기관 발급 기준서 (패턴 B용) |
| **3** | R-5 + 그룹 2 잔여 + 개발팀 구현 결과물과 Spec Sheet 대조 검수 (③·⑤가 코드·테스트에 반영됐는지) | 누적 24장 + 검수 기록 |
| **4** | R-6 + 그룹 3 운영 기준서 + **Recipe 단위 통합 검증** (부품들이 묶음으로 모였을 때 법률별 소결론이 완전한가 — 4개 묶음 각 1장) + 전체를 BUIDL 논증서에 합류 | 27장 완성 + Recipe 명세 4장 + 논증서 입력 |

**Recipe 단위 검증이 마지막에 있는 이유**: 부품이 다 맞아도 묶음에 빠진 요건이 있으면 그 법률의 소결론이 불완전합니다. 묶음마다 "이 법률의 모든 요건이 어느 부품에 의해 커버되는가"의 대조표(coverage 표)를 만들어 확인합니다 — 이 표가 그대로 논증서의 척추가 됩니다.

## 7. 산출물 정리 — 끝났을 때 손에 있는 것

1. **Element Spec Sheet 27장** — 부품당 1장 (§2 5칸 양식, *1 element = 1 file 원칙 §2.7)*. 개발 인수인계 + 논증서의 "법→논리" 절반
2. **Recipe Spec Sheet 4장** — 묶음당 1장 (§2.6 6칸 양식). *§7 기존 "coverage 표 4장"의 *완전한 form — *법률효과·부품 subset·activation·composition·거절처리·Conflict·Interaction 모두 포함*
3. **검증기관 발급 기준서** — 증명서형 부품(패턴 B)이 신뢰할 증명서의 발급 요건 정의
4. **운영 기준서** — 감시형 부품의 탐지 기준·처리 절차·시한
5. → 위 31 file (Element 27 + Recipe 4) + 부속 기준서 2종 = **BUIDL 규제 논증서** ("어느 법이 → 어떤 논리로 → 어느 코드에")의 입력이 되어, 데모와 함께 Phase 2의 최종 산출물 완성

## 8. 변경 로그

- [2026-06-12] (canton-rwa) v1.2 ⭐⭐ **§2.6 Recipe Spec Sheet 양식 + §2.7 1 부품·1 묶음 = 1 문서 원칙 신설**. *사용자 요구 명시*: *"각 element와 recipe 1마다 *하나의 문서가 *나오는게 *원칙"*. **§2.6 Recipe Spec Sheet 6칸 양식** (① 법률효과·② 부품 subset·③ Activation logic·④ Composition rule·⑤ 거절·예외·⑥ Conflict·Interaction) — *Element 5칸 양식과 *parallel + Recipe-specific ⑥ Conflict·Interaction 추가*. **§2.7 *5 subsections*:
   - 2.7.1 원칙 4 줄 (1 Element = 1 file·1 Recipe = 1 file·cross-ref·총 31 file)
   - 2.7.2 5 reasons (isolated read·parallel work·변호사 위임 단위·git history·cross-ref 명확)
   - 2.7.3 Physical 폴더 구조 권고 (`spec-sheets/elements/`·`spec-sheets/recipes/`)
   - 2.7.4 Naming convention (Element 한국어·Recipe 영어)
   - 2.7.5 frontmatter 표준 (type·id·name·domain·maturity·verification-pattern·timing·stateful·research-source·related-recipes·related-elements 등)
   - 2.7.6 기존 자료와의 관계 (Spec Sheet = deep dive 압축본)
   - 2.7.7 Sprint별 timing
   §7 산출물 정리에 *Recipe Spec Sheet 4장 추가* (기존 "coverage 표 4장" → "Recipe Spec Sheet 4장 (coverage 포함 완전 form)"). *Sprint 4 종료 = 31 file 완성 = BUIDL 데모 + 논증서 + 변호사 위임 자료 *all-in-one*.
- [2026-06-12] (canton-rwa) v1.1 ⭐ **§2.5 Element·Recipe 전체 Map 신설**. *사용자 요청: "33문서에 element recipe 전체 map 상세버전 적당한 위치에 추가 — 전체그림을 명확하게 보고 싶어"*. **6 subsections**:
   - §2.5.1 *27개 부품 전체 매트릭스* (도메인 A·B·C·D·E·F + 검사 대상·성숙도·검증 방식·Timing·Stateful?)
   - §2.5.2 *4 Recipe + Element 부착 매트릭스* (R1 Issuance·R2 Resale·R3 Fund·R4 행위감시)
   - §2.5.3 *BUIDL 1 transaction cumulative Recipe attachment trace*
   - §2.5.4 *Element × Recipe 행렬 (●·○·—)* + Coverage 분석 (cross-Recipe shared·Recipe-exclusive·Conditional)
   - §2.5.5 *성숙도·코드 패턴·Timing·Statefulness 4 분포 시각화*
   - §2.5.6 *Navigation index — §3 이후 작업이 *이 map의 어디를 가리키는지 추적*
   *§3 현황 진단 3그룹 분류와의 *direct mapping 명시*. *§3 이전 위치 신설로 *map 먼저 → detail 흐름 자연스러움*.
- [2026-06-12] (canton-rwa) v1.0 작성 (사용자 요청: "각 element와 recipe를 리서치하고 구현까지 — 리걸 파트가 실질 준비할 부분의 구체 플랜"). 작업 본질 = 법률검토보고서의 코드화 / 부품 완성의 5칸 DoD (Element Spec Sheet 양식 정의) / 27개 부품 3그룹 현황 진단 (완료 11·정밀화 필요 10·감시형 3) / 리서치 큐 R-1~R-6 (합계 약 6.5일 — R-1 QP 정의·R-2 OFAC 50% 규칙이 데모 직결 최우선) / 코드 변환 패턴 3종 (기계 판정·증명서·감시 — 패턴 지정도 리걸의 책임인 이유 포함) / 스프린트별 타임플랜 + Recipe coverage 표 / 산출물 5종. 31 (전체 플랜)의 리걸 트랙 상세판.
