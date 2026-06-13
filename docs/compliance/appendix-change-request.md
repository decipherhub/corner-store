# 개발팀 수정 요청서 — Recipe v4 + ACM 반영 (Corner Store)

> **본 문서의 성격 (중요)**
> 이것은 *지시서가 아니라 수정 요청 (change request)*입니다. 아래 항목들은 **compliance 측에서 도출된 요구사항 + 법적 근거**이며, **수용 여부·구현 방식·일정의 결정 권한은 개발팀에 있습니다**. 각 항목에 "구현 자유도" 칸을 두어 팀이 결정할 영역을 명시했습니다. 논의가 필요한 부분은 회의에서 다루면 좋겠습니다.
>
> **배경 한 줄**: 미국증권법 학습이 누적되면서 "Reg D Recipe 1개"가 아니라 *한 거래에 여러 규제 framework이 동시 적용* (최대 7 Recipe)된다는 점이 확인되었고, 이를 수용하기 위한 최소 변경 2건 + 설계 결정 요청 3건입니다. **현재 아키텍처의 뼈대 (Router·TRM·Element/Recipe 분리·early exit·CREATE2)는 정합하며 재설계가 필요한 것이 아닙니다** (노트 21 검토 결론 유지).
>
> **관통 원리 (온오프체인 하이브리드)**: 아래 요청들은 하나의 원리를 공유합니다 — **온체인은 검증·게이팅만, 무거운 것(대량 데이터·민감 정보)과 못 푸는 것(판단·비결정론)은 오프체인**. 온체인으로의 통로는 진입점 통제(modifier)로 통일. CR-1의 *full manifest off-chain + hash anchor*, CR-3의 *off-chain attestation 옵션*, CR-5의 *off-chain indexer 옵션*이 모두 이 원리의 사례입니다. hot path는 항상 경량 (SLOAD 수 회 + check 호출)으로 유지되어야 하며, 이것이 고성능 처리와 비결정론적 규제를 동시에 수용하는 근간입니다 (OCP와 직교하는 두 번째 설계 축).

---

## CR-1. TokenRecipeMapping → ManifestCore 확장 🔴 (Phase 2 MVP)

**요청**: TRM의 값 타입을 `address (recipe 1개)` → `ManifestCore struct`로 확장.

```solidity
// 참고 sketch — 필드 구성·패킹은 팀 결정 영역
struct ManifestCore {
    uint16  issuanceRecipeId;      // + version (packed)
    uint16  fundRecipeId;          // 0 = none
    uint32  enabledResalePaths;    // bitset
    uint8   supportedEngines;      // bitset {AMM, OB, RFQ}
    uint16  stateScopeId;
    uint32  factsPacked;           // fundForm·restrictedFlag 등
    bytes32 fullManifestHash;      // off-chain full manifest anchor
}
```

| 항목 | 내용 |
|------|------|
| 근거 | 한 토큰에 Recipe가 1개가 아님 — 발행 framework + 펀드 여부 + 허용 resale path + 지원 engine이 *토큰별로 다르게 조합*됨. 예: BUIDL = Reg D 506(c) + ICA §3(c)(7) + Rule 144 + RFQ/OB |
| 구현 자유도 | struct 레이아웃·패킹·ID 체계·storage 위치 (Router inline vs 별도 컨트랙트 — gas trade-off는 노트 21 🟡-4 참조) 모두 팀 결정 |
| 참조 | 07 ACM §3.6·§V (v0=현 TRM → v1 진화 경로) |
| 비고 | 무거운 정보 (override 근거·legal doc·governance config)는 off-chain + hash anchor — hot path는 이 struct SLOAD로 끝나야 함. **+ (2026-06-08 추가) manifest에 *발행 측 ModularCompliance 커버 범위* 필드 검토 권장** — 발행 측이 이미 검사하는 claim (예: buyer accredited)은 거래 측이 재조회하지 않는 *분담 검사 (Coverage Delta)* 최적화의 기반. claim 조회는 topic×issuer 외부 호출이라 중복 시 비용이 큼 (노트 23 §2) |

## CR-2. Router multi-Recipe orchestration 🔴 (Phase 2 MVP)

**요청**: Router의 검사 호출을 *single recipe.check()* → *applicable Recipes 식별 + Element subsets union + cumulative AND*로 확장.

```
// 의사코드 — 함수 분해·최적화는 팀 결정 영역
manifest = ACM[tx.asset]
if empty → passThrough (early exit 유지)
recipes = identifyApplicableRecipes(manifest.facts, txContext)
elements = union(r.elementSubset for r in recipes)  // 중복 Element 1회만 실행
for e in elements: if !e.check(tx) → revert(e.reason)
```

