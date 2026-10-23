# DB · API 연결 가이드 (TALENT LINK)

## 0. 지금 상태
| 부분 | 지금 | 연결 후 |
|---|---|---|
| 데이터 (공고·임직원·지원·제안·기록) | 각 브라우저의 localStorage + 페이지 안에 적은 값 | **Supabase DB** 한 곳 — 누가 어디서 열어도 같은 데이터 |
| AI 결과 (요건 분해·점수·추천서·제안서) | 미리 써 둔 모의 결과 | **Gemini API**가 실제로 생성 |
| 서버 | Vercel 함수 2개 (로그인·로그아웃) + 미들웨어 | Vercel 함수 `/api/*` 가 DB와 AI를 잇는 다리 |
| 비밀값 | Vercel 환경변수: HR_ID · HR_PASSWORD · HR_SESSION_SECRET · GEMINI_API_KEY | + SUPABASE_URL · SUPABASE_SECRET_KEY |

원칙: **브라우저는 DB·AI에 직접 접근하지 않는다.** 모든 요청은 `/api/*`를 거치고, 키는 서버(Vercel 환경변수)에만 둔다.

```
브라우저 ──fetch──▶ /api/* (Vercel 함수) ──▶ Supabase (Postgres · Storage · pgvector)
                         │
                         └──────────────▶ Gemini API (LLM · 임베딩)
```

## 1. 연결할 것 목록
| # | 무엇 | 역할 | 필요한 값 |
|---|---|---|---|
| 1 | **Supabase Postgres** | 공고 45개, 임직원·발령·자격·교육·성과·프로젝트·CDP·인재풀 동의, 지원·제안·추천서·운영 기록 | SUPABASE_URL, SUPABASE_SECRET_KEY |
| 2 | **Supabase pgvector** | 문서 조각의 의미 검색 ("표현이 달라도 같은 경험") | (1과 같음, 확장 기능만 켬) |
| 3 | **Supabase Storage** | JD 원문, 논문 요약, 전임자 메모, 수행확인서 같은 파일 원본 | (1과 같음) |
| 4 | **Gemini API — 텍스트** | JD 요건 분해, 후보 정성 판정, 추천서·제안서·셀프 진단 문장 | GEMINI_API_KEY (등록돼 있음) |
| 5 | **Gemini API — 임베딩** | 문서·프로필을 벡터로 바꿔 pgvector에 저장 | (4와 같음) |
| 6 | **Vercel 함수 `/api/*`** | 위 1~5를 화면과 연결, 인사 권한 확인 | 추가 값 없음 |

## 2. 세팅 순서

### 1단계 — Supabase 프로젝트 만들기 (사람이 할 일, 5분)
1. https://supabase.com 로그인 → **New project**
2. 이름 `talent-link`, 지역 **Northeast Asia (Seoul)**, DB 비밀번호 저장
3. Project Settings → API에서 **Project URL**, **secret key(service_role)** 복사
   - secret key는 서버 전용. 화면 코드·저장소·카톡에 붙이지 않는다.

> 다른 방법: Vercel 대시보드 → 프로젝트 → Storage/Marketplace에서 Supabase를 추가하면 환경변수가 자동으로 들어간다.
> 기존 ai-runner용 Supabase 프로젝트는 다른 앱과 섞이므로 새 프로젝트를 권장한다.

### 2단계 — 환경변수 등록 (Claude가 할 수 있음)
```bash
vercel env add SUPABASE_URL production preview development
vercel env add SUPABASE_SECRET_KEY production preview development
vercel env pull .env.local     # 로컬 개발용 (gitignore 됨)
```

### 3단계 — 테이블 만들기 (Claude가 SQL 작성 → Supabase SQL Editor에서 실행)
`data/*.json` 구조를 그대로 표로 옮긴다.

