# Corner Store 배포 및 DEX 시연 가이드

이 문서는 **Deployment Studio에서 Corner Store reference stack을 배포한 뒤,
같은 deployment artifact와 같은 컨트랙트 주소로 RFQ DEX를 실행하는 방법**을
설명합니다.

## 핵심 흐름

```text
Anvil 실행
  → Deployment Studio 실행
  → 프로젝트 설정
  → Doctor
  → Dry-run
  → Deploy reference stack
  → Verify artifact
  → Start DEX demo
  → Open DEX
```

`Start DEX demo`는 별도 stack을 다시 배포하지 않습니다. Studio에서 검증한
다음 값을 RFQ backend, Operator API와 Dashboard에 그대로 전달합니다.

- deployment artifact
- Router와 Adapter 주소
- 프로젝트 config와 scenario
- 실제 배포에 사용한 RPC

처음 시작할 때는 기존 `e2e-anvil.sh`와 같은 CLI onboarding 절차를 사용해
선택한 demo Manifest와 venue를 **방금 배포한 동일 stack에서** 활성화합니다.
DEX를 중지했다가 다시 시작할 때는 완료된 onboarding을 반복하지 않습니다.

---

## 1. 저장소 루트에서 실행하기

터미널 위치가 Corner Store 저장소 루트인지 확인합니다.

```bash
cd /path/to/corner-store
pwd
test -f scripts/studio.sh && echo "Corner Store root"
```

이 문서의 모든 명령은 특별한 설명이 없는 한 이 위치에서 실행합니다.

---

## 2. 최초 1회 의존성 설치

Corner Store 패키지는 아직 npm public registry에서 설치하는 방식이 아닙니다.
clone한 저장소 안의 각 로컬 서비스를 준비하는 명령입니다.

```bash
npm install --prefix services/cli
npm install --prefix services/rfq-demo-backend
npm install --prefix services/operator-api
npm install --prefix services/deployment-studio
```

`--prefix services/cli`은 다음과 같은 의미입니다.

```bash
cd services/cli
npm install
cd ../..
```

의존성이 이미 설치되어 있다면 반복할 필요가 없습니다. Foundry의 `anvil`,
`forge` 명령도 사용할 수 있어야 합니다.

---

## 3. Anvil 실행

첫 번째 터미널에서 로컬 체인을 실행합니다.

```bash
anvil --host 127.0.0.1 --port 8545
```

이 터미널은 시연이 끝날 때까지 유지합니다.

`8545`가 이미 사용 중이면 실행 중인 프로세스를 확인합니다.

```bash
lsof -nP -iTCP:8545 -sTCP:LISTEN
```

다른 포트를 사용하려면 예를 들어:

```bash
anvil --host 127.0.0.1 --port 18545
```

이 경우 다음 단계의 `--rpc`도 `http://127.0.0.1:18545`로 맞춰야 합니다.

---

## 4. Deployment Studio 실행

두 번째 터미널에서 실행합니다.

```bash
scripts/studio.sh \
  --host 127.0.0.1 \
  --port 8791 \
  --rpc http://127.0.0.1:8545
```

스크립트가 자동으로 CLI, RFQ backend, Operator API와 Studio를 빌드한 뒤
Studio를 시작합니다.

브라우저에서 다음 주소를 엽니다.

```text
http://127.0.0.1:8791
```

기본 서비스 주소는 다음과 같습니다.

| 서비스 | 기본 주소 |
| --- | --- |
| Deployment Studio | `http://127.0.0.1:8791` |
| RFQ backend | `http://127.0.0.1:8787` |
| Operator API | `http://127.0.0.1:8788` |
| DEX Dashboard | `http://127.0.0.1:8790` |

포트는 제품에 하드코딩된 주소가 아닙니다. 필요한 경우 실행할 때 바꿀 수 있습니다.

```bash
scripts/studio.sh \
  --host 127.0.0.1 \
  --port 19791 \
  --rpc http://127.0.0.1:18545 \
  --rfq-backend-port 19787 \
  --operator-api-port 19788 \
  --dashboard-port 19790
```

