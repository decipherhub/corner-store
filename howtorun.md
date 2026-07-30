# Corner Store 실행 및 시연 가이드

## 가장 빠른 통합 시연

이 방법은 별도로 Anvil이나 각 서비스를 켤 필요 없이 다음 과정을 한 번에
실행합니다.

1. 로컬 Anvil 시작
2. production 배포와 같은 구현을 사용하는 Corner Store core 배포
3. 데모용 ERC-3643/ONCHAINID 자산, Mock TA claim, 정책과 Maker 재고 주입
4. 배포 artifact 검증과 CLI onboarding
5. RFQ backend, Operator API, Dashboard 시작
6. Router를 통한 정상 매수·매도와 컴플라이언스 거부 경로 검증

> 이 시연은 실제 production core 배포 경로를 재사용하지만, 자산·신원·가격·
> 계정·재고는 로컬 데모 fixture입니다. 실제 TA/Securitize 또는 메인넷
> 온보딩 결과로 취급하면 안 됩니다.

### 1. 저장소 루트로 이동

```bash
cd /path/to/corner-store
```

현재 위치를 확인합니다.

```bash
pwd
test -f scripts/showcase.sh && echo "Corner Store root"
```

### 2. 실행 계획 확인

```bash
scripts/showcase.sh --plan
```

이 명령은 트랜잭션이나 프로세스를 시작하지 않습니다. 다음 항목만 확인합니다.

- 자산 프로필: 기본값 `buidl-like`
- 실행 모드: 기본값 `rfq`
- Anvil/RFQ backend/Operator API/Dashboard 포트
- production core 배포와 demo activation의 분리
- 생성될 deployment artifact 경로

### 3. 통합 데모 실행

```bash
scripts/showcase.sh
```

스크립트가 자동 검증을 마치면 마지막에 다음과 같은 주소를 출력합니다.

```text
Demo is ready: http://127.0.0.1:8790
RFQ backend: http://127.0.0.1:8787
Press Ctrl-C to stop all demo services.
```

실행 중인 터미널은 닫지 말고 브라우저에서 Dashboard 주소를 엽니다.

### 4. 발표용 시연 순서

#### A. 환경과 배포 결과 확인

1. 화면 상단의 `Local Anvil`, `Mock TA` 표시를 먼저 설명합니다.
2. Environment 영역에서 배포된 Router와 RFQ Adapter 주소를 확인합니다.
3. 주소가 화면에 하드코딩된 값이 아니라
   `deployments/anvil-e2e.json`에서 전달된 값임을 설명합니다.

핵심 설명:

> 같은 production core 배포 구현으로 컨트랙트를 배포한 뒤, 로컬 시연에만
> Mock TA·정책·Maker·재고를 별도 주입했습니다. 이후 backend와 Dashboard는
> 동일한 deployment artifact를 사용합니다.

#### B. 적격 투자자의 정상 RFQ 체결

1. 우측 상단 지갑 선택에서 적격 투자자를 선택합니다.
2. `RFQ 거래`로 이동합니다.
3. `매수` 또는 `매도`, 수량과 만료시간을 선택합니다.
4. Compliance Pre-check가 통과하는지 확인합니다.
5. `Request Quote`를 누릅니다.
6. `My RFQs`에서 live firm quote를 선택하고 가격, 금액, 만료시간과
   taker/nonce를 검토합니다.
7. `Accept`를 눌러 Router 체결을 실행합니다.
8. 성공 transaction과 잔액 변화를 확인합니다.
9. `Portfolio`와 가격/체결 차트에 성공한 거래가 반영되는지 확인합니다.

매수는 투자자가 quote asset을 Maker에게 지급하고 RWA token을 받는 거래입니다.
매도는 투자자가 RWA token을 지급하고 quote asset을 받는 반대 거래입니다.

#### C. 비적격 투자자 차단

1. 지갑 선택에서 비적격 투자자를 선택합니다.
2. `RFQ 거래`에서 Pre-check 실패 사유를 확인합니다.
3. 거래가 허용되지 않고 `Qualified Purchaser claim missing` 등 현재 정책의
   reason이 표시되는지 확인합니다.

