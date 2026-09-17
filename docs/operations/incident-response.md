# Incident Response Runbook

이 문서는 Corner Store reference stack에서 보안·컴플라이언스·identity/provider·RFQ·
RPC/indexer 사고가 발생했을 때 **위험을 먼저 줄이고, 증거를 보존한 뒤, 검증된
상태에서만 재개**하는 절차다.

현재 구현은 production custody나 hosted control plane이 아니다. 실제 운영자는
chain, 발행자, ERC-3643/ONCHAINID provider, Safe/multisig와 법무 책임자를 이 절차에
맞게 지정해야 한다.

## 1. Trigger and reason

긴급 containment에는 ADR-007의 emergency pause reason code를 사용한다.

- `SECURITY_INCIDENT`
- `COMPLIANCE_INCIDENT`
- `IDENTITY_OR_CLAIM_FAILURE`
- `LEGAL_REQUEST`
- `MARKET_INTEGRITY`
- `OPERATOR_ERROR`
- `OTHER`

정상적인 규제·issuer·claim topic·recipe·venue 변경이나 migration은 ADR-007의
lifecycle reason code로 별도 기록하고, 긴급 사고 code와 혼용하지 않는다.

최초 신고자는 시간, network/deployment ID, 영향 자산·venue, 관찰한 transaction과
reason을 기록한다. private key, API token, claim 원문이나 PII는 ticket/event에 넣지
않는다.

## 2. Immediate containment

1. 영향 범위를 모르면 fail-closed로 취급한다.
2. RFQ signer 또는 backend가 의심되면 새 quote 발급을 중지하고 maker approval을
   철회한다.
3. 전체 실행을 즉시 중단해야 하면 `OperatorRegistry.setGlobalPaused(true, reason)`을
   사용한다.
4. venue 단위 사고는 `OperatorRegistry.setVenueSuspended(venue, true, reason)`로
   차단한다.
5. 자산 단위 사고는 `OperatorRegistry.setAssetSuspended(token, true, reason)`으로
   Router 실행을 차단하고, Manifest 자체가 의심되면
   `TokenPolicyRegistry.suspendManifest`도 함께 사용한다.
6. ERC-3643 token/identity/claim provider 사고는 해당 외부 운영자에게 pause, freeze,
   issuer revocation을 요청한다. Corner Store가 외부 trust boundary를 소유한다고
   가정하지 않는다.
7. direct adapter 호출로 우회하지 않는다. 모든 복구 시험도 승인된 Router 경로를
   사용한다.

`OperatorRegistry`가 global/asset/venue pause의 중앙 source of truth이며 Router는
nonce 소비와 compliance evaluation 전에 세 범위를 모두 검사한다. 중단은 operator가
즉시 수행할 수 있지만, 재개는 owner가 예약하고 최소 1일 timelock 뒤 owner가
실행한다. Manifest 재개는 Factory owner가 예약하고 registry operator가 delay 뒤
실행한다.

## 3. Sequencer outage / censorship 대응

GIWA는 단일 sequencer 구조다 (상세는
[`giwa-chain-semantics.md`](./giwa-chain-semantics.md) 참조). sequencer가 멈추거나
특정 트랜잭션을 censorship하는 상황은 아래 절차로 대응한다.

1. `latest`와 `safe` block tag의 진행을 비교해 sequencer 정지를 감지한다.
   `latest` block height가 정상 block time(1초)보다 크게 느려지거나 멈추면
   sequencer 장애로 간주한다. `safe`가 계속 진행 중이면 이미 L1에 제출된 batch는
   정상적으로 derive되고 있다는 뜻이며 sequencer 자체만 정지한 상태다.
2. 이 문서의 pause lever (`OperatorRegistry.setGlobalPaused`,
   `setVenueSuspended`, `setAssetSuspended` 등)는 모두 L2 트랜잭션이다. sequencer가
   내려가 있으면 이 lever는 **사용할 수 없다.** sequencer 장애 자체가 containment
   실행을 막을 수 있음을 미리 인지한다.
3. sequencer가 없어도 L1->L2 방향은 forced inclusion (escape hatch)으로 유지된다.
   L1의 `OptimismPortal`에서 `depositTransaction()`을 직접 호출하면 늦어도
   sequencing window (`seq_window_size`, 약 12시간) 안에는 derivation pipeline이
   해당 트랜잭션을 포함해야 한다.
