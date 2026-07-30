# Corner Store Deployment Studio 실행 가이드

Deployment Studio는 로컬/demo 환경에서 Corner Store 프로젝트를 생성하고,
설정 검증부터 배포 artifact 확인까지 진행하는 화면입니다.

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
11. Activation Checklist와 Operations handoff 상태를 확인합니다.

Module 항목은 임의 문자열을 입력하는 기본 form이 아닙니다. 제공되는 reference
또는 integrator adapter를 선택하고, 직접 구현한 모듈이 있을 때만
`Custom module ID`를 선택합니다. Custom ID를 입력해도 패키지가 자동 설치되지는
않으며 해당 capability 구현은 실행 환경에서 별도로 제공해야 합니다.

Activation Checklist는 실제 Maker 승인, signer 권한 부여 또는 token allowance
트랜잭션을 실행하지 않습니다. 운영자가 해당 온체인 작업과 smoke settlement를
확인했다는 사실만 기록합니다.

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

## 8. PR 병합 순서

Deployment Studio PR은 SDK 제품화 PR 위에 쌓여 있습니다.

1. PR `#71`을 먼저 병합합니다.
2. PR `#73`의 base branch를 `main`으로 변경합니다.
3. 변경 파일과 CI 결과를 다시 확인합니다.
4. PR `#73`을 병합합니다.
