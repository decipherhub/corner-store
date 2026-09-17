# GIWA 테스트넷 배포 방법

이 문서는 Corner Store RFQ reference stack을 **로컬 Anvil이 아니라 GIWA
Sepolia 테스트넷에 실제로 배포**하는 가장 단순한 절차다.

배포 결과는 실제 테스트넷 트랜잭션과 컨트랙트 주소로 남는다. 다만 배포되는
ERC-3643 자산, Trusted Issuer claim, quote token과 초기 잔액은 해커톤 검증을
위한 fixture이며 실제 BUIDL 또는 Securitize 연동이 아니다.

## 전체 흐름

처음 한 번:

1. 최신 `main` 준비
2. GIWA 전용 배포 지갑 생성 또는 등록
3. Faucet에서 테스트 ETH 수령
4. `.env.testnet`에 테스트 계정 주소 입력

배포할 때:

1. 환경변수 불러오기
2. 네트워크와 잔액 확인
3. 시뮬레이션
4. 실제 배포
5. 생성된 artifact와 컨트랙트 주소 확인

## 0. 반드시 저장소 루트에서 실행

아래 명령은 모두 Corner Store 저장소 루트에서 실행한다.

```sh
cd /path/to/corner-store
```

현재 위치 확인:

```sh
pwd
test -f foundry.toml && echo "Corner Store root: OK"
```

## 1. 배포 코드가 있는 최신 `main` 준비

현재 작업 중인 브랜치에 미커밋 변경이 없다면:

```sh
git fetch origin
git switch main
git pull --ff-only origin main
```

현재 브랜치에 미커밋 변경이 있거나 다른 작업을 유지해야 한다면, 별도의 clean
worktree를 만드는 편이 안전하다.

```sh
git fetch origin
git worktree add /tmp/corner-store-giwa origin/main
cd /tmp/corner-store-giwa
```

배포 파일이 있는지 확인한다.

```sh
test -f .env.testnet.example
test -x scripts/deploy-testnet-rfq.sh
```

둘 중 하나라도 실패하면 아직 public-testnet 배포 코드가 없는 브랜치다.

## 2. GIWA 네트워크 정보

| 항목 | 값 |
| --- | --- |
| Network | GIWA Sepolia |
| Chain ID | `91342` |
| RPC | `https://sepolia-rpc.giwa.io` |
| Explorer | `https://sepolia-explorer.giwa.io` |
| Gas token | Test ETH |

공식 문서:

- <https://docs.giwa.io/giwa-chain/en/get-started/connect-to-giwa>
- <https://docs.giwa.io/get-started/faucets>

공용 RPC는 rate limit이 있을 수 있다. 배포 중 RPC 제한이 반복되면 GIWA가
지원하는 별도 RPC provider를 사용하되 Chain ID는 반드시 `91342`인지 확인한다.

## 3. 테스트넷 전용 배포 지갑 등록

실제 자산을 보관하는 지갑을 사용하지 말고 GIWA 테스트넷 전용 지갑을 사용한다.

```sh
cast wallet import corner-store-giwa --interactive
```

실행 중 입력하는 것:

1. 테스트넷 전용 개인키
2. 로컬 keystore를 암호화할 비밀번호

개인키는 명령행, `.env.testnet`, Git에 넣지 않는다. 이후 배포 명령에서는 개인키
대신 `--account corner-store-giwa`를 사용한다.

등록 확인:

```sh
cast wallet list
cast wallet address --account corner-store-giwa
```

출력된 주소가 이번 배포의 `CORNER_STORE_TESTNET_DEPLOYER`다.

## 4. Faucet에서 테스트 ETH 받기

위에서 확인한 deployer 주소로 GIWA Faucet의 테스트 ETH를 받는다.

잔액 확인:

```sh
cast balance \
  "$(cast wallet address --account corner-store-giwa)" \
  --rpc-url https://sepolia-rpc.giwa.io
```

