# Element Emergency Replacement Runbook

이 문서는 production에서 치명적인 Element 결함이 발견됐을 때 **기존 정책 객체를
덮어쓰거나 timelock을 우회하지 않고** 영향 자산만 새 immutable Element/Recipe/
Manifest version으로 교체하는 실행 절차다. 일반 사고 분류와 증거 보존은
[`incident-response.md`](./incident-response.md)를 먼저 따른다.

## Safety invariants

- 같은 `elementId` 또는 같은 `(recipeKey, recipeVersion)`을 재사용하지 않는다.
- 중단은 즉시 수행하지만 재개와 semantic update는 기존 owner/Safe 권한과 최소
  delay를 유지한다. break-glass 완화 경로는 없다.
- Manifest가 `SUSPENDED`인 상태에서 update를 활성화해도 상태는 계속
  `SUSPENDED`다. 검증 전 자동 재개하지 않는다.
- 공유 Recipe를 사용하더라도 명시적으로 update하지 않은 자산의 Manifest version,
  binding, compiled plan과 `policyId`는 바뀌면 안 된다.
- raw KYC/TA payload, 이름, 연락처, signer secret은 artifact, ticket, event 또는
  reason code에 넣지 않는다.

## Authority matrix

| 동작 | 실행 권한 | 속도 |
| --- | --- | --- |
| quote 발급 중지 | RFQ service operator | 즉시 |
| maker approval 철회 | RFQ adapter operator | 즉시 |
| known RFQ nonce 취소 | 해당 maker account | 즉시 |
| global/asset/venue suspend | OperatorRegistry operator | 즉시 |
| Manifest suspend | TokenPolicyRegistry operator | 즉시 |
| Element/Recipe 신규 version 등록 | 각 Registry owner/Safe | governance transaction |
| Manifest update 예약/취소 | TokenPolicyRegistry owner; Factory가 owner면 Factory owner/Safe | 최소 1일 delay |
| Manifest update 활성화 | TokenPolicyRegistry operator | delay 후 |
| Manifest resume 예약 | Registry owner; Factory가 owner면 Factory owner/Safe | 최소 1일 delay |
| Manifest resume | Registry operator | delay 후 |
| asset/venue/global unpause 예약·실행 | OperatorRegistry owner/Safe | 최소 1일 delay |

production 배포에서 `TokenPolicyRegistry.owner()`가 `CornerStoreFactory`이면 Safe는
Registry를 직접 호출하지 않고 Factory의 forwarding API를 호출한다. full policy
config가 있는 자산에는 반드시 6-인자 `scheduleManifestUpdate`를 사용한다. 4-인자
호환 overload는 parameter/override가 없는 정책에만 사용한다.

## Phase 0 — Stop condition and evidence

1. incident ID, chain ID, deployment ID, token, venue, 최초 관측 block/tx와
   `COMPLIANCE_INCIDENT` reason을 기록한다.
2. 현재 `ManifestCore`, version, status, binding, compiled plan/config hash,
   `policyId`, history hash, Element/Recipe 주소와 runtime code hash를 export한다.
3. `ComplianceEngine.recordPolicyAuditCheckpoint(token)`을 호출해 변경 전 checkpoint를
   남기고 event transaction을 incident record에 연결한다.
4. 현재 artifact를 hash로 복원하고 검증한다.

```sh
corner-store policy-audit-reconstruct sha256:<CURRENT_DIGEST> \
  --store <IMMUTABLE_STORE> --out before-policy.json
corner-store policy-audit-verify before-policy.json \
  --expected sha256:<CURRENT_DIGEST> --store <IMMUTABLE_STORE>
```

artifact 복원, code-hash 비교 또는 checkpoint reconciliation이 실패하면 recovery를
진행하지 않고 containment 상태를 유지한다.

## Phase 1 — Immediate containment

아래 순서를 같은 incident change set으로 실행한다.

1. RFQ service의 신규 quote 발급을 중지한다.
2. signer compromise 가능성이 있으면 delegate를 즉시 revoke하고 key rotation을
   별도 incident로 수행한다.
3. 해당 maker를 RFQ adapter에서 비승인 상태로 전환한다.
4. durable coordinator의 `RESERVED`/`SIGNED` quote를 열거한다. maker account가 알고
   있는 nonce를 `cancelQuoteNonce` 또는 bounded batch `cancelQuoteNonces`로 취소한다.
5. `OperatorRegistry.setAssetSuspended(token, true, reason)`을 실행한다.
6. `TokenPolicyRegistry.suspendManifest(token, reason)`을 실행한다.
7. 결함이 공유 venue 또는 여러 자산에 미치는지 모르면 venue 또는 global pause까지
   확대한다. 범위가 확인되기 전에는 좁혀서 재개하지 않는다.

취소하지 못한 old quote가 있더라도 교체 activation 뒤에는 signed `policyId`와 fresh
settlement decision이 달라 `RFQQuoteMismatch`로 거부돼야 한다. nonce 취소는 즉시
containment이고 policy binding은 최종 fail-closed backstop이다.

## Phase 2 — Build immutable replacement

1. 수정 구현을 **새 `elementId`와 version metadata**로 배포한다. 기존 주소/ID를
   proxy upgrade나 registry overwrite로 바꾸지 않는다.
