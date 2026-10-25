// 팀원 인사 데이터(V3) → 정리된 인재풀 데이터(data/hr_v3/clean/*.json)
// - 임광현(EMP-HW-0019)은 시연 스토리 확정 전까지 제외
// - 전원 "지원하지 않은 인재풀 인원" (지원서 없음, 희망 직무·자기소개는 프로필로)
// - 검증 상태 문구 삭제, 반복·중복 이름 교체
// - 기록이 부족한 인원은 희망 공고에 맞는 팀·프로젝트·성과를 Claude로 채운다 (결과는 enriched.json에 저장해 재사용)
// 실행: ANTHROPIC_API_KEY=... node data/hr_v3/build.mjs
import fs from 'node:fs';
import path from 'node:path';
import Anthropic from '@anthropic-ai/sdk';
import { TEAMS, FAMILY, JD_FAMILY, SITES } from './org.mjs';

const DIR = import.meta.dirname, OUT = path.join(DIR, 'clean');
const EXCLUDE = new Set(['EMP-HW-0019']);

function parseCSV(text) {
  const rows = []; let row = [], cell = '', q = false;
  text = text.replace(/^﻿/, '');
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) { if (c === '"') { if (text[i + 1] === '"') { cell += '"'; i++ } else q = false } else cell += c; continue }
    if (c === '"') q = true; else if (c === ',') { row.push(cell); cell = '' } else if (c === '\n') { row.push(cell.replace(/\r$/, '')); rows.push(row); row = []; cell = '' } else cell += c;
  }
  if (cell || row.length) { row.push(cell); rows.push(row) }
  const [head, ...body] = rows.filter(r => r.length > 1);
  return body.map(r => Object.fromEntries(head.map((h, i) => [h, r[i] ?? ''])));
}
const read = f => parseCSV(fs.readFileSync(path.join(DIR, f + '.csv'), 'utf8')).filter(r => !EXCLUDE.has(r.employee_id));
const T = Object.fromEntries(['employees', 'assignments', 'cdp', 'certifications', 'evidence', 'performance', 'projects', 'skills', 'skill_development', 'training'].map(f => [f, read(f)]));
const ESSAY = Object.fromEntries(fs.readFileSync(path.join(DIR, 'applicants.jsonl'), 'utf8').split('\n').filter(Boolean).map(l => JSON.parse(l).application).map(a => [a.emp, a.fields]));
const JOBS = Object.fromEntries(JSON.parse(fs.readFileSync(path.join(DIR, '../jobs.json'), 'utf8')).map(j => [j.id, j]));

// 검증 상태 표기 삭제
const clean = v => String(v ?? '')
  .replace(/\s*\(보유 주장·미검증\)/g, '').replace(/\s*\((?:확인|검토) 필요\)/g, '')
  .replace(/\s*[·\/]\s*(?:세부 조건 |담당자 |증빙 )?(?:확인|검토|검증) 필요/g, '')
  .replace(/\s*연도별 목표·산출물 원본 확인 필요/g, '').replace(/\s*\[ JD\]/g, '')
  .replace(/\s*\(내부 기록 기준\)/g, '').trim();
const hash = s => [...s].reduce((h, c) => Math.imul(h ^ c.charCodeAt(0), 16777619) >>> 0, 2166136261);
const ISSUER = { 'Google Analytics 교육 인증': 'Google', '컴퓨터활용능력 1급': '대한상공회의소', SQLD: '한국데이터산업진흥원', ADsP: '한국데이터산업진흥원', '데이터분석 준전문가': '한국데이터산업진흥원', 정보보안기사: '한국인터넷진흥원' };

