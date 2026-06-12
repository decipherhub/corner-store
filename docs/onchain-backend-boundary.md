# Corner Store: 온체인 vs 백엔드 경계 (이해용)

> 이 문서는 각 레이어의 책임을 "백엔드로 옮겨도 되는가, 온체인에 남아야 하는가"
> 기준으로 정리한 개인·팀용 정리본이다. 정식 책임 정의와 trust boundary는
> [`architecture/`](./architecture/README.md), 레이어 정의는
> [`layers-overview.md`](./layers-overview.md), 시나리오는
> [`layer-scenarios.md`](./layer-scenarios.md)를 우선한다. 충돌하면 그쪽이 정답.

## 한 줄로

모든 레이어는 두 가지 일을 섞어서 한다. **계산/결정**(무엇이 허용되는지 판단하고,
라우팅하고, 목록·견적을 산출)과 **집행/강제**(실제로 토큰을 옮기고, atomic하게
revert하고, 전송이 일어나는 그 순간에 강제). 백엔드는 이 중 **계산 절반만** 가져갈 수
있다.

## 핵심 프레임워크: 계산 vs 집행

각 레이어의 책임을 둘로 가른다.

- **계산/결정 (백엔드 가능)**: 허용 여부 판단, route 힌트, 목록/견적/preview 산출,
  manifest 대조, 오작동 검출·alert. hot path 밖의 일회성·주기성 연산.
- **집행/강제 (온체인 필수)**: 실제 토큰 이동, atomicity, 전송 순간의 강제.

**온체인에 반드시 남아야 하는 세 가지:**

1. **실제 토큰 전송** — 가치를 옮기는 것은 EVM 트랜잭션 그 자체다. 백엔드는
   ERC-3643 토큰을 옮길 수 없다 (L1, E2E-1 step 6-8).
2. **Atomicity** — "실행 중 거부 = 전체 롤백, 부분 이동 절대 없음"
   ([`layers-overview.md`](./layers-overview.md) 거부 시점, E2E-3). 단,
   이 보장은 Corner Store의 **단일 트랜잭션 Adapter 합성**(콜백 + transferFrom +
   settle를 한 tx로 묶고 한 단위로 revert)이 만드는 것이지, 토큰 단독의 속성이
   아니다. 우회 경로는 atomicity를 잃을 수 있다 (E2E-4 "일부 토큰만 이동").
3. **전송 순간의 강제** — 예: FakePool 콜백 origin 검증(A-F1). 백엔드는 이 호출을
   아예 거치지 않으므로 구조적으로 부재한다.

## 레이어별 경계 (L1–L5)

| 레이어 | 백엔드가 가질 수 있는 것 (계산/결정/오케스트레이션) | 온체인에 남아야 하는 것 (집행/강제) | 시나리오 |
|---|---|---|---|
| **L1 Token & Identity** | 없음 (외부·발행자 소유). 사전 검증용 `isVerified`/`canTransfer` 결과 조회만 | 실제 transfer, ERC-3643 enforcement, atomic revert. 우회 경로(R-E2)에서도 유일하게 살아남는 보장 | T-F1~F5, R-E2, E2E-3 |
| **L2 Compliance Policy** | Element/Recipe 평가, preview decision 산출, UX용 사전 검증 (KYC/PII가 온체인에 올라가는 것은 아님 — ONCHAINID claim 평가 + reason-code 이벤트) | fill 시점 최신 재평가로 binding decision 생성, fail-closed 기본값, 감사 이벤트 | P-F1~F10, P-E1~E3, E2E-5 |
| **L3 Execution & Routing** | venue 목록·route 힌트·VenueSelector preview, 요청↔답안지 사전 대조 (UX) | dispatch 시점 decisionHash binding 검증, nonce/deadline 소비, suspend/registry 상태 읽기 | R-F1~F8, R-E1~E3 |
| **L4 Venue (Adapter)** | venue 선택, quote/order authoring·서명, matching 회계(계산) | 콜백 origin·서명·잔여수량·zero-residual을 atomic tx 안에서 검증 (집행 순간) | A-F1~F4, Q-F1~F7, O-F1~F6 |
| **L5 Deployment & Operations** | preflight 산출, manifest 대조, checkpoint/resume, indexing/monitoring/alert | 활성화 gate(owner), role 분리, suspend/pause/delist 상태를 런타임에 읽기 | D-P*, D-O*, D-R*, D-A* |

각 레이어에서 백엔드는 계산 절반을 가질 수 있지만, "백엔드가 X를 막는다"는 주장은
백엔드를 거치지 않는 공격자(R-E2, A-F1) 앞에서는 거짓이 된다.

