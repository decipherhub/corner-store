# ADR-008 — 컴플라이언스 이음매(seam) 4종 결정: 취득 출처 · 상태 카운팅 · 거절 로깅 · 라우터 밖 감시

- **상태:** Accepted (2026-07-22)
- **결정자:** 승준 (리걸/PM) + Cowork 리서치
- **유형:** 컴플라이언스 seam 확정 (legal/PM 결정 → dev 구현 명세화)
- **해소하는 열린 결정(repo):** D004(취득 출처·stateful commit hook·거절 로깅) · D006(라우터 밖 경로) · D009(C-01 취득 이음매 / CR-3)
- **1차 출처:** 17 CFR §230.144 (eCFR) · 15 U.S.C. §78l(g)/§80a-3(c)(7) (uscode) · Securitize DS Protocol / BUIDL on-chain 구조 · 미국변호사(염보경) C-01·D-01·A-06 검토

> **이 문서가 뭔가.** 개발팀이 mock으로 우회 구현하고 "열린 결정"으로 남긴 컴플라이언스 이음매(seam) 4개를, 정식 법률검토 결과로 **어떻게 채울지** 확정한다. 4개는 독립이 아니라 **하나의 off-chain 컴플라이언스 데이터 레이어 + Securitize(TA) 어댑터**로 수렴한다(§5). 데모(Gasok)엔 mock으로 충분하고, 본 문서는 *production 적용 규격이 확정됐다*는 증빙이다.

> **⚠️ 정오 (2026-07-28).** 본 문서 §0 표·§2 D-B의 "(a)(2) person-group 키가 **C-08·D-01 공통**"이라는 서술은 **오기**다. **D-01(보유자 수)의 카운팅 단위는 Rule 12g5-1의 held of record**(명의 보유자 — 법인 = 1, (a)(2) 가족·person-group 합산 없음)이며, §2 D-B의 D-01 bullet("§12(g) held of record, 법인 = 1, look-through 안 함")이 통제한다. **(a)(2) person-group 합산은 C-08(Rule 144(e) 물량 한도) 전용**이다. 두 규칙은 목적이 다르다 — §12(g)(D-01)는 등록 트리거 산정이라 명의 보유자를 개별로 세고, Rule 144(a)(2)(C-08)는 계열자의 매도 물량 합산이라 person-group으로 묶는다. 해당 문구는 아래에서 정정 표기했다(§0 표 ②·§2 person-group 소절·§5 다이어그램). 상세는 D-01 spec sheet §4.

---

## 0. 왜 이 4개가 함께 결정되나

| seam | 한 줄 문제 | 수렴점 |
|------|-----------|--------|
| ① acquisition source (C-01 lockup) | "이 사람이 언제 취득했나"를 코드가 어디서 아나 | **Securitize(TA) 어댑터** |
| ② stateful counting (C-08·D-01) | "누적 물량·보유자 수"를 어떻게 세나 | off-chain 상태 (키: C-08 = (a)(2) person-group / D-01 = 12g5-1 held-of-record — 정오 참조) |
| ③ reject logging | 거절(revert)된 거래를 어떻게 남기나 | **off-chain 컴플라이언스 데이터 레이어** |
| ④ out-of-router path | 우리 검사 우회하는 transfer를 어떻게 | 예방(발행측/venue) + **탐지(off-chain surveillance)** |

→ ③④가 같은 off-chain 레이어이고, ①이 그 레이어에 데이터를 공급하며, ②의 상태도 거기 산다. 즉 **Layer 5(off-chain Operator support)** 하나로 통합된다.

---

## 1. 결정 D-A — acquisition source = Securitize(TA) 어댑터

**결정.** C-01 보유기간(Rule 144)의 취득 데이터는 **온체인이 아니라 Securitize(발행사 명의개서대리인)에서** 받는다. `IAcquisitionSource` 어댑터(PD-4 경계)가 per-lot으로 아래를 요청한다.

**필요 필드 (C-01 검토 기준):**

| 필드 | 의미 | 근거 |
|------|------|------|
| `acquisitionDate` | issuer·affiliate로부터 취득한 날 | Rule 144(d)(1) |
| `paymentCompleteAt` | 대금 완납일 | Rule 144(d)(1) "full payment" |
| `sourceType` | 취득 유형(PRIMARY/DIVIDEND/CONVERSION/PLEDGE/GIFT/TRUST/ESTATE …) | Rule 144(d)(3)(i)~(x) tacking 10종 |
| `lineageRef` | 승계형일 때 원본 lot 참조 | (d)(3) tacking |

