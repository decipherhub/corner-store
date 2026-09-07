# GIWA Chain Operational Semantics

## 개요 / 범위

이 문서는 Corner Store가 배포 대상으로 사용하는 GIWA Sepolia (OP Stack 기반 L2)의
트랜잭션 확정 단계, 출금 챌린지 기간, forced inclusion escape hatch, fault proof
현황을 정리하고, 이 사실들이 우리 코드의 confirmation 처리와 어떻게 다른지
기록한다.

여기 적힌 사실은 2026-09-07에 다음 방법으로 직접 검증했다.

- GIWA public RPC (`https://sepolia-rpc.giwa.io/`)에 대한 live JSON-RPC 호출
  (`eth_getBlockByNumber` with `latest`/`safe`/`finalized`, `optimism_syncStatus`)
- L1 Sepolia에 배포된 GIWA `OptimismPortal`, `SystemConfig`, `DisputeGameFactory`에
  대한 `cast` on-chain read
- GIWA 공개 genesis config
  (`https://raw.githubusercontent.com/giwa-io/node/main/genesis/consensus/sepolia-rollup.json`)

출처가 GIWA 공식 문서인지, on-chain 직접 조회인지, 우리 추론인지를 각 절에서
구분해 표기한다.

## GIWA Sepolia 네트워크 정보

| 항목 | 값 | 출처 |
| --- | --- | --- |
| Chain ID | 91342 | on-chain 검증 |
| L1 | Ethereum Sepolia (chain ID 11155111) | on-chain 검증 |
| Public RPC | `https://sepolia-rpc.giwa.io/` | GIWA 공개 정보 |
| Flashblocks RPC | `https://sepolia-rpc-flashblocks.giwa.io/` | GIWA 공개 정보 |
| Explorer | `https://sepolia-explorer.giwa.io` (Blockscout) | GIWA 공개 정보 |
| Faucet | `https://faucet.giwa.io/` | GIWA 공개 정보 |
| Bridge | `https://sepolia-bridge.giwa.io/` | GIWA 공개 정보 |
| Block time | 1초 | on-chain 검증 |
| Block gas limit | 60,000,000 | on-chain 검증 |
| `seq_window_size` | 3600 L1 block (약 12시간) | genesis config |
| `max_sequencer_drift` | 600초 (10분) | genesis config |
| `channel_timeout` | 300초 (5분) | genesis config |

genesis config 출처:
`https://raw.githubusercontent.com/giwa-io/node/main/genesis/consensus/sepolia-rollup.json`

## 트랜잭션 확정 단계

GIWA public RPC는 `latest`, `safe`, `finalized` block tag를 모두 지원한다
(2026-09-07, 서로 다른 시점의 두 독립 sample로 검증). 관측치는 다음과 같다.

- Sample A: latest #35408402 (ts 1788753518), safe #35408114 (ts 1788753230),
  finalized #35407076 (ts 1788752192). safe가 latest보다 288 block(약 4.8분) 뒤처짐,
  finalized는 약 1326초(약 22분) 뒤처짐.
- Sample B (독립 시점): safe 약 4.4분, finalized 약 19.2분 뒤처짐.

두 sample을 합쳐 관측 범위를 safe 약 4~5분, finalized 약 19~22분으로 제시한다.
이는 **관측된 범위이지 GIWA가 공표한 SLA가 아니다.** GIWA는 batch 제출 주기에 대해
공식 SLA를 게시하지 않으며, 유일하게 문서화된 상한은 genesis config의
`channel_timeout = 300초`뿐이다.

| 단계 | 의미 | 관측 지연 | 되돌릴 수 있는 주체 | RPC 확인 방법 |
| --- | --- | --- | --- | --- |
| `latest` (unsafe) | sequencer가 만들었지만 아직 L1에 batch로 올라가지 않은 상태. GIWA에는 public mempool이 없고 sequencer가 단독으로 순서를 정하므로, sequencer가 재정렬/폐기할 수 있다. | sub-second | GIWA sequencer 단독 | `eth_getBlockByNumber("latest", false)` |
| `safe` | batch data가 L1에 제출되어 L1 데이터로부터 derive 가능한 상태. 되돌리려면 깊은 L1 reorg가 필요하다. | 관측 약 4~5분 | 깊은 L1 reorg (사실상 sequencer 단독으로는 불가) | `eth_getBlockByNumber("safe", false)` |
| `finalized` | batch를 담은 L1 block 자체가 Ethereum consensus에서 finalize된 상태 (2 epoch). 사실상 되돌릴 수 없다. | 관측 약 19~22분 | 사실상 불가 | `eth_getBlockByNumber("finalized", false)` |

