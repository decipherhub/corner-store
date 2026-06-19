# ADR-002 — OD-CI-5: 횡단 규제(제재·관할·Reg M)를 독립 Cross-Jurisdictional Recipe로 분리

| 항목 | 값 |
|---|---|
| Status | **Accepted** (2026-06-17) |
| Decider | 규제 담당 단독 결정 (쟁점 등록부 §1-가 — freeze-blocking) |
| Channel | [G] GitHub (ADR) |
| Scope | Recipe 분류·orchestration 변경 (검사 실행 코드는 불변) |
| Related | open-issues-backlog `OD-CI-5` / 아키텍처 노트 15 §V / update-process 노트 06 / BUIDL 시나리오 노트 29 / ADR-001(F-04) |
| Follow-up | Manifest universal-Recipe 명시 · B-01 포함 검사 · 3축→5축 재분류(🟡)와 조율 |

> **첫 문장 요약.** 제재(Sanctions)·국가 제한(Country/Jurisdiction)·Reg M(F-04) 검사를, 지금처럼 증권법 Recipe 묶음 *안에* 넣지 말고, **모든 자산에 항상 걸리는 독립 "횡단(cross-jurisdictional) Recipe"로 빼낸다.** 검사 코드 자체는 안 바뀌고, *어느 묶음에 속하느냐(분류·조합)*만 바뀐다.

---

## 1. 배경 (Context)

제재(OFAC)·관할 제한은 법적 성격이 **증권법 면제의 요건이 아니라, 그와 독립된 별개 법률**이다. 제재 위반은 증권이든 아니든·미국이든 한국이든 *항상* 적용되는 strict liability 의무다. 그런데 현재 설계에서는 이 검사들(A-01 Sanctions·A-02 Country)이 *증권 발행 Recipe(Reg D 묶음) 안에* 부품으로 들어가 있다.

문제: 증권법 묶음 안에 가둬 두면, **비증권 자산이나 다른 관할로 확장할 때 재사용이 안 된다.** "이 규제가 왜 여기(증권 Recipe) 있지?"라는 법률 지도상의 부정합도 생긴다 — 제재는 증권법의 하위 요건이 아니기 때문이다.

(같은 맥락에서 ADR-001로 추가한 **Reg M(F-04)**도 시장행위 규제라 증권 발행 요건과 결이 다르므로, 이 횡단 묶음의 후보다.)

---

## 2. 결정 (Decision)

**옵션 (ii) 채택 — 제재·관할·Reg M을 묶는 독립 "Cross-Jurisdictional Recipe"를 신설한다.**

- 이 Recipe는 자산 종류·관할과 무관하게 **모든 거래에 universal하게 binding**된다.
- **검사 실행 코드(Element)는 불변** — A-01·A-02·F-04 부품 자체는 그대로 두고, *소속 Recipe와 orchestration*만 바꾼다(재분류).
- Manifest(자산 신상카드)가 *이 universal Recipe 포함을 명시*하고, B-01(Manifest 무결성 검사)이 포함 여부를 확인한다.
- **단서 — 감시형(F-02 wash trading·F-03 §20(e) 등)은 이 Recipe에 넣지 않는다.** 사후 monitoring은 거래 직전 "소결(pass/fail)"로 환원되지 않으므로(flag + Operator 판단이 정확), Recipe 모델에 부적합하다.

---

## 3. 고려한 옵션 (Options Considered)

| 옵션 | 내용 | 판정 |
|---|---|---|
| (i) always-on Element 분류 | A-01·A-02를 증권 Recipe에서 빼되 "always-on Element"라는 특수 분류로 둠 | ❌ — Router에 "always-on" 특수 분기가 생겨 메커니즘이 둘로 갈림 |
| **(ii) 독립 횡단 Recipe (채택)** | Sanctions·Jurisdiction·Reg M을 하나의 cross-jurisdictional Recipe로 묶어 universal binding | ✅ 채택 |

**(ii)의 우위 4가지:**
1. **단일 메커니즘** — Router가 "Recipe 조합"이라는 하나의 메커니즘만 갖는다(always-on 특수 분기 소멸).
2. **거버넌스 재사용** — 버전업 절차(노트 06)를 그대로 탄다. OFAC 명부 변경 = Recipe 버전업으로 처리.
3. **재사용성** — 비증권 자산·타 관할로 확장할 때 이 횡단 Recipe만 그대로 binding하면 된다.
4. **법률검토보고서 동형성** — "1 법률 = 1 소결 = 1 Recipe" 원칙에 맞는다(제재는 별개 법률 → 별개 Recipe).

**기존 반론 해소** — "항상 포함되면 분류가 무의미하지 않나?" → *Manifest가 universal Recipe 포함을 명시*하고 B-01이 검증하므로, 오히려 법률 지도가 더 명시적이 된다(어느 거래든 "제재 Recipe가 걸려 있다"가 신상카드에 적힌다).

---

## 4. 결과 (Consequences)

**긍정** — Router 단일화, 거버넌스 재사용, 비증권/타관할 확장성, 법적 매핑의 명시성. 검사 실행 코드 불변이라 구현 disruption이 작다(분류·orchestration 변경에 그침).

**부담/비용** — ① Manifest 스키마에 "universal Recipe 포함" 명시 필드 + B-01에 포함 검사 로직 추가. ② 3축→5축 재분류(🟡, freeze 후 batch)와 조율 필요 — 두 재분류가 같은 부품(F-04 등)을 건드리므로 순서를 맞춰야 한다.

**따라오는 작업:**
- Manifest에 universal Recipe 참조 명시 + B-01 포함 검사 (개발팀).
- Cross-Jurisdictional Recipe의 정확한 부품 구성 확정(아래 열린 질문).
- **감시형(F-02·F-03)은 명시적으로 제외** — 별도 flag+Operator 경로 유지.

---

## 5. 열린 질문 (Open Questions)

- 횡단 Recipe의 정확한 구성: A-01·A-02·F-04 외에 더 들어갈 부품이 있나(예: 향후 AML 관련)? — freeze 후 정밀화.
- 버전업 거버넌스: OFAC 변경 = Recipe 버전업의 구체 절차(노트 06 재사용이되 universal Recipe 특수성 반영).
- 다관할 충돌 시 "stricter rule wins" 적용을 이 Recipe 레벨에서 어떻게 표현하나 — methodology §9 패턴과 연결.

---

## 6. 검증 / 출처 (Verification)

- 아키텍처 노트 15 §V "OD-CI-5 v2" (사용자 2차 제안으로 옵션 정밀화, 2026-06-12 — 권고 ✅).
- update-process 노트 06(거버넌스·버전업), BUIDL 시나리오 노트 29.
- 법적 근거: OFAC 제재(31 CFR)·관할 제한은 증권법과 독립된 strict liability 의무 → 별개 Recipe 정당화. Reg M(F-04)은 ADR-001.

---

## 변경 로그

- **[2026-06-17] ADR-002 작성·Accepted.** OD-CI-5(횡단 규제 재분류) 결정 — 제재·관할·Reg M을 독립 Cross-Jurisdictional Recipe로 분리(옵션 ii). 쟁점 등록부 §1-가 freeze-blocking 4건 중 3번째. 검사 코드 불변·분류/orchestration만 변경. 감시형(F-02·F-03) 제외. 후속: Manifest universal-Recipe 명시·B-01 포함 검사·3축→5축(🟡)과 조율.
