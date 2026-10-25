// 시연 주인공 임광현(EMP-HW-0019)을 인재풀에 넣는다. 팀이 만든 원본(CSV·applicants.jsonl)을 최대한 그대로 쓴다.
// 시나리오(다른 직무 도전)에 맞춰 바꾼 것: 현 소속 글로벌마케팅팀 → 해외사업팀(방산 수출 사업지원), 프로젝트 제목, 프로젝트 2의 산출물·성과(1과 중복),
// 역량 수준(전부 5 → 3~5), 2024·2026 평가 C → B, 영어 성적 추가, 참여 조건 통일. 검증 상태 문구는 뺀다.
// 지원서는 만들지 않는다(공모에 지원하지 않은 숨은 후보). clean/*.json에 추가하고 talent-link DB에도 넣는다.
// 실행: node data/hr_v3/add-protagonist.mjs   (VERCEL_TOKEN 필요 없음 · DB는 .env.local)
import '../scan/localenv.mjs';
import fs from 'node:fs';
import path from 'node:path';
import { select, insert } from '../../api/_lib/db.js';

const DIR = import.meta.dirname, ID = 'EMP-HW-0019';
const src = fs.readFileSync(path.join(DIR, 'applicants.jsonl'), 'utf8').split('\n').filter(Boolean).map(JSON.parse).find(x => x.application.emp === ID);
const F = src.application.fields, H = src.hris;
const RETEAM = s => String(s).replace('한화시스템 글로벌마케팅팀에서 과장 직급으로 글로벌 B2B 기술마케팅 책임 업무를', '한화시스템 해외사업팀에서 과장 직급으로 방산 수출 사업지원 업무를');
const tidy = s => String(s || '').replace(/\s*\((보유 주장·미검증|확인 필요|수료 이력 · 확인 필요)\)/g, '').replace(/\(보유 주장·미검증\)/g, '').trim();

const rows = {
  employees: [{ employee_id: ID, name: '임광현', company: '한화시스템', division: null, team: '해외사업팀', role: '방산 수출 사업지원 책임', grade: '과장', job_family: '영업',
    hire_date: '2011-04-12', tenure_months: 186, current_role_start: '2021-09-12', current_role_months: 61, relevant_experience_months: 88, location: '판교', desired_jd: 'JD-034', talent_pool: true,
    career_summary: RETEAM(F['자기소개서 — 경험 및 기여']).replaceAll('마케팅 및 제품전략 커뮤니케이션 | 제품 가치제안·전시회 캠페인', '해외사업 | 방산전자 해외 전시회 바이어 대응·제안 지원').replaceAll('마케팅 및 제품전략 커뮤니케이션 | 캠페인 리드·콘텐츠 데이터 분석', '해외사업 | 수출 리드 CRM·콘텐츠 데이터 분석'),
    interest: RETEAM(F['자기소개서 — 지원 동기']), strengths_and_gaps: F['자기소개서 — 한계 및 보완'], as_of: '2026-10-23',
    pool_available_from: '2026-12-01', pool_participation_pct: null, pool_location: '판교·창원 근무 협의 가능', org_status: '조직장 협의 전' }],
  assignments: H.assignments.map(a => ({ assignment_id: a.assignment_id, employee_id: ID, effective_date: a.effective_date, end_date: a.end_date || null, company: a.company, ...(a.team === '글로벌마케팅팀' ? { team: '해외사업팀', role: '방산 수출 사업지원 책임' } : { team: a.team, role: a.role }), change_type: a.change_type })),
  projects: [1, 2].map(i => ({ project_id: `PJT-${ID}-${i}`, employee_id: ID, company: '한화시스템',
    title: i === 1 ? '해외사업 | 방산전자 해외 전시회 바이어 대응·제안 지원' : '해외사업 | 수출 리드 CRM·콘텐츠 데이터 분석',
    start_date: i === 1 ? '2024-02-01' : '2025-02-01', end_date: i === 1 ? '2024-11-30' : '2025-11-30', role: '방산 수출 사업지원 책임',
    direct_contributions: i === 1 ? '방산전자·ICT 제품의 기술 가치제안, 해외 전시회 통합 캠페인, CRM 전환지표 운영을 직접 주도' : '방산전자·ICT 제품의 기술 가치제안, 해외 전시회 통합 캠페인, CRM 전환지표 운영을 직접 주도; 콘텐츠 KPI 검토 및 업무 담당자와 개선사항 조율',
    deliverable: i === 1 ? '제품 브로슈어·영문 세일즈키트·캠페인 KPI 대시보드' : '전시 후속 리드 분류 기준서·CRM 전환 대시보드·월간 리드 분석 리포트', not_performed: '고객 미팅 최종 계약 체결은 영업조직 책임',
    outcome: i === 1 ? '신규 해외 리드 112건, 유효 리드 54건, 영업기회 전환 18건 (내부 기록 기준)' : '리드 분류 기준 통일로 영업 이관 리드 중복 31% 감소, 콘텐츠별 문의 전환 월간 보고 정착' })),
};
rows.evidence = rows.projects.map((p, i) => ({ evidence_id: `EV-${ID}-${i + 1}`, employee_id: ID, project_id: p.project_id, evidence_type: '업무 수행 내역서', title: `${p.title} 업무 수행 내역서`, role: p.role, contributions: p.direct_contributions, deliverables: p.deliverable, results: p.outcome }));
rows.skills = [['B2B 마케팅', 3], ['제품 가치제안', 4], ['방산전자', 5], ['ICT', 4], ['CRM', 5], ['영문 콘텐츠', 4], ['Power BI', 4], ['시장분석', 4]].map(([skill, level], i) => ({ skill_record_id: `SK-${ID}-${i + 1}`, employee_id: ID, skill, level, basis: '프로젝트 수행 기반', context: rows.projects[0].title }));
rows.skill_development = [['B2B 마케팅', 2, 4], ['제품 가치제안', 2, 4]].map(([skill, f, t], i) => ({ development_id: `DEV-${ID}-${i + 1}`, employee_id: ID, skill, from_level: f, to_level: t, acquired_date: '2025-11-25', method: '프로젝트 참여 및 교육 이수' }));
rows.certifications = [{ certification_id: `CERT-${ID}-1`, employee_id: ID, certificate: tidy('데이터분석 준전문가(보유 주장·미검증)'), issuer: '한국데이터산업진흥원', obtained_date: '2024-09-13' },
  { certification_id: `CERT-${ID}-2`, employee_id: ID, certificate: 'OPIc IH', issuer: 'ACTFL', obtained_date: '2025-04-19' }];
