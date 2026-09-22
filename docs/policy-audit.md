# Policy Audit Artifact

## 목적

production 정책 활성화에 사용한 Element, Recipe, Manifest 설정과 배포 코드를
PII 없이 재구성할 수 있도록 canonical 감사 아티팩트를 만든다. 아티팩트 원문은
운영자가 선택한 불변 저장소에 보관하고, 그 SHA-256 digest만
`ManifestCore.fullManifestHash`에 기록한다.

이 기능은 법률 승인, provider 원문 보관 또는 WORM/retention 제품을 대신하지
않는다. 저장소의 가용성·보존기간·접근통제는 production operator 책임이다.

## Commitment Model

```text
canonical artifact JSON
  └─ SHA-256("corner-store.policy-audit.v1" || 0x00 || JSON)
       ├─ sha256:<digest>        off-chain identifier
       └─ 0x<digest>             ManifestCore.fullManifestHash

Manifest approval
  └─ ComplianceEngine.recordPolicyAuditCheckpoint(token)
       └─ token + final policyId + version + artifact digest + status + historyHash
```

아티팩트에는 최종 `policyId`를 넣지 않는다. `policyId`는
`fullManifestHash`를 포함한 Manifest와 실행 배포 binding에서 계산되므로,
아티팩트가 자신의 digest와 최종 `policyId`를 동시에 포함하면 순환 commitment가
생긴다. 대신 Manifest가 아티팩트 digest를 원자적으로 고정하고, 승인 직후의
permissionless checkpoint event가 최종 `policyId`와 그 digest를 연결한다.

checkpoint는 상태를 변경하거나 새로운 권한을 만들지 않는다. 누구나 현재
Registry/Engine 상태에서 동일 값을 재계산해 event를 남길 수 있다. schema v4
onboarding plan은 `manifest-approve` 직후, venue/maker 활성화 전에 이 호출을 넣는다.
향후 suspend/resume/update/retire 운영도 lifecycle mutation 직후 checkpoint를
기록해야 한다.

## Canonical Schema

`corner-store-policy-audit` schema v1은 다음을 포함한다.

- chain, token, 의도한 policy version과 REGISTER/UPDATE lifecycle action
- config/legal/compiled-plan commitment와 Manifest fields
- exact Recipe binding과 enforcement override
- Engine/Registry 주소와 runtime code hash
- binding별 Element 구현, version/metadata, parameter schema/bytes/hash
- exact Recipe version, 구현, runtime code hash와 required Element set
- provider ID/evidence/signature의 hash reference와 유효기간
- compliance-data PII-free audit chain head
- 생성 tool version, source commit, 선택적 이전 artifact hash

unknown field는 거부한다. raw KYC/TA payload, 이름, 연락처, 신분증, signer secret을
넣지 않는다. `parameters`는 법률 승인된 정책값의 encoded bytes이며, provider 원문
또는 개인 식별자를 encode하는 용도로 사용하면 안 된다.

## CLI Workflow

예제 입력은
[`services/toolkit/examples/corner-store.policy-audit.input.json`](../services/toolkit/examples/corner-store.policy-audit.input.json)에 있다.

```sh
# 1. canonical artifact 생성(기존 파일 overwrite 거부)
corner-store policy-audit-build policy-audit.input.json --out policy-audit.json

# 2. 운영자가 선택한 store adapter에 보관
corner-store policy-audit-store policy-audit.json --store ./policy-audit-store

# 3. hash와 저장 상태 재검증
corner-store policy-audit-verify policy-audit.json \
  --expected sha256:<digest> --store ./policy-audit-store

# 4. hash만으로 복원·재검증
corner-store policy-audit-reconstruct sha256:<digest> \
  --store ./policy-audit-store --out reconstructed.json
```

`LocalPolicyAuditStore`는 content-addressed reference adapter다. regular file만 읽고,
원자적 create와 hash 재계산으로 overwrite/tamper를 거부한다. 단일 로컬 디스크는
production WORM, 복제, backup 또는 retention 보장이 아니다. production에서는 같은
`PolicyAuditStore` 계약을 만족하는 operator-owned durable adapter와 독립 복구 검증이
필요하다.

## Onboarding v4/v5 Gate

새 production onboarding은 schema v4를 사용한다.

- `artifactHash`와 `manifest.fullManifestHash`가 같은 digest여야 한다.
- reviewed artifact가 store에 먼저 존재하고 다시 읽어도 같은 canonical bytes여야 한다.
- chain/token, config/legal/compiled-plan, Manifest, binding/override,
  Element/Recipe, Engine/Registry 주소와 runtime code hash가 onboarding config와
  일치해야 한다.
- plan은 Manifest 승인 후 `recordPolicyAuditCheckpoint(token)`을 실행하고 그 뒤에만
  venue/maker activation을 진행한다.
- post-state verifier는 live `policyId`와 Manifest version이 nonzero인지 확인한다.

```sh
corner-store production-onboarding-plan corner-store.production-onboarding.json \
  --audit-artifact policy-audit.json \
  --audit-store ./policy-audit-store \
  --out safe-onboarding.json
```

schema v1~v3는 기존 demo/호환성 입력으로 계속 읽지만, 저장된 감사 아티팩트 gate를
제공하지 않으므로 새 production activation 근거로 사용하지 않는다.

schema v5는 parameterized REGISTER와 UPDATE에 사용한다. UPDATE artifact는 config의
`intendedPolicyVersion`, `previousArtifactHash`, compiled plan, Element parameter
schema와 exact bytes에 모두 일치해야 한다. 하나라도 다르면 Safe calldata를
출력하지 않는다.

## Reconciliation

감사 또는 사고 대응 시 다음을 함께 검증한다.

1. checkpoint event의 token/version/artifact hash/history hash를 읽는다.
2. artifact hash로 immutable store에서 원문을 복원하고 canonical hash를 다시 계산한다.
3. live Engine의 `policyHashesOf(token)`과 Registry의 `manifestVersionOf(token)`을
   checkpoint와 비교한다.
4. artifact의 deployment runtime code hash와 현재 code hash를 비교한다.
5. lifecycle 변경 뒤 checkpoint가 누락됐으면 서비스 활성화를 중단하고 incident
   runbook으로 이관한다.