Pre-check는 사용자 편의를 위한 예상 결과입니다. 최종 자산 이동 전에는 Router가
온체인 상태를 다시 검사합니다.

#### D. Quote 발급 후 Claim 만료

1. `Admin`으로 전환합니다.
2. `Enforcement Cases`에서 `Quote 이후 claim 만료`를 선택합니다.
3. 화면 순서대로 기준 상태 준비 → quote 발급 → 시간 경과 → 실행 제출을
   각각 진행합니다.
4. quote 자체는 아직 유효하지만 QP claim이 만료되어 Router가 체결을
   거부하는지 확인합니다.
5. 실패 transaction, reasonCode와 잔액 불변 증거를 확인합니다.

#### E. Quote 발급 후 Maker 승인 취소

1. `Admin`의 `Enforcement Cases`에서 `Quote 이후 Maker 취소`를 선택합니다.
2. 승인된 Maker의 quote를 먼저 발급합니다.
3. quote 발급 후 Maker 상태를 취소합니다.
4. 저장된 quote를 실행해 `RFQMakerNotApproved`로 거부되는지 확인합니다.
5. 다음 정상 거래를 위해 `Maker 관리`에서 Maker를 복구합니다.

#### F. Adapter 직접 호출 우회 차단

1. `Admin`의 `Enforcement Cases`에서 `Adapter 직접 호출`을 선택합니다.
2. 직접 호출을 제출합니다.
3. RFQ Adapter가 Router 이외 호출자를 거부하고 자산 이동이 없는지 확인합니다.

### 5. 시연 중 확인할 핵심

- 정상 체결만 Portfolio, 거래량과 체결 차트에 반영됩니다.
- 거부된 거래는 잔액과 시장 데이터에 영향을 주지 않습니다.
- quote 발급 시점의 Pre-check가 최종 체결을 보장하지 않습니다.
- Router는 체결 직전에 최신 투자자 claim과 Maker 승인을 다시 검사합니다.
- RFQ Adapter 직접 호출로 Router 검사를 우회할 수 없습니다.
- 배포 주소는 deployment artifact를 통해 backend와 UI에 전달됩니다.

### 6. 종료

`scripts/showcase.sh`를 실행한 터미널에서:

```text
Ctrl-C
```

Anvil, RFQ backend, Operator API와 Dashboard가 함께 종료됩니다.

포트가 이미 사용 중이라는 오류가 나오면 이전 시연 프로세스가 남아 있는지
확인합니다.

```bash
lsof -nP -iTCP:8545 -sTCP:LISTEN
lsof -nP -iTCP:8787 -sTCP:LISTEN
lsof -nP -iTCP:8788 -sTCP:LISTEN
lsof -nP -iTCP:8790 -sTCP:LISTEN
```

다른 포트를 사용하려면 예시 설정을 복사해 `runtime`의 네 포트를 변경합니다.

```bash
cp services/toolkit/examples/corner-store.showcase.json corner-store.showcase.json
scripts/showcase.sh --config corner-store.showcase.json --plan
scripts/showcase.sh --config corner-store.showcase.json
```

네 포트는 서로 달라야 하며, 인증 없는 로컬 데모이므로 host는
`127.0.0.1` 또는 `localhost`만 허용합니다.

---

## Deployment Studio 개별 테스트

Deployment Studio는 로컬/demo 환경에서 Corner Store 프로젝트를 생성하고,
설정 검증부터 배포하고, **그 배포 artifact와 동일한 컨트랙트 주소로 DEX
데모를 시작하는 화면**입니다.

이 흐름을 테스트할 때는 `scripts/showcase.sh`를 따로 실행하지 않습니다.
Studio의 `Start DEX demo` 버튼이 RFQ backend, Operator API와 Dashboard를
직접 시작합니다. 따라서 두 번째 stack을 다시 배포하지 않습니다.