// 이름: 같은 글자 반복·동명이인 교체 (사번 기준으로 고정)
const SUR = '김이박최정강조윤장임한오서신권황안송류홍전고문양손배백허남심노하곽성차주우구민나진지엄채원천방공현함변염여추도소석선설마길연위표명기반왕금옥육인맹제모탁국어은편용예봉경봉사부황보'.split('');
const GIV = ['민준', '서준', '도윤', '예준', '시우', '하준', '지호', '주원', '지훈', '건우', '우진', '선우', '서진', '민재', '현우', '연우', '유준', '정우', '승우', '승현', '시윤', '준혁', '은우', '지환', '승민', '서연', '서윤', '지우', '서현', '민서', '하은', '하윤', '윤서', '지민', '채원', '지원', '수아', '다은', '은서', '예은', '수빈', '소율', '예린', '지아', '유나', '혜원', '가은', '나윤', '태윤', '동현'];
const seen = new Set(), RENAMED = {};
for (const e of T.employees) {
  let n = e.name, k = 0;
  while (/(.)\1/.test(n) || seen.has(n)) { const h = hash(e.employee_id + k++); n = SUR[h % 40] + GIV[(h >>> 8) % GIV.length] }
  if (n !== e.name) RENAMED[e.employee_id] = [e.name, n];
  seen.add(n); e.name = n;
}

// 지정 이름: 희망 공고가 서로 다른 19명(계열사·직무 고르게)에게 순서대로 부여
const NAMED = ['강동구', '김도현', '공영찬', '김창섭', '박서연', '백진우', '신민규', '신채은', '김예주', '심현준', '안근호', '안찬호', '황성훈', '이지은', '이태연', '임민수', '최희정', '하성민', '성연재'];
const NAMED_JDS = ['JD-001', 'JD-004', 'JD-005', 'JD-006', 'JD-007', 'JD-014', 'JD-017', 'JD-018', 'JD-019', 'JD-020', 'JD-021', 'JD-022', 'JD-028', 'JD-029', 'JD-034', 'JD-035', 'JD-037', 'JD-039', 'JD-043'];
{
  const taken = new Set(NAMED);
  // 지정 이름과 겹치는 기존 인원은 다른 이름으로
  for (const e of T.employees) if (taken.has(e.name)) { let k = 0, n; do { const h = hash(e.employee_id + 'x' + k++); n = SUR[h % 40] + GIV[(h >>> 8) % GIV.length] } while (seen.has(n) || taken.has(n)); RENAMED[e.employee_id] = [RENAMED[e.employee_id]?.[0] || e.name, n]; seen.add(n); e.name = n }
  NAMED_JDS.forEach((jd, i) => { const e = T.employees.find(x => x.desired_jd === jd && !NAMED.includes(x.name)); RENAMED[e.employee_id] = [RENAMED[e.employee_id]?.[0] || e.name, NAMED[i]]; e.name = NAMED[i] });
}

// 기록이 부족한 인원 = 프로젝트 성과가 비어 있는 사람
const byEmp = (t, id) => T[t].filter(r => r.employee_id === id);
const thin = T.employees.filter(e => byEmp('projects', e.employee_id).some(p => !p.outcome));
const others = c => Object.keys(SITES).filter(x => x !== c);

// 소속: 희망 공고와 같은 계열사의 관련 팀, 일부(약 25%)는 다른 계열사의 같은 직무군 팀 → 계열사 간 이동 관심
for (const e of thin) {
  const jd = e.desired_jd, h = hash(e.employee_id);
  if (h % 4 === 0 && FAMILY[JD_FAMILY[jd]]) { const co = others(JOBS[jd].company)[(h >>> 4) % 2];[e.division, e.team, e.role] = FAMILY[JD_FAMILY[jd]][co]; e.company = co }
  else { e.company = JOBS[jd].company;[e.division, e.team, e.role] = TEAMS[jd][(h >>> 4) % TEAMS[jd].length] }
  e.current_location = SITES[e.company][(h >>> 8) % SITES[e.company].length];
}

// 팀 → 계열사 (공고 번호로 판단)
const teamCompany = {};
for (const [jd, list] of Object.entries(TEAMS)) for (const [d, t] of list) teamCompany[t + '|' + d] = JOBS[jd].company;

