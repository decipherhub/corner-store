---
type: requirement-spec
project: RWA DEX (Giwa) · corner-store
element-id: B-01
element-name: Manifest Integrity (신상카드 정합)
status: v0.1 (2026-07-28) — 2부 구성. Part II는 실장 컨트랙트(AssetClassification.sol) 기준.
substance-sot: "보경 walkthrough — Element.B-01_신상카드-정합.md (2026-07-08). 레포 docs 교체 대상."
implements: "src/compliance/elements/AssetClassification.sol (ELEMENT_ID B-01-v1, 커밋 'upgrade B-01 to doc §5.2–§5.4 asset card integrity spec')"
reflects-decisions: [ADR-004, ADR-006, ADR-008]
umbrella: "SPEC.md — 공유 개념(ERC-3643·Element/Recipe/Manifest·Trusted Issuer·off-chain Compliance Data Layer·경계)은 여기에 의한다"
stateful: false
tags: [requirement-spec, B-01, manifest-integrity, asset-card, R1, R2, R3]
---

# B-01 Manifest Integrity — 요구사항 명세서

본 문서는 컴플라이언스 부품 B-01(신상카드 정합)의 요구사항 명세서이다. **제1부**는 본 부품이 지키는 규율의 법적 근거와 그 도출 과정을, **제2부**는 이를 구현한 명세를 규정한다. 법적 실질은 보경 변호사가 검토·작성한 walkthrough에 의하며, 제2부는 레포에 실장된 컨트랙트 `AssetClassification.sol`(B-01-v1)을 기준으로 한다. 시스템 공유 개념은 `SPEC.md`에 의한다.

본 부품은 어느 매수인의 자격도, 어느 개별 사실의 실체적 적법성도 판정하지 아니한다. 본 부품이 보는 것은 다른 모든 판정이 딛고 서는 공통 전제, 즉 이 거래가 근거로 삼는 자산의 신상카드(Manifest)가 진본이고, 승인되었으며, 자기모순이 없고, 최신인가이다. 신상카드가 오염된 채로 다른 부품이 돌면 그 판정 전부가 오염된 사실 위에 서므로, 본 부품은 검사 묶음에서 가장 먼저 실행된다.

---

# 제1부. 법적 근거 및 논증

## 1. 개요

B-01은 거래 대상 자산의 신상카드가 진본이고 승인 절차를 거쳤으며 내부적으로 모순이 없고 신선한지를 거래 직전에 판정하는 부품이다. 다른 부품들이 조문 하나의 요건을 각각 구현하는 것과 달리, 본 부품이 지키는 것은 어느 한 조문이 아니라 모든 조문 판정의 공통 전제이다. 미국 증권법의 면제는 전부 사실에 달려 있고, 그 사실을 잘못 기록한 채 작동하는 컴플라이언스 시스템은 준수처럼 보이는 위반을 양산한다. 따라서 본 부품의 법적 근거는 어느 요건 조문이 아니라, ① 사실 오류에 대한 무과실 책임 구조와 면제 주장자의 입증책임, ② 사실을 담은 기록의 규제 지위와 그 무결성·변경 규율, ③ 허위 사실에 대한 책임이라는 세 다발이 하나의 설계로 수렴한 것이다.

## 2. 규범적 근거

미국 연방 증권규제의 출발점은 1933년 증권법 제5조이다. 등록신고서 없이 증권을 청약하거나 매도하면 그 자체로 위법이며, 조문은 고의나 과실을 요건으로 삼지 아니한다(15 U.S.C. § 77e). 이 무과실 기본값에서 벗어나는 유일한 길이 면제인데, 모든 면제는 조건부이고 그 조건은 전부 사실 명제이다. Regulation D Rule 506(c)는 매수인 전원이 적격투자자일 것을, 투자회사법 제3조(c)(7)은 보유자 전원이 취득 시점에 적격구매자일 것과 공모를 하지 아니할 것을(15 U.S.C. § 80a-3(c)(7)(A)), Rule 144는 보유기간·물량·방식 조건의 충족을 각 요구한다. 이 조건들은 "이 자산은 제3조(c)(7) 펀드다", "이 발행은 506(c)다", "지금 판매 중이다", "발행주식총수는 N이다"와 같은 사실이다.