사용 가능한 전체 옵션:

```bash
scripts/studio.sh --help
```

---

## 5. Studio에서 배포하기

화면에서 다음 순서대로 진행합니다.

### 5.1 프로젝트 생성

1. 새 프로젝트 이름을 입력합니다.
2. Integration Mode는 RFQ 데모를 위해 `reference-service`를 선택합니다.
3. Network는 `anvil`, RPC는 현재 실행 중인 Anvil 주소를 사용합니다.
4. Asset Profile은 `buidl-like` 또는 `reg-d`를 선택합니다.
5. Venue에서 RFQ를 활성화합니다.
6. 설정을 저장합니다.

Integration Mode의 의미:

| 모드 | 용도 |
| --- | --- |
| `library-only` | 기존 애플리케이션이 Corner Store RFQ SDK를 직접 호출 |
| `reference-service` | 제공되는 reference RFQ HTTP backend로 빠르게 통합·시연 |
| `existing-backend` | 기존 회사 backend의 pricing, risk, signer, nonce 모듈과 연결 |

현재 Studio에서 직접 broadcast하는 경로는 로컬 reference/demo 배포용입니다.
메인넷 private key를 브라우저에 입력하거나 Studio가 임의로 보관하지 않습니다.

### 5.2 배포 전 검증

다음 버튼을 순서대로 실행합니다.

1. **Run doctor**
   - Node, Foundry, 프로젝트 설정과 RPC 준비 상태를 검사합니다.
2. **Review dry-run**
   - 실제 실행될 배포 계획, 네트워크와 RPC를 검토합니다.
3. **Deploy reference stack**
   - 현재 Anvil에 Corner Store reference stack을 배포합니다.
4. **Verify artifact**
   - 생성된 artifact의 필수 주소와 설정 일치 여부를 검사합니다.

배포 전에 실행한 Doctor에서는 선택적 `artifact` 항목이
`not created yet`으로 표시될 수 있습니다. 이는 정상입니다. 배포가 성공하면
Studio가 Doctor를 다시 실행해 생성된 artifact 경로로 표시를 갱신합니다.

설정이나 RPC를 변경하면 기존 Doctor/Dry-run/Verify 결과는 무효가 됩니다.
변경 후에는 위 단계를 다시 실행합니다.

---

## 6. 배포한 컨트랙트로 DEX 실행하기

Artifact 검증이 끝나면:

1. **Start DEX demo**를 누릅니다.
2. 최초 실행이면 선택한 profile의 Manifest가 같은 배포물에서 활성화됩니다.
3. 상태가 `DEX running on verified deployment`로 바뀌는지 확인합니다.
4. **Open DEX**를 누릅니다.
5. Dashboard의 Environment에서 Router 주소를 확인합니다.
6. Studio의 Artifact Viewer에 표시된 Router 주소와 같은지 확인합니다.

이 과정에서 Studio는 다음 서비스를 시작합니다.

```text
RFQ backend ───────┐
Operator API ──────┼─ 같은 artifact / 같은 RPC 사용
DEX Dashboard ─────┘
```

RFQ backend가 실제로 읽은 Router와 검증된 artifact의 Router가 다르면
`Start DEX demo`는 실패하도록 구성되어 있습니다.

> 이 연결 흐름에서는 `scripts/showcase.sh`를 별도로 실행하지 않습니다.
> 실행하면 또 다른 reference stack을 배포하게 되어 Studio 결과와 분리됩니다.

---

## 7. DEX 데모 시연 순서

### 7.1 정상 거래

1. 적격 투자자 지갑을 선택합니다.
2. `RFQ 거래`에서 매수 또는 매도와 수량을 입력합니다.
3. Compliance Pre-check 통과를 확인합니다.
4. Quote를 요청합니다.
5. `My RFQs`에서 가격, 수량, 만료시간, nonce를 검토합니다.
6. Quote를 수락합니다.
7. Router 체결 성공과 transaction hash를 확인합니다.
8. Portfolio 잔액과 체결 차트 반영을 확인합니다.

- 매수: 투자자가 quote asset을 지급하고 RWA token을 받습니다.
- 매도: 투자자가 RWA token을 지급하고 quote asset을 받습니다.

