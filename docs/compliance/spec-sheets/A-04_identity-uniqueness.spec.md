---
type: requirement-spec
project: RWA DEX (Giwa) · corner-store
element-id: A-04
element-name: Identity Uniqueness / Deduplication (신원 중복)
status: v1.0 (2026-07-22) — 보경 walkthrough 기반. Part II는 실장 컨트랙트(IdentityUniqueness.sol) 기준.
substance-sot: "보경 walkthrough — Element.A-04_신원-중복.md (2026-07-08). 레포 docs 교체 대상."
implements: "src/compliance/elements/IdentityUniqueness.sol (ELEMENT_ID A-04-v1)"
reflects-decisions: [ADR-002, ADR-004, ADR-006]
umbrella: "SPEC.md — 공유 개념(ERC-3643·ONCHAINID·Trusted Issuer·경계)은 여기에 의한다"
stateful: false
tags: [requirement-spec, A-04, identity-dedup, kyc, bsa, foundation]
---

# A-04 Identity Uniqueness — 요구사항 명세서

본 문서는 컴플라이언스 부품 A-04(신원 중복)의 요구사항 명세서이다. **제1부**는 법적 근거와 논증을, **제2부**는 실장 명세를 규정한다. 법적 실질은 보경 변호사가 검토·작성한 walkthrough에 의하며, 제2부는 레포에 실장된 컨트랙트 `IdentityUniqueness.sol`(A-04-v1)을 기준으로 한다. 시스템 공유 개념은 `SPEC.md`에 의한다.

본 부품은 지갑 뒤의 사람을 확정하고 같은 사람을 하나의 신원으로 유지하는 신원 기반층으로서, 다른 거의 모든 부품의 공통 전제가 된다.

---

# 제1부. 법적 근거 및 논증

## 1. 개요

A-04는 이 지갑 뒤에 있는 사람이 누구이고 그 사람이 시스템 안에서 단 하나의 신원으로만 존재하는지를 거래 직전에 확인하는 부품이다. 지갑은 익명의 키쌍일 뿐이며 법이 요건을 거는 단위는 언제나 사람이다. 한 사람이 지갑을 여러 개 만들어 별개의 사람인 것처럼 가장하면 보유자 수 상한(D-01), 물량 합산(C-08), 제재 스크리닝(A-01), 자격 검증(A-03·A-13) 등 거의 모든 검사가 동시에 무력화된다. 본 부품은 그 위장을 막는다.

## 2. 규범적 근거

"한 사람은 한 사람으로 센다"를 직접 명한 단일 조문은 없다. 대신 세 규범군이 수렴한다. 첫째, 요건의 단위가 사람임을 정하는 규범이다. Rule 506(c)의 모든 매수인 요건(17 C.F.R. § 230.506(c)(2)(i)), §4(a)(7)의 각 매수인 요건(15 U.S.C. § 77d(a)(7)·(d)(1)), Rule 144(a)(2)의 매도 계정 person 확장(17 C.F.R. § 230.144(a)(2)), §3(c)(7)의 배타적 소유(15 U.S.C. § 80a-3(c)(7)(A))가 모두 사람 단위이다. 둘째, 그 사람의 신원 확인을 명하는 은행비밀법 축이다. USA PATRIOT Act가 도입한 고객확인 프로그램의 제정법 위임(31 U.S.C. § 5318(l))과 그 실행규칙(31 C.F.R. § 1023.220)은 금융기관이 각 고객의 진짜 신원을 안다는 합리적 믿음을 형성하도록 요구하며, 법인 고객의 수익적 소유자 확인(31 C.F.R. § 1010.230)이 이를 보완한다. 셋째, 사람 단위를 쪼개는 행위를 막는 회피 방지 규범이다. 증권거래법 §12(g)(5)의 정의 위임과 그에 따른 Rule 12g5-1(a)(6)·(b)(3)은 동일인으로 인정되는 유사 명의를 1인으로 세고, 회피 목적의 보유 형태는 실소유자로 본다.

## 3. 쟁점별 논증

### 3.1 요건의 단위는 사람이다

검사의 단위가 지갑인지 사람인지가 문제된다. 위 규범군이 정하는 요건은 모두 사람을 단위로 한다. 따라서 검사의 대상 변수는 지갑이 아니라 사람이어야 하며, 그렇지 아니하면 요건 자체가 지갑 분산으로 잠탈된다.

### 3.2 신원 확인 의무의 주체

