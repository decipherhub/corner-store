# ADR-006 — 자산 일반성(Asset-Agnostic) 불변식: Element·Recipe는 BUIDL에 의존하지 않는다

- **상태:** Accepted (2026-06-17)
- **결정자:** 승준(리걸/PM)
- **유형:** 설계 불변식(freeze-level — ADR-003·004와 동급)
- **연계:** note 33 §2.7 · 보경 변호사 A-03 §3.12(D) · Manifest(TokenPolicyRegistry)

## 1. 배경

BUIDL을 *데모·테스트 자산*으로 쓴다. 그러나 Element·Recipe가 *BUIDL에 의존*(특정 값·구조를 코드에 박음)하면 — Decipher가 *BUIDL 전용 시스템*이 되어, **SDK·범용 표준이라는 핵심 가치가 깨진다.** 우리 목표는 *어떤 RWA 자산에도 적용되는 준법 표준*이다.

## 2. 결정

**Element·Recipe는 *자산 무관(asset-agnostic) 범용 컴포넌트*다. 자산별 사실은 *Manifest에만* 산다. BUIDL은 (a) 그 값들을 선언한 *테스트 인스턴스*이고, (b) 문서의 *예시*일 뿐 — 로직에 박히지 않는다.**

### 불변식 3개

1. **자산별 값은 Manifest 입력으로만** — 면제 framework·허용 관할·보유자 한도·전매 경로·보고 여부·허용 엔진·restricted 여부 등은 *모두 `Manifest.*`에서 읽는다.* element/recipe 코드에 *상수로 하드코딩 금지.* (법령 상수 — 예: QP $5M(ICA §2(a)(51)) — 은 *자산 무관*이라 예외적으로 코드 상수 허용.)
2. **Element·Recipe 로직은 자산 무관** — 동일 코드가 *어떤 506(c)/§3(c)(7) 자산*에도 동작해야 한다. 자산 분기는 *Manifest 값에 의한 분기*이지 *자산 ID 분기*가 아니다.
3. **문서의 "BUIDL 적용"은 *예시*** — walkthrough §1 맥락·§10 적용의 BUIDL 언급은 *이해용 예시*이지 *구현 명세*가 아니다. 구현은 *Manifest 입력*만 본다.

## 3. 검증 (감사 — 2026-06-17)

| 자산별 값 | 부품 | 출처 | 하드코딩? |
|---|---|---|---|
| 면제 framework | R1/R3 activation·A-03·A-13 | `Manifest.issuanceFramework` | ✗ (Manifest) |
| 허용 관할 | A-02 | `Manifest.allowedJurisdictions` | ✗ |
| 전매 경로 | C-00 | `Manifest.resaleFramework` | ✗ |
| 보유자 한도(2000/100) | D-01 | `Manifest.holderCap` | ✗ |
| 보고/비보고(6m/1y) | C-01 | `Manifest.issuerReporting` | ✗ |
| 허용 엔진 | B-04 | `Manifest.supportedEngines` | ✗ |
| restricted 여부 | B-03 | `Manifest.shouldBeRestricted` | ✗ |
| 자격 임계($5M·$25M QP) | A-13 | *법령 상수*(ICA §2(a)(51)) | (자산 무관 상수) |
| Trusted Issuer 명부 | A-03·A-13 등 | `TrustedIssuerRegistry`(시스템) | ✗ |

→ **현 설계상 element/recipe 로직에 BUIDL 의존 *0*.** 모든 자산별 값이 Manifest(또는 자산 무관 법령 상수)에서 온다.

## 4. 결과

- 새 자산(Ondo·다른 506(c)/§3(c)(7) RWA) 온보딩 = *Manifest 한 장 작성*으로 끝(코드 변경 불요) → SDK 가치 실현.
- 개발팀: element/recipe 컨트랙트는 *Manifest를 인자로 받는 순수 함수*로 구현(자산 ID 하드코딩 금지).
- 문서: 향후 walkthrough/Recipe의 BUIDL 언급은 *예시*임을 유지(로직 명세와 분리).

## 5. 열린 질문 / 후속

- **코드 리뷰 체크리스트**: 구현 단계에서 "자산 ID·BUIDL 값 하드코딩 없음"을 PR 체크 항목으로.
- **Manifest 스키마 확정**: 위 자산별 값들을 담는 Manifest 필드 정의(B-01과 연계).

## 변경 이력
- [2026-06-17] 작성(사용자 우려: "element/recipe가 BUIDL에 dependency 있으면 안 됨 — 범용 component여야"). 감사 결과 *현 설계 하드코딩 0* 확인 + 불변식 3개 못 박음.
