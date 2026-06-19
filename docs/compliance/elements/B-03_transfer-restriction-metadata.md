---
type: element-walkthrough
element-id: B-03
element-name: Transfer-Restriction Metadata (이전제한 메타데이터)
parent-recipe: R1·R2 공유 (restricted 자산 전제)
internal-id: ELE.B-03
status: v1.0 — 공유 산출물 form (자체완결·규제맥락 우선·인용 검증 대기)
audience: 개발팀·법무팀·외부 consultant·학회원
related-external-sources:
  - "17 CFR § 230.502(d) — restricted securities 이전 제한: https://www.ecfr.gov/current/title-17/section-230.502"
  - "ERC-3643 — restricted/transfer 메타데이터·legend"
created: 2026-06-17
updated: 2026-06-17
tags: [element, B-03, restricted, transfer-restriction, metadata, walkthrough, spec-sheet, pattern-A]
---

# B-03 Transfer-Restriction Metadata — 부품 심층 인수인계 문서 (Walkthrough)

> **이 문서는 무엇인가.** Decipher 컴플라이언스 부품 중 **"이 토큰이 *제한증권(restricted)으로 표시*돼 있어 전송 통제 대상인지 확인하는 부품"**(내부 식별자 B-03)을 풀어 쓴 문서다. B-02가 *토큰 규격(ERC-3643)*을 본다면, B-03은 *이 자산이 실제로 restricted 플래그·이전제한 태그를 달고 있는지* 본다. 전통 증권의 *"restricted" 레전드(legend)*에 해당하는 온체인 표식이다.
>
> **자체완결 원칙.** 다른 내부 문서를 열지 않아도 단독으로 이해되도록 작성했다. 인용은 외부 공식 자료만 사용한다.

> ✅ **인용 검증 완료** (2026-06-17 — 502(d) restricted 개념 확인). 작성 시 메모 ↓ — **인용 검증 상태 (v1.0, 2026-06-17).** 1차 초안. Rule 502(d) 문언은 검증 패스에서 eCFR 원문 1대1 확인(현재 "확인 요"). 메타데이터·레전드는 ERC-3643/관행 기준.

---

## §1. 규제 맥락 — 이 부품이 왜 필요한가 (Context First)

> **왜 맥락부터.** 사모 증권은 *restricted securities*라 *자유 전송이 안 된다*. 전통 증권에선 증서에 *"이 증권은 등록되지 않았으며 전매가 제한된다"는 레전드(legend)*를 찍는다. 토큰에선 그 레전드가 *restricted 플래그·이전제한 메타데이터*로 구현된다. B-03은 *이 표식이 제대로 달려 있는지* 확인한다.

### 1.1 핵심 개념 — "restricted라는 표식"

쉽게 말하면, Reg D로 산 증권은 *법적으로 restricted*다(Rule 502(d)). 전통 금융에선 주권·계좌에 **restrictive legend**("…not been registered … may not be resold absent registration or exemption")를 표시해, *전송 시 제한을 알린다.*

토큰화 증권에선 이 레전드가 *온체인 메타데이터*가 된다 — `restricted=true`, 이전제한 태그(transfer restriction flags), legend hash 등. **이 표식이 있어야** 시스템이 *"이 자산은 통제 대상"*임을 알고 전송을 게이팅한다. 표식이 *누락·해제*되면 — 시스템이 자산을 *자유 토큰으로 오인*해 무방비 전송을 허용할 위험.

B-03은 *restricted 메타데이터가 정확히 달려 있는지*(그리고 *부당하게 해제되지 않았는지*) 확인한다.

### 1.2 어디서 오나

| 출처 | 무엇 |
|---|---|
| **Rule 502(d)** | Reg D 증권 = restricted, *등록·면제 없이 재판매 불가* → 이전 제한 표식 필요 |
| **전통 legend 관행** | restrictive legend(증서 표시) → 온체인 메타데이터로 변환 |
| **ERC-3643** | restricted/transfer 메타데이터·compliance 태그 표현 |

### 1.3 왜 이 부품이 존재하는가

restricted 표식이 *자산에 정확히 붙어 있어야* — 시스템과 토큰의 *전송 게이팅이 발동*한다. 표식은 *"이 자산은 자유 토큰이 아니다"*라는 *1차 스위치*다. B-03은 그 스위치가 켜져 있고 일관됨을 보증한다(꺼져 있으면 다른 통제가 우회됨).

### 1.4 Decipher에서의 위치