그 사실이 틀렸을 때 벌어지는 일이 본 부품의 존재 이유이다. 사실이 하나라도 틀리면 면제 조건 판정 자체가 잘못된 대상을 향하고, 면제가 성립하지 아니하면 기본값인 제5조 위반으로 돌아간다. 제12조(a)(1)은 그 위반에 대하여 매수인에게 무조건적 해제권을 부여하며, 매도인의 선의나 주의는 항변이 되지 아니한다(15 U.S.C. § 77l(a)(1)). 나아가 SEC v. Ralston Purina Co., 346 U.S. 119 (1953)가 확립한 바와 같이, 면제를 주장하는 자가 그 성립을 입증하여야 한다. 요컨대 이 시장에서 사실은 틀리면 무과실로 책임지고 맞다는 것을 스스로 증명하여야 하는 대상이며, 그 증명의 원료는 시스템이 남기는 판정 이력과 카드 버전 이력이다. 오염된 카드 위에 쌓인 통과 기록은 증명 자산이 아니라 체계적으로 잘못 운영되었다는 반대 증거가 된다.

이 사실이 사는 곳이 Decipher의 신상카드이며, 신상카드는 다시 세 갈래의 규제를 받는다. 첫째, 기록 갈래이다. 거래 venue는 자기 영업에 관한 기록을 작성하고 정확히 보존할 제정법상 의무를 지고(1934년 증권거래소법 제17조(a)(1), 15 U.S.C. § 78q(a)(1)), 특히 Rule 17a-4(e)(7)은 준수 매뉴얼을 그 갱신·수정·개정 이력까지 포함하여 보존하도록 명령한다(17 C.F.R. § 240.17a-4(e)(7)). 신상카드와 Recipe 레지스트리는 기계가독 준수 매뉴얼에 해당하므로 버전 이력의 보존은 선택이 아니라 규칙 문언이다. 전자기록이라면 Rule 17a-4(f)가 무결성 방식까지 지정하여, 재기록 불가 매체(WORM)이거나 모든 수정·삭제를 시각·행위자와 함께 남겨 원본을 재구성할 수 있는 감사추적(audit-trail)을 요구한다(17 C.F.R. § 240.17a-4(f); 2022년 개정 SEC Release No. 34-96034). 온체인 해시 앵커와 서명된 버전 이력은 이 감사추적 요건의 자연스러운 구현이다. 둘째, 변경 갈래이다. Regulation ATS Rule 301(b)(2)는 운영 방식의 중대 변경을 시행 최소 20일 전에 신고하고 기재가 부정확해지면 정정하도록 강제하며, 그 신고에 보고서(report)의 지위를 부여하여 허위 기재에 형사 책임을 연결한다(17 C.F.R. § 242.301(b)(2)). 규칙 문서를 사전에, 기록을 남기며, 정정 의무와 함께 바꾸어야 한다는 이 문법이 카드의 다중서명·시차잠금(time-lock)·정정 버전 규율에 대응한다. 셋째, 책임 갈래이다. venue가 참가자에게 사실상 표시하는 자산 정보가 허위이면 증권의 청약·매도에서의 중대 사실 허위 진술(1933년법 제17조(a), 15 U.S.C. § 77q(a))과 시장 사기 일반 조항(Rule 10b-5, 17 C.F.R. § 240.10b-5)의 사정권에 들어간다. 제17조(a)(2)·(3)은 고의 없이 과실만으로도 SEC 집행이 가능하므로, 몰랐다는 항변은 성립하지 아니한다.

이 세 갈래가 합쳐지면 결론은 하나이다. 신상카드의 무결성 확인은 사람이 가끔 하는 점검이 아니라 거래마다 기계가 강제하고 그 이력이 규제 양식으로 남는 상시 게이트여야 한다. 그것이 B-01이다. 확인이 불가능하거나 모호한 경우의 안전 방향은 차단(fail-closed)이며, 이는 무과실 기본값(제5조·제12조(a)(1))의 코드 구현이다.

## 3. 쟁점별 논증

### 3.1 판정 대상은 요건이 아니라 요건 판정의 전제이다

