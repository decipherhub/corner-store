# Corner Store 레이어별 시나리오 (이해용)

> 이 문서는 신규 합류자와 팀원이 각 레이어가 **어떤 입력**에서 **어떤 결정**을
> 내리는지 시나리오로 익히기 위한 정리본이다. 정식 책임은
> [`architecture/`](./architecture/README.md), 제품 범위는
> [`MVP-v2-multi-venue.md`](./MVP-v2-multi-venue.md), 구현 순서는
> [`ROADMAP.md`](./ROADMAP.md)를 우선한다.
>
> 레이어 정의는 [`layers-overview.md`](./layers-overview.md)에 있다. 이 문서는
> 그 위에서 시나리오만 정리한다.

## 시나리오 표기 규칙

- **결과 ✅**: 거래/단계 성공
- **결과 ❌**: 거부, revert, 활성화 차단
- **결정자**: 어느 레이어/컴포넌트가 그 결과를 만들었는가
- **사용자 영향**: 자산 이동 여부, 가스 소비, UX

각 시나리오는 **사전 거부**(자산 이동 없음)와 **실행 중 거부**(롤백)를 구분한다.

---

## Layer 1 — Token & Identity

> 토큰의 `transfer()` 안에서 ERC-3643이 자동 실행. Corner Store는 호출자.

### 성공 시나리오

| # | 입력 | 결과 | 결정자 |
|---|---|---|---|
| T-S1 | verified 수신자, 보유 한도 내, 허용 국가 | ✅ transfer 실행 | ERC-3643 `canTransfer=true` |
| T-S2 | RWA→USDC 매도 (RWA를 받는 Pool 등록됨) | ✅ Pool에 RWA 전송 | IdentityRegistry에 Pool 등록 |
| T-S3 | RWA-RWA pair, 양쪽 IdentityRegistry 모두 Pool 등록 | ✅ 양방향 transfer 가능 | 양쪽 발행자 |

### 거부 시나리오 (실행 중 거부 = 전체 롤백)

| # | 조건 | 결정자 | 영향 |
|---|---|---|---|
| T-F1 | 수신자가 IdentityRegistry 미등록 | `isVerified=false` | swap 전체 revert, 가스 소비 |
| T-F2 | 수신자 보유 한도 초과 | 발행자 MaxBalance module | revert |
| T-F3 | 수신자가 차단 국가 | 발행자 CountryAllow module | revert |
| T-F4 | 발행자가 sender 계정 동결 | 발행자 compliance | revert |
| T-F5 | Pool이 IdentityRegistry 미등록인 채 swap 진입 | `isVerified(Pool)=false` | Pool로 RWA 보내는 순간 revert |

### 알아둘 점

- ERC-3643 검사 통과 ≠ 거래 허용. **거래 측 규칙(Layer 2)**은 별도.
- ERC-3643이 거부하면 Layer 2~4가 통과시켰어도 **전체 트랜잭션 롤백**. atomicity 보장됨.
- T-F5는 사실 **Layer 5 preflight로 막혀야 할 상황**. 활성화 시 검사 안 했으면 user 가스 낭비로 노출됨.

---

## Layer 2 — Compliance Policy

> `ComplianceEngine`이 거래 context를 평가해 `ComplianceDecision`을 생성.
> 실행 시점에 매번 재평가 (preview 결정은 권한 입력으로 받지 않음).

### 성공 시나리오

| # | 입력 (context) | 결정 | 비고 |
|---|---|---|---|
| P-S1 | RWA-X, ACTIVE policy, 적격투자자 buyer, AMM 요청, 금액 한도 내 | `allowed=true, allowedVenueTypes={AMM}, maxAmount=…` | 정상 |
| P-S2 | USDC ↔ USDT (양쪽 UNREGULATED 명시 등록) | `allowed=true`, public venue fast path | 명시적 UNREGULATED만 |
| P-S3 | RWA-X (ACTIVE) ↔ USDC (UNREGULATED), buyer 적격 | regulated 정책으로 전체 context 평가 후 `allowed=true` | 한쪽이 ACTIVE면 fast path 금지 |