판정: `clockStart = max(acquisitionDate, paymentCompleteAt)`. 승계형이면 `clockStart = lineageRef.clockStart` 승계. `lineageRef` 결손 → `HP_LINEAGE_BROKEN`(REVIEW).

**근거.**
- pooled AMM은 fungible + 풀 경유로 lot identity가 소실 → **온체인 lot 추적 불가**.
- **BUIDL은 permissioned ERC-20(whitelist형)** — 컨트랙트가 whitelist만 강제하고 *취득일은 온체인에 없다*(Etherscan 확인: 0x7712c34…). → 취득 데이터는 Securitize **off-chain 원장(Connect API)**에서.
- (참고) 토큰이 **DS Protocol**을 쓰면 온체인 `RegistryService`/`ComplianceService`가 lockup·투자자정보를 온체인 추적하므로 어댑터가 온체인 read 가능. BUIDL은 whitelist형이라 off-chain 경로.

**⭐ 배당토큰 주의.** BUIDL은 이자를 **매일 새 토큰(배당)으로 지급** → 각 배당 lot의 tacking lineage(Rule 144(d)(3) 배당 승계)가 필요. 이게 취득 데이터 중 가장 까다로운 부분.

**확인 필요 (blocker 1건):** Securitize **Connect API가 per-holder로 `acquisitionDate`+`paymentCompleteAt`+`sourceType`+배당 lineage를 노출하나?** → Securitize 문의. (API 미노출 시 → 서명 attestation 파일 방식 협의.)

**스코프.** 우리 주 재판매 경로 = **§4(a)(7)**(ADR-005) → 보유기간 요건 無("class outstanding ≥ 90일"만, 이건 증권 전체 속성이라 쉬움). C-01은 **Rule 144 보조경로 전용** → **데모는 mock `IAcquisitionSource` 유지 OK**, production Rule 144 활성화 시에만 Securitize 통합.

---

## 2. 결정 D-B — stateful counting = C-08(물량) + D-01(보유자 수)

**결정.** 상태를 세는(stateful) element = **C-08(Rule 144(e) 물량)** + **D-01(보유자 수)**. 나머지는 대부분 예/아니오(stateless). 아래 계산 규칙을 스펙으로 확정하고, PD-3 idempotent `commit()`으로 거래 후 갱신한다.

### C-08 — Rule 144(e) 물량 한도

- **창:** 직전 **3개월(달력월) rolling**, 성공 매도 누적.
- **상한:** `max(발행량의 1%, 4주 평균 주간거래량)`. **무거래 RWA(국가거래소 거래량 = 0)** → 상한 = **1% outstanding**(2차 프롱 0 수렴, A-06 §1.11 확인).
- **위반 = 초과(>)**, 상한 도달(=)은 적법("shall not exceed").
- **상태 키 = (a)(2) person-group**(주소 아님, 아래).

### D-01 — 보유자 수

- ⭐ **"2,000명 상한은 §3(c)(7)에 없다."** §3(c)(7)(QP 펀드)엔 인원 상한이 아예 없다. 2,000은 **증권거래소법 §12(g) 공개회사 등록 트리거**에서 온다. §3(c)(7) 펀드는 미등록이라 §12(g)(2)(B) 면제를 못 받아 노출됨. → D-01이 지키는 것은 "§12(g) 등록 트리거를 넘지 않기".
- **상한:** held of record **< 2,000** (그리고 비-AI **< 500**). **FPI**(외국사모발행자)면 Rule 12g3-2(a)로 **US-resident record holder < 300**이 이를 대체.
- **부등호:** §12(g)는 *미만 유지*(< 2,000, ≤ 1,999 안전). (§3(c)(1)의 100은 ≤ 100 허용 — 부등호 다름. dormant.)
- **카운팅은 look-through 안 함(자격판정과 반대):** §12(g) "held of record"는 **법인 = 1**(Rule 12g5-1(a)(2)). 자격판정(A-13/A-09)은 법인을 뚫어봄. 목적이 달라 방향 반대. 예외 = 회피목적 보유(12g5-1(b)(3)).
- **dedup:** 동일인 다중 지갑은 A-04로 1명 처리 후 집계.
- **갱신:** 신규 holder면 +1, 완전 처분 시 −1.
- **주의:** §12(g) 트리거는 실시간이 아니라 **회계연도 말 기준** → D-01의 거래별 게이트는 *등록위험 예방용 보수 장치*.
- **확인:** 실제 BUIDL이 **FPI(BVI 역외)**인지 → < 2,000 vs < 300 결정(OD-D01-3).