> 현재 Studio의 직접 배포 기능은 Anvil 같은 허용된 demo 네트워크만 지원합니다.
> Mainnet 배포와 private key 입력은 지원하지 않습니다.

## 1. 사전 준비

이 문서는 Corner Store가 npm에 공개되어 있다는 전제로 작성된 것이 아닙니다.
먼저 GitHub 저장소를 clone하고, **저장소 루트 디렉터리 안에서** 실행해야 합니다.

```text
corner-store/                         ← 현재 터미널 위치
├── services/
│   ├── cli/                          ← 로컬 CLI 소스
│   ├── toolkit/                      ← 로컬 Toolkit 소스
│   └── deployment-studio/            ← 로컬 Studio 소스
└── scripts/studio.sh
```

다음 명령은 npm에서 Corner Store 제품을 내려받는 명령이 아닙니다.

```bash
npm install --prefix services/cli
npm install --prefix services/deployment-studio
```

`--prefix`는 “이 디렉터리로 이동해서 npm install을 실행하라”는 의미입니다.

```bash
# 아래 두 묶음은 동일한 의미입니다.

npm install --prefix services/cli

cd services/cli
npm install
cd ../..
```

실제로 설치되는 내용은 다음과 같습니다.

| 명령 | 하는 일 |
| --- | --- |
| `npm install --prefix services/cli` | 로컬 `services/cli/package.json`을 읽고 `commander`, `ethers`, TypeScript 등을 `services/cli/node_modules`에 설치 |
| `npm install --prefix services/deployment-studio` | 로컬 Studio의 TypeScript 의존성을 설치하고 `file:../toolkit` 선언을 통해 같은 저장소의 Toolkit을 연결 |

즉, 현재 구조는 다음과 같습니다.

```text
clone한 Corner Store 저장소
        ├─ 로컬 CLI 소스
        ├─ 로컬 Toolkit 소스
        └─ 로컬 Deployment Studio 소스
                     ↓
          npm install로 외부 의존성만 준비
                     ↓
              scripts/studio.sh 실행
```

현재 `@corner-store/cli`와 Deployment Studio를 npm public registry에서
설치하는 방식은 아닙니다. 따라서 별도 프로젝트에서 다음 명령을 실행하는
사용 방식은 아직 제공하지 않습니다.

```bash
# 현재는 이 방식이 아님
npm install @corner-store/cli
```

`npm install`은 최초 실행 또는 lockfile/의존성이 변경된 경우에만 다시 실행하면 됩니다.

Foundry의 `anvil` 명령도 설치되어 있어야 합니다.

## 2. Anvil 실행

첫 번째 터미널:

```bash
anvil --host 127.0.0.1 --port 8545
```

`8545`가 사용 중이면 다른 포트를 지정할 수 있습니다.

```bash
anvil --host 127.0.0.1 --port 18545
```

## 3. Deployment Studio 실행

두 번째 터미널:

```bash
scripts/studio.sh \
  --host 127.0.0.1 \
  --port 8791 \
  --rpc http://127.0.0.1:8545 \
  --operations-url http://127.0.0.1:8790
```

Anvil을 `18545`에서 실행했다면 `--rpc`도 동일하게 변경합니다.

```bash
scripts/studio.sh \
  --host 127.0.0.1 \
  --port 8791 \
  --rpc http://127.0.0.1:18545 \
  --allowed-rpc-hosts 127.0.0.1 \
  --operations-url http://127.0.0.1:8790
```

브라우저에서 터미널에 출력된 주소를 엽니다.

```text
http://127.0.0.1:8791
```

주소와 포트는 고정된 제품 값이 아닙니다. CLI 옵션 또는
`CORNER_STORE_*` 환경변수로 실행 환경에 맞게 주입할 수 있습니다.

전체 옵션:

```bash
scripts/studio.sh --help
```

## 4. 화면 테스트 순서

1. 새 프로젝트를 생성합니다.
2. Integration Mode에서 데모에 가장 적합한 `reference-service`를 선택합니다.
   각 카드의 `?`를 누르면 생성되는 것과 직접 구현할 부분을 확인할 수 있습니다.
