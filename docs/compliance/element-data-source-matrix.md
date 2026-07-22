# Element Data-Source Matrix (기술측)

각 compliance Element의 **현재(illustrative) 구현 → production 데이터 소스 → 연동 방식 → 코드상 seam → 결정 상태**를 한 곳에 모은 변환표다. ADR-004가 Phase 1 착수 조건으로 요구하는 **Legal-to-Technical Matrix**(법 → 증거 → 집행)의 *기술측 절반*을 채우며, 각 행의 "법무 확정 질문"이 법률측 절반의 입력이 된다.

> **원칙 (ROADMAP/MVP-v2, D008).** 모든 Element의 데이터 실질은 법률 검토 승인 전까지
> operator-settable attestation mock으로 유지한다. 이 표의 "production 소스" 열은
> 승인 후 연결할 대상의 후보이지, 승인된 정책이 아니다.

> **출처 주의.** Element별 데이터 소스의 1차 도출은 전략 보고서(노트 14,
> `docs/reference/14-decipher-rwa-dex-overview.md`) §3.2인데, 이 파일은 현재
> **main에 없다**(`layer1-layer2-mvp-for-dex` 브랜치에만 존재). main 편입 여부가
> 미결이므로, 이 표가 main에서 참조 가능한 유일한 요약본이다.

## 구현된 Element (11)

| ID | 현재 mock 구현 (seam 위치) | Production 데이터 소스 | 연동 방식 | 상태 / 법무 확정 질문 |
| --- | --- | --- | --- | --- |
| **A-01 Sanctions** | operator가 `setBlocked`로 켜는 bool — `src/compliance/elements/Sanctions.sol` | OFAC SDN 리스트 (Chainalysis/TRM 류 온체인 oracle) | oracle 컨트랙트 조회로 `check` 내부 교체, 또는 oracle→attestation 갱신 봇 | 승인 게이트. Q: 리스트 갱신 SLA(거래 시점 최신성 요구 수준), 2차 제재(secondary sanctions) 포함 범위 |
| **A-02 Jurisdiction** | `jurisdictionOf` + `allowedJurisdiction` operator 매핑 — `Jurisdiction.sol` | ONCHAINID 관할권 claim (trusted issuer 발급) | claim topic 등록 + `check`가 claim 존재·유효성 조회 | 승인 게이트. Q: Reg S category 기준의 국가 분류표, allowed-set 변경 거버넌스(누가·어떤 절차로) |
| **A-03 Accredited Investor** | 단일 bool `setAccredited` — `AccreditedInvestor.sol` | ONCHAINID `ACCREDITED_INVESTOR_TOPIC` + `SELF_CERT_TOPIC` claims | **element 세분화 선행**: 노트 14 §3.1의 4-원자(적격 claim / 최소투자금액 / 자기인증 / 제3자 자금조달 부재)로 분해 후 claim별 연동 | 승인 게이트 + **구현 분해 필요**. Q: 506(c) 합리적 검증 방법(소득/순자산 증빙 기준, 2025-03 SEC No-Action Letter 반영 범위), claim 유효기간/갱신 주기 |
| **A-04 Identity Uniqueness** | operator `bindIdentity` 1:1 바인딩 (불변식은 setter가 강제) — `IdentityUniqueness.sol` | ONCHAINID IdentityRegistry (T-REX와 공유) | ERC-3643 IdentityRegistry 조회로 교체 (지갑↔identity 매핑은 이미 그쪽이 원본) | 승인 게이트. Q: 1인 다지갑 허용 정책(허용 시 한도 합산 기준), identity 회수·재발급 절차 |
| **A-05 US Tax Resident** | `setUsTaxResident` 플래그, **미플래그=통과(fail-open, 주석으로 명시)** — `UsTaxResident.sol` | 적극적 비거주 attestation (IRS Substantial Presence Test 기반) | 부재=거부(fail-closed)로 뒤집고 positive claim 요구 | 승인 게이트 + **시맨틱 반전 필요**. Q: 증빙 형식(W-8BEN 상당?), 판정 주체와 갱신 주기 |
| **A-13 Qualified Purchaser** | bool `setQualifiedPurchaser` — `QualifiedPurchaser.sol` | ONCHAINID claim | claim 존재·issuer·만료 검증 ("Pattern B") | 승인 게이트. **법률 심층 문서 존재**: `docs/compliance/elements/A-13_qualified-purchaser.md` (11개 중 유일한 walkthrough — 나머지 element의 표준 포맷) |
| **B-01 Asset Classification** | `setClassification(asset, tag)` + 생성자 `requiredClassification` — `AssetClassification.sol` | 발행인 선언 (Listing Agreement) + operator 승인 | Manifest 등록 시 분류를 함께 심사·기록하는 운영 절차와 결합 | 승인 게이트. Q: 분류 선언의 책임 주체(발행인 vs operator), 오분류 발견 시 정정·소급 절차 |
| **B-02 ERC-3643 Native** | `setErc3643Native` attestation (**의도적 stand-in**, natspec에 seam 명시) — `Erc3643Native.sol` | ERC-165 `supportsInterface`(T-REX `IToken`) 또는 token registry 조회 | `check` 내부를 introspection으로 교체 — **결정론적, 법무 불필요** | **기술 결정만 남음** (vendored T-REX의 ERC-165 지원 여부 검증 필요, D008) |
| **C-01 Rule 144 Lockup** | `AttestedAcquisitionSource`의 expiring holder×asset snapshot + mock TA lot resolver | ADR-008의 Transfer Agent adapter; 실제 Securitize API mapping은 미검증 | off-chain per-lot lineage/완납일 검증 → conservative snapshot hash attestation → `Lockup` fail-closed | **foundation 구현, production provider blocked.** Q: 공식 API field/auth, amount-specific lot allocation(FIFO 등), retention/WORM provider |
| **E-01 Form D Filing** | `setFormDFiled(asset, filed, ref)` + 참조 해시 — `FormDFiling.sol` | EDGAR oracle 또는 hash-anchored Listing Agreement | 제출 확인 봇이 attestation 갱신 + `filingRef`에 accession number 해시 | 승인 게이트. Q: 최초 판매 후 15일 제출 시한의 온체인 반영(유예 처리), amendment 추적 범위 |
| **F-02 Market Conduct (Surveillance)** | 거래 카운터 임계 초과 시 flag 이벤트 (STATEFUL, 차단 안 함) — `SurveillanceFlag.sol` | Phase 3 operator 시장감시 규칙 | 감시 패턴은 off-chain 분석 + on-chain flag hook 유지 | **Phase 3 범위** (Layer 4). Q: 감시 패턴 정의와 broker-dealer 규제 연구 결과 대기 (Element catalog freeze 노트 참조) |