B-01이 어느 조문을 판정하는지가 문제된다. A-13이 제2조(a)(51)의 적격구매자 요건을, D-01이 제12조(g)의 보유자 수 요건을 각각 직접 구현하는 것과 달리, B-01은 특정 요건을 판정하지 아니한다. 본 부품이 지키는 것은 "판정에 쓰이는 사실이 승인된 진본이고, 자기모순이 없으며, 최신인가"라는 공통 전제이다. 그러므로 제1부에 인용된 조문들은 B-01이 그것을 판정한다는 관계가 아니라, 그 조문들이 B-01이라는 설계를 명령한다는 관계로 읽어야 한다. 무과실 책임과 입증책임이 기계 강제와 이력 보존을 명령하고, 사실 의존 면제가 선언 정합의 검사를 명령하며, 기록·변경 규율이 버전 검사와 신선도 검사를 명령한다.

### 3.2 정합과 진실은 다르다

B-01이 카드 내용의 진실성까지 보는지가 문제된다. 본 부품이 판정하는 것은 신상카드가 승인된 버전이고, 온·오프체인이 일치하며, 카드 안에 모순이 없고, 만료성 사실이 신선한가라는 정합이지, 카드에 적힌 내용이 세상의 진실인가라는 진실이 아니다. 발행주식총수가 실제로 그 수인지, 펀드가 실제로 제3조(c)(7) 구조로 조직되었는지와 같은 진실성은 온보딩 심사에서 운영자가 검증하고, 발행자가 사실 진실성을 보증하며, 운영 중의 반대정보는 부품 A-12가 표면화한다. 이 구분을 지우면 B-01에 오프체인 세계의 진위 판정이라는 불가능한 책임이 얹히고, 본 부품이 결정론적 기계 판정으로 남을 수 없게 된다.

### 3.3 신상카드는 다른 부품의 입력이자 어느 부품이 도는지를 정하는 해석 기준이다

신상카드 무결성을 별도 부품으로 승격하는 이유가 문제된다. 신상카드는 다른 모든 부품의 입력이면서, 동시에 어느 부품이 부착되어 도는지를 결정하는 해석 기준 자체이다. 카드의 fundForm이 조작되거나 누락되면 A-13과 D-01이 아예 부착되지 아니한 채 거래가 통과할 수 있다. 이는 검사가 틀리는 실패가 아니라 검사가 돌지 아니하는 실패이며, 카드의 낡은 발행주식총수는 C-08의 물량 상한 분모를 틀어지게 하고, 승인 절차를 우회하여 수정된 매수 금지 명단은 부품 F-04의 발행자 매수 금지를 무력화한다. 그러므로 신상카드 무결성은 다른 검사와 병렬로 두어서는 아니 되고, 검사 묶음의 첫 원소로 고정하여 가장 먼저 실행하여야 한다.

### 3.4 선언 정합은 활성화의 무결성이다

B-01이 사실 의존 면제와 맺는 관계가 문제된다. 투자회사법 제3조(c)(7)의 면제는 발행인의 속성 사실에 달려 있고, Decipher에서 그 속성을 선언하는 곳이 신상카드의 fundForm 필드이며, 이 한 필드가 적격구매자 검사와 보유자 수 검사의 부착을 켠다. 따라서 그 조문의 요건 준수 여부를 판정하기 이전에, 선언 자체의 무결성이라는 선행 문제가 있다. B-01은 이 조문의 요건을 판정하지 아니하고, fundForm과 fund용 Recipe 식별자, 그리고 실제 부착된 부품 집합이 상호 일치하는지만 판정한다. 이 상호 일치를 불변식으로 강제하여, 사실이 가리키는 Recipe 조합과 실제 부착된 조합이 어긋난 카드를 첫 검사에서 모순으로 차단한다.

### 3.5 per-tx 게이트와 해시 대사는 다른 채널이다

카드 무결성 검사를 매 거래 온체인에서 전부 수행할 수 있는지가 문제된다. 온체인 hot path는 경량 core의 저장소 읽기 몇 번으로 끝나야 하므로, 오프체인 전문(full manifest)의 해시 재계산을 매 거래마다 온체인에서 돌릴 수 없다. 그러므로 B-01은 두 채널로 작동한다. 채널 1은 매 거래의 per-tx 게이트로서 존재·상태·버전·불변식·신선도를 결정론적으로 검사하고, 채널 2는 hot path 밖의 상시 대사 감시자로서 온체인 해시 앵커와 오프체인 전문을 대조하여 불일치 시 자산을 정지 상태로 전환한다. 채널 2의 결론은 게이트가 직접 소비하지 아니하고 서명된 상태 입력으로 변환되어, 채널 1의 상태 검사 단계에서 나타난다. 이 분리 덕에 hot path는 가벼우면서도 Rule 17a-4(f)의 감사추적 무결성이 상시 보증된다. 이 채널 2가 곧 ADR-008이 정한 오프체인 Compliance Data Layer의 한 소비처이다.