### 7.2 비적격 투자자 차단

1. 비적격 투자자 지갑으로 전환합니다.
2. Pre-check의 실패 항목과 사유를 확인합니다.
3. Quote 요청 또는 체결이 차단되는지 확인합니다.

### 7.3 Quote 이후 claim 만료

1. 적격 투자자로 Quote를 먼저 발급합니다.
2. Admin 화면에서 해당 투자자의 claim을 만료시킵니다.
3. 기존 Quote 체결을 시도합니다.
4. Router가 최신 상태를 다시 검사해 거부하는지 확인합니다.

### 7.4 Quote 이후 Maker 승인 취소

1. 승인된 Maker의 Quote를 발급합니다.
2. Admin 화면에서 Maker 승인을 취소합니다.
3. 기존 Quote 체결을 시도합니다.
4. Router가 거래를 거부하는지 확인합니다.
5. 다음 시연을 위해 Maker를 복구합니다.

### 7.5 Adapter 직접 호출 차단

1. Admin의 Enforcement Case에서 Adapter 직접 호출을 선택합니다.
2. 우회 호출을 제출합니다.
3. Adapter가 Router 외 호출자를 거부하고 잔액이 바뀌지 않는지 확인합니다.

핵심은 Pre-check가 최종 승인을 보장하지 않는다는 점입니다. 실제 자산 이동
직전에 Router가 투자자 claim, 정책과 Maker 승인을 다시 검사합니다.

---

## 8. 종료

먼저 Studio 화면에서 **Stop DEX**를 누릅니다. RFQ backend, Operator API와
Dashboard가 함께 종료됩니다.

그다음:

1. Studio 터미널에서 `Ctrl-C`
2. Anvil 터미널에서 `Ctrl-C`

남은 프로세스를 확인하려면:

```bash
lsof -nP -iTCP:8545 -sTCP:LISTEN
lsof -nP -iTCP:8787 -sTCP:LISTEN
lsof -nP -iTCP:8788 -sTCP:LISTEN
lsof -nP -iTCP:8790 -sTCP:LISTEN
lsof -nP -iTCP:8791 -sTCP:LISTEN
```

---

## 9. 자주 발생하는 오류

### `port ... is already in use`

이전 프로세스가 남아 있거나 다른 프로그램이 같은 포트를 사용하고 있습니다.
`lsof`로 PID를 확인해 기존 데모를 종료하거나 다른 포트를 지정합니다.

### `DEX handoff locked`

아직 artifact 검증이 끝나지 않았습니다. `Deploy reference stack` 실행 후
`Verify artifact`를 먼저 완료합니다.

### RPC mismatch 또는 artifact 변경 오류

배포 이후 RPC, config 또는 scenario가 변경되었습니다. 현재 설정으로 다시
Doctor → Dry-run → Deploy → Verify를 진행합니다.

### DEX 서비스가 시작 직후 종료됨

생성한 프로젝트 아래의 로그를 확인합니다.

```text
.corner-store/studio-projects/<project>/.corner-store/runtime/
├── rfq-backend.log
├── operator-api.log
└── dashboard.log
```

---

## 10. 빠른 독립 데모

Deployment Studio의 배포 과정을 보여주지 않고 DEX 기능만 빠르게 확인하려면:

```bash
scripts/showcase.sh
```

이 명령은 Anvil, reference 배포, fixture 주입과 DEX 서비스를 한 번에 준비합니다.
Studio에서 배포한 artifact를 재사용하는 경로는 아니므로 발표 목적에 따라 둘 중
하나를 선택합니다.

| 목적 | 권장 실행 방법 |
| --- | --- |
| 설정·배포·검증·DEX 연결까지 시연 | `scripts/studio.sh` |
| RFQ 거래와 컴플라이언스 기능만 빠르게 시연 | `scripts/showcase.sh` |

---

## 11. 개발 검증

Deployment Studio만 검증:

```bash
npm test --prefix services/deployment-studio
```

저장소 전체 검증:

```bash
scripts/check.sh
```