### 거부 시나리오 (사전 거부 = 자산 이동 없음, 가스만 소비)

| # | 조건 | reason code 후보 | 비고 |
|---|---|---|---|
| P-F1 | policy 상태 `UNKNOWN` (등록 안 됨) | `POLICY_UNKNOWN` | fail-closed. UNREGULATED로 자동 추론 금지 |
| P-F2 | policy 상태 `SUSPENDED` | `POLICY_SUSPENDED` | 운영자 일시중단 |
| P-F3 | token delisted | `POLICY_DELISTED` | 일반 ERC-20 경로로 자동 전환 금지 |
| P-F4 | lockup 기간 미충족 (Rule 144 등) | `LOCKUP_VIOLATION` | LockupElement 거부 |
| P-F5 | buyer가 적격투자자 아님 (Reg D 506(c) 등) | `INVESTOR_NOT_ACCREDITED` | AccreditedInvestorElement |
| P-F6 | sender/receiver OFAC 제재 명단 | `SANCTIONED_PARTY` | SanctionsElement |
| P-F7 | 요청 venue type이 정책 허용 범위 밖 | `VENUE_TYPE_NOT_ALLOWED` | 예: 대량은 RFQ만 허용인데 AMM 요청 |
| P-F8 | 금액이 정책 maxAmount 초과 | `AMOUNT_EXCEEDS_LIMIT` | |
| P-F9 | operator/dealer suspended | `OPERATOR_SUSPENDED` | OperatorRegistry |
| P-F10 | mixed pair 한쪽 `UNKNOWN`/`SUSPENDED` | `POLICY_UNKNOWN`/`POLICY_SUSPENDED` | 어느 쪽이라도 막히면 거부 |

### Edge / 시간 의존 시나리오

| # | 조건 | 결과 |
|---|---|---|
| P-E1 | 주문/견적 생성 시점엔 통과, fill 시점엔 policy 변경됨 | fill 시점 재평가에서 거부 — Engine은 **최신** version 평가 |
| P-E2 | 같은 사용자가 다른 token에 decision 재사용 시도 | `decisionHash` mismatch → 거부 |
| P-E3 | preview decision을 그대로 execution 권한으로 입력 | 무시. 실행 권한은 fill 시점 평가에서만 생성 |

---

## Layer 3 — Execution & Routing

> `ExecutionRouter`가 요청과 Engine의 decision을 대조하고 Adapter로 dispatch.
> 매칭 로직과 법률 규칙은 들고 있지 않음.

### 성공 시나리오

| # | 입력 | 결과 |
|---|---|---|
| R-S1 | decision: AMM 허용, user: AMM 요청, 파라미터 일치 | UniswapV3Adapter로 dispatch ✅ |
| R-S2 | decision: 여러 venue 허용, user가 그 중 하나 명시 | 명시된 venue로 dispatch ✅ |
| R-S3 | 일반 ERC-20 fast path (양쪽 UNREGULATED) | public AMM venue로 직접 라우팅 ✅ |

### 거부 시나리오 (사전 거부)

| # | 조건 | reason code 후보 |
|---|---|---|
| R-F1 | user가 RFQ 요청, decision은 AMM만 | `REQUEST_VENUE_MISMATCH` |
| R-F2 | user가 명시한 venue 주소가 decision의 allowedVenuesHash와 불일치 | `VENUE_BINDING_MISMATCH` |
| R-F3 | user 요청 amount > decision.maxAmount | `AMOUNT_EXCEEDS_DECISION` |
| R-F4 | nonce 재사용 | `NONCE_REUSED` |
| R-F5 | deadline 초과 (validUntil 또는 user-supplied) | `DEADLINE_EXCEEDED` |
| R-F6 | Adapter가 VenueRegistry에 미등록 또는 suspended | `ADAPTER_NOT_REGISTERED` / `ADAPTER_SUSPENDED` |
| R-F7 | decisionHash가 다른 actor/token/venue에 바인딩됨 | `DECISION_BINDING_MISMATCH` |
| R-F8 | decision의 policyVersion이 현재 policy 최신 버전이 아님 | `POLICY_VERSION_STALE` |