신원 확인 의무를 누가 지는지가 문제된다. 고객확인 프로그램 등 은행비밀법상 의무는 등록된 운영 주체(브로커·딜러 등)의 의무이지 스마트 컨트랙트의 의무가 아니다. 본 부품은 그 의무 이행이 산출한 확정 신원이라는 사실을 온체인에서 소비 가능한 형태로 유지하고 판정한다. 신원의 실체 확인은 off-chain에서 이루어지고, 본 부품은 그 결과를 결정론적으로 읽는다.

### 3.3 회피 방지 — 다지갑은 허용, 다신원은 금지

여러 지갑을 보유하는 것이 위법인지가 문제된다. 다지갑 자체는 위법이 아니며 운영 지갑과 콜드월렛의 분리는 정상 관행이다. 금지되는 것은 여러 지갑이 아니라 여러 신원이다. Rule 12g5-1(a)(6)은 동일인으로 인정되는 유사 명의를 1인으로 세고, (b)(3)은 회피 목적의 보유 형태를 실소유자로 본다. 따라서 본 부품의 규칙은 여러 지갑을 허용하되 모두 하나의 신원에 결속시키는 것이며, 하류 부품은 지갑이 아니라 신원 단위로 세고 합산한다.

### 3.4 두 방향의 위협

본 부품이 막는 위협의 방향이 문제된다. 하나는 위장 분산으로서, 한 사람이 여러 지갑을 별개 신원으로 등록하여 머릿수와 한도를 쪼개는 것이다. 이 경우 D-01의 보유자 수, C-08의 물량 합산, 매수인 수 산정, 자격 검증 회피가 깨진다. 다른 하나는 위장 차용으로서, 제재 대상자나 비적격자가 타인의 검증된 신원 뒤에 숨는 것이다. 이 경우 A-01의 제재 스크리닝과 자격 검증(A-03·A-13)이 무효가 된다. 두 방향 모두 지갑과 사람의 매핑을 검증 가능하게 하고 사람당 신원을 하나로 유지함으로써 막힌다.

### 3.5 하류 공급

본 부품이 다른 부품에 무엇을 공급하는지가 문제된다. 본 부품은 발행·재판매의 신원 게이트인 동시에, D-01의 카운팅 단위를 공급하는 강한 의존 대상이며, A-01의 스크리닝 대상 신원 속성과 F-01의 자기거래 탐지 기반을 공급한다. 본 부품이 무너지면 그 사람이 지나가는 모든 검사가 동시에 무너진다.

## 4. 확정 사항 및 잔여 쟁점

본 부품의 1인 1신원 구조와 세 규범군의 수렴은 위와 같이 확정되었다. 잔여로는 온보딩 dedup 스크리닝의 실무 기준, 법인 신원 그래프(A-08·A-09 연계)의 갱신 주기, 그리고 다지갑을 하나의 신원에 결속하는 완전한 다지갑 모델의 구현이 있다(현재 컨트랙트는 1:1로 단순화).

---

# 제2부. 구현 명세 (컨트랙트 `IdentityUniqueness.sol` 기준)

## 5. 시스템 내 위치

| 항목 | 값 (컨트랙트 메타) |
|---|---|
| ELEMENT_ID | `A-04-v1` |
| 분류 | 투자자 속성(INVESTOR_ATTRIBUTE) |
| 검증 패턴 | 기계 판정형 · DETERMINISTIC (온보딩 실사는 off-chain, 런타임은 레지스트리 조회) |
| 판정 시점 | 거래 전 검증(EX_ANTE_VERIFY) · ONE_TIME |
| 상태 | STATELESS (check는 레지스트리 스냅샷을 읽음) |
| 활성 | R1·R2 필수. D-01(강한 의존)·A-01·F-01에 기반 데이터 공급. |
| 의존 부품 | A-11(claim 현행성, 규율 인라인) · A-08·A-09(법인 신원 그래프) · A-12(red-flag) |

## 6. 인터페이스

```solidity
// 판정 (view). user = 당사자
function check(address user, address counterparty, address, uint256, bytes)
    external view returns (bool passed, bytes32 reasonCode);

// 운영자 설정 (onlyOperator, Governed)
function bindIdentity(address wallet, bytes32 identityId) external;   // 1:1 결속(불변식은 여기서)
function unbindIdentity(address wallet) external;
function setKycClaim(bytes32 identityId, KycClaim claim) external;    // 신원 단위 KYC claim
function setIdentityStatus(bytes32 identityId, IdentityStatus status) external; // FROZEN/REVOKED
function setDedupStatus(bytes32 identityId, DedupStatus status) external;       // SUSPECTED/CONFIRMED_DUPLICATE
function setEnforceCounterparty(bool enabled) external;               // 상대방 게이트(opt-in)
```