// ── Claude로 부족한 기록 채우기
const CACHE = path.join(DIR, 'enriched.json');
const cache = fs.existsSync(CACHE) ? JSON.parse(fs.readFileSync(CACHE, 'utf8')) : {};
const S = { type: 'string' }, N = { type: 'integer' }, A = x => ({ type: 'array', items: x }), O = p => ({ type: 'object', properties: p, required: Object.keys(p), additionalProperties: false });
const SCHEMA = O({
  career_summary: S, interest: S, strengths_and_gaps: S,
  prior_roles: A(O({ team: S, role: S })),
  projects: A(O({ title: S, role: S, direct_contributions: S, deliverable: S, not_performed: S, outcome: S })),
  skills: A(O({ skill: S, level: N, context: S })),
  kpis: A(S),
});
const SYSTEM = `당신은 한화 그룹 계열사(한화오션·한화시스템·한화에어로스페이스)의 인사 기록을 작성하는 HR 데이터 담당자입니다.
주어진 직원 한 명의 기본 정보에 맞춰, 실제 인사 시스템에 있을 법한 경력·프로젝트·역량 기록을 씁니다.
- 회사의 실제 사업(조선·해양·특수선 / 레이다·통신·전자광학·ICT / 항공엔진·지상방산·유도무기·우주)과 소속 팀의 업무에 맞게 구체적으로 씁니다.
- 직급·근속에 맞는 책임 범위로 씁니다. 사원·대리는 실무 수행, 과장·차장은 과제 리드, 부장은 조직·사업 단위 관리.
- 성과(outcome)는 측정 가능한 결과를 한 줄로 씁니다. 과장되지 않은 수치를 씁니다. 예: "도면 출도 지연 건수 월 12건→5건", "검사 리드타임 9일→6일".
- 사람마다 다른 경험이 되도록 프로젝트 소재를 다양하게 고릅니다. 회사의 공개된 제품·사업을 쓰되 기밀·계약 금액·고객사 내부 정보는 쓰지 않습니다.
- "확인 필요", "미검증", "검토 필요" 같은 검증 상태 표현과 "시연", "가상", "더미"는 쓰지 않습니다.
- career_summary: 본인 시점 2~3문장의 경력 소개. interest: 희망 직무에 관심을 갖게 된 이유 1~2문장. strengths_and_gaps: 강점과 아직 경험이 적은 부분 1~2문장.
- 이 직원은 공고에 지원하지 않은 그룹 인재풀 등록자입니다. "지원"이라는 표현을 쓰지 말고, 희망 직무에 대한 관심으로 씁니다.
- prior_roles: 현재 이전 발령의 팀·직무를 오래된 순으로, 요청한 개수만큼. 팀은 반드시 입력의 '같은계열사_팀목록' 중에서 고릅니다.
- 프로젝트는 반드시 현재 회사·팀(또는 이전 발령 팀)에서 실제로 했을 법한 일이어야 합니다. 기존기록의 프로젝트명은 참고만 하고, 회사·팀에 맞지 않으면 새 이름을 씁니다. 제목은 괄호 없이 짧게 씁니다.
- projects: 요청한 개수만큼, 기간 순서대로. not_performed는 본인이 하지 않은 범위 한 줄.
- skills: 4~6개, level은 1~5. kpis: 이 사람의 연도별 KPI 항목 이름 3~4개(예: "도면 출도 준수율").`;