## L5 상세: 두 개의 렌즈로 분류

L5는 런타임 거래 흐름과 직교하는 수직 축이다. 두 렌즈로 본다.

- **렌즈 1 (계산 vs 집행)**: 모든 L5 항목은 "기대값을 계산하고 drift를 검출"하는
  절반과 "실제로 활성화를 거부/전송을 차단/키를 회수"하는 절반을 가진다. 백엔드는
  **모든 항목의 계산 절반**을 가질 수 있다 (preflight·reconciliation은 hot path
  밖이다).
- **렌즈 2 (가: 런타임과 중복 vs 나: 유일한 집행)**: 집행 절반이 어디 있어야
  하는지는 **"검사가 틀렸을 때 무슨 일이 일어나는가"**가 결정한다.
  - **(가) 런타임 온체인 강제와 중복** → 틀려도 가스/UX만 손실, 자금 안전 → 백엔드로
    이동 가능 (검출·조기 gate로).
  - **(나) 유일한 집행** → 틀리면 자금/정책 위험, 런타임 backstop 없음 → 집행은
    온체인에 남고, 백엔드는 **검출·alert만** 가능.

### Preflight 블록 (D-P*) — 대부분 (가)

| 시나리오 | 분류 | 백엔드 가능 (계산) | 틀렸을 때 실패 모드 | 비고 |
|---|---|---|---|---|
| D-P1 Pool 미등록 | 가 | isVerified(Pool) 계산·활성화 gate | **가스/UX** — T-F5가 transfer 순간 revert, 자금 안전 | 단, 의존하는 backstop(T-F5)이 **온체인**일 때만 중복 성립 |
| D-P2 RWA-RWA 한쪽만 등록 | 가 | 양측 isVerified 계산 | **가스/UX** — 미등록 방향이 자기 ERC-3643에서 revert | D-P1의 양면 |
| D-P4 Policy UNKNOWN/비활성 | 가 | 활성화 결정 | **가스/UX** — Engine이 fill에서 fail-closed (P-F1/F2/F10) | 이 중복은 **policy 상태 읽기가 온체인(나)일 때만** 성립. 읽기를 백엔드로 옮기면 (나)로 변함 |
| D-P5 Operator 미등록/비활성 | 가 | OperatorRegistry 상태 계산 | **가스/UX** — fill에서 P-F9/Q-F4가 온체인 읽기로 거부 | 진짜 집행은 fill 시점 OperatorRegistry 읽기 |
| D-P8 허용 외 fee tier | 백엔드 | 프로필 정책 결정 | **UX/경제성** — 자금/정책 위험 없음 | 가장 명확히 demotable. 보안 경계 아님 |
| D-P3/D-R2 Adapter 코드해시 ≠ manifest | 경계 | EXTCODEHASH 대조·활성화 거부·alert | **혼합** — 잘못된 impl이 온체인 invariant를 지키면 가스/UX, 악성이면 자금/정책 | 자동 revert backstop 없음. "기능하지만 잘못된 Adapter"는 가/나 사이. 활성화 gate(어떤 Adapter를 Router가 신뢰하는가)는 **권한 분리된 온체인 Registry write**여야 함 |
| D-P6/D-R4 deployer 권한 미회수 | 나(인접) | manifest vs 온체인 owner 대조 | **자금/정책** — 잔존 deployer 키가 god-mode | 런타임 backstop 없음. 백엔드는 검출·활성화 차단만, 실제 안전은 온체인 role 상태 |
| D-P7 manifest vs 온체인 불일치 | 검출=백엔드 / 상태=온체인 | drift 검출·alert | **정책** — 미검출 시 잘못된 권한이 활성 유지 | reconciliation은 백엔드가 소유, 권위 있는 상태는 온체인 |
| D-R1 checkpoint resume / D-R3 manifest immutability | 백엔드 | 오케스트레이션·tooling invariant | **배포-ops/감사** — 자금 무관 | 런타임 hot path 아님 |

### 운영·권한 블록 (D-O*, D-A*) — (나), 유일한 집행