### Edge

| # | 조건 | 결과 |
|---|---|---|
| R-E1 | decision 발급 후 venue가 그 사이 suspend됨 | Router가 fill 직전 재평가에서 거부 |
| R-E2 | Router 우회한 표준 pool 직접 호출 | Layer 2 보장 없음. 단 ERC-3643 transfer enforcement는 적용됨 |
| R-E3 | Router 컨트랙트에 의도하지 않은 잔액이 남는 swap | invariant 위반 — 설계상 발생하면 안 됨 |

---

## Layer 4 — Venue (Adapter)

> Adapter가 venue 고유 프로토콜 검증 후 실제 swap/fill을 실행.

### 4-1. AMM (UniswapV3Adapter)

#### 성공
| # | 입력 | 결과 |
|---|---|---|
| A-S1 | 등록된 Pool, callback origin = 그 Pool, 파라미터 binding 일치 | `swap()` 성공, tokenOut 전송, Adapter 잔액 0 |

#### 거부 (실행 중 거부 = 롤백)
| # | 조건 | reason / behavior |
|---|---|---|
| A-F1 | FakePool이 `uniswapV3SwapCallback`을 직접 호출 | 콜백 origin 검증 실패 → revert. 사용자 토큰 보호 |
| A-F2 | swap params(sqrtPriceLimit, deadline 등)이 decision binding과 불일치 | revert |
| A-F3 | Pool이 VenueRegistry에 미등록 | dispatch 자체가 안 됨 (Router 레벨이 막아야 함) |
| A-F4 | callback 후 Adapter에 잔여 토큰 발생 | invariant 위반 — non-custodial 원칙 |

### 4-2. RFQ Adapter

#### 시나리오 흐름
```
Alice(taker) ↔ Bob(maker, dealer) 오프체인 협상
  → Bob이 EIP-712 quote 서명
  → Alice가 fillQuote(quote, signature) on-chain 호출
```

#### 성공
| # | 입력 | 결과 |
|---|---|---|
| Q-S1 | 유효 서명, 미만료, 미사용 nonce, 인가 dealer, 지정 taker 일치, fill 시 compliance 통과 | settle ✅ |

#### 거부
| # | 조건 | reason |
|---|---|---|
| Q-F1 | 서명 위조 또는 잘못된 signer | `INVALID_SIGNATURE` |
| Q-F2 | 견적 만료 | `QUOTE_EXPIRED` |
| Q-F3 | nonce 이미 사용 (replay) | `NONCE_REUSED` |
| Q-F4 | maker가 OperatorRegistry에서 미등록/suspended | `DEALER_NOT_AUTHORIZED` |
| Q-F5 | 견적은 Alice 전용인데 Charlie가 호출 | `TAKER_MISMATCH` |
| Q-F6 | 파라미터(token/amount/price)가 서명된 견적과 불일치 | `QUOTE_PARAMS_MISMATCH` |
| Q-F7 | 견적 발행 후 maker가 OFAC 등에 추가됨 | fill 시 재검증에서 Layer 2 거부 |

### 4-3. Order Book Adapter

#### 시나리오 흐름
```
Bob: "RWA-X 100개 매도, USDC 1.5/개" → 서명된 order 호가창에 게시
Alice: 50개 부분 체결
나중에 Charlie: 나머지 50개 체결 시도
```

#### 성공
| # | 입력 | 결과 |
|---|---|---|
| O-S1 | 서명된 order, 미취소, 잔여 수량 내 fill, matcher 인가, fill 시 compliance 통과 | partial/full fill ✅ |

