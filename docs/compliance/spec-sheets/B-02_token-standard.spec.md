---
type: requirement-spec
project: RWA DEX (Giwa) · corner-store
element-id: B-02
element-name: Token Standard Conformance (토큰 표준)
status: v0.1 (2026-07-22) — 2부 구성. Part II는 실장 컨트랙트(Erc3643Native.sol) 기준.
substance-sot: "보경 walkthrough — Element.B-02_토큰-표준.md (2026-07-08). 레포 docs 교체 대상."
implements: "src/compliance/elements/Erc3643Native.sol (ELEMENT_ID B-02-v1, 커밋 'upgrade B-02 erc3643 native to conformance probe spec')"
reflects-decisions: [ADR-004, ADR-006]
umbrella: "SPEC.md — 공유 개념(ERC-3643·Element/Recipe/Manifest·Trusted Issuer·경계)은 여기에 의한다"
stateful: false
tags: [requirement-spec, B-02, token-standard, erc-3643, R1, R2]
---

# B-02 Token Standard Conformance — 요구사항 명세서

본 문서는 컴플라이언스 부품 B-02(토큰 표준)의 요구사항 명세서이다. **제1부**는 본 부품이 지키는 규율의 법적 근거와 그 도출 과정을, **제2부**는 이를 구현한 명세를 규정한다. 법적 실질은 보경 변호사가 검토·작성한 walkthrough에 의하며, 제2부는 레포에 실장된 컨트랙트 `Erc3643Native.sol`(B-02-v1)을 기준으로 한다. 시스템 공유 개념은 `SPEC.md`에 의한다.

본 부품은 매수인의 자격을 판정하지 아니한다. 본 부품이 보는 것은 사람이 아니라 기계, 즉 거래 대상 토큰이 진정한 ERC-3643 표준 컨트랙트이고 등록된 대로 배선되어 있으며 지금 이 이전을 허용하는 상태인지를 확인한다.

---

# 제1부. 법적 근거 및 논증

## 1. 개요

B-02는 거래 대상 토큰이 진정한 ERC-3643(T-REX) 표준 기계이고, 그 구성요소(Identity Registry·Compliance 바인딩·구현체)가 상장 시점에 등록된 대로 유지되어 있으며, 현재 이 이전을 허용하는 작동 상태인지를 거래 직전에 확인하는 부품이다. Decipher의 거래 측 검사는 발행 측이 이미 수행하는 검증을 재수행하지 아니하고 신뢰·위임하는데(설계 원칙 G2), 그 위임이 법적으로 안전하려면 위임 대상 기계가 진짜이고 그대로이며 살아 있어야 한다. 본 부품은 그 전제를 매 거래 확인한다.

## 2. 규범적 근거

미국 사모 시장은 등록 없이 발행된 제한증권의 유통을 세 가지 실물 도구로 통제해 왔다. 증서 문면의 제한 문구(legend), 명의개서 정지 지시(stop transfer), 그리고 이를 집행하는 명의개서대리인(transfer agent)이다. Regulation D Rule 502(d)는 이 실무를 규칙으로 끌어올려, Reg D로 취득한 증권은 등록 또는 면제 없이 재판매될 수 없으며 발행인은 매수인이 인수인이 되지 아니하도록 상당한 주의를 다하여야 하고 그 주의는 증서 또는 증권을 표창하는 그 밖의 문서에 legend를 부착함으로써 증명될 수 있다고 규정한다(17 C.F.R. § 230.502(d)). 동 조는 이 방법이 배타적이지 아니하며 다른 조치도 상당한 주의를 충족할 수 있다고 명시한다.

ERC-3643은 이 세 도구를 코드로 옮긴 표준이다. 증서 legend는 이전 함수에 내장된 조건으로, stop transfer는 `canTransfer`·`isVerified`의 실패(revert)로, 명의개서대리인의 명부는 Identity Registry로 각 대응한다. 이전 조건을 코드로 강제하여 위반 재판매가 성립 자체를 불가능하게 하는 구조는, 읽히기를 기다리는 종이 legend보다 구조적으로 강한 "다른 조치"에 해당한다. 한편 제한증권의 지위는 후속 취득자에게 승계되므로(17 C.F.R. § 230.144(a)(3)), 이 기계는 발행 직후만이 아니라 증권의 전 수명 동안 유지되어야 한다. 그리고 면제를 주장하는 자가 그 성립을 입증하여야 하므로(SEC v. Ralston Purina Co., 346 U.S. 119 (1953)), 기계의 확인과 그 확인 이력의 보존이 요구된다. 통제 없는 재판매는 §5의 미등록 매도(15 U.S.C. § 77e)와 인수인 책임(15 U.S.C. § 77b(a)(11))으로 직행하므로, 확인이 불가능한 경우의 안전 방향은 차단(fail-closed)이다.