async function enrich(e) {
  if (cache[e.employee_id]) return cache[e.employee_id];
  const j = JOBS[e.desired_jd], projs = byEmp('projects', e.employee_id), asg = byEmp('assignments', e.employee_id);
  const input = {
    직원: { 회사: e.company, 사업부: e.division, 팀: e.team, 직무: e.role, 직급: e.grade, 입사일: e.hire_date, 근속개월: e.tenure_months, 현직무시작: e.current_role_start, 근무지: e.current_location },
    희망공고: { 회사: j.company, 공고명: j.title, 담당업무: j.tasks, 필수: j.required, 우대: j.preferred },
    기존기록: { 프로젝트: projs.map(p => `${p.project_title} (${p.start_date}~${p.end_date}) ${p.direct_contributions}`), 역량: byEmp('skills', e.employee_id).map(s => s.skill), 자격: byEmp('certifications', e.employee_id).map(c => clean(c.certificate)), 교육: byEmp('training', e.employee_id).map(t => t.course) },
    같은계열사_팀목록: [...new Set(Object.values(TEAMS).flat().filter(([d, t]) => Object.values(TEAMS).some(() => true)).filter(([d, t, r]) => teamCompany[t + '|' + d] === e.company).map(([d, t]) => `${d} ${t}`))],
    요청: { prior_roles_개수: Math.max(0, asg.length - 1), projects_개수: projs.length, 프로젝트_기간: projs.map(p => `${p.start_date}~${p.end_date}`) },
  };
  const client = new Anthropic({ maxRetries: 4 });
  const res = await client.messages.create({
    model: 'claude-sonnet-5-5', max_tokens: 4000,
    output_config: { effort: 'low', format: { type: 'json_schema', schema: SCHEMA } },
    system: SYSTEM, messages: [{ role: 'user', content: JSON.stringify(input, null, 1) }],
  });
  const out = JSON.parse(res.content.filter(b => b.type === 'text').map(b => b.text).join(''));
  cache[e.employee_id] = out; fs.writeFileSync(CACHE, JSON.stringify(cache, null, 1));
  return out;
}
const LIMIT = +process.env.LIMIT || Infinity;
let done = 0; const queue = thin.slice(0, LIMIT);
await Promise.all(Array.from({ length: 8 }, async () => {
  while (queue.length) { const e = queue.shift(); try { await enrich(e) } catch (err) { console.error(e.employee_id, err.status || '', err.message) } if (++done % 20 === 0) console.log(`채움 ${done}/${thin.length}`) }
}));
const missing = thin.filter(e => !cache[e.employee_id]);
if (LIMIT !== Infinity) { console.log('LIMIT 시험 실행 — 생성만 하고 종료'); process.exit(0) }
if (missing.length) { console.error('미완료', missing.map(e => e.employee_id).join(', ')); process.exit(1) }

