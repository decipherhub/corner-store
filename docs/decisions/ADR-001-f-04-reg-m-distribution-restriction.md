# ADR-001 — F-04: Reg M Distribution Period Restriction Element 추가

| 항목 | 값 |
|---|---|
| Status | **Accepted** (2026-06-17) |
| Decider | 규제 담당 단독 결정 (쟁점 등록부 §1-가 — freeze-blocking) |
| Channel | [G] GitHub (ADR) |
| Scope | Element pool freeze 대상 확정 |
| Related | open-issues-backlog `F-04` / methodology(패턴 분류 §2) / 유통규제 Reg M deep dive / BUIDL 구현 시나리오 |
| Follow-up | 개발팀 `CR-8`(rail 분리) · 변호사 `Q-T2a~d`(non-blocking) |

> **이 문서가 뭔지 (첫 ADR — 템플릿 겸용).** ADR(Architecture Decision Record)은 "어떤 설계·규제 결정을, 왜, 어떤 대안을 제치고 내렸는지"를 한 장에 남기는 기록이다. 팀이 나중에 "이거 왜 이렇게 했지?"를 되짚을 수 있게 한다. 본 문서는 Decipher의 첫 ADR이며, 이후 ADR은 같은 6-섹션 틀(배경·결정·옵션·결과·열린질문·검증)로 찍어낸다.

---

## 1. 배경 (Context)

**Reg M**은 미국판 *"공모(distribution) 진행 중 시세 받치기 금지"* 규제다 — 한국 자본시장법 §176④ 안정조작 규제의 사촌. 핵심 명령은 *"증권을 파는 중인 사람(발행인·인수인·판매참가자)은 파는 기간 동안 그 증권을 사지 마라"*이다.

우리 프로젝트에서 문제가 되는 지점은 둘이다.

1. **상시 발행 = 끝나지 않는 매수 금지 기간.** BUIDL 같은 토큰화 펀드는 매일·계속 신규 토큰을 발행한다(상시 발행). 그러면 판매기간(**restricted period**)이 끝나지 않으므로, *매수 금지가 영원히 걸린 상태*가 기본값이 된다. 그 상태에서 발행자(BlackRock)나 계열 시장조성자가 우리 DEX 풀에 매수 호가를 깔면 **Rule 102 정면 위반**이다.
2. **개방형 펀드 예외를 못 쓴다.** 미국은 *등록* 개방형 펀드(뮤추얼펀드)에 Reg M 예외(Rule 102(d))를 줬지만, BUIDL은 *등록을 면제받은* §3(c)(7) 사모펀드라 정의 사슬이 끊겨 문언상 예외 대상이 아니다 (한국 감각: "공모펀드 특례를, 공모펀드 규제를 면제받은 사모펀드가 가져다 쓸 수는 없다").

즉, 발행자측의 매수를 막는 부품이 없으면 BUIDL listing에 Reg M 노출 구멍이 생긴다.

---

## 2. 결정 (Decision)

**F-04(Reg M Distribution Period Restriction) Element를 부품 목록에 정식 추가하고 freeze 대상으로 확정한다.** 확정 스펙:

- **always-on** — 상시 발행에서 restricted period가 끝나지 않으므로 항상 켜둔다.
- **차단 대상 = "파는 쪽 사람들"의 매수 방향만** — `restrictedParties = 발행자 ∪ 계열 매수자(affiliated purchaser) ∪ 판매참가자(distribution participant)`. **제3자 일반 LP·투자자의 유동성은 건드리지 않는다**(Reg M 수범자가 아님).
- **STATELESS** — 부품 자체는 상태를 안 가진다. "지금 판매 중인가 + 차단 명단"이라는 상태는 자산 신상카드(Manifest)의 `distributionStatus` facts가 보유한다.
- **basis enum** — `distributionStatus.basis ∈ {LEGAL_OPINION, CONSERVATIVE_DEFAULT, RELIEF_OBTAINED}`. 비조치의견서(no-action letter)를 받으면 **코드를 고치지 않고 basis 설정값만** 바꿔 차단을 무력화한다(확장에 열린 설계).

판정 로직(의사 코드):
```
F-04(주문, 신상카드):
  if 신상카드.distributionStatus.active == false      → 통과   # 판매 중 아님
  if 주문.방향 != 매수                                  → 통과   # Reg M은 매수만 금지
  if 주문.당사자 ∈ 신상카드.distributionStatus.restrictedParties
                                                       → 거절 (REGM_RESTRICTED)
  else                                                 → 통과
```

---

## 3. 고려한 옵션 (Options Considered)