### 3.6 두 부등호의 방향은 다르다

시차잠금과 신선도의 경계값 처리가 문제된다. 버전 시차잠금은 현재 시각이 승인 시각에 지연을 더한 값 이상이면 발효한다. 즉 경계값에서 발효한다(이상 허용). 반면 만료성 사실의 신선도는 현재 시각에서 사실 기준시각을 뺀 값이 최대 허용 연한 이하이면 유효하고, 초과하는 순간부터 실패한다(이하 허용, 초과 탈락). 두 검사의 부등호 방향이 반대이므로 경계값 테스트를 분리하여 규율한다. 시차잠금은 Regulation ATS의 사전 대기 문법의 내부 대응물이고, 신선도는 기록을 현재와 일치하게 유지하라는 의무(17 C.F.R. § 242.302)의 파라미터화이다.

### 3.7 판정 파라미터는 카드 밖에 둔다

카드가 자기 검사의 기준을 담을 수 있는지가 문제된다. 신선도의 대상 필드 목록과 최대 허용 연한, 시차잠금 지연과 같은 판정 파라미터를 검사 대상인 신상카드 안에 두면, 카드가 자기를 재는 잣대를 스스로 정하는 순환(자기 인증)이 생긴다. 그러므로 이 파라미터들은 카드 밖의 거버넌스 상수(부품 레지스트리 설정)에 두어 자기참조를 구조적으로 끊는다. 이 자기참조 차단은 설계 불변식이다.

## 4. 확정 사항 및 잔여 쟁점

거래마다 도는 결정론적 게이트(존재 → 상태 → 버전 → 불변식 → 신선도)와 hot path 밖의 상시 해시 대사라는 2채널 구조, 검사 묶음 내 최우선 실행, 그리고 정합과 진실의 소관 분리는 위와 같이 확정되었다. 다만 유의할 점이 있다. 첫째, 신상카드 변경 중 어떤 것이 Regulation ATS상 운영의 중대 변경에 해당하여 실제 Form ATS 정정 신고를 요하는지는 내부 버전 규율과 별개의 판단이며, 이 이중 트랙의 정렬은 잔여 쟁점으로 남긴다. 둘째, 발행주식총수와 같은 분모류 사실의 원천 대사(Securitize 명세와 카드와 온체인 총공급의 3자 대조)는 B-01이 신선도 축을, 소비 부품인 C-08·D-01이 사용 축을 각각 맡는 공동 규율이다. 셋째, A-13 문서가 B-01을 체결 직후 사후 교차검증으로 서술한 부분은, 본 문서의 확정 분류(거래 전 무상태 기계 판정)와 시점이 다른 두 소비처로 정리하며, 사후 교차검증은 부품 본체가 아니라 동일 규칙집합을 소비하는 운영자 감사 채널로 본다.

---

# 제2부. 구현 명세 (컨트랙트 `AssetClassification.sol` 기준)

## 5. 시스템 내 위치

| 항목 | 값 (컨트랙트 메타) |
|---|---|
| ELEMENT_ID | `B-01-v1` |
| 파일명 | `AssetClassification.sol` (레거시 명칭 유지) |
| 분류 | 자산 속성(ASSET_ATTRIBUTE) |
| 검증 패턴 | 기계 판정형 — 카드 상태·버전·불변식·신선도의 결정론적 확인 |
| 판정 시점 | 거래 전 관문(AT_TRADE_GATE) · ONE_TIME |
| 상태 | STATELESS · DETERMINISTIC |
| 활성 | R1(발행)·R2(재판매)·R3(펀드) 전부 필수. 검사 묶음의 첫 원소로 고정 실행. |
| 의존 관계 | 없음(다른 부품을 호출하지 아니함) — 반대로 사실 소비 부품 전원(A-03·A-13·C-00·C-08·D-01·F-04·B-02·B-04)이 본 부품의 보증을 전제한다 |

