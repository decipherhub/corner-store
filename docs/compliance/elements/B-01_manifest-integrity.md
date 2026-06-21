---
type: element-walkthrough
element-id: B-01
element-name: Manifest Integrity (자산 규제 명세 정합)
parent-recipe: 전 Recipe 공유 (R1·R2·R3·R-XJ) — 모든 거래의 신뢰 기반
internal-id: ELE.B-01
status: v1.0 — 공유 산출물 form (자체완결·규제맥락 우선·인용 검증 대기)
audience: 개발팀·법무팀·외부 consultant·학회원
related-external-sources:
  - "(아키텍처) Manifest = 자산 규제 명세(TokenPolicyRegistry) — Decipher 4-Layer 모델"
created: 2026-06-17
updated: 2026-06-17
tags: [element, B-01, manifest, integrity, walkthrough, spec-sheet, shared, pattern-A]
---

# B-01 Manifest Integrity — 부품 심층 인수인계 문서 (Walkthrough)

> **이 문서는 무엇인가.** Decipher 컴플라이언스 부품 중 **"자산의 규제 명세(Manifest, =신상카드)가 *진짜이고 변조되지 않았는지* 확인하는 부품"**(내부 식별자 B-01)을 풀어 쓴 문서다. 다른 모든 부품은 *Manifest가 선언한 사실*(어느 면제·어느 Recipe·어느 한도)을 *믿고* 작동한다. B-01은 **그 Manifest 자체가 신뢰할 수 있는지**를 확인하는 *기반 부품*이다 — 다른 검사들이 *올바른 설정 위에서* 돌게 하는 토대.
>
> **자체완결 원칙.** 다른 내부 문서를 열지 않아도 단독으로 이해되도록 작성했다. 인용은 외부 공식 자료만 사용한다. (단 B-01은 *특정 조문*보다 *시스템 무결성*에 관한 부품이라, 법적 근거는 "왜 설정이 진짜여야 하는가"의 맥락으로 다룬다.)

> ✅ **인용 검증 완료** (2026-06-17 — 기술 무결성 부품, 법령 인용 소수·개념 확인). 작성 시 메모 ↓ — **인용 검증 상태 (v1.0, 2026-06-17).** B-01은 *기술 무결성 검사*라 법령 인용이 적다(다른 부품 대비). 아키텍처 정의(Manifest=TokenPolicyRegistry)는 Decipher 설계 기준.

---

## §1. 규제 맥락 — 이 부품이 왜 필요한가 (Context First)

> **왜 맥락부터.** B-01은 *법조문을 직접 검사하는 부품이 아니다.* 대신 *"다른 모든 법조문 검사가 *믿고 쓰는 설정*이 진짜인가"*를 본다. 비유하면 — 모든 검사원이 보는 *자산의 신상카드*가 위조되지 않았는지 확인하는 *신원증명 검사*다.

### 1.1 핵심 개념 — "검사들이 믿고 쓰는 설정의 진위"

Decipher의 4-Layer 모델에서 **Manifest(자산 규제 명세 / 신상카드)**는 *각 자산이 어떤 규제 묶음(Recipe)을 적용받고, 어떤 사실(발행 면제·허용 관할·한도)을 갖는지*를 선언하는 *자산별 설정*이다(TokenPolicyRegistry). 예: *"BUIDL = Reg D 506(c) + §3(c)(7), 허용 관할 [...], 보유자 한도 2000, resaleFramework=§4(a)(7)"*.

문제: **다른 모든 부품은 이 Manifest를 *그대로 믿고* 작동한다.** A-13은 "이 자산이 §3(c)(7) 펀드"라는 Manifest 선언을 믿고 QP를 보고, D-01은 Manifest의 "한도 2000"을 믿고 센다. 만약 *Manifest가 변조*되면(예: "한도 2000"을 "20000"으로) — *모든 하위 검사가 잘못된 전제 위에서* 돌아 *전부 무력화*된다.