| 시나리오 | 분류 | 온체인에 남아야 하는 이유 | 틀렸을 때 실패 모드 |
|---|---|---|---|
| D-O1 venue suspend | 온체인(나) | suspend bit을 fill 시점 Router/Registry가 읽어야 함 (R-F6, R-E1). 백엔드 flag은 우회 호출자가 무시 | **정책/자금** — frozen이어야 할 venue가 계속 settle |
| D-O2 operator suspend | 온체인(나) | fill 시점 OperatorRegistry 온체인 읽기 (Q-F4, P-F9, E2E-5). 서명 시점과 무관하게 settle 순간에 유효해야 | **정책/자금** — suspend된 dealer 견적이 그대로 fill |
| D-O3 emergency pause | 온체인(나) | kill switch는 런타임 경로가 온체인으로 읽어야 작동. **언제** pause할지는 백엔드 결정, pause **상태**는 온체인 | **자금/정책** — 사고 중에도 계속 settle |
| D-O4 token delist | 온체인(나) | delisted 상태를 온체인 fail-closed로 읽음 (P-F3). mapping 부재를 UNREGULATED로 보지 않음 (no permissive default) | **정책** — delisted RWA가 일반 ERC-20으로 silent 라우팅 |
| D-A1 정책키 = 실행키 | 온체인(나) | 분리 자체가 보안 통제. 단일 키로 정책 수정 후 실행. 보상하는 런타임 guard 없음 | **정책 우회/자금** — 단일 키 탈취로 정책 재작성 후 실행 |
| D-A2 등록키 = 거래키 | 온체인(나) | **A-F1로도 못 막음**: 콜백 origin 검증은 *미등록* FakePool만 막는다. 이 키는 FakePool을 *합법 등록*해 A-F1을 통과시키고 self-deal | **자금** — 정당 등록된 가짜 venue로 자기 거래 빼돌리기 |
| D-A3 pause 권한 부재/분실 | 온체인(나) | pause capability(D-O3가 행사)가 도달 가능한 온체인 role로 존재해야 함. 분실 시 사고 중 정지할 백엔드 대체재 없음 | **자금/정책** — D-O3 backstop 자체가 불능 |

핵심 판별 질문: **"이 L5 검사가 틀리거나 생략돼도 여전히 발동하는 온체인 런타임
guard가 있는가?"** 있으면 (가), 백엔드로 demote 가능. 없으면 (나), 집행은 온체인에
남고 백엔드는 검출·alert만.

## 왜 백엔드로는 안 되는가 (우회 논증)

백엔드 차단은 **자발적으로 백엔드를 경유하는 정직한 사용자에게만** 작동한다. 공개
체인에서는 그렇지 않다.

- **R-E2 (직접 pool 호출)**: [`execution-routing.md`](./architecture/execution-routing.md)이
  명시한다 — "Router를 지원 진입점으로 둔다고 표준 pool 직접 호출이 기술적으로
  차단되는 것은 아니다", "MVP v1의 Layer 2 compliance 보장은 Router 지원 경로에
  한정한다." 직접 호출자는 백엔드를 거치지 않는다.
- **A-F1 (FakePool)**: 공격자가 FakePool을 배포해 Adapter 콜백을 **직접** 호출한다.
  이 호출은 백엔드를 통과하지 않으므로, 같은 EVM call frame 안의 origin 검증만이
  approve된 사용자 토큰 유출을 막는다.
- **untrusted pool / bypass caller**: 신뢰할 수 없는 pool과 우회 호출자는 백엔드의
  존재를 무시한다.

따라서 "오직 백엔드에만 사는 검사"는 이 공격자들 앞에서 **검사가 없는 것과 동일**하다.
보장은 **토큰이 움직이는 순간 온체인에서 atomic하게 강제될 때만 보장**이다. 팀이
production RWA venue를 비우회 enforcement 확정 전까지 비활성으로 두기로 한 결정
(E2E-4, execution-routing Current Decisions)이 바로 "백엔드 라우팅은 보안 경계가
아니다"라는 명시적 인정이다. (주의: 발행자 IdentityRegistry whitelisting은
**온체인 발행자 통제**이지 백엔드 메커니즘이 아니며, 그 자체가 직접 호출을 "막는"
것도 아니다 — 화이트리스트된 pool도 직접 호출될 수 있다.)

## 이걸 다 온체인에 올렸을 때 우리 프로젝트의 엣지

엣지는 "컴플라이언스 기능이 더 많다"가 아니다. 백엔드도 같은 allow/deny 목록·견적·
라우팅을 계산할 수 있다. 엣지는 **집행의 위치(location-of-enforcement)**라는 구조적
사실이며, 공격자가 실제로 노리는 부분에서 이긴다.

- **A-F1 콜백 origin 강제 (가장 반박하기 어려운 엣지)**: Adapter가 사용자 approve를
  들고 있고, FakePool은 콜백을 직접 호출해 백엔드를 절대 거치지 않는다. transferFrom과
  같은 call frame의 온체인 origin/registry 검증만이 유출을 막는다. permissioned-backend
  경쟁자는 이 순간 **구조적으로 부재**한다.