### (a)(2) person-group 합산 (C-08 물량 전용, 설계 난점)

> **⚠️ 정오 (2026-07-28).** 이 소절의 person-group 키는 **C-08(Rule 144(e) 물량 한도) 전용**이다. **D-01(보유자 수)에는 적용되지 않는다** — D-01의 카운팅 단위는 Rule 12g5-1의 held of record(명의 보유자, 법인 = 1)로 (a)(2) 가족·person-group 합산을 하지 않는다(위 D-01 bullet이 통제). 원문의 "C-08·D-01 공통"·"C-08·D-01은 그 그룹 단위로 누적"은 오기이며, 아래에서 C-08 한정으로 정정한다.

- Rule 144(a)(2): 매도 계산 주체 = 본인 + **동거 친족·배우자** + 그들이 합산 **10% 이상** 지분/수익권 가진 **신탁·법인**.
- → **C-08 상태 카운터의 키가 *지갑주소*가 아니라 *person-group***이어야 한다. person-group 식별은 **A-06(control)·A-04(신원)**가 하고, C-08은 그 그룹 단위로 매도 물량을 누적한다. (D-01은 이 소절 대상이 아니다 — 위 정오 참조.)

---

## 3. 결정 D-C — reject logging = off-chain (풍부한 이벤트 내용)

**결정.** 거절된 거래는 **off-chain에 기록**한다(온체인 강제 이벤트는 제재 hit 등 *고위험만* 선택적). revert가 온체인 이벤트를 롤백하므로, **off-chain indexer**가 거절 사유를 포착·저장한다. (사용자 판단과 일치.)

**근거.** 법률의견서 §3 — on-chain hash + off-chain **WORM 또는 audit-trail**(17a-4(f) 2022 개정)이 원칙적 허용. **SAR(FinCEN 의심거래보고)은 원래 off-chain 컴플라이언스 기능** → 막힌 의심거래도 off-chain 기록으로 SAR 생성 가능. 즉 off-chain 기록으로 SAR·감독 목적 **충분**.

**거절 이벤트 내용 (스펙 — 이걸 다 잡아야 함):**

| 필드 | 내용 |
|------|------|
| `timestamp`, `attemptTxRef` | 시도 시각·트랜잭션 참조 |
| `from`/`to`, `tokenIn`/`tokenOut`, `amount`, `direction` | 거래 파라미터 |
| `failedElement`, `reasonCode` | 어느 규칙에서·왜 막혔나 |
| `attestedFacts`, `reliedExemption` | 어느 attestation·어느 면제에 의지했나 |
| `riskTier` | 제재(OFAC) hit = 상 / 단순 부적격 = 하 |

**저장:** WORM 또는 recreate-capable audit-trail, producible(easily-readable). **risk-tier별 조치:** 제재 hit = 온체인 이벤트 + 즉시 알림 + SAR 후보 / 단순 부적격 = off-chain 기록만.

**확인:** BD/ATS 확정 시 **Reg ATS Rule 302가 "미체결 주문 기록"을 요구** → 그 경우 order record에 거절도 포함(법적 의무화). 그 전엔 best-practice.

---

## 4. 결정 D-D — out-of-router = 예방(발행측/venue) + 탐지(off-chain surveillance)

**결정.** router 밖 경로(직접 ERC-3643 transfer·직접 pool call 등)는 **두 층**으로 다룬다.

### ⭐ 핵심 구분 — 예방(prevent) vs 탐지(detect)

- **예방 = 온체인, 발행측/venue 담당.**
  - **BUIDL 등 whitelist 토큰은 Securitize가 *모든* transfer에서 whitelist를 강제** → 비화이트리스트 지갑으론 이동 불가(우회 **baseline이 이미 봉쇄**됨). (BUIDL 구조 확인: "contract itself rejects the transfer to non-whitelisted wallet".)
  - + **controlled venue**(§4(a)(7) 폐쇄 whitelist, 의견서 §4)로 거래를 venue에 제한하면 직접우회 자체가 원천봉쇄.
- **탐지 = off-chain, 우리 surveillance 모듈 담당.**
  - 우리 거래측 Recipe(Rule 144 물량 C-08·보유자수 D-01·감시 F-02/F-03)는 router 밖에선 *강제 못 함*. 대신 **off-chain surveillance 모듈이 그 토큰의 *chain-wide 모든 transfer*를 인덱싱·분석** → 우회·이상 패턴 탐지 → operator가 조치(suspend·SAR·발행자 통보).