## 3. 쟁점별 논증

### 3.1 검사 대상은 사람이 아니라 기계

B-02가 무엇을 판정하는지가 문제된다. 매수인·매도인의 자격 실체는 다른 부품이 본다. 적격투자자는 A-03이, 적격구매자는 A-13이, 지갑과 신원의 바인딩은 A-04가 판정한다. B-02가 확인하는 것은 그러한 판정을 집행하는 기계, 즉 legend에 대응하는 이전제한 기계가 존재하고 진짜이며 켜져 있는지이다. B-02의 마지막 단계인 위임 프로브가 결과적으로 수신자 검증을 스치더라도, 이는 발행 측 기계에게 그 기계 자신의 답을 미리 물어보는 것이지 자격을 재판정하는 것이 아니다.

### 3.2 위임의 세 전제

발행 측 검증을 재수행하지 아니하는 위임이 어떤 조건에서 안전한지가 문제된다. 첫째, 표준성이다. 위임 대상이 실제로 그 표준이어야 한다. 표준을 자칭하나 검증 함수를 항상 참으로 반환하는 껍데기라면 모든 위임이 허공을 향한다. 둘째, 배선 불변이다. 상장 시점에 검증한 기계가 거래 시점에도 같은 기계여야 한다. 소유자가 구성요소 바인딩을 교체하거나 프록시 구현체를 업그레이드할 수 있기 때문이다. 셋째, 작동 상태이다. 기계가 지금 살아서 이 이전을 허용하여야 한다. 토큰이 정지되었거나 지갑이 동결되었거나 자유 잔액이 부족하거나 발행 측 규칙이 이 이전을 거부하면 다른 부품이 모두 통과하여도 체결은 토큰에서 반려된다. 본 부품은 이 세 전제를 확인한다.

### 3.3 배선 불변을 매 거래 확인하는 이유

배선을 상장 시점에 한 번 확인하는 것으로 충분한지가 문제된다. 상장 후 구성요소가 무제한 통과 모듈로 조용히 교체되면 상장 심사의 모든 결론이 소급하여 무효가 된다. 나아가 입증책임의 구조상, 교체된 기계 위에 쌓인 통과 기록은 증명 자산이 아니라 체계적으로 잘못 운영되었다는 반대 증거가 된다. 그러므로 배선의 등록값 대조는 상장 시점에 한 번이 아니라 매 거래 수행되어야 하며, 그 불일치는 단순 실패가 아니라 보안 사건에 준하여 다룬다.

### 3.4 위임 프로브

발행 측 기계에게 그 기계 자신의 판정 함수를 미리 묻는 것이 자격 재판정이 아닌지가 문제된다. 위임 프로브는 발행 측이 이전 순간에 수행할 검증(수신자 신원 검증·규칙 모듈 통과)을 체결 전에 정적으로 미리 실행하여, 체결 시점의 반려를 검사 시점에 앞당겨 아는 것이다. 판정의 주체와 기준은 발행 측 기계이며 Decipher는 그 답을 소비할 뿐이므로, 이는 재판정이 아니라 위임의 확인이다.

### 3.5 발행 형태 — 네이티브 발행과 wrapper의 구별

어떤 토큰이든 위임 대상이 될 수 있는지가 문제된다. 토큰화는 증권의 성질을 바꾸지 아니한다. 발행인 명의로 네이티브 발행된 토큰이라면 그 토큰이 곧 증권이나, 제3자가 보관 증권을 감싼 wrapper 토큰이라면 그 토큰은 원 증권과 별개의 증권(증권에 대한 수취증)일 수 있어 법률 분석 전체가 달라진다. 그러므로 본 Recipe 구성에서는 네이티브 발행(NATIVE_ISSUER)임을 상장 심사에서 확인하고, 그러하지 아니하면 상장을 거절한다.

### 3.6 표준 준수와 규칙 내용의 적법성은 다르다

