// 인재풀 데이터 읽기 · 규칙 필터 · AI 판정 요청 만들기 · 점수(규칙) 계산
// 화면 API(api/*.js)와 미리 계산 스크립트(data/scan/precompute.mjs)가 함께 쓴다.
import { select } from './db.js';
import { JD_FAMILY } from '../../data/hr_v3/org.mjs';
import { EVAL_SYSTEM, ANALYZE_SYSTEM, MATCH_SCHEMAS as SCHEMAS } from './prompts.js';

export const AXES = ['직무경험', '업무 역량', '업무 성과', '성장 가능성', '커리어 적합성'];
export const LEVELS = ['매우 중요', '중요', '보통', '덜 중요'];
export const MODEL = () => process.env.CLAUDE_MODEL || 'claude-sonnet-5-5';
export const family = jd => JD_FAMILY[jd] || '마케팅';

const TABLES = ['assignments', 'projects', 'evidence', 'skills', 'skill_development', 'certifications', 'training', 'performance', 'career_plans'];

// 인재풀 전체(직원별 기록 묶음)
export async function loadPool(ids) {
  const f = ids ? `employee_id=in.(${ids.join(',')})` : '';
  const [emps, ...rest] = await Promise.all([select('employees', f + '&order=employee_id'), ...TABLES.map(t => select(t, f))]);
  const by = Object.fromEntries(emps.map(e => [e.employee_id, { ...e, ...Object.fromEntries(TABLES.map(t => [t, []])) }]));
  rest.forEach((rows, i) => rows.forEach(r => by[r.employee_id]?.[TABLES[i]].push(r)));
  return by;
}
export const activeApps = () => select('applications', 'cancelled_at=is.null&order=id');

// 참여 여건: 지원서가 있으면 지원서, 없으면 인재풀 등록 때 적은 이동 희망 조건
export function availability(e, app) {
  const a = app || { available_from: e.pool_available_from, participation_pct: e.pool_participation_pct, location: e.pool_location, org_status: e.org_status };
  if (!a.available_from) return '참여 가능 시점·투입 범위 회신 필요 · 소속 조직 협의 전';
  return `${a.available_from}부터 / 최대 ${a.participation_pct}% / ${a.location || '근무지 협의'} · ${a.org_status || '조직장 협의 전'}`;
}

// AI에 넘길 프로필 문장. 이름·직급·나이·성별은 넣지 않는다(판정에 쓰지 않음).
export function profileText(e, app) {
  const L = [];
  L.push(`현재: ${e.company} ${e.team} · ${e.role} / 근속 ${Math.floor(e.tenure_months / 12)}년 ${e.tenure_months % 12}개월, 현 직무 ${e.current_role_months}개월 / 근무지 ${e.location}`);
  if (e.career_summary) L.push(`경력 요약: ${e.career_summary.replace(/\n/g, ' ')}`);
  if (e.interest) L.push(`관심: ${e.interest}`);
  if (e.strengths_and_gaps) L.push(`강점·보완점(본인 기재): ${e.strengths_and_gaps}`);
  e.assignments.sort((a, b) => a.effective_date.localeCompare(b.effective_date)).forEach(a => L.push(`발령 이력: ${a.effective_date}~${a.end_date || '현재'} ${a.company} ${a.team} ${a.role} (${a.change_type})`));
  e.projects.forEach(p => {
    const ev = e.evidence.filter(v => v.project_id === p.project_id).map(v => v.evidence_type).join(', ');
    L.push(`프로젝트: ${p.title} (${p.start_date}~${p.end_date || '진행 중'}) / 역할 ${p.role} / 직접 수행: ${p.direct_contributions} / 산출물: ${p.deliverable} / 수행하지 않은 범위: ${p.not_performed || '-'} / 결과: ${p.outcome || '기록 없음'} / 증빙: ${ev || '없음(본인 기재)'}`);
  });
  if (e.skills.length) L.push('역량: ' + e.skills.map(s => `${s.skill}(Lv${s.level}, ${s.basis})`).join(', '));
  e.skill_development.forEach(d => L.push(`역량 향상: ${d.skill} Lv${d.from_level}→${d.to_level} (${d.acquired_date}, ${d.method})`));
  e.certifications.forEach(c => L.push(`자격(자격 대장): ${c.certificate} · ${c.issuer} · ${c.obtained_date}`));
  e.training.forEach(t => L.push(`교육 이력: ${t.course} (${t.completion_date}, ${t.hours}시간)`));
  e.performance.filter(p => p.year >= 2023).sort((a, b) => a.year - b.year).forEach(p => L.push(`평가 기록 ${p.year}: KPI "${p.kpi}" 달성률 ${p.kpi_achievement_pct}% · 등급 ${p.grade}`));
  e.career_plans.forEach(c => L.push(`커리어 계획: 희망 ${c.desired_role} / 목표 ${c.development_goal} / 계획 ${c.plan}`));
  L.push(`참여 여건: ${availability(e, app)}`);
  if (app) L.push(`이 공고 지원서 — 지원 동기: ${app.motive}`);
  return L.join('\n');
}

