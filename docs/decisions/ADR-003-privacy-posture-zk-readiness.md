# ADR-003 — Privacy Posture & ZK-Readiness Invariant

| 항목 | 값 |
|---|---|
| Status | **Accepted** (2026-06-17) |
| Decider | 규제 담당 단독 결정 (freeze-relevant 설계 결정 — 사용자 제기) |
| Channel | [G] GitHub (ADR) |
| Scope | freeze 설계 불변식 (지금 ZK 구현 X · 인터페이스만 잠금) |
| Related | 근거: `프라이버시-ZK-적용전략` / methodology §5.4 · §6.7 / 노트 35(규제수용 철학 — 검증↔프라이버시 축·ZK 다리) / ADR-001(F-04) · ADR-002(OD-CI-5) |
| Follow-up | 개발팀: Giwa ZK verifier·confidential tx 역량 확인 · 변호사: Q-Privacy-1 (신용정보법·개인정보법) |

> **첫 문장 요약.** ZK를 *지금 구현하지는 않는다.* 다만 나중에 ZK를 *부품을 깨지 않고* 끼울 수 있도록, freeze에 **설계 불변식 3개**를 박는다.

---

## 1. 배경 (Context)

프라이버시는 claim(신원·자격)에만 걸린 문제가 아니라 **DEX 전체**, 특히 **거래 그래프(포지션·상대방·수량)**에 걸린다 — 공개 원장이 이를 노출해 기관 참여를 막는 *privacy-transparency 딜레마*. 우리는 KYC로 *주소에 지속 신원*을 묶으므로 가명성 방어가 약하다.

핵심 제약 두 가지:
- **컨셉 보존**: 우리 컨셉은 "스마트컨트랙트를 통한 *온체인* 컴플라이언스". *"프라이버시 때문에 다 오프체인"은 컨셉 자폭*이다(온체인에 "믿어주세요"만 남음). **ZK는 컴플라이언스를 온체인에 유지하면서 데이터를 가리는 유일한 경로** — verifier가 ZK proof를 온체인 검증.
- **위협 모델**: T1 — 식별된 포지션을 공개·경쟁자로부터 은닉. T2 — 개인정보보호법·신용정보법(온체인 불변성 vs 삭제권/파기 → 개인·신용정보 온체인 평문 금지가 *법적 요건*).

단, ZK·shielded 기술은 RWA 맥락에서 *대부분 prototype(2026 기준)*이라 지금 구현은 과조기. 그래서 *짓지 말고 자리만 비워두는* 결정이 필요하다.

---

## 2. 결정 (Decision)

**지금 ZK를 구현하지 않는다. 대신 freeze에 아래 설계 불변식 3개를 박는다.**

1. **검증 인터페이스 추상화** — 부품(Element)은 credential을 `verify(증명) → 결과`로 검증하고, **평문 필드(basis enum 등)에 직접 의존하지 않는다.** → 현재 off-chain claim을 나중에 ZK proof로 *부품 수정 없이* swap 가능.
2. **개인·신용정보 on-chain 평문 금지** — 원본(자산명세·KYC서류·신용정보)은 off-chain, 온체인엔 hash/proof만. (개인정보보호법·신용정보법 정합 + 삭제권 충족 — 업계 표준 "hash + off-chain")
3. **거래 그래프·호가 경로(표면 ③④)를 confidential/shielded-ready로** — 수량·상대방을 *지금은 노출하더라도*, 나중에 confidential transactions·shielded pool을 끼울 자리를 데이터 경로에 비워둔다(지금 구현 X).

적용 우선순위(설계상): **② 자격 claim은 BBS+/selective-disclosure VC로 가장 쉽게 교체 가능(우선)** — 패턴 B가 VC 모델과 동형. **③ 거래 그래프는 무겁고 prototype이라 인터페이스만 ready(보수적).**

---

## 3. 고려한 옵션 (Options Considered)

| 옵션 | 내용 | 판정 |
|---|---|---|
| (i) 지금 ZK 전면 구현 | shielded pool 등 즉시 | ❌ 과조기 — RWA ZK는 대부분 prototype, 비용·리스크 큼 |
| (ii) 프라이버시 무시 (전부 공개) | 평문 그대로 freeze | ❌ T1(기관 기피)·T2(신용정보법·개인정보법 위반 소지) |
| (iii) 다 오프체인 | 컴플라이언스도 오프체인 | ❌ 컨셉 자폭(온체인 검증 상실) |
| **(iv) 불변식만 잠금 (채택)** | 지금 구현 X·ZK-ready 인터페이스만 freeze | ✅ 컨셉 유지 + ZK 길 확보 + privacy law 정합 |

---

## 4. 결과 (Consequences)

**긍정** — ① 온체인 컴플라이언스(컨셉) 유지. ② 나중에 ZK를 *부품 안 깨고* 끼울 수 있음. ③ 개인·신용정보 on-chain 금지로 privacy law 정합(현재 off-chain claim 설계와 이미 대체로 일치). ④ 지금 구현 부담 0(자리만 비움).

**부담/비용** — 인터페이스 추상화는 *설계 규율*을 요구(개발팀이 부품을 짤 때 평문 의존을 피해야). freeze 전 개발팀과 인터페이스 형태 합의 필요.

**따라오는 작업** — 개발팀: Giwa(EVM L2)에서 ZK verifier 가스·confidential tx 지원 확인. 시범: ②부터 selective-disclosure VC. 변호사: Q-Privacy-1.

---

## 5. 열린 질문 (Open Questions)

- **③ 거래 그래프 방향** — (a) 수용 / (b) confidential amounts 먼저 / (c) shielded pool. *지금은 열어두고 인터페이스만 ready* (개발팀 Giwa 역량 확인 후 결정). 보수적 default.
- **Giwa ZK 역량** — verifier 컨트랙트 가스 비용·confidential tx/precompile 지원·shielded pool 가능성 (개발팀 Q).
- **Q-Privacy-1 (변호사)** — 온체인 enum·주소-신원 바인딩이 신용정보법상 *개인신용정보*·개인정보보호법상 *개인정보*에 해당? 삭제권·파기의무 적용?

---

## 6. 검증 / 출처 (Verification)

- 근거 문서: `산출물/_core/프라이버시-ZK-적용전략.md` (기술 카탈로그 + 표면 매핑).
- 외부: W3C VC Data Integrity BBS(selective disclosure) · SoK of RWA Tokenization(privacy-transparency dilemma) · blockchain immutability vs right-to-erasure(hash+off-chain 표준 해법).
- 기술 성숙도: RWA 맥락 ZK/shielded는 대부분 prototype(2026.1 기준) → 지금 구현 X 정당화.

---

## 변경 로그

- **[2026-06-17] ADR-003 작성·Accepted.** Privacy posture & ZK-readiness — 사용자 제기(프라이버시가 DEX-wide·구현 중심 가능성). 지금 ZK 구현 X, freeze 불변식 3개 잠금(인터페이스 추상화·개인정보 on-chain 평문 금지·③④ shielded-ready). "다 오프체인=컨셉 자폭" 기각, ZK=온체인 컴플라이언스+프라이버시 화해 기술. 위협모델 T1(포지션 은닉)·T2(신용정보법·개인정보법). 근거: 프라이버시-ZK-적용전략 문서. freeze-blocking 5번째 항목(원 §4-가 4건 + 본건).