B-02가 발행 측 규칙의 적법성까지 보는지가 문제된다. B-02가 확인하는 것은 기계의 형식과 상태, 즉 표준 인터페이스·배선·작동이며, 발행자가 그 기계에 등록한 규칙값(국가 제한값·보유 한도값 등)의 실체적 적법성이 아니다. 규칙 내용의 적법성은 발행자의 책임 영역이며(설계 원칙 G5), Decipher는 상장 심사에서 카드 선언과의 정합, 즉 요구 모듈의 존재·바인딩까지만 본다.

## 4. 확정 사항 및 잔여 쟁점

기계 확인의 구조(상장 심사 + 매 거래 게이트)는 위와 같이 확정되었다. 다만 유의할 점이 있다. ERC-3643 표준 문언상 mint와 forcedTransfer는 수신자 신원 검증만 요구하고 규칙 모듈을 우회하며, burn은 자격 검사 전부를 우회한다. 상시 발행 펀드는 신규 보유자가 mint로 유입되므로, 보유자 수 상한 같은 모듈이 발행 경로에서 강제되는지는 구현에 의존한다. 따라서 표준만을 근거로 부품 D-01의 온체인 강제가 발행 경로까지 덮는다고 가정하여서는 아니 되며, 이는 상장 심사의 행위 검증 항목으로 확인한다.

---

# 제2부. 구현 명세 (컨트랙트 `Erc3643Native.sol` 기준)

## 5. 시스템 내 위치

| 항목 | 값 (컨트랙트 메타) |
|---|---|
| ELEMENT_ID | `B-02-v1` |
| 분류 | 자산 속성(ASSET_ATTRIBUTE) |
| 검증 패턴 | 기계 판정형 — 정적 배선 대조 + 결정론적 위임 프로브 |
| 판정 시점 | 거래 전 관문(AT_TRADE_GATE) · ONE_TIME |
| 상태 | STATELESS · DETERMINISTIC |
| 활성 | R1(발행)·R2(재판매) 필수 부착. 모든 토큰 이동이 R1 또는 R2를 경유하므로 사실상 전 거래 커버. |
| 의존 관계 | B-01(카드 무결성, 직전 실행) · B-03(제한 선언) · B-04(엔진) · A-03/A-13/A-04(자격, 별개) |

`user`는 매수인(수신자, to), `counterparty`는 매도인(원천, from)이다.

## 6. 두 레짐

컨트랙트는 자산별로 두 레짐을 둔다.

- **선언 전용(기본).** 운영자 증명 `erc3643Native[asset]`이 상장 심사 게이트 ①을 대리한다. 증명된 자산에 배선이 등록되지 아니한 경우 선언만으로 통과한다. 증명되지 아니한 자산은 fail-closed로 차단한다(코드 1).
- **라이브 배선(자산별 opt-in).** `registerWiring`으로 구성요소 주소와 구현체 codehash를 봉인하면 `check`가 실제 토큰에 대하여 게이트 ②~⑤를 view staticcall로 수행한다. `clearWiring`은 선언 전용으로 되돌린다.

## 7. 인터페이스

```solidity
// 판정 (view). user=매수인(to), counterparty=매도인(from)
function check(address user, address counterparty, address asset, uint256 amount, bytes)
    external view returns (bool passed, bytes32 reasonCode);

// 운영자 설정 (onlyOperator, Governed)
function setErc3643Native(address asset, bool native_) external;                    // 선언 게이트 ①
function registerWiring(address asset, address identityRegistry_, address compliance_, bytes32 implCodehash) external; // 배선 봉인 → 게이트 ②~⑤
function clearWiring(address asset) external;                                       // 선언 전용 복귀
```

프로브 대상 표준 표면: `identityRegistry()·compliance()·paused()·isFrozen()·getFrozenTokens()·balanceOf()`(토큰), `isVerified()`(Identity Registry), `canTransfer()`(Compliance). 모든 외부 프로브는 try/catch로 감싸며, 어떠한 revert·비적합 대상도 코드 1로 귀결한다(fail-closed).

## 8. 기능 요구사항 (게이트)