`optimism_syncStatus`는 GIWA public RPC에서 사용할 수 없다
(`rpc method is not whitelisted` 응답, on-chain/RPC 직접 검증). 이는 op-node
전용 method이지 execution layer `eth_*` method가 아니기 때문이다. dApp은 위 세
tag에 대한 `eth_getBlockByNumber` 호출만으로 확정 단계를 판단해야 한다.

**중요한 구분 (GIWA 공식 문서 인용):** "Fault proofs do not impact the
finalization of the L2 rollup, only the finalization of withdrawal transactions
to the L1." (https://docs.optimism.io/stack/differences) 즉 위 `finalized` tag가
가리키는 L2 상태 확정성과, 아래 "출금 챌린지 기간"에서 다루는 7일 출금 대기는
서로 다른 질문이다. 거래 영수증에 "결제 최종 확정"을 표시할 때 이 둘을 절대
혼용하면 안 된다.

## 영수증 화면 권고

3단계 상태 모델을 권고한다.

1. **접수** (기준: `latest`) - 제출 직후, sub-second. UX 반응성 목적으로만
   사용하고 "확정"으로 표시하지 않는다.
2. **확정** (기준: `safe`) - 관측 약 4~5분. batch가 L1에 올라가 L1 데이터로부터
   derive 가능한 상태.
3. **최종** (기준: `finalized`) - 관측 약 19~22분. 여기가 "settlement final"
   타임스탬프를 찍어야 할 유일한 지점이다. 단, 이는 L2 rollup finality이며 L2->L1
   출금 자체의 최종성과는 다르다 (출금은 별도의 7일 challenge window를 거친다,
   아래 참조).

트랜잭션이 속한 block number를 `safe`/`finalized` block number와 비교하는 방식의
TypeScript 예시:

```ts
type Stage = "접수" | "확정" | "최종";

async function getReceiptStage(
  rpcUrl: string,
  txBlockNumber: bigint,
): Promise<Stage> {
  const [safeBlock, finalizedBlock] = await Promise.all([
    getBlockByTag(rpcUrl, "safe"),
    getBlockByTag(rpcUrl, "finalized"),
  ]);

  if (txBlockNumber <= finalizedBlock.number) return "최종";
  if (txBlockNumber <= safeBlock.number) return "확정";
  return "접수";
}

async function getBlockByTag(rpcUrl: string, tag: "safe" | "finalized") {
  const res = await fetch(rpcUrl, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "eth_getBlockByNumber",
      params: [tag, false],
    }),
  });
  const { result } = await res.json();
  return { number: BigInt(result.number), timestamp: BigInt(result.timestamp) };
}
```

## 출금 챌린지 기간

이 절은 "트랜잭션 확정 단계"와 별개 주제다. **L2 상태가 `finalized`라고 해서
L2->L1 출금이 즉시 인출 가능한 것은 아니다.** 이 구분을 영수증/UI 문구에서 절대
혼동하지 않는다.

GIWA `OptimismPortal` (L1 Sepolia): `0x956962C34687A954e611A83619ABaA37Ce6bC78A`,
version `5.6.1` (둘 다 on-chain 검증).

- `proofMaturityDelaySeconds()` = 604800 = 정확히 7일 (on-chain 검증)
- `disputeGameFinalityDelaySeconds()` = 302400 = 3.5일 (on-chain 검증)
- 이 지연은 오직 L2->L1 출금에만 적용되며, L1->L2 예치나 일반 L2 상태 확정과는
  무관하다.

## Escape hatch / 강제 포함

OP Stack에서 상속된 forced inclusion 메커니즘이 GIWA에도 지원된다 (OP Stack 공통
설계, on-chain에서 관련 contract 존재로 간접 확인).

- **메커니즘**: L1의 `OptimismPortal`
  (`0x956962C34687A954e611A83619ABaA37Ce6bC78A`)에서 `depositTransaction()`을
  직접 호출한다. derivation pipeline은 sequencing window
  (`seq_window_size` 3600 L1 block, 약 12시간)가 지나면 늦어도 그 시점까지는 이
  트랜잭션을 포함해야 한다.
- **address aliasing 주의 (우리 계약에 중요)**: L2에서 이 호출은 원래 L1
  주소가 아니라 `L1 address + 0x1111000000000000000000000000000000001111`로
  계산된 **aliased 주소**로부터 실행된다. 즉 L2에서 EOA가 보유한 operator/owner
  role은, 그 aliased 주소가 별도로 authorize되어 있지 않은 한 forced path를 통해
  자동으로 행사되지 않는다.
