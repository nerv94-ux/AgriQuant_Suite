# 경쟁상품 수집 파이프라인 고정 로드맵

이 문서는 작업 중 항상 띄워두는 고정 체크리스트입니다.
진행할 때마다 상태만 갱신합니다.

## 운영 방식 (로드맵 + 체크리스트 + TODO)
- 로드맵: 프로그램 완료까지 유지하는 상위 단계(큰 지도)
- 체크리스트: 현재 파트 완료 기준(단계별 실행 항목)
- TODO: 지금 당장 처리할 작업(짧은 실행 목록, 수시 갱신)

### 사용 규칙
- 로드맵은 지우지 않고 단계 상태만 갱신
- 체크리스트는 파트가 바뀌면 새로 교체
- TODO는 최대 3~5개만 유지하고 완료 즉시 체크
- 단계 완료 시 `완료 기록`에 날짜/파일 추가
- 큰 작업 1개 완료 시 백업 질의: `백업 커밋할까요?`

### 새 파트 시작 템플릿
- 파트명: `예) 단계 5/6: 운영 안정화`
- 목표: `무엇을 끝내면 완료인지 1~2줄`
- 체크리스트:
  - [ ] API/서버
  - [ ] UI/UX
  - [ ] 에러/예외
  - [ ] 검증(수동/로그)
- TODO(현재 할 일):
  - [ ] 바로 착수할 1번 작업
  - [ ] 이어서 할 2번 작업
  - [ ] 최종 확인 작업

## 현재 할 일 (고정 TODO)
- [ ] 쿨다운 종료 후 `수집 실행` 재테스트 (429/쿨다운/캐시 메시지 확인)
- [ ] `Gemini 요약` 재생성 후 성공률·근거 문구 품질 확인
- [ ] 필요 시 쿨다운 시간(6h) 운영값 재조정 여부 결정
- [ ] 수집 카드에 `다음 시도 가능 시각` 표시 추가
- [ ] 요약 카드에 `신뢰도(높음/중간/낮음)` 배지 추가

## 단계 1/4: 등록 자동화
- [x] 링크 입력 시 출처 자동 판별 (네이버/쿠팡/지마켓/11번가)
- [x] 링크에서 상품번호 자동 추출
- [x] 출처+상품번호 기반 정규 URL 자동 생성
- [x] 저장 전 URL/상품번호 정규화 검증

## 단계 2/4: 링크 복구/동기화
- [x] 주기 점검 시 URL 상태코드/리다이렉트 확인
- [x] 링크 깨짐 시 출처+상품번호로 표준 링크 재생성
- [x] 자동 복구 성공/실패 로그 기록
- [x] 수동 재확인 필요 대상 플래그

## 단계 3/4: 수집 실행 파이프
- [x] 수집 실행 API(수동 트리거) 추가
- [x] 가격/옵션가/품절/리뷰수/평점 1차 추출
- [x] 스냅샷 저장(시점별 비교 가능)
- [x] 실패 재시도/백오프/에러 리포트

## 단계 4/4: Gemini 요약 연결
- [x] 수집 데이터 입력 포맷(JSON) 정의
- [x] 요약 프롬프트 템플릿(강점/리스크/불만 키워드)
- [x] 정량 계산은 코드, 요약만 LLM 분리
- [x] 결과 카드(요약 + 근거 필드) 표시

## 단계 5/5: 운영 안정화(템플릿)
- 목표: 쿨다운/수집 신뢰도/운영 가시성을 개선해 실사용 안정성 확보
- 체크리스트:
  - [ ] API/서버: 쿨다운 정책 및 캐시 정책 운영값 확정
  - [ ] UI/UX: 다음 시도 가능 시각, 신뢰도 배지 표시
  - [ ] 에러/예외: 429/쿨다운/캐시 상태별 사용자 안내 문구 정리
  - [ ] 검증(수동/로그): 쿨다운 후 재시도 결과와 요약 품질 확인
- TODO(현재 할 일):
  - [ ] 쿨다운 종료 후 수집 실행 재테스트
  - [ ] 요약 생성 재실행 및 품질 확인
  - [ ] 운영값(쿨다운 시간/캐시 시간) 최종 결정

## 운영 원칙
- 공식 API/약관 우선 준수
- 요청 빈도 제한(차단 방지)
- 개인정보/민감정보 최소 저장
- 단계 완료 시 날짜와 변경 파일 기록

## 완료 기록
- 2026-04-09: 단계 1/4 완료
  - `src/components/desk/competitorTargets.ts`
  - `src/components/desk/DeskProductCompetitorTargetsPanel.tsx`
  - `src/components/desk/server/deskUserDraftQueries.ts`
  - `src/pages/api/desk/products/[id]/competitor-targets.ts`
- 2026-04-09: 단계 2/4 완료
  - `src/components/desk/competitorTargets.ts`
  - `src/components/desk/DeskProductCompetitorTargetsPanel.tsx`
  - `src/components/desk/server/deskUserDraftQueries.ts`
  - `src/pages/api/desk/products/[id]/competitor-targets.ts`
  - `src/pages/api/cron/desk-competitor-sync.ts`
- 2026-04-09: 단계 3/4 완료
  - `prisma/schema.prisma`
  - `prisma/migrations/20260409193000_desk_competitor_snapshot/migration.sql`
  - `src/components/desk/server/competitorCollector.ts`
  - `src/pages/api/desk/products/[id]/competitor-collect.ts`
  - `src/components/desk/DeskProductCompetitorTargetsPanel.tsx`
- 2026-04-09: 단계 4/4 완료
  - `src/components/desk/server/competitorSummary.ts`
  - `src/pages/api/desk/products/[id]/competitor-summary.ts`
  - `src/components/desk/DeskProductCompetitorTargetsPanel.tsx`