| 옵션 | 내용 | 판정 |
|---|---|---|
| **A. 정식 추가 (채택)** | always-on 차단 부품 + Manifest facts + basis enum | ✅ 채택 — 상시 발행 구조상 Reg M 노출이 실재하고, 보수적 default가 다운사이드 거의 없이 막아줌 |
| B. 메모만 (코드 없이) | 설계 메모만 남기고 구현 보류 | ❌ 기각 — F-05(공매도)와 달리 F-04는 BUIDL listing 즉시 발생하는 노출. 메모만으로는 listing 시 무방비 |
| C. 미추가 | 부품 자체를 안 둠 | ❌ 기각 — 발행자측 매수 차단 장치가 없으면 Rule 102 위반 리스크 무대응 |

---

## 4. 결과 (Consequences)

**긍정** — ① 발행자측 매수만 보수적으로 막고 제3자 거래는 그대로 자유라 유동성 영향 최소. ② basis enum 덕에 relief 회신이 와도 코드 무변경(설정값만 변경)으로 대응. ③ BUIDL 구현 시나리오에서 `distributionStatus.active = true (CONSERVATIVE_DEFAULT)` + A-13(Qualified Purchaser) 동시 적용의 첫 실례를 확보.

**부담/비용** — ① "판매 중인가(distribution 여부)"·"누가 발행자측인가(restrictedParties)"는 *사실(facts)* 요건이라 자산별로 신상카드에 채워 넣어야 함(운영 부담). ② 환매가 "매수"로 오인될 경계 리스크(아래 rail 분리로 방어).

**따라오는 작업 (별도 트랙 — freeze·일정 안 막음):**
- **개발팀 `CR-8`**: 1차 시장(청약·환매 NAV 창구) ↔ 2차 시장(DEX 매매) **통로 기술적 분리**. *이것은 UX 디테일이 아니라 Rule 102 방어선*이다(환매가 시장 매수로 읽히는 리스크 차단). + `distributionStatus` 사실 구조 구현.
- **Operator 해제 게이트**: Rule 101의 예외(비권유 거래·리서치 등) 해당 여부는 기계가 판정 못 하므로, 일단 거절 후 권한자(Operator)가 판단·해제·기록하는 기존 이중 게이트 패턴 재사용(새 메커니즘 불요).
- **변호사 `Q-T2a~d`**: 보수적 default로 이미 막아둔 상태라 회신 전에도 진행 가능(non-blocking).

---

## 5. 열린 질문 (Open Questions — 변호사 트랙, non-blocking)

| Q | 질문 | 우선순위 |
|---|---|---|
| Q-T2a | 토큰화 펀드의 상시 creation이 distribution에 해당하는 사실 기준은? (판매대행사 유/무 각각) | 🔴 |
| Q-T2b | §3(c)(7) 펀드의 개방형 예외 부적용이 맞는지 확인 + 비조치의견서 신청 성공 가능성 | 🔴 |
| Q-T2c | 환매 창구 분리 구조가 Rule 102 "매수" 리스크를 차단하기에 충분한가 (interval fund 선례 유추 강도) | 🟡 |
| Q-T2d | Rule 105가 상시 NAV 발행에 적용되는가 (공매도 도입 전 — 낮은 우선) | 🟢 |

→ 위임 letter Section F(Market Conduct)에 수록됨. 발송해도 일정 안 막힘(보수적 default → 회신·relief 시 설정값만 변경).

---

## 6. 검증 / 출처 (Verification)

- **Reg M**: 17 CFR §§ 242.100–105 (Rule 100 정의 / Rule 101 판매참가자·계열 / Rule 102 발행자·매출인 + 계열 / Rule 105 공매도). [eCFR]
- **개방형 예외 부적용**: Rule 102(d) → "open-end management investment company"(ICA 정의 차용) → §3(c)(7) 펀드는 ICA "investment company" 정의에서 제외 → 예외 부적용.
- **유추 자원**: interval fund 관행(SEC SLB No. 9) / 2025-12-17 크립토 ETP relief(단 *정규거래소(NSE) 상장* 조건 — ATS 거래 사모 토큰은 공백 → 비조치의견서 신청 대상).
- 한국법 anchor: 자본시장법 §176④ 안정조작·시장조성 규제.

---

## 변경 로그

- **[2026-06-17] ADR-001 작성·Accepted.** F-04 정식 추가 결정(쟁점 등록부 §1-가 freeze-blocking 4건 중 1번째). Decipher 첫 ADR — 6-섹션 템플릿(배경·결정·옵션·결과·열린질문·검증) 정립. 채널 [G]. 후속: 개발팀 CR-8(rail 분리)·변호사 Q-T2a~d(non-blocking).
