# Decisions

## D001 — Repository-managed Harness를 사용한다

Date: 2026-06-09

### Context

프로젝트 상태와 다음 작업이 대화나 외부 메모에 의존하면 새 에이전트 세션이
정확한 범위와 완료 조건을 복구하기 어렵다.

### Decision

다음 역할을 저장소 파일로 관리한다.

- 진입 지침: `AGENTS.md`
- 아키텍처 라우터: `ARCHITECTURE.md`
- feature 상태: `FEATURES.md`
- 세션 상태: `PROGRESS.md`
- 결정 이유: `DECISIONS.md`
- 품질 상태: `QUALITY.md`
- 큰 작업 계획: `docs/exec-plans/`
- 전체 검증: `scripts/check.sh`

### Alternatives Considered

- 대화와 외부 노트만 사용: 세션 간 복구와 검증 근거가 약해 제외
- 모든 내용을 `AGENTS.md`에 작성: 진입 문서가 길어지고 중복되므로 제외

### Consequences

- 작업 전후 상태 문서 갱신 비용이 생긴다.
- 대신 작업 범위, 결정 이유와 검증 결과가 저장소에 남는다.

### Related Files

- `HARNESSGUIDE.md`
- `AGENTS.md`
- `FEATURES.md`
- `PROGRESS.md`

## D002 — 현재 제품 문서를 유지한 채 imported 문서를 별도 migration feature로 반영한다

Date: 2026-06-09

### Context

`importedDouments/`에는 SDK/reference DEX와 4-Layer compliance 모델을 설명하는
새 입력 자료가 있다. 기존 공식 문서와 동시에 수정하면 Harness 구조 변경과 제품
경계 변경이 섞인다.

### Decision

Harness baseline에서는 현재 `docs/`를 공식 source of truth로 유지한다. imported
문서 반영은 `DOC-001` feature와 별도 Exec Plan에서 수행한다.

### Alternatives Considered

- Harness 작업과 아키텍처 migration을 동시에 수행: 변경 범위와 검증 기준이
  혼합되어 제외

### Consequences

- 짧은 기간 동안 현재 문서와 다음 방향 입력 자료가 함께 존재한다.
- `docs/product-specs/index.md`와 `PROGRESS.md`에서 migration pending 상태를
  명시한다.

### Related Files

- `importedDouments/`
- `docs/product-specs/index.md`
- `FEATURES.md`
