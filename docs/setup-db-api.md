# DB · API 연결 가이드 (TALENT LINK) — 2026-10-25 개정

## 0. 결론
- **꼭 필요한 것은 AI API(Gemini) 하나**이고, 이미 연결돼 있다 (`/api/draft`, Vercel 환경변수 `GEMINI_API_KEY`).
- **DB(Supabase Postgres)는 선택**이다. 여러 기기·여러 사람이 같은 데이터를 봐야 할 때만 필요하다.
- **pgvector(벡터 검색)는 지금 규모에선 불필요**하다. 아래 4장 참고.

## 1. 지금 연결된 것
| 구성 | 역할 | 상태 |
|---|---|---|
| Vercel 정적 사이트 `public/` | 화면 5개 + 공용 문서 틀 `talent-docs.js` | 배포 중 |
| `middleware.js` + `/api/login` · `/api/logout` | 인사 화면 로그인 (서명 쿠키 `tl_hr`) | 완료 |
| `/api/draft` | 추천서·제안서 내용 생성 (Gemini, JSON 출력, 실패 시 규칙 기반 초안) | 완료 |
| `api/_lib/prompts.js` | AI 규칙·문서별 작성 기준·출력 스키마 | 완료 |
| 브라우저 저장소(localStorage) | 공고·지원·제안·운영 기록 | 같은 브라우저 안에서 화면끼리 연결 |

환경변수(Vercel): `HR_ID`, `HR_PASSWORD`, `HR_SESSION_SECRET`, `GEMINI_API_KEY`, (선택) `GEMINI_MODEL` — 값은 저장소에 두지 않는다.

## 2. 추가로 만들 AI API (DB 없이 가능)
| API | 입력 → 출력 | 화면 |
|---|---|---|
| `POST /api/analyze-jd` | JD 원문 + 참고 자료(전임자 인수인계·고성과자 패턴·연구 요약) → 요건 목록(평가 축·정량/정성·필수/우대·근거 출처)과 축별 중요도 4단계 제안 | AI 인재 매칭 STEP 2 |
| `POST /api/evaluate` | 확정 요건 + 후보 1명의 프로필·근거 → 요건별 상태(확인/확인 필요/정보 미확인)·근거 문장·잘 맞는 점·우려점·면담 질문 | STEP 4 후보 상세 (규칙 필터 후 상위 후보만) |
| `POST /api/self-check` | 공고 + 내 프로필 → 요건별 비교·보충할 점 | 임직원 적합도 진단 |

모두 `/api/draft`와 같은 방식: 프롬프트 틀은 `api/_lib/prompts.js`, 출력은 JSON 스키마 고정, 실패하면 화면의 기존 결과로 자동 전환.
점수(5축 종합)는 AI가 아니라 규칙 계산으로 둔다 — 같은 입력이면 같은 점수, 가중치를 바꾸면 즉시 재계산.

## 3. DB가 필요해지는 경우 (선택)
필요한 경우: 인사 담당자 PC에서 보낸 제안을 임직원이 **다른 기기**에서 받아야 할 때, 여러 담당자가 같은 기록을 볼 때, AI 결과를 저장해 다시 부르지 않을 때.
시연 영상처럼 한 브라우저에서 흐름을 보여주는 경우엔 지금 구조로 충분하다.

세팅 순서 (Supabase 기준)
1. supabase.com → New project → 지역 Seoul → Project URL·secret key 복사 (또는 Vercel 대시보드 → Storage에서 Supabase 추가하면 환경변수 자동 등록)
2. `vercel env add SUPABASE_URL` / `SUPABASE_SECRET_KEY`
3. 테이블 생성(SQL Editor): `jobs`, `job_requirements`, `employees`(+ 경력·자격·교육·성과·프로젝트·근거문서·인재풀 동의), `applications`, `offers`, `reports`, `audit_log`, `ai_results` — 모든 테이블 RLS 켜고 공개 정책 없음(서버 함수만 접근)
4. `node data/seed.mjs`로 `data/*.json` 적재
5. API 추가: `GET /api/jobs`, `POST/DELETE /api/applications`, `POST /api/offers`, `GET /api/audit`
6. 화면의 localStorage 읽기·쓰기를 `fetch('/api/...')`로 교체, 실패 시 localStorage로 대체

## 4. pgvector가 필요 없는 이유
- pgvector는 **문서가 너무 많아 AI에게 다 줄 수 없을 때** 관련 조각만 먼저 골라내는 용도다.
- 지금은 후보 프로필·근거가 사람당 수백~수천 자이고, 규칙 필터로 후보를 수십 명으로 줄인 뒤 **프로필 전체를 AI에 그대로** 넣어도 충분하다.
- "표현이 달라도 같은 경험" 연결은 AI가 프로필 문장과 요건을 직접 대조하면서 처리하고, 자주 쓰는 표현은 역량 동의어 사전으로 보완한다.
- 실제 도입 규모(수만 명 × 문서 수십 건)가 되면 그때 벡터 검색을 추가한다 → 서술의 "확장 계획"에 한 줄로 쓰면 된다.

## 5. 보안·원칙
- 브라우저는 DB·AI에 직접 접근하지 않고 `/api/*`만 거친다. 키는 Vercel 환경변수에만 둔다.
- 인사용 API는 로그인 쿠키(`tl_hr`)를 확인한다 (`/api/draft`는 적용됨).
- 외부 AI에는 가상 데이터만 보낸다. 실제 도입 시 사내 전용 모델 또는 보안 계약 필요.