3. Asset Profile과 RFQ venue를 설정합니다.
   Arbitrum, GIWA 또는 Custom EVM은 설정과 Dry-run 검토까지만 지원하며
   Studio에서 직접 broadcast하지 않습니다.
4. 설정을 저장합니다.
5. **Run Doctor**를 실행해 필수 항목이 통과하는지 확인합니다.
6. **Review Dry-run**으로 실행할 배포 계획과 RPC를 확인합니다.
7. **Deploy Demo**를 실행합니다.
8. 진행 로그가 완료되고 deployment artifact가 생성되는지 확인합니다.
9. **Verify Artifact**를 실행합니다.
10. Artifact Viewer에서 Router, RFQ Adapter 등 배포 주소를 확인합니다.
11. **Start DEX demo**를 누릅니다.
12. 상태가 `DEX running on verified deployment`로 바뀌는지 확인합니다.
13. **Open DEX**를 눌러 Dashboard를 엽니다.
14. Dashboard Environment의 Router 주소와 Studio Artifact Viewer의 Router
    주소가 같은지 확인합니다.
15. 정상 RFQ와 거부 시나리오를 시연합니다.
16. 종료할 때 Studio에서 **Stop DEX**를 누릅니다.

`Start DEX demo`는 다음 값을 자동으로 전달합니다.

| 대상 | 전달되는 값 |
| --- | --- |
| RFQ backend | Studio가 생성한 artifact, project scenario, 실제 배포 RPC |
| Operator API | project config, 동일 artifact, runtime event 파일 |
| Dashboard | 방금 시작한 RFQ backend와 Operator API URL |

다른 RPC를 입력하거나 artifact/config/scenario가 Verify 이후 변경되면 DEX
시작이 차단됩니다. Studio에서 다시 배포하고 Verify해야 합니다.

Module 항목은 임의 문자열을 입력하는 기본 form이 아닙니다. 제공되는 reference
또는 integrator adapter를 선택하고, 직접 구현한 모듈이 있을 때만
`Custom module ID`를 선택합니다. Custom ID를 입력해도 패키지가 자동 설치되지는
않으며 해당 capability 구현은 실행 환경에서 별도로 제공해야 합니다.

Activation Checklist는 실제 Maker 승인, signer 권한 부여 또는 token allowance
트랜잭션을 실행하지 않습니다. 운영자가 해당 온체인 작업과 smoke settlement를
확인했다는 사실만 기록합니다. 로컬 reference stack의 데모 초기 상태는
`DeployStack`이 주입하며, Dashboard 거래는 그 상태와 동일 artifact를 사용합니다.

설정이나 RPC를 변경하면 기존 Doctor/Dry-run 증거가 무효화됩니다.
이 경우 Doctor와 Dry-run을 다시 실행해야 배포할 수 있습니다.

## 5. 확인해야 할 실패 시나리오

- Anvil이 꺼진 상태에서는 Doctor 또는 배포가 정상적으로 차단되는지
- Dry-run에 사용한 RPC와 다른 RPC로 배포할 때 차단되는지
- 허용되지 않은 RPC host 또는 demo network가 아닌 설정에서 직접 배포가 차단되는지
- 설정을 변경한 뒤 이전 Verify/Handoff 상태가 그대로 사용되지 않는지
- 브라우저를 통하지 않은 인증 없는 변경 요청이 거부되는지

## 6. 종료

Studio와 Anvil을 실행한 각 터미널에서:

```text
Ctrl-C
```

포트가 남아 있는지 확인하려면:

```bash
lsof -nP -iTCP:8545 -sTCP:LISTEN
lsof -nP -iTCP:8791 -sTCP:LISTEN
```

## 7. 전체 자동 검증

```bash
scripts/check.sh
```

현재 기준으로 다음 항목이 포함됩니다.

- Solidity format, lint, build, test
- RFQ, CLI, Toolkit 및 관련 서비스 smoke test
- Deployment Studio build 및 smoke test
- vendored Uniswap v3 deployment tests
