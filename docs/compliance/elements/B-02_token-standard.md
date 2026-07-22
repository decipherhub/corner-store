---
type: element-walkthrough
element-id: B-02
element-name: Token Standard (ERC-3643 적합성)
parent-recipe: R1·R2 공유 (토큰 기술 전제)
internal-id: ELE.B-02
status: v1.0 — 공유 산출물 form (자체완결·규제맥락 우선·인용 검증 대기)
audience: 개발팀·법무팀·외부 consultant·학회원
related-external-sources:
  - "ERC-3643 (T-REX) — 허가형 토큰 표준(ONCHAINID·Compliance·Identity Registry)"
  - "(법적 배경) Rule 502(d) restricted securities 이전 제한 — 토큰이 이를 강제해야"
created: 2026-06-17
updated: 2026-06-17
tags: [element, B-02, erc-3643, token-standard, walkthrough, spec-sheet, pattern-A]
---

# B-02 Token Standard — 부품 심층 인수인계 문서 (Walkthrough)

> **이 문서는 무엇인가.** Decipher 컴플라이언스 부품 중 **"이 토큰이 *허가형 증권 토큰 표준(ERC-3643)*을 따르는지 확인하는 부품"**(내부 식별자 B-02)을 풀어 쓴 문서다. 증권형 토큰은 *아무 ERC-20*이 아니라 *전송 자체를 컴플라이언스로 통제할 수 있는 표준*이어야 한다. B-02는 그 *기술 전제*를 확인한다.
>
> **자체완결 원칙.** 다른 내부 문서를 열지 않아도 단독으로 이해되도록 작성했다. 인용은 외부 공식 자료만 사용한다.

> ✅ **인용 검증 완료** (2026-06-17 — 토큰 표준 부품, 502(d) 개념·ERC-3643 확인). 작성 시 메모 ↓ — **인용 검증 상태 (v1.0, 2026-06-17).** B-02는 *토큰 표준 적합성*(기술) 부품이라 법령 인용보다 *표준 명세(ERC-3643)* 중심. 법적 연결은 "restricted securities 이전 제한을 토큰이 강제해야 한다"(Rule 502(d))로 다룬다.

---

## §1. 규제 맥락 — 이 부품이 왜 필요한가 (Context First)

> **왜 맥락부터.** 증권형 토큰은 *전송이 자유로운 일반 토큰(ERC-20)*이면 안 된다. 사모 증권은 *restricted*라 *전송 자체가 제한*돼야 하는데, 그러려면 토큰이 *컴플라이언스 모듈·신원 레지스트리를 내장한 허가형 표준*이어야 한다. B-02는 그 표준 적합성을 확인한다.

### 1.1 핵심 개념 — "전송을 통제할 수 있는 토큰이어야 한다"

쉽게 말하면, 일반 ERC-20은 *누구나 누구에게나* 보낼 수 있다. 그런데 사모 증권(BUIDL 등)은 *restricted securities*라 — 자격 없는 사람·제재 대상·미허가 관할로 *전송 자체가 막혀야* 한다. 이를 토큰 *레벨에서 강제*하려면 **ERC-3643(T-REX)** 같은 *허가형(permissioned) 표준*이 필요하다. ERC-3643은:
- **Identity Registry**(ONCHAINID) — 보유 자격 있는 신원만 등록,
- **Compliance 모듈** — 전송 규칙(국가·자격·한도) 강제,
- **transfer 시 자격 검증** — 부적격 전송을 토큰이 *거부*.

B-02는 *이 토큰이 그런 표준을 구현했는지*(인터페이스·모듈 존재)를 확인한다. 표준을 안 따르는 토큰은 *전송 통제가 불가능*해 증권형으로 쓸 수 없다.

### 1.2 어디서 오나 — 표준 + 법적 연결

| 출처 | 무엇 |
|---|---|
| **ERC-3643 (T-REX)** | 허가형 증권 토큰 표준(Identity Registry·Compliance·transfer 검증) |
| **Rule 502(d)** | restricted securities는 *이전이 제한*돼야 — 토큰이 이를 강제할 기술 전제 |

### 1.3 왜 이 부품이 존재하는가 (법적 의미)

*전송 제한이 토큰에 내장*돼야 — 사후 차단이 아니라 *원천적으로* 부적격 이전을 막을 수 있다. ERC-3643은 그 표준이고, B-02는 *DEX가 다루는 자산이 그 표준을 만족*함을 보증한다. (회의 2026-06-17: ERC-3643은 이미 *eligibility/accredited 모듈·Identity Registry(6 필드)*를 갖고 *발행 규제 중심*. B-02는 그 표준 적합성을 확인해, 우리 부품이 토큰 모듈과 *coordination*할 수 있게 한다.)

### 1.4 Decipher에서의 위치