export function jobText(j) {
  return `${j.company} · ${j.title} (${j.id})\n담당 업무: ${j.tasks.join(' / ')}\n필수 요건: ${j.required.join(' / ')}\n우대 요건: ${j.preferred.join(' / ')}\n조건: ${j.conditions}`;
}

// ── 공고 분석 (JD + 참고 자료 → 요건·중요도 제안)
export function analyzeParams(job, ref) {
  const refs = ref ? {
    전임자_인수인계: { 사업: ref.business, 진행_업무: ref.handover?.tasks?.map(t => `${t.task}: ${t.handover} (주의: ${t.caution})`), 메모: ref.handover?.memos, 후임자_역량_키워드: ref.handover?.successor_keywords },
    고성과자_패턴: { 사례_수: ref.high_performers_sample_n, 패턴: ref.high_performers?.map(h => `${h.pattern} (${h.share_pct}%)`) },
    연구_요약: ref.research?.map(r => `${r.finding} → ${r.implication}`),
    연구_기반_행동_요건: ref.research_basis && { 직무군: ref.research_basis.family, 요지: ref.research_basis.focus, 출처: ref.research_basis.sources, 요건: ref.research_basis.traits.map(t => `${t.behavior}(${t.trait}) · 기본 중요도 ${t.level}`) },
  } : null;
  return {
    model: MODEL(), max_tokens: 6000,
    output_config: { effort: 'low', format: { type: 'json_schema', schema: SCHEMAS.analysis } },
    system: ANALYZE_SYSTEM,
    messages: [{ role: 'user', content: `[공고]\n${jobText(job)}\n\n[공고별 참고 자료]\n${JSON.stringify(refs, null, 1)}` }],
  };
}
// AI 결과 → 화면에서 쓰는 요건 목록(r1~)과 축 중요도
export function normalizeAnalysis(a) {
  return {
    pitch: a.pitch, needs: a.needs, rule_summary: a.rule_summary, synonym_example: a.synonym_example,
    reqs: a.requirements.map((r, i) => ({ id: 'r' + (i + 1), r: r.requirement, axis: r.axis, type: r.type, need: r.need, src: r.sources, terms: r.related_terms })),
    levels: AXES.map(x => Math.max(0, LEVELS.indexOf(a.axis_importance[x]))),
  };
}