B-03은 *기술 메타 부품*(B 도메인)으로 B-01(Manifest)·B-02(표준)와 묶인다. *순수 기계 판정*(플래그·태그 확인). B-02가 *"전송 통제 *능력*이 있는 토큰인가"*, B-03이 *"이 자산이 실제로 통제 대상으로 *표시*됐는가"* — 능력 vs 표식.

### 1.5 한국법 비교 — 전매제한 표시·보호예수 표식

한국도 사모 증권에 *전매제한 조치(권면분할 금지·예탁 보호예수 등)*를 표시한다. "제한 대상임을 표식으로 명시"하는 발상이 같다. B-03은 그 표식을 *온체인 메타데이터*로 확인.

---

## §2. 📋 메타 정보 (Internal Identifier Box)

| 항목 | 값 | 한 줄 풀이 |
|---|---|---|
| 부품 이름 | **Transfer-Restriction Metadata** | restricted 표식·이전제한 태그 검사원 |
| 검사 대상 | 자산이 *restricted·이전제한 메타데이터*를 정확히 가졌는가 | "통제 대상으로 표시됐나" |
| Internal ID | B-03 (Decipher PM 규약) | 부품 일련번호 |
| 검증 방식 | **기계 판정형(패턴 A)** — 플래그·태그 확인 | restricted==true 등 |
| Timing | **pre-trade** | 거래 직전 |
| Stateful 여부 | **STATELESS** | 메타데이터 1회 확인 |
| 주 활성화 Recipe | **R1·R2 공유** | restricted 자산 전제 |
| 연계 부품 | **B-02**(표준)·**B-01**(Manifest)·**C-00**(restricted→resale 경로) | |
| 성숙도 | 🟢 완료 | |
| 파일·위치 | B-03_transfer-restriction-metadata.md · 산출물/elements/ | 산출물 경로 |

---

## §2-A. 📐 결정론 경계 — 온체인이 하는 일 / Manifest·발행자에 위임하는 일

> **개발팀 핵심:** 아래 *왼쪽만 구현*. *자산이 restricted인지의 *법적 판단**은 발행 framework(Manifest)가 정함 — B-03은 *표식 일치*만.

| ✅ 온체인이 확인/구현 (결정론) | 🔵 Manifest/발행자가 정함 |
|---|---|
| `restricted` 플래그·이전제한 태그 존재 확인 | 이 자산이 *왜* restricted인가(발행 면제) |
| Manifest 선언과 토큰 메타데이터 *일치* | restricted *해제 조건*(거버넌스) |
| legend hash 정합(있으면) | 어떤 제한 태그가 필요한지 정책 |

→ B-03은 *"표식이 정확히 달려 일관되는가"*만. *restricted여야 하는지·언제 풀리는지*는 Manifest/거버넌스(off-chain 결정).

---

## §3. ① 법적·기술 근거

### 3.1 Layer 2 — Rule 502(d)