`asset`은 거래 대상 토큰 컨트랙트 주소이다. `check`의 `user`·`counterparty`·`amount` 인자는 무시된다. 본 부품은 매수인·매도인이 아니라 자산의 카드를 보는 자산 측 검사이기 때문이다.

## 6. 검사 대상 — 자산별 신상카드 미러

컨트랙트는 자산별로 하나의 카드(`AssetCard`)를 저장하고, 그 카드가 진본·승인·무모순·신선인지를 `check`에서 판정한다. 카드는 온체인 ManifestCore를 대리하는 미러이며, 필드는 다음과 같다.

- `status` — 카드 생애 상태. `NONE`(카드 없음, 미상장·미첨부) / `ACTIVE`(활성) / `SUSPENDED`(감시자 불일치·긴급 정지). 기본값은 `NONE`.
- `classification` — 자산의 분류 태그(레거시 필드). 불변식 INV-C의 대상.
- `coreVersion` · `approvedVersion` — 카드가 참조하는 버전과 승인된 버전.
- `approvedAt` — 시차잠금 기준시각. 발효 시각은 `approvedAt + activationDelay`.
- `factsAsOf` · `maxFactAge` — 만료성 사실의 신선도 기준시각과 최대 허용 연한. `maxFactAge = 0`이면 신선도 검사 비활성.

시차잠금 지연 `activationDelay`는 카드 밖의 상태 변수로 별도 관리한다(제3.7절 자기참조 차단의 구현). 카드 자체는 무상태 정적 스냅샷으로 판정되나, 검사 대상인 신상카드는 거버넌스 평면에서 버전 관리되는 상태이다.

## 7. 인터페이스

```solidity
// 판정 (view). asset 측 검사이므로 user·counterparty·amount는 무시.
function check(address, address, address asset, uint256, bytes)
    external view returns (bool passed, bytes32 reasonCode);

// 운영자 설정 (onlyOperator, Governed)
function setClassification(address asset, bytes32 classification) external; // 레거시 — 완전 활성 카드 1회 기록
function setCard(address asset, AssetCard calldata card) external;          // 운영자 증명 카드 전체 기록
function setActivationDelay(uint64 delay) external;                         // 시차잠금 지연(카드 밖)

// 레거시 뷰
function classificationOf(address asset) external view returns (bytes32);   // 카드의 classification 필드
function requiredClassification() external view returns (bytes32);          // 생성자 봉인 immutable
```

`setClassification`은 시그니처와 정상경로 효과를 정확히 보존한 레거시 세터로서, 대상 자산에 완전 활성 카드(상태 `ACTIVE`, 버전 1을 버전 1로 승인, `approvedAt = now`, `factsAsOf = now`, `maxFactAge = 0`)를 기록하여 그 자산이 별도 호출 없이 `check`를 통과하게 한다. 강화된 엄격성(정지·버전 승인·시차잠금·신선도)은 `setCard`·`setActivationDelay`로 운영자가 설정하며, 기본값은 완전 활성 및 비활성이므로 기존에 통과하던 흐름이 새로 실패하지 아니한다. 생성자는 `requiredClassification`이 0이면 되돌린다(`ZeroRequiredClassification`) — 분류가 없는 자산(기본값 0)이 올바르게 선언된 자산과 구별 불가능해지는 것을 막기 위함이다.

## 8. 기능 요구사항 (게이트)

`check`는 walkthrough 제5.2절의 순서 — 싸고 탈락 잘 되는 검사와 선행조건을 먼저 — 를 그대로 따라 다섯 단계를 순차 평가하며, 외부 호출이 없다.