**→ 사용자 (4) 질문 답:** **"온체인 분석을 off-chain 모듈로 처리"는 옳은 방향**이다 — 실제 시장감시(surveillance)가 정확히 그렇게 동작한다. **단 off-chain은 *탐지*이지 *예방*이 아님을 명확히 하라.** 예방은 반드시 온체인(발행측 module / whitelist / controlled venue)이어야 한다.

### element 분류 — token-level 필수 vs venue-level

| 분류 | 어디서 강제 | 해당 element |
|------|-----------|-------------|
| **token-level(모든 transfer 성립)** | 발행측 ERC-3643 module / whitelist | OFAC 제재(A-01)·verified/KYC(발행측 이미)·jurisdiction(A-02, CountryAllow) |
| **venue-level(거래소 맥락)** | router-only 강제 + **off-chain 탐지** | Rule 144 물량(C-08)·보유자수(D-01)·lockup(C-01)·감시(F-02/F-03) |

**발표 포인트.** "우리 거래측 강제는 router 경로 한정, baseline은 발행측(Securitize whitelist)이 chain-wide 강제, 나머지는 off-chain 탐지" = 7/8 회의의 *"중개 측에서 다 하려다 무거워졌다, 발행 측이 상위호환"*을 정확히 구조화한 것. **"직접 구현해봤기에 나온 구조적 인사이트"**로 서술.

---

## 5. 통합 아키텍처 — off-chain 컴플라이언스 데이터 레이어 (Layer 5)

4개 결정이 하나로 수렴한다:

```
[Securitize TA] --(①취득/attestation)--> [off-chain 컴플라이언스 데이터 레이어]
                                              ├─ ③ 성공거래 + 거절 기록 (WORM/audit-trail)
                                              ├─ ② stateful 상태 (C-08 물량=person-group 키 / D-01 보유자수=12g5-1 held-of-record 키 — 정오)
                                              ├─ ④ chain-wide transfer 감시 (out-of-router 탐지)
                                              └─ SAR/알림 생성, operator 대시보드
[온체인]  발행측 whitelist/module (예방·baseline) + our Router(venue 강제, 성공만 온체인)
```

= 볼트 4-Layer의 **Layer 5(off-chain Operator support)** + 발행측(Layer 0/외곽). 노트 16·의견서 §5와 정합.

---

## 6. 확인 필요 요약 (문의·결정 항목)

| # | 항목 | 담당/대상 | 막는 것 |
|---|------|----------|---------|
| Q1 | Securitize Connect API가 취득일+완납일+sourceType+배당 lineage 노출? | Securitize 문의 | D-A production |
| Q2 | 실제 BUIDL이 FPI(BVI)인가 → holder 상한 < 2,000 vs < 300 | 리걸 확인 | D-B |
| Q3 | BD/ATS 확정 시 Reg ATS 302 미체결 주문 기록 요구? | 의견서 §1 후속 | D-C 의무화 |
| Q4 | controlled-venue(폐쇄 whitelist) 채택? | 팀 결정 | D-D 예방층 |

## 7. Demo vs Production

- **Demo(Gasok):** 4개 전부 mock/off-chain 데모로 충분. 본 문서 = "정식 법률검토 완료, production 규격 확정"의 증빙(발표 엣지).
- **Production:** Securitize 통합(Q1) + off-chain surveillance·기록 레이어 구축 + controlled venue(Q4) + FPI/BD-ATS 확정(Q2·Q3).

---

## 변경 이력

- [2026-07-22] 초안. D004/D006/D009 열린 결정 4건을 정식 검토로 확정. 리서치: Rule 144(e) 물량(무거래→1%)·144(d)(3) tacking·§12(g)/§3(c)(7) holder count·Securitize DS Protocol/BUIDL whitelist 구조. 4건이 off-chain 데이터 레이어 + Securitize 어댑터로 수렴. 예방(온체인 발행측/venue) vs 탐지(off-chain surveillance) 구분 확립.
- [2026-07-28] **정오.** §2 D-B의 "(a)(2) person-group 키 = C-08·D-01 공통" 서술을 정정. D-01(§12(g) 보유자 수)의 카운팅 단위는 Rule 12g5-1 held of record(법인 = 1, person-group 합산 없음)이고, (a)(2) person-group 합산은 C-08(Rule 144(e) 물량) 전용이다. §2 D-B의 D-01 bullet(held of record)이 통제하며, 문서 내부 모순을 그 방향으로 정리. 최상단 정오 배너 + §0 표 ②·person-group 소절·§5 다이어그램에 정정 표기. 근거: D-01 spec sheet §4.