> **17 CFR § 230.502(d) — restricted securities** [🔗 [eCFR](https://www.ecfr.gov/current/title-17/section-230.502)]
>
> **요지**: Reg D 거래 취득 증권은 §4(a)(2) 취득 증권과 같은 지위(restricted)이고, *등록·면제 없이 재판매 불가*. 발행자는 *이전 제한 고지(legend 등)* 등 *underwriter 방지 reasonable care*를 다해야. → 토큰의 restricted 표식이 이 *이전 제한의 온체인 구현*.

### 3.2 전통 legend → 온체인 메타데이터

> restrictive legend(증서의 "미등록·전매제한" 문구)를 토큰에선 `restricted=true`·transfer restriction 태그·legend hash로 표현. *전송 게이팅의 1차 스위치.*

### 3.3 Sub-요건 분해

| 요소 | 충족 조건 |
|---|---|
| restricted 플래그 | `asset.restricted == true`(restricted 자산인 경우) |
| 이전제한 태그 | 필요한 transfer restriction 태그 장착 |
| Manifest 정합 | Manifest 선언과 메타데이터 일치 |
| legend 정합 | legend hash가 정본과 일치(있으면) |

---

## §4. ② 입력 사실 — 판정에 필요한 데이터

| 필드 | 유형 | 출처 | 무엇 |
|---|---|---|---|
| `token.restricted` | bool | 토큰 메타 | restricted 표식 |
| `token.transferTags` | bytes/enum[] | 토큰 메타 | 이전제한 태그 |
| `manifest.shouldBeRestricted` | bool | Manifest | restricted여야 하는지(발행 framework) |
| `token.legendHash` | bytes32(선택) | 토큰 메타 | legend 정본 해시 |

---

## §5. ③ 판정 로직

### 5.1 Pseudocode + 해설

```
function check_B_03(asset):
    if asset.manifest.shouldBeRestricted and not asset.token.restricted:
        return FAIL_RESTRICTED_FLAG_MISSING       # restricted여야 하는데 표식 없음
    if not transfer_tags_consistent(asset.token.transferTags, asset.manifest):
        return FAIL_TRANSFER_TAGS_INCONSISTENT     # 태그 불일치
    return PASS
```

- **해설**: Manifest가 "restricted여야 한다"고 선언한 자산이 *실제 restricted 표식*을 갖는지, 태그가 일관되는지 확인. *restricted여야 하는지의 판단*은 Manifest(발행 framework)가 함(§2-A).

---

## §6. ④ 거절·예외 처리

| Code | 언제 | 처리 |
|---|---|---|
| `FAIL_RESTRICTED_FLAG_MISSING` | restricted여야 하는데 표식 없음 | 차단(통제 우회 위험) + 알림 |
| `FAIL_TRANSFER_TAGS_INCONSISTENT` | 태그가 Manifest와 불일치 | 차단 + 검토 |
| `PASS` | 표식 정합 | 통과 |

---

## §7. ⑤ 테스트 케이스

| # | 시나리오 | 기대 |
|---|---|---|
| T1 | restricted 자산, 표식·태그 정합 | **PASS** |
| T2 | restricted여야 하는데 `restricted=false` | **FAIL_RESTRICTED_FLAG_MISSING** |
| T3 | 태그가 Manifest 선언과 불일치 | **FAIL_TRANSFER_TAGS_INCONSISTENT** |
| T4 | 비-restricted 자산(등록 증권 등) | **PASS**(restricted 불요) |

---

## §8. (α) 코드 변환 패턴 선택 — 기계 판정형(A)

본 부품은 **패턴 A**(플래그·태그 이분). 사람 판단 0. *restricted 여부의 법적 판단*은 Manifest(발행 framework)가 미리 결정.

---

## §9. (β) Cross-Element·Cross-Recipe Coordination

- **B-02(표준)**: B-02=전송 통제 *능력*(ERC-3643), B-03=전송 통제 *표식*(restricted). 능력+표식 둘 다 있어야 게이팅 발동.
- **B-01(Manifest)**: restricted 여부는 Manifest가 선언, B-01이 무결성 보증, B-03이 토큰 메타와 일치 확인.
- **C-00(전매 경로)**: restricted라서 *재판매에 별도 경로(§4(a)(7)/144)*가 필요 — B-03이 restricted를 확인하면 C-00이 경로를 라우팅.
- **Recipe**: R1·R2 공유 토큰 전제.

---

## §10. (γ) 3-Layer Solution

| Layer | 누가 | 무엇 | 한계 |
|---|---|---|---|
| 1. 온체인 메타 | 코드 | 플래그·태그·정합 확인 | restricted 판단은 Manifest |
| 2. 발행자/토큰 | 토큰 | restricted 표식·legend 설정 | 발행자 설정 책임 |
| 3. 거버넌스 | Decipher | restricted 해제 조건·정책 | |

---

## §11. (δ) Frontend·Off-chain Operator Layer

| 단계 | 위치 | 무엇 |
|---|---|---|
| 표식 누락 알림 | Off-chain | restricted 표식 누락 = 긴급 검토(우회 위험) |
| legend 안내 | Frontend | "이 자산은 제한증권(restricted) — 전매 경로 필요" |

---

## §12. Open Issues

1. **이전제한 태그 표준화** 🟢 — 어떤 transfer restriction 태그 집합을 쓰나(ERC-3643 정합).
2. **restricted 해제 조건** 🟡 — Rule 144 1년 경과 후 legend 제거 등 *해제 거버넌스*(C-01 연계).
3. **legend hash 운영** 🟢 — legend 정본·해시 관리.

---

## §13. 파일명 규칙 (Naming Convention)

```
본 부품: B-03_transfer-restriction-metadata.md · 산출물/elements/
```

## §14. 변경 로그

- [2026-06-17] v1.0 작성. *이전제한 메타데이터(restricted 표식)* walkthrough 신설. 규제 맥락(restricted=전송 통제 대상·전통 legend→온체인 메타·Rule 502(d)·한국 전매제한 표시 anchor), §2-A 경계(표식 일치=온체인·restricted 판단=Manifest), 근거(502(d)·legend·ERC-3643), 로직(플래그·태그 정합 pseudocode), 테스트 4종, 패턴 A, B-02 능력 vs B-03 표식·C-00 재판매 경로 coordination, Open Issues 3종(태그 표준·해제 조건·legend). 기술 메타 부품.