**B-01의 일은 그 Manifest가 *변조되지 않고, 커밋된 정본과 일치*하는지 확인**하는 것이다. *모든 거래의 신뢰 기반*이라 *전 Recipe에 붙는다*.

### 1.2 왜 이 부품이 존재하는가 (법적 의미)

직접 조문은 없지만, 법적 의미는 명확하다 — **컴플라이언스 시스템의 *완전성(integrity)*은 그 설정이 진짜일 때만 성립**한다. 변조된 설정으로 통과시킨 거래는 *법적으로 무방비*다. 즉 B-01은 *반사기(anti-fraud)·시스템 신뢰성*의 토대이고, *"우리 검사가 신뢰할 만하다"*는 주장의 전제다. (트랜잭션 영수증이 곧 법률검토 문서가 되려면, 그 검토가 *진짜 설정* 위에서 이뤄져야 한다.)

### 1.3 Decipher에서의 위치 — 모든 검사의 토대

B-01은 *모든 Recipe에 attached*되는 *공유 기반 부품*이다(A-01·A-02처럼 횡단적이되, 성격은 *기술 무결성*). 다른 부품이 *내용*을 본다면 B-01은 *그 내용이 담긴 그릇의 진위*를 본다. **순수 기계 판정(해시 비교)**이라 가장 결정론적이다.

### 1.4 한국법 비교 — 등록원부·공시서류 정합성

한국에서도 *주주명부·등록원부·공시서류*의 *정합성·위변조 방지*가 시장 신뢰의 토대다. "기록이 진짜여야 그 위의 모든 판단이 유효하다"는 발상이 같다. B-01은 그 정합성을 *온체인 해시 검증*으로 구현한다.

---

## §2. 📋 메타 정보 (Internal Identifier Box)

| 항목 | 값 | 한 줄 풀이 |
|---|---|---|
| 부품 이름 | **Manifest Integrity** | 자산 규제 명세 무결성 검사원 |
| 검사 대상 | Manifest가 *커밋된 정본과 일치·미변조*인가 | "이 신상카드가 진짜인가" |
| Internal ID | B-01 (Decipher PM 규약) | 부품 일련번호 |
| 검증 방식 | **기계 판정형(패턴 A)** — 해시·서명 비교 | 가장 결정론적 |
| Timing | **pre-trade** | 거래 직전(모든 검사 전) |
| Stateful 여부 | **STATELESS** | 현재 Manifest vs 정본 해시 |
| 주 활성화 Recipe | **전 Recipe 공유**(R1·R2·R3·R-XJ) | 모든 거래의 신뢰 기반 |
| 연계 부품 | **모든 부품**(이들이 B-01이 보증한 Manifest를 신뢰) | |
| 성숙도 | 🟢 완료(재정의 done) | |
| 파일·위치 | B-01_manifest-integrity.md · 산출물/elements/ | 산출물 경로 |

---

## §2-A. 📐 결정론 경계 — 온체인이 하는 일 / 거버넌스에 위임하는 일

> **개발팀 핵심:** B-01은 *거의 전부 온체인 결정론*(해시 비교). 오른쪽은 *Manifest 내용 자체를 정하는* 일(거버넌스)로, B-01의 범위 밖.

| ✅ 온체인이 확인/구현 (결정론) | 🔵 거버넌스/오프체인이 정함 |
|---|---|
| Manifest 해시 == 커밋된 정본 해시 | Manifest *내용*(어느 Recipe·한도·면제) 결정 |
| 거버넌스 서명·승인 무결성(변경 권한) | 변경 *승인 절차*(2-of-3 multisig·timelock) |
| 필드 일관성(facts ↔ 활성 Recipe) | 어떤 변경이 *적법한지* 판단 |

→ B-01은 *"그릇이 진짜인가"*만 본다. *그릇에 무엇을 담을지*는 거버넌스(off-chain 결정)가 정하고, B-01은 그 결정의 *무결성*만 검증.