- **REQ-B02-1 (선언 게이트 ①).** 시스템은 자산이 ERC-3643 네이티브로 증명되지 아니한 경우 차단하여야 한다(코드 1). 배선이 등록되지 아니한 증명 자산은 선언만으로 통과한다.
- **REQ-B02-2 (코드 존재).** 라이브 레짐에서 대상 주소에 코드가 없으면(EOA·미배포) 차단한다(코드 1).
- **REQ-B02-3 (배선 드리프트 ②).** Identity Registry 또는 Compliance 바인딩이 등록값과 다르거나 구현체 codehash가 등록값과 다르면 차단한다(코드 2, 보안 사건 등급). 프로브가 revert하면 코드 1.
- **REQ-B02-4 (정지 ③).** 토큰이 전역 정지 상태이면 차단한다(코드 3).
- **REQ-B02-5 (동결 ④).** 매도인 또는 매수인 지갑이 동결이면 차단한다(코드 4).
- **REQ-B02-6 (자유 잔액).** 매도인의 자유 잔액(잔고 − 동결분)이 이전 수량보다 작으면 차단한다(코드 5). 포함 기준으로서 정확히 같은 경우는 통과하며, 수량이 0이면 이 검사를 생략한다.
- **REQ-B02-7 (위임 프로브 ⑤).** 시스템은 등록된 구성요소 주소를 호출하여, 수신자가 검증되지 아니하였거나 규칙 모듈의 `canTransfer`가 거짓이면 차단한다(코드 6). 등록값을 호출하므로 검증된 주소만 호출한다는 원칙이 성립한다.

## 9. reasonCode

컨트랙트는 `ReasonCodes.encode(recipeId, "B-02-v1", n)`으로 인코딩하며, `n`은 walkthrough §6.1과 일치한다.

| n | Code | 발생 조건 |
|---|---|---|
| 1 | `TOKEN_STANDARD_MISMATCH` | 선언 미증명 · 코드 없음 · 프로브 revert(fail-closed) |
| 2 | `TOKEN_WIRING_DRIFT` | IR/MC 바인딩 또는 구현체 codehash가 등록값과 불일치(보안 사건 등급) |
| 3 | `TOKEN_PAUSED` | 토큰 전역 정지 |
| 4 | `TOKEN_FROZEN_PARTY` | 매도인 또는 매수인 지갑 동결 |
| 5 | `TOKEN_INSUFFICIENT_UNFROZEN` | 매도인 자유 잔액 < 수량 |
| 6 | `TOKEN_TRANSFER_INELIGIBLE` | 수신자 미검증 또는 `canTransfer`=false(두 분기, 단일 코드) |

`REJECT_LISTING_NONCONFORMANT`(walkthrough §6.1)은 상장 파이프라인(L1~L4 심사) 채널로서 거래별 코드가 아니며 off-chain에서 표면화한다.

## 10. Mock·Production Seam (현재 구현)

선언 게이트 ①은 운영자 증명이 상장 심사를 대리하는 mock이며, 실제로는 ERC-165 introspection 또는 신뢰 토큰 레지스트리로 대체된다. 라이브 배선의 등록값은 실제로는 B-01 Manifest 카드와 거버넌스 상수에 위치한다(자기참조 방지). 게이트 ②의 구현체 codehash는 본 구현에서 자산 주소의 코드 해시를 직접 사용하며, 프록시 토큰의 구현체 해시를 취하는 정밀화는 production seam이다.

## 11. 불변식

1. 어떠한 프로브 revert·비적합 대상도 통과가 아니라 차단으로 귀결한다(fail-closed).
2. 배선 드리프트(코드 2)는 단순 실패가 아니라 보안 사건 등급으로 다룬다.
3. 자유 잔액 판정은 포함 기준이며(정확히 같으면 통과), 동결분이 잔고를 초과하는 병리적 경우는 자유 잔액 0으로 포화 처리한다.
4. 위임 프로브는 등록값(게이트 ②로 토큰과 일치 증명됨)만 호출한다.
5. 본 부품은 자격을 재판정하지 아니한다.

## 12. 의존성

```
B-01(카드 무결성) → 카드 보증 직후 → B-02가 카드의 토큰 측 기재를 실물과 대조
B-03(제한 선언)   → 제한의 선언(B-02는 제한을 집행하는 기계를 봄, 분업)
B-04(엔진)        → 위임 프로브 호출 위상(1-hop/2-hop)이 엔진에 의존(설계 협응)
A-03·A-13·A-04    → 매수인·매도인 자격(별개 — B-02는 재판정 안 함)
발행측 IR·MC      → 위임 프로브 대상(staticcall)
```

## 13. 인수 기준