Corner Store reference stack은 여러 컨트랙트와 초기화 트랜잭션을 배포한다.
시뮬레이션에서 예상한 비용보다 충분히 여유 있는 잔액을 준비한다.

## 5. 배포 설정 파일 만들기

저장소 루트에서:

```sh
cp .env.testnet.example .env.testnet
```

`No such file or directory`가 나오면 다음을 확인한다.

```sh
pwd
git branch --show-current
ls -la .env.testnet.example scripts/deploy-testnet-rfq.sh
```

파일이 없다면 **1번 단계의 최신 `main` 또는 clean worktree 준비**를 다시 수행한다.

`.env.testnet`에 다음처럼 입력한다.

```dotenv
RPC_URL=https://sepolia-rpc.giwa.io
CHAIN_ID=91342
BLOCKSCOUT_API_URL=https://sepolia-explorer.giwa.io/api

# cast wallet address --account corner-store-giwa 결과
CORNER_STORE_TESTNET_DEPLOYER=0x...

# 짧은 해커톤 fixture에서는 deployer와 같아도 된다.
CORNER_STORE_GOVERNANCE=0x...
CORNER_STORE_OPERATOR=0x...

# 테스트용 Maker와 투자자 지갑 주소
CORNER_STORE_TESTNET_MAKER=0x...
CORNER_STORE_TESTNET_INVESTOR=0x...
CORNER_STORE_TESTNET_INVESTOR_B=0x...
CORNER_STORE_TESTNET_INELIGIBLE_INVESTOR=0x...

# Mock Trusted Issuer 전용 폐기 가능한 테스트 키
# 실제 운영·자산 보관 지갑의 키를 사용하지 않는다.
CORNER_STORE_TESTNET_ISSUER_KEY=0x...

CORNER_STORE_DEPLOYMENT_ID=giwa-sepolia-rfq

# 배포본 브라우저 데모 설정
CORNER_STORE_TESTNET_RPC_URL=https://sepolia-rpc.giwa.io
CORNER_STORE_TESTNET_EXPLORER_URL=https://sepolia-explorer.giwa.io
CORNER_STORE_TESTNET_DEMO_HOST=127.0.0.1
CORNER_STORE_TESTNET_DEMO_PORT=8791
```

### 각 계정의 의미

| 환경변수 | 역할 |
| --- | --- |
| `DEPLOYER` | 배포와 초기 설정 트랜잭션에 서명 |
| `GOVERNANCE` | 배포 후 핵심 설정 소유권을 받는 주소 |
| `OPERATOR` | Maker 승인, 정책 운영 등 테스트 운영 권한 |
| `MAKER` | RFQ 가격을 제시하고 반대편 자산을 공급 |
| `INVESTOR` | 정상 체결을 보여주는 적격 투자자 A |
| `INVESTOR_B` | quote 후 claim 만료 거부 시나리오용 적격 투자자 B |
| `INELIGIBLE_INVESTOR` | 비적격 투자자 차단 시나리오용 |
| `ISSUER_KEY` | Mock ONCHAINID claim을 서명하는 테스트 전용 issuer 키 |

Governance와 Operator는 짧은 해커톤 배포에서는 deployer 주소를 재사용할 수 있다.
Maker와 투자자들은 거래 주체가 다르므로 서로 다른 테스트 지갑을 사용하는 편이
데모가 명확하다.

`.env.testnet`은 커밋하지 않는다.

```sh
git check-ignore .env.testnet
```

## 6. 환경변수 불러오기

새 터미널을 열 때마다 저장소 루트에서 실행한다.

```sh
set -a
source .env.testnet
set +a
```

필수값 확인:

```sh
printf 'RPC=%s\nCHAIN_ID=%s\nDEPLOYER=%s\n' \
  "$RPC_URL" "$CHAIN_ID" "$CORNER_STORE_TESTNET_DEPLOYER"
```