#### 거부
| # | 조건 | reason |
|---|---|---|
| O-F1 | Bob이 그 사이 order cancel | `ORDER_CANCELLED` |
| O-F2 | Alice 50 + Charlie 51 (51 > 잔여 50) | `FILL_EXCEEDS_REMAINING` |
| O-F3 | order 만료 | `ORDER_EXPIRED` |
| O-F4 | 시장 지정 matcher가 아닌 자가 fill 트리거 | `MATCHER_NOT_AUTHORIZED` |
| O-F5 | order 게시 시점엔 통과, fill 시점에 maker가 suspend | 재검증에서 거부 |
| O-F6 | nonce 또는 order ID 재사용 | `ORDER_REUSED` |

### Adapter 공통 invariant

- Adapter가 custody를 가지지 않는 경로(AMM)에선 잔여 잔액 없음
- fill 시점 compliance 재검증을 주문/견적 생성 시점 검사로 대체하지 않음
- 다른 venue의 request/decision을 가져와서 fill 불가

---

## Layer 5 — Deployment & Operations

> 런타임 거래 흐름과 다른 축. 배포·활성화·권한·suspension·복구 책임.

### Preflight (venue 활성화 전 차단)

| # | 조건 | 차단 효과 |
|---|---|---|
| D-P1 | Pool 주소가 발행자 IdentityRegistry에 미등록 | AMM venue 활성화 차단 |
| D-P2 | RWA-RWA pair에서 한쪽 IdentityRegistry만 등록됨 | venue 활성화 차단 |
| D-P3 | Adapter 코드 해시가 manifest 기대값과 다름 | 활성화 차단 (잘못된 implementation 보호) |
| D-P4 | Policy 상태가 `UNKNOWN` 또는 비활성 | venue 활성화 차단 |
| D-P5 | Operator가 등록되지 않았거나 비활성 | venue 활성화 차단 |
| D-P6 | deployer 임시 권한이 final owner(multisig)로 미이전 | production 활성화 차단 |
| D-P7 | manifest와 on-chain owner/role/config 불일치 | 활성화 차단, alert |
| D-P8 | 허용 외 fee tier (예: 1bp 미허용) | venue 활성화 차단 |

> Preflight를 빠뜨리면 → user의 매 swap이 런타임에서 실패 (T-F5처럼 ERC-3643 revert).
> 가스 낭비와 사용자 신뢰 손실. 활성화 시점 한 번의 검사로 막아야 한다.

### 운영 중 시나리오

| # | 트리거 | 결과 |
|---|---|---|
| D-O1 | 운영자가 특정 venue suspend | 신규 실행 거부, 진행 중 트랜잭션 영향 없음 |
| D-O2 | operator suspend | 해당 operator 경유 RFQ/OB fill 거부 |
| D-O3 | policy emergency pause | 전체 또는 해당 token 실행 거부 |
| D-O4 | regulated token delist | suspension + 신규 실행 거부 (UNREGULATED 자동 전환 절대 없음) |

### 배포 실패 / 복구

| # | 조건 | 처리 |
|---|---|---|
| D-R1 | 6단계 중 3단계까지 성공 후 실패 | manifest checkpoint에서 재개 |
| D-R2 | 재실행 시 저장 주소의 bytecode 변경 감지 | 단계 건너뛰지 않고 alert |
| D-R3 | production manifest 덮어쓰기 시도 | 거부 (immutable 보존) |
| D-R4 | 임시 deployer 권한이 활성화 후에도 남아있음 | handoff 미완 → production 활성화 차단 |

### 권한 분리 (이상 상태 검출)