- **REQ-B01-1 (존재 ①).** 시스템은 자산의 카드 상태가 `NONE`이면 차단하여야 한다(코드 1). 저장소 읽기 1회로 끝나는 가장 싸고 가장 치명적인 결손을 가장 먼저 본다. 미상장·비증권 토큰의 무검사 통과(passThrough)는 카드가 첨부되지 아니한 자산에 대한 것으로, 상장 처리된 자산이 카드 없이 통과하는 것과는 구별된다.
- **REQ-B01-2 (상태 ②).** 카드 상태가 `SUSPENDED`이면 차단한다(코드 2). 채널 2의 해시 불일치, 운영자 긴급 정지, 폐기가 모두 이 한 관문으로 수렴한다. 게이트는 정지 사유를 알 필요가 없으며, 사유는 로그와 거버넌스 기록에 있다.
- **REQ-B01-3 (버전 승인 ③a).** `coreVersion`이 `approvedVersion`과 다르면 차단한다(코드 3). 승인 집합 밖의 버전을 참조하는 것은 단일 키 수정 등 거버넌스 우회의 신호이다.
- **REQ-B01-4 (시차잠금 ③b).** 현재 시각이 `approvedAt + activationDelay` 미만이면 차단한다(코드 4). 경계는 포함이다. 즉 `now == approvedAt + activationDelay`인 순간 통과하고, 1초라도 이르면 실패한다. 발효 전 버전 참조와 승인 밖 버전 참조를 다른 코드로 구분하는 것은 사고 조사 시 성격이 다르기 때문이다.
- **REQ-B01-5 (불변식 ④ / INV-C).** 카드의 `classification`이 생성자로 봉인된 `requiredClassification`과 다르면 차단한다(코드 5). 이는 walkthrough의 불변식 묶음 중 분류 정합(INV-C)을 구현한 것으로, 이전에 코드 1의 "잘못된 분류로 첨부됨"에 섞여 있던 경우를 이 코드로 분리한다.
- **REQ-B01-6 (신선도 ⑤).** `maxFactAge`가 0이 아니고 경과가 이를 초과하면(`now - factsAsOf > maxFactAge`, 엄격 초과) 차단한다(코드 6). 경계는 배제이다. 즉 `now - factsAsOf == maxFactAge`이면 통과하고, 1초라도 초과하면 실패한다. 이는 시차잠금과 반대 방향의 부등호이며, 미래·동일 기준시각에서는 경과를 0으로 처리하여 언더플로를 피한다. `maxFactAge = 0`은 이 검사를 비활성화한다.

다섯 단계를 모두 통과하면 `check`는 통과를 반환한다.

## 9. reasonCode

컨트랙트는 `ReasonCodes.encode(0, "B-01-v1", n)`으로 인코딩하며, `n`은 walkthrough 제6.1절 실패 코드명과 평가 순서까지 일치한다.

| n | Code (§6.1) | 발생 조건 | 근거 |
|---|---|---|---|
| 1 | `MANIFEST_MISSING` | 카드 상태 `NONE`(미첨부 자산) | § 5·§ 12(a)(1) fail-closed |
| 2 | `MANIFEST_SUSPENDED` | 카드 상태 `SUSPENDED`(감시자 불일치·긴급 정지·폐기 수렴) | § 17(a)·Rule 10b-5·17a-4(f) |
| 3 | `VERSION_UNAPPROVED` | `coreVersion ≠ approvedVersion`(승인 밖 버전 참조) | Reg ATS 301(b)(2)·17a-4(e)(7) |
| 4 | `VERSION_PENDING` | 시차잠금 미경과(`now < approvedAt + delay`, 경계 포함 통과) | Reg ATS 301(b)(2)(ii) 사전 대기 |
| 5 | `FACTS_INCONSISTENT` | INV-C: `classification ≠ requiredClassification` | § 3(c)(7)(A) 활성화 정합 |
| 6 | `FACT_STALE` | 신선도 초과(`now - factsAsOf > maxFactAge`, 엄격 초과) | 17 C.F.R. § 242.302 keep current |

`REVIEW_MANIFEST_DRIFT`(walkthrough §6.1)는 감시자의 소프트 드리프트 채널로서 오프체인 운영 큐이며, 거래별 코드가 아니므로 `check`에서 방출되지 아니한다. walkthrough가 규정한 통과 이벤트(`emit B01Check`) 또한 `view` 함수에서 방출이 불가능하여 문서화된 생략이다.

## 10. Mock·Production Seam (현재 구현)

본 구현은 walkthrough의 5단 게이트 골격(존재·상태·버전·시차잠금·신선도)과 두 경계 부등호의 비대칭을 충실히 구현하되, 완전 명세와 다음 지점에서 갈린다. 이 간극은 결함이 아니라 현재 데모 범위의 명시적 축약이다.