## 백로그 Element (미구현 — pool freeze v1 기준)

| ID | 내용 | 데이터 소스 후보 | 상태 |
| --- | --- | --- | --- |
| C-02 Swap Cooldown | 스왑 간 최소 간격 | on-chain state (자체 기록) | Phase 1·2 optional |
| C-03 Max Balance per Holder | 보유 한도 | on-chain state + manifest 파라미터 | Phase 1·2 optional |
| E-02 Issuer Standing | 발행인 자격 유지 | issuer attestation | Phase 1·2 optional |
| D-03 Listing Differential Disclosure | 상장 차등 공시 | operator/issuer 공시 채널 | Phase 3 |
| F-01 Operator Affiliate Restriction | 운영자 특수관계인 제한 | operator 신고 | Phase 3 |

41개 확장 카탈로그(법률 리서치 제안)는 backlog 입력이며, market-conduct/broker-dealer
연구 완료 전 개별 Element의 법적 정확성·데이터 소스는 검토되지 않은 것으로 본다
(`docs/compliance/04-element-interface.md` 배너, MVP-v2 §5·§8).

## 다음 단계

1. **법무측 절반**: 이 표의 "법무 확정 질문" 열을 입력으로 Legal-to-Technical Matrix의
   법률 검증(ADR-004 요구 산출물)을 완성한다. Element당 심층 포맷은 A-13 walkthrough를
   표준으로 한다.
2. **기술 선행 작업** (법무 무관하게 진행 가능): B-02 introspection 전환 검증,
   A-03 4-원자 element 분해 설계, A-05 fail-closed 반전 설계.
3. **provider refinement**: C-01의 실제 TA API mapping, amount-specific lot allocation과
   production audit storage를 검증한다(ADR-008/D012).

관련 문서: D008/D009(`DECISIONS.md`), `docs/demo.md`(mock vs real 경계),
`docs/compliance/04-element-interface.md`(인터페이스·택소노미),
`docs/compliance/elements/A-13_qualified-purchaser.md`(walkthrough 표준).