| # | 상태 | 위험 |
|---|---|---|
| D-A1 | policy 변경 권한과 실행 권한이 같은 주소 | 단일 키 탈취로 정책 우회 가능 |
| D-A2 | venue 등록 권한과 거래 실행 권한이 같은 주소 | 가짜 venue 등록 후 자기 거래로 빼돌리기 가능 |
| D-A3 | emergency pause 권한 부재 또는 분실 | 사고 시 대응 불가 |

---

## 레이어 횡단 시나리오 (E2E)

실제 swap 한 번에 여러 레이어가 같이 동작한다. 대표 흐름 몇 개.

### E2E-1: 정상 AMM swap (RWA → USDC, 적격투자자, 매도)
```
1. [3] Router 진입, decision 요청
2. [2] Engine 평가 → allowed, AMM, maxAmount=… (ACTIVE policy, 모든 Element pass)
3. [3] Router: 요청 venue=AMM ✓, amount ≤ max ✓, nonce/deadline ✓
4. [4] UniswapV3Adapter → Pool.swap()
5. [4] Pool → Adapter.uniswapV3SwapCallback() (origin 검증 ✓)
6. [4] Adapter → RWA.transferFrom(user → Pool)
7. [1] RWA(ERC-3643).transfer: isVerified(Pool)=✓, canTransfer=✓
8. Pool → USDC.transfer(Pool → user)
9. ✅ 완료. ComplianceLogger / ExecutionLogger 이벤트 emit.
```

### E2E-2: Layer 2 거부 (lockup 미충족 매도)
```
1. [3] Router 진입
2. [2] Engine 평가 → LockupElement fail → allowed=false, reason=LOCKUP_VIOLATION
3. [3] Router → revert with reason
   사전 거부. 자산 이동 없음.
```

### E2E-3: Layer 1 거부 (수신자 미검증)
```
1~4. [2][3][4] 다 통과
5. [4] Pool → Adapter callback → Adapter → RWA.transferFrom(user → Pool)
6. [1] RWA(ERC-3643).transfer: isVerified(user 수령측)=false → revert
7. 전체 트랜잭션 롤백. 부분 이동 없음.
```

### E2E-4: 직접 Pool 호출 (Router 우회)
```
1. user → Pool.swap() 직접 호출
2. Pool → 직접 호출자에게 콜백 → 콜백 처리 안 됨 또는 비표준 흐름
3. 일부 토큰만 이동했다가 ERC-3643 단계에서 revert 또는 진행됨
   → Layer 2(Corner Store policy) 보장 없음
   → ERC-3643 transfer enforcement만 적용
   → Production RWA venue는 이런 직접 호출이 의미를 갖지 않도록 외부 승인·비우회 enforcement 확정 전 비활성
```

### E2E-5: 시간 의존 거부 (RFQ fill 사이 정책 변경)
```
t=0: Bob이 견적 서명, Alice에게 전달
t=1: 운영자가 정책 SUSPENDED 처리 (사고 대응)
t=2: Alice가 fillQuote 호출
  → [4] Adapter: 서명/만료/nonce 검증 ✓
  → [3]+[2] Router가 fill 시점 재평가 → POLICY_SUSPENDED → 거부
  결과: 견적이 12시간 유효해도 시점 평가에서 막힘
```

---

## 시나리오를 코드/테스트로 옮길 때 체크리스트

각 시나리오를 테스트로 만들 때 다음을 점검한다.

- [ ] 어느 레이어가 결정자인지 명확한가
- [ ] 사전 거부 / 실행 중 거부 / 활성화 차단 중 어느 종류인가
- [ ] 거부 시 reason code가 식별 가능한가 (관측·디버깅용)
- [ ] 부분 자산 이동 없이 atomic하게 처리되는가
- [ ] decision/nonce/decisionHash binding이 다른 context로 재사용되지 않는가
- [ ] manifest와 on-chain 상태 일관성이 유지되는가 (Layer 5 시나리오)
- [ ] suspend/pause 후 신규 실행이 거부되는가

이 체크리스트는 `ROADMAP.md`의 phase별 완료 조건과 정렬돼 있다.