| 항목 | 현재 구현(mock) | 완전 명세(walkthrough) |
|---|---|---|
| 검사 대상 원천 | 컨트랙트 자체의 자산별 카드 미러(`cardOf`) | 실제 ManifestCore·TokenPolicyRegistry + 오프체인 해시 대사 감시자 |
| ④ 불변식 | 분류 정합 단일(INV-C: `classification == requiredClassification`) | INV-1~6 전부(fundForm↔fundRecipeId, issuanceExemption↔issuanceRecipeId, resalePaths 포함관계, distribution⇒restrictedParties, 필수 필드 존재, override 강화 방향) |
| ③ 버전 승인 | 단일 `approvedVersion` 동치 | 승인 집합(approvedSet) 소속 + 미대체(superseded 아님) |
| 채널 2(해시 대사) | 온체인 미구현 — `SUSPENDED`를 운영자 `setCard`가 대리(감시자 출력의 자리표) | 온체인 `fullManifestHash` 앵커 + hot path 밖 감시자 재계산·대조(ADR-008 오프체인 Compliance Data Layer) |
| 소프트 드리프트 | 미방출(오프체인 큐) | `REVIEW_MANIFEST_DRIFT` 운영 검토 채널 |
| 통과 이벤트 | `view` 제약으로 생략 | `emit B01Check`(자산·버전·코드·시각) 불변 로그 |

즉 ④ 불변식 단계가 완전 명세의 여섯 갈래 교차 검증을 담으려면 카드에 ManifestCore의 Recipe 식별자 구조가 필요하나, 본 mock은 그 구조를 두지 아니하고 레거시 분류 필드 하나만 검사한다. 채널 2의 온체인 앵커 대사는 ADR-008이 오프체인 계층으로 확정한 결정과 정합하며, 본 컨트랙트의 `SUSPENDED`는 그 오프체인 판정이 서명 입력으로 온체인에 반영되는 지점이다.

## 11. 불변식

1. 확인이 불가능하거나 카드가 없으면 통과가 아니라 차단으로 귀결한다(fail-closed).
2. 채널 2의 판단은 그 자체로 게이트를 바꾸지 아니하고, 상태(`SUSPENDED`)로 변환되어야 효력이 있다.
3. 시차잠금은 경계 포함(이상 발효), 신선도는 경계 배제(초과 탈락)로 부등호 방향이 반대이다.
4. 판정 파라미터(시차잠금 지연 등)는 카드 밖에 두어 자기 인증 순환을 끊는다.
5. 본 부품은 다른 부품을 호출하지 아니하며, 검사 묶음의 첫 원소로 실행되어 나머지 부품에 무결한 사실을 공급한다.

## 12. 의존성

```
(선행 없음)          → B-01은 사실 공급자이므로 다른 부품을 호출하지 않는다
B-01(본 부품)        → 검사 묶음 첫 실행 → 카드 무결 보증
   ↓ 이 보증을 전제로
B-02·B-03·B-04      → 카드의 토큰 측 기재를 실물과 대조·소비
A-13·D-01           → fundForm 선언(INV-C·완전 명세 INV-1)이 부착을 켜는 대상
C-00·C-08·F-04      → enabledResalePaths·분모·distributionStatus 사실 소비
채널 2(오프체인)     → 해시 대사 → SUSPENDED 서명 입력(ADR-008 D-계열)
```

## 13. 인수 기준

| # | 시나리오 | 기대 결과 |
|---|---|---|
| 1 | 카드 없음(상태 NONE) | MANIFEST_MISSING(1) |
| 2 | `setClassification`으로 완전 활성 카드 기록, 분류 일치 | PASS |
| 3 | 카드 상태 SUSPENDED | MANIFEST_SUSPENDED(2) |
| 4 | `coreVersion ≠ approvedVersion` | VERSION_UNAPPROVED(3) |
| 5 | 시차잠금 지연 설정, `now < approvedAt + delay` | VERSION_PENDING(4) |
| 6 | `now == approvedAt + delay` 정확히 | PASS(경계 포함) |
| 7 | `classification ≠ requiredClassification` | FACTS_INCONSISTENT(5) |
| 8 | `maxFactAge ≠ 0`, `now - factsAsOf > maxFactAge` | FACT_STALE(6) |
| 9 | `now - factsAsOf == maxFactAge` 정확히 | PASS(경계 배제 아님, 이하 유효) |
| 10 | `maxFactAge == 0`(신선도 비활성), 나머지 정상 | PASS |
| 11 | 존재·상태·버전·불변식·신선도 모두 정상 | PASS |
| 12 | 생성자에 `requiredClassification = 0` | 배포 revert(ZeroRequiredClassification) |