- **비우회성 (정직하게 한정)**: 엣지는 "우회를 막는다"가 아니라 "우회자도 발행자
  ERC-3643 transfer enforcement에는 묶이며(R-E2), 비우회 enforcement 확정 전까지
  production RWA venue는 비활성"이다. 백엔드 경쟁자는 우회자에게 보호도 잔여 보장도
  제로다.
- **Atomicity (Corner Store 경로 한정)**: 단일 트랜잭션 Adapter 합성이 multi-leg
  swap을 all-or-nothing으로 만든다(E2E-3). 백엔드 outage·race·compromise가
  정책 위반/반쪽 거래를 settle시킬 수 없다. 토큰 단독 속성으로 주장하지 않는다(E2E-4).
- **결정 시점 binding (fill 재평가)**: 백엔드는 quote 시점에 인가하면 공격자가 이미
  쥔 권한을 회수할 수 없다. Corner Store는 settlement 권한을 fill 순간 온체인 평가에만
  묶는다(P-E1/P-E3, "settlement 권한은 fill 트랜잭션의 최신 평가에서만"). 증거: 12시간
  유효 견적도 SUSPEND 후 fill에서 막힘(E2E-5).
- **decisionHash binding**: 인가를 actor/token/amount/venue/version/expiry/nonce에
  묶인 **비양도·단발·context-lock** 자격증명으로 만든다(R-F2/R-F7/P-E2). 다른 context로
  재사용하려는 공격자는 백엔드에 자발적으로 묻지 않으므로 dispatch 시점 온체인 검증만
  유효하다.
- **fail-closed 불변식**: UNKNOWN/SUSPENDED/delisted 기본 거부가 **컨트랙트 invariant**
  다(README Cross-Layer Rule, P-F1/P-F10/D-O4). 백엔드 misconfiguration·downtime으로
  열 수 없다.
- **role 분리 (D-A1/D-A2)**: 온체인 분리는 공격자에게 독립된 키들을 동시 탈취하도록
  강제한다. 백엔드 "DB상 admin role"은 암호학적 분리도, 누가 무엇을 쥐는지의 공개
  검증성도 없다. D-A2는 특히 A-F1로도 못 막는 (나) 사례라 날카롭다.
- **온체인 suspend/pause/delist (D-O1~O4)**: 온체인 상태가 뒤집히는 즉시 ERC-3643
  gate를 치는 우회자까지 **모든 호출자**에게 효력. 백엔드 kill switch는 poll하는
  트래픽만 멈춘다.
- **non-custodial (AMM 경로 한정)**: zero-residual invariant가 운영자 custody honeypot과
  custodial 라이선스 의무를 없앤다(A-F4, R-E3). 단 이 invariant는 "custody를 가지지
  않는 경로(AMM)"만 보장한다 — RFQ/OB가 토큰을 보유하는지는 미해결
  ([`token-and-identity.md`](./architecture/token-and-identity.md) Open Decisions)이라,
  해결 전까지 확대 주장 금지.
- **검증 가능한 온체인 감사**: reason-code 이벤트가 실제 settlement에 묶이고 운영자가
  변조 불가하다. 단 정확한 경계 — 온체인 강제는 "승인된 versioned 정책이 적용됐고 왜
  허용/거부됐는지"를 증명하지, **정책 내용의 법적 정당성**을 증명하지 않는다(README
  Product Boundary, compliance-policy Trust Boundary).

**엣지가 아닌 것**: (가)-class preflight(D-P1/D-P3). 런타임 강제와 중복이라 틀려도
가스/UX 손실뿐이며, 백엔드 경쟁자도 동등하게 할 수 있다. 여기서 엣지를 주장하면 진짜
moat(나-class 유일 집행 + 환원 불가 온체인 3종)가 흐려진다.

## 결론

**백엔드 = 두뇌(계산·결정·오케스트레이션), 온체인 = 손(집행·강제·전송 순간).**
보장은 토큰이 움직이는 순간 온체인에서 atomic하게 강제될 때만 보장이며, 공격자가
무시할 수 있는 컴포넌트(백엔드)에 집행을 위임하는 순간 그것은 단지 정책이 된다.

---

참고: 레이어 정의 [`layers-overview.md`](./layers-overview.md) · 시나리오
[`layer-scenarios.md`](./layer-scenarios.md) · 정식 책임 [`architecture/`](./architecture/README.md)
([execution-routing](./architecture/execution-routing.md) ·
[compliance-policy](./architecture/compliance-policy.md) ·
[token-and-identity](./architecture/token-and-identity.md) ·
[deployment-operations](./architecture/deployment-operations.md)). 충돌 시 architecture/가 정답.