B-02는 *기술 전제* 부품이다(B-01과 함께 B 도메인 = 자산·기술 메타). 자격 부품(A군)이 *사람*을, B-02는 *토큰 자체의 규격*을 본다. **순수 기계 판정**(인터페이스 확인). ERC-3643의 token-level 자격 검사와 우리 DEX market-level 검사는 *defense-in-depth*(중복 아닌 독립 검증) — 보경 변호사 A-03 §3.12(6)도 이를 명시.

### 1.5 한국법 비교 — 증권형 토큰 규격

한국도 *토큰증권(STO)* 규율에서 *분산원장 요건·이전 통제·발행 등록*을 논한다. "증권형 토큰은 통제 가능한 규격이어야 한다"는 발상이 ERC-3643과 통한다. B-02는 그 규격 적합성을 *온체인 인터페이스 검증*으로 구현한다.

---

## §2. 📋 메타 정보 (Internal Identifier Box)

| 항목 | 값 | 한 줄 풀이 |
|---|---|---|
| 부품 이름 | **Token Standard (ERC-3643)** | 허가형 증권 토큰 표준 적합성 검사원 |
| 검사 대상 | 토큰이 *ERC-3643(T-REX)* 표준을 구현했는가 | "전송 통제 가능한 토큰인가" |
| Internal ID | B-02 (Decipher PM 규약) | 부품 일련번호 |
| 검증 방식 | **기계 판정형(패턴 A)** — 인터페이스·모듈 확인 | supportsInterface 등 |
| Timing | **pre-trade** | 거래 직전 |
| Stateful 여부 | **STATELESS** | 토큰 규격 1회 확인 |
| 주 활성화 Recipe | **R1·R2 공유** | 토큰 기술 전제 |
| 연계 부품 | **B-03**(이전제한 메타)·**B-01**(Manifest)·**A-03/A-13**(token-level과 defense-in-depth) | |
| 성숙도 | 🟢 완료(확인만) | |
| 파일·위치 | B-02_token-standard.md · 산출물/elements/ | 산출물 경로 |

---

## §2-A. 📐 결정론 경계 — 온체인이 하는 일 / 표준·발행자에 위임하는 일

> **개발팀 핵심:** 아래 *왼쪽만 구현*. 토큰이 *실제로 컴플라이언스를 옳게 강제하는지*는 토큰(발행자) 책임 — B-02는 *표준 구현 여부*만.

| ✅ 온체인이 확인/구현 (결정론) | 🔵 토큰/발행자가 책임 |
|---|---|
| ERC-3643 인터페이스 구현 확인(supportsInterface) | 토큰의 *실제 컴플라이언스 로직 정확성* |
| Identity Registry·Compliance 모듈 *존재* 확인 | 모듈 *내부 규칙 설정*(누가 자격) |
| 필수 함수(transfer 검증) 존재 | (발행자가 모듈을 어떻게 구성) |

→ B-02는 *"표준을 구현했는가"*만 본다. *그 표준이 옳게 동작하는지·모듈에 무엇을 넣었는지*는 토큰/발행자(+우리 부품의 독립 검증).

---

## §3. ① 법적·기술 근거

### 3.1 표준 근거 — ERC-3643 (T-REX)

> **ERC-3643 (T-REX)** — 허가형 증권 토큰 표준. 핵심 구성: **Identity Registry**(ONCHAINID 기반 적격 신원 등록)·**Compliance**(전송 규칙 모듈)·**Token**(transfer 시 자격 검증·강제). → 부적격 전송을 *토큰이 거부*. B-02는 이 구성요소 구현을 확인.

### 3.2 법적 연결 — Rule 502(d) (restricted)

> **17 CFR § 230.502(d)** — Reg D 증권은 *restricted securities*라 *등록·면제 없이 재판매 불가*. 즉 *이전이 제한*돼야 한다. → 토큰이 *이 제한을 기술적으로 강제*하려면 ERC-3643 같은 허가형 표준이 필요. B-02가 그 전제를 확인.

### 3.3 Sub-요건 분해

| 요소 | 충족 조건 |
|---|---|
| 표준 인터페이스 | ERC-3643 인터페이스 구현(supportsInterface) |
| Identity Registry | 적격 신원 등록 모듈 존재 |
| Compliance 모듈 | 전송 규칙 강제 모듈 존재 |
| transfer 검증 | 전송 시 자격 확인 함수 존재 |

---

## §4. ② 입력 사실 — 판정에 필요한 데이터

| 필드 | 유형 | 출처 | 무엇 |
|---|---|---|---|
| `token.interfaceIds` | bytes4[] | 토큰 컨트랙트 | 구현 인터페이스(ERC-3643) |
| `token.identityRegistry` | address | 토큰 | Identity Registry 모듈 주소 |
| `token.compliance` | address | 토큰 | Compliance 모듈 주소 |
| `manifest.requiredStandard` | enum | Manifest | 요구 표준(ERC-3643) |