// ── 규칙 필터: 1단계 공고 문구 일치, 2단계 AI가 뽑은 관련어(표현이 달라도 같은 경험)까지 넓혀 대조
const words = s => String(s || '').split(/[\s·,/()\-~·:;"'「」]+/).map(w => w.replace(/(및|등|관련|기반|역량|경험|지식|능력|활용|수행)$/g, '')).filter(w => w.length >= 2);
function haystack(e) {
  return [e.team, e.role, e.career_summary, e.interest, ...e.projects.map(p => `${p.title} ${p.direct_contributions} ${p.deliverable}`), ...e.skills.map(s => s.skill), ...e.certifications.map(c => c.certificate), ...e.training.map(t => t.course), ...e.career_plans.map(c => c.desired_role + ' ' + c.development_goal)].join(' ');
}
const jdWordsOf = job => [...new Set(words([job.title, ...job.tasks, ...job.required, ...job.preferred].join(' ')))];
const score1 = (job, jw, e, h) => jw.filter(w => h.includes(w)).length + (e.desired_jd === job.id ? 6 : family(e.desired_jd) === family(job.id) ? 3 : 0);
const score2 = (analysis, h) => { let s = 0; for (const r of analysis.reqs) for (const t of [r.r, ...(r.terms || [])].flatMap(words)) if (h.includes(t)) s += r.need === '필수' ? 2 : 1; return s };
// 한 사람과 공고의 규칙 근접도(임직원 홈의 "가까운 직무" 순서용)
export function ruleScore(job, analysis, e) { const h = haystack(e); return score1(job, jdWordsOf(job), e, h) + score2(analysis, h) }
export function prefilter(job, analysis, pool, apps, scope) {
  const jw = jdWordsOf(job);
  const people = Object.values(pool).filter(e => e.talent_pool && (!scope || scope.includes(e.company)));
  const applied = new Set(apps.filter(a => a.jd_id === job.id).map(a => a.employee_id));
  const s1 = people.map(e => { const h = haystack(e); return { e, h, s1: score1(job, jw, e, h) } }).sort((a, b) => b.s1 - a.s1);
  const n1 = Math.round(people.length * 0.25);
  const pass1 = s1.filter((x, i) => i < n1 || applied.has(x.e.employee_id));
  const s2 = pass1.map(x => ({ ...x, s2: x.s1 + score2(analysis, x.h) })).sort((a, b) => b.s2 - a.s2);
  const n2 = Math.min(30, s2.length);
  const pass2 = s2.filter((x, i) => i < n2 || applied.has(x.e.employee_id)).map(x => x.e.employee_id);
  return { total: people.length, pass1: pass1.length, pass2 };
}

// ── 후보 1명 판정 요청 (요건별 근거 확인 · 강점 · 우려 · 질문). 점수는 아래 규칙으로 계산한다.
export function evalParams(job, analysis, e, app) {
  const reqs = analysis.reqs.map(r => `${r.id} [${r.need}·${r.axis}] ${r.r}`).join('\n');
  return {
    model: MODEL(), max_tokens: 3000,
    output_config: { effort: 'low', format: { type: 'json_schema', schema: SCHEMAS.evaluation } },
    system: EVAL_SYSTEM,
    messages: [{ role: 'user', content: `[공고]\n${jobText(job)}\n\n[확정 요건]\n${reqs}\n\n[후보 기록]\n공모 지원: ${app ? '이 공고에 지원함' : '지원하지 않음(인재풀 등록)'}\n${profileText(e, app)}` }],
  };
}

const PT = { '확인': 92, '확인 필요': 64, '정보 미확인': 40 };
const GRADE = { S: 100, A: 88, B: 72, C: 55, D: 40 };
// 축 점수 = 요건 판정(65%) + 인사 기록 지표(35%). 정보가 없으면 중간값으로 둔다(부족으로 단정하지 않음).
export function axesOf(job, analysis, e, judged) {
  const st = Object.fromEntries(judged.requirements.map(r => [r.id, r.status]));
  const recent = e.performance.filter(p => p.year >= 2024);
  const sameFam = family(e.desired_jd) === family(job.id);
  const objective = {
    '직무경험': sameFam ? Math.min(98, 50 + e.relevant_experience_months * 0.5) : 52 + Math.min(20, e.current_role_months * 0.1),
    '업무 역량': 50 + Math.min(40, e.certifications.length * 8 + e.skills.filter(s => s.level >= 3).length * 6),
    '업무 성과': recent.length ? recent.reduce((a, p) => a + (GRADE[p.grade] ?? 60), 0) / recent.length : 60,
    '성장 가능성': 50 + Math.min(45, e.skill_development.length * 7 + e.training.filter(t => t.completion_date >= '2024').length * 6),
    '커리어 적합성': e.desired_jd === job.id ? 96 : sameFam ? 82 : 56,
  };
  return AXES.map(a => {
    const rs = analysis.reqs.filter(r => r.axis === a && st[r.id]);
    const req = rs.length ? rs.reduce((s, r) => s + PT[st[r.id]], 0) / rs.length : null;
    return Math.round(req === null ? objective[a] : req * 0.65 + objective[a] * 0.35);
  });
}

// 화면용 후보 카드
export function candidateOf(job, analysis, e, judged, app) {
  return {
    emp: e.employee_id, name: e.name, company: e.company, team: e.team, role: e.role, checked: e.as_of,
    applied: !!app, ax: axesOf(job, analysis, e, judged),
    req: Object.fromEntries(judged.requirements.map(r => [r.id, [r.status, r.evidence]])),
    strengths: judged.strengths, concerns: judged.concerns, questions: judged.questions, avail: availability(e, app),
  };
}

// 인사 콘솔 지원서 형식(원문 + 항목). a가 없으면 인재풀 프로필(이동 희망 조건 사용)
export function applicationRecord(a, e, job) {
  const p = e.projects[0] || {};
  const evid = e.evidence.map(v => `${v.title} / ${v.evidence_type} — 역할: ${v.role} / 수행: ${v.contributions} / 산출물: ${v.deliverables}`);
  const fields = {
    '사번': `${e.employee_id} / ${e.company} / ${e.team} / ${e.role}`,
    '경력': `${e.current_role_start} ~ 현재 / ${e.role} (현 직무 ${e.current_role_months}개월)`,
    '프로젝트': p.title ? `${p.title} (${p.start_date} ~ ${p.end_date || '진행 중'})` : '기재 없음',
    '목적·역할': p.role || '-',
    '직접 수행': e.projects.map(x => x.direct_contributions).join(' / ') || '-',
    '직접 사용 도구': e.skills.map(s => s.skill).slice(0, 5).join(' / ') || '-',
    '산출물': e.projects.map(x => x.deliverable).join(' / ') || '-',
    '수행하지 않은 범위': e.projects.map(x => x.not_performed).filter(Boolean).join(' / ') || '-',
    '역량': e.skills.map(s => `${s.skill} (Lv${s.level})`).join(' / ') || '기재 없음',
    '보유 자격증': e.certifications.map(c => `${c.certificate} | ${c.issuer} | ${c.obtained_date}`).join(' / ') || '없음',
    '교육': e.training.map(t => `${t.course} (${t.completion_date})`).join(' / ') || '기재 없음',
    ...(a ? { '자기소개서 — 지원 동기': a.motive } : { '커리어 계획': e.career_plans.map(c => `${c.desired_role} · ${c.development_goal}`).join(' / ') || '-' }),
    '참여': a ? `${a.available_from}부터 / 최대 ${a.participation_pct}% / ${a.location}` : availability(e).split(' · ')[0],
    '조직 승인': a ? a.org_status : (e.org_status || '조직장 협의 전'),
    '본인 프로필 확인일': e.as_of,
  };
  const id = a ? 'APP-' + String(a.id).padStart(3, '0') : e.employee_id;
  return {
    id, dbId: a ? a.id : null, name: e.name, jd: a ? a.jd_id : null, emp: e.employee_id, company: e.company, team: e.team, role: e.role, fields, evidence: evid,
    raw: [a ? `${id} | ${e.name} → ${a.jd_id}` : `${e.employee_id} | ${e.name} · 인재풀 프로필`, ...Object.entries(fields).map(([k, v]) => `${k}: ${v}`), ...evid].join('\n'),
    title: job?.title, motive: a?.motive || '', time: a ? new Date(a.created_at).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' }) : '',
    review: a ? (a.review || { stage: a.status || '미검토', owner: '', note: '', org: '협의 전', cert: '원문 상태 유지' }) : null,
  };
}

export const parseJSON = msg => JSON.parse(msg.content.filter(b => b.type === 'text').map(b => b.text).join(''));
