// 시연용 가상 인사 데이터 생성기.
// 실제 인사 환경의 시스템별 내보내기(export) 형태를 그대로 흉내 낸다 → 나중에 실제 데이터로 바꿔 끼울 수 있게.
// 실행: node data/generate.mjs  → data/*.json
// 회사는 실제 한화 계열사 이름을 쓰지만, 모든 인물과 수치는 가상이다. 성별·나이 등 직무와 무관한 속성은 만들지 않는다.
import fs from 'node:fs';
import path from 'node:path';

const OUT = path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'));
let seed = 20261022;
const rnd = () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648);
const pick = a => a[Math.floor(rnd() * a.length)];
const between = (a, b) => Math.round(a + rnd() * (b - a));
const d = (y, m, day = 1) => `${y}-${String(m).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

const COMPANIES = ['한화오션', '한화시스템', '한화에어로스페이스'];
// 계열사마다 실제로 있을 법한 조직만 쓴다 [팀, 직무군, 직무]
const TEAMS = {
  한화오션: [['기본설계팀', '설계', '선박 설계'], ['생산기획팀', '생산', '생산 계획'], ['품질경영팀', '품질', '품질 보증'], ['구매팀', '구매', '기자재 구매'], ['설계지원팀', '설계', '설계 데이터'], ['재무팀', '재무', '재무 담당']],
  한화시스템: [['체계개발팀', '연구개발', '시스템 엔지니어링'], ['SW개발팀', '연구개발', '임베디드 SW'], ['생산관리팀', '생산', '생산 관리'], ['품질보증팀', '품질', '품질 보증'], ['해외사업팀', '영업', '방산 수출'], ['전략기획팀', '경영관리', '전략 기획']],
  한화에어로스페이스: [['기계설계팀', '연구개발', '기계 설계'], ['제어개발팀', '연구개발', '제어 SW'], ['생산기술팀', '생산', '제조 공정'], ['품질보증팀', '품질', '품질 보증'], ['구매팀', '구매', '부품 구매'], ['인사팀', '인사', '인사 운영']],
};
// 신뢰 등급: 시스템 확정 / 문서 근거 / 본인 기재 / 면담 확인 필요
const T = { SYS: '시스템 확정', DOC: '문서 근거', SELF: '본인 기재', ASK: '면담 확인 필요' };

const tables = { employees: [], appointments: [], certifications: [], trainings: [], performance: [], projects: [], skills: [], career_plans: [], talent_pool_consents: [], availability: [], evidence_docs: [] };
const add = (t, row) => tables[t].push(row);

// ───── 상세 인물 (화면·영상 시나리오와 같은 사실) ─────
const DETAILED = [
  { emp_id: 'EMP-001', name: '김서윤', company: '한화오션', org: '경영분석팀', job_family: '경영관리', job: '경영분석', grade_band: 'G3', hire: d(2021, 3), applied: true,
    appts: [[d(2021, 3), null, '경영분석팀', '경영분석', '입사']],
    certs: [['SQLD', '한국데이터산업진흥원', d(2023, 6, 16), T.SYS]],
    lms: [['SQL 실무 심화', '데이터', 16, d(2022, 9, 30)]],
    perf: [[2024, 'A', 0.18, 108, '순매출 기준 차이를 발견하고 재무·영업과 정의서를 정리함. 데이터 검증 정확도가 높음.'], [2025, 'A', 0.15, 111, '월간 실적 대시보드로 경영회의 준비 시간을 줄임.']],
    projects: [['월간 실적 한눈에 보기', d(2025, 2), d(2025, 8, 31), '사업부별 보고 수치와 표현 통일', '데이터 모델·대시보드 개발 담당', ['SQL로 매출 집계 및 원장 대조', 'Power BI 모델·DAX 지표 작성', '재무·영업과 순매출 정의 합의'], ['SQL', 'Power BI', 'DAX'], ['매출·손익 대시보드', '지표 정의서', '대조 쿼리'], ['원천 ERP 개발'], T.DOC]],
    skills: [['SQL', '실무'], ['Power BI', '실무'], ['지표 설계', '실무']],
    cdp: [['경영지표·데이터 표준'], '그룹 공통 경영지표 체계를 운영하는 역할', '1년 내'],
    consent: true, avail: [d(2026, 12), 100, '서울 · 주 2일 원격 희망'] },
  { emp_id: 'EMP-011', name: '이한결', company: '한화에어로스페이스', org: '데이터운영팀', job_family: '데이터', job: '데이터 운영', grade_band: 'G3', hire: d(2022, 8), applied: false,
    appts: [[d(2022, 8), d(2024, 1, 31), '설비관리팀', '설비 관리', '입사'], [d(2024, 2), null, '데이터운영팀', '데이터 운영', '직무 전환']],
    certs: [['SQLD', '한국데이터산업진흥원', d(2023, 6, 16), T.SYS], ['ADsP', '한국데이터산업진흥원', d(2024, 11, 22), T.SYS]],
    lms: [['사내 데이터분석 심화과정', '데이터', 40, d(2024, 6, 28)], ['Python 업무 자동화', '데이터', 12, d(2025, 3, 14)]],
    perf: [[2024, 'A', 0.12, 112, '3개 사업장 데이터 표준 통일을 실무 리드. 타 사업장 담당자 설득을 주도함.'], [2025, 'B+', 0.30, 104, '월간 리포트 작성 6시간→40분, 재보고 월 5건→1건으로 줄임.']],
    projects: [['사업장 데이터 표준 통일', d(2024, 4), d(2024, 12, 31), '3개 사업장 운영 지표 정의 통일', '실무 리드', ['지표 정의 차이 조사', '표준 정의서 작성', '사업장 담당자 합의 진행'], ['SQL', 'Excel'], ['데이터 표준 정의서'], ['원천 시스템 개발'], T.DOC],
      ['월간 리포트 자동화', d(2025, 3), d(2025, 9, 30), '월간 운영 리포트 작성 시간 단축', '개발 담당', ['SQL 데이터 검증', 'Python 리포트 자동화'], ['SQL', 'Python', 'Power BI'], ['자동화 스크립트', '월간 리포트'], [], T.DOC]],
    skills: [['SQL', '실무'], ['Python', '실무'], ['Power BI', '실무']],
    cdp: [['데이터 분석', '경영지표'], '그룹 차원의 경영 데이터 표준을 만드는 역할', '즉시'],
    consent: true, avail: null },
  { emp_id: 'EMP-024', name: '박지호', company: '한화시스템', org: '사업관리팀', job_family: '경영관리', job: '사업 실적 관리', grade_band: 'G3', hire: d(2020, 1), applied: false,
    appts: [[d(2020, 1), null, '사업관리팀', '사업 실적 관리', '입사']], certs: [], lms: [['SQL 기초', '데이터', 8, d(2023, 4, 7)]],
    perf: [[2024, 'S', 0.05, 121, '사업별 수주·매출 분석으로 목표 배분을 개선함.'], [2025, 'A', 0.14, 109, '사업·재무 부서 간 실적 기준을 조율함.']],
    projects: [['사업별 수주·매출 분석 체계', d(2023, 2), d(2023, 10, 31), '사업별 수주·매출 실적 분석', '분석 담당', ['사업별 실적 분석', '실적 기준 조율'], ['Excel'], ['사업 실적 보고서'], [], T.DOC]],
    skills: [['실적 분석', '전문']], cdp: null, consent: true, avail: null },
  { emp_id: 'EMP-037', name: '최예린', company: '한화오션', org: '재무팀', job_family: '재무', job: '손익 분석', grade_band: 'G3', hire: d(2021, 7), applied: false,
    appts: [[d(2021, 7), null, '재무팀', '손익 분석', '입사']], certs: [['재경관리사', '삼일회계법인', d(2022, 5, 20), T.SYS]], lms: [],
    perf: [[2024, 'A', 0.2, 106, '사업부 손익 차이 원인 분석 보고 체계를 만듦.'], [2025, 'A', 0.22, 105, '결산 데이터 검증 쿼리를 정리함.']],
    projects: [['손익 차이 분석 보고 체계화', d(2024, 3), d(2024, 9, 30), '월 손익 차이 원인 보고', '분석 담당', ['결산 데이터 SQL 추출·검증', '차이 원인 보고'], ['SQL', 'Excel'], ['손익 차이 보고서'], [], T.DOC]],
    skills: [['SQL', '실무'], ['손익 분석', '전문']], cdp: [['재무 기획'], '재무 기획 리더', '1년 내'], consent: true, avail: null },
];
const FILLER_NAMES = ['정민호', '한다인', '오태경', '윤채원', ...'민서 지안 도윤 하은 서진 예준 수아 시우 지유 건우 채은 현우 유나 태민 소율 준서 다은 윤호 서아 재원 나연 승현 하린 우진 지민 은호 가윤 성민 다현 주원 세아 동하 연우 서율 이준 하람'.split(' ').map((g, i) => '김이박최정강조윤장임한오서신권황'[i % 16] + g)];
const GRADES = [['S', 0.05], ['A', 0.2], ['B+', 0.45], ['B', 0.8], ['C', 0.95]];

function emit(e) {
  add('employees', { emp_id: e.emp_id, name: e.name, company: e.company, org: e.org, job_family: e.job_family, job: e.job, grade_band: e.grade_band, hire_date: e.hire, work_location: '서울', status: '재직', _source: 'HRIS 인사 마스터', _tier: T.SYS });
  e.appts.forEach(([from, to, org, job, type]) => add('appointments', { emp_id: e.emp_id, from, to, company: e.company, org, job, type, _source: 'HRIS 발령 이력', _tier: T.SYS }));
  e.certs.forEach(([name, issuer, acquired_at, tier]) => add('certifications', { emp_id: e.emp_id, name, issuer, acquired_at, _source: '자격 등록', _tier: tier }));
  e.lms.forEach(([course, category, hours, completed_at]) => add('trainings', { emp_id: e.emp_id, course, category, hours, completed_at, _source: 'LMS', _tier: T.SYS, _note: '이수는 숙련을 뜻하지 않음' }));
  // 등급 원점수와 함께 "회사 내 상대 위치"를 둔다 — 계열사 간 비교는 상대 위치로만
  e.perf.forEach(([year, grade, pct, kpi, comment]) => add('performance', { emp_id: e.emp_id, year, grade, company_percentile_top: pct, kpi_attainment_pct: kpi, evaluator_comment: comment, _source: '성과관리 시스템', _tier: T.SYS, _access: '인사 담당자 열람 권한 필요' }));
  e.projects.forEach(([title, from, to, purpose, role, did, tools, outputs, not_done, tier], i) => {
    const doc = `${e.emp_id}-EV-P${i + 1}`;
    add('projects', { emp_id: e.emp_id, title, from, to, purpose, role, did, tools, outputs, not_done, evidence_doc_id: tier === T.DOC ? doc : null, _source: '프로젝트 시스템 · 경력기술서', _tier: tier });
    if (tier === T.DOC) add('evidence_docs', { id: doc, emp_id: e.emp_id, type: '수행확인서', title: `${title} 수행확인서`, issued_at: to || '2026-10-01', status: '확인완료(시연)' });
  });
  e.skills.forEach(([skill, level]) => add('skills', { emp_id: e.emp_id, skill, level, _source: '스킬 인벤토리', _tier: T.SELF }));
  if (e.cdp) add('career_plans', { emp_id: e.emp_id, desired_jobs: e.cdp[0], long_term_goal: e.cdp[1], mobility_intent: e.cdp[2], updated_at: '2026-09-30', _source: '경력개발계획(CDP)', _tier: T.SELF });
  add('talent_pool_consents', { emp_id: e.emp_id, consented: e.consent, scope: e.consent ? '그룹 전체' : null, consented_at: e.consent ? '2026-03-02' : null, expires_at: e.consent ? '2027-03-01' : null, _source: '그룹 인재풀 등록', _note: '동의한 임직원만 계열사 간 스캔 대상' });
  add('availability', { emp_id: e.emp_id, start: e.avail?.[0] ?? null, max_ratio_pct: e.avail?.[1] ?? null, note: e.avail?.[2] ?? null, org_agreement: '협의 전', _source: '본인·소속 조직 입력', _tier: e.avail ? T.SELF : T.ASK });
}
DETAILED.forEach(emit);

FILLER_NAMES.forEach((name, i) => {
  const company = COMPANIES[i % COMPANIES.length];
  const [org, fam, job] = TEAMS[company][Math.floor(i / COMPANIES.length) % 3];
  const hy = between(2015, 2023);
  const emp_id = 'EMP-' + String(100 + i * 7).padStart(3, '0');
  const g = () => { const r = rnd(); const [grade] = GRADES.find(([, c]) => r <= c) || ['B']; return grade; };
  const tools = [pick(['SQL', 'Excel', 'Python', 'SAP']), pick(['Power BI', 'Tableau', 'Excel', 'R'])];
  emit({ emp_id, name, company, org, job_family: fam, job, grade_band: pick(['G2', 'G3', 'G4']), hire: d(hy, between(1, 12)), applied: rnd() > 0.85,
    appts: rnd() > 0.7 ? [[d(hy, 1), d(hy + 2, 12, 31), pick(TEAMS[company])[0], pick(TEAMS[company])[2], '입사'], [d(hy + 3, 1), null, org, job, '직무 전환']] : [[d(hy, 1), null, org, job, '입사']],
    certs: rnd() > 0.5 ? [[pick(['SQLD', 'ADsP', '정보처리기사', '재경관리사', 'PMP']), pick(['한국데이터산업진흥원', '한국산업인력공단', 'PMI']), d(between(2018, 2025), between(1, 12), 15), rnd() > 0.3 ? T.SYS : T.SELF]] : [],
    lms: rnd() > 0.4 ? [[pick(['데이터 리터러시', 'SQL 기초', '프로젝트 관리', '재무제표 이해']), pick(['데이터', '경영', '리더십']), between(4, 24), d(between(2022, 2026), between(1, 9), 20)]] : [],
    perf: [2024, 2025].map(y => { const grade = g(); return [y, grade, Math.round(rnd() * 100) / 100, between(85, 118), pick(['담당 업무를 안정적으로 수행함.', '유관 부서와의 협업이 원활함.', '개선 과제를 주도적으로 제안함.', '데이터 기반 보고 품질이 좋음.'])]; }),
    projects: rnd() > 0.3 ? [[pick(['업무 프로세스 개선', '보고 체계 정비', '데이터 정합성 점검', '비용 절감 TF']), d(2024, between(1, 6)), d(2024, between(7, 12), 28), '부서 과제', pick(['참여', '실무 담당', '리드']), ['관련 데이터 정리', '보고서 작성'], tools, ['결과 보고서'], [], rnd() > 0.5 ? T.DOC : T.SELF]] : [],
    skills: tools.map(t => [t, pick(['기초', '실무'])]),
    cdp: rnd() > 0.45 ? [[pick(['데이터 분석', '사업 기획', '재무 기획', '영업 기획', 'IT 기획'])], pick(['전문가 트랙', '관리자 트랙', '미정']), pick(['즉시', '1년 내', '없음'])] : null,
    consent: rnd() > 0.2, avail: null });
});

// ───── 직무 쪽 데이터 ─────
// 공고(jobs.json)는 직무.docx에서 data/sync-jobs.mjs가 만든다. 아래는 시연 공고 JD-014(한화오션 사업기획 및 사업관리)의 판단 기준 보조 데이터.
// NCS(국가직무능력표준) 형식을 본뜬 시연용 직무 표준 요약 — 실제 코드·문구가 아니다
const job_standards = [{ job_family: '경영관리 > 사업관리', _source: 'NCS 형식 시연용 요약(실제 NCS 원문 아님)', units: [
  { unit: '사업계획 수립', knowledge: ['사업성 분석', '원가 구조'], skills: ['사업계획서 작성', '손익 분석'], attitudes: ['정확성', '객관성'] },
  { unit: '경영정보 시각화', knowledge: ['대시보드 설계 원칙'], skills: ['BI 도구 활용'], attitudes: ['사용자 관점'] },
  { unit: '이해관계자 조율', knowledge: ['조직별 보고 체계'], skills: ['합의 도출', '정의서 문서화'], attitudes: ['협력', '설득'] }] }];
const high_performer_patterns = [{ job_family: '사업관리', sample_n: 12, min_sample_rule: 10, period: '2023~2025 상위 평가자 익명 집계', patterns: [
  { pattern: '프로젝트 일정·원가·손익을 함께 관리한 경험', share_pct: 75 },
  { pattern: 'ERP 원천 데이터로 실적을 직접 검증한 경험', share_pct: 83 },
  { pattern: 'BI 대시보드를 직접 구축·운영', share_pct: 58 }], _source: '인사 시스템(평가+경력) 익명 집계', _note: '표본 10명 미만이면 사용하지 않음' }];
const predecessor_notes = [{ job_id: 'JD-014', text: '프로젝트마다 원가 집계 기준이 달라 손익 비교가 가장 오래 걸렸음. 착수 초기에 원가·매출 인식 기준을 맞춰야 함. 도구보다 부서 간 조율이 병목.', _source: '현업 인터뷰 메모(개인 식별 정보 제외)' }];
// 표현이 달라도 같은 역량으로 묶는 동의어 사전
const skill_synonyms = [
  { canonical: '경영지표 시각화', aliases: ['BI 대시보드', 'Power BI 대시보드', '실적 대시보드', 'Tableau 대시보드', '경영 리포트 시각화'] },
  { canonical: 'SQL 데이터 검증', aliases: ['SQL 집계', '원장 대조', '데이터 정합성 점검', '쿼리 작성'] },
  { canonical: '지표 정의 합의', aliases: ['기준 조율', '정의서 정리', '표준 통일', 'KPI 정의 협의'] },
  { canonical: '매출·손익 분석', aliases: ['사업별 수주·매출 분석', '손익 차이 분석', '원가 분석', '실적 분석'] }];

const all = { ...tables, job_standards, high_performer_patterns, predecessor_notes, skill_synonyms };
for (const [k, v] of Object.entries(all)) fs.writeFileSync(path.join(OUT, `${k}.json`), JSON.stringify(v, null, 2) + '\n');
console.log(Object.entries(all).map(([k, v]) => `${k}: ${v.length}`).join('\n'));