## 7. 상태 및 구성

- `identityOf[wallet]` · `walletOf[identity]` — 지갑↔신원 1:1 매핑. 유일성 불변식은 `bindIdentity`에 있다(같은 쌍 재결속은 no-op, 다른 값 결속은 거절).
- 신원 단위 상태(지갑이 아니라 신원 id로 키잉): `kycClaimOf`(존재·서명·발급자·검증시각·최대연령) · `identityStatusOf`(ACTIVE/FROZEN/REVOKED) · `dedupStatusOf`(UNIQUE/SUSPECTED_DUPLICATE/CONFIRMED_DUPLICATE).
- `enforceCounterparty`(기본 false) — AMM 풀 매도인은 신원 결속이 없어, 켜면 상대방에게도 동일 파이프라인을 적용한다.

## 8. 기능 요구사항

- **REQ-A04-1 (1:1 불변식).** 결속은 지갑과 신원을 양방향 1:1로 유지하여야 한다. 같은 쌍의 재결속은 멱등이며, 어느 한쪽을 다른 값에 결속하려는 시도는 거절한다.
- **REQ-A04-2 (판정 순서).** 시스템은 미결속(1) → KYC claim 없음(2) → 서명(3) → 발급자 신뢰(4) → 현행성(5, 엄격 `>`) → FROZEN(6) → REVOKED(7) → 확정 중복(8) → 의심 중복(9)의 순서로 판정하여야 한다.
- **REQ-A04-3 (신원 단위 상태).** KYC claim·상태·중복 상태는 지갑이 아니라 신원 단위로 키잉하여, 같은 신원에 결속된 모든 지갑이 하나의 claim을 공유하여야 한다.
- **REQ-A04-4 (현행성 규율).** claim 현행성은 엄격 `>`로 판정하며(A-11 규율 인라인), 최대연령에 정확히 도달한 경우는 통과한다. 최대연령 0은 무만료이다.
- **REQ-A04-5 (상대방 게이트).** `enforceCounterparty`가 켜진 경우 상대방에게도 동일 파이프라인을 적용한다.
- **REQ-A04-6 (하류 공급).** 확정된 신원은 D-01의 카운팅 단위와 A-01·F-01의 기반 데이터로 공급된다.

## 9. reasonCode

컨트랙트는 `ReasonCodes.encode(recipeId, "A-04-v1", n)`으로 인코딩하며, `n`은 walkthrough §6.2와 일치한다.

| n | Code | 발생 조건 |
|---|---|---|
| 1 | `IDENTITY_NOT_REGISTERED` | 지갑 미결속 |
| 2 | `KYC_CLAIM_MISSING` | KYC claim 없음 |
| 3 | `KYC_CLAIM_INVALID_SIG` | 서명 무효 |
| 4 | `UNTRUSTED_KYC_ISSUER` | 발급자 미신뢰 |
| 5 | `KYC_CLAIM_EXPIRED` | 현행성 초과(엄격 `>`) |
| 6 | `IDENTITY_FROZEN` | 신원 동결 |
| 7 | `IDENTITY_REVOKED` | 신원 취소 |
| 8 | `DUPLICATE_IDENTITY` | 확정 중복 |
| 9 | `REVIEW_IDENTITY_DUPLICATE_SUSPECTED` | 의심 중복(심사) |

중복의 확정(8)과 의심(9)은 코드 번호로만 구별되며, 인터페이스에 별도 심사 결과가 없어 `passed`는 둘 다 거짓이다.

## 10. Legacy·Opt-in 경계 (현재 구현)

`bindIdentity`는 신원을 처음 결속할 때 완전히 유효한 KYC claim(존재·서명·발급자 신뢰·검증시각 현재·무만료)을 seed하여, 결속된 지갑이 추가 호출 없이 통과하도록 한다. 이후 운영자가 `setKycClaim`으로 커스터마이즈한 claim은 재결속으로 덮어쓰지 아니한다. 상대방 게이트는 기본 꺼짐이다(풀 매도인 무결속). 다지갑 모델(walkthrough §7.3)은 본 구현에서 1:1로 단순화되어 있다.

## 11. 불변식

1. 지갑↔신원은 양방향 1:1이다.
2. 신원 단위 상태는 지갑이 아니라 신원에 귀속되며 재결속을 넘어 유지된다.
3. 여러 지갑은 허용되나 여러 신원은 금지된다(같은 사람 = 하나의 신원).
4. 신원의 실체 확인은 off-chain에서 이루어지고 본 부품은 결과를 읽는다.