`CORNER_STORE_TESTNET_ISSUER_KEY` 같은 비밀값은 출력하지 않는다.

## 7. 배포 전 네트워크 확인

```sh
cast chain-id --rpc-url "$RPC_URL"
cast balance "$CORNER_STORE_TESTNET_DEPLOYER" --rpc-url "$RPC_URL"
```

첫 번째 명령 결과가 반드시 다음과 같아야 한다.

```text
91342
```

다르면 배포하지 않는다.

## 8. 먼저 시뮬레이션

`--broadcast` 없이 실행하면 테스트넷에 트랜잭션을 전송하지 않는다.

```sh
scripts/deploy-testnet-rfq.sh \
  --rpc-url "$RPC_URL" \
  --chain-id "$CHAIN_ID" \
  --account corner-store-giwa
```

확인할 것:

- sender가 `CORNER_STORE_TESTNET_DEPLOYER`와 같은가
- Chain ID가 `91342`인가
- 시뮬레이션이 revert 없이 끝나는가
- deployer의 테스트 ETH가 충분한가

## 9. GIWA 테스트넷에 실제 배포

시뮬레이션이 성공한 뒤에만 실행한다.

```sh
scripts/deploy-testnet-rfq.sh \
  --rpc-url "$RPC_URL" \
  --chain-id "$CHAIN_ID" \
  --account corner-store-giwa \
  --broadcast \
  --verify \
  --verifier blockscout \
  --verifier-url "$BLOCKSCOUT_API_URL"
```

GIWA 공식 Foundry 가이드의 Blockscout API endpoint를 사용해 배포와 source
verification을 함께 수행한다. Foundry가 keystore 비밀번호를 요청하면 3번
단계에서 설정한 비밀번호를 입력한다.
스크립트는 다음을 자동으로 수행한다.

1. GIWA Chain ID 재확인
2. ERC-3643/ONCHAINID 테스트 fixture 배포
3. Compliance registry, Engine, Router 배포
4. RFQ Adapter, Venue와 Maker Authorizer 배포
5. BUIDL-like Manifest와 테스트 claim/잔액 초기화
6. 온체인 배포 결과 검증
7. 트랜잭션과 컨트랙트 주소를 artifact에 저장

배포 중 일부 트랜잭션만 성공하고 실패했다면 같은 deployment ID로 무작정
재실행하지 않는다. 로그와 `broadcast/` 기록을 먼저 확인한다.

## 10. 배포 결과와 주소 확인

정상 완료 시 다음 파일이 생성된다.

```text
deployments/public/giwa-sepolia-rfq-91342.json
```

주소 요약:

```sh
scripts/list-testnet-deployments.sh
```

JSON 출력:

```sh
scripts/list-testnet-deployments.sh --json
```

artifact에는 다음이 기록된다.

- 배포 소스 commit
- Chain ID
- 배포 트랜잭션 hash
- ERC-3643 테스트 토큰
- Compliance Engine
- Execution Router
- RFQ Adapter와 Venue
- Maker Authorizer
- 테스트 참여자 주소

개인키와 RPC credential은 artifact에 저장되지 않는다.

## 11. 참여자별 토큰 승인

배포 스크립트는 Maker나 투자자 대신 서명할 수 없다. 실제 거래 전에 각 참여자
지갑이 배포된 RFQ Adapter에 RWA와 quote token allowance를 승인해야 한다.

각 참여자 keystore를 등록한 후 아래 명령을 해당 계정으로 실행한다.

```sh
CORNER_STORE_ARTIFACT=deployments/public/giwa-sepolia-rfq-91342.json \
forge script script/ApproveTestnetRFQ.s.sol:ApproveTestnetRFQ \
  --rpc-url "$RPC_URL" \
  --chain-id "$CHAIN_ID" \
  --account <participant-keystore-name> \
  --broadcast
```

