# 📢 팀 공지 — Element Pool Freeze v1 (부품 목록 확정)

> **2026-06-17 · 규제(리걸/PM) 파트** · 상세 결정: `docs/decisions/ADR-001~004`

## 한 줄

**컴플라이언스 부품 목록(Element pool)을 v1으로 확정(freeze)했습니다.** 이제 *"어떤 부품을 쓸지"*가 잠겼고, **Phase 1(컴플라이언스 엔진 구현) 착수 게이트가 열렸습니다.**

## 무엇이 잠겼고, 무엇이 안 잠겼나

- **잠긴 것**: 부품 *목록* 자체 (어떤 Element가 있고 어느 Recipe에 붙는지). 추가·삭제·재분류는 이제 *거버넌스 절차(2-of-3 multisig·24h timelock)*를 거칩니다 — 임의 변경 금지.
- **안 잠긴 것**: 각 부품의 *내부 spec 정밀화*, Recipe orchestration, 운영(Operator)·Manifest 결정은 계속 진행됩니다. *"어떤 부품"은 잠갔지만 "어떻게 구현"은 열려 있습니다.*

## 청중별 — 나에게 무슨 의미인가

- **개발팀 👩‍💻**: 자재 명세서가 나왔습니다. **`docs/compliance/법률-기술 변환표 (Legal-to-Technical Matrix)`** — 법률요건 → 증거 → 부품 → 집행 지점 → 실패 코드/동작을 한 표에 정리. 이 표 + walkthrough 3종(A-13·A-03·A-06) + 방법론으로 **Phase 1 구현을 시작할 수 있습니다.** (착수 조건이던 Matrix 해소.)
- **법무/자문 ⚖️**: freeze를 연 결정 5건은 ADR-001~004 + F-05 stub. 남은 변호사 위임 질문(공모 유발·QP 경계·책임 분배·time-of-acquisition·privacy 등)은 위임 letter Section F·Q-Privacy-1로 진행 — *보수적 기본값으로 막아둬서 회신 전에도 구현은 진행됩니다.*
- **학회/팀 🎓**: Phase 0(기반) 이후 첫 큰 마일스톤. 다음은 데모(BUIDL)로 가는 길.

## 무엇이 freeze를 열었나 (5건)

| 결정 | 내용 | 기록 |
|---|---|---|
| F-04 추가 | Reg M 발행자측 매수 차단 부품 | ADR-001 |
| F-05 보류 | 공매도 부품 = spec-only stub | F-05 |
| OD-CI-5 독립 | 제재·관할·Reg M → 독립 Cross-Jurisdictional Recipe | ADR-002 |
| OD-CI-4 | 분류 문서·논증서 양식 보완 | (완료) |
| Privacy/ZK | ZK-readiness 불변식 3개(인터페이스 추상화·개인정보 on-chain 금지·shielded-ready) | ADR-003 |

## 다음

1. **개발팀**: Matrix로 Phase 1 착수 — 권장 우선 부품 walkthrough = A-09(look-through) → D-01(보유자수 카운터) → C-00(전매경로).
2. **다음 회의 안건(팀 결정 5건)**: 매수금지 명단 governance / 만료 자격자 배당 처리 / 긴급정지 multisig / 운영키 custody(15c3-3) / 의심거래 flag 처리 시한.
3. **추적 중인 설계 리스크(블로커 아님)**: L2/Giwa substrate(1순위)·업그레이드 거버넌스·MEV·oracle·composability·기업행위 — 등록부 §2.

*질문·이의는 이 문서 PR 코멘트 또는 Discussions로.*