2. `ElementRegistry.registerElement(newElementId, newAddress, defaultAction)` calldata를
   review한다. metadata, parameter schema, default enforcement와 runtime code hash가
   승인 자료와 같아야 한다.
3. 기존 canonical recipe alias/key를 유지하되 version을 증가시킨 새 Recipe를
   배포하고 `RecipeRegistry.registerRecipe(aliasHash, recipeKey, recipeId,
   newVersion, newAddress)` calldata를 review한다.
4. 새 Recipe의 `requiredElements()`가 새 Element ID를 가리키고, 기존 Recipe version과
   주소는 그대로 남아 있는지 확인한다.
5. 영향받지 않은 자산 목록을 snapshot하고 이후 비교 기준으로 고정한다.

Registry가 같은 Element ID나 Recipe version 재등록을 허용하거나 runtime code hash가
reviewed 값과 다르면 즉시 중단한다.

## Phase 3 — UPDATE artifact and Safe proposal

새 policy audit input은 다음을 만족해야 한다.

- `lifecycleAction = UPDATE`
- `intendedPolicyVersion = currentVersion + 1`
- `previousArtifactHash = current artifact digest`
- exact new Element/Recipe deployment와 runtime code hash
- 전체 Manifest, binding, enforcement override, parameter config
- PII-free provider evidence reference와 compliance audit chain head

```sh
corner-store policy-audit-build update-audit.input.json --out update-policy.json
corner-store policy-audit-store update-policy.json --store <IMMUTABLE_STORE>
corner-store policy-audit-verify update-policy.json \
  --expected sha256:<NEW_DIGEST> --store <IMMUTABLE_STORE>
```

새 digest의 `0x<digest>`를 replacement `ManifestCore.fullManifestHash`에 넣는다.
Safe proposal에는 다음을 분리해 포함한다.

1. 새 Element 등록
2. 새 Recipe version 등록
3. Factory의 full `scheduleManifestUpdate(token, manifest, bindings, overrides,
   config, reason)` 호출

현재 schema v4 onboarding planner는 최초 등록 gate다. UPDATE Safe proposal export의
자동화는 #108 범위이므로, 그 전에는 external Safe tooling 또는 reviewed `cast
calldata`로 proposal을 생성하고 decoded calldata를 두 사람이 artifact와 대조한다.
자동화 부재를 이유로 timelock이나 review를 생략하지 않는다.

## Phase 4 — Delay and activation

1. pending update의 Manifest hash, bindings, effective time, reason, compiled plan/config
   hash를 Safe proposal 및 artifact와 대조한다.
2. delay 중 새 증거나 더 넓은 영향이 발견되면 `cancelManifestUpdate`하고 다시
   artifact부터 생성한다. pending payload를 재해석하지 않는다.
3. effective time 전 `activateManifestUpdate`가 revert하는지 dry-run한다.
4. delay 후 Registry operator가 update를 활성화한다.
5. 즉시 아래를 확인한다.
   - 대상 자산 version만 `+1`
   - 대상 status는 여전히 `SUSPENDED`
   - 새 exact Recipe version, Element ID/address/code hash와 config가 active
   - 영향받지 않은 자산의 version/binding/history/`policyId` 불변
   - old policy-bound RFQ quote settlement가 `RFQQuoteMismatch`로 실패
6. `recordPolicyAuditCheckpoint(token)`을 호출하고 새 checkpoint event와 artifact를
   reconciliation한다.

## Phase 5 — Verification gate

재개 예약 전에 다음을 모두 통과해야 한다.

- incident-specific unit/integration regression
- affected profile의 `toolkit-validate`, `toolkit-simulate`, `toolkit-preflight`
- fork/live read-only verification 또는 승인된 chain snapshot test
- `scripts/check.sh`
- `scripts/e2e-anvil.sh --profile <affected-profile>`의 7/7 및 RFQ success/rejection
- before/after artifact reconstruction, runtime code-hash와 checkpoint reconciliation
- 신규 quote가 새 `policyId`를 포함하고 old quote는 거부됨

검증 실패, provider stale/unavailable, finality/reorg 불확실성, Safe payload mismatch,
영향 범위 불명확 중 하나라도 있으면 suspended 상태를 유지한다.

## Phase 6 — Delayed resume

1. Factory owner/Safe가 `scheduleManifestResume(token, reason)`을 예약한다.
2. OperatorRegistry owner/Safe가 필요한 asset/venue/global unpause를 예약한다.
3. delay 동안 provider freshness, inventory, maker/signer와 monitoring readiness를 다시
   확인한다. 이상이 있으면 pending resume/unpause를 취소한다.
4. Registry operator가 Manifest를 먼저 resume한다.
5. venue/global pause를 사용했다면 좁은 범위부터 순서대로 해제한다.
6. **asset unpause를 마지막**에 실행한다.
7. maker approval은 fresh quote 발급 준비와 incident monitoring이 확인된 뒤 마지막에
   복구한다. 기존 quote를 재사용하지 않는다.

## Rollback

rollback은 이전 구현을 같은 ID에 덮어쓰는 작업이 아니다. 이상이 발견되면 즉시
asset/venue/global pause와 Manifest suspend를 다시 실행한다. 필요하면 또 다른 새
Element ID, Recipe version과 Manifest version을 만드는 동일 절차를 반복한다. 모든
재시도는 새 artifact, 새 digest, 새 checkpoint와 새 Safe proposal을 사용한다.