- **강제할 수 있는 것**: ETH transfer, aliased 계정으로부터의 임의 contract call.
- **강제할 수 없는 것**: 다른 대기 중인 L2 트랜잭션과의 순서 관계 (삽입할 L2
  mempool 자체가 없음), 다른 당사자의 미확정 트랜잭션과의 atomicity, L2 block
  gas limit을 초과하는 작업, 이미 sequencing된 트랜잭션의 취소/재정렬.

## Fault proof 현황과 잔여 중앙화 위험

on-chain 조회 결과:

- `DisputeGameFactory.gameImpls(0)` (permissionless CANNON) =
  `0x0000000000000000000000000000000000000000`: permissionless fault-proof game이
  배포되어 있지 않다.
- `DisputeGameFactory.gameImpls(1)` (PERMISSIONED_CANNON) =
  `0xe1dFFCBE4e22B813F26d2106D943C102e7cAb87e`
- `OptimismPortal.respectedGameType()` = `1`: portal은 오직 permissioned game이
  제출한 출금 증명만 인정한다.

**우리 분석 (GIWA의 공식 표명이 아님)**: GIWA는 fault-proof 대응 가능한 contract를
permissioned-only 모드로 운영 중이며, 사실상 Stage 0 (centralized sequencer +
permissioned proposer/challenger)에 해당한다. GIWA는 공식 stage label을 게시하지
않는다.

**운영상 함의**: forced inclusion은 sequencer가 죽어도 L1->L2 예치/호출 경로를
살려두지만, L2->L1 출금은 여전히 단일 permissioned proposer/challenger keypair에
의존한다. 이 키가 유실되면 현재는 출금을 permissionless하게 증명하고 finalize할
경로가 없다. 이는 sequencer censorship과는 별개의, 실질적인 잔여 중앙화 위험이다.

## 현재 코드와의 차이

- `blockTag`를 지정한 코드가 저장소 전체에서 0건이다 (`grep -rn "blockTag"`).
  모든 block read가 암묵적으로 `"latest"`를 사용한다.
- `services/testnet-rfq-demo/public/app.js:127,142`의 현재 영수증 UI는
  "Submitted {hash}" 다음 `transaction.wait()` (ethers 기본값 1 confirmation) 후
  "Confirmed in block {n}"만 보여준다. timestamp, finality 상태, tx explorer
  link가 없다.
- `services/rfq/src/coordinator.ts:225`의 `DEFAULT_CONFIRMATIONS = 12`와
  `PUBLISHED -> FILL_OBSERVED -> FILLED` state machine은 confirmation depth로
  게이팅된다.
- `services/operator-api/src/indexer.ts:16-42`의 `FinalityAwareIndexer`는
  `head - confirmations` (기본 12)를 사용해 `{lastFinalizedBlock,
  lastFinalizedHash}` cursor를 저장한다. 다만 실행 중인 서버
  (`src/index.ts`)에서는 인스턴스화되지 않고 `test/smoke.ts`에서만 쓰인다.

**핵심 지적**: 고정된 12-confirmation depth 휴리스틱은 L1 mental model이며 OP
Stack L2에는 맞지 않는다. GIWA에서 12 confirmation은 12초에 불과해 `safe`
(관측 약 4~5분)보다 훨씬 약하고, 애초에 L2 block depth는 어떤 reorg-resistance
경계에도 대응하지 않는다. L2 되돌림은 sequencer의 행동과 L1 reorg에 의해
결정되지, L2 block depth에 의해 결정되지 않기 때문이다. 올바른 신호는
`safe`/`finalized` tag다. 이는 production에서 이미 깨져 있는 문제가 아니라
(해당 indexer는 서버에 연결되어 있지 않다), **권고 사항이자 gap**으로 다룬다.

## 확인하지 못한 것

- GIWA가 공표한 batch 제출 SLA는 없다. `channel_timeout = 300초`만 유일한 문서화된
  상한이다.
- GIWA는 공식 decentralization stage label을 게시하지 않는다. 위 Stage 0 판단은
  우리 분석이다.
- `optimism_syncStatus`는 GIWA public RPC에서 사용할 수 없다
  (`rpc method is not whitelisted`).
- 아래 L1 Sepolia 주소는 `SystemConfig` on-chain read로 얻은 값이며, GIWA 공식
  문서에 게시되어 있지 않다.
  - `SystemConfig`: `0x8352825ba56c32d816dd906ad4a392b5bc9ec984`
  - `L1CrossDomainMessenger`: `0x23ce19ED800fbbC964B9350b01B9113a8508D3F1`
  - `L1StandardBridge`: `0x77b2ffc0F57598cAe1DB76cb398059cF5d10A7E7`
  - `DisputeGameFactory`: `0x37347caB2afaa49B776372279143D71ad1f354F6`
  - `batchInbox`: `0x00Ef2e3B7754f2a65F1e897a27A3306D9B52F544`