| 항목 | 내용 |
|------|------|
| 근거 | cumulative AND가 법적 요구 — 김 부장 시나리오 (affiliate가 §3(c)(7) 펀드를 RFQ로 매도)에서 7 Recipe·23 Element 동시 적용. 어느 하나의 framework만 통과해서는 면제 불성립 |
| 구현 자유도 | loop 구조·gas 최적화·Recipe 컨트랙트 분리 단위 모두 팀 결정. 기존 single router·early exit·pool-only custody 패턴은 그대로 |
| 참조 | 05 §3.2·§8.1 / 07 §IV |

## CR-3. Acquisition registry 설계 결정 요청 🔴 (Phase 2 — 공동 설계 필요)

**요청**: Rule 144 holding period (LockupElement)의 데이터 source 결정. ERC-3643에는 *취득 시점 기록이 없습니다* (T-REX `created` hook은 mint 시점만 — 노트 23).

| 항목 | 내용 |
|------|------|
| 근거 | C-01 (Rule 144 Holding Period)이 Required 19에 포함 — "누가 언제 취득했나"의 lot-level 데이터 없이는 구현 불가. 풀 경유 시 holding period 처리 정책도 미결 (노트 21 🔴-2) |
| 구현 자유도 | 별도 registry 컨트랙트 vs issuer ONCHAINID claim vs off-chain attestation + hash — *법적 충분성은 compliance 측에서 검토 지원* (공동 설계 지점) |
| 참조 | 노트 21 🔴-2 / 노트 23 시사 4 |

## CR-4. IElement commit hook 자리 예약 🟡 (인터페이스 설계 시)

**요청**: `IElement` 인터페이스에 `onTransfer(from, to, amount)` 자리를 예약 (현 Phase 미구현, 주석 처리도 무방).

| 항목 | 내용 |
|------|------|
| 근거 | 상태형 Element (C-08 affiliate volume limit — 3개월 rolling 누적 추적)가 Phase 3에 들어옴. ERC-3643이 canTransfer(검사)/transferred(기록)를 쌍으로 두는 것과 같은 패턴 — 지금 자리를 안 잡으면 나중에 인터페이스 breaking change |
| 구현 자유도 | 시그니처·호출 시점·미구현 기간의 처리 모두 팀 결정 |
| 참조 | 노트 23 §1 발견 2 (CQS)·§4 |

## CR-5. Reject-logging 정책 결정 🟡 (Phase 2)

**요청**: 거부된 거래의 audit trail 보존 방식 결정. 현재 구조 (revert)에서는 emit된 event가 rollback과 함께 사라져 *거부 기록이 남지 않습니다*.

| 항목 | 내용 |
|------|------|
| 근거 | AML·Reg ATS 관점에서 "제재 주소가 N회 시도하다 차단됨"이 핵심 audit trail. 또한 Q-R5 (어느 Recipe가 activated되었는지의 기록 의무)가 변호사 위임 중 |
| 구현 자유도 | `(success, reasonCode)` return 방식 vs try/catch 상위 emit vs off-chain indexer 보완 — 팀 결정 |
| 참조 | 노트 21 🟡-6 |

---

## 기존 전달 사항 (노트 21 — 재확인용 묶음)

위 5건과 별개로, 6/4 정합성 리뷰에서 식별된 사항들입니다 (이미 공유된 것 재정리): 🟡-4 gas 추정 정정 (cold SLOAD 2100 + cold account 2600) / 🟡-5 §12 다이어그램 hot-path vs governance 구분 / 🟡-7 ComplianceRouter `nonReentrant` 명시 / 🟢-8 데모 라벨링 ("축약 시뮬레이션 Recipe — 4 of 19 Required") / 🟢-10 `POOL_INIT_CODE_HASH` fork 검증 assert.

## 우선순위 제안 (참고용 — 일정 결정은 팀)

| 순위 | 항목 | 시점 |
|------|------|------|
| 1 | CR-3 (acquisition registry) | 설계 결정이 다른 구현을 blocking — 공동 회의 우선 |
| 2 | CR-1 + CR-2 (Manifest + orchestration) | Phase 2 MVP 빌드 시 — Step 2 ("Recipe 하나") 시점에 함께 |
| 3 | CR-4 (commit hook 예약) | IElement 인터페이스 첫 확정 전 |
| 4 | CR-5 (reject-logging) | Phase 2 중 정책 결정 |

---

## 변경 로그

- [2026-06-08] (canton-rwa) v1.0 작성. Recipe v4 + ACM 도출 수정 요청 5건 (CR-1 ManifestCore·CR-2 orchestration·CR-3 acquisition registry·CR-4 commit hook·CR-5 reject-logging) + 노트 21 기존 피드백 묶음 + 우선순위 제안. *change request 성격 명시 — 결정 권한은 개발팀* (2026-06-08 사용자 지시 반영).