## 12. 의존성

```
Trusted Issuer(온보딩 CIP/KYC) → 확정 신원·KYC claim → A-04
A-11(현행성) → claim 최대연령 규율(인라인)
A-08·A-09 → 법인 신원 그래프
A-04(확정 신원) → D-01(카운팅 단위) · A-01(스크리닝 속성) · F-01(자기거래 탐지)
```

## 13. 인수 기준

| # | 시나리오 | 기대 결과 |
|---|---|---|
| 1 | 미결속 지갑 | IDENTITY_NOT_REGISTERED(1) |
| 2 | KYC claim 없음 | KYC_CLAIM_MISSING(2) |
| 3 | 서명 무효 | KYC_CLAIM_INVALID_SIG(3) |
| 4 | 발급자 미신뢰 | UNTRUSTED_KYC_ISSUER(4) |
| 5 | 현행성 초과 | KYC_CLAIM_EXPIRED(5) |
| 6 | 동결 신원 | IDENTITY_FROZEN(6) |
| 7 | 취소 신원 | IDENTITY_REVOKED(7) |
| 8 | 확정 중복 | DUPLICATE_IDENTITY(8) |
| 9 | 의심 중복 | REVIEW_IDENTITY_DUPLICATE_SUSPECTED(9) |
| 10 | 같은 신원 두 번째 지갑 결속 시도(다른 값) | bindIdentity revert(불변식) |
| 11 | 유효 결속·claim | PASS |

## 14. Demo 및 Production 범위

| 구분 | Demo (현재) | Production |
|---|---|---|
| 신원 데이터 | 운영자 `bindIdentity`·`setKycClaim` | ONCHAINID·Trusted Issuer CIP/KYC |
| dedup | 운영자 `setDedupStatus`(off-chain 스크리닝) | 온보딩 중복 스크리닝 파이프 |
| 다지갑 | 1:1 단순화 | 신원당 다지갑 결속 |
| 상대방 | 기본 꺼짐(풀 매도인) | 양자·RFQ venue 시 켜짐 |

## 15. 잔여 확정 항목

1. 다지갑 모델(신원당 복수 지갑) 구현(현재 1:1).
2. 온보딩 dedup 스크리닝 실무 기준.
3. 법인 신원 그래프(A-08·A-09)와 CDD 수익적 소유자 연계.
4. 상대방 게이트의 상시화(현재 opt-in).

---

# 부록. 출처 및 연혁

## A. 절별 출처

| 절 | 성격 | 출처 |
|---|---|---|
| 제1~3절 (법적 근거·논증) | 파생 | 보경 walkthrough §1·§3 |
| 제5~13절 (구현) | 실장 | `IdentityUniqueness.sol` (A-04-v1) |
| 제10절 (legacy·opt-in) | 실장 | `IdentityUniqueness.sol` 주석 |

## B. 근거 문헌

- 원 출처(substance): 보경 walkthrough `Element.A-04_신원-중복.md` (2026-07-08) — 레포 `docs/compliance/elements/` 교체 대상.
- 구현: `src/compliance/elements/IdentityUniqueness.sol`
- 결정: `ADR-002`(횡단) · `ADR-004` · `ADR-006`
- 공유 개념: `SPEC.md` 제1·2절
- 1차 출처: 17 C.F.R. § 230.506(c)(2)(i)·(ii)·§ 230.501(e)·§ 230.144(a)(2) · 15 U.S.C. § 77d(a)(7)·(d)(1)·§ 80a-3(c)(7)(A)·§ 78l(g)(5) · 31 U.S.C. § 5318(l) · 31 C.F.R. § 1023.220·§ 1010.230·§ 240.12g5-1(a)(6)·(b)(3)

## C. 변경 로그

- [2026-07-22] v1.0 — 보경 검토본 기반. 제1부: 세 규범군(요건단위=사람 506(c)/§4(a)(7)/144(a)(2)/§3(c)(7) · BSA CIP §5318(l)/1023.220 true identity · 회피방지 12g5-1(a)(6)/(b)(3))·두 위협모델(위장분산·위장차용)·다지갑 허용/다신원 금지·하류 공급(D-01 hard dependency). 제2부: 실장 `IdentityUniqueness.sol`(1:1 binding 불변식·신원단위 상태·KycClaim·Identity/Dedup enum·check pipeline·REQ-A04-1~6·9 reason code·legacy seed·opt-in 상대방). A-04는 보경 기반 실구현이라 제2부는 현행 계약.
