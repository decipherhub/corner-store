# SDK-002 — Standalone Integration and Deployment Workflow

## Goal

외부 사용자가 Corner Store 저장소 내부 구조를 몰라도 설치, 구성, 배포 계획,
RFQ 연결과 검증을 수행할 수 있는 package-ready workflow를 제공한다.

## In Scope

1. contracts, Toolkit, RFQ SDK와 CLI package metadata
2. unified `create`, `doctor`, `deploy`, `verify`, `test-module` commands
3. library-only, reference-service와 existing-backend project modes
4. secret/address-free generated config and runtime contract
5. optional Docker export
6. clean generated-project and package validation

## Out of Scope

- npm registry publish와 release credentials
- hosted RFQ dealer
- production durable nonce implementation (#66)
- production auth/audit/rate-limit implementation (#67)
- Kubernetes 또는 특정 cloud vendor

## Execution

1. 기존 Toolkit/RFQ behavior를 회귀 테스트로 고정한다.
2. package metadata와 unified command aliases를 추가한다.
3. standalone project generator와 doctor/verify flow를 구현한다.
4. public module conformance command를 연결한다.
5. 외부 임시 디렉터리에서 install/build/dry-run을 검증한다.
6. 문서와 repository 상태를 갱신하고 전체 check를 실행한다.

## Completion Evidence

- Docker 없이 clean project 생성·설치·build·doctor 통과
- Docker는 명시적 선택에서만 생성
- existing backend와 library-only 모드가 server를 강제하지 않음
- custom RFQ module이 CLI conformance를 통과
- package dry-run에 runtime source와 type declarations 포함
- repository check 통과

## Result

- source checkout과 packed CLI 양쪽에서 clean generated project를 생성하고
  install, build, test, doctor와 deployment dry-run을 검증했다.
- bundled contract source로 독립 Foundry build를 실행하고 isolated Anvil에 실제
  broadcast한 뒤 생성 deployment artifact를 `verify`로 확인했다.
- EIP-712 signer conformance는 서명 길이만 확인하지 않고 configured maker
  address 복구까지 검증한다.
- `scripts/check.sh`에서 Forge 665/665, 모든 service smoke와 deploy-v3 10/10을
  통과했다.