| # | 시나리오 | 기대 결과 |
|---|---|---|
| 1 | 증명되지 아니한 자산 | TOKEN_STANDARD_MISMATCH(1) |
| 2 | 증명 자산, 배선 미등록 | PASS(선언 전용) |
| 3 | 라이브, 대상 주소 코드 없음 | TOKEN_STANDARD_MISMATCH(1) |
| 4 | 라이브, IR 바인딩이 등록값과 불일치 | TOKEN_WIRING_DRIFT(2) |
| 5 | 라이브, 구현체 codehash 불일치 | TOKEN_WIRING_DRIFT(2) |
| 6 | 토큰 정지 | TOKEN_PAUSED(3) |
| 7 | 매도인 지갑 동결 | TOKEN_FROZEN_PARTY(4) |
| 8 | 자유 잔액 < 수량 | TOKEN_INSUFFICIENT_UNFROZEN(5) |
| 9 | 자유 잔액 = 수량 | PASS(포함) |
| 10 | 수신자 미검증 | TOKEN_TRANSFER_INELIGIBLE(6) |
| 11 | 규칙 모듈 canTransfer=false | TOKEN_TRANSFER_INELIGIBLE(6) |
| 12 | 프로브 revert(비적합 표준) | TOKEN_STANDARD_MISMATCH(1) |
| 13 | 표준·배선·상태·프로브 모두 정상 | PASS |

## 14. Demo 및 Production 범위

| 구분 | Demo (현재) | Production |
|---|---|---|
| 선언 게이트 ① | 운영자 증명(`setErc3643Native`) | ERC-165 introspection·신뢰 토큰 레지스트리 |
| 배선 등록값 | `registerWiring` 봉인 | B-01 Manifest 카드 + 거버넌스 상수 |
| 구현체 해시(②) | 자산 codehash 직접 | 프록시 구현체 해시 |
| 상장 심사 | off-chain(레짐 ①이 대리) | L1~L5 파이프라인 |

## 15. 잔여 확정 항목

1. mint·forcedTransfer의 모듈 우회 — 보유자 수 상한(D-01)의 발행 경로 강제 여부(상장 L4 행위 검증).
2. 프록시 토큰의 구현체 해시 게이트(②)의 정밀화.
3. 선언 게이트 ①의 production 대체(ERC-165·신뢰 레지스트리).
4. 위임 프로브 호출 위상과 엔진(B-04)의 협응(OD-B02-2).

---

# 부록. 출처 및 연혁

## A. 절별 출처

| 절 | 성격 | 출처 |
|---|---|---|
| 제1~4절 (법적 근거·논증) | 파생 | 보경 walkthrough §1·§3 |
| 제5~9·11~13절 (구현) | 실장 | `Erc3643Native.sol` (B-02-v1) |
| 제10절 (mock/seam) | 실장 | `Erc3643Native.sol` 주석 |
| 제14절 (Demo/Production) | 파생·실장 | walkthrough §3.0.1 + 컨트랙트 기본값 |

법적 실질을 본 문서에서 임의로 수정하지 아니한다. 보경 walkthrough가 개정되면 파생 절을, 컨트랙트가 변경되면 제2부를 재생성한다.

## B. 근거 문헌

- 원 출처(substance): 보경 walkthrough `Element.B-02_토큰-표준.md` (2026-07-08) — 레포 `docs/compliance/elements/` 교체 대상.
- 구현: `src/compliance/elements/Erc3643Native.sol`
- 결정: `ADR-004`(Element Pool Freeze) · `ADR-006`(asset-agnostic)
- 공유 개념: `SPEC.md` 제1·2절
- 1차 출처: 17 C.F.R. § 230.502(d) · § 230.144(a)(3) · 15 U.S.C. § 77e · § 77b(a)(11) · § 77d(a)(7) · § 80a-3(c)(7)(A) · § 78c(a)(25) · § 78q-1 · SEC v. Ralston Purina Co., 346 U.S. 119 (1953) · EIP-3643 (eips.ethereum.org)

## C. 변경 로그

- [2026-07-22] v0.1 — 2부 구성. 제1부는 보경 walkthrough(§1·§3) 기반 법률 메모 체 산문(논증 6 — 기계 확인·위임 3전제·배선 불변·위임 프로브·NATIVE_ISSUER·표준 대 규칙적법성), 제2부는 실장 컨트랙트 `Erc3643Native.sol` 기준(두 레짐·게이트 ①~⑤·REQ-B02-1~7·6 reason code·mock seam). Rule 502(d) legend·stop-transfer 기계론과 mint/forcedTransfer 모듈 우회(D-01 발행경로) 유의점 반영. B-02는 보경 기반 실구현 부품이라 제2부는 현행 계약.