4. **OPEN ITEM**: forced inclusion 호출은 L2에서 address-aliased 계정
   (L1 주소 + `0x1111000000000000000000000000000000001111`)으로 실행된다. 즉 L2
   operator EOA가 보유한 pause/suspend 권한은, 그 aliased 주소가 별도로
   operator로 등록되어 있지 않은 한 forced path로 행사되지 않는다. aliased
   주소를 사전에 operator로 등록해 둘지는 아직 결정되지 않았다. 결정 전까지는
   sequencer 장애 중 forced path로 containment lever를 행사할 수 없다고
   가정한다.
5. L2->L1 출금 경로는 이 sequencer 장애와 별개로 단일 permissioned
   proposer/challenger keypair에 의존한다 (fault proof가 permissioned-only
   모드로 운영됨). 해당 키가 없으면 sequencer가 복구돼도 출금을 finalize할 수
   없다.

상세 배경(확정 단계 관측치, escape hatch 한계, fault proof 현황)은
[`giwa-chain-semantics.md`](./giwa-chain-semantics.md)를 참조한다.

## 4. Evidence preservation

- deployment artifact와 Toolkit checkpoint의 config/artifact hash
- 관련 transaction hash, block number/hash, emitted reason code
- Manifest version/status와 venue/maker approval snapshot
- Operator API event export와 finality cursor
- 실행한 containment action, actor, 승인 ticket와 시각

기존 checkpoint나 event file을 덮어쓰지 않는다. indexer가 finalized block hash
변경을 감지하면 자동 진행을 멈추고, chain별 rewind/replay 정책이 승인될 때까지
새 상태를 authoritative record로 취급하지 않는다.

## 5. Triage

| 사고 | 우선 확인 | 기본 조치 |
| --- | --- | --- |
| Router/Adapter exploit 의심 | direct-call rejection, registered adapter/venue, nonce | 영향 venue와 자산 suspend |
| Compliance/claim drift | Manifest version, trusted issuer, claim expiry, token wiring | 자산 suspend, provider 증거 재검증 |
| RFQ signer 노출 | maker approval, 발급 nonce, backend access log | quote 중지, maker revoke, key rotation |
| RPC/indexer reorg | finalized block hash, cursor, duplicate/missing event | index 중지, 승인된 지점부터 replay |
| Operator error | actor, calldata, reason, old/new state | 추가 mutation 중지, multisig review |

## 6. Recovery gate

재개는 containment의 단순 역순이 아니다. compliance 완화, trusted issuer 추가,
recipe 제거와 unpause는 외부 multisig 승인과 적용 가능한 timelock을 거친다.

재개 전에 다음을 모두 만족한다.

1. root cause와 영향 범위가 기록됐다.
2. key/provider/config 교체가 필요한 경우 새 값이 승인됐다.
3. `toolkit-validate`, `toolkit-simulate`, `toolkit-preflight`가 통과했다.
4. 새 immutable checkpoint가 생성되고 이전 checkpoint와 변경 이유가 연결됐다.
5. `scripts/check.sh`가 통과했다.
6. 영향 profile의 `scripts/e2e-anvil.sh --profile <profile>`이 7/7 scenario와
   protected RFQ success/rejection path를 통과했다.
7. global/asset/venue unpause 또는 Manifest resume를 예약하고 timelock 동안 새 증거와
   취소 필요성을 재검토한다.
8. 한 자산·venue부터 단계적으로 resume하고 Operator API events/metrics를 관찰한다.

## 7. Post-incident

- incident timeline, root cause, containment, recovery와 재발 방지 항목을 남긴다.
- 필요한 code/config/runbook 변경은 별도 feature와 review를 거친다.
- production 환경에서는 TLS, secret rotation, 실제 multisig provider, chain finality,
  backup/restore와 alert routing을 이 reference 절차 위에 추가한다.

관련 문서:

- [`giwa-chain-semantics.md`](./giwa-chain-semantics.md)
- [`../security.md`](../security.md)
- [`../rfq-threat-model.md`](../rfq-threat-model.md)
- [`../architecture/deployment-operations.md`](../architecture/deployment-operations.md)
- [`../demo.md`](../demo.md)
- [`../decisions/ADR-007-pd-architecture-decisions.md`](../decisions/ADR-007-pd-architecture-decisions.md)