// ── 정리된 테이블 만들기
const db = {};
const thinSet = new Set(thin.map(e => e.employee_id));
db.employees = T.employees.map(e => {
  const x = cache[e.employee_id], f = ESSAY[e.employee_id] || {};
  return {
    employee_id: e.employee_id, name: e.name, company: e.company, division: e.division || null, team: e.team, role: e.role, grade: e.grade,
    hire_date: e.hire_date, tenure_months: +e.tenure_months, current_role_start: e.current_role_start, current_role_months: +e.current_role_months,
    relevant_experience_months: +e.relevant_experience_months, location: e.current_location, desired_jd: e.desired_jd, talent_pool: true,
    career_summary: x ? x.career_summary : clean(f['자기소개서 — 경험 및 기여']), interest: x ? x.interest : clean(f['자기소개서 — 지원 동기']),
    strengths_and_gaps: x ? x.strengths_and_gaps : clean(f['자기소개서 — 한계 및 보완']), as_of: e.as_of,
  };
});
const emp = Object.fromEntries(db.employees.map(e => [e.employee_id, e]));
db.assignments = Object.values(Object.groupBy(T.assignments, a => a.employee_id)).flatMap(list => list.map((a, i) => {
  const e = emp[a.employee_id], x = cache[a.employee_id], last = i === list.length - 1;
  const pr = x && !last ? x.prior_roles[i] : null;
  return { assignment_id: a.assignment_id, employee_id: a.employee_id, effective_date: a.effective_date, end_date: a.end_date || null, company: thinSet.has(a.employee_id) ? e.company : a.company,
    team: last ? e.team : pr ? pr.team : a.team, role: last ? e.role : pr ? pr.role : a.role, change_type: a.change_type };
}));
db.projects = T.projects.map(p => {
  const x = cache[p.employee_id]; const k = byEmp('projects', p.employee_id).indexOf(p); const g = x?.projects[k];
  return { project_id: p.project_id, employee_id: p.employee_id, company: emp[p.employee_id].company, title: g ? g.title : clean(p.project_title), start_date: p.start_date, end_date: p.end_date,
    role: g ? g.role : p.role, direct_contributions: g ? g.direct_contributions : clean(p.direct_contributions), deliverable: g ? g.deliverable : clean(p.deliverable),
    not_performed: g ? g.not_performed : clean(p.not_performed), outcome: g ? g.outcome : clean(p.outcome) };
});
const proj = Object.fromEntries(db.projects.map(p => [p.project_id, p]));
db.evidence = T.evidence.map(v => { const p = proj[v.project_id]; return { evidence_id: v.evidence_id, employee_id: v.employee_id, project_id: v.project_id, evidence_type: '수행확인서', title: `${p.title} 수행확인서`, role: p.role, contributions: p.direct_contributions, deliverables: p.deliverable, results: p.outcome } });
db.skills = Object.values(Object.groupBy(T.skills, s => s.employee_id)).flatMap(list => {
  const x = cache[list[0].employee_id];
  if (x) return x.skills.map((s, i) => ({ skill_record_id: `SK-${list[0].employee_id}-${i + 1}`, employee_id: list[0].employee_id, skill: s.skill, level: Math.min(5, Math.max(1, s.level)), basis: '프로젝트 수행 기반', context: s.context }));
  return list.map(s => ({ skill_record_id: s.skill_record_id, employee_id: s.employee_id, skill: s.skill, level: +s.level, basis: s.level_scale.includes('자가') ? '본인 기재' : '프로젝트 수행 기반', context: clean(s.experience_context) || null }));
});
db.skill_development = T.skill_development.map(d => ({ development_id: d.development_id, employee_id: d.employee_id, skill: d.skill, from_level: +d.from_level, to_level: +d.to_level, acquired_date: d.acquired_date, method: d.method }));
db.certifications = T.certifications.map(c => { const name = clean(c.certificate).replace(/^데이터분석 준전문가$/, 'ADsP'); return { certification_id: c.certification_id, employee_id: c.employee_id, certificate: name, issuer: ISSUER[name] || '한국산업인력공단', obtained_date: c.obtained_date } });
db.training = T.training.map(t => ({ training_id: t.training_id, employee_id: t.employee_id, course: t.course, completion_date: t.completion_date, hours: +t.hours }));
db.performance = T.performance.map(p => {
  const x = cache[p.employee_id]; const kpi = x ? x.kpis[(+p.year) % x.kpis.length] : clean(p.kpi_definition).split(' · ')[0];
  return { evaluation_id: p.evaluation_id, employee_id: p.employee_id, year: +p.year, kpi: kpi, kpi_target: +p.kpi_target, kpi_achievement_pct: +p.kpi_achievement_pct, grade: p.evaluation };
});
db.career_plans = T.cdp.map(c => ({ cdp_id: c.cdp_id, employee_id: c.employee_id, desired_jd: c.desired_jd, desired_role: JOBS[c.desired_jd]?.title || clean(c.desired_role), development_goal: clean(c.development_goal), plan: clean(c.plan), target_date: c.target_date }));

fs.mkdirSync(OUT, { recursive: true });
for (const [k, v] of Object.entries(db)) fs.writeFileSync(path.join(OUT, k + '.json'), JSON.stringify(v, null, 1));
fs.writeFileSync(path.join(OUT, '_renamed.json'), JSON.stringify(RENAMED, null, 1));
console.log(Object.entries(db).map(([k, v]) => `${k} ${v.length}`).join(' · '), `· 이름 교체 ${Object.keys(RENAMED).length} · 채운 인원 ${thin.length}`);