---

## §3. ① 법적·설계 근거

### 3.1 설계 근거 (Layer — 아키텍처)

> **Manifest = 자산별 규제 명세(TokenPolicyRegistry)** — Decipher 4-Layer: Element(검사) → Recipe(규제 묶음) → **Manifest(자산 신상카드)** → Operator(운영). Manifest는 *"이 자산에 어떤 Recipe·사실·한도가 적용되는가"*를 선언. 모든 부품이 이를 입력으로 신뢰.

### 3.2 무결성 메커니즘

- **해시 커밋**: Manifest의 정본 해시를 *거버넌스가 커밋*하고, B-01은 현재 Manifest가 그 해시와 일치하는지 확인.
- **변경 거버넌스**: Manifest·Element 변경은 *2-of-3 multisig + 24h timelock*(ADR-004 freeze 거버넌스)로만. B-01은 *승인된 변경*인지(서명) 확인.
- **필드 일관성**: facts(예: issuanceFramework=RegD506c)와 활성 Recipe(R1)가 *서로 모순 없는지*.

### 3.3 법적 의미 (간접)

직접 조문은 없으나 — *반사기(§10(b))·시스템 신뢰성*의 토대. 변조 설정으로 통과시킨 거래는 *컴플라이언스 주장의 근거를 잃는다*. B-01은 *"우리 검사가 진짜 설정 위에서 돌았다"*를 보증.

---

## §4. ② 입력 사실 — 판정에 필요한 데이터

| 필드 | 유형 | 출처 | 무엇 |
|---|---|---|---|
| `manifest.hash` | bytes32 | 온체인 현재 Manifest | 현재 설정의 해시 |
| `manifest.committedHash` | bytes32 | 거버넌스 커밋 | 정본 해시 |
| `manifest.govSignature` | bytes | 거버넌스 multisig | 변경 승인 서명 |
| `manifest.facts` / `activeRecipes` | struct | Manifest | 일관성 검사 대상 |
| `manifest.version` | uint | Manifest | 버전(timelock 정합) |

---

## §5. ③ 판정 로직

### 5.1 Pseudocode + 해설

```
function check_B_01(asset):
    m = asset.manifest
    if keccak(m.facts, m.activeRecipes, m.version) != m.committedHash:
        return FAIL_MANIFEST_TAMPERED            # 해시 불일치 = 변조
    if not gov_verify(m.govSignature, m.committedHash):
        return FAIL_MANIFEST_UNAUTHORIZED         # 거버넌스 미승인 변경
    if not facts_consistent(m.facts, m.activeRecipes):
        return FAIL_MANIFEST_INCONSISTENT         # facts ↔ Recipe 모순
    return PASS
```

- **해설**: 순수 해시·서명·일관성 검사. *내용의 옳고 그름*은 안 본다(그건 거버넌스) — *그릇이 진짜이고 일관되는지*만. 가장 결정론적인 부품.

---

## §6. ④ 거절·예외 처리

| Code | 언제 | 처리 |
|---|---|---|
| `FAIL_MANIFEST_TAMPERED` | 해시 불일치 | 거래 차단 + 긴급 알림(변조 = 심각) |
| `FAIL_MANIFEST_UNAUTHORIZED` | 거버넌스 미승인 변경 | 차단 + 알림 |
| `FAIL_MANIFEST_INCONSISTENT` | facts↔Recipe 모순 | 차단 + 설정 검토 |
| `PASS` | 정합 | 통과(다른 부품이 이 Manifest 신뢰) |

해설: B-01 실패는 *시스템 무결성 사고*라 다른 실패보다 *심각도가 높다*(긴급 알림). 자산 전체 거래 정지로 이어질 수 있음.

---

## §7. ⑤ 테스트 케이스