---

## §5. ③ 판정 로직

### 5.1 Pseudocode + 해설

```
function check_B_02(asset):
    t = asset.token
    if not t.supportsInterface(ERC3643_INTERFACE_ID):
        return FAIL_TOKEN_STANDARD_UNSUPPORTED
    if t.identityRegistry == address(0) or t.compliance == address(0):
        return FAIL_TOKEN_MODULES_MISSING        # 핵심 모듈 미장착
    return PASS
```

- **해설**: 순수 인터페이스·모듈 존재 확인. *모듈이 옳게 설정됐는지*는 안 본다(발행자·우리 독립 검증). 가장 단순한 기계 판정.

---

## §6. ④ 거절·예외 처리

| Code | 언제 | 처리 |
|---|---|---|
| `FAIL_TOKEN_STANDARD_UNSUPPORTED` | ERC-3643 미구현 | 거래 차단(증권형으로 부적합) |
| `FAIL_TOKEN_MODULES_MISSING` | Identity/Compliance 모듈 없음 | 차단 |
| `PASS` | 표준 적합 | 통과 |

---

## §7. ⑤ 테스트 케이스

| # | 시나리오 | 기대 |
|---|---|---|
| T1 | ERC-3643 완전 구현 | **PASS** |
| T2 | 일반 ERC-20(허가형 아님) | **FAIL_TOKEN_STANDARD_UNSUPPORTED** |
| T3 | ERC-3643이나 Compliance 모듈 미장착 | **FAIL_TOKEN_MODULES_MISSING** |
| T4 | Identity Registry 주소 0 | **FAIL_TOKEN_MODULES_MISSING** |

---

## §8. (α) 코드 변환 패턴 선택 — 기계 판정형(A)

본 부품은 **패턴 A**(인터페이스 이분). 사람 판단 0. *모듈 내부 설정의 옳음*만 B-02 밖(발행자·우리 독립 검증).

---

## §9. (β) Cross-Element·Cross-Recipe Coordination

- **B-03(이전제한 메타)**: B-02가 *표준 구현*을, B-03이 *restricted 플래그·태그*를 — 함께 토큰 기술 전제.
- **A-03/A-13(defense-in-depth)**: ERC-3643은 token-level 자격(transfer eligibility)을 보고, A-03/A-13은 DEX market-level 자격을 본다. *중복이 아니라 독립 검증*(토큰 모듈을 그냥 신뢰하지 않음) — 보경 변호사 A-03 §3.12(6).
- **Recipe**: R1·R2 공유 토큰 전제.

---

## §10. (γ) 3-Layer Solution

| Layer | 누가 | 무엇 | 한계 |
|---|---|---|---|
| 1. 온체인 인터페이스 | 코드 | 표준·모듈 존재 확인 | 모듈 내부 설정 옳음은 밖 |
| 2. 발행자/토큰 | 토큰 컨트랙트 | 컴플라이언스 모듈 구성·강제 | 발행자 설정 책임 |
| 3. 독립 검증 | Decipher 부품 | A-03/A-13 등 market-level 재검증 | defense-in-depth |

---

## §11. (δ) Frontend·Off-chain Operator Layer

| 단계 | 위치 | 무엇 |
|---|---|---|
| 표준 미적합 안내 | Frontend | "이 토큰은 허가형 표준 미적합 — 거래 불가" |
| 토큰 온보딩 검토 | Off-chain | 신규 자산 리스팅 시 ERC-3643 적합성 사전 확인 |

---

## §12. Open Issues

1. **ERC-3643 버전·확장** 🟢 — T-REX 버전·필수 모듈 집합 확정.
2. **token-level vs market-level 역할 경계** 🟡 — ERC-3643 모듈이 보는 것과 우리 부품이 보는 것의 중복/분담 명확화(defense-in-depth 범위).
3. **Securitize DS Protocol → ERC-3643 가정** 🟡 — 실제 BUIDL은 DS Protocol. "ERC-3643 재구성 가정" 위 설계(보경 변호사 A-03 §3.12).

---

## §13. 파일명 규칙 (Naming Convention)

```
본 부품: B-02_token-standard.md · 산출물/elements/
```

## §14. 변경 로그

- [2026-06-17] v1.0 작성. *ERC-3643 토큰 표준 적합성* walkthrough 신설. 규제 맥락(증권형은 전송 통제 가능한 허가형이어야·ERC-3643 구성·Rule 502(d) 연결·한국 STO anchor), §2-A 경계(표준 구현=온체인·모듈 내부 옳음=발행자), 근거(ERC-3643·502(d)), 로직(인터페이스·모듈 pseudocode), 테스트 4종, 패턴 A, B-03·A-03/A-13 defense-in-depth coordination, Open Issues 3종. 기술 표준 부품(법령 인용 적음).