| 묶음 | 테이블 |
|---|---|
| 공고 | `jobs` (45개, 회사·업무·필수·우대·검증 상태), `job_requirements` (AI가 분해하고 인사팀이 확정한 요건·가중치) |
| 임직원 | `employees`, `appointments`, `certifications`, `trainings`, `performance`, `projects`, `evidence_docs`, `skills`, `career_plans`, `talent_pool_consents`, `availability` |
| 업무 기록 | `applications` (지원·취소), `offers` (제안서), `reports` (추천서), `scan_runs` · `scan_results` (스캔 결과·점수·근거), `audit_log` |
| 문서 검색 | `documents` (원본 메타), `document_chunks` (조각 + `embedding vector(768)`) |

보안: 모든 테이블에 RLS(행 단위 보안)를 켜고 공개 정책을 두지 않는다. → 브라우저가 직접 읽을 수 없고, `/api/*`(secret key)만 접근.

### 4단계 — 시드 데이터 넣기 (Claude)
`node data/seed.mjs` — `data/*.json`(임직원 44명 등)과 `data/jobs.json`(45개)을 DB에 넣는 스크립트. 공고를 바꾸면 `jobs_source.txt → sync-jobs → seed` 순서.

### 5단계 — Gemini 연결 확인 (Claude)
- 키는 이미 Vercel에 있음 (`GEMINI_API_KEY`). Google AI Studio에서 발급한 키.
- 텍스트: Gemini Flash 계열(속도·비용), 결과는 **JSON 스키마 고정 출력**으로 받아 화면 표에 그대로 넣는다.
- 임베딩: Gemini 임베딩 모델(768차원)로 문서 조각 저장.
- 무료 한도가 있으므로 **규칙 필터로 먼저 줄이고(1,248 → 약 300), LLM은 상위 약 50명에만** 쓰고, 결과는 `scan_results`에 저장해 다시 부르지 않는다.

### 6단계 — API 만들기 (Claude)
| API | 하는 일 | 권한 |
|---|---|---|
| `GET /api/jobs` | 공고 목록·상세 | 누구나 |
| `POST /api/analyze-jd` | JD + 참고 문서 → Gemini → 요건·유형·필수/우대·가중치 제안 | 인사 |
| `POST /api/scan` | 확정 요건으로 ① 규칙 필터(SQL) ② 의미 검색(pgvector) ③ Gemini 정성 판정 → 점수·근거 저장 | 인사 |
| `POST /api/draft` | 추천서 / 제안서 생성 (근거 있는 내용만) | 인사 |
| `POST /api/offers` | 제안 발송 → 당사자 받은 제안함 | 인사 |
| `POST /api/self-check` | 임직원 적합도·요건별 비교·보충할 점 | 임직원 |
| `POST /api/applications` · `DELETE /api/applications/:id` | 지원 · 지원 취소 | 임직원 |
| `POST /api/upload` | 문서 업로드 → Storage → 조각내기 → 임베딩 저장 | 인사 |
| `GET /api/audit` | 운영 기록 | 인사 |
인사 권한은 지금의 로그인 쿠키(`tl_hr`)를 함수에서도 똑같이 확인한다. 임직원 쪽은 시연용 고정 사용자(이한결)로 두고, 실제 도입 시 사내 SSO로 바꾼다.

### 7단계 — 화면을 API로 바꾸기 (Claude)
- localStorage 읽기·쓰기 → `fetch('/api/...')`
- **API가 실패하면 지금의 모의 결과로 자동 전환** (발표 중 네트워크 문제 대비)
- 화면에 "AI 생성 · 2026-10-24 14:05 · 근거 6건" 처럼 생성 시각과 근거 수 표시

### 8단계 — 확인·배포
`vercel dev`로 로컬 확인 → e2e·피드백 점검 스크립트에 API 경로 추가 → push → 자동 배포.

## 3. 결정이 필요한 것 (사용자)
1. Supabase: **새 프로젝트**(권장) / 기존 프로젝트에 `tl_` 접두사로 같이 쓰기
2. 발표 때 실제 AI 호출을 켤지, 모의 결과로 고정할지 (권장: 실제 호출 + 실패 시 자동 모의 전환)
3. 외부 AI로 보내는 데이터는 가상 데이터만 — 실제 도입 시에는 사내 전용 모델 또는 보안 계약 필요 (서술의 "한계"에 기재)