## 14. Demo 및 Production 범위

| 구분 | Demo (현재) | Production |
|---|---|---|
| 카드 원천 | 컨트랙트 자체 미러(`cardOf`) | ManifestCore·TokenPolicyRegistry |
| ④ 불변식 | INV-C(분류 정합) 단일 | INV-1~6 교차 검증 |
| ③ 버전 | 단일 `approvedVersion` | 승인 집합 + 미대체 |
| 해시 대사 | 오프체인 미구현(운영자 정지 대리) | 온체인 앵커 + 감시자(ADR-008 오프체인 계층) |
| 상태 전환 원천 | `setCard`(운영자) | 감시자 서명 입력 + 거버넌스 |
| 감사추적 | 문서화된 생략(view) | `emit B01Check` 불변 로그 + 버전 사슬 export |

## 15. 잔여 확정 항목

1. ④ 불변식의 완전 명세(INV-1~6) 온체인화 — ManifestCore의 Recipe 식별자 구조 도입 여부.
2. 채널 2 해시 대사의 온체인 앵커·감시자 구현 — ADR-008 오프체인 Compliance Data Layer와의 접합.
3. 버전 승인의 집합·대체 모델(단일 `approvedVersion` → `approvedSet` + `correctionOf` 사슬).
4. 신상카드 변경의 Form ATS 중대 변경 해당성 판단과 내부 버전 규율의 이중 트랙 정렬.
5. 분모류 사실의 3자 원천 대사(Securitize 명세·카드·총공급) — C-08·D-01과의 공동 규율.

---

# 부록. 출처 및 연혁

## A. 절별 출처

| 절 | 성격 | 출처 |
|---|---|---|
| 제1~4절 (법적 근거·논증) | 파생 | 보경 walkthrough §1·§3(§3.1~§3.12·§3.19·§3.20)·§4 |
| 제5~9·11~13절 (구현) | 실장 | `AssetClassification.sol` (B-01-v1) |
| 제10절 (mock/seam) | 실장·파생 | `AssetClassification.sol` 주석 + walkthrough §3.19·§5 |
| 제14절 (Demo/Production) | 파생·실장 | walkthrough §3.0.1·§8 + 컨트랙트 기본값 |

법적 실질을 본 문서에서 임의로 수정하지 아니한다. 보경 walkthrough가 개정되면 파생 절을, 컨트랙트가 변경되면 제2부를 재생성한다.

## B. 근거 문헌

- 원 출처(substance): 보경 walkthrough `Element.B-01_신상카드-정합.md` (2026-07-08) — 레포 `docs/compliance/elements/` 교체 대상.
- 구현: `src/compliance/elements/AssetClassification.sol` (B-01-v1)
- 결정: `ADR-004`(Element Pool Freeze) · `ADR-006`(asset-agnostic) · `ADR-008`(off-chain Compliance Data Layer — 채널 2 대사)
- 공유 개념: `SPEC.md` 제1·2절 (Element/Recipe/Manifest·ADR-008 계층)
- 1차 출처: 15 U.S.C. § 77e · § 77l(a)(1) · § 77q(a) · § 78q(a)(1) · § 80a-3(c)(7)(A) · 17 C.F.R. § 240.17a-4(e)(7)·(f) · § 240.10b-5 · § 242.301(b)(2)·§ 242.302·§ 242.303 · SEC v. Ralston Purina Co., 346 U.S. 119 (1953) · SEC Release No. 34-96034 (87 FR 66412, 2022)

## C. 변경 로그

- 2026-07-28 (v0.1) — 초안. 보경 walkthrough(2026-07-08) §1·§3·§4 기반 제1부, `AssetClassification.sol`(B-01-v1) 기반 제2부. mock의 ④불변식 INV-C 축약·채널 2 오프체인(ADR-008 정합)을 §10·§14에 명시.