최소한 Maker와 정상 거래에 사용할 투자자 A는 승인해야 한다.

## 12. 배포본 최종 검증

```sh
CORNER_STORE_ARTIFACT=deployments/public/giwa-sepolia-rfq-91342.json \
CORNER_STORE_REQUIRE_APPROVALS=true \
forge script script/VerifyTestnetRFQ.s.sol:VerifyTestnetRFQ \
  --rpc-url "$RPC_URL" \
  --chain-id "$CHAIN_ID"
```

검증기는 다음 문제를 발견하면 실패한다.

- artifact와 현재 Chain ID 불일치
- 배포 주소에 코드가 없음
- governance/operator 불일치
- Manifest 또는 RFQ venue 비활성
- Maker 미승인
- 초기 inventory 부족
- 요청한 참여자의 allowance 부족

## 13. GIWA 배포본으로 브라우저 데모 실행

Maker용 테스트넷 전용 키를 로컬 환경변수로 제공해야 RFQ backend가 firm quote에
서명할 수 있다. 이 키도 실제 자산 지갑과 분리하고 Git에 저장하지 않는다.

```sh
export CORNER_STORE_TESTNET_ARTIFACT=deployments/public/giwa-sepolia-rfq-91342.json
export CORNER_STORE_TESTNET_RPC_URL=https://sepolia-rpc.giwa.io
export CORNER_STORE_TESTNET_EXPLORER_URL=https://sepolia-explorer.giwa.io
export CORNER_STORE_TESTNET_MAKER_KEY=0x...

scripts/run-testnet-rfq-demo.sh
```

출력된 주소를 브라우저에서 열고 artifact에 등록된 투자자 지갑을 연결한다.

이 데모는 기존 로컬 `scripts/showcase.sh`와 별개다.

- `scripts/showcase.sh`: Anvil에서 결정적으로 실행하는 발표용 시나리오
- `scripts/run-testnet-rfq-demo.sh`: 이미 GIWA에 배포된 artifact를 사용하는
  실제 테스트넷 거래 증명

## 가장 짧은 명령 요약

최초 한 번:

```sh
cast wallet import corner-store-giwa --interactive
cp .env.testnet.example .env.testnet
```

`.env.testnet` 작성 후:

```sh
set -a
source .env.testnet
set +a

scripts/deploy-testnet-rfq.sh \
  --rpc-url "$RPC_URL" \
  --chain-id "$CHAIN_ID" \
  --account corner-store-giwa

scripts/deploy-testnet-rfq.sh \
  --rpc-url "$RPC_URL" \
  --chain-id "$CHAIN_ID" \
  --account corner-store-giwa \
  --broadcast
```

## 문제 해결

### `.env.testnet.example: No such file or directory`

현재 위치가 저장소 루트가 아니거나 public-testnet 코드가 없는 이전 브랜치다.

```sh
git fetch origin
git worktree add /tmp/corner-store-giwa origin/main
cd /tmp/corner-store-giwa
cp .env.testnet.example .env.testnet
```

### `RPC chain id ... does not match`

잘못된 RPC를 사용하고 있다. GIWA Sepolia는 Chain ID `91342`다.

### `insufficient funds`

deployer의 GIWA 테스트 ETH가 부족하다. Faucet에서 추가로 받은 뒤 잔액을 다시
확인한다.

### artifact가 이미 존재한다

public deployment 기록은 덮어쓰지 않는다. 새로운 ID를 사용한다.

```sh
export CORNER_STORE_DEPLOYMENT_ID=giwa-sepolia-rfq-v2
```

### 개인키를 어디에 넣어야 하는가

deployer 개인키는 `.env.testnet`에 넣지 않는다.

```sh
cast wallet import corner-store-giwa --interactive
```

로 암호화된 Foundry keystore에 한 번 등록하고 배포 시
`--account corner-store-giwa`만 사용한다.