| # | 시나리오 | 기대 |
|---|---|---|
| T1 | Manifest 해시 == 정본 | **PASS** |
| T2 | Manifest 변조(해시 불일치) | **FAIL_MANIFEST_TAMPERED** |
| T3 | 거버넌스 서명 없는 변경 | **FAIL_MANIFEST_UNAUTHORIZED** |
| T4 | facts=RegD506c인데 활성 Recipe에 R1 없음 | **FAIL_MANIFEST_INCONSISTENT** |
| T5 | timelock 미경과 버전 | **FAIL**(거버넌스 정합) |

---

## §8. (α) 코드 변환 패턴 선택 — 기계 판정형(A), 가장 순수

본 부품은 **패턴 A 중 가장 순수**하다 — 해시·서명·집합 일관성은 *완전히 결정론*이고 사람 판단이 0이다. (Manifest *내용*을 정하는 거버넌스만 off-chain.) 그래서 B-01은 *비결정성 캡슐화*가 필요 없는 드문 부품이다.

---

## §9. (β) Cross-Element·Cross-Recipe Coordination

- **모든 부품의 토대**: A-13은 Manifest의 "§3(c)(7)" 선언을, D-01은 "한도 2000"을, C-00은 "resaleFramework"를, A-02는 "allowedJurisdictions"를 *믿고* 쓴다. B-01이 그 신뢰를 *보증*한다.
- **거버넌스(ADR-004)**: Manifest 변경은 2-of-3 multisig+24h timelock. B-01은 *승인된 변경*만 통과.
- **Recipe**: 전 Recipe 공유(R1·R2·R3·R-XJ) — 모든 거래에서 *가장 먼저* 돈다(다른 검사의 전제).

---

## §10. (γ) 3-Layer Solution

| Layer | 누가 | 무엇 | 한계 |
|---|---|---|---|
| 1. 온체인 해시 | 코드 | 해시·서명·일관성 검증 | 내용 옳음은 거버넌스 |
| 2. 거버넌스 | multisig 보유자 | Manifest 내용 결정·승인 | 거버넌스 키 보안 |
| 3. 운영 감사 | Decipher | 변조 알림·정본 관리 | |

---

## §11. (δ) Frontend·Off-chain Operator Layer

| 단계 | 위치 | 무엇 |
|---|---|---|
| 변조 알림 | Off-chain(운영) | 해시 불일치 = 긴급 경보·자산 정지 |
| 거버넌스 변경 | Off-chain | multisig 승인 + timelock 후 커밋 |
| 정본 관리 | Off-chain | Manifest 버전·정본 해시 보관 |

---

## §12. Open Issues

1. **facts↔Recipe 일관성 규칙** 🟡 — 어떤 조합이 "모순"인지(예: RegD506c인데 R1 미부착) 규칙 목록화.
2. **거버넌스 키·timelock 운영** 🟢 — ADR-004 거버넌스와 정합(2-of-3·24h).
3. **버전·롤백 처리** 🟢 — Manifest 버전 전환·롤백 시 무결성.

---

## §13. 파일명 규칙 (Naming Convention)

```
본 부품: B-01_manifest-integrity.md · 산출물/elements/
```

## §14. 변경 로그

- [2026-06-17] v1.0 작성. *자산 규제 명세(Manifest) 무결성* walkthrough 신설. 규제 맥락(모든 검사가 믿는 설정의 진위·변조 시 전체 무력화·반사기 토대·한국 등록원부 정합 anchor), §2-A 경계(해시 검증=온체인·내용 결정=거버넌스), 무결성 메커니즘(해시 커밋·multisig+timelock·필드 일관성), 로직(해시·서명·일관성 pseudocode), 테스트 5종, 패턴 A 최순수, 전 Recipe 토대·ADR-004 거버넌스 coordination, Open Issues 3종. 법령 인용 적음(기술 무결성 부품). 가장 결정론적 — 비결정성 캡슐화 불요.
