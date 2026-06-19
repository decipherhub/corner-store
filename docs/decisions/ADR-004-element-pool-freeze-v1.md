# ADR-004 — Element Pool Freeze v1 (부품 목록 동결)

| 항목 | 값 |
|---|---|
| Status | **Accepted** (2026-06-17) — 🧊 **FROZEN** |
| Decider | 규제 담당 단독 (쟁점 등록부 §4-가 freeze-blocking 결정 전부 완료) |
| Channel | [G] GitHub (ADR) |
| Scope | Element pool 동결 — Phase 1(컴플라이언스 엔진 구현) 진입 게이트 |
| Related | ADR-001(F-04)·ADR-002(OD-CI-5)·ADR-003(privacy)·OD-CI-4 / SoT: 노트 13(Element pool)·33 §2.5(Map)·31(실행플랜)·00(연대기) |
| Unfreeze | 추가·변경은 거버넌스(노트 06 update-process)를 통해서만 |

> **한 줄.** 부품 목록(Element pool)을 **확정(freeze)**한다. 이로써 "어떤 부품을 쓸지"가 잠겼고, 개발팀이 Phase 1을 *시작할 수 있는* 자재 명세서가 나왔다.

---

## 1. 배경 (Context)

노트 31 §4-가는 *"규제 담당 단독 결정 — 처리 즉시 '부품 목록 확정' 선언"*으로 정의했다. 그 freeze-blocking 결정들이 모두 닫혔으므로, Element pool을 동결할 수 있는 상태에 도달했다.

연대기(노트 00)가 명시한 대로, 이 freeze는 **Phase 0(완료) → Phase 1(컴플라이언스 엔진)** 으로 넘어가는 게이트다. 코드 쪽이 착수 조건으로 기다려 온 "부품 확정"의 절반이 여기서 닫힌다.

---

## 2. 결정 (Decision)

**Element pool을 v1으로 동결한다.**

- **동결 대상**: 노트 13(Element Pool list)·노트 33 §2.5(전체 Map)가 SoT인 부품 목록. 본 freeze는 그 pool에 **ADR-001로 F-04(Reg M 차단)를 추가**하고 **F-05(공매도)를 spec-only stub**으로 둔 상태를 v1으로 잠근다.
- **"동결"의 의미**: 부품 목록(parts list)이 *확정*됐다. 추가·삭제·재분류는 *임의로 하지 않고* **거버넌스(노트 06 update-process)를 통해서만** 한다.
- **동결되지 않는 것**: 각 부품의 *내부 spec 정밀화*, Recipe orchestration, Manifest·Operator 운영 결정(§4-나)은 계속 진행된다. freeze는 "*어떤 부품이 있나*"를 잠그는 것이지 "*각 부품을 어떻게 구현하나*"를 잠그는 게 아니다.

---

## 3. Freeze를 연 결정들 (Enabling Decisions)

| 결정 | 내용 | 기록 |
|---|---|---|
| F-04 추가 | Reg M 발행자측 매수 차단 부품 정식 추가 | **ADR-001** |
| F-05 보류 | 공매도 부품은 spec-only stub(코드 X) | F-05 stub |
| OD-CI-5 독립 | 제재·관할·Reg M을 독립 Cross-Jurisdictional Recipe로 | **ADR-002** |
| OD-CI-4 실행 | 분류 체계(노트 05 always-on)·논증서 양식(노트 12 운영의무 열) 패치 | 완료 |
| Privacy/ZK | ZK-readiness 불변식 3개(인터페이스 추상화·개인정보 on-chain 금지·shielded-ready) | **ADR-003** |

---

## 4. 결과 (Consequences)

**긍정 — Phase 1 진입 게이트가 열렸다.** 개발팀이 확정된 부품 목록으로 컴플라이언스 엔진 구현을 시작할 수 있다. Manifest·Operator는 이미 코드에 TokenPolicyRegistry·OperatorRegistry로 landed(다리 절반 놓임).

**⚠️ 중요 — freeze는 Phase 1의 *필요조건*이지 충분조건이 아니다.** 연대기 §6 기준, Phase 1을 *실제로* 여는 데는 freeze 외에 두 가지가 더 필요하다:
1. **Legal-to-Technical Matrix** — 개발팀이 착수 조건으로 기다리는 *핵심 미제출 산출물*. (← **freeze 직후 최우선**)
2. **시연 시나리오 7종** — 규제 담당 책임.

즉 *"부품 목록은 잠갔지만, 그 부품들을 법→증거→집행으로 잇는 변환표(Matrix)는 아직"*이다.

**부담** — 동결 후 추가가 필요하면 거버넌스 절차(노트 06)를 거쳐야 하므로, *지금 빠뜨린 부품*이 있으면 비용이 든다. → §5의 sweep으로 점검 완료.

---

## 5. 열린 질문 / 동결의 한계

- **설계 blind-spot sweep(06-17)**: privacy 외에 설계 영향 영역 6건(L2 substrate·업그레이드 거버넌스·MEV·oracle·composability·기업행위)을 전수 스캔 → **모두 *부품 목록을 바꾸지 않는* Phase-1 리스크**로 확인(freeze 무관). 등록부 §2에 추적 등록. **L2/Giwa substrate**는 deep-dive 1순위 권고(전용 분석 부재).
- **§4-나 팀 결정 5건**(매수금지명단 governance·만료자 배당·긴급정지 multisig·custody/15c3-3·flag SLA)은 다음 회의 안건 — Phase 1 *구현* 중 병행.
- **Unfreeze process**: 부품 추가·재분류는 노트 06 update-process(거버넌스 심사)를 통해서만.

---

## 6. 검증 / 출처

- 노트 31 §4-가(freeze-blocking 정의)·노트 00(Phase 게이트)·노트 13/33 §2.5(Element pool SoT)·노트 06(update-process).
- Enabling: ADR-001·002·003 + OD-CI-4 패치(노트 05·12).

---

## 변경 로그

- **[2026-06-17] ADR-004 — Element Pool Freeze v1 선언 (Accepted·FROZEN).** §4-가 freeze-blocking 결정 5건(F-04 추가/F-05 stub/OD-CI-5 독립/OD-CI-4 패치/Privacy ZK-ready) 완료 → 부품 목록 v1 동결. Phase 1 진입 게이트 open. ⚠️ 다음 최우선 = Legal-to-Technical Matrix(개발팀 대기 핵심 미제출). blind-spot sweep 6건은 부품 목록 불변 Phase-1 리스크로 추적(freeze 무관). unfreeze=노트 06.