rows.training = [['프로젝트 관리 전문', '2024-07-16', 24], ['B2B 마케팅 데이터 분석', '2025-07-16', 16], ['방산 산업 이해', '2026-07-16', 40]].map(([course, d, h], i) => ({ training_id: `TRN-${ID}-${i + 1}`, employee_id: ID, course, completion_date: d, hours: h }));
const perf = [[2016, 'CRM 데이터 품질', 101, 'B'], [2017, '영문 콘텐츠 납기', 110, 'B'], [2018, '제품 가치제안 개선', 92, 'B'], [2019, '고객 접점 확대', 115, 'A'], [2020, '유효 리드 발굴', 115, 'A'], [2021, '캠페인 목표 달성', 121, 'A'], [2022, '전시회 후속 상담', 138, 'S'], [2023, '콘텐츠 유입 성과', 100, 'B'], [2024, 'CRM 데이터 품질', 96, 'B'], [2025, '영문 콘텐츠 납기', 124, 'A'], [2026, '제품 가치제안 개선', 98, 'B']];
rows.performance = perf.map(([year, kpi, pct, grade], i) => ({ evaluation_id: `PERF-${ID}-${year}-${String(i + 1).padStart(2, '0')}`, employee_id: ID, year, kpi, kpi_target: 100, kpi_achievement_pct: pct, grade }));
rows.career_plans = [{ cdp_id: `CDP-${ID}`, employee_id: ID, desired_jd: 'JD-034', desired_role: '마케팅 및 제품전략 커뮤니케이션', development_goal: '방산·ICT 제품 마케팅 경험', plan: '고객 세분화·가치제안 심화 교육 및 현업 프로젝트 참여', target_date: '2027-06-30' }];

const H2 = { apikey: process.env.SUPABASE_SECRET_KEY, Authorization: `Bearer ${process.env.SUPABASE_SECRET_KEY}` };
// 이미 있으면 지우고(하위 기록은 cascade) 다시 넣는다
if ((await select('employees', `employee_id=eq.${ID}`)).length) await fetch(`${process.env.SUPABASE_URL}/rest/v1/employees?employee_id=eq.${ID}`, { method: 'DELETE', headers: H2 });
const have = 0;
for (const [t, list] of Object.entries(rows)) {
  const f = path.join(DIR, 'clean', t + '.json');
  const cur = JSON.parse(fs.readFileSync(f, 'utf8')).filter(r => r.employee_id !== ID);
  fs.writeFileSync(f, JSON.stringify(t === 'employees' ? [...cur, ...list].sort((a, b) => a.employee_id.localeCompare(b.employee_id)) : [...cur, ...list], null, 1));
  if (!have) await insert(t, list);
}
console.log(have ? 'DB에 이미 있음 · clean 파일만 갱신' : 'DB에 추가', Object.entries(rows).map(([t, l]) => `${t} ${l.length}`).join(' · '));
